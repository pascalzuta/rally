# Rally — Recreational Tennis League Platform

> Play more tennis. Play the right opponents. Automatically.

## Overview

Rally is a peer-to-peer tennis coordination app and tournament platform for recreational players. There are no managers or admins — players find each other, challenge each other directly, and let AI handle the scheduling headache. Players sign up, set their weekly availability, and join monthly round-robin tournaments in their county. A zero-admin tournament engine automatically forms tournaments by county and NTRP skill band, runs round-robin group stages, auto-schedules matches using a 3-tier scheduling algorithm, handles dual-confirmation score reporting, computes ELO ratings, and manages the full tournament lifecycle from registration through finals.

**Core value prop**: eliminate the back-and-forth of "when are you free?" by letting AI propose match times from both players' recurring availability, and eliminate tournament admin by letting the engine handle formation, brackets, standings, and progression.

**Live URLs:**
- Frontend: https://rally-tennis.netlify.app
- Backend API: https://rally-hgyo.onrender.com/v1
- Database: Supabase PostgreSQL

**Repository:** https://github.com/pascalzuta/rally

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18.3, Vite 5.4, TypeScript 5.7 |
| Backend | Express 4.21, Node.js 20+, TypeScript |
| Database | Supabase PostgreSQL (JSONB + CITEXT) |
| Shared Logic | `@rally/core` workspace package |
| Auth | JWT (HMAC-signed HS256, 24h TTL), email-only login |
| Hosting | Netlify (frontend), Render (backend) |
| Build | tsup (server bundle), Vite (frontend) |
| AI Scheduling | OpenAI `gpt-4.1-mini` via `/v1/chat/completions` |
| Payments | Stripe (checkout sessions, webhooks, customer portal) |
| Monorepo | npm workspaces |

---

## Monorepo Structure

```
/
├── apps/
│   ├── tennis-web-v2/              React frontend (main app, port 5175)
│   │   ├── src/
│   │   │   ├── App.tsx             Main component + auth gate + tab router + bottom sheet portal
│   │   │   ├── api.ts              API client (fetch wrappers)
│   │   │   ├── types.ts            Frontend type definitions
│   │   │   ├── constants.ts        API_BASE, tabs, day names
│   │   │   ├── helpers.ts          displayName, formatScore, formatDate, friendlyStatus, shortTournamentName
│   │   │   ├── components/         Reusable UI components (12)
│   │   │   ├── screens/            Page-level components (6)
│   │   │   ├── hooks/              Custom React hooks (6)
│   │   │   └── styles/             CSS files
│   │   ├── vite.config.ts          Dev server on :5175, proxy /v1 → :8788
│   │   └── package.json
│   │
│   ├── tennis-web/                 v1 frontend (legacy, port 5174)
│   │   ├── src/
│   │   │   ├── App.tsx             Single-file SPA (all screens + components)
│   │   │   ├── main.tsx
│   │   │   └── styles/main.css
│   │   ├── public/
│   │   │   ├── r.png              R logomark (upper-left on every screen)
│   │   │   └── logo.png           Full RALLY logo with text (hero/landing)
│   │   └── vite.config.ts
│   │
│   └── tennis-server/              Express backend API (port 8788)
│       ├── src/
│       │   ├── index.ts            Entry point
│       │   ├── config.ts           Zod-validated env config
│       │   ├── http/
│       │   │   ├── app.ts          Express setup (cors, helmet, pino, seed, engine)
│       │   │   ├── routes.ts       All API endpoints (~1000 lines)
│       │   │   ├── seed.ts         Basic demo seeding (6 players + 2 tournaments)
│       │   │   └── seedRich.ts     200 players + 10 county tournaments
│       │   ├── auth/tokens.ts      JWT generation (HMAC token issue/verify)
│       │   ├── middleware/auth.ts   Auth verification
│       │   ├── domain/rating.ts    Player creation + match result application (enhanced ELO with margin multiplier + confidence)
│       │   ├── services/
│       │   │   ├── tournamentEngine.ts  Tournament lifecycle automation (30s tick)
│       │   │   ├── scheduler.ts         AI scheduling (OpenAI + algorithmic fallback) + overlap + near-miss
│       │   │   ├── autoScheduler.ts     Greedy match scheduling
│       │   │   ├── paceRules.ts         Tournament deadline constants
│       │   │   └── stripe.ts            Stripe checkout, webhooks, portal
│       │   ├── data/
│       │   │   └── usCities.ts     US city→county lookup (400+ cities, search function)
│       │   └── repo/
│       │       ├── interfaces.ts   Data layer contracts (AuthRepo, PlayerRepo, AvailabilityRepo, MatchRepo, TournamentRepo, PoolRepo)
│       │       ├── memory.ts       In-memory repos (local dev)
│       │       └── supabase.ts     Supabase implementations (6 repos)
│       ├── supabase/schema.sql     PostgreSQL schema (6 tables)
│       ├── tsup.config.ts          ESM bundler for Render deploy
│       └── package.json
│
├── packages/
│   └── tennis-core/                Shared types + pure business logic (@rally/core)
│       └── src/
│           ├── types.ts            Core data types (Player, Match, Tournament, PoolEntry, SetScore, StandingEntry, ResultReport, etc.)
│           ├── rating.ts           ELO calculations + NTRP mapping (enhanced ELO with margin, confidence K-factor)
│           ├── roundRobin.ts       Circle-method round-robin schedule generation
│           ├── standings.ts        Standings computation with tiebreaks (FNV-1a hash)
│           ├── validation.ts       Zod schemas for all API requests
│           └── index.ts            Barrel export
│
├── render.yaml                     Render deployment blueprint
├── netlify.toml                    Netlify build config + SPA fallback
├── pace-rules.md                   Full pace rules specification
├── project.MD                      This file
└── package.json                    Root monorepo (npm workspaces)
```

