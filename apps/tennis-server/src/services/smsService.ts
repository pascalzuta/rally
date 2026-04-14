/**
 * SMS Service — Twilio
 *
 * Sends SMS messages via the Twilio REST API.
 *
 * Setup requirements:
 * 1. Twilio account with an active phone number
 * 2. Environment variables:
 *    - TWILIO_ACCOUNT_SID   — Twilio account SID (starts with "AC")
 *    - TWILIO_AUTH_TOKEN    — Twilio auth token
 *    - TWILIO_PHONE_NUMBER  — Twilio sender number (E.164 format, e.g. +15005550006)
 */
import Twilio from "twilio";
import type { Logger } from "pino";

// Configuration (set by initSms)
let twilioClient: ReturnType<typeof Twilio> | null = null;
let fromNumber: string | null = null;
let authToken: string | null = null;

let initAttempted = false;

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Initialize the Twilio SMS service.
 * Call once at server startup. Safe to call multiple times.
 * If credentials are missing, SMS is silently disabled.
 */
export function initSms(logger: Logger): void {
  if (initAttempted) return;
  initAttempted = true;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !token || !phoneNumber) {
    logger.warn(
      "[SMS] Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER — SMS disabled",
    );
    return;
  }

  twilioClient = Twilio(accountSid, token);
  fromNumber = phoneNumber;
  authToken = token;

  logger.info({ from: phoneNumber }, "[SMS] Twilio SMS service initialized");
}

/**
 * Check if SMS is configured and available.
 */
export function isSmsEnabled(): boolean {
  return twilioClient !== null;
}

/**
 * Send a single SMS message.
 *
 * @param to   - Recipient phone number in E.164 format (e.g. +12125551234)
 * @param body - Plain text message body (ideally under 160 chars)
 */
export async function sendSms(
  to: string,
  body: string,
  logger?: Logger,
): Promise<SmsResult> {
  if (!twilioClient || !fromNumber) {
    return { success: false, error: "SMS not configured" };
  }

  try {
    const message = await twilioClient.messages.create({
      to,
      from: fromNumber,
      body,
    });

    logger?.info({ to, messageId: message.sid }, "[SMS] Message sent");
    return { success: true, messageId: message.sid };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger?.warn({ to, error }, "[SMS] Failed to send message");
    return { success: false, error };
  }
}

/**
 * Validate a Twilio webhook signature.
 * Use this to verify that incoming webhook requests genuinely came from Twilio.
 *
 * @param url       - Full URL of the webhook endpoint (must match exactly)
 * @param params    - POST params from the Twilio request body
 * @param signature - Value of the X-Twilio-Signature header
 */
export function validateTwilioWebhook(
  url: string,
  params: Record<string, string>,
  signature: string,
): boolean {
  if (!authToken) return false;
  return Twilio.validateRequest(authToken, signature, url, params);
}
