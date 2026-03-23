import { getClient } from './supabase'

const PENDING_REF_KEY = 'rally-pending-ref'

// --- Helpers ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// --- Pending ref param (stored before registration completes) ---

export function storePendingRef(slug: string): void {
  localStorage.setItem(PENDING_REF_KEY, slug)
}

export function getPendingRef(): string | null {
  return localStorage.getItem(PENDING_REF_KEY)
}

export function clearPendingRef(): void {
  localStorage.removeItem(PENDING_REF_KEY)
}

// --- Referral click tracking ---

export async function trackReferralClick(slug: string): Promise<void> {
  const client = getClient()
  if (!client) return

  const { data: ref } = await client
    .from('referrals')
    .select('id, clicks')
    .eq('slug', slug)
    .maybeSingle()

  if (!ref) return

  await client
    .from('referral_events')
    .insert({
      id: generateId(),
      referral_id: ref.id,
      event_type: 'click',
      created_at: new Date().toISOString(),
    })
    .then(() => {
      // also increment clicks counter on referrals row
      client
        .from('referrals')
        .update({ clicks: (ref.clicks || 0) + 1 })
        .eq('id', ref.id)
        .then(() => {})
    })
}

// --- Referral signup tracking ---

export async function trackReferralSignup(slug: string, playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return

  const { data: ref } = await client
    .from('referrals')
    .select('id, signups')
    .eq('slug', slug)
    .maybeSingle()

  if (!ref) return

  await client.from('referral_events').insert({
    id: generateId(),
    referral_id: ref.id,
    event_type: 'signup',
    player_id: playerId,
    created_at: new Date().toISOString(),
  })

  await client
    .from('referrals')
    .update({ signups: (ref.signups || 0) + 1 })
    .eq('id', ref.id)
}

// --- Referral stats ---

export async function getReferralStats(
  slug: string,
): Promise<{ clicks: number; signups: number }> {
  const client = getClient()
  if (!client) return { clicks: 0, signups: 0 }

  const { data } = await client
    .from('referrals')
    .select('clicks, signups')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return { clicks: 0, signups: 0 }
  return { clicks: data.clicks || 0, signups: data.signups || 0 }
}

// --- Viral referral creation (auto after signup) ---

export async function createViralReferral(playerId: string): Promise<string> {
  const slug = generateSlug()
  const client = getClient()

  if (client) {
    await client.from('referrals').insert({
      id: generateId(),
      slug,
      creator_id: playerId,
      type: 'viral',
      clicks: 0,
      signups: 0,
      created_at: new Date().toISOString(),
    })
  }

  return slug
}

// --- Influencer referral creation (admin only) ---

export async function createInfluencerReferral(
  slug: string,
  creatorId: string,
): Promise<void> {
  const client = getClient()
  if (!client) return

  await client.from('referrals').insert({
    id: generateId(),
    slug,
    creator_id: creatorId,
    type: 'influencer',
    clicks: 0,
    signups: 0,
    created_at: new Date().toISOString(),
  })
}

// --- Look up referral by slug (for landing page) ---

export async function getReferralBySlug(
  slug: string,
): Promise<{ id: string; creatorName?: string; county?: string; signups: number } | null> {
  const client = getClient()
  if (!client) return null

  const { data } = await client
    .from('referrals')
    .select('id, creator_id, county, signups, creator_name')
    .eq('slug', slug)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id,
    creatorName: data.creator_name || undefined,
    county: data.county || undefined,
    signups: data.signups || 0,
  }
}

// --- URL helpers ---

export function getReferralUrl(slug: string): string {
  const base = window.location.origin + window.location.pathname.replace(/\/$/, '')
  return `${base}/r/${slug}`
}

export function getRefParamFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const refParam = params.get('ref')
  if (refParam) return refParam

  // also handle /r/[slug] path pattern
  const path = window.location.pathname
  const match = path.match(/\/r\/([a-z0-9]+)/)
  if (match) return match[1]

  return null
}
