import { randomUUID } from "node:crypto";
import type { AuthUser, AvailabilitySlot, Player, Tournament } from "@rally/core";
import type { AuthRepo, AvailabilityRepo, MatchRepo, PlayerRepo, TournamentRepo } from "../repo/interfaces.js";

// ── Name data (diverse Bay Area demographics) ───────────────────────────────

const FIRST_NAMES = [
  // Anglo
  "James", "Emma", "Jack", "Olivia", "Ryan", "Sophia", "Connor", "Ava",
  "Dylan", "Charlotte", "Liam", "Grace", "Owen", "Lily", "Ethan", "Harper",
  // Hispanic
  "Carlos", "Sofia", "Diego", "Isabella", "Marco", "Valentina", "Mateo", "Camila",
  "Luis", "Elena", "Andres", "Lucia", "Javier", "Gabriela",
  // Asian
  "Kevin", "Michelle", "Jason", "Cindy", "David", "Jenny", "Brian", "Amy",
  "Eric", "Lisa", "Andrew", "Nicole", "Steven", "Karen",
  // Indian
  "Raj", "Priya", "Arjun", "Ananya", "Vikram", "Neha", "Kiran", "Divya",
];

const LAST_NAMES = [
  // Anglo
  "Anderson", "Mitchell", "Thompson", "Parker", "Collins",
  // Hispanic
  "Garcia", "Rodriguez", "Martinez", "Hernandez", "Lopez",
  // Asian
  "Chen", "Wang", "Kim", "Nguyen", "Lee",
  // Indian
  "Patel", "Shah", "Kumar", "Gupta", "Singh",
];

// ── Bay Area county + city data ─────────────────────────────────────────────

const COUNTIES: Array<{ county: string; city: string }> = [
  { county: "Marin County", city: "San Rafael" },
  { county: "San Francisco County", city: "San Francisco" },
  { county: "Sonoma County", city: "Santa Rosa" },
  { county: "Napa County", city: "Napa" },
  { county: "Contra Costa County", city: "Walnut Creek" },
  { county: "Alameda County", city: "Oakland" },
  { county: "San Mateo County", city: "San Mateo" },
  { county: "Santa Clara County", city: "San Jose" },
  { county: "Solano County", city: "Vallejo" },
  { county: "Santa Cruz County", city: "Santa Cruz" },
];

// ── Availability patterns (designed to produce all 3 scheduling tiers) ──────

/**
 * Patterns are designed so that:
 * - Patterns 0-2 have strong weekend overlap → Tier 1 (auto-scheduled)
 * - Patterns 0+1, 2+3 have near-misses (adjacent/close slots) → Tier 2 (flex)
 * - Patterns 1+4 have no overlap at all → Tier 3 (propose & pick)
 *
 * With 20 players per county on 7 patterns, we get a realistic mix of all tiers.
 */
const AVAIL_PATTERNS: Array<Array<{ dayOfWeek: number; startTime: string; endTime: string }>> = [
  // Pattern 0: Early bird — weekday mornings + Sat morning
  [
    { dayOfWeek: 1, startTime: "07:00", endTime: "09:00" },
    { dayOfWeek: 3, startTime: "07:00", endTime: "09:00" },
    { dayOfWeek: 5, startTime: "07:00", endTime: "09:00" },
    { dayOfWeek: 6, startTime: "08:00", endTime: "11:00" },
    { dayOfWeek: 0, startTime: "08:00", endTime: "11:00" },
  ],
  // Pattern 1: Evening player — weekday evenings + Sun afternoon
  [
    { dayOfWeek: 1, startTime: "18:00", endTime: "20:00" },
    { dayOfWeek: 2, startTime: "18:00", endTime: "20:30" },
    { dayOfWeek: 4, startTime: "17:30", endTime: "19:30" },
    { dayOfWeek: 6, startTime: "10:00", endTime: "13:00" },
    { dayOfWeek: 0, startTime: "14:00", endTime: "17:00" },
  ],
  // Pattern 2: Weekend warrior — mostly weekends + Wed lunch
  [
    { dayOfWeek: 6, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 6, startTime: "14:00", endTime: "17:00" },
    { dayOfWeek: 0, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 0, startTime: "14:00", endTime: "16:30" },
    { dayOfWeek: 3, startTime: "12:00", endTime: "14:00" },
  ],
  // Pattern 3: Lunch break + near-miss with morning (ends at 14:00, pattern 0 ends at 09:00)
  // Also near-miss with evening on Tue (17:00-19:00 near pattern 1's 18:00-20:30)
  [
    { dayOfWeek: 1, startTime: "11:30", endTime: "13:30" },
    { dayOfWeek: 2, startTime: "17:00", endTime: "19:00" },
    { dayOfWeek: 4, startTime: "12:00", endTime: "14:00" },
    { dayOfWeek: 6, startTime: "09:00", endTime: "11:30" },
    { dayOfWeek: 0, startTime: "10:00", endTime: "12:30" },
    { dayOfWeek: 5, startTime: "17:00", endTime: "19:00" },
  ],
  // Pattern 4: Odd hours — designed for Tier 3 (no overlap with patterns 0,1)
  [
    { dayOfWeek: 1, startTime: "14:00", endTime: "16:00" },
    { dayOfWeek: 3, startTime: "14:00", endTime: "16:00" },
    { dayOfWeek: 5, startTime: "14:00", endTime: "16:00" },
  ],
  // Pattern 5: Near-miss with Pattern 0 (mornings that end just as 0 starts)
  // Mon/Wed/Fri: 05:30-07:30 overlaps 30 min with Pattern 0's 07:00-09:00
  [
    { dayOfWeek: 1, startTime: "05:30", endTime: "07:30" },
    { dayOfWeek: 3, startTime: "06:00", endTime: "08:00" },
    { dayOfWeek: 5, startTime: "05:30", endTime: "07:30" },
    { dayOfWeek: 6, startTime: "07:00", endTime: "09:30" },
    { dayOfWeek: 0, startTime: "07:00", endTime: "09:30" },
  ],
  // Pattern 6: Broad spread — some overlap with most patterns
  [
    { dayOfWeek: 1, startTime: "06:30", endTime: "09:00" },
    { dayOfWeek: 2, startTime: "17:30", endTime: "20:00" },
    { dayOfWeek: 3, startTime: "12:00", endTime: "14:30" },
    { dayOfWeek: 5, startTime: "17:00", endTime: "19:30" },
    { dayOfWeek: 6, startTime: "09:30", endTime: "13:00" },
    { dayOfWeek: 0, startTime: "09:00", endTime: "12:00" },
    { dayOfWeek: 4, startTime: "07:00", endTime: "09:00" },
  ],
];

