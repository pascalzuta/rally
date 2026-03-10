# Play Tennis — Tournament App

## Overview
A mobile-first web app for organizing local tennis tournaments within county-based communities. Players register, join lobbies, get matched in tournaments, and schedule/play matches with Elo-based ratings.

## Architecture
- **Framework**: React + TypeScript + Vite
- **State**: localStorage-based store (no backend)
- **Styling**: Plain CSS with CSS variables

## Data Model

### Core Types
- **PlayerProfile**: id, name, county, createdAt
- **Tournament**: id, name, date, county, format (single-elimination | round-robin), players, matches, status (setup | in-progress | completed)
- **Match**: id, round, position, player1Id, player2Id, scores, winnerId, completed, schedule, resolution
- **MatchSchedule**: status (unscheduled | proposed | confirmed | escalated | resolved), proposals, confirmedSlot, escalationDay, participationScores, resolution
- **MatchResolution**: type (walkover | forced-match | double-loss), winnerId, reason, resolvedAt, forcedSlot
- **MatchProposal**: id, proposedBy, day, startHour, endHour, status (pending | accepted | rejected)
- **PlayerRating**: name, rating (Elo), matchesPlayed
- **LobbyEntry**: playerId, playerName, county, joinedAt
- **AvailabilitySlot**: day, startHour, endHour

### Match Broadcast Types
- **MatchBroadcast**: id, playerId, playerName, tournamentId, date, startTime, endTime, location, message, status (active | claimed | expired), createdAt, expiresAt, claimedBy, matchId

## Features

### Player Registration
- Two-step flow: name/county then availability setup
- Quick availability presets and custom time picker

### Lobby System
- County-based lobbies with 6-8 player tournaments
- 48-hour countdown once 6 players join
- Invite via shareable link with county parameter

### Tournament Formats
- **Single-elimination**: Seeded bracket by Elo, bye handling, winner advancement
- **Round-robin**: All-play-all with standings table

### Match Scheduling
- System generates proposals from availability overlap
- Players accept or counter-propose times
- Escalation timeline (Day 0-3): Day 3 auto-assigns best available slot
- Status flow: unscheduled → proposed → confirmed → escalated → resolved

### Unresolved Match Resolution
- **Participation Score**: Tracks scheduling engagement per player per match
  - +4 for accepting a proposal, +3 for proposing a time
  - Threshold: 3 points = meaningful participation
- **Resolution at Day 4**: When escalation completes without confirmation
  - **Walkover**: One player participated (>= threshold), other didn't → active player wins
  - **Forced Match**: Both participated → system assigns Sunday 10am slot, match must be played
  - **Double Loss**: Neither participated → match canceled, both receive loss
- Resolution indicators on match cards: "Match Awarded", "Final Match Assigned", "Match Canceled"
- Walkovers advance winners in single-elimination brackets automatically

### Match Scoring
- 3-set tennis scoring with validation (6-4, 7-5, 7-6 tiebreak rules)
- Win probability bar (Elo-based)
- Automatic bracket advancement on score entry

### Player Ratings
- Global Elo system with dynamic K-factor
- Rating labels: Newcomer → Beginner → Club → Strong → Elite → Semi-pro → Pro

### Tournament Availability Broadcast ("Play Now")
- Prominent "Play Now" button with lightning icon at top of tournament view
- Floating action button (FAB) in bottom-right for quick access from anywhere
- Creation flow: date, time window (from/to), location, optional message
- **Timeline view**: Broadcasts grouped by day, sorted by time, showing availability windows
- Claim confirmation modal before committing to a match
- First-claim-wins: opponent claims → match auto-confirmed
- One active broadcast per player, auto-expires after 2 hours
- Broadcasts visible only to eligible opponents (unplayed, unscheduled)

## Storage Keys
- `play-tennis-data` — Tournament data
- `play-tennis-ratings` — Global Elo ratings
- `play-tennis-profile` — Current user profile
- `play-tennis-lobby` — Lobby entries
- `play-tennis-availability` — Player availability
- `play-tennis-broadcasts` — Match broadcasts

## Components
- **App.tsx** — Root with tab navigation (Play, Tournaments, Profile)
- **Register.tsx** — Two-step registration
- **Lobby.tsx** — County lobby with countdown
- **TournamentView.tsx** — Bracket/match display with tabs
- **MatchSchedulePanel.tsx** — Time negotiation UI
- **MatchScoreModal.tsx** — Score entry modal
- **Standings.tsx** — Round-robin standings table
- **BroadcastPanel.tsx** — Play Now button, timeline view, creation form, claim confirmation
- **Profile.tsx** — Player stats and Elo rating
- **DevTools.tsx** — Dev utilities (seed, simulate, switch profile)

## Dev Tools
- Seed lobby with test players (+1, +3, +5)
- Force start tournaments
- Simulate round scores
- Auto-confirm all schedules
- Escalate all unconfirmed matches
- Switch between test profiles
