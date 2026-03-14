# Scheduling & Grouping System Briefing

## 1. Problem Statement

Today, when 6-8 players join a county lobby, the system creates a single group-knockout tournament and schedules each match independently via pairwise availability overlap (`generateMatchSchedule` in `store.ts`). This works at small scale but breaks down in three ways: (1) with 100+ players in a county, random batching into groups of 6-8 ignores availability compatibility, producing groups where some pairs have zero overlap; (2) match-by-match scheduling creates a negotiation burden -- each of the 15 matches in a 6-player round-robin goes through its own propose/accept/escalate cycle; (3) round-robin is infeasible for 30+ players (435 matches for 30 players).

## 2. Vision

A player joins their county lobby, shares when they're free, and receives a fully-scheduled tournament bracket within seconds of the tournament starting -- no back-and-forth required for most matches.

## 3. Solution Overview

| Component | What It Does | When It Runs |
|---|---|---|
| **Availability-Clustered Grouping** | Partitions N lobby players into groups of 6-8 where members share 3+ common 2-hour windows | At tournament creation, before bracket generation |
| **Bulk Auto-Scheduler** | Assigns concrete time slots to all matches in one pass | Immediately after bracket generation |
| **Monthly Ladder Format** | Pairs players by availability overlap each round, 4-5 rounds for 30+ players | Alternative format for large lobbies |

**How they connect:** Clustering feeds groups to the bracket generator. The bracket generator feeds matches to the bulk scheduler. For large pools (30+), the Monthly Ladder replaces round-robin entirely, using overlap as a pairing criterion so scheduling is trivial by construction.

## 4. Player Journey

| Step | Current | Proposed |
|---|---|---|
| 1. Join lobby | Name + county | Name + county + availability (tap presets or pick times) |
| 2. Wait for players | 6 players triggers 48h countdown | Same, but player sees a live "scheduling confidence" preview as others join |
| 3. Tournament created | Random group of 6-8 | Groups formed around shared availability |
| 4. Bracket generated | Matches created, each independently scheduled | Matches created, **most times locked in automatically** |
| **5. The "aha moment"** | 15 matches, all "unscheduled" or with proposals to review | **Player opens their bracket and sees "12 of 15 matches already scheduled."** Calendar-style view shows their next 3 weeks. This is where the magic lands. |
| 6. Play matches | Proposal/counter-proposal/escalation per match | Most matches just show "Confirmed: Saturday 10 AM" |
| 7. Large lobby (30+) | Overflow creates multiple round-robin groups | **Monthly Ladder**: 4-5 rounds, paired by overlap, pre-scheduled |

> **UX callout — Step 1 (Availability collection):** The current Register.tsx already has presets ("weekday evenings", "weekend mornings") and a custom picker. The change is making it mandatory -- but it must not feel like a gate. Design principle: **ask for availability as part of telling players what they'll get.** Frame it as "Tell us when you're free and we'll handle the rest," not "You must submit 3+ availability windows to proceed." One-tap presets should cover 80% of players. Show a preview ("Based on your availability, you could play 3 matches this week") as immediate payoff.

> **UX callout — Step 5 (The aha moment):** This is the single most important screen in the app. When a player opens their new tournament, the first thing they should see is a celebration state: "Your matches are scheduled!" with a compact calendar view. Not a table of 15 rows -- a week-by-week agenda showing their next few matches with confirmed times. The feeling should be: "Wait, it already figured this out for me?"

> **UX callout — The "just wants to play this weekend" player:** Not everyone wants to commit to a multi-week tournament. The existing Play Now / Find Match tab already serves this use case (broadcast availability, claim a match). Make sure the scheduling briefing doesn't accidentally bury or complicate that path. The two flows should feel complementary: "Join a tournament for regular competition, or find a match right now."

## 5. Player Communication

How to present auto-scheduling in the UI -- this is the difference between "helpful" and "controlling."

### Language Guidelines

| System concept | Player-facing language |
|---|---|
| Auto-confirmed match | "Scheduled" (with green accent stripe) |
| Needs-accept match | "Suggested time -- tap to confirm" |
| Needs-negotiation match | "Pick a time with [opponent name]" |
| Bulk scheduler | Never mentioned. Players just see results. |
| Availability clustering | Never mentioned. Groups just work. |
| Swiss-system format | "Monthly Ladder" |
| Buchholz tiebreaker | "Opponent strength" (or just hide it) |
| Overlap score | Never mentioned. |

### Notification & Messaging Patterns

**When tournament is created (push / in-app):**
> "Your tournament is ready! 12 of 15 matches are already scheduled. Tap to see your calendar."

**When a match is auto-scheduled:**
Don't notify per match. Show the full schedule once, on bracket open. Individual match cards show confirmed times inline -- no fanfare needed.

