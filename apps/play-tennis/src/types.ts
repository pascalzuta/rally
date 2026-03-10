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

// --- Availability ---

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'

export interface AvailabilitySlot {
  day: DayOfWeek
  startHour: number // 0-23
  endHour: number   // 1-24
}

// --- Scheduling ---

export type SchedulingStatus = 'unscheduled' | 'proposed' | 'confirmed' | 'escalated'

export interface MatchProposal {
  id: string
  proposedBy: 'system' | string // 'system' or player ID
  day: DayOfWeek
  startHour: number
  endHour: number
  status: 'pending' | 'accepted' | 'rejected'
}

export interface MatchSchedule {
  status: SchedulingStatus
  proposals: MatchProposal[]
  confirmedSlot: { day: DayOfWeek; startHour: number; endHour: number } | null
  createdAt: string          // when scheduling started
  escalationDay: number      // 0-4, tracks escalation timeline
  lastEscalation: string     // ISO date of last escalation check
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
  schedule?: MatchSchedule
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
  countdownStartedAt?: string  // ISO timestamp when 6-player countdown began
}

// --- Match Broadcast ---

export type BroadcastStatus = 'active' | 'claimed' | 'expired'

export interface MatchBroadcast {
  id: string
  playerId: string
  playerName: string
  tournamentId: string
  date: string       // ISO date string e.g. "2026-03-10"
  startTime: string  // e.g. "18:30"
  location: string
  message?: string
  status: BroadcastStatus
  createdAt: string
  expiresAt: string  // ISO timestamp, default 2 hours from creation
  claimedBy?: string // player ID who claimed
  matchId?: string   // match ID created from the claim
}
