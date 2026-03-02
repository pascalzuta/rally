import { describe, it, expect } from "vitest";
import {
  startingRating,
  expectedScore,
  kFactor,
  computeRatingUpdate,
  levelFromRating,
  marginMultiplier,
  kFactorWithConfidence,
  computeEnhancedRatingUpdate,
  ntrpToRating,
  ratingToNtrp,
  skillBandFromNtrp,
} from "../rating.js";

// ─── startingRating ───────────────────────────────────────────────────────────

describe("startingRating", () => {
  it("returns 1000", () => {
    expect(startingRating()).toBe(1000);
  });
});

// ─── expectedScore ────────────────────────────────────────────────────────────

describe("expectedScore", () => {
  it("returns 0.5 for equal ratings", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it("returns > 0.5 when player is higher rated", () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
  });

  it("returns < 0.5 when player is lower rated", () => {
    expect(expectedScore(800, 1000)).toBeLessThan(0.5);
  });

  it("returns close to 1 for a very large rating advantage", () => {
    expect(expectedScore(2000, 1000)).toBeGreaterThan(0.99);
  });

  it("returns close to 0 for a very large rating disadvantage", () => {
    expect(expectedScore(1000, 2000)).toBeLessThan(0.01);
  });

  it("expected scores of player and opponent sum to 1", () => {
    const pScore = expectedScore(1100, 900);
    const oScore = expectedScore(900, 1100);
    expect(pScore + oScore).toBeCloseTo(1);
  });
});

// ─── kFactor ──────────────────────────────────────────────────────────────────

describe("kFactor", () => {
  it("returns 32 for new players (< 20 games)", () => {
    expect(kFactor(0)).toBe(32);
    expect(kFactor(10)).toBe(32);
    expect(kFactor(19)).toBe(32);
  });

  it("returns 16 for established players (>= 20 games)", () => {
    expect(kFactor(20)).toBe(16);
    expect(kFactor(100)).toBe(16);
  });
});

// ─── computeRatingUpdate ──────────────────────────────────────────────────────

describe("computeRatingUpdate", () => {
  it("winner gains rating and loser loses rating", () => {
    const winnerUpdate = computeRatingUpdate(1000, 1000, 10, true);
    const loserUpdate = computeRatingUpdate(1000, 1000, 10, false);

    expect(winnerUpdate.delta).toBeGreaterThan(0);
    expect(loserUpdate.delta).toBeLessThan(0);
    expect(winnerUpdate.newRating).toBeGreaterThan(1000);
    expect(loserUpdate.newRating).toBeLessThan(1000);
  });

  it("produces a larger swing for an upset (lower rated beats higher rated)", () => {
    // Normal: higher rated beats lower rated
    const normalWin = computeRatingUpdate(1200, 1000, 10, true);
    // Upset: lower rated beats higher rated
    const upsetWin = computeRatingUpdate(1000, 1200, 10, true);

    expect(upsetWin.delta).toBeGreaterThan(normalWin.delta);
  });

  it("uses K=32 for new players", () => {
    const update = computeRatingUpdate(1000, 1000, 5, true);
    // With equal ratings, expected = 0.5, so delta = round(32 * 0.5) = 16
    expect(update.delta).toBe(16);
  });

  it("uses K=16 for established players", () => {
    const update = computeRatingUpdate(1000, 1000, 25, true);
    // With equal ratings, expected = 0.5, so delta = round(16 * 0.5) = 8
    expect(update.delta).toBe(8);
  });

  it("never returns newRating below 100", () => {
    // Very low rated player loses to much higher rated
    const update = computeRatingUpdate(100, 2000, 0, false);
    expect(update.newRating).toBeGreaterThanOrEqual(100);
  });

  it("delta for winner and loser sum to approximately zero for equal games played", () => {
    const winnerUpdate = computeRatingUpdate(1000, 1000, 10, true);
    const loserUpdate = computeRatingUpdate(1000, 1000, 10, false);
    // Due to rounding they might not be exactly opposite
    expect(Math.abs(winnerUpdate.delta + loserUpdate.delta)).toBeLessThanOrEqual(1);
  });
});

// ─── levelFromRating ──────────────────────────────────────────────────────────

describe("levelFromRating", () => {
  it("returns Beginner for rating < 1050", () => {
    expect(levelFromRating(900)).toBe("Beginner");
    expect(levelFromRating(1000)).toBe("Beginner");
    expect(levelFromRating(1049)).toBe("Beginner");
  });

  it("returns Intermediate for rating 1050 to 1199", () => {
    expect(levelFromRating(1050)).toBe("Intermediate");
    expect(levelFromRating(1100)).toBe("Intermediate");
    expect(levelFromRating(1199)).toBe("Intermediate");
  });

  it("returns Advanced for rating >= 1200", () => {
    expect(levelFromRating(1200)).toBe("Advanced");
    expect(levelFromRating(1500)).toBe("Advanced");
  });
});

// ─── marginMultiplier ─────────────────────────────────────────────────────────

describe("marginMultiplier", () => {
  it("returns >= 1.0", () => {
    const result = marginMultiplier([
      { aGames: 7, bGames: 6 },
      { aGames: 6, bGames: 7 },
      { aGames: 7, bGames: 6 },
    ]);
    expect(result).toBeGreaterThanOrEqual(1.0);
  });

  it("returns a higher multiplier for a more decisive victory", () => {
    const close = marginMultiplier([
      { aGames: 7, bGames: 5 },
      { aGames: 7, bGames: 5 },
    ]);
    const decisive = marginMultiplier([
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 0 },
    ]);
    expect(decisive).toBeGreaterThan(close);
  });

  it("is clamped to at most 1.5", () => {
    // Very large margin
    const result = marginMultiplier([
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 0 },
    ]);
    expect(result).toBeLessThanOrEqual(1.5);
  });

  it("returns exactly 1.0 + contributions for known inputs", () => {
    // 2 sets: A wins both 6-4. setsA=2, setsB=0. setDiff=2, gamesA=12, gamesB=8, gameDiff=4
    // multiplier = 1 + 0.05*2 + 0.01*4 = 1.14
    const result = marginMultiplier([
      { aGames: 6, bGames: 4 },
      { aGames: 6, bGames: 4 },
    ]);
    expect(result).toBeCloseTo(1.14);
  });
});