**When a suggested time needs confirmation:**
> "[Opponent name] -- Saturday 10 AM? Tap to confirm or pick another time."

Frame it as a conversation between the player and a specific opponent, not as "the system assigned you a slot."

**When availability changes after scheduling:**
> "Heads up -- your Saturday 10 AM match with [name] may need rescheduling. Want to find a new time?"

Don't auto-reschedule confirmed matches. The player confirmed it; changing it without consent breaks trust.

### Trust Principles

1. **Never schedule without the player's availability data.** The system only uses times the player explicitly said they're free.
2. **Auto-confirmed means "both players said they're free then."** Make this visible: "Scheduled during a time you're both available."
3. **Players can always change.** Every confirmed match has a "Reschedule" option. It's not locked in stone.
4. **Show your work on demand.** A small "Why this time?" link could show: "You're both free Saturday mornings. This was the best fit with your other matches."

## 6. Technical Changes

### Files to Modify

| File | Change |
|---|---|
| `apps/play-tennis/src/types.ts` | Add `PlayerAvailabilityGraph`, `ClusterGroup`, `LadderTournament` types. Extend `Tournament.format` with `'ladder'`. Add `schedulingTier` to `Match`. |
| `apps/play-tennis/src/store.ts` | Replace random batching in `startTournamentFromLobby()` with cluster-based grouping. Replace per-match `generateMatchSchedule()` loop in `generateBracket()` with bulk scheduler call. Add ladder bracket generation path. |
| `packages/tennis-core/src/types.ts` | Add `SchedulingConstraints`, `BulkScheduleResult` types. Extend `Tournament` with `format: 'ladder'`. |
| `packages/tennis-core/src/roundRobin.ts` | No change (still used within clusters). |
| `apps/play-tennis/src/sync.ts` | Sync `availability` table reads needed for overlap graph computation. |

### New Modules

| Module | Purpose |
|---|---|
| `packages/tennis-core/src/clustering.ts` | Overlap graph builder + greedy clustering algorithm |
| `packages/tennis-core/src/bulkScheduler.ts` | Batch match scheduler |
| `packages/tennis-core/src/ladder.ts` | Monthly Ladder pairing engine (Swiss-system under the hood) |

## 7. Tournament Formats

### Round-Robin Season (Enhanced, Groups of 6-8)

Same as today's `group-knockout` format, but groups are formed by availability clustering instead of random assignment. Within each cluster, the existing `generateRoundRobin()` circle method works unchanged.

**Capacity:** 4-8 players per group (unchanged).

### Monthly Ladder (New, for 30+ Players)

> **UX callout — Progressive disclosure:** Do not ship this format on day 1. Start with enhanced round-robin (Phases 1-3). The Monthly Ladder adds real UI complexity (standings, round-by-round pairing, new mental model). Launch it only after the core auto-scheduling is proven and players are asking for bigger tournaments. The round-robin format is familiar and sufficient for early communities of 6-20 players.

| Property | Player-facing explanation |
|---|---|
| How it works | "You play 4-5 matches over the month. Each round, you're matched with someone at a similar level who's free when you are." |
| Standings | Rank, wins, "opponent strength" (Buchholz, but never called that) |
| Why not round-robin | "With 30+ players, playing everyone isn't practical. The ladder gives you competitive matches without the scheduling nightmare." |

**Under the hood:** Swiss-system pairing. `ceil(log2(N))` rounds. Sort by record, pair adjacent players by best overlap score. Each round's matches are pre-scheduled because overlap drives pairing.

> **UX callout — "Swiss" naming:** Never use "Swiss" in any player-facing UI or copy. It's jargon that means nothing to a recreational tennis player. "Monthly Ladder" communicates the core idea: you climb a ranking over a month of matches. If we need to explain the format, say: "Each round, you're matched with someone at your level."

## 8. Scheduling Algorithm -- Bulk Auto-Scheduler

### Input
- All matches in the tournament (from bracket generation)
- All players' `AvailabilitySlot[]` (from `play-tennis-availability` store)
- Constraints config

### Constraints

| Constraint | Rule |
|---|---|
| No double-booking | A player cannot have two matches in the same 2-hour window |
| Rest between matches | Minimum 1 day between matches for the same player |
| Weekly cap | Maximum 2 matches per player per week |
| Venue fairness | Distribute home/away if venue data exists |

> **UX callout — Weekly cap:** 2 matches per week is aggressive for casual recreational players with jobs and families. Consider defaulting to 1-2 and letting the player set their own cap during availability setup ("How many matches per week? 1 / 2 / 3"). This turns a constraint into a preference and gives the player control.

### Algorithm

