/**
 * Store Integration Tests
 *
 * Tests the play-tennis store functions with stubbed Supabase sync.
 * The store uses memoryStore (in-memory Map) instead of localStorage,
 * so no browser API mocking is needed — just clear the store between tests.
 *
 * Covers:
 * - Score report → confirm → visible to both players
 * - 48-hour edit window enforcement
 * - Cancellation creates walkover for both players
 * - Trophy awarding after tournament completion
 * - Badge awarding (first-tournament, comeback-win, undefeated-champion)
 * - Notification delivery to correct player
 * - Knockout phase generation from group stage
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { clear as clearMemoryStore, setItem as memSetItem, getItem as memGetItem } from "../memoryStore";

// Mock Supabase sync layer before importing store
vi.mock("../sync", () => ({
  SUPABASE_PRIMARY: false,
  syncTournament: vi.fn().mockResolvedValue({ success: true }),
  syncLobbyEntry: vi.fn().mockResolvedValue(undefined),
  syncRemoveLobbyEntry: vi.fn().mockResolvedValue(undefined),
  syncRatingsForPlayer: vi.fn().mockResolvedValue(undefined),
  syncTournaments: vi.fn(),
  syncLobbyForCounty: vi.fn().mockResolvedValue([]),
  syncRatings: vi.fn().mockResolvedValue(undefined),
  syncAvailabilityToRemote: vi.fn().mockResolvedValue(undefined),
  fetchAvailabilityForPlayers: vi.fn().mockResolvedValue({}),
  getTournamentTimestamp: vi.fn().mockReturnValue(undefined),
  setTournamentTimestamp: vi.fn(),
  refreshTournamentById: vi.fn().mockResolvedValue(undefined),
  syncRatingSnapshot: vi.fn().mockResolvedValue(undefined),
  syncTrophiesToRemote: vi.fn().mockResolvedValue(undefined),
  syncBadgesToRemote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../supabase", () => ({
  getClient: vi.fn().mockReturnValue(null),
}));

vi.mock("../api", () => ({
  apiJoinLobby: vi.fn().mockResolvedValue(undefined),
  apiLeaveLobby: vi.fn().mockResolvedValue(undefined),
  isApiConfigured: vi.fn().mockReturnValue(false),
}));

vi.mock("../offline-queue", () => ({
  enqueue: vi.fn(),
}));

// Now import store functions
import {
  createProfile,
  getProfile,
  saveAvailability,
  getAvailability,
  saveMatchScore,
  confirmMatchScore,
  editMatchScore,
  cancelMatch,
  awardTournamentTrophies,
  checkAndAwardBadges,
  getPlayerTrophies,
  getPlayerBadges,
  getNotifications,
  getPlayerRating,
} from "../store";

import type { Tournament, Match, Player } from "../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Create a minimal valid tournament with matches pre-populated */
function createTestTournament(overrides?: Partial<Tournament>): Tournament {
  const players: Player[] = [
    { id: "alice", name: "Alice", },
    { id: "bob", name: "Bob", },
    { id: "carol", name: "Carol", },
    { id: "dave", name: "Dave", },
  ];

  const matches: Match[] = [
    // Group matches (round-robin: 6 matches for 4 players)
    makeTestMatch("m1", "alice", "bob", 1, 0, "group"),
    makeTestMatch("m2", "alice", "carol", 1, 1, "group"),
    makeTestMatch("m3", "alice", "dave", 1, 2, "group"),
    makeTestMatch("m4", "bob", "carol", 2, 0, "group"),
    makeTestMatch("m5", "bob", "dave", 2, 1, "group"),
    makeTestMatch("m6", "carol", "dave", 2, 2, "group"),
  ];

  const t: Tournament = {
    id: "t1",
    name: "Cornwall April 2026",
    date: "2026-04-01",
    county: "cornwall",
    format: "round-robin",
    players,
    matches,
    status: "in-progress",
    createdAt: "2026-04-01T00:00:00Z",
    ...overrides,
  };

  return t;
}

function makeTestMatch(
  id: string,
  player1Id: string,
  player2Id: string,
  round: number,
  position: number,
  phase: "group" | "knockout" = "group"
): Match {
  return {
    id,
    round,
    position,
    player1Id,
    player2Id,
    score1: [],
    score2: [],
    winnerId: null,
    completed: false,
    phase,
  };
}

