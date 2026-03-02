import { describe, it, expect } from "vitest";
import {
  availabilitySlotSchema,
  setScoreSchema,
  playerProfileSchema,
  loginSchema,
  challengeSchema,
} from "../validation.js";

// ─── availabilitySlotSchema ───────────────────────────────────────────────────

describe("availabilitySlotSchema", () => {
  describe("valid slots", () => {
    it("accepts a valid slot", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "12:00",
      });
      expect(result.success).toBe(true);
    });

    it("accepts midnight boundary times", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 0,
        startTime: "00:00",
        endTime: "23:59",
      });
      expect(result.success).toBe(true);
    });

    it("accepts dayOfWeek 0 (Sunday) through 6 (Saturday)", () => {
      for (let day = 0; day <= 6; day++) {
        const result = availabilitySlotSchema.safeParse({
          dayOfWeek: day,
          startTime: "10:00",
          endTime: "11:00",
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("invalid times", () => {
    it("rejects invalid time format (no colon)", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "0900",
        endTime: "1200",
      });
      expect(result.success).toBe(false);
    });

    it("rejects hour > 23", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "24:00",
        endTime: "25:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects minute > 59", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "09:60",
        endTime: "12:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects single-digit hour format", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "9:00",
        endTime: "12:00",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("startTime < endTime constraint", () => {
    it("rejects startTime equal to endTime", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "09:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects startTime after endTime", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "09:00",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid dayOfWeek", () => {
    it("rejects dayOfWeek < 0", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: -1,
        startTime: "09:00",
        endTime: "12:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects dayOfWeek > 6", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 7,
        startTime: "09:00",
        endTime: "12:00",
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer dayOfWeek", () => {
      const result = availabilitySlotSchema.safeParse({
        dayOfWeek: 1.5,
        startTime: "09:00",
        endTime: "12:00",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ─── setScoreSchema ───────────────────────────────────────────────────────────

describe("setScoreSchema", () => {
  describe("valid scores", () => {
    it("accepts 6-0", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 0 }).success).toBe(true);
    });

    it("accepts 6-1", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 1 }).success).toBe(true);
    });

    it("accepts 6-2", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 2 }).success).toBe(true);
    });

    it("accepts 6-3", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 3 }).success).toBe(true);
    });

    it("accepts 6-4", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 4 }).success).toBe(true);
    });

    it("accepts 7-5", () => {
      expect(setScoreSchema.safeParse({ aGames: 7, bGames: 5 }).success).toBe(true);
    });

    it("accepts 7-6 (tiebreak without details)", () => {
      expect(setScoreSchema.safeParse({ aGames: 7, bGames: 6 }).success).toBe(true);
    });

    it("accepts 7-6 with tiebreak details", () => {
      const result = setScoreSchema.safeParse({
        aGames: 7,
        bGames: 6,
        tiebreak: { aPoints: 7, bPoints: 4 },
      });
      expect(result.success).toBe(true);
    });

    it("accepts reversed scores (opponent winning)", () => {
      expect(setScoreSchema.safeParse({ aGames: 0, bGames: 6 }).success).toBe(true);
      expect(setScoreSchema.safeParse({ aGames: 4, bGames: 6 }).success).toBe(true);
      expect(setScoreSchema.safeParse({ aGames: 5, bGames: 7 }).success).toBe(true);
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 7 }).success).toBe(true);
    });
  });

  describe("invalid scores", () => {
    it("rejects 6-5 (not a valid final score)", () => {
      expect(setScoreSchema.safeParse({ aGames: 6, bGames: 5 }).success).toBe(false);
    });

    it("rejects 5-6 (reverse of invalid)", () => {
      expect(setScoreSchema.safeParse({ aGames: 5, bGames: 6 }).success).toBe(false);
    });

    it("rejects 5-5 (no winner)", () => {
      expect(setScoreSchema.safeParse({ aGames: 5, bGames: 5 }).success).toBe(false);
    });

    it("rejects 8-6 (games out of valid range)", () => {
      expect(setScoreSchema.safeParse({ aGames: 8, bGames: 6 }).success).toBe(false);
    });

    it("rejects 7-7 (impossible score)", () => {
      expect(setScoreSchema.safeParse({ aGames: 7, bGames: 7 }).success).toBe(false);
    });

    it("rejects 4-4 (both under 6)", () => {
      expect(setScoreSchema.safeParse({ aGames: 4, bGames: 4 }).success).toBe(false);
    });

    it("rejects 7-4 (if 7 games, opponent must have 5 or 6)", () => {
      expect(setScoreSchema.safeParse({ aGames: 7, bGames: 4 }).success).toBe(false);
    });

    it("rejects negative games", () => {
      expect(setScoreSchema.safeParse({ aGames: -1, bGames: 6 }).success).toBe(false);
    });
  });

  describe("tiebreak rules", () => {
    it("rejects tiebreak on non-7-6 scores", () => {
      const result = setScoreSchema.safeParse({
        aGames: 6,
        bGames: 4,
        tiebreak: { aPoints: 7, bPoints: 3 },
      });
      expect(result.success).toBe(false);
    });

    it("allows 7-6 without tiebreak details", () => {
      const result = setScoreSchema.safeParse({
        aGames: 7,
        bGames: 6,
      });
      expect(result.success).toBe(true);
    });

    it("allows 7-6 with tiebreak details", () => {
      const result = setScoreSchema.safeParse({
        aGames: 7,
        bGames: 6,
        tiebreak: { aPoints: 7, bPoints: 2 },
      });
      expect(result.success).toBe(true);
    });
  });
});

