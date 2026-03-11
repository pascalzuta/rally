import { Tournament, Player, Match, PlayerProfile, PlayerRating, LobbyEntry, AvailabilitySlot, MatchProposal, MatchSchedule, DayOfWeek, MatchBroadcast, BroadcastStatus, MatchResolution, ResolutionType, Trophy, TrophyTier, Badge, BadgeType } from './types'

const STORAGE_KEY = 'play-tennis-data'
const RATINGS_KEY = 'play-tennis-ratings'
const PROFILE_KEY = 'play-tennis-profile'
const LOBBY_KEY = 'play-tennis-lobby'
const AVAILABILITY_KEY = 'play-tennis-availability'
const BROADCAST_KEY = 'play-tennis-broadcasts'
const RATING_HISTORY_KEY = 'play-tennis-rating-history'
const TROPHIES_KEY = 'play-tennis-trophies'
const BADGES_KEY = 'play-tennis-badges'
const PENDING_VICTORY_KEY = 'play-tennis-pending-victory'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

// --- Profile ---

export function getProfile(): PlayerProfile | null {
  try {
    const data = localStorage.getItem(PROFILE_KEY)
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export function createProfile(name: string, county: string): PlayerProfile {
  const profile: PlayerProfile = {
    id: generateId(),
    name: name.trim(),
    county: county.trim(),
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
  return profile
}

export function logout(): void {
  localStorage.removeItem(PROFILE_KEY)
}

// --- Lobby ---

function loadLobby(): LobbyEntry[] {
  try {
    const data = localStorage.getItem(LOBBY_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveLobby(lobby: LobbyEntry[]): void {
  localStorage.setItem(LOBBY_KEY, JSON.stringify(lobby))
}

export function getLobbyByCounty(county: string): LobbyEntry[] {
  return loadLobby().filter(e => e.county.toLowerCase() === county.toLowerCase())
}

export function isInLobby(playerId: string): boolean {
  return loadLobby().some(e => e.playerId === playerId)
}

export function joinLobby(profile: PlayerProfile): LobbyEntry[] {
  const lobby = loadLobby()
  if (lobby.some(e => e.playerId === profile.id)) return getLobbyByCounty(profile.county)
  lobby.push({
    playerId: profile.id,
    playerName: profile.name,
    county: profile.county,
    joinedAt: new Date().toISOString(),
  })
  saveLobby(lobby)
  return getLobbyByCounty(profile.county)
}

export function leaveLobby(playerId: string): void {
  const lobby = loadLobby().filter(e => e.playerId !== playerId)
  saveLobby(lobby)
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

export function startTournamentFromLobby(county: string): Tournament | null {
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
      for (const e of newPlayers) {
        if (t.players.length >= MAX_PLAYERS) break
        t.players.push({ id: e.playerId, name: e.playerName })
      }

      // Remove added players from lobby
      const takenIds = new Set(t.players.map(p => p.id))
      const remainingLobby = lobby.filter(e => !takenIds.has(e.playerId))
      saveLobby(remainingLobby)

      // If we hit max, start immediately
      if (t.players.length >= MAX_PLAYERS) {
        save(all)
        return generateBracket(t.id) ?? t
      }

      save(all)
      return t
    }
    return existing
  }

  // Need at least MIN_PLAYERS to create a tournament
  if (allCounty.length < MIN_PLAYERS) return null

  // Take up to MAX_PLAYERS
  const countyPlayers = allCounty.slice(0, MAX_PLAYERS)
  const tournament: Tournament = {
    id: generateId(),
    name: `${county} Open`,
    date: new Date().toISOString().split('T')[0],
    county,
    format: 'group-knockout',
    players: countyPlayers.map(e => ({ id: e.playerId, name: e.playerName })),
    matches: [],
    status: 'setup',
    createdAt: new Date().toISOString(),
    countdownStartedAt: new Date().toISOString(),
  }

  const all = load()
  all.unshift(tournament)
  save(all)

  // Remove players who entered the tournament from lobby
  const takenIds = new Set(countyPlayers.map(e => e.playerId))
  const remainingLobby = lobby.filter(e => !takenIds.has(e.playerId))
  saveLobby(remainingLobby)

  // If we already have max players, start immediately
  if (countyPlayers.length >= MAX_PLAYERS) {
    return generateBracket(tournament.id) ?? tournament
  }

  return tournament
}

// Check countdown and start tournament if expired
export function checkCountdownExpired(tournamentId: string): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.status !== 'setup' || !t.countdownStartedAt) return undefined

  const remaining = getCountdownRemaining(t)
  if (remaining !== null && remaining <= 0 && t.players.length >= MIN_PLAYERS) {
    save(all)
    return generateBracket(t.id)
  }
  return undefined
}

// Force-start a setup tournament (dev tool)
export function forceStartTournament(tournamentId: string): Tournament | undefined {
  const t = getTournament(tournamentId)
  if (!t || t.status !== 'setup') return undefined
  return generateBracket(tournamentId)
}

// --- Availability ---

function loadAllAvailability(): Record<string, AvailabilitySlot[]> {
  try {
    const data = localStorage.getItem(AVAILABILITY_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveAllAvailability(avail: Record<string, AvailabilitySlot[]>): void {
  localStorage.setItem(AVAILABILITY_KEY, JSON.stringify(avail))
}

export function saveAvailability(playerId: string, slots: AvailabilitySlot[]): void {
  const all = loadAllAvailability()
  all[playerId] = slots
  saveAllAvailability(all)
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
      if (end - start >= 1) { // at least 1 hour overlap
        overlaps.push({ day: a.day, startHour: start, endHour: end })
      }
    }
  }
  return overlaps
}

const DAY_ORDER: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function rankSlots(slots: AvailabilitySlot[]): AvailabilitySlot[] {
  return [...slots].sort((a, b) => {
    // Prefer longer slots
    const durA = a.endHour - a.startHour
    const durB = b.endHour - b.startHour
    if (durB !== durA) return durB - durA
    // Then prefer weekends
    const weekendA = (a.day === 'saturday' || a.day === 'sunday') ? 0 : 1
    const weekendB = (b.day === 'saturday' || b.day === 'sunday') ? 0 : 1
    if (weekendA !== weekendB) return weekendA - weekendB
    // Then by day order
    return DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
  })
}

export function generateMatchSchedule(
  player1Id: string,
  player2Id: string
): MatchSchedule {
  const slots1 = getAvailability(player1Id)
  const slots2 = getAvailability(player2Id)

  const overlaps = computeOverlap(slots1, slots2)
  const ranked = rankSlots(overlaps)

  // Generate up to 3 system proposals from overlaps
  const proposals: MatchProposal[] = ranked.slice(0, 3).map(slot => ({
    id: generateId(),
    proposedBy: 'system',
    day: slot.day,
    startHour: slot.startHour,
    endHour: slot.endHour,
    status: 'pending',
  }))

  // If no overlap, use one player's slots as suggestions
  if (proposals.length === 0) {
    const fallback = rankSlots([...slots1, ...slots2])
    for (const slot of fallback.slice(0, 3)) {
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

export function acceptProposal(
  tournamentId: string,
  matchId: string,
  proposalId: string,
  acceptedBy: string
): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match?.schedule) return undefined

  const proposal = match.schedule.proposals.find(p => p.id === proposalId)
  if (!proposal || proposal.status !== 'pending') return undefined

  // Mark this proposal as accepted, others as rejected
  for (const p of match.schedule.proposals) {
    p.status = p.id === proposalId ? 'accepted' : 'rejected'
  }

  match.schedule.status = 'confirmed'
  match.schedule.confirmedSlot = {
    day: proposal.day,
    startHour: proposal.startHour,
    endHour: proposal.endHour,
  }

  // Track participation: +4 for accepting
  if (!match.schedule.participationScores) match.schedule.participationScores = {}
  match.schedule.participationScores[acceptedBy] = (match.schedule.participationScores[acceptedBy] ?? 0) + 4

  save(all)
  return t
}

export function proposeNewSlots(
  tournamentId: string,
  matchId: string,
  proposedBy: string,
  slots: { day: DayOfWeek; startHour: number; endHour: number }[]
): Tournament | undefined {
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

  save(all)
  return t
}

export function escalateMatch(
  tournamentId: string,
  matchId: string
): Tournament | undefined {
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
    resolveMatchByParticipation(t, match)
  }

  save(all)
  return t
}

const PARTICIPATION_THRESHOLD = 3

export function getParticipationScore(schedule: MatchSchedule, playerId: string): number {
  return schedule.participationScores?.[playerId] ?? 0
}

export function getParticipationLabel(score: number): string {
  if (score >= 6) return 'Very Active'
  if (score >= PARTICIPATION_THRESHOLD) return 'Participated'
  if (score >= 1) return 'Minimal'
  return 'Inactive'
}

function resolveMatchByParticipation(tournament: Tournament, match: Match): void {
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
    if (p1 && p2) updateRatings(p1, p2, p1.id)

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
    if (p1 && p2) updateRatings(p1, p2, p2.id)

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
  } else if (tournament.format === 'group-knockout') {
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
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function save(tournaments: Tournament[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tournaments))
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

export function deleteTournament(tournamentId: string): void {
  const all = load().filter(t => t.id !== tournamentId)
  save(all)
}

export function leaveTournament(tournamentId: string, playerId: string): boolean {
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
    } else {
      save(all)
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

  save(all)
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

export function generateBracket(tournamentId: string): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.players.length < 2) return undefined

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
        })
      }
    }
    t.matches = matches
  }

  // Generate schedules for all matches with both players assigned
  for (const m of t.matches) {
    if (m.player1Id && m.player2Id && !m.completed) {
      m.schedule = generateMatchSchedule(m.player1Id, m.player2Id)
    }
  }

  t.status = 'in-progress'
  save(all)
  return t
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

  const groupMatches = tournament.matches.filter(m => m.phase === 'group')
  for (const match of groupMatches) {
    if (!match.completed) continue
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

export function saveMatchScore(
  tournamentId: string,
  matchId: string,
  score1: number[],
  score2: number[],
  winnerId: string
): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined

  const match = t.matches.find(m => m.id === matchId)
  if (!match) return undefined

  match.score1 = score1
  match.score2 = score2
  match.winnerId = winnerId
  match.completed = true

  // Update global Elo ratings
  const p1 = t.players.find(p => p.id === match.player1Id)
  const p2 = t.players.find(p => p.id === match.player2Id)
  const winner = t.players.find(p => p.id === winnerId)
  if (p1 && p2 && winner) {
    updateRatings(p1, p2, winner.id)
  }

  // Advance winner in single-elimination
  if (t.format === 'single-elimination') {
    const nextRoundMatches = t.matches.filter(m => m.round === match.round + 1)
    const nextMatch = nextRoundMatches[Math.floor(match.position / 2)]
    if (nextMatch) {
      if (match.position % 2 === 0) {
        nextMatch.player1Id = winnerId
      } else {
        nextMatch.player2Id = winnerId
      }
      // Generate schedule when both players are known
      if (nextMatch.player1Id && nextMatch.player2Id && !nextMatch.schedule) {
        nextMatch.schedule = generateMatchSchedule(nextMatch.player1Id, nextMatch.player2Id)
      }
    }
  }

  // Group-knockout: check if group phase is done, generate knockout
  if (t.format === 'group-knockout') {
    if (match.phase === 'group') {
      const groupMatches = t.matches.filter(m => m.phase === 'group')
      const allGroupDone = groupMatches.every(m => m.completed)
      if (allGroupDone && !t.groupPhaseComplete) {
        generateKnockoutPhase(t)
      }
    } else if (match.phase === 'knockout') {
      // Advance in knockout bracket (semis → final)
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

  const allDone = t.matches.every(m => m.completed)
  if (allDone) {
    t.status = 'completed'
    awardTournamentTrophies(t.id, t)
    for (const p of t.players) {
      checkAndAwardBadges(p.id, t.id, t)
    }
  }

  save(all)
  return t
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

export function getPlayerSeed(tournament: Tournament, playerId: string | null): number | null {
  if (!playerId) return null
  const seeds = getSeeds(tournament)
  return seeds.get(playerId) ?? null
}

// --- Player Ratings (Global Elo) ---

function loadRatings(): Record<string, PlayerRating> {
  try {
    const data = localStorage.getItem(RATINGS_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveRatings(ratings: Record<string, PlayerRating>): void {
  localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings))
}

// Legacy: look up by normalized name (for backwards compat with old data)
function findRatingByName(ratings: Record<string, PlayerRating>, name: string): PlayerRating | null {
  const normalized = name.trim().toLowerCase()
  for (const entry of Object.values(ratings)) {
    if (entry.name.trim().toLowerCase() === normalized) return entry
  }
  return null
}

export function getPlayerRating(playerId: string, playerName?: string): PlayerRating {
  const ratings = loadRatings()
  // Try by ID first
  if (ratings[playerId]) return ratings[playerId]
  // Fallback: try legacy name-based key
  const displayName = playerName ?? playerId
  const legacyKey = displayName.trim().toLowerCase()
  if (ratings[legacyKey]) return ratings[legacyKey]
  return { name: displayName, rating: 1500, matchesPlayed: 0 }
}

// Lookup by name for leaderboard (searches all entries)
export function getPlayerRatingByName(playerName: string): PlayerRating {
  const ratings = loadRatings()
  const found = findRatingByName(ratings, playerName)
  return found ?? { name: playerName, rating: 1500, matchesPlayed: 0 }
}

export function getAllRatings(): PlayerRating[] {
  return Object.values(loadRatings()).sort((a, b) => b.rating - a.rating)
}

function kFactor(matchesPlayed: number): number {
  return 250 / Math.pow(matchesPlayed + 5, 0.4)
}

export function winProbability(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

export function updateRatings(
  playerA: { id: string; name: string },
  playerB: { id: string; name: string },
  winnerId: string
): void {
  const ratings = loadRatings()

  const a = ratings[playerA.id] ?? { name: playerA.name, rating: 1500, matchesPlayed: 0 }
  const b = ratings[playerB.id] ?? { name: playerB.name, rating: 1500, matchesPlayed: 0 }
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
  saveRatings(ratings)
  recordRatingSnapshot(playerA.id, a.rating)
  recordRatingSnapshot(playerB.id, b.rating)
}

// --- Rating History ---

export interface RatingSnapshot {
  rating: number
  timestamp: string
}

function loadRatingHistory(): Record<string, RatingSnapshot[]> {
  try {
    const data = localStorage.getItem(RATING_HISTORY_KEY)
    return data ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveRatingHistory(history: Record<string, RatingSnapshot[]>): void {
  localStorage.setItem(RATING_HISTORY_KEY, JSON.stringify(history))
}

function recordRatingSnapshot(playerId: string, rating: number): void {
  const history = loadRatingHistory()
  if (!history[playerId]) history[playerId] = []
  history[playerId].push({ rating, timestamp: new Date().toISOString() })
  saveRatingHistory(history)
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

export function getRatingLabel(rating: number): string {
  if (rating >= 2200) return 'Pro'
  if (rating >= 2000) return 'Semi-pro'
  if (rating >= 1800) return 'Elite'
  if (rating >= 1600) return 'Strong'
  if (rating >= 1400) return 'Club'
  if (rating >= 1200) return 'Beginner'
  return 'Newcomer'
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
  try {
    const data = localStorage.getItem(TROPHIES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveTrophies(trophies: Trophy[]): void {
  localStorage.setItem(TROPHIES_KEY, JSON.stringify(trophies))
}

export function getPlayerTrophies(playerId: string): Trophy[] {
  return loadTrophies().filter(t => t.playerId === playerId)
    .sort((a, b) => {
      const tierOrder: Record<TrophyTier, number> = { champion: 0, finalist: 1, semifinalist: 2 }
      return tierOrder[a.tier] - tierOrder[b.tier] || b.awardedAt.localeCompare(a.awardedAt)
    })
}

export function getAllTrophies(): Trophy[] {
  return loadTrophies()
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
    // Round-robin: winner is #1 in standings (most wins)
    // getGroupStandings filters by phase==='group', but round-robin matches have no phase
    // So compute standings directly
    const stats = t.players.map(p => ({ id: p.id, name: p.name, wins: 0 }))
    for (const m of t.matches) {
      if (!m.completed || !m.winnerId) continue
      const s = stats.find(s => s.id === m.winnerId)
      if (s) s.wins++
    }
    stats.sort((a, b) => b.wins - a.wins)
    const standings = stats
    if (standings.length > 0) {
      const winner = t.players.find(p => p.name === standings[0].name)
      if (winner) {
        newTrophies.push({
          id: generateId(), playerId: winner.id, playerName: winner.name,
          tournamentId: t.id, tournamentName: t.name, county: t.county,
          tier: 'champion', date: t.date, awardedAt: now,
        })
      }
      if (standings.length > 1) {
        const second = t.players.find(p => p.name === standings[1].name)
        if (second) {
          newTrophies.push({
            id: generateId(), playerId: second.id, playerName: second.name,
            tournamentId: t.id, tournamentName: t.name, county: t.county,
            tier: 'finalist', date: t.date, awardedAt: now,
          })
        }
      }
    }
  }

  trophies.push(...newTrophies)
  saveTrophies(trophies)

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

export function getLatestChampionTrophy(county: string): Trophy | null {
  const trophies = loadTrophies()
  const countyChampions = trophies
    .filter(t => t.county.toLowerCase() === county.toLowerCase() && t.tier === 'champion')
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
  return countyChampions[0] ?? null
}

// --- Badges ---

function loadBadges(): Badge[] {
  try {
    const data = localStorage.getItem(BADGES_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveBadges(badges: Badge[]): void {
  localStorage.setItem(BADGES_KEY, JSON.stringify(badges))
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
}

function awardBadge(playerId: string, type: BadgeType, tournamentId?: string): void {
  const badges = loadBadges()
  if (badges.some(b => b.playerId === playerId && b.type === type)) return
  const def = BADGE_DEFS[type]
  badges.push({
    id: generateId(),
    playerId,
    type,
    label: def.label,
    description: def.description,
    awardedAt: new Date().toISOString(),
    tournamentId,
  })
  saveBadges(badges)
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
  try {
    const data = localStorage.getItem(PENDING_VICTORY_KEY)
    const all: PendingVictory[] = data ? JSON.parse(data) : []
    return all.find(v => v.playerId === playerId) ?? null
  } catch {
    return null
  }
}

export function clearPendingVictory(playerId: string): void {
  try {
    const data = localStorage.getItem(PENDING_VICTORY_KEY)
    const all: PendingVictory[] = data ? JSON.parse(data) : []
    const filtered = all.filter(v => v.playerId !== playerId)
    if (filtered.length > 0) {
      localStorage.setItem(PENDING_VICTORY_KEY, JSON.stringify(filtered))
    } else {
      localStorage.removeItem(PENDING_VICTORY_KEY)
    }
  } catch {
    localStorage.removeItem(PENDING_VICTORY_KEY)
  }
}

function setPendingVictory(trophy: Trophy): void {
  try {
    const data = localStorage.getItem(PENDING_VICTORY_KEY)
    const all: PendingVictory[] = data ? JSON.parse(data) : []
    // Don't duplicate
    if (all.some(v => v.playerId === trophy.playerId && v.tournamentName === trophy.tournamentName)) return
    all.push({
      tier: trophy.tier,
      tournamentName: trophy.tournamentName,
      playerId: trophy.playerId,
    })
    localStorage.setItem(PENDING_VICTORY_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
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

export function seedLobby(county: string, count: number = 3): LobbyEntry[] {
  const lobby = loadLobby()
  const existing = lobby.filter(e => e.county.toLowerCase() === county.toLowerCase())
  const existingNames = new Set(existing.map(e => e.playerName.toLowerCase()))

  const available = TEST_PLAYERS.filter(n => !existingNames.has(n.toLowerCase()))
  const toAdd = available.slice(0, count)

  for (const name of toAdd) {
    const id = generateId()
    const playerIdx = TEST_PLAYERS.indexOf(name)
    lobby.push({ playerId: id, playerName: name, county, joinedAt: new Date().toISOString() })

    // Set up their rating (keyed by player ID)
    const ratings = loadRatings()
    const normalizedName = name.trim().toLowerCase()
    if (!ratings[id]) {
      ratings[id] = { name, rating: TEST_RATINGS[normalizedName] ?? 1500, matchesPlayed: Math.floor(Math.random() * 20) + 5 }
      saveRatings(ratings)
    }

    // Set up their availability
    if (playerIdx >= 0 && TEST_AVAILABILITY[playerIdx]) {
      saveAvailability(id, TEST_AVAILABILITY[playerIdx])
    }
  }

  saveLobby(lobby)
  return getLobbyByCounty(county)
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
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// Auto-confirm all pending schedules (dev tool)
export function autoConfirmAllSchedules(tournamentId: string): Tournament | undefined {
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
        match.schedule.confirmedSlot = { day: best.day, startHour: best.startHour, endHour: best.endHour }
      }
    }
  }

  save(all)
  return t
}

// Simulate random scores for the current round of a tournament
export function simulateRoundScores(tournamentId: string): Tournament | undefined {
  const t = getTournament(tournamentId)
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

  let updated = t
  for (const match of roundMatches) {
    const pick = SCORES[Math.floor(Math.random() * SCORES.length)]
    const winnerId = pick.w === 1 ? match.player1Id! : match.player2Id!
    const result = saveMatchScore(tournamentId, match.id, pick.s1, pick.s2, winnerId)
    if (result) updated = result
  }

  return updated
}

// Simulate a tournament all the way to the final, with the given player as a finalist
export function simulateToFinal(playerId: string, county: string): { tournamentId: string } | null {
  const profile = getProfile()
  if (!profile) return null

  // Step 1: Ensure player is in lobby, seed to 6+, and create tournament
  if (!isInLobby(playerId)) {
    joinLobby(profile)
  }
  seedLobby(county, 5)
  const lobby = getLobbyByCounty(county)
  if (lobby.length < 6) return null

  // Create tournament from lobby if one doesn't exist yet
  startTournamentFromLobby(county)
  const setupT = getSetupTournamentForCounty(county)
  if (!setupT) {
    // Need to create tournament via lobby - join lobby first if not in it
    const inLobby = lobby.find(e => e.playerId === playerId)
    if (!inLobby) {
      joinLobby(profile)
    }
    // Still need 6 in lobby for tournament creation
    const updatedLobby = getLobbyByCounty(county)
    if (updatedLobby.length < 6) {
      seedLobby(county, 6 - updatedLobby.length)
    }
    // Create the tournament from lobby entries
    startTournamentFromLobby(county)
    const st = getSetupTournamentForCounty(county)
    if (!st) return null
    const started = forceStartTournament(st.id)
    if (!started) return null
    return simulateToFinalInner(started.id, playerId)
  }

  const started = forceStartTournament(setupT.id)
  if (!started) return null
  return simulateToFinalInner(started.id, playerId)
}

function simulateToFinalInner(tournamentId: string, playerId: string): { tournamentId: string } | null {
  let t = getTournament(tournamentId)
  if (!t) return null

  // For group-knockout: score all group matches, ensuring player wins enough
  if (t.format === 'group-knockout') {
    const groupMatches = t.matches.filter(m => m.phase === 'group')
    for (const match of groupMatches) {
      if (match.completed || !match.player1Id || !match.player2Id) continue
      const isMyMatch = match.player1Id === playerId || match.player2Id === playerId
      const s1 = [6, 6]
      const s2 = [3, 4]
      let winnerId: string
      if (isMyMatch) {
        winnerId = playerId
      } else {
        winnerId = match.player1Id!
      }
      // Set scores so the winner wins
      if (winnerId === match.player1Id) {
        saveMatchScore(tournamentId, match.id, s1, s2, winnerId)
      } else {
        saveMatchScore(tournamentId, match.id, s2, s1, winnerId)
      }
    }

    // Reload tournament (knockout phase should now exist)
    t = getTournament(tournamentId)
    if (!t) return null

    // Score semifinals, ensuring our player wins
    const knockoutMatches = t.matches.filter(m => m.phase === 'knockout')
    const semis = knockoutMatches.filter(m => m.round === 2)
    for (const semi of semis) {
      if (semi.completed || !semi.player1Id || !semi.player2Id) continue
      const isMyMatch = semi.player1Id === playerId || semi.player2Id === playerId
      const s1 = [6, 6]
      const s2 = [3, 4]
      let winnerId: string
      if (isMyMatch) {
        winnerId = playerId
      } else {
        winnerId = semi.player1Id!
      }
      if (winnerId === semi.player1Id) {
        saveMatchScore(tournamentId, semi.id, s1, s2, winnerId)
      } else {
        saveMatchScore(tournamentId, semi.id, s2, s1, winnerId)
      }
    }

    return { tournamentId }
  }

  // For single-elimination: score all rounds except the last
  if (t.format === 'single-elimination') {
    const maxRound = Math.max(...t.matches.map(m => m.round))
    for (let round = 1; round < maxRound; round++) {
      t = getTournament(tournamentId)
      if (!t) return null
      const roundMatches = t.matches.filter(m => m.round === round && !m.completed && m.player1Id && m.player2Id)
      for (const match of roundMatches) {
        const isMyMatch = match.player1Id === playerId || match.player2Id === playerId
        const s1 = [6, 6]
        const s2 = [3, 4]
        let winnerId: string
        if (isMyMatch) {
          winnerId = playerId
        } else {
          winnerId = match.player1Id!
        }
        if (winnerId === match.player1Id) {
          saveMatchScore(tournamentId, match.id, s1, s2, winnerId)
        } else {
          saveMatchScore(tournamentId, match.id, s2, s1, winnerId)
        }
      }
    }
    return { tournamentId }
  }

  // Round-robin: score all except last match involving player
  const myMatches = t.matches.filter(m => m.player1Id === playerId || m.player2Id === playerId)
  const otherMatches = t.matches.filter(m => m.player1Id !== playerId && m.player2Id !== playerId)
  // Score all other matches
  for (const match of otherMatches) {
    if (match.completed || !match.player1Id || !match.player2Id) continue
    saveMatchScore(tournamentId, match.id, [6, 6], [3, 4], match.player1Id!)
  }
  // Score all my matches except the last
  for (let i = 0; i < myMatches.length - 1; i++) {
    const match = myMatches[i]
    if (match.completed || !match.player1Id || !match.player2Id) continue
    if (match.player1Id === playerId) {
      saveMatchScore(tournamentId, match.id, [6, 6], [3, 4], playerId)
    } else {
      saveMatchScore(tournamentId, match.id, [3, 4], [6, 6], playerId)
    }
  }

  return { tournamentId }
}

// --- Match Broadcasts ---

function loadBroadcasts(): MatchBroadcast[] {
  try {
    const data = localStorage.getItem(BROADCAST_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

function saveBroadcasts(broadcasts: MatchBroadcast[]): void {
  localStorage.setItem(BROADCAST_KEY, JSON.stringify(broadcasts))
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

export function claimBroadcast(
  broadcastId: string,
  claimingPlayerId: string
): { broadcast: MatchBroadcast; tournament: Tournament } | null {
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
    save(all)
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
