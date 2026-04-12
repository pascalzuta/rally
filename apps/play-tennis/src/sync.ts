import { RealtimeChannel } from '@supabase/supabase-js'
import { initSupabase, getClient, getAuthUserId } from './supabase'
import { Tournament, LobbyEntry, PlayerRating, AvailabilitySlot, Trophy, TrophyTier, Badge, RatingSnapshot } from './types'
import { getItem, setItem } from './memoryStore'

// Feature flag: set to false to revert to localStorage-first (old behavior)
export const SUPABASE_PRIMARY = true

// Custom event dispatched when remote data arrives
export const SYNC_EVENT = 'rally-sync-update'

function dispatchSync() {
  window.dispatchEvent(new Event(SYNC_EVENT))
}

const STORAGE_KEY = 'play-tennis-data'
const LOBBY_KEY = 'play-tennis-lobby'
const RATINGS_KEY = 'play-tennis-ratings'

// --- Sync result type ---

export interface SyncResult {
  success: boolean
  error?: string
  conflict?: boolean
}

// --- Tournament timestamp tracking for optimistic locking ---

const tournamentTimestamps = new Map<string, string>()

export function getTournamentTimestamp(id: string): string | undefined {
  return tournamentTimestamps.get(id)
}

export function setTournamentTimestamp(id: string, ts: string): void {
  tournamentTimestamps.set(id, ts)
}

// --- Supabase-first write helpers (Phase 1) ---

export async function syncTournament(tournament: Tournament, expectedUpdatedAt?: string): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: true } // offline: fall through to localStorage

  const row = {
    id: tournament.id,
    county: tournament.county.toLowerCase(),
    data: tournament,
  }

  if (expectedUpdatedAt) {
    // Optimistic lock: only update if updated_at matches
    const { error, count } = await client
      .from('tournaments')
      .update({ data: tournament })
      .eq('id', tournament.id)
      .eq('updated_at', expectedUpdatedAt)

    if (error) return { success: false, error: error.message }
    if (count === 0) {
      // Could be a conflict OR the row doesn't exist yet
      // Check if row exists
      const { data: existing } = await client
        .from('tournaments')
        .select('id')
        .eq('id', tournament.id)
        .single()

      if (existing) {
        return { success: false, conflict: true }
      }
      // Row doesn't exist — insert it
      const { error: insertError } = await client
        .from('tournaments')
        .insert(row)
      if (insertError) return { success: false, error: insertError.message }
    }
  } else {
    // No expected timestamp — upsert (new tournament or first sync)
    const { error } = await client
      .from('tournaments')
      .upsert(row, { onConflict: 'id' })
    if (error) return { success: false, error: error.message }
  }

  // Fetch the new updated_at after write
  const { data: refreshed } = await client
    .from('tournaments')
    .select('updated_at')
    .eq('id', tournament.id)
    .single()
  if (refreshed) {
    tournamentTimestamps.set(tournament.id, refreshed.updated_at)
  }

  return { success: true }
}

