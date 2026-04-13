import type { AppConfig } from "../config.js";
import type { PlayerRepo } from "../repo/interfaces.js";

let stripe: any = null;

export function initStripe(config: AppConfig): void {
  if (config.STRIPE_SECRET_KEY) {
    try {
      const Stripe = require("stripe");
      stripe = new Stripe(config.STRIPE_SECRET_KEY);
    } catch {
      console.warn("[Stripe] stripe package not installed, payment features disabled");
    }
  }
}

export function isStripeEnabled(): boolean {
  return stripe !== null;
}

export async function createCheckoutSession(
  config: AppConfig,
  playerId: string,
  email: string,
  plan: "monthly" | "yearly"
): Promise<string | null> {
  if (!stripe) return null;

  const priceId = plan === "monthly" ? config.STRIPE_PRICE_MONTHLY : config.STRIPE_PRICE_YEARLY;
  if (!priceId) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { playerId },
    success_url: `${config.CORS_ORIGIN}?subscription=success`,
    cancel_url: `${config.CORS_ORIGIN}?subscription=cancelled`,
  });

  return session.url;
}

export async function createPortalSession(
  playerId: string,
  config: AppConfig
): Promise<string | null> {
  if (!stripe) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: playerId,
    return_url: config.CORS_ORIGIN,
  });

  return session.url;
}

export function handleWebhookEvent(
  rawBody: string,
  signature: string,
  webhookSecret: string
): { type: string; data: Record<string, unknown> } | null {
  if (!webhookSecret || !stripe) return null;
  try {
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    return { type: event.type, data: (event.data as { object: Record<string, unknown> }).object };
  } catch {
    return null;
  }
}
