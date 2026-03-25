import { Subscription, SubscriptionTier, PremiumFeature } from './types'
import { getClient } from './supabase'
import { SYNC_EVENT } from './sync'

const SUBSCRIPTION_KEY = 'rally-subscription'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

export function getSubscription(playerId: string): Subscription | null {
  try {
    const data = localStorage.getItem(SUBSCRIPTION_KEY)
    if (!data) return null
    const sub: Subscription = JSON.parse(data)
    return sub.playerId === playerId ? sub : null
  } catch { return null }
}

function saveSubscription(sub: Subscription): void {
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(sub))
}

export function getPlayerTier(playerId: string): SubscriptionTier {
  const sub = getSubscription(playerId)
  if (!sub) return 'free'
  if (sub.status === 'active') return 'pro'
  if (sub.status === 'trial') {
    if (sub.trialEndsAt && new Date() > new Date(sub.trialEndsAt)) return 'free'
    if (sub.trialMatchesRemaining <= 0) return 'free'
    return 'trial'
  }
  return 'free'
}

export function isPremium(playerId: string): boolean {
  const tier = getPlayerTier(playerId)
  return tier === 'pro' || tier === 'trial'
}

const PREMIUM_FEATURES: PremiumFeature[] = [
  'algorithmic_matching', 'priority_scheduling', 'county_leaderboard_position',
  'advanced_stats', 'head_to_head_records', 'custom_tournament_formats',
]

export function canAccessFeature(playerId: string, feature: PremiumFeature): boolean {
  if (!PREMIUM_FEATURES.includes(feature)) return true
  return isPremium(playerId)
}

export async function startTrial(playerId: string): Promise<Subscription> {
  const existing = getSubscription(playerId)
  if (existing) return existing
  const now = new Date()
  const sub: Subscription = {
    id: generateId(), playerId, status: 'trial', trialMatchesRemaining: 5,
    trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  }
  saveSubscription(sub)
  const client = getClient()
  if (client) {
    await client.from('subscriptions').insert({
      id: sub.id, player_id: sub.playerId, status: sub.status,
      trial_matches_remaining: sub.trialMatchesRemaining, trial_ends_at: sub.trialEndsAt,
      created_at: sub.createdAt,
    })
  }
  dispatchSync()
  return sub
}

export async function consumeTrialMatch(playerId: string): Promise<Subscription | null> {
  const sub = getSubscription(playerId)
  if (!sub || sub.status !== 'trial' || sub.trialMatchesRemaining <= 0) return sub
  sub.trialMatchesRemaining -= 1
  saveSubscription(sub)
  const client = getClient()
  if (client) await client.from('subscriptions').update({ trial_matches_remaining: sub.trialMatchesRemaining }).eq('id', sub.id)
  dispatchSync()
  return sub
}

export async function refreshSubscriptionFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('subscriptions').select('*').eq('player_id', playerId).single()
  if (!data) return
  saveSubscription({
    id: data.id, playerId: data.player_id, plan: data.plan, status: data.status,
    trialMatchesRemaining: data.trial_matches_remaining ?? 0, trialEndsAt: data.trial_ends_at,
    currentPeriodStart: data.current_period_start, currentPeriodEnd: data.current_period_end,
    createdAt: data.created_at,
  })
}