```
1. For each match, compute candidate_slots = overlap_windows(player1, player2)
2. Sort matches by |candidate_slots| ascending  (hardest-to-schedule first)
3. For each match in sorted order:
   a. Filter candidate_slots by constraints (no conflicts with already-assigned matches)
   b. If slots remain: assign the highest-ranked slot, mark match as "confirmed"
   c. If no slots remain: try backtracking (un-assign the conflicting match, re-solve both)
   d. If backtracking fails: mark as "needs-accept" (propose top slot, one player must confirm)
   e. If no overlap at all: mark as "needs-negotiation" (existing escalation flow)
4. Return BulkScheduleResult { confirmed[], needsAccept[], needsNegotiation[] }
```

### Expected Outcomes (with well-clustered groups)

| Tier | % of Matches | What the player sees |
|---|---|---|
| Auto-confirmed | 70-90% | "Scheduled: Sat 10 AM" (green stripe) |
| Needs one accept | 10-20% | "Suggested: Sat 10 AM -- tap to confirm" (blue stripe) |
| Needs negotiation | 0-5% | "Pick a time with [name]" (orange stripe) |

### Integration Point

In `store.ts`, `generateBracket()` currently loops through matches calling `generateMatchSchedule()` per match (lines 1029-1033). Replace with:

```typescript
const result = bulkScheduleMatches(t.matches, allPlayerAvailability, constraints)
// result.confirmed -> schedule.status = 'confirmed'
// result.needsAccept -> schedule.status = 'proposed' (single best proposal)
// result.needsNegotiation -> schedule.status = 'unscheduled' (existing flow)
```

## 9. Grouping Algorithm -- Availability Clustering

### Overlap Graph Construction

For N players in a county lobby:

1. Fetch each player's `AvailabilitySlot[]`
2. Split all slots into 2-hour match windows (reuse existing `splitIntoMatchWindows()`)
3. For each player pair (i, j), compute `overlapScore = count of shared 2-hour windows per week`
4. Store as adjacency list: `Map<playerId, Map<playerId, number>>`

### Clustering

```
1. Build overlap graph for all N lobby players
2. Sort players by total overlap (sum of all edge weights) -- ascending (hardest to place first)
3. Greedy assignment:
   a. Take next unassigned player P
   b. Find the existing group G where P has the highest minimum overlap with all members
      (i.e., P shares >= 3 windows with every member of G)
   c. If no group qualifies or all groups are full (8 players): create new group with P
   d. If multiple groups qualify: pick the one with highest average overlap with P
4. Post-process: merge any undersized groups (< 4 players) into compatible groups, or
   place remainders on a waitlist for next cycle
```

### Minimum Overlap Threshold

A pair must share **3+ two-hour windows per week** to be in the same group. This ensures the bulk scheduler has enough candidate slots for constraint satisfaction.

**Why 3:** With 15 matches in a 6-player round-robin and constraints (no double-booking, rest days, weekly cap), each match needs ~2-3 viable slots to achieve 90%+ auto-scheduling.

> **UX callout — Waitlisted players:** "Place remainders on a waitlist for next cycle" is a one-liner that hides a painful experience. A player who joins a lobby, submits availability, waits for enough players, and then gets told "sorry, you don't fit any group" will feel rejected. Design the waitlist experience carefully: tell them why ("Your schedule didn't overlap enough with this group -- we'll match you in the next round"), show when the next cycle starts, and offer to notify them. Better yet: show a warning during availability entry if their times are unusually narrow ("Tip: adding a weekend morning would match you with 4 more players").

### Data Dependency

Requires availability before lobby join. Current `Register.tsx` already has an availability picker step. Change: make it **mandatory with a minimum of 3 slots** before the "Join Lobby" button is enabled.

> **UX callout — "3 slots" feels arbitrary to a player.** Don't show a counter ("2 of 3 required"). Instead, frame it positively: show a preview of matchable players that grows as they add slots. "You can match with 2 players" -> "You can match with 5 players" -> "You can match with 8 players -- nice!" The player adds more because they see the benefit, not because a gate demands it. The minimum still exists as a backend guard, but the UI motivates through reward, not requirement.

## 10. Edge Cases

| Scenario | What happens | Player communication |
|---|---|---|
| **Availability changes after scheduling** | Player taps "Reschedule" on a confirmed match. System re-runs scheduler for that match only. If no new overlap, falls back to negotiation. | "This match needs a new time. We'll suggest options based on your updated schedule." |
| **Player joins lobby late** (after others already waiting) | They're included in the next clustering pass. No special treatment needed -- clustering runs at tournament creation, not continuously. | "You're in! Tournament starts when the countdown ends." |
| **Player wants to play this weekend only** | This is the Find Match / Play Now flow, not the tournament flow. Don't try to merge these. | Existing broadcast + claim flow. No changes needed. |
| **Player submits very narrow availability** (e.g., only Tuesday 7-9 PM) | Clustering may not find a compatible group. Player is waitlisted with guidance. | "Adding more times helps us find you matches. Players with flexible schedules get matched faster." |
| **Player no-shows a confirmed match** | Existing walkover / participation score system handles this. No changes. | Existing resolution flow. |
| **Two friends want to play each other** | Future enhancement: "play together" pair constraint. For now, same-county players in similar availability windows will likely cluster together naturally. | Not surfaced in v1. |

