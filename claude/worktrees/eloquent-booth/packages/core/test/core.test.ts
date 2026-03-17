import { describe, expect, it } from "vitest";
import { calculateDailyScore, calculateStreak, validatePriority } from "../src";

describe("validatePriority", () => {
  it("accepts measurable, specific priorities", () => {
    const result = validatePriority({
      title: "Ship math homework revision set by 7pm",
      why: "I need to improve my test grade this week"
    });

    expect(result.isValid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(70);
  });

  it("rejects vague priorities", () => {
    const result = validatePriority({
      title: "do stuff",
      why: "important"
    });

    expect(result.isValid).toBe(false);
    expect(result.hints.length).toBeGreaterThan(0);
  });
});

describe("accountability scoring", () => {
  it("calculates score and streak", () => {
    const score = calculateDailyScore({
      date: "2026-02-18",
      confidence: 4,
      priorities: [
        { id: "1", title: "A", why: "B", blockers: "", status: "done" },
        { id: "2", title: "C", why: "D", blockers: "", status: "partial" }
      ]
    });

    expect(score).toBeGreaterThan(0);
    expect(calculateStreak([10, 71, 75])).toBe(2);
  });
});
