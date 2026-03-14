# Rally - Play Tennis

## Project Overview
Tennis tournament app for local communities. Players join by county, form lobbies, and auto-create tournaments when 6+ players join.

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase (Realtime Database for multi-user sync)
- GitHub Pages (deploy via `.github/workflows/deploy-pages.yml`)
- Custom domain: play-rally.com (CNAME configured)

## Key Architecture
- `apps/play-tennis/src/store.ts` — All game state (localStorage + Supabase sync)
- `apps/play-tennis/src/sync.ts` — Bi-directional Supabase sync layer
- `apps/play-tennis/src/supabase.ts` — Supabase client (hardcoded config, project ref: gxiflulfgqahlvdirecz)
- Data flows: localStorage (fast local cache) ↔ Supabase (shared persistence)

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

## Pending Tasks
- Configure DNS on Namecheap for play-rally.com → GitHub Pages (4 A records + 1 CNAME for www)
- Test multi-user sync end-to-end with real users

## Development
```bash
cd apps/play-tennis
npm run dev        # Dev server on port 5180
npm run build      # TypeScript check + Vite build
```

## Branch
Active development on `claude/rally-tennis-app-uuWbC`
