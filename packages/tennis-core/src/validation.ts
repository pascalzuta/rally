import { z } from "zod";

/** Validates a player's self-reported skill level */
export const skillLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);

/** Validates and sanitizes a player profile update (name, city, level, optional county/NTRP) */
export const playerProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name must be 80 characters or fewer"),
  city: z.string().trim().min(1, "City is required").max(80, "City must be 80 characters or fewer"),
  level: skillLevelSchema,
  county: z.string().trim().min(1, "County is required").max(80, "County must be 80 characters or fewer").optional(),
  ntrp: z.number().min(2.5, "NTRP must be at least 2.5").max(5.0, "NTRP must be at most 5.0").multipleOf(0.5, "NTRP must be in 0.5 increments").optional()
});

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Validates a single recurring weekly availability slot (day, start/end time) */
export const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0, "Day of week must be 0 (Sun) to 6 (Sat)").max(6, "Day of week must be 0 (Sun) to 6 (Sat)"),
  startTime: z.string().regex(timeRegex, "Must be HH:MM (00:00–23:59)"),
  endTime: z.string().regex(timeRegex, "Must be HH:MM (00:00–23:59)")
}).refine(
  (data) => data.startTime < data.endTime,
  { message: "startTime must be before endTime" }
);

/** Validates the full set of availability slots for a player (max 20) */
export const setAvailabilitySchema = z.object({
  slots: z.array(availabilitySlotSchema).max(20, "Maximum 20 availability slots allowed")
});

/** Validates login payload (email address) */
export const loginSchema = z.object({
  email: z.string().email("A valid email address is required")
});

/** Validates a match challenge request (opponent ID and optional venue) */
export const challengeSchema = z.object({
  opponentId: z.string().uuid("Opponent ID must be a valid UUID"),
  venue: z.string().max(120, "Venue must be 120 characters or fewer").optional()
});

/** Validates a time proposal acceptance (proposal ID) */
export const acceptTimeSchema = z.object({
  proposalId: z.string().min(1, "Proposal ID is required")
});

/** Validates a casual match result report (winner ID and score string) */
export const reportResultSchema = z.object({
  winnerId: z.string().uuid("Winner ID must be a valid UUID"),
  score: z.string().min(1, "Score is required").max(80, "Score must be 80 characters or fewer")
});

// ─── Tournament Schemas ───────────────────────────────────────────────────────

/**
 * Validates a single set score.
 * In tennis, valid final set scores are: 6-0..6-4, 7-5, 7-6 (tiebreak).
 * aGames = challenger's games, bGames = opponent's games.
 */
export const setScoreSchema = z.object({
  aGames: z.number().int().min(0, "Games cannot be negative").max(7, "Games cannot exceed 7"),
  bGames: z.number().int().min(0, "Games cannot be negative").max(7, "Games cannot exceed 7"),
  tiebreak: z.object({
    aPoints: z.number().int().min(0, "Tiebreak points cannot be negative").max(99, "Tiebreak points cannot exceed 99"),
    bPoints: z.number().int().min(0, "Tiebreak points cannot be negative").max(99, "Tiebreak points cannot exceed 99")
  }).optional()
}).refine(
  (s) => {
    const { aGames: a, bGames: b } = s;
    // One player must win with 6+ games
    if (a < 6 && b < 6) return false;
    // Standard set: 6-0 through 6-4
    if ((a === 6 && b <= 4) || (b === 6 && a <= 4)) return true;
    // Set went to 7-5
    if ((a === 7 && b === 5) || (b === 7 && a === 5)) return true;
    // Tiebreak: 7-6
    if ((a === 7 && b === 6) || (b === 7 && a === 6)) return true;
    return false;
  },
  { message: "Invalid set score (e.g. valid: 6-4, 7-5, 7-6)" }
).refine(
  (s) => {
    const { aGames: a, bGames: b, tiebreak: tb } = s;
    // Tiebreak required only for 7-6 scores
    const isTiebreakSet = (a === 7 && b === 6) || (b === 7 && a === 6);
    if (isTiebreakSet && !tb) return true; // Allow omitting tiebreak detail
    if (!isTiebreakSet && tb) return false; // No tiebreak on non-7-6 sets
    return true;
  },
  { message: "Tiebreak details only allowed for 7-6 sets" }
);

/** Validates a tournament match result report (winner ID and structured set scores) */
export const reportTournamentResultSchema = z.object({
  winnerId: z.string().uuid("Winner ID must be a valid UUID"),
  sets: z.array(setScoreSchema).min(2, "At least 2 sets are required").max(3, "Maximum 3 sets allowed")
});

// ─── Subscription Schema ─────────────────────────────────────────────────────

/** Validates a subscription checkout request (monthly or yearly plan) */
export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(["monthly", "yearly"])
});

// ─── Pool Schema ────────────────────────────────────────────────────────────

/** Validates a pool signup request (optional county override) */
export const poolSignupSchema = z.object({
  county: z.string().trim().min(1, "County is required").max(80, "County must be 80 characters or fewer").optional()
});

// ─── Tournament Name Schema ──────────────────────────────────────────────────

/** Validates a tournament name (currently server-generated, but sanitized for safety) */
export const tournamentNameSchema = z.string().trim().min(1, "Tournament name is required").max(200, "Tournament name must be 200 characters or fewer");
