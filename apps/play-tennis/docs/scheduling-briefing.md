# Scheduling & Grouping System Briefing

## 1. Problem Statement

Today, when 6-8 players join a county lobby, the system creates a single group-knockout tournament and schedules each match independently via pairwise availability overlap (`generateMatchSchedule` in `store.ts`). This works at small scale but breaks down in three ways: (1) with 100+ players in a county, random batching into groups of 6-8 ignores availability compatibility, producing groups where some pairs have zero overlap; (2) match-by-match scheduling creates a negotiation burden -- each of the 15 matches in a 6-player round-robin goes through its own propose/accept/escalate cycle; (3) round-robin is infeasible for 30+ players (435 matches for 30 players).

## 2. Vision

A player joins their county lobby, submits 3+ availability windows, and receives a fully-scheduled tournament bracket within seconds of the tournament starting -- no negotiation required for most matches.

## 3. Solution Overview

| Component | What It Does | When It Runs |
|---|---|---|
| **Availability-Clustered Grouping** | Partitions N lobby players into groups of 6-8 where members share 3+ common 2-hour windows | At tournament creation, before bracket generation |
| **Bulk Auto-Scheduler** | Assigns concrete time slots to all matches in one constraint-solving pass | Immediately after bracket generation |
| **Swiss-Style Format** | Pairs players by availability overlap each round, 4-5 rounds for 30+ players | Alternative format for large lobbies |

**How they connect:** Clustering feeds groups to the bracket generator. The bracket generator feeds matches to the bulk scheduler. For large pools (30+), Swiss replaces round-robin entirely, using overlap as a pairing criterion so scheduling is trivial by construction.

## 4. Player Journey

| Step | Current | Proposed |
|---|---|---|
| 1. Join lobby | Name + county | Name + county + **3 availability windows required** |
| 2. Wait for players | 6 players triggers 48h countdown | Same, but system pre-computes overlap graph as players join |
| 3. Tournament created | Random group of 6-8 | **Clustered group** of 6-8 with high overlap scores |
| 4. Bracket generated | Matches created, each independently scheduled | Matches created, **bulk scheduler assigns 70-90% of slots instantly** |
| 5. Player sees bracket | 15 matches, all "unscheduled" or with proposals to review | 15 matches: ~12 confirmed, ~2 need one accept, ~1 needs negotiation |
| 6. Play matches | Proposal/counter-proposal/escalation per match | Most matches just show "Confirmed: Saturday 10 AM" |
| 7. Large lobby (30+) | Overflow creates multiple round-robin groups | **Swiss format**: 4-5 rounds, paired by overlap, pre-scheduled |

## 5. Technical Changes

### Files to Modify

| File | Change |
|---|---|
| `apps/play-tennis/src/types.ts` | Add `PlayerAvailabilityGraph`, `ClusterGroup`, `SwissTournament` types. Extend `Tournament.format` with `'swiss'`. Add `schedulingTier` to `Match`. |
| `apps/play-tennis/src/store.ts` | Replace random batching in `startTournamentFromLobby()` with cluster-based grouping. Replace per-match `generateMatchSchedule()` loop in `generateBracket()` with bulk scheduler call. Add Swiss bracket generation path. |
| `packages/tennis-core/src/types.ts` | Add `SchedulingConstraints`, `BulkScheduleResult` types. Extend `Tournament` with `format: 'swiss'`. |
| `packages/tennis-core/src/roundRobin.ts` | No change (still used within clusters). |
| `apps/play-tennis/src/sync.ts` | Sync `availability` table reads needed for overlap graph computation. |

### New Modules

| Module | Purpose |
|---|---|
| `packages/tennis-core/src/clustering.ts` | Overlap graph builder + greedy clustering algorithm |
| `packages/tennis-core/src/bulkScheduler.ts` | Constraint-based batch match scheduler |
| `packages/tennis-core/src/swiss.ts` | Swiss-system pairing engine |

## 6. New Tournament Formats

### Round-Robin Season (Enhanced, Groups of 6-8)

Same as today's `group-knockout` format, but groups are formed by availability clustering instead of random assignment. Within each cluster, the existing `generateRoundRobin()` circle method works unchanged.

**Capacity:** 4-8 players per group (unchanged).

### Swiss-Style (New, for 30+ Players)