export async function syncLobbyEntry(entry: LobbyEntry): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: true }

  const { error } = await client.from('lobby').upsert({
    player_id: entry.playerId,
    player_name: entry.playerName,
    county: entry.county.toLowerCase(),
    joined_at: entry.joinedAt,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function syncRemoveLobbyEntry(playerId: string): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: true }

  const { error } = await client.from('lobby').delete().eq('player_id', playerId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function syncRatingsForPlayer(playerId: string, rating: PlayerRating): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: true }

  const { error } = await client.from('ratings').upsert({
    player_id: playerId,
    data: rating,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Legacy fire-and-forget functions (used when SUPABASE_PRIMARY is false)
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

export async function syncAvailabilityToRemote(
  playerId: string,
  county: string,
  slots: AvailabilitySlot[],
  weeklyCap: number = 2,
): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: true } // offline: will be queued

  const { error } = await client.from('availability').upsert({
    player_id: playerId,
    county: county.toLowerCase(),
    slots,
    weekly_cap: weeklyCap,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// --- Availability remote fetch ---

const AVAILABILITY_KEY = 'play-tennis-availability'

export async function refreshAvailabilityFromRemote(countyKey: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('availability').select('*').eq('county', countyKey)
  if (!data) return

  // Merge remote availability into localStorage (preserve local-only entries)
  const localRaw = getItem(AVAILABILITY_KEY)
  const local: Record<string, AvailabilitySlot[]> = localRaw ? JSON.parse(localRaw) : {}
  const remoteIds = new Set(data.map(row => row.player_id))

  // Start with remote data (authoritative for known players)
  const merged: Record<string, AvailabilitySlot[]> = {}
  for (const row of data) {
    merged[row.player_id] = row.slots as AvailabilitySlot[]
  }
  // Preserve local-only entries (not yet synced to Supabase)
  for (const [id, slots] of Object.entries(local)) {
    if (!remoteIds.has(id)) {
      merged[id] = slots
    }
  }

  setItem(AVAILABILITY_KEY, JSON.stringify(merged))
  dispatchSync()
}

export async function fetchAvailabilityForPlayers(
  playerIds: string[]
): Promise<Record<string, AvailabilitySlot[]>> {
  const client = getClient()
  if (!client) return {}

  const { data } = await client
    .from('availability')
    .select('player_id, slots')
    .in('player_id', playerIds)

  if (!data) return {}

  const result: Record<string, AvailabilitySlot[]> = {}
  for (const row of data) {
    result[row.player_id] = row.slots as AvailabilitySlot[]
  }
  return result
}

// --- Rating History sync ---

const RATING_HISTORY_KEY = 'play-tennis-rating-history'

export async function syncRatingSnapshot(playerId: string, rating: number, timestamp: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const authId = await getAuthUserId()
  await client.from('rating_history').insert({
    player_id: playerId,
    rating,
    recorded_at: timestamp,
    auth_id: authId ?? undefined,
  })
}

async function refreshRatingHistoryFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client
    .from('rating_history')
    .select('rating, recorded_at')
    .eq('player_id', playerId)
    .order('recorded_at', { ascending: true })
  if (!data || data.length === 0) return

  const snapshots: RatingSnapshot[] = data.map(row => ({
    rating: Number(row.rating),
    timestamp: row.recorded_at,
  }))

  const local: Record<string, RatingSnapshot[]> = safeParseJSON(getItem(RATING_HISTORY_KEY), {})
  local[playerId] = snapshots
  setItem(RATING_HISTORY_KEY, JSON.stringify(local))
}

// --- Trophies sync ---

const TROPHIES_KEY = 'play-tennis-trophies'

export async function syncTrophiesToRemote(trophies: Trophy[]): Promise<void> {
  const client = getClient()
  if (!client) return
  const authId = await getAuthUserId()
  const rows = trophies.map(t => ({
    id: t.id,
    player_id: t.playerId,
    player_name: t.playerName,
    tournament_id: t.tournamentId,
    tournament_name: t.tournamentName,
    county: t.county.toLowerCase(),
    tier: t.tier,
    date: t.date,
    awarded_at: t.awardedAt,
    final_match: t.finalMatch ?? null,
    auth_id: authId ?? undefined,
  }))
  await client.from('trophies').upsert(rows, { onConflict: 'id' })
}

async function refreshTrophiesFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client
    .from('trophies')
    .select('*')
    .eq('player_id', playerId)
  if (!data || data.length === 0) return

  const remoteTrophies: Trophy[] = data.map(row => ({
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    tournamentId: row.tournament_id,
    tournamentName: row.tournament_name,
    county: row.county,
    tier: row.tier as TrophyTier,
    date: row.date,
    awardedAt: row.awarded_at,
    ...(row.final_match ? { finalMatch: row.final_match as Trophy['finalMatch'] } : {}),
  }))

  // Merge: remote trophies take precedence, keep local-only ones
  const localTrophies: Trophy[] = safeParseJSON(getItem(TROPHIES_KEY), [])
  const remoteIds = new Set(remoteTrophies.map(t => t.id))
  const localOnly = localTrophies.filter(t => t.playerId !== playerId || !remoteIds.has(t.id))
  // Also keep trophies for OTHER players that are local-only
  const otherPlayerLocal = localTrophies.filter(t => t.playerId !== playerId)
  const merged = [...remoteTrophies, ...localOnly.filter(t => t.playerId === playerId), ...otherPlayerLocal.filter(t => !remoteIds.has(t.id))]
  // Deduplicate by id
  const seen = new Set<string>()
  const deduped = merged.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })
  setItem(TROPHIES_KEY, JSON.stringify(deduped))
}

// --- Badges sync ---

const BADGES_KEY = 'play-tennis-badges'

