// ---------------------------------------------------------------------------
// PushService — delivers push notifications via FCM (Android/web) and APNs (iOS)
// ---------------------------------------------------------------------------

import type { Logger } from "pino";
import type { AppConfig } from "../config.js";

export interface PushResult {
  success: boolean;
  /** Provider-specific message ID on success */
  providerMessageId?: string;
  /** Error reason on failure */
  error?: string;
  /** True if the token is permanently invalid and should be deactivated */
  tokenInvalid?: boolean;
}

export interface PushPayload {
  token: string;
  platform: "ios" | "android" | "web";
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushService {
  send(payload: PushPayload): Promise<PushResult>;
  isConfigured(): boolean;
}

// ---------------------------------------------------------------------------
// Real implementation
// ---------------------------------------------------------------------------

export function createPushService(config: AppConfig, logger: Logger): PushService {
  let fcmAccessToken: string | null = null;
  let fcmTokenExpiry = 0;
  let apnsProvider: import("@parse/node-apn").Provider | null = null;

  const hasFcm = !!(config.FCM_PROJECT_ID && config.FCM_CLIENT_EMAIL && config.FCM_PRIVATE_KEY);
  const hasApns = !!(config.APNS_KEY_BASE64 && config.APNS_KEY_ID && config.APNS_TEAM_ID && config.APNS_BUNDLE_ID);

  if (hasFcm) {
    logger.info("PushService: FCM configured for project %s", config.FCM_PROJECT_ID);
  }
  if (hasApns) {
    logger.info("PushService: APNs configured for bundle %s (%s)", config.APNS_BUNDLE_ID, config.APNS_PRODUCTION ? "production" : "sandbox");
  }

  async function getFcmAccessToken(): Promise<string> {
    if (fcmAccessToken && Date.now() < fcmTokenExpiry) return fcmAccessToken;

    // Use Google Auth Library to get OAuth2 token for FCM v1 API
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      credentials: {
        client_email: config.FCM_CLIENT_EMAIL,
        private_key: config.FCM_PRIVATE_KEY.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    fcmAccessToken = tokenResponse.token ?? null;
    fcmTokenExpiry = Date.now() + 50 * 60 * 1000; // refresh 10min before 60min expiry
    if (!fcmAccessToken) throw new Error("Failed to obtain FCM access token");
    return fcmAccessToken;
  }

  async function sendFcm(payload: PushPayload): Promise<PushResult> {
    if (!hasFcm) return { success: false, error: "FCM not configured" };

    try {
      const token = await getFcmAccessToken();
      const url = `https://fcm.googleapis.com/v1/projects/${config.FCM_PROJECT_ID}/messages:send`;

      const message: Record<string, unknown> = {
        token: payload.token,
        notification: { title: payload.title, body: payload.body },
      };
      if (payload.data) message.data = payload.data;

      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        const json = (await res.json()) as { name?: string };
        const result: PushResult = { success: true };
        if (json.name) result.providerMessageId = json.name;
        return result;
      }

      const errBody = (await res.json()) as { error?: { code?: number; status?: string; message?: string } };
      const errStatus = errBody.error?.status ?? "";
      const tokenInvalid = errStatus === "NOT_FOUND" || errStatus === "INVALID_ARGUMENT" || res.status === 404;

      return {
        success: false,
        error: `FCM ${res.status}: ${errBody.error?.message ?? "unknown"}`,
        tokenInvalid,
      };
    } catch (err) {
      return { success: false, error: `FCM error: ${(err as Error).message}` };
    }
  }

  async function getApnsProvider(): Promise<import("@parse/node-apn").Provider> {
    if (apnsProvider) return apnsProvider;

    const apn = await import("@parse/node-apn");
    const keyBuffer = Buffer.from(config.APNS_KEY_BASE64, "base64");

    apnsProvider = new apn.Provider({
      token: {
        key: keyBuffer,
        keyId: config.APNS_KEY_ID,
        teamId: config.APNS_TEAM_ID,
      },
      production: config.APNS_PRODUCTION,
    });
    return apnsProvider;
  }

  async function sendApns(payload: PushPayload): Promise<PushResult> {
    if (!hasApns) return { success: false, error: "APNs not configured" };

    try {
      const apn = await import("@parse/node-apn");
      const provider = await getApnsProvider();

      const notification = new apn.Notification();
      notification.alert = { title: payload.title, body: payload.body };
      notification.topic = config.APNS_BUNDLE_ID;
      notification.sound = "default";
      notification.pushType = "alert";
      if (payload.data) notification.payload = payload.data;

      const result = await provider.send(notification, payload.token);

      if (result.sent.length > 0) {
        const apnsResult: PushResult = { success: true };
        const device = result.sent[0]?.device;
        if (device) apnsResult.providerMessageId = device;
        return apnsResult;
      }

      const failure = result.failed[0];
      const reason = failure?.response?.reason ?? "unknown";
      // APNs 410 Gone = token is permanently invalid
      const tokenInvalid = reason === "Unregistered" || reason === "BadDeviceToken" || failure?.status === 410;

      return { success: false, error: `APNs: ${reason}`, tokenInvalid };
    } catch (err) {
      return { success: false, error: `APNs error: ${(err as Error).message}` };
    }
  }

  return {
    async send(payload: PushPayload): Promise<PushResult> {
      if (payload.platform === "ios") {
        return sendApns(payload);
      }
      // android and web both use FCM
      return sendFcm(payload);
    },

    isConfigured(): boolean {
      return hasFcm || hasApns;
    },
  };
}

// ---------------------------------------------------------------------------
// Noop implementation (for dev/test when no credentials are configured)
// ---------------------------------------------------------------------------

export function createNoopPushService(logger: Logger): PushService {
  logger.info("PushService: running in no-op mode (no push credentials configured)");
  return {
    async send(payload: PushPayload): Promise<PushResult> {
      logger.info({ token: payload.token.slice(0, 8) + "...", platform: payload.platform, title: payload.title }, "PushService [noop]: would send push");
      return { success: true, providerMessageId: `noop-${Date.now()}` };
    },
    isConfigured(): boolean {
      return false;
    },
  };
}