| Property | Value |
|---|---|
| Players | 8-64 per bracket |
| Rounds | `ceil(log2(N))` -- 5 rounds for 32 players |
| Pairing per round | Sort by record, then pair adjacent players by best overlap score |
| Scheduling | Each round's matches are pre-scheduled because overlap drives pairing |
| Standings | Win count, then Buchholz (sum of opponents' wins), then game diff |

Swiss avoids the combinatorial explosion of round-robin while still giving every player multiple competitive matches.

## 7. Scheduling Algorithm -- Bulk Auto-Scheduler

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

| Tier | % of Matches | Player Action Required |
|---|---|---|
| Auto-confirmed | 70-90% | None -- shows as "Confirmed: Sat 10 AM" |
| Needs one accept | 10-20% | One tap to confirm proposed time |
| Needs negotiation | 0-5% | Existing proposal/counter-proposal flow |

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

### Data Dependency

Requires availability before lobby join. Current `Register.tsx` already has an availability picker step. Change: make it **mandatory with a minimum of 3 slots** before the "Join Lobby" button is enabled.

## 9. Fallback System

For the 0-5% of matches that cannot be auto-scheduled:

| Stage | Timeline | Action |
|---|---|---|
| Proposal | Day 0 | Bulk scheduler proposes best available slot |
| Counter-proposal | Day 0-2 | Players can counter-propose via existing `MatchSchedulePanel` |
| Escalation | Day 3 | System auto-assigns best remaining slot (existing `escalationDay` logic) |
| Resolution | Day 4 | Existing resolution: walkover / forced-match / double-loss based on `participationScores` |

No changes to the existing escalation pipeline (`MatchSchedule.escalationDay`, `MatchResolution`). The fallback system is identical to today -- it just handles far fewer matches.

## 10. Implementation Phases

| Phase | Scope | Effort | Impact |
|---|---|---|---|
| **1. Mandatory availability** | Require 3+ slots before lobby join. Gate in `Register.tsx` and `joinLobby()`. | S | Unblocks everything; no algorithm changes yet |
| **2. Bulk auto-scheduler** | New `bulkScheduler.ts` module. Replace per-match scheduling in `generateBracket()`. | L | 70-90% of matches auto-confirmed. Biggest UX win. |
| **3. Availability clustering** | New `clustering.ts` module. Replace random batching in `startTournamentFromLobby()`. | M | Groups have natural overlap; scheduler success rate rises to 90%+ |
| **4. Swiss format** | New `swiss.ts` module. Add format option for large lobbies. UI for Swiss standings. | L | Unlocks 30+ player tournaments without combinatorial explosion |
| **5. Scheduling dashboard** | Show `BulkScheduleResult` stats to players: "12 confirmed, 2 need your input, 1 being negotiated" | S | Transparency; reduces anxiety about tournament progress |

**Recommended order:** 1 -> 2 -> 3 -> 4 -> 5. Phases 1-2 deliver the core value. Phase 3 amplifies it. Phase 4 is independent and can run in parallel with 3.

## 11. Risks & Tradeoffs

| Risk | Severity | Mitigation |
|---|---|---|
| **Mandatory availability deters signups** | Medium | Keep minimum low (3 slots). Offer presets ("weekday evenings", "weekend mornings") to reduce friction. Already have presets in Register.tsx. |
| **Clustering produces unequal group sizes** | Low | Allow groups of 4-8. Remainders (< 4) wait for next cycle or get placed in a compatible group with relaxed threshold (2 windows). |
| **Bulk scheduler is slow for large brackets** | Low | 6-player round-robin = 15 matches. Even naive backtracking solves in < 100ms. Swiss rounds solve independently (5-16 matches per round). |
| **Availability data goes stale** | Medium | Prompt players to re-confirm availability weekly. Flag matches where a player's availability changed since scheduling. |
| **Swiss format unfamiliar to casual players** | Medium | Frame as "Monthly Ladder" not "Swiss System." Show simple standings: rank, wins, next opponent. Hide Buchholz from UI. |
| **Backtracking creates unstable schedules** | Low | Limit backtracking depth to 2. Beyond that, fall back to "needs-accept" tier. Players always see stable confirmed times. |
| **Clustering splits friend groups** | Low | Allow "play together" links (pair constraint) that force two players into the same cluster, with overlap threshold relaxed to 2 windows. Future enhancement. |

### What We're Trading Off

- **Flexibility for structure:** Players must commit availability upfront instead of negotiating ad-hoc. This is the core tradeoff -- we trade spontaneity for reliability.
- **Perfect fairness for schedulability:** Swiss pairing by overlap means some player pairs may never meet. Acceptable because the alternative (round-robin for 30+) is impractical.
- **Simplicity for automation:** The system becomes more complex (three new modules), but the player experience becomes dramatically simpler.