// ─── kFactorWithConfidence ────────────────────────────────────────────────────

describe("kFactorWithConfidence", () => {
  it("uses base 48 for provisional players", () => {
    // provisionalRemaining > 0, confidence = 0
    // base=48, result = max(1, round(48 * (1.1 - 0*0.5))) = round(48 * 1.1) = round(52.8) = 53
    const result = kFactorWithConfidence(0, 10);
    expect(result).toBe(53);
  });

  it("uses base 32 for non-provisional players", () => {
    // provisionalRemaining = 0, confidence = 0
    // base=32, result = max(1, round(32 * (1.1 - 0*0.5))) = round(32 * 1.1) = round(35.2) = 35
    const result = kFactorWithConfidence(0, 0);
    expect(result).toBe(35);
  });

  it("decreases K with higher confidence", () => {
    const lowConf = kFactorWithConfidence(0.2, 0);
    const highConf = kFactorWithConfidence(0.8, 0);
    expect(highConf).toBeLessThan(lowConf);
  });

  it("never returns 0 or negative (K-factor clamp)", () => {
    // Even with maximum confidence = 1
    const result = kFactorWithConfidence(1, 0);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it("returns at least 1 for confidence = 1, non-provisional", () => {
    // base=32, result = max(1, round(32 * (1.1 - 1.0*0.5))) = round(32 * 0.6) = round(19.2) = 19
    const result = kFactorWithConfidence(1, 0);
    expect(result).toBe(19);
  });

  it("returns at least 1 for confidence = 1, provisional", () => {
    // base=48, result = max(1, round(48 * (1.1 - 1.0*0.5))) = round(48 * 0.6) = round(28.8) = 29
    const result = kFactorWithConfidence(1, 5);
    expect(result).toBe(29);
  });

  it("clamps confidence above 1 to 1", () => {
    // confidence = 2.0 should be clamped to 1.0
    // base=32, result = max(1, round(32 * (1.1 - 1.0*0.5))) = 19
    const result = kFactorWithConfidence(2.0, 0);
    expect(result).toBe(19); // Same as confidence=1
  });

  it("handles confidence = 0", () => {
    // base=32, result = max(1, round(32 * (1.1 - 0))) = round(35.2) = 35
    const result = kFactorWithConfidence(0, 0);
    expect(result).toBe(35);
  });
});

// ─── computeEnhancedRatingUpdate ──────────────────────────────────────────────

describe("computeEnhancedRatingUpdate", () => {
  it("winner gains and loser loses", () => {
    const winnerUpdate = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true);
    const loserUpdate = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, false);

    expect(winnerUpdate.delta).toBeGreaterThan(0);
    expect(loserUpdate.delta).toBeLessThan(0);
  });

  it("applies margin multiplier when sets are provided", () => {
    const withoutSets = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true);
    const withSets = computeEnhancedRatingUpdate(1000, 1000, 0.5, 0, true, [
      { aGames: 6, bGames: 0 },
      { aGames: 6, bGames: 0 },
    ]);

    expect(withSets.delta).toBeGreaterThanOrEqual(withoutSets.delta);
  });

  it("never returns newRating below 100", () => {
    const update = computeEnhancedRatingUpdate(100, 2000, 0, 0, false);
    expect(update.newRating).toBeGreaterThanOrEqual(100);
  });
});

// ─── ntrpToRating / ratingToNtrp ──────────────────────────────────────────────

describe("ntrpToRating", () => {
  it("maps NTRP 2.5 to approximately 950", () => {
    expect(ntrpToRating(2.5)).toBe(950);
  });

  it("maps NTRP 3.0 to approximately 1060", () => {
    expect(ntrpToRating(3.0)).toBe(1060);
  });

  it("maps NTRP 5.0 to approximately 1500", () => {
    expect(ntrpToRating(5.0)).toBe(1500);
  });
});

describe("ratingToNtrp", () => {
  it("is the inverse of ntrpToRating for standard NTRP values", () => {
    for (const ntrp of [2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) {
      const rating = ntrpToRating(ntrp);
      expect(ratingToNtrp(rating)).toBeCloseTo(ntrp);
    }
  });

  it("rounds to nearest 0.5", () => {
    // rating 1000 -> raw = (1000-400)/220 = 2.727... -> round to 0.5 -> 2.5
    expect(ratingToNtrp(1000)).toBe(2.5);
  });
});

// ─── skillBandFromNtrp ────────────────────────────────────────────────────────

describe("skillBandFromNtrp", () => {
  it("returns 3.0 for NTRP <= 3.0", () => {
    expect(skillBandFromNtrp(2.5)).toBe("3.0");
    expect(skillBandFromNtrp(3.0)).toBe("3.0");
  });

  it("returns 3.5 for NTRP > 3.0 and < 4.0", () => {
    expect(skillBandFromNtrp(3.5)).toBe("3.5");
  });

  it("returns 4.0 for NTRP >= 4.0", () => {
    expect(skillBandFromNtrp(4.0)).toBe("4.0");
    expect(skillBandFromNtrp(4.5)).toBe("4.0");
    expect(skillBandFromNtrp(5.0)).toBe("4.0");
  });
});
