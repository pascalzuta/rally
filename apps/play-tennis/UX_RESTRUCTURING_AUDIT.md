# UX Restructuring Audit — Play Tennis Tournament App

---

## Phase 1 — Feature Inventory

| # | Feature | Purpose | Current Location | Access Path | Est. Usage Frequency |
|---|---------|---------|-----------------|-------------|---------------------|
| 1 | Player Registration | Create profile with name, county, availability | `Register.tsx` — full screen | App load (no profile) | One-time |
| 2 | Availability Setup | Set weekly playing time slots (quick presets or custom) | `Register.tsx` — step 2 of registration | Registration → Step 2 | One-time |
| 3 | Invite Join Flow | Join lobby via SMS invite link (`?join=county`) | `App.tsx` + `Register.tsx` | External link → auto-join | Low |
| 4 | Lobby / Waiting Room | Wait for enough players to form a tournament | `Lobby.tsx` — Play tab | Bottom tab: Play | High |
| 5 | Join / Leave Lobby | Enter or exit the tournament waiting queue | `Lobby.tsx` — buttons | Play tab → Join/Leave button | Medium |
| 6 | Invite Friends (SMS) | Share invite link to recruit players | `Lobby.tsx` — Invite button | Play tab → Invite Friends | Low |
| 7 | Tournament Auto-Creation | Auto-create tournament at 6 players, countdown to start | `Lobby.tsx` + store | Automatic when 6 join lobby | Low (automatic) |
| 8 | Setup Countdown Timer | Show countdown until tournament starts (48h) | `Lobby.tsx` — inline | Play tab (when setup active) | Medium |
| 9 | Tournament List | View all tournaments (setup, active, completed) | `App.tsx` — Tournaments tab | Bottom tab: Tournaments | High |
| 10 | Tournament View | Main tournament screen with bracket and matches | `TournamentView.tsx` — full screen | Tournaments tab → tap card | High |
| 11 | Match Bracket Display | Show single-elimination bracket organized by round | `TournamentView.tsx` — Matches tab | Tournament View → Matches tab | High |
| 12 | Round-Robin Match List | Show all round-robin matches in a flat list | `TournamentView.tsx` — Matches tab | Tournament View → Matches tab | High |
| 13 | Match Scoring | Enter set scores and determine winner | `MatchScoreModal.tsx` — modal | Tournament → tap scoreable match | High |
| 14 | Win Probability Display | Show Elo-based win probability bar | `MatchScoreModal.tsx` — top of modal | Inside scoring modal | Low |
| 15 | Match Scheduling (Proposals) | Propose, accept, or counter-propose match times | `MatchSchedulePanel.tsx` — inline panel | Tournament → tap own unscheduled match | High |
| 16 | Scheduling Escalation | Auto-escalate unresolved scheduling after days | Store logic + `MatchSchedulePanel.tsx` | Automatic (displayed in match card) | Medium |
| 17 | Participation Scoring | Track player engagement in scheduling (0–6+ points) | Store logic + `MatchSchedulePanel.tsx` | Shown in escalated match status | Low |
| 18 | Walkover Resolution | Award win when opponent doesn't participate in scheduling | Store logic + `TournamentView.tsx` | Automatic after escalation day 4 | Low |
| 19 | Forced Match Assignment | System assigns time (Sun 10am) when both participated but can't agree | Store logic + `MatchSchedulePanel.tsx` | Automatic after escalation day 4 | Low |
| 20 | Double-Loss Resolution | Both players lose when neither participates | Store logic + `TournamentView.tsx` | Automatic after escalation day 4 | Low |
| 21 | Broadcast Availability ("Play Now") | Broadcast when/where you're available to play | `BroadcastPanel.tsx` — inline form | Tournament → Play Now button / FAB | Medium |
| 22 | Availability Timeline | See other players' upcoming availability (next 3 days) | `BroadcastPanel.tsx` — toggle section | Tournament → "Who's Free?" button / FAB | Medium |
| 23 | Claim Spontaneous Match | Claim another player's broadcast to confirm a match | `BroadcastPanel.tsx` — claim modal | Tournament → availability timeline → tap broadcast | Medium |
| 24 | Standings Table (Round-Robin) | Leaderboard with W/L, sets, Elo for round-robin | `Standings.tsx` — tab | Tournament → Standings tab | Medium |
| 25 | Player Ratings (Elo) | Track and display Elo ratings with tier labels | Store + `Profile.tsx` + match cards | Profile tab; match cards; standings | Medium |
| 26 | Profile & Stats | View name, county, rating, W/L record, events | `Profile.tsx` — Profile tab | Bottom tab: Profile | Low |
| 27 | Leave Tournament | Exit tournament with match forfeits | `TournamentView.tsx` — Leave button | Tournament → Leave button (header) | Low |
| 28 | Delete Tournament | Remove completed tournament from list | `App.tsx` — delete button on card | Tournaments tab → delete icon on card | Low |
| 29 | Sign Out | Log out and return to registration | `Profile.tsx` — Sign Out button | Profile tab → Sign Out | Low |
| 30 | Floating Action Buttons | Quick access to Play Now and Who's Free | `BroadcastPanel.tsx` — FABs | Bottom-right corner in active tournament | Medium |
| 31 | Dev Tools | Testing: seed lobby, simulate scores, switch profiles | `DevTools.tsx` — toggle panel | DEV button (bottom-right) | N/A (dev only) |

