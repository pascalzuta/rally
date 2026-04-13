import type { AuthUser, AvailabilitySlot, Match, Notification, Player, PoolEntry, Tournament } from "@rally/core";
import type { AuthRepo, AvailabilityRepo, DeviceToken, DeviceTokenRepo, MatchRepo, NotificationRepo, PlayerRepo, PoolRepo, TournamentRepo } from "./interfaces.js";

export class InMemoryAuthRepo implements AuthRepo {
  private readonly byId = new Map<string, AuthUser>();
  private readonly byEmail = new Map<string, string>();

  async findByEmail(email: string): Promise<AuthUser | null> {
    const id = this.byEmail.get(email.toLowerCase());
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    return this.byId.get(id) ?? null;
  }

  async upsert(user: AuthUser): Promise<void> {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email.toLowerCase(), user.id);
  }
}

export class InMemoryPlayerRepo implements PlayerRepo {
  private readonly byId = new Map<string, Player>();

  async findById(id: string): Promise<Player | null> {
    return this.byId.get(id) ?? null;
  }

  async findByCity(city: string): Promise<Player[]> {
    const lower = city.toLowerCase();
    return [...this.byId.values()].filter((p) => p.city.toLowerCase() === lower);
  }

  async findByCounty(county: string): Promise<Player[]> {
    const lower = county.toLowerCase();
    return [...this.byId.values()].filter((p) => p.county.toLowerCase() === lower);
  }

  async upsert(player: Player): Promise<void> {
    this.byId.set(player.id, player);
  }
}

export class InMemoryAvailabilityRepo implements AvailabilityRepo {
  private readonly byPlayer = new Map<string, AvailabilitySlot[]>();

  async getByPlayer(playerId: string): Promise<AvailabilitySlot[]> {
    return this.byPlayer.get(playerId) ?? [];
  }

  async setForPlayer(playerId: string, slots: AvailabilitySlot[]): Promise<void> {
    this.byPlayer.set(playerId, slots);
  }
}

export class InMemoryMatchRepo implements MatchRepo {
  private readonly byId = new Map<string, Match>();

  async findById(id: string): Promise<Match | null> {
    return this.byId.get(id) ?? null;
  }

  async findByPlayer(playerId: string): Promise<Match[]> {
    return [...this.byId.values()]
      .filter((m) => m.challengerId === playerId || m.opponentId === playerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findByTournament(tournamentId: string): Promise<Match[]> {
    return [...this.byId.values()]
      .filter((m) => m.tournamentId === tournamentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async save(match: Match): Promise<void> {
    this.byId.set(match.id, match);
  }
}

export class InMemoryTournamentRepo implements TournamentRepo {
  private readonly byId = new Map<string, Tournament>();

  async findById(id: string): Promise<Tournament | null> {
    return this.byId.get(id) ?? null;
  }

  async listOpen(): Promise<Tournament[]> {
    return [...this.byId.values()].filter(
      (t) => t.status === "registration" || t.status === "active"
    );
  }

  async listByStatus(status: string): Promise<Tournament[]> {
    return [...this.byId.values()].filter((t) => t.status === status);
  }

  async listAll(): Promise<Tournament[]> {
    return [...this.byId.values()];
  }

  async findByCountyBandMonth(county: string, band: string, month: string): Promise<Tournament | null> {
    const lower = county.toLowerCase();
    return (
      [...this.byId.values()].find(
        (t) =>
          t.county.toLowerCase() === lower &&
          t.band === band &&
          t.month === month
      ) ?? null
    );
  }

  async save(tournament: Tournament): Promise<void> {
    this.byId.set(tournament.id, tournament);
  }

  async remove(id: string): Promise<void> {
    this.byId.delete(id);
  }
}

export class InMemoryPoolRepo implements PoolRepo {
  private readonly byPlayerId = new Map<string, PoolEntry>();

  async add(entry: PoolEntry): Promise<void> {
    this.byPlayerId.set(entry.playerId, entry);
  }

  async remove(playerId: string): Promise<void> {
    this.byPlayerId.delete(playerId);
  }

  async findByPlayer(playerId: string): Promise<PoolEntry | null> {
    return this.byPlayerId.get(playerId) ?? null;
  }

  async findByCountyAndBand(county: string, band: string): Promise<PoolEntry[]> {
    const lower = county.toLowerCase();
    return [...this.byPlayerId.values()].filter(
      (e) => e.county.toLowerCase() === lower && e.band === band
    );
  }

  async findByCounty(county: string): Promise<PoolEntry[]> {
    const lower = county.toLowerCase();
    return [...this.byPlayerId.values()].filter(
      (e) => e.county.toLowerCase() === lower
    );
  }

  async removeMany(playerIds: string[]): Promise<void> {
    for (const id of playerIds) {
      this.byPlayerId.delete(id);
    }
  }
}

export class InMemoryDeviceTokenRepo implements DeviceTokenRepo {
  private readonly tokens: DeviceToken[] = [];

  async findByPlayerId(playerId: string): Promise<DeviceToken[]> {
    return this.tokens.filter((t) => t.playerId === playerId);
  }

  async deleteByToken(token: string): Promise<void> {
    const idx = this.tokens.findIndex((t) => t.token === token);
    if (idx >= 0) this.tokens.splice(idx, 1);
  }
}

export class InMemoryNotificationRepo implements NotificationRepo {
  private readonly byId = new Map<string, Notification>();

  async queue(notification: Notification): Promise<void> {
    this.byId.set(notification.id, notification);
  }

  async findPending(limit = 50): Promise<Notification[]> {
    const now = new Date().toISOString();
    return [...this.byId.values()]
      .filter((n) => n.status === "queued" && n.scheduledFor <= now)
      .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
      .slice(0, limit);
  }

  async markSent(id: string): Promise<void> {
    const n = this.byId.get(id);
    if (n) {
      n.status = "sent";
      n.sentAt = new Date().toISOString();
    }
  }

  async markFailed(id: string): Promise<void> {
    const n = this.byId.get(id);
    if (n) n.status = "failed";
  }

  async findByMatchAndType(matchId: string, type: string): Promise<Notification[]> {
    return [...this.byId.values()].filter(
      (n) => n.matchId === matchId && n.type === type
    );
  }

  async findByPlayerSince(playerId: string, since: string): Promise<Notification[]> {
    return [...this.byId.values()].filter(
      (n) => n.playerId === playerId && n.createdAt >= since
    );
  }
}
