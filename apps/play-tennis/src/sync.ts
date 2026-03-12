import { RealtimeChannel } from '@supabase/supabase-js'
import { initSupabase, getClient } from './supabase'
import { Tournament, LobbyEntry, PlayerRating, AvailabilitySlot } from './types'

// Custom event dispatched when remote data arrives
export const SYNC_EVENT = 'rally-sync-update'

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

const STORAGE_KEY = 'play-tennis-data'
const LOBBY_KEY = 'play-tennis-lobby'
const RATINGS_KEY = 'play-tennis-ratings'

// --- Supabase write helpers ---

export function syncTournaments(tournaments: Tournament[]): void {
  const client = getClient()
  if (!client) return
  for (const t of tournaments) {
    client.from('tournaments').upsert({
      id: t.id,
      county: t.county.toLowerCase(),
      data: t,
    }, { onConflict: 'id' }).then()
  }
}

export function syncLobbyForCounty(county: string, entries: LobbyEntry[]): void {
  const client = getClient()
  if (!client) return
  const countyKey = county.toLowerCase()
  // Delete removed entries, then upsert current ones
  const playerIds = entries.map(e => e.playerId)
  client.from('lobby').delete()
    .eq('county', countyKey)
    .not('player_id', 'in', `(${playerIds.join(',')})`)
    .then(() => {
      if (entries.length > 0) {
        client.from('lobby').upsert(
          entries.map(e => ({
            player_id: e.playerId,
            player_name: e.playerName,
            county: countyKey,
            joined_at: e.joinedAt,
          })),
          { onConflict: 'player_id' }
        ).then()
      }
    })
}

export function syncRatings(ratings: Record<string, PlayerRating>): void {
  const client = getClient()
  if (!client) return
  const rows = Object.entries(ratings).map(([id, r]) => ({
    player_id: id,
    data: r,
  }))
  if (rows.length > 0) {
    client.from('ratings').upsert(rows, { onConflict: 'player_id' }).then()
  }
}

export function syncAvailability(playerId: string, slots: AvailabilitySlot[]): void {
  // Availability stays local-only (not critical for cross-device discovery)
}

// --- Supabase Realtime subscriptions ---

let channel: RealtimeChannel | null = null

function subscribeToCounty(county: string): void {
  const client = getClient()
  if (!client) return

  const countyKey = county.toLowerCase()

  // Subscribe to all table changes via a single Realtime channel
  channel = client.channel(`county-${countyKey}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby', filter: `county=eq.${countyKey}` }, () => {
      refreshLobbyFromRemote(countyKey)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `county=eq.${countyKey}` }, () => {
      refreshTournamentsFromRemote(countyKey)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ratings' }, () => {
      refreshRatingsFromRemote()
    })
    .subscribe()
}

async function refreshLobbyFromRemote(countyKey: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('lobby').select('*').eq('county', countyKey)
  if (!data) return
  const remoteEntries: LobbyEntry[] = data.map(row => ({
    playerId: row.player_id,
    playerName: row.player_name,
    county: row.county,
    joinedAt: row.joined_at,
  }))
  const localLobby: LobbyEntry[] = safeParseJSON(localStorage.getItem(LOBBY_KEY), [])
  const otherCounties = localLobby.filter(e => e.county.toLowerCase() !== countyKey)
  localStorage.setItem(LOBBY_KEY, JSON.stringify([...otherCounties, ...remoteEntries]))
  dispatchSync()
}

async function refreshTournamentsFromRemote(countyKey: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('tournaments').select('*').eq('county', countyKey)
  if (!data) return
  const remoteTournaments: Tournament[] = data.map(row => row.data as Tournament)
  const remoteIds = new Set(remoteTournaments.map(t => t.id))
  const localTournaments: Tournament[] = safeParseJSON(localStorage.getItem(STORAGE_KEY), [])
  const others = localTournaments.filter(t => !remoteIds.has(t.id) && t.county.toLowerCase() !== countyKey)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...remoteTournaments, ...others]))
  dispatchSync()
}

async function refreshRatingsFromRemote(): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('ratings').select('*')
  if (!data) return
  const localRatings: Record<string, PlayerRating> = safeParseJSON(localStorage.getItem(RATINGS_KEY), {})
  const remoteRatings: Record<string, PlayerRating> = {}
  for (const row of data) remoteRatings[row.player_id] = row.data as PlayerRating
  localStorage.setItem(RATINGS_KEY, JSON.stringify({ ...localRatings, ...remoteRatings }))
  dispatchSync()
}

// --- Init ---

export async function initSync(county: string): Promise<void> {
  const client = initSupabase()
  if (!client) return

  const countyKey = county.toLowerCase()

  // Push local lobby entries to remote
  const localLobby: LobbyEntry[] = safeParseJSON(localStorage.getItem(LOBBY_KEY), [])
  const localCountyLobby = localLobby.filter(e => e.county.toLowerCase() === countyKey)
  if (localCountyLobby.length > 0) {
    await client.from('lobby').upsert(
      localCountyLobby.map(e => ({
        player_id: e.playerId,
        player_name: e.playerName,
        county: countyKey,
        joined_at: e.joinedAt,
      })),
      { onConflict: 'player_id' }
    )
  }

  // Push local tournaments to remote
  const localTournaments: Tournament[] = safeParseJSON(localStorage.getItem(STORAGE_KEY), [])
  const localCountyTournaments = localTournaments.filter(t => t.county.toLowerCase() === countyKey)
  if (localCountyTournaments.length > 0) {
    await client.from('tournaments').upsert(
      localCountyTournaments.map(t => ({
        id: t.id,
        county: countyKey,
        data: t,
      })),
      { onConflict: 'id' }
    )
  }

  // Push local ratings
  const localRatings: Record<string, PlayerRating> = safeParseJSON(localStorage.getItem(RATINGS_KEY), {})
  const ratingRows = Object.entries(localRatings).map(([id, r]) => ({
    player_id: id,
    data: r,
  }))
  if (ratingRows.length > 0) {
    await client.from('ratings').upsert(ratingRows, { onConflict: 'player_id' })
  }

  // Fetch remote data into localStorage
  await refreshLobbyFromRemote(countyKey)
  await refreshTournamentsFromRemote(countyKey)
  await refreshRatingsFromRemote()

  // Subscribe to real-time changes
  subscribeToCounty(county)
}

function safeParseJSON<T>(data: string | null, fallback: T): T {
  try {
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}
