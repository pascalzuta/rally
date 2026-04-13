import { randomUUID } from "node:crypto";
import type { Match, Tournament } from "@rally/core";
import { generateRoundRobin, computeStandings } from "@rally/core";
import type { AvailabilityRepo, DeviceTokenRepo, MatchRepo, NotificationRepo, PlayerRepo, PoolRepo, TournamentRepo } from "../repo/interfaces.js";
import type { Logger } from "pino";
import { autoScheduleTournament } from "./autoScheduler.js";
import { findOverlaps, buildProposalsFromOverlaps } from "./scheduler.js";
import {
  PACE_RULES,
  addAutoAction,
  addDays,
  applySingleForfeit,
  applyMutualForfeit,
  daysSince,
  determineFault,
} from "./paceRules.js";
import { NotificationService } from "./notificationService.js";
import { NOTIFICATION_TEMPLATES } from "./notificationTemplates.js";

/** Default engine tick interval in milliseconds */
const DEFAULT_TICK_INTERVAL_MS = 30_000;

/** Days after registration opens before min-player activation triggers */
const REGISTRATION_WINDOW_DAYS = 7;

/** Minimum number of standings entries required to create finals bracket */
const MIN_STANDINGS_FOR_FINALS = 4;

/** Hours before a disputed result is auto-confirmed */
const AUTO_RESOLVE_HOURS = 48;

interface EngineDeps {
  pool: PoolRepo;
  tournaments: TournamentRepo;
  matches: MatchRepo;
  players: PlayerRepo;
  availability: AvailabilityRepo;
  notifications: NotificationRepo;
  deviceTokens?: DeviceTokenRepo;
  logger: Logger;
}

export class TournamentEngine {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private notificationService: NotificationService;

