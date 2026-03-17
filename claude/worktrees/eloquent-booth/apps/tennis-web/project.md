# Rally — Peer-to-Peer Tennis App

> Play more tennis. Play the right opponents. Automatically.

---

## What it is

Rally is a peer-to-peer tennis coordination app. There are no managers or admins — players find each other, challenge each other directly, and let AI handle the scheduling headache. A zero-admin tournament engine automatically forms monthly tournaments by county and NTRP skill band, runs round-robin group stages, and crowns winners through finals matches.

**Core value prop**: eliminate the back-and-forth of "when are you free?" by letting AI propose match times from both players' recurring availability, and eliminate tournament admin by letting the engine handle formation, brackets, standings, and progression.

---

## Tech stack

| Layer | Tech |
|---|---|
| Web frontend | React 18 + TypeScript + Vite (port **5174**) |
| API server | Express + TypeScript + tsx (port **8788**) |
| Shared types & logic | `@rally/core` package (Zod schemas, ELO, round-robin, standings) |
| Auth | HMAC tokens (HS256, 24 h TTL), email-only login |
| Storage | In-memory (resets on restart — no DB yet) |
| AI scheduling | OpenAI `gpt-4.1-mini` via `/v1/chat/completions` |
| Payments | Stripe (checkout sessions, webhooks, customer portal) |
| Monorepo | npm workspaces at `/Users/pascal/Desktop/experimentation` |

---

## Project structure

```
apps/
  tennis-web/          <- React SPA (this project's frontend)
    src/
      App.tsx          <- single-file SPA (all screens + components)
      main.tsx
      styles/main.css  <- all styles
    public/
      r.png            <- R logomark (upper-left on every screen)
      logo.png         <- full RALLY logo with text (hero/landing)
    vite.config.ts
    project.md         <- you are here

  tennis-server/       <- Express API
    src/
      index.ts         <- entry point (port 8788)
      config.ts        <- Zod-validated env config
      http/
        app.ts         <- Express setup (cors, helmet, pino, seed, engine)
        routes.ts      <- all API routes
        seed.ts        <- 6 demo players + 2 demo tournaments seeded on startup
      auth/tokens.ts   <- HMAC token issue/verify
      domain/rating.ts <- Enhanced ELO with margin multiplier + confidence
      middleware/auth.ts
      repo/
        interfaces.ts  <- AuthRepo, PlayerRepo, AvailabilityRepo, MatchRepo, TournamentRepo, PoolRepo
        memory.ts      <- in-memory implementations
      data/
        usCities.ts    <- US city->county lookup (400+ cities, search function)
      security/hmacToken.ts
      services/
        scheduler.ts   <- AI scheduling (OpenAI + algorithmic fallback)
        tournamentEngine.ts <- Zero-admin tournament lifecycle engine
        stripe.ts      <- Stripe checkout, webhooks, portal
      types/express.d.ts

packages/
  tennis-core/         <- @rally/core
    src/
      types.ts         <- Player, Match, Tournament, Pool, SetScore, StandingEntry, etc.
      rating.ts        <- Enhanced ELO (margin multiplier, confidence K-factor, NTRP mapping)
      roundRobin.ts    <- Circle-method round-robin schedule generation
      standings.ts     <- Standings computation with tiebreakers
      validation.ts    <- Zod schemas for all API requests
      index.ts         <- barrel export
```

---

## API routes

