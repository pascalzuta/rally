# Rally - Play Tennis

## Project Overview
Tennis tournament app for local communities. Players join by county, form lobbies, and auto-create tournaments when 6+ players join.

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase (Realtime Database for multi-user sync)
- GitHub Pages (production deploy via `.github/workflows/deploy-pages.yml`)
- Vercel (staging/preview deploys — automatic per branch)
- Custom domain: play-rally.com (GitHub Pages, DNS: 185.199.x.x)

## Deployment (two environments)
- **Production**: play-rally.com — GitHub Pages, deploys on push to `main` via `deploy-pages.yml`
- **Staging**: rally-play-tennis.vercel.app — Vercel, deploys on push to `staging` branch
- **Workflow**: Develop on feature branches → merge to `staging` → check rally-play-tennis.vercel.app → user says "deploy to live" → merge `staging` into `main` → play-rally.com updates
- Both environments share the same Supabase database

## Key Architecture
- `apps/play-tennis/` — The Rally Tennis web app (the only tennis frontend)
- `apps/tennis-server/` — The Rally backend (Express, port 8788)
- `apps/play-tennis/src/store.ts` — All game state (localStorage + Supabase sync)
- `apps/play-tennis/src/sync.ts` — Bi-directional Supabase sync layer
- `apps/play-tennis/src/supabase.ts` — Supabase client (hardcoded config, project ref: gxiflulfgqahlvdirecz)
- Data flows: localStorage (fast local cache) ↔ Supabase (shared persistence)

## Component Routing (important!)
- `App.tsx` → `BracketTab` is the main tournament view (NOT `TournamentView.tsx`)
- `BracketTab` renders `ScheduleSummary` as the default "aha moment" view for round-robin tournaments
- `TournamentView.tsx` exists but is a secondary/legacy code path — changes there may not be visible on the live site

## Supabase Project
- Name: rally-tennis
- Region: us-west-2
- Tables: lobby, tournaments, ratings (all with RLS open + Realtime enabled)
- Dashboard: https://supabase.com/dashboard/project/gxiflulfgqahlvdirecz

## Registration Flow
1. Onboarding screens (3 screens: problem, solution, motivation)
2. Signup form (first name, last name, county)
3. Skill level & gender selection ("About your game" step)
4. Availability picker (quick slots or detailed custom times)
5. Confirmation screen → auto-navigates to Home tab

## Important Patterns
- **Post-registration**: New players must land on Home tab (not Profile). `handleRegistered` sets `activeTab('home')`.
- **Lobby sync listener**: Lobby component listens for `SYNC_EVENT` (`rally-sync-update`) to stay in sync with Supabase realtime updates. Without this, the counter can go stale.
- **DevTools seeding**: `seedLobby()` syncs seeded players to Supabase (not just localStorage). This prevents seeded players from disappearing when remote refresh fires.
- **No availability gate on lobby join**: Registration already makes availability mandatory. Do not add a second availability check in `joinLobby()` — it blocks re-joining after registration.

## Scheduling & Grouping System
Full briefing: `apps/play-tennis/docs/scheduling-briefing.md` (18 sections)

### Core Concept
- **Availability-clustered grouping**: Players grouped by shared 2-hour windows (min 3 overlap), not random
- **Bulk auto-scheduler**: Assigns all round-robin match times in one pass at tournament creation
- **Three scheduling tiers**: `auto` (confirmed), `needs-accept` (proposed), `needs-negotiation` (unscheduled)
- Tier data already set by `bulkScheduleMatches()` in `bulkScheduler.ts` — UI needs to read it

### Key Files
- `apps/play-tennis/src/clustering.ts` — `clusterPlayersByAvailability()` groups players by overlap
- `apps/play-tennis/src/bulkScheduler.ts` — `bulkScheduleMatches()` assigns times, sets scheduling tiers
- `apps/play-tennis/src/tennis-core.ts` — `generateRoundRobin()` creates all match pairings

### Architecture Decisions
- **Client-side scheduling**: Clustering is O(N²), sub-1ms for N<200. Bulk scheduling sub-5ms for 15 matches.
- **localStorage-first writes**: Same pattern as lobby fix — write local, then sync to Supabase
- **Availability sync gap**: Availability currently stored in localStorage only (`syncAvailability()` is a no-op). Must be synced to Supabase for multi-device scheduling. New `availability` table required.
- **Tournament lifecycle**: `setup` → `scheduling` (new) → `in-progress` → `completed`

### Design System (Polymarket Indoor-Inspired)
- Data-forward: numbers and status as primary visual elements
- Monospace tabular-nums for all counts, percentages, timers
- Color-coded left borders: green (auto/confirmed), blue (needs-accept), orange (needs-negotiation)
- Card style: `var(--color-surface)`, `var(--radius-md)`, `var(--shadow-sm)`, no visible border except status

### Implementation Priority
1. **P0**: Availability sync to Supabase (unblocks everything)
2. **P0**: "Aha moment" screen — schedule summary showing "12 of 15 matches auto-scheduled"
3. **P1**: Scheduling tier badges on match cards
4. **P1**: Calendar/agenda view for scheduled matches
5. **P2**: Weekly cap preference, waitlist experience

## Pending Tasks
- Configure DNS on Namecheap for play-rally.com → GitHub Pages (4 A records + 1 CNAME for www)
- Test multi-user sync end-to-end with real users
- Implement availability sync to Supabase (PR 1 — critical path)
- Build scheduling tier UI and "aha moment" screen (PR 2)

## Development
```bash
cd apps/play-tennis
npm run dev        # Dev server on port 5180
npm run build      # TypeScript check + Vite build
```

## Branch Strategy
- **NEVER push or merge to `main` unless the user explicitly says to deploy to live.** This is critical — `main` is the production branch and updates play-rally.com immediately.
- All work happens on feature branches branched from `staging`.
- When work is done, merge the feature branch into `staging` and push. This updates rally-play-tennis.vercel.app for the user to review.
- When the user says "deploy to live" (or similar), merge `staging` into `main` and push. This updates play-rally.com.
