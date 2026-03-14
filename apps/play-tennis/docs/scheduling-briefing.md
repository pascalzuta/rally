# Scheduling & Grouping System Briefing

## 1. Problem Statement

Today, when 6-8 players join a county lobby, the system batches them randomly and schedules each match independently via pairwise availability overlap. This breaks down in two ways: (1) random batching ignores availability compatibility, producing groups where some pairs have zero overlap; (2) match-by-match scheduling creates a negotiation burden -- each of the 15 matches in a 6-player round-robin goes through its own propose/accept/escalate cycle.

## 2. Vision

A player joins their county lobby, shares when they're free, and receives a fully-scheduled round-robin tournament within seconds of the tournament starting -- no back-and-forth required for most matches.

## 3. Solution Overview

| Component | What It Does | When It Runs |
|---|---|---|
| **Availability-Clustered Grouping** | Partitions N lobby players into groups of 6-8 where members share 3+ common 2-hour windows | At tournament creation, before bracket generation |
| **Bulk Auto-Scheduler** | Assigns concrete time slots to all round-robin matches in one pass | Immediately after bracket generation |

**How they connect:** Clustering feeds groups to the bracket generator. The bracket generator creates all round-robin matchups (known on day 1). The bulk scheduler assigns times to all matches at once. For 30+ players: just run multiple round-robin groups clustered by availability, with top finishers advancing to a cross-group playoff.

## 4. Format: Round-Robin Only

**Why round-robin is the only format we need:**
- All matchups known on day 1 -- 100% of matches can be bulk-scheduled
- Every player guaranteed 5+ matches (6-player group) -- more engagement
- Losing a match doesn't knock you out -- keeps casual players motivated
- Already half-built (`generateRoundRobin()` in tennis-core)
- Groups formed by availability overlap -- scheduling practically solves itself

**What we're removing:**
- Single-elimination -- only round 1 is schedulable upfront, rest depends on winners
- Group-knockout -- the knockout phase reintroduces "wait for winner" delays

**Scaling to 30+ players:** Multiple round-robin groups (clustered by availability). Top 1-2 finishers from each group advance to a cross-group playoff round-robin. Same format, just layered.

**Capacity:** 4-8 players per group. 6 is the sweet spot (15 matches, ~3 weeks).

## 5. Player Journey

| Step | Current | Proposed |
|---|---|---|
| 1. Join lobby | Name + county | Name + county + availability (tap presets or pick times) |
| 2. Wait for players | 6 players triggers 48h countdown | Same, but player sees a live "scheduling confidence" preview as others join |
| 3. Tournament created | Random group of 6-8 | Groups formed around shared availability |
| 4. Bracket generated | Matches created, each independently scheduled | All round-robin matches created, **most times locked in automatically** |
| **5. The "aha moment"** | 15 matches, all "unscheduled" or with proposals to review | **Player opens their bracket and sees "12 of 15 matches already scheduled."** Calendar-style view shows their next 3 weeks. |
| 6. Play matches | Proposal/counter-proposal/escalation per match | Most matches just show "Confirmed: Saturday 10 AM" |

> **UX callout -- Step 1 (Availability collection):** The current Register.tsx already has presets ("weekday evenings", "weekend mornings") and a custom picker. The change is making it mandatory -- but it must not feel like a gate. Design principle: **ask for availability as part of telling players what they'll get.** Frame it as "Tell us when you're free and we'll handle the rest." One-tap presets should cover 80% of players. Show a preview ("Based on your availability, you could play 3 matches this week") as immediate payoff.

> **UX callout -- Step 5 (The aha moment):** This is the single most important screen in the app. When a player opens their new tournament, the first thing they should see is: "Your matches are scheduled!" with a compact calendar view. A week-by-week agenda showing their next few matches with confirmed times. The feeling should be: "Wait, it already figured this out for me?"

> **UX callout -- The "just wants to play this weekend" player:** Not everyone wants a multi-week tournament. The existing Find Match tab serves this use case (broadcast availability, claim a match). The two flows should feel complementary: "Join a tournament for regular competition, or find a match right now."

## 6. Player Communication

How to present auto-scheduling in the UI -- this is the difference between "helpful" and "controlling."

### Language Guidelines

