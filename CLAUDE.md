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
Active development on `claude/tennis-tournament-app-wqHUw`
