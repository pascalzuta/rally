import type {
  Player,
  AvailabilitySlot,
  Tournament,
  TournamentMatch,
  SchedulingResult,
  SchedulingInfo,
  AvailabilityImpactSuggestion,
  PoolStatus,
  CitySearchResult,
  Match,
} from "./types";

const API = import.meta.env.VITE_API_URL || "/v1";

function authH(token: string): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: token ? authH(token) : { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: authH(token) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: "DELETE", headers: authH(token) });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: authH(token),
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Auth
export const apiLogin = (email: string) => post<{ accessToken: string; player: Player }>("/auth/login", { email });
export const apiGetMe = (token: string) => get<{ player: Player }>("/players/me", token);
export const apiUpdateProfile = (token: string, data: { name: string; city: string; level: string; county?: string; ntrp?: number }) => put<{ player: Player }>("/players/me", data, token);

// Availability
export const apiGetAvailability = (token: string) => get<{ slots: AvailabilitySlot[] }>("/players/me/availability", token);
export const apiSetAvailability = (token: string, slots: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) => put<{ slots: AvailabilitySlot[] }>("/players/me/availability", { slots }, token);

// Tournaments
export const apiGetTournaments = (token: string) => get<{ tournaments: Tournament[] }>("/tournaments", token);
export const apiGetTournament = (token: string, id: string) => get<{ tournament: Tournament; playerNames: Record<string, string> }>(`/tournaments/${id}`, token);
export const apiJoinTournament = (token: string, id: string) => post<{ tournament: Tournament; activated?: boolean; schedulingResult?: SchedulingResult }>(`/tournaments/${id}/join`, {}, token);
export const apiLeaveTournament = (token: string, id: string) => del<{ tournament: Tournament }>(`/tournaments/${id}/leave`, token);
export const apiGetTournamentMatches = (token: string, id: string) => get<{ matches: TournamentMatch[] }>(`/tournaments/${id}/matches`, token);

// Tournament scoring
export const apiSubmitTournamentScore = (token: string, tournamentId: string, matchId: string, winnerId: string, sets: Array<{ aGames: number; bGames: number; tiebreak?: { aPoints: number; bPoints: number } }>) =>
  post<{ status: string; match?: unknown }>(`/tournaments/${tournamentId}/matches/${matchId}/score`, { winnerId, sets }, token);

// Scheduling
export const apiGetSchedulingInfo = (token: string, matchId: string) => get<SchedulingInfo>(`/matches/${matchId}/scheduling-info`, token);
export const apiScheduleMatch = (token: string, matchId: string, datetime: string, label: string) => post<{ match: unknown; scheduled: boolean }>(`/matches/${matchId}/schedule`, { datetime, label }, token);
export const apiFlexAccept = (token: string, matchId: string, datetime: string, label: string) => post<{ match: unknown; scheduled: boolean }>(`/matches/${matchId}/flex-accept`, { datetime, label }, token);
export const apiProposeTimes = (token: string, matchId: string, times: Array<{ datetime: string; label: string }>) => post<{ match: unknown }>(`/matches/${matchId}/propose-times`, { times }, token);
export const apiAcceptTime = (token: string, matchId: string, proposalId: string) => post<{ match: unknown; scheduled: boolean }>(`/matches/${matchId}/accept-time`, { proposalId }, token);

// Availability impact
export const apiGetAvailabilityImpact = (token: string, playerId: string) => get<{ suggestions: AvailabilityImpactSuggestion[] }>(`/players/${playerId}/availability-impact`, token);

// Pool
export const apiGetPoolStatus = (token: string, county?: string) => get<PoolStatus>(`/pool/status${county ? `?county=${encodeURIComponent(county)}` : ""}`, token);
export const apiJoinPool = (token: string, county?: string) => post<{ entry: unknown }>("/pool/signup", county ? { county } : {}, token);
export const apiLeavePool = (token: string) => del<{ ok: boolean }>("/pool/leave", token);

// Debug
export const apiSeedRich = () => post<{ ok: boolean; counties: number; players: number; tournaments: number }>("/debug/seed-rich", {});
export const apiSimulateTournament = () => post<{ ok: boolean; tournamentId: string }>("/debug/simulate-tournament", {});
export const apiAcceptProposals = (playerId: string) => post<{ ok: boolean; accepted: number }>("/debug/accept-proposals", { playerId });

// City search
export const apiSearchCities = async (q: string): Promise<CitySearchResult[]> => {
  const res = await fetch(`${API}/cities/search?q=${encodeURIComponent(q)}&limit=5`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results: CitySearchResult[] };
  return data.results;
};

// Subscription
export const apiCheckout = (token: string, plan: string) => post<{ url: string | null; devMode?: boolean; player?: Player }>("/subscription/checkout", { plan }, token);

// Matches (challenge)
export const apiGetMatches = (token: string) => get<{ matches: Match[] }>("/matches", token);
