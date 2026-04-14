import { Tournament, Player, Match, MatchPhase, PlayerProfile, PlayerRating, LobbyEntry, AvailabilitySlot, MatchProposal, MatchSchedule, SkillLevel, Gender, DayOfWeek, MatchBroadcast, MatchResolution, Trophy, TrophyTier, Badge, BadgeType, MatchOffer, RallyNotification, DirectMessage, SchedulingSummary, MatchReaction, MatchFeedback, ReliabilityScore, EtiquetteScore, MatchSlot, RescheduleIntent, RescheduleReason, ScheduleHistoryEntry, RatingSnapshot } from './types'
import {
  syncTournament, syncLobbyEntry, syncRemoveLobbyEntry, syncRatingsForPlayer,
  syncAvailabilityToRemote, fetchAvailabilityForPlayers,
  getTournamentTimestamp, setTournamentTimestamp, refreshTournamentById,
  syncRatingSnapshot, syncTrophiesToRemote, syncBadgesToRemote,
  refreshLobbyFromRemote,
  SyncResult,
} from './sync'
import { titleCase } from './dateUtils'
import { getItem, setItem } from './memoryStore'
import { getClient } from './supabase'
import { apiJoinLobby, apiLeaveLobby, isApiConfigured } from './api'
import { bulkScheduleMatches, type SimpleAvailabilitySlot, type MatchToSchedule, clusterPlayersByAvailability, type PlayerAvailability } from '@rally/core'
import {
  bridgeGetTournaments, bridgeSetTournaments,
  bridgeGetLobby, bridgeSetLobby,
  bridgeGetRatings, bridgeSetRatings,
  bridgeGetAvailability, bridgeSetAvailability,
  bridgeGetTrophies, bridgeSetTrophies,
  bridgeGetBadges, bridgeSetBadges,
  bridgeGetRatingHistory, bridgeSetRatingHistory,
  bridgeGetFeedback, bridgeSetFeedback,
  bridgeGetEtiquetteScores, bridgeSetEtiquetteScores,
  bridgeGetBroadcasts, bridgeSetBroadcasts,
  bridgeGetMatchOffers, bridgeSetMatchOffers,
  bridgeGetNotifications, bridgeSetNotifications,
  bridgeGetMessages, bridgeSetMessages,
  bridgeGetReactions, bridgeSetReactions,
  bridgeGetReliabilityScores, bridgeSetReliabilityScores,
  bridgeGetPendingVictories, bridgeSetPendingVictories,
  bridgeGetPendingFeedback, bridgeSetPendingFeedback,
  bridgeShowError,
  bridgeNotifyOtherTabs,
} from './storeBridge'

const PROFILE_KEY = 'play-tennis-profile'

// --- Pending Feedback ---
// Persists across sync-driven re-renders so the feedback form stays visible

export interface PendingFeedback {
  matchId: string
  tournamentId: string
  opponentId: string
  opponentName: string
}

export function setPendingFeedback(data: PendingFeedback): void {
  bridgeSetPendingFeedback(data)
}

export function getPendingFeedback(): PendingFeedback | null {
  return bridgeGetPendingFeedback()
}

export function clearPendingFeedback(): void {
  bridgeSetPendingFeedback(null)
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// --- Profile ---

export function getProfile(): PlayerProfile | null {
  try {
    const data = getItem(PROFILE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function createProfile(
  name: string,
  county: string,
  options?: { skillLevel?: SkillLevel; gender?: Gender; email?: string; authId?: string },
): PlayerProfile {
  // Duplicate guard: return existing profile if one exists, but re-key it
  // to the auth UUID if the IDs diverged (random ID → stable auth UUID)
  const existing = getProfile()
  if (existing) {
    if (options?.authId && existing.id !== options.authId) {
      existing.id = options.authId
      existing.authId = options.authId
      if (options.email) existing.email = options.email
      setItem(PROFILE_KEY, JSON.stringify(existing))
    }
    return existing
  }

  // Auth UUID is the canonical player identity. Fall back to generateId()
  // only as a last resort (should not happen with current registration flow).
  const id = options?.authId ?? generateId()
  if (!options?.authId) {
    console.warn('[Rally] createProfile called without authId — player ID will not be stable across devices')
  }

  // Validate and sanitize inputs
  const trimmedName = name.trim().replace(/<[^>]*>/g, '').slice(0, 100)
  const trimmedCounty = county.trim().replace(/<[^>]*>/g, '').slice(0, 200)
  if (!trimmedName || !trimmedCounty) {
    console.warn('[Rally] Invalid profile data: empty name or county')
    // Return a minimal profile to prevent crashes
    const fallback: PlayerProfile = {
      id,
      authId: options?.authId,
      email: options?.email,
      name: trimmedName || 'Player',
      county: trimmedCounty || 'unknown',
      skillLevel: options?.skillLevel,
      gender: options?.gender,
      createdAt: new Date().toISOString(),
    }
    setItem(PROFILE_KEY, JSON.stringify(fallback))
    return fallback
  }

  const profile: PlayerProfile = {
    id,
    authId: options?.authId,
    email: options?.email,
    name: trimmedName,
    county: trimmedCounty,
    skillLevel: options?.skillLevel,
    gender: options?.gender,
    createdAt: new Date().toISOString(),
  }
  setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}


// --- Lobby ---

function loadLobby(): LobbyEntry[] {
  return bridgeGetLobby()
}

function saveLobby(lobby: LobbyEntry[]): void {
  bridgeSetLobby(lobby)
}

export function getLobbyByCounty(county: string): LobbyEntry[] {
  return loadLobby().filter(e => e.county.toLowerCase() === county.toLowerCase())
}

export function isInLobby(playerId: string): boolean {
  return loadLobby().some(e => e.playerId === playerId)
}

export async function joinLobby(profile: PlayerProfile): Promise<LobbyEntry[]> {
  const countyKey = profile.county.toLowerCase()
  const lobby = loadLobby()
  if (lobby.some(e => e.playerId === profile.id)) {
    // Already in lobby locally — refresh from Supabase to get full aggregated count
    await refreshLobbyFromRemote(countyKey)
    return getLobbyByCounty(profile.county)
  }
  const entry: LobbyEntry = {
    playerId: profile.id,
    playerName: profile.name,
    county: profile.county,
    joinedAt: new Date().toISOString(),
  }
  lobby.push(entry)

  // Save to bridge FIRST so UI updates immediately
  saveLobby(lobby)

  // Try backend API first (validates + writes with service role key)
  if (isApiConfigured()) {
    const apiOk = await apiJoinLobby(entry)
    if (!apiOk) {
      // API failed — fall back to direct Supabase write
      const result = await syncLobbyEntry(entry)
      if (!result.success) {
        console.warn('[Rally] Failed to sync lobby entry to Supabase', entry)
        bridgeShowError('Could not join lobby — check your connection')
      }
    }
  } else {
    // No API configured — direct Supabase write (legacy path)
    const result = await syncLobbyEntry(entry)
    if (!result.success) {
      console.warn('[Rally] Failed to sync lobby entry to Supabase', entry)
      bridgeShowError('Could not join lobby — check your connection')
    }
  }
  // Refresh from Supabase to get ALL players' entries (not just local)
  await refreshLobbyFromRemote(countyKey)
  return getLobbyByCounty(profile.county)
}

export async function leaveLobby(playerId: string): Promise<void> {
  const lobby = loadLobby().filter(e => e.playerId !== playerId)

  // Save to bridge FIRST for immediate UI update
  saveLobby(lobby)

  // Try backend API first
  if (isApiConfigured()) {
    const apiOk = await apiLeaveLobby(playerId)
    if (!apiOk) {
      const result = await syncRemoveLobbyEntry(playerId)
      if (!result.success) {
        console.warn('[Rally] Failed to remove lobby entry from Supabase', playerId)
        bridgeShowError('Could not leave lobby — check your connection')
      }
    }
  } else {
    const result = await syncRemoveLobbyEntry(playerId)
    if (!result.success) {
      console.warn('[Rally] Failed to remove lobby entry from Supabase', playerId)
      bridgeShowError('Could not leave lobby — check your connection')
    }
  }
}

const COUNTDOWN_MS = 48 * 60 * 60 * 1000 // 48 hours
const MIN_PLAYERS = 6
const MAX_PLAYERS = 8

export function getCountdownRemaining(tournament: Tournament): number | null {
  if (!tournament.countdownStartedAt || tournament.status !== 'setup') return null
  const elapsed = Date.now() - new Date(tournament.countdownStartedAt).getTime()
  return Math.max(0, COUNTDOWN_MS - elapsed)
}

export function getSetupTournamentForCounty(county: string): Tournament | undefined {
  return load().find(
    t => t.county.toLowerCase() === county.toLowerCase() && t.status === 'setup'
  )
}

function getNextTournamentNumber(county: string, extraTournaments: Tournament[] = []): number {
  const persisted = load()
  const all = [...persisted, ...extraTournaments]
  const countyTournaments = all.filter(
    t => t.county.toLowerCase() === county.toLowerCase()
  )
  let maxNum = 0
  for (const t of countyTournaments) {
    const match = t.name.match(/#(\d+)$/)
    if (match) {
      maxNum = Math.max(maxNum, parseInt(match[1], 10))
    }
  }
  return maxNum + 1
}

function getStartsAt(now: Date = new Date()): string {
  // Next Monday (or today if already Monday)
  const day = now.getDay() // 0=Sun, 1=Mon
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + daysUntilMonday)
  return monday.toISOString().split('T')[0]
}

function createTournament(county: string, players: LobbyEntry[], extraTournaments: Tournament[] = []): Tournament {
  const num = getNextTournamentNumber(county, extraTournaments)
  return {
    id: generateId(),
    name: `${titleCase(county)} Open #${num}`,
    date: new Date().toISOString().split('T')[0],
    county,
    format: 'round-robin',
    players: players.map(e => ({ id: e.playerId, name: e.playerName })),
    matches: [],
    status: 'setup',
    createdAt: new Date().toISOString(),
    startsAt: getStartsAt(),
    countdownStartedAt: new Date().toISOString(),
  }
}

export async function startTournamentFromLobby(county: string): Promise<Tournament | null> {
  const lobby = loadLobby()
  const allCounty = lobby.filter(e => e.county.toLowerCase() === county.toLowerCase())

  // Check if there's already a setup tournament for this county
  const existing = getSetupTournamentForCounty(county)

  if (existing) {
    // Add new lobby players to existing setup tournament
    const existingIds = new Set(existing.players.map(p => p.id))
    const newPlayers = allCounty.filter(e => !existingIds.has(e.playerId))

    if (newPlayers.length > 0) {
      const all = load()
      const t = all.find(x => x.id === existing.id)!
      const overflow: LobbyEntry[] = []
      for (const e of newPlayers) {
        if (t.players.length >= MAX_PLAYERS) {
          overflow.push(e)
        } else {
          t.players.push({ id: e.playerId, name: e.playerName })
        }
      }

      // If we hit max, start immediately
      if (t.players.length >= MAX_PLAYERS) {
        await saveAndSync(all, t)
        await generateBracket(t.id)
      } else {
        await saveAndSync(all, t)
      }

      // Create overflow tournaments for remaining players
      const takenIds = new Set(t.players.map(p => p.id))
      if (overflow.length >= MIN_PLAYERS) {
        const currentAll = load()
        const newlyCreated: Tournament[] = []
        while (overflow.length >= MIN_PLAYERS) {
          const batch = overflow.splice(0, MAX_PLAYERS)
          const newTournament = createTournament(county, batch, newlyCreated)
          currentAll.unshift(newTournament)
          newlyCreated.push(newTournament)
          for (const e of batch) takenIds.add(e.playerId)
          if (batch.length >= MAX_PLAYERS) {
            await saveAndSync(currentAll, newTournament)
            await generateBracket(newTournament.id)
          }
        }
        save(currentAll)
      }

      // Remove all assigned players from lobby
      const remainingLobby = lobby.filter(e => !takenIds.has(e.playerId))
      saveLobby(remainingLobby)

      return getTournament(t.id) ?? t
    }
    return existing
  }

  // Need at least MIN_PLAYERS to create a tournament
  if (allCounty.length < MIN_PLAYERS) return null

  // Cluster players by availability overlap, then create tournaments per group
  const all = load()
  let firstTournament: Tournament | null = null
  const takenIds = new Set<string>()
  const newlyCreated: Tournament[] = []

  // Fetch fresh availability from Supabase before clustering
  if (getClient()) {
    const remoteAvail = await fetchAvailabilityForPlayers(allCounty.map(e => e.playerId))
    for (const [pid, slots] of Object.entries(remoteAvail)) {
      const avail = loadAllAvailability()
      avail[pid] = slots
      saveAllAvailability(avail)
    }
  }

  const playerAvailabilities: PlayerAvailability[] = allCounty.map(e => ({
    playerId: e.playerId,
    playerName: e.playerName,
    slots: getAvailability(e.playerId),
  }))

  const clusterResult = clusterPlayersByAvailability(playerAvailabilities)

  for (const group of clusterResult.groups) {
    if (group.players.length < MIN_PLAYERS) continue
    const batch: LobbyEntry[] = group.players.map(p => {
      const entry = allCounty.find(e => e.playerId === p.playerId)!
      return entry
    })
    const tournament = createTournament(county, batch, newlyCreated)
    all.unshift(tournament)
    newlyCreated.push(tournament)
    for (const e of batch) takenIds.add(e.playerId)
    if (!firstTournament) firstTournament = tournament
  }

  // Batch sync all new tournaments to Supabase (single HTTP request)
  await saveAndSyncBatch(all, newlyCreated)

  // Remove players who entered tournaments from lobby
  const remainingLobby = lobby.filter(e => !takenIds.has(e.playerId))
  saveLobby(remainingLobby)
  await Promise.all(
    [...takenIds].map(id =>
      syncRemoveLobbyEntry(id).catch(() => { console.warn('[Rally] Failed to remove lobby entry from Supabase', id); bridgeShowError('Could not save — check your connection') })
    )
  )

  // Start any tournaments that are already at max capacity
  for (const t of load()) {
    if (t.county.toLowerCase() === county.toLowerCase() && t.status === 'setup' && t.players.length >= MAX_PLAYERS) {
      await generateBracket(t.id)
    }
  }

  return firstTournament ? (getTournament(firstTournament.id) ?? firstTournament) : null
}

// Check countdown and start tournament if expired
export async function checkCountdownExpired(tournamentId: string): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.status !== 'setup' || !t.countdownStartedAt) return undefined

  const remaining = getCountdownRemaining(t)
  if (remaining !== null && remaining <= 0 && t.players.length >= MIN_PLAYERS) {
    save(all)
    return await generateBracket(t.id)
  }
  return undefined
}

// Force-start a setup tournament (dev tool)
export async function forceStartTournament(tournamentId: string): Promise<Tournament | undefined> {
  const t = getTournament(tournamentId)
  if (!t || t.status !== 'setup') return undefined
  return await generateBracket(tournamentId)
}

// --- Friend Tournaments ---

export function getFriendTournaments(playerId: string): Tournament[] {
  return load().filter(t => t.type === 'friend' && t.players.some(p => p.id === playerId))
}

export function getTournamentByInviteCode(inviteCode: string): Tournament | undefined {
  return load().find(t => t.inviteCode === inviteCode)
}

/** Fetch just the county for a tournament invite code (used to pre-fill registration) */
export async function getInviteTournamentCounty(inviteCode: string): Promise<string | null> {
  const local = getTournamentByInviteCode(inviteCode)
  if (local) return local.county

  const client = getClient()
  if (!client) return null
  const { data } = await client
    .from('tournaments')
    .select('data')
    .contains('data', { inviteCode })
    .maybeSingle()
  if (data) {
    const tournament = data.data as Tournament
    return tournament.county
  }
  return null
}

export async function joinFriendTournament(inviteCode: string, profile: PlayerProfile): Promise<Tournament | null> {
  // Try RPC first — single atomic server-side operation
  const client = getClient()
  if (client) {
    try {
      const { data: rpcResult } = await client.rpc('rpc_join_friend_tournament', {
        p_invite_code: inviteCode,
        p_player_id: profile.id,
        p_player_name: profile.name,
      })
      if (rpcResult?.success && rpcResult.tournament) {
        // Update local state from RPC result
        const serverTournament = rpcResult.tournament as Tournament
        const all = bridgeGetTournaments()
        const idx = all.findIndex(t => t.id === serverTournament.id)
        if (idx >= 0) all[idx] = serverTournament
        else all.push(serverTournament)
        bridgeSetTournaments([...all])
        return serverTournament
      }
    } catch (err) {
      console.warn('[Rally] RPC join_friend_tournament failed, falling back to local:', err)
      bridgeShowError('Connection issue — your changes are saved locally but may not sync')
    }
  }

  // Fallback: read-modify-write path
  let tournament = getTournamentByInviteCode(inviteCode)

  // If not found locally, try fetching from Supabase
  if (!tournament) {
    if (client) {
      const { data } = await client
        .from('tournaments')
        .select('*')
        .contains('data', { inviteCode })
        .maybeSingle()
      if (data) {
        tournament = data.data as Tournament
        // Cache locally
        const all = load()
        if (!all.find(t => t.id === tournament!.id)) {
          all.unshift(tournament)
          save(all)
        }
        if (data.updated_at) {
          setTournamentTimestamp(tournament.id, data.updated_at)
        }
      }
    }
  }

  if (!tournament) return null
  if (tournament.status !== 'setup') return null
  if (tournament.players.some(p => p.id === profile.id)) return tournament // already joined
  const max = tournament.maxPlayers ?? 8
  if (tournament.players.length >= max) return null // full

  const all = load()
  const t = all.find(x => x.id === tournament!.id)
  if (!t) return null

  t.players.push({ id: profile.id, name: profile.name })

  // If we hit max, start countdown
  if (t.players.length >= MIN_PLAYERS && !t.countdownStartedAt) {
    t.countdownStartedAt = new Date().toISOString()
  }

  await saveAndSync(all, t)

  // Auto-start if at max
  if (t.players.length >= max) {
    await generateBracket(t.id)
  }

  return getTournament(t.id) ?? t
}

export async function cancelFriendTournament(tournamentId: string, playerId: string): Promise<boolean> {
  const tournament = getTournament(tournamentId)
  if (!tournament) return false
  if (tournament.type !== 'friend') return false
  if (tournament.createdBy !== playerId) return false
  if (tournament.status !== 'setup') return false

  await deleteTournament(tournamentId)
  return true
}

export async function startFriendTournament(tournamentId: string, playerId: string): Promise<Tournament | undefined> {
  const tournament = getTournament(tournamentId)
  if (!tournament) return undefined
  if (tournament.type !== 'friend') return undefined
  if (tournament.createdBy !== playerId) return undefined
  if (tournament.status !== 'setup') return undefined
  if (tournament.players.length < MIN_PLAYERS) return undefined

  return await generateBracket(tournamentId)
}

// --- Availability ---

function loadAllAvailability(): Record<string, AvailabilitySlot[]> {
  return bridgeGetAvailability()
}

function saveAllAvailability(avail: Record<string, AvailabilitySlot[]>): void {
  bridgeSetAvailability(avail)
}

export async function saveAvailability(playerId: string, slots: AvailabilitySlot[], county?: string, weeklyCap?: number): Promise<void> {
  // Validate and deduplicate slots
  const validSlots = slots
    .filter(s => s.startHour < s.endHour && s.startHour >= 0 && s.endHour <= 24)
    .filter((s, i, arr) => arr.findIndex(x => x.day === s.day && x.startHour === s.startHour && x.endHour === s.endHour) === i)

  const all = loadAllAvailability()
  all[playerId] = validSlots
  // Write to bridge FIRST (local-first pattern)
  saveAllAvailability(all)

  // Fallback: if county not provided, try to get it from the current profile.
  // This prevents callers from accidentally skipping the Supabase sync.
  if (!county) {
    const profile = getProfile()
    if (profile?.county) {
      county = profile.county
      weeklyCap = weeklyCap ?? profile.weeklyCap ?? 2
    }
  }

  // Sync to Supabase
  if (county) {
    const result = await syncAvailabilityToRemote(playerId, county, validSlots, weeklyCap ?? 2)
    if (!result.success) {
      console.warn('[Rally] Failed to sync availability to Supabase', playerId)
      bridgeShowError('Could not save your changes — please try again')
    } else {
      // Notify other tabs so they re-fetch and stay in sync
      bridgeNotifyOtherTabs()
    }
  } else {
    // Only dev/seed code paths should reach here (no profile context)
    console.warn('[Rally] saveAvailability called without county — skipping Supabase sync')
  }
}

export function getAvailability(playerId: string): AvailabilitySlot[] {
  return loadAllAvailability()[playerId] ?? []
}

// --- Upcoming Availability (next 3 days) ---

export interface UpcomingSlot {
  date: string       // ISO date e.g. "2026-03-10"
  dayLabel: string   // e.g. "Today", "Tomorrow", "Wednesday"
  playerId: string
  playerName: string
  startHour: number
  endHour: number
}

export function getUpcomingAvailability(tournament: Tournament, excludePlayerId?: string): UpcomingSlot[] {
  const DAY_NAMES: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const allAvail = loadAllAvailability()
  const slots: UpcomingSlot[] = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let d = 0; d < 3; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() + d)
    const dayOfWeek = DAY_NAMES[date.getDay()]
    const dateStr = date.toISOString().split('T')[0]
    const dayLabel = d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'long' })

    for (const player of tournament.players) {
      if (player.id === excludePlayerId) continue
      const playerSlots = allAvail[player.id] ?? []
      for (const slot of playerSlots) {
        if (slot.day === dayOfWeek) {
          // If today, skip slots that have already passed
          if (d === 0) {
            const nowHour = new Date().getHours()
            if (slot.endHour <= nowHour) continue
          }
          slots.push({
            date: dateStr,
            dayLabel,
            playerId: player.id,
            playerName: player.name,
            startHour: d === 0 ? Math.max(slot.startHour, new Date().getHours()) : slot.startHour,
            endHour: slot.endHour,
          })
        }
      }
    }
  }

  // Sort by date, then start hour
  slots.sort((a, b) => a.date.localeCompare(b.date) || a.startHour - b.startHour)
  return slots
}

