import type { Player, SetScore, TournamentMatch } from "./types";

export function displayName(p: Player | null | undefined): string {
  if (!p) return "Unknown";
  if (p.name && p.name.trim()) return p.name;
  return p.email.split("@")[0] ?? "Player";
}

export function formatScore(sets: SetScore[]): string {
  return sets.map(s => {
    const base = `${s.aGames}-${s.bGames}`;
    if (s.tiebreak) return `${base}(${Math.min(s.tiebreak.aPoints, s.tiebreak.bPoints)})`;
    return base;
  }).join(", ");
}

export function buildScorePreview(sets: Array<{ a: string; b: string }>): string {
  return sets.filter(s => s.a || s.b).map(s => `${s.a || "0"}-${s.b || "0"}`).join(", ");
}

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

export function formatDayTime(dayOfWeek: number, startTime: string, endTime: string): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[dayOfWeek]} ${startTime}\u2013${endTime}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
}

export function tierLabel(tier?: 1 | 2 | 3): string {
  switch (tier) {
    case 1: return "Auto-scheduled";
    case 2: return "Flex needed";
    case 3: return "Needs scheduling";
    default: return "Pending";
  }
}

export function tierColor(tier?: 1 | 2 | 3): string {
  switch (tier) {
    case 1: return "var(--green)";
    case 2: return "var(--amber)";
    case 3: return "var(--red-primary)";
    default: return "var(--text-muted)";
  }
}

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

export function friendlyMatchStatus(match: { status: string; pendingResult?: unknown; result?: unknown }): string {
  if (match.pendingResult && !match.result) return "Awaiting Confirmation";
  return friendlyStatus(match.status);
}

export function shortTournamentName(name: string): string {
  // "Rally League – Marin County – 2026-02" → "Marin County"
  const parts = name.split(/\s*[–—-]\s*/);
  if (parts.length >= 3) return parts[1]?.trim() ?? name;
  return name;
}

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
