import { describe, it, expect } from "vitest";
import { computeStandings, deterministicTiebreak } from "../standings.js";
import type { Match } from "../types.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMatch(
  overrides: Partial<Match> & Pick<Match, "challengerId" | "opponentId">
): Match {
  return {
    id: crypto.randomUUID(),
    status: "completed",
    proposals: [],
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

const pA = "aaaa-aaaa-aaaa-aaaa";
const pB = "bbbb-bbbb-bbbb-bbbb";
const pC = "cccc-cccc-cccc-cccc";
const pD = "dddd-dddd-dddd-dddd";

// ─── No matches ───────────────────────────────────────────────────────────────

describe("computeStandings", () => {
  describe("with no matches", () => {
    it("returns all players with zeroed stats", () => {
      const standings = computeStandings([pA, pB, pC], []);
      expect(standings).toHaveLength(3);
      for (const entry of standings) {
        expect(entry.played).toBe(0);
        expect(entry.wins).toBe(0);
        expect(entry.losses).toBe(0);
        expect(entry.setsWon).toBe(0);
        expect(entry.setsLost).toBe(0);
        expect(entry.setDiff).toBe(0);
        expect(entry.gamesWon).toBe(0);
        expect(entry.gamesLost).toBe(0);
        expect(entry.gameDiff).toBe(0);
      }
    });

    it("initializes all head-to-head as pending", () => {
      const standings = computeStandings([pA, pB, pC], []);
      const entryA = standings.find((s) => s.playerId === pA)!;
      expect(entryA.headToHead[pB]).toBe("pending");
      expect(entryA.headToHead[pC]).toBe("pending");
    });
  });

  // ─── Win / loss tracking ──────────────────────────────────────────────────

  describe("win/loss tracking", () => {
    it("increments wins for the winner and losses for the loser", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      expect(entryA.played).toBe(1);
      expect(entryA.wins).toBe(1);
      expect(entryA.losses).toBe(0);

      expect(entryB.played).toBe(1);
      expect(entryB.wins).toBe(0);
      expect(entryB.losses).toBe(1);
    });

    it("tracks head-to-head as win/loss", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pB,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      expect(entryA.headToHead[pB]).toBe("loss");
      expect(entryB.headToHead[pA]).toBe("win");
    });

    it("ignores non-completed matches", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          status: "pending",
          result: {
            winnerId: pA,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      expect(entryA.played).toBe(0);
      expect(entryA.wins).toBe(0);
    });
  });

  // ─── Mutual no-show forfeit ───────────────────────────────────────────────

  describe("mutual no-show forfeit (winnerId = null)", () => {
    it("increments played but not wins or losses", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: null,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      expect(entryA.played).toBe(1);
      expect(entryA.wins).toBe(0);
      expect(entryA.losses).toBe(0);

      expect(entryB.played).toBe(1);
      expect(entryB.wins).toBe(0);
      expect(entryB.losses).toBe(0);
    });

    it("does not update head-to-head", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: null,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      expect(entryA.headToHead[pB]).toBe("pending");
    });
  });

  // ─── Set score tracking ─────────────────────────────────────────────────

  describe("set score tracking", () => {
    it("accumulates games won/lost for both players from sets", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 4 },
              { aGames: 6, bGames: 3 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      // A is challenger: aGames are A's games
      expect(entryA.gamesWon).toBe(12); // 6 + 6
      expect(entryA.gamesLost).toBe(7); // 4 + 3
      expect(entryA.gameDiff).toBe(5);

      expect(entryB.gamesWon).toBe(7); // 4 + 3
      expect(entryB.gamesLost).toBe(12); // 6 + 6
      expect(entryB.gameDiff).toBe(-5);
    });

    it("tracks sets won/lost correctly", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 4 },
              { aGames: 3, bGames: 6 },
              { aGames: 6, bGames: 2 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      expect(entryA.setsWon).toBe(2); // sets 1 and 3
      expect(entryA.setsLost).toBe(1); // set 2
      expect(entryA.setDiff).toBe(1);

      expect(entryB.setsWon).toBe(1); // set 2
      expect(entryB.setsLost).toBe(2); // sets 1 and 3
      expect(entryB.setDiff).toBe(-1);
    });

    it("does not count a set win for either player when games are equal", () => {
      // Edge case: aGames === bGames (e.g., incomplete set or edge data)
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 6 },
              { aGames: 6, bGames: 3 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;
      const entryB = standings.find((s) => s.playerId === pB)!;

      // The 6-6 set does not count as a set win for either
      expect(entryA.setsWon).toBe(1); // only set 2 (6-3)
      expect(entryA.setsLost).toBe(0);
      expect(entryB.setsWon).toBe(0);
      expect(entryB.setsLost).toBe(1);

      // But games still count
      expect(entryA.gamesWon).toBe(12); // 6 + 6
      expect(entryA.gamesLost).toBe(9); // 6 + 3
    });
  });

  // ─── Sort order / tiebreaks ─────────────────────────────────────────────

  describe("sort order", () => {
    it("sorts by wins descending (primary)", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pA,
          opponentId: pC,
          result: {
            winnerId: pA,
            reportedBy: pA,
            reportedAt: "2025-01-03T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pB,
          opponentId: pC,
          result: {
            winnerId: pB,
            reportedBy: pB,
            reportedAt: "2025-01-04T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB, pC], matches);
      expect(standings[0]!.playerId).toBe(pA); // 2 wins
      expect(standings[1]!.playerId).toBe(pB); // 1 win
      expect(standings[2]!.playerId).toBe(pC); // 0 wins
    });

    it("breaks tie using head-to-head", () => {
      // A beats C, B beats C, B beats A => all have mixed records
      // A: 1 win (vs C), 1 loss (vs B)
      // B: 2 wins (vs C, vs A)
      // C: 0 wins
      // But let's make A and B tied on wins, with B winning H2H
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pC,
          result: {
            winnerId: pA,
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pB,
          opponentId: pC,
          result: {
            winnerId: pC,
            reportedBy: pB,
            reportedAt: "2025-01-03T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pB,
            reportedBy: pA,
            reportedAt: "2025-01-04T00:00:00Z",
          },
        }),
      ];

      // A: 1 win (vs C), 1 loss (vs B)
      // B: 1 win (vs A), 1 loss (vs C)
      // C: 1 win (vs B), 1 loss (vs A)
      // All tied at 1 win. H2H: B beat A, so B > A; A beat C, so A > C; C beat B, so C > B.
      // With circular H2H, the 2-way comparisons should resolve pairwise:
      // B vs A: B wins (B ranks higher)
      // A vs C: A wins (A ranks higher)
      // B vs C: C wins (C ranks higher)
      // This creates a circular dependency, but sort is pairwise
      const standings = computeStandings([pA, pB, pC], matches);

      // B should rank above A (B beat A head-to-head)
      const posB = standings.findIndex((s) => s.playerId === pB);
      const posA = standings.findIndex((s) => s.playerId === pA);
      expect(posB).toBeLessThan(posA);
    });

    it("breaks tie using set difference when head-to-head is pending", () => {
      // A and B both have 1 win but never played each other
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pC,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 0 },
              { aGames: 6, bGames: 0 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pB,
          opponentId: pD,
          result: {
            winnerId: pB,
            sets: [
              { aGames: 6, bGames: 4 },
              { aGames: 7, bGames: 5 },
            ],
            reportedBy: pB,
            reportedAt: "2025-01-03T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB, pC, pD], matches);
      // A: setDiff = +2 (2 sets won, 0 lost); B: setDiff = +2 (2 sets won, 0 lost)
      // But A has gameDiff = +12, B has gameDiff = +4
      // Both set diffs are same (+2), so it falls to game diff
      // A: gamesWon=12, gamesLost=0, gameDiff=+12
      // B: gamesWon=13, gamesLost=9, gameDiff=+4
      const posA = standings.findIndex((s) => s.playerId === pA);
      const posB = standings.findIndex((s) => s.playerId === pB);
      expect(posA).toBeLessThan(posB); // A has better game diff
    });

    it("breaks tie using game difference when set difference is equal", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pC,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 0 },
              { aGames: 6, bGames: 1 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pB,
          opponentId: pD,
          result: {
            winnerId: pB,
            sets: [
              { aGames: 6, bGames: 4 },
              { aGames: 6, bGames: 4 },
            ],
            reportedBy: pB,
            reportedAt: "2025-01-03T00:00:00Z",
          },
        }),
      ];

      // Both A and B have setDiff = +2
      // A: gameDiff = 12-1 = +11
      // B: gameDiff = 12-8 = +4
      const standings = computeStandings([pA, pB, pC, pD], matches);
      const posA = standings.findIndex((s) => s.playerId === pA);
      const posB = standings.findIndex((s) => s.playerId === pB);
      expect(posA).toBeLessThan(posB);
    });

    it("uses deterministic tiebreak as final fallback", () => {
      // Two players with identical stats and no head-to-head
      const standings1 = computeStandings([pA, pB], [], "2025-01");
      const standings2 = computeStandings([pA, pB], [], "2025-01");

      // Must be stable/deterministic
      expect(standings1[0]!.playerId).toBe(standings2[0]!.playerId);
      expect(standings1[1]!.playerId).toBe(standings2[1]!.playerId);
    });
  });

  // ─── deterministicTiebreak ──────────────────────────────────────────────

  describe("deterministicTiebreak", () => {
    it("returns a non-zero value for different players", () => {
      const result = deterministicTiebreak(pA, pB, "2025-01");
      expect(result).not.toBe(0);
    });

    it("is deterministic (same inputs produce same output)", () => {
      const r1 = deterministicTiebreak(pA, pB, "2025-01");
      const r2 = deterministicTiebreak(pA, pB, "2025-01");
      expect(r1).toBe(r2);
    });

    it("is order-independent (sorted IDs ensure consistency)", () => {
      const r1 = deterministicTiebreak(pA, pB, "2025-01");
      const r2 = deterministicTiebreak(pB, pA, "2025-01");
      // r1 should be the negation of r2 (opposite sort direction)
      expect(r1).toBe(-r2);
    });

    it("changes with different month values", () => {
      const r1 = deterministicTiebreak(pA, pB, "2025-01");
      const r2 = deterministicTiebreak(pA, pB, "2025-02");
      expect(r1).not.toBe(r2);
    });
  });

  // ─── Multiple matches accumulation ──────────────────────────────────────

  describe("multiple matches accumulation", () => {
    it("accumulates stats across multiple matches", () => {
      const matches: Match[] = [
        makeMatch({
          challengerId: pA,
          opponentId: pB,
          result: {
            winnerId: pA,
            sets: [
              { aGames: 6, bGames: 4 },
              { aGames: 6, bGames: 3 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-02T00:00:00Z",
          },
        }),
        makeMatch({
          challengerId: pA,
          opponentId: pC,
          result: {
            winnerId: pC,
            sets: [
              { aGames: 3, bGames: 6 },
              { aGames: 4, bGames: 6 },
            ],
            reportedBy: pA,
            reportedAt: "2025-01-03T00:00:00Z",
          },
        }),
      ];

      const standings = computeStandings([pA, pB, pC], matches);
      const entryA = standings.find((s) => s.playerId === pA)!;

      expect(entryA.played).toBe(2);
      expect(entryA.wins).toBe(1);
      expect(entryA.losses).toBe(1);
      // Match 1: gamesWon 12, gamesLost 7; Match 2: gamesWon 7, gamesLost 12
      expect(entryA.gamesWon).toBe(19); // 6+6+3+4
      expect(entryA.gamesLost).toBe(19); // 4+3+6+6
      expect(entryA.gameDiff).toBe(0);
    });
  });
});