// --- Scheduling Engine ---

function computeOverlap(slotsA: AvailabilitySlot[], slotsB: AvailabilitySlot[]): AvailabilitySlot[] {
  const overlaps: AvailabilitySlot[] = []
  for (const a of slotsA) {
    for (const b of slotsB) {
      if (a.day !== b.day) continue
      const start = Math.max(a.startHour, b.startHour)
      const end = Math.min(a.endHour, b.endHour)
      if (end - start >= 2) { // at least 2 hours (one match length) overlap
        overlaps.push({ day: a.day, startHour: start, endHour: end })
      }
    }
  }
  return overlaps
}

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

/** Split overlaps into 2-hour match windows */
function splitIntoMatchWindows(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const windows: AvailabilitySlot[] = []
  for (const slot of slots) {
    for (let h = slot.startHour; h + 2 <= slot.endHour; h += 2) {
      windows.push({ day: slot.day, startHour: h, endHour: h + 2 })
    }
  }
  return windows
}

function rankSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    // Prefer weekends
    const weekendA = (a.day === 'saturday' || a.day === 'sunday') ? 0 : 1
    const weekendB = (b.day === 'saturday' || b.day === 'sunday') ? 0 : 1
    if (weekendA !== weekendB) return weekendA - weekendB
    // Then by day order
    return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day) || a.startHour - b.startHour
  })
}

export function generateMatchSchedule(
  player1Id: string,
  player2Id: string,
  tournament?: Tournament,
  matchId?: string
): MatchSchedule {
  const slots1 = getAvailability(player1Id)
  const slots2 = getAvailability(player2Id)

  const overlaps = computeOverlap(slots1, slots2)
  const windows = splitIntoMatchWindows(overlaps)
  const ranked = rankSlots(windows)

  // Filter out days where either player already has a confirmed match
  const filtered = tournament
    ? ranked.filter(slot =>
        !hasConfirmedMatchOnDay(tournament, player1Id, slot.day, matchId ?? '') &&
        !hasConfirmedMatchOnDay(tournament, player2Id, slot.day, matchId ?? ''))
    : ranked

  // Generate up to 3 system proposals from 2-hour match windows
  const source = filtered.length > 0 ? filtered : ranked
  const proposals: MatchProposal[] = source.slice(0, 3).map(slot => ({
    id: generateId(),
    proposedBy: 'system',
    day: slot.day,
    startHour: slot.startHour,
    endHour: slot.endHour,
    status: 'pending',
  }))

  // If no overlap, use one player's slots as suggestions
  if (proposals.length === 0) {
    const fallback = rankSlots(splitIntoMatchWindows([...slots1, ...slots2]))
    const fallbackFiltered = tournament
      ? fallback.filter(slot =>
          !hasConfirmedMatchOnDay(tournament, player1Id, slot.day, matchId ?? '') &&
          !hasConfirmedMatchOnDay(tournament, player2Id, slot.day, matchId ?? ''))
      : fallback
    const fallbackSource = fallbackFiltered.length > 0 ? fallbackFiltered : fallback
    for (const slot of fallbackSource.slice(0, 3)) {
      proposals.push({
        id: generateId(),
        proposedBy: 'system',
        day: slot.day,
        startHour: slot.startHour,
        endHour: slot.endHour,
        status: 'pending',
      })
    }
  }

  return {
    status: proposals.length > 0 ? 'proposed' : 'unscheduled',
    proposals,
    confirmedSlot: null,
    createdAt: new Date().toISOString(),
    escalationDay: 0,
    lastEscalation: new Date().toISOString(),
  }
}

function createProposalObjects(
  proposedBy: 'system' | string,
  slots: MatchSlot[]
): MatchProposal[] {
  return slots.map(slot => ({
    id: generateId(),
    proposedBy,
    day: slot.day,
    startHour: slot.startHour,
    endHour: slot.endHour,
    status: 'pending',
  }))
}

function createScheduleHistoryEntry(
  type: ScheduleHistoryEntry['type'],
  changedBy: string,
  fromSlot?: MatchSlot,
  toSlot?: MatchSlot
): ScheduleHistoryEntry {
  return {
    id: generateId(),
    type,
    changedBy,
    changedAt: new Date().toISOString(),
    fromSlot,
    toSlot,
  }
}

function clearActiveRescheduleRequest(schedule: MatchSchedule): void {
  delete schedule.activeRescheduleRequest
}

function getOpponentIdForPlayer(match: Match, playerId: string): string | null {
  if (match.player1Id === playerId) return match.player2Id
  if (match.player2Id === playerId) return match.player1Id
  return null
}

function canStartReschedule(match: Match): match is Match & { schedule: MatchSchedule } {
  return Boolean(
    match.schedule &&
    match.schedule.status === 'confirmed' &&
    match.schedule.confirmedSlot &&
    !match.completed &&
    !match.scoreReportedBy &&
    !match.schedule.activeRescheduleRequest
  )
}

export type RescheduleUiState =
  | 'none'
  | 'soft_request_sent'
  | 'soft_request_received'
  | 'hard_request_sent'
  | 'hard_request_received'

export function getRescheduleUiState(match: Match, currentPlayerId: string): RescheduleUiState {
  const request = match.schedule?.activeRescheduleRequest
  if (!request || request.status !== 'pending') return 'none'
  const isRequester = request.requestedBy === currentPlayerId
  if (request.intent === 'soft') {
    return isRequester ? 'soft_request_sent' : 'soft_request_received'
  }
  return isRequester ? 'hard_request_sent' : 'hard_request_received'
}

/** Check if a player already has a confirmed match on a given day in this tournament */
function hasConfirmedMatchOnDay(tournament: Tournament, playerId: string, day: string, excludeMatchId: string): boolean {
  return tournament.matches.some(m =>
    m.id !== excludeMatchId &&
    !m.completed &&
    m.schedule?.status === 'confirmed' &&
    m.schedule.confirmedSlot?.day === day &&
    (m.player1Id === playerId || m.player2Id === playerId)
  )
}

export async function acceptProposal(
  tournamentId: string,
  matchId: string,
  proposalId: string,
  acceptedBy: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule) return undefined

  const proposal = match.schedule.proposals.find(p => p.id === proposalId)
  if (!proposal || proposal.status !== 'pending') return undefined

  // Prevent same-day conflicts: reject if either player already has a confirmed match on this day
  const player1 = match.player1Id
  const player2 = match.player2Id
  if (player1 && hasConfirmedMatchOnDay(t, player1, proposal.day, matchId)) return undefined
  if (player2 && hasConfirmedMatchOnDay(t, player2, proposal.day, matchId)) return undefined

  // Mark this proposal as accepted, others as rejected
  for (const p of match.schedule.proposals) {
    p.status = p.id === proposalId ? 'accepted' : 'rejected'
  }

  match.schedule.status = 'confirmed'
  match.schedule.schedulingTier = 'auto'
  const nextSlot: MatchSlot = {
    day: proposal.day,
    startHour: proposal.startHour,
    endHour: proposal.endHour,
  }
  match.schedule.confirmedSlot = nextSlot

  // Track participation: +4 for accepting
  if (!match.schedule.participationScores) match.schedule.participationScores = {}
  match.schedule.participationScores[acceptedBy] = (match.schedule.participationScores[acceptedBy] ?? 0) + 4

  if (match.schedule.activeRescheduleRequest?.status === 'pending') {
    const request = match.schedule.activeRescheduleRequest
    request.status = 'accepted'
    request.respondedBy = acceptedBy
    request.respondedAt = new Date().toISOString()
    request.selectedProposalId = proposalId
    if (request.countsTowardLimit) {
      match.schedule.rescheduleCount = (match.schedule.rescheduleCount ?? 0) + 1
    }
    if (!match.schedule.scheduleHistory) match.schedule.scheduleHistory = []
    match.schedule.scheduleHistory.push(
      createScheduleHistoryEntry('rescheduled', acceptedBy, request.originalSlot, nextSlot)
    )
    clearActiveRescheduleRequest(match.schedule)
  }

  // Invalidate cached summary so it recomputes from match data
  delete t.schedulingSummary

  await saveAndSync(all, t)
  return t
}

async function requestRescheduleInternal(
  tournamentId: string,
  matchId: string,
  requesterId: string,
  intent: RescheduleIntent,
  reason: RescheduleReason,
  slots: MatchSlot[],
  note?: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match || !canStartReschedule(match)) return undefined

  const currentCount = match.schedule.rescheduleCount ?? 0
  if (currentCount >= 2) return undefined

  const currentSlot = match.schedule.confirmedSlot
  if (!currentSlot) return undefined

  match.schedule.activeRescheduleRequest = {
    id: generateId(),
    intent,
    requestedBy: requesterId,
    requestedAt: new Date().toISOString(),
    reason,
    note: note?.trim() || undefined,
    originalSlot: currentSlot,
    status: 'pending',
    countsTowardLimit: true,
    originalSlotReleasedAt: intent === 'hard' ? new Date().toISOString() : undefined,
  }

  match.schedule.proposals = createProposalObjects(requesterId, slots)

  if (!match.schedule.participationScores) match.schedule.participationScores = {}
  match.schedule.participationScores[requesterId] = (match.schedule.participationScores[requesterId] ?? 0) + 3

  if (intent === 'hard') {
    if (!match.schedule.scheduleHistory) match.schedule.scheduleHistory = []
    match.schedule.scheduleHistory.push(
      createScheduleHistoryEntry('original-slot-released', requesterId, currentSlot)
    )
    match.schedule.confirmedSlot = null
    match.schedule.status = match.schedule.proposals.length > 0 ? 'proposed' : 'unscheduled'
  } else {
    match.schedule.status = 'confirmed'
  }

  const requesterName = t.players.find(p => p.id === requesterId)?.name ?? 'Your opponent'
  const opponentId = getOpponentIdForPlayer(match, requesterId)
  if (opponentId) {
    addNotification({
      type: 'match_reminder',
      recipientId: opponentId,
      senderId: requesterId,
      senderName: requesterName,
      message: intent === 'hard'
        ? `${requesterName} can't make the current match time. This match needs a new time.`
        : `${requesterName} asked to move the current match time.`,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  }

  await saveAndSync(all, t)
  return t
}

export async function requestSoftReschedule(
  tournamentId: string,
  matchId: string,
  requesterId: string,
  reason: RescheduleReason,
  slots: MatchSlot[],
  note?: string
): Promise<Tournament | undefined> {
  if (slots.length === 0) return undefined
  return requestRescheduleInternal(tournamentId, matchId, requesterId, 'soft', reason, slots, note)
}

export async function requestHardReschedule(
  tournamentId: string,
  matchId: string,
  requesterId: string,
  reason: RescheduleReason,
  slots: MatchSlot[],
  note?: string
): Promise<Tournament | undefined> {
  return requestRescheduleInternal(tournamentId, matchId, requesterId, 'hard', reason, slots, note)
}

export async function declineSoftReschedule(
  tournamentId: string,
  matchId: string,
  responderId: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule?.activeRescheduleRequest) return undefined

  const request = match.schedule.activeRescheduleRequest
  if (request.intent !== 'soft' || request.requestedBy === responderId) return undefined

  request.status = 'declined'
  request.respondedBy = responderId
  request.respondedAt = new Date().toISOString()
  match.schedule.proposals = []
  clearActiveRescheduleRequest(match.schedule)

  const responderName = t.players.find(p => p.id === responderId)?.name ?? 'Your opponent'
  addNotification({
    type: 'match_reminder',
    recipientId: request.requestedBy,
    senderId: responderId,
    senderName: responderName,
    message: `${responderName} kept the current match time.`,
    relatedMatchId: matchId,
    relatedTournamentId: tournamentId,
  })

  await saveAndSync(all, t)
  return t
}

export async function counterReschedule(
  tournamentId: string,
  matchId: string,
  responderId: string,
  slots: MatchSlot[],
  note?: string
): Promise<Tournament | undefined> {
  if (slots.length === 0) return undefined

  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule?.activeRescheduleRequest) return undefined

  const request = match.schedule.activeRescheduleRequest
  if (request.requestedBy === responderId) return undefined

  match.schedule.proposals = createProposalObjects(responderId, slots)
  if (note?.trim()) {
    request.note = note.trim()
  }

  if (!match.schedule.participationScores) match.schedule.participationScores = {}
  match.schedule.participationScores[responderId] = (match.schedule.participationScores[responderId] ?? 0) + 3

  const responderName = t.players.find(p => p.id === responderId)?.name ?? 'Your opponent'
  addNotification({
    type: 'match_reminder',
    recipientId: request.requestedBy,
    senderId: responderId,
    senderName: responderName,
    message: `${responderName} suggested another match time.`,
    relatedMatchId: matchId,
    relatedTournamentId: tournamentId,
  })

  await saveAndSync(all, t)
  return t
}

export async function withdrawSoftReschedule(
  tournamentId: string,
  matchId: string,
  requesterId: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule?.activeRescheduleRequest) return undefined

  const request = match.schedule.activeRescheduleRequest
  if (request.intent !== 'soft' || request.requestedBy !== requesterId) return undefined

  request.status = 'withdrawn'
  clearActiveRescheduleRequest(match.schedule)
  match.schedule.proposals = []

  const requesterName = t.players.find(p => p.id === requesterId)?.name ?? 'Your opponent'
  const opponentId = getOpponentIdForPlayer(match, requesterId)
  if (opponentId) {
    addNotification({
      type: 'match_reminder',
      recipientId: opponentId,
      senderId: requesterId,
      senderName: requesterName,
      message: `${requesterName} withdrew the reschedule request. The original match time still stands.`,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  }

  await saveAndSync(all, t)
  return t
}

export async function proposeNewSlots(
  tournamentId: string,
  matchId: string,
  proposedBy: string,
  slots: { day: DayOfWeek; startHour: number; endHour: number }[]
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule) return undefined

  for (const slot of slots) {
    match.schedule.proposals.push({
      id: generateId(),
      proposedBy,
      day: slot.day,
      startHour: slot.startHour,
      endHour: slot.endHour,
      status: 'pending',
    })
  }

  if (match.schedule.status === 'unscheduled') {
    match.schedule.status = 'proposed'
  }

  // Track participation: +3 for proposing
  if (!match.schedule.participationScores) match.schedule.participationScores = {}
  match.schedule.participationScores[proposedBy] = (match.schedule.participationScores[proposedBy] ?? 0) + 3

  await saveAndSync(all, t)
  return t
}

