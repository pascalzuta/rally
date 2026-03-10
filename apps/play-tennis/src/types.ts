export interface Player {
  id: string
  name: string
}

export interface PlayerProfile {
  id: string
  name: string
  county: string
  createdAt: string
}

export interface PlayerRating {
  name: string
  rating: number
  matchesPlayed: number
}

export interface LobbyEntry {
  playerId: string
  playerName: string
  county: string
  joinedAt: string
}

export interface Match {
  id: string
  round: number
  position: number
  player1Id: string | null
  player2Id: string | null
  score1: number[]
  score2: number[]
  winnerId: string | null
  completed: boolean
}

export interface Tournament {
  id: string
  name: string
  date: string
  county: string
  format: 'single-elimination' | 'round-robin'
  players: Player[]
  matches: Match[]
  status: 'setup' | 'in-progress' | 'completed'
  createdAt: string
}
