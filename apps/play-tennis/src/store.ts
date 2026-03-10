import { Tournament, Player, Match, PlayerProfile, PlayerRating, LobbyEntry, AvailabilitySlot, MatchProposal, MatchSchedule, DayOfWeek, MatchBroadcast, BroadcastStatus } from './types'

const STORAGE_KEY = 'play-tennis-data'
const RATINGS_KEY = 'play-tennis-ratings'
const PROFILE_KEY = 'play-tennis-profile'
const LOBBY_KEY = 'play-tennis-lobby'
const AVAILABILITY_KEY = 'play-tennis-availability'
const BROADCAST_KEY = 'play-tennis-broadcasts'

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
    format: 'single-elimination',
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
  if (!match?.schedule || match.schedule.status === 'confirmed') return undefined

  match.schedule.escalationDay += 1
  match.schedule.lastEscalation = new Date().toISOString()

  // Day 3: system assigns provisional slot from best available
  if (match.schedule.escalationDay >= 3 && match.schedule.status !== 'escalated') {
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

  save(all)
  return t
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
      const rA = getPlayerRating(a.name).rating
      const rB = getPlayerRating(b.name).rating
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
    updateRatings(p1.name, p2.name, winner.name)
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

  const allDone = t.matches.every(m => m.completed)
  if (allDone) {
    t.status = 'completed'
  }

  save(all)
  return t
}

export function getPlayerName(tournament: Tournament, playerId: string | null): string {
  if (!playerId) return 'TBD'
  return tournament.players.find(p => p.id === playerId)?.name ?? 'Unknown'
}

// --- Player Ratings (Global Elo) ---

function normalizePlayerName(name: string): string {
  return name.trim().toLowerCase()
}

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

export function getPlayerRating(playerName: string): PlayerRating {
  const key = normalizePlayerName(playerName)
  const ratings = loadRatings()
  return ratings[key] ?? { name: playerName, rating: 1500, matchesPlayed: 0 }
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

export function updateRatings(playerAName: string, playerBName: string, winnerName: string): void {
  const ratings = loadRatings()
  const keyA = normalizePlayerName(playerAName)
  const keyB = normalizePlayerName(playerBName)

  const a = ratings[keyA] ?? { name: playerAName, rating: 1500, matchesPlayed: 0 }
  const b = ratings[keyB] ?? { name: playerBName, rating: 1500, matchesPlayed: 0 }

  const pA = winProbability(a.rating, b.rating)

  const kA = kFactor(a.matchesPlayed)
  const kB = kFactor(b.matchesPlayed)

  const winnerKey = normalizePlayerName(winnerName)
  const sA = winnerKey === keyA ? 1 : 0
  const sB = 1 - sA

  a.rating = Math.round((a.rating + kA * (sA - pA)) * 10) / 10
  b.rating = Math.round((b.rating + kB * (sB - (1 - pA))) * 10) / 10
  a.matchesPlayed += 1
  b.matchesPlayed += 1

  ratings[keyA] = a
  ratings[keyB] = b
  saveRatings(ratings)
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

    // Set up their rating
    const ratings = loadRatings()
    const key = normalizePlayerName(name)
    if (!ratings[key]) {
      ratings[key] = { name, rating: TEST_RATINGS[key] ?? 1500, matchesPlayed: Math.floor(Math.random() * 20) + 5 }
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
  return TEST_PLAYERS.map((name, i) => ({
    id: `test-${i}`,
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