export async function escalateMatch(
  tournamentId: string,
  matchId: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule || match.schedule.status === 'confirmed' || match.schedule.status === 'resolved') return undefined

  match.schedule.escalationDay += 1
  match.schedule.lastEscalation = new Date().toISOString()

  // Day 3: system assigns provisional slot from best available
  if (match.schedule.escalationDay === 3 && match.schedule.status !== 'escalated') {
    const pending = match.schedule.proposals.filter(p => p.status === 'pending')
    if (pending.length > 0) {
      const best = pending[0]
      for (const p of match.schedule.proposals) {
        p.status = p.id === best.id ? 'accepted' : 'rejected'
      }
      match.schedule.status = 'confirmed'
      match.schedule.confirmedSlot = { day: best.day, startHour: best.startHour, endHour: best.endHour }
    } else {
      match.schedule.status = 'escalated'
    }
  }

  // Day 4+: trigger resolution based on participation scores
  if (match.schedule.escalationDay >= 4 && match.schedule.status === 'escalated') {
    await resolveMatchByParticipation(t, match)
  }

  await saveAndSync(all, t)
  return t
}

const PARTICIPATION_THRESHOLD = 3

async function resolveMatchByParticipation(tournament: Tournament, match: Match): Promise<void> {
  if (!match.schedule || !match.player1Id || !match.player2Id) return

  const scores = match.schedule.participationScores ?? {}
  const score1 = scores[match.player1Id] ?? 0
  const score2 = scores[match.player2Id] ?? 0

  const p1Above = score1 >= PARTICIPATION_THRESHOLD
  const p2Above = score2 >= PARTICIPATION_THRESHOLD

  let resolution: MatchResolution

  if (p1Above && !p2Above) {
    // Case 1: Player 1 wins walkover
    resolution = {
      type: 'walkover',
      winnerId: match.player1Id,
      reason: 'Opponent did not participate in scheduling',
      resolvedAt: new Date().toISOString(),
    }
    match.winnerId = match.player1Id
    match.completed = true
    match.score1 = []
    match.score2 = []

    // Update Elo
    const p1 = tournament.players.find(p => p.id === match.player1Id)
    const p2 = tournament.players.find(p => p.id === match.player2Id)
    if (p1 && p2) await updateRatings(p1, p2, p1.id)

    // Advance winner
    advanceWinner(tournament, match, match.player1Id)
  } else if (!p1Above && p2Above) {
    // Case 2: Player 2 wins walkover
    resolution = {
      type: 'walkover',
      winnerId: match.player2Id,
      reason: 'Opponent did not participate in scheduling',
      resolvedAt: new Date().toISOString(),
    }
    match.winnerId = match.player2Id
    match.completed = true
    match.score1 = []
    match.score2 = []

    const p1 = tournament.players.find(p => p.id === match.player1Id)
    const p2 = tournament.players.find(p => p.id === match.player2Id)
    if (p1 && p2) await updateRatings(p1, p2, p2.id)

    advanceWinner(tournament, match, match.player2Id)
  } else if (p1Above && p2Above) {
    // Case 3: Both participated — forced match assignment
    resolution = {
      type: 'forced-match',
      winnerId: null,
      reason: 'Both players participated but could not agree on a time',
      resolvedAt: new Date().toISOString(),
      forcedSlot: { day: 'sunday', startHour: 10, endHour: 11 },
    }
    match.schedule.status = 'confirmed'
    match.schedule.confirmedSlot = { day: 'sunday', startHour: 10, endHour: 11 }
  } else {
    // Case 4: Neither participated — double loss
    resolution = {
      type: 'double-loss',
      winnerId: null,
      reason: 'Neither player participated in scheduling',
      resolvedAt: new Date().toISOString(),
    }
    match.completed = true
    match.score1 = []
    match.score2 = []
  }

  match.schedule.resolution = resolution
  match.resolution = resolution
  match.schedule.status = 'resolved'

  // Check if tournament is complete
  const allDone = tournament.matches.every(m => m.completed)
  if (allDone) {
    tournament.status = 'completed'
    awardTournamentTrophies(tournament.id, tournament)
    for (const p of tournament.players) {
      checkAndAwardBadges(p.id, tournament.id, tournament)
    }
  }
}

function advanceWinner(tournament: Tournament, match: Match, winnerId: string): void {
  if (tournament.format === 'single-elimination') {
    const nextRoundMatches = tournament.matches.filter(m => m.round === match.round + 1)
    const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
    if (nextMatch) {
      if (match.position % 2 === 0) {
        nextMatch.player1Id = winnerId
      } else {
        nextMatch.player2Id = winnerId
      }
      if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
        nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
      }
    }
  } else if (tournament.format === 'group-knockout' || tournament.format === 'round-robin') {
    if (match.phase === 'group') {
      // Check if all group matches are done → generate knockout
      const groupMatches = tournament.matches.filter(m => m.phase === 'group')
      const allGroupDone = groupMatches.every(m => m.completed)
      if (allGroupDone && !tournament.groupPhaseComplete) {
        generateKnockoutPhase(tournament)
      }
    } else if (match.phase === 'knockout') {
      const nextRoundMatches = tournament.matches.filter(m => m.round === match.round + 1 && m.phase === 'knockout')
      const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
      if (nextMatch) {
        if (match.position % 2 === 0) {
          nextMatch.player1Id = winnerId
        } else {
          nextMatch.player2Id = winnerId
        }
        if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
          nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
        }
      }
    }
  }
}

// --- Tournaments ---

function load(): Tournament[] {
  return bridgeGetTournaments()
}

function save(tournaments: Tournament[]): void {
  bridgeSetTournaments(tournaments)
}

/** Supabase-first save: syncs a specific tournament, then updates bridge */
async function saveAndSync(all: Tournament[], changedTournament: Tournament): Promise<SyncResult> {
  const result = await syncTournament(changedTournament, getTournamentTimestamp(changedTournament.id))
  if (!result.success) {
    if (result.conflict) {
      // Conflict: refresh from remote and retry once with fresh timestamp
      const fresh = await refreshTournamentById(changedTournament.id)
      if (fresh) {
        // Re-apply our changes on top of the fresh remote state
        const mergedAll = all.map(t => t.id === changedTournament.id ? changedTournament : t)
        const retry = await syncTournament(changedTournament, getTournamentTimestamp(changedTournament.id))
        if (retry.success) {
          bridgeSetTournaments(mergedAll)
          return { success: true }
        }
      }
      // Conflict couldn't be resolved remotely — still save locally so UI updates
      bridgeSetTournaments(all)
      console.warn('[Rally] Tournament sync conflict could not be resolved', changedTournament.id)
      bridgeShowError('Changes saved locally but may not sync until you\'re back online')
      return { success: true }
    }
    // Network error: save locally + log warning
    bridgeSetTournaments(all)
    console.warn('[Rally] Failed to sync tournament to Supabase', changedTournament.id)
    bridgeShowError('Changes saved locally but may not sync until you\'re back online')
    return { success: true }
  }
  bridgeSetTournaments(all)
  bridgeNotifyOtherTabs()
  return { success: true }
}

/** Batch sync: upserts multiple tournaments in a single request */
async function saveAndSyncBatch(all: Tournament[], tournaments: Tournament[]): Promise<void> {
  if (tournaments.length > 0) {
    const client = getClient()
    if (client) {
      const rows = tournaments.map(t => ({
        id: t.id,
        county: t.county,
        data: t,
      }))
      const { error } = await client.from('tournaments').upsert(rows, { onConflict: 'id' })
      if (error) {
        console.warn('[Rally] Failed to batch sync tournaments to Supabase', error)
        bridgeShowError('Could not save tournaments — check your connection')
      }
    }
  }
  bridgeSetTournaments(all)
}

export function getTournaments(): Tournament[] {
  return load()
}

export function getTournamentsByCounty(county: string): Tournament[] {
  return load().filter(t => t.county && t.county.toLowerCase() === county.toLowerCase())
}

export function getPlayerTournaments(playerId: string): Tournament[] {
  return load().filter(t => t.players.some(p => p.id === playerId))
}

export function getTournament(id: string): Tournament | undefined {
  return load().find(t => t.id === id)
}

export async function deleteTournament(tournamentId: string): Promise<void> {
  const all = load().filter(t => t.id !== tournamentId)
  save(all)
  // Also delete from Supabase
  const client = getClient()
  if (client) {
    await client.from('tournaments').delete().eq('id', tournamentId)
  }
}

export async function leaveTournament(tournamentId: string, playerId: string): Promise<boolean> {
  // Try RPC first — atomic server-side forfeit
  const client = getClient()
  if (client) {
    try {
      const { data: rpcResult } = await client.rpc('rpc_forfeit_player', {
        p_tournament_id: tournamentId,
        p_player_id: playerId,
      })
      if (rpcResult?.success && rpcResult.tournament) {
        const serverTournament = rpcResult.tournament as Tournament
        const all = bridgeGetTournaments()
        const idx = all.findIndex(t => t.id === serverTournament.id)
        if (idx >= 0) all[idx] = serverTournament
        bridgeSetTournaments([...all])

        // Award trophies/badges if tournament completed
        if (serverTournament.status === 'completed') {
          awardTournamentTrophies(serverTournament.id, serverTournament)
          for (const p of serverTournament.players) {
            checkAndAwardBadges(p.id, serverTournament.id, serverTournament)
          }
        }
        return true
      }
    } catch (err) {
      console.warn('[Rally] RPC forfeit failed, falling back to local:', err)
      bridgeShowError('Connection issue — your changes are saved locally but may not sync')
    }
  }

  // Fallback: local read-modify-write
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return false

  // Can't leave if not a participant
  if (!t.players.some(p => p.id === playerId)) return false

  // Setup: just remove from player list
  if (t.status === 'setup') {
    t.players = t.players.filter(p => p.id !== playerId)
    if (t.players.length === 0) {
      // Remove empty tournament
      save(all.filter(x => x.id !== tournamentId))
      const client = getClient()
      if (client) {
        await client.from('tournaments').delete().eq('id', tournamentId)
      }
    } else {
      await saveAndSync(all, t)
    }
    return true
  }

  // In-progress: forfeit all incomplete matches involving this player
  for (const match of t.matches) {
    if (match.completed) continue

    const isPlayer1 = match.player1Id === playerId
    const isPlayer2 = match.player2Id === playerId
    if (!isPlayer1 && !isPlayer2) continue

    const opponentId = isPlayer1 ? match.player2Id : match.player1Id
    if (opponentId) {
      // Opponent wins by walkover
      match.winnerId = opponentId
      match.completed = true
      match.score1 = []
      match.score2 = []
      match.resolution = {
        type: 'walkover',
        winnerId: opponentId,
        reason: 'Opponent left the tournament',
        resolvedAt: new Date().toISOString(),
      }
      if (match.schedule) {
        match.schedule.status = 'resolved'
        match.schedule.resolution = match.resolution
      }

      // Advance opponent
      advanceWinner(t, match, opponentId)
    } else {
      // No opponent yet — just mark completed
      match.completed = true
    }
  }

  // Remove player from the tournament roster
  t.players = t.players.filter(p => p.id !== playerId)

  // Check if tournament is now complete
  const allDone = t.matches.every(m => m.completed)
  if (allDone) {
    t.status = 'completed'
    awardTournamentTrophies(t.id, t)
    for (const p of t.players) {
      checkAndAwardBadges(p.id, t.id, t)
    }
  }

  await saveAndSync(all, t)
  return true
}

// Generate seed positions so top seeds are placed apart in bracket
function getSeedPositions(size: number): number[] {
  if (size === 1) return [0]
  const positions = [0, 1]
  while (positions.length < size) {
    const next: number[] = []
    const len = positions.length
    for (let i = 0; i < len; i++) {
      next.push(positions[i] * 2)
      next.push(len * 2 - 1 - positions[i] * 2)
    }
    positions.length = 0
    positions.push(...next)
  }
  return positions
}

export async function generateBracket(tournamentId: string): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.players.length < 2) return undefined

  // Fetch remote availability so we have all players' slots (not just local user's)
  if (getClient()) {
    const remoteAvail = await fetchAvailabilityForPlayers(t.players.map(p => p.id))
    for (const [pid, slots] of Object.entries(remoteAvail)) {
      const avail = loadAllAvailability()
      avail[pid] = slots
      saveAllAvailability(avail)
    }
  }

  if (t.format === 'single-elimination') {
    const seeded = [...t.players].sort((a, b) => {
      const rA = getPlayerRating(a.id, a.name).rating
      const rB = getPlayerRating(b.id, b.name).rating
      return rB - rA
    })
    const size = Math.pow(2, Math.ceil(Math.log2(seeded.length)))
    const slots = new Array<Player | null>(size).fill(null)
    const seedOrder = getSeedPositions(size)
    for (let i = 0; i < seeded.length; i++) {
      slots[seedOrder[i]] = seeded[i]
    }
    const padded: (Player | null)[] = slots

    const totalRounds = Math.log2(size)
    const matches: Match[] = []

    for (let i = 0; i < size / 2; i++) {
      const p1 = padded[i * 2]
      const p2 = padded[i * 2 + 1]
      const isBye = !p1 || !p2
      matches.push({
        id: generateId(),
        round: 1,
        position: i,
        player1Id: p1?.id ?? null,
        player2Id: p2?.id ?? null,
        score1: [],
        score2: [],
        winnerId: isBye ? (p1?.id ?? p2?.id ?? null) : null,
        completed: isBye,
      })
    }

    for (let round = 2; round <= totalRounds; round++) {
      const matchesInRound = size / Math.pow(2, round)
      for (let i = 0; i < matchesInRound; i++) {
        matches.push({
          id: generateId(),
          round,
          position: i,
          player1Id: null,
          player2Id: null,
          score1: [],
          score2: [],
          winnerId: null,
          completed: false,
        })
      }
    }

    advanceByes(matches)
    t.matches = matches
  } else if (t.format === 'group-knockout') {
    // Group phase: full round robin (every player plays every other player)
    const matches: Match[] = []
    for (let i = 0; i < t.players.length; i++) {
      for (let j = i + 1; j < t.players.length; j++) {
        matches.push({
          id: generateId(),
          round: 1,
          position: matches.length,
          player1Id: t.players[i].id,
          player2Id: t.players[j].id,
          score1: [],
          score2: [],
          winnerId: null,
          completed: false,
          phase: 'group',
        })
      }
    }
    // Knockout matches (semis + final) are generated when group phase completes
    t.groupPhaseComplete = false
    t.matches = matches
  } else {
    // Round-robin: all players play each other (group phase), then top 4 play semifinals + final
    const matches: Match[] = []
    for (let i = 0; i < t.players.length; i++) {
      for (let j = i + 1; j < t.players.length; j++) {
        matches.push({
          id: generateId(),
          round: 1,
          position: matches.length,
          player1Id: t.players[i].id,
          player2Id: t.players[j].id,
          score1: [],
          score2: [],
          winnerId: null,
          completed: false,
          phase: 'group',
        })
      }
    }
    t.groupPhaseComplete = false
    t.matches = matches
  }

  // Bulk-schedule all matches with both players assigned
  const matchesToSchedule: MatchToSchedule[] = t.matches
    .filter(m => m.player1Id && m.player2Id && !m.completed)
    .map(m => ({ matchId: m.id, player1Id: m.player1Id!, player2Id: m.player2Id! }))

  const allAvailability: Record<string, SimpleAvailabilitySlot[]> = {}
  for (const p of t.players) {
    allAvailability[p.id] = getAvailability(p.id)
  }

  const scheduleResult = bulkScheduleMatches(matchesToSchedule, allAvailability)

  // Apply confirmed matches
  for (const { matchId, slot } of scheduleResult.confirmed) {
    const m = t.matches.find(x => x.id === matchId)
    if (m) {
      m.schedule = {
        status: 'confirmed',
        proposals: [{
          id: generateId(),
          proposedBy: 'system',
          day: slot.day as DayOfWeek,
          startHour: slot.startHour,
          endHour: slot.endHour,
          status: 'accepted',
        }],
        confirmedSlot: { day: slot.day as DayOfWeek, startHour: slot.startHour, endHour: slot.endHour },
        createdAt: new Date().toISOString(),
        escalationDay: 0,
        lastEscalation: new Date().toISOString(),
        participationScores: {},
        schedulingTier: 'auto',
      }
    }
  }

  // Apply needs-accept matches (suggest best slot)
  for (const { matchId, slot } of scheduleResult.needsAccept) {
    const m = t.matches.find(x => x.id === matchId)
    if (m) {
      m.schedule = {
        status: 'proposed',
        proposals: [{
          id: generateId(),
          proposedBy: 'system',
          day: slot.day as DayOfWeek,
          startHour: slot.startHour,
          endHour: slot.endHour,
          status: 'pending',
        }],
        confirmedSlot: null,
        createdAt: new Date().toISOString(),
        escalationDay: 0,
        lastEscalation: new Date().toISOString(),
        participationScores: {},
        schedulingTier: 'needs-accept',
      }
    }
  }

  // Apply needs-negotiation matches (fall back to per-match scheduling)
  for (const { matchId } of scheduleResult.needsNegotiation) {
    const m = t.matches.find(x => x.id === matchId)
    if (m && m.player1Id && m.player2Id) {
      m.schedule = generateMatchSchedule(m.player1Id, m.player2Id, t, m.id)
      if (m.schedule) {
        m.schedule.schedulingTier = 'needs-negotiation'
      }
    }
  }

  // Set scheduling summary
  t.schedulingSummary = {
    confirmed: scheduleResult.confirmed.length,
    needsAccept: scheduleResult.needsAccept.length,
    needsNegotiation: scheduleResult.needsNegotiation.length,
    scheduledAt: new Date().toISOString(),
  }

  t.status = 'in-progress'
  await saveAndSync(all, t)
  return t
}