export async function syncBadgesToRemote(badges: Badge[]): Promise<void> {
  const client = getClient()
  if (!client) return
  const authId = await getAuthUserId()
  const rows = badges.map(b => ({
    id: b.id,
    player_id: b.playerId,
    badge_type: b.type,
    label: b.label,
    description: b.description,
    awarded_at: b.awardedAt,
    tournament_id: b.tournamentId ?? null,
    auth_id: authId ?? undefined,
  }))
  await client.from('badges').upsert(rows, { onConflict: 'id' })
}

async function refreshBadgesFromRemote(playerId: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client
    .from('badges')
    .select('*')
    .eq('player_id', playerId)
  if (!data || data.length === 0) return

  const remoteBadges: Badge[] = data.map(row => ({
    id: row.id,
    playerId: row.player_id,
    type: row.badge_type as Badge['type'],
    label: row.label,
    description: row.description,
    awardedAt: row.awarded_at,
    ...(row.tournament_id ? { tournamentId: row.tournament_id } : {}),
  }))

  const localBadges: Badge[] = safeParseJSON(getItem(BADGES_KEY), [])
  const remoteIds = new Set(remoteBadges.map(b => b.id))
  const otherPlayerLocal = localBadges.filter(b => b.playerId !== playerId)
  const merged = [...remoteBadges, ...otherPlayerLocal.filter(b => !remoteIds.has(b.id))]
  setItem(BADGES_KEY, JSON.stringify(merged))
}

/** Refresh rating history, trophies, and badges for the current player from Supabase */
export async function refreshPlayerProfileData(playerId: string): Promise<void> {
  await Promise.all([
    refreshRatingHistoryFromRemote(playerId),
    refreshTrophiesFromRemote(playerId),
    refreshBadgesFromRemote(playerId),
  ])
  dispatchSync()
}

// --- Supabase Realtime subscriptions ---

let channel: RealtimeChannel | null = null

