// ---------------------------------------------------------------------------
// NotificationService — real implementation replacing NoopNotificationService
// ---------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { Notification } from "@rally/core";
import type { NotificationRepo, NotificationDeliveryRepo, DeviceTokenRepo } from "../repo/interfaces.js";
import type { PushService } from "./pushService.js";
import { NOTIFICATION_TEMPLATES, PHASE1_TEMPLATES, type NotificationType } from "./notificationTemplates.js";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [30_000, 120_000, 600_000]; // 30s, 2min, 10min

export interface NotificationServiceDeps {
  notifications: NotificationRepo;
  notificationDeliveries: NotificationDeliveryRepo;
  deviceTokens: DeviceTokenRepo;
  pushService: PushService;
  logger: Logger;
}

export interface QueueParams {
  playerId: string;
  matchId?: string;
  tournamentId?: string;
  type: string;
  subject: string;
  body: string;
}

export interface NotificationServiceInterface {
  queueNotification(params: QueueParams): Promise<void>;
  processQueue(): Promise<void>;
}

export function createNotificationService(deps: NotificationServiceDeps): NotificationServiceInterface {
  const { notifications, notificationDeliveries, deviceTokens, pushService, logger } = deps;

  async function queueNotification(params: QueueParams): Promise<void> {
    // Template gate: only Phase 1 templates produce real notifications
    if (!PHASE1_TEMPLATES.has(params.type as NotificationType)) {
      logger.debug({ type: params.type }, "notification type not in Phase 1 allow-list, skipping");
      return;
    }

    // De-duplication: check for existing notification with same match+type in last 6 hours
    if (params.matchId) {
      const existing = await notifications.findByMatchAndType(params.matchId, params.type);
      const sixHoursAgo = new Date(Date.now() - SIX_HOURS_MS).toISOString();
      const recent = existing.find((n) => n.createdAt >= sixHoursAgo);
      if (recent) {
        logger.debug({ matchId: params.matchId, type: params.type }, "duplicate notification suppressed");
        return;
      }
    }

    const now = new Date().toISOString();
    const notification: Notification = {
      id: randomUUID(),
      playerId: params.playerId,
      type: params.type,
      subject: params.subject,
      body: params.body,
      channel: "push",
      status: "queued",
      scheduledFor: now,
      retryCount: 0,
      createdAt: now,
    };
    if (params.matchId) notification.matchId = params.matchId;
    if (params.tournamentId) notification.tournamentId = params.tournamentId;

    await notifications.queue(notification);
    logger.info({ id: notification.id, type: params.type, playerId: params.playerId }, "notification queued");
  }

  async function processQueue(): Promise<void> {
    // claimPending handles lease recovery (reclaims stuck 'processing' rows > 5min)
    // and atomic claiming of new 'queued' rows
    const batch = await notifications.claimPending(50);
    if (batch.length === 0) return;

    logger.info({ count: batch.length }, "processing notification batch");

    for (const notification of batch) {
      try {
        await deliverNotification(notification);
      } catch (err) {
        logger.error({ id: notification.id, err }, "unexpected error delivering notification");
        await notifications.markFailed(notification.id);
      }
    }
  }

  async function deliverNotification(notification: Notification): Promise<void> {
    // Look up all active device tokens for this player
    const tokens = await deviceTokens.findActiveByPlayerId(notification.playerId);

    if (tokens.length === 0) {
      logger.warn({ playerId: notification.playerId, notificationId: notification.id }, "player has no active device tokens");
      await notifications.markFailed(notification.id);
      return;
    }

    // Resolve push-friendly title/body from template if available
    const templateFn = NOTIFICATION_TEMPLATES[notification.type as NotificationType];
    let pushTitle = notification.subject;
    let pushBody = stripHtml(notification.body);

    if (templateFn && notification.metadata) {
      try {
        const content = templateFn(notification.metadata as never);
        if (content.pushTitle) pushTitle = content.pushTitle;
        if (content.pushBody) pushBody = content.pushBody;
      } catch {
        // Fall back to subject/stripped body
      }
    }

    let anySuccess = false;

    // Deliver to ALL active tokens (phone + tablet + web)
    for (const token of tokens) {
      const deliveryId = randomUUID();

      const result = await pushService.send({
        token: token.token,
        platform: token.platform,
        title: pushTitle,
        body: pushBody,
        data: {
          notificationId: notification.id,
          type: notification.type,
          ...(notification.matchId ? { matchId: notification.matchId } : {}),
          ...(notification.tournamentId ? { tournamentId: notification.tournamentId } : {}),
        },
      });

      // Create delivery record per token
      const delivery: import("@rally/core").NotificationDelivery = {
        id: deliveryId,
        notificationId: notification.id,
        channel: "push",
        status: result.success ? "push_sent" : "delivery_failed",
        createdAt: new Date().toISOString(),
      };
      if (result.providerMessageId) delivery.providerMessageId = result.providerMessageId;
      if (result.success) delivery.pushSentAt = new Date().toISOString();
      if (result.error) delivery.failureReason = result.error;

      await notificationDeliveries.create(delivery);

      if (result.success) {
        anySuccess = true;
      }

      // Deactivate permanently invalid tokens
      if (result.tokenInvalid) {
        logger.warn({ token: token.token.slice(0, 8) + "...", platform: token.platform }, "deactivating invalid device token");
        await deviceTokens.deactivate(token.token);
      }
    }

    if (anySuccess) {
      await notifications.markSent(notification.id);
    } else {
      // All tokens failed. Retry with backoff if under max retries.
      if (notification.retryCount < MAX_RETRIES) {
        const delay = RETRY_DELAYS_MS[notification.retryCount] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
        const retryAt = new Date(Date.now() + delay).toISOString();
        logger.info({ id: notification.id, retryCount: notification.retryCount + 1, retryAt }, "scheduling retry");
        // Requeue by updating status back to queued with future scheduled_for
        await requeue(notification.id, notification.retryCount + 1, retryAt);
      } else {
        logger.warn({ id: notification.id }, "notification failed after max retries");
        await notifications.markFailed(notification.id);
      }
    }
  }

  async function requeue(id: string, retryCount: number, scheduledFor: string): Promise<void> {
    await notifications.requeue(id, retryCount, scheduledFor);
  }

  return { queueNotification, processQueue };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
