/**
 * Tournament Pace Rules — Configuration Constants
 *
 * Controls all deadline timing, notification cadence, and grace mechanisms.
 * See /pace-rules.md for the full framework design.
 */

export const PACE_RULES = {
  // ── Match deadlines (hours) ────────────────────────────────────────────────

  /** Days a match can sit in "pending" before auto-action */
  PENDING_DEADLINE_DAYS: 7,
  /** Days a match can sit in "scheduling" before auto-accept */
  SCHEDULING_DEADLINE_DAYS: 5,
  /** Days after scheduledAt before score is required */
  SCORE_DEADLINE_DAYS: 3,
  /** Hours for score confirmation (existing mechanism) */
  CONFIRMATION_DEADLINE_HOURS: 48,

  // ── Tournament deadlines (days from activation) ────────────────────────────

  /** Max days for round-robin phase */
  ROUND_ROBIN_DAYS: 18,
  /** Max days for finals phase */
  FINALS_DAYS: 5,
  /** Absolute backstop — tournament completes regardless */
  HARD_DEADLINE_DAYS: 32,

  // ── Notification timing (days from deadline start) ─────────────────────────

  /** Pending match reminders */
  PENDING_REMINDER_1_DAY: 3,
  PENDING_REMINDER_2_DAY: 5,
  PENDING_FINAL_WARNING_DAY: 6,

  /** Scheduling (proposal acceptance) reminders */
  SCHEDULING_REMINDER_1_DAY: 2,
  SCHEDULING_REMINDER_2_DAY: 4,

  /** Score submission reminders (days after match date) */
  SCORE_REMINDER_1_DAY: 1,
  SCORE_REMINDER_2_DAY: 2,

  /** Score confirmation reminder (hours) */
  CONFIRMATION_REMINDER_HOURS: 24,

  /** Round-robin "one week left" reminder (days into round-robin) */
  ROUND_ROBIN_WEEK_WARNING_DAY: 11,

  // ── Grace mechanisms ───────────────────────────────────────────────────────

  /** Max vacation hold per tournament */
  VACATION_HOLD_MAX_DAYS: 7,
  /** Extra deadline days for first-time players */
  FIRST_TOURNAMENT_GRACE_DAYS: 2,
  /** Days added by opponent-initiated extension */
  EXTENSION_DAYS: 3,
  /** Max extensions per match */
  MAX_EXTENSIONS_PER_MATCH: 1,

  // ── Notification batching ──────────────────────────────────────────────────

  /** Min hours between reminder emails to same player */
  BATCH_COOLDOWN_HOURS: 6,
  /** Don't send emails after this hour (local time) */
  QUIET_HOURS_START: 20,
  /** Resume sending at this hour */
  QUIET_HOURS_END: 9,
  /** Batch into summary if player has this many+ pending actions */
  BATCH_THRESHOLD: 3,

  // ── Cap to prevent gaming with far-future dates ────────────────────────────

  /** Max days from scheduling to score deadline (caps far-future dates) */
  SCORE_DEADLINE_CAP_DAYS: 14,

  // ── Forfeit scoring ────────────────────────────────────────────────────────

  /** Games awarded to winner in a W/O forfeit */
  FORFEIT_WINNER_GAMES: 6,
  /** Games for the forfeiting player */
  FORFEIT_LOSER_GAMES: 0,
} as const;

export type PaceRules = typeof PACE_RULES;

// ── Helper functions ─────────────────────────────────────────────────────────

import type { Match } from "@rally/core";

type PlayerAction = "proposed" | "accepted" | "flex-accepted" | "scored" | "confirmed";

/** Record that a player took an action on this match (for forfeit fault determination). */
export function recordPlayerActivity(match: Match, playerId: string, action: PlayerAction): void {
  if (!match.playerActivity) {
    match.playerActivity = {};
  }
  const entry = match.playerActivity[playerId];
  if (entry) {
    entry.lastActionAt = new Date().toISOString();
    if (!entry.actions.includes(action)) entry.actions.push(action);
  } else {
    match.playerActivity[playerId] = {
      lastActionAt: new Date().toISOString(),
      actions: [action],
    };
  }
}

/** Record a system auto-action on this match. */
export function addAutoAction(
  match: Match,
  action: NonNullable<Match["autoActions"]>[number]["action"],
  details?: string
): void {
  if (!match.autoActions) match.autoActions = [];
  const entry: NonNullable<Match["autoActions"]>[number] = {
    action,
    timestamp: new Date().toISOString(),
  };
  if (details !== undefined) entry.details = details;
  match.autoActions.push(entry);
}

/** Determine fault for forfeit: who was responsive vs silent? */
export function determineFault(match: Match): "challenger" | "opponent" | "mutual" {
  const activity = match.playerActivity ?? {};
  const challengerActive = !!activity[match.challengerId];
  const opponentActive = !!activity[match.opponentId];

  if (challengerActive && !opponentActive) return "opponent";
  if (!challengerActive && opponentActive) return "challenger";
  return "mutual";
}

/** Apply a single-player forfeit: responsive player wins W/O 6-0 6-0. */
export function applySingleForfeit(match: Match, responsivePlayerId: string): Match {
  const now = new Date().toISOString();
  const forfeitReason = "Opponent did not respond after multiple reminders";
  return {
    ...match,
    status: "completed",
    result: {
      winnerId: responsivePlayerId,
      sets: [
        { aGames: PACE_RULES.FORFEIT_WINNER_GAMES, bGames: PACE_RULES.FORFEIT_LOSER_GAMES },
        { aGames: PACE_RULES.FORFEIT_WINNER_GAMES, bGames: PACE_RULES.FORFEIT_LOSER_GAMES },
      ],
      reportedBy: "system",
      reportedAt: now,
      confirmedBy: "auto-forfeit",
      confirmedAt: now,
      forfeit: true,
      forfeitReason,
    },
    updatedAt: now,
  };
}

/** Apply a mutual no-show forfeit: neither player responded. */
export function applyMutualForfeit(match: Match): Match {
  const now = new Date().toISOString();
  return {
    ...match,
    status: "completed",
    result: {
      winnerId: null,
      sets: [],
      reportedBy: "system",
      reportedAt: now,
      confirmedBy: "auto-forfeit",
      confirmedAt: now,
      forfeit: true,
      forfeitReason: "Neither player responded",
    },
    updatedAt: now,
  };
}

/** Calculate days elapsed since an ISO date string. */
export function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

/** Add days to a Date and return an ISO string. */
export function addDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
