/**
 * Push Notification Service — Direct APNs (iOS-only)
 *
 * Sends push notifications via Apple Push Notification service (APNs)
 * using HTTP/2 with JWT (token-based) authentication.
 *
 * No Firebase dependency — communicates directly with APNs.
 *
 * Setup requirements:
 * 1. Apple Developer account with push entitlement
 * 2. APNs Auth Key (.p8) downloaded from Apple Developer portal
 * 3. Environment variables:
 *    - APNS_KEY_ID       — 10-char key ID from Apple
 *    - APNS_TEAM_ID      — 10-char team ID from Apple Developer account
 *    - APNS_KEY_BASE64   — Base64-encoded .p8 private key contents
 *    - APNS_BUNDLE_ID    — App bundle ID (default: com.playrally.app)
 *    - APNS_ENVIRONMENT  — "production" or "development" (default: development)
 *
 * Token lifecycle:
 * - Tokens are registered by the Capacitor app via Supabase RPC (upsert_device_token)
 * - Stale tokens are cleaned up here when APNs returns 410 (Unregistered) or 400 (BadDeviceToken)
 * - No time-based expiry — APNs tokens are valid until the app is uninstalled
 */
import { connect, type ClientHttp2Session, constants } from "node:http2";
import { createSign } from "node:crypto";
import type { Logger } from "pino";

const { HTTP2_HEADER_METHOD, HTTP2_HEADER_PATH, HTTP2_HEADER_STATUS } = constants;

// APNs endpoints
const APNS_HOST_PRODUCTION = "api.push.apple.com";
const APNS_HOST_SANDBOX = "api.sandbox.push.apple.com";

// JWT token cache — APNs JWTs are valid for up to 60 minutes
let cachedJwt: { token: string; expiresAt: number } | null = null;

// Reusable HTTP/2 connection
let http2Session: ClientHttp2Session | null = null;
let sessionHost: string | null = null;

// Configuration (set by init)
let apnsConfig: {
  keyId: string;
  teamId: string;
  privateKey: string;
  bundleId: string;
  host: string;
} | null = null;

let initAttempted = false;

/**
 * Initialize APNs push service.
 * Call once at server startup. Safe to call multiple times.
 * If credentials are missing, push notifications are silently disabled.
 */
export async function initPush(logger: Logger): Promise<void> {
  if (initAttempted) return;
  initAttempted = true;

  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const keyBase64 = process.env.APNS_KEY_BASE64;
  const bundleId = process.env.APNS_BUNDLE_ID ?? "com.playrally.app";
  const environment = process.env.APNS_ENVIRONMENT ?? "development";

  if (!keyId || !teamId || !keyBase64) {
    logger.warn(
      "[Push] Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_KEY_BASE64 — push notifications disabled",
    );
    return;
  }

  try {
    const privateKey = Buffer.from(keyBase64, "base64").toString("utf-8");

    // Validate the key looks like a PEM key
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Decoded APNS_KEY_BASE64 does not look like a PEM private key");
    }

    const host =
      environment === "production" ? APNS_HOST_PRODUCTION : APNS_HOST_SANDBOX;

    apnsConfig = { keyId, teamId, privateKey, bundleId, host };
    logger.info(
      { environment, bundleId, host },
      "[Push] APNs push service initialized",
    );
  } catch (err) {
    logger.error({ err }, "[Push] Failed to initialize APNs push service");
  }
}

/**
 * Generate a JWT for APNs authentication.
 * Tokens are cached for 50 minutes (APNs allows up to 60).
 */
function getApnsJwt(): string {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if still valid (with 10-min buffer)
  if (cachedJwt && cachedJwt.expiresAt > now) {
    return cachedJwt.token;
  }

  if (!apnsConfig) throw new Error("APNs not initialized");

  // APNs JWT header + payload
  const header = {
    alg: "ES256",
    kid: apnsConfig.keyId,
  };
  const payload = {
    iss: apnsConfig.teamId,
    iat: now,
  };

  // Build JWT manually using ES256 (P-256 ECDSA with SHA-256)
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const sign = createSign("SHA256");
  sign.update(signingInput);
  const derSignature = sign.sign(apnsConfig.privateKey);

  // Convert DER signature to raw r||s format (64 bytes) for JWT ES256
  const rawSignature = derToRaw(derSignature);
  const encodedSignature = base64url(rawSignature);

  const token = `${signingInput}.${encodedSignature}`;

  // Cache for 50 minutes
  cachedJwt = { token, expiresAt: now + 50 * 60 };

  return token;
}

/** Base64url encode (no padding) */
function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf.toString("base64url");
}

