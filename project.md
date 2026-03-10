# Play Tennis - Project Briefing & Technical Documentation

## Project Overview

Play Tennis is a mobile-first tennis tournament app where players sign up by county and get auto-matched into tournaments. When 4+ players from the same county join the lobby, a tournament starts automatically. The app features a FiveThirtyEight-style Elo rating system that tracks player skill across tournaments.

Live URL: https://pascalzuta.github.io/rally/

## Features

- Player registration with name and county selection (Irish counties)
- County-based lobby system — join and wait for opponents
- Auto-start tournaments when 4+ players from the same county are in the lobby
- Fixed 4-player single-elimination tournaments (2 semis + final)
- FiveThirtyEight-style Elo rating system (global, persists across tournaments)
- Rating-based seeding for single-elimination brackets
- Win probability bar displayed before each match
- Opponent ratings shown next to names in all match cards
- Best-of-3 set scoring with tennis score validation (6-x, 7-5, 7-6)
- Only match participants can enter scores (no scoring other people's games)
- SMS invite flow: share a link to invite friends to your county lobby
- **Match scheduling system**: availability collection during signup, automatic overlap calculation, structured accept/propose/escalate flow
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

## Brand Assets

All brand assets live in `apps/play-tennis/brand/` and are the canonical source. Do not modify proportions, stretch, rotate, or recolor.

```
apps/play-tennis/brand/
├── rally-logo.svg          # Full wordmark (logomark + "Rally" text) — canonical source
├── rally-logo-mark.svg     # Extracted swoosh logomark only
├── rally-logo-white.svg    # White version for dark backgrounds
├── favicon.svg             # Logomark as SVG favicon
├── favicon.ico             # 16x16 + 32x32 ICO favicon
├── apple-touch-icon.png    # 180x180 iOS home screen icon
├── app-icon-1024.png       # 1024x1024 app store icon
└── generate-assets.mjs     # Script to regenerate raster assets from SVG source
```

**UI usage rules:**
- Navigation bars: full logo (logomark + wordmark), rendered inline as SVG
- Small contexts (favicon, loading spinners, icons): logomark only
- Maintain clear spacing around the logo equal to at least the height of the "R"
- Logomark should be slightly smaller than wordmark height when inline with text

## Project Structure

```
apps/play-tennis/
├── index.html
├── vite.config.ts          # Base path: /rally/
├── tsconfig.json
├── package.json
├── brand/                  # Brand asset pack (see above)
└── src/
    ├── main.tsx            # React DOM entry point
    ├── App.tsx             # Auth flow + tab navigation (Play/Tournaments/Profile)
    ├── store.ts            # All data operations (profile, lobby, tournaments, ratings, availability, scheduling)
    ├── types.ts            # TypeScript interfaces (includes scheduling types)
    ├── styles.css          # All styles, CSS variables, mobile-first
    └── components/
        ├── Register.tsx          # Name + county + availability registration
        ├── Lobby.tsx             # County waiting room, auto-start at 4
        ├── Profile.tsx           # Player rating, stats, sign out
        ├── TournamentView.tsx    # Tournament detail + bracket view + scheduling
        ├── MatchSchedulePanel.tsx # Inline scheduling: proposals, accept, propose
        ├── MatchScoreModal.tsx   # Score entry modal with win probability
        └── Standings.tsx         # Round-robin standings table
```

## Architecture

### User Flow
1. First visit: Register with name + county + availability (quick picks or detailed, can skip)
2. Play tab: Join county lobby, wait for 4 players
3. While waiting: "Invite Friends" button generates SMS with `?join=County` deep link
4. When 4 players join: tournament auto-creates, bracket generated, matches get scheduling proposals
5. Players accept proposed times or propose alternatives; once confirmed, they can score the match
6. Tournaments tab: View and manage all your tournaments
7. Profile tab: See your Elo rating, stats, and match history

### Invite Flow (SMS Deep Link)
- **Trigger**: Player is in lobby, waiting for more players → "Invite Friends" button appears
- **Action**: Opens SMS compose with pre-written message + link (e.g. `?join=LA+County,+CA`)
- **New user clicks link**: Register screen with county pre-filled (read-only), auto-joined to lobby after registration
- **Existing user clicks link**: Auto-joined to the invite county's lobby immediately
- **Link format**: `{app-url}?join={county}` — parsed on app load, cleared from URL after processing

### Access Control
- **Scoring**: Only match participants can enter scores for their own matches
- **Tournament deletion**: Only available for completed tournaments, and only by participants
- **Lobby**: County-scoped — players only see their county's lobby

### Match Scheduling System
- **Availability collection**: During registration (step 2), players pick quick slots (weekday evenings, weekend mornings/afternoons) or enter detailed day/time ranges. Can skip.
- **Overlap calculation**: When a match is created, the system computes intersection of both players' availability. Ranked by duration > weekends > day order.
- **Proposals**: Up to 3 system-generated proposals from overlapping slots. If no overlap, falls back to either player's available times.
- **Structured actions**: Accept a proposal (one-tap confirms), or propose a new time slot. No chat required.
- **Scheduling states**: `unscheduled → proposed → confirmed → escalated`
- **Match scoring gate**: Players can only enter scores after the match time is confirmed (or if no schedule exists for legacy matches).
- **Escalation**: Day 3+ auto-confirms the best pending proposal. If no proposals exist, marks as escalated.
- **Dev tools**: "Confirm All" button auto-accepts first proposal for all unscheduled matches.

### State Management
No state library. Each component manages local state with `useState`. Persistence handled by pure functions in `store.ts` using multiple localStorage keys:
- `play-tennis-profile` — logged-in player profile
- `play-tennis-lobby` — county lobby entries
- `play-tennis-data` — tournaments
- `play-tennis-ratings` — global Elo ratings
- `play-tennis-availability` — player availability slots (keyed by player ID)

### Data Model

- **PlayerProfile**: id, name, county, createdAt
- **LobbyEntry**: playerId, playerName, county, joinedAt
- **Tournament**: id, name, date, county, format, players[], matches[], status, createdAt
- **Player**: id, name (per-tournament)
- **PlayerRating**: name, rating, matchesPlayed (global, persists across tournaments)
- **Match**: id, round, position, player1Id, player2Id, score1[], score2[], winnerId, completed, schedule?
- **MatchSchedule**: status, proposals[], confirmedSlot, createdAt, escalationDay, lastEscalation
- **MatchProposal**: id, proposedBy, day, startHour, endHour, status (pending/accepted/rejected)
- **AvailabilitySlot**: day (DayOfWeek), startHour, endHour

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
| 2026-03-10 | Fixed county to US (free text input)                        |
| 2026-03-10 | Added dev tools: lobby seeder + profile switcher             |
| 2026-03-10 | Capped tournaments at 4 players, always single-elimination   |
| 2026-03-10 | Product hardening: participant-only scoring, delete guards, best-of-3, tennis score validation |
| 2026-03-10 | SMS invite flow: share link to invite friends to county lobby |
| 2026-03-10 | Match scheduling system: availability collection, overlap engine, accept/propose flow |
| 2026-03-10 | Brand asset pack: full logo, logomark, white variant, favicon, app icons; navbar uses official SVG |