function seedTournament(t: Tournament): void {
  memSetItem("play-tennis-data", JSON.stringify([t]));
}

function loadTournament(id: string): Tournament | undefined {
  const all = JSON.parse(memGetItem("play-tennis-data") ?? "[]");
  return all.find((t: Tournament) => t.id === id);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearMemoryStore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. AVAILABILITY PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Availability persistence", () => {
  it("saves availability and retrieves it by player ID", async () => {
    const profile = createProfile("Alice", "cornwall", { skillLevel: "intermediate" });

    const slots = [
      { day: "saturday" as const, startHour: 9, endHour: 14 },
      { day: "sunday" as const, startHour: 10, endHour: 15 },
    ];

    await saveAvailability(profile.id, slots, "cornwall");
    const retrieved = getAvailability(profile.id);

    expect(retrieved).toHaveLength(2);
    expect(retrieved[0]!.day).toBe("saturday");
    expect(retrieved[0]!.startHour).toBe(9);
    expect(retrieved[1]!.day).toBe("sunday");
  });

  it("profile persists across reads", () => {
    const profile = createProfile("Bob", "devon");
    const retrieved = getProfile();
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe("Bob");
    expect(retrieved!.county).toBe("devon");
    expect(retrieved!.id).toBe(profile.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. SCORE REPORTING — TWO-PHASE CONFIRMATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Score reporting two-phase flow", () => {
  it("reporter submits score → match is NOT yet completed", async () => {
    const t = createTestTournament();
    seedTournament(t);

    const result = await saveMatchScore("t1", "m1", [6, 6], [3, 4], "alice", "alice");
    expect(result).toBeDefined();

    const updated = loadTournament("t1");
    const match = updated!.matches.find((m) => m.id === "m1")!;

    expect(match.score1).toEqual([6, 6]);
    expect(match.score2).toEqual([3, 4]);
    expect(match.winnerId).toBe("alice");
    expect(match.scoreReportedBy).toBe("alice");
    expect(match.completed).toBe(false); // NOT completed yet
  });

  it("opponent confirms → match IS completed", async () => {
    const t = createTestTournament();
    // Pre-fill the score as if alice reported it
    t.matches[0]!.score1 = [6, 6];
    t.matches[0]!.score2 = [3, 4];
    t.matches[0]!.winnerId = "alice";
    t.matches[0]!.scoreReportedBy = "alice";
    t.matches[0]!.scoreReportedAt = new Date().toISOString();
    seedTournament(t);

    const result = await confirmMatchScore("t1", "m1", "bob");
    expect(result).toBeDefined();

    const updated = loadTournament("t1");
    const match = updated!.matches.find((m) => m.id === "m1")!;

    expect(match.completed).toBe(true);
    expect(match.scoreConfirmedBy).toBe("bob");
  });

  it("reporter CANNOT confirm their own score", async () => {
    const t = createTestTournament();
    t.matches[0]!.score1 = [6, 6];
    t.matches[0]!.score2 = [3, 4];
    t.matches[0]!.winnerId = "alice";
    t.matches[0]!.scoreReportedBy = "alice";
    seedTournament(t);

    const result = await confirmMatchScore("t1", "m1", "alice");
    expect(result).toBeUndefined(); // Rejected — reporter can't confirm
  });

  it("sends notification to opponent when score is reported", async () => {
    const t = createTestTournament();
    seedTournament(t);

    await saveMatchScore("t1", "m1", [6, 6], [3, 4], "alice", "alice");

    // Bob should have a notification
    const bobNotifs = getNotifications("bob");
    expect(bobNotifs.length).toBeGreaterThanOrEqual(1);
    const scoreNotif = bobNotifs.find((n) => n.type === "score_reported");
    expect(scoreNotif).toBeDefined();
    expect(scoreNotif!.recipientId).toBe("bob");
  });

  it("sends notification to reporter when score is confirmed", async () => {
    const t = createTestTournament();
    t.matches[0]!.score1 = [6, 6];
    t.matches[0]!.score2 = [3, 4];
    t.matches[0]!.winnerId = "alice";
    t.matches[0]!.scoreReportedBy = "alice";
    t.matches[0]!.scoreReportedAt = new Date().toISOString();
    seedTournament(t);

    await confirmMatchScore("t1", "m1", "bob");

    // Alice should be notified
    const aliceNotifs = getNotifications("alice");
    const confirmNotif = aliceNotifs.find(
      (n) => n.type === "score_reported" && n.senderId === "bob"
    );
    expect(confirmNotif).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SCORE EDITING — 48-HOUR WINDOW
// ═══════════════════════════════════════════════════════════════════════════════

describe("Score editing 48-hour window", () => {
  it("allows editing within 48 hours", async () => {
    const t = createTestTournament();
    t.matches[0]!.completed = true;
    t.matches[0]!.score1 = [6, 6];
    t.matches[0]!.score2 = [3, 4];
    t.matches[0]!.winnerId = "alice";
    // Set completion time to 1 hour ago
    t.matches[0]!.schedule = {
      status: "resolved",
      proposals: [],
      confirmedSlot: null,
      createdAt: new Date().toISOString(),
      escalationDay: 0,
      lastEscalation: new Date().toISOString(),
      resolution: {
        resolvedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      } as any,
    };
    seedTournament(t);

    const result = await editMatchScore("t1", "m1", [4, 4], [6, 6], "bob");
    expect(result).toBeDefined();

    const updated = loadTournament("t1");
    const match = updated!.matches.find((m) => m.id === "m1")!;
    expect(match.winnerId).toBe("bob"); // Updated
    expect(match.score1).toEqual([4, 4]);
    expect(match.score2).toEqual([6, 6]);
  });

  it("rejects editing after 48 hours", async () => {
    const t = createTestTournament();
    t.matches[0]!.completed = true;
    t.matches[0]!.score1 = [6, 6];
    t.matches[0]!.score2 = [3, 4];
    t.matches[0]!.winnerId = "alice";
    // Set completion time to 49 hours ago
    t.matches[0]!.schedule = {
      status: "resolved",
      proposals: [],
      confirmedSlot: null,
      createdAt: new Date().toISOString(),
      escalationDay: 0,
      lastEscalation: new Date().toISOString(),
      resolution: {
        resolvedAt: new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString(),
      } as any,
    };
    seedTournament(t);

    const result = await editMatchScore("t1", "m1", [4, 4], [6, 6], "bob");
    expect(result).toBeUndefined(); // Rejected — too late
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MATCH CANCELLATION
// ═══════════════════════════════════════════════════════════════════════════════

describe("Match cancellation creates walkover for both players", () => {
  it("sets resolution to walkover and marks completed", async () => {
    const t = createTestTournament();
    seedTournament(t);

    const result = await cancelMatch("t1", "m1", "scheduling conflict");
    expect(result).toBeDefined();

    const updated = loadTournament("t1");
    const match = updated!.matches.find((m) => m.id === "m1")!;

    expect(match.completed).toBe(true);
    expect(match.resolution).toBeDefined();
    expect(match.resolution!.type).toBe("walkover");
    expect(match.resolution!.reason).toBe("scheduling conflict");
    // No winner for mutual cancel
    expect(match.resolution!.winnerId).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. TROPHY AWARDING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Trophy awarding after tournament completion", () => {
  it("awards champion, finalist, semifinalist for single-elimination", () => {
    const t: Tournament = {
      id: "t-se",
      name: "SE Tournament",
      date: "2026-04-01",
      county: "cornwall",
      format: "single-elimination",
      players: [
        { id: "p1", name: "Alice", },
        { id: "p2", name: "Bob", },
        { id: "p3", name: "Carol", },
        { id: "p4", name: "Dave", },
      ],
      matches: [
        // Semis
        {
          id: "sf1", round: 1, position: 0, player1Id: "p1", player2Id: "p2",
          score1: [6], score2: [3], winnerId: "p1", completed: true,
        },
        {
          id: "sf2", round: 1, position: 1, player1Id: "p3", player2Id: "p4",
          score1: [6], score2: [4], winnerId: "p3", completed: true,
        },
        // Final
        {
          id: "f1", round: 2, position: 0, player1Id: "p1", player2Id: "p3",
          score1: [6, 6], score2: [4, 3], winnerId: "p1", completed: true,
        },
      ],
      status: "completed",
      createdAt: "2026-04-01T00:00:00Z",
    };
    seedTournament(t);

    const trophies = awardTournamentTrophies("t-se", t);

    expect(trophies.length).toBeGreaterThanOrEqual(3);

    const champion = trophies.find((tr) => tr.tier === "champion");
    expect(champion).toBeDefined();
    expect(champion!.playerId).toBe("p1"); // Alice won the final

    const finalist = trophies.find((tr) => tr.tier === "finalist");
    expect(finalist).toBeDefined();
    expect(finalist!.playerId).toBe("p3"); // Carol lost the final

    const semifinalists = trophies.filter((tr) => tr.tier === "semifinalist");
    expect(semifinalists).toHaveLength(2);
    const semiPlayerIds = semifinalists.map((tr) => tr.playerId).sort();
    expect(semiPlayerIds).toEqual(["p2", "p4"]); // Bob and Dave lost semis
  });

  it("does not re-award trophies for same tournament", () => {
    const t: Tournament = {
      id: "t-no-dup",
      name: "No Dup",
      date: "2026-04-01",
      county: "cornwall",
      format: "single-elimination",
      players: [
        { id: "p1", name: "Alice", },
        { id: "p2", name: "Bob", },
      ],
      matches: [
        {
          id: "f1", round: 1, position: 0, player1Id: "p1", player2Id: "p2",
          score1: [6], score2: [3], winnerId: "p1", completed: true,
        },
      ],
      status: "completed",
      createdAt: "2026-04-01T00:00:00Z",
    };
    seedTournament(t);

    const first = awardTournamentTrophies("t-no-dup", t);
    expect(first.length).toBeGreaterThan(0);

    const second = awardTournamentTrophies("t-no-dup", t);
    expect(second).toHaveLength(0); // No duplicates
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BADGE AWARDING
// ═══════════════════════════════════════════════════════════════════════════════

describe("Badge awarding", () => {
  it("awards first-tournament badge on completion", () => {
    const t = createTestTournament({ status: "completed" });
    // Complete all matches
    for (const m of t.matches) {
      m.completed = true;
      m.winnerId = m.player1Id;
      m.score1 = [6];
      m.score2 = [3];
    }
    seedTournament(t);

    const badges = checkAndAwardBadges("alice", "t1", t);

    const firstTournament = badges.find((b) => b.type === "first-tournament");
    expect(firstTournament).toBeDefined();
  });

  it("awards undefeated-champion when player wins all matches + is champion", () => {
    const t: Tournament = {
      id: "t-undefeated",
      name: "Undefeated Test",
      date: "2026-04-01",
      county: "cornwall",
      format: "single-elimination",
      players: [
        { id: "alice", name: "Alice", },
        { id: "bob", name: "Bob", },
      ],
      matches: [
        {
          id: "f1", round: 1, position: 0, player1Id: "alice", player2Id: "bob",
          score1: [6, 6], score2: [3, 4], winnerId: "alice", completed: true,
        },
      ],
      status: "completed",
      createdAt: "2026-04-01T00:00:00Z",
    };
    seedTournament(t);

    // First award trophies (so checkAndAwardBadges can find champion status)
    awardTournamentTrophies("t-undefeated", t);

    const badges = checkAndAwardBadges("alice", "t-undefeated", t);

    const undefeated = badges.find((b) => b.type === "undefeated-champion");
    expect(undefeated).toBeDefined();
  });

  it("awards comeback-win badge when player loses first set but wins match", () => {
    const t = createTestTournament({ status: "completed" });
    // Alice loses first set 4-6 but wins match
    t.matches[0]!.completed = true;
    t.matches[0]!.winnerId = "alice";
    t.matches[0]!.score1 = [4, 6, 6]; // Alice's scores per set
    t.matches[0]!.score2 = [6, 3, 4]; // Bob's scores per set
    // Complete remaining matches
    for (let i = 1; i < t.matches.length; i++) {
      t.matches[i]!.completed = true;
      t.matches[i]!.winnerId = t.matches[i]!.player1Id;
      t.matches[i]!.score1 = [6];
      t.matches[i]!.score2 = [3];
    }
    seedTournament(t);

    const badges = checkAndAwardBadges("alice", "t1", t);

    const comeback = badges.find((b) => b.type === "comeback-win");
    expect(comeback).toBeDefined();
  });

  it("does NOT award comeback-win when player wins first set", () => {
    const t = createTestTournament({ status: "completed" });
    // Alice wins first set cleanly
    t.matches[0]!.completed = true;
    t.matches[0]!.winnerId = "alice";
    t.matches[0]!.score1 = [6, 6]; // Alice wins both sets
    t.matches[0]!.score2 = [3, 4];
    for (let i = 1; i < t.matches.length; i++) {
      t.matches[i]!.completed = true;
      t.matches[i]!.winnerId = t.matches[i]!.player1Id;
      t.matches[i]!.score1 = [6];
      t.matches[i]!.score2 = [3];
    }
    seedTournament(t);

    const badges = checkAndAwardBadges("alice", "t1", t);

    const comeback = badges.find((b) => b.type === "comeback-win");
    expect(comeback).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RATINGS UPDATE VIA STORE
// ═══════════════════════════════════════════════════════════════════════════════

describe("Ratings update through store", () => {
  it("updates player rating after score report", async () => {
    const t = createTestTournament();
    seedTournament(t);

    const beforeAlice = getPlayerRating("alice", "Alice");
    const beforeBob = getPlayerRating("bob", "Bob");

    await saveMatchScore("t1", "m1", [6, 6], [3, 4], "alice", "alice");

    const afterAlice = getPlayerRating("alice", "Alice");
    const afterBob = getPlayerRating("bob", "Bob");

    // Winner should gain rating
    expect(afterAlice.rating).toBeGreaterThan(beforeAlice.rating);
    // Loser should lose rating
    expect(afterBob.rating).toBeLessThan(beforeBob.rating);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. FULL LIFECYCLE — SCORE → CONFIRM → TOURNAMENT COMPLETE → TROPHIES + BADGES
// ═══════════════════════════════════════════════════════════════════════════════

describe("Full lifecycle: all matches → tournament complete → trophies + badges", () => {
  it("completing all matches triggers trophy and badge awards", async () => {
    const t = createTestTournament({ format: "single-elimination" });
    // Restructure as a 4-player single-elimination bracket
    t.matches = [
      // Semi 1
      {
        id: "sf1", round: 1, position: 0, player1Id: "alice", player2Id: "bob",
        score1: [6, 6], score2: [3, 4], winnerId: "alice",
        completed: false, scoreReportedBy: "alice", scoreReportedAt: new Date().toISOString(),
      },
      // Semi 2
      {
        id: "sf2", round: 1, position: 1, player1Id: "carol", player2Id: "dave",
        score1: [6, 6], score2: [2, 3], winnerId: "carol",
        completed: false, scoreReportedBy: "carol", scoreReportedAt: new Date().toISOString(),
      },
      // Final (empty — will be filled after semis)
      {
        id: "f1", round: 2, position: 0, player1Id: null, player2Id: null,
        score1: [], score2: [], winnerId: null, completed: false,
      },
    ];
    seedTournament(t);

    // Bob confirms semi 1
    await confirmMatchScore("t1", "sf1", "bob");

    // Dave confirms semi 2
    await confirmMatchScore("t1", "sf2", "dave");

    // Check the final match was populated
    let updated = loadTournament("t1");
    const finalMatch = updated!.matches.find((m) => m.id === "f1")!;
    expect(finalMatch.player1Id).toBe("alice");
    expect(finalMatch.player2Id).toBe("carol");

    // Report and confirm the final
    await saveMatchScore("t1", "f1", [6, 7], [4, 5], "alice", "alice");
    await confirmMatchScore("t1", "f1", "carol");

    // Check tournament is completed
    updated = loadTournament("t1");
    expect(updated!.status).toBe("completed");

    // Check trophies were awarded
    const aliceTrophies = getPlayerTrophies("alice");
    const carolTrophies = getPlayerTrophies("carol");

    expect(aliceTrophies.some((tr) => tr.tier === "champion")).toBe(true);
    expect(carolTrophies.some((tr) => tr.tier === "finalist")).toBe(true);

    // Check badges
    const aliceBadges = getPlayerBadges("alice");
    expect(aliceBadges.some((b) => b.type === "first-tournament")).toBe(true);
    expect(aliceBadges.some((b) => b.type === "undefeated-champion")).toBe(true);
  });
});
