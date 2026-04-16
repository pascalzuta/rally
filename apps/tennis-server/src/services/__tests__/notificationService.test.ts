import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNotificationService } from "../notificationService.js";
import type { NotificationServiceDeps } from "../notificationService.js";
import type { Notification, NotificationDelivery } from "@rally/core";
import type { NotificationRepo, NotificationDeliveryRepo, DeviceTokenRepo, DeviceToken } from "../../repo/interfaces.js";
import type { PushService, PushResult } from "../pushService.js";
import pino from "pino";

const logger = pino({ level: "silent" });

function makeToken(overrides: Partial<DeviceToken> = {}): DeviceToken {
  return {
    id: "tok-1",
    playerId: "player-1",
    token: "device-token-abc",
    platform: "ios",
    active: true,
    consecutiveFailures: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<NotificationServiceDeps> = {}): NotificationServiceDeps {
  const notificationStore: Notification[] = [];

  const notifications: NotificationRepo = {
    queue: vi.fn(async (n: Notification) => { notificationStore.push(n); }),
    findPending: vi.fn(async () => []),
    claimPending: vi.fn(async () => []),
    markSent: vi.fn(async () => {}),
    markFailed: vi.fn(async () => {}),
    requeue: vi.fn(async () => {}),
    findByMatchAndType: vi.fn(async () => []),
    findByPlayerSince: vi.fn(async () => []),
  };

  const notificationDeliveries: NotificationDeliveryRepo = {
    create: vi.fn(async () => {}),
    findByNotificationId: vi.fn(async () => null),
    updateStatus: vi.fn(async () => {}),
    findPendingEscalations: vi.fn(async () => []),
    acknowledge: vi.fn(async () => {}),
  };

  const deviceTokens: DeviceTokenRepo = {
    findActiveByPlayerId: vi.fn(async () => [makeToken()]),
    findByPlayerId: vi.fn(async () => [makeToken()]),
    deactivate: vi.fn(async () => {}),
    deleteByToken: vi.fn(async () => {}),
  };

  const pushService: PushService = {
    send: vi.fn(async (): Promise<PushResult> => ({ success: true, providerMessageId: "msg-1" })),
    isConfigured: () => true,
  };

  return { notifications, notificationDeliveries, deviceTokens, pushService, logger, ...overrides };
}

describe("NotificationService", () => {
  describe("queueNotification", () => {
    it("queues Phase 1 template types", async () => {
      const deps = makeDeps();
      const svc = createNotificationService(deps);

      await svc.queueNotification({
        playerId: "player-1",
        matchId: "match-1",
        tournamentId: "t-1",
        type: "N-01",
        subject: "Tournament started",
        body: "Your tournament is live",
      });

      expect(deps.notifications.queue).toHaveBeenCalledTimes(1);
    });

    it("silently drops non-Phase-1 template types", async () => {
      const deps = makeDeps();
      const svc = createNotificationService(deps);

      await svc.queueNotification({
        playerId: "player-1",
        matchId: "match-1",
        type: "N-04", // Tournament Complete — not in Phase 1
        subject: "Complete",
        body: "Done",
      });

      expect(deps.notifications.queue).not.toHaveBeenCalled();
    });

    it("suppresses duplicate match+type within 6 hours", async () => {
      const deps = makeDeps();
      // Return an existing recent notification
      (deps.notifications.findByMatchAndType as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "existing-1", createdAt: new Date().toISOString(), type: "N-01", matchId: "match-1" },
      ]);
      const svc = createNotificationService(deps);

      await svc.queueNotification({
        playerId: "player-1",
        matchId: "match-1",
        type: "N-01",
        subject: "Tournament started",
        body: "again",
      });

      expect(deps.notifications.queue).not.toHaveBeenCalled();
    });

    it("allows same match+type after 6 hours", async () => {
      const deps = makeDeps();
      const sevenHoursAgo = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
      (deps.notifications.findByMatchAndType as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: "old-1", createdAt: sevenHoursAgo, type: "N-01", matchId: "match-1" },
      ]);
      const svc = createNotificationService(deps);

      await svc.queueNotification({
        playerId: "player-1",
        matchId: "match-1",
        type: "N-01",
        subject: "Tournament started",
        body: "ok now",
      });

      expect(deps.notifications.queue).toHaveBeenCalledTimes(1);
    });
  });

  describe("processQueue", () => {
    it("delivers to all active tokens and marks sent", async () => {
      const token1 = makeToken({ id: "tok-1", token: "aaa", platform: "ios" });
      const token2 = makeToken({ id: "tok-2", token: "bbb", platform: "web" });
      const deps = makeDeps();
      (deps.deviceTokens.findActiveByPlayerId as ReturnType<typeof vi.fn>).mockResolvedValue([token1, token2]);
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "n-1",
          playerId: "player-1",
          type: "N-01",
          subject: "Test",
          body: "Body",
          channel: "push",
          status: "processing",
          scheduledFor: new Date().toISOString(),
          retryCount: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      // Should send to both tokens
      expect(deps.pushService.send).toHaveBeenCalledTimes(2);
      // Should create 2 delivery records
      expect(deps.notificationDeliveries.create).toHaveBeenCalledTimes(2);
      // Should mark notification as sent
      expect(deps.notifications.markSent).toHaveBeenCalledWith("n-1");
    });

    it("deactivates invalid tokens on APNs 410", async () => {
      const deps = makeDeps();
      (deps.pushService.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "APNs: Unregistered",
        tokenInvalid: true,
      });
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "n-2",
          playerId: "player-1",
          type: "N-42",
          subject: "Score",
          body: "Score submitted",
          channel: "push",
          status: "processing",
          scheduledFor: new Date().toISOString(),
          retryCount: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      expect(deps.deviceTokens.deactivate).toHaveBeenCalledWith("device-token-abc");
    });

    it("requeues with incremented retry count on all-token failure", async () => {
      const deps = makeDeps();
      (deps.pushService.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "FCM 500: internal",
      });
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "n-3",
          playerId: "player-1",
          type: "N-30",
          subject: "Match",
          body: "Confirmed",
          channel: "push",
          status: "processing",
          scheduledFor: new Date().toISOString(),
          retryCount: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      expect(deps.notifications.requeue).toHaveBeenCalledWith("n-3", 1, expect.any(String));
    });

    it("marks failed after max retries", async () => {
      const deps = makeDeps();
      (deps.pushService.send as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: "FCM 500: internal",
      });
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "n-4",
          playerId: "player-1",
          type: "N-40",
          subject: "Score",
          body: "Reminder",
          channel: "push",
          status: "processing",
          scheduledFor: new Date().toISOString(),
          retryCount: 3, // Already at max
          createdAt: new Date().toISOString(),
        },
      ]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      expect(deps.notifications.markFailed).toHaveBeenCalledWith("n-4");
      expect(deps.notifications.requeue).not.toHaveBeenCalled();
    });

    it("marks failed when player has no active tokens", async () => {
      const deps = makeDeps();
      (deps.deviceTokens.findActiveByPlayerId as ReturnType<typeof vi.fn>).mockResolvedValue([]);
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([
        {
          id: "n-5",
          playerId: "player-no-tokens",
          type: "N-01",
          subject: "Test",
          body: "Body",
          channel: "push",
          status: "processing",
          scheduledFor: new Date().toISOString(),
          retryCount: 0,
          createdAt: new Date().toISOString(),
        },
      ]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      expect(deps.notifications.markFailed).toHaveBeenCalledWith("n-5");
      expect(deps.pushService.send).not.toHaveBeenCalled();
    });

    it("does nothing when queue is empty", async () => {
      const deps = makeDeps();
      (deps.notifications.claimPending as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const svc = createNotificationService(deps);
      await svc.processQueue();

      expect(deps.pushService.send).not.toHaveBeenCalled();
    });
  });
});
