import { useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SkillLevel = "beginner" | "intermediate" | "advanced";
type MatchStatus = "pending" | "scheduling" | "scheduled" | "completed" | "cancelled";
type AuthMode = "signin" | "signup";
type SkillBand = "3.0" | "3.5" | "4.0";
type TournamentStatus = "registration" | "active" | "finals" | "completed";
type SubscriptionStatus = "free" | "active" | "cancelled";

interface Player {
  id: string; email: string; name: string; city: string;
  level: SkillLevel; rating: number; wins: number; losses: number;
  county: string; ntrp: number; ratingConfidence: number;
  provisionalRemaining: number; subscription: SubscriptionStatus;
  createdAt: string; updatedAt: string;
}

interface AvailabilitySlot {
  id: string; playerId: string; dayOfWeek: number; startTime: string; endTime: string;
}

interface TimeProposal {
  id: string; datetime: string; label: string; acceptedBy: string[];
}

interface SetScore {
  aGames: number; bGames: number;
  tiebreak?: { aPoints: number; bPoints: number };
}

interface MatchResult {
  winnerId: string; score?: string; sets?: SetScore[];
  reportedBy: string; reportedAt: string;
  confirmedBy?: string; confirmedAt?: string;
}

interface ResultReport {
  winnerId: string; sets: SetScore[];
  reportedBy: string; reportedAt: string;
}

interface StandingEntry {
  playerId: string; played: number; wins: number; losses: number;
  setsWon: number; setsLost: number; setDiff: number;
  gamesWon: number; gamesLost: number; gameDiff: number;
  headToHead: Record<string, "win" | "loss" | "pending">;
}

interface RoundRobinPairing {
  homeIndex: number; awayIndex: number; matchId: string | null;
}

interface TournamentRound {
  roundNumber: number; targetWeek: number; pairings: RoundRobinPairing[];
}

interface Match {
  id: string; challengerId: string; opponentId: string; status: MatchStatus;
  proposals: TimeProposal[]; scheduledAt?: string; venue?: string;
  result?: MatchResult;
  createdAt: string; updatedAt: string;
}

interface Tournament {
  id: string; month: string; name: string; county: string; band: SkillBand;
  status: TournamentStatus; playerIds: string[];
  minPlayers: number; maxPlayers: number;
  rounds: TournamentRound[]; standings: StandingEntry[];
  pendingResults: Record<string, ResultReport>;
  registrationOpenedAt: string;
  finalsMatches?: { champMatchId?: string; thirdMatchId?: string };
  schedulingResult?: { scheduledCount: number; failedCount: number; failedMatchIds: string[] };
  createdAt: string;
  // Legacy fields for backward compat
  city?: string; level?: string;
}

interface BandBreakdown {
  band: string; poolCount: number; tournamentCount: number;
}

interface PoolStatus {
  inPool: boolean; count: number; needed: number;
  band: SkillBand; county: string;
  tournamentId: string | null; daysRemaining: number;
  totalCountyInterest: number;
  bandBreakdown: BandBreakdown[];
}

interface CitySearchResult {
  city: string; state: string; stateCode: string; county: string;
}

interface TimeProposalUI {
  id: string;
  datetime: string;
  label: string;
  acceptedBy: string[];
}

interface SchedulingOption {
  datetime: string;
  label: string;
}

interface TournamentMatch {
  id: string; tournamentId: string;
  homePlayerId: string; awayPlayerId: string;
  round: number; status: string;
  proposals?: TimeProposalUI[];
  scheduledAt?: string;
  result?: MatchResult;
  pendingResult?: ResultReport;
}

// ─── Screens ──────────────────────────────────────────────────────────────────
type Screen = "start" | "login" | "setup" | "home" | "tournaments" | "matches" | "players" | "availability" | "profile" | "match-detail" | "tournament-detail";

// ─── API helpers ──────────────────────────────────────────────────────────────
const API = "/v1";
const TOKEN_KEY = "rally-token"; // sessionStorage = per-tab session

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

async function put<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT", headers: authH(token), body: JSON.stringify(body)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE", headers: authH(token)
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Demo accounts (shown as quick-login cards) ────────────────────────────

const DEMO_ACCOUNTS = [
  { email: "alice@rally.test",   name: "Alice Johnson", rating: 1085, level: "Intermediate", color: "#D97706" },
  { email: "bob@rally.test",     name: "Bob Carter",    rating: 960,  level: "Intermediate", color: "#16A34A" },
  { email: "charlie@rally.test", name: "Charlie Davis", rating: 920,  level: "Beginner",     color: "#3B82F6" },
  { email: "diana@rally.test",   name: "Diana Lee",     rating: 1340, level: "Advanced",     color: "#9333EA" },
  { email: "ethan@rally.test",   name: "Ethan Walsh",   rating: 1025, level: "Intermediate", color: "#F97316" },
  { email: "fiona@rally.test",   name: "Fiona Moore",   rating: 875,  level: "Beginner",     color: "#0891B2" },
];

// ─── Tournament test accounts (6 players in same band/county) ────────────────

const TOURNEY_TEST_ACCOUNTS = [
  { email: "t1-alex@rally.test",  name: "T1-Alex [3.5]",  color: "#ef4444" },
  { email: "t2-beth@rally.test",  name: "T2-Beth [3.5]",  color: "#f97316" },
  { email: "t3-chris@rally.test", name: "T3-Chris [3.5]", color: "#eab308" },
  { email: "t4-dana@rally.test",  name: "T4-Dana [3.5]",  color: "#22c55e" },
  { email: "t5-eli@rally.test",   name: "T5-Eli [3.5]",   color: "#3b82f6" },
  { email: "t6-faye@rally.test",  name: "T6-Faye [3.5]",  color: "#a855f7" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function levelLabel(r: number): string {
  if (r < 1050) return "Beginner";
  if (r < 1200) return "Intermediate";
  return "Advanced";
}

function levelClass(level: string): string {
  if (level === "advanced") return "level-advanced";
  if (level === "intermediate") return "level-intermediate";
  return "level-beginner";
}

function initials(name: string): string {
  const words = name.split(" ").filter(w => !w.startsWith("["));
  return words.map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function displayName(name: string): string {
  return name.replace(/\s*\[[\d.]+\]$/, "").trim();
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  } catch { return iso; }
}

function formatMonth(ym: string): string {
  try {
    const [y, m] = ym.split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  } catch { return ym; }
}

function tournamentLevelLabel(level: string): string {
  const map: Record<string, string> = {
    all: "All Levels", beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced"
  };
  return map[level] ?? level;
}

// ─── Nav icons (minimal stroke SVGs — color via currentColor) ─────────────────

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

function IconTournaments() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M9 14.5l-3 7.5 6-3 6 3-3-7.5" />
      <path d="M12 5v6" />
      <path d="M9 8h6" />
    </svg>
  );
}

function IconMatches() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="8 6 12 2 16 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
      <path d="M4 20h16" />
      <path d="M7 15h10a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z" />
    </svg>
  );
}

function IconPlayers() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3.5" />
      <path d="M2 21v-1.5A5.5 5.5 0 0 1 7.5 14h3A5.5 5.5 0 0 1 16 19.5V21" />
      <circle cx="18" cy="7" r="2.5" />
      <path d="M18 12c2.2.3 4 2.1 4 4.5V21" />
    </svg>
  );
}

function IconSchedule() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="2.5" />
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="2.5" />
      <line x1="16" y1="14" x2="16" y2="14" strokeWidth="2.5" />
      <line x1="8" y1="18" x2="8" y2="18" strokeWidth="2.5" />
      <line x1="12" y1="18" x2="12" y2="18" strokeWidth="2.5" />
    </svg>
  );
}