## 11. Fallback System

For the 0-5% of matches that cannot be auto-scheduled:

| Stage | Timeline | Action |
|---|---|---|
| Suggestion | Day 0 | System suggests the best available slot |
| Counter-proposal | Day 0-2 | Players can counter-propose via existing `MatchSchedulePanel` |
| Escalation | Day 3 | System auto-assigns best remaining slot (existing `escalationDay` logic) |
| Resolution | Day 4 | Existing resolution: walkover / forced-match / double-loss based on `participationScores` |

No changes to the existing escalation pipeline (`MatchSchedule.escalationDay`, `MatchResolution`). The fallback system is identical to today -- it just handles far fewer matches.

## 12. Implementation Phases

| Phase | Scope | Effort | Impact |
|---|---|---|---|
| **1. Availability as onboarding** | Require availability before lobby join. Redesign availability step with presets, preview of matchable players, positive framing. Gate in `Register.tsx` and `joinLobby()`. | S | Unblocks everything. Also improves onboarding even before algorithm changes. |
| **2. Bulk auto-scheduler** | New `bulkScheduler.ts` module. Replace per-match scheduling in `generateBracket()`. **Design the "your matches are scheduled" screen.** | L | 70-90% of matches auto-confirmed. Biggest UX win. |
| **3. Availability clustering** | New `clustering.ts` module. Replace random batching in `startTournamentFromLobby()`. Design waitlist experience. | M | Groups have natural overlap; scheduler success rate rises to 90%+ |
| **4. Scheduling dashboard** | Show schedule summary to players: "12 scheduled, 2 need your input, 1 being negotiated." Calendar-style view of upcoming matches. | S | Transparency; this is the "aha moment" screen. Should ship alongside or immediately after Phase 2. |
| **5. Monthly Ladder format** | New `ladder.ts` module. Add format option for large lobbies. UI for ladder standings. **Only build when a county reaches 20+ active players.** | L | Unlocks 30+ player tournaments. Not needed until communities grow. |

**Recommended order:** 1 -> 2 -> 4 -> 3 -> 5. Note: Phase 4 (the scheduling dashboard) moved up. The auto-scheduler (Phase 2) without a good presentation layer will underwhelm. Players need to *see* the magic to feel it.

> **Over-engineering flag:** Phases 1-3 are the real product. Phase 5 (Monthly Ladder) is solving a scaling problem that doesn't exist yet. No county in the app has 30 players today. Build it when you need it. The clustering and bulk scheduling are valuable even at 6-8 player scale.

## 13. Risks & Tradeoffs

| Risk | Severity | Mitigation |
|---|---|---|
| **Mandatory availability deters signups** | Medium | Frame as benefit, not gate. Presets cover 80% of players. Show matchable-player preview as incentive. Already have presets in Register.tsx. |
| **Clustering produces unequal group sizes** | Low | Allow groups of 4-8. Waitlisted players get clear communication and next-cycle notification. |
| **Bulk scheduler is slow for large brackets** | Low | 6-player round-robin = 15 matches. Even naive backtracking solves in < 100ms. Ladder rounds solve independently (5-16 matches per round). |
| **Availability data goes stale** | Medium | Prompt players to re-confirm availability weekly. Never auto-reschedule confirmed matches -- offer to help reschedule instead. |
| **Ladder format unfamiliar to casual players** | Medium | Call it "Monthly Ladder." Show simple standings: rank, wins, next opponent. Hide tiebreaker math. Don't ship until needed. |
| **Backtracking creates unstable schedules** | Low | Limit backtracking depth to 2. Beyond that, fall back to "needs-accept" tier. Players always see stable confirmed times. |
| **Clustering splits friend groups** | Low | Allow "play together" links (pair constraint) that force two players into the same cluster. Future enhancement. |
| **Auto-scheduling feels controlling** | Medium | See Player Communication section. Key: always show why a time was chosen, always let players reschedule, never use language that implies the system "assigned" something. |

### What We're Trading Off

- **Flexibility for structure:** Players share availability upfront instead of negotiating ad-hoc. This is the core tradeoff -- we trade spontaneity for reliability. The Find Match tab preserves the spontaneous path.
- **Perfect fairness for schedulability:** Ladder pairing by overlap means some player pairs may never meet. Acceptable because the alternative (round-robin for 30+) is impractical.
- **Simplicity for automation:** The system becomes more complex (three new modules), but the player experience becomes dramatically simpler.
