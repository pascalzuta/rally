// ─── Shared types from @rally/core ───────────────────────────────────────────
// Re-export domain types so the rest of the frontend can keep importing from
// "./types" without changing every file.

export type {
  SkillLevel,
  SkillBand,
  SubscriptionStatus,
  MatchStatus,
  TournamentStatus,
  Player,
  AvailabilitySlot,
  TimeProposal,
  SetScore,
  MatchResult,
  Match,
  ResultReport,
  StandingEntry,
  RoundRobinPairing,
  TournamentRound,
  NearMiss,
  SchedulingResult,
  Tournament,
} from "@rally/core";

// ─── Frontend-only types ─────────────────────────────────────────────────────
// These types are specific to the web-v2 UI and don't belong in the shared
// package.

import type {
  AvailabilitySlot,
  MatchResult,
  NearMiss,
  ResultReport,
  SkillBand,
  TimeProposal,
  Tournament,
} from "@rally/core";

export type AuthMode = "signin" | "signup";
export type Tab = "home" | "tourney" | "activity" | "profile";

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  homePlayerId: string;
  awayPlayerId: string;
  round: number;
  status: string;
  finalsType?: "championship" | "third-place";
  proposals?: TimeProposal[];
  scheduledAt?: string;
  schedulingTier?: 1 | 2 | 3;
  nearMiss?: NearMiss;
  result?: MatchResult;
  pendingResult?: ResultReport;
}

export interface PoolStatus {
  inPool: boolean;
  count: number;
  needed: number;
  band: SkillBand;
  county: string;
  tournamentId: string | null;
  daysRemaining: number;
  totalCountyInterest: number;
  bandBreakdown: Array<{ band: string; poolCount: number; tournamentCount: number }>;
}

export interface CitySearchResult {
  city: string;
  state: string;
  stateCode: string;
  county: string;
}

export interface SchedulingOption {
  datetime: string;
  label: string;
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
export type ActionType =
  | "confirm-score"
  | "flex-schedule"
  | "propose-times"
  | "pick-time"
  | "enter-score";

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
