import { randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { Notification } from "@rally/core";
import type { NotificationRepo } from "../repo/interfaces.js";
import { PACE_RULES } from "./paceRules.js";

interface QueueParams {
  playerId: string;
  matchId?: string;
  tournamentId?: string;
  type: string;
  subject: string;
  body: string;
}

export class NotificationService {
  constructor(
    private readonly repo: NotificationRepo,
    private readonly logger: Logger,
  ) {}

  /** Queue a notification with de-duplication and quiet hours. */
  async queueNotification(params: QueueParams): Promise<void> {
    // 1. De-duplicate: skip if same match+type already queued
    if (params.matchId) {
      const existing = await this.repo.findByMatchAndType(params.matchId, params.type);
      if (existing.length > 0) return;
    }

    // 2. Cooldown: skip if player got a notification in the last BATCH_COOLDOWN_HOURS
    const cooldownSince = new Date(Date.now() - PACE_RULES.BATCH_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
    const recent = await this.repo.findByPlayerSince(params.playerId, cooldownSince);
    // Only apply cooldown to reminder-type notifications (not transactional ones like N-30, N-44)
    const isReminder = params.type.includes("1") || params.type.includes("2") || params.type.includes("3");
    if (isReminder && recent.length > 0) return;

    // 3. Quiet hours: if current hour is in quiet window, schedule for next morning
    const now = new Date();
    const hour = now.getHours();
    let scheduledFor = now.toISOString();
    if (hour >= PACE_RULES.QUIET_HOURS_START || hour < PACE_RULES.QUIET_HOURS_END) {
      const next = new Date(now);
      if (hour >= PACE_RULES.QUIET_HOURS_START) {
        next.setDate(next.getDate() + 1);
      }
      next.setHours(PACE_RULES.QUIET_HOURS_END, 0, 0, 0);
      scheduledFor = next.toISOString();
    }

    const notification: Notification = {
      id: randomUUID(),
      playerId: params.playerId,
      type: params.type,
      subject: params.subject,
      body: params.body,
      channel: "email",
      status: "queued",
      scheduledFor,
      createdAt: now.toISOString(),
    };
    if (params.matchId) notification.matchId = params.matchId;
    if (params.tournamentId) notification.tournamentId = params.tournamentId;

    await this.repo.queue(notification);
  }

  /** Process queued notifications — V1 is log-only. */
  async processQueue(): Promise<void> {
    const pending = await this.repo.findPending(50);
    for (const n of pending) {
      // V1: Log-only — no email provider yet
      this.logger.info(
        { notificationId: n.id, playerId: n.playerId, type: n.type, subject: n.subject },
        "notification_sent",
      );
      await this.repo.markSent(n.id);
    }
  }
}
