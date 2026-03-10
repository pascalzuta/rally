# Play Tennis - Project Briefing & Technical Documentation

## Project Overview

Play Tennis is a mobile-first tennis tournament management web app. Users can create tournaments, add players, generate brackets, enter match scores, and track standings. The app runs entirely in the browser with no backend — all data is stored in localStorage.

Live URL: https://pascalzuta.github.io/rally/

## Features

- Create tournaments with name, date, and format selection
- Two formats: Single-elimination (knockout) and Round-robin
- Add/remove players during setup phase
- Auto-generated brackets with rating-based seeding
- FiveThirtyEight-style Elo rating system (global, persists across tournaments)
- Win probability display before each match
- Set-by-set score entry (up to 3 sets per match)
- Automatic winner advancement in single-elimination
- Bye handling when player count isn't a power of 2
- Standings table for round-robin (sorted by wins, set diff, game diff)
- Tournament lifecycle: setup -> in-progress -> completed
- Delete tournaments

## Tech Stack

- React 18.3 + TypeScript 5.7
- Vite 5.4 (build tool)
- Pure CSS with CSS variables (no UI library)
- localStorage for persistence (no backend)
- GitHub Pages for hosting (deployed via GitHub Actions)

## Project Structure

```
apps/play-tennis/
├── index.html
├── vite.config.ts          # Base path: /rally/
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx            # React DOM entry point
    ├── App.tsx             # Screen router (home / create / tournament)
    ├── store.ts            # localStorage CRUD operations
    ├── types.ts            # TypeScript interfaces
    ├── styles.css          # All styles, CSS variables, mobile-first
    └── components/
        ├── Home.tsx              # Tournament list
        ├── CreateTournament.tsx  # New tournament form
        ├── TournamentView.tsx    # Tournament detail + bracket view
        ├── MatchScoreModal.tsx   # Score entry modal (3 sets)
        └── Standings.tsx         # Round-robin standings table
```

## Architecture

### Routing
Client-side screen switching via `useState<Screen>()` in App.tsx. No URL-based router — refreshing returns to home screen.

### State Management
No state library. Each component manages local state with `useState`. Persistence handled by pure functions in `store.ts` that read/write to localStorage under the key `play-tennis-data`. Global player ratings stored separately under `play-tennis-ratings`.

### Data Model

- **Tournament**: id, name, date, format, players[], matches[], status, createdAt
- **Player**: id, name (per-tournament)
- **PlayerRating**: name, rating, matchesPlayed (global, persists across tournaments)
- **Match**: id, round, position, player1Id, player2Id, score1[], score2[], winnerId, completed

### Player Rating System (Elo)
FiveThirtyEight-style Elo rating system. Ratings are global (keyed by normalized player name) and persist across tournaments.

- **Initial rating**: 1500
- **Win probability**: P_A = 1 / (1 + 10^((R_B - R_A) / 400))
- **Dynamic K-factor**: K = 250 / ((matches + 5)^0.4) — new players adjust fast, veterans stabilize
- **Rating update**: R' = R + K * (actual - expected)
- **Score margin ignored** — only win/loss affects ratings (per FiveThirtyEight model)
- **Seeding**: Single-elimination brackets seed by rating (top seeds placed apart)
- **Storage**: Separate localStorage key `play-tennis-ratings`

Rating scale: <1200 Newcomer, 1200 Beginner, 1400 Club, 1600 Strong, 1800 Elite, 2000 Semi-pro, 2200+ Pro

### Styling
Pure CSS with variables for theming. Mobile-optimized (max-width 480px). Green primary color (#16a34a), system font stack, 12px border radius.

## Deployment

- Hosted on GitHub Pages
- Auto-deployed via `.github/workflows/deploy-pages.yml`
- Triggers on push to `claude/tennis-tournament-app-wqHUw` or `main`
- Build: `npm ci` at monorepo root, then `npm run build:play-tennis`
- Output: `apps/play-tennis/dist`

## Monorepo Context

This app lives inside a larger monorepo with npm workspaces. The root `package.json` defines workspace scripts. The lockfile is at the repo root, not in the app directory.

## Change Log

| Date       | Change                                                      |
|------------|-------------------------------------------------------------|
| 2026-03-10 | Initial app deployed to GitHub Pages                        |
| 2026-03-10 | Fixed workflow: install deps from monorepo root             |
| 2026-03-10 | Added branch deployment rule for feature branch             |
| 2026-03-10 | Added FiveThirtyEight Elo rating system with seeding        |
