/**
 * OneSignal Push Service
 *
 * Sends push notifications via OneSignal's REST API.
 * Handles web push (Phase 1) and native push (Phase 2) through one provider.
 *
 * Setup:
 * 1. Create a OneSignal app at onesignal.com
 * 2. Environment variables:
 *    - ONESIGNAL_APP_ID      — OneSignal App ID
 *    - ONESIGNAL_REST_API_KEY — OneSignal REST API Key (os_v2_app_...)
 */
import * as OneSignal from "@onesignal/node-onesignal";
import type { Logger } from "pino";

let client: OneSignal.DefaultApi | null = null;
let appId: string | null = null;
let initAttempted = false;

/**
 * Initialize OneSignal. Call once at server startup.
 * If credentials are missing, OneSignal push is silently disabled.
 */
export function initOneSignal(logger: Logger): void {
  if (initAttempted) return;
  initAttempted = true;

  const id = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!id || !apiKey) {
    logger.warn("[OneSignal] Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY — disabled");
    return;
  }

  const configuration = OneSignal.createConfiguration({
    restApiKey: apiKey,
  });
  client = new OneSignal.DefaultApi(configuration);
  appId = id;

  logger.info({ appId: id }, "[OneSignal] Initialized");
}

/**
 * Check if OneSignal is configured.
 */
export function isOneSignalEnabled(): boolean {
  return client !== null && appId !== null;
}

export interface OneSignalPushResult {
  success: boolean;
  notificationId?: string | undefined;
  recipients?: number | undefined;
  error?: string | undefined;
}

/**
 * Send a push notification to a specific user via their external_id (Supabase auth UUID).
 * OneSignal routes to all subscribed devices (web, iOS, Android) for that user.
 */
export async function sendOneSignalPush(
  externalUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  logger?: Logger,
): Promise<OneSignalPushResult> {
  if (!client || !appId) {
    return { success: false, error: "OneSignal not configured" };
  }

  try {
    const notification = new OneSignal.Notification();
    notification.app_id = appId;
    notification.include_aliases = { external_id: [externalUserId] };
    notification.target_channel = "push";
    notification.headings = { en: title };
    notification.contents = { en: body };
    if (data) {
      notification.data = data;
    }

    const result = await client.createNotification(notification);

    // Check for errors in response
    if (result.errors) {
      const errorMsg = typeof result.errors === "string" ? result.errors : JSON.stringify(result.errors);
      logger?.warn(
        { externalUserId, errors: result.errors },
        "[OneSignal] Push returned errors",
      );
      return { success: false, notificationId: result.id, error: errorMsg };
    }

    if (!result.id) {
      logger?.warn(
        { externalUserId },
        "[OneSignal] No notification ID returned — likely no recipients",
      );
      return { success: false, error: "no_notification_id" };
    }

    logger?.info(
      { notificationId: result.id },
      "[OneSignal] Push sent",
    );
    return { success: true, notificationId: result.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger?.error({ err, externalUserId }, "[OneSignal] Failed to send push");
    return { success: false, error };
  }
}
