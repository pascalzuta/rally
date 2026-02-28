export type SkillLevel = "beginner" | "intermediate" | "advanced";
export type MatchStatus = "pending" | "scheduling" | "scheduled" | "completed" | "cancelled";
export type AuthMode = "signin" | "signup";
export type SkillBand = "3.0" | "3.5" | "4.0";
export type TournamentStatus = "registration" | "active" | "finals" | "completed";
export type SubscriptionStatus = "free" | "active" | "cancelled";
export type Tab = "home" | "tourney" | "activity" | "profile";

export interface Player {
  id: string; email: string; name: string; city: string;
  level: SkillLevel; rating: number; wins: number; losses: number;
  county: string; ntrp: number; ratingConfidence: number;
  provisionalRemaining: number; subscription: SubscriptionStatus;
  createdAt: string; updatedAt: string;
}

export interface AvailabilitySlot {
  id: string; playerId: string; dayOfWeek: number; startTime: string; endTime: string;
}

export interface TimeProposal {
  id: string; datetime: string; label: string; acceptedBy: string[];
}

export interface SetScore {
  aGames: number; bGames: number;
  tiebreak?: { aPoints: number; bPoints: number };
}

export interface MatchResult {
  winnerId: string; score?: string; sets?: SetScore[];
  reportedBy: string; reportedAt: string;
  confirmedBy?: string; confirmedAt?: string;
}

export interface ResultReport {
  winnerId: string; sets: SetScore[];
  reportedBy: string; reportedAt: string;
}

export interface StandingEntry {
  playerId: string; played: number; wins: number; losses: number;
  setsWon: number; setsLost: number; setDiff: number;
  gamesWon: number; gamesLost: number; gameDiff: number;
  headToHead: Record<string, "win" | "loss" | "pending">;
}

export interface RoundRobinPairing {
  homeIndex: number; awayIndex: number; matchId: string | null;
}

export interface TournamentRound {
  roundNumber: number; targetWeek: number; pairings: RoundRobinPairing[];
}

export interface Match {
  id: string; challengerId: string; opponentId: string; status: MatchStatus;
  proposals: TimeProposal[]; scheduledAt?: string; venue?: string;
  result?: MatchResult;
  createdAt: string; updatedAt: string;
}

export interface NearMiss {
  dayOfWeek: number; date: string;
  slotA: { startTime: string; endTime: string };
  slotB: { startTime: string; endTime: string };
  overlapMinutes: number; gapMinutes: number; flexNeeded: number;
  suggestion: string; flexedWindow: { startTime: string; endTime: string };
}

export interface SchedulingResult {
  scheduledCount: number; failedCount: number; failedMatchIds: string[];
  nearMissCount: number; nearMissMatchIds: string[];
}

export interface Tournament {
  id: string; month: string; name: string; county: string; band: SkillBand;
  status: TournamentStatus; playerIds: string[];
  minPlayers: number; maxPlayers: number;
  rounds: TournamentRound[]; standings: StandingEntry[];
  pendingResults: Record<string, ResultReport>;
  registrationOpenedAt: string;
  finalsMatches?: { champMatchId?: string; thirdMatchId?: string };
  schedulingResult?: SchedulingResult;
  createdAt: string;
  city?: string; level?: string;
}

export interface TournamentMatch {
  id: string; tournamentId: string;
  homePlayerId: string; awayPlayerId: string;
  round: number; status: string;
  proposals?: TimeProposal[];
  scheduledAt?: string;
  schedulingTier?: 1 | 2 | 3;
  nearMiss?: NearMiss;
  result?: MatchResult;
  pendingResult?: ResultReport;
}

export interface PoolStatus {
  inPool: boolean; count: number; needed: number;
  band: SkillBand; county: string;
  tournamentId: string | null; daysRemaining: number;
  totalCountyInterest: number;
  bandBreakdown: Array<{ band: string; poolCount: number; tournamentCount: number }>;
}

export interface CitySearchResult {
  city: string; state: string; stateCode: string; county: string;
}

export interface SchedulingOption {
  datetime: string; label: string;
}

export interface SchedulingInfo {
  tier: 1 | 2 | 3;
  overlaps: SchedulingOption[];
  nearMisses: NearMiss[];
  mySlots: AvailabilitySlot[];
  opponentSlots: AvailabilitySlot[];
  opponentName: string;
}

export interface AvailabilityImpactSuggestion {
  slot: { dayOfWeek: number; startTime: string; endTime: string; label: string };
  matchesUnlocked: number;
  opponentNames: string[];
}

// Action item types for the home screen
export type ActionType = "confirm-score" | "flex-schedule" | "propose-times" | "pick-time" | "enter-score";

export interface ActionItem {
  type: ActionType;
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  opponentName: string;
  opponentId: string;
  round: number;
  nearMiss?: NearMiss;
  proposals?: TimeProposal[];
}

// Bottom sheet content types
export type SheetContent =
  | { type: "score-entry"; match: TournamentMatch; tournament: Tournament }
  | { type: "confirm-score"; match: TournamentMatch; tournament: Tournament }
  | { type: "scheduling"; match: TournamentMatch; schedulingInfo: SchedulingInfo }
  | { type: "flex"; match: TournamentMatch; nearMiss: NearMiss }
  | { type: "propose"; match: TournamentMatch; mySlots: AvailabilitySlot[] };
