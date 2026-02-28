import { randomUUID } from "node:crypto";
import type { AvailabilitySlot, Match, NearMiss, SchedulingResult, TimeProposal } from "@rally/core";
import { findNearMisses, findOverlaps, formatProposalLabel } from "./scheduler.js";

/**
 * Auto-schedule all matches in a tournament by cross-referencing player availability.
 *
 * Algorithm (greedy, round-by-round):
 * 1. For each match, find 2-hour overlap windows in the next 14 days
 * 2. Filter out dates already booked for either player (max 1 match/day)
 * 3. Pick the first available window, mark it as booked for both players
 * 4. Matches that can't be scheduled are left as "pending"
 */
export async function autoScheduleTournament(
  matches: Match[],
  playerAvailability: Map<string, AvailabilitySlot[]>,
  fromDate: Date
): Promise<{ result: SchedulingResult; updatedMatches: Match[] }> {
  // Track booked dates per player — at most 1 match per day
  const bookedDates = new Map<string, Set<string>>();

  const failedMatchIds: string[] = [];
  let scheduledCount = 0;
  const updatedMatches: Match[] = [];

  for (const match of matches) {
    const slotsA = playerAvailability.get(match.challengerId) ?? [];
    const slotsB = playerAvailability.get(match.opponentId) ?? [];

    const overlaps = findOverlaps(slotsA, slotsB, fromDate);

    // Filter out dates already booked for either player
    const playerABooked = bookedDates.get(match.challengerId) ?? new Set<string>();
    const playerBBooked = bookedDates.get(match.opponentId) ?? new Set<string>();

    const available = overlaps.filter((o) => {
      const dateStr = o.date.toISOString().slice(0, 10);
      return !playerABooked.has(dateStr) && !playerBBooked.has(dateStr);
    });

    if (available.length > 0) {
      const chosen = available[0]!;
      const dateStr = chosen.date.toISOString().slice(0, 10);

      // Book the date for both players
      if (!bookedDates.has(match.challengerId)) bookedDates.set(match.challengerId, new Set());
      if (!bookedDates.has(match.opponentId)) bookedDates.set(match.opponentId, new Set());
      bookedDates.get(match.challengerId)!.add(dateStr);
      bookedDates.get(match.opponentId)!.add(dateStr);

      // Build ISO datetime from date + startTime
      const [hh, mm] = chosen.startTime.split(":").map(Number);
      const scheduledDate = new Date(chosen.date);
      scheduledDate.setHours(hh ?? 0, mm ?? 0, 0, 0);

      const proposal: TimeProposal = {
        id: randomUUID(),
        datetime: scheduledDate.toISOString(),
        label: formatProposalLabel(chosen.date, chosen.startTime),
        acceptedBy: [match.challengerId, match.opponentId],
      };

      const updated: Match = {
        ...match,
        status: "scheduled",
        proposals: [proposal],
        scheduledAt: scheduledDate.toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updatedMatches.push(updated);
      scheduledCount++;
    } else {
      // Can't auto-schedule — leave as pending
      failedMatchIds.push(match.id);
      updatedMatches.push(match);
    }
  }

  // ── Second pass: tag failed matches with near-miss data ──
  const nearMissMatchIds: string[] = [];
  const finalMatches: Match[] = [];

  for (const match of updatedMatches) {
    if (match.status === "scheduled") {
      // Tier 1 — already auto-scheduled
      finalMatches.push({ ...match, schedulingTier: 1 });
      continue;
    }

    // Check for near-misses (Tier 2)
    const slotsA = playerAvailability.get(match.challengerId) ?? [];
    const slotsB = playerAvailability.get(match.opponentId) ?? [];
    const nearMisses = findNearMisses(slotsA, slotsB, fromDate);

    if (nearMisses.length > 0) {
      // Tier 2 — has a flex opportunity
      nearMissMatchIds.push(match.id);
      finalMatches.push({
        ...match,
        schedulingTier: 2,
        nearMiss: nearMisses[0]!, // best near-miss (least flex needed)
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Tier 3 — no overlap, no near-miss → propose & pick
      finalMatches.push({
        ...match,
        schedulingTier: 3,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  return {
    result: {
      scheduledCount,
      failedCount: failedMatchIds.length,
      failedMatchIds,
      nearMissCount: nearMissMatchIds.length,
      nearMissMatchIds,
    },
    updatedMatches: finalMatches,
  };
}