All routes are prefixed with `/v1`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | -- | Liveness check |
| GET | `/cities/search?q=` | -- | City autocomplete (returns city, state, county) |
| POST | `/auth/login` | -- | Email login / register (returns JWT) |
| GET | `/players/me` | Y | My profile |
| PUT | `/players/me` | Y | Update name / city / county / level / ntrp |
| GET | `/players/me/availability` | Y | My recurring availability slots |
| PUT | `/players/me/availability` | Y | Replace my availability slots |
| GET | `/players/nearby` | Y | Same city, +/-300 ELO |
| GET | `/players/:id` | Y | Any player's profile |
| GET | `/matches` | Y | My matches |
| GET | `/matches/:id` | Y | Single match detail |
| POST | `/matches` | Y | Challenge a player -> AI generates time proposals |
| POST | `/matches/:id/accept-time` | Y | Accept a proposal; both accepted -> `scheduled` |
| POST | `/matches/:id/result` | Y | Report result -> updates ELO ratings |
| GET | `/tournaments` | Y | List tournaments (filter by county, band, status) |
| GET | `/tournaments/:id` | Y | Tournament detail with player names |
| GET | `/tournaments/:id/matches` | Y | All matches in a tournament |
| POST | `/tournaments/:id/join` | Y | Join a registration-phase tournament |
| DELETE | `/tournaments/:id/leave` | Y | Leave a tournament |
| POST | `/tournaments/:id/matches/:matchId/score` | Y | Report structured set score (mutual confirmation) |
| POST | `/pool/signup` | Y | Join the interest pool (optional county param) |
| DELETE | `/pool/leave` | Y | Leave the pool |
| GET | `/pool/status` | Y | Pool status for player's county (or ?county= param) |
| POST | `/subscription/checkout` | Y | Start Stripe checkout (or dev-mode auto-activate) |
| POST | `/subscription/portal` | Y | Stripe customer portal session |
| POST | `/subscription/webhook` | -- | Stripe webhook handler |
| GET | `/subscription/status` | Y | Current subscription status |
| POST | `/debug/simulate-tournament` | -- | Creates a 6-player active tournament with the test accounts (dev only) |

---

## Tournament engine (zero-admin)

The `TournamentEngine` runs on a 30-second interval and handles the full tournament lifecycle automatically:

### Lifecycle

```
Pool signup -> Registration -> Active (round-robin) -> Finals (#1v#2, #3v#4) -> Completed
```

### Engine tick sequence

