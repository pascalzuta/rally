# Play Tennis - Project Briefing & Technical Documentation

## Project Overview

Play Tennis is a mobile-first tennis tournament app where players sign up by county and get auto-matched into tournaments. When 4+ players from the same county join the lobby, a tournament starts automatically. The app features a FiveThirtyEight-style Elo rating system that tracks player skill across tournaments.

Live URL: https://pascalzuta.github.io/rally/

## Features

- Player registration with name and county selection (Irish counties)
- County-based lobby system — join and wait for opponents
- Auto-start tournaments when 4+ players from the same county are in the lobby
- Auto-selects format: round-robin (up to 6 players) or single-elimination (7+)
- FiveThirtyEight-style Elo rating system (global, persists across tournaments)
- Rating-based seeding for single-elimination brackets
- Win probability bar displayed before each match
- Opponent ratings shown next to names in all match cards
- Set-by-set score entry (up to 2 sets per match)
- Automatic winner advancement in single-elimination
- Bye handling when player count isn't a power of 2
- Standings table for round-robin (sorted by wins, set diff, game diff)
- Profile tab with rating, win/loss stats, and match count
- Bottom tab navigation: Play, Tournaments, Profile

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
    ├── App.tsx             # Auth flow + tab navigation (Play/Tournaments/Profile)
    ├── store.ts            # All data operations (profile, lobby, tournaments, ratings)
    ├── types.ts            # TypeScript interfaces
    ├── styles.css          # All styles, CSS variables, mobile-first
    └── components/
        ├── Register.tsx          # Name + county registration
        ├── Lobby.tsx             # County waiting room, auto-start at 4
        ├── Profile.tsx           # Player rating, stats, sign out
        ├── TournamentView.tsx    # Tournament detail + bracket view
        ├── MatchScoreModal.tsx   # Score entry modal with win probability
        └── Standings.tsx         # Round-robin standings table
```

## Architecture

### User Flow
1. First visit: Register with name + county
2. Play tab: Join county lobby, wait for 4+ players
3. When enough players join: tournament auto-creates and starts
4. Tournaments tab: View and manage all your tournaments
5. Profile tab: See your Elo rating, stats, and match history

### State Management
No state library. Each component manages local state with `useState`. Persistence handled by pure functions in `store.ts` using multiple localStorage keys:
- `play-tennis-profile` — logged-in player profile
- `play-tennis-lobby` — county lobby entries
- `play-tennis-data` — tournaments
- `play-tennis-ratings` — global Elo ratings

### Data Model

- **PlayerProfile**: id, name, county, createdAt
- **LobbyEntry**: playerId, playerName, county, joinedAt
- **Tournament**: id, name, date, county, format, players[], matches[], status, createdAt
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
Pure CSS with variables for theming. Mobile-optimized (max-width 480px). Green primary color (#16a34a), system font stack, 12px border radius. Bottom tab navigation with safe-area-inset support.

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
| 2026-03-10 | County-based signup, lobby, auto-start, profile tab         |