/** Get scheduling summary for a tournament */
export function getSchedulingSummary(tournament: Tournament): SchedulingSummary | null {
  if (tournament.schedulingSummary) return tournament.schedulingSummary
  // Compute from match data if not cached
  if (tournament.status === 'setup' || tournament.status === 'scheduling') return null
  let confirmed = 0, needsAccept = 0, needsNegotiation = 0
  for (const m of tournament.matches) {
    if (!m.schedule) continue
    switch (m.schedule.schedulingTier) {
      case 'auto': confirmed++; break
      case 'needs-accept': needsAccept++; break
      case 'needs-negotiation': needsNegotiation++; break
    }
  }
  return { confirmed, needsAccept, needsNegotiation, scheduledAt: tournament.createdAt }
}

/** Compute scheduling confidence for a set of players in a county lobby */
export function getSchedulingConfidence(county: string): { score: number; label: 'high' | 'medium' | 'low'; playersWithAvailability: number } {
  const lobby = getLobbyByCounty(county)
  const allAvail = loadAllAvailability()

  let withAvailability = 0
  const playerSlots: Array<{ playerId: string; slots: AvailabilitySlot[] }> = []

  for (const entry of lobby) {
    const slots = allAvail[entry.playerId] ?? []
    if (slots.length > 0) {
      withAvailability++
      playerSlots.push({ playerId: entry.playerId, slots })
    }
  }

  if (playerSlots.length < 2) {
    return { score: 0, label: 'low', playersWithAvailability: withAvailability }
  }

  // Compute average pairwise overlap
  let totalOverlap = 0
  let pairs = 0
  for (let i = 0; i < playerSlots.length; i++) {
    for (let j = i + 1; j < playerSlots.length; j++) {
      const overlap = computeOverlap(playerSlots[i].slots, playerSlots[j].slots)
      const windows = splitIntoMatchWindows(overlap)
      totalOverlap += windows.length
      pairs++
    }
  }

  const avgOverlap = pairs > 0 ? totalOverlap / pairs : 0
  // Map to 0-100 score: 3+ windows = high (70+), 1-3 = medium, 0 = low
  const score = Math.min(100, Math.round((avgOverlap / 5) * 100))
  const label = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low'

  return { score, label, playersWithAvailability: withAvailability }
}

// Compute group standings for group-knockout format
export function getGroupStandings(tournament: Tournament): { id: string; name: string; wins: number; losses: number; setsWon: number; setsLost: number; gamesWon: number; gamesLost: number }[] {
  const stats = tournament.players.map(p => ({
    id: p.id,
    name: p.name,
    wins: 0,
    losses: 0,
    setsWon: 0,
    setsLost: 0,
    gamesWon: 0,
    gamesLost: 0,
  }))

  // For both group-knockout and round-robin, count only group phase matches
  // Skip split-decision matches (disputed, don't count for standings)
  const groupMatches = tournament.matches.filter(m => m.phase === 'group')
  for (const match of groupMatches) {
    if (!match.completed || match.splitDecision) continue
    const s1 = stats.find(s => s.id === match.player1Id)
    const s2 = stats.find(s => s.id === match.player2Id)
    if (!s1 || !s2) continue

    if (match.winnerId === match.player1Id) {
      s1.wins++
      s2.losses++
    } else {
      s2.wins++
      s1.losses++
    }

    for (let i = 0; i < match.score1.length; i++) {
      s1.gamesWon += match.score1[i]
      s1.gamesLost += match.score2[i]
      s2.gamesWon += match.score2[i]
      s2.gamesLost += match.score1[i]
      if (match.score1[i] > match.score2[i]) {
        s1.setsWon++
        s2.setsLost++
      } else {
        s2.setsWon++
        s1.setsLost++
      }
    }
  }

  stats.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const aSetDiff = a.setsWon - a.setsLost
    const bSetDiff = b.setsWon - b.setsLost
    if (bSetDiff !== aSetDiff) return bSetDiff - aSetDiff
    return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost)
  })

  return stats
}

// Generate knockout phase matches for group-knockout format
function generateKnockoutPhase(tournament: Tournament): void {
  const standings = getGroupStandings(tournament)
  const top4 = standings.slice(0, 4)

  // Semi 1: #1 vs #4
  const semi1: Match = {
    id: generateId(),
    round: 2,
    position: 0,
    player1Id: top4[0]?.id ?? null,
    player2Id: top4[3]?.id ?? null,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    phase: 'knockout',
  }

  // Semi 2: #2 vs #3
  const semi2: Match = {
    id: generateId(),
    round: 2,
    position: 1,
    player1Id: top4[1]?.id ?? null,
    player2Id: top4[2]?.id ?? null,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    phase: 'knockout',
  }

  // Final: TBD vs TBD
  const final: Match = {
    id: generateId(),
    round: 3,
    position: 0,
    player1Id: null,
    player2Id: null,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    phase: 'knockout',
  }

  tournament.matches.push(semi1, semi2, final)
  tournament.groupPhaseComplete = true

  // Generate schedules for semis
  if (semi1.player1Id && semi1.player2Id) {
    semi1.schedule = generateMatchSchedule(semi1.player1Id, semi1.player2Id)
  }
  if (semi2.player1Id && semi2.player2Id) {
    semi2.schedule = generateMatchSchedule(semi2.player1Id, semi2.player2Id)
  }
}

function advanceByes(matches: Match[]): void {
  const round1 = matches.filter(m => m.round === 1)
  const round2 = matches.filter(m => m.round === 2)

  for (let i = 0; i < round1.length; i++) {
    const m = round1[i]
    if (m.completed && m.winnerId) {
      const nextMatch = round2[Math.floor(i / 2)]
      if (nextMatch) {
        if (i % 2 === 0) {
          nextMatch.player1Id = m.winnerId
        } else {
          nextMatch.player2Id = m.winnerId
        }
      }
    }
  }
}

export async function saveMatchScore(
  tournamentId: string,
  matchId: string,
  score1: number[],
  score2: number[],
  winnerId: string,
  reportedBy?: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match) return undefined

  // Note: ratings are NOT applied here. The 2-phase offline flow applies them
  // in confirmMatchScore when match.completed flips to true. The RPC atomic
  // path applies them inside the success branch below (since RPC completes
  // the match in one shot). Applying them here would double-count when both
  // saveMatchScore and confirmMatchScore run.
  const p1 = t.players.find(p => p.id === match.player1Id)
  const p2 = t.players.find(p => p.id === match.player2Id)
  const winner = t.players.find(p => p.id === winnerId)

  // Try RPC for atomic score submission + bracket advancement
  {
    const client = getClient()
    if (client) {
      try {
        const { data, error } = await client.rpc('rpc_submit_score', {
          p_tournament_id: tournamentId,
          p_match_id: matchId,
          p_score1: score1,
          p_score2: score2,
          p_winner_id: winnerId,
        })
        if (!error && data?.success) {
          // Server handled score + advancement atomically — apply ratings now
          if (p1 && p2 && winner) {
            await updateRatings(p1, p2, winner.id)
          }
          const serverTournament = data.tournament as Tournament
          if (data.updated_at) {
            setTournamentTimestamp(tournamentId, data.updated_at)
          }

          // Handle phase transition: group → knockout (for group-knockout and round-robin)
          if (serverTournament.format === 'group-knockout' || serverTournament.format === 'round-robin') {
            const serverMatch = serverTournament.matches.find((m: Match) => m.id === matchId)
            if (serverMatch?.phase === 'group') {
              const groupMatches = serverTournament.matches.filter((m: Match) => m.phase === 'group')
              const allGroupDone = groupMatches.every((m: Match) => m.completed)
              if (allGroupDone && !serverTournament.groupPhaseComplete) {
                generateKnockoutPhase(serverTournament)
                // Re-sync the updated tournament with knockout phase
                await syncTournament(serverTournament, data.updated_at)
              }
            }
          }

          // Award trophies/badges locally
          const allDone = serverTournament.matches.every((m: Match) => m.completed)
          if (allDone && serverTournament.status === 'completed') {
            awardTournamentTrophies(serverTournament.id, serverTournament)
            for (const p of serverTournament.players) {
              checkAndAwardBadges(p.id, serverTournament.id, serverTournament)
            }
          }

          // Update local cache
          const idx = all.findIndex(x => x.id === tournamentId)
          if (idx >= 0) all[idx] = serverTournament
          else all.unshift(serverTournament)
          save(all)
          return serverTournament
        }
      } catch {
        // RPC failed, fall through to local logic
      }
    }
  }

  // Phase 1 fallback: local score — mark as reported, not completed
  match.score1 = score1
  match.score2 = score2
  match.winnerId = winnerId
  match.scoreReportedBy = reportedBy ?? winnerId // Reporter is the current player
  match.scoreReportedAt = new Date().toISOString()
  // Don't set completed=true — wait for opponent confirmation

  // Persist pending feedback so the form shows after reporting
  const feedbackOpponentId = match.player1Id === (reportedBy ?? winnerId) ? match.player2Id! : match.player1Id!
  const feedbackOpponentName = t.players.find(p => p.id === feedbackOpponentId)?.name ?? 'Opponent'
  setPendingFeedback({ matchId, tournamentId, opponentId: feedbackOpponentId, opponentName: feedbackOpponentName })

  // Send notification to opponent
  const reporterName = t.players.find(p => p.id === match.scoreReportedBy)?.name ?? 'Your opponent'
  const opponentId = match.player1Id === match.scoreReportedBy ? match.player2Id : match.player1Id
  if (opponentId) {
    const scoreStr = score1.map((s, i) => `${s}-${score2[i]}`).join(', ')
    addNotification({
      type: 'score_reported',
      recipientId: opponentId,
      senderId: match.scoreReportedBy,
      senderName: reporterName,
      message: `${reporterName} reported a score: ${scoreStr}. Please confirm.`,
      detail: scoreStr,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  }

  await saveAndSync(all, t)
  return t
}

export async function confirmMatchScore(
  tournamentId: string,
  matchId: string,
  currentPlayerId: string
): Promise<Tournament | undefined> {
  // Try atomic RPC first — handles score confirmation + ratings + history in one transaction
  const client = getClient()
  if (client) {
    try {
      const { data: rpcResult } = await client.rpc('rpc_confirm_score', {
        p_tournament_id: tournamentId,
        p_match_id: matchId,
        p_confirming_player_id: currentPlayerId,
      })
      if (rpcResult?.success && rpcResult.tournament) {
        const serverTournament = rpcResult.tournament as Tournament
        const all = bridgeGetTournaments()
        const idx = all.findIndex(t => t.id === serverTournament.id)
        if (idx >= 0) all[idx] = serverTournament
        else all.push(serverTournament)
        bridgeSetTournaments([...all])

        // Update local ratings from RPC result
        if (rpcResult.ratings) {
          const ratings = bridgeGetRatings()
          const pA = rpcResult.ratings.playerA
          const pB = rpcResult.ratings.playerB
          if (pA) ratings[pA.id] = { name: pA.name ?? pA.id, rating: pA.rating, matchesPlayed: pA.matchesPlayed }
          if (pB) ratings[pB.id] = { name: pB.name ?? pB.id, rating: pB.rating, matchesPlayed: pB.matchesPlayed }
          bridgeSetRatings({ ...ratings })
        }

        // Award trophies/badges locally if tournament completed (client-side presentation logic)
        if (serverTournament.status === 'completed') {
          awardTournamentTrophies(serverTournament.id, serverTournament)
          for (const p of serverTournament.players) {
            checkAndAwardBadges(p.id, serverTournament.id, serverTournament)
          }
        }

        // Set pending feedback for the confirming player
        const match = serverTournament.matches.find(m => m.id === matchId)
        if (match) {
          const opponentId = match.player1Id === currentPlayerId ? match.player2Id! : match.player1Id!
          const opponentName = serverTournament.players.find(p => p.id === opponentId)?.name ?? 'Opponent'
          setPendingFeedback({ matchId, tournamentId, opponentId, opponentName })
        }

        return serverTournament
      }
    } catch (err) {
      console.warn('[Rally] RPC confirm_score failed, falling back to local:', err)
      bridgeShowError('Connection issue — your changes are saved locally but may not sync')
    }
  }

  // Fallback: local logic (same as before)
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match || !match.scoreReportedBy || match.completed) return undefined

  // Only the non-reporting player can confirm
  const isReporter = match.scoreReportedBy === currentPlayerId
  if (isReporter) return undefined

  const winnerId = match.winnerId
  match.completed = true
  match.scoreConfirmedBy = currentPlayerId
  match.scoreConfirmedAt = new Date().toISOString()

  // Update ELO ratings
  const p1 = t.players.find(p => p.id === match.player1Id)
  const p2 = t.players.find(p => p.id === match.player2Id)
  if (p1 && p2 && winnerId) {
    await updateRatings(p1, p2, winnerId)
  }

  // Advance winner in single-elimination
  if (t.format === 'single-elimination' && winnerId) {
    const nextRoundMatches = t.matches.filter(m => m.round === match.round + 1)
    const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
    if (nextMatch) {
      if (match.position % 2 === 0) {
        nextMatch.player1Id = winnerId
      } else {
        nextMatch.player2Id = winnerId
      }
      if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
        nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
      }
    }
  }

  // Group-knockout and round-robin: check if group phase is done, generate knockout
  if (t.format === 'group-knockout' || t.format === 'round-robin') {
    if (match.phase === 'group') {
      const groupMatches = t.matches.filter(m => m.phase === 'group')
      const allGroupDone = groupMatches.every(m => m.completed)
      if (allGroupDone && !t.groupPhaseComplete) {
        generateKnockoutPhase(t)
      }
    } else if (match.phase === 'knockout' && winnerId) {
      const nextRoundMatches = t.matches.filter(m => m.round === match.round + 1 && m.phase === 'knockout')
      const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
      if (nextMatch) {
        if (match.position % 2 === 0) {
          nextMatch.player1Id = winnerId
        } else {
          nextMatch.player2Id = winnerId
        }
        if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
          nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
        }
      }
    }
  }

  // Notify reporter that score was confirmed
  if (match.scoreReportedBy) {
    const confirmerName = t.players.find(p => p.id === currentPlayerId)?.name ?? 'Your opponent'
    addNotification({
      type: 'score_reported',
      recipientId: match.scoreReportedBy,
      senderId: currentPlayerId,
      senderName: confirmerName,
      message: `${confirmerName} confirmed the score.`,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  }

  const allDone = t.matches.every(m => m.completed)
  if (allDone) {
    t.status = 'completed'
    awardTournamentTrophies(t.id, t)
    for (const p of t.players) {
      checkAndAwardBadges(p.id, t.id, t)
    }
  }

  // Persist pending feedback so the form survives sync-driven re-renders
  const opponentId = match.player1Id === currentPlayerId ? match.player2Id! : match.player1Id!
  const opponentName = t.players.find(p => p.id === opponentId)?.name ?? 'Opponent'
  setPendingFeedback({ matchId, tournamentId, opponentId, opponentName })

  await saveAndSync(all, t)
  return t
}

export async function cancelMatch(
  tournamentId: string,
  matchId: string,
  reason: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match) return undefined

  match.resolution = {
    type: 'walkover',
    winnerId: null,
    reason,
    resolvedAt: new Date().toISOString(),
  }
  match.completed = true

  await saveAndSync(all, t)
  return t
}

// --- Match Reactions ---

function loadReactions(): MatchReaction[] {
  return bridgeGetReactions()
}

function saveReactionsToStorage(reactions: MatchReaction[]): void {
  bridgeSetReactions(reactions)
}

export function saveMatchReaction(reaction: MatchReaction): void {
  const reactions = loadReactions()
  // Replace existing reaction from same player for same match
  const idx = reactions.findIndex(r => r.matchId === reaction.matchId && r.playerId === reaction.playerId)
  if (idx >= 0) {
    reactions[idx] = reaction
  } else {
    reactions.push(reaction)
  }
  saveReactionsToStorage(reactions)
}

export function getMatchReactions(matchId: string): MatchReaction[] {
  return loadReactions().filter(r => r.matchId === matchId)
}

export function getPlayerName(tournament: Tournament, playerId: string | null): string {
  if (!playerId) return 'TBD'
  return tournament.players.find(p => p.id === playerId)?.name ?? 'Unknown'
}

export function getSeeds(tournament: Tournament): Map<string, number> {
  const seeds = new Map<string, number>()
  if (tournament.format === 'single-elimination' || tournament.format === 'group-knockout') {
    const sorted = [...tournament.players].sort((a, b) => {
      return getPlayerRating(b.id, b.name).rating - getPlayerRating(a.id, a.name).rating
    })
    sorted.forEach((p, i) => seeds.set(p.id, i + 1))
  }
  return seeds
}

// --- Player Ratings (Global Elo) ---

function loadRatings(): Record<string, PlayerRating> {
  return bridgeGetRatings()
}

function saveRatings(ratings: Record<string, PlayerRating>): void {
  // Spread into a new reference so React's useState triggers a re-render.
  // updateRatings() mutates the rating objects in place, so passing `ratings`
  // directly would be a no-op for subscribers (same Object.is identity) and the
  // UI would not reflect the new rating until an unrelated re-render.
  bridgeSetRatings({ ...ratings })
}

/** Sync specific player ratings to Supabase */
async function saveRatingsAndSync(ratings: Record<string, PlayerRating>, ...playerIds: string[]): Promise<void> {
  saveRatings(ratings)
  for (const id of playerIds) {
    const rating = ratings[id]
    if (rating) {
      const result = await syncRatingsForPlayer(id, rating)
      if (!result.success) {
        console.warn('[Rally] Failed to sync rating to Supabase', id)
        bridgeShowError('Could not update your rating — please try again')
      }
    }
  }
}

export function getPlayerRating(playerId: string, playerName?: string): PlayerRating {
  const ratings = loadRatings()
  // Try by ID first
  if (ratings[playerId]) return ratings[playerId]
  // Fallback: try legacy name-based key
  const displayName = playerName ?? playerId
  const legacyKey = displayName.trim().toLowerCase()
  if (ratings[legacyKey]) return ratings[legacyKey]
  return { name: displayName, rating: 1000, matchesPlayed: 0 }
}

function kFactor(matchesPlayed: number): number {
  return 250 / Math.pow(matchesPlayed + 5, 0.4)
}

