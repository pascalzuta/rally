# Project Log

## 2026-02-27
- Corrected Fund Advisors section on Team page using source content from https://greenroompartners.com/advisory-board.
- Replaced advisor bios with source-accurate summaries shortened by roughly 60%.
- Updated advisor photo URLs to official advisory-board image links with encoded crop parameters for reliability.
- Mirrored the same corrections in `GRP-alt/team.html` to keep instances aligned.
- Updated Team page advisor role labels: René Gamboa is now "Legal Advisor" and Hanno Fichtner is now "Strategy Advisor".
- 2026-02-27: Enabled CMS visibility on all subpages when logged in (including News and Post), removed page exclusions, and fixed CMS image-migration initialization bug in cms.js.
- 2026-02-27: Fixed CMS availability after Partner Login by forcing page reload on login/logout (GRP + GRP-alt). Bumped app.js cache-bust to v=20260227b.
- 2026-02-27: Updated mobile nav (<=780px) to open as a bottom-anchored sheet above iPhone bottom toolbar/safe area for easier testing. Bumped styles.css cache-bust to v=20260227n (GRP + GRP-alt).
- 2026-02-27 (rollback): Restored GRP to post-CMS-all-pages baseline by reverting later global login reload and bottom-anchored mobile nav changes. Asset refs reset to styles.css?v=20260225m and app.js?v=20260225n.
- 2026-02-28: Added full-site password gate in GRP frontend. Site is blocked until password `wimbledon` is entered (localStorage key grp-site-gate-auth-v1).
- 2026-03-01: Documented migration path away from localStorage to Netlify + Supabase (DB-backed CMS/blog). Pending credentials: NETLIFY_AUTH_TOKEN, NETLIFY_SITE_ID, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY. Goal: content persistence across deploys and server-side auth/API.
# Rally — Recreational Tennis League Platform

## Overview

Rally is a tournament and match scheduling platform for recreational tennis players. Players sign up, set their weekly availability, and join monthly round-robin tournaments in their county. The system auto-schedules matches using a 3-tier scheduling algorithm, handles dual-confirmation score reporting, computes ELO ratings, and manages the full tournament lifecycle from registration through finals.

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
| Auth | JWT (HMAC-signed, 24h TTL) |
| Hosting | Netlify (frontend), Render (backend) |
| Build | tsup (server bundle), Vite (frontend) |
| Optional | OpenAI (AI scheduling proposals), Stripe (subscriptions) |

---

## Monorepo Structure

```
/
├── apps/
│   ├── tennis-web-v2/              React frontend (main app)
│   │   ├── src/
│   │   │   ├── App.tsx             Main component + state orchestration
│   │   │   ├── api.ts              API client (fetch wrappers)
│   │   │   ├── types.ts            Frontend type definitions
│   │   │   ├── components/         Reusable UI components (12)
│   │   │   ├── screens/            Page-level components (6)
│   │   │   ├── hooks/              Custom React hooks (6)
│   │   │   └── styles/             CSS files
│   │   ├── vite.config.ts          Dev server on :5175, proxy /v1 → :8788
│   │   └── package.json
│   │
│   └── tennis-server/              Express backend API
│       ├── src/
│       │   ├── index.ts            Entry point
│       │   ├── config.ts           Zod-validated env config
│       │   ├── http/
│       │   │   ├── app.ts          Express setup + repo wiring
│       │   │   ├── routes.ts       All API endpoints (~1000 lines)
│       │   │   ├── seed.ts         Basic demo seeding
│       │   │   └── seedRich.ts     200 players + 10 county tournaments
│       │   ├── auth/tokens.ts      JWT generation
│       │   ├── middleware/auth.ts   Auth verification
│       │   ├── domain/rating.ts    Player creation + match result application
│       │   ├── services/
│       │   │   ├── tournamentEngine.ts  Tournament lifecycle automation
│       │   │   ├── scheduler.ts         Overlap + near-miss + AI proposals
│       │   │   ├── autoScheduler.ts     Greedy match scheduling
│       │   │   └── stripe.ts            Payment processing
│       │   └── repo/
│       │       ├── interfaces.ts   Data layer contracts
│       │       ├── memory.ts       In-memory repos (local dev)
│       │       └── supabase.ts     Supabase implementations (6 repos)
│       ├── supabase/schema.sql     PostgreSQL schema (6 tables)
│       ├── tsup.config.ts          ESM bundler for Render deploy
│       └── package.json
│
├── packages/
│   └── tennis-core/                Shared types + pure business logic
│       └── src/
│           ├── types.ts            Core data types (Player, Match, Tournament, etc.)
│           ├── rating.ts           ELO calculations + NTRP mapping
│           ├── roundRobin.ts       Round-robin tournament generation
│           ├── standings.ts        Standings computation with tiebreaks
│           └── validation.ts       Zod schemas
│
├── render.yaml                     Render deployment blueprint
├── netlify.toml                    Netlify build config + SPA fallback
└── package.json                    Root monorepo (npm workspaces)
```

