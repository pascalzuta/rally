import { randomUUID } from "node:crypto";
import express, { Router } from "express";
import type { Match, Player } from "@rally/core";
import type { Tournament } from "@rally/core";
import {
  acceptTimeSchema,
  challengeSchema,
  loginSchema,
  playerProfileSchema,
  poolSignupSchema,
  reportResultSchema,
  setAvailabilitySchema,
  reportTournamentResultSchema,
  subscriptionCheckoutSchema,
  computeStandings,
  generateRoundRobin,
  skillBandFromNtrp
} from "@rally/core";
import type { AppConfig } from "../config.js";
import { issueAccessToken, newAuthUser } from "../auth/tokens.js";
import { authMiddleware } from "../middleware/auth.js";
import { applyMatchResult, findNearbyPlayers, newPlayer } from "../domain/rating.js";
import { applyEnhancedMatchResult } from "../domain/rating.js";
import { generateMatchProposals } from "../services/scheduler.js";
import type { AuthRepo, AvailabilityRepo, MatchRepo, PlayerRepo, TournamentRepo } from "../repo/interfaces.js";
import type { PoolRepo } from "../repo/interfaces.js";
import { createCheckoutSession, createPortalSession, handleWebhookEvent, isStripeEnabled } from "../services/stripe.js";
import { searchCities } from "../data/usCities.js";
import { TOURNEY_TEST_PLAYERS } from "./seed.js";
import { seedRichData } from "./seedRich.js";
import { findNearMisses, findOverlaps, formatProposalLabel } from "../services/scheduler.js";
import type { TournamentEngine } from "../services/tournamentEngine.js";

interface RouteDeps {
  config: AppConfig;
  auth: AuthRepo;
  players: PlayerRepo;
  availability: AvailabilityRepo;
  matches: MatchRepo;
  tournaments: TournamentRepo;
  pool: PoolRepo;
  engine: TournamentEngine;
}

