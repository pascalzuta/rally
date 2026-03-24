export interface Player {
  id: string
  name: string
}

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'
export type Gender = 'male' | 'female' | 'other'

export interface PlayerProfile {
  id: string
  authId?: string    // Supabase auth user ID
  email?: string     // verified email address
  name: string
  county: string
  skillLevel?: SkillLevel
  gender?: Gender
  weeklyCap?: 1 | 2 | 3  // max matches per week, default 2
  bio?: string
  playingStyle?: string[]
  photoUrl?: string
  preferredCourts?: string[]
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

export type SchedulingStatus = 'unscheduled' | 'proposed' | 'confirmed' | 'escalated' | 'resolved'

export interface MatchProposal {
  id: string
  proposedBy: 'system' | string // 'system' or player ID
  day: DayOfWeek
  startHour: number
  endHour: number
  status: 'pending' | 'accepted' | 'rejected'
}

export type SchedulingTier = 'auto' | 'needs-accept' | 'needs-negotiation'

export interface MatchSlot {
  day: DayOfWeek
  startHour: number
  endHour: number
}

export type RescheduleIntent = 'soft' | 'hard'

export type RescheduleReason =
  | 'conflict'
  | 'weather'
  | 'court_issue'
  | 'injury_illness'
  | 'other'

export type RescheduleRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface RescheduleRequest {
  id: string
  intent: RescheduleIntent
  requestedBy: string
  requestedAt: string
  reason: RescheduleReason
  note?: string
  originalSlot: MatchSlot
  status: RescheduleRequestStatus
  respondedBy?: string
  respondedAt?: string
  selectedProposalId?: string
  countsTowardLimit: boolean
  originalSlotReleasedAt?: string
}

export interface ScheduleHistoryEntry {
  id: string
  type: 'initial-confirmation' | 'rescheduled' | 'original-slot-released'
  changedBy: string
  changedAt: string
  fromSlot?: MatchSlot
  toSlot?: MatchSlot
}

export interface MatchSchedule {
  status: SchedulingStatus
  proposals: MatchProposal[]
  confirmedSlot: MatchSlot | null
  createdAt: string          // when scheduling started
  escalationDay: number      // 0-4, tracks escalation timeline
  lastEscalation: string     // ISO date of last escalation check
  participationScores?: Record<string, number>  // playerId -> score
  resolution?: MatchResolution
  schedulingTier?: SchedulingTier  // how the match was scheduled
  rescheduleCount?: number
  activeRescheduleRequest?: RescheduleRequest
  scheduleHistory?: ScheduleHistoryEntry[]
}

export type ResolutionType = 'walkover' | 'forced-match' | 'double-loss'

export interface MatchResolution {
  type: ResolutionType
  winnerId: string | null      // null for double-loss
  reason: string               // human-readable explanation
  resolvedAt: string           // ISO timestamp
  forcedSlot?: MatchSlot  // for forced-match
}

export type MatchPhase = 'group' | 'knockout'

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
  scoreReportedBy?: string | null
  scoreReportedAt?: string | null
  scoreConfirmedBy?: string | null
  scoreConfirmedAt?: string | null
  scoreDispute?: ScoreDispute | null
  splitDecision?: boolean
  schedule?: MatchSchedule
  resolution?: MatchResolution
  phase?: MatchPhase
}

// --- Score Disputes ---

export type DisputeStatus = 'pending' | 'accepted' | 'rejected' | 'admin-review'

export interface ScoreDispute {
  id: string
  type: 'correction' | 'issue'
  proposedScore1?: number[]
  proposedScore2?: number[]
  proposedWinnerId?: string | null
  issueText?: string
  disputedBy: string
  disputedAt: string
  status: DisputeStatus
  resolvedAt?: string
  resolvedBy?: string
}

// --- Match Feedback (Reliability Rating) ---

export type FeedbackSentiment = 'positive' | 'neutral' | 'negative'
export type IssueCategory = 'showed_up_late' | 'left_early' | 'disputed_unfairly' | 'unsportsmanlike' | 'other'

export interface MatchFeedback {
  id: string
  matchId: string
  tournamentId: string
  fromPlayerId: string
  toPlayerId: string
  sentiment: FeedbackSentiment
  issueCategories?: IssueCategory[]
  issueText?: string
  createdAt: string
  revealedAt?: string
}