---

## Phase 2 — Usability Problems

### P1. Tournament access requires too many taps
The Tournaments tab shows a list of cards. To see your matches, you must tap a card. To schedule or score, you must then tap a specific match. This is 3 taps to reach the most common action (scheduling or scoring). For an app where a player is typically in exactly one active tournament, this is excessive.

### P2. The Play tab (Lobby) is useless once you're in a tournament
The default tab is "Play" (Lobby). Once a player has joined a tournament, the Lobby shows their county with a "Leave Lobby" button and little else of value. The most important screen — the active tournament — is behind the Tournaments tab instead.

### P3. Broadcast / "Play Now" is buried inside the tournament view
The broadcast system is one of the app's most time-sensitive features (broadcasts expire in 2 hours). Yet it's only accessible after navigating into a specific tournament's Matches tab. There is no indication on the Tournaments tab or Play tab that broadcasts exist.

### P4. Related scheduling features are scattered
Match scheduling proposals, escalation status, availability timeline, and Play Now broadcasts are all part of the same problem ("when are we playing?") but live in different parts of the UI:
- Proposals: inline panel inside a match card
- Escalation: badge on the match card
- Availability: toggle section in broadcast panel
- Play Now: separate broadcast form

### P5. No global "action needed" indicators
The Tournaments tab card shows status (setup/in-progress/completed) and player count, but never tells the user "you have 2 matches to schedule" or "1 match ready to score." The user must enter each tournament to discover pending actions.

### P6. Match cards overload multiple functions
Tapping a match card can either open the scoring modal or expand the scheduling panel, depending on match state. The user has no visible affordance explaining which will happen. The same tap target serves two fundamentally different purposes.

### P7. Availability setup is only during registration
Players set their availability during the registration flow (step 2) and have no way to update it afterward. There is no availability management screen in the Profile tab or anywhere else in the app.

### P8. No notification system
The app has no push notifications, no in-app notification center, and no badges. Scheduling proposals, escalation deadlines, broadcast claims, and tournament starts all require the user to manually check the app. Critical time-sensitive events (2-hour broadcast expiry, escalation deadlines) can be missed entirely.

### P9. Standings only accessible inside tournament
Round-robin standings require navigating into the tournament and switching to the Standings tab. There's no quick way to check your position.

### P10. Profile tab is a dead end
The Profile tab shows static stats but provides no way to update availability, view match history, manage settings, or access any actionable feature. It's purely informational.

### P11. Leave Tournament is too easy to trigger accidentally
The Leave button sits in the tournament header alongside the back button. Leaving a tournament is destructive (forfeits all matches) but is positioned as a casual header action.

### P12. Scheduling escalation is invisible to the user
Escalation happens through a day counter in the store, but the user has no visibility into the escalation timeline. They don't know when a match will be auto-resolved or what actions they need to take to avoid a walkover.

---

## Phase 3 — Next Action Visibility Analysis

| User State | Expected Next Action | Where it appears in UI | Clearly visible? | UX Problem |
|-----------|---------------------|----------------------|-----------------|------------|
| Just registered | Join the lobby | Play tab shows "Join Lobby" button | Yes | None — this works well |
| In lobby, waiting for players | Wait or invite friends | Play tab shows player count and invite button | Mostly yes | No indication of how long the wait might be |
| Tournament just started | See who you play and schedule your match | Must navigate: Tournaments tab → tap tournament → find your match → tap it | No | The most critical moment (tournament start) dumps users on the lobby tab with no redirect or prompt |
| Has an unscheduled match | Open match and propose times | Tournament → tap match card → scheduling panel | No | No indicator on tournament card. User must remember to check. No tap hint distinguishes "schedule" from "score" clearly |
| Has pending proposals from opponent | Accept or counter-propose | Tournament → tap match card → see proposals | No | No badge or count on tournament card. Proposals can sit unnoticed for days |
| Has a confirmed match coming up | Play the match, then report score | Confirmed time shown when match card is expanded | Partially | Confirmed time only visible after expanding the match. No reminder or countdown |
| Needs to report a match score | Tap match and enter scores | Tournament → tap scoreable match → scoring modal | Partially | "Tap to score" hint exists but blends into the match card. No prominent call-to-action |
| Match is being escalated | Respond to scheduling to avoid walkover | Escalation badge on match card | No | User doesn't know what escalation means, what day they're on, or when the deadline is |
| Advances to next round | See next opponent and schedule | New match appears in bracket | No | No celebration, no prompt, no "your next match" highlight. User must scan the bracket |
| Wants to play spontaneously | Broadcast availability or check who's free | Tournament → Play Now button or FAB | Partially | Only accessible inside tournament view. No prompt if opponents have broadcast |
| Tournament completed | See final results | Winner banner in tournament view | Yes | Works reasonably well |