// ── Seeding function ─────────────────────────────────────────────────────────

export async function seedRichData(
  auth: AuthRepo,
  players: PlayerRepo,
  availability: AvailabilityRepo,
  tournaments: TournamentRepo,
  _matches: MatchRepo
): Promise<{ counties: number; players: number; tournaments: number }> {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let totalPlayers = 0;
  let totalTournaments = 0;

  for (let countyIdx = 0; countyIdx < COUNTIES.length; countyIdx++) {
    const { county, city } = COUNTIES[countyIdx]!;
    const countyPlayerIds: string[] = [];

    // Create 20 players per county
    for (let i = 0; i < 20; i++) {
      const firstName = FIRST_NAMES[(i + countyIdx * 5) % FIRST_NAMES.length] ?? "Player";
      const lastName = LAST_NAMES[i % LAST_NAMES.length] ?? "Test";
      const displayName = `${firstName} ${lastName}`;
      const countySlug = county.toLowerCase().replace(/\s+/g, "");
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${countySlug}@rally.test`;

      // Check if already exists
      const existing = await auth.findByEmail(email);
      if (existing) {
        countyPlayerIds.push(existing.id);
        totalPlayers++;
        continue;
      }

      const id = randomUUID();

      // Rating: spread between 950-1150 (all "intermediate" / 3.5 band)
      const rating = 950 + Math.round((i / 19) * 200);

      const authUser: AuthUser = { id, email, createdAt: now.toISOString() };
      await auth.upsert(authUser);

      const player: Player = {
        id,
        email,
        name: displayName,
        city,
        county,
        level: "intermediate",
        ntrp: 3.5,
        rating,
        ratingConfidence: 0.5,
        provisionalRemaining: 3,
        subscription: "active",
        wins: Math.floor(Math.random() * 10),
        losses: Math.floor(Math.random() * 8),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      await players.upsert(player);

      // Assign availability pattern (cycle through 7 patterns)
      const pattern = AVAIL_PATTERNS[i % AVAIL_PATTERNS.length]!;
      const slots: AvailabilitySlot[] = pattern.map((s) => ({
        id: randomUUID(),
        playerId: id,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        endTime: s.endTime,
      }));
      await availability.setForPlayer(id, slots);

      countyPlayerIds.push(id);
      totalPlayers++;
    }

    // Create a tournament in this county with 7 of the 20 players pre-registered
    // (so user joining as 8th triggers activation)
    // Idempotent: skip if a tournament already exists for this county/band/month
    const existingTournament = await tournaments.findByCountyBandMonth(county, "3.5", thisMonth);
    if (existingTournament) {
      totalTournaments++;
      continue;
    }

    const tournamentId = randomUUID();
    const registeredPlayerIds = countyPlayerIds.slice(0, 7);

    const tournament: Tournament = {
      id: tournamentId,
      month: thisMonth,
      name: `Rally League – ${county} – ${thisMonth}`,
      county,
      band: "3.5",
      status: "registration",
      playerIds: registeredPlayerIds,
      minPlayers: 6,
      maxPlayers: 8,
      rounds: [],
      standings: [],
      pendingResults: {},
      registrationOpenedAt: now.toISOString(),
      createdAt: now.toISOString(),
    };
    await tournaments.save(tournament);
    totalTournaments++;
  }

  return { counties: COUNTIES.length, players: totalPlayers, tournaments: totalTournaments };
}