export function winProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export async function updateRatings(
  playerA: { id: string; name: string },
  playerB: { id: string; name: string },
  winnerId: string
): Promise<void> {
  const ratings = loadRatings()

  const a = ratings[playerA.id] ?? { name: playerA.name, rating: 1000, matchesPlayed: 0 }
  const b = ratings[playerB.id] ?? { name: playerB.name, rating: 1000, matchesPlayed: 0 }
  // Keep display name current
  a.name = playerA.name
  b.name = playerB.name

  const pA = winProbability(a.rating, b.rating)

  const kA = kFactor(a.matchesPlayed)
  const kB = kFactor(b.matchesPlayed)

  const sA = winnerId === playerA.id ? 1 : 0
  const sB = 1 - sA

  a.rating = Math.round((a.rating + kA * (sA - pA)) * 10) / 10
  b.rating = Math.round((b.rating + kB * (sB - (1 - pA))) * 10) / 10
  a.matchesPlayed += 1
  b.matchesPlayed += 1

  ratings[playerA.id] = a
  ratings[playerB.id] = b
  await saveRatingsAndSync(ratings, playerA.id, playerB.id)
  recordRatingSnapshot(playerA.id, a.rating)
  recordRatingSnapshot(playerB.id, b.rating)
}

// --- Rating History ---

function loadRatingHistory(): Record<string, RatingSnapshot[]> {
  return bridgeGetRatingHistory()
}

function saveRatingHistory(history: Record<string, RatingSnapshot[]>): void {
  bridgeSetRatingHistory(history)
}

function recordRatingSnapshot(playerId: string, rating: number): void {
  const timestamp = new Date().toISOString()
  const history = loadRatingHistory()
  if (!history[playerId]) history[playerId] = []
  history[playerId].push({ rating, timestamp })
  saveRatingHistory(history)
  // Sync to Supabase
  syncRatingSnapshot(playerId, rating, timestamp).catch(err => { console.warn('[Rally] Rating snapshot sync failed:', err); bridgeShowError('Could not update your rating — please try again') })
}

export function getRatingHistory(playerId: string): RatingSnapshot[] {
  return loadRatingHistory()[playerId] ?? []
}

export function getRatingTrend(playerId: string): number {
  const history = getRatingHistory(playerId)
  if (history.length < 2) return 0
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weekAgoStr = weekAgo.toISOString()
  // Find earliest snapshot within the last week, or use the one just before
  let baseRating = history[0].rating
  for (const snap of history) {
    if (snap.timestamp < weekAgoStr) {
      baseRating = snap.rating
    } else {
      break
    }
  }
  const currentRating = history[history.length - 1].rating
  return Math.round(currentRating - baseRating)
}

export function getRatingLabel(rating: number, matchesPlayed?: number): string {
  // Placement period: first 5 matches
  if (matchesPlayed !== undefined && matchesPlayed < 5) {
    return `Placement (${matchesPlayed}/5)`
  }
  if (rating >= 1800) return 'Diamond'
  if (rating >= 1600) return 'Platinum'
  if (rating >= 1400) return 'Gold'
  if (rating >= 1200) return 'Silver'
  return 'Bronze'
}

// --- Match History ---

export interface MatchHistoryEntry {
  matchId: string
  tournamentId: string
  tournamentName: string
  opponentId: string
  opponentName: string
  score: string        // e.g. "6-3 6-4" or "4-6 6-3 7-5"
  won: boolean
  date: string         // tournament date
  round: number
  format: Tournament['format']
  phase?: MatchPhase
}

export function getMatchHistory(playerId: string): MatchHistoryEntry[] {
  const tournaments = load()
  const entries: MatchHistoryEntry[] = []

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (!match.completed || !match.winnerId) continue
      if (match.player1Id !== playerId && match.player2Id !== playerId) continue
      if (!match.player1Id || !match.player2Id) continue

      const isPlayer1 = match.player1Id === playerId
      const opponentId = isPlayer1 ? match.player2Id : match.player1Id
      const opponentName = getPlayerName(tournament, opponentId)
      const won = match.winnerId === playerId

      // Format score from player's perspective
      const sets: string[] = []
      for (let i = 0; i < match.score1.length; i++) {
        const myScore = isPlayer1 ? match.score1[i] : match.score2[i]
        const theirScore = isPlayer1 ? match.score2[i] : match.score1[i]
        sets.push(`${myScore}-${theirScore}`)
      }

      entries.push({
        matchId: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        opponentId,
        opponentName,
        score: sets.join(' '),
        won,
        date: tournament.date,
        round: match.round,
        format: tournament.format,
        phase: match.phase,
      })
    }
  }

  // Most recent first
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return entries
}

export function getHeadToHead(playerId: string, opponentId: string): { wins: number; losses: number; matches: MatchHistoryEntry[] } {
  const history = getMatchHistory(playerId)
  const h2h = history.filter(m => m.opponentId === opponentId)
  return {
    wins: h2h.filter(m => m.won).length,
    losses: h2h.filter(m => !m.won).length,
    matches: h2h,
  }
}

export interface RecentResult {
  matchId: string
  tournamentId: string
  tournamentName: string
  winnerId: string
  winnerName: string
  loserId: string
  loserName: string
  score: string
  round: number
  date: string
}

export function getRecentResults(county: string, limit: number = 10): RecentResult[] {
  const tournaments = load().filter(t => t.county === county)
  const results: RecentResult[] = []

  for (const tournament of tournaments) {
    for (const match of tournament.matches) {
      if (!match.completed || !match.winnerId || !match.player1Id || !match.player2Id) continue

      const loserId = match.winnerId === match.player1Id ? match.player2Id : match.player1Id
      const winnerName = getPlayerName(tournament, match.winnerId)
      const loserName = getPlayerName(tournament, loserId)

      const sets: string[] = []
      for (let i = 0; i < match.score1.length; i++) {
        const ws = match.winnerId === match.player1Id ? match.score1[i] : match.score2[i]
        const ls = match.winnerId === match.player1Id ? match.score2[i] : match.score1[i]
        sets.push(`${ws}-${ls}`)
      }

      results.push({
        matchId: match.id,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        winnerId: match.winnerId,
        winnerName,
        loserId,
        loserName,
        score: sets.join(' '),
        round: match.round,
        date: tournament.date,
      })
    }
  }

  results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return results.slice(0, limit)
}

// --- Leaderboard ---

export interface LeaderboardEntry {
  name: string
  rating: number
  matchesPlayed: number
  rank: number
  wins: number
  losses: number
}

export function getCountyLeaderboard(county: string): LeaderboardEntry[] {
  const tournaments = load()
  // Map player ID -> { name, wins, losses }
  const playerMap = new Map<string, { name: string; wins: number; losses: number }>()

  // Collect all players from tournaments in this county
  for (const t of tournaments) {
    if (t.county.toLowerCase() !== county.toLowerCase()) continue
    for (const p of t.players) {
      if (!playerMap.has(p.id)) playerMap.set(p.id, { name: p.name, wins: 0, losses: 0 })
    }
    for (const m of t.matches) {
      if (!m.completed || !m.winnerId) continue
      const p1 = t.players.find(p => p.id === m.player1Id)
      const p2 = t.players.find(p => p.id === m.player2Id)
      if (p1) {
        const s = playerMap.get(p1.id) ?? { name: p1.name, wins: 0, losses: 0 }
        if (m.winnerId === p1.id) s.wins++; else s.losses++
        playerMap.set(p1.id, s)
      }
      if (p2) {
        const s = playerMap.get(p2.id) ?? { name: p2.name, wins: 0, losses: 0 }
        if (m.winnerId === p2.id) s.wins++; else s.losses++
        playerMap.set(p2.id, s)
      }
    }
  }

  // Also include lobby entries
  const lobby = loadLobby()
  for (const e of lobby) {
    if (e.county.toLowerCase() === county.toLowerCase()) {
      if (!playerMap.has(e.playerId)) playerMap.set(e.playerId, { name: e.playerName, wins: 0, losses: 0 })
    }
  }

  const entries: LeaderboardEntry[] = []
  for (const [playerId, stats] of playerMap) {
    const r = getPlayerRating(playerId, stats.name)
    entries.push({ name: stats.name, rating: r.rating, matchesPlayed: r.matchesPlayed, rank: 0, wins: stats.wins, losses: stats.losses })
  }

  entries.sort((a, b) => b.rating - a.rating)
  entries.forEach((e, i) => e.rank = i + 1)

  return entries
}

export function getPlayerRank(playerName: string, county: string): { rank: number; total: number; percentile: number } {
  const leaderboard = getCountyLeaderboard(county)
  const total = leaderboard.length
  const entry = leaderboard.find(e => e.name.toLowerCase() === playerName.toLowerCase())
  const rank = entry?.rank ?? total
  const percentile = total > 0 ? Math.round(((total - rank) / total) * 100) : 0
  return { rank, total, percentile }
}

// --- Trophies ---

function loadTrophies(): Trophy[] {
  return bridgeGetTrophies()
}

async function saveTrophies(trophies: Trophy[], newTrophies?: Trophy[]): Promise<void> {
  bridgeSetTrophies(trophies)
  if (newTrophies && newTrophies.length > 0) {
    try {
      await syncTrophiesToRemote(newTrophies)
    } catch (err) {
      console.warn('[Rally] Trophy sync failed:', err)
      bridgeShowError('Could not save trophy — please refresh')
    }
  }
}

export function getPlayerTrophies(playerId: string): Trophy[] {
  return loadTrophies().filter(t => t.playerId === playerId)
    .sort((a, b) => {
      const tierOrder: Record<TrophyTier, number> = { champion: 0, finalist: 1, semifinalist: 2 }
      return tierOrder[a.tier] - tierOrder[b.tier] || b.awardedAt.localeCompare(a.awardedAt)
    })
}

function formatMatchScore(score1: number[], score2: number[]): string {
  return score1.map((s, i) => `${s}-${score2[i]}`).join(' ')
}

export function awardTournamentTrophies(tournamentId: string, tournamentObj?: Tournament): Trophy[] {
  const t = tournamentObj ?? load().find(t => t.id === tournamentId)
  if (!t || t.status !== 'completed') return []

  const trophies = loadTrophies()
  // Don't re-award if already done
  if (trophies.some(tr => tr.tournamentId === tournamentId)) return []

  const newTrophies: Trophy[] = []
  const now = new Date().toISOString()

  if (t.format === 'single-elimination') {
    // Find the final match (highest round)
    const maxRound = Math.max(...t.matches.map(m => m.round))
    const finalMatch = t.matches.find(m => m.round === maxRound && m.completed)
    if (!finalMatch || !finalMatch.winnerId) return []

    const champion = t.players.find(p => p.id === finalMatch.winnerId)
    const finalist = t.players.find(p => p.id === (finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id))
    const scoreStr = formatMatchScore(
      finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score1 : finalMatch.score2,
      finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score2 : finalMatch.score1
    )

    if (champion) {
      newTrophies.push({
        id: generateId(), playerId: champion.id, playerName: champion.name,
        tournamentId: t.id, tournamentName: t.name, county: t.county,
        tier: 'champion', date: t.date, awardedAt: now,
        finalMatch: { opponentName: finalist?.name ?? 'Unknown', score: scoreStr, won: true }
      })
    }
    if (finalist) {
      newTrophies.push({
        id: generateId(), playerId: finalist.id, playerName: finalist.name,
        tournamentId: t.id, tournamentName: t.name, county: t.county,
        tier: 'finalist', date: t.date, awardedAt: now,
        finalMatch: { opponentName: champion?.name ?? 'Unknown', score: scoreStr, won: false }
      })
    }

    // Semifinalists: lost in the round before the final
    const semiRound = maxRound - 1
    if (semiRound >= 1) {
      const semiMatches = t.matches.filter(m => m.round === semiRound && m.completed)
      for (const sm of semiMatches) {
        if (!sm.winnerId) continue
        const loserId = sm.player1Id === sm.winnerId ? sm.player2Id : sm.player1Id
        if (!loserId) continue
        const loser = t.players.find(p => p.id === loserId)
        if (loser) {
          newTrophies.push({
            id: generateId(), playerId: loser.id, playerName: loser.name,
            tournamentId: t.id, tournamentName: t.name, county: t.county,
            tier: 'semifinalist', date: t.date, awardedAt: now,
          })
        }
      }
    }
  } else if (t.format === 'group-knockout') {
    // Knockout phase matches
    const knockoutMatches = t.matches.filter(m => m.phase === 'knockout')
    const maxRound = Math.max(...knockoutMatches.map(m => m.round))
    const finalMatch = knockoutMatches.find(m => m.round === maxRound && m.completed)

    if (!finalMatch || !finalMatch.winnerId) return []

    const champion = t.players.find(p => p.id === finalMatch.winnerId)
    const finalist = t.players.find(p => p.id === (finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id))
    const scoreStr = formatMatchScore(
      finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score1 : finalMatch.score2,
      finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score2 : finalMatch.score1
    )

    if (champion) {
      newTrophies.push({
        id: generateId(), playerId: champion.id, playerName: champion.name,
        tournamentId: t.id, tournamentName: t.name, county: t.county,
        tier: 'champion', date: t.date, awardedAt: now,
        finalMatch: { opponentName: finalist?.name ?? 'Unknown', score: scoreStr, won: true }
      })
    }
    if (finalist) {
      newTrophies.push({
        id: generateId(), playerId: finalist.id, playerName: finalist.name,
        tournamentId: t.id, tournamentName: t.name, county: t.county,
        tier: 'finalist', date: t.date, awardedAt: now,
        finalMatch: { opponentName: champion?.name ?? 'Unknown', score: scoreStr, won: false }
      })
    }

    // Semifinalists
    const semiRound = maxRound - 1
    const semiMatches = knockoutMatches.filter(m => m.round === semiRound && m.completed)
    for (const sm of semiMatches) {
      if (!sm.winnerId) continue
      const loserId = sm.player1Id === sm.winnerId ? sm.player2Id : sm.player1Id
      if (!loserId) continue
      const loser = t.players.find(p => p.id === loserId)
      if (loser) {
        newTrophies.push({
          id: generateId(), playerId: loser.id, playerName: loser.name,
          tournamentId: t.id, tournamentName: t.name, county: t.county,
          tier: 'semifinalist', date: t.date, awardedAt: now,
        })
      }
    }
  } else if (t.format === 'round-robin') {
    // Round-robin with playoff phase: semis + final determine trophies
    const knockoutMatches = t.matches.filter(m => m.phase === 'knockout')
    if (knockoutMatches.length > 0) {
      const maxRound = Math.max(...knockoutMatches.map(m => m.round))
      const finalMatch = knockoutMatches.find(m => m.round === maxRound && m.completed)
      if (finalMatch && finalMatch.winnerId) {
        const champion = t.players.find(p => p.id === finalMatch.winnerId)
        const finalist = t.players.find(p => p.id === (finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id))
        const scoreStr = formatMatchScore(
          finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score1 : finalMatch.score2,
          finalMatch.winnerId === finalMatch.player1Id ? finalMatch.score2 : finalMatch.score1
        )
        if (champion) {
          newTrophies.push({
            id: generateId(), playerId: champion.id, playerName: champion.name,
            tournamentId: t.id, tournamentName: t.name, county: t.county,
            tier: 'champion', date: t.date, awardedAt: now,
            finalMatch: { opponentName: finalist?.name ?? 'Unknown', score: scoreStr, won: true }
          })
        }
        if (finalist) {
          newTrophies.push({
            id: generateId(), playerId: finalist.id, playerName: finalist.name,
            tournamentId: t.id, tournamentName: t.name, county: t.county,
            tier: 'finalist', date: t.date, awardedAt: now,
            finalMatch: { opponentName: champion?.name ?? 'Unknown', score: scoreStr, won: false }
          })
        }
        // Semifinalists
        const semiRound = maxRound - 1
        const semiMatches = knockoutMatches.filter(m => m.round === semiRound && m.completed)
        for (const sm of semiMatches) {
          if (!sm.winnerId) continue
          const loserId = sm.player1Id === sm.winnerId ? sm.player2Id : sm.player1Id
          if (!loserId) continue
          const loser = t.players.find(p => p.id === loserId)
          if (loser) {
            newTrophies.push({
              id: generateId(), playerId: loser.id, playerName: loser.name,
              tournamentId: t.id, tournamentName: t.name, county: t.county,
              tier: 'semifinalist', date: t.date, awardedAt: now,
            })
          }
        }
      }
    }
  }

  trophies.push(...newTrophies)
  saveTrophies(trophies, newTrophies)

  // Set pending victory for each player so UI can show animation
  for (const trophy of newTrophies) {
    setPendingVictory(trophy)
  }

  return newTrophies
}

export function isDefendingChampion(playerName: string, county: string): boolean {
  const trophies = loadTrophies()
  return trophies.some(t =>
    t.playerName.toLowerCase() === playerName.toLowerCase() &&
    t.county.toLowerCase() === county.toLowerCase() &&
    t.tier === 'champion'
  )
}

// --- Badges ---

function loadBadges(): Badge[] {
  return bridgeGetBadges()
}

async function saveBadges(badges: Badge[], newBadges?: Badge[]): Promise<void> {
  bridgeSetBadges(badges)
  if (newBadges && newBadges.length > 0) {
    try {
      await syncBadgesToRemote(newBadges)
    } catch (err) {
      console.warn('[Rally] Badge sync failed:', err)
      bridgeShowError('Could not save badge — please refresh')
    }
  }
}

export function getPlayerBadges(playerId: string): Badge[] {
  return loadBadges().filter(b => b.playerId === playerId)
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
}

const BADGE_DEFS: Record<BadgeType, { label: string; description: string }> = {
  'first-tournament': { label: 'First Tournament', description: 'Completed your first tournament' },
  'undefeated-champion': { label: 'Undefeated', description: 'Won a tournament without losing a match' },
  'comeback-win': { label: 'Comeback', description: 'Won a match after losing the first set' },
  'five-tournaments': { label: 'Veteran', description: 'Completed 5 tournaments' },
  'ten-matches': { label: 'Seasoned', description: 'Played 10 rated matches' },
  'reliable-player': { label: 'Reliable', description: 'Consistently shows up and confirms promptly' },
  'good-sport': { label: 'Good Sport', description: 'Highly rated for fairness by opponents' },
  'community-regular': { label: 'Regular', description: 'Played 15+ matches across 3+ tournaments' },
}