**Summary:** The app communicates next actions poorly in 8 out of 11 common user states. The most critical gap is the absence of any global "action needed" signal — users must manually navigate into tournaments and expand match cards to discover what requires their attention.

---

## Phase 4 — Mental Model Analysis

### How players think about a tournament

Players have a simple linear mental model:

```
Join → See my opponent → Schedule our match → Play → Report score → See next opponent → Repeat
```

### Where the app diverges from this model

| Mental Model | Current App Structure | Mismatch |
|-------------|---------------------|----------|
| "I want to join a tournament" | Join Lobby → wait for 6 players → auto-creation → navigate to Tournaments tab to see it | The lobby is a waiting room concept that players don't expect. They expect to join a tournament directly. The transition from lobby to tournament is invisible. |
| "Who do I play next?" | Navigate to Tournaments tab → tap tournament → scan bracket for your name → find your match | Opponent discovery requires scanning a multi-round bracket. No "Your Next Match" highlight exists. |
| "When are we playing?" | Tap match card → scheduling panel expands with proposals | Scheduling is buried inside match cards. Players expect scheduling to be a primary activity, not a hidden sub-panel. |
| "I'm free right now, anyone want to play?" | Navigate to tournament → find broadcast panel → fill form | Spontaneous play is a tournament-scoped feature buried 3 levels deep. Players think of "I'm free" as a global action, not a tournament action. |
| "What do I need to do?" | Check each tournament individually, expand each match card | No dashboard or summary exists. Players expect the app to tell them what needs attention. |
| "How am I doing in the tournament?" | For round-robin: find Standings tab inside tournament. For elimination: scan bracket. | Standings are a secondary tab. Overall progress is never summarized. |
| "My match is coming up soon" | Expand match card to see confirmed time | No countdown, no reminder, no calendar integration. Players expect upcoming matches to be prominent. |
| "I won my match, what's next?" | Submit score → bracket updates silently → scan for new match | No transition or prompt guides the player forward after scoring. |

### Core Mismatch

The app is structured around **screens** (Lobby, Tournament List, Tournament View) while players think in terms of **actions** (schedule, play, score, advance). The navigation requires players to know which screen contains the action they need, rather than surfacing actions based on their current tournament state.

---

## Phase 5 — Proposed Experience Structure

1. When users open the app, they immediately see their active tournament and any matches requiring action — not the lobby.

2. If the user has no active tournament, the app shows a clear path to join one (lobby) as the primary screen.

3. Matches requiring attention (unscheduled, pending proposals, ready to score) are highlighted with clear action badges visible before tapping into a tournament.

4. Each match card clearly communicates its single expected action: "Schedule", "Respond to proposal", "Score this match", or "Confirmed for Saturday 3pm".

5. Scheduling a match takes no more than 2 taps from the home screen: tap match → accept a proposal or propose a time.

6. The "Play Now" broadcast feature is accessible from the top level of the app, not buried inside a tournament view — spontaneous play is a first-class action.

7. Players who are available right now are visible at a glance without navigating into tournament details.

8. When a player advances to the next round, the app immediately shows their next opponent and prompts them to schedule.

9. The tournament bracket is always one tap away and clearly shows the player's position and path through the tournament.

10. Scheduling escalation is transparent: players can see the escalation timeline, understand the consequences of inaction, and know exactly how many days remain before auto-resolution.

11. Match results can be reported directly from the match card on the home screen without navigating into the full tournament view.

12. Players always know their tournament standing — whether through a visible bracket position (elimination) or rank (round-robin).

13. Availability preferences can be updated at any time from the profile, not just during registration.

14. Notifications (even if in-app only) alert players to scheduling proposals, confirmed matches, escalation warnings, and broadcast opportunities.

15. The app feels like a guided journey from "join" to "champion" — each completed action naturally leads to the next step.

16. Tournament history and completed tournaments are accessible but secondary — the primary experience focuses on the current active tournament.