function subscribeToCounty(county: string): void {
  const client = getClient()
  if (!client) return

  const countyKey = county.toLowerCase()

  channel = client.channel(`county-${countyKey}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'lobby', filter: `county=eq.${countyKey}` }, () => {
      refreshLobbyFromRemote(countyKey)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `county=eq.${countyKey}` }, () => {
      refreshTournamentsFromRemote(countyKey)
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability', filter: `county=eq.${countyKey}` }, () => {
      refreshAvailabilityFromRemote(countyKey)
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
  // Merge: keep local-only entries (e.g. dev-seeded players) alongside remote data
  const localLobby: LobbyEntry[] = safeParseJSON(getItem(LOBBY_KEY), [])
  const otherCounties = localLobby.filter(e => e.county.toLowerCase() !== countyKey)
  const remoteIds = new Set(remoteEntries.map(e => e.playerId))
  const localOnlyCounty = localLobby.filter(
    e => e.county.toLowerCase() === countyKey && !remoteIds.has(e.playerId)
  )
  setItem(LOBBY_KEY, JSON.stringify([...otherCounties, ...remoteEntries, ...localOnlyCounty]))
  dispatchSync()
}

async function refreshTournamentsFromRemote(countyKey: string): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('tournaments').select('*').eq('county', countyKey)
  if (!data) return
  const remoteTournaments: Tournament[] = data.map(row => {
    // Track updated_at for optimistic locking
    if (row.updated_at) {
      tournamentTimestamps.set(row.id, row.updated_at)
    }
    return row.data as Tournament
  })
  const remoteIds = new Set(remoteTournaments.map(t => t.id))
  const localTournaments: Tournament[] = safeParseJSON(getItem(STORAGE_KEY), [])
  // Keep local-only tournaments for this county (not yet synced) + tournaments from other counties
  const localOnlyForCounty = localTournaments.filter(
    t => t.county.toLowerCase() === countyKey && !remoteIds.has(t.id)
  )
  const otherCounties = localTournaments.filter(t => t.county.toLowerCase() !== countyKey)
  setItem(STORAGE_KEY, JSON.stringify([...remoteTournaments, ...localOnlyForCounty, ...otherCounties]))
  dispatchSync()
}

export async function refreshTournamentById(tournamentId: string): Promise<Tournament | null> {
  const client = getClient()
  if (!client) return null
  const { data } = await client.from('tournaments').select('*').eq('id', tournamentId).single()
  if (!data) return null

  if (data.updated_at) {
    tournamentTimestamps.set(data.id, data.updated_at)
  }
  const tournament = data.data as Tournament

  // Update memoryStore cache
  const local: Tournament[] = safeParseJSON(getItem(STORAGE_KEY), [])
  const idx = local.findIndex(t => t.id === tournamentId)
  if (idx >= 0) {
    local[idx] = tournament
  } else {
    local.unshift(tournament)
  }
  setItem(STORAGE_KEY, JSON.stringify(local))
  dispatchSync()
  return tournament
}

async function refreshRatingsFromRemote(): Promise<void> {
  const client = getClient()
  if (!client) return
  const { data } = await client.from('ratings').select('*')
  if (!data) return
  const localRatings: Record<string, PlayerRating> = safeParseJSON(getItem(RATINGS_KEY), {})
  const remoteRatings: Record<string, PlayerRating> = {}
  for (const row of data) remoteRatings[row.player_id] = row.data as PlayerRating
  // Remote wins for known players; local-only entries preserved
  const merged = { ...localRatings, ...remoteRatings }
  setItem(RATINGS_KEY, JSON.stringify(merged))
  dispatchSync()
}

// --- Init ---

export async function initSync(county: string): Promise<void> {
  const client = initSupabase()
  if (!client) return

  const countyKey = county.toLowerCase()

  // Flush any offline writes first
  const { flushQueue } = await import('./offline-queue')
  await flushQueue()

  if (!SUPABASE_PRIMARY) {
    // Legacy mode: push local data to remote (old behavior)
    const localLobby: LobbyEntry[] = safeParseJSON(getItem(LOBBY_KEY), [])
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

    const localTournaments: Tournament[] = safeParseJSON(getItem(STORAGE_KEY), [])
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

    const localRatings: Record<string, PlayerRating> = safeParseJSON(getItem(RATINGS_KEY), {})
    const ratingRows = Object.entries(localRatings).map(([id, r]) => ({
      player_id: id,
      data: r,
    }))
    if (ratingRows.length > 0) {
      await client.from('ratings').upsert(ratingRows, { onConflict: 'player_id' })
    }
  }

  // Fetch remote data into localStorage (both modes)
  await refreshLobbyFromRemote(countyKey)
  await refreshTournamentsFromRemote(countyKey)
  await refreshRatingsFromRemote()
  await refreshAvailabilityFromRemote(countyKey)

  // Fetch player-specific data (rating history, trophies, badges)
  const PROFILE_KEY = 'play-tennis-profile'
  try {
    const profileStr = getItem(PROFILE_KEY)
    if (profileStr) {
      const profile = JSON.parse(profileStr)
      if (profile?.id) {
        await refreshPlayerProfileData(profile.id)
      }
    }
  } catch {
    // Non-critical — continue with local data
  }

  // Link existing localStorage profile to auth session (Phase 3 migration)
  await linkProfileToAuth(client, county)

  // Subscribe to real-time changes
  subscribeToCounty(county)
}

/**
 * Phase 3: Link existing localStorage profile to Supabase auth.
 * On first run after auth is enabled, this upserts the player into the
 * `players` table and backfills `auth_id` on lobby/ratings rows.
 */
async function linkProfileToAuth(client: ReturnType<typeof getClient>, county: string): Promise<void> {
  if (!client) return
  const authId = await getAuthUserId()
  if (!authId) return

  const PROFILE_KEY = 'play-tennis-profile'
  try {
    const profileStr = getItem(PROFILE_KEY)
    if (!profileStr) return
    const profile = JSON.parse(profileStr)
    if (!profile?.id || !profile?.name) return

    // Upsert into players table (idempotent)
    await client.from('players').upsert({
      player_id: profile.id,
      auth_id: authId,
      player_name: profile.name,
      county: county.toLowerCase(),
    }, { onConflict: 'player_id' })

    // Backfill auth_id on lobby row (if exists)
    await client.from('lobby')
      .update({ auth_id: authId })
      .eq('player_id', profile.id)
      .is('auth_id', null)

    // Backfill auth_id on ratings row (if exists)
    await client.from('ratings')
      .update({ auth_id: authId })
      .eq('player_id', profile.id)
      .is('auth_id', null)

    // Backfill auth_id on rating_history, trophies, badges
    await client.from('rating_history')
      .update({ auth_id: authId })
      .eq('player_id', profile.id)
      .is('auth_id', null)

    await client.from('trophies')
      .update({ auth_id: authId })
      .eq('player_id', profile.id)
      .is('auth_id', null)

    await client.from('badges')
      .update({ auth_id: authId })
      .eq('player_id', profile.id)
      .is('auth_id', null)
  } catch {
    // Migration is best-effort — don't block app startup
  }
}

function safeParseJSON<T>(data: string | null, fallback: T): T {
  try {
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}