| System concept | Player-facing language |
|---|---|
| Auto-confirmed match | "Scheduled" (with green accent stripe) |
| Needs-accept match | "Suggested time -- tap to confirm" |
| Needs-negotiation match | "Pick a time with [opponent name]" |
| Bulk scheduler | Never mentioned. Players just see results. |
| Availability clustering | Never mentioned. Groups just work. |
| Overlap score | Never mentioned. |

### Notification Patterns

**When tournament is created:**
> "Your tournament is ready! 12 of 15 matches are already scheduled. Tap to see your calendar."

**When a match is auto-scheduled:**
Don't notify per match. Show the full schedule once, on bracket open. Individual match cards show confirmed times inline.

**When a suggested time needs confirmation:**
> "[Opponent name] -- Saturday 10 AM? Tap to confirm or pick another time."

**When availability changes after scheduling:**
> "Heads up -- your Saturday 10 AM match with [name] may need rescheduling. Want to find a new time?"

Don't auto-reschedule confirmed matches. The player confirmed it; changing it without consent breaks trust.

### Trust Principles

1. **Never schedule outside stated availability.** The system only uses times the player said they're free.
2. **Auto-confirmed means "both players said they're free then."** Make this visible: "Scheduled during a time you're both available."
3. **Players can always change.** Every confirmed match has a "Reschedule" option.
4. **Show your work on demand.** A "Why this time?" link shows: "You're both free Saturday mornings. This was the best fit with your other matches."

## 7. Scheduling Algorithm -- Bulk Auto-Scheduler

### Input
- All round-robin matches (from bracket generation -- all known on day 1)
- All players' `AvailabilitySlot[]`
- Constraints config

### Constraints

| Constraint | Rule |
|---|---|
| No double-booking | A player cannot have two matches in the same 2-hour window |
| Rest between matches | Minimum 1 day between matches for the same player |
| Weekly cap | Maximum matches per player per week (player-configurable: 1, 2, or 3) |

> **UX callout -- Weekly cap:** Let the player set their own cap during availability setup ("How many matches per week? 1 / 2 / 3"). This turns a constraint into a preference and gives the player control.

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

## 8. Grouping Algorithm -- Availability Clustering

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

> **UX callout -- Waitlisted players:** A player who joins, submits availability, waits, and gets told "sorry, you don't fit any group" will feel rejected. Design carefully: tell them why ("Your schedule didn't overlap enough -- we'll match you in the next round"), show when the next cycle starts, and offer to notify them. Better yet: show a warning during availability entry if their times are unusually narrow ("Tip: adding a weekend morning would match you with 4 more players").

### Data Dependency

Requires availability before lobby join. Current `Register.tsx` already has an availability picker. Change: make it **mandatory with a minimum of 3 slots** before "Join Lobby" is enabled.

> **UX callout -- "3 slots" feels arbitrary.** Don't show a counter ("2 of 3 required"). Instead, show a preview of matchable players that grows as they add slots. "You can match with 2 players" -> "You can match with 5 players" -> "You can match with 8 players -- nice!" The minimum still exists as a backend guard, but the UI motivates through reward.

## 9. Technical Changes

### Files to Modify

| File | Change |
|---|---|
| `types.ts` | Add `ClusterGroup`, `BulkScheduleResult`, `SchedulingConstraints` types. Add `schedulingTier: 'auto' \| 'needs-accept' \| 'needs-negotiation'` to `Match`. Remove `'single-elimination' \| 'group-knockout'` from `Tournament.format`, keep `'round-robin'` only. |
| `store.ts` | Replace random batching in `startTournamentFromLobby()` with cluster-based grouping. Replace per-match `generateMatchSchedule()` loop in `generateBracket()` with bulk scheduler call. Remove single-elimination and group-knockout bracket generation paths. |
| `tennis-core/roundRobin.ts` | No change (already generates round-robin pairings). |
| `sync.ts` | Sync `availability` table reads needed for overlap graph computation. |

### New Modules

| Module | Purpose |
|---|---|
| `packages/tennis-core/src/clustering.ts` | Overlap graph builder + greedy clustering algorithm |
| `packages/tennis-core/src/bulkScheduler.ts` | Batch match scheduler with constraint solving |

## 10. Edge Cases

