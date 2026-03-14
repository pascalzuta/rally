# Play Tennis — Tournament App

## Overview
A mobile-first web app for organizing local tennis tournaments within county-based communities. Players register, join lobbies, get matched in tournaments, and schedule/play matches with Elo-based ratings.

## Architecture
- **Framework**: React + TypeScript + Vite
- **State**: localStorage-based store (no backend)
- **Styling**: Plain CSS with CSS variables

## Design System
- **Polymarket-inspired**: Neutral surfaces, minimal color, color only for meaning, strong typography hierarchy
- **Typography**: Inter font with `font-variant-numeric: tabular-nums` for consistent number rendering (no monospace overrides)
- **Unified card anatomy**: Eyebrow label → Title → Secondary text → Content module → Action button
- **Accent stripes**: 4px left border — blue (respond), orange (score), green (confirmed), gray (pending), red (escalated)
- **Typography scale**: 12px uppercase semibold eyebrow (0.06em letter-spacing), 18px semibold title, 14px secondary
- **Spacing**: 20px card padding, 16px border-radius, 16px card gap
- **Action-first sorting**: score > respond > schedule > confirmed > pending > completed
- **Match time display**: Stacked day/hour layout in the score area of match cards for scheduled matches

## Data Model

### Core Types
- **PlayerProfile**: id, name, county, createdAt
- **Tournament**: id, name, date, county, format (single-elimination | round-robin | group-knockout), players, matches, status (setup | in-progress | completed), groupPhaseComplete
- **Match**: id, round, position, player1Id, player2Id, scores, winnerId, completed, schedule, resolution, phase (group | knockout)
- **MatchSchedule**: status (unscheduled | proposed | confirmed | escalated | resolved), proposals, confirmedSlot, escalationDay, participationScores, resolution
- **MatchResolution**: type (walkover | forced-match | double-loss), winnerId, reason, resolvedAt, forcedSlot
- **MatchProposal**: id, proposedBy, day, startHour, endHour, status (pending | accepted | rejected)
- **PlayerRating**: name, rating (Elo), matchesPlayed
- **LobbyEntry**: playerId, playerName, county, joinedAt
- **AvailabilitySlot**: day, startHour, endHour
- **UpcomingSlot**: date, dayLabel, playerId, playerName, startHour, endHour (computed from AvailabilitySlot for next 3 days)
- **Trophy**: id, playerId, playerName, tournamentId, tournamentName, county, tier (champion | finalist | semifinalist), date, awardedAt, finalMatch (optional: opponentName, score, won)
- **Badge**: id, playerId, type (first-tournament | undefeated-champion | comeback-win | five-tournaments | ten-matches), label, description, awardedAt

### Match Broadcast Types
- **MatchBroadcast**: id, playerId, playerName, tournamentId, date, startTime, endTime, location, message, status (active | claimed | expired), createdAt, expiresAt, claimedBy, matchId

### Match Offer Types
- **MatchOffer**: offerId, senderId, senderName, recipientId, recipientName, tournamentId, proposedDate, proposedTime, createdAt, expiresAt, status (proposed | accepted | declined | expired), matchId
- **RallyNotification**: id, type (match_offer | offer_accepted | offer_declined | offer_expired | match_reminder), recipientId, message, detail, relatedOfferId, createdAt, read
- **DirectMessage**: id, senderId, senderName, recipientId, recipientName, text, createdAt, read

## Features

### Onboarding & Registration
- **Three-screen onboarding flow** before signup:
  - Screen 1 (Problem): "Scheduling tennis is frustrating" — chat bubble illustration
  - Screen 2 (Solution): "Rally schedules matches automatically" — availability overlap visual
  - Screen 3 (Motivation): "Compete in your local tennis ladder" — leaderboard preview
- **Signup screen**: First name, last name, county autocomplete
  - County field: searchable autocomplete with all 3,000+ US counties
  - Geolocation detection: reverse geocodes user location to suggest county
  - Social proof: "N players competing in [County]" below CTA
  - CTA button: "Start Competing"
  - Large Rally logo prominence (1.5x larger on registration)
- **Availability step**: Quick availability presets and custom time picker
- Polymarket-inspired visual style: clean cards, large typography, subtle animations
- Invite link flow skips onboarding, goes directly to signup with county pre-filled

