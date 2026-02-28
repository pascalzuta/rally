import { randomUUID } from "node:crypto";
import type { AvailabilitySlot, NearMiss, TimeProposal } from "@rally/core";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface SchedulerConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** Format a date as "Sat 15 Feb · 10:00am" */
export function formatProposalLabel(date: Date, startTime: string): string {
  const day = SHORT_DAY[date.getDay()] ?? "";
  const month = MONTH_NAMES[date.getMonth()] ?? "";
  const [hh, mm] = startTime.split(":").map(Number);
  const h = hh ?? 0;
  const m = mm ?? 0;
  const suffix = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const timeLabel = `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
  return `${day} ${date.getDate()} ${month} · ${timeLabel}`;
}

/** Find dates in the next 14 days where both players share a slot */
export function findOverlaps(
  slotsA: AvailabilitySlot[],
  slotsB: AvailabilitySlot[],
  fromDate: Date
): Array<{ date: Date; startTime: string; endTime: string }> {
  const overlaps: Array<{ date: Date; startTime: string; endTime: string }> = [];

  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + i);
    const dow = candidate.getDay();

    const dayA = slotsA.filter((s) => s.dayOfWeek === dow);
    const dayB = slotsB.filter((s) => s.dayOfWeek === dow);

    for (const sa of dayA) {
      for (const sb of dayB) {
        // Find overlap window (both need to be free for 2 hours)
        const start = sa.startTime > sb.startTime ? sa.startTime : sb.startTime;
        const end = sa.endTime < sb.endTime ? sa.endTime : sb.endTime;

        // Check overlap is at least 2 hours
        const [sh, sm] = start.split(":").map(Number);
        const [eh, em] = end.split(":").map(Number);
        const startMins = (sh ?? 0) * 60 + (sm ?? 0);
        const endMins = (eh ?? 0) * 60 + (em ?? 0);

        if (endMins - startMins >= 75) {
          overlaps.push({ date: new Date(candidate), startTime: start, endTime: end });
        }
      }
    }
  }

  return overlaps;
}

/** Minimum match duration in minutes for auto-scheduling */
const MIN_MATCH_MINUTES = 75;

/**
 * Find near-miss scheduling windows: slots that almost overlap but need a small
 * time adjustment from one or both players to create a playable window.
 *
 * Detects:
 * - Short overlaps (1-74 min): e.g. "You overlap for 45 min on Saturdays"
 * - Adjacent slots (gap = 0): e.g. "You finish at 7pm, they start at 7pm"
 * - Small gaps (1-60 min): e.g. "30-min gap between your Thursday slots"
 */
export function findNearMisses(
  slotsA: AvailabilitySlot[],
  slotsB: AvailabilitySlot[],
  fromDate: Date
): NearMiss[] {
  const nearMisses: NearMiss[] = [];

  for (let i = 1; i <= 14; i++) {
    const candidate = new Date(fromDate);
    candidate.setDate(candidate.getDate() + i);
    const dow = candidate.getDay();

    const dayA = slotsA.filter((s) => s.dayOfWeek === dow);
    const dayB = slotsB.filter((s) => s.dayOfWeek === dow);

    for (const sa of dayA) {
      for (const sb of dayB) {
        const [saStartH, saStartM] = sa.startTime.split(":").map(Number);
        const [saEndH, saEndM] = sa.endTime.split(":").map(Number);
        const [sbStartH, sbStartM] = sb.startTime.split(":").map(Number);
        const [sbEndH, sbEndM] = sb.endTime.split(":").map(Number);

        const aStart = (saStartH ?? 0) * 60 + (saStartM ?? 0);
        const aEnd = (saEndH ?? 0) * 60 + (saEndM ?? 0);
        const bStart = (sbStartH ?? 0) * 60 + (sbStartM ?? 0);
        const bEnd = (sbEndH ?? 0) * 60 + (sbEndM ?? 0);

        // Calculate overlap
        const overlapStart = Math.max(aStart, bStart);
        const overlapEnd = Math.min(aEnd, bEnd);
        const overlapMinutes = Math.max(0, overlapEnd - overlapStart);

        // Already a full match (>= 75 min) — handled by findOverlaps
        if (overlapMinutes >= MIN_MATCH_MINUTES) continue;

        // Calculate gap (if no overlap)
        let gapMinutes = 0;
        if (overlapMinutes === 0) {
          // They don't overlap at all — check if they're close
          if (aEnd <= bStart) gapMinutes = bStart - aEnd;
          else if (bEnd <= aStart) gapMinutes = aStart - bEnd;
        }

        // Only report if gap is small enough to be worth flexing (≤ 60 min gap)
        // or there IS some overlap (just not enough)
        if (gapMinutes > 60 && overlapMinutes === 0) continue;

        // Compute the flex needed to reach MIN_MATCH_MINUTES
        const flexNeeded = MIN_MATCH_MINUTES - overlapMinutes + gapMinutes;

        // Skip if flex is too large (> 90 min = unreasonable)
        if (flexNeeded > 90) continue;

        // Compute the resulting window if flex is accepted
        // Strategy: split the flex evenly, or one player extends toward the other
        const combinedStart = Math.min(aStart, bStart);
        const combinedEnd = Math.max(aEnd, bEnd);
        const midpoint = Math.floor((Math.max(aStart, bStart) + Math.min(aEnd, bEnd)) / 2);
        const flexedStart = Math.max(combinedStart, midpoint - Math.floor(MIN_MATCH_MINUTES / 2));
        const flexedEnd = flexedStart + MIN_MATCH_MINUTES;

        // Build suggestion text
        let suggestion: string;
        if (overlapMinutes > 0) {
          suggestion = `You overlap for ${overlapMinutes} min — extend by ${flexNeeded} min for a full match`;
        } else if (gapMinutes === 0) {
          suggestion = `Your slots are back-to-back — shift ${flexNeeded} min to create a window`;
        } else {
          suggestion = `${gapMinutes}-min gap — shift ${flexNeeded} min to create a window`;
        }

        const toTimeStr = (mins: number) => {
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        };

        nearMisses.push({
          dayOfWeek: dow,
          date: candidate.toISOString(),
          slotA: { startTime: sa.startTime, endTime: sa.endTime },
          slotB: { startTime: sb.startTime, endTime: sb.endTime },
          overlapMinutes,
          gapMinutes,
          flexNeeded,
          suggestion,
          flexedWindow: {
            startTime: toTimeStr(flexedStart),
            endTime: toTimeStr(Math.min(flexedEnd, combinedEnd)),
          },
        });
      }
    }
  }

  // Sort by least flex needed (easiest adjustments first)
  nearMisses.sort((a, b) => a.flexNeeded - b.flexNeeded);

  return nearMisses;
}

function buildProposalsFromOverlaps(
  overlaps: Array<{ date: Date; startTime: string; endTime: string }>
): TimeProposal[] {
  return overlaps.slice(0, 3).map(({ date, startTime }) => {
    const [hh, mm] = startTime.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hh ?? 0, mm ?? 0, 0, 0);
    return {
      id: randomUUID(),
      datetime: d.toISOString(),
      label: formatProposalLabel(date, startTime),
      acceptedBy: []
    };
  });
}

function buildAvailabilitySummary(slots: AvailabilitySlot[]): string {
  if (!slots.length) return "no recurring availability set";
  return slots
    .map((s) => `${DAY_NAMES[s.dayOfWeek] ?? "?"} ${s.startTime}–${s.endTime}`)
    .join(", ");
}

interface OpenAIMessage {
  role: "system" | "user";
  content: string;
}

interface ScheduleRequest {
  playerAName: string;
  playerBName: string;
  city: string;
  slotsA: AvailabilitySlot[];
  slotsB: AvailabilitySlot[];
  fromDate: Date;
}

export async function generateMatchProposals(
  cfg: SchedulerConfig,
  req: ScheduleRequest
): Promise<TimeProposal[]> {
  // First compute overlaps (always needed as fallback or validation)
  const overlaps = findOverlaps(req.slotsA, req.slotsB, req.fromDate);

  if (!cfg.apiKey || overlaps.length === 0) {
    return buildProposalsFromOverlaps(overlaps);
  }

  // Use AI to pick the best 3 slots and format them conversationally
  const todayStr = req.fromDate.toISOString().slice(0, 10);
  const availA = buildAvailabilitySummary(req.slotsA);
  const availB = buildAvailabilitySummary(req.slotsB);
  const overlapLines = overlaps
    .slice(0, 6)
    .map(({ date, startTime }) => {
      const [hh, mm] = startTime.split(":").map(Number);
      const d = new Date(date);
      d.setHours(hh ?? 0, mm ?? 0, 0, 0);
      return d.toISOString().slice(0, 16);
    })
    .join(", ");

  const prompt = `You are scheduling a tennis match between ${req.playerAName} and ${req.playerBName} in ${req.city}.
Today is ${todayStr}. A match takes about 2 hours.

${req.playerAName} is available: ${availA}
${req.playerBName} is available: ${availB}

Available overlapping windows: ${overlapLines}

Pick the 3 best options (prefer weekends and morning slots). Return ONLY a JSON array with exactly 3 objects:
[{"datetime":"YYYY-MM-DDTHH:MM:00","label":"Short friendly label e.g. Sat 15 Feb · 10:00am"}]`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), cfg.timeoutMs);

  try {
    const messages: OpenAIMessage[] = [
      { role: "system", content: "You are a scheduling assistant. Respond only with valid JSON." },
      { role: "user", content: prompt }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: 400,
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) return buildProposalsFromOverlaps(overlaps);

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = payload.choices?.[0]?.message?.content ?? "";

    // Parse the JSON response
    const parsed = JSON.parse(raw) as unknown;
    const arr = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>)[Object.keys(parsed as object)[0] ?? ""] ?? [];

    if (!Array.isArray(arr)) return buildProposalsFromOverlaps(overlaps);

    const proposals: TimeProposal[] = arr.slice(0, 3).map((item: unknown) => {
      const obj = item as Record<string, string>;
      return {
        id: randomUUID(),
        datetime: obj["datetime"] ?? new Date().toISOString(),
        label: obj["label"] ?? "Time slot",
        acceptedBy: []
      };
    });

    return proposals.length > 0 ? proposals : buildProposalsFromOverlaps(overlaps);
  } catch {
    return buildProposalsFromOverlaps(overlaps);
  } finally {
    clearTimeout(timeout);
  }
}