| Scenario | What happens | Player communication |
|---|---|---|
| **Availability changes after scheduling** | Player taps "Reschedule" on a confirmed match. System re-runs scheduler for that match only. If no new overlap, falls back to negotiation. | "This match needs a new time. We'll suggest options based on your updated schedule." |
| **Player joins lobby late** | Included in the next clustering pass. Clustering runs at tournament creation, not continuously. | "You're in! Tournament starts when the countdown ends." |
| **Player wants to play this weekend only** | This is the Find Match flow, not the tournament flow. Keep them separate. | Existing broadcast + claim flow. No changes. |
| **Player submits very narrow availability** | Clustering may not find a compatible group. Waitlisted with guidance. | "Adding more times helps us find you matches. Players with flexible schedules get matched faster." |
| **Player no-shows a confirmed match** | Existing walkover / participation score system handles this. | Existing resolution flow. |
| **Two friends want to play each other** | Same-county players with similar availability will likely cluster together naturally. Explicit "play together" is a future enhancement. | Not surfaced in v1. |
| **30+ players in one county** | Multiple round-robin groups clustered by availability. Top finishers advance to cross-group playoff (also round-robin). | "You're in Group A! Top 2 from each group advance to the playoff round." |

## 11. Fallback System

For the 0-5% of matches that cannot be auto-scheduled:

| Stage | Timeline | Action |
|---|---|---|
| Suggestion | Day 0 | System suggests the best available slot |
| Counter-proposal | Day 0-2 | Players can counter-propose via existing `MatchSchedulePanel` |
| Escalation | Day 3 | System auto-assigns best remaining slot |
| Resolution | Day 4 | Existing resolution: walkover / forced-match / double-loss based on participation scores |

No changes to the existing escalation pipeline. It just handles far fewer matches.

## 12. Implementation Phases

| Phase | Scope | Effort | Impact |
|---|---|---|---|
| **1. Availability as onboarding** | Require availability before lobby join. Redesign availability step with presets, matchable-player preview, positive framing. Gate in `Register.tsx` and `joinLobby()`. | S | Unblocks everything. Improves onboarding immediately. |
| **2. Bulk auto-scheduler** | New `bulkScheduler.ts` module. Replace per-match scheduling in `generateBracket()`. Switch to round-robin only. Remove elimination/knockout code paths. | L | 70-90% of matches auto-confirmed. Biggest UX win. |
| **3. Scheduling dashboard** | "Your matches are scheduled!" screen. Calendar-style view of upcoming matches. Summary: "12 scheduled, 2 need your input, 1 being negotiated." | S | The "aha moment" screen. Ship alongside Phase 2. |
| **4. Availability clustering** | New `clustering.ts` module. Replace random batching in `startTournamentFromLobby()`. Waitlist experience. | M | Groups have natural overlap; scheduler success rate rises to 90%+. |

**Recommended order:** 1 -> 2 + 3 -> 4.

## 13. Risks & Tradeoffs

| Risk | Severity | Mitigation |
|---|---|---|
| **Mandatory availability deters signups** | Medium | Frame as benefit, not gate. Presets cover 80% of players. Show matchable-player preview. |
| **Clustering produces unequal group sizes** | Low | Allow groups of 4-8. Waitlisted players get clear communication and next-cycle notification. |
| **Bulk scheduler is slow** | Low | 6-player round-robin = 15 matches. Naive backtracking solves in < 100ms. |
| **Availability data goes stale** | Medium | Prompt players to re-confirm weekly. Never auto-reschedule confirmed matches. |
| **Backtracking creates unstable schedules** | Low | Limit backtracking depth to 2. Beyond that, fall back to "needs-accept" tier. |
| **Clustering splits friend groups** | Low | "Play together" pair constraint as future enhancement. |
| **Auto-scheduling feels controlling** | Medium | See Player Communication section. Always show why, always let players reschedule. |
| **Removing elimination format** | Low | Round-robin gives every player more matches. Elimination fans get the competitive edge from cross-group playoffs. |

### What We're Trading Off

- **Flexibility for structure:** Players share availability upfront instead of negotiating ad-hoc. The Find Match tab preserves the spontaneous path.
- **Simplicity for automation:** Two new modules (clustering + bulk scheduler), but the player experience becomes dramatically simpler.
- **One format for clarity:** Round-robin only. No format picker, no confusion. Everyone plays everyone in their group.
