import { randomUUID } from "node:crypto";
import type { AuthUser, AvailabilitySlot, Match, Player, Tournament } from "@rally/core";
import { generateRoundRobin, computeStandings } from "@rally/core";
import type { AuthRepo, AvailabilityRepo, MatchRepo, PlayerRepo, TournamentRepo } from "../repo/interfaces.js";

// ── Demo players ────────────────────────────────────────────────────────────

interface DemoSpec {
  email: string;
  name: string;
  city: string;
  county: string;
  level: "beginner" | "intermediate" | "advanced";
  ntrp: number;
  rating: number;
  wins: number;
  losses: number;
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}

const DEMO_PLAYERS: DemoSpec[] = [
  {
    email: "alice@rally.test",
    name: "Alice Johnson",
    city: "London",
    county: "Greater London",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1085,
    wins: 7,
    losses: 3,
    availability: [
      { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" },
      { dayOfWeek: 0, startTime: "10:00", endTime: "13:00" }
    ]
  },
  {
    email: "bob@rally.test",
    name: "Bob Carter",
    city: "London",
    county: "Greater London",
    level: "intermediate",
    ntrp: 3.5,
    rating: 960,
    wins: 4,
    losses: 6,
    availability: [
      { dayOfWeek: 6, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: 5, startTime: "18:00", endTime: "21:00" }
    ]
  },
  {
    email: "charlie@rally.test",
    name: "Charlie Davis",
    city: "London",
    county: "Greater London",
    level: "beginner",
    ntrp: 3.5,
    rating: 920,
    wins: 2,
    losses: 5,
    availability: [
      { dayOfWeek: 6, startTime: "10:00", endTime: "13:00" },
      { dayOfWeek: 3, startTime: "19:00", endTime: "21:30" }
    ]
  },
  {
    email: "diana@rally.test",
    name: "Diana Lee",
    city: "London",
    county: "Greater London",
    level: "advanced",
    ntrp: 4.5,
    rating: 1340,
    wins: 18,
    losses: 4,
    availability: [
      { dayOfWeek: 6, startTime: "07:00", endTime: "10:00" },
      { dayOfWeek: 2, startTime: "06:30", endTime: "08:30" }
    ]
  },
  {
    email: "ethan@rally.test",
    name: "Ethan Walsh",
    city: "London",
    county: "Greater London",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1025,
    wins: 5,
    losses: 5,
    availability: [
      { dayOfWeek: 6, startTime: "10:00", endTime: "13:00" },
      { dayOfWeek: 0, startTime: "11:00", endTime: "14:00" }
    ]
  },
  {
    email: "fiona@rally.test",
    name: "Fiona Moore",
    city: "London",
    county: "Greater London",
    level: "beginner",
    ntrp: 3.0,
    rating: 875,
    wins: 1,
    losses: 4,
    availability: [
      { dayOfWeek: 6, startTime: "09:30", endTime: "12:00" },
      { dayOfWeek: 0, startTime: "14:00", endTime: "17:00" }
    ]
  }
];

// ── Tournament test players (6 players, all NTRP 3.5, same county) ──────────

export const TOURNEY_TEST_PLAYERS: DemoSpec[] = [
  {
    email: "t1-alex@rally.test",
    name: "T1-Alex [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1050,
    wins: 6,
    losses: 4,
    availability: [{ dayOfWeek: 6, startTime: "09:00", endTime: "12:00" }]
  },
  {
    email: "t2-beth@rally.test",
    name: "T2-Beth [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1020,
    wins: 5,
    losses: 5,
    availability: [{ dayOfWeek: 6, startTime: "10:00", endTime: "13:00" }]
  },
  {
    email: "t3-chris@rally.test",
    name: "T3-Chris [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 990,
    wins: 4,
    losses: 6,
    availability: [{ dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }]
  },
  {
    email: "t4-dana@rally.test",
    name: "T4-Dana [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1080,
    wins: 7,
    losses: 3,
    availability: [{ dayOfWeek: 6, startTime: "08:00", endTime: "11:00" }]
  },
  {
    email: "t5-eli@rally.test",
    name: "T5-Eli [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 960,
    wins: 3,
    losses: 5,
    availability: [{ dayOfWeek: 0, startTime: "10:00", endTime: "13:00" }]
  },
  {
    email: "t6-faye@rally.test",
    name: "T6-Faye [3.5]",
    city: "San Francisco",
    county: "San Francisco County",
    level: "intermediate",
    ntrp: 3.5,
    rating: 1000,
    wins: 5,
    losses: 4,
    availability: [{ dayOfWeek: 6, startTime: "11:00", endTime: "14:00" }]
  }
];

export async function seedDemoPlayers(
  auth: AuthRepo,
  players: PlayerRepo,
  availability: AvailabilityRepo
): Promise<void> {
  const now = new Date().toISOString();

  for (const spec of [...DEMO_PLAYERS, ...TOURNEY_TEST_PLAYERS]) {
    const existing = await auth.findByEmail(spec.email);
    if (existing) continue;

    const id = randomUUID();

    const authUser: AuthUser = { id, email: spec.email, createdAt: now };
    await auth.upsert(authUser);

    const player: Player = {
      id,
      email: spec.email,
      name: spec.name,
      city: spec.city,
      county: spec.county,
      level: spec.level,
      ntrp: spec.ntrp,
      rating: spec.rating,
      ratingConfidence: 0.5,
      provisionalRemaining: 3,
      subscription: "active",
      wins: spec.wins,
      losses: spec.losses,
      createdAt: now,
      updatedAt: now
    };
    await players.upsert(player);

    const slots: AvailabilitySlot[] = spec.availability.map((s) => ({
      id: randomUUID(),
      playerId: id,
      ...s
    }));
    await availability.setForPlayer(id, slots);
  }
}

// ── Demo tournaments ─────────────────────────────────────────────────────────

export async function seedDemoTournaments(
  repo: TournamentRepo,
  matches: MatchRepo,
  auth: AuthRepo
): Promise<void> {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Look up demo player IDs
  const alice = await auth.findByEmail("alice@rally.test");
  const bob = await auth.findByEmail("bob@rally.test");
  const charlie = await auth.findByEmail("charlie@rally.test");
  const ethan = await auth.findByEmail("ethan@rally.test");

  // Registration tournament for band "3.0"
  await repo.save({
    id: randomUUID(),
    month: thisMonth,
    name: `Rally League – NTRP 3.0 – ${thisMonth}`,
    county: "Greater London",
    band: "3.0",
    status: "registration",
    playerIds: [],
    minPlayers: 4,
    maxPlayers: 8,
    rounds: [],
    standings: [],
    pendingResults: {},
    registrationOpenedAt: now.toISOString(),
    createdAt: now.toISOString()
  });

  if (!alice || !bob || !charlie || !ethan) return;

  // Active tournament for band "3.5" with 4 players
  const playerIds = [alice.id, ethan.id, bob.id, charlie.id];
  const rounds = generateRoundRobin(4);
  const tournamentId = randomUUID();
  const matchNow = new Date().toISOString();

  // Create match entities for each pairing
  const updatedRounds = [];
  for (const round of rounds) {
    const updatedPairings = [];
    for (const pairing of round.pairings) {
      const matchId = randomUUID();
      const m: Match = {
        id: matchId,
        challengerId: playerIds[pairing.homeIndex]!,
        opponentId: playerIds[pairing.awayIndex]!,
        tournamentId,
        status: "scheduled",
        proposals: [],
        createdAt: matchNow,
        updatedAt: matchNow
      };
      await matches.save(m);
      updatedPairings.push({ ...pairing, matchId });
    }
    updatedRounds.push({ ...round, pairings: updatedPairings });
  }

  const standings = computeStandings(playerIds, []);

  await repo.save({
    id: tournamentId,
    month: thisMonth,
    name: `Rally League – NTRP 3.5 – ${thisMonth}`,
    county: "Greater London",
    band: "3.5",
    status: "active",
    playerIds,
    minPlayers: 4,
    maxPlayers: 8,
    rounds: updatedRounds,
    standings,
    pendingResults: {},
    registrationOpenedAt: new Date(now.getTime() - 8 * 86400000).toISOString(),
    createdAt: new Date(now.getTime() - 8 * 86400000).toISOString()
  });
}