  constructor(private deps: EngineDeps, private intervalMs = DEFAULT_TICK_INTERVAL_MS) {
    this.notificationService = new NotificationService(deps.notifications, deps.logger, deps.deviceTokens);
  }

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
    if (this.ticking) return; // Prevent overlapping ticks
    this.ticking = true;
    try {
      // Pace rule enforcement (strictest first)
      await this.enforceHardDeadline();
      await this.enforceRoundRobinDeadline();
      await this.enforcePendingDeadlines();
      await this.enforceSchedulingDeadlines();
      await this.enforceScoreDeadlines();
      await this.processReminders();

      // Existing lifecycle
      await this.processPoolSignups();
      await this.checkRegistrationWindows();
      await this.checkFinals();
      await this.checkTournamentCompletion();
      await this.autoResolveDisputes();

      // Flush notification queue
      await this.notificationService.processQueue();
    } catch (err) {
      this.deps.logger.error({ err }, "TournamentEngine tick error");
    } finally {
      this.ticking = false;
    }
  }

  /** Public method: check if a specific tournament should be activated (e.g. after join) */
  async activateTournamentIfReady(tournamentId: string): Promise<boolean> {
    const t = await this.deps.tournaments.findById(tournamentId);
    if (!t || t.status !== "registration") return false;

    const enoughPlayers = t.playerIds.length >= t.maxPlayers;
    const minMetAndExpired =
      t.playerIds.length >= t.minPlayers && this.daysSince(t.registrationOpenedAt) >= REGISTRATION_WINDOW_DAYS;

    if (enoughPlayers || minMetAndExpired) {
      await this.activateTournament(t);
      return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PACE RULE ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Hard Deadline (Day 32) ─────────────────────────────────────────────────

  private async enforceHardDeadline(): Promise<void> {
    const tournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    const now = Date.now();
    for (const t of tournaments) {
      if (!t.hardDeadline) continue;
      if (new Date(t.hardDeadline).getTime() > now) continue;

      // Forfeit ALL remaining non-completed matches
      const matches = await this.deps.matches.findByTournament(t.id);
      for (const m of matches) {
        if (m.status === "completed") continue;
        await this.forfeitMatch(m, t);
      }

      // Recompute standings and complete
      const allMatches = await this.deps.matches.findByTournament(t.id);
      t.standings = computeStandings(t.playerIds, allMatches);
      t.status = "completed";
      await this.deps.tournaments.save(t);

      // Notify all players
      for (const pid of t.playerIds) {
        const player = await this.deps.players.findById(pid);
        const content = NOTIFICATION_TEMPLATES["N-04"]({
          tournamentName: t.name,
          playerName: player?.name ?? "Player",
        });
        await this.notificationService.queueNotification({
          playerId: pid,
          tournamentId: t.id,
          type: "N-04",
          ...content,
        });
      }

      this.deps.logger.info({ tournamentId: t.id }, "Hard deadline reached — tournament completed");
    }
  }

  // ── Round-Robin Deadline (Day 18) ──────────────────────────────────────────

  private async enforceRoundRobinDeadline(): Promise<void> {
    const tournaments = await this.deps.tournaments.listByStatus("active");
    const now = Date.now();

    for (const t of tournaments) {
      if (!t.roundRobinDeadline) continue;
      if (new Date(t.roundRobinDeadline).getTime() > now) continue;

      // Forfeit remaining round-robin matches
      const matches = await this.deps.matches.findByTournament(t.id);
      const rrMatchIds = new Set(
        t.rounds.flatMap((r) => r.pairings.map((p) => p.matchId).filter(Boolean))
      );

      for (const m of matches) {
        if (m.status === "completed") continue;
        if (!rrMatchIds.has(m.id)) continue;
        await this.forfeitMatch(m, t);
      }

      // Recompute standings and check if we can do finals
      const allMatches = await this.deps.matches.findByTournament(t.id);
      const rrMatches = allMatches.filter((m) => rrMatchIds.has(m.id));
      t.standings = computeStandings(t.playerIds, rrMatches);

      // Transition to finals if possible, otherwise complete
      if (t.standings.length >= MIN_STANDINGS_FOR_FINALS) {
        await this.createFinals(t);
      } else {
        t.status = "completed";
      }

      await this.deps.tournaments.save(t);
      this.deps.logger.info({ tournamentId: t.id }, "Round-robin deadline reached");
    }
  }

  // ── Pending Deadlines (7 days) ─────────────────────────────────────────────

  private async enforcePendingDeadlines(): Promise<void> {
    const tournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    for (const t of tournaments) {
      const matches = await this.deps.matches.findByTournament(t.id);

      for (const m of matches) {
        if (m.status !== "pending" || !m.deadlineStartedAt) continue;
        if (daysSince(m.deadlineStartedAt) < PACE_RULES.PENDING_DEADLINE_DAYS) continue;

        if (m.schedulingTier === 2 && m.nearMiss) {
          // Tier 2: auto-accept the flex suggestion
          await this.autoFlexMatch(m, t);
        } else {
          // Tier 3: auto-propose from challenger's availability
          await this.autoProposeMatch(m, t);
        }
      }
    }
  }

  // ── Scheduling Deadlines (5 days) ──────────────────────────────────────────

  private async enforceSchedulingDeadlines(): Promise<void> {
    const tournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    for (const t of tournaments) {
      const matches = await this.deps.matches.findByTournament(t.id);

      for (const m of matches) {
        if (m.status !== "scheduling" || !m.proposalsCreatedAt) continue;
        if (daysSince(m.proposalsCreatedAt) < PACE_RULES.SCHEDULING_DEADLINE_DAYS) continue;

        // Auto-accept the earliest proposal
        await this.autoAcceptEarliestProposal(m, t);
      }
    }
  }

  // ── Score Deadlines (3 days post-match) ────────────────────────────────────

  private async enforceScoreDeadlines(): Promise<void> {
    const tournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    for (const t of tournaments) {
      const matches = await this.deps.matches.findByTournament(t.id);

      for (const m of matches) {
        if (m.status !== "scheduled" || !m.scheduledAt) continue;

        const matchDate = new Date(m.scheduledAt);
        if (matchDate.getTime() > Date.now()) continue; // Match hasn't happened yet

        const daysAfterMatch = daysSince(m.scheduledAt);
        // Cap at SCORE_DEADLINE_CAP_DAYS
        const deadline = Math.min(PACE_RULES.SCORE_DEADLINE_DAYS, PACE_RULES.SCORE_DEADLINE_CAP_DAYS);
        if (daysAfterMatch < deadline) continue;

        // Check if one player submitted via pendingResults
        const report = t.pendingResults[m.id];
        if (report) {
          // One player submitted — auto-confirm
          const now = new Date().toISOString();
          const updated: Match = {
            ...m,
            status: "completed",
            result: {
              winnerId: report.winnerId,
              sets: report.sets,
              reportedBy: report.reportedBy,
              reportedAt: report.reportedAt,
              confirmedBy: "auto",
              confirmedAt: now,
            },
            updatedAt: now,
          };
          addAutoAction(updated, "auto-forfeit", "Score auto-confirmed after deadline");
          await this.deps.matches.save(updated);
          delete t.pendingResults[m.id];
          await this.deps.tournaments.save(t);

          this.deps.logger.info({ matchId: m.id }, "Score auto-confirmed after deadline");
        } else {
          // Neither submitted — forfeit based on activity
          await this.forfeitMatch(m, t);
        }
      }
    }
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  private async processReminders(): Promise<void> {
    const tournaments = [
      ...(await this.deps.tournaments.listByStatus("active")),
      ...(await this.deps.tournaments.listByStatus("finals")),
    ];

    for (const t of tournaments) {
      // Round-robin week warning
      if (t.status === "active" && t.activatedAt) {
        const elapsed = daysSince(t.activatedAt);
        if (elapsed >= PACE_RULES.ROUND_ROBIN_WEEK_WARNING_DAY && elapsed < PACE_RULES.ROUND_ROBIN_WEEK_WARNING_DAY + 1) {
          for (const pid of t.playerIds) {
            const player = await this.deps.players.findById(pid);
            const content = NOTIFICATION_TEMPLATES["N-02"]({
              tournamentName: t.name,
              playerName: player?.name ?? "Player",
            });
            await this.notificationService.queueNotification({
              playerId: pid,
              tournamentId: t.id,
              type: "N-02",
              ...content,
            });
          }
        }
      }

      const matches = await this.deps.matches.findByTournament(t.id);

      for (const m of matches) {
        // Pending match reminders
        if (m.status === "pending" && m.deadlineStartedAt) {
          const elapsed = daysSince(m.deadlineStartedAt);
          await this.sendMatchReminder(m, t, elapsed, "pending");
        }

        // Scheduling reminders
        if (m.status === "scheduling" && m.proposalsCreatedAt) {
          const elapsed = daysSince(m.proposalsCreatedAt);
          await this.sendMatchReminder(m, t, elapsed, "scheduling");
        }

        // Score reminders
        if (m.status === "scheduled" && m.scheduledAt) {
          const matchDate = new Date(m.scheduledAt);
          if (matchDate.getTime() < Date.now()) {
            const elapsed = daysSince(m.scheduledAt);
            await this.sendMatchReminder(m, t, elapsed, "score");
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PACE RULE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private async forfeitMatch(m: Match, t: Tournament): Promise<void> {
    const fault = determineFault(m);
    let updated: Match;

    if (fault === "mutual") {
      updated = applyMutualForfeit(m);
      addAutoAction(updated, "auto-forfeit", "Mutual no-show");

      // Notify both
      for (const pid of [m.challengerId, m.opponentId]) {
        const player = await this.deps.players.findById(pid);
        const opponentId = pid === m.challengerId ? m.opponentId : m.challengerId;
        const opponent = await this.deps.players.findById(opponentId);
        const content = NOTIFICATION_TEMPLATES["N-51"]({
          playerName: player?.name ?? "Player",
          opponentName: opponent?.name ?? "Opponent",
        });
        await this.notificationService.queueNotification({
          playerId: pid,
          matchId: m.id,
          tournamentId: t.id,
          type: "N-51",
          ...content,
        });
      }
    } else {
      const responsiveId = fault === "opponent" ? m.challengerId : m.opponentId;
      const forfeitedId = fault === "opponent" ? m.opponentId : m.challengerId;
      updated = applySingleForfeit(m, responsiveId);
      addAutoAction(updated, "auto-forfeit", `${fault} forfeited`);

      // Notify responsive player
      const responsive = await this.deps.players.findById(responsiveId);
      const forfeited = await this.deps.players.findById(forfeitedId);
      const respContent = NOTIFICATION_TEMPLATES["N-50-responsive"]({
        playerName: responsive?.name ?? "Player",
        opponentName: forfeited?.name ?? "Opponent",
      });
      await this.notificationService.queueNotification({
        playerId: responsiveId,
        matchId: m.id,
        tournamentId: t.id,
        type: "N-50-responsive",
        ...respContent,
      });

      // Notify forfeited player
      const forfContent = NOTIFICATION_TEMPLATES["N-50-forfeited"]({
        playerName: forfeited?.name ?? "Player",
        opponentName: responsive?.name ?? "Opponent",
      });
      await this.notificationService.queueNotification({
        playerId: forfeitedId,
        matchId: m.id,
        tournamentId: t.id,
        type: "N-50-forfeited",
        ...forfContent,
      });
    }

    await this.deps.matches.save(updated);
    this.deps.logger.info({ matchId: m.id, fault }, "Match forfeited");
  }

  private async autoFlexMatch(m: Match, t: Tournament): Promise<void> {
    const nearMiss = m.nearMiss!;
    const flexedStart = nearMiss.flexedWindow.startTime;
    const dateStr = nearMiss.date.slice(0, 10);
    const scheduledAt = `${dateStr}T${flexedStart}:00`;

    const proposal = {
      id: randomUUID(),
      datetime: scheduledAt,
      label: `Auto-flexed: ${dateStr} ${flexedStart}`,
      acceptedBy: [m.challengerId, m.opponentId],
    };

    const updated: Match = {
      ...m,
      status: "scheduled" as const,
      proposals: [proposal],
      scheduledAt,
      updatedAt: new Date().toISOString(),
    };
    addAutoAction(updated, "auto-flex", `Flex from near-miss on ${dateStr}`);
    await this.deps.matches.save(updated);

    // Notify both
    for (const pid of [m.challengerId, m.opponentId]) {
      const player = await this.deps.players.findById(pid);
      const opponentId = pid === m.challengerId ? m.opponentId : m.challengerId;
      const opponent = await this.deps.players.findById(opponentId);
      const content = NOTIFICATION_TEMPLATES["N-14"]({
        playerName: player?.name ?? "Player",
        opponentName: opponent?.name ?? "Opponent",
        datetime: proposal.label,
      });
      await this.notificationService.queueNotification({
        playerId: pid,
        matchId: m.id,
        tournamentId: t.id,
        type: "N-14",
        ...content,
      });
    }

    this.deps.logger.info({ matchId: m.id }, "Auto-flexed pending match");
  }

  private async autoProposeMatch(m: Match, t: Tournament): Promise<void> {
    // Generate proposals from challenger's availability
    const slotsA = await this.deps.availability.getByPlayer(m.challengerId);
    const slotsB = await this.deps.availability.getByPlayer(m.opponentId);
    const overlaps = findOverlaps(slotsA, slotsB, new Date());

    let proposals;
    if (overlaps.length > 0) {
      proposals = buildProposalsFromOverlaps(overlaps);
    } else {
      // No overlap — build from challenger's availability alone
      const fakeOverlaps = slotsA.slice(0, 3).map((s) => {
        const d = new Date();
        d.setDate(d.getDate() + ((s.dayOfWeek - d.getDay() + 7) % 7 || 7));
        return { date: d, startTime: s.startTime, endTime: s.endTime };
      });
      proposals = buildProposalsFromOverlaps(fakeOverlaps);
    }

    // Mark proposer as auto-accepted
    for (const p of proposals) {
      p.acceptedBy = [m.challengerId];
    }

    const now = new Date().toISOString();
    const updated: Match = {
      ...m,
      status: "scheduling" as const,
      proposals,
      proposalsCreatedAt: now,
      deadlineStartedAt: now, // Reset for scheduling phase clock
      updatedAt: now,
    };
    addAutoAction(updated, "auto-propose", "System auto-proposed after pending deadline");
    await this.deps.matches.save(updated);

    // Notify both
    const challenger = await this.deps.players.findById(m.challengerId);
    const opponent = await this.deps.players.findById(m.opponentId);

    const challContent = NOTIFICATION_TEMPLATES["N-23"]({
      playerName: challenger?.name ?? "Player",
      opponentName: opponent?.name ?? "Opponent",
    });
    await this.notificationService.queueNotification({
      playerId: m.challengerId,
      matchId: m.id,
      tournamentId: t.id,
      type: "N-23",
      ...challContent,
    });

    const oppContent = NOTIFICATION_TEMPLATES["N-24"]({
      playerName: opponent?.name ?? "Player",
      opponentName: challenger?.name ?? "Challenger",
    });
    await this.notificationService.queueNotification({
      playerId: m.opponentId,
      matchId: m.id,
      tournamentId: t.id,
      type: "N-24",
      ...oppContent,
    });

    this.deps.logger.info({ matchId: m.id }, "Auto-proposed for pending match");
  }

  private async autoAcceptEarliestProposal(m: Match, t: Tournament): Promise<void> {
    // Pick earliest proposal
    const sorted = [...m.proposals].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    const earliest = sorted[0];
    if (!earliest) return;

    const updated: Match = {
      ...m,
      status: "scheduled" as const,
      proposals: m.proposals.map((p) =>
        p.id === earliest.id
          ? { ...p, acceptedBy: [m.challengerId, m.opponentId] }
          : p
      ),
      scheduledAt: earliest.datetime,
      updatedAt: new Date().toISOString(),
    };
    addAutoAction(updated, "auto-accept", `Auto-accepted earliest proposal: ${earliest.label}`);
    await this.deps.matches.save(updated);

    // Notify both
    for (const pid of [m.challengerId, m.opponentId]) {
      const player = await this.deps.players.findById(pid);
      const opponentId = pid === m.challengerId ? m.opponentId : m.challengerId;
      const opponent = await this.deps.players.findById(opponentId);
      const content = NOTIFICATION_TEMPLATES["N-27"]({
        playerName: player?.name ?? "Player",
        opponentName: opponent?.name ?? "Opponent",
        datetime: earliest.label,
      });
      await this.notificationService.queueNotification({
        playerId: pid,
        matchId: m.id,
        tournamentId: t.id,
        type: "N-27",
        ...content,
      });
    }

    this.deps.logger.info({ matchId: m.id }, "Auto-accepted earliest proposal");
  }

  private async sendMatchReminder(
    m: Match,
    t: Tournament,
    elapsed: number,
    phase: "pending" | "scheduling" | "score"
  ): Promise<void> {
    const challenger = await this.deps.players.findById(m.challengerId);
    const opponent = await this.deps.players.findById(m.opponentId);
    const challName = challenger?.name ?? "Player";
    const oppName = opponent?.name ?? "Opponent";

    let type: string | null = null;

    if (phase === "pending") {
      if (elapsed >= PACE_RULES.PENDING_FINAL_WARNING_DAY && elapsed < PACE_RULES.PENDING_DEADLINE_DAYS) {
        type = m.schedulingTier === 2 ? "N-13" : "N-22";
      } else if (elapsed >= PACE_RULES.PENDING_REMINDER_2_DAY && elapsed < PACE_RULES.PENDING_FINAL_WARNING_DAY) {
        type = m.schedulingTier === 2 ? "N-12" : "N-21";
      } else if (elapsed >= PACE_RULES.PENDING_REMINDER_1_DAY && elapsed < PACE_RULES.PENDING_REMINDER_2_DAY) {
        type = m.schedulingTier === 2 ? "N-11" : "N-21";
      }
    } else if (phase === "scheduling") {
      if (elapsed >= PACE_RULES.SCHEDULING_REMINDER_2_DAY && elapsed < PACE_RULES.SCHEDULING_DEADLINE_DAYS) {
        type = "N-26";
      } else if (elapsed >= PACE_RULES.SCHEDULING_REMINDER_1_DAY && elapsed < PACE_RULES.SCHEDULING_REMINDER_2_DAY) {
        type = "N-25";
      }
    } else if (phase === "score") {
      if (elapsed >= PACE_RULES.SCORE_REMINDER_2_DAY && elapsed < PACE_RULES.SCORE_DEADLINE_DAYS) {
        type = "N-41";
      } else if (elapsed >= PACE_RULES.SCORE_REMINDER_1_DAY && elapsed < PACE_RULES.SCORE_REMINDER_2_DAY) {
        type = "N-40";
      }
    }

    if (!type) return;

    // Send to both players
    for (const pid of [m.challengerId, m.opponentId]) {
      const pName = pid === m.challengerId ? challName : oppName;
      const oName = pid === m.challengerId ? oppName : challName;

      const templateFn = NOTIFICATION_TEMPLATES[type as keyof typeof NOTIFICATION_TEMPLATES];
      if (!templateFn) continue;

      // All reminder templates take { playerName, opponentName }
      const content = (templateFn as (p: { playerName: string; opponentName: string }) => { subject: string; body: string })({
        playerName: pName,
        opponentName: oName,
      });

      await this.notificationService.queueNotification({
        playerId: pid,
        matchId: m.id,
        tournamentId: t.id,
        type,
        ...content,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXISTING LIFECYCLE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

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
        t.playerIds.length >= t.minPlayers && this.daysSince(t.registrationOpenedAt) >= REGISTRATION_WINDOW_DAYS;

      if (enoughPlayers || minMetAndExpired) {
        await this.activateTournament(t);
      }
    }
  }

  private async activateTournament(t: Tournament): Promise<void> {
    const playerCount = t.playerIds.length;
    const rounds = generateRoundRobin(playerCount);
    const now = new Date();
    const nowIso = now.toISOString();

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
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        await this.deps.matches.save(match);
      }
    }

    t.rounds = rounds;

    // Compute initial standings (all zeroes)
    const tournamentMatches = await this.deps.matches.findByTournament(t.id);
    t.standings = computeStandings(t.playerIds, tournamentMatches);
    t.status = "active";

    // ── Set pace-rule deadlines ──
    t.activatedAt = nowIso;
    t.hardDeadline = addDays(now, PACE_RULES.HARD_DEADLINE_DAYS);
    t.roundRobinDeadline = addDays(now, PACE_RULES.ROUND_ROBIN_DAYS);

    // Auto-schedule matches based on player availability
    const playerAvailability = new Map<string, import("@rally/core").AvailabilitySlot[]>();
    // Collect existing scheduled matches for all players to prevent same-day conflicts
    const existingScheduledMatches: import("@rally/core").Match[] = [];
    for (const pid of t.playerIds) {
      const slots = await this.deps.availability.getByPlayer(pid);
      playerAvailability.set(pid, slots);
      const playerMatches = await this.deps.matches.findByPlayer(pid);
      for (const m of playerMatches) {
        if (m.tournamentId !== t.id && m.status === "scheduled" && m.scheduledAt) {
          existingScheduledMatches.push(m);
        }
      }
    }

    const { result: schedulingResult, updatedMatches } = await autoScheduleTournament(
      tournamentMatches,
      playerAvailability,
      now,
      existingScheduledMatches
    );

    // Save updated matches — set deadlineStartedAt on unscheduled (Tier 2/3)
    for (const m of updatedMatches) {
      if (m.status === "pending") {
        m.deadlineStartedAt = nowIso;
      }
      await this.deps.matches.save(m);
    }

    t.schedulingResult = schedulingResult;
    await this.deps.tournaments.save(t);

    // Notify all players (N-01)
    for (const pid of t.playerIds) {
      const player = await this.deps.players.findById(pid);
      const content = NOTIFICATION_TEMPLATES["N-01"]({
        county: t.county,
        tournamentName: t.name,
        playerName: player?.name ?? "Player",
      });
      await this.notificationService.queueNotification({
        playerId: pid,
        tournamentId: t.id,
        type: "N-01",
        ...content,
      });
    }

    this.deps.logger.info(
      { tournamentId: t.id, playerCount, scheduledCount: schedulingResult.scheduledCount, totalMatches: tournamentMatches.length },
      "Activated tournament"
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

      if (t.standings.length < MIN_STANDINGS_FOR_FINALS) continue;

      await this.createFinals(t);
      await this.deps.tournaments.save(t);
      this.deps.logger.info({ tournamentId: t.id }, "Tournament moved to finals");
    }
  }

  private async createFinals(t: Tournament): Promise<void> {
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
      deadlineStartedAt: now,
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
      deadlineStartedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await this.deps.matches.save(thirdMatch);

    t.finalsMatches = { champMatchId, thirdMatchId };
    t.status = "finals";

    // Notify top 4 (N-03)
    for (const entry of [first, second, third, fourth]) {
      const player = await this.deps.players.findById(entry.playerId);
      const content = NOTIFICATION_TEMPLATES["N-03"]({
        tournamentName: t.name,
        playerName: player?.name ?? "Player",
      });
      await this.notificationService.queueNotification({
        playerId: entry.playerId,
        tournamentId: t.id,
        type: "N-03",
        ...content,
      });
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

        // Notify all players (N-04)
        for (const pid of t.playerIds) {
          const player = await this.deps.players.findById(pid);
          const content = NOTIFICATION_TEMPLATES["N-04"]({
            tournamentName: t.name,
            playerName: player?.name ?? "Player",
          });
          await this.notificationService.queueNotification({
            playerId: pid,
            tournamentId: t.id,
            type: "N-04",
            ...content,
          });
        }

        this.deps.logger.info({ tournamentId: t.id }, "Tournament completed");
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
    const autoResolveMs = AUTO_RESOLVE_HOURS * 60 * 60 * 1000;

    for (const t of activeTournaments) {
      let changed = false;

      for (const [matchId, report] of Object.entries(t.pendingResults)) {
        const reportedAt = new Date(report.reportedAt).getTime();
        if (now - reportedAt < autoResolveMs) continue;

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

        this.deps.logger.info({ matchId }, "Auto-confirmed disputed result");
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
