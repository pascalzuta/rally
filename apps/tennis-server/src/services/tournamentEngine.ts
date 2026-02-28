import { randomUUID } from "node:crypto";
import type { Match, Tournament } from "@rally/core";
import { generateRoundRobin, computeStandings } from "@rally/core";
import type { AvailabilityRepo, MatchRepo, PlayerRepo, PoolRepo, TournamentRepo } from "../repo/interfaces.js";
import { autoScheduleTournament } from "./autoScheduler.js";

interface EngineDeps {
  pool: PoolRepo;
  tournaments: TournamentRepo;
  matches: MatchRepo;
  players: PlayerRepo;
  availability: AvailabilityRepo;
}

export class TournamentEngine {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private deps: EngineDeps, private intervalMs = 30_000) {}

  start(): void {
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick(): Promise<void> {
    try {
      await this.processPoolSignups();
      await this.checkRegistrationWindows();
      await this.checkFinals();
      await this.checkTournamentCompletion();
      await this.autoResolveDisputes();
    } catch (err) {
      console.error("[TournamentEngine] tick error:", err);
    }
  }

  /** Public method: check if a specific tournament should be activated (e.g. after join) */
  async activateTournamentIfReady(tournamentId: string): Promise<boolean> {
    const t = await this.deps.tournaments.findById(tournamentId);
    if (!t || t.status !== "registration") return false;

    const enoughPlayers = t.playerIds.length >= t.maxPlayers;
    const minMetAndExpired =
      t.playerIds.length >= t.minPlayers && this.daysSince(t.registrationOpenedAt) >= 7;

    if (enoughPlayers || minMetAndExpired) {
      await this.activateTournament(t);
      return true;
    }
    return false;
  }

  // ── Pool → Registration ──────────────────────────────────────────────────

  private async processPoolSignups(): Promise<void> {
    const tournaments = await this.deps.tournaments.listByStatus("registration");

    for (const t of tournaments) {
      const entries = await this.deps.pool.findByCountyAndBand(t.county, t.band);
      const newEntries = entries.filter((e) => !t.playerIds.includes(e.playerId));

      if (newEntries.length === 0) continue;

      for (const entry of newEntries) {
        t.playerIds.push(entry.playerId);
      }

      await this.deps.pool.removeMany(newEntries.map((e) => e.playerId));
      await this.deps.tournaments.save(t);

      if (t.playerIds.length >= t.maxPlayers) {
        await this.activateTournament(t);
      }
    }
  }

  // ── Registration → Active ─────────────────────────────────────────────────

  private async checkRegistrationWindows(): Promise<void> {
    const tournaments = await this.deps.tournaments.listByStatus("registration");

    for (const t of tournaments) {
      const enoughPlayers = t.playerIds.length >= t.maxPlayers;
      const minMetAndExpired =
        t.playerIds.length >= t.minPlayers && this.daysSince(t.registrationOpenedAt) >= 7;

      if (enoughPlayers || minMetAndExpired) {
        await this.activateTournament(t);
      }
    }
  }

  private async activateTournament(t: Tournament): Promise<void> {
    const playerCount = t.playerIds.length;
    const rounds = generateRoundRobin(playerCount);
    const now = new Date().toISOString();

    // Create Match entities for every pairing that is not a bye
    for (const round of rounds) {
      for (const pairing of round.pairings) {
        if (pairing.homeIndex === -1 || pairing.awayIndex === -1) continue;

        const challengerId = t.playerIds[pairing.homeIndex];
        const opponentId = t.playerIds[pairing.awayIndex];
        if (!challengerId || !opponentId) continue;

        const matchId = randomUUID();
        pairing.matchId = matchId;

        const match: Match = {
          id: matchId,
          challengerId,
          opponentId,
          tournamentId: t.id,
          status: "pending",
          proposals: [],
          createdAt: now,
          updatedAt: now,
        };

        await this.deps.matches.save(match);
      }
    }

    t.rounds = rounds;

    // Compute initial standings (all zeroes)
    const tournamentMatches = await this.deps.matches.findByTournament(t.id);
    t.standings = computeStandings(t.playerIds, tournamentMatches);
    t.status = "active";

    // Auto-schedule matches based on player availability
    const playerAvailability = new Map<string, import("@rally/core").AvailabilitySlot[]>();
    for (const pid of t.playerIds) {
      const slots = await this.deps.availability.getByPlayer(pid);
      playerAvailability.set(pid, slots);
    }

    const { result: schedulingResult, updatedMatches } = await autoScheduleTournament(
      tournamentMatches,
      playerAvailability,
      new Date()
    );

    // Save updated matches with scheduling info
    for (const m of updatedMatches) {
      await this.deps.matches.save(m);
    }

    t.schedulingResult = schedulingResult;
    await this.deps.tournaments.save(t);
    console.log(
      `[TournamentEngine] Activated tournament ${t.id} with ${playerCount} players. ` +
      `Scheduled ${schedulingResult.scheduledCount}/${tournamentMatches.length} matches.`
    );
  }

  // ── Active → Finals ───────────────────────────────────────────────────────

  private async checkFinals(): Promise<void> {
    const tournaments = await this.deps.tournaments.listByStatus("active");

    for (const t of tournaments) {
      const matches = await this.deps.matches.findByTournament(t.id);

      // All round-robin matches must be completed
      const roundRobinMatches = matches.filter((m) =>
        t.rounds.some((r) =>
          r.pairings.some((p) => p.matchId === m.id)
        )
      );

      const allCompleted = roundRobinMatches.length > 0 &&
        roundRobinMatches.every((m) => m.status === "completed");

      if (!allCompleted) continue;

      // Recompute standings
      t.standings = computeStandings(t.playerIds, roundRobinMatches);

      if (t.standings.length < 4) continue;

      const first = t.standings[0]!;
      const second = t.standings[1]!;
      const third = t.standings[2]!;
      const fourth = t.standings[3]!;

      const now = new Date().toISOString();

      // Create championship match: #1 vs #2
      const champMatchId = randomUUID();
      const champMatch: Match = {
        id: champMatchId,
        challengerId: first.playerId,
        opponentId: second.playerId,
        tournamentId: t.id,
        status: "pending",
        proposals: [],
        createdAt: now,
        updatedAt: now,
      };
      await this.deps.matches.save(champMatch);

      // Create third-place match: #3 vs #4
      const thirdMatchId = randomUUID();
      const thirdMatch: Match = {
        id: thirdMatchId,
        challengerId: third.playerId,
        opponentId: fourth.playerId,
        tournamentId: t.id,
        status: "pending",
        proposals: [],
        createdAt: now,
        updatedAt: now,
      };
      await this.deps.matches.save(thirdMatch);

      t.finalsMatches = { champMatchId, thirdMatchId };
      t.status = "finals";

      await this.deps.tournaments.save(t);
      console.log(`[TournamentEngine] Tournament ${t.id} moved to finals`);
    }
  }

  // ── Finals → Completed ────────────────────────────────────────────────────

  private async checkTournamentCompletion(): Promise<void> {
    const tournaments = await this.deps.tournaments.listByStatus("finals");

    for (const t of tournaments) {
      if (!t.finalsMatches?.champMatchId || !t.finalsMatches?.thirdMatchId) continue;

      const champMatch = await this.deps.matches.findById(t.finalsMatches.champMatchId);
      const thirdMatch = await this.deps.matches.findById(t.finalsMatches.thirdMatchId);

      if (
        champMatch?.status === "completed" &&
        thirdMatch?.status === "completed"
      ) {
        // Recompute final standings with all matches
        const allMatches = await this.deps.matches.findByTournament(t.id);
        t.standings = computeStandings(t.playerIds, allMatches);
        t.status = "completed";

        await this.deps.tournaments.save(t);
        console.log(`[TournamentEngine] Tournament ${t.id} completed`);
      }
    }
  }

  // ── Auto-resolve disputed results ─────────────────────────────────────────

  private async autoResolveDisputes(): Promise<void> {
    const activeTournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    const now = Date.now();
    const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

    for (const t of activeTournaments) {
      let changed = false;

      for (const [matchId, report] of Object.entries(t.pendingResults)) {
        const reportedAt = new Date(report.reportedAt).getTime();
        if (now - reportedAt < FORTY_EIGHT_HOURS) continue;

        // Auto-confirm the pending result
        const match = await this.deps.matches.findById(matchId);
        if (!match) continue;

        match.result = {
          winnerId: report.winnerId,
          sets: report.sets,
          reportedBy: report.reportedBy,
          reportedAt: report.reportedAt,
          confirmedBy: "auto",
          confirmedAt: new Date().toISOString(),
        };
        match.status = "completed";
        match.updatedAt = new Date().toISOString();

        await this.deps.matches.save(match);
        delete t.pendingResults[matchId];
        changed = true;

        console.log(`[TournamentEngine] Auto-confirmed result for match ${matchId}`);
      }

      if (changed) {
        // Recompute standings after auto-resolving
        const matches = await this.deps.matches.findByTournament(t.id);
        t.standings = computeStandings(t.playerIds, matches);
        await this.deps.tournaments.save(t);
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private daysSince(isoDate: string): number {
    const then = new Date(isoDate).getTime();
    const now = Date.now();
    return (now - then) / (1000 * 60 * 60 * 24);
  }
}