function awardBadge(playerId: string, type: BadgeType, tournamentId?: string): void {
  const badges = loadBadges()
  if (badges.some(b => b.playerId === playerId && b.type === type)) return
  const def = BADGE_DEFS[type]
  const newBadge: Badge = {
    id: generateId(),
    playerId,
    type,
    label: def.label,
    description: def.description,
    awardedAt: new Date().toISOString(),
    tournamentId,
  }
  badges.push(newBadge)
  saveBadges(badges, [newBadge])
}

export function checkAndAwardBadges(playerId: string, tournamentId: string, tournamentObj?: Tournament): Badge[] {
  const before = getPlayerBadges(playerId)
  const savedTournaments = load()
  // Merge in the unsaved tournament object so we see it as completed
  const tournaments = tournamentObj
    ? savedTournaments.map(st => st.id === tournamentObj.id ? tournamentObj : st)
    : savedTournaments
  // If the tournament isn't in saved list yet, add it
  if (tournamentObj && !tournaments.some(t => t.id === tournamentObj.id)) {
    tournaments.push(tournamentObj)
  }

  const completed = tournaments.filter(t =>
    t.status === 'completed' && t.players.some(p => p.id === playerId)
  )

  // First tournament
  if (completed.length >= 1) awardBadge(playerId, 'first-tournament', tournamentId)
  // Five tournaments
  if (completed.length >= 5) awardBadge(playerId, 'five-tournaments', tournamentId)

  // Ten matches
  const playerName = tournaments.flatMap(t => t.players).find(p => p.id === playerId)?.name ?? ''
  if (playerName) {
    const rating = getPlayerRating(playerId, playerName)
    if (rating.matchesPlayed >= 10) awardBadge(playerId, 'ten-matches')
  }

  // Undefeated champion
  const t = tournaments.find(t => t.id === tournamentId)
  if (t) {
    const trophies = loadTrophies()
    const isChamp = trophies.some(tr => tr.playerId === playerId && tr.tournamentId === tournamentId && tr.tier === 'champion')
    if (isChamp) {
      const playerMatches = t.matches.filter(m =>
        m.completed && m.winnerId &&
        (m.player1Id === playerId || m.player2Id === playerId)
      )
      const allWon = playerMatches.every(m => m.winnerId === playerId)
      if (allWon && playerMatches.length > 0) {
        awardBadge(playerId, 'undefeated-champion', tournamentId)
      }
    }
  }

  // Comeback win: won match after losing first set
  if (t) {
    for (const m of t.matches) {
      if (!m.completed || m.winnerId !== playerId) continue
      if ((m.player1Id !== playerId && m.player2Id !== playerId)) continue
      const isP1 = m.player1Id === playerId
      const firstSetWon = isP1 ? m.score1[0] > m.score2[0] : m.score2[0] > m.score1[0]
      if (!firstSetWon && m.winnerId === playerId) {
        awardBadge(playerId, 'comeback-win', tournamentId)
        break
      }
    }
  }

  const after = getPlayerBadges(playerId)
  return after.filter(b => !before.some(bb => bb.id === b.id))
}

// --- Pending Victory (for animation trigger) ---

export interface PendingVictory {
  tier: TrophyTier
  tournamentName: string
  playerId: string
}

export function getPendingVictory(playerId: string): PendingVictory | null {
  const all = bridgeGetPendingVictories()
  return all.find(v => v.playerId === playerId) ?? null
}

export function clearPendingVictory(playerId: string): void {
  const all = bridgeGetPendingVictories()
  const filtered = all.filter(v => v.playerId !== playerId)
  bridgeSetPendingVictories(filtered)
}

function setPendingVictory(trophy: Trophy): void {
  const all = bridgeGetPendingVictories()
  // Don't duplicate
  if (all.some(v => v.playerId === trophy.playerId && v.tournamentName === trophy.tournamentName)) return
  bridgeSetPendingVictories([...all, {
    tier: trophy.tier,
    tournamentName: trophy.tournamentName,
    playerId: trophy.playerId,
  }])
}

export function retroactivelyAwardTrophies(): void {
  const tournaments = load()
  for (const t of tournaments) {
    if (t.status === 'completed') {
      awardTournamentTrophies(t.id, t)
      for (const p of t.players) {
        checkAndAwardBadges(p.id, t.id, t)
      }
    }
  }
}

// --- Dev Tools ---

const TEST_PLAYERS = [
  'Alex Rivera', 'Jordan Chen', 'Sam Patel', 'Taylor Kim',
  'Casey Brooks', 'Morgan Lee', 'Riley Davis', 'Quinn Adams',
]

const TEST_RATINGS: Record<string, number> = {
  'alex rivera': 1650, 'jordan chen': 1580, 'sam patel': 1520, 'taylor kim': 1490,
  'casey brooks': 1440, 'morgan lee': 1400, 'riley davis': 1550, 'quinn adams': 1470,
}

const TEST_AVAILABILITY: AvailabilitySlot[][] = [
  [{ day: 'tuesday', startHour: 18, endHour: 21 }, { day: 'saturday', startHour: 9, endHour: 13 }],
  [{ day: 'monday', startHour: 18, endHour: 21 }, { day: 'wednesday', startHour: 18, endHour: 21 }, { day: 'saturday', startHour: 10, endHour: 14 }],
  [{ day: 'saturday', startHour: 8, endHour: 12 }, { day: 'sunday', startHour: 8, endHour: 12 }],
  [{ day: 'thursday', startHour: 17, endHour: 20 }, { day: 'friday', startHour: 17, endHour: 20 }, { day: 'sunday', startHour: 13, endHour: 17 }],
  [{ day: 'tuesday', startHour: 19, endHour: 21 }, { day: 'thursday', startHour: 19, endHour: 21 }, { day: 'saturday', startHour: 9, endHour: 12 }],
  [{ day: 'wednesday', startHour: 17, endHour: 20 }, { day: 'saturday', startHour: 13, endHour: 17 }, { day: 'sunday', startHour: 9, endHour: 13 }],
  [{ day: 'monday', startHour: 17, endHour: 20 }, { day: 'friday', startHour: 17, endHour: 20 }, { day: 'saturday', startHour: 8, endHour: 11 }],
  [{ day: 'tuesday', startHour: 18, endHour: 21 }, { day: 'sunday', startHour: 10, endHour: 14 }],
]

export async function seedLobby(county: string, count: number = 3): Promise<LobbyEntry[]> {
  const normalizedCounty = county.toLowerCase()
  const lobby = loadLobby()
  const existing = lobby.filter(e => e.county.toLowerCase() === normalizedCounty)
  const existingNames = new Set(existing.map(e => e.playerName.toLowerCase()))

  const available = TEST_PLAYERS.filter(n => !existingNames.has(n.toLowerCase()))
  const toAdd = available.slice(0, count)

  for (const name of toAdd) {
    const id = generateId()
    const playerIdx = TEST_PLAYERS.indexOf(name)
    const entry: LobbyEntry = { playerId: id, playerName: name, county, joinedAt: new Date().toISOString() }
    lobby.push(entry)

    // Set up their rating (keyed by player ID)
    const ratings = loadRatings()
    const normalizedName = name.trim().toLowerCase()
    const rating: PlayerRating = { name, rating: TEST_RATINGS[normalizedName] ?? 1000, matchesPlayed: Math.floor(Math.random() * 20) + 5 }
    if (!ratings[id]) {
      ratings[id] = rating
      await saveRatingsAndSync(ratings, id)
    }

    // Set up their availability
    if (playerIdx >= 0 && TEST_AVAILABILITY[playerIdx]) {
      saveAvailability(id, TEST_AVAILABILITY[playerIdx])
    }

    // Sync to Supabase
    const lobbyResult = await syncLobbyEntry(entry)
    if (!lobbyResult.success) {
      console.warn('[Rally] Failed to sync seeded lobby entry to Supabase', entry)
      bridgeShowError('Could not save — check your connection')
    }
    const ratingResult = await syncRatingsForPlayer(id, rating)
    if (!ratingResult.success) {
      console.warn('[Rally] Failed to sync seeded rating to Supabase', id)
      bridgeShowError('Could not save — check your connection')
    }
  }

  saveLobby(lobby)
  return getLobbyByCounty(normalizedCounty)
}

export function getTestProfiles(county: string): PlayerProfile[] {
  // Look up real IDs from lobby and tournaments so switching profiles works correctly
  const lobby = loadLobby()
  const tournaments = load()
  const allPlayers = new Map<string, string>() // name -> id

  for (const entry of lobby) {
    allPlayers.set(entry.playerName.toLowerCase(), entry.playerId)
  }
  for (const t of tournaments) {
    for (const p of t.players) {
      allPlayers.set(p.name.toLowerCase(), p.id)
    }
  }

  return TEST_PLAYERS.map((name, i) => ({
    id: allPlayers.get(name.toLowerCase()) ?? `test-${i}`,
    name,
    county,
    createdAt: new Date().toISOString(),
  }))
}

export function switchProfile(profile: PlayerProfile): void {
  setItem(PROFILE_KEY, JSON.stringify(profile))
}

// Auto-confirm all pending schedules (dev tool)
export async function autoConfirmAllSchedules(tournamentId: string): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  for (const match of t.matches) {
    if (match.schedule && match.schedule.status !== 'confirmed' && !match.completed) {
      const pending = match.schedule.proposals.filter(p => p.status === 'pending')
      if (pending.length > 0) {
        const best = pending[0]
        for (const p of match.schedule.proposals) {
          p.status = p.id === best.id ? 'accepted' : 'rejected'
        }
        match.schedule.status = 'confirmed'
        match.schedule.schedulingTier = 'auto'
        match.schedule.confirmedSlot = { day: best.day, startHour: best.startHour, endHour: best.endHour }
      }
    }
  }

  await saveAndSync(all, t)
  return t
}

/** Directly complete a match for dev simulation — bypasses RPC and two-phase confirmation */
function devCompleteMatch(
  tournament: Tournament, matchId: string,
  s1: number[], s2: number[], winnerId: string
) {
  const match = tournament.matches.find(m => m.id === matchId)
  if (!match) return
  match.score1 = s1
  match.score2 = s2
  match.winnerId = winnerId
  match.completed = true
  match.scoreReportedBy = winnerId
  match.scoreReportedAt = new Date().toISOString()
  match.scoreConfirmedBy = match.player1Id === winnerId ? match.player2Id! : match.player1Id!
  match.scoreConfirmedAt = new Date().toISOString()

  // Advance winner in single-elimination or knockout phase
  if ((tournament.format === 'single-elimination' || match.phase === 'knockout') && winnerId) {
    const nextRoundMatches = tournament.matches.filter(
      m => m.round === match.round + 1 && (match.phase !== 'knockout' || m.phase === 'knockout')
    )
    const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
    if (nextMatch) {
      if (match.position % 2 === 0) {
        nextMatch.player1Id = winnerId
      } else {
        nextMatch.player2Id = winnerId
      }
      if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
        nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
      }
    }
  }

  // Group phase completion check
  if ((tournament.format === 'group-knockout' || tournament.format === 'round-robin') && match.phase === 'group') {
    const groupMatches = tournament.matches.filter(m => m.phase === 'group')
    if (groupMatches.every(m => m.completed) && !tournament.groupPhaseComplete) {
      generateKnockoutPhase(tournament)
    }
  }
}

// Simulate random scores for the current round of a tournament
export async function simulateRoundScores(tournamentId: string): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.status !== 'in-progress') return undefined

  // Find the earliest incomplete round with scoreable matches
  const incompleteMatches = t.matches.filter(
    m => !m.completed && m.player1Id && m.player2Id
  )
  if (incompleteMatches.length === 0) return t

  const minRound = Math.min(...incompleteMatches.map(m => m.round))
  const roundMatches = incompleteMatches.filter(m => m.round === minRound)

  const SCORES = [
    { s1: [6, 6], s2: [3, 4], w: 1 },
    { s1: [6, 6], s2: [2, 1], w: 1 },
    { s1: [6, 6], s2: [4, 3], w: 1 },
    { s1: [7, 6], s2: [5, 4], w: 1 },
    { s1: [3, 4], s2: [6, 6], w: 2 },
    { s1: [2, 6, 4], s2: [6, 3, 6], w: 2 },
    { s1: [6, 4, 6], s2: [3, 6, 2], w: 1 },
    { s1: [4, 2], s2: [6, 6], w: 2 },
  ]

  for (const match of roundMatches) {
    const pick = SCORES[Math.floor(Math.random() * SCORES.length)]
    const winnerId = pick.w === 1 ? match.player1Id! : match.player2Id!
    devCompleteMatch(t, match.id, pick.s1, pick.s2, winnerId)
  }

  // Check if tournament is done
  if (t.matches.every(m => m.completed)) {
    t.status = 'completed'
  }

  await saveAndSync(all, t)
  return t
}

// Simulate a tournament all the way to the final, with the given player as a finalist
export async function simulateToFinal(playerId: string, county: string): Promise<{ tournamentId: string } | null> {
  const profile = getProfile()
  if (!profile) return null

  // Step 1: Ensure player is in lobby, seed to 6+, and create tournament
  if (!isInLobby(playerId)) {
    await joinLobby(profile)
  }
  await seedLobby(county, 5)
  const lobby = getLobbyByCounty(county)
  if (lobby.length < 6) return null

  // Create tournament from lobby if one doesn't exist yet
  await startTournamentFromLobby(county)
  const setupT = getSetupTournamentForCounty(county)
  if (!setupT) {
    // Need to create tournament via lobby - join lobby first if not in it
    const inLobby = lobby.find(e => e.playerId === playerId)
    if (!inLobby) {
      await joinLobby(profile)
    }
    // Still need 6 in lobby for tournament creation
    const updatedLobby = getLobbyByCounty(county)
    if (updatedLobby.length < 6) {
      await seedLobby(county, 6 - updatedLobby.length)
    }
    // Create the tournament from lobby entries
    await startTournamentFromLobby(county)
    const st = getSetupTournamentForCounty(county)
    if (!st) return null
    const started = await forceStartTournament(st.id)
    if (!started) return null
    return await simulateToFinalInner(started.id, playerId)
  }

  const started = await forceStartTournament(setupT.id)
  if (!started) return null
  return await simulateToFinalInner(started.id, playerId)
}

async function simulateToFinalInner(tournamentId: string, playerId: string): Promise<{ tournamentId: string } | null> {
  const all = load()
  const tournament = all.find(x => x.id === tournamentId)
  if (!tournament) return null
  const t = tournament // const binding for closure narrowing

  /** Score a match: player always wins their matches, player1 wins others */
  function simScore(match: Match) {
    if (match.completed || !match.player1Id || !match.player2Id) return
    const isMyMatch = match.player1Id === playerId || match.player2Id === playerId
    const winnerId = isMyMatch ? playerId : match.player1Id!
    const s1 = winnerId === match.player1Id ? [6, 6] : [3, 4]
    const s2 = winnerId === match.player1Id ? [3, 4] : [6, 6]
    devCompleteMatch(t, match.id, s1, s2, winnerId)
  }

  // For group-knockout: score all group matches, ensuring player wins enough
  if (t.format === 'group-knockout') {
    for (const match of t.matches.filter(m => m.phase === 'group')) {
      simScore(match)
    }
    // Score semifinals, ensuring our player wins
    for (const semi of t.matches.filter(m => m.phase === 'knockout' && m.round === 2)) {
      simScore(semi)
    }
    await saveAndSync(all, t)
    return { tournamentId }
  }

  // For single-elimination: score all rounds except the last
  if (t.format === 'single-elimination') {
    const maxRound = Math.max(...t.matches.map(m => m.round))
    for (let round = 1; round < maxRound; round++) {
      const roundMatches = t.matches.filter(m => m.round === round && !m.completed && m.player1Id && m.player2Id)
      for (const match of roundMatches) {
        simScore(match)
      }
    }
    await saveAndSync(all, t)
    return { tournamentId }
  }

  // Round-robin with playoffs: score all group matches, then semis, leave final
  for (const match of t.matches.filter(m => m.phase === 'group')) {
    simScore(match)
  }
  // Score semifinals, ensuring our player wins
  const semis = t.matches.filter(m => m.phase === 'knockout' && m.round === 2)
  for (const semi of semis) {
    simScore(semi)
  }
  await saveAndSync(all, t)
  return { tournamentId }
}

// --- Match Broadcasts ---

function loadBroadcasts(): MatchBroadcast[] {
  return bridgeGetBroadcasts()
}

function saveBroadcasts(broadcasts: MatchBroadcast[]): void {
  bridgeSetBroadcasts(broadcasts)
}

function cleanExpiredBroadcasts(): void {
  const broadcasts = loadBroadcasts()
  const now = Date.now()
  let changed = false
  for (const b of broadcasts) {
    if (b.status === 'active' && new Date(b.expiresAt).getTime() <= now) {
      b.status = 'expired'
      changed = true
    }
  }
  if (changed) saveBroadcasts(broadcasts)
}

export function createBroadcast(
  playerId: string,
  playerName: string,
  tournamentId: string,
  date: string,
  startTime: string,
  endTime: string,
  location: string,
  message?: string
): MatchBroadcast | null {
  cleanExpiredBroadcasts()
  const broadcasts = loadBroadcasts()

  // One active broadcast per player
  const existing = broadcasts.find(b => b.playerId === playerId && b.status === 'active')
  if (existing) return null

  const now = new Date()
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString()

  const broadcast: MatchBroadcast = {
    id: generateId(),
    playerId,
    playerName,
    tournamentId,
    date,
    startTime,
    endTime,
    location,
    message,
    status: 'active',
    createdAt: now.toISOString(),
    expiresAt,
  }

  broadcasts.push(broadcast)
  saveBroadcasts(broadcasts)
  return broadcast
}

export function getActiveBroadcasts(tournamentId: string, forPlayerId?: string): MatchBroadcast[] {
  cleanExpiredBroadcasts()
  const broadcasts = loadBroadcasts()
  const tournament = getTournament(tournamentId)
  if (!tournament) return []

  return broadcasts.filter(b => {
    if (b.tournamentId !== tournamentId || b.status !== 'active') return false
    if (!forPlayerId) return true
    // Don't show own broadcasts
    if (b.playerId === forPlayerId) return false
    // Only show if the viewer hasn't already played/scheduled with the broadcaster
    const hasPlayed = tournament.matches.some(
      m => m.completed &&
        ((m.player1Id === b.playerId && m.player2Id === forPlayerId) ||
         (m.player2Id === b.playerId && m.player1Id === forPlayerId))
    )
    if (hasPlayed) return false
    const hasScheduled = tournament.matches.some(
      m => !m.completed && m.schedule?.status === 'confirmed' &&
        ((m.player1Id === b.playerId && m.player2Id === forPlayerId) ||
         (m.player2Id === b.playerId && m.player1Id === forPlayerId))
    )
    return !hasScheduled
  })
}