/** Convert DER-encoded ECDSA signature to raw r||s format (64 bytes for P-256) */
function derToRaw(derSig: Buffer): Buffer {
  // DER: 0x30 [total-len] 0x02 [r-len] [r] 0x02 [s-len] [s]
  let offset = 2; // skip 0x30 and total length

  // Read r
  if (derSig[offset] !== 0x02) throw new Error("Invalid DER signature");
  offset++;
  const rLen = derSig[offset]!;
  offset++;
  let r = derSig.subarray(offset, offset + rLen);
  offset += rLen;

  // Read s
  if (derSig[offset] !== 0x02) throw new Error("Invalid DER signature");
  offset++;
  const sLen = derSig[offset]!;
  offset++;
  let s = derSig.subarray(offset, offset + sLen);

  // Strip leading zeros (DER may add a 0x00 prefix for positive sign)
  if (r.length === 33 && r[0] === 0) r = r.subarray(1);
  if (s.length === 33 && s[0] === 0) s = s.subarray(1);

  // Pad to 32 bytes each
  const raw = Buffer.alloc(64);
  r.copy(raw, 32 - r.length);
  s.copy(raw, 64 - s.length);

  return raw;
}

/**
 * Get or create a reusable HTTP/2 session to APNs.
 */
function getHttp2Session(): ClientHttp2Session {
  if (!apnsConfig) throw new Error("APNs not initialized");

  if (http2Session && !http2Session.closed && !http2Session.destroyed && sessionHost === apnsConfig.host) {
    return http2Session;
  }

  // Clean up old session
  if (http2Session) {
    try { http2Session.close(); } catch { /* ignore */ }
  }

  http2Session = connect(`https://${apnsConfig.host}:443`);
  sessionHost = apnsConfig.host;

  http2Session.on("error", () => {
    http2Session = null;
    sessionHost = null;
  });

  http2Session.on("goaway", () => {
    http2Session = null;
    sessionHost = null;
  });

  return http2Session;
}

export interface PushResult {
  successCount: number;
  failureCount: number;
  /** Tokens that APNs says are no longer valid — delete these from device_tokens */
  staleTokens: string[];
}

/**
 * Send a push notification to one or more device tokens.
 *
 * @param tokens - APNs device tokens (hex strings from device_tokens table)
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
  if (!apnsConfig) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0, staleTokens: [] };
  }

  const jwt = getApnsJwt();
  const session = getHttp2Session();

  // APNs payload
  const payload = JSON.stringify({
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
      "mutable-content": 1,
    },
    ...(data ?? {}),
  });

  const results = await Promise.allSettled(
    tokens.map((token) => sendSinglePush(session, jwt, token, payload)),
  );

  let successCount = 0;
  let failureCount = 0;
  const staleTokens: string[] = [];

  results.forEach((result, idx) => {
    if (result.status === "fulfilled") {
      const { statusCode, reason } = result.value;
      if (statusCode === 200) {
        successCount++;
      } else {
        failureCount++;
        // 410 = Unregistered, 400 with BadDeviceToken = invalid token
        if (statusCode === 410 || reason === "BadDeviceToken") {
          staleTokens.push(tokens[idx]!);
        }
        logger?.warn(
          { token: tokens[idx]!.slice(0, 20) + "...", statusCode, reason },
          "[Push] Failed to send to token",
        );
      }
    } else {
      failureCount++;
      logger?.warn(
        { token: tokens[idx]!.slice(0, 20) + "...", error: result.reason },
        "[Push] Request failed for token",
      );
    }
  });

  logger?.info(
    { success: successCount, failed: failureCount, stale: staleTokens.length },
    "[Push] APNs send result",
  );

  return { successCount, failureCount, staleTokens };
}

/**
 * Send a single push notification via HTTP/2 to APNs.
 */
function sendSinglePush(
  session: ClientHttp2Session,
  jwt: string,
  token: string,
  payload: string,
): Promise<{ statusCode: number; reason?: string }> {
  return new Promise((resolve, reject) => {
    if (!apnsConfig) {
      reject(new Error("APNs not initialized"));
      return;
    }

    const req = session.request({
      [HTTP2_HEADER_METHOD]: "POST",
      [HTTP2_HEADER_PATH]: `/3/device/${token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": apnsConfig.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "apns-expiration": "0",
      "content-type": "application/json",
    });

    req.setEncoding("utf-8");
    let responseBody = "";

    req.on("response", (headers) => {
      const statusCode = Number(headers[HTTP2_HEADER_STATUS]) || 500;

      req.on("data", (chunk: string) => {
        responseBody += chunk;
      });

      req.on("end", () => {
        let reason: string | undefined = undefined;
        if (statusCode !== 200 && responseBody) {
          try {
            const parsed = JSON.parse(responseBody);
            reason = parsed.reason ?? undefined;
          } catch { /* ignore parse errors */ }
        }
        resolve(reason !== undefined ? { statusCode, reason } : { statusCode });
      });
    });

    req.on("error", reject);

    // 10 second timeout per request
    req.setTimeout(10_000, () => {
      req.close();
      reject(new Error("APNs request timeout"));
    });

    req.end(payload);
  });
}

/**
 * Check if push notifications are configured and available.
 */
export function isPushEnabled(): boolean {
  return apnsConfig !== null;
}

/**
 * Gracefully close the HTTP/2 session (call on server shutdown).
 */
export function closePushSession(): void {
  if (http2Session) {
    try { http2Session.close(); } catch { /* ignore */ }
    http2Session = null;
    sessionHost = null;
  }
}
