import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser, AvailabilitySlot, Match, Player, PoolEntry, Tournament } from "@rally/core";
import type { AuthRepo, AvailabilityRepo, MatchRepo, PlayerRepo, PoolRepo, TournamentRepo } from "./interfaces.js";

// ── Helpers: camelCase ↔ snake_case ─────────────────────────────────────────────

function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)] = v;
  }
  return out;
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  }
  return out;
}

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
    provisionalRemaining: Number(row.provisional_remaining) ?? 5,
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
    created_at: m.createdAt,
    updated_at: m.updatedAt,
  };
}

function rowToMatch(row: Record<string, unknown>): Match {
  return {
    id: row.id as string,
    challengerId: row.challenger_id as string,
    opponentId: row.opponent_id as string,
    tournamentId: (row.tournament_id as string) || undefined,
    status: row.status as Match["status"],
    proposals: (typeof row.proposals === "string" ? JSON.parse(row.proposals) : row.proposals) || [],
    scheduledAt: row.scheduled_at ? String(row.scheduled_at) : undefined,
    venue: (row.venue as string) || undefined,
    result: row.result
      ? typeof row.result === "string"
        ? JSON.parse(row.result)
        : row.result
      : undefined,
    schedulingTier: (row.scheduling_tier as Match["schedulingTier"]) || undefined,
    nearMiss: row.near_miss
      ? typeof row.near_miss === "string"
        ? JSON.parse(row.near_miss)
        : row.near_miss
      : undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
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
    created_at: t.createdAt,
  };
}

function rowToTournament(row: Record<string, unknown>): Tournament {
  const parseJson = (v: unknown): unknown => {
    if (typeof v === "string") return JSON.parse(v);
    return v;
  };
  return {
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
    finalsMatches: row.finals_matches
      ? (parseJson(row.finals_matches) as Tournament["finalsMatches"])
      : undefined,
    schedulingResult: row.scheduling_result
      ? (parseJson(row.scheduling_result) as Tournament["schedulingResult"])
      : undefined,
    createdAt: String(row.created_at),
  };
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
