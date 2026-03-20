/**
 * Frontend-compatible API routes.
 *
 * These routes work with the LIVE Supabase table schemas (lobby, tournaments,
 * ratings, availability, players) using the Supabase client directly.
 *
 * This bridges the gap between the frontend's data model (JSONB blobs,
 * localStorage-style player IDs) and the backend's validation/auth layer.
 */
import { Router } from "express";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
import { supabaseAuthMiddleware } from "../middleware/supabaseAuth.js";

interface FrontendRouteDeps {
  config: AppConfig;
  supabase: SupabaseClient;
}

// --- Validation schemas ---

const lobbyJoinSchema = z.object({
  playerId: z.string().min(1).max(100),
  playerName: z.string().trim().min(1).max(80),
  county: z.string().trim().min(1).max(80),
});

const lobbyLeaveSchema = z.object({
  playerId: z.string().min(1).max(100),
});

const availabilitySlotSchema = z.object({
  day: z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(1).max(24),
}).refine((s) => s.endHour > s.startHour, { message: "endHour must be after startHour" });

const saveAvailabilitySchema = z.object({
  playerId: z.string().min(1).max(100),
  county: z.string().trim().min(1).max(80),
  slots: z.array(availabilitySlotSchema).max(30),
  weeklyCap: z.number().int().min(1).max(7).default(2),
});

const saveTournamentSchema = z.object({
  id: z.string().min(1).max(100),
  county: z.string().trim().min(1).max(80),
  data: z.record(z.unknown()),
});

const scoreSubmitSchema = z.object({
  tournamentId: z.string().min(1),
  matchId: z.string().min(1),
  playerId: z.string().min(1),
  winnerId: z.string().min(1),
  score: z.string().min(1).max(50),
});

export function createFrontendRoutes(deps: FrontendRouteDeps): Router {
  const router = Router();
  const { config, supabase } = deps;
  const requireAuth = supabaseAuthMiddleware(config);

  // ── Lobby Join ──────────────────────────────────────────────────────────

  router.post("/lobby/join", requireAuth, async (req, res) => {
    const parsed = lobbyJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { playerId, playerName, county } = parsed.data;
    const authId = req.authUser!.authId;

    // Upsert lobby entry with auth_id linkage
    const { error } = await supabase.from("lobby").upsert({
      player_id: playerId,
      player_name: playerName,
      county: county.toLowerCase(),
      joined_at: new Date().toISOString(),
      auth_id: authId,
    }, { onConflict: "player_id" });

    if (error) {
      res.status(500).json({ error: "lobby_join_failed", message: error.message });
      return;
    }

    // Also ensure player exists in players table
    await supabase.from("players").upsert({
      player_id: playerId,
      auth_id: authId,
      player_name: playerName,
      county: county.toLowerCase(),
    }, { onConflict: "player_id" });

    res.json({ ok: true });
  });

  // ── Lobby Leave ─────────────────────────────────────────────────────────

  router.post("/lobby/leave", requireAuth, async (req, res) => {
    const parsed = lobbyLeaveSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { playerId } = parsed.data;

    const { error } = await supabase.from("lobby").delete().eq("player_id", playerId);
    if (error) {
      res.status(500).json({ error: "lobby_leave_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Save Availability ──────────────────────────────────────────────────

  router.put("/availability", requireAuth, async (req, res) => {
    const parsed = saveAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { playerId, county, slots, weeklyCap } = parsed.data;
    const authId = req.authUser!.authId;

    const { error } = await supabase.from("availability").upsert({
      player_id: playerId,
      auth_id: authId,
      county: county.toLowerCase(),
      slots,
      weekly_cap: weeklyCap,
    }, { onConflict: "player_id" });

    if (error) {
      res.status(500).json({ error: "availability_save_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Save Tournament ────────────────────────────────────────────────────

  router.put("/tournament", requireAuth, async (req, res) => {
    const parsed = saveTournamentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { id, county, data } = parsed.data;

    const { error } = await supabase.from("tournaments").upsert({
      id,
      county: county.toLowerCase(),
      data,
    }, { onConflict: "id" });

    if (error) {
      res.status(500).json({ error: "tournament_save_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Submit Score ───────────────────────────────────────────────────────

  router.post("/score", requireAuth, async (req, res) => {
    const parsed = scoreSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    // Score submission updates the tournament JSONB data
    // For now, validate and pass through — full scoring logic stays client-side
    // until tournament engine is wired up
    res.json({ ok: true, validated: true });
  });

  // ── Health check for frontend routes ───────────────────────────────────

  router.get("/health", (_req, res) => {
    res.json({ ok: true, routes: "frontend" });
  });

  return router;
}
