export interface TierConfig {
  tier: 1 | 2 | 3;
  pushTitle: string;
  pushBody: string;
  /** Escalation window in minutes before SMS fires (Tier 1 only) */
  escalationMinutes?: number;
}

export const NOTIFICATION_TIERS: Record<string, TierConfig> = {
  // Tier 1: Push + SMS escalation
  "N-01": { tier: 1, pushTitle: "Tournament Started!", pushBody: "Your tournament is now active. Check your matches!", escalationMinutes: 30 },
  "N-30": { tier: 1, pushTitle: "Match Confirmed", pushBody: "Your match time is locked in.", escalationMinutes: 30 },
  "N-42": { tier: 1, pushTitle: "Score Submitted", pushBody: "Your opponent reported a score. Please confirm.", escalationMinutes: 30 },
  "N-13": { tier: 1, pushTitle: "Last Chance to Schedule", pushBody: "Auto-scheduling tomorrow if no action taken.", escalationMinutes: 30 },
  "N-26": { tier: 1, pushTitle: "Pick a Time Now", pushBody: "System picks tomorrow if you don't.", escalationMinutes: 30 },
  "N-61": { tier: 1, pushTitle: "Match Tomorrow", pushBody: "You have a match tomorrow. Don't forget!", escalationMinutes: 10 },

  // Tier 2: Push only
  "N-10": { tier: 2, pushTitle: "New Match Created", pushBody: "Can you flex a few minutes for this match?" },
  "N-20": { tier: 2, pushTitle: "Propose Match Times", pushBody: "Suggest 3 times for your opponent to pick from." },
  "N-24": { tier: 2, pushTitle: "Times Proposed", pushBody: "Your opponent proposed times. Pick one!" },
  "N-40": { tier: 2, pushTitle: "Submit Your Score", pushBody: "Your match was yesterday. How'd it go?" },
  "N-03": { tier: 2, pushTitle: "You Made the Finals!", pushBody: "Congrats! Check the bracket." },
  "N-11": { tier: 2, pushTitle: "Scheduling Reminder", pushBody: "Don't forget to confirm your match time." },
  "N-21": { tier: 2, pushTitle: "Propose Times Reminder", pushBody: "Still need to propose times for your match." },
  "N-25": { tier: 2, pushTitle: "Pick a Time Reminder", pushBody: "Pick a time before auto-scheduling kicks in." },
  "N-60": { tier: 2, pushTitle: "Lobby Forming!", pushBody: "Players in your county are joining. Tournament starts soon!" },
  "N-62": { tier: 2, pushTitle: "New Message", pushBody: "Your opponent sent you a message." },

  // Tier 3: In-app only (no push, no SMS)
  "N-04": { tier: 3, pushTitle: "", pushBody: "" },
  "N-14": { tier: 3, pushTitle: "", pushBody: "" },
  "N-23": { tier: 3, pushTitle: "", pushBody: "" },
  "N-27": { tier: 3, pushTitle: "", pushBody: "" },
  "N-44": { tier: 3, pushTitle: "", pushBody: "" },
  "N-50-responsive": { tier: 3, pushTitle: "", pushBody: "" },
  "N-50-forfeited": { tier: 3, pushTitle: "", pushBody: "" },
  "N-51": { tier: 3, pushTitle: "", pushBody: "" },
};

/** Get the tier for a notification type. Defaults to Tier 3 (in-app only) if unknown. */
export function getTier(type: string): TierConfig {
  return NOTIFICATION_TIERS[type] ?? { tier: 3, pushTitle: "", pushBody: "" };
}

/** Check if a notification type is Tier 1 (eligible for SMS escalation). */
export function isTier1(type: string): boolean {
  return getTier(type).tier === 1;
}

/** Check if a notification should be delivered via push (Tier 1 or 2). */
export function isPushDelivered(type: string): boolean {
  return getTier(type).tier <= 2;
}