export function createRoutes(deps: RouteDeps): Router {
  const router = Router();
  const { config } = deps;

  // ── Health ─────────────────────────────────────────────────────────────────

  router.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // ── Auth ───────────────────────────────────────────────────────────────────

  router.post("/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const email = parsed.data.email.toLowerCase();

    // Find or create auth user
    let authUser = await deps.auth.findByEmail(email);
    if (!authUser) {
      authUser = newAuthUser(email);
      await deps.auth.upsert(authUser);
    }

    // Find or create player profile
    let player = await deps.players.findById(authUser.id);
    if (!player) {
      player = newPlayer(authUser.id, email);
      await deps.players.upsert(player);
    }

    const accessToken = issueAccessToken(authUser, config.AUTH_TOKEN_SECRET);
    res.json({ accessToken, player });
  });

  // ── City search (no auth required) ────────────────────────────────────────

  router.get("/cities/search", (req, res) => {
    const q = (req.query["q"] as string) ?? "";
    if (q.trim().length < 2) { res.json({ results: [] }); return; }
    const limit = Math.min(parseInt(req.query["limit"] as string) || 10, 20);
    const results = searchCities(q, limit);
    res.json({ results });
  });

  // ── Stripe webhook (no auth required) ────────────────────────────────────

  router.post("/subscription/webhook", express.raw({ type: "application/json" }), (req, res) => {
    const sig = req.headers["stripe-signature"] as string | undefined;
    if (!sig) { res.status(400).json({ error: "missing_signature" }); return; }
    const event = handleWebhookEvent(req.body.toString(), sig, deps.config.STRIPE_WEBHOOK_SECRET || "");
    if (!event) { res.status(400).json({ error: "invalid_event" }); return; }
    // Handle subscription events
    if (event.type === "checkout.session.completed" || event.type === "customer.subscription.updated") {
      // In production, update player subscription status based on event.data
      console.log(`Stripe webhook: ${event.type}`);
    }
    res.json({ received: true });
  });

  // ── Debug: simulate tournament start (no auth) ─────────────────────────────

  router.post("/debug/simulate-tournament", async (_req, res) => {
    try {
      const { playerId } = _req.body as { playerId?: string };
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      // If a playerId was provided, include that player first
      const playerIds: string[] = [];
      if (playerId) {
        const p = await deps.players.findById(playerId);
        if (p) {
          playerIds.push(playerId);
        }
      }

      // Look up or create test player IDs and reset their stats to seed values
      for (const spec of TOURNEY_TEST_PLAYERS) {
        let authUser = await deps.auth.findByEmail(spec.email);
        if (!authUser) {
          // Auto-create the test player
          const id = randomUUID();
          authUser = { id, email: spec.email, createdAt: now.toISOString() };
          await deps.auth.upsert(authUser);
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
            createdAt: now.toISOString(),
            updatedAt: now.toISOString()
          };
          await deps.players.upsert(player);
          // Set availability
          const slots = spec.availability.map((s) => ({
            id: randomUUID(),
            playerId: id,
            ...s
          }));
          await deps.availability.setForPlayer(id, slots);
        }
        playerIds.push(authUser.id);
        // Reset player stats to seed values
        const p = await deps.players.findById(authUser.id);
        if (p) {
          p.rating = spec.rating;
          p.ratingConfidence = 0.5;
          p.provisionalRemaining = 3;
          p.wins = spec.wins;
          p.losses = spec.losses;
          p.updatedAt = now.toISOString();
          await deps.players.upsert(p);
        }
      }

      // Remove ALL existing SF County 3.5 test tournaments
      const allTournaments = await deps.tournaments.listAll();
      for (const old of allTournaments) {
        if (old.county === "San Francisco County" && old.band === "3.5") {
          await deps.tournaments.remove(old.id);
        }
      }

      // Create tournament in active status with round-robin
      const tournamentId = randomUUID();
      const rounds = generateRoundRobin(playerIds.length);
      const matchNow = now.toISOString();

      // Create match entities for every pairing
      const updatedRounds = [];
      for (const round of rounds) {
        const updatedPairings = [];
        for (const pairing of round.pairings) {
          if (pairing.homeIndex === -1 || pairing.awayIndex === -1) continue;
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
          await deps.matches.save(m);
          updatedPairings.push({ ...pairing, matchId });
        }
        updatedRounds.push({ ...round, pairings: updatedPairings });
      }

      const standings = computeStandings(playerIds, []);

      const tournament: Tournament = {
        id: tournamentId,
        month: thisMonth,
        name: `Rally League – NTRP 3.5 – ${thisMonth}`,
        county: "San Francisco County",
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
      };

      await deps.tournaments.save(tournament);

      res.json({
        ok: true,
        tournamentId,
        playerCount: playerIds.length,
        matchCount: updatedRounds.reduce((sum, r) => sum + r.pairings.length, 0),
        players: TOURNEY_TEST_PLAYERS.map((p, i) => ({ email: p.email, name: p.name, id: playerIds[i] }))
      });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "failed" });
    }
  });

  // ── Debug: seed rich data (200 players + 10 tournaments) ──────────────────

  router.post("/debug/accept-proposals", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };
      if (!playerId) {
        res.status(400).json({ error: "playerId required" });
        return;
      }
      const matches = await deps.matches.findByPlayer(playerId);
      let accepted = 0;
      for (const match of matches) {
        if (match.status !== "scheduling" || !match.proposals?.length) continue;
        const opponentId = match.challengerId === playerId ? match.opponentId : match.challengerId;
        // Find first proposal the user accepted but opponent hasn't
        const proposal = match.proposals.find(
          (p) => p.acceptedBy.includes(playerId) && !p.acceptedBy.includes(opponentId),
        );
        if (!proposal) continue;
        proposal.acceptedBy.push(opponentId);
        match.status = "scheduled";
        match.scheduledAt = proposal.datetime;
        await deps.matches.save(match);
        accepted++;
      }
      res.json({ ok: true, accepted });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("accept-proposals error:", e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/debug/submit-scores", async (req, res) => {
    try {
      const { playerId } = req.body as { playerId?: string };
      if (!playerId) {
        res.status(400).json({ error: "playerId required" });
        return;
      }
      // Find all tournaments the player is in
      const allTournaments = await deps.tournaments.listAll();
      let submitted = 0;
      for (const tournament of allTournaments) {
        if (!tournament.playerIds.includes(playerId)) continue;
        if (tournament.status !== "active" && tournament.status !== "finals") continue;
        const matches = await deps.matches.findByTournament(tournament.id);
        let tournamentUpdated = false;
        for (const match of matches) {
          if (match.status !== "scheduled") continue;
          const isChallenger = match.challengerId === playerId;
          const isOpponent = match.opponentId === playerId;
          if (!isChallenger && !isOpponent) continue;
          // Skip if already has pending result
          if (tournament.pendingResults[match.id]) continue;
          const opponentId = isChallenger ? match.opponentId : match.challengerId;
          // Opponent reports a win: 6-4, 6-3
          tournament.pendingResults[match.id] = {
            winnerId: opponentId,
            sets: [{ aGames: 6, bGames: 4 }, { aGames: 6, bGames: 3 }],
            reportedBy: opponentId,
            reportedAt: new Date().toISOString(),
          };
          tournamentUpdated = true;
          submitted++;
        }
        if (tournamentUpdated) {
          await deps.tournaments.save(tournament);
        }
      }
      res.json({ ok: true, submitted });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("submit-scores error:", e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/debug/seed-rich", async (_req, res) => {
    try {
      const result = await seedRichData(deps.auth, deps.players, deps.availability, deps.tournaments, deps.matches);
      res.json({ ok: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error
        ? e.message
        : typeof e === "object" && e !== null
          ? JSON.stringify(e)
          : String(e);
      console.error("seed-rich error:", e);
      res.status(500).json({ error: msg });
    }
  });

  // ── All routes below require auth ──────────────────────────────────────────

  router.use(authMiddleware(config, deps.players));

  // ── Player profile ─────────────────────────────────────────────────────────

  router.get("/players/me", (req, res) => {
    res.json({ player: req.player });
  });

  router.put("/players/me", async (req, res) => {
    const parsed = playerProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const updated: Player = {
      ...req.player,
      name: parsed.data.name,
      city: parsed.data.city,
      level: parsed.data.level,
      ...(parsed.data.county ? { county: parsed.data.county } : {}),
      ...(parsed.data.ntrp ? { ntrp: parsed.data.ntrp } : {}),
      updatedAt: new Date().toISOString()
    };
    await deps.players.upsert(updated);
    res.json({ player: updated });
  });

  // ── Availability ───────────────────────────────────────────────────────────

  router.get("/players/me/availability", async (req, res) => {
    const slots = await deps.availability.getByPlayer(req.player.id);
    res.json({ slots });
  });

  router.put("/players/me/availability", async (req, res) => {
    const parsed = setAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const slots = parsed.data.slots.map((s) => ({
      ...s,
      id: randomUUID(),
      playerId: req.player.id
    }));
    await deps.availability.setForPlayer(req.player.id, slots);
    res.json({ slots });
  });

  // ── Player discovery ───────────────────────────────────────────────────────

  router.get("/players/nearby", async (req, res) => {
    if (!req.player.city) {
      res.json({ players: [] });
      return;
    }
    const all = await deps.players.findByCity(req.player.city);
    const nearby = findNearbyPlayers(all, req.player);
    res.json({ players: nearby });
  });

  router.get("/players/:id", async (req, res) => {
    const player = await deps.players.findById(req.params["id"] ?? "");
    if (!player) {
      res.status(404).json({ error: "player_not_found" });
      return;
    }
    res.json({ player });
  });

  // ── Matches ────────────────────────────────────────────────────────────────

  router.get("/matches", async (req, res) => {
    const myMatches = await deps.matches.findByPlayer(req.player.id);
    res.json({ matches: myMatches });
  });

  router.get("/matches/:id", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) {
      res.status(404).json({ error: "match_not_found" });
      return;
    }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" });
      return;
    }
    res.json({ match });
  });

  /** Challenge another player – triggers AI scheduling */
  router.post("/matches", async (req, res) => {
    const parsed = challengeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { opponentId, venue } = parsed.data;
    if (opponentId === req.player.id) {
      res.status(400).json({ error: "cannot_challenge_yourself" });
      return;
    }

    const opponent = await deps.players.findById(opponentId);
    if (!opponent) {
      res.status(404).json({ error: "opponent_not_found" });
      return;
    }

    // Generate AI scheduling proposals
    const slotsA = await deps.availability.getByPlayer(req.player.id);
    const slotsB = await deps.availability.getByPlayer(opponentId);

    const proposals = await generateMatchProposals(
      {
        apiKey: config.OPENAI_API_KEY,
        model: config.OPENAI_MODEL,
        timeoutMs: config.SCHEDULER_TIMEOUT_MS
      },
      {
        playerAName: req.player.name || req.player.email,
        playerBName: opponent.name || opponent.email,
        city: req.player.city || opponent.city || "your area",
        slotsA,
        slotsB,
        fromDate: new Date()
      }
    );

    const now = new Date().toISOString();
    const match: Match = {
      id: randomUUID(),
      challengerId: req.player.id,
      opponentId,
      status: proposals.length > 0 ? "scheduling" : "pending",
      proposals,
      ...(venue ? { venue } : {}),
      createdAt: now,
      updatedAt: now
    };

    await deps.matches.save(match);
    res.status(201).json({ match });
  });

  /** Accept one of the AI-proposed times */
  router.post("/matches/:id/accept-time", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) {
      res.status(404).json({ error: "match_not_found" });
      return;
    }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" });
      return;
    }
    if (match.status === "completed" || match.status === "cancelled") {
      res.status(409).json({ error: "match_already_finished" });
      return;
    }

    const parsed = acceptTimeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { proposalId } = parsed.data;
    const proposal = match.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      res.status(404).json({ error: "proposal_not_found" });
      return;
    }

    // Record that this player accepts
    const updatedProposals = match.proposals.map((p) =>
      p.id === proposalId && !p.acceptedBy.includes(req.player.id)
        ? { ...p, acceptedBy: [...p.acceptedBy, req.player.id] }
        : p
    );

    const updatedProposal = updatedProposals.find((p) => p.id === proposalId);
    // If both players have accepted → schedule the match
    const bothAccepted =
      updatedProposal?.acceptedBy.includes(match.challengerId) &&
      updatedProposal?.acceptedBy.includes(match.opponentId);

    const updated: Match = {
      ...match,
      proposals: updatedProposals,
      status: bothAccepted ? "scheduled" : "scheduling",
      ...(bothAccepted && updatedProposal?.datetime ? { scheduledAt: updatedProposal.datetime } : {}),
      updatedAt: new Date().toISOString()
    };

    await deps.matches.save(updated);
    res.json({ match: updated, scheduled: bothAccepted });
  });

  /** Get scheduling options for an unscheduled match (overlap windows) */
  router.get("/matches/:id/scheduling-options", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) {
      res.status(404).json({ error: "match_not_found" });
      return;
    }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" });
      return;
    }

    const slotsA = await deps.availability.getByPlayer(match.challengerId);
    const slotsB = await deps.availability.getByPlayer(match.opponentId);
    const overlaps = findOverlaps(slotsA, slotsB, new Date());

    const options = overlaps.slice(0, 10).map((o) => {
      const [hh, mm] = o.startTime.split(":").map(Number);
      const d = new Date(o.date);
      d.setHours(hh ?? 0, mm ?? 0, 0, 0);
      return {
        datetime: d.toISOString(),
        label: formatProposalLabel(o.date, o.startTime),
      };
    });

    // Also include opponent availability for display
    const opponentId = match.challengerId === req.player.id ? match.opponentId : match.challengerId;
    const opponentSlots = await deps.availability.getByPlayer(opponentId);
    const opponent = await deps.players.findById(opponentId);

    res.json({ options, opponentName: opponent?.name ?? "Opponent", opponentSlots });
  });

  /** Manually schedule a match with a chosen time slot */
  router.post("/matches/:id/schedule", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) {
      res.status(404).json({ error: "match_not_found" });
      return;
    }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" });
      return;
    }
    if (match.status === "completed" || match.status === "cancelled") {
      res.status(409).json({ error: "match_already_finished" });
      return;
    }

    const { datetime, label } = req.body as { datetime?: string; label?: string };
    if (!datetime || !label) {
      res.status(400).json({ error: "datetime_and_label_required" });
      return;
    }

    const proposal: import("@rally/core").TimeProposal = {
      id: randomUUID(),
      datetime,
      label,
      acceptedBy: [match.challengerId, match.opponentId],
    };

    const updated: Match = {
      ...match,
      status: "scheduled",
      proposals: [proposal],
      scheduledAt: datetime,
      updatedAt: new Date().toISOString(),
    };
    await deps.matches.save(updated);
    res.json({ match: updated, scheduled: true });
  });

  /** Get full scheduling info for a match (tiers, overlaps, near-misses, slots) */
  router.get("/matches/:id/scheduling-info", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) { res.status(404).json({ error: "match_not_found" }); return; }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" }); return;
    }

    const slotsA = await deps.availability.getByPlayer(match.challengerId);
    const slotsB = await deps.availability.getByPlayer(match.opponentId);
    const overlaps = findOverlaps(slotsA, slotsB, new Date());
    const nearMisses = findNearMisses(slotsA, slotsB, new Date());

    const options = overlaps.slice(0, 10).map((o) => {
      const [hh, mm] = o.startTime.split(":").map(Number);
      const d = new Date(o.date);
      d.setHours(hh ?? 0, mm ?? 0, 0, 0);
      return { datetime: d.toISOString(), label: formatProposalLabel(o.date, o.startTime) };
    });

    const opponentId = match.challengerId === req.player.id ? match.opponentId : match.challengerId;
    const opponent = await deps.players.findById(opponentId);
    const mySlots = match.challengerId === req.player.id ? slotsA : slotsB;
    const opponentSlots = match.challengerId === req.player.id ? slotsB : slotsA;

    // Determine tier
    let tier: 1 | 2 | 3;
    if (overlaps.length > 0) tier = 1;
    else if (nearMisses.length > 0) tier = 2;
    else tier = 3;

    res.json({
      tier,
      overlaps: options,
      nearMisses: nearMisses.slice(0, 5),
      mySlots,
      opponentSlots,
      opponentName: opponent?.name ?? "Opponent",
    });
  });

  /** Accept a flex near-miss — adjusts the window and schedules the match */
  router.post("/matches/:id/flex-accept", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) { res.status(404).json({ error: "match_not_found" }); return; }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" }); return;
    }
    if (match.status === "completed" || match.status === "cancelled") {
      res.status(409).json({ error: "match_already_finished" }); return;
    }

    const { datetime, label } = req.body as { datetime?: string; label?: string };
    if (!datetime || !label) {
      res.status(400).json({ error: "datetime_and_label_required" }); return;
    }

    const proposal: import("@rally/core").TimeProposal = {
      id: randomUUID(),
      datetime,
      label,
      acceptedBy: [match.challengerId, match.opponentId],
    };

    const updated: Match = {
      ...match,
      status: "scheduled",
      schedulingTier: 2,
      proposals: [proposal],
      scheduledAt: datetime,
      updatedAt: new Date().toISOString(),
    };
    await deps.matches.save(updated);
    res.json({ match: updated, scheduled: true });
  });

  /** Propose times for a match (Tier 3 — propose & pick) */
  router.post("/matches/:id/propose-times", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) { res.status(404).json({ error: "match_not_found" }); return; }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" }); return;
    }
    if (match.status === "completed" || match.status === "cancelled") {
      res.status(409).json({ error: "match_already_finished" }); return;
    }

    const { times } = req.body as { times?: Array<{ datetime: string; label: string }> };
    if (!times || !Array.isArray(times) || times.length === 0) {
      res.status(400).json({ error: "times_required" }); return;
    }

    const proposals: import("@rally/core").TimeProposal[] = times.slice(0, 3).map((t) => ({
      id: randomUUID(),
      datetime: t.datetime,
      label: t.label,
      acceptedBy: [req.player.id], // proposer auto-accepts
    }));

    const updated: Match = {
      ...match,
      status: "scheduling",
      schedulingTier: match.schedulingTier ?? 3,
      proposals,
      updatedAt: new Date().toISOString(),
    };
    await deps.matches.save(updated);
    res.json({ match: updated });
  });

  /** Get availability impact analysis — which new slots would help schedule the most matches */
  router.get("/players/:id/availability-impact", async (req, res) => {
    const playerId = req.params["id"] ?? "";
    if (playerId !== req.player.id) {
      res.status(403).json({ error: "not_your_profile" }); return;
    }

    const mySlots = await deps.availability.getByPlayer(playerId);
    const myMatches = await deps.matches.findByPlayer(playerId);
    const unscheduledMatches = myMatches.filter(
      (m) => m.tournamentId && (m.status === "pending" || (m.status === "scheduling" && m.schedulingTier === 3))
    );

    if (unscheduledMatches.length === 0) {
      res.json({ suggestions: [], message: "All your matches are scheduled!" }); return;
    }

    // For each potential time slot (common options), check how many matches it would unlock
    const CANDIDATE_SLOTS = [
      { dayOfWeek: 1, startTime: "07:00", endTime: "09:00", label: "Mon morning" },
      { dayOfWeek: 1, startTime: "12:00", endTime: "14:00", label: "Mon lunch" },
      { dayOfWeek: 1, startTime: "18:00", endTime: "20:00", label: "Mon evening" },
      { dayOfWeek: 2, startTime: "07:00", endTime: "09:00", label: "Tue morning" },
      { dayOfWeek: 2, startTime: "18:00", endTime: "20:00", label: "Tue evening" },
      { dayOfWeek: 3, startTime: "07:00", endTime: "09:00", label: "Wed morning" },
      { dayOfWeek: 3, startTime: "12:00", endTime: "14:00", label: "Wed lunch" },
      { dayOfWeek: 3, startTime: "18:00", endTime: "20:00", label: "Wed evening" },
      { dayOfWeek: 4, startTime: "07:00", endTime: "09:00", label: "Thu morning" },
      { dayOfWeek: 4, startTime: "18:00", endTime: "20:00", label: "Thu evening" },
      { dayOfWeek: 5, startTime: "07:00", endTime: "09:00", label: "Fri morning" },
      { dayOfWeek: 5, startTime: "17:00", endTime: "19:00", label: "Fri evening" },
      { dayOfWeek: 6, startTime: "09:00", endTime: "12:00", label: "Sat morning" },
      { dayOfWeek: 6, startTime: "14:00", endTime: "17:00", label: "Sat afternoon" },
      { dayOfWeek: 0, startTime: "09:00", endTime: "12:00", label: "Sun morning" },
      { dayOfWeek: 0, startTime: "14:00", endTime: "17:00", label: "Sun afternoon" },
    ];

    // Filter out slots I already have
    const existingDays = new Set(mySlots.map((s) => `${s.dayOfWeek}-${s.startTime}`));
    const candidates = CANDIDATE_SLOTS.filter(
      (c) => !existingDays.has(`${c.dayOfWeek}-${c.startTime}`)
    );

    const suggestions: Array<{ slot: typeof CANDIDATE_SLOTS[0]; matchesUnlocked: number; opponentNames: string[] }> = [];

    for (const candidate of candidates) {
      const hypotheticalSlots = [...mySlots, {
        id: "hypothetical",
        playerId,
        dayOfWeek: candidate.dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      }];

      let matchesUnlocked = 0;
      const opponentNames: string[] = [];

      for (const m of unscheduledMatches) {
        const opponentId = m.challengerId === playerId ? m.opponentId : m.challengerId;
        const opponentSlots = await deps.availability.getByPlayer(opponentId);
        const currentOverlaps = findOverlaps(mySlots, opponentSlots, new Date());
        const newOverlaps = findOverlaps(hypotheticalSlots, opponentSlots, new Date());

        if (currentOverlaps.length === 0 && newOverlaps.length > 0) {
          matchesUnlocked++;
          const opp = await deps.players.findById(opponentId);
          opponentNames.push(opp?.name ?? "Opponent");
        }
      }

      if (matchesUnlocked > 0) {
        suggestions.push({ slot: candidate, matchesUnlocked, opponentNames });
      }
    }

    // Sort by most matches unlocked
    suggestions.sort((a, b) => b.matchesUnlocked - a.matchesUnlocked);

    res.json({ suggestions: suggestions.slice(0, 3) });
  });

  /** Report match result */
  router.post("/matches/:id/result", async (req, res) => {
    const match = await deps.matches.findById(req.params["id"] ?? "");
    if (!match) {
      res.status(404).json({ error: "match_not_found" });
      return;
    }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) {
      res.status(403).json({ error: "not_your_match" });
      return;
    }
    if (match.status === "completed") {
      res.status(409).json({ error: "result_already_reported" });
      return;
    }

    const parsed = reportResultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { winnerId, score } = parsed.data;
    if (winnerId !== match.challengerId && winnerId !== match.opponentId) {
      res.status(400).json({ error: "winner_not_in_match" });
      return;
    }

    // Update ratings
    const loserId = winnerId === match.challengerId ? match.opponentId : match.challengerId;
    const winner = await deps.players.findById(winnerId);
    const loser = await deps.players.findById(loserId);

    if (winner && loser) {
      const { updatedWinner, updatedLoser } = applyMatchResult(winner, loser);
      await deps.players.upsert(updatedWinner);
      await deps.players.upsert(updatedLoser);
    }

    const updatedMatch: Match = {
      ...match,
      status: "completed",
      result: {
        winnerId,
        score,
        reportedBy: req.player.id,
        reportedAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    };

    await deps.matches.save(updatedMatch);

    const updatedWinner = await deps.players.findById(winnerId);
    const updatedLoser = await deps.players.findById(loserId);

    res.json({ match: updatedMatch, winner: updatedWinner, loser: updatedLoser });
  });

  // ── Tournaments ────────────────────────────────────────────────────────────

  router.get("/tournaments", async (req, res) => {
    const { county, band, status } = req.query;
    let tournaments;
    if (status) { tournaments = await deps.tournaments.listByStatus(status as string); }
    else { tournaments = await deps.tournaments.listAll(); }
    if (county) tournaments = tournaments.filter(t => t.county.toLowerCase() === (county as string).toLowerCase());
    if (band) tournaments = tournaments.filter(t => t.band === band);
    res.json({ tournaments });
  });

  router.post("/tournaments/:id/join", async (req, res) => {
    const tournament = await deps.tournaments.findById(req.params["id"] ?? "");
    if (!tournament) {
      res.status(404).json({ error: "tournament_not_found" });
      return;
    }
    if (tournament.playerIds.includes(req.player.id)) {
      res.json({ tournament, alreadyJoined: true });
      return;
    }
    if (tournament.status !== "registration") {
      res.status(409).json({ error: "tournament_not_open" });
      return;
    }

    const updated = {
      ...tournament,
      playerIds: [...tournament.playerIds, req.player.id]
    };
    await deps.tournaments.save(updated);

    // Try synchronous activation (triggers auto-scheduling)
    const activated = await deps.engine.activateTournamentIfReady(updated.id);
    if (activated) {
      const fresh = await deps.tournaments.findById(updated.id);
      res.json({ tournament: fresh ?? updated, alreadyJoined: false, activated: true, schedulingResult: fresh?.schedulingResult });
      return;
    }

    res.json({ tournament: updated, alreadyJoined: false, activated: false });
  });

  router.delete("/tournaments/:id/leave", async (req, res) => {
    const tournament = await deps.tournaments.findById(req.params["id"] ?? "");
    if (!tournament) {
      res.status(404).json({ error: "tournament_not_found" });
      return;
    }

    const updated = {
      ...tournament,
      playerIds: tournament.playerIds.filter((id) => id !== req.player.id)
    };
    await deps.tournaments.save(updated);
    res.json({ tournament: updated });
  });

  // ── Pool ─────────────────────────────────────────────────────────────────

  router.post("/pool/signup", async (req, res) => {
    const player = req.player;
    if (!player.ntrp) { res.status(400).json({ error: "profile_incomplete" }); return; }
    const parsed = poolSignupSchema.safeParse(req.body || {});
    const county = (parsed.success && parsed.data.county) ? parsed.data.county.trim() : player.county;
    if (!county) { res.status(400).json({ error: "profile_incomplete" }); return; }
    const existing = await deps.pool.findByPlayer(player.id);
    if (existing) { res.json({ entry: existing, alreadySignedUp: true }); return; }
    const band = skillBandFromNtrp(player.ntrp);
    const entry = { id: randomUUID(), playerId: player.id, county, band, rating: player.rating, createdAt: new Date().toISOString() };
    await deps.pool.add(entry);
    res.status(201).json({ entry });
  });

  router.delete("/pool/leave", async (req, res) => {
    const existing = await deps.pool.findByPlayer(req.player.id);
    if (!existing) {
      res.status(404).json({ error: "not_in_pool" });
      return;
    }
    await deps.pool.remove(req.player.id);
    res.json({ ok: true });
  });

  router.get("/pool/status", async (req, res) => {
    const player = req.player;
    if (!player.ntrp) { res.json({ inPool: false, count: 0, needed: 8 }); return; }
    // Allow querying a specific county (for searching other areas)
    const county = (typeof req.query["county"] === "string" && req.query["county"].trim())
      ? req.query["county"].trim()
      : player.county;
    if (!county) { res.json({ inPool: false, count: 0, needed: 8 }); return; }
    const band = skillBandFromNtrp(player.ntrp);
    const entries = await deps.pool.findByCountyAndBand(county, band);
    const inPool = entries.some(e => e.playerId === player.id);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existing = await deps.tournaments.findByCountyBandMonth(county, band, month);

    // Also compute total county interest across ALL bands (so users can see activity even at other levels)
    const allCountyEntries = await deps.pool.findByCounty(county);
    const allBands = ["3.0", "3.5", "4.0"] as const;
    const bandBreakdown: Array<{ band: string; poolCount: number; tournamentCount: number }> = [];
    let totalCountyInterest = 0;
    for (const b of allBands) {
      const bandEntries = allCountyEntries.filter(e => e.band === b);
      const bandTournament = await deps.tournaments.findByCountyBandMonth(county, b, month);
      const count = bandEntries.length + (bandTournament?.playerIds.length ?? 0);
      if (count > 0) bandBreakdown.push({ band: b, poolCount: bandEntries.length, tournamentCount: bandTournament?.playerIds.length ?? 0 });
      totalCountyInterest += count;
    }

    res.json({
      inPool, count: entries.length + (existing?.playerIds.length ?? 0), needed: 8, band, county,
      tournamentId: existing?.id ?? null,
      daysRemaining: existing ? Math.max(0, 7 - Math.floor((Date.now() - new Date(existing.registrationOpenedAt).getTime()) / 86400000)) : null,
      totalCountyInterest,
      bandBreakdown
    });
  });

  // ── Tournament detail ──────────────────────────────────────────────────────

  router.get("/tournaments/:id", async (req, res) => {
    const tournament = await deps.tournaments.findById(req.params["id"] ?? "");
    if (!tournament) { res.status(404).json({ error: "tournament_not_found" }); return; }
    const playerNames: Record<string, string> = {};
    for (const pid of tournament.playerIds) { const p = await deps.players.findById(pid); if (p) playerNames[pid] = p.name || p.email; }
    res.json({ tournament, playerNames });
  });

  router.get("/tournaments/:id/matches", async (req, res) => {
    const tournament = await deps.tournaments.findById(req.params["id"] ?? "");
    if (!tournament) { res.status(404).json({ error: "tournament_not_found" }); return; }
    const matches = await deps.matches.findByTournament(tournament.id);

    // Build matchId → round number lookup from tournament rounds
    const matchRoundMap: Record<string, number> = {};
    for (const round of tournament.rounds) {
      for (const pairing of round.pairings) {
        if (pairing.matchId) matchRoundMap[pairing.matchId] = round.roundNumber;
      }
    }

    // Format sets into score string (e.g. "6-4, 6-3")
    function formatScore(sets: Array<{ aGames: number; bGames: number; tiebreak?: { aPoints: number; bPoints: number } }>): string {
      return sets.map(s => {
        const base = `${s.aGames}-${s.bGames}`;
        if (s.tiebreak) return `${base}(${Math.min(s.tiebreak.aPoints, s.tiebreak.bPoints)})`;
        return base;
      }).join(", ");
    }

    // Transform matches for frontend TournamentMatch shape
    const transformed = matches.map(m => {
      const pendingReport = tournament.pendingResults[m.id];
      return {
        id: m.id,
        tournamentId: m.tournamentId,
        homePlayerId: m.challengerId,
        awayPlayerId: m.opponentId,
        round: matchRoundMap[m.id] ?? 0,
        status: m.status,
        proposals: m.proposals,
        scheduledAt: m.scheduledAt,
        result: m.result ? {
          winnerId: m.result.winnerId,
          score: m.result.sets ? formatScore(m.result.sets) : (m.result.score ?? ""),
          sets: m.result.sets,
          reportedBy: m.result.reportedBy,
          reportedAt: m.result.reportedAt,
          confirmedBy: m.result.confirmedBy,
          confirmedAt: m.result.confirmedAt,
        } : undefined,
        pendingResult: pendingReport ? {
          winnerId: pendingReport.winnerId,
          sets: pendingReport.sets,
          reportedBy: pendingReport.reportedBy,
          reportedAt: pendingReport.reportedAt,
        } : undefined,
      };
    });

    res.json({ matches: transformed });
  });

  // ── Tournament score reporting ─────────────────────────────────────────────

  router.post("/tournaments/:id/matches/:matchId/score", async (req, res) => {
    const tournament = await deps.tournaments.findById(req.params["id"] ?? "");
    if (!tournament) { res.status(404).json({ error: "tournament_not_found" }); return; }
    const match = await deps.matches.findById(req.params["matchId"] ?? "");
    if (!match || match.tournamentId !== tournament.id) { res.status(404).json({ error: "match_not_found" }); return; }
    if (match.challengerId !== req.player.id && match.opponentId !== req.player.id) { res.status(403).json({ error: "not_your_match" }); return; }
    if (match.status === "completed") { res.status(409).json({ error: "already_completed" }); return; }
    const parsed = reportTournamentResultSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() }); return; }
    const { winnerId, sets: rawSets } = parsed.data;
    const sets = rawSets as import("@rally/core").SetScore[];
    if (winnerId !== match.challengerId && winnerId !== match.opponentId) { res.status(400).json({ error: "winner_not_in_match" }); return; }
    const pendingKey = match.id;
    const existingReport = tournament.pendingResults[pendingKey];
    if (!existingReport) {
      const report = { winnerId, sets, reportedBy: req.player.id, reportedAt: new Date().toISOString() };
      await deps.tournaments.save({ ...tournament, pendingResults: { ...tournament.pendingResults, [pendingKey]: report } });
      res.json({ status: "awaiting_confirmation", match }); return;
    }
    if (existingReport.reportedBy === req.player.id) { res.status(409).json({ error: "already_reported" }); return; }
    const reportsMatch = existingReport.winnerId === winnerId && JSON.stringify(existingReport.sets) === JSON.stringify(sets);
    if (reportsMatch) {
      const now = new Date().toISOString();
      const updatedMatch: Match = { ...match, status: "completed", result: { winnerId, sets, reportedBy: existingReport.reportedBy, reportedAt: existingReport.reportedAt, confirmedBy: req.player.id, confirmedAt: now }, updatedAt: now };
      await deps.matches.save(updatedMatch);
      const loserId = winnerId === match.challengerId ? match.opponentId : match.challengerId;
      const winner = await deps.players.findById(winnerId);
      const loser = await deps.players.findById(loserId);
      if (winner && loser) { const { updatedWinner, updatedLoser } = applyEnhancedMatchResult(winner, loser, sets); await deps.players.upsert(updatedWinner); await deps.players.upsert(updatedLoser); }
      const { [pendingKey]: _, ...remainingPending } = tournament.pendingResults;
      const allMatches = await deps.matches.findByTournament(tournament.id);
      const completedMatches = allMatches.filter(m => m.status === "completed");
      const standings = computeStandings(tournament.playerIds, completedMatches);
      await deps.tournaments.save({ ...tournament, pendingResults: remainingPending, standings });
      res.json({ status: "confirmed", match: updatedMatch });
    } else {
      res.json({ status: "disputed", message: "Reports don't match. Will auto-resolve in 48h." });
    }
  });

  // ── Subscription ───────────────────────────────────────────────────────────

  router.post("/subscription/checkout", async (req, res) => {
    const parsed = subscriptionCheckoutSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "invalid_payload" }); return; }
    if (!isStripeEnabled()) {
      const updated = { ...req.player, subscription: "active" as const, updatedAt: new Date().toISOString() };
      await deps.players.upsert(updated);
      res.json({ url: null, devMode: true, player: updated }); return;
    }
    const url = await createCheckoutSession(deps.config, req.player.id, req.player.email, parsed.data.plan);
    if (!url) { res.status(500).json({ error: "checkout_failed" }); return; }
    res.json({ url });
  });

  router.post("/subscription/portal", async (req, res) => {
    const portalUrl = await createPortalSession(req.player.id, deps.config);
    if (!portalUrl) {
      res.status(503).json({ error: "stripe_not_configured" });
      return;
    }
    res.json({ url: portalUrl });
  });

  router.get("/subscription/status", async (req, res) => {
    res.json({ subscription: req.player.subscription || "free" });
  });

  return router;
}