// ─── playerProfileSchema ──────────────────────────────────────────────────────

describe("playerProfileSchema", () => {
  const validProfile = {
    name: "John Doe",
    city: "Dublin",
    level: "intermediate" as const,
  };

  describe("valid profiles", () => {
    it("accepts a valid profile with required fields only", () => {
      expect(playerProfileSchema.safeParse(validProfile).success).toBe(true);
    });

    it("accepts a valid profile with all optional fields", () => {
      const result = playerProfileSchema.safeParse({
        ...validProfile,
        county: "Dublin",
        ntrp: 3.5,
      });
      expect(result.success).toBe(true);
    });

    it("accepts all valid skill levels", () => {
      for (const level of ["beginner", "intermediate", "advanced"]) {
        const result = playerProfileSchema.safeParse({ ...validProfile, level });
        expect(result.success).toBe(true);
      }
    });

    it("accepts valid NTRP values (2.5 to 5.0 in 0.5 steps)", () => {
      for (const ntrp of [2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) {
        const result = playerProfileSchema.safeParse({ ...validProfile, ntrp });
        expect(result.success).toBe(true);
      }
    });
  });

  describe("name length limits", () => {
    it("rejects empty name", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, name: "" });
      expect(result.success).toBe(false);
    });

    it("accepts name of length 1", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, name: "A" });
      expect(result.success).toBe(true);
    });

    it("accepts name of length 80", () => {
      const result = playerProfileSchema.safeParse({
        ...validProfile,
        name: "A".repeat(80),
      });
      expect(result.success).toBe(true);
    });

    it("rejects name longer than 80 chars", () => {
      const result = playerProfileSchema.safeParse({
        ...validProfile,
        name: "A".repeat(81),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("city length limits", () => {
    it("rejects empty city", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, city: "" });
      expect(result.success).toBe(false);
    });

    it("rejects city longer than 80 chars", () => {
      const result = playerProfileSchema.safeParse({
        ...validProfile,
        city: "C".repeat(81),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("invalid skill levels", () => {
    it("rejects unknown skill level", () => {
      const result = playerProfileSchema.safeParse({
        ...validProfile,
        level: "expert",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("NTRP range", () => {
    it("rejects NTRP below 2.5", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, ntrp: 2.0 });
      expect(result.success).toBe(false);
    });

    it("rejects NTRP above 5.0", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, ntrp: 5.5 });
      expect(result.success).toBe(false);
    });

    it("rejects NTRP not a multiple of 0.5", () => {
      const result = playerProfileSchema.safeParse({ ...validProfile, ntrp: 3.3 });
      expect(result.success).toBe(false);
    });
  });
});

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  describe("valid emails", () => {
    it("accepts a standard email", () => {
      expect(loginSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
    });

    it("accepts email with subdomain", () => {
      expect(
        loginSchema.safeParse({ email: "user@mail.example.com" }).success
      ).toBe(true);
    });

    it("accepts email with plus addressing", () => {
      expect(
        loginSchema.safeParse({ email: "user+tag@example.com" }).success
      ).toBe(true);
    });
  });

  describe("invalid emails", () => {
    it("rejects empty string", () => {
      expect(loginSchema.safeParse({ email: "" }).success).toBe(false);
    });

    it("rejects string without @", () => {
      expect(loginSchema.safeParse({ email: "userexample.com" }).success).toBe(false);
    });

    it("rejects string without domain", () => {
      expect(loginSchema.safeParse({ email: "user@" }).success).toBe(false);
    });

    it("rejects string without local part", () => {
      expect(loginSchema.safeParse({ email: "@example.com" }).success).toBe(false);
    });
  });
});

// ─── challengeSchema ──────────────────────────────────────────────────────────

describe("challengeSchema", () => {
  describe("valid challenges", () => {
    it("accepts a valid UUID opponentId", () => {
      const result = challengeSchema.safeParse({
        opponentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });

    it("accepts with optional venue", () => {
      const result = challengeSchema.safeParse({
        opponentId: "550e8400-e29b-41d4-a716-446655440000",
        venue: "Central Park Courts",
      });
      expect(result.success).toBe(true);
    });

    it("accepts without venue", () => {
      const result = challengeSchema.safeParse({
        opponentId: "550e8400-e29b-41d4-a716-446655440000",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid challenges", () => {
    it("rejects non-UUID opponentId", () => {
      const result = challengeSchema.safeParse({
        opponentId: "not-a-uuid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty opponentId", () => {
      const result = challengeSchema.safeParse({
        opponentId: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects venue longer than 120 chars", () => {
      const result = challengeSchema.safeParse({
        opponentId: "550e8400-e29b-41d4-a716-446655440000",
        venue: "V".repeat(121),
      });
      expect(result.success).toBe(false);
    });
  });
});
