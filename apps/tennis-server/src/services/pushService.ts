/**
 * Push Notification Service
 *
 * Sends push notifications via Firebase Cloud Messaging (FCM v1 API).
 * Uses firebase-admin SDK for reliable delivery to iOS (APNs) and Android.
 *
 * Setup requirements:
 * 1. Firebase project created with FCM enabled
 * 2. APNs auth key (.p8) uploaded to Firebase Console
 * 3. GOOGLE_APPLICATION_CREDENTIALS_JSON env var set with service account JSON
 *
 * Token lifecycle:
 * - Tokens are registered by the Capacitor app via Supabase RPC (upsert_device_token)
 * - Stale tokens are cleaned up here when FCM returns "not registered" errors
 * - No time-based expiry — FCM tokens can be valid for months
 */
import type { Logger } from "pino";

// Firebase Admin types — dynamically imported to avoid hard dependency
// until firebase-admin is installed
interface FirebaseApp {
  messaging(): FirebaseMessaging;
}
interface FirebaseMessaging {
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}
interface MulticastMessage {
  tokens: string[];
  notification: { title: string; body: string };
  data?: Record<string, string>;
  apns?: {
    payload: {
      aps: {
        sound: string;
        badge?: number;
        'mutable-content'?: number;
      };
    };
  };
  android?: {
    priority: 'high' | 'normal';
    notification: { sound: string };
  };
}
interface BatchResponse {
  successCount: number;
  failureCount: number;
  responses: Array<{
    success: boolean;
    messageId?: string;
    error?: { code: string; message: string };
  }>;
}

let firebaseApp: FirebaseApp | null = null;
let initAttempted = false;

/**
 * Initialize Firebase Admin SDK.
 * Call once at server startup. Safe to call multiple times.
 * If credentials are missing, push notifications are silently disabled.
 */
export async function initFirebase(logger: Logger): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credJson) {
    logger.warn("[Push] No GOOGLE_APPLICATION_CREDENTIALS_JSON — push notifications disabled");
    return;
  }

  try {
    // Dynamic import so the server doesn't crash if firebase-admin isn't installed yet
    const admin = await import("firebase-admin");
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(credJson)),
    }) as unknown as FirebaseApp;
    logger.info("[Push] Firebase Admin initialized successfully");
  } catch (err) {
    logger.error({ err }, "[Push] Failed to initialize Firebase Admin");
  }
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  /** Tokens that FCM says are no longer valid — delete these from device_tokens */
  staleTokens: string[];
}

/**
 * Send a push notification to one or more device tokens.
 *
 * @param tokens - FCM device tokens (from device_tokens table)
 * @param title - Notification title (bold, ~40 chars)
 * @param body - Notification body (~80 chars, plain text)
 * @param data - Optional key-value payload for deep linking
 *               e.g. { route: '/bracket', matchId: 'abc-123', action: 'confirm-score' }
 */
export async function sendPush(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  logger?: Logger,
): Promise<PushResult> {
  if (!firebaseApp) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  const message: MulticastMessage = {
    tokens,
    notification: { title, body },
    data: data ?? {},
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
          "mutable-content": 1,
        },
      },
    },
    android: {
      priority: "high",
      notification: { sound: "default" },
    },
  };

  try {
    const response = await firebaseApp.messaging().sendEachForMulticast(message);

    const staleTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          staleTokens.push(tokens[idx]);
        }
        logger?.warn(
          { token: tokens[idx].slice(0, 20) + "...", errorCode: code },
          "[Push] Failed to send to token",
        );
      }
    });

    logger?.info(
      { success: response.successCount, failed: response.failureCount, stale: staleTokens.length },
      "[Push] Multicast result",
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      staleTokens,
    };
  } catch (err) {
    logger?.error({ err }, "[Push] sendEachForMulticast failed");
    return { successCount: 0, failureCount: tokens.length, staleTokens: [] };
  }
}

/**
 * Check if push notifications are configured and available.
 */
export function isPushEnabled(): boolean {
  return firebaseApp !== null;
}
