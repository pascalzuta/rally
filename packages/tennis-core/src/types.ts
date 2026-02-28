// ─── Subscription ─────────────────────────────────────────────────────────────

export type SubscriptionStatus = "free" | "active" | "cancelled";
export type SubscriptionPlan = "monthly" | "yearly";

// ─── Skill ────────────────────────────────────────────────────────────────────

export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type SkillBand = "3.0" | "3.5" | "4.0";

// ─── Player ───────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  email: string;
  name: string;
  city: string;
  county: string;
  level: SkillLevel;
  ntrp: number;
  rating: number;
  ratingConfidence: number;
  provisionalRemaining: number;
  wins: number;
  losses: number;
  subscription: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Pool ─────────────────────────────────────────────────────────────────────

export interface PoolEntry {
  id: string;
  playerId: string;
  county: string;
  band: SkillBand;
  rating: number;
  createdAt: string;
}

// ─── Availability ─────────────────────────────────────────────────────────────

/** Recurring weekly slot, e.g. "Saturdays 09:00-12:00" */
export interface AvailabilitySlot {
  id: string;
  playerId: string;
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number;
  /** "HH:MM" 24-hour */
  startTime: string;
  /** "HH:MM" 24-hour */
  endTime: string;
}

// ─── Match ────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "pending"
  | "scheduling"
  | "scheduled"
  | "completed"
  | "cancelled";

export interface TimeProposal {
  id: string;
  /** ISO datetime */
  datetime: string;
  /** Human-readable label, e.g. "Sat 10 Feb - 10:00am" */
  label: string;
  /** Player IDs that have accepted this slot */
  acceptedBy: string[];
}

export interface SetScore {
  aGames: number;
  bGames: number;
  tiebreak?: { aPoints: number; bPoints: number };
}

export interface MatchResult {
  winnerId: string;
  /** Legacy string format for casual matches, e.g. "6-4, 7-5" */
  score?: string;
  /** Structured scoring for tournament matches */
  sets?: SetScore[];
  reportedBy: string;
  reportedAt: string;
  /** Second player confirmation */
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface Match {
  id: string;
  challengerId: string;
  opponentId: string;
  tournamentId?: string;
  status: MatchStatus;
  proposals: TimeProposal[];
  /** ISO datetime once scheduled */
  scheduledAt?: string;
  venue?: string;
  result?: MatchResult;
  /** Scheduling tier: 1=auto, 2=flex-needed, 3=propose-and-pick */
  schedulingTier?: 1 | 2 | 3;
  /** Best near-miss if tier 2 */
  nearMiss?: NearMiss;
  createdAt: string;
  updatedAt: string;
}

// ─── Tournament ───────────────────────────────────────────────────────────────

export type TournamentStatus = "registration" | "active" | "finals" | "completed";

export interface RoundRobinPairing {
  homeIndex: number;
  awayIndex: number;
  matchId: string | null;
}

export interface TournamentRound {
  roundNumber: number;
  targetWeek: number;
  pairings: RoundRobinPairing[];
}

export interface StandingEntry {
  playerId: string;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDiff: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  headToHead: Record<string, "win" | "loss" | "pending">;
}

export interface ResultReport {
  winnerId: string;
  sets: SetScore[];
  reportedBy: string;
  reportedAt: string;
}

export interface NearMiss {
  dayOfWeek: number;
  date: string;
  slotA: { startTime: string; endTime: string };
  slotB: { startTime: string; endTime: string };
  overlapMinutes: number;
  gapMinutes: number;
  flexNeeded: number;
  suggestion: string;
  flexedWindow: { startTime: string; endTime: string };
}

export interface SchedulingResult {
  scheduledCount: number;
  failedCount: number;
  failedMatchIds: string[];
  nearMissCount: number;
  nearMissMatchIds: string[];
}

export interface Tournament {
  id: string;
  /** "YYYY-MM" */
  month: string;
  name: string;
  county: string;
  band: SkillBand;
  status: TournamentStatus;
  playerIds: string[];
  minPlayers: number;
  maxPlayers: number;
  rounds: TournamentRound[];
  standings: StandingEntry[];
  pendingResults: Record<string, ResultReport>;
  registrationOpenedAt: string;
  finalsMatches?: { champMatchId?: string; thirdMatchId?: string };
  schedulingResult?: SchedulingResult;
  createdAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
}