function IconMe() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20v-1a8 8 0 0 1 16 0v1" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconLocation() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // Use sessionStorage so each browser tab is a separate session
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [player, setPlayer] = useState<Player | null>(null);
  const [screen, setScreen] = useState<Screen>("start");
  const [matches, setMatches] = useState<Match[]>([]);
  const [nearbyPlayers, setNearbyPlayers] = useState<Player[]>([]);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [playerCache, setPlayerCache] = useState<Record<string, Player>>({});

  // Auth state
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Setup state
  const [setupName, setSetupName] = useState("");
  const [setupCity, setSetupCity] = useState("");
  const [setupLevel, setSetupLevel] = useState<SkillLevel>("intermediate");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState("");

  // Challenge state
  const [challengingId, setChallengingId] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeError, setChallengeError] = useState("");
  const [challengeVenue, setChallengeVenue] = useState("");

  // Availability state
  const [newDay, setNewDay] = useState(6);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("12:00");
  const [availSaving, setAvailSaving] = useState(false);
  const [availMsg, setAvailMsg] = useState("");

  // Result state
  const [reportWinnerId, setReportWinnerId] = useState("");
  const [reportScore, setReportScore] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  // Home / area search state
  const [citySearchInput, setCitySearchInput] = useState("");
  const [activeCityFilter, setActiveCityFilter] = useState<string>(""); // "" = player's own city

  // Tournament detail state
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [tournamentDetail, setTournamentDetail] = useState<Tournament | null>(null);
  const [tournamentPlayerNames, setTournamentPlayerNames] = useState<Record<string, string>>({});
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentDetailLoading, setTournamentDetailLoading] = useState(false);
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});

  // All-tournaments match state (for Tourneys tab Action Needed + Matches tab)
  const [allMyTournamentMatches, setAllMyTournamentMatches] = useState<Array<TournamentMatch & { tournamentName: string; tournamentId: string }>>([]);
  const [allTournamentPlayerNames, setAllTournamentPlayerNames] = useState<Record<string, string>>({});

  // Pool state
  const [poolStatus, setPoolStatus] = useState<PoolStatus | null>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  // Score entry state (tournament matches)
  const [scoreEntryMatchId, setScoreEntryMatchId] = useState<string | null>(null);
  const [scoreSets, setScoreSets] = useState<Array<{ myGames: string; theirGames: string }>>([
    { myGames: "", theirGames: "" },
    { myGames: "", theirGames: "" },
  ]);
  const [scoreThirdSetTiebreak, setScoreThirdSetTiebreak] = useState(false);
  const [scoreTiebreakMy, setScoreTiebreakMy] = useState("");
  const [scoreTiebreakTheir, setScoreTiebreakTheir] = useState("");
  const [scoreSubmitting, setScoreSubmitting] = useState(false);
  const [scoreError, setScoreError] = useState("");
  const [scoreSuccess, setScoreSuccess] = useState("");
  const [scoreWinnerId, setScoreWinnerId] = useState("");

  // Scheduling modal state
  const [schedulingModalMatchId, setSchedulingModalMatchId] = useState<string | null>(null);
  const [schedulingOptions, setSchedulingOptions] = useState<SchedulingOption[]>([]);
  const [schedulingOpponentName, setSchedulingOpponentName] = useState("");
  const [schedulingLoading, setSchedulingLoading] = useState(false);

  // Setup state additions
  const [setupCounty, setSetupCounty] = useState("");
  const [setupNtrp, setSetupNtrp] = useState<number>(3.5);

  // City autocomplete state (shared helper)
  const [setupCityResults, setSetupCityResults] = useState<CitySearchResult[]>([]);
  const [setupCityDropdownOpen, setSetupCityDropdownOpen] = useState(false);
  const [homeCityResults, setHomeCityResults] = useState<CitySearchResult[]>([]);
  const [homeCityDropdownOpen, setHomeCityDropdownOpen] = useState(false);
  const [selectedSearchCounty, setSelectedSearchCounty] = useState<string>("");
  const [selectedSearchCityLabel, setSelectedSearchCityLabel] = useState<string>("");

  // Tournament request state
  const [tournamentRequested, setTournamentRequested] = useState(false);
  const [tournamentRequestCounty, setTournamentRequestCounty] = useState("");
  const [tournamentRequestLoading, setTournamentRequestLoading] = useState(false);

  // Pool status for searched area (different from player's own area)
  const [searchAreaPoolStatus, setSearchAreaPoolStatus] = useState<PoolStatus | null>(null);

  // ── Data loaders ────────────────────────────────────────────────────────────

  async function loadMatches(t: string) {
    try { const d = await get<{ matches: Match[] }>("/matches", t); setMatches(d.matches); } catch { /* silent */ }
  }

  async function loadNearby(t: string) {
    try { const d = await get<{ players: Player[] }>("/players/nearby", t); setNearbyPlayers(d.players); } catch { /* silent */ }
  }

  async function loadAvailability(t: string) {
    try { const d = await get<{ slots: AvailabilitySlot[] }>("/players/me/availability", t); setAvailability(d.slots); } catch { /* silent */ }
  }

  async function loadTournaments(t: string) {
    try { const d = await get<{ tournaments: Tournament[] }>("/tournaments", t); setTournaments(d.tournaments); } catch { /* silent */ }
  }

  async function loadPoolStatus(t: string) {
    try { const d = await get<PoolStatus>("/pool/status", t); setPoolStatus(d); } catch { /* silent */ }
  }

  async function loadTournamentDetail(tournamentId: string, t: string) {
    setTournamentDetailLoading(true);
    try {
      const [detail, matchData] = await Promise.all([
        get<{ tournament: Tournament; playerNames: Record<string, string> }>(`/tournaments/${tournamentId}`, t),
        get<{ matches: TournamentMatch[] }>(`/tournaments/${tournamentId}/matches`, t),
      ]);
      setTournamentDetail(detail.tournament);
      setTournamentPlayerNames(detail.playerNames);
      setTournamentMatches(matchData.matches);
    } catch { /* silent */ } finally { setTournamentDetailLoading(false); }
  }

  async function loadAllMyTournamentMatches(t: string) {
    if (!player) return;
    // Fetch fresh tournament list to avoid stale state
    let tList: Tournament[] = tournaments;
    try {
      const d = await get<{ tournaments: Tournament[] }>("/tournaments", t);
      tList = d.tournaments;
    } catch { /* use existing */ }
    const myTournaments = tList.filter(tr =>
      tr.playerIds.includes(player.id) && (tr.status === "active" || tr.status === "finals")
    );
    const allMatches: Array<TournamentMatch & { tournamentName: string; tournamentId: string }> = [];
    const allNames: Record<string, string> = {};
    await Promise.all(myTournaments.map(async (tr) => {
      try {
        const [detail, matchData] = await Promise.all([
          get<{ tournament: Tournament; playerNames: Record<string, string> }>(`/tournaments/${tr.id}`, t),
          get<{ matches: TournamentMatch[] }>(`/tournaments/${tr.id}/matches`, t),
        ]);
        Object.assign(allNames, detail.playerNames);
        for (const m of matchData.matches) {
          if (m.homePlayerId === player.id || m.awayPlayerId === player.id) {
            allMatches.push({ ...m, tournamentName: tr.name, tournamentId: tr.id });
          }
        }
      } catch { /* silent */ }
    }));
    setAllMyTournamentMatches(allMatches);
    setAllTournamentPlayerNames(prev => ({ ...prev, ...allNames }));
  }

  // City search API (no auth needed)
  async function searchCitiesApi(query: string): Promise<CitySearchResult[]> {
    if (query.trim().length < 2) return [];
    try {
      const res = await fetch(`${API}/cities/search?q=${encodeURIComponent(query.trim())}&limit=8`);
      if (!res.ok) return [];
      const data = (await res.json()) as { results: CitySearchResult[] };
      return data.results;
    } catch { return []; }
  }

  // Debounced city search for setup screen
  useEffect(() => {
    if (!setupCity.trim() || setupCity.trim().length < 2) {
      setSetupCityResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchCitiesApi(setupCity).then(r => {
        setSetupCityResults(r);
        setSetupCityDropdownOpen(r.length > 0);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [setupCity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced city search for home screen
  useEffect(() => {
    if (!citySearchInput.trim() || citySearchInput.trim().length < 2) {
      setHomeCityResults([]);
      setHomeCityDropdownOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      void searchCitiesApi(citySearchInput).then(r => {
        setHomeCityResults(r);
        setHomeCityDropdownOpen(r.length > 0);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [citySearchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load pool status for searched area
  async function loadSearchAreaPoolStatus(county: string, t: string) {
    try {
      const d = await get<PoolStatus>(`/pool/status?county=${encodeURIComponent(county)}`, t);
      setSearchAreaPoolStatus(d);
    } catch { setSearchAreaPoolStatus(null); }
  }

  // Handle "Start a tournament" request
  async function handleStartTournamentRequest(county: string) {
    if (!token) return;
    setTournamentRequestLoading(true);
    try {
      await post<{ entry: unknown }>("/pool/signup", { county }, token);
      setTournamentRequested(true);
      setTournamentRequestCounty(county);
      // Also refresh pool status
      await loadSearchAreaPoolStatus(county, token);
      await loadPoolStatus(token);
    } catch { /* silent */ } finally { setTournamentRequestLoading(false); }
  }

  async function fetchPlayer(id: string, t: string): Promise<Player | null> {
    if (playerCache[id]) return playerCache[id] ?? null;
    try {
      const d = await get<{ player: Player }>(`/players/${id}`, t);
      setPlayerCache(prev => ({ ...prev, [id]: d.player }));
      return d.player;
    } catch { return null; }
  }

  // Restore session on mount
  useEffect(() => {
    if (!token) { setScreen("start"); return; }
    (async () => {
      try {
        const d = await get<{ player: Player }>("/players/me", token);
        setPlayer(d.player);
        if (!d.player.name) { setScreen("setup"); return; }
        setScreen("home");
        void loadTournaments(token);
        void loadMatches(token);
      } catch {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setScreen("start");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !player?.name) return;
    if (screen === "home") { void loadTournaments(token); void loadPoolStatus(token); }
    if (screen === "tournaments") { void loadTournaments(token); void loadAllMyTournamentMatches(token); }
    if (screen === "matches")      { void loadMatches(token); void loadTournaments(token); void loadAllMyTournamentMatches(token); }
    if (screen === "players")      void loadNearby(token);
    if (screen === "availability") void loadAvailability(token);
    if (screen === "profile")      void loadTournaments(token);
    if (screen === "tournament-detail" && selectedTournamentId) {
      void loadTournamentDetail(selectedTournamentId, token);
    }
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token || !player) return;
    for (const m of matches) {
      const otherId = m.challengerId === player.id ? m.opponentId : m.challengerId;
      void fetchPlayer(otherId, token);
    }
  }, [matches]); // eslint-disable-line react-hooks/exhaustive-deps

  function nav(s: Screen) {
    setChallengeError("");
    setScreen(s);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────────

  async function doLogin(email: string) {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) { setLoginError("Enter a valid email"); return; }
    setLoginLoading(true);
    setLoginError("");
    try {
      const d = await post<{ accessToken: string; player: Player }>("/auth/login", { email: clean });
      sessionStorage.setItem(TOKEN_KEY, d.accessToken);
      setToken(d.accessToken);
      setPlayer(d.player);
      if (!d.player.name) {
        setSetupName(""); setSetupCity("");
        setScreen("setup");
      } else {
        setScreen("home");
        void loadTournaments(d.accessToken);
        void loadMatches(d.accessToken);
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed");
    } finally { setLoginLoading(false); }
  }

  // ── Profile setup ─────────────────────────────────────────────────────────

  async function handleSetup() {
    if (!setupName.trim() || !setupCity.trim()) { setSetupError("Name and city are required"); return; }
    if (!token) return;
    setSetupLoading(true); setSetupError("");
    try {
      const d = await put<{ player: Player }>("/players/me", {
        name: setupName.trim(), city: setupCity.trim(), level: setupLevel,
        county: setupCounty.trim(), ntrp: setupNtrp,
      }, token);
      setPlayer(d.player);
      setScreen("home");
      void loadTournaments(token);
      void loadMatches(token);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "Save failed");
    } finally { setSetupLoading(false); }
  }

  // ── Challenge ─────────────────────────────────────────────────────────────

  async function handleChallenge(opponentId: string) {
    if (!token) return;
    setChallengeLoading(true); setChallengeError("");
    try {
      const d = await post<{ match: Match }>("/matches",
        { opponentId, ...(challengeVenue ? { venue: challengeVenue } : {}) }, token
      );
      setMatches(prev => [d.match, ...prev]);
      setChallengingId(null); setChallengeVenue("");
      setSelectedMatch(d.match);
      setReportWinnerId(""); setReportScore(""); setReportError(""); setReportSuccess("");
      nav("match-detail");
    } catch (e) {
      setChallengeError(e instanceof Error ? e.message : "Challenge failed");
    } finally { setChallengeLoading(false); }
  }

  // ── Accept time ───────────────────────────────────────────────────────────

  async function handleAcceptTime(matchId: string, proposalId: string) {
    if (!token) return;
    setAcceptingId(proposalId);
    try {
      const d = await post<{ match: Match; scheduled: boolean }>(
        `/matches/${matchId}/accept-time`, { proposalId }, token
      );
      setSelectedMatch(d.match);
      setMatches(prev => prev.map(m => m.id === matchId ? d.match : m));
    } catch { /* silent */ } finally { setAcceptingId(null); }
  }

  // ── Report result ─────────────────────────────────────────────────────────

  async function handleReportResult(matchId: string) {
    if (!token || !reportWinnerId || !reportScore.trim()) {
      setReportError("Select winner and enter score"); return;
    }
    setReportLoading(true); setReportError(""); setReportSuccess("");
    try {
      const d = await post<{ match: Match; winner: Player; loser: Player }>(
        `/matches/${matchId}/result`, { winnerId: reportWinnerId, score: reportScore.trim() }, token
      );
      setSelectedMatch(d.match);
      setMatches(prev => prev.map(m => m.id === matchId ? d.match : m));
      if (player) {
        const updatedMe = d.winner?.id === player.id ? d.winner : d.loser;
        if (updatedMe) setPlayer(updatedMe);
      }
      setReportSuccess(`Result saved! ${d.winner?.name ?? "Winner"} wins ${reportScore}.`);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Failed to report result");
    } finally { setReportLoading(false); }
  }

  // ── Availability ──────────────────────────────────────────────────────────

  async function addSlot() {
    if (!token) return;
    if (newStart >= newEnd) { setAvailMsg("Start must be before end"); return; }
    const updated = [...availability,
      { id: "", playerId: player?.id ?? "", dayOfWeek: newDay, startTime: newStart, endTime: newEnd }
    ];
    setAvailSaving(true); setAvailMsg("");
    try {
      const d = await put<{ slots: AvailabilitySlot[] }>("/players/me/availability",
        { slots: updated.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) }, token
      );
      setAvailability(d.slots); setAvailMsg("Saved!");
    } catch { setAvailMsg("Save failed"); } finally { setAvailSaving(false); }
  }

  async function removeSlot(slotId: string) {
    if (!token) return;
    const updated = availability.filter(s => s.id !== slotId);
    try {
      const d = await put<{ slots: AvailabilitySlot[] }>("/players/me/availability",
        { slots: updated.map(({ dayOfWeek, startTime, endTime }) => ({ dayOfWeek, startTime, endTime })) }, token
      );
      setAvailability(d.slots);
    } catch { /* silent */ }
  }

  // ── Tournaments ───────────────────────────────────────────────────────────

  async function toggleTournament(t: Tournament) {
    if (!token || !player) return;
    const joined = t.playerIds.includes(player.id);
    try {
      if (joined) {
        const res = await fetch(`${API}/tournaments/${t.id}/leave`, {
          method: "DELETE", headers: authH(token)
        });
        const json = (await res.json()) as { tournament: Tournament };
        setTournaments(prev => prev.map(x => x.id === t.id ? json.tournament : x));
      } else {
        const d = await post<{ tournament: Tournament; activated?: boolean; schedulingResult?: { scheduledCount: number; failedCount: number; failedMatchIds: string[] } }>(`/tournaments/${t.id}/join`, {}, token);
        setTournaments(prev => prev.map(x => x.id === t.id ? d.tournament : x));
        if (d.activated && token) {
          // Tournament was activated — reload data
          void loadTournaments(token);
          void loadAllMyTournamentMatches(token);
          const total = (d.schedulingResult?.scheduledCount ?? 0) + (d.schedulingResult?.failedCount ?? 0);
          const scheduled = d.schedulingResult?.scheduledCount ?? 0;
          if (total > 0) {
            alert(`Tournament activated! ${scheduled}/${total} matches auto-scheduled.${d.schedulingResult?.failedCount ? ` ${d.schedulingResult.failedCount} need manual scheduling.` : ""}`);
          }
        }
      }
    } catch { /* silent */ }
  }

  // ── Scheduling modal ────────────────────────────────────────────────────

  async function openSchedulingModal(matchId: string) {
    if (!token) return;
    setSchedulingModalMatchId(matchId);
    setSchedulingLoading(true);
    setSchedulingOptions([]);
    try {
      const res = await fetch(`${API}/matches/${matchId}/scheduling-options`, {
        headers: authH(token),
      });
      const data = (await res.json()) as { options: SchedulingOption[]; opponentName: string };
      setSchedulingOptions(data.options);
      setSchedulingOpponentName(data.opponentName);
    } catch {
      setSchedulingOptions([]);
    } finally {
      setSchedulingLoading(false);
    }
  }

  async function acceptSchedulingOption(matchId: string, option: SchedulingOption) {
    if (!token) return;
    try {
      const res = await fetch(`${API}/matches/${matchId}/schedule`, {
        method: "POST",
        headers: authH(token),
        body: JSON.stringify({ datetime: option.datetime, label: option.label }),
      });
      if (res.ok) {
        setSchedulingModalMatchId(null);
        // Reload tournament data
        if (selectedTournamentId && token) void loadTournamentDetail(selectedTournamentId, token);
        if (token) void loadAllMyTournamentMatches(token);
      }
    } catch { /* silent */ }
  }

  // ── Pool signup / leave ──────────────────────────────────────────────────

  async function handlePoolSignup() {
    if (!token) return;
    setPoolLoading(true);
    try {
      await post<{ entry: unknown }>("/pool/signup", {}, token);
      await loadPoolStatus(token);
    } catch { /* silent */ } finally { setPoolLoading(false); }
  }

  async function handlePoolLeave() {
    if (!token) return;
    setPoolLoading(true);
    try {
      await del<{ ok: boolean }>("/pool/leave", token);
      await loadPoolStatus(token);
    } catch { /* silent */ } finally { setPoolLoading(false); }
  }

  // ── Score submission (tournament matches) ──────────────────────────────────

  function buildScorePreview(): string {
    const parts: string[] = [];
    for (let i = 0; i < scoreSets.length; i++) {
      const s = scoreSets[i];
      if (s.myGames === "" && s.theirGames === "") continue;
      parts.push(`${s.myGames}-${s.theirGames}`);
    }
    if (scoreThirdSetTiebreak && scoreTiebreakMy && scoreTiebreakTheir) {
      parts.push(`[${scoreTiebreakMy}-${scoreTiebreakTheir}]`);
    }
    return parts.join(", ");
  }

  function resetScoreEntry() {
    setScoreEntryMatchId(null);
    setScoreSets([{ myGames: "", theirGames: "" }, { myGames: "", theirGames: "" }]);
    setScoreThirdSetTiebreak(false);
    setScoreTiebreakMy(""); setScoreTiebreakTheir("");
    setScoreError(""); setScoreSuccess(""); setScoreWinnerId("");
  }

  async function handleTournamentScoreSubmit(matchId: string) {
    if (!token || !player || !selectedTournamentId) return;
    if (!scoreWinnerId) { setScoreError("Select the winner"); return; }

    // Find the match to determine if we are home (challenger) or away (opponent)
    const thisMatch = tournamentMatches.find(m => m.id === matchId);
    const isHome = thisMatch ? thisMatch.homePlayerId === player.id : true;

    const sets: SetScore[] = [];
    for (const s of scoreSets) {
      if (s.myGames === "" && s.theirGames === "") continue;
      const my = parseInt(s.myGames, 10);
      const their = parseInt(s.theirGames, 10);
      if (isNaN(my) || isNaN(their)) { setScoreError("Enter valid game counts"); return; }
      // aGames = challenger (home), bGames = opponent (away)
      sets.push(isHome ? { aGames: my, bGames: their } : { aGames: their, bGames: my });
    }
    if (sets.length === 0) { setScoreError("Enter at least one set"); return; }

    if (scoreThirdSetTiebreak && scoreTiebreakMy && scoreTiebreakTheir) {
      const ta = parseInt(scoreTiebreakMy, 10);
      const tb = parseInt(scoreTiebreakTheir, 10);
      if (!isNaN(ta) && !isNaN(tb)) {
        // Tiebreak points also need to be from challenger's perspective
        sets.push(isHome
          ? { aGames: 1, bGames: 0, tiebreak: { aPoints: ta, bPoints: tb } }
          : { aGames: 0, bGames: 1, tiebreak: { aPoints: tb, bPoints: ta } });
      }
    }

    setScoreSubmitting(true); setScoreError("");
    try {
      await post<{ status: string; match: TournamentMatch }>(
        `/tournaments/${selectedTournamentId}/matches/${matchId}/score`,
        { winnerId: scoreWinnerId, sets },
        token
      );
      setScoreSuccess("Score submitted! Awaiting confirmation from opponent.");
      // Reload tournament detail
      void loadTournamentDetail(selectedTournamentId, token);
    } catch (e) {
      setScoreError(e instanceof Error ? e.message : "Failed to submit score");
    } finally { setScoreSubmitting(false); }
  }

  // ── Subscription checkout ──────────────────────────────────────────────────

  async function handleSubscriptionCheckout() {
    if (!token) return;
    try {
      const d = await post<{ url?: string; devMode?: boolean; player?: Player }>("/subscription/checkout", {}, token);
      if (d.devMode && d.player) {
        setPlayer(d.player);
      } else if (d.url) {
        window.location.href = d.url;
      }
    } catch { /* silent */ }
  }

  function signOut() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null); setPlayer(null); setMatches([]);
    setScreen("start");
  }

  // ─── Computed ───────────────────────────────────────────────────────────────

  const pendingCount = matches.filter(m =>
    m.status === "scheduling" && player && !m.proposals.some(p => p.acceptedBy.includes(player.id))
  ).length;

  // Tournament matches needing action (schedule, enter score, or confirm pending)
  const tourneyActionMatches = allMyTournamentMatches.filter(m => {
    if (!player) return false;
    const hasResult = !!m.result;
    const hasPending = !!m.pendingResult;
    if (hasResult) return false;
    if (m.status === "completed") return false;
    if (hasPending && m.pendingResult?.reportedBy !== player.id) return true; // needs confirmation
    if (m.status === "pending" && !m.scheduledAt && !hasPending) return true; // needs scheduling
    if ((m.status === "scheduled" || m.scheduledAt) && !hasPending) return true; // needs score entry
    if (!hasPending && !m.scheduledAt && m.status !== "pending") return true; // fallback: needs score entry
    return false;
  });
  const tourneyActionCount = tourneyActionMatches.length;

  function opponentName(m: Match): string {
    if (!player) return "Opponent";
    const id = m.challengerId === player.id ? m.opponentId : m.challengerId;
    return displayName(playerCache[id]?.name ?? "Opponent");
  }

  // Home page: city-filtered tournaments (use county or city for backward compat)
  const displayCity = activeCityFilter || player?.county || player?.city || "";
  const tournamentLocation = (t: Tournament) => (t.county || t.city || "").toLowerCase();
  const isSearchingOtherArea = selectedSearchCounty && selectedSearchCounty.toLowerCase() !== (player?.county || player?.city || "").toLowerCase();
  const visibleTournaments = citySearchInput.trim()
    ? tournaments.filter(t => {
        const loc = tournamentLocation(t);
        const q = citySearchInput.toLowerCase().trim();
        return loc.includes(q) || (t.county || "").toLowerCase().includes(q);
      })
    : tournaments.filter(t => tournamentLocation(t) === displayCity.toLowerCase());

  const liveTournaments   = visibleTournaments.filter(t => t.status === "active" || t.status === "finals");
  const openTournaments   = visibleTournaments.filter(t => t.status === "registration");
  const closedTournaments = visibleTournaments.filter(t => t.status === "completed");

  // Check if player has an active tournament
  const hasActiveTournament = tournaments.some(t =>
    (t.status === "active" || t.status === "finals") && player && t.playerIds.includes(player.id)
  );

  // Status pill helper
  function statusPillClass(status: TournamentStatus): string {
    switch (status) {
      case "registration": return "pill pill-registration";
      case "active": return "pill pill-active";
      case "finals": return "pill pill-finals";
      case "completed": return "pill pill-completed";
      default: return "pill pill-completed";
    }
  }

  function statusPillLabel(status: TournamentStatus): string {
    switch (status) {
      case "registration": return "Registration";
      case "active": return "Active";
      case "finals": return "Finals";
      case "completed": return "Completed";
      default: return status;
    }
  }

  function navigateToTournament(id: string) {
    setSelectedTournamentId(id);
    setExpandedRounds({});
    resetScoreEntry();
    nav("tournament-detail");
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  function renderTestBar() {
    return (
      <div className="test-sim-bar">
        <div className="test-sim-label">TEST BAR</div>
        <div className="test-sim-players">
          {TOURNEY_TEST_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              className={`test-sim-player ${player?.email === acc.email ? "test-sim-active" : ""}`}
              style={{ borderColor: acc.color }}
              onClick={() => void doLogin(acc.email)}
            >
              <span className="test-sim-dot" style={{ background: acc.color }} />
              {acc.name}
            </button>
          ))}
        </div>
        <button
          className="test-sim-action"
          onClick={async () => {
            try {
              const res = await fetch(`${API}/debug/simulate-tournament`, { method: "POST" });
              const data = await res.json() as { ok?: boolean; tournamentId?: string; error?: string };
              if (data.ok) {
                alert(`Tournament created! ID: ${data.tournamentId?.slice(0, 8)}…`);
                if (token) {
                  void loadTournaments(token);
                  void loadMatches(token);
                }
              } else {
                alert(`Error: ${data.error}`);
              }
            } catch (e) { alert(`Failed: ${e}`); }
          }}
        >
          Simulate Tournament Start
        </button>
        <button
          className="test-sim-action"
          onClick={async () => {
            try {
              const res = await fetch(`${API}/debug/seed-rich`, { method: "POST" });
              const data = await res.json() as { ok?: boolean; counties?: number; players?: number; tournaments?: number; error?: string };
              if (data.ok) {
                alert(`Seeded! ${data.players} players, ${data.tournaments} tournaments across ${data.counties} counties`);
                if (token) {
                  void loadTournaments(token);
                }
              } else {
                alert(`Error: ${data.error}`);
              }
            } catch (e) { alert(`Failed: ${e}`); }
          }}
        >
          Seed Rich Data
        </button>
      </div>
    );
  }

  // ── START ────────────────────────────────────────────────────────────────────
  if (screen === "start") {
    return (
      <div className="start-screen">
        <img src="/r.png" alt="Rally" className="screen-logomark" onClick={() => nav("start")} />
        <div className="start-hero">
          <img src="/logo.png" alt="Rally" className="app-logo" />
          <p className="app-tagline">Play more tennis. Play the right opponents. Automatically.</p>
        </div>

        <div className="feature-row">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="feature-title">AI Scheduling</div>
            <div className="feature-desc">No texts. No chasing. Rally finds match times that work for both players. Just show up and play.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                <polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
            <div className="feature-title">Smart Ratings</div>
            <div className="feature-desc">Your level, updated every match. ELO-based ratings adjust after every result so you're always challenged — never mismatched.</div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
              </svg>
            </div>
            <div className="feature-title">Monthly Cups</div>
            <div className="feature-desc">Real competition. Every month. 8-player groups by level. Round-robin battles, then a final push for the win.</div>
          </div>
        </div>

        <div className="start-actions">
          <button className="btn-primary btn-full"
            onClick={() => { setAuthMode("signup"); setLoginEmail(""); setLoginError(""); setScreen("login"); }}>
            Start playing
          </button>
          <button className="btn-ghost btn-full"
            onClick={() => { setAuthMode("signin"); setLoginEmail(""); setLoginError(""); setScreen("login"); }}>
            Sign in
          </button>
        </div>

        <div className="quick-login-grid">
          <p className="quick-login-label">Test accounts — tap to sign in instantly</p>
          <div className="quick-login-cards">
            {DEMO_ACCOUNTS.map(acc => (
              <div key={acc.email} className="quick-player-card" onClick={() => void doLogin(acc.email)}>
                <div className="player-avatar" style={{ background: `linear-gradient(145deg, ${acc.color}CC, ${acc.color})` }}>
                  {initials(acc.name)}
                </div>
                <div className="quick-player-name">{acc.name.split(" ")[0]}</div>
                <div className="quick-player-stats">{acc.rating} · {acc.level}</div>
              </div>
            ))}
          </div>
        </div>
        {renderTestBar()}
      </div>
    );
  }

  // ── LOGIN / SIGN UP ───────────────────────────────────────────────────────────
  if (screen === "login") {
    const isSignup = authMode === "signup";
    return (
      <div className="login-screen">
        <img src="/r.png" alt="Rally" className="screen-logomark" onClick={() => setScreen("start")} />
        <button className="back-link" onClick={() => setScreen("start")}>← Back</button>

        <img src="/logo.png" alt="Rally" className="app-logo" style={{ marginTop: 16, width: 72, height: 72 }} />
        <div className="app-wordmark">{isSignup ? "Join Rally" : "Welcome back"}</div>
        <p className="app-tagline">
          {isSignup ? "Enter your email to create a free account" : "Sign in with your email"}
        </p>

        {loginError && <div className="error-msg" style={{ width: "100%", maxWidth: 360 }}>{loginError}</div>}

        <div className="login-form">
          <input
            type="email" placeholder="your@email.com"
            value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void doLogin(loginEmail); }}
            autoFocus
          />
          <button className="btn-primary btn-full" onClick={() => void doLogin(loginEmail)} disabled={loginLoading}>
            {loginLoading ? (isSignup ? "Creating account…" : "Signing in…") : (isSignup ? "Create account" : "Sign in")}
          </button>
          <button className="btn-ghost btn-full"
            onClick={() => { setAuthMode(isSignup ? "signin" : "signup"); setLoginError(""); }}>
            {isSignup ? "Already have an account? Sign in" : "No account? Create one"}
          </button>
        </div>

        {/* Quick-login test accounts */}
        <div className="quick-login-grid">
          <p className="quick-login-label">Test accounts — tap to sign in instantly</p>
          <div className="quick-login-cards">
            {DEMO_ACCOUNTS.map(acc => (
              <div key={acc.email} className="quick-player-card" onClick={() => void doLogin(acc.email)}>
                <div className="player-avatar" style={{ background: `linear-gradient(145deg, ${acc.color}CC, ${acc.color})` }}>
                  {initials(acc.name)}
                </div>
                <div className="quick-player-name">{acc.name.split(" ")[0]}</div>
                <div className="quick-player-stats">{acc.rating} · {acc.level}</div>
              </div>
            ))}
          </div>
        </div>
        {renderTestBar()}
      </div>
    );
  }

  // ── SETUP ────────────────────────────────────────────────────────────────────
  if (screen === "setup") {
    return (
      <div className="setup-screen">
        <img src="/r.png" alt="Rally" className="screen-logomark" onClick={() => { signOut(); }} />
        <img src="/logo.png" alt="Rally" className="app-logo" style={{ marginBottom: 14, width: 72, height: 72 }} />
        <div className="app-wordmark" style={{ marginBottom: 4, fontSize: 32 }}>Your profile</div>
        <p className="app-tagline">Set up your player profile to get started</p>
        <div className="login-form" style={{ textAlign: "left" }}>
          {setupError && <div className="error-msg">{setupError}</div>}
          <div className="form-group">
            <label>Your name</label>
            <input placeholder="e.g. Alex Smith" value={setupName} onChange={e => setSetupName(e.target.value)} />
          </div>
          <div className="form-group city-autocomplete-wrap">
            <label>City</label>
            <input
              placeholder="e.g. Larkspur, CA"
              value={setupCity}
              onChange={e => {
                setSetupCity(e.target.value);
                // Clear auto-filled county when user edits city
                if (setupCounty) setSetupCounty("");
              }}
              onFocus={() => { if (setupCityResults.length > 0) setSetupCityDropdownOpen(true); }}
              onBlur={() => { setTimeout(() => setSetupCityDropdownOpen(false), 200); }}
              autoComplete="off"
            />
            {setupCityDropdownOpen && setupCityResults.length > 0 && (
              <div className="city-dropdown">
                {setupCityResults.map((c, i) => (
                  <div key={`${c.city}-${c.stateCode}-${i}`} className="city-dropdown-item"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSetupCity(`${c.city}, ${c.stateCode}`);
                      setSetupCounty(c.county);
                      setSetupCityDropdownOpen(false);
                      setSetupCityResults([]);
                    }}>
                    <div className="city-dropdown-name">{c.city}, {c.stateCode}</div>
                    <div className="city-dropdown-county">{c.county}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label>County {setupCounty && <span style={{ color: "var(--muted)", fontWeight: 400 }}>(auto-detected)</span>}</label>
            <input
              placeholder="Select a city above to auto-fill"
              value={setupCounty}
              onChange={e => setSetupCounty(e.target.value)}
              style={setupCounty ? { color: "var(--fg)", background: "rgba(255,255,255,0.03)" } : undefined}
            />
          </div>
          <div className="form-group">
            <label>Skill level</label>
            <select value={setupLevel} onChange={e => setSetupLevel(e.target.value as SkillLevel)}>
              <option value="beginner">Beginner (just starting out)</option>
              <option value="intermediate">Intermediate (club level)</option>
              <option value="advanced">Advanced (competitive)</option>
            </select>
          </div>
          <div className="form-group">
            <label>NTRP Rating</label>
            <div className="ntrp-selector">
              {[2.5, 3.0, 3.5, 4.0, 4.5, 5.0].map(val => (
                <button
                  key={val}
                  type="button"
                  className={`ntrp-option ${setupNtrp === val ? "selected" : ""}`}
                  onClick={() => setSetupNtrp(val)}
                >
                  {val.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary btn-full" onClick={() => void handleSetup()} disabled={setupLoading}>
            {setupLoading ? "Saving…" : "Start playing →"}
          </button>
        </div>
        {renderTestBar()}
      </div>
    );
  }

  // ── MAIN APP SHELL ───────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* Header */}
      {screen !== "match-detail" && screen !== "tournament-detail" ? (
        <header className="app-header">
          <div className="header-left" onClick={() => nav("home")} style={{ cursor: "pointer" }}>
            <img src="/r.png" alt="Rally" className="header-logo" />
            <div>
              <h1>Rally</h1>
              {player && <div className="header-sub">{displayName(player.name)} · {player.county || player.city}</div>}
            </div>
          </div>
          {player && <div className="rating-badge">{player.rating}</div>}
        </header>
      ) : screen === "match-detail" ? (
        <header className="app-header">
          <div className="header-left">
            <img src="/r.png" alt="Rally" className="header-logo" onClick={() => nav("home")} style={{ cursor: "pointer" }} />
            <button onClick={() => nav("matches")}
              style={{ background: "none", color: "white", fontWeight: 700, fontSize: 15, padding: "4px 0" }}>
              ← Back
            </button>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "Oswald, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>Match</span>
          <div style={{ width: 48 }} />
        </header>
      ) : (
        <header className="app-header">
          <div className="header-left">
            <img src="/r.png" alt="Rally" className="header-logo" onClick={() => nav("home")} style={{ cursor: "pointer" }} />
            <button onClick={() => nav("tournaments")}
              style={{ background: "none", color: "white", fontWeight: 700, fontSize: 15, padding: "4px 0" }}>
              ← Back
            </button>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, fontFamily: "Oswald, sans-serif", textTransform: "uppercase", letterSpacing: "0.04em" }}>Tournament</span>
          <div style={{ width: 48 }} />
        </header>
      )}

      {/* ── HOME ────────────────────────────────────────────────────────────── */}
      {screen === "home" && (
        <div className="screen">
          {/* Pool CTA Card */}
          {!hasActiveTournament && player && (
            <div className="pool-cta-card">
              <div className="pool-cta-title">Ready to compete?</div>
              <div className="pool-cta-meta">
                NTRP {player.ntrp?.toFixed(1) || "3.5"} &middot; {player.county || player.city || "Your area"}
              </div>
              {poolStatus ? (
                <>
                  <div className="pool-progress">
                    <div className="pool-progress-text">
                      {poolStatus.count} of {poolStatus.needed} players signed up
                    </div>
                    <div className="pool-progress-bar">
                      <div className="pool-progress-fill" style={{ width: `${Math.min(100, (poolStatus.count / poolStatus.needed) * 100)}%` }} />
                    </div>
                  </div>
                  {poolStatus.daysRemaining > 0 && (
                    <div className="pool-countdown">
                      Starts in {poolStatus.daysRemaining} day{poolStatus.daysRemaining !== 1 ? "s" : ""} or when {poolStatus.needed} players join
                    </div>
                  )}
                  {poolStatus.inPool ? (
                    <button className="btn-ghost btn-full" onClick={() => void handlePoolLeave()} disabled={poolLoading}>
                      {poolLoading ? "Leaving..." : "Leave pool"}
                    </button>
                  ) : (
                    <button className="btn-primary btn-full" onClick={() => void handlePoolSignup()} disabled={poolLoading}>
                      {poolLoading ? "Signing up..." : "Sign me up"}
                    </button>
                  )}
                </>
              ) : (
                <button className="btn-primary btn-full" onClick={() => void handlePoolSignup()} disabled={poolLoading}>
                  {poolLoading ? "Signing up..." : "Sign me up"}
                </button>
              )}
            </div>
          )}

          {/* City filter bar with autocomplete */}
          <div className="area-filter-bar">
            {!citySearchInput && (
              <div className="area-label">
                <span className="area-icon"><IconLocation /></span>
                <span className="area-city-name">
                  {selectedSearchCityLabel
                    ? `${selectedSearchCityLabel} · ${selectedSearchCounty}`
                    : activeCityFilter || player?.county || player?.city || "Your area"}
                </span>
                {(activeCityFilter || selectedSearchCounty) && (
                  <button className="area-clear-btn" onClick={() => {
                    setActiveCityFilter("");
                    setCitySearchInput("");
                    setSelectedSearchCounty("");
                    setSelectedSearchCityLabel("");
                    setSearchAreaPoolStatus(null);
                    setTournamentRequested(false);
                  }}>
                    ✕
                  </button>
                )}
              </div>
            )}
            <div className="area-search-wrap city-autocomplete-wrap">
              <span className="area-search-icon"><IconSearch /></span>
              <input
                className="area-search-input"
                type="text"
                placeholder="Search city…"
                value={citySearchInput}
                onChange={e => setCitySearchInput(e.target.value)}
                onFocus={() => { if (homeCityResults.length > 0) setHomeCityDropdownOpen(true); }}
                onBlur={() => { setTimeout(() => setHomeCityDropdownOpen(false), 200); }}
                onKeyDown={e => {
                  if (e.key === "Escape") { setCitySearchInput(""); setHomeCityDropdownOpen(false); }
                }}
                autoComplete="off"
              />
              {citySearchInput && (
                <button className="area-search-clear" onClick={() => {
                  setCitySearchInput("");
                  setHomeCityDropdownOpen(false);
                }}>✕</button>
              )}
              {homeCityDropdownOpen && homeCityResults.length > 0 && (
                <div className="city-dropdown home-city-dropdown">
                  {homeCityResults.map((c, i) => (
                    <div key={`${c.city}-${c.stateCode}-${i}`} className="city-dropdown-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        // Set the county as the active filter
                        setActiveCityFilter(c.county);
                        setSelectedSearchCounty(c.county);
                        setSelectedSearchCityLabel(`${c.city}, ${c.stateCode}`);
                        setCitySearchInput("");
                        setHomeCityDropdownOpen(false);
                        setHomeCityResults([]);
                        setTournamentRequested(false);
                        setSearchAreaPoolStatus(null);
                        // Load pool status for that county
                        if (token) void loadSearchAreaPoolStatus(c.county, token);
                      }}>
                      <div className="city-dropdown-name">{c.city}, {c.stateCode}</div>
                      <div className="city-dropdown-county">{c.county}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Live now */}
          {liveTournaments.length > 0 && (
            <>
              <div className="home-section-head">
                <span className="live-dot" />
                <span className="home-section-title">Live now</span>
              </div>
              {liveTournaments.map(t => (
                <TournamentCard key={t.id} tournament={t} player={player!} onToggle={toggleTournament}
                  onNavigate={navigateToTournament} live />
              ))}
            </>
          )}

          {/* Open registration */}
          {openTournaments.length > 0 && (
            <>
              <div className="home-section-head">
                <span className="home-section-title">Open registration</span>
                <span className="home-section-count">{openTournaments.length}</span>
              </div>
              {openTournaments.map(t => (
                <TournamentCard key={t.id} tournament={t} player={player!} onToggle={toggleTournament}
                  onNavigate={navigateToTournament} />
              ))}
            </>
          )}

          {/* Closed / upcoming (no registration yet) */}
          {closedTournaments.length > 0 && (
            <>
              <div className="home-section-head">
                <span className="home-section-title">Past tournaments</span>
              </div>
              {closedTournaments.map(t => (
                <TournamentCard key={t.id} tournament={t} player={player!} onToggle={toggleTournament}
                  onNavigate={navigateToTournament} />
              ))}
            </>
          )}

          {/* Empty state — with "Start a tournament" option */}
          {visibleTournaments.length === 0 && (
            <div className="empty-state-card">
              {tournamentRequested ? (
                // Success: tournament request submitted
                <div className="tournament-requested-msg">
                  <div className="tournament-requested-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                  </div>
                  <div className="tournament-requested-title">You're on the list!</div>
                  <div className="tournament-requested-body">
                    We'll alert you when enough players in <strong>{tournamentRequestCounty}</strong> sign up for a tournament at your level
                    (NTRP {player?.ntrp?.toFixed(1) || "3.5"}).
                  </div>
                  {searchAreaPoolStatus && (searchAreaPoolStatus.totalCountyInterest > 0 || searchAreaPoolStatus.count > 0) && (
                    <div className="pool-progress" style={{ marginTop: 14 }}>
                      <div className="pool-progress-text">
                        {searchAreaPoolStatus.count} of {searchAreaPoolStatus.needed} players at your level
                      </div>
                      <div className="pool-progress-bar">
                        <div className="pool-progress-fill" style={{ width: `${Math.min(100, (searchAreaPoolStatus.count / searchAreaPoolStatus.needed) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 14 }}>
                    Once {searchAreaPoolStatus?.needed || 8} players join, everyone gets notified to start playing.
                  </div>
                </div>
              ) : (
                // No tournaments — offer to start one
                <>
                  <div className="empty-icon"><IconHome /></div>
                  <p className="empty-state-title">
                    No tournaments in {selectedSearchCounty || activeCityFilter || player?.county || player?.city || "this area"}
                  </p>
                  {searchAreaPoolStatus && searchAreaPoolStatus.totalCountyInterest > 0 ? (
                    <p className="empty-state-desc">
                      {searchAreaPoolStatus.totalCountyInterest} {searchAreaPoolStatus.totalCountyInterest === 1 ? "player has" : "players have"} already signed up in this area. Join them!
                    </p>
                  ) : (
                    <p className="empty-state-desc">
                      {selectedSearchCounty || activeCityFilter
                        ? "Be the first to request a tournament here!"
                        : "Search for your city to find or start tournaments nearby."}
                    </p>
                  )}
                  {searchAreaPoolStatus && searchAreaPoolStatus.bandBreakdown.length > 0 && (
                    <div className="band-breakdown" style={{ marginTop: 10, marginBottom: 10 }}>
                      {searchAreaPoolStatus.bandBreakdown.map(b => (
                        <span key={b.band} className="band-breakdown-item">
                          NTRP {b.band}: {b.poolCount + b.tournamentCount} {b.poolCount + b.tournamentCount === 1 ? "player" : "players"}
                        </span>
                      ))}
                    </div>
                  )}
                  {(selectedSearchCounty || (player?.county && !isSearchingOtherArea)) && (
                    <button
                      className="btn-primary btn-full"
                      style={{ marginTop: 14 }}
                      onClick={() => {
                        const county = selectedSearchCounty || player?.county || "";
                        if (county) void handleStartTournamentRequest(county);
                      }}
                      disabled={tournamentRequestLoading}>
                      {tournamentRequestLoading
                        ? "Signing up..."
                        : searchAreaPoolStatus && searchAreaPoolStatus.totalCountyInterest > 0
                          ? `Join the waitlist in ${selectedSearchCounty || player?.county || "your area"}`
                          : `Start a tournament in ${selectedSearchCounty || player?.county || "your area"}`}
                    </button>
                  )}
                  {searchAreaPoolStatus && searchAreaPoolStatus.count > 0 && !tournamentRequested && (
                    <div className="pool-progress" style={{ marginTop: 14 }}>
                      <div className="pool-progress-text">
                        {searchAreaPoolStatus.count} of {searchAreaPoolStatus.needed} at your level (NTRP {searchAreaPoolStatus.band})
                      </div>
                      <div className="pool-progress-bar">
                        <div className="pool-progress-fill" style={{ width: `${Math.min(100, (searchAreaPoolStatus.count / searchAreaPoolStatus.needed) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TOURNAMENTS ──────────────────────────────────────────────────── */}
      {screen === "tournaments" && player && (
        <div className="screen">
          {/* Action Needed */}
          {tourneyActionMatches.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div className="home-section-head">
                <span className="home-section-title">Action needed</span>
                <span className="home-section-count">{tourneyActionMatches.length}</span>
              </div>
              {tourneyActionMatches.map(m => {
                const oppId = m.homePlayerId === player.id ? m.awayPlayerId : m.homePlayerId;
                const oppName = displayName(allTournamentPlayerNames[oppId] || "Opponent");
                const needsConfirm = !!m.pendingResult && m.pendingResult.reportedBy !== player.id;
                const needsScheduling = m.status === "pending" && !m.scheduledAt && !m.pendingResult;
                const ctaLabel = needsConfirm ? "Confirm Score" : needsScheduling ? "Schedule" : "Enter Score";
                return (
                  <div key={m.id} className="card action-needed-card" style={{ marginBottom: 8, cursor: "pointer" }}
                    onClick={() => {
                      if (needsScheduling) {
                        void openSchedulingModal(m.id);
                        return;
                      }
                      resetScoreEntry();
                      if (!needsConfirm) setScoreEntryMatchId(m.id);
                      setSelectedTournamentId(m.tournamentId);
                      if (token) void loadTournamentDetail(m.tournamentId, token);
                      nav("tournament-detail");
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 2 }}>
                          {displayName(m.tournamentName)} · Round {m.round}
                        </div>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, textTransform: "uppercase" }}>
                          vs {oppName}
                        </div>
                        {m.scheduledAt && (
                          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
                            {new Date(m.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {new Date(m.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                      <button className={needsScheduling ? "btn-secondary" : "btn-primary"} style={{ padding: "8px 14px", fontSize: 13, whiteSpace: "nowrap" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (needsScheduling) {
                            void openSchedulingModal(m.id);
                            return;
                          }
                          resetScoreEntry();
                          if (!needsConfirm) setScoreEntryMatchId(m.id);
                          setSelectedTournamentId(m.tournamentId);
                          if (token) void loadTournamentDetail(m.tournamentId, token);
                          nav("tournament-detail");
                        }}>
                        {ctaLabel}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* My Tournaments */}
          {(() => {
            const myTournaments = tournaments.filter(t => t.playerIds.includes(player.id));
            const nearbyTournaments = tournaments.filter(t =>
              !t.playerIds.includes(player.id) &&
              (t.county || "").toLowerCase() === (player.county || "").toLowerCase()
            );
            return (
              <>
                {myTournaments.length > 0 && (
                  <>
                    <div className="home-section-head">
                      <span className="home-section-title">My tournaments</span>
                      <span className="home-section-count">{myTournaments.length}</span>
                    </div>
                    {myTournaments.map(t => (
                      <TournamentCard key={t.id} tournament={t} player={player} onToggle={toggleTournament}
                        onNavigate={navigateToTournament} live={t.status === "active" || t.status === "finals"} />
                    ))}
                  </>
                )}

                {nearbyTournaments.length > 0 && (
                  <>
                    <div className="home-section-head" style={{ marginTop: myTournaments.length > 0 ? 16 : 0 }}>
                      <span className="home-section-title">Nearby tournaments</span>
                      <span className="home-section-count">{nearbyTournaments.length}</span>
                    </div>
                    {nearbyTournaments.map(t => (
                      <TournamentCard key={t.id} tournament={t} player={player} onToggle={toggleTournament}
                        onNavigate={navigateToTournament} />
                    ))}
                  </>
                )}

                {myTournaments.length === 0 && nearbyTournaments.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon"><IconTournaments /></div>
                    <p className="empty-state-title">No tournaments yet</p>
                    <p className="empty-state-desc">Check the Home tab to find or start tournaments in your area.</p>
                    <button className="btn-primary mt-16" onClick={() => nav("home")}>Go to Home</button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* ── MATCHES ────────────────────────────────────────────────────────── */}
      {screen === "matches" && (
        <div className="screen">
          {/* Tournament matches */}
          {allMyTournamentMatches.length > 0 && (
            <>
              <div className="home-section-head">
                <span className="home-section-title">Tournament matches</span>
                <span className="home-section-count">{allMyTournamentMatches.length}</span>
              </div>
              {allMyTournamentMatches
                .filter(m => !m.result && m.status !== "completed")
                .map(m => {
                  const oppId = m.homePlayerId === player?.id ? m.awayPlayerId : m.homePlayerId;
                  const oppName = displayName(allTournamentPlayerNames[oppId] || "Opponent");
                  const needsConfirm = !!m.pendingResult && m.pendingResult.reportedBy !== player?.id;
                  const awaiting = !!m.pendingResult && m.pendingResult.reportedBy === player?.id;
                  const needsScheduling = m.status === "pending" && !m.scheduledAt && !m.pendingResult;
                  return (
                    <div key={m.id} className="match-card" style={{ cursor: "pointer" }}
                      onClick={() => {
                        if (needsScheduling) {
                          void openSchedulingModal(m.id);
                          return;
                        }
                        resetScoreEntry();
                        if (!needsConfirm && !awaiting) setScoreEntryMatchId(m.id);
                        setSelectedTournamentId(m.tournamentId);
                        if (token) void loadTournamentDetail(m.tournamentId, token);
                        nav("tournament-detail");
                      }}>
                      <div className="match-vs">vs {oppName}</div>
                      <div className="match-meta">
                        {displayName(m.tournamentName)} · Round {m.round}
                        {m.scheduledAt && (
                          <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                            {new Date(m.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                      {needsScheduling && (
                        <span className="match-status-pill pill-pending">Schedule match</span>
                      )}
                      {needsConfirm && (
                        <span className="match-status-pill pill-scheduling">Confirm score</span>
                      )}
                      {awaiting && (
                        <span className="match-status-pill pill-scheduled">Awaiting confirmation</span>
                      )}
                      {!needsConfirm && !awaiting && !needsScheduling && (
                        <span className="match-status-pill pill-pending">Enter score</span>
                      )}
                    </div>
                  );
                })}
              {allMyTournamentMatches.filter(m => !!m.result || m.status === "completed").length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {allMyTournamentMatches
                    .filter(m => !!m.result || m.status === "completed")
                    .slice(0, 5)
                    .map(m => {
                      const oppId = m.homePlayerId === player?.id ? m.awayPlayerId : m.homePlayerId;
                      const oppName = displayName(allTournamentPlayerNames[oppId] || "Opponent");
                      const won = m.result?.winnerId === player?.id;
                      return (
                        <div key={m.id} className="match-card completed" style={{ cursor: "pointer" }}
                          onClick={() => {
                            setSelectedTournamentId(m.tournamentId);
                            if (token) void loadTournamentDetail(m.tournamentId, token);
                            nav("tournament-detail");
                          }}>
                          <div className="match-vs">vs {oppName}</div>
                          <div className="match-meta">
                            {displayName(m.tournamentName)} · R{m.round} · {won ? "Won" : "Lost"}{m.result?.score ? ` · ${m.result.score}` : ""}
                          </div>
                          <span className="match-status-pill pill-completed">Completed</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </>
          )}

          {/* Challenge matches */}
          {matches.length > 0 && allMyTournamentMatches.length > 0 && (
            <div className="home-section-head" style={{ marginTop: 16 }}>
              <span className="home-section-title">Challenge matches</span>
            </div>
          )}
          {matches.length === 0 && allMyTournamentMatches.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><IconMatches /></div>
              <p>No matches yet</p>
              <p>Find a player and send them a challenge</p>
              <button className="btn-primary mt-16" onClick={() => nav("players")}>Find players</button>
            </div>
          ) : (
            <>
              {matches.filter(m => m.status !== "completed" && m.status !== "cancelled").map(m => {
                const isChallenger = m.challengerId === player?.id;
                const myAccepted = m.proposals.some(p => p.acceptedBy.includes(player?.id ?? ""));
                const needsAction = m.status === "scheduling" && !myAccepted;
                return (
                  <div key={m.id} className={`match-card ${needsAction ? "needs-action" : m.status}`}
                    onClick={() => {
                      setSelectedMatch(m); setReportWinnerId(""); setReportScore("");
                      setReportError(""); setReportSuccess(""); nav("match-detail");
                    }}>
                    <div className="match-vs">vs {opponentName(m)}</div>
                    <div className="match-meta">
                      {isChallenger ? "You challenged" : "Challenge received"} ·{" "}
                      {m.scheduledAt ? formatDate(m.scheduledAt) : "Awaiting schedule"}
                    </div>
                    <span className={`match-status-pill pill-${m.status}`}>
                      {needsAction ? "⚡ Pick a time" : m.status}
                    </span>
                  </div>
                );
              })}
              {matches.filter(m => m.status === "completed").length > 0 && (
                <>
                  <div className="card-title mt-16">Past challenge matches</div>
                  {matches.filter(m => m.status === "completed").slice(0, 5).map(m => (
                    <div key={m.id} className="match-card completed"
                      onClick={() => {
                        setSelectedMatch(m); setReportWinnerId(""); setReportScore("");
                        setReportError(""); setReportSuccess(""); nav("match-detail");
                      }}>
                      <div className="match-vs">vs {opponentName(m)}</div>
                      <div className="match-meta">
                        {m.result
                          ? `${playerCache[m.result.winnerId]?.name ?? "Winner"} won · ${m.result.score}`
                          : "Completed"}
                      </div>
                      <span className="match-status-pill pill-completed">Completed</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PLAYERS ────────────────────────────────────────────────────────── */}
      {screen === "players" && (
        <div className="screen">
          {!player?.city ? (
            <div className="error-msg">Set your city in your profile to find nearby players.</div>
          ) : nearbyPlayers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><IconPlayers /></div>
              <p>No players nearby yet</p>
              <p>Share Rally with your tennis club!</p>
            </div>
          ) : (
            nearbyPlayers.map(p => (
              <div key={p.id} className="player-item">
                <div className="player-avatar"
                  style={{
                    background: `linear-gradient(145deg, ${DEMO_ACCOUNTS.find(a => a.email === p.email)?.color ?? "#888"}CC, ${DEMO_ACCOUNTS.find(a => a.email === p.email)?.color ?? "#888"})`,
                    width: 46, height: 46, borderRadius: 14, flexShrink: 0
                  }}>
                  {initials(p.name)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="player-name">{displayName(p.name)}</div>
                  <div className="player-info">
                    {p.city} · {p.rating} pts · {p.wins}W {p.losses}L
                  </div>
                  <span className={`level-pill ${levelClass(levelLabel(p.rating).toLowerCase())}`}>{levelLabel(p.rating)}</span>
                </div>
                {challengingId === p.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <input placeholder="Venue (optional)" value={challengeVenue}
                      onChange={e => setChallengeVenue(e.target.value)}
                      style={{ width: 130, padding: "7px 10px", fontSize: 13 }} />
                    {challengeError && <div className="error-msg" style={{ fontSize: 12, marginBottom: 0 }}>{challengeError}</div>}
                    <div className="row">
                      <button className="btn-ghost" style={{ padding: "7px 12px" }} onClick={() => setChallengingId(null)}>Cancel</button>
                      <button className="btn-primary" style={{ padding: "7px 14px" }}
                        onClick={() => void handleChallenge(p.id)} disabled={challengeLoading}>
                        {challengeLoading ? "…" : "Send"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button className="btn-secondary" style={{ padding: "8px 14px", whiteSpace: "nowrap" }}
                    onClick={() => { setChallengingId(p.id); setChallengeError(""); setChallengeVenue(""); }}>
                    Challenge
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── AVAILABILITY ───────────────────────────────────────────────────── */}
      {screen === "availability" && (
        <div className="screen">
          <div className="card">
            <div className="card-title">Your recurring availability</div>
            <p style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, marginBottom: 12 }}>
              AI uses this to find match times automatically when you challenge someone.
            </p>
            {availability.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>No slots set yet.</p>
            ) : (
              availability.map(s => (
                <div key={s.id} className="avail-slot">
                  <span style={{ minWidth: 36, fontSize: 13, fontWeight: 600 }}>{DAY_LABELS[s.dayOfWeek]}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{s.startTime} – {s.endTime}</span>
                  <button className="btn-danger" style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => void removeSlot(s.id)}>Remove</button>
                </div>
              ))
            )}
            {availMsg && (
              <div className={availMsg === "Saved!" ? "success-msg mt-12" : "error-msg mt-12"}>{availMsg}</div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Add a slot</div>
            <div className="add-slot-row">
              <select value={newDay} onChange={e => setNewDay(Number(e.target.value))}>
                {DAY_LABELS.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
              <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} />
              <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
            </div>
            <button className="btn-primary btn-full mt-12" onClick={() => void addSlot()} disabled={availSaving}>
              {availSaving ? "Saving…" : "Add slot"}
            </button>
          </div>
        </div>
      )}

      {/* ── PROFILE ────────────────────────────────────────────────────────── */}
      {screen === "profile" && player && (
        <div className="screen">
          <div className="card" style={{ textAlign: "center", paddingTop: 24, paddingBottom: 24 }}>
            <div className="player-avatar" style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 12px",
              fontSize: 22,
              background: `linear-gradient(145deg, ${DEMO_ACCOUNTS.find(a => a.email === player.email)?.color ?? "var(--clay)"}CC, ${DEMO_ACCOUNTS.find(a => a.email === player.email)?.color ?? "var(--clay)"})`
            }}>{initials(player.name || player.email)}</div>
            <div className="rating-big">{player.rating}</div>
            <div className="rating-label">{levelLabel(player.rating)}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              {player.ntrp && <span className="ntrp-badge">NTRP {player.ntrp.toFixed(1)}</span>}
              <span className={`subscription-badge ${player.subscription === "active" ? "subscription-active" : "subscription-free"}`}>
                {player.subscription === "active" ? "Pro Member" : "Free"}
              </span>
            </div>
            {player.county && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                <IconLocation /> {player.county}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 18 }}>
              {[{ val: player.wins, label: "Wins" }, { val: player.losses, label: "Losses" }, {
                val: player.wins + player.losses > 0
                  ? `${Math.round(player.wins / (player.wins + player.losses) * 100)}%`
                  : "—",
                label: "Win rate"
              }].map(s => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div className="stat-number">{s.val}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {player.subscription !== "active" && (
            <div className="card" style={{ textAlign: "center" }}>
              <div className="card-title">Upgrade to Pro</div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Unlock tournament entry, advanced stats, and priority matchmaking.
              </p>
              <button className="btn-primary btn-full" onClick={() => void handleSubscriptionCheckout()}>
                Upgrade to Pro
              </button>
            </div>
          )}

          <div className="card">
            <div className="card-title">Edit profile</div>
            <ProfileEdit player={player} token={token!} onUpdated={setPlayer} />
          </div>

          {tournaments.length > 0 && (
            <>
              <div className="card-title mt-16">Tournaments</div>
              {tournaments.map(t => {
                const joined = t.playerIds.includes(player.id);
                return (
                  <div key={t.id} className="tournament-card" style={{ cursor: "pointer" }}
                    onClick={() => navigateToTournament(t.id)}>
                    <div className="tournament-name">{t.name}</div>
                    <div className="tournament-meta">
                      {t.county || t.city} · <span className="ntrp-badge" style={{ fontSize: 10, padding: "1px 6px" }}>{t.band}</span> · {t.playerIds.length} / {t.maxPlayers || 8} players
                    </div>
                    <span className={statusPillClass(t.status)}>{statusPillLabel(t.status)}</span>
                    {joined && <span className="tournament-joined-tag" style={{ marginLeft: 8 }}>You're in</span>}
                  </div>
                );
              })}
            </>
          )}

          <button className="btn-ghost btn-full mt-16"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={signOut}>
            Sign out
          </button>
        </div>
      )}

      {/* ── TOURNAMENT DETAIL ─────────────────────────────────────────────── */}
      {screen === "tournament-detail" && selectedTournamentId && player && (
        <div className="screen">
          {tournamentDetailLoading && !tournamentDetail ? (
            <div className="empty-state" style={{ paddingTop: 32 }}>
              <p>Loading tournament...</p>
            </div>
          ) : tournamentDetail ? (
            <div className="tournament-detail">
              {/* Header */}
              <div className="tournament-header">
                <div className="tournament-title">{tournamentDetail.name}</div>
                <div className="tournament-meta" style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <span className="ntrp-badge">{tournamentDetail.band}</span>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>{tournamentDetail.county}</span>
                  <span className={statusPillClass(tournamentDetail.status)}>
                    {statusPillLabel(tournamentDetail.status)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
                  {formatMonth(tournamentDetail.month)} &middot; {tournamentDetail.playerIds.length} / {tournamentDetail.maxPlayers || 8} players
                </div>
              </div>

              {/* Scheduling result banner */}
              {tournamentDetail.schedulingResult && (
                <div className="card" style={{
                  marginBottom: 16,
                  borderLeft: `3px solid ${tournamentDetail.schedulingResult.failedCount === 0 ? "#4ade80" : "#fbbf24"}`,
                  padding: "10px 14px",
                }}>
                  {tournamentDetail.schedulingResult.failedCount === 0 ? (
                    <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 13 }}>
                      All {tournamentDetail.schedulingResult.scheduledCount} matches auto-scheduled!
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "#fbbf24" }}>
                        {tournamentDetail.schedulingResult.scheduledCount} of {tournamentDetail.schedulingResult.scheduledCount + tournamentDetail.schedulingResult.failedCount} matches scheduled
                      </div>
                      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {tournamentDetail.schedulingResult.failedCount} match{tournamentDetail.schedulingResult.failedCount !== 1 ? "es" : ""} need manual scheduling
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Standings table */}
              {tournamentDetail.standings && tournamentDetail.standings.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="card-title">Standings</div>
                  <div className="standings-table">
                    <div className="standings-header">
                      <span className="standings-rank">#</span>
                      <span className="standings-name">Player</span>
                      <span className="standings-stat">W</span>
                      <span className="standings-stat">L</span>
                      <span className="standings-stat">S+/-</span>
                      <span className="standings-stat">G+/-</span>
                    </div>
                    {tournamentDetail.standings
                      .slice()
                      .sort((a, b) => b.wins - a.wins || b.setDiff - a.setDiff || b.gameDiff - a.gameDiff)
                      .map((s, idx) => {
                        const pName = displayName(tournamentPlayerNames[s.playerId] || "Player");
                        const parts = pName.split(" ");
                        const short = parts.length > 1
                          ? `${parts[0]} ${parts.slice(-1)[0]?.[0] || ""}.`
                          : parts[0] || pName;
                        const isCurrent = s.playerId === player.id;
                        return (
                          <div key={s.playerId} className={`standings-row ${isCurrent ? "current-player" : ""}`}>
                            <span className="standings-rank">{idx + 1}</span>
                            <span className="standings-name">{short}</span>
                            <span className="standings-stat">{s.wins}</span>
                            <span className="standings-stat">{s.losses}</span>
                            <span className={`standings-stat ${s.setDiff > 0 ? "positive" : s.setDiff < 0 ? "negative" : ""}`}>
                              {s.setDiff > 0 ? `+${s.setDiff}` : s.setDiff}
                            </span>
                            <span className={`standings-stat ${s.gameDiff > 0 ? "positive" : s.gameDiff < 0 ? "negative" : ""}`}>
                              {s.gameDiff > 0 ? `+${s.gameDiff}` : s.gameDiff}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Your matches */}
              {(() => {
                const myMatches = tournamentMatches.filter(
                  m => m.homePlayerId === player.id || m.awayPlayerId === player.id
                );
                if (myMatches.length === 0) return null;
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div className="card-title">Your matches</div>
                    {myMatches.map(m => {
                      const isHome = m.homePlayerId === player.id;
                      const oppId = isHome ? m.awayPlayerId : m.homePlayerId;
                      const oppName = displayName(tournamentPlayerNames[oppId] || "Opponent");
                      const hasResult = !!m.result;
                      const hasPendingResult = !!m.pendingResult;
                      const isScoring = scoreEntryMatchId === m.id;
                      const canScore = !hasResult && !hasPendingResult && m.status !== "completed";

                      return (
                        <div key={m.id} className="card" style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 15, fontWeight: 600, textTransform: "uppercase" }}>
                                vs {oppName}
                              </div>
                              <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                                Round {m.round}
                                {m.scheduledAt && (
                                  <span style={{ marginLeft: 8, color: "var(--accent)" }}>
                                    {new Date(m.scheduledAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {new Date(m.scheduledAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasResult && m.result && (
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 14, fontWeight: 600 }}>
                                  {m.result.winnerId === player.id ? "Won" : "Lost"}
                                </div>
                                {m.result.score && (
                                  <div className="round-pairing-score">{m.result.score}</div>
                                )}
                              </div>
                            )}
                            {hasPendingResult && !hasResult && (
                              <span className="pill pill-registration" style={{ fontSize: 10 }}>
                                {m.pendingResult?.reportedBy === player.id ? "Awaiting confirmation" : "Confirm score"}
                              </span>
                            )}
                            {canScore && !isScoring && m.status === "pending" && !m.scheduledAt && (
                              <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openSchedulingModal(m.id);
                                }}>
                                Schedule
                              </button>
                            )}
                            {canScore && !isScoring && (m.status !== "pending" || !!m.scheduledAt) && (
                              <button className="btn-secondary" style={{ padding: "7px 14px", fontSize: 13 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resetScoreEntry();
                                  setScoreEntryMatchId(m.id);
                                }}>
                                Enter Score
                              </button>
                            )}
                          </div>

                          {/* Score entry inline */}
                          {isScoring && (
                            <div className="score-entry" style={{ marginTop: 12, borderTop: `1px solid var(--line)`, paddingTop: 12 }}>
                              <div className="score-entry-title">Enter Score</div>

                              {scoreError && <div className="error-msg" style={{ marginBottom: 8 }}>{scoreError}</div>}
                              {scoreSuccess && <div className="success-msg" style={{ marginBottom: 8 }}>{scoreSuccess}</div>}

                              {!scoreSuccess && (
                                <>
                                  {scoreSets.map((set, i) => (
                                    <div key={i} className="set-input-row">
                                      <span className="set-label">Set {i + 1}</span>
                                      <input
                                        type="number" min="0" max="7"
                                        className="set-input"
                                        placeholder=""
                                        value={set.myGames}
                                        onChange={e => {
                                          const next = [...scoreSets];
                                          next[i] = { ...next[i], myGames: e.target.value };
                                          setScoreSets(next);
                                          // Auto-determine winner
                                          const mySetsWon = next.filter(s => s.myGames && s.theirGames && Number(s.myGames) > Number(s.theirGames)).length;
                                          const theirSetsWon = next.filter(s => s.myGames && s.theirGames && Number(s.theirGames) > Number(s.myGames)).length;
                                          if (mySetsWon >= 2) setScoreWinnerId(player.id);
                                          else if (theirSetsWon >= 2) setScoreWinnerId(oppId);
                                        }}
                                      />
                                      <span className="set-divider">-</span>
                                      <input
                                        type="number" min="0" max="7"
                                        className="set-input"
                                        placeholder=""
                                        value={set.theirGames}
                                        onChange={e => {
                                          const next = [...scoreSets];
                                          next[i] = { ...next[i], theirGames: e.target.value };
                                          setScoreSets(next);
                                          // Auto-determine winner
                                          const mySetsWon = next.filter(s => s.myGames && s.theirGames && Number(s.myGames) > Number(s.theirGames)).length;
                                          const theirSetsWon = next.filter(s => s.myGames && s.theirGames && Number(s.theirGames) > Number(s.myGames)).length;
                                          if (mySetsWon >= 2) setScoreWinnerId(player.id);
                                          else if (theirSetsWon >= 2) setScoreWinnerId(oppId);
                                        }}
                                      />
                                    </div>
                                  ))}

                                  {scoreSets.length < 3 && (
                                    <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 12, marginBottom: 8 }}
                                      onClick={() => setScoreSets([...scoreSets, { myGames: "", theirGames: "" }])}>
                                      + Add Set 3
                                    </button>
                                  )}

                                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                    <label style={{ marginBottom: 0, flex: "none" }}>Match tiebreak</label>
                                    <button
                                      className={`btn-ghost`}
                                      style={{
                                        padding: "4px 10px", fontSize: 11,
                                        background: scoreThirdSetTiebreak ? "rgba(213,10,10,0.1)" : undefined,
                                        borderColor: scoreThirdSetTiebreak ? "var(--primary)" : undefined,
                                        color: scoreThirdSetTiebreak ? "var(--primary)" : undefined
                                      }}
                                      onClick={() => setScoreThirdSetTiebreak(!scoreThirdSetTiebreak)}>
                                      {scoreThirdSetTiebreak ? "On" : "Off"}
                                    </button>
                                  </div>

                                  {scoreThirdSetTiebreak && (
                                    <div className="set-input-row">
                                      <span className="set-label">TB</span>
                                      <input type="number" className="set-input" placeholder=""
                                        value={scoreTiebreakMy}
                                        onChange={e => setScoreTiebreakMy(e.target.value)} />
                                      <span className="set-divider">-</span>
                                      <input type="number" className="set-input" placeholder=""
                                        value={scoreTiebreakTheir}
                                        onChange={e => setScoreTiebreakTheir(e.target.value)} />
                                    </div>
                                  )}

                                  {/* Winner (auto-detected from scores, manual fallback) */}
                                  {(() => {
                                    const mySetsWon = scoreSets.filter(s => s.myGames && s.theirGames && Number(s.myGames) > Number(s.theirGames)).length;
                                    const theirSetsWon = scoreSets.filter(s => s.myGames && s.theirGames && Number(s.theirGames) > Number(s.myGames)).length;
                                    const autoDetected = mySetsWon >= 2 || theirSetsWon >= 2;
                                    if (autoDetected) {
                                      const winnerName = mySetsWon >= 2 ? `${displayName(player.name)} (you)` : displayName(oppName);
                                      return (
                                        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                                          <span style={{ fontWeight: 600, color: "#4ade80" }}>Winner: {winnerName}</span>
                                        </div>
                                      );
                                    }
                                    return (
                                      <div className="form-group" style={{ marginBottom: 12 }}>
                                        <label>Winner</label>
                                        <select value={scoreWinnerId} onChange={e => setScoreWinnerId(e.target.value)}>
                                          <option value="">Select winner...</option>
                                          <option value={player.id}>{displayName(player.name)} (you)</option>
                                          <option value={oppId}>{displayName(oppName)}</option>
                                        </select>
                                      </div>
                                    );
                                  })()}

                                  {buildScorePreview() && (
                                    <div className="score-preview">{buildScorePreview()}</div>
                                  )}

                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn-ghost" style={{ flex: 1 }} onClick={resetScoreEntry}>
                                      Cancel
                                    </button>
                                    <button className="btn-primary" style={{ flex: 1 }}
                                      disabled={scoreSubmitting}
                                      onClick={() => void handleTournamentScoreSubmit(m.id)}>
                                      {scoreSubmitting ? "Submitting..." : "Submit Score"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* All rounds */}
              {tournamentDetail.rounds && tournamentDetail.rounds.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div className="card-title">Rounds</div>
                  {tournamentDetail.rounds.map(round => {
                    const isExpanded = expandedRounds[round.roundNumber] === true; // default collapsed
                    return (
                      <div key={round.roundNumber} className="round-section">
                        <div className="round-title"
                          onClick={() => setExpandedRounds(prev => ({
                            ...prev, [round.roundNumber]: !isExpanded
                          }))}>
                          <span>Round {round.roundNumber} — Week {round.targetWeek}</span>
                          <span style={{ fontSize: 12 }}>{isExpanded ? "▾" : "▸"}</span>
                        </div>
                        {isExpanded && round.pairings.map((p, pi) => {
                          const homeId = tournamentDetail.playerIds[p.homeIndex];
                          const awayId = tournamentDetail.playerIds[p.awayIndex];
                          const homeName = homeId ? displayName(tournamentPlayerNames[homeId] || "Player") : "BYE";
                          const awayName = awayId ? displayName(tournamentPlayerNames[awayId] || "Player") : "BYE";
                          const match = p.matchId ? tournamentMatches.find(m => m.id === p.matchId) : null;
                          return (
                            <div key={pi} className="round-pairing">
                              <span style={{ flex: 1 }}>
                                {homeName.split(" ")[0]} vs {awayName.split(" ")[0]}
                              </span>
                              {match?.result?.score ? (
                                <span className="round-pairing-score">{match.result.score}</span>
                              ) : match?.pendingResult ? (
                                <span style={{ fontSize: 11, color: "#f59e0b" }}>Pending</span>
                              ) : (
                                <span style={{ fontSize: 11, color: "var(--muted)" }}>—</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Finals section */}
              {(tournamentDetail.status === "finals" || tournamentDetail.status === "completed") &&
                tournamentDetail.finalsMatches && (
                <div className="finals-section">
                  <div className="finals-title">Finals</div>
                  {tournamentDetail.finalsMatches.champMatchId && (() => {
                    const champMatch = tournamentMatches.find(m => m.id === tournamentDetail.finalsMatches?.champMatchId);
                    if (!champMatch) return null;
                    const homeName = displayName(tournamentPlayerNames[champMatch.homePlayerId] || "Player");
                    const awayName = displayName(tournamentPlayerNames[champMatch.awayPlayerId] || "Player");
                    return (
                      <div className="finals-match-card">
                        <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700, fontFamily: "Oswald, sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                          Championship
                        </div>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, textTransform: "uppercase" }}>
                          {homeName} vs {awayName}
                        </div>
                        {champMatch.result?.score && (
                          <div className="round-pairing-score" style={{ marginTop: 4 }}>{champMatch.result.score}</div>
                        )}
                        {champMatch.result?.winnerId && (
                          <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#4ade80" }}>
                            Winner: {displayName(tournamentPlayerNames[champMatch.result.winnerId] || "Player")}
                          </div>
                        )}
                        {!champMatch.result && (champMatch.homePlayerId === player.id || champMatch.awayPlayerId === player.id) && !champMatch.pendingResult && (
                          <button className="btn-primary" style={{ marginTop: 10, padding: "8px 16px" }}
                            onClick={() => { resetScoreEntry(); setScoreEntryMatchId(champMatch.id); }}>
                            Enter Score
                          </button>
                        )}
                      </div>
                    );
                  })()}
                  {tournamentDetail.finalsMatches.thirdMatchId && (() => {
                    const thirdMatch = tournamentMatches.find(m => m.id === tournamentDetail.finalsMatches?.thirdMatchId);
                    if (!thirdMatch) return null;
                    const homeName = displayName(tournamentPlayerNames[thirdMatch.homePlayerId] || "Player");
                    const awayName = displayName(tournamentPlayerNames[thirdMatch.awayPlayerId] || "Player");
                    return (
                      <div className="finals-match-card">
                        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, fontFamily: "Oswald, sans-serif", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>
                          3rd Place
                        </div>
                        <div style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, fontWeight: 600, textTransform: "uppercase" }}>
                          {homeName} vs {awayName}
                        </div>
                        {thirdMatch.result?.score && (
                          <div className="round-pairing-score" style={{ marginTop: 4 }}>{thirdMatch.result.score}</div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ paddingTop: 32 }}>
              <p>Tournament not found</p>
            </div>
          )}
        </div>
      )}

      {/* ── MATCH DETAIL ───────────────────────────────────────────────────── */}
      {screen === "match-detail" && selectedMatch && player && (
        <MatchDetail
          match={selectedMatch} player={player} token={token!}
          playerCache={playerCache} acceptingId={acceptingId}
          reportWinnerId={reportWinnerId} reportScore={reportScore}
          reportLoading={reportLoading} reportError={reportError} reportSuccess={reportSuccess}
          onAcceptTime={handleAcceptTime}
          onSetReportWinner={setReportWinnerId} onSetReportScore={setReportScore}
          onReportResult={handleReportResult}
          onFetchPlayer={id => fetchPlayer(id, token!)}
        />
      )}

      {/* ── SCHEDULING MODAL ────────────────────────────────────────────────── */}
      {schedulingModalMatchId && (
        <div className="modal-overlay" onClick={() => setSchedulingModalMatchId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Schedule Match</div>
              <button className="modal-close" onClick={() => setSchedulingModalMatchId(null)}>&times;</button>
            </div>
            {schedulingOpponentName && (
              <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                vs {displayName(schedulingOpponentName)}
              </div>
            )}
            {schedulingLoading ? (
              <div style={{ textAlign: "center", padding: 20, color: "var(--muted)" }}>Loading available times...</div>
            ) : schedulingOptions.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <div style={{ color: "var(--muted)", marginBottom: 8 }}>No overlapping availability found.</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  Check your availability on the Avail. tab, or ask your opponent to update theirs.
                </div>
              </div>
            ) : (
              <div className="scheduling-options">
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                  Pick a time that works for both players:
                </div>
                {schedulingOptions.map((opt, i) => (
                  <button
                    key={i}
                    className="scheduling-option-btn"
                    onClick={() => void acceptSchedulingOption(schedulingModalMatchId, opt)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BOTTOM NAV ─────────────────────────────────────────────────────── */}
      <nav className="bottom-nav">
        <button className={`nav-btn ${screen === "home" ? "active" : ""}`} onClick={() => nav("home")}>
          <div className="nav-icon-box"><IconHome /></div>
          Home
        </button>
        <button className={`nav-btn ${screen === "tournaments" || screen === "tournament-detail" ? "active" : ""}`}
          onClick={() => nav("tournaments")}>
          <div className="nav-icon-box"><IconTournaments /></div>
          Tourneys
          {tourneyActionCount > 0 && (
            <span style={{ background: "var(--primary)", color: "#FFFFFF", borderRadius: 3, fontSize: 10, fontWeight: 700, padding: "1px 6px", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>
              {tourneyActionCount}
            </span>
          )}
        </button>
        <button className={`nav-btn ${screen === "matches" || screen === "match-detail" ? "active" : ""}`}
          onClick={() => nav("matches")}>
          <div className="nav-icon-box"><IconMatches /></div>
          Matches
          {pendingCount > 0 && (
            <span style={{ background: "var(--primary)", color: "#FFFFFF", borderRadius: 3, fontSize: 10, fontWeight: 700, padding: "1px 6px", fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>
              {pendingCount}
            </span>
          )}
        </button>
        <button className={`nav-btn ${screen === "players" ? "active" : ""}`} onClick={() => nav("players")}>
          <div className="nav-icon-box"><IconPlayers /></div>
          Players
        </button>
        <button className={`nav-btn ${screen === "availability" ? "active" : ""}`} onClick={() => nav("availability")}>
          <div className="nav-icon-box"><IconSchedule /></div>
          Avail.
        </button>
        <button className={`nav-btn ${screen === "profile" ? "active" : ""}`} onClick={() => nav("profile")}>
          <div className="nav-icon-box"><IconMe /></div>
          Me
        </button>
      </nav>

      {/* ── TEST SIMULATION BAR ───────────────────────────────────────────── */}
      {renderTestBar()}
    </div>
  );
}

// ─── TournamentCard ────────────────────────────────────────────────────────────

interface TournamentCardProps {
  tournament: Tournament;
  player: Player;
  onToggle: (t: Tournament) => Promise<void>;
  onNavigate?: (id: string) => void;
  live?: boolean;
}

function TournamentCard({ tournament: t, player, onToggle, onNavigate, live = false }: TournamentCardProps) {
  const joined = t.playerIds.includes(player.id);
  const maxP = t.maxPlayers || 8;
  const spotsLeft = maxP - t.playerIds.length;
  const isFull = spotsLeft <= 0;
  const fillPct = Math.min(100, (t.playerIds.length / maxP) * 100);
  const canJoin = !joined && !isFull && t.status === "registration";
  const displayLocation = t.county || t.city || "";

  // Status pills using new tournament statuses
  function cardStatusPill() {
    switch (t.status) {
      case "registration": return <span className="pill pill-registration">Registration</span>;
      case "active": return <span className="pill pill-active">Live</span>;
      case "finals": return <span className="pill pill-finals">Finals</span>;
      case "completed": return <span className="pill pill-completed">Completed</span>;
      default: return <span className="pill pill-completed">{t.status}</span>;
    }
  }

  return (
    <div className={`tournament-home-card ${live ? "tournament-live" : ""} ${joined ? "tournament-joined" : ""}`}
      style={{ cursor: onNavigate ? "pointer" : undefined }}
      onClick={() => onNavigate?.(t.id)}>
      <div className="tournament-home-top">
        <div style={{ flex: 1 }}>
          <div className="tournament-home-name">{t.name}</div>
          <div className="tournament-home-meta">
            <span className="tournament-home-city">
              <IconLocation /> {displayLocation}
            </span>
            {t.band && <span className="ntrp-badge">{t.band}</span>}
          </div>
        </div>
        <div className="tournament-home-status-col">
          {cardStatusPill()}
          {onNavigate && <span style={{ fontSize: 18, color: "var(--muted)", marginLeft: 4 }}>›</span>}
        </div>
      </div>

      <div className="tournament-home-month">{formatMonth(t.month)}</div>

      {/* Player count + progress bar */}
      <div className="tournament-progress-row">
        <span className="tournament-player-count">{t.playerIds.length} / {maxP} players</span>
        {isFull && <span className="tournament-full-tag">Full</span>}
        {joined && <span className="tournament-joined-tag">You're in</span>}
      </div>
      <div className="tournament-progress-track">
        <div className="tournament-progress-fill" style={{ width: `${fillPct}%` }} />
      </div>

      {/* Action button */}
      {(canJoin || joined) && t.status === "registration" && (
        <button
          className={joined ? "btn-ghost tournament-action-btn" : "btn-secondary tournament-action-btn"}
          onClick={(e) => { e.stopPropagation(); void onToggle(t); }}>
          {joined ? "Leave tournament" : "Join tournament"}
        </button>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProfileEdit({ player, token, onUpdated }: { player: Player; token: string; onUpdated: (p: Player) => void }) {
  const [name, setName] = useState(player.name);
  const [city, setCity] = useState(player.city);
  const [level, setLevel] = useState<SkillLevel>(player.level);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setSaving(true); setMsg("");
    try {
      const d = await put<{ player: Player }>("/players/me", { name, city, level }, token);
      onUpdated(d.player); setMsg("Saved!");
    } catch { setMsg("Save failed"); } finally { setSaving(false); }
  }

  return (
    <div className="gap-8">
      <div className="form-group"><label>Name</label><input value={name} onChange={e => setName(e.target.value)} /></div>
      <div className="form-group"><label>City</label><input value={city} onChange={e => setCity(e.target.value)} /></div>
      <div className="form-group">
        <label>Level</label>
        <select value={level} onChange={e => setLevel(e.target.value as SkillLevel)}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>
      {msg && <div className={msg === "Saved!" ? "success-msg" : "error-msg"} style={{ marginBottom: 0 }}>{msg}</div>}
      <button className="btn-primary" onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

interface MatchDetailProps {
  match: Match; player: Player; token: string;
  playerCache: Record<string, Player>; acceptingId: string | null;
  reportWinnerId: string; reportScore: string;
  reportLoading: boolean; reportError: string; reportSuccess: string;
  onAcceptTime: (matchId: string, proposalId: string) => Promise<void>;
  onSetReportWinner: (id: string) => void; onSetReportScore: (s: string) => void;
  onReportResult: (matchId: string) => Promise<void>;
  onFetchPlayer: (id: string) => Promise<Player | null>;
}

function MatchDetail({
  match, player, playerCache, acceptingId,
  reportWinnerId, reportScore, reportLoading, reportError, reportSuccess,
  onAcceptTime, onSetReportWinner, onSetReportScore, onReportResult, onFetchPlayer
}: MatchDetailProps) {
  const [opponentName, setOpponentName] = useState("");

  useEffect(() => {
    const otherId = match.challengerId === player.id ? match.opponentId : match.challengerId;
    const cached = playerCache[otherId];
    if (cached) { setOpponentName(cached.name); return; }
    void onFetchPlayer(otherId).then(p => { if (p) setOpponentName(p.name); });
  }, [match, player.id, playerCache]); // eslint-disable-line react-hooks/exhaustive-deps

  const otherId = match.challengerId === player.id ? match.opponentId : match.challengerId;
  const otherName = opponentName || playerCache[otherId]?.name || "Opponent";
  const isChallenger = match.challengerId === player.id;

  return (
    <div className="screen">
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          {displayName(player.name)} vs {displayName(otherName)}
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500, marginBottom: 10 }}>
          {isChallenger ? "You challenged" : "Challenge received"}
          {match.venue ? ` · 📍 ${match.venue}` : ""}
        </div>
        <span className={`match-status-pill pill-${match.status}`}>{match.status}</span>
        {match.scheduledAt && (
          <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>
            Scheduled: {formatDate(match.scheduledAt)}
          </div>
        )}
      </div>

      {/* AI time proposals */}
      {(match.status === "scheduling" || match.status === "pending") && match.proposals.length > 0 && (
        <div className="card">
          <div className="card-title">AI-suggested times</div>
          <p style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, marginBottom: 12 }}>
            Based on both players' availability. Accept the same slot to lock in the match.
          </p>
          <div className="proposal-list">
            {match.proposals.map(p => {
              const myAccepted = p.acceptedBy.includes(player.id);
              const otherAccepted = p.acceptedBy.includes(otherId);
              return (
                <div key={p.id} className={`proposal-item ${myAccepted ? "accepted-by-me" : ""}`}>
                  <span className="proposal-label">
                    {p.label}
                    {otherAccepted && <span className="proposal-accepted" style={{ marginLeft: 8 }}>✓ {otherName} agreed</span>}
                  </span>
                  {myAccepted ? (
                    <span style={{ fontSize: 12, color: "#6BAEE8", fontWeight: 700 }}>✓ You accepted</span>
                  ) : (
                    <button className="btn-secondary" style={{ padding: "7px 13px", fontSize: 13 }}
                      disabled={acceptingId === p.id} onClick={() => void onAcceptTime(match.id, p.id)}>
                      {acceptingId === p.id ? "…" : "Accept"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {match.status === "pending" && match.proposals.length === 0 && (
        <div className="card">
          <div className="card-title">No times found</div>
          <p style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500 }}>
            No overlapping availability found. Add more slots in the Schedule tab and the AI will suggest times.
          </p>
        </div>
      )}

      {/* Report result */}
      {(match.status === "scheduled" || match.status === "scheduling") && (
        <div className="card">
          <div className="card-title">Report result</div>
          {reportSuccess ? (
            <div className="success-msg">{reportSuccess}</div>
          ) : (
            <>
              {reportError && <div className="error-msg">{reportError}</div>}
              <div className="form-group">
                <label>Winner</label>
                <select value={reportWinnerId} onChange={e => onSetReportWinner(e.target.value)}>
                  <option value="">Select winner…</option>
                  <option value={player.id}>{displayName(player.name)} (you)</option>
                  <option value={otherId}>{displayName(otherName)}</option>
                </select>
              </div>
              <div className="form-group">
                <label>Score</label>
                <input placeholder="e.g. 6-4, 7-5" value={reportScore}
                  onChange={e => onSetReportScore(e.target.value)} />
                <div className="score-hint">Sets separated by commas</div>
              </div>
              <button className="btn-primary btn-full" disabled={reportLoading}
                onClick={() => void onReportResult(match.id)}>
                {reportLoading ? "Saving…" : "Submit result"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Completed result */}
      {match.status === "completed" && match.result && (
        <div className="card">
          <div className="card-title">Result</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {match.result.winnerId === player.id ? "🏆 You won" : `${otherName} won`}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 500, marginTop: 4 }}>
            Score: {match.result.score}
          </div>
        </div>
      )}
    </div>
  );
}
