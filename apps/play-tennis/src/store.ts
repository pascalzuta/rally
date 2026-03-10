import { Tournament, Player, Match, PlayerProfile, PlayerRating, LobbyEntry } from './types'

const STORAGE_KEY = 'play-tennis-data'
const RATINGS_KEY = 'play-tennis-ratings'
const PROFILE_KEY = 'play-tennis-profile'
const LOBBY_KEY = 'play-tennis-lobby'

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

export function startTournamentFromLobby(county: string): Tournament | null {
  const lobby = loadLobby()
  const allCounty = lobby.filter(e => e.county.toLowerCase() === county.toLowerCase())
  if (allCounty.length < 4) return null

  // Take exactly 4 players per tournament
  const countyPlayers = allCounty.slice(0, 4)
  const format: Tournament['format'] = 'single-elimination'
  const tournament: Tournament = {
    id: generateId(),
    name: `${county} Open`,
    date: new Date().toISOString().split('T')[0],
    county,
    format,
    players: countyPlayers.map(e => ({ id: e.playerId, name: e.playerName })),
    matches: [],
    status: 'setup',
    createdAt: new Date().toISOString(),
  }

  const all = load()
  all.unshift(tournament)
  save(all)

  // Remove only the 4 players who entered the tournament from lobby
  const takenIds = new Set(countyPlayers.map(e => e.playerId))
  const remainingLobby = lobby.filter(e => !takenIds.has(e.playerId))
  saveLobby(remainingLobby)

  // Generate bracket immediately
  return generateBracket(tournament.id) ?? tournament
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

export function seedLobby(county: string, count: number = 3): LobbyEntry[] {
  const lobby = loadLobby()
  const existing = lobby.filter(e => e.county.toLowerCase() === county.toLowerCase())
  const existingNames = new Set(existing.map(e => e.playerName.toLowerCase()))

  const available = TEST_PLAYERS.filter(n => !existingNames.has(n.toLowerCase()))
  const toAdd = available.slice(0, count)

  for (const name of toAdd) {
    const id = generateId()
    lobby.push({ playerId: id, playerName: name, county, joinedAt: new Date().toISOString() })

    // Set up their rating
    const ratings = loadRatings()
    const key = normalizePlayerName(name)
    if (!ratings[key]) {
      ratings[key] = { name, rating: TEST_RATINGS[key] ?? 1500, matchesPlayed: Math.floor(Math.random() * 20) + 5 }
      saveRatings(ratings)
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
