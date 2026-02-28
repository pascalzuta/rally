import type { AuthUser, AvailabilitySlot, Match, Player, PoolEntry, Tournament } from "@rally/core";

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
