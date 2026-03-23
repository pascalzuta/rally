# Rally — Play Tennis

Tennis tournament app for local communities. Players join by county, form lobbies, and auto-create tournaments when 6+ players join.

**Live:** [play-rally.com](https://play-rally.com)

## Structure

- `apps/play-tennis/` — React + TypeScript web app (Vite)
- `apps/tennis-server/` — Express + TypeScript backend
- `packages/tennis-core/` — Shared tennis logic (scheduling, standings)

## Run (Node.js 20+)

```bash
npm install
npm run dev:play-tennis     # Frontend on port 5180
npm run dev:tennis-server   # Backend on port 8788
```