export function getPlayerActiveBroadcast(playerId: string): MatchBroadcast | undefined {
  cleanExpiredBroadcasts()
  return loadBroadcasts().find(b => b.playerId === playerId && b.status === 'active')
}

export async function claimBroadcast(
  broadcastId: string,
  claimingPlayerId: string
): Promise<{ broadcast: MatchBroadcast; tournament: Tournament } | null> {
  cleanExpiredBroadcasts()
  const broadcasts = loadBroadcasts()
  const broadcast = broadcasts.find(b => b.id === broadcastId)
  if (!broadcast || broadcast.status !== 'active') return null

  const tournament = getTournament(broadcast.tournamentId)
  if (!tournament) return null

  // Find unplayed match between these two players
  const match = tournament.matches.find(
    m => !m.completed &&
      ((m.player1Id === broadcast.playerId && m.player2Id === claimingPlayerId) ||
       (m.player2Id === broadcast.playerId && m.player1Id === claimingPlayerId))
  )

  if (!match) return null

  // Prevent same-day conflicts before claiming
  const broadcastDay = (['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const)[
    new Date(broadcast.date + 'T' + broadcast.startTime).getDay()
  ]
  if (hasConfirmedMatchOnDay(tournament, broadcast.playerId, broadcastDay, match.id)) return null
  if (hasConfirmedMatchOnDay(tournament, claimingPlayerId, broadcastDay, match.id)) return null

  // Claim the broadcast
  broadcast.status = 'claimed'
  broadcast.claimedBy = claimingPlayerId
  broadcast.matchId = match.id
  saveBroadcasts(broadcasts)

  // Confirm the match schedule
  const all = load()
  const t = all.find(x => x.id === broadcast.tournamentId)
  if (!t) return null

  const m = t.matches.find(x => x.id === match.id)
  if (m) {
    // Parse the broadcast date/time into a day of week and hour
    const broadcastDate = new Date(broadcast.date + 'T' + broadcast.startTime)
    const days: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const day = days[broadcastDate.getDay()]
    const hour = broadcastDate.getHours()

    if (!m.schedule) {
      m.schedule = {
        status: 'confirmed',
        proposals: [],
        confirmedSlot: { day, startHour: hour, endHour: hour + 1 },
        createdAt: new Date().toISOString(),
        escalationDay: 0,
        lastEscalation: new Date().toISOString(),
      }
    } else {
      m.schedule.status = 'confirmed'
      m.schedule.confirmedSlot = { day, startHour: hour, endHour: hour + 1 }
    }
    await saveAndSync(all, t)
  }

  return { broadcast, tournament: t }
}

export function cancelBroadcast(broadcastId: string, playerId: string): boolean {
  const broadcasts = loadBroadcasts()
  const broadcast = broadcasts.find(b => b.id === broadcastId && b.playerId === playerId)
  if (!broadcast || broadcast.status !== 'active') return false
  broadcast.status = 'expired'
  saveBroadcasts(broadcasts)
  return true
}

// =====================================================================
// Match Offer System
// =====================================================================

function loadOffers(): MatchOffer[] {
  return bridgeGetMatchOffers()
}

function saveOffers(offers: MatchOffer[]): void {
  bridgeSetMatchOffers(offers)
}

function loadNotifications(): RallyNotification[] {
  return bridgeGetNotifications()
}

function saveNotifications(notifications: RallyNotification[]): void {
  bridgeSetNotifications(notifications)
}

function addNotification(notif: Omit<RallyNotification, 'id' | 'createdAt' | 'read'>): RallyNotification {
  const notifications = loadNotifications()
  const entry: RallyNotification = {
    ...notif,
    id: generateId(),
    createdAt: new Date().toISOString(),
    read: false,
  }
  notifications.unshift(entry)
  // Keep last 50 notifications
  if (notifications.length > 50) notifications.length = 50
  saveNotifications(notifications)
  return entry
}

/** Clean expired offers and update their status */
export function cleanExpiredOffers(): void {
  const offers = loadOffers()
  const now = Date.now()
  let changed = false
  for (const offer of offers) {
    if (offer.status === 'proposed' && new Date(offer.expiresAt).getTime() <= now) {
      offer.status = 'expired'
      changed = true
      addNotification({
        type: 'offer_expired',
        recipientId: offer.senderId,
        message: 'Match offer expired',
        detail: `${offer.proposedTime} offer to ${offer.recipientName}`,
        relatedOfferId: offer.offerId,
      })
    }
  }
  if (changed) saveOffers(offers)
}

/** Create a match offer */
export function createMatchOffer(
  sender: { id: string; name: string },
  recipient: { id: string; name: string },
  tournamentId: string,
  proposedDate: string,
  proposedTime: string,
  proposedDay: string,
  proposedStartHour: number,
  proposedEndHour: number,
): MatchOffer | { error: string } {
  cleanExpiredOffers()
  const offers = loadOffers()

  // Check: 1 active offer per opponent
  const existingToRecipient = offers.find(
    o => o.senderId === sender.id && o.recipientId === recipient.id && o.status === 'proposed'
  )
  if (existingToRecipient) {
    return { error: 'You already have a pending offer to this player.' }
  }

  // Check: max 5 outgoing active offers
  const activeOutgoing = offers.filter(o => o.senderId === sender.id && o.status === 'proposed')
  if (activeOutgoing.length >= 5) {
    return { error: 'You have too many active match offers. Wait for responses or cancel one.' }
  }

  const now = new Date()
  const offer: MatchOffer = {
    offerId: generateId(),
    senderId: sender.id,
    senderName: sender.name,
    recipientId: recipient.id,
    recipientName: recipient.name,
    tournamentId,
    proposedDate,
    proposedTime,
    proposedDay,
    proposedStartHour,
    proposedEndHour,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'proposed',
  }

  offers.push(offer)
  saveOffers(offers)

  // Notify recipient
  addNotification({
    type: 'match_offer',
    recipientId: recipient.id,
    senderId: sender.id,
    senderName: sender.name,
    message: `${sender.name} proposed a match`,
    detail: `${proposedTime} on ${proposedDate}`,
    relatedOfferId: offer.offerId,
  })

  return offer
}

/** Get active incoming offers for a player */
export function getIncomingOffers(playerId: string): MatchOffer[] {
  cleanExpiredOffers()
  return loadOffers().filter(
    o => o.recipientId === playerId && o.status === 'proposed'
  )
}

/** Get active outgoing offers for a player */
export function getOutgoingOffers(playerId: string): MatchOffer[] {
  cleanExpiredOffers()
  return loadOffers().filter(
    o => o.senderId === playerId && o.status === 'proposed'
  )
}

/** Accept a match offer */
export async function acceptMatchOffer(offerId: string, acceptorId: string): Promise<{ offer: MatchOffer; matchConfirmed: boolean } | { error: string }> {
  cleanExpiredOffers()
  const offers = loadOffers()
  const offer = offers.find(o => o.offerId === offerId)

  if (!offer) return { error: 'Offer not found.' }
  if (offer.recipientId !== acceptorId) return { error: 'Not your offer to accept.' }
  if (offer.status !== 'proposed') return { error: `Offer is already ${offer.status}.` }

  offer.status = 'accepted'

  // Find the match between these two players and confirm the schedule
  const all = load()
  const tournament = all.find(t => t.id === offer.tournamentId)
  let matchConfirmed = false

  if (tournament) {
    const match = tournament.matches.find(m =>
      !m.completed &&
      ((m.player1Id === offer.senderId && m.player2Id === offer.recipientId) ||
       (m.player1Id === offer.recipientId && m.player2Id === offer.senderId))
    )
    if (match) {
      offer.matchId = match.id
      if (!match.schedule) {
        match.schedule = {
          status: 'confirmed',
          proposals: [],
          confirmedSlot: {
            day: offer.proposedDay as DayOfWeek,
            startHour: offer.proposedStartHour,
            endHour: offer.proposedEndHour,
          },
          escalationDay: 0,
          participationScores: {},
          createdAt: new Date().toISOString(),
          lastEscalation: new Date().toISOString(),
        }
      } else {
        match.schedule.status = 'confirmed'
        match.schedule.confirmedSlot = {
          day: offer.proposedDay as DayOfWeek,
          startHour: offer.proposedStartHour,
          endHour: offer.proposedEndHour,
        }
      }
      matchConfirmed = true
      await saveAndSync(all, tournament!)
    }
  }

  // Close conflicting offers for the same time slot
  for (const other of offers) {
    if (other.offerId === offerId) continue
    if (other.status !== 'proposed') continue
    if (
      (other.senderId === offer.senderId || other.senderId === offer.recipientId ||
       other.recipientId === offer.senderId || other.recipientId === offer.recipientId) &&
      other.proposedDate === offer.proposedDate &&
      other.proposedStartHour === offer.proposedStartHour
    ) {
      other.status = 'expired'
      addNotification({
        type: 'offer_expired',
        recipientId: other.senderId,
        message: 'This time is no longer available',
        detail: `${other.proposedTime} — ${other.recipientName} is now booked`,
        relatedOfferId: other.offerId,
      })
    }
  }

  saveOffers(offers)

  // Notify sender
  addNotification({
    type: 'offer_accepted',
    recipientId: offer.senderId,
    senderId: offer.recipientId,
    senderName: offer.recipientName,
    message: `${offer.recipientName} accepted your match`,
    detail: `${offer.proposedTime} on ${offer.proposedDate}`,
    relatedOfferId: offer.offerId,
  })

  // Notify acceptor too
  addNotification({
    type: 'offer_accepted',
    recipientId: offer.recipientId,
    senderId: offer.senderId,
    senderName: offer.senderName,
    message: 'Match confirmed',
    detail: `${offer.proposedTime} vs ${offer.senderName}`,
    relatedOfferId: offer.offerId,
  })

  return { offer, matchConfirmed }
}

/** Decline a match offer */
export function declineMatchOffer(offerId: string, declinerId: string): MatchOffer | { error: string } {
  const offers = loadOffers()
  const offer = offers.find(o => o.offerId === offerId)

  if (!offer) return { error: 'Offer not found.' }
  if (offer.recipientId !== declinerId) return { error: 'Not your offer to decline.' }
  if (offer.status !== 'proposed') return { error: `Offer is already ${offer.status}.` }

  offer.status = 'declined'
  saveOffers(offers)

  // Notify sender
  addNotification({
    type: 'offer_declined',
    recipientId: offer.senderId,
    senderId: offer.recipientId,
    senderName: offer.recipientName,
    message: `${offer.recipientName} declined your match`,
    detail: `${offer.proposedTime} on ${offer.proposedDate}`,
    relatedOfferId: offer.offerId,
  })

  return offer
}

/** Cancel an outgoing offer */
export function cancelMatchOffer(offerId: string, senderId: string): boolean {
  const offers = loadOffers()
  const offer = offers.find(o => o.offerId === offerId && o.senderId === senderId)
  if (!offer || offer.status !== 'proposed') return false
  offer.status = 'expired'
  saveOffers(offers)
  return true
}

/** Get notifications for a player */
export function getNotifications(playerId: string): RallyNotification[] {
  return loadNotifications().filter(n => n.recipientId === playerId)
}

/** Get unread notification count */
export function getUnreadNotificationCount(playerId: string): number {
  return loadNotifications().filter(n => n.recipientId === playerId && !n.read).length
}

/** Mark notifications as read */
export function markNotificationsRead(playerId: string): void {
  const notifications = loadNotifications()
  let changed = false
  for (const n of notifications) {
    if (n.recipientId === playerId && !n.read) {
      n.read = true
      changed = true
    }
  }
  if (changed) saveNotifications(notifications)
}

/** Get an offer by ID */
export function getMatchOffer(offerId: string): MatchOffer | null {
  return loadOffers().find(o => o.offerId === offerId) ?? null
}

// --- Direct Messages ---

function loadMessages(): DirectMessage[] {
  return bridgeGetMessages()
}

function saveMessages(msgs: DirectMessage[]): void {
  bridgeSetMessages(msgs)
}

export function sendMessage(senderId: string, senderName: string, recipientId: string, recipientName: string, text: string): DirectMessage {
  const msgs = loadMessages()
  const msg: DirectMessage = {
    id: generateId(),
    senderId,
    senderName,
    recipientId,
    recipientName,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    read: false,
  }
  msgs.push(msg)
  saveMessages(msgs)
  return msg
}

export function getConversation(playerId: string, otherPlayerId: string): DirectMessage[] {
  return loadMessages().filter(m =>
    (m.senderId === playerId && m.recipientId === otherPlayerId) ||
    (m.senderId === otherPlayerId && m.recipientId === playerId)
  ).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getConversationList(playerId: string): { otherPlayerId: string; otherPlayerName: string; lastMessage: DirectMessage; unreadCount: number }[] {
  const msgs = loadMessages().filter(m => m.senderId === playerId || m.recipientId === playerId)
  const byPeer: Record<string, DirectMessage[]> = {}
  for (const m of msgs) {
    const peerId = m.senderId === playerId ? m.recipientId : m.senderId
    if (!byPeer[peerId]) byPeer[peerId] = []
    byPeer[peerId].push(m)
  }
  return Object.entries(byPeer).map(([peerId, peerMsgs]) => {
    peerMsgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const last = peerMsgs[peerMsgs.length - 1]
    const unread = peerMsgs.filter(m => m.recipientId === playerId && !m.read).length
    return {
      otherPlayerId: peerId,
      otherPlayerName: last.senderId === peerId ? last.senderName : last.recipientName,
      lastMessage: last,
      unreadCount: unread,
    }
  }).sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt))
}

export function getUnreadMessageCount(playerId: string): number {
  return loadMessages().filter(m => m.recipientId === playerId && !m.read).length
}

export function markConversationRead(playerId: string, otherPlayerId: string): void {
  const msgs = loadMessages()
  let changed = false
  for (const m of msgs) {
    if (m.recipientId === playerId && m.senderId === otherPlayerId && !m.read) {
      m.read = true
      changed = true
    }
  }
  if (changed) saveMessages(msgs)
}

export function hasUnreadFrom(playerId: string, otherPlayerId: string): boolean {
  return loadMessages().some(m => m.recipientId === playerId && m.senderId === otherPlayerId && !m.read)
}

// --- Welcome Message ---

export const RALLY_SYSTEM_ID = 'rally-system'
const RALLY_SYSTEM_NAME = 'Rally'

const WELCOME_MESSAGE_TEXT = `Welcome to Rally! Tap to learn how tournaments, scheduling, and scoring work — plus how to create a free tournament.`

export function sendWelcomeMessage(playerId: string): void {
  const msgs = loadMessages()
  // Don't send if already exists
  if (msgs.some(m => m.senderId === RALLY_SYSTEM_ID && m.recipientId === playerId)) return
  const msg: DirectMessage = {
    id: generateId(),
    senderId: RALLY_SYSTEM_ID,
    senderName: RALLY_SYSTEM_NAME,
    recipientId: playerId,
    recipientName: '',
    text: WELCOME_MESSAGE_TEXT,
    createdAt: new Date().toISOString(),
    read: false,
  }
  msgs.push(msg)
  saveMessages(msgs)
}

// --- Score Disputes ---

export async function proposeScoreCorrection(
  tournamentId: string,
  matchId: string,
  currentPlayerId: string,
  proposedScore1: number[],
  proposedScore2: number[],
  proposedWinnerId: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match || !match.scoreReportedBy || match.completed) return undefined

  // Only the non-reporter can propose a correction
  if (match.scoreReportedBy === currentPlayerId) return undefined

  match.scoreDispute = {
    id: generateId(),
    type: 'correction',
    proposedScore1,
    proposedScore2,
    proposedWinnerId,
    disputedBy: currentPlayerId,
    disputedAt: new Date().toISOString(),
    status: 'pending',
  }

  const disputerName = t.players.find(p => p.id === currentPlayerId)?.name ?? 'Your opponent'
  const scoreStr = proposedScore1.map((s, i) => `${s}-${proposedScore2[i]}`).join(', ')
  addNotification({
    type: 'score_correction_proposed',
    recipientId: match.scoreReportedBy,
    senderId: currentPlayerId,
    senderName: disputerName,
    message: `${disputerName} suggests the score was ${scoreStr}.`,
    detail: scoreStr,
    relatedMatchId: matchId,
    relatedTournamentId: tournamentId,
  })

  await saveAndSync(all, t)
  return t
}

