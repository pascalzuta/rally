import { getClient, getAuthUserId } from './supabase'
import { Tournament, LobbyEntry, PlayerRating, AvailabilitySlot, Trophy, Badge, RatingSnapshot } from './types'

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

// --- Supabase write helpers (used by store.ts) ---

export async function syncTournament(tournament: Tournament, expectedUpdatedAt?: string): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: false, error: 'Not connected to server' }

  const row = {
    id: tournament.id,
    county: tournament.county.toLowerCase(),
    data: tournament,
  }

  if (expectedUpdatedAt) {
    const { error, count } = await client
      .from('tournaments')
      .update({ data: tournament, updated_at: new Date().toISOString() })
      .eq('id', tournament.id)
      .eq('updated_at', expectedUpdatedAt)

    if (error) return { success: false, error: error.message }
    if (count === 0) {
      const { data: existing } = await client
        .from('tournaments')
        .select('id')
        .eq('id', tournament.id)
        .single()

      if (existing) {
        return { success: false, conflict: true }
      }
      const { error: insertError } = await client
        .from('tournaments')
        .insert(row)
      if (insertError) return { success: false, error: insertError.message }
    }
  } else {
    const { error } = await client
      .from('tournaments')
      .upsert(row, { onConflict: 'id' })
    if (error) return { success: false, error: error.message }
  }

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
  if (!client) return { success: false, error: 'Not connected to server' }

  // auth_id required by RLS policy "Authenticated write own lobby"
  const authId = await getAuthUserId()

  const { error } = await client.from('lobby').upsert({
    player_id: entry.playerId,
    player_name: entry.playerName,
    county: entry.county.toLowerCase(),
    joined_at: entry.joinedAt,
    auth_id: authId,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function syncRemoveLobbyEntry(playerId: string): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: false, error: 'Not connected to server' }

  const { error } = await client.from('lobby').delete().eq('player_id', playerId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function syncRatingsForPlayer(playerId: string, rating: PlayerRating): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: false, error: 'Not connected to server' }

  // auth_id required by RLS policy "Authenticated write own ratings"
  const authId = await getAuthUserId()

  const { error } = await client.from('ratings').upsert({
    player_id: playerId,
    data: rating,
    auth_id: authId,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function syncAvailabilityToRemote(
  playerId: string,
  county: string,
  slots: AvailabilitySlot[],
  weeklyCap: number = 2,
): Promise<SyncResult> {
  const client = getClient()
  if (!client) return { success: false, error: 'Not connected to server' }

  // auth_id is required by RLS policy "Authenticated write own availability"
  // which checks auth_id = auth.uid(). Without it, the upsert is silently rejected.
  const authId = await getAuthUserId()

  const { error } = await client.from('availability').upsert({
    player_id: playerId,
    county: county.toLowerCase(),
    slots,
    weekly_cap: weeklyCap,
    auth_id: authId,
  }, { onConflict: 'player_id' })

  if (error) return { success: false, error: error.message }
  return { success: true }
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

// --- Rating History write ---

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

// --- Trophies write ---

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

// --- Badges write ---

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

// --- Tournament fetch (no localStorage, returns data directly) ---

export async function refreshTournamentById(tournamentId: string): Promise<Tournament | null> {
  const client = getClient()
  if (!client) return null
  const { data } = await client.from('tournaments').select('*').eq('id', tournamentId).single()
  if (!data) return null

  if (data.updated_at) {
    tournamentTimestamps.set(data.id, data.updated_at)
  }
  return data.data as Tournament
}

// --- No-op stubs (kept for callers that still reference them) ---

/** @deprecated RallyDataProvider handles lobby data now */
export async function refreshLobbyFromRemote(_rawCounty: string): Promise<void> {
  // No-op: RallyDataProvider handles lobby fetching and Realtime subscriptions
}

/** @deprecated RallyDataProvider handles availability data now */
export async function refreshAvailabilityFromRemote(_rawCounty: string): Promise<void> {
  // No-op: RallyDataProvider handles availability fetching and Realtime subscriptions
}