// --- Reliability Score ---

export interface ReliabilityScore {
  playerId: string
  overallScore: number
  showUpRate: number
  fairnessRating: number
  noDisputesAgainst: number
  confirmationSpeed: number
  matchesConsidered: number
  lastUpdated: string
}

export interface SchedulingSummary {
  confirmed: number
  needsAccept: number
  needsNegotiation: number
  scheduledAt: string
}

export interface Tournament {
  id: string
  name: string
  date: string
  county: string
  format: 'single-elimination' | 'round-robin' | 'group-knockout'
  players: Player[]
  matches: Match[]
  status: 'setup' | 'scheduling' | 'in-progress' | 'completed'
  createdAt: string
  startsAt?: string  // ISO date (YYYY-MM-DD) — Monday of the week matches begin; anchors all week numbers
  countdownStartedAt?: string  // ISO timestamp when 6-player countdown began
  groupPhaseComplete?: boolean  // for group-knockout: true once all group matches done
  clusterRunId?: string  // links to cluster_runs for traceability
  schedulingSummary?: SchedulingSummary  // set after bulk scheduling
  waitlistedPlayerIds?: string[]  // player IDs that couldn't be placed in any group
  mode?: 'singles' | 'doubles'
  teams?: DoublesTeam[]
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
  endTime: string    // e.g. "20:30"
  location: string
  message?: string
  status: BroadcastStatus
  createdAt: string
  expiresAt: string  // ISO timestamp, default 2 hours from creation
  claimedBy?: string // player ID who claimed
  matchId?: string   // match ID created from the claim
}

// --- Trophies & Badges ---

export type TrophyTier = 'champion' | 'finalist' | 'semifinalist'

export interface Trophy {
  id: string
  playerId: string
  playerName: string
  tournamentId: string
  tournamentName: string
  county: string
  tier: TrophyTier
  date: string              // tournament date
  awardedAt: string         // ISO timestamp
  finalMatch?: {            // for champion/finalist: the final match details
    opponentName: string
    score: string           // e.g. "6-3 6-4"
    won: boolean
  }
}

export type BadgeType =
  | 'first-tournament'
  | 'undefeated-champion'
  | 'comeback-win'
  | 'five-tournaments'
  | 'ten-matches'
  | 'reliable-player'
  | 'good-sport'
  | 'community-regular'

export interface Badge {
  id: string
  playerId: string
  type: BadgeType
  label: string
  description: string
  awardedAt: string
  tournamentId?: string     // optional: which tournament triggered it
}

// --- Match Offers ---

export type OfferStatus = 'proposed' | 'accepted' | 'declined' | 'expired'

export interface MatchOffer {
  offerId: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  tournamentId: string
  proposedDate: string     // ISO date string e.g. "2026-03-15"
  proposedTime: string     // e.g. "9:00 AM"
  proposedDay: string      // e.g. "saturday"
  proposedStartHour: number
  proposedEndHour: number
  createdAt: string        // ISO timestamp
  expiresAt: string        // ISO timestamp (createdAt + 2 hours)
  status: OfferStatus
  matchId?: string         // linked match ID once accepted
}

// --- Direct Messages ---

export interface DirectMessage {
  id: string
  senderId: string
  senderName: string
  recipientId: string
  recipientName: string
  text: string
  createdAt: string
  read: boolean
}

// --- Notifications ---

export type NotificationType = 'match_offer' | 'offer_accepted' | 'offer_declined' | 'offer_expired' | 'match_reminder' | 'score_reported' | 'score_correction_proposed' | 'score_correction_resolved' | 'score_issue_reported' | 'feedback_requested' | 'reliability_nudge'

export interface RallyNotification {
  id: string
  type: NotificationType
  recipientId: string
  senderId?: string
  senderName?: string
  message: string
  detail?: string
  relatedOfferId?: string
  relatedMatchId?: string
  relatedTournamentId?: string
  createdAt: string
  read: boolean
}

// --- Match Reactions ---

export interface MatchReaction {
  matchId: string
  playerId: string
  fun: number  // 1-5
  fair: number // 1-5
  playAgain: boolean
  createdAt: string
}

// --- Doubles ---

export interface DoublesTeam {
  id: string
  player1Id: string
  player2Id: string
  teamName: string
}