---

## Phase 6 — Proposed Navigation Structure

### Top-Level Navigation (Bottom Tabs)

```
Tab 1 — Home       Tab 2 — Bracket       Tab 3 — Play Now       Tab 4 — Profile
```

---

### Tab 1 — Home

**Purpose:** Dashboard showing everything that needs the player's attention right now.

**Key Screens:**
- Action cards for matches needing attention (schedule, respond, score)
- Active tournament summary with current round and opponent
- Upcoming confirmed matches with countdown
- Lobby join prompt (if no active tournament)

**Features contained:**
- Match action cards (schedule / respond to proposals / score)
- Confirmed match countdown
- Tournament progress indicator
- Lobby status and join/leave (when no active tournament)
- Setup countdown timer (when tournament is forming)
- Invite friends

**Rationale:** This replaces both the current Play tab and the Tournaments tab as the default landing screen. It answers "what should I do next?" immediately.

---

### Tab 2 — Bracket

**Purpose:** Full tournament bracket or standings view.

**Key Screens:**
- Single-elimination bracket with rounds
- Round-robin standings table
- Match detail (tap any match to see details, schedule, or score)

**Features contained:**
- Bracket visualization (elimination)
- Standings table (round-robin)
- All matches with status indicators
- Match scheduling panel (when tapping own match)
- Match scoring modal (when tapping scoreable match)
- Tournament info (name, format, player count)

**Rationale:** The bracket is the second most important view. It deserves its own tab rather than being nested inside a tournament card. Since a player is typically in one active tournament, this tab always shows the relevant bracket.

---

### Tab 3 — Play Now

**Purpose:** Spontaneous play — broadcast availability and find available opponents.

**Key Screens:**
- Broadcast creation form
- Available players timeline (next 3 days)
- Claim match confirmation

**Features contained:**
- Create broadcast (date, time, location, message)
- Active broadcast management (cancel)
- Opponent availability timeline
- Claim match flow
- Player availability overview

**Rationale:** Elevating Play Now from a sub-feature inside tournament view to a top-level tab makes spontaneous play discoverable and easy to access. This is one of the app's most differentiating features.

---

### Tab 4 — Profile

**Purpose:** Player identity, stats, settings, and tournament history.

**Key Screens:**
- Profile card (name, county, rating, tier)
- Stats summary (matches, wins, losses, events)
- Availability management (update weekly slots)
- Tournament history (completed tournaments)
- Sign out

**Features contained:**
- Player info and rating display
- Lifetime stats
- Availability editing (moved from registration-only)
- Past tournament list with results
- Account management (sign out)

**Rationale:** Profile becomes more useful by adding availability management and tournament history. Current tournaments move to Home; completed tournaments live here.

---

### Navigation for Edge Cases

| Scenario | Behavior |
|----------|----------|
| No active tournament | Home tab shows lobby with join prompt. Bracket and Play Now tabs show empty states with "Join a tournament first" message. |
| Multiple tournaments | Home tab shows action cards from all tournaments. Bracket tab shows a tournament selector at top. |
| Tournament just completed | Home tab shows completion summary and final results. Bracket tab shows final bracket. |
| Setup phase (countdown) | Home tab shows countdown and player roster. Bracket tab shows "Tournament starting soon" with player list. |

---

### Feature Location Changes Summary

| Feature | Current Location | Proposed Location |
|---------|-----------------|-------------------|
| Lobby (join/leave) | Play tab (default) | Home tab (when no tournament) |
| Tournament list | Tournaments tab | Home tab (active) + Profile tab (history) |
| Match actions | Tournament View → match card | Home tab (action cards) + Bracket tab |
| Bracket | Tournament View → Matches tab | Bracket tab (dedicated) |
| Standings | Tournament View → Standings tab | Bracket tab (tab within) |
| Play Now / Broadcast | Tournament View → broadcast panel | Play Now tab (dedicated) |
| Availability timeline | Tournament View → toggle in broadcast | Play Now tab |
| Claim match | Tournament View → broadcast → claim modal | Play Now tab |
| Player availability edit | Registration only | Profile tab |
| Tournament history | Tournaments tab (mixed with active) | Profile tab |
| Leave tournament | Tournament header | Bracket tab → settings/overflow |

---

## Phase 7 — Awaiting Approval

This audit is complete. All six phases have been documented:

1. Feature Inventory (31 features cataloged)
2. UX Problems (12 problems identified)
3. Next Action Visibility (11 user states analyzed)
4. Mental Model Analysis (8 mismatches identified)
5. Proposed Experience (16 bullet points)
6. Proposed Navigation (4-tab structure)

**No code changes have been made.** Awaiting approval before proceeding with implementation.
