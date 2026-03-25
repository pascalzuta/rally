import { Referral, ReferralType } from './types'
import { getClient } from './supabase'

const REFERRAL_SOURCE_KEY = 'rally-referral-source'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function setReferralSource(slug: string): void {
  sessionStorage.setItem(REFERRAL_SOURCE_KEY, slug)
}

export function getReferralSource(): string | null {
  return sessionStorage.getItem(REFERRAL_SOURCE_KEY)
}

export function clearReferralSource(): void {
  sessionStorage.removeItem(REFERRAL_SOURCE_KEY)
}

export async function resolveReferralSlug(slug: string): Promise<Referral | null> {
  const client = getClient()
  if (!client) return null
  const { data } = await client.from('referrals').select('*').eq('slug', slug).single()
  if (!data) return null
  return {
    id: data.id, slug: data.slug, type: data.type as ReferralType,
    creatorId: data.creator_id, creatorName: data.creator_name ?? '',
    parentReferralId: data.parent_referral_id,
    clickCount: data.click_count ?? 0, signupCount: data.signup_count ?? 0,
    createdAt: data.created_at,
  }
}

export async function trackReferralClick(slug: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('referrals').select('id, click_count').eq('slug', slug).single()
  if (data) {
    await client.from('referrals').update({ click_count: (data.click_count ?? 0) + 1 }).eq('id', data.id)
    await client.from('referral_events').insert({
      id: generateId(), referral_id: data.id, event_type: 'click',
      metadata: { slug, timestamp: new Date().toISOString() }, created_at: new Date().toISOString(),
    })
  }
}

export async function trackReferralSignup(slug: string, playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('referrals').select('id, signup_count').eq('slug', slug).single()
  if (data) {
    await client.from('referrals').update({ signup_count: (data.signup_count ?? 0) + 1 }).eq('slug', slug)
    await client.from('referral_events').insert({
      id: generateId(), referral_id: data.id, event_type: 'signup',
      player_id: playerId, created_at: new Date().toISOString(),
    })
  }
  await client.from('players').update({ referral_source: slug }).eq('player_id', playerId)
}

export async function createViralReferral(playerId: string, playerName: string, parentSlug?: string): Promise<string> {
  const slug = playerName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Math.random().toString(36).slice(2, 6)
  const client = getClient()
  if (client) {
    let parentReferralId: string | null = null
    if (parentSlug) {
      const { data: parent } = await client.from('referrals').select('id').eq('slug', parentSlug).single()
      parentReferralId = parent?.id ?? null
    }
    await client.from('referrals').insert({
      id: generateId(), slug, type: 'viral', creator_id: playerId, creator_name: playerName,
      parent_referral_id: parentReferralId, click_count: 0, signup_count: 0, created_at: new Date().toISOString(),
    })
  }
  return slug
}
