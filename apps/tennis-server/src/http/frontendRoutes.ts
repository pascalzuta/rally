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

const saveProfileSchema = z.object({
  playerName: z.string().trim().min(1).max(80),
  county: z.string().trim().min(1).max(80),
  email: z.string().email().optional(),
  skillLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  weeklyCap: z.number().int().min(1).max(7).optional(),
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

    // Notification gate: player must have push token OR phone number
    const authId = req.authUser!.authId;
    const [deviceCheck, phoneCheck] = await Promise.all([
      supabase.from("device_tokens").select("id").eq("player_id", authId).eq("active", true).limit(1),
      supabase.from("player_phones").select("id").eq("player_id", authId).limit(1),
    ]);
    const hasDevice = (deviceCheck.data?.length ?? 0) > 0;
    const hasPhone = (phoneCheck.data?.length ?? 0) > 0;
    if (!hasDevice && !hasPhone) {
      res.status(403).json({
        error: "notifications_required",
        message: "Enable push notifications or provide a phone number to join tournaments. Rally needs to reach you when matches are scheduled.",
      });
      return;
    }

    const { playerId, playerName, county } = parsed.data;

    // Ownership check: prevent impersonating another player's lobby entry
    const { data: existing } = await supabase.from("lobby").select("auth_id").eq("player_id", playerId).maybeSingle();
    if (existing && existing.auth_id !== authId) {
      res.status(403).json({ error: "not_your_lobby_entry" });
      return;
    }

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
    const authId = req.authUser!.authId;

    // Ownership check: only allow deleting your own lobby entry
    const { data: existing } = await supabase.from("lobby").select("auth_id").eq("player_id", playerId).maybeSingle();
    if (existing && existing.auth_id !== authId) {
      res.status(403).json({ error: "not_your_lobby_entry" });
      return;
    }

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
    const authId = req.authUser!.authId;

    // Ownership check: only participants can update a tournament
    const { data: existing } = await supabase.from("tournaments").select("data").eq("id", id).maybeSingle();
    if (existing) {
      const tournamentData = existing.data as { players?: Array<{ id?: string; playerId?: string }> } | null;
      const players = tournamentData?.players ?? [];
      const isParticipant = players.some(p => p.id === authId || p.playerId === authId);
      if (!isParticipant) {
        res.status(403).json({ error: "not_a_participant" });
        return;
      }
    }

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

  // ── Get Profile (by auth_id) ─────────────────────────────────────────

  router.get("/profile", requireAuth, async (req, res) => {
    const authId = req.authUser!.authId;

    const { data, error } = await supabase
      .from("players")
      .select("player_id, auth_id, player_name, county, email, sex, experience_level, weekly_cap, created_at")
      .eq("auth_id", authId)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: "profile_fetch_failed", message: error.message });
      return;
    }

    if (!data) {
      res.status(404).json({ error: "profile_not_found" });
      return;
    }

    // Map DB columns to frontend profile shape
    res.json({
      ok: true,
      profile: {
        id: data.player_id,
        authId: data.auth_id,
        name: data.player_name,
        county: data.county,
        email: data.email ?? undefined,
        skillLevel: data.experience_level ?? undefined,
        gender: data.sex ?? undefined,
        weeklyCap: data.weekly_cap ?? 2,
        createdAt: data.created_at,
      },
    });
  });

  // ── Save / Update Profile ──────────────────────────────────────────────

  router.post("/profile", requireAuth, async (req, res) => {
    const parsed = saveProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const { playerName, county, email, skillLevel, gender, weeklyCap } = parsed.data;
    const authId = req.authUser!.authId;

    const { error } = await supabase.from("players").upsert({
      player_id: authId,
      auth_id: authId,
      player_name: playerName,
      county: county.toLowerCase(),
      email: email ?? null,
      sex: gender ?? null,
      experience_level: skillLevel ?? null,
      weekly_cap: weeklyCap ?? 2,
    }, { onConflict: "player_id" });

    if (error) {
      res.status(500).json({ error: "profile_save_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Register Device Token ───────────────────────────────────────────────

  const registerDeviceSchema = z.object({
    token: z.string().min(1).max(500),
    platform: z.enum(["ios", "android", "web"]),
  });

  router.post("/notifications/register-device", requireAuth, async (req, res) => {
    const parsed = registerDeviceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const authId = req.authUser!.authId;
    const { token, platform } = parsed.data;

    // Upsert: update existing token or create new one
    const { error } = await supabase.from("device_tokens").upsert({
      player_id: authId,
      token,
      platform,
      active: true,
      consecutive_failures: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: "token" });

    if (error) {
      res.status(500).json({ error: "device_registration_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Save Phone Number ─────────────────────────────────────────────────

  const savePhoneSchema = z.object({
    phoneNumber: z.string().min(10).max(20),
  });

  router.post("/notifications/phone", requireAuth, async (req, res) => {
    const parsed = savePhoneSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_payload", details: parsed.error.flatten() });
      return;
    }

    const authId = req.authUser!.authId;
    const { phoneNumber } = parsed.data;

    const { error } = await supabase.from("player_phones").upsert({
      player_id: authId,
      phone_number: phoneNumber,
    }, { onConflict: "player_id" });

    if (error) {
      res.status(500).json({ error: "phone_save_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Acknowledge Notification ──────────────────────────────────────────

  router.post("/notifications/:id/ack", requireAuth, async (req, res) => {
    const notificationId = req.params.id;

    // Mark the delivery as acknowledged (prevents SMS escalation)
    const { error } = await supabase
      .from("notification_deliveries")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("notification_id", notificationId)
      .eq("channel", "push");

    if (error) {
      res.status(500).json({ error: "ack_failed", message: error.message });
      return;
    }

    res.json({ ok: true });
  });

  // ── Notification Capability Check ─────────────────────────────────────

  router.get("/notifications/status", requireAuth, async (req, res) => {
    const authId = req.authUser!.authId;

    const [deviceCheck, phoneCheck] = await Promise.all([
      supabase.from("device_tokens").select("id, platform").eq("player_id", authId).eq("active", true),
      supabase.from("player_phones").select("phone_number").eq("player_id", authId).maybeSingle(),
    ]);

    res.json({
      ok: true,
      hasActiveDevice: (deviceCheck.data?.length ?? 0) > 0,
      devices: deviceCheck.data?.map((d: Record<string, unknown>) => ({ id: d.id, platform: d.platform })) ?? [],
      hasPhone: !!phoneCheck.data,
      canJoinTournament: (deviceCheck.data?.length ?? 0) > 0 || !!phoneCheck.data,
    });
  });

  // ── Health check for frontend routes ───────────────────────────────────

  router.get("/health", (_req, res) => {
    res.json({ ok: true, routes: "frontend" });
  });

  return router;
}