---

## Core Features

### 1. Authentication & Profile Setup
- Email-based login (no password — JWT issued on email match, auto-creates accounts)
- Profile setup: name, city (US city search with autocomplete), county (auto-filled from city), skill level (NTRP 2.5–5.0)
- ELO rating starts at 1000, provisional for first 5 matches
- Gate password screen protects the app (with "Forgot password?" reset flow)

### 2. Weekly Availability
- Players set recurring weekly time slots (e.g., Mon 08:00–10:00, Sat 09:00–12:00)
- Up to 20 slots per player
- **Availability Impact**: API suggests which new slots would unlock the most match scheduling
- Warning if no availability set before joining a tournament

### 3. Tournament System
- **Monthly round-robin** tournaments per county per skill band (3.0, 3.5, 4.0)
- 4–8 players per tournament
- Auto-activates when 8 players join (or 7 days + 4+ players)
- **Lifecycle**: Registration → Active → Finals → Completed
- **Finals**: Top 4 play championship (#1 vs #2) and 3rd-place (#3 vs #4) matches
- **Pool system**: Players queue up; tournaments auto-created when enough players

### 4. 3-Tier Match Scheduling

| Tier | Name | Condition | UX |
|------|------|-----------|-----|
| **Tier 1** | Auto-Scheduled | 75+ min overlap in availability | Match auto-scheduled, players notified |
| **Tier 2** | Flex Match | 30-74 min overlap or adjacent slots (gap ≤ 60 min) | One-tap "Flex N min?" |
| **Tier 3** | Propose & Pick | No useful overlap | Player A proposes 2-3 times, Player B picks one |

- **Greedy algorithm** schedules all tournament matches at once, max 1 match/player/day
- **Near-miss detection** identifies adjacent slots and small gaps with flex suggestions
- v1 used 120-min threshold; v2 lowered to 75 min for more auto-scheduled matches

### 5. Score Reporting (Dual Confirmation)
- Either player reports the result with structured set scores (e.g., 6-3, 6-4)
- Opponent must confirm the score
- **Auto-dispute resolution**: If not confirmed within 48 hours, auto-confirms (first reporter wins)
- Supports tiebreak scoring per set

### 6. Standings & Rankings
- **Tiebreak order**: Wins → Head-to-Head (2-way) → Set Diff → Game Diff → Deterministic hash (FNV-1a)
- Live-computed from confirmed match results
- Displayed with full W/L, sets, and games breakdown

### 7. ELO Rating System
- Base K-factor: 32 (first 20 games), then 16
- Adjusted for confidence (0–1) and provisional status (1.5x for provisional, K=48)
- Margin multiplier: bonus for decisive victories (up to 1.5x based on set/game differential)
- NTRP mapping: `ntrpToRating(n) = 400 + n × 220`
- ELO floor: 100

### 8. NTRP Skill Bands
- **Self-rated NTRP**: 2.5–5.0 in 0.5 steps (set during profile setup, validated `.multipleOf(0.5)`)
- **Skill bands** (3 for MVP): `3.0` (NTRP ≤ 3.0), `3.5` (NTRP 3.0–3.5), `4.0` (NTRP ≥ 4.0)
- Band determines which tournaments a player can join

### 9. City Search & Autocomplete
- **400+ cities** across all US states + UK cities (for demo data compatibility)
- **County identification**: every city mapped to its county (e.g., Larkspur, CA → Marin County)
- **Smart search**: exact match > starts-with > contains, searches city name, state, and county
- **No auth required**: `/v1/cities/search?q=larkspur` works before login (used during setup)
- Selecting a city auto-fills the county field in both Setup and Home screens

### 10. Freemium Model

| Feature | Free | Pro ($10/mo or $89/yr) |
|---------|------|------------------------|
| Sign up, browse tournaments, see standings | Yes | Yes |
| Join the interest pool | Yes | Yes |
| Actually play in tournaments | — | Yes |
| Advanced stats, priority matchmaking | — | Yes |

Conversion funnel: free user signs up → sees tournaments forming → gets notified when enough players → pays to participate.

Payment: Stripe on web (checkout sessions + customer portal). Apple IAP / Google Play billing deferred to native apps.

---

## Data Model

### Player
`id, email, name, city, county, level, ntrp, rating, ratingConfidence, provisionalRemaining, wins, losses, subscription, createdAt, updatedAt`

### Match
`id, challengerId, opponentId, tournamentId?, status (pending|scheduling|scheduled|completed|cancelled), proposals[], scheduledAt?, venue?, result?, schedulingTier (1|2|3), nearMiss?, createdAt, updatedAt`

### Tournament
`id, month, name, county, band, status (registration|active|finals|completed), playerIds[], minPlayers, maxPlayers, rounds[], standings[], pendingResults{}, finalsMatches?, schedulingResult?, ratingSnapshot?, createdAt`

### AvailabilitySlot
`id, playerId, dayOfWeek (0-6), startTime, endTime`

### PoolEntry
`id, playerId, county, band, rating, createdAt`

---

## API Endpoints

**Base**: `/v1`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | No | Health check |
| POST | /auth/login | No | Email login → JWT + player |
| POST | /auth/gate | No | Gate password check |
| POST | /auth/gate/reset | No | Reset gate password (requires reset key) |
| GET | /cities/search | No | US city search (autocomplete) |
| GET | /players/me | Yes | Current player profile |
| PUT | /players/me | Yes | Update profile |
| GET | /players/:id | Yes | Get player by ID |
| GET | /players/nearby | Yes | Find nearby players (same city, ±300 ELO) |
| GET | /players/:id/availability-impact | Yes | Suggest high-impact availability slots |
| GET | /players/me/availability | Yes | Get availability slots |
| PUT | /players/me/availability | Yes | Set availability slots |
| GET | /matches | Yes | Player's matches |
| GET | /matches/:id | Yes | Match details |
| POST | /matches | Yes | Create challenge match → AI generates time proposals |
| GET | /matches/:id/scheduling-info | Yes | Full scheduling info (overlaps, near-misses, player slots) |
| GET | /matches/:id/scheduling-options | Yes | Overlap windows |
| POST | /matches/:id/accept-time | Yes | Accept proposed time; both accepted → `scheduled` |
| POST | /matches/:id/schedule | Yes | Manually schedule |
| POST | /matches/:id/flex-accept | Yes | Accept Tier 2 near-miss flex |
| POST | /matches/:id/propose-times | Yes | Propose 2-3 times (Tier 3) |
| POST | /matches/:id/result | Yes | Report casual match result → updates ELO |
| GET | /tournaments | Yes | List tournaments (filter by county, band, status) |
| GET | /tournaments/:id | Yes | Tournament detail + player names + ratings |
| GET | /tournaments/:id/matches | Yes | Tournament matches |
| POST | /tournaments/:id/join | Yes | Join tournament |
| DELETE | /tournaments/:id/leave | Yes | Leave tournament |
| POST | /tournaments/:id/matches/:matchId/score | Yes | Report tournament score (structured set scores, mutual confirmation) |
| GET | /pool/status | Yes | Pool queue status (accepts optional `?county=` param) |
| POST | /pool/signup | Yes | Join pool queue (accepts optional `county` param) |
| DELETE | /pool/leave | Yes | Leave pool |
| POST | /subscription/checkout | Yes | Stripe checkout (or dev-mode auto-activate) |
| POST | /subscription/portal | Yes | Stripe customer portal session |
| POST | /subscription/webhook | No | Stripe webhook handler (signature verification) |
| GET | /subscription/status | Yes | Subscription status |
| POST | /debug/seed-rich | No | Seed 200 players + 10 tournaments |
| POST | /debug/simulate-tournament | No | Simulate a tournament (6 test players + logged-in user) |
| POST | /debug/accept-proposals | No | Accept all pending proposals for player |
| POST | /debug/submit-scores | No | Opponents submit scores for player's matches |
| POST | /debug/confirm-scores | No | Confirm all pending scores for player |
| POST | /debug/advance-to-finals | No | Advance tournament to finals phase |

---

## Frontend Architecture (v2)

### Screen Flow

```
[not logged in]
  gate           ← password gate (with "Forgot password?" reset flow)
    |
  start          ← landing page (logo, tagline, 3 feature tiles, Start Playing / Sign In CTAs)
    | "Start Playing"            | "Sign in"
  login (signup mode)          login (signin mode)
  "Join Rally" copy            "Welcome back" copy
    | new email → setup          | known email → home
  setup          ← profile creation (name, city autocomplete, county auto-fill, NTRP selector)
    |
  home

[logged in — bottom nav]
  home              ← Pool CTA, city autocomplete search, tournament list by county, action cards
  tourney           ← Tournament deep-dive with segmented control (Matches/Standings/Info)
  activity          ← Upcoming matches, recent results, full match history
  profile           ← Player info, availability management, impact hints, sign out
  tournament-detail ← Standings table, your matches with score entry, all rounds, finals section
  match-detail      ← Match info, AI time proposals, report result
```

### Screens
1. **GateScreen** — Password gate with "Forgot password?" reset flow
2. **LoginScreen** — Email authentication ("Sign In / Sign Up")
3. **SetupScreen** — Profile setup (name, city search with autocomplete, county auto-fill, NTRP level)
4. **HomeScreen** — Action items (color-coded by urgency), next match countdown, my tournaments with progress bars, quick stats (Rating, Record, Win Rate), pool CTA, city autocomplete search
5. **TourneyScreen** — Matches/Standings/Info tabs (segmented control), finals UI, rating deltas, tournament discovery
6. **ActivityScreen** — All matches (upcoming, awaiting confirmation, completed)
7. **ProfileScreen** — Profile info, availability editor, impact suggestions, sign out

### Home Screen — Action-Oriented Dashboard

Action cards sorted by urgency with color coding:
- **Red**: Confirm opponent's score
- **Amber**: Flex-schedule (Tier 2) or Propose times (Tier 3)
- **Blue**: Pick from proposed times or Enter score

Below action cards: Next Match countdown, My Tournaments with progress bars, Quick Stats (Rating, Record, Win Rate).

**Pool CTA card**: shown when player has no active tournament. Shows NTRP band, county, signup progress bar, countdown.

**Empty state**: "No tournaments in [County]" with "Start a tournament" button → pool signup → confirmation message. Shows cross-band interest and "Join the waitlist" when others have signed up.

### Tournament Detail
- **Header**: tournament name, band badge, county, status pill, month, player count
- **Standings table**: Rank, Player, W, L, Set+/-, Game+/-
- **Your matches**: cards with status (Pending / Scheduled / Enter Score / Awaiting Confirmation)
- **Score entry**: set-by-set input (tap for each set), match tiebreak toggle, preview, submit
- **All rounds**: collapsible round sections with pairings + results
- **Finals**: championship + 3rd place match (when in finals/completed status)

### Components
- **BottomNav** — 4-tab navigation (Home, Tourney, Activity, Profile) with action badge
- **BottomSheet** — Modal drawer for all match interactions
- **ActionCard** — Horizontally scrollable action items (score entry, scheduling, flex, propose)
- **ScoreEntrySheet** — Report result with winner + structured set scores
- **ConfirmScoreSheet** — Confirm/dispute opponent's reported score
- **SchedulingSheet** — Pick time from overlap options or accept proposals
- **FlexSheet** — Accept Tier 2 near-miss with flex suggestion (slot comparison visual)
- **ProposeSheet** — Propose 2-3 custom times (Tier 3, multi-select from own availability)
- **StandingsTable** — Ranked table with W/L, sets, games
- **TestBar** — Dev-only bar with 6-step test flow + 6 player-switch buttons

### Hooks
- `useAuth` — Login, logout, token/player state, profile updates
- `useMatches` — Load matches, submit scores, schedule, flex, propose, accept
- `useTournaments` — List, join, leave, load details
- `useActionItems` — Compute tiered action cards from match data
- `useAvailability` — Get/save slots, load impact suggestions
- `useBottomSheet` — Sheet open/close and content type management

---

## Database Schema (Supabase PostgreSQL)

6 tables with JSONB for complex nested data, CITEXT for case-insensitive text:

| Table | Purpose |
|-------|---------|
| `auth_users` | Email-based auth — id (UUID PK), email (CITEXT UNIQUE), created_at |
| `players` | Player profiles — id (UUID PK → auth_users), 15+ flat columns, indexed on county/city |
| `availability_slots` | Weekly recurring time slots — id, player_id (FK CASCADE), day_of_week, start_time, end_time |
| `matches` | Matches — flat columns + JSONB for proposals/result/near_miss, indexed on players/tournament/status |
| `tournaments` | Tournaments — flat columns + JSONB for rounds/standings/pending_results, TEXT[] for player_ids, unique index on (county, band, month) |
| `pool_entries` | Waiting pool — id, player_id (UNIQUE FK), county, band, rating |

RLS enabled but no policies — backend uses service role key.

Schema file: `apps/tennis-server/supabase/schema.sql`

---

## Environment Variables

### Server
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | 8788 | API port (8788 local, 10000 Render) |
| `AUTH_TOKEN_SECRET` | Yes | — | JWT signing secret (32+ chars) |
| `CORS_ORIGIN` | Yes | `http://localhost:5174` | Frontend URL |
| `SUPABASE_URL` | No* | — | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | — | Supabase service role JWT |
| `OPENAI_API_KEY` | No | — | AI scheduling proposals |
| `OPENAI_MODEL` | No | `gpt-4.1-mini` | OpenAI model for scheduling |
| `SCHEDULER_TIMEOUT_MS` | No | 8000 | AI scheduling timeout |
| `STRIPE_SECRET_KEY` | No | — | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | No | — | Stripe webhook signature verification |
| `STRIPE_PRICE_MONTHLY` | No | — | Stripe monthly price ID |
| `STRIPE_PRICE_YEARLY` | No | — | Stripe yearly price ID |
| `GATE_PASSWORD` | No | (set in config) | Gate password for app access |
| `GATE_RESET_KEY` | No | (set in config) | Reset key for changing gate password |

*Without Supabase vars, server falls back to in-memory storage (data lost on restart).

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | API base path (defaults to `/v1` for dev proxy) |

---

## Deployment

### Architecture

```
Browser → Netlify (static SPA) → Render (Express API) → Supabase (PostgreSQL)
```

### Frontend (Netlify)
- Auto-deploys from GitHub on push to main
- Build: `npm install && npm run build --workspace=apps/tennis-web-v2`
- Publish: `apps/tennis-web-v2/dist`
- SPA fallback: `/* → /index.html` (200)
- Set `VITE_API_URL` to Render backend URL + `/v1` (e.g. `https://rally-api.onrender.com/v1`)
- Config file: `netlify.toml`

### Backend (Render)
- Auto-deploys from GitHub on push to main (sometimes needs manual trigger)
- Build: `npm install && npm run build --workspace=apps/tennis-server`
- Start: `node apps/tennis-server/dist/index.js`
- Free tier, port 10000
- Set env vars: `AUTH_TOKEN_SECRET`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- Config file: `render.yaml` (Blueprint for one-click setup, auto-generates auth secret)

### Database (Supabase)
- Create a new Supabase project
- Run `apps/tennis-server/supabase/schema.sql` in the Supabase SQL Editor to create tables
- Copy the Project URL and Service Role Key
- Service role key used by backend (bypasses RLS)

---

## Local Development

```bash
# Install all dependencies
npm install

# Start backend (watches for changes)
cd apps/tennis-server
cp .env.example .env  # Configure env vars
npm run dev            # Starts on :8788

# Start frontend (in separate terminal)
cd apps/tennis-web-v2
npm run dev            # Starts on :5175, proxies /v1 → :8788

# Or from the monorepo root:
npm run dev:tennis-server    # API on port 8788
npm run dev:tennis-web-v2    # Vite on port 5175

# Run tests
npm test               # From root — runs all workspace tests

# Build for production
npm run build --workspace=apps/tennis-server    # → dist/index.js
npm run build --workspace=apps/tennis-web-v2    # → dist/
```

Without `SUPABASE_URL` set, the backend automatically falls back to in-memory storage.

### Seeding Test Data

The `POST /v1/debug/seed-rich` endpoint creates:
- 200 players across 10 Bay Area counties (diverse names: Anglo, Hispanic, Asian, Indian)
- 7 availability patterns designed to produce all 3 scheduling tiers
- 10 tournaments (one per county) in registration status with 7/8 players
- Joining as the 8th player triggers tournament activation + auto-scheduling

Counties: Marin, San Francisco, Sonoma, Napa, Contra Costa, Alameda, San Mateo, Santa Clara, Solano, Santa Cruz.

### Demo Accounts (seeded on server start)

All in Greater London with Saturday morning overlap for easy AI scheduling testing.

| Email | Name | Rating | NTRP | Band | Subscription |
|-------|------|--------|------|------|-------------|
| alice@rally.test | Alice Johnson | 1085 | 3.5 | 3.5 | Active |
| bob@rally.test | Bob Carter | 960 | 3.5 | 3.5 | Active |
| charlie@rally.test | Charlie Davis | 920 | 3.5 | 3.5 | Active |
| diana@rally.test | Diana Lee | 1340 | 4.5 | 4.0 | Active |
| ethan@rally.test | Ethan Walsh | 1025 | 3.5 | 3.5 | Active |
| fiona@rally.test | Fiona Moore | 875 | 3.0 | 3.0 | Active |

### Tournament Test Accounts (6 players, all NTRP 3.5, San Francisco County)

Used by the TestBar for quick player switching and tournament simulation.

| Email | Name | Rating | NTRP |
|-------|------|--------|------|
| t1-alex@rally.test | T1-Alex [3.5] | 1050 | 3.5 |
| t2-beth@rally.test | T2-Beth [3.5] | 1020 | 3.5 |
| t3-chris@rally.test | T3-Chris [3.5] | 990 | 3.5 |
| t4-dana@rally.test | T4-Dana [3.5] | 1080 | 3.5 |
| t5-eli@rally.test | T5-Eli [3.5] | 960 | 3.5 |
| t6-faye@rally.test | T6-Faye [3.5] | 1000 | 3.5 |

Seeded tournaments:
- **NTRP 3.5 Active** tournament (Greater London) with Alice, Ethan, Bob, Charlie — full round-robin bracket
- **NTRP 3.0 Registration** tournament (Greater London) — open for signups

Open each in a **separate browser tab** — each tab has its own session (`sessionStorage`).

### TestBar — Full Lifecycle Test Flow

The TestBar provides a 6-step sequence to test the entire tournament lifecycle:

1. **Seed** — Seeds 200 players + 10 tournaments
2. **Simulate** — Creates a test tournament with 7 NPC players + logged-in user
3. **Schedule** — Accepts all pending match proposals → matches become scheduled
4. **Scores** — Opponents submit scores for all scheduled matches → pending confirmation
5. **Confirm** — User confirms all pending scores → matches completed, ratings updated
6. **Finals** — Advances to finals → creates Championship (#1v#2) and 3rd Place (#3v#4) matches

After step 6, run steps 4→5 again to complete the finals and finish the tournament.
Each step's `ratingSnapshot` captures pre-tournament ratings for delta display in standings.

**TestBar UI**: Fixed bar below bottom nav (z-index 30, dark background, gold label). 6 player buttons (T1-Alex through T6-Faye), color-coded with dots, click to instant-login. Active player gets thicker border + blue background. "Simulate Tournament Start" button calls the debug endpoint. Shows on all screens. Bottom nav pushed up by 108px; screen padding increased to 200px.

---

## Tournament Engine (Zero-Admin)

Background process (`tournamentEngine.ts`) runs on a 30-second tick interval:

### Lifecycle

```
Pool signup → Registration → Active (round-robin) → Finals (#1v#2, #3v#4) → Completed
```

### Engine Tick Sequence

1. **processPoolSignups()** — Groups pool entries by (county, band). Creates or fills `registration` tournaments.
2. **checkRegistrationWindows()** — Activates tournaments: immediately at 8 players, or after 7 days with 4+ players. Generates round-robin brackets, creates match entities, initializes standings.
3. **Auto-schedule matches** — Greedy algorithm using player availability (3-tier system).
4. **checkFinals()** — When all round-robin matches complete, creates championship (#1 vs #2) and 3rd-place (#3 vs #4) matches. Status → `finals`.
5. **checkTournamentCompletion()** — When both finals matches complete, finalizes standings. Status → `completed`.
6. **autoResolveDisputes()** — Pending score reports older than 48h auto-confirm (first reporter wins).
7. **Enforce pace deadlines** — Auto-flex, auto-propose, auto-accept, auto-forfeit (see Pace Rules).
8. **Send notifications** — Batched email reminders for pending actions.

### Round-Robin Algorithm

Circle method (`packages/tennis-core/src/roundRobin.ts`):
- Fix player 0, rotate positions 1..N-1 each round
- Produces (N-1) rounds for even N, N rounds for odd N
- Target weeks distributed evenly across 4 weeks
- Handles odd numbers with bye (index -1)

---

## Pace Rules (Tournament Deadline Framework)

Full specification: **`/pace-rules.md`** · Constants: **`apps/tennis-server/src/services/paceRules.ts`**

Ensures every tournament completes within ~30 days, even with unresponsive players.

### Timeline
- **Registration**: 7 days → **Round-Robin**: 18 days → **Finals**: 5 days → **Hard Deadline**: Day 32

### Match Deadline Chain
| Status | Deadline | Auto-Action |
|--------|----------|-------------|
| Pending | 7 days | Tier 2: auto-flex-schedule. Tier 3: auto-propose from challenger's availability. |
| Scheduling | 5 days | Auto-accept earliest proposal. |
| Scheduled | +3 days after match date | One scored → auto-confirm. Neither scored → mutual forfeit. |
| Awaiting confirmation | 48 hours | Auto-confirm *(existing)*. |

### Forfeit Rules
- **Single no-show** (one responsive, one silent): Responsive player wins W/O 6-0 6-0.
- **Mutual no-show** (neither acted): No winner, no standings impact.
- **ELO not affected** by forfeits. **Standings are** (W/L counts).

### Grace Mechanisms
- 3–4 reminder notifications before any auto-action
- Vacation hold (up to 7 days, pauses deadlines)
- Opponent-initiated 3-day extension (once per match)
- First-tournament grace (+2 days on all deadlines)

### Notification Types (27 total)
Tournament lifecycle (N-01 to N-04), scheduling reminders (N-10 to N-27), score reminders (N-40 to N-44), forfeit notices (N-50 to N-51). Batched daily, quiet hours 8 PM – 9 AM, 6-hour cooldown.

---

## Key Design Decisions

1. **JSONB for complex data**: Proposals, results, standings stored as JSONB — keeps schema simple, avoids deep normalization
2. **Dual-confirmation scoring**: Both players must agree on result before it's recorded
3. **Deterministic tiebreaks**: FNV-1a hash ensures consistent ordering when all other metrics are equal
4. **In-memory fallback**: Server works without Supabase for local dev (in-memory repos implement same interfaces)
5. **3-tier scheduling**: Maximizes auto-scheduled matches while providing graceful fallbacks
6. **Service role auth**: Backend uses Supabase service role key (no RLS policies needed)
7. **Monorepo with shared core**: Business logic (rating, round-robin, standings) shared between server and potential future clients

---

## Design Guidelines

### Brand & Color System

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#060e1e` | Page background (deep navy) |
| `--surface` | `#0c1a2e` | Sheet/modal backgrounds |
| `--card` | `#162a4a` | Card backgrounds, form inputs |
| `--card-border` | `#234068` | Card borders, dividers |
| `--red-primary` | `#D50A0A` | Brand accent, CTAs, nav active, primary buttons |
| `--blue-secondary` | `#1A5BB5` | Secondary accents, focus states |
| `--green` | `#22c55e` | Wins, success, confirmations |
| `--amber` | `#f59e0b` | Warnings, running states |
| `--gold` | `#FFD700` | Championship finals accent |
| `--bronze` | `#CD7F32` | 3rd-place finals accent |
| `--text` | `#f0f2f5` | Primary text |
| `--text-muted` | `#8b95a5` | Secondary text, labels |
| `--text-dim` | `#5a6577` | Tertiary text, hints |

**No orange anywhere.** Red (`#D50A0A`) is the brand color. Orange is explicitly banned.

**Design language**: NFL.com-inspired — bold, sharp, dark navy + red. Background has subtle blue radial glow at top. Header is deep navy (`#030810`) with 3px red bottom border.

### Typography

- **Headings**: Oswald (`--font-heading`) — bold, uppercase section headers with `letter-spacing: 0.08em`
- **Body**: Inter (`--font-body`) — clean, readable body text
- **Rally logo text**: Oswald italic (`.home-title { font-style: italic }`)
- **Section headers**: 14px uppercase tracked Oswald (`.section-title`)
- **Stat numbers**: Oswald for large numerical displays (ratings, scores, etc.)
- **Buttons**: Oswald 700, uppercase, `letter-spacing: 0.08em`

### Spacing

Spacing tokens: `--space-xs` (4px), `--space-sm` (8px), `--space-md` (16px), `--space-lg` (24px), `--space-xl` (32px).

### Card Pattern

Cards use `background: var(--card)`, `border: 1px solid var(--card-border)`, `border-radius: 12px`, and subtle depth with optional `box-shadow`. Nested containers (e.g., standings) use `border-radius: 12px` with `overflow: hidden` for contained elements.

### Bottom Sheet Pattern

All modal interactions use the `<BottomSheet>` component:
- Dark `--surface` background with `border-radius: 16px 16px 0 0`
- Drag handle, no duplicate titles (each sheet provides its own styled header)
- Content components: ScoreEntrySheet, ConfirmScoreSheet, SchedulingSheet, FlexSheet, ProposeSheet
- Action rows use `btn-primary` (red) and `btn-secondary` (card-colored) buttons

### Button Styles

| Class | Style | Usage |
|-------|-------|-------|
| `btn-primary` | Red background, white text, rounded | Submit, Confirm, primary CTA |
| `btn-secondary` | Card background, muted text, bordered | Cancel, Dispute, secondary actions |
| `.login-btn` | Red gradient background | Sign In button |
| `.action-card` | Card with blue border | Tappable action items |

### Status Badges

Tournament status badges use pill-shaped `border-radius: 12px` with transparent color backgrounds:
- Green: Active tournaments (pulsing green dot)
- Blue: Registration
- Amber: Finals (with pulse animation)
- Gray: Completed

### Logo & Icons

- **Rally R logo**: `/favicon.svg` — compact R icon with red/green gradient on navy
- **Full logo**: `/logo.svg` — R icon with "RALLY" italic wordmark
- **R logomark**: `/r.png` — always in upper-left, clickable to home
- **Full logo image**: `/logo.png` — used in hero/landing sections
- **Nav icons**: Inline SVGs (house, trophy, calendar, person), 20px stroke
- **Action card icons**: Emoji (contextual per action type)

### Mobile (iPhone 16)

`viewport-fit=cover`, `env(safe-area-inset-*)` on header + bottom nav, `apple-mobile-web-app-capable`, 16px minimum input font-size.

---

## Progress Log

> All notable changes are recorded here in reverse-chronological order.

### 2026-03-09 — Gate Password Reset Feature
- Added `POST /auth/gate/reset` endpoint: accepts reset key + new password, updates in-memory gate password
- Added `GATE_RESET_KEY` config option (Zod-validated)
- Updated GateScreen with "Forgot password?" flow (reset key + new password form)
- Added `.login-success` and `.login-link` CSS styles

### 2026-03-01 — GRP Migration Planning
- Documented migration path away from localStorage to Netlify + Supabase (DB-backed CMS/blog)
- Pending credentials: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### 2026-02-28 — GRP Password Gate
- Added full-site password gate in GRP frontend (localStorage key `grp-site-gate-auth-v1`)

### 2026-02-28 — Deployment: Netlify + Supabase + Render
- **Supabase PostgreSQL**: 6-table schema with JSONB for complex nested objects
- **Supabase repo layer**: 6 new repo implementations (`src/repo/supabase.ts`) implementing existing interfaces — zero changes to business logic
- **Backend build**: tsup bundles server + @rally/core into single `dist/index.js` for Render deployment
- **Frontend env**: `VITE_API_URL` env var for production API URL, falls back to `/v1` proxy for local dev
- **Render Blueprint**: `render.yaml` for one-click backend deployment with auto-generated auth secret
- **Netlify config**: `netlify.toml` with monorepo build command + SPA redirect
- **In-memory fallback**: Backend auto-detects missing Supabase env vars and falls back to in-memory storage

### 2026-02-28 — Rally v2: E2E Testing, Bug Fixes & Documentation
- **10-user E2E test suite**: Automated curl-based testing across 10 users with varied availability patterns
- **13 bugs identified**: 3 critical, 4 high, 3 medium, 3 warnings
- **Expert panel review**: 3-person UX/Visual/Backend panel produced prioritized fix specification
- **11 fixes implemented**: friendlyStatus/friendlyMatchStatus helpers, shortTournamentName, segment control CSS, empty state guidance, availability check on join, tier preservation in propose-times, duplicate join check reorder, login button text, empty availability warning, impact hint fallback
- **Re-test verification**: 7/7 tests passed

#### Scheduling Results Across Test Users

| User | Availability | Auto-scheduled | Near-miss | Propose & Pick |
|------|-------------|---------------|-----------|---------------|
| User 6 (Napa, broad) | 7 days 8-20 | 7/7 (100%) | 0 | 0 |
| User 1 (Marin, moderate) | Sat+Sun+Wed | 4/7 | 2 | 1 |
| User 5 (Sonoma, narrow) | Mon 18-19:30 | 1/7 | 0 | 6 |
| User 4 (Santa Clara, none) | None | 0/7 | 0 | 7 |

#### Bug Fixes Implemented

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

### 2026-02-28 — Rally v2: Smart Scheduling & UX Redesign (full build)
- **Three-tier scheduling intelligence**: Auto-scheduled (75min+ overlap), Flex Match (near-miss), Propose & Pick (no overlap)
- **4-tab navigation**: Home (action dashboard), Tourney (segmented control), Activity (match timeline), Profile (availability management)
- **Bottom sheets**: 5 sheet types for all interactions
- **200-player Bay Area seed data**: 10 counties, diverse names, 7 availability patterns
- **New backend endpoints**: scheduling-info, flex-accept, propose-times, availability-impact, seed-rich
- **Frontend**: ~25 new files (hooks, components, screens, styles)
- **CSS fixes**: Multiple rounds of class name alignment, flex layout fixes, responsive mobile layout

### 2026-02-27 — GRP Updates
- Corrected Fund Advisors section on Team page using source content
- Updated advisor bios, photo URLs, and role labels
- Enabled CMS visibility on all subpages when logged in
- Fixed CMS availability after Partner Login
- Updated mobile nav for iPhone bottom toolbar/safe area
- Rollback: Restored GRP to post-CMS-all-pages baseline

### 2026-02-26 — Test Simulation Bar
- **6 tournament test players** added to seed.ts (T1-Alex through T6-Faye, San Francisco County, NTRP 3.5)
- **Debug endpoint**: `POST /v1/debug/simulate-tournament`
- **Test bar UI**: fixed bar below bottom nav on all screens with player-switch buttons and simulation action

### 2026-02-25 — Cross-Band Pool Visibility Fix
- Frontend empty state now shows `totalCountyInterest` and `bandBreakdown` from pool status API
- Band breakdown pills display interest counts per NTRP band
- CTA text changes from "Start a tournament" to "Join the waitlist" when interest exists

### 2026-02-25 — Bug Fix Round (8-Agent Sweep)
- CSS: live dot color fixed red→green, nav font fixed Inter→Oswald, pulse keyframes updated
- Seed: Bob and Charlie NTRP corrected from 3.0 to 3.5
- Standings: lexicographic tiebreaker replaced with FNV-1a hash
- Rating: band 4.0 threshold corrected (`>=4.0`)
- Nearby players: filter changed from county+city to city-only
- Pool leave: now returns 404 when player not in pool
- Validation: NTRP enforces `.multipleOf(0.5)`; added `poolSignupSchema`
- Stripe: added `handleWebhookEvent`, webhook route with signature verification, portal route

### 2026-02-25 — City Autocomplete Search + "Start a Tournament" Flow
- **City search API**: `GET /v1/cities/search?q=` (no auth)
- **400+ US cities** mapped to counties + UK cities for demo compat
- **Setup + Home screens**: city autocomplete with county auto-fill
- **Empty state redesign**: "Start a tournament in [County]" CTA
- **Pool signup**: accepts optional `county` parameter
- **Start screen copy**: "Play more tennis. Play the right opponents. Automatically."

### 2026-02-25 — Logo/Icon Updates
- `r.png` (R logomark) on every screen upper-left, clickable to home
- `logo.png` (full RALLY logo) in hero/landing sections

### 2026-02-24 — Zero-Admin Tournament Engine (Full Implementation)
- **@rally/core expanded**: types, roundRobin.ts, standings.ts, rating.ts, validation.ts
- **Server**: TournamentEngine (30s tick), InMemoryPoolRepo, pool/tournament/score routes, Stripe integration, city search
- **Frontend**: tournament-detail screen, pool CTA, NTRP selector, subscription badges, city search autocomplete
- **Seed data**: 6 demo players with county/NTRP, 1 active + 1 registration tournament

### 2026-02-24 — Full NFL.com Design Overhaul
- Fonts: Oswald (headings) + Inter (body)
- Colors: #D50A0A red, #1A5BB5 blue, #060e1e bg
- Sharp buttons, 8px card radius, 3px red header border, red nav active glow

### Earlier — Initial Build
- Monorepo: @rally/web (Vite+React), @rally/server (Express), @rally/core (Zod + ELO)
- Auth: email-only HMAC tokens, sessionStorage per-tab, 6 seeded demo players
- Screens: Matches, Players, Schedule (availability), Me (profile), Match Detail
- AI scheduling: OpenAI gpt-4.1-mini → top-3 time proposals
- ELO: K=32 first 20 games, K=16 after, floor 100

---

## Recent Design Updates

### Design Polish (Commit 157dfa2)
- Reverted nav active color from orange to red (`#D50A0A`)
- Copied Rally R logo assets from v1 (`favicon.svg`, `logo.svg`, `r.png`)
- Fixed Profile screen CSS class mismatches
- Restyled availability section with proper form controls and slot chips
- Standings table wrapped in card container with dark header row and current-player highlight
- Info tab redesign: structured cards for tournament details, player pills, rules list

### Bottom Sheet Styling
- Rewrote all bottom sheet CSS to match actual TSX component class names
- Added `btn-primary` and `btn-secondary` shared button classes
- Added shared sheet header pattern (centered Oswald title + context subtitle)
- Added shared sheet actions row pattern (flex gap-12 layout)
- Styled all 5 sheet types (ScoreEntry, ConfirmScore, Scheduling, Flex, Propose)
- Removed duplicate titles (BottomSheet title prop removed; each sheet has own header)

### TestBar Verification
- All 6 steps verified working: Seed → Simulate → Schedule → Scores → Confirm → Finals
- Reset button verified: resets all step states to "ready"
- Full tournament lifecycle confirmed end-to-end including finals advancement

---

## Known Limitations / Next Steps

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
