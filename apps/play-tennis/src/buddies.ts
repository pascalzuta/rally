import { Buddy, BuddyPing, BuddyStatus, PingStatus } from './types'
import { getClient } from './supabase'
import { SYNC_EVENT } from './sync'

const BUDDIES_KEY = 'rally-buddies'
const PINGS_KEY = 'rally-buddy-pings'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

export function getBuddies(): Buddy[] {
  try {
    const data = localStorage.getItem(BUDDIES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveBuddies(buddies: Buddy[]): void {
  localStorage.setItem(BUDDIES_KEY, JSON.stringify(buddies))
}

export function getAcceptedBuddies(playerId: string): Buddy[] {
  return getBuddies().filter(
    b => b.status === 'accepted' && (b.requesterId === playerId || b.recipientId === playerId)
  )
}

export function getPendingBuddyRequests(playerId: string): Buddy[] {
  return getBuddies().filter(b => b.status === 'pending' && b.recipientId === playerId)
}

export function getBuddyName(buddy: Buddy, myId: string): string {
  return buddy.requesterId === myId ? buddy.recipientName : buddy.requesterName
}

export function getBuddyId(buddy: Buddy, myId: string): string {
  return buddy.requesterId === myId ? buddy.recipientId : buddy.requesterId
}

export async function sendBuddyRequest(
  requesterId: string, requesterName: string,
  recipientId: string, recipientName: string,
): Promise<Buddy> {
  const buddies = getBuddies()
  const existing = buddies.find(
    b => (b.requesterId === requesterId && b.recipientId === recipientId) ||
         (b.requesterId === recipientId && b.recipientId === requesterId)
  )
  if (existing) return existing

  const buddy: Buddy = {
    id: generateId(), requesterId, requesterName, recipientId, recipientName,
    status: 'pending', createdAt: new Date().toISOString(),
  }
  buddies.push(buddy)
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    await client.from('buddies').insert({
      id: buddy.id, requester_id: buddy.requesterId, requester_name: buddy.requesterName,
      recipient_id: buddy.recipientId, recipient_name: buddy.recipientName,
      status: buddy.status, created_at: buddy.createdAt,
    })
  }
  dispatchSync()
  return buddy
}

export async function acceptBuddyRequest(buddyId: string): Promise<Buddy | null> {
  const buddies = getBuddies()
  const idx = buddies.findIndex(b => b.id === buddyId)
  if (idx === -1) return null
  buddies[idx].status = 'accepted'
  buddies[idx].acceptedAt = new Date().toISOString()
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    await client.from('buddies').update({ status: 'accepted', accepted_at: buddies[idx].acceptedAt }).eq('id', buddyId)
  }
  dispatchSync()
  return buddies[idx]
}

export async function declineBuddyRequest(buddyId: string): Promise<void> {
  const buddies = getBuddies()
  const idx = buddies.findIndex(b => b.id === buddyId)
  if (idx === -1) return
  buddies[idx].status = 'declined'
  saveBuddies(buddies)
  const client = getClient()
  if (client) await client.from('buddies').update({ status: 'declined' }).eq('id', buddyId)
  dispatchSync()
}

export async function removeBuddy(buddyId: string): Promise<void> {
  saveBuddies(getBuddies().filter(b => b.id !== buddyId))
  const client = getClient()
  if (client) await client.from('buddies').delete().eq('id', buddyId)
  dispatchSync()
}

// --- Ping to play ---

export function getPings(playerId: string): BuddyPing[] {
  try {
    const all: BuddyPing[] = JSON.parse(localStorage.getItem(PINGS_KEY) || '[]')
    return all.filter(p => (p.senderId === playerId || p.recipientId === playerId) && p.status !== 'expired')
  } catch { return [] }
}

export function getIncomingPings(playerId: string): BuddyPing[] {
  return getPings(playerId).filter(p => p.recipientId === playerId && p.status === 'proposed')
}

function getAllPings(): BuddyPing[] {
  try { return JSON.parse(localStorage.getItem(PINGS_KEY) || '[]') } catch { return [] }
}

function savePings(pings: BuddyPing[]): void {
  localStorage.setItem(PINGS_KEY, JSON.stringify(pings))
}

export async function sendPing(
  senderId: string, senderName: string,
  recipientId: string, recipientName: string,
  proposedDate: string, proposedTime: string,
  location?: string, message?: string,
): Promise<BuddyPing> {
  const now = new Date()
  const ping: BuddyPing = {
    id: generateId(), senderId, senderName, recipientId, recipientName,
    proposedDate, proposedTime, location, message,
    status: 'proposed', createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
  }
  const pings = getAllPings()
  pings.push(ping)
  savePings(pings)

  const client = getClient()
  if (client) {
    await client.from('buddy_pings').insert({
      id: ping.id, sender_id: ping.senderId, sender_name: ping.senderName,
      recipient_id: ping.recipientId, recipient_name: ping.recipientName,
      proposed_date: ping.proposedDate, proposed_time: ping.proposedTime,
      location: ping.location, message: ping.message,
      status: ping.status, created_at: ping.createdAt, expires_at: ping.expiresAt,
    })
  }
  dispatchSync()
  return ping
}

export async function respondToPing(pingId: string, response: 'accepted' | 'declined'): Promise<BuddyPing | null> {
  const pings = getAllPings()
  const idx = pings.findIndex(p => p.id === pingId)
  if (idx === -1) return null
  pings[idx].status = response
  savePings(pings)
  const client = getClient()
  if (client) await client.from('buddy_pings').update({ status: response }).eq('id', pingId)
  dispatchSync()
  return pings[idx]
}

export async function refreshBuddiesFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('buddies').select('*').or(`requester_id.eq.${playerId},recipient_id.eq.${playerId}`)
  if (!data) return
  saveBuddies(data.map(row => ({
    id: row.id, requesterId: row.requester_id, requesterName: row.requester_name ?? '',
    recipientId: row.recipient_id, recipientName: row.recipient_name ?? '',
    status: row.status as BuddyStatus, createdAt: row.created_at, acceptedAt: row.accepted_at,
  })))
  dispatchSync()
}

export async function refreshPingsFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('buddy_pings').select('*').or(`sender_id.eq.${playerId},recipient_id.eq.${playerId}`).neq('status', 'expired')
  if (!data) return
  const existing = getAllPings().filter(p => p.senderId !== playerId && p.recipientId !== playerId)
  savePings([...existing, ...data.map(row => ({
    id: row.id, senderId: row.sender_id, senderName: row.sender_name ?? '',
    recipientId: row.recipient_id, recipientName: row.recipient_name ?? '',
    proposedDate: row.proposed_date, proposedTime: row.proposed_time,
    location: row.location, message: row.message,
    status: row.status as PingStatus, createdAt: row.created_at, expiresAt: row.expires_at,
  }))])
}

export async function searchPlayers(query: string, county: string, excludeIds: string[]): Promise<{ id: string; name: string }[]> {
  const client = getClient()
  if (!client) return []
  const { data } = await client.from('players').select('player_id, player_name')
    .eq('county', county.toLowerCase()).ilike('player_name', `%${query}%`)
    .not('player_id', 'in', `(${excludeIds.join(',')})`)
    .limit(10)
  if (!data) return []
  return data.map(row => ({ id: row.player_id, name: row.player_name }))
}
