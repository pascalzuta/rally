/**
 * Tournament Lifecycle Integration Tests
 *
 * Simulates a full 6-player round-robin tournament end-to-end using
 * the pure functions in tennis-core. Covers:
 *
 * 1. Availability persistence after registration
 * 2. Both players see the same scheduled time
 * 3. Max one match per day (restHours: 24 constraint)
 * 4. Score reporting visible to both players
 * 5. Ratings, win/loss stats, and standings update correctly
 * 6. Semifinals/finals scheduled from top-2 standings
 * 7. Weekly cap enforcement
 * 8. Edge cases: walkovers, upsets, tiebreaks
 */

import { describe, it, expect } from "vitest";
import {
  bulkScheduleMatches,
  type SimpleAvailabilitySlot,
  type MatchToSchedule,
  type SchedulingConstraints,
} from "../bulkScheduler.js";
import {
  clusterPlayersByAvailability,
  computeOverlapScore,
  type PlayerAvailability,
} from "../clustering.js";
import { generateRoundRobin } from "../roundRobin.js";
import { computeStandings } from "../standings.js";
import {
  computeRatingUpdate,
  computeEnhancedRatingUpdate,
  startingRating,
  marginMultiplier,
} from "../rating.js";
import type { Match, SetScore, StandingEntry } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avail(...slots: Array<[string, number, number]>): SimpleAvailabilitySlot[] {
  return slots.map(([day, startHour, endHour]) => ({ day, startHour, endHour }));
}

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

function makeMatch(
  overrides: Partial<Match> & Pick<Match, "challengerId" | "opponentId">
): Match {
  return {
    id: crypto.randomUUID(),
    status: "completed",
    proposals: [],
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };
}

