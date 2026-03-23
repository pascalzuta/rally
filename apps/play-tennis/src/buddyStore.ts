import { Buddy, BuddyPing, BuddyPingResponse } from './types'
import { getClient } from './supabase'

const BUDDIES_KEY = 'rally-buddies'
const PINGS_KEY = 'rally-buddy-pings'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// --- Local storage helpers ---

function loadBuddies(): Buddy[] {
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

function loadPings(): BuddyPing[] {
  try {
    const data = localStorage.getItem(PINGS_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function savePings(pings: BuddyPing[]): void {
  localStorage.setItem(PINGS_KEY, JSON.stringify(pings))
}

// --- DB row mappers ---

function rowToBuddy(row: Record<string, unknown>): Buddy {
  return {
    id: row.id as string,
    requesterId: row.requester_id as string,
    requesterName: row.requester_name as string,
    recipientId: row.recipient_id as string,
    recipientName: row.recipient_name as string,
    status: row.status as Buddy['status'],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function rowToPing(row: Record<string, unknown>): BuddyPing {
  return {
    id: row.id as string,
    senderId: row.sender_id as string,
    senderName: row.sender_name as string,
    recipientId: row.recipient_id as string,
    recipientName: row.recipient_name as string,
    proposedDate: row.proposed_date as string,
    proposedTime: row.proposed_time as string,
    location: row.location as string | undefined,
    response: row.response as BuddyPingResponse | undefined,
    createdAt: row.created_at as string,
  }
}

// --- Buddy CRUD ---

export async function sendBuddyRequest(
  requesterId: string,
  requesterName: string,
  recipientId: string,
  recipientName: string,
): Promise<Buddy> {
  const now = new Date().toISOString()
  const buddy: Buddy = {
    id: generateId(),
    requesterId,
    requesterName,
    recipientId,
    recipientName,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }

  const buddies = loadBuddies()
  buddies.push(buddy)
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    const { error } = await client.from('buddies').insert({
      id: buddy.id,
      requester_id: buddy.requesterId,
      requester_name: buddy.requesterName,
      recipient_id: buddy.recipientId,
      recipient_name: buddy.recipientName,
      status: buddy.status,
      created_at: buddy.createdAt,
      updated_at: buddy.updatedAt,
    })
    if (error) console.warn('[Rally] Failed to sync buddy request:', error.message)
  }

  return buddy
}

export async function acceptBuddyRequest(buddyId: string): Promise<Buddy> {
  const buddies = loadBuddies()
  const idx = buddies.findIndex(b => b.id === buddyId)
  if (idx < 0) throw new Error('Buddy request not found')

  buddies[idx] = { ...buddies[idx], status: 'accepted', updatedAt: new Date().toISOString() }
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    const { error } = await client
      .from('buddies')
      .update({ status: 'accepted', updated_at: buddies[idx].updatedAt })
      .eq('id', buddyId)
    if (error) console.warn('[Rally] Failed to sync buddy accept:', error.message)
  }

  return buddies[idx]
}

export async function declineBuddyRequest(buddyId: string): Promise<void> {
  const buddies = loadBuddies()
  const idx = buddies.findIndex(b => b.id === buddyId)
  if (idx < 0) return

  buddies[idx] = { ...buddies[idx], status: 'declined', updatedAt: new Date().toISOString() }
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    const { error } = await client
      .from('buddies')
      .update({ status: 'declined', updated_at: buddies[idx].updatedAt })
      .eq('id', buddyId)
    if (error) console.warn('[Rally] Failed to sync buddy decline:', error.message)
  }
}

export async function removeBuddy(buddyId: string): Promise<void> {
  const buddies = loadBuddies().filter(b => b.id !== buddyId)
  saveBuddies(buddies)

  const client = getClient()
  if (client) {
    const { error } = await client.from('buddies').delete().eq('id', buddyId)
    if (error) console.warn('[Rally] Failed to remove buddy in Supabase:', error.message)
  }
}

/** All accepted buddies for the current player (requester or recipient) */
export function getBuddies(playerId: string): Buddy[] {
  return loadBuddies().filter(
    b => b.status === 'accepted' && (b.requesterId === playerId || b.recipientId === playerId)
  )
}

/** Incoming pending buddy requests (player is recipient) */
export function getPendingRequests(playerId: string): Buddy[] {
  return loadBuddies().filter(b => b.status === 'pending' && b.recipientId === playerId)
}

// --- Pings ---

export async function pingBuddy(
  senderId: string,
  senderName: string,
  recipientId: string,
  recipientName: string,
  proposedDate: string,
  proposedTime: string,
  location?: string,
): Promise<BuddyPing> {
  const ping: BuddyPing = {
    id: generateId(),
    senderId,
    senderName,
    recipientId,
    recipientName,
    proposedDate,
    proposedTime,
    location,
    createdAt: new Date().toISOString(),
  }

  const pings = loadPings()
  pings.push(ping)
  savePings(pings)

  const client = getClient()
  if (client) {
    const { error } = await client.from('buddy_pings').insert({
      id: ping.id,
      sender_id: ping.senderId,
      sender_name: ping.senderName,
      recipient_id: ping.recipientId,
      recipient_name: ping.recipientName,
      proposed_date: ping.proposedDate,
      proposed_time: ping.proposedTime,
      location: ping.location ?? null,
      created_at: ping.createdAt,
    })
    if (error) console.warn('[Rally] Failed to sync buddy ping:', error.message)
  }

  return ping
}

export async function respondToPing(
  pingId: string,
  response: BuddyPingResponse,
): Promise<BuddyPing> {
  const pings = loadPings()
  const idx = pings.findIndex(p => p.id === pingId)
  if (idx < 0) throw new Error('Ping not found')

  pings[idx] = { ...pings[idx], response }
  savePings(pings)

  const client = getClient()
  if (client) {
    const { error } = await client
      .from('buddy_pings')
      .update({ response })
      .eq('id', pingId)
    if (error) console.warn('[Rally] Failed to sync ping response:', error.message)
  }

  return pings[idx]
}

/** Incoming pings awaiting response */
export function getPendingPings(playerId: string): BuddyPing[] {
  return loadPings().filter(p => p.recipientId === playerId && !p.response)
}

/** Outgoing pings sent by this player */
export function getOutgoingPings(playerId: string): BuddyPing[] {
  return loadPings().filter(p => p.senderId === playerId)
}

/**
 * Subscribe to real-time buddy + ping updates for a player.
 * Returns an unsubscribe function.
 */
export function subscribeBuddyUpdates(
  playerId: string,
  callback: () => void,
): () => void {
  const client = getClient()
  if (!client) return () => {}

  const buddyCh = client
    .channel(`buddies-${playerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'buddies' },
      async ({ new: row }) => {
        if (!row) return
        const r = row as Record<string, unknown>
        if (r['requester_id'] !== playerId && r['recipient_id'] !== playerId) return
        const buddies = loadBuddies()
        const idx = buddies.findIndex(b => b.id === r['id'])
        const updated = rowToBuddy(r)
        if (idx >= 0) buddies[idx] = updated
        else buddies.push(updated)
        saveBuddies(buddies)
        callback()
      },
    )
    .subscribe()

  const pingCh = client
    .channel(`buddy-pings-${playerId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'buddy_pings' },
      async ({ new: row }) => {
        if (!row) return
        const r = row as Record<string, unknown>
        if (r['sender_id'] !== playerId && r['recipient_id'] !== playerId) return
        const pings = loadPings()
        const idx = pings.findIndex(p => p.id === r['id'])
        const updated = rowToPing(r)
        if (idx >= 0) pings[idx] = updated
        else pings.push(updated)
        savePings(pings)
        callback()
      },
    )
    .subscribe()

  return () => {
    client.removeChannel(buddyCh)
    client.removeChannel(pingCh)
  }
}

/**
 * Fetch buddies and pings from Supabase and merge into localStorage.
 */
export async function syncBuddiesFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return

  const [buddyRes, pingRes] = await Promise.all([
    client
      .from('buddies')
      .select('*')
      .or(`requester_id.eq.${playerId},recipient_id.eq.${playerId}`),
    client
      .from('buddy_pings')
      .select('*')
      .or(`sender_id.eq.${playerId},recipient_id.eq.${playerId}`),
  ])

  if (buddyRes.data) {
    const remote = buddyRes.data.map(rowToBuddy)
    const local = loadBuddies().filter(
      b => b.requesterId !== playerId && b.recipientId !== playerId
    )
    saveBuddies([...local, ...remote])
  }

  if (pingRes.data) {
    const remote = pingRes.data.map(rowToPing)
    const local = loadPings().filter(
      p => p.senderId !== playerId && p.recipientId !== playerId
    )
    savePings([...local, ...remote])
  }
}
