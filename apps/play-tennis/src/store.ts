import { Tournament, Player, Match } from './types'

const STORAGE_KEY = 'play-tennis-data'

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

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function generateBracket(tournamentId: string): Tournament | undefined {
  const all = load()
  const t = all.find(x => x.id === tournamentId)
  if (!t || t.players.length < 2) return undefined

  if (t.format === 'single-elimination') {
    const shuffled = shuffle(t.players)
    // Pad to next power of 2
    const size = Math.pow(2, Math.ceil(Math.log2(shuffled.length)))
    const padded: (Player | null)[] = [...shuffled]
    while (padded.length < size) padded.push(null)

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