const PLAYERS = ["alice", "bob", "carol", "dave", "eve", "frank"];

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AVAILABILITY PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe("1. Availability stays in the system after registration", () => {
  it("availability slots are preserved when passed to the scheduler", () => {
    // Simulate: player registers with availability, later it's used for scheduling
    const registeredAvailability: Record<string, SimpleAvailabilitySlot[]> = {
      alice: avail(["saturday", 9, 12], ["sunday", 10, 14]),
      bob: avail(["saturday", 10, 13], ["sunday", 10, 14]),
    };

    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "alice", player2Id: "bob" },
    ];

    const result = bulkScheduleMatches(matches, registeredAvailability);

    // The scheduler should find the overlap and schedule the match
    expect(result.confirmed.length + result.needsAccept.length).toBe(1);
    expect(result.needsNegotiation).toHaveLength(0);

    // The scheduled slot must fall within BOTH players' availability
    const scheduled = result.confirmed[0] ?? result.needsAccept[0];
    expect(scheduled).toBeDefined();
    const slot = scheduled!.slot;

    // Saturday overlap: 10-12, Sunday overlap: 10-14
    const aliceSlots = registeredAvailability["alice"]!;
    const bobSlots = registeredAvailability["bob"]!;

    const fitsAlice = aliceSlots.some(
      (s) => s.day === slot.day && slot.startHour >= s.startHour && slot.endHour <= s.endHour
    );
    const fitsBob = bobSlots.some(
      (s) => s.day === slot.day && slot.startHour >= s.startHour && slot.endHour <= s.endHour
    );
    expect(fitsAlice).toBe(true);
    expect(fitsBob).toBe(true);
  });

  it("players with no availability get needsNegotiation", () => {
    const result = bulkScheduleMatches(
      [{ matchId: "m1", player1Id: "alice", player2Id: "bob" }],
      { alice: [], bob: [] }
    );
    expect(result.needsNegotiation).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BOTH PLAYERS SEE THE SAME SCHEDULED TIME
// ═══════════════════════════════════════════════════════════════════════════════

describe("2. Both players see the same match time", () => {
  it("each match has exactly one scheduled slot shared by both players", () => {
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of PLAYERS) {
      availability[p] = avail(
        ["saturday", 9, 14],
        ["sunday", 9, 14],
        ["wednesday", 18, 21],
      );
    }

    const matches = roundRobinMatches(PLAYERS);
    const result = bulkScheduleMatches(matches, availability);

    // Every confirmed match has a single slot — not a different slot per player
    for (const entry of result.confirmed) {
      expect(entry.slot).toBeDefined();
      expect(entry.slot.day).toBeTruthy();
      expect(entry.slot.startHour).toBeDefined();
      expect(entry.slot.endHour).toBeDefined();
      // Slot duration should be exactly 2 hours (default matchDurationHours)
      expect(entry.slot.endHour - entry.slot.startHour).toBe(2);
    }

    // The matchId maps back to specific player pairs — each match produces ONE slot
    const slotByMatch = new Map<string, typeof result.confirmed[0]>();
    for (const entry of result.confirmed) {
      expect(slotByMatch.has(entry.matchId)).toBe(false); // no duplicates
      slotByMatch.set(entry.matchId, entry);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ONLY ONE MATCH PER DAY (restHours constraint)
// ═══════════════════════════════════════════════════════════════════════════════

describe("3. Max one match per day per player", () => {
  it("enforces restHours: 24 — no player plays twice on the same day+week", () => {
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of PLAYERS) {
      // Only available Saturday — forces scheduler to spread across weeks
      availability[p] = avail(["saturday", 8, 20]);
    }

    const matches = roundRobinMatches(PLAYERS); // 15 matches
    const result = bulkScheduleMatches(matches, availability);

    // Build a map: playerId → set of "week:day" strings they're scheduled
    const playerDays = new Map<string, Set<string>>();
    for (const p of PLAYERS) playerDays.set(p, new Set());

    const matchMap = new Map(matches.map((m) => [m.matchId, m]));

    for (const entry of result.confirmed) {
      const m = matchMap.get(entry.matchId)!;
      const key = `w${entry.slot.week}:${entry.slot.day}`;

      const p1Days = playerDays.get(m.player1Id)!;
      const p2Days = playerDays.get(m.player2Id)!;

      // Assert neither player already plays on this day in this week
      expect(p1Days.has(key)).toBe(false);
      expect(p2Days.has(key)).toBe(false);

      p1Days.add(key);
      p2Days.add(key);
    }

    // Verify matches are spread across multiple weeks (not all crammed into one)
    const weeksUsed = new Set(result.confirmed.map((e) => e.slot.week));
    expect(weeksUsed.size).toBeGreaterThan(1);
  });

  it("regression: two non-overlapping matches on same day still blocked", () => {
    // This is the exact bug we found — Sat 8-10 and Sat 14-16 for same player
    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
      { matchId: "m2", player1Id: "p1", player2Id: "p3" },
    ];

    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["saturday", 8, 20]),
      p2: avail(["saturday", 8, 20]),
      p3: avail(["saturday", 8, 20]),
    };

    // With only Saturday available and restHours=24, p1 can only play
    // once per Saturday. The second match must go to a different week.
    const result = bulkScheduleMatches(matches, availability);

    const totalScheduled = result.confirmed.length + result.needsAccept.length;
    expect(totalScheduled).toBe(2);

    // Find p1's two matches
    const matchMap = new Map(matches.map((m) => [m.matchId, m]));
    const p1Slots: Array<{ week: number; day: string }> = [];
    for (const entry of result.confirmed) {
      const m = matchMap.get(entry.matchId)!;
      if (m.player1Id === "p1" || m.player2Id === "p1") {
        p1Slots.push({ week: entry.slot.week, day: entry.slot.day });
      }
    }

    // p1's two matches must be on different weeks (can't both be same Saturday)
    if (p1Slots.length === 2) {
      const sameWeekAndDay =
        p1Slots[0]!.week === p1Slots[1]!.week &&
        p1Slots[0]!.day === p1Slots[1]!.day;
      expect(sameWeekAndDay).toBe(false);
    }
  });

  it("respects custom restHours constraint", () => {
    const availability: Record<string, SimpleAvailabilitySlot[]> = {
      p1: avail(["monday", 8, 20], ["tuesday", 8, 20]),
      p2: avail(["monday", 8, 20], ["tuesday", 8, 20]),
      p3: avail(["monday", 8, 20], ["tuesday", 8, 20]),
    };

    const matches: MatchToSchedule[] = [
      { matchId: "m1", player1Id: "p1", player2Id: "p2" },
      { matchId: "m2", player1Id: "p1", player2Id: "p3" },
    ];

    // With restHours=24, p1 can't play Mon AND Tue in the same week?
    // Actually restHours means 24h gap between matches for same player
    // Mon 8-10 and Tue 8-10 is 24h apart, so it should be okay
    const result = bulkScheduleMatches(matches, availability, { restHours: 24 });

    // Both matches should be schedulable since Mon→Tue is ≥24h
    const totalScheduled = result.confirmed.length + result.needsAccept.length;
    expect(totalScheduled).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. WEEKLY CAP ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════════════

describe("4. Weekly cap limits matches per player per week", () => {
  it("defaults to max 2 matches per week per player", () => {
    // Give 4 players availability only on one day to force same-week scheduling
    const players = ["p1", "p2", "p3", "p4"];
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of players) {
      // Available every day — but weekly cap should still limit
      availability[p] = avail(
        ["monday", 8, 20],
        ["tuesday", 8, 20],
        ["wednesday", 8, 20],
        ["thursday", 8, 20],
        ["friday", 8, 20],
        ["saturday", 8, 20],
        ["sunday", 8, 20],
      );
    }

    const matches = roundRobinMatches(players); // 6 matches for 4 players
    const result = bulkScheduleMatches(matches, availability);

    // Count matches per player per week
    const matchMap = new Map(matches.map((m) => [m.matchId, m]));
    const playerWeekCount = new Map<string, Map<number, number>>();

    for (const entry of result.confirmed) {
      const m = matchMap.get(entry.matchId)!;
      for (const pid of [m.player1Id, m.player2Id]) {
        if (!playerWeekCount.has(pid)) playerWeekCount.set(pid, new Map());
        const weekMap = playerWeekCount.get(pid)!;
        weekMap.set(entry.slot.week, (weekMap.get(entry.slot.week) ?? 0) + 1);
      }
    }

    // No player should exceed 2 matches in any single week
    for (const [playerId, weekMap] of playerWeekCount) {
      for (const [week, count] of weekMap) {
        expect(count).toBeLessThanOrEqual(2);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SCORE REPORTING & STANDINGS
// ═══════════════════════════════════════════════════════════════════════════════

describe("5. Score reporting updates standings for both players", () => {
  it("winner gets +1 win, loser gets +1 loss, games tracked correctly", () => {
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "bob",
        result: {
          winnerId: "alice",
          sets: [
            { aGames: 6, bGames: 3 },
            { aGames: 6, bGames: 4 },
          ],
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob"], matches);
    const alice = standings.find((s) => s.playerId === "alice")!;
    const bob = standings.find((s) => s.playerId === "bob")!;

    // Both see the same result
    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(0);
    expect(bob.wins).toBe(0);
    expect(bob.losses).toBe(1);

    // Game stats match the reported score
    expect(alice.gamesWon).toBe(12); // 6+6
    expect(alice.gamesLost).toBe(7); // 3+4
    expect(bob.gamesWon).toBe(7);
    expect(bob.gamesLost).toBe(12);

    // Head-to-head is symmetric
    expect(alice.headToHead["bob"]).toBe("win");
    expect(bob.headToHead["alice"]).toBe("loss");
  });

  it("edited score replaces the original in standings", () => {
    // First report: Alice wins 6-3, 6-4
    // Edit: Bob actually won 3-6, 6-4, 7-5
    const editedMatch = makeMatch({
      challengerId: "alice",
      opponentId: "bob",
      result: {
        winnerId: "bob",
        sets: [
          { aGames: 3, bGames: 6 },
          { aGames: 6, bGames: 4 },
          { aGames: 5, bGames: 7 },
        ],
        reportedBy: "alice",
        reportedAt: "2026-04-05T10:00:00Z",
        confirmedBy: "bob",
        confirmedAt: "2026-04-05T11:00:00Z",
      },
    });

    const standings = computeStandings(["alice", "bob"], [editedMatch]);
    const alice = standings.find((s) => s.playerId === "alice")!;
    const bob = standings.find((s) => s.playerId === "bob")!;

    // Now Bob is the winner
    expect(bob.wins).toBe(1);
    expect(alice.losses).toBe(1);
    expect(alice.headToHead["bob"]).toBe("loss");
    expect(bob.headToHead["alice"]).toBe("win");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. RATINGS PROPERLY AFFECTED BY SCORES
// ═══════════════════════════════════════════════════════════════════════════════

describe("6. Ratings update correctly after matches", () => {
  it("winner gains ELO, loser loses ELO, changes are symmetric", () => {
    const rating = startingRating(); // 1000
    const winnerUpdate = computeRatingUpdate(rating, rating, 0, true);
    const loserUpdate = computeRatingUpdate(rating, rating, 0, false);

    expect(winnerUpdate.delta).toBeGreaterThan(0);
    expect(loserUpdate.delta).toBeLessThan(0);
    // Symmetric for equal-rated new players
    expect(Math.abs(winnerUpdate.delta + loserUpdate.delta)).toBeLessThanOrEqual(1);
  });

  it("upset produces larger rating swing", () => {
    const favoriteWins = computeRatingUpdate(1200, 1000, 10, true);
    const underdogWins = computeRatingUpdate(1000, 1200, 10, true);

    expect(underdogWins.delta).toBeGreaterThan(favoriteWins.delta);
  });

  it("decisive victory gives larger delta via margin multiplier", () => {
    const closeSets: SetScore[] = [
      { aGames: 7, bGames: 5 },
      { aGames: 7, bGames: 5 },
    ];
    const blowoutSets: SetScore[] = [
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 1 },
    ];

    const closeUpdate = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true, closeSets);
    const blowoutUpdate = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true, blowoutSets);

    expect(blowoutUpdate.delta).toBeGreaterThanOrEqual(closeUpdate.delta);
  });

  it("new player K-factor is higher than established player", () => {
    const newPlayerWin = computeRatingUpdate(1000, 1000, 5, true);
    const estPlayerWin = computeRatingUpdate(1000, 1000, 25, true);

    // K=32 vs K=16
    expect(newPlayerWin.delta).toBeGreaterThan(estPlayerWin.delta);
  });

  it("rating never goes below 100", () => {
    const update = computeRatingUpdate(100, 2000, 0, false);
    expect(update.newRating).toBeGreaterThanOrEqual(100);
  });

  it("cumulative ratings track correctly over a 3-match series", () => {
    let aliceRating = startingRating();
    let bobRating = startingRating();

    // Match 1: Alice wins
    let au = computeRatingUpdate(aliceRating, bobRating, 0, true);
    let bu = computeRatingUpdate(bobRating, aliceRating, 0, false);
    aliceRating = au.newRating;
    bobRating = bu.newRating;
    expect(aliceRating).toBeGreaterThan(1000);
    expect(bobRating).toBeLessThan(1000);

    // Match 2: Bob wins (upset from lower rating)
    au = computeRatingUpdate(aliceRating, bobRating, 1, false);
    bu = computeRatingUpdate(bobRating, aliceRating, 1, true);
    aliceRating = au.newRating;
    bobRating = bu.newRating;

    // Bob's win should be worth MORE because he was lower rated
    expect(bu.delta).toBeGreaterThan(16); // More than the equal-rating baseline

    // Match 3: Alice wins again
    au = computeRatingUpdate(aliceRating, bobRating, 2, true);
    bu = computeRatingUpdate(bobRating, aliceRating, 2, false);
    aliceRating = au.newRating;
    bobRating = bu.newRating;

    // After 2 wins vs 1 loss, Alice should be above starting
    expect(aliceRating).toBeGreaterThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. STANDINGS DETERMINE CORRECT SEMIFINALS
// ═══════════════════════════════════════════════════════════════════════════════

describe("7. Top-2 from standings advance to semifinals", () => {
  it("complete round-robin produces correct standings order", () => {
    // 4-player round-robin: 6 matches total
    // Results: Alice beats everyone, Bob beats Carol & Dave, Carol beats Dave
    // Expected: Alice (3-0), Bob (2-1), Carol (1-2), Dave (0-3)
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "bob",
        result: {
          winnerId: "alice",
          sets: [{ aGames: 6, bGames: 3 }, { aGames: 6, bGames: 4 }],
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "alice",
        opponentId: "carol",
        result: {
          winnerId: "alice",
          sets: [{ aGames: 6, bGames: 2 }, { aGames: 6, bGames: 1 }],
          reportedBy: "alice",
          reportedAt: "2026-04-06T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "alice",
        opponentId: "dave",
        result: {
          winnerId: "alice",
          sets: [{ aGames: 6, bGames: 0 }, { aGames: 6, bGames: 2 }],
          reportedBy: "alice",
          reportedAt: "2026-04-07T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "bob",
        opponentId: "carol",
        result: {
          winnerId: "bob",
          sets: [{ aGames: 6, bGames: 4 }, { aGames: 6, bGames: 3 }],
          reportedBy: "bob",
          reportedAt: "2026-04-08T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "bob",
        opponentId: "dave",
        result: {
          winnerId: "bob",
          sets: [{ aGames: 6, bGames: 1 }, { aGames: 6, bGames: 2 }],
          reportedBy: "bob",
          reportedAt: "2026-04-09T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "carol",
        opponentId: "dave",
        result: {
          winnerId: "carol",
          sets: [{ aGames: 6, bGames: 4 }, { aGames: 7, bGames: 5 }],
          reportedBy: "carol",
          reportedAt: "2026-04-10T10:00:00Z",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob", "carol", "dave"], matches);

    expect(standings[0]!.playerId).toBe("alice"); // 3-0
    expect(standings[0]!.wins).toBe(3);
    expect(standings[1]!.playerId).toBe("bob"); // 2-1
    expect(standings[1]!.wins).toBe(2);
    expect(standings[2]!.playerId).toBe("carol"); // 1-2
    expect(standings[2]!.wins).toBe(1);
    expect(standings[3]!.playerId).toBe("dave"); // 0-3
    expect(standings[3]!.wins).toBe(0);

    // Top 2 would advance to semifinals
    const semifinalists = standings.slice(0, 2).map((s) => s.playerId);
    expect(semifinalists).toContain("alice");
    expect(semifinalists).toContain("bob");
  });

  it("head-to-head breaks ties correctly", () => {
    // Alice and Bob both 1-1, but Bob beat Alice h2h → Bob ranks higher
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "carol",
        result: {
          winnerId: "alice",
          sets: [{ aGames: 6, bGames: 3 }, { aGames: 6, bGames: 4 }],
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "bob",
        opponentId: "carol",
        result: {
          winnerId: "carol",
          sets: [{ aGames: 4, bGames: 6 }, { aGames: 3, bGames: 6 }],
          reportedBy: "bob",
          reportedAt: "2026-04-06T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "alice",
        opponentId: "bob",
        result: {
          winnerId: "bob",
          sets: [{ aGames: 4, bGames: 6 }, { aGames: 3, bGames: 6 }],
          reportedBy: "alice",
          reportedAt: "2026-04-07T10:00:00Z",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob", "carol"], matches);

    // Alice: 1W 1L, Bob: 1W 1L, Carol: 1W 1L — all tied on wins
    // Bob beat Alice h2h → Bob > Alice in pairwise comparison
    const posAlice = standings.findIndex((s) => s.playerId === "alice");
    const posBob = standings.findIndex((s) => s.playerId === "bob");
    expect(posBob).toBeLessThan(posAlice);
  });

  it("game difference breaks ties when h2h is pending", () => {
    // Alice and Bob both 1-0 but never played each other
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "carol",
        result: {
          winnerId: "alice",
          sets: [{ aGames: 6, bGames: 0 }, { aGames: 6, bGames: 0 }],
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
        },
      }),
      makeMatch({
        challengerId: "bob",
        opponentId: "dave",
        result: {
          winnerId: "bob",
          sets: [{ aGames: 7, bGames: 5 }, { aGames: 7, bGames: 5 }],
          reportedBy: "bob",
          reportedAt: "2026-04-06T10:00:00Z",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob", "carol", "dave"], matches);

    // Alice: gameDiff = +12, Bob: gameDiff = +4
    const posAlice = standings.findIndex((s) => s.playerId === "alice");
    const posBob = standings.findIndex((s) => s.playerId === "bob");
    expect(posAlice).toBeLessThan(posBob);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ROUND-ROBIN GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("8. Round-robin generates correct bracket structure", () => {
  it("6 players produce 15 unique matchups across 5 rounds", () => {
    const rounds = generateRoundRobin(6);

    expect(rounds).toHaveLength(5); // N-1 rounds for even N

    // Collect all matchups
    const matchups = new Set<string>();
    for (const round of rounds) {
      for (const pairing of round.pairings) {
        if (pairing.homeIndex === -1 || pairing.awayIndex === -1) continue;
        const key = [pairing.homeIndex, pairing.awayIndex].sort().join("-");
        matchups.add(key);
      }
    }

    expect(matchups.size).toBe(15); // C(6,2) = 15
  });

  it("4 players produce 6 unique matchups across 3 rounds", () => {
    const rounds = generateRoundRobin(4);
    expect(rounds).toHaveLength(3);

    const matchups = new Set<string>();
    for (const round of rounds) {
      for (const pairing of round.pairings) {
        if (pairing.homeIndex === -1 || pairing.awayIndex === -1) continue;
        const key = [pairing.homeIndex, pairing.awayIndex].sort().join("-");
        matchups.add(key);
      }
    }
    expect(matchups.size).toBe(6);
  });

  it("each player plays exactly once per round (no double-booking)", () => {
    const rounds = generateRoundRobin(6);

    for (const round of rounds) {
      const playersInRound = new Set<number>();
      for (const pairing of round.pairings) {
        if (pairing.homeIndex !== -1) {
          expect(playersInRound.has(pairing.homeIndex)).toBe(false);
          playersInRound.add(pairing.homeIndex);
        }
        if (pairing.awayIndex !== -1) {
          expect(playersInRound.has(pairing.awayIndex)).toBe(false);
          playersInRound.add(pairing.awayIndex);
        }
      }
    }
  });

  it("odd player count uses byes correctly", () => {
    const rounds = generateRoundRobin(5);
    expect(rounds).toHaveLength(5); // padded to 6, so 5 rounds

    // Each round should have exactly one bye (-1)
    for (const round of rounds) {
      const byeCount = round.pairings.filter(
        (p) => p.homeIndex === -1 || p.awayIndex === -1
      ).length;
      expect(byeCount).toBe(1);
    }
  });

  it("target weeks are distributed across 4 weeks", () => {
    const rounds = generateRoundRobin(6);
    const weeks = new Set(rounds.map((r) => r.targetWeek));

    // Should use weeks 1-4
    for (const w of weeks) {
      expect(w).toBeGreaterThanOrEqual(1);
      expect(w).toBeLessThanOrEqual(4);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. CLUSTERING — PLAYERS GROUPED BY AVAILABILITY OVERLAP
// ═══════════════════════════════════════════════════════════════════════════════

describe("9. Player clustering groups compatible players", () => {
  it("players with shared availability are grouped together", () => {
    const players: PlayerAvailability[] = [
      { playerId: "p1", playerName: "Alice", slots: avail(["saturday", 9, 14], ["sunday", 10, 14]) },
      { playerId: "p2", playerName: "Bob", slots: avail(["saturday", 10, 15], ["sunday", 10, 14]) },
      { playerId: "p3", playerName: "Carol", slots: avail(["saturday", 9, 13], ["sunday", 11, 15]) },
      { playerId: "p4", playerName: "Dave", slots: avail(["saturday", 10, 14], ["sunday", 10, 13]) },
    ];

    const result = clusterPlayersByAvailability(players, {
      minGroupSize: 4,
      maxGroupSize: 8,
    });

    // All 4 should be grouped together (they all share Saturday and Sunday overlap)
    expect(result.groups.length).toBeGreaterThanOrEqual(1);
    const totalGrouped = result.groups.reduce((sum, g) => sum + g.players.length, 0);
    expect(totalGrouped + result.waitlisted.length).toBe(4);
  });

  it("overlap score counts 2-hour match windows correctly", () => {
    // Both available Sat 10-14 → 2 possible 2hr windows (10-12, 12-14)
    const score = computeOverlapScore(
      avail(["saturday", 10, 14]),
      avail(["saturday", 10, 14]),
      2
    );
    expect(score).toBeGreaterThanOrEqual(2);
  });

  it("no overlap produces score 0", () => {
    const score = computeOverlapScore(
      avail(["saturday", 8, 10]),
      avail(["sunday", 8, 10]),
    );
    expect(score).toBe(0);
  });

  it("waitlists players who don't fit any group", () => {
    const players: PlayerAvailability[] = [
      { playerId: "p1", playerName: "A", slots: avail(["saturday", 9, 14]) },
      { playerId: "p2", playerName: "B", slots: avail(["saturday", 9, 14]) },
      { playerId: "p3", playerName: "C", slots: avail(["saturday", 9, 14]) },
      { playerId: "p4", playerName: "D", slots: avail(["saturday", 9, 14]) },
      // Eve only available weekday evenings — poor overlap with weekend group
      { playerId: "p5", playerName: "E", slots: avail(["tuesday", 20, 22]) },
    ];

    const result = clusterPlayersByAvailability(players, {
      minGroupSize: 4,
      maxGroupSize: 8,
    });

    // Eve should be waitlisted or in a degraded group
    const eveInGroup = result.groups.some((g) =>
      g.players.some((p) => p.playerId === "p5")
    );
    const eveWaitlisted = result.waitlisted.some((p) => p.playerId === "p5");

    // Either Eve is waitlisted, or the quality is degraded
    expect(eveWaitlisted || result.quality === "degraded" || result.quality === "fallback").toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. WALKOVER / FORFEIT HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe("10. Walkover / forfeit edge cases", () => {
  it("forfeit with no winner increments played but not wins/losses", () => {
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "bob",
        result: {
          winnerId: null,
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
          forfeit: true,
          forfeitReason: "mutual no-show",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob"], matches);
    const alice = standings.find((s) => s.playerId === "alice")!;
    const bob = standings.find((s) => s.playerId === "bob")!;

    expect(alice.played).toBe(1);
    expect(alice.wins).toBe(0);
    expect(alice.losses).toBe(0);
    expect(bob.played).toBe(1);
    expect(bob.wins).toBe(0);
    expect(bob.losses).toBe(0);
  });

  it("walkover with a winner counts as a normal win/loss", () => {
    const matches: Match[] = [
      makeMatch({
        challengerId: "alice",
        opponentId: "bob",
        result: {
          winnerId: "alice",
          reportedBy: "alice",
          reportedAt: "2026-04-05T10:00:00Z",
          forfeit: true,
          forfeitReason: "bob no-show",
        },
      }),
    ];

    const standings = computeStandings(["alice", "bob"], matches);
    const alice = standings.find((s) => s.playerId === "alice")!;
    const bob = standings.find((s) => s.playerId === "bob")!;

    expect(alice.wins).toBe(1);
    expect(bob.losses).toBe(1);
    expect(alice.headToHead["bob"]).toBe("win");
  });

  it("walkover rating change is smaller due to no margin multiplier", () => {
    // A real win with blowout sets
    const realWin = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true, [
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 0 },
    ]);

    // Walkover — no sets, margin multiplier = 1.0
    const walkoverWin = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true);

    expect(realWin.delta).toBeGreaterThanOrEqual(walkoverWin.delta);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. FULL TOURNAMENT LIFECYCLE — END TO END
// ═══════════════════════════════════════════════════════════════════════════════

describe("11. Full tournament lifecycle: cluster → schedule → play → standings → semis", () => {
  it("runs a complete 6-player tournament", () => {
    // Step 1: Register 6 players with availability
    const players: PlayerAvailability[] = PLAYERS.map((name) => ({
      playerId: name,
      playerName: name,
      slots: avail(
        ["saturday", 9, 15],
        ["sunday", 9, 15],
        ["wednesday", 18, 21],
      ),
    }));

    // Step 2: Cluster players
    const cluster = clusterPlayersByAvailability(players, {
      minGroupSize: 4,
      maxGroupSize: 8,
    });

    expect(cluster.groups.length).toBeGreaterThanOrEqual(1);
    const group = cluster.groups[0]!;
    expect(group.players.length).toBeGreaterThanOrEqual(4);

    // Step 3: Generate round-robin bracket
    const rounds = generateRoundRobin(group.players.length);
    expect(rounds.length).toBeGreaterThan(0);

    // Step 4: Schedule matches
    const groupPlayerIds = group.players.map((p) => p.playerId);
    const matchesToSchedule = roundRobinMatches(groupPlayerIds);
    const availability: Record<string, SimpleAvailabilitySlot[]> = {};
    for (const p of group.players) {
      const orig = players.find((pl) => pl.playerId === p.playerId)!;
      availability[p.playerId] = orig.slots;
    }

    const scheduleResult = bulkScheduleMatches(matchesToSchedule, availability);

    // Most matches should be schedulable with good availability
    const totalScheduled = scheduleResult.confirmed.length + scheduleResult.needsAccept.length;
    expect(totalScheduled).toBeGreaterThan(0);

    // Step 5: Simulate playing all matches — build results
    // Alice dominates, Bob strong, Carol decent, rest lose more
    const completedMatches: Match[] = [];
    const playerList = groupPlayerIds;

    for (let i = 0; i < playerList.length; i++) {
      for (let j = i + 1; j < playerList.length; j++) {
        // Higher-indexed player usually loses (simple deterministic outcome)
        const winnerId = playerList[i]!;
        completedMatches.push(
          makeMatch({
            challengerId: playerList[i]!,
            opponentId: playerList[j]!,
            result: {
              winnerId,
              sets: [
                { aGames: 6, bGames: 3 },
                { aGames: 6, bGames: 4 },
              ],
              reportedBy: playerList[i]!,
              reportedAt: new Date().toISOString(),
              confirmedBy: playerList[j]!,
              confirmedAt: new Date().toISOString(),
            },
          })
        );
      }
    }

    // Step 6: Compute standings
    const standings = computeStandings(playerList, completedMatches);

    // First player should have most wins (beat everyone)
    expect(standings[0]!.playerId).toBe(playerList[0]);
    expect(standings[0]!.wins).toBe(playerList.length - 1);

    // Last player should have 0 wins
    expect(standings[standings.length - 1]!.wins).toBe(0);

    // Step 7: Top 2 advance to semis
    const top2 = standings.slice(0, 2).map((s) => s.playerId);
    expect(top2).toHaveLength(2);
    expect(top2[0]).toBe(playerList[0]); // Most wins
    expect(top2[1]).toBe(playerList[1]); // Second most wins

    // Step 8: Compute ratings after all matches
    const ratings: Record<string, number> = {};
    for (const p of playerList) ratings[p] = startingRating();

    for (const match of completedMatches) {
      const { challengerId, opponentId, result } = match;
      if (!result?.winnerId) continue;

      const cUpdate = computeRatingUpdate(
        ratings[challengerId]!,
        ratings[opponentId]!,
        0,
        result.winnerId === challengerId
      );
      const oUpdate = computeRatingUpdate(
        ratings[opponentId]!,
        ratings[challengerId]!,
        0,
        result.winnerId === opponentId
      );
      ratings[challengerId] = cUpdate.newRating;
      ratings[opponentId] = oUpdate.newRating;
    }

    // Player who won all matches should have highest rating
    const sortedByRating = Object.entries(ratings).sort((a, b) => b[1] - a[1]);
    expect(sortedByRating[0]![0]).toBe(playerList[0]);

    // Player who lost all matches should have lowest rating
    expect(sortedByRating[sortedByRating.length - 1]![0]).toBe(
      playerList[playerList.length - 1]
    );
  });
});
