import { describe, it, expect } from "vitest";
import { generateRoundRobin } from "../roundRobin.js";

// ─── Basic validation ─────────────────────────────────────────────────────────

describe("generateRoundRobin", () => {
  describe("input validation", () => {
    it("throws for playerCount < 4", () => {
      expect(() => generateRoundRobin(3)).toThrow("playerCount must be 4-8");
    });

    it("throws for playerCount > 8", () => {
      expect(() => generateRoundRobin(9)).toThrow("playerCount must be 4-8");
    });

    it("does not throw for playerCount 4-8", () => {
      for (let n = 4; n <= 8; n++) {
        expect(() => generateRoundRobin(n)).not.toThrow();
      }
    });
  });

  // ─── Round count ──────────────────────────────────────────────────────────

  describe("round count", () => {
    it("generates n-1 rounds for even player counts", () => {
      // 4 players -> 3 rounds
      expect(generateRoundRobin(4)).toHaveLength(3);
      // 6 players -> 5 rounds
      expect(generateRoundRobin(6)).toHaveLength(5);
      // 8 players -> 7 rounds
      expect(generateRoundRobin(8)).toHaveLength(7);
    });

    it("generates n rounds for odd player counts (padded to even)", () => {
      // 5 players -> padded to 6 -> 5 rounds
      expect(generateRoundRobin(5)).toHaveLength(5);
      // 7 players -> padded to 8 -> 7 rounds
      expect(generateRoundRobin(7)).toHaveLength(7);
    });
  });

  // ─── Every player plays every other player exactly once ────────────────

  describe("complete pairings", () => {
    function assertEveryPairExactlyOnce(playerCount: number) {
      const rounds = generateRoundRobin(playerCount);

      // Collect all pairings as sorted [a, b] tuples, ignoring byes (-1)
      const pairings = new Map<string, number>();
      for (const round of rounds) {
        for (const pairing of round.pairings) {
          const { homeIndex, awayIndex } = pairing;
          if (homeIndex === -1 || awayIndex === -1) continue; // skip byes
          const key = [Math.min(homeIndex, awayIndex), Math.max(homeIndex, awayIndex)].join(",");
          pairings.set(key, (pairings.get(key) ?? 0) + 1);
        }
      }

      // Every pair of indices [0..playerCount-1] should appear exactly once
      for (let i = 0; i < playerCount; i++) {
        for (let j = i + 1; j < playerCount; j++) {
          const key = `${i},${j}`;
          expect(pairings.get(key), `pair (${i},${j}) should appear exactly once`).toBe(1);
        }
      }

      // Total unique pairings should be C(playerCount, 2)
      const expectedPairCount = (playerCount * (playerCount - 1)) / 2;
      expect(pairings.size).toBe(expectedPairCount);
    }

    it("with 4 players: every pair plays exactly once", () => {
      assertEveryPairExactlyOnce(4);
    });

    it("with 5 players: every pair plays exactly once", () => {
      assertEveryPairExactlyOnce(5);
    });

    it("with 6 players: every pair plays exactly once", () => {
      assertEveryPairExactlyOnce(6);
    });

    it("with 7 players: every pair plays exactly once", () => {
      assertEveryPairExactlyOnce(7);
    });

    it("with 8 players: every pair plays exactly once", () => {
      assertEveryPairExactlyOnce(8);
    });
  });

  // ─── Bye handling for odd player counts ────────────────────────────────

  describe("bye handling (odd player counts)", () => {
    it("each round with odd players has exactly one bye pairing", () => {
      const rounds = generateRoundRobin(5);
      for (const round of rounds) {
        const byes = round.pairings.filter(
          (p) => p.homeIndex === -1 || p.awayIndex === -1
        );
        expect(byes).toHaveLength(1);
      }
    });

    it("each player gets a bye at least once with odd counts", () => {
      const playerCount = 5;
      const rounds = generateRoundRobin(playerCount);
      const byePlayers = new Set<number>();

      for (const round of rounds) {
        for (const pairing of round.pairings) {
          if (pairing.homeIndex === -1) byePlayers.add(pairing.awayIndex);
          if (pairing.awayIndex === -1) byePlayers.add(pairing.homeIndex);
        }
      }

      // Every player should have a bye at least once
      for (let i = 0; i < playerCount; i++) {
        expect(byePlayers.has(i), `player ${i} should have a bye`).toBe(true);
      }
    });

    it("no byes exist for even player counts", () => {
      const rounds = generateRoundRobin(6);
      for (const round of rounds) {
        const byes = round.pairings.filter(
          (p) => p.homeIndex === -1 || p.awayIndex === -1
        );
        expect(byes).toHaveLength(0);
      }
    });
  });

  // ─── Round structure ──────────────────────────────────────────────────────

  describe("round structure", () => {
    it("round numbers are sequential starting from 1", () => {
      const rounds = generateRoundRobin(6);
      rounds.forEach((round, index) => {
        expect(round.roundNumber).toBe(index + 1);
      });
    });

    it("pairings have matchId: null", () => {
      const rounds = generateRoundRobin(4);
      for (const round of rounds) {
        for (const pairing of round.pairings) {
          expect(pairing.matchId).toBeNull();
        }
      }
    });

    it("each round has the expected number of pairings", () => {
      // Even: n/2 pairings per round
      const rounds4 = generateRoundRobin(4);
      for (const round of rounds4) {
        expect(round.pairings).toHaveLength(2); // 4/2
      }

      const rounds6 = generateRoundRobin(6);
      for (const round of rounds6) {
        expect(round.pairings).toHaveLength(3); // 6/2
      }

      // Odd: (n+1)/2 pairings per round (includes bye)
      const rounds5 = generateRoundRobin(5);
      for (const round of rounds5) {
        expect(round.pairings).toHaveLength(3); // (5+1)/2
      }
    });
  });

  // ─── Target weeks ─────────────────────────────────────────────────────────

  describe("target week assignment", () => {
    it("assigns target weeks between 1 and 4", () => {
      for (let n = 4; n <= 8; n++) {
        const rounds = generateRoundRobin(n);
        for (const round of rounds) {
          expect(round.targetWeek).toBeGreaterThanOrEqual(1);
          expect(round.targetWeek).toBeLessThanOrEqual(4);
        }
      }
    });

    it("target weeks are non-decreasing (spread evenly)", () => {
      for (let n = 4; n <= 8; n++) {
        const rounds = generateRoundRobin(n);
        for (let i = 1; i < rounds.length; i++) {
          expect(rounds[i]!.targetWeek).toBeGreaterThanOrEqual(rounds[i - 1]!.targetWeek);
        }
      }
    });

    it("uses all 4 weeks for 4+ rounds", () => {
      // With 5+ rounds (e.g. 6 players = 5 rounds), all 4 weeks should be used
      const rounds = generateRoundRobin(6);
      const weeks = new Set(rounds.map((r) => r.targetWeek));
      expect(weeks.size).toBe(4);
    });
  });

  // ─── Player appears once per round ────────────────────────────────────

  describe("player scheduling", () => {
    it("each player appears at most once per round (no double-booking)", () => {
      for (let n = 4; n <= 8; n++) {
        const rounds = generateRoundRobin(n);
        for (const round of rounds) {
          const seen = new Set<number>();
          for (const pairing of round.pairings) {
            if (pairing.homeIndex !== -1) {
              expect(seen.has(pairing.homeIndex), `player ${pairing.homeIndex} double-booked in round ${round.roundNumber} (n=${n})`).toBe(false);
              seen.add(pairing.homeIndex);
            }
            if (pairing.awayIndex !== -1) {
              expect(seen.has(pairing.awayIndex), `player ${pairing.awayIndex} double-booked in round ${round.roundNumber} (n=${n})`).toBe(false);
              seen.add(pairing.awayIndex);
            }
          }
        }
      }
    });
  });
});