### Lobby System
- County-based lobbies with 6-8 player tournaments
- 48-hour countdown once 6 players join
- Invite via shareable link with county parameter

### Tournament Formats
- **Single-elimination**: Seeded bracket by Elo, bye handling, winner advancement
- **Round-robin**: All-play-all with standings table
- **Group-knockout** (default): Full round-robin group phase → top 4 advance to single-elimination semis/final. Automatic knockout bracket generation when last group match is scored. Progress stepper shows Group → Semifinals → Final.

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

### Leave Tournament
- "Leave this tournament" link at bottom of Bracket tab (hidden for completed tournaments)
- Confirmation dialog warns about forfeiting remaining matches
- Setup tournaments: player removed from roster
- In-progress tournaments: all incomplete matches forfeited as walkovers for opponents
- Opponents automatically advanced in single-elimination brackets
- Tournament removed from player's tournament list after leaving

### Match Scoring
- 3-set tennis scoring with validation (6-4, 7-5, 7-6 tiebreak rules)
- Win probability bar (Elo-based)
- Automatic bracket advancement on score entry

### Player Ratings
- Global Elo system with dynamic K-factor: `250 / Math.pow(matchesPlayed + 5, 0.4)`
- Starting rating: 1500
- Rating labels: Newcomer (<1200) → Beginner (1200) → Club (1400) → Strong (1600) → Elite (1800) → Semi-pro (2000) → Pro (2200+)
- Rating history tracked per player with snapshots after each match
- Weekly trend calculation (rating change over last 7 days)

### County Leaderboard
- Rankings scoped by county, sourced from tournament players and lobby entries
- Leaderboard rows show avatar initial, name, W-L record, rating
- Crown emoji for #1 rank
- Soft highlight (light blue) for current player row
- Context text: "Rank #N of M players in County"
- Smart display: shows all for ≤10 players, top 3 + nearby for larger lists

