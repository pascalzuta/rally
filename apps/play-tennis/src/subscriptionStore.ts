import { Subscription, SubscriptionPlan, PremiumFeature } from './types'
import { getClient } from './supabase'

const SUBSCRIPTION_KEY = 'rally-subscription'

const TRIAL_MATCHES_MAX = 5

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function loadSubscription(): Subscription | null {
  try {
    const data = localStorage.getItem(SUBSCRIPTION_KEY)
    return data ? (JSON.parse(data) as Subscription) : null
  } catch {
    return null
  }
}

function saveSubscription(sub: Subscription): void {
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub))
}

// --- Public API ---

export function getSubscription(): Subscription | null {
  return loadSubscription()
}

export function isPro(): boolean {
  const sub = loadSubscription()
  if (!sub) return false
  return (
    (sub.plan === 'pro_monthly' || sub.plan === 'pro_annual') &&
    sub.status === 'active'
  )
}

export function isTrialActive(): boolean {
  const sub = loadSubscription()
  if (!sub || sub.plan !== 'trial') return false
  if (sub.status !== 'trialing' && sub.status !== 'active') return false
  // Check trial matches remaining
  if (sub.trialMatchesUsed >= sub.trialMatchesMax) return false
  // Check trial expiry date if set
  if (sub.trialEndsAt && new Date(sub.trialEndsAt) <= new Date()) return false
  return true
}

export function getTrialMatchesRemaining(): number {
  const sub = loadSubscription()
  if (!sub || sub.plan !== 'trial') return 0
  return Math.max(0, sub.trialMatchesMax - sub.trialMatchesUsed)
}

export function canAccessFeature(feature: PremiumFeature): boolean {
  if (isPro()) return true
  if (isTrialActive()) return true
  return false
}

export async function startTrial(): Promise<Subscription> {
  const existing = loadSubscription()
  const playerId = existing?.playerId ?? ''
  const now = new Date()
  const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  const sub: Subscription = {
    id: existing?.id ?? generateId(),
    playerId,
    plan: 'trial',
    status: 'trialing',
    trialMatchesUsed: 0,
    trialMatchesMax: TRIAL_MATCHES_MAX,
    trialStartedAt: now.toISOString(),
    trialEndsAt: trialEnd.toISOString(),
    createdAt: existing?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
  }

  saveSubscription(sub)

  // Sync to Supabase
  const client = getClient()
  if (client && playerId) {
    await client
      .from('subscriptions')
      .upsert({
        id: sub.id,
        player_id: sub.playerId,
        plan: sub.plan,
        status: sub.status,
        trial_matches_used: sub.trialMatchesUsed,
        trial_matches_max: sub.trialMatchesMax,
        trial_started_at: sub.trialStartedAt,
        trial_ends_at: sub.trialEndsAt,
        created_at: sub.createdAt,
        updated_at: sub.updatedAt,
      })
      .then(({ error }) => {
        if (error) console.warn('[Rally] Failed to sync subscription:', error.message)
      })
  }

  return sub
}

export async function consumeTrialMatch(): Promise<Subscription> {
  const sub = loadSubscription()
  if (!sub) throw new Error('No subscription found')

  const updated: Subscription = {
    ...sub,
    trialMatchesUsed: sub.trialMatchesUsed + 1,
    updatedAt: new Date().toISOString(),
  }

  saveSubscription(updated)

  const client = getClient()
  if (client && updated.playerId) {
    await client
      .from('subscriptions')
      .update({
        trial_matches_used: updated.trialMatchesUsed,
        updated_at: updated.updatedAt,
      })
      .eq('id', updated.id)
      .then(({ error }) => {
        if (error) console.warn('[Rally] Failed to update trial usage:', error.message)
      })
  }

  return updated
}

/** Initialize a free subscription record for a new player */
export function initFreeSubscription(playerId: string): Subscription {
  const existing = loadSubscription()
  if (existing) {
    if (!existing.playerId) {
      const updated = { ...existing, playerId, updatedAt: new Date().toISOString() }
      saveSubscription(updated)
      return updated
    }
    return existing
  }
  const now = new Date().toISOString()
  const sub: Subscription = {
    id: generateId(),
    playerId,
    plan: 'free',
    status: 'active',
    trialMatchesUsed: 0,
    trialMatchesMax: TRIAL_MATCHES_MAX,
    createdAt: now,
    updatedAt: now,
  }
  saveSubscription(sub)
  return sub
}

/** Stub for Stripe checkout session (Phase 8) */
export async function createCheckoutSession(plan: 'monthly' | 'annual'): Promise<string> {
  // Phase 8: call backend to create Stripe session and return URL
  console.warn('[Rally] Stripe checkout not yet implemented for plan:', plan)
  return ''
}

/** Handle subscription update from webhook/Stripe (Phase 8) */
export async function handleSubscriptionUpdate(data: Record<string, unknown>): Promise<void> {
  const sub = loadSubscription()
  if (!sub) return

  const planMap: Record<string, SubscriptionPlan> = {
    monthly: 'pro_monthly',
    annual: 'pro_annual',
  }

  const newPlan = planMap[data.plan as string] ?? sub.plan
  const updated: Subscription = {
    ...sub,
    plan: newPlan,
    status: (data.status as Subscription['status']) ?? sub.status,
    currentPeriodStart: (data.current_period_start as string) ?? sub.currentPeriodStart,
    currentPeriodEnd: (data.current_period_end as string) ?? sub.currentPeriodEnd,
    cancelAtPeriodEnd: (data.cancel_at_period_end as boolean) ?? sub.cancelAtPeriodEnd,
    stripeCustomerId: (data.stripe_customer_id as string) ?? sub.stripeCustomerId,
    stripeSubscriptionId: (data.stripe_subscription_id as string) ?? sub.stripeSubscriptionId,
    updatedAt: new Date().toISOString(),
  }
  saveSubscription(updated)
}