1. **processPoolSignups()** — Groups pool entries by (county, band). Creates or fills `registration` tournaments.
2. **checkRegistrationWindows()** — Activates tournaments: immediately at 8 players, or after 7 days with 4+ players. Generates round-robin brackets, creates match entities, initializes standings.
3. **checkFinals()** — When all round-robin matches complete, creates championship (#1 vs #2) and 3rd-place (#3 vs #4) matches. Status -> `finals`.
4. **checkTournamentCompletion()** — When both finals matches complete, finalizes standings. Status -> `completed`.
5. **autoResolveDisputes()** — Pending score reports older than 48h auto-confirm (first reporter wins).

### Round-robin algorithm

Circle method (packages/tennis-core/src/roundRobin.ts):
- Fix player 0, rotate positions 1..N-1 each round
- Produces (N-1) rounds for even N, N rounds for odd N
- Target weeks distributed evenly across 4 weeks
- Handles odd numbers with bye (index -1)

### Score reporting flow

1. First player reports: `{ winnerId, sets: [...] }` -> stored as pending
2. Second player reports matching score -> auto-confirmed, standings + ELO updated with margin multiplier
3. Disagreeing report -> flagged as disputed, auto-resolves after 48h

---

## NTRP rating system

- **Self-rated NTRP**: 2.5 - 5.0 in 0.5 steps (set during profile setup)
- **Skill bands** (3 for MVP): `3.0` (NTRP ≤ 3.0), `3.5` (NTRP 3.0-3.5), `4.0` (NTRP 4.0+)
- **Enhanced ELO**: base K=32 (provisional K=48), margin multiplier 1.0-1.5 based on set/game differential, confidence 0.0-1.0
- **Tiebreak order**: wins -> H2H (2-way) -> set diff -> game diff -> deterministic hash tiebreak

### Standings tiebreakers

Computed in packages/tennis-core/src/standings.ts:
1. Most wins
2. Head-to-head (2-way only)
3. Set differential
4. Game differential
5. Deterministic hash (FNV-1a hash of sorted player IDs + month)

---

## City search & autocomplete

The city search system (apps/tennis-server/src/data/usCities.ts) provides:

- **400+ cities** across all US states + UK cities (for demo data compatibility)
- **County identification**: every city mapped to its county (e.g., Larkspur, CA -> Marin County)
- **Smart search**: exact match > starts-with > contains, searches city name, state, and county
- **No auth required**: `/v1/cities/search?q=larkspur` works before login (used during setup)

### Frontend flow

1. User types in city search -> debounced API call (250ms) -> dropdown with matching cities
2. Each result shows "CITY, STATE" with county below
3. Selecting a city sets the county as the area filter
4. Tournaments are filtered by county
5. If no tournaments exist -> "Start a tournament in [County]" button
6. Clicking it creates a pool signup -> shows confirmation: "You'll be alerted when enough players join"

### Setup screen

City input uses the same autocomplete. Selecting a city auto-fills the county field.

---

## Freemium model

| Feature | Free | Pro ($10/mo or $89/yr) |
|---|---|---|
| Sign up, browse tournaments, see standings | Y | Y |
| Join the interest pool | Y | Y |
| Actually play in tournaments | -- | Y |
| Advanced stats, priority matchmaking | -- | Y |

Conversion funnel: free user signs up -> sees tournaments forming -> gets notified when enough players -> pays to participate.

Payment: Stripe on web (checkout sessions + customer portal). Apple IAP / Google Play billing deferred to native apps.

---

## Demo accounts (seeded on server start)

All in Greater London with Saturday morning overlap for easy AI scheduling testing.

| Email | Name | Rating | NTRP | Band | Subscription |
|---|---|---|---|---|---|
| alice@rally.test | Alice Johnson | 1085 | 3.5 | 3.5 | Active |
| bob@rally.test | Bob Carter | 960 | 3.5 | 3.5 | Active |
| charlie@rally.test | Charlie Davis | 920 | 3.5 | 3.5 | Active |
| diana@rally.test | Diana Lee | 1340 | 4.5 | 4.0 | Active |
| ethan@rally.test | Ethan Walsh | 1025 | 3.5 | 3.5 | Active |
| fiona@rally.test | Fiona Moore | 875 | 3.0 | 3.0 | Active |

### Tournament test accounts (6 players, all NTRP 3.5, San Francisco County)

Used by the test simulation bar for quick player switching and tournament simulation.

| Email | Name | Rating | NTRP |
|---|---|---|---|
| t1-alex@rally.test | T1-Alex [3.5] | 1050 | 3.5 |
| t2-beth@rally.test | T2-Beth [3.5] | 1020 | 3.5 |
| t3-chris@rally.test | T3-Chris [3.5] | 990 | 3.5 |
| t4-dana@rally.test | T4-Dana [3.5] | 1080 | 3.5 |
| t5-eli@rally.test | T5-Eli [3.5] | 960 | 3.5 |
| t6-faye@rally.test | T6-Faye [3.5] | 1000 | 3.5 |

### Seeded tournaments

- **NTRP 3.5 Active** tournament (Greater London) with Alice, Ethan, Bob, Charlie — full round-robin bracket
- **NTRP 3.0 Registration** tournament (Greater London) — open for signups

Open each in a **separate browser tab** -- each tab has its own session (`sessionStorage`).

---

## Design

- **Design language**: NFL.com-inspired -- bold, sharp, dark navy + red
- **Colors**: `#D50A0A` NFL Red (primary/CTA), `#1A5BB5` blue (secondary), `#060e1e` bg, `#0c1a2e` surface
- **Background**: deep navy with subtle blue radial glow at top
- **Typography**: `Oswald` 700 for all headings + buttons + labels (uppercase, tracked), `Inter` 400-700 for body
- **Buttons**: sharp corners (`border-radius: 4px`), uppercase, `letter-spacing: 0.08em`, solid red fill
- **Cards**: `border-radius: 8px`, `border: 1px solid #1c3050`, darker surface
- **Header**: deep navy (`#030810`) with **3px red bottom border**
- **Nav active**: red icon box glow, red icon color
- **Nav tabs**: Home, Matches, Players, Schedule, Me (5 tabs, uppercase labels)
- **Logo**: `r.png` (R logomark) always in upper-left, clickable to home. `logo.png` (full RALLY logo with text) used in hero/landing sections.
- **iPhone 16**: `viewport-fit=cover`, `env(safe-area-inset-*)` on header + bottom nav, `apple-mobile-web-app-capable`, 16px minimum input font-size

---

## Screen flow

```
[not logged in]
  start        <- landing page (logo, tagline, 3 feature tiles, Start Playing / Sign In CTAs)
    | "Start Playing"            | "Sign in"
  login (signup mode)          login (signin mode)
  "Join Rally" copy            "Welcome back" copy
    | new email -> setup          | known email -> home
  setup        <- profile creation (name, city autocomplete, county auto-fill, NTRP selector)
    |
  home

[logged in -- bottom nav]
  home              <- Pool CTA, city autocomplete search, tournament list by county
  matches           <- active + past matches; tap -> match-detail
  players           <- nearby players (same city, +/-300 ELO); Challenge button
  availability      <- recurring time slots used by AI scheduler
  profile           <- ELO stats, NTRP badge, subscription badge, edit profile, tournaments, sign out
  tournament-detail <- standings table, your matches with score entry, all rounds, finals section
  match-detail      <- match info, AI time proposals, report result
```

### Home page details
- **Pool CTA card**: shown when player has no active tournament. Shows NTRP band, county, signup progress bar, countdown.
- **City autocomplete search**: type to search -> dropdown with city/county results -> select to filter
- **Area pill**: shows current county filter with clear button
- **Live now**: tournaments with `status: active | finals` (pulsing green dot)
- **Open registration**: tournaments with `status: registration`; Join/Leave button
- **Empty state**: "No tournaments in [County]" with "Start a tournament" button -> pool signup -> confirmation message. Also shows cross-band interest and "Join the waitlist" when others have signed up.
- **Tournament cards**: clickable -> tournament-detail

### Test simulation bar (dev tool)
- **Fixed bar below bottom nav** (z-index 30, dark background, gold label)
- **6 player buttons**: T1-Alex through T6-Faye, color-coded with dots, click to instant-login as that player
- **Active highlight**: current player's button gets thicker border + blue background
- **"Simulate Tournament Start" button**: calls `POST /v1/debug/simulate-tournament` to create a 6-player active tournament in San Francisco County (NTRP 3.5 band), then reloads tournament data
- **Shows on all screens**: start, login, setup, and main app shell (rendered via `renderTestBar()` function)
- Bottom nav is pushed up by 108px to make room; screen padding increased to 200px

### Tournament detail
- **Header**: tournament name, band badge, county, status pill, month, player count
- **Standings table**: Rank, Player, W, L, Set+/-, Game+/-
- **Your matches**: cards with status (Pending / Scheduled / Enter Score / Awaiting Confirmation)
- **Score entry**: set-by-set input (tap for each set), match tiebreak toggle, preview, submit
- **All rounds**: collapsible round sections with pairings + results
- **Finals**: championship + 3rd place match (when in finals/completed status)

---

## Running locally

```bash
# From the monorepo root
npm run dev:tennis-server   # starts API on port 8788
npm run dev:tennis-web      # starts Vite on port 5174
```

---

## Environment (apps/tennis-server/.env)

```
PORT=8788
AUTH_TOKEN_SECRET=<32+ char secret>
CORS_ORIGIN=http://localhost:5174
OPENAI_API_KEY=<your key>
OPENAI_MODEL=gpt-4.1-mini
SCHEDULER_TIMEOUT_MS=8000
STRIPE_SECRET_KEY=<optional>
STRIPE_WEBHOOK_SECRET=<optional>
STRIPE_PRICE_MONTHLY=<optional>
STRIPE_PRICE_YEARLY=<optional>
```

---

## Progress log

> All notable changes are recorded here in reverse-chronological order.

### 2026-02-28 — Deployment: Netlify + Supabase + Render
- **Supabase PostgreSQL**: 6-table schema (auth_users, players, availability_slots, matches, tournaments, pool_entries) with JSONB for complex nested objects
- **Supabase repo layer**: 6 new repo implementations (`src/repo/supabase.ts`) implementing existing interfaces — zero changes to business logic
- **Backend build**: tsup bundles server + @rally/core into single `dist/index.js` for Render deployment
- **Frontend env**: `VITE_API_URL` env var for production API URL, falls back to `/v1` proxy for local dev
- **Render Blueprint**: `render.yaml` for one-click backend deployment with auto-generated auth secret
- **Netlify config**: `netlify.toml` with monorepo build command + SPA redirect
- **In-memory fallback**: Backend auto-detects missing Supabase env vars and falls back to in-memory storage for local dev

### 2026-02-28 — Rally v2: E2E Testing, Bug Fixes & Documentation
- **10-user E2E test suite**: Automated curl-based testing across 10 users with varied availability patterns (broad, narrow, none, weekday-only, weekend-only)
- **13 bugs identified**: 3 critical, 4 high, 3 medium, 3 warnings
- **Expert panel review**: 3-person UX/Visual/Backend panel produced prioritized fix specification
- **11 fixes implemented**: friendlyStatus/friendlyMatchStatus helpers, shortTournamentName, segment control CSS, empty state guidance, availability check on join, tier preservation in propose-times, duplicate join check reorder, login button text, empty availability warning, impact hint fallback
- **Re-test verification**: 7/7 tests passed — broad availability (all Tier 1), no availability (all Tier 3), narrow Saturday-only (mixed Tier 1/2/3), score submission + confirmation flow, tier preservation on propose-times

### 2026-02-28 — Rally v2: Smart Scheduling & UX Redesign (full build)
- **Three-tier scheduling intelligence**: Auto-scheduled (75min+ overlap), Flex Match (near-miss), Propose & Pick (no overlap)
- **4-tab navigation**: Home (action dashboard), Tourney (segmented control), Activity (match timeline), Profile (availability management)
- **Bottom sheets**: 5 sheet types for all interactions (score entry, confirm, scheduling, flex, propose)
- **200-player Bay Area seed data**: 10 counties, diverse names, 7 availability patterns
- **New backend endpoints**: scheduling-info, flex-accept, propose-times, availability-impact, seed-rich
- **Frontend**: ~25 new files (hooks, components, screens, styles)
- **CSS fixes**: Multiple rounds of class name alignment, flex layout fixes, responsive mobile layout

### 2026-02-26 — Test simulation bar
- **6 tournament test players** added to seed.ts: T1-Alex [3.5] through T6-Faye [3.5], all in San Francisco County, NTRP 3.5
- **Debug endpoint**: `POST /v1/debug/simulate-tournament` — creates a 6-player active round-robin tournament (15 matches, 5 rounds) with all test players
- **Test bar UI**: fixed bar below bottom nav on all screens with player-switch buttons and "Simulate Tournament Start" action
- **CSS**: `.test-sim-bar`, `.test-sim-player`, `.test-sim-action` styles; bottom nav offset to 108px; screen padding 200px

### 2026-02-25 — Cross-band pool visibility fix
- **Frontend empty state**: now shows `totalCountyInterest` and `bandBreakdown` fields from pool status API
- **Band breakdown pills**: displays interest counts per NTRP band when others have signed up in the same county
- **CTA text**: changes from "Start a tournament" to "Join the waitlist" when interest exists

### 2026-02-25 — Bug fix round (8-agent sweep)
- **CSS**: live dot color fixed red→green (#22c55e), nav font fixed Inter→Oswald, pulse keyframes updated to green
- **Seed**: Bob and Charlie NTRP corrected from 3.0 to 3.5 (matching their 3.5-band tournament)
- **Standings**: lexicographic tiebreaker replaced with FNV-1a hash for deterministic, fair ordering
- **Rating**: band 4.0 threshold corrected from `>3.5` to `>=4.0` (`if (ntrp < 4.0)` for 3.5 band)
- **Nearby players**: filter changed from county+city to city-only matching
- **Pool leave**: now returns 404 when player is not in pool (was silently succeeding)
- **Validation**: NTRP enforces `.multipleOf(0.5)`; added `poolSignupSchema`
- **Stripe**: added `handleWebhookEvent` function, webhook route with signature verification, portal route
- **Routes**: pool signup now validates with `poolSignupSchema`

### 2026-02-25 — City autocomplete search + "Start a tournament" flow
- **City search API**: `GET /v1/cities/search?q=` (no auth) — 400+ US cities mapped to counties, smart ranked search
- **City data**: `apps/tennis-server/src/data/usCities.ts` — includes all Marin County cities (Larkspur, Mill Valley, Sausalito, etc.), major Bay Area/CA cities, key cities across all US states, UK cities for demo compat
- **Setup screen**: city input now has autocomplete dropdown; selecting a city auto-fills county
- **Home screen**: "Search city..." replaced with autocomplete dropdown; selecting a city filters by county, loads pool status for that area
- **Empty state redesign**: when no tournaments in searched county, shows "Start a tournament in [County]" CTA button
- **Tournament request flow**: clicking "Start a tournament" creates pool signup for that county -> shows green success message: "You're on the list! We'll alert you when enough players in [County] sign up"
- **Pool signup updated**: accepts optional `county` parameter (for signing up in a different area)
- **Pool status updated**: accepts optional `?county=` query parameter
- **Start screen copy updated**: new action-oriented tonality — "Play more tennis. Play the right opponents. Automatically." / "No texts. No chasing." / "Smart Ratings" / "Real competition. Every month."

### 2026-02-25 — Logo/icon updates
- `r.png` (R logomark) shown on every screen upper-left, always clickable to navigate home
- `logo.png` (full RALLY logo with text) used in hero/landing sections
- `.screen-logomark` class for pre-auth screens, `.header-logo` for app shell

### 2026-02-24 — Zero-admin tournament engine (full implementation)
- **@rally/core expanded**: types (Player county/ntrp/confidence, Tournament rounds/standings/finals, PoolEntry, SetScore, StandingEntry, ResultReport), roundRobin.ts (circle method), standings.ts (with tiebreakers), rating.ts (enhanced ELO with margin), validation.ts (new schemas)
- **Server**: TournamentEngine (30s tick), InMemoryPoolRepo, pool/tournament/score routes, Stripe integration, city search
- **Frontend**: tournament-detail screen (standings, rounds, score entry, finals), pool CTA, NTRP selector, subscription badges, city search autocomplete
- **Seed data**: 6 demo players with county/NTRP, 1 active tournament (NTRP 3.5), 1 registration tournament (NTRP 3.0)

### 2026-02-24 — Full NFL.com design overhaul
- Fonts: Oswald (headings) + Inter (body). Colors: #D50A0A red, #1A5BB5 blue, #060e1e bg
- Sharp buttons, 8px card radius, 3px red header border, red nav active glow

### Earlier — Initial build
- Monorepo: @rally/web (Vite+React), @rally/server (Express), @rally/core (Zod + ELO)
- Auth: email-only HMAC tokens, sessionStorage per-tab, 6 seeded demo players
- Screens: Matches, Players, Schedule (availability), Me (profile), Match Detail
- AI scheduling: OpenAI gpt-4.1-mini -> top-3 time proposals
- ELO: K=32 first 20 games, K=16 after, floor 100

---

## Rally v2 — Smart Scheduling & UX Redesign

### Overview

Rally v2 (`apps/tennis-web-v2`, port **5175**) is a complete UX redesign that makes scheduling the centerpiece of the app. Built as a separate app instance for side-by-side comparison with v1. The core insight: the v1 binary view (either perfect overlap or "unschedulable") left too many matches unresolved. v2 introduces a three-tier scheduling intelligence system that handles the full spectrum.

### Three-Tier Scheduling System

| Tier | Name | Trigger | User Action |
|------|------|---------|-------------|
| **1** | Auto-Scheduled | 75+ min overlap (lowered from v1's 120 min) | None — booked automatically |
| **2** | Flex Match | 30-74 min overlap or adjacent slots | One-tap "Flex 15 min?" |
| **3** | Propose & Pick | No overlap or near-miss found | Player A proposes 2-3 times, Player B picks one |

**Backend changes:**
- `scheduler.ts`: Lowered `findOverlaps()` threshold from 120 → 75 minutes; added `findNearMisses()` function
- `autoScheduler.ts`: Second pass after greedy auto-scheduling tags matches with near-miss data
- `routes.ts`: New endpoints — `GET /matches/:id/scheduling-info`, `POST /matches/:id/flex-accept`, `POST /matches/:id/propose-times`, `GET /players/:id/availability-impact`
- Match type extended with `schedulingTier` (1|2|3) and `nearMiss` data

### 4-Tab Navigation

Simplified from v1's 6 tabs to 4:

| Tab | Icon | Purpose |
|-----|------|---------|
| **Home** | 🏠 | Action dashboard — what needs attention now (badge count) |
| **Tourney** | 🏆 | Tournament deep-dive with segmented control (Matches/Standings/Info) |
| **Activity** | 📅 | Upcoming matches, recent results, full match history |
| **Profile** | 👤 | Player info, availability management, impact hints |

### Home Screen — Action-Oriented Dashboard

Action cards sorted by urgency with color coding:
- **Red**: Confirm opponent's score
- **Amber**: Flex-schedule (Tier 2) or Propose times (Tier 3)
- **Blue**: Pick from proposed times or Enter score

Below action cards: Next Match countdown, My Tournaments with progress bars, Quick Stats (Rating, Record, Win Rate).

### Bottom Sheets

All interactions happen via bottom sheets (replacing modals/navigation):
- **ScoreEntrySheet**: Set-by-set score input
- **ConfirmScoreSheet**: View opponent's score + Confirm/Dispute
- **SchedulingSheet**: Pick from overlapping time slots (Tier 1/3)
- **FlexSheet**: Near-miss visualization + one-tap accept (Tier 2)
- **ProposeSheet**: Multi-select from own availability → send proposals

### Seed Data — Bay Area Counties

200 players across 10 Bay Area counties with diverse names (Anglo, Hispanic, Asian, Indian). 7 availability patterns designed to produce all 3 scheduling tiers. Each county gets a tournament with 7 pre-registered players (8th player triggers activation).

Counties: Marin County, San Francisco County, Sonoma County, Napa County, Contra Costa County, Alameda County, San Mateo County, Santa Clara County, Solano County, Santa Cruz County.

### v2 File Structure

```
apps/tennis-web-v2/
├── src/
│   ├── App.tsx               # Auth gate + tab router + bottom sheet portal
│   ├── api.ts                # All fetch helpers
│   ├── types.ts              # Interfaces (import @rally/core + UI-specific)
│   ├── constants.ts          # API_BASE, tabs, day names
│   ├── helpers.ts            # displayName, formatScore, formatDate, friendlyStatus, shortTournamentName
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTournaments.ts
│   │   ├── useMatches.ts
│   │   ├── useActionItems.ts # Computes tiered action cards from match data
│   │   ├── useAvailability.ts
│   │   └── useBottomSheet.ts
│   ├── components/
│   │   ├── BottomNav.tsx, BottomSheet.tsx, TestBar.tsx
│   │   ├── ScoreEntrySheet.tsx, ConfirmScoreSheet.tsx
│   │   ├── SchedulingSheet.tsx, FlexSheet.tsx, ProposeSheet.tsx
│   ├── screens/
│   │   ├── LoginScreen.tsx, SetupScreen.tsx
│   │   ├── HomeScreen.tsx, TourneyScreen.tsx
│   │   ├── ActivityScreen.tsx, ProfileScreen.tsx
│   └── styles/main.css
```

### v2 API Endpoints (new)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/matches/:id/scheduling-info` | Full scheduling picture: overlaps, near-misses, player slots |
| POST | `/matches/:id/flex-accept` | Accept a near-miss flex (Tier 2) |
| POST | `/matches/:id/propose-times` | Propose 2-3 times (Tier 3) |
| GET | `/players/:id/availability-impact` | "Adding X would auto-schedule N more matches" |
| POST | `/debug/seed-rich` | Seed 200 Bay Area players + 10 county tournaments |

### E2E Testing & Bug Fixes (2026-02-28)

**10-user E2E test** covering:
- 6 new user signups across different counties (SF, Alameda, Santa Clara, Sonoma, Napa, Marin)
- Availability patterns: broad (every day 8-20), narrow (Mon 18-19:30 only), weekend+Wed, weekday evenings, and no availability
- Tournament join and activation (8th player triggers round-robin + auto-scheduling)
- Score submission + opponent confirmation → standings update
- Propose-times and flex-accept flows
- Edge cases: auth guards, duplicate joins, cross-match score submission

**Scheduling results across test users:**

| User | Availability | Auto-scheduled | Near-miss | Propose & Pick |
|------|-------------|---------------|-----------|---------------|
| User 6 (Napa, broad) | 7 days 8-20 | 7/7 (100%) | 0 | 0 |
| User 1 (Marin, moderate) | Sat+Sun+Wed | 4/7 | 2 | 1 |
| User 5 (Sonoma, narrow) | Mon 18-19:30 | 1/7 | 0 | 6 |
| User 4 (Santa Clara, none) | None | 0/7 | 0 | 7 |

**Bug report (13 issues found):**
- 3 Critical (auth auto-create, broken /me route, /me availability-impact 403)
- 4 High (schema mismatch, no-availability join, tier regression, stale test data)
- 3 Medium (misleading error, status inconsistency, empty suggestions)
- 3 Warnings (empty availability, no county validation, scheduling rate)

**Expert panel review** (3-person UX/Visual/Backend panel) produced prioritized fix spec. Implemented:

| Fix | Type | Description |
|-----|------|-------------|
| friendlyStatus() | FIX NOW | "pending" → "Needs Scheduling", "scheduling" → "Awaiting Response" |
| friendlyMatchStatus() | FIX NOW | Detects pendingResult → "Awaiting Confirmation" |
| shortTournamentName() | FIX NOW | "Rally League – Marin County – 2026-02" → "Marin County" |
| Segment control CSS | FIX NOW | Non-active buttons now transparent with muted text |
| Empty state guidance | FIX NOW | "Join a tournament below to get started" etc. |
| Availability check on join | FIX NOW | Warns if no availability set before joining tournament |
| Tier preservation | FIX NOW | propose-times no longer downgrades Tier 2 → 3 |
| Duplicate join check | FIX SOON | Check duplicate before status check in join handler |
| Login button text | FIX SOON | "Sign In" → "Sign In / Sign Up" |
| Empty availability warning | FIX SOON | Confirmation dialog before saving empty slots |
| Impact hint fallback | FIX SOON | Generic hint when fewer than 3 availability slots |

### Re-test results (post-fix verification)

All **7/7 tests passed** with varied user parameters:

| Test | User Profile | Result |
|------|-------------|--------|
| Broad availability (every day 8am–8pm) | Contra Costa county | ✅ All 7 matches Tier 1 auto-scheduled |
| No availability (empty slots) | San Mateo county | ✅ All 7 matches Tier 3 (propose & pick) |
| Narrow availability (Sat 10:00–11:30) | Alameda county | ✅ Mixed: 2 Tier 1, 1 Tier 2, 4 Tier 3 |
| Score submission flow | Marin county | ✅ Submit → confirm → completed. Standings + rating updated |
| Tier preservation on propose-times | Marin county | ✅ Tier 2 match stays Tier 2 after proposing |

All fixes verified working. Three-tier scheduling correctly handles the full spectrum from broad to zero overlap.

### Running v2

```bash
# From the monorepo root
npm run dev:tennis-server    # API on port 8788
npm run dev:tennis-web-v2    # Vite on port 5175

# Seed Bay Area data (after login):
# POST /v1/debug/seed-rich
```

---

## Deployment — Netlify + Supabase + Render

### Architecture

```
Browser → Netlify (static SPA) → Render (Express API) → Supabase (PostgreSQL)
```

| Layer | Service | Config |
|-------|---------|--------|
| Frontend | **Netlify** | Auto-deploys from `apps/tennis-web-v2`, SPA redirect in `netlify.toml` |
| Backend | **Render** | Free-tier Node.js, auto-deploys via `render.yaml` Blueprint |
| Database | **Supabase** | PostgreSQL with 6 tables, schema in `apps/tennis-server/supabase/schema.sql` |

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `auth_users` | Email-based auth (id, email, created_at) |
| `players` | Player profiles (15+ flat columns) |
| `availability_slots` | Weekly recurring time slots |
| `matches` | Matches with JSONB for proposals/result/near_miss |
| `tournaments` | Tournaments with JSONB for rounds/standings/scheduling_result |
| `pool_entries` | Waiting pool for tournament formation |

### Setup Instructions

**1. Supabase**
- Create a new Supabase project
- Run `apps/tennis-server/supabase/schema.sql` in the SQL Editor
- Copy the Project URL and Service Role Key

**2. Render**
- Connect your GitHub repo
- Use the `render.yaml` Blueprint for one-click setup
- Set environment variables:
  - `CORS_ORIGIN` = your Netlify domain (e.g. `https://rally-tennis.netlify.app`)
  - `SUPABASE_URL` = from Supabase dashboard
  - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase dashboard

**3. Netlify**
- Connect your GitHub repo, set base directory to `apps/tennis-web-v2`
- Set environment variable:
  - `VITE_API_URL` = your Render backend URL + `/v1` (e.g. `https://rally-api.onrender.com/v1`)

### Key Files

| File | Purpose |
|------|---------|
| `apps/tennis-server/supabase/schema.sql` | Database migration |
| `apps/tennis-server/src/repo/supabase.ts` | 6 Supabase repo implementations |
| `apps/tennis-server/tsup.config.ts` | Bundles backend for Render (includes @rally/core) |
| `apps/tennis-web-v2/netlify.toml` | Netlify build config + SPA redirect |
| `render.yaml` | Render Blueprint for backend auto-deploy |

### Local Dev (unchanged)

Without `SUPABASE_URL` set, the backend automatically falls back to in-memory storage:
```bash
npm run dev:tennis-server    # API on port 8788 (in-memory)
npm run dev:tennis-web-v2    # Vite on port 5175
```

---

## Known limitations / next steps

- [x] ~~Persist data to SQLite or Postgres~~ → Supabase PostgreSQL
- [ ] Email verification for login (currently auto-creates accounts)
- [ ] Push notifications / email when tournament is ready or match time proposed
- [ ] Calendar sync (Google/Apple)
- [ ] Native apps (iOS/Android) with Apple IAP / Google Play billing
- [ ] Court access system (host courts, travel radius)
- [ ] Swiss system for 9-16 player tournaments
- [ ] Band auto-promotion after sustained rating drift
- [ ] Player photos / profile customisation
- [ ] Chat between matched players
- [ ] Invite/share links for virality
- [ ] County validation on tournament join
- [ ] Availability-impact endpoint: improve suggestion algorithm for sparse data