### Trophies & Badges
- **Trophy system**: Champion (gold), Finalist (silver), Semifinalist (bronze) trophies awarded automatically on tournament completion
- **Trophy Cabinet**: Grid display on Profile, taps open detail modal with tournament name, tier, date, and final match result
- **Trophy visual**: Minimal vector trophy icon with metallic gradient per tier (gold #D4AF37, silver #C0C0C0, bronze #CD7F32)
- **Badges**: Milestone-based medallions — First Tournament, Undefeated Champion, Comeback Win, Veteran (5 tournaments), Seasoned (10 matches)
- **Victory animations**: Full-screen overlay on tournament completion — confetti particles, trophy scale-in, tier-appropriate text (1.6s duration, cubic easing)
- **Defending champion marker**: Trophy emoji shown next to name on leaderboard for players who've won a tournament in their county
- Storage: `play-tennis-trophies`, `play-tennis-badges`

### Tournament Availability Broadcast ("Play Now")
- Dedicated "Play Now" tab in bottom navigation (elevated from sub-feature to first-class tab)
- Creation flow: date, time window (from/to), location, optional message
- **Timeline view**: Broadcasts grouped by day, sorted by time, showing availability windows
- **Availability overview**: Shows all players' registered availability projected onto next 3 days (always visible, no toggle)
- Claim confirmation modal before committing to a match
- First-claim-wins: opponent claims → match auto-confirmed
- One active broadcast per player, auto-expires after 2 hours
- Broadcasts visible only to eligible opponents (unplayed, unscheduled)

### Match Offer & Acceptance System
- **Core model**: Structured match offers, not messaging. Players propose a specific time → opponent accepts/declines.
- **Flow**: Player proposes time → opponent receives offer → Accept / Decline → Match confirmed
- **MatchOffer type**: offerId, senderId, senderName, recipientId, recipientName, proposedDate, proposedTime, createdAt, expiresAt, status (proposed | accepted | declined | expired)
- **Offer creation** (Find Match tab):
  1. Player selects opponent
  2. System shows overlapping availability slots
  3. Player selects one time slot
  4. Taps "Ask to Play" → creates offer with status=proposed, 2-hour expiration
  5. Toast: "Match offer sent" (does NOT auto-confirm)
- **Offer delivery** (MVP localStorage simulation):
  - Stored in `rally_notifications` localStorage key
  - Notification appears in: bell dropdown, Play Now tab, Home action cards
  - Allows realistic testing when switching users in DevTools
- **Recipient experience**: Match Offer Card showing sender name, proposed time, expiration countdown, Accept/Decline buttons
- **Accepting**: status→confirmed, match record created, time slot reserved, both players notified, toast "Match scheduled"
- **Declining**: status→declined, sender notified, offer disappears from active lists
- **Expiration**: expiresAt = createdAt + 2 hours, expired offers cannot be accepted, sender sees "Offer expired"
- **Limits**: 1 active offer per opponent, 5 total outgoing offers max
- **Conflict prevention**: Accepting a match reserves the time slot, overlapping offers auto-closed
- **Home integration**: Confirmed match appears as top "Next Match" card with "Score Match" action
- **Notification types**: match_offer ("proposed a match"), offer_accepted, offer_declined, offer_expired, match_reminder
- **Backend transition**: System structured to map to future API → Match Offer Service → Notification Service (push, SMS, email)
- **UI principles**: Cards emphasize Time > Opponent > Expiration > Actions. No chat bubbles, no sports icons. Minimal and structured.

### Direct Messaging
- **1:1 messages** between players — simple text, no group chat
- **Access points**: Message icon on match cards (Bracket tab, Home tab) and opponent rows (Play Now tab)
- **Inline panel**: Expands below match card/opponent row — consistent behavior across all tabs
- **UI**: Chat bubble layout (own messages right-aligned blue, theirs left-aligned gray), auto-scroll, Enter to send
- **Inbox**: Envelope icon in top nav (left of notification bell) opens full message inbox
  - **Rendered at root level** (outside nav) with `z-index: 1000` for proper full-screen overlay
  - **Unread dot**: Red dot on envelope icon when any unread messages exist
  - **Tournament tabs**: "Current Tournament" / "Past Tournaments" navigation (same style as Bracket tab's matches/standings tabs)
  - **Conversation cards**: Sorted by most recent, showing avatar, name, preview text, timestamp, unread badge
  - Click conversation → opens full chat view with back navigation
- **Unread indicators**: Red dot on speech bubble icon per match/opponent card when unread messages exist from that player
- **Home action items**: Unread messages from tournament opponents appear as "Message" action cards on Home tab (priority between respond and schedule)
- **Data model**: `DirectMessage` with sender/recipient IDs, text, timestamp, read status
- **Storage**: `rally-direct-messages` localStorage key
- **Limits**: 500 character max per message
- **No match notes**: Notes feature on match schedule cards was removed to reduce clutter

### Match Scheduling — 2-Hour Windows
- Availability slots remain broad (e.g., "Saturday 9 AM – 3 PM") to maximize overlap matching
- When proposing match times, overlaps are split into **2-hour windows** (e.g., "9 AM", "11 AM", "1 PM")
- Minimum overlap required: 2 hours (one match length)
- Players choose a concrete 2-hour window, not a vague range

## Storage Keys
- `play-tennis-data` — Tournament data
- `play-tennis-ratings` — Global Elo ratings
- `play-tennis-profile` — Current user profile
- `play-tennis-lobby` — Lobby entries
- `play-tennis-availability` — Player availability
- `play-tennis-broadcasts` — Match broadcasts
- `play-tennis-rating-history` — Rating snapshots over time
- `play-tennis-trophies` — Player trophies (champion/finalist/semifinalist)
- `play-tennis-badges` — Player achievement badges
- `rally-match-offers` — Match offers (proposed/accepted/declined/expired)
- `rally-notifications` — In-app notification entries
- `rally-direct-messages` — Player-to-player direct messages

## Navigation Structure
Four-tab layout designed around the player's tournament journey.

**Browser history integration**: Tab state synced to URL hash (`#home`, `#bracket`, `#playnow`, `#profile`). Tab switches push history entries so the browser back/forward buttons navigate between tabs instead of leaving the app. Deep-linking supported (e.g. `play-rally.com/#bracket`).

| Tab | Icon | Purpose |
|-----|------|---------|
| **Home** | 🏠 | Dashboard with action cards — answers "what should I do next?" |
| **Bracket** | 🏆 | Dedicated bracket/standings view, always one tap away |
| **Play Now** | ⚡ | Broadcast availability & find opponents |
| **Profile** | 👤 | Stats, availability management, tournament history |

### Home Tab
- Onboarding card with activation steps (moved from Profile)
- Leaderboard teaser showing top 3 county players
- When no active tournament: shows Lobby (join/leave, invite friends, countdown)
- When active tournament: shows prioritized action cards for matches needing attention
  - Action types (by priority): Escalated > Score Match > Respond to Proposal > Schedule Match
  - "Up Next" card for confirmed upcoming matches with day/time
  - Tournament progress indicator
  - "You're all caught up" state when nothing needs attention
  - **Incoming offers summary** — count badge linking to Find Match tab (full offer UI lives on PlayNow, not duplicated here)
- **Inline actions**: Schedule and score matches directly from the Home tab without navigating to the tournament tab
  - Schedule/respond/escalated cards expand inline `MatchSchedulePanel` within the card
  - Score cards and up-next cards open `MatchScoreModal` as overlay
  - After completing an action, the card dismisses and the next action surfaces
  - Allows processing entire action queue from one screen

### Bracket Tab
- Full bracket (elimination) or standings table (round-robin) for the active tournament
- Match cards with inline scheduling, scoring, and messaging (tap to expand/score/message)
- Match sort priority: Escalated > Confirmed/Score > Proposed/Respond > Unscheduled > Others > Completed
- **Inline messaging**: Message icon on match cards opens conversation with opponent
- "Leave this tournament" link at bottom (replaces header button)

### Play Now Tab
- Broadcast creation form (date, time, location, message)
- Active broadcast management
- Availability timeline always visible (not behind a toggle)
- Active broadcasts from opponents with "Claim Match" flow
- **Inline messaging**: Message icon on opponent cards opens conversation

### Leaderboard
- Full county rankings with W-L records
- **Recent Activity feed** — last 5 county matches (moved from Home for better context alongside rankings)

### Profile Tab
- **Player identity card**: Name, county, matches played count
- **Rating hero card**: Large rating number with trend arrow (▲/▼), tier label (e.g. "Club Level"), county rank, last match change, weekly trend, engagement prompt ("One more win could move you to #3"), link to leaderboard
- **Performance grid**: 4-column grid with Matches, Wins, Losses, Win Rate (%)
- **Rating progress chart**: SVG line chart with match-based x-axis (Start, M1, M2...), visible data points, tournament history cards below
- **Availability**: Simplified display with short day names (Sat, Sun), title changes to "Available" when slots exist
- **Rating explainer**: Collapsible "How ratings work" section at bottom — Elo explanation, tier table, K-factor note
- Sign out button

## Components
- **App.tsx** — Root with 4-tab navigation (Home, Bracket, Play Now, Profile), derives active tournament
- **Home.tsx** — Dashboard with action cards (inline scheduling & scoring), lobby fallback, tournament progress
- **BracketTab.tsx** — Dedicated bracket/standings view with inline scheduling, scoring, and messaging
- **PlayNowTab.tsx** — Elevated broadcast/availability as first-class tab with inline messaging
- **Register.tsx** — Three-screen onboarding + signup with county autocomplete + availability picker
- **Lobby.tsx** — County lobby with countdown (used by Home tab)
- **TournamentView.tsx** — Legacy bracket/match display (retained for reference)
- **MatchSchedulePanel.tsx** — Time negotiation UI (used by Home and BracketTab)
- **MatchScoreModal.tsx** — Score entry modal (used by Home and BracketTab)
- **Standings.tsx** — Round-robin standings table (used by BracketTab)
- **BroadcastPanel.tsx** — Legacy broadcast panel (retained for reference; PlayNowTab replaces it)
- **Profile.tsx** — Player identity, rating hero, performance stats, rating chart, availability, rating explainer
- **MessagePanel.tsx** — Inline 1:1 chat panel (used by BracketTab, Home, PlayNowTab, and Inbox)
- **Inbox.tsx** — Full message inbox overlay with tournament tab navigation and conversation list
- **Leaderboard.tsx** — Full county ranking screen with avatar initials, W-L records, soft highlight, defending champion marker, recent activity feed
- **VictoryAnimation.tsx** — Full-screen trophy celebration overlay with confetti and tier-appropriate styling
- **DevTools.tsx** — Dev utilities (seed, simulate, switch profile)

## Dev Tools
- Seed lobby with test players (+1, +3, +5)
- Force start tournaments
- Simulate round scores
- Auto-confirm all schedules
- Escalate all unconfirmed matches
- Switch between test profiles