---

## Core Features

### 1. Authentication & Profile Setup
- Email-based login (no password — JWT issued on email match)
- Profile setup: name, city (US city search), county, skill level (NTRP 2.5–5.0)
- ELO rating starts at 1000, provisional for first 5 matches

### 2. Weekly Availability
- Players set recurring weekly time slots (e.g., Mon 08:00–10:00, Sat 09:00–12:00)
- Up to 20 slots per player
- **Availability Impact**: API suggests which new slots would unlock the most match scheduling

### 3. Tournament System
- **Monthly round-robin** tournaments per county per skill band (3.0, 3.5, 4.0)
- 4–8 players per tournament
- Auto-activates when 8 players join (or 7 days + 4+ players)
- **Lifecycle**: Registration → Active → Finals → Completed
- **Finals**: Top 4 play championship (#1 vs #2) and 3rd-place (#3 vs #4) matches
- **Pool system**: Players queue up; tournaments auto-created when enough players

### 4. 3-Tier Match Scheduling

| Tier | Condition | UX |
|------|-----------|-----|
| **Tier 1** (Auto) | 2+ hour overlap in availability | Match auto-scheduled, players notified |
| **Tier 2** (Flex) | Near-miss: overlap < 75 min or gap ≤ 60 min | Player asked to flex by N minutes |
| **Tier 3** (Propose) | No useful overlap | Player proposes 3 times, opponent picks |

- **Greedy algorithm** schedules all tournament matches at once, max 1 match/player/day
- **Near-miss detection** identifies adjacent slots and small gaps with flex suggestions

### 5. Score Reporting (Dual Confirmation)
- Either player reports the result with structured set scores (e.g., 6-3, 6-4)
- Opponent must confirm the score
- **Auto-dispute resolution**: If not confirmed within 48 hours, auto-confirms
- Supports tiebreak scoring per set

### 6. Standings & Rankings
- **Tiebreak order**: Wins → Head-to-Head (2-way) → Set Diff → Game Diff → Deterministic hash
- Live-computed from confirmed match results
- Displayed with full W/L, sets, and games breakdown

### 7. ELO Rating System
- Base K-factor: 32 (first 20 games), then 16
- Adjusted for confidence (0–1) and provisional status (1.5x for provisional)
- Margin multiplier: bonus for decisive victories (up to 1.5x)
- NTRP mapping: `ntrpToRating(n) = 400 + n × 220`

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
| GET | /cities/search | No | US city search |
| GET | /players/me | Yes | Current player profile |
| PUT | /players/me | Yes | Update profile |
| GET | /players/:id | Yes | Get player by ID |
| GET | /players/nearby | Yes | Find nearby players |
| GET | /players/:id/availability-impact | Yes | Suggest high-impact availability slots |
| GET | /players/me/availability | Yes | Get availability slots |
| PUT | /players/me/availability | Yes | Set availability slots |
| GET | /matches | Yes | Player's matches |
| GET | /matches/:id | Yes | Match details |
| POST | /matches | Yes | Create challenge match |
| GET | /matches/:id/scheduling-info | Yes | Full scheduling info |
| GET | /matches/:id/scheduling-options | Yes | Overlap windows |
| POST | /matches/:id/accept-time | Yes | Accept proposed time |
| POST | /matches/:id/schedule | Yes | Manually schedule |
| POST | /matches/:id/flex-accept | Yes | Accept Tier 2 flex |
| POST | /matches/:id/propose-times | Yes | Propose 3 times (Tier 3) |
| POST | /matches/:id/result | Yes | Report casual match result |
| GET | /tournaments | Yes | List tournaments |
| GET | /tournaments/:id | Yes | Tournament detail + player names + ratings |
| GET | /tournaments/:id/matches | Yes | Tournament matches |
| POST | /tournaments/:id/join | Yes | Join tournament |
| DELETE | /tournaments/:id/leave | Yes | Leave tournament |
| POST | /tournaments/:id/matches/:matchId/score | Yes | Report tournament score |
| GET | /pool/status | Yes | Pool queue status |
| POST | /pool/signup | Yes | Join pool queue |
| DELETE | /pool/leave | Yes | Leave pool |
| POST | /subscription/checkout | Yes | Stripe checkout |
| POST | /subscription/portal | Yes | Stripe portal |
| GET | /subscription/status | Yes | Subscription status |
| POST | /debug/seed-rich | No | Seed 200 players + 10 tournaments |
| POST | /debug/simulate-tournament | No | Simulate a tournament |
| POST | /debug/accept-proposals | No | Accept all pending proposals for player |
| POST | /debug/submit-scores | No | Opponents submit scores for player's matches |
| POST | /debug/confirm-scores | No | Confirm all pending scores for player |
| POST | /debug/advance-to-finals | No | Advance tournament to finals phase |

---

## Frontend Architecture

### Screens
1. **LoginScreen** — Email authentication
2. **SetupScreen** — Profile setup (name, city search, county, level)
3. **HomeScreen** — Action items, next match, my tournaments, quick stats
4. **TourneyScreen** — Matches/Standings/Info tabs, finals UI, rating deltas, tournament discovery
5. **ActivityScreen** — All matches (upcoming, awaiting confirmation, completed)
6. **ProfileScreen** — Profile info, availability editor, impact suggestions, sign out

### Components
- **BottomNav** — 4-tab navigation (Home, Tourney, Activity, Profile) with action badge
- **BottomSheet** — Modal drawer for all match interactions
- **ActionCard** — Horizontally scrollable action items (score entry, scheduling, flex, propose)
- **ScoreEntrySheet** — Report result with winner + structured set scores
- **ConfirmScoreSheet** — Confirm/dispute opponent's reported score
- **SchedulingSheet** — Pick time from overlap options or accept proposals
- **FlexSheet** — Accept Tier 2 near-miss with flex suggestion
- **ProposeSheet** — Propose 3 custom times (Tier 3)
- **StandingsTable** — Ranked table with W/L, sets, games
- **TestBar** — Dev-only bar with 6-step test flow: Seed → Simulate → Schedule → Scores → Confirm → Finals

### Hooks
- `useAuth` — Login, logout, token/player state, profile updates
- `useMatches` — Load matches, submit scores, schedule, flex, propose, accept
- `useTournaments` — List, join, leave, load details
- `useActionItems` — Compute action items from matches + tournaments
- `useAvailability` — Get/save slots, load impact suggestions
- `useBottomSheet` — Sheet open/close and content type management

---

## Database Schema (Supabase PostgreSQL)

6 tables with JSONB for complex nested data, CITEXT for case-insensitive text:

- `auth_users` — id (UUID PK), email (CITEXT UNIQUE), created_at
- `players` — id (UUID PK → auth_users), all profile fields, indexed on county/city
- `availability_slots` — id, player_id (FK CASCADE), day_of_week, start_time, end_time
- `matches` — flat columns + JSONB for proposals/result/near_miss, indexed on players/tournament/status
- `tournaments` — flat columns + JSONB for rounds/standings/pending_results, TEXT[] for player_ids, unique index on (county, band, month)
- `pool_entries` — id, player_id (UNIQUE FK), county, band, rating

RLS enabled but no policies — backend uses service role key.

---

## Environment Variables

### Server
| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Yes | API port (8788 local, 10000 Render) |
| `AUTH_TOKEN_SECRET` | Yes | JWT signing secret (32+ chars) |
| `CORS_ORIGIN` | Yes | Frontend URL |
| `SUPABASE_URL` | No* | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | No* | Supabase service role JWT |
| `OPENAI_API_KEY` | No | AI scheduling proposals |
| `STRIPE_SECRET_KEY` | No | Stripe payments |

*Without Supabase vars, server falls back to in-memory storage (data lost on restart).

### Frontend
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | API base path (defaults to `/v1` for dev proxy) |

---

## Deployment

### Frontend (Netlify)
- Auto-deploys from GitHub on push
- Build: `npm install && npm run build --workspace=apps/tennis-web-v2`
- Publish: `apps/tennis-web-v2/dist`
- SPA fallback: `/* → /index.html` (200)
- Set `VITE_API_URL` to Render backend URL

### Backend (Render)
- Auto-deploys from GitHub on push (sometimes needs manual trigger)
- Build: `npm install && npm run build --workspace=apps/tennis-server`
- Start: `node apps/tennis-server/dist/index.js`
- Free tier, port 10000
- Set env vars: `AUTH_TOKEN_SECRET`, `CORS_ORIGIN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Database (Supabase)
- Schema in `apps/tennis-server/supabase/schema.sql`
- Run schema SQL in Supabase SQL Editor to create tables
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

# Run tests
npm test               # From root — runs all workspace tests

# Build for production
npm run build --workspace=apps/tennis-server    # → dist/index.js
npm run build --workspace=apps/tennis-web-v2    # → dist/
```

### Seeding Test Data
The `POST /v1/debug/seed-rich` endpoint creates:
- 200 players across 10 Bay Area counties
- 7 availability patterns designed to produce all 3 scheduling tiers
- 10 tournaments (one per county) in registration status with 7/8 players
- Joining as the 8th player triggers tournament activation + auto-scheduling

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

---

## Tournament Engine

Background process (`tournamentEngine.ts`) runs on a 30-second tick interval:

1. **Auto-activate**: Registration tournaments with 8 players or 7+ days old with 4+ players
2. **Generate rounds**: Circle-method round-robin, spread across 4-week window
3. **Auto-schedule matches**: Greedy algorithm using player availability (3-tier system)
4. **Enforce pace deadlines**: Auto-flex, auto-propose, auto-accept, auto-forfeit (see Pace Rules)
5. **Send notifications**: Batched email reminders for pending actions
6. **Auto-confirm scores**: Pending results uncontested for 48+ hours
7. **Advance to finals**: When all round-robin matches complete, create championship + 3rd-place matches
8. **Complete tournament**: When finals matches are done, lock final standings

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

## Design Guidelines (v2 Frontend)

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

### Typography

- **Headings**: Oswald (`--font-heading`) — bold, uppercase section headers with `letter-spacing: 0.08em`
- **Body**: Inter (`--font-body`) — clean, readable body text
- **Rally logo text**: Oswald italic (`.home-title { font-style: italic }`)
- **Section headers**: 14px uppercase tracked Oswald (`.section-title`)
- **Stat numbers**: Oswald for large numerical displays (ratings, scores, etc.)

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
- Green: Active tournaments
- Blue: Registration
- Amber: Finals (with pulse animation)
- Gray: Completed

### Logo & Icons

- **Rally R logo**: `/favicon.svg` — compact R icon with red/green gradient on navy
- **Full logo**: `/logo.svg` — R icon with "RALLY" italic wordmark
- **Nav icons**: Inline SVGs (house, trophy, calendar, person), 20px stroke
- **Action card icons**: Emoji (contextual per action type)

---

## Recent Updates

### Design Polish (Commit 157dfa2)
- Reverted nav active color from orange to red (`#D50A0A`)
- Copied Rally R logo assets from v1 (`favicon.svg`, `logo.svg`, `r.png`)
- Fixed Profile screen CSS class mismatches (player-card-name, badge-rating, etc.)
- Restyled availability section with proper form controls and slot chips
- Standings table wrapped in card container with dark header row and current-player highlight
- Info tab redesign: structured cards for tournament details, player pills, rules list

### Bottom Sheet Styling (Latest)
- Rewrote all bottom sheet CSS to match actual TSX component class names
- Added `btn-primary` and `btn-secondary` shared button classes used by all sheets
- Added shared sheet header pattern (centered Oswald title + context subtitle)
- Added shared sheet actions row pattern (flex gap-12 layout)
- Styled ScoreEntrySheet: winner toggle with active state glow, score inputs, preview card
- Styled ConfirmScoreSheet: report card with score display, dispute/confirm buttons
- Styled SchedulingSheet: option list with hover states, proposal heading, empty state
- Styled FlexSheet: slot comparison visual, gap info, adjusted window highlight
- Styled ProposeSheet: checkbox option list with scrollable container, selected state
- Removed duplicate titles (BottomSheet title prop removed; each sheet has own header)

### TestBar Verification
- All 6 steps verified working: Seed → Simulate → Schedule → Scores → Confirm → Finals
- Reset button verified: resets all step states to "ready"
- Full tournament lifecycle confirmed end-to-end including finals advancement
