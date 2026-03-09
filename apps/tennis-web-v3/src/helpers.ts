import type { Player, SetScore, TournamentMatch } from "./types";

/**
 * Get a display-friendly name for a player.
 * Falls back to the email prefix if no name is set, or "Unknown" if player is null.
 * @param p - The player object, or null/undefined
 * @returns A human-readable display name
 */
export function displayName(p: Player | null | undefined): string {
  if (!p) return "Unknown";
  if (p.name && p.name.trim()) return p.name;
  return p.email.split("@")[0] ?? "Player";
}

/**
 * Format structured set scores into a readable string (e.g. "6-4, 7-6(5)").
 * @param sets - Array of set scores with optional tiebreak details
 * @returns Formatted score string
 */
export function formatScore(sets: SetScore[]): string {
  return sets.map(s => {
    const base = `${s.aGames}-${s.bGames}`;
    if (s.tiebreak) return `${base}(${Math.min(s.tiebreak.aPoints, s.tiebreak.bPoints)})`;
    return base;
  }).join(", ");
}

/**
 * Build a live score preview string from partially entered set inputs.
 * @param sets - Array of string pairs representing games entered by each player
 * @returns Preview string like "6-4, 3-0"
 */
export function buildScorePreview(sets: Array<{ a: string; b: string }>): string {
  return sets.filter(s => s.a || s.b).map(s => `${s.a || "0"}-${s.b || "0"}`).join(", ");
}

/**
 * Format an ISO datetime string into a friendly label (e.g. "Sat 15 Feb - 10:00am").
 * @param iso - ISO 8601 datetime string
 * @returns Human-readable date/time string
 */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} \u00B7 ${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

/**
 * Format a recurring availability slot as "Mon 09:00-12:00".
 * @param dayOfWeek - Day of week (0=Sun, 6=Sat)
 * @param startTime - Start time in HH:MM format
 * @param endTime - End time in HH:MM format
 */
export function formatDayTime(dayOfWeek: number, startTime: string, endTime: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[dayOfWeek]} ${startTime}\u2013${endTime}`;
}

/**
 * Convert a number to its ordinal string (e.g. 1 -> "1st", 2 -> "2nd").
 * @param n - The number to convert
 */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
}

/**
 * Get a human-readable label for a scheduling tier.
 * @param tier - 1=Auto-scheduled, 2=Flex needed, 3=Needs scheduling
 */
export function tierLabel(tier?: 1 | 2 | 3): string {
  switch (tier) {
    case 1: return "Auto-scheduled";
    case 2: return "Flex needed";
    case 3: return "Needs scheduling";
    default: return "Pending";
  }
}

/**
 * Get the CSS color variable for a scheduling tier indicator.
 * @param tier - 1=green, 2=amber, 3=red
 */
export function tierColor(tier?: 1 | 2 | 3): string {
  switch (tier) {
    case 1: return "var(--green)";
    case 2: return "var(--amber)";
    case 3: return "var(--red-primary)";
    default: return "var(--text-muted)";
  }
}

/**
 * Convert a match status code to a user-friendly display string.
 * @param status - Internal status code (e.g. "pending", "scheduled", "completed")
 */
export function friendlyStatus(status: string): string {
  switch (status) {
    case "pending": return "Needs Scheduling";
    case "scheduling": return "Awaiting Response";
    case "scheduled": return "Scheduled";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return status;
  }
}

/**
 * Get user-friendly match status, accounting for pending result confirmations.
 * @param match - Object with status and optional pending/confirmed result
 */
export function friendlyMatchStatus(match: { status: string; pendingResult?: unknown; result?: unknown }): string {
  if (match.pendingResult && !match.result) return "Awaiting Confirmation";
  return friendlyStatus(match.status);
}

/**
 * Extract the short county name from a full tournament name.
 * E.g. "Rally League -- Marin County -- 2026-02" -> "Marin County"
 * @param name - Full tournament name
 */
export function shortTournamentName(name: string): string {
  // "Rally League – Marin County – 2026-02" → "Marin County"
  const parts = name.split(/\s*[–—-]\s*/);
  if (parts.length >= 3) return parts[1]?.trim() ?? name;
  return name;
}

/**
 * Calculate a human-readable countdown string until a scheduled match.
 * @param scheduledAt - ISO datetime of the scheduled match, or undefined
 * @returns Countdown like "In 2d 5h", "In 3h 15m", "Now", or empty string
 */
export function matchCountdown(scheduledAt?: string): string {
  if (!scheduledAt) return "";
  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `In ${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `In ${hours}h ${mins}m`;
}
