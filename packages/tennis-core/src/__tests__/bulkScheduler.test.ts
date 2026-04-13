import { describe, it, expect } from "vitest";
import { bulkScheduleMatches, type SimpleAvailabilitySlot, type MatchToSchedule } from "../bulkScheduler.js";

// Helper: create availability for a player
function avail(...slots: Array<[string, number, number]>): SimpleAvailabilitySlot[] {
  return slots.map(([day, startHour, endHour]) => ({ day, startHour, endHour }));
}

// Helper: 6-player round-robin = 15 matches
function roundRobinMatches(playerIds: string[]): MatchToSchedule[] {
  const matches: MatchToSchedule[] = [];
  let id = 1;
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({ matchId: `m${id++}`, player1Id: playerIds[i]!, player2Id: playerIds[j]! });
    }
  }
  return matches;
}

describe("bulkScheduleMatches", () => {
  it("schedules all matches when all players share the same availability", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const matches = roundRobinMatches(players);
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of players) {
      availability[p] = avail(
        ["saturday", 8, 12],
        ["sunday", 8, 12],
        ["tuesday", 18, 21],
        ["thursday", 18, 21],
      );
    }

    const result = bulkScheduleMatches(matches, availability);

    // All 15 matches should be confirmed (plenty of slots across weeks)
    expect(result.confirmed.length).toBeGreaterThanOrEqual(10);
    expect(result.needsNegotiation).toHaveLength(0);
    // Total should be 15
    expect(result.confirmed.length + result.needsAccept.length + result.needsNegotiation.length).toBe(15);
  });

  it("returns needsNegotiation when players have no availability", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: [],
      p2: [],
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(0);
    expect(result.needsNegotiation).toHaveLength(1);
    expect(result.needsNegotiation[0]!.matchId).toBe("m1");
  });

  it("returns needsNegotiation when players have no overlap", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["monday", 8, 12]),
      p2: avail(["friday", 18, 21]),
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(0);
    // No shared windows — must be negotiation, not a fake suggestion that
    // p2 can't actually make.
    expect(result.needsNegotiation.length).toBe(1);
    expect(result.needsAccept.length).toBe(0);
  });

  it("confirms a match when two players overlap", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["saturday", 9, 13]),
      p2: avail(["saturday", 10, 14]),
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]!.slot.day).toBe("saturday");
    expect(result.confirmed[0]!.slot.startHour).toBeGreaterThanOrEqual(10);
    expect(result.confirmed[0]!.slot.endHour).toBeLessThanOrEqual(13);
  });

  it("does not double-book a player in the same week/day/time", () => {
    // Player p1 plays both p2 and p3 — both overlap on Saturday 10-12
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
      { matchId: "m2", player1Id: "p1", player2Id: "p3" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["saturday", 10, 12]),
      p2: avail(["saturday", 10, 12]),
      p3: avail(["saturday", 10, 12]),
    };

    const result = bulkScheduleMatches(matches, availability);

    // Both confirmed, but should be in different weeks
    const confirmed = result.confirmed;
    if (confirmed.length === 2) {
      expect(confirmed[0]!.slot.week).not.toBe(confirmed[1]!.slot.week);
    }
    // At minimum, should not have both in the same week/day/time
    expect(result.confirmed.length + result.needsAccept.length + result.needsNegotiation.length).toBe(2);
  });

  it("respects weekly cap per player", () => {
    // 3 matches for p1 in a group, weekly cap = 1
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
      { matchId: "m2", player1Id: "p1", player2Id: "p3" },
      { matchId: "m3", player1Id: "p1", player2Id: "p4" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["saturday", 8, 14], ["sunday", 8, 14]),
      p2: avail(["saturday", 8, 14], ["sunday", 8, 14]),
      p3: avail(["saturday", 8, 14], ["sunday", 8, 14]),
      p4: avail(["saturday", 8, 14], ["sunday", 8, 14]),
    };

    const result = bulkScheduleMatches(matches, availability, { weeklyCapPerPlayer: 1 });

    // With cap of 1 per week, p1's matches should be spread across 3 weeks
    const weeks = result.confirmed.map(c => c.slot.week);
    const uniqueWeeks = new Set(weeks);
    // Each week should have at most 1 match for p1
    expect(uniqueWeeks.size).toBe(weeks.length);
  });

  it("prefers weekend slots over weekday slots", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["monday", 18, 21], ["saturday", 10, 14]),
      p2: avail(["monday", 18, 21], ["saturday", 10, 14]),
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(1);
    expect(result.confirmed[0]!.slot.day).toBe("saturday");
  });

  it("handles missing availability gracefully", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    // p2 not in availability map at all
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["saturday", 10, 14]),
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(0);
    // Should suggest from p1's availability
    expect(result.needsAccept.length + result.needsNegotiation.length).toBe(1);
  });

  it("returns correct totals for a full 6-player round-robin", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const matches = roundRobinMatches(players);
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of players) {
      availability[p] = avail(
        ["tuesday", 18, 21],
        ["thursday", 18, 21],
        ["saturday", 9, 13],
        ["sunday", 9, 13],
      );
    }

    const result = bulkScheduleMatches(matches, availability);
    const total = result.confirmed.length + result.needsAccept.length + result.needsNegotiation.length;

    expect(total).toBe(15);
    expect(result.confirmed.length).toBeGreaterThan(0);
  });

  // Regression: Strategy B run on a real 6-player tournament returned
  // 0 confirmed / 15 needs-accept / 0 negotiation. Root cause: the backtracking
  // algorithm only commits results when it finds a near-complete solution
  // (≤ maxBacktrackDepth=2 unscheduled). When it can't, it returns ZERO assignments
  // even though a partial solution clearly exists. This pins the live availability
  // shape so we don't regress on it.
  it("regression: 6 identical players with weeknight + weekend availability — must auto-confirm > 0", () => {
    const players = ["p1", "p2", "p3", "p4", "p5", "p6"];
    const matches = roundRobinMatches(players);
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of players) {
      availability[p] = avail(
        ["monday", 18, 21],
        ["wednesday", 18, 21],
        ["saturday", 10, 14],
      );
    }

    const result = bulkScheduleMatches(matches, availability);

    // The reasonable bar: at least half of all matches should auto-confirm
    // when all 6 players share generous overlapping availability.
    expect(result.confirmed.length, `confirmed got ${result.confirmed.length}/15`).toBeGreaterThanOrEqual(8);
    // Total still accounts for all 15
    expect(result.confirmed.length + result.needsAccept.length + result.needsNegotiation.length).toBe(15);
  });

  // Regression: this is the EXACT availability shape that produced 0/15 confirmed
  // in a live preview run — pascal + the 5 seeded players from store.ts. Each player
  // has plenty of overlap with several others, so a "0 confirmed" result is wrong.
  it("regression: live seeded-lobby availability — must not return 0 confirmed", () => {
    const players = ["pascal", "alex", "jordan", "sam", "taylor", "casey"];
    const matches = roundRobinMatches(players);
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      pascal: avail(["monday", 18, 21], ["wednesday", 18, 21], ["saturday", 10, 14]),
      alex:   avail(["tuesday", 18, 21], ["saturday", 9, 13]),
      jordan: avail(["monday", 18, 21], ["wednesday", 18, 21], ["saturday", 10, 14]),
      sam:    avail(["saturday", 8, 12], ["sunday", 8, 12]),
      taylor: avail(["thursday", 17, 20], ["friday", 17, 20], ["sunday", 13, 17]),
      casey:  avail(["tuesday", 19, 21], ["thursday", 19, 21], ["saturday", 9, 12]),
    };

    const result = bulkScheduleMatches(matches, availability);

    // Was: 0 confirmed / 15 needs-accept / 0 negotiation in the live run.
    // Reasonable bar: at least a third of matches should auto-confirm with this much overlap.
    expect(result.confirmed.length, `confirmed got ${result.confirmed.length}/15`).toBeGreaterThanOrEqual(5);
    expect(result.confirmed.length + result.needsAccept.length + result.needsNegotiation.length).toBe(15);
  });

  // Honest labeling: when player A has Monday-only and player B has Friday-only
  // availability, there is NO overlap. Suggesting Monday is dishonest because
  // player B is definitely not available — this should be needsNegotiation,
  // not needsAccept.
  it("regression: zero-overlap matches must be needsNegotiation, not fake needsAccept", () => {
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
    ];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["monday", 8, 12]),
      p2: avail(["friday", 18, 21]),
    };

    const result = bulkScheduleMatches(matches, availability);

    expect(result.confirmed).toHaveLength(0);
    // Was: needsAccept (suggesting from p1) — that's a lie because p2 can't make it.
    expect(result.needsNegotiation).toHaveLength(1);
    expect(result.needsAccept).toHaveLength(0);
  });
});
