import { Tournament, Player, Match, PlayerRating } from './types'

const STORAGE_KEY = 'play-tennis-data'
const RATINGS_KEY = 'play-tennis-ratings'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

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

export function getTournament(id: string): Tournament | undefined {
  return load().find(t => t.id === id)
}

export function createTournament(name: string, date: string, format: Tournament['format']): Tournament {
  const tournament: Tournament = {
    id: generateId(),
    name,
    date,
    format,
    players: [],
    matches: [],
    status: 'setup',
    createdAt: new Date().toISOString(),
  }
  const all = load()
  all.unshift(tournament)
  save(all)
  return tournament
}

export function addPlayer(tournamentId: string, playerName: string): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  t.players.push({ id: generateId(), name: playerName.trim() })
  save(all)
  return t
}

export function removePlayer(tournamentId: string, playerId: string): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t) return undefined
  t.players = t.players.filter(p => p.id !== playerId)
  save(all)
  return t
}

export function deleteTournament(tournamentId: string): void {
  const all = load().filter(t => t.id !== tournamentId)
  save(all)
}

// Generate seed positions so top seeds are placed apart in bracket
// E.g., for 8: seed 1 at pos 0, seed 2 at pos 7, seed 3 at pos 3, seed 4 at pos 4...
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
    // Seed by rating: highest rated players placed apart in bracket
    const seeded = [...t.players].sort((a, b) => {
      const rA = getPlayerRating(a.name).rating
      const rB = getPlayerRating(b.name).rating
      return rB - rA
    })
    const size = Math.pow(2, Math.ceil(Math.log2(seeded.length)))
    // Place seeds so top seeds meet latest: 1v8, 4v5, 2v7, 3v6 etc.
    const slots = new Array<Player | null>(size).fill(null)
    const seedOrder = getSeedPositions(size)
    for (let i = 0; i < seeded.length; i++) {
      slots[seedOrder[i]] = seeded[i]
    }
    const padded: (Player | null)[] = slots

    const totalRounds = Math.log2(size)
    const matches: Match[] = []

    // First round
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

    // Later rounds (empty slots)
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

    // Advance byes
    advanceByes(matches)

    t.matches = matches
  } else {
    // Round-robin: every player plays every other player
    const matches: Match[] = []
    let round = 1
    for (let i = 0; i < t.players.length; i++) {
      for (let j = i + 1; j < t.players.length; j++) {
        matches.push({
          id: generateId(),
          round,
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

  // Check if tournament is completed
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
  const pB = 1 - pA

  const kA = kFactor(a.matchesPlayed)
  const kB = kFactor(b.matchesPlayed)

  const winnerKey = normalizePlayerName(winnerName)
  const sA = winnerKey === keyA ? 1 : 0
  const sB = 1 - sA

  a.rating = Math.round((a.rating + kA * (sA - pA)) * 10) / 10
  b.rating = Math.round((b.rating + kB * (sB - pB)) * 10) / 10
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
