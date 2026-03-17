import { z } from "zod";

export const skillLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

export const playerProfileSchema = z.object({
  name: z.string().min(1).max(80),
  city: z.string().min(1).max(80),
  level: skillLevelSchema,
  county: z.string().min(1).max(80).optional(),
  ntrp: z.number().min(2.5).max(5.0).multipleOf(0.5).optional()
});

export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM")
});

export const setAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(20)
});

export const loginSchema = z.object({
  email: z.string().email()
});

export const challengeSchema = z.object({
  opponentId: z.string().uuid(),
  venue: z.string().max(120).optional()
});

export const acceptTimeSchema = z.object({
  proposalId: z.string().min(1)
});

export const reportResultSchema = z.object({
  winnerId: z.string().uuid(),
  score: z.string().min(1).max(80)
});

// ─── Tournament Schemas ───────────────────────────────────────────────────────

export const setScoreSchema = z.object({
  aGames: z.number().int().min(0).max(7),
  bGames: z.number().int().min(0).max(7),
  tiebreak: z.object({
    aPoints: z.number().int().min(0),
    bPoints: z.number().int().min(0)
  }).optional()
});

export const reportTournamentResultSchema = z.object({
  winnerId: z.string().uuid(),
  sets: z.array(setScoreSchema).min(2).max(3)
});

// ─── Subscription Schema ─────────────────────────────────────────────────────

export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"])
});

// ─── Pool Schema ────────────────────────────────────────────────────────────

export const poolSignupSchema = z.object({
  county: z.string().min(1).max(80).optional()
});
