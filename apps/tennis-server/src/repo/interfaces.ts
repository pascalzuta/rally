import type { AuthUser, AvailabilitySlot, Match, Notification, NotificationDelivery, Player, PoolEntry, Tournament } from "@rally/core";

export interface AuthRepo {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  upsert(user: AuthUser): Promise<void>;
}

export interface PlayerRepo {
  findById(id: string): Promise<Player | null>;
  findByCity(city: string): Promise<Player[]>;
  findByCounty(county: string): Promise<Player[]>;
  upsert(player: Player): Promise<void>;
}

export interface AvailabilityRepo {
  getByPlayer(playerId: string): Promise<AvailabilitySlot[]>;
  setForPlayer(playerId: string, slots: AvailabilitySlot[]): Promise<void>;
}

export interface MatchRepo {
  findById(id: string): Promise<Match | null>;
  findByPlayer(playerId: string): Promise<Match[]>;
  findByTournament(tournamentId: string): Promise<Match[]>;
  save(match: Match): Promise<void>;
}

export interface TournamentRepo {
  findById(id: string): Promise<Tournament | null>;
  listOpen(): Promise<Tournament[]>;
  listByStatus(status: string): Promise<Tournament[]>;
  listAll(): Promise<Tournament[]>;
  findByCountyBandMonth(county: string, band: string, month: string): Promise<Tournament | null>;
  save(tournament: Tournament): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface PoolRepo {
  add(entry: PoolEntry): Promise<void>;
  remove(playerId: string): Promise<void>;
  findByPlayer(playerId: string): Promise<PoolEntry | null>;
  findByCountyAndBand(county: string, band: string): Promise<PoolEntry[]>;
  findByCounty(county: string): Promise<PoolEntry[]>;
  removeMany(playerIds: string[]): Promise<void>;
}

export interface NotificationRepo {
  queue(notification: Notification): Promise<void>;
  findPending(limit?: number): Promise<Notification[]>;
  /** Atomically claim pending notifications (uses UPDATE...RETURNING in Supabase). */
  claimPending(limit?: number): Promise<Notification[]>;
  markSent(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
  findByMatchAndType(matchId: string, type: string): Promise<Notification[]>;
  findByPlayerSince(playerId: string, since: string): Promise<Notification[]>;
}

export interface NotificationDeliveryRepo {
  create(delivery: NotificationDelivery): Promise<void>;
  findByNotificationId(notificationId: string): Promise<NotificationDelivery | null>;
  updateStatus(id: string, status: NotificationDelivery["status"], fields?: Partial<NotificationDelivery>): Promise<void>;
  /** Find Tier 1 deliveries that are past their escalation window and haven't been acknowledged. */
  findPendingEscalations(escalationMinutes: number): Promise<NotificationDelivery[]>;
  /** Find delivery by notification ID for acknowledgment. */
  acknowledge(notificationId: string): Promise<void>;
}

export interface PlayerPhoneRepo {
  findByPlayerId(playerId: string): Promise<{ phoneNumber: string } | null>;
  upsert(playerId: string, phoneNumber: string): Promise<void>;
}

export interface DeviceToken {
  id: string;
  playerId: string;
  token: string;
  platform: "ios" | "android" | "web";
  appVersion?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTokenRepo {
  findByPlayerId(playerId: string): Promise<DeviceToken[]>;
  deleteByToken(token: string): Promise<void>;
}
