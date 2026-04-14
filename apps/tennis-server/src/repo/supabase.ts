import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser, AvailabilitySlot, Match, Notification, NotificationDelivery, Player, PoolEntry, Tournament } from "@rally/core";
import type { AuthRepo, AvailabilityRepo, DeviceToken, DeviceTokenRepo, MatchRepo, NotificationDeliveryRepo, NotificationRepo, PlayerPhoneRepo, PlayerRepo, PoolRepo, TournamentRepo } from "./interfaces.js";

// ── AuthUser mapping ────────────────────────────────────────────────────────────

function authUserToRow(u: AuthUser): Record<string, unknown> {
  return { id: u.id, email: u.email, created_at: u.createdAt };
}

function rowToAuthUser(row: Record<string, unknown>): AuthUser {
  return {
    id: row.id as string,
    email: row.email as string,
    createdAt: String(row.created_at),
  };
}

// ── Player mapping ──────────────────────────────────────────────────────────────

function playerToRow(p: Player): Record<string, unknown> {
  return {
    id: p.id,
    email: p.email,
    name: p.name,
    city: p.city,
    county: p.county,
    level: p.level,
    ntrp: p.ntrp,
    rating: p.rating,
    rating_confidence: p.ratingConfidence,
    provisional_remaining: p.provisionalRemaining,
    wins: p.wins,
    losses: p.losses,
    subscription: p.subscription,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

function rowToPlayer(row: Record<string, unknown>): Player {
  return {
    id: row.id as string,
    email: row.email as string,
    name: (row.name as string) || "",
    city: (row.city as string) || "",
    county: (row.county as string) || "",
    level: (row.level as Player["level"]) || "beginner",
    ntrp: Number(row.ntrp) || 3.0,
    rating: Number(row.rating) || 1000,
    ratingConfidence: Number(row.rating_confidence) || 0,
    provisionalRemaining: Number(row.provisional_remaining) || 5,
    wins: Number(row.wins) || 0,
    losses: Number(row.losses) || 0,
    subscription: (row.subscription as Player["subscription"]) || "free",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

// ── Match mapping ───────────────────────────────────────────────────────────────

function matchToRow(m: Match): Record<string, unknown> {
  return {
    id: m.id,
    challenger_id: m.challengerId,
    opponent_id: m.opponentId,
    tournament_id: m.tournamentId ?? null,
    status: m.status,
    scheduled_at: m.scheduledAt ?? null,
    venue: m.venue ?? null,
    scheduling_tier: m.schedulingTier ?? null,
    proposals: JSON.stringify(m.proposals),
    result: m.result ? JSON.stringify(m.result) : null,
    near_miss: m.nearMiss ? JSON.stringify(m.nearMiss) : null,
    deadline_started_at: m.deadlineStartedAt ?? null,
    proposals_created_at: m.proposalsCreatedAt ?? null,
    auto_actions: m.autoActions ? JSON.stringify(m.autoActions) : JSON.stringify([]),
    player_activity: m.playerActivity ? JSON.stringify(m.playerActivity) : JSON.stringify({}),
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

function rowToMatch(row: Record<string, unknown>): Match {
  const m: Match = {
    id: row.id as string,
    challengerId: row.challenger_id as string,
    opponentId: row.opponent_id as string,
    status: row.status as Match["status"],
    proposals: (typeof row.proposals === "string" ? JSON.parse(row.proposals) : row.proposals) || [],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
  if (row.tournament_id) m.tournamentId = row.tournament_id as string;
  if (row.scheduled_at) m.scheduledAt = String(row.scheduled_at);
  if (row.venue) m.venue = row.venue as string;
  if (row.result) m.result = typeof row.result === "string" ? JSON.parse(row.result) : row.result;
  if (row.scheduling_tier) m.schedulingTier = row.scheduling_tier as NonNullable<Match["schedulingTier"]>;
  if (row.near_miss) m.nearMiss = typeof row.near_miss === "string" ? JSON.parse(row.near_miss) : row.near_miss;
  if (row.deadline_started_at) m.deadlineStartedAt = String(row.deadline_started_at);
  if (row.proposals_created_at) m.proposalsCreatedAt = String(row.proposals_created_at);
  if (row.auto_actions) {
    const parsed = typeof row.auto_actions === "string" ? JSON.parse(row.auto_actions) : row.auto_actions;
    if (Array.isArray(parsed) && parsed.length > 0) m.autoActions = parsed as NonNullable<Match["autoActions"]>;
  }
  if (row.player_activity) {
    const parsed = typeof row.player_activity === "string" ? JSON.parse(row.player_activity) : row.player_activity;
    if (parsed && typeof parsed === "object" && Object.keys(parsed as object).length > 0) {
      m.playerActivity = parsed as NonNullable<Match["playerActivity"]>;
    }
  }
  return m;
}

// ── Tournament mapping ──────────────────────────────────────────────────────────

function tournamentToRow(t: Tournament): Record<string, unknown> {
  return {
    id: t.id,
    month: t.month,
    name: t.name,
    county: t.county,
    band: t.band,
    status: t.status,
    player_ids: t.playerIds,
    min_players: t.minPlayers,
    max_players: t.maxPlayers,
    rounds: JSON.stringify(t.rounds),
    standings: JSON.stringify(t.standings),
    pending_results: JSON.stringify(t.pendingResults),
    registration_opened_at: t.registrationOpenedAt,
    finals_matches: t.finalsMatches ? JSON.stringify(t.finalsMatches) : null,
    scheduling_result: t.schedulingResult ? JSON.stringify(t.schedulingResult) : null,
    activated_at: t.activatedAt ?? null,
    hard_deadline: t.hardDeadline ?? null,
    round_robin_deadline: t.roundRobinDeadline ?? null,
    created_at: t.createdAt,
  };
}

function rowToTournament(row: Record<string, unknown>): Tournament {
  const parseJson = (v: unknown): unknown => {
    if (typeof v === "string") return JSON.parse(v);
    return v;
  };
  const t: Tournament = {
    id: row.id as string,
    month: row.month as string,
    name: row.name as string,
    county: row.county as string,
    band: row.band as Tournament["band"],
    status: row.status as Tournament["status"],
    playerIds: (row.player_ids as string[]) || [],
    minPlayers: Number(row.min_players) || 4,
    maxPlayers: Number(row.max_players) || 8,
    rounds: (parseJson(row.rounds) as Tournament["rounds"]) || [],
    standings: (parseJson(row.standings) as Tournament["standings"]) || [],
    pendingResults: (parseJson(row.pending_results) as Tournament["pendingResults"]) || {},
    registrationOpenedAt: String(row.registration_opened_at),
    createdAt: String(row.created_at),
  };
  if (row.finals_matches) t.finalsMatches = parseJson(row.finals_matches) as NonNullable<Tournament["finalsMatches"]>;
  if (row.scheduling_result) t.schedulingResult = parseJson(row.scheduling_result) as NonNullable<Tournament["schedulingResult"]>;
  if (row.activated_at) t.activatedAt = String(row.activated_at);
  if (row.hard_deadline) t.hardDeadline = String(row.hard_deadline);
  if (row.round_robin_deadline) t.roundRobinDeadline = String(row.round_robin_deadline);
  return t;
}

// ── Pool mapping ────────────────────────────────────────────────────────────────

function poolToRow(e: PoolEntry): Record<string, unknown> {
  return {
    id: e.id,
    player_id: e.playerId,
    county: e.county,
    band: e.band,
    rating: e.rating,
    created_at: e.createdAt,
  };
}

function rowToPool(row: Record<string, unknown>): PoolEntry {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    county: row.county as string,
    band: row.band as PoolEntry["band"],
    rating: Number(row.rating) || 1000,
    createdAt: String(row.created_at),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Repository Implementations
// ═══════════════════════════════════════════════════════════════════════════════

export class SupabaseAuthRepo implements AuthRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    const { data, error } = await this.db
      .from("auth_users")
      .select("*")
      .ilike("email", email)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToAuthUser(data) : null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    const { data, error } = await this.db
      .from("auth_users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToAuthUser(data) : null;
  }

  async upsert(user: AuthUser): Promise<void> {
    const { error } = await this.db
      .from("auth_users")
      .upsert(authUserToRow(user), { onConflict: "id" });
    if (error) throw error;
  }
}

export class SupabasePlayerRepo implements PlayerRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Player | null> {
    const { data, error } = await this.db
      .from("players")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPlayer(data) : null;
  }

  async findByCity(city: string): Promise<Player[]> {
    const { data, error } = await this.db
      .from("players")
      .select("*")
      .ilike("city", city);
    if (error) throw error;
    return (data || []).map(rowToPlayer);
  }

  async findByCounty(county: string): Promise<Player[]> {
    const { data, error } = await this.db
      .from("players")
      .select("*")
      .ilike("county", county);
    if (error) throw error;
    return (data || []).map(rowToPlayer);
  }

  async upsert(player: Player): Promise<void> {
    const { error } = await this.db
      .from("players")
      .upsert(playerToRow(player), { onConflict: "id" });
    if (error) throw error;
  }
}

export class SupabaseAvailabilityRepo implements AvailabilityRepo {
  constructor(private readonly db: SupabaseClient) {}

  async getByPlayer(playerId: string): Promise<AvailabilitySlot[]> {
    const { data, error } = await this.db
      .from("availability_slots")
      .select("*")
      .eq("player_id", playerId);
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id as string,
      playerId: row.player_id as string,
      dayOfWeek: Number(row.day_of_week),
      startTime: row.start_time as string,
      endTime: row.end_time as string,
    }));
  }

  async setForPlayer(playerId: string, slots: AvailabilitySlot[]): Promise<void> {
    // Delete existing, then insert new (replace-all pattern)
    const { error: delErr } = await this.db
      .from("availability_slots")
      .delete()
      .eq("player_id", playerId);
    if (delErr) throw delErr;

    if (slots.length === 0) return;

    const rows = slots.map((s) => ({
      id: s.id,
      player_id: s.playerId,
      day_of_week: s.dayOfWeek,
      start_time: s.startTime,
      end_time: s.endTime,
    }));

    const { error: insErr } = await this.db
      .from("availability_slots")
      .insert(rows);
    if (insErr) throw insErr;
  }
}

export class SupabaseMatchRepo implements MatchRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Match | null> {
    const { data, error } = await this.db
      .from("matches")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToMatch(data) : null;
  }

  async findByPlayer(playerId: string): Promise<Match[]> {
    const { data, error } = await this.db
      .from("matches")
      .select("*")
      .or(`challenger_id.eq.${playerId},opponent_id.eq.${playerId}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToMatch);
  }

  async findByTournament(tournamentId: string): Promise<Match[]> {
    const { data, error } = await this.db
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(rowToMatch);
  }

  async save(match: Match): Promise<void> {
    const { error } = await this.db
      .from("matches")
      .upsert(matchToRow(match), { onConflict: "id" });
    if (error) throw error;
  }
}

export class SupabaseTournamentRepo implements TournamentRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findById(id: string): Promise<Tournament | null> {
    const { data, error } = await this.db
      .from("tournaments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToTournament(data) : null;
  }

  async listOpen(): Promise<Tournament[]> {
    const { data, error } = await this.db
      .from("tournaments")
      .select("*")
      .in("status", ["registration", "active"]);
    if (error) throw error;
    return (data || []).map(rowToTournament);
  }

  async listByStatus(status: string): Promise<Tournament[]> {
    const { data, error } = await this.db
      .from("tournaments")
      .select("*")
      .eq("status", status);
    if (error) throw error;
    return (data || []).map(rowToTournament);
  }

  async listAll(): Promise<Tournament[]> {
    const { data, error } = await this.db
      .from("tournaments")
      .select("*");
    if (error) throw error;
    return (data || []).map(rowToTournament);
  }

  async findByCountyBandMonth(county: string, band: string, month: string): Promise<Tournament | null> {
    const { data, error } = await this.db
      .from("tournaments")
      .select("*")
      .ilike("county", county)
      .eq("band", band)
      .eq("month", month)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToTournament(data) : null;
  }

  async save(tournament: Tournament): Promise<void> {
    const { error } = await this.db
      .from("tournaments")
      .upsert(tournamentToRow(tournament), { onConflict: "id" });
    if (error) throw error;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db
      .from("tournaments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}

export class SupabasePoolRepo implements PoolRepo {
  constructor(private readonly db: SupabaseClient) {}

  async add(entry: PoolEntry): Promise<void> {
    const { error } = await this.db
      .from("pool_entries")
      .upsert(poolToRow(entry), { onConflict: "player_id" });
    if (error) throw error;
  }

  async remove(playerId: string): Promise<void> {
    const { error } = await this.db
      .from("pool_entries")
      .delete()
      .eq("player_id", playerId);
    if (error) throw error;
  }

  async findByPlayer(playerId: string): Promise<PoolEntry | null> {
    const { data, error } = await this.db
      .from("pool_entries")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPool(data) : null;
  }

  async findByCountyAndBand(county: string, band: string): Promise<PoolEntry[]> {
    const { data, error } = await this.db
      .from("pool_entries")
      .select("*")
      .ilike("county", county)
      .eq("band", band);
    if (error) throw error;
    return (data || []).map(rowToPool);
  }

  async findByCounty(county: string): Promise<PoolEntry[]> {
    const { data, error } = await this.db
      .from("pool_entries")
      .select("*")
      .ilike("county", county);
    if (error) throw error;
    return (data || []).map(rowToPool);
  }

  async removeMany(playerIds: string[]): Promise<void> {
    if (playerIds.length === 0) return;
    const { error } = await this.db
      .from("pool_entries")
      .delete()
      .in("player_id", playerIds);
    if (error) throw error;
  }
}

// ── Notification mapping ─────────────────────────────────────────────────────

function notificationToRow(n: Notification): Record<string, unknown> {
  return {
    id: n.id,
    player_id: n.playerId,
    match_id: n.matchId ?? null,
    tournament_id: n.tournamentId ?? null,
    type: n.type,
    subject: n.subject,
    body: n.body,
    channel: n.channel,
    status: n.status,
    scheduled_for: n.scheduledFor,
    sent_at: n.sentAt ?? null,
    created_at: n.createdAt,
    metadata: n.metadata ? JSON.stringify(n.metadata) : JSON.stringify({}),
  };
}

function rowToNotification(row: Record<string, unknown>): Notification {
  const n: Notification = {
    id: row.id as string,
    playerId: row.player_id as string,
    type: row.type as string,
    subject: row.subject as string,
    body: row.body as string,
    channel: (row.channel as Notification["channel"]) || "email",
    status: (row.status as Notification["status"]) || "queued",
    scheduledFor: String(row.scheduled_for),
    createdAt: String(row.created_at),
  };
  if (row.match_id) n.matchId = row.match_id as string;
  if (row.tournament_id) n.tournamentId = row.tournament_id as string;
  if (row.sent_at) n.sentAt = String(row.sent_at);
  if (row.metadata) {
    const parsed = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
    if (parsed && typeof parsed === "object" && Object.keys(parsed as object).length > 0) {
      n.metadata = parsed as Record<string, unknown>;
    }
  }
  return n;
}

export class SupabaseNotificationRepo implements NotificationRepo {
  constructor(private readonly db: SupabaseClient) {}

  async queue(notification: Notification): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .insert(notificationToRow(notification));
    if (error) throw error;
  }

  async findPending(limit = 50): Promise<Notification[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("status", "queued")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(rowToNotification);
  }

  async markSent(id: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  }

  async markFailed(id: string): Promise<void> {
    const { error } = await this.db
      .from("notifications")
      .update({ status: "failed" })
      .eq("id", id);
    if (error) throw error;
  }

  async findByMatchAndType(matchId: string, type: string): Promise<Notification[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("match_id", matchId)
      .eq("type", type);
    if (error) throw error;
    return (data || []).map(rowToNotification);
  }

  async findByPlayerSince(playerId: string, since: string): Promise<Notification[]> {
    const { data, error } = await this.db
      .from("notifications")
      .select("*")
      .eq("player_id", playerId)
      .gte("created_at", since);
    if (error) throw error;
    return (data || []).map(rowToNotification);
  }

  async claimPending(limit = 50): Promise<Notification[]> {
    const { data, error } = await this.db.rpc("claim_pending_notifications", {
      batch_size: limit,
    });
    if (error) throw error;
    return (data || []).map(rowToNotification);
  }
}

// ── NotificationDelivery mapping ────────────────────────────────────────────

function rowToDelivery(row: Record<string, unknown>): NotificationDelivery {
  return {
    id: row.id as string,
    notificationId: row.notification_id as string,
    channel: row.channel as NotificationDelivery["channel"],
    providerMessageId: row.provider_message_id as string | undefined,
    status: row.status as NotificationDelivery["status"],
    pushSentAt: row.push_sent_at ? String(row.push_sent_at) : undefined,
    smsSentAt: row.sms_sent_at ? String(row.sms_sent_at) : undefined,
    acknowledgedAt: row.acknowledged_at ? String(row.acknowledged_at) : undefined,
    failureReason: row.failure_reason as string | undefined,
    createdAt: String(row.created_at),
  };
}

// ── Device Token Repository ──────────────────────────────────────────────────

function rowToDeviceToken(row: Record<string, unknown>): DeviceToken {
  return {
    id: row.id as string,
    playerId: row.player_id as string,
    token: row.token as string,
    platform: row.platform as DeviceToken["platform"],
    appVersion: row.app_version as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabaseDeviceTokenRepo implements DeviceTokenRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findByPlayerId(playerId: string): Promise<DeviceToken[]> {
    const { data, error } = await this.db
      .from("device_tokens")
      .select("*")
      .eq("player_id", playerId);
    if (error) throw error;
    return (data || []).map(rowToDeviceToken);
  }

  async deleteByToken(token: string): Promise<void> {
    const { error } = await this.db
      .from("device_tokens")
      .delete()
      .eq("token", token);
    if (error) throw error;
  }
}

export class SupabaseNotificationDeliveryRepo implements NotificationDeliveryRepo {
  constructor(private readonly db: SupabaseClient) {}

  async create(delivery: NotificationDelivery): Promise<void> {
    const { error } = await this.db
      .from("notification_deliveries")
      .insert({
        id: delivery.id,
        notification_id: delivery.notificationId,
        channel: delivery.channel,
        provider_message_id: delivery.providerMessageId ?? null,
        status: delivery.status,
        push_sent_at: delivery.pushSentAt ?? null,
        sms_sent_at: delivery.smsSentAt ?? null,
        acknowledged_at: delivery.acknowledgedAt ?? null,
        failure_reason: delivery.failureReason ?? null,
        created_at: delivery.createdAt,
      });
    if (error) throw error;
  }

  async findByNotificationId(notificationId: string): Promise<NotificationDelivery | null> {
    const { data, error } = await this.db
      .from("notification_deliveries")
      .select("*")
      .eq("notification_id", notificationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToDelivery(data) : null;
  }

  async updateStatus(id: string, status: NotificationDelivery["status"], fields?: Partial<NotificationDelivery>): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (fields?.pushSentAt) update.push_sent_at = fields.pushSentAt;
    if (fields?.smsSentAt) update.sms_sent_at = fields.smsSentAt;
    if (fields?.acknowledgedAt) update.acknowledged_at = fields.acknowledgedAt;
    if (fields?.failureReason) update.failure_reason = fields.failureReason;
    if (fields?.providerMessageId) update.provider_message_id = fields.providerMessageId;

    const { error } = await this.db
      .from("notification_deliveries")
      .update(update)
      .eq("id", id);
    if (error) throw error;
  }

  async findPendingEscalations(escalationMinutes: number): Promise<NotificationDelivery[]> {
    const cutoff = new Date(Date.now() - escalationMinutes * 60 * 1000).toISOString();
    const { data, error } = await this.db
      .from("notification_deliveries")
      .select("*")
      .eq("status", "push_sent")
      .eq("channel", "push")
      .lte("push_sent_at", cutoff)
      .limit(50);
    if (error) throw error;
    return (data || []).map(rowToDelivery);
  }

  async acknowledge(notificationId: string): Promise<void> {
    const { error } = await this.db
      .from("notification_deliveries")
      .update({
        status: "acknowledged",
        acknowledged_at: new Date().toISOString(),
      })
      .eq("notification_id", notificationId)
      .eq("channel", "push");
    if (error) throw error;
  }
}

export class SupabasePlayerPhoneRepo implements PlayerPhoneRepo {
  constructor(private readonly db: SupabaseClient) {}

  async findByPlayerId(playerId: string): Promise<{ phoneNumber: string } | null> {
    const { data, error } = await this.db
      .from("player_phones")
      .select("phone_number")
      .eq("player_id", playerId)
      .maybeSingle();
    if (error) throw error;
    return data ? { phoneNumber: data.phone_number as string } : null;
  }

  async upsert(playerId: string, phoneNumber: string): Promise<void> {
    const { error } = await this.db
      .from("player_phones")
      .upsert({
        player_id: playerId,
        phone_number: phoneNumber,
      }, { onConflict: "player_id" });
    if (error) throw error;
  }
}
