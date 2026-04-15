import { describe, it, expect } from "vitest";
import { createNoopPushService } from "../pushService.js";
import pino from "pino";

const logger = pino({ level: "silent" });

describe("PushService (noop)", () => {
  it("returns success for any payload", async () => {
    const svc = createNoopPushService(logger);

    const result = await svc.send({
      token: "fake-token-12345678",
      platform: "ios",
      title: "Test",
      body: "Hello",
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toMatch(/^noop-/);
  });

  it("reports not configured", () => {
    const svc = createNoopPushService(logger);
    expect(svc.isConfigured()).toBe(false);
  });

  it("routes android to FCM (noop)", async () => {
    const svc = createNoopPushService(logger);

    const result = await svc.send({
      token: "android-token",
      platform: "android",
      title: "Test",
      body: "Android push",
    });

    expect(result.success).toBe(true);
  });

  it("routes web to FCM (noop)", async () => {
    const svc = createNoopPushService(logger);

    const result = await svc.send({
      token: "web-token",
      platform: "web",
      title: "Test",
      body: "Web push",
    });

    expect(result.success).toBe(true);
  });
});