export async function resolveScoreDispute(
  tournamentId: string,
  matchId: string,
  currentPlayerId: string,
  action: 'accept' | 'reject'
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match || !match.scoreDispute || match.scoreDispute.status !== 'pending') return undefined

  // Only the original reporter can resolve
  if (match.scoreReportedBy !== currentPlayerId) return undefined

  const dispute = match.scoreDispute

  if (action === 'accept') {
    // Apply the proposed score
    if (dispute.proposedScore1) match.score1 = dispute.proposedScore1
    if (dispute.proposedScore2) match.score2 = dispute.proposedScore2
    if (dispute.proposedWinnerId) match.winnerId = dispute.proposedWinnerId
    dispute.status = 'accepted'
    dispute.resolvedAt = new Date().toISOString()
    dispute.resolvedBy = currentPlayerId

    // Now complete the match (same logic as confirmMatchScore)
    match.completed = true
    match.scoreConfirmedBy = dispute.disputedBy
    match.scoreConfirmedAt = new Date().toISOString()

    const winnerId = match.winnerId
    const p1 = t.players.find(p => p.id === match.player1Id)
    const p2 = t.players.find(p => p.id === match.player2Id)
    if (p1 && p2 && winnerId) {
      await updateRatings(p1, p2, winnerId)
    }

    // Bracket advancement
    if (match.winnerId) advanceWinner(t, match, match.winnerId)

    const resolverName = t.players.find(p => p.id === currentPlayerId)?.name ?? 'Your opponent'
    addNotification({
      type: 'score_correction_resolved',
      recipientId: dispute.disputedBy,
      senderId: currentPlayerId,
      senderName: resolverName,
      message: `${resolverName} accepted your score correction.`,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  } else {
    // Reject → split decision
    dispute.status = 'rejected'
    dispute.resolvedAt = new Date().toISOString()
    dispute.resolvedBy = currentPlayerId
    match.completed = true
    match.splitDecision = true
    // No ELO update, no bracket advancement for split decisions

    const resolverName = t.players.find(p => p.id === currentPlayerId)?.name ?? 'Your opponent'
    addNotification({
      type: 'score_correction_resolved',
      recipientId: dispute.disputedBy,
      senderId: currentPlayerId,
      senderName: resolverName,
      message: `Score dispute resulted in a split decision. The match won't count toward standings.`,
      relatedMatchId: matchId,
      relatedTournamentId: tournamentId,
    })
  }

  // Persist pending feedback so the form survives sync-driven re-renders
  const opponentId = match.player1Id === currentPlayerId ? match.player2Id! : match.player1Id!
  const opponentName = t.players.find(p => p.id === opponentId)?.name ?? 'Opponent'
  setPendingFeedback({ matchId, tournamentId, opponentId, opponentName })

  // Check tournament completion
  const allDone = t.matches.every(m => m.completed)
  if (allDone) {
    t.status = 'completed'
    awardTournamentTrophies(t.id, t)
    for (const p of t.players) {
      checkAndAwardBadges(p.id, t.id, t)
    }
  }

  await saveAndSync(all, t)
  return t
}

export async function reportMatchIssue(
  tournamentId: string,
  matchId: string,
  currentPlayerId: string,
  issueText: string
): Promise<Tournament | undefined> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  const match = t.matches.find(m => m.id === matchId)
  if (!match || !match.scoreReportedBy || match.completed) return undefined

  match.scoreDispute = {
    id: generateId(),
    type: 'issue',
    issueText,
    disputedBy: currentPlayerId,
    disputedAt: new Date().toISOString(),
    status: 'admin-review',
  }

  await saveAndSync(all, t)
  return t
}

// --- Match Feedback (Reliability Rating) ---

function loadFeedback(): MatchFeedback[] {
  return bridgeGetFeedback()
}

function saveFeedbackToStorage(feedback: MatchFeedback[]): void {
  bridgeSetFeedback(feedback)
}

export async function saveMatchFeedback(
  feedback: Omit<MatchFeedback, 'id' | 'createdAt'>
): Promise<void> {
  const all = loadFeedback()
  const existing = all.findIndex(f => f.matchId === feedback.matchId && f.fromPlayerId === feedback.fromPlayerId)

  const entry: MatchFeedback = {
    ...feedback,
    id: generateId(),
    createdAt: new Date().toISOString(),
  }

  if (existing >= 0) {
    all[existing] = entry
  } else {
    all.push(entry)
  }

  saveFeedbackToStorage(all)

  // Sync to Supabase
  const client = getClient()
  if (client) {
    try {
      await client.from('match_feedback').upsert({
        id: entry.id,
        match_id: entry.matchId,
        tournament_id: entry.tournamentId,
        from_player_id: entry.fromPlayerId,
        to_player_id: entry.toPlayerId,
        sentiment: entry.sentiment,
        issue_categories: entry.issueCategories ?? [],
        issue_text: entry.issueText ?? null,
        created_at: entry.createdAt,
      })
    } catch {
      console.warn('[Rally] Failed to sync feedback to Supabase', entry.id)
      bridgeShowError('Could not save your feedback — please try again')
    }
  }

  // Recalculate reliability for the rated player
  recalculateReliability(feedback.toPlayerId)

  // Recalculate etiquette score for the rated player
  await recalculateEtiquetteScore(feedback.toPlayerId)
}

export function getPlayerFeedbackForMatch(matchId: string, playerId: string): MatchFeedback | null {
  return loadFeedback().find(f => f.matchId === matchId && f.fromPlayerId === playerId) ?? null
}

// --- Reliability Score ---

function loadReliability(): Record<string, ReliabilityScore> {
  return bridgeGetReliabilityScores()
}

function saveReliabilityToStorage(scores: Record<string, ReliabilityScore>): void {
  bridgeSetReliabilityScores(scores)
}

export function recalculateReliability(playerId: string): ReliabilityScore {
  const tournaments = load()
  const feedback = loadFeedback()
  const now = Date.now()

  // Gather last 20 completed matches for this player
  const playerMatches: { match: Match; tournament: Tournament }[] = []
  for (const t of tournaments) {
    for (const m of t.matches) {
      if (!m.completed) continue
      if (m.player1Id !== playerId && m.player2Id !== playerId) continue
      playerMatches.push({ match: m, tournament: t })
    }
  }

  // Sort by completion time (most recent first), take last 20
  playerMatches.sort((a, b) => {
    const aTime = a.match.scoreConfirmedAt ?? a.match.scoreReportedAt ?? ''
    const bTime = b.match.scoreConfirmedAt ?? b.match.scoreReportedAt ?? ''
    return bTime.localeCompare(aTime)
  })
  const recent = playerMatches.slice(0, 20)

  if (recent.length === 0) {
    const score: ReliabilityScore = {
      playerId,
      overallScore: 100,
      showUpRate: 1,
      fairnessRating: 1,
      noDisputesAgainst: 1,
      confirmationSpeed: 1,
      matchesConsidered: 0,
      lastUpdated: new Date().toISOString(),
    }
    const scores = loadReliability()
    scores[playerId] = score
    saveReliabilityToStorage(scores)
    return score
  }

  // Phase 2: Apply decay (6-month half-life)
  function decayWeight(matchTimeStr: string | undefined): number {
    if (!matchTimeStr) return 1
    const ageMs = now - new Date(matchTimeStr).getTime()
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000)
    return Math.pow(0.5, ageMonths / 6)
  }

  // 1. Show-up rate (40%) — fraction of matches that weren't walkovers against this player
  let showUpWeightedSum = 0
  let showUpWeightTotal = 0
  for (const { match } of recent) {
    const weight = decayWeight(match.scoreConfirmedAt ?? match.scoreReportedAt ?? undefined)
    const isWalkoverAgainst = match.resolution?.type === 'walkover' && match.resolution.winnerId !== playerId
    showUpWeightedSum += weight * (isWalkoverAgainst ? 0 : 1)
    showUpWeightTotal += weight
  }
  const showUpRate = showUpWeightTotal > 0 ? showUpWeightedSum / showUpWeightTotal : 1

  // 2. Fairness rating (25%) — weighted average of opponent feedback sentiment
  const feedbackReceived = feedback.filter(f => f.toPlayerId === playerId)
  let fairnessWeightedSum = 0
  let fairnessWeightTotal = 0
  for (const f of feedbackReceived) {
    const weight = decayWeight(f.createdAt)
    const sentimentScore = f.sentiment === 'positive' ? 1 : f.sentiment === 'neutral' ? 0.5 : 0
    fairnessWeightedSum += weight * sentimentScore
    fairnessWeightTotal += weight
  }
  const fairnessRating = fairnessWeightTotal > 0 ? fairnessWeightedSum / fairnessWeightTotal : 1

  // 3. No disputes against (20%) — fraction of matches with no dispute filed against this player
  let disputeWeightedSum = 0
  let disputeWeightTotal = 0
  for (const { match } of recent) {
    const weight = decayWeight(match.scoreConfirmedAt ?? match.scoreReportedAt ?? undefined)
    const hasDisputeAgainst = match.scoreDispute && match.scoreReportedBy === playerId && match.scoreDispute.type === 'correction'
    disputeWeightedSum += weight * (hasDisputeAgainst ? 0 : 1)
    disputeWeightTotal += weight
  }
  const noDisputesAgainst = disputeWeightTotal > 0 ? disputeWeightedSum / disputeWeightTotal : 1

  // 4. Confirmation speed (15%) — normalized average time to confirm (faster = higher)
  let speedWeightedSum = 0
  let speedWeightTotal = 0
  for (const { match } of recent) {
    if (match.scoreReportedBy === playerId) continue // only count when this player was the confirmer
    if (!match.scoreReportedAt || !match.scoreConfirmedAt) continue
    const weight = decayWeight(match.scoreConfirmedAt)
    const hoursToConfirm = (new Date(match.scoreConfirmedAt).getTime() - new Date(match.scoreReportedAt).getTime()) / (1000 * 60 * 60)
    // Normalize: 0-1h = 1.0, 48h+ = 0.0, linear between
    const speedScore = Math.max(0, Math.min(1, 1 - hoursToConfirm / 48))
    speedWeightedSum += weight * speedScore
    speedWeightTotal += weight
  }
  const confirmationSpeed = speedWeightTotal > 0 ? speedWeightedSum / speedWeightTotal : 1

  // Weighted composite
  const overallScore = Math.round(
    (0.40 * showUpRate + 0.25 * fairnessRating + 0.20 * noDisputesAgainst + 0.15 * confirmationSpeed) * 100
  )

  const score: ReliabilityScore = {
    playerId,
    overallScore,
    showUpRate,
    fairnessRating,
    noDisputesAgainst,
    confirmationSpeed,
    matchesConsidered: recent.length,
    lastUpdated: new Date().toISOString(),
  }

  const scores = loadReliability()
  scores[playerId] = score
  saveReliabilityToStorage(scores)

  // Phase 2: Nudge notifications
  checkReliabilityNudge(playerId, score)

  // Phase 2: Award reliability badges
  checkReliabilityBadges(playerId, score, feedbackReceived.length, recent.length, tournaments)

  return score
}

export function getReliabilityScore(playerId: string): ReliabilityScore | null {
  const scores = loadReliability()
  return scores[playerId] ?? null
}

export type ReliabilityLevel = 'green' | 'yellow' | 'red' | null

export function getReliabilityLevel(playerId: string): ReliabilityLevel {
  const score = getReliabilityScore(playerId)
  if (!score || score.matchesConsidered < 5) return null // not enough data
  if (score.overallScore >= 75) return 'green'
  if (score.overallScore >= 50) return 'yellow'
  return 'red'
}

// Phase 2: Nudge notifications for declining reliability
const NUDGE_COOLDOWN_KEY = 'play-tennis-reliability-nudge'

function checkReliabilityNudge(playerId: string, score: ReliabilityScore): void {
  if (score.matchesConsidered < 5) return

  // Check cooldown (max once per week)
  try {
    const data = getItem(NUDGE_COOLDOWN_KEY)
    const nudges: Record<string, string> = data ? JSON.parse(data) : {}
    const lastNudge = nudges[playerId]
    if (lastNudge) {
      const weekMs = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - new Date(lastNudge).getTime() < weekMs) return
    }

    let message = ''
    if (score.overallScore < 30) {
      message = 'Your reliability is critically low. Organizers may deprioritize your match scheduling.'
    } else if (score.overallScore < 50) {
      message = 'Some of your recent opponents flagged issues. Showing up on time and confirming scores promptly helps everyone have a better experience.'
    } else {
      return // no nudge needed
    }

    addNotification({
      type: 'reliability_nudge',
      recipientId: playerId,
      message,
    })

    nudges[playerId] = new Date().toISOString()
    setItem(NUDGE_COOLDOWN_KEY, JSON.stringify(nudges))
  } catch {
    // ignore storage errors
  }
}

// Phase 2: Check and award reliability-based badges
function checkReliabilityBadges(
  playerId: string,
  score: ReliabilityScore,
  feedbackCount: number,
  matchCount: number,
  tournaments: Tournament[]
): void {
  // Reliable Player: overallScore >= 85 and 10+ matches considered
  if (score.overallScore >= 85 && score.matchesConsidered >= 10) {
    awardBadge(playerId, 'reliable-player')
  }

  // Good Sport: fairnessRating >= 0.9 and 10+ feedback records
  if (score.fairnessRating >= 0.9 && feedbackCount >= 10) {
    awardBadge(playerId, 'good-sport')
  }

  // Community Regular: 15+ matches across 3+ tournaments
  if (matchCount >= 15) {
    const tournamentsPlayed = new Set<string>()
    for (const t of tournaments) {
      for (const m of t.matches) {
        if (m.completed && (m.player1Id === playerId || m.player2Id === playerId)) {
          tournamentsPlayed.add(t.id)
        }
      }
    }
    if (tournamentsPlayed.size >= 3) {
      awardBadge(playerId, 'community-regular')
    }
  }
}

// --- Etiquette Score ---

function loadEtiquetteScores(): Record<string, EtiquetteScore> {
  return bridgeGetEtiquetteScores()
}

function saveEtiquetteScores(scores: Record<string, EtiquetteScore>): void {
  bridgeSetEtiquetteScores(scores)
}

/**
 * Computes an etiquette score for a player based on all feedback received about them.
 *
 * Score composition:
 * - Sentiment average (0-1): positive=1, neutral=0.5, negative=0
 * - Issue category penalties: unsportsmanlike weighs heaviest, others moderate
 * - Time-decay: 6-month half-life so recent behavior matters more
 *
 * The overall score (0-100) combines sentiment with issue severity.
 * Stored by player ID locally; keyed by email in Supabase via auth join.
 */
export async function recalculateEtiquetteScore(playerId: string): Promise<EtiquetteScore> {
  const feedback = loadFeedback()
  const received = feedback.filter(f => f.toPlayerId === playerId)
  const now = Date.now()

  // Resolve email from profile if this is the current user, otherwise store playerId as key
  const profile = getProfile()
  const email = profile?.id === playerId && profile.email ? profile.email : playerId

  if (received.length === 0) {
    const score: EtiquetteScore = {
      email,
      overallScore: 100,
      sentimentAvg: 1,
      issueBreakdown: { showedUpLate: 0, leftEarly: 0, disputedUnfairly: 0, unsportsmanlike: 0, other: 0 },
      feedbackCount: 0,
      lastUpdated: new Date().toISOString(),
    }
    const scores = loadEtiquetteScores()
    scores[playerId] = score
    saveEtiquetteScores(scores)
    return score
  }

  function decayWeight(dateStr: string): number {
    const ageMs = now - new Date(dateStr).getTime()
    const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000)
    return Math.pow(0.5, ageMonths / 6)
  }

  // Weighted sentiment average
  let sentimentWeightedSum = 0
  let sentimentWeightTotal = 0
  const issueBreakdown = { showedUpLate: 0, leftEarly: 0, disputedUnfairly: 0, unsportsmanlike: 0, other: 0 }

  for (const f of received) {
    const weight = decayWeight(f.createdAt)
    const sentimentVal = f.sentiment === 'positive' ? 1 : f.sentiment === 'neutral' ? 0.5 : 0
    sentimentWeightedSum += weight * sentimentVal
    sentimentWeightTotal += weight

    // Count issue categories from negative feedback
    if (f.sentiment === 'negative' && f.issueCategories) {
      for (const cat of f.issueCategories) {
        if (cat === 'showed_up_late') issueBreakdown.showedUpLate++
        else if (cat === 'left_early') issueBreakdown.leftEarly++
        else if (cat === 'disputed_unfairly') issueBreakdown.disputedUnfairly++
        else if (cat === 'unsportsmanlike') issueBreakdown.unsportsmanlike++
        else if (cat === 'other') issueBreakdown.other++
      }
    }
  }

  const sentimentAvg = sentimentWeightTotal > 0 ? sentimentWeightedSum / sentimentWeightTotal : 1

  // Issue severity penalty (per-incident, decay not applied to keep it simple)
  // Each incident reduces the score; unsportsmanlike is the heaviest
  const issuePenalty =
    issueBreakdown.unsportsmanlike * 8 +
    issueBreakdown.disputedUnfairly * 4 +
    issueBreakdown.showedUpLate * 3 +
    issueBreakdown.leftEarly * 3 +
    issueBreakdown.other * 2

  // Overall: 70% sentiment, 30% issue-free (capped penalty at 30 points)
  const overallScore = Math.max(0, Math.round(
    sentimentAvg * 70 + Math.max(0, 30 - issuePenalty)
  ))

  const score: EtiquetteScore = {
    email,
    overallScore,
    sentimentAvg,
    issueBreakdown,
    feedbackCount: received.length,
    lastUpdated: new Date().toISOString(),
  }

  const scores = loadEtiquetteScores()
  scores[playerId] = score
  saveEtiquetteScores(scores)

  // Sync to Supabase
  const client = getClient()
  if (client) {
    try {
      await client.from('etiquette_scores').upsert({
        player_id: playerId,
        email,
        overall_score: overallScore,
        sentiment_avg: sentimentAvg,
        issue_breakdown: issueBreakdown,
        feedback_count: received.length,
        last_updated: score.lastUpdated,
      })
    } catch { /* silent — etiquette sync is best-effort */ }
  }

  return score
}

// --- Auto-accept timeout (48h) ---

export async function checkAutoAcceptScores(): Promise<void> {
  const all = load()
  let changed = false
  const now = Date.now()
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000

  for (const t of all) {
    for (const match of t.matches) {
      if (!match.scoreReportedBy || !match.scoreReportedAt || match.completed) continue
      // Skip matches with pending disputes
      if (match.scoreDispute?.status === 'pending') continue

      const reportedTime = new Date(match.scoreReportedAt).getTime()
      if (now - reportedTime >= FORTY_EIGHT_HOURS) {
        match.completed = true
        match.scoreConfirmedBy = 'auto'
        match.scoreConfirmedAt = new Date().toISOString()
        changed = true

        // Notify the reporter
        if (match.scoreReportedBy) {
          addNotification({
            type: 'score_reported',
            recipientId: match.scoreReportedBy,
            message: 'Score auto-confirmed after 48 hours.',
            relatedMatchId: match.id,
            relatedTournamentId: t.id,
          })
        }

        // Bracket advancement
        if (match.winnerId) advanceWinner(t, match, match.winnerId)

        // Check tournament completion
        const allDone = t.matches.every(m => m.completed)
        if (allDone) {
          t.status = 'completed'
          awardTournamentTrophies(t.id, t)
          for (const p of t.players) {
            checkAndAwardBadges(p.id, t.id, t)
          }
        }
      }
    }
  }

  if (changed) {
    save(all)
    // Sync changed tournaments (awaited so errors surface)
    for (const t of all) {
      const result = await syncTournament(t)
      if (!result.success) {
        console.warn('[Rally] Auto-accept sync failed for tournament', t.id)
      }
    }
  }
}
