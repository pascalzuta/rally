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

## 14. UX Specification — Detailed Screen & Interaction Specs

This section provides implementation-ready descriptions for every scheduling-related screen. All specs reference the existing Polymarket-inspired design system defined in `styles.css`: card containers with `var(--radius-card)` corners and `var(--shadow)`, `border-left: 4px solid` status stripes on `.match-card`, `font-variant-numeric: tabular-nums` for numbers, and the color token palette (`--color-positive-primary` green, `--color-accent-primary` blue, `--color-warning-primary` orange, `--color-negative-primary` red, `--color-text-muted` gray).

---

### 14.1 Availability Collection UX (Registration Step)

**Where it lives:** The existing `step === 'availability'` screen in `Register.tsx`. Currently optional; becomes mandatory. The "Start Competing" button (`btn btn-primary btn-large`) stays disabled until the minimum threshold is met (3 two-hour windows — enforced server-side, never shown as a counter).

#### Screen Layout (top to bottom)

1. **Header block** (reuses `.signup-header`)
   - Title: "When can you play?" (keeps current `signup-title` class)
   - Subtitle changes from current "Tell us when you're free and we'll handle the rest" to: **"Add your times. We'll schedule your matches automatically."** — shifts framing from "give us data" to "here's what you get."

2. **Quick-slot toggle grid** (reuses `.quick-slots` container)
   - Same five presets as today (`QUICK_SLOTS` array). Each renders as a `.quick-slot-btn` chip.
   - Interaction: tap to toggle. Selected state adds `selected` class (existing). Checkmark character renders in `.quick-slot-check` span.
   - Change: the first two options ("Weekday evenings", "Saturday mornings") keep the `recommended` class but gain a subtle label: a `::after` pseudo-element reading "Most popular" in `--font-body-sm` / `--color-text-muted`, positioned below the button text. No new DOM element needed.

3. **Matchable-players preview** (NEW element — `.availability-preview`)
   - Appears immediately below the quick-slot grid. Hidden when zero slots selected; fades in (`opacity 0 -> 1, 200ms ease`) when the first slot is toggled.
   - Structure:
     ```
     <div class="availability-preview">
       <span class="availability-preview-count">5</span>
       <span class="availability-preview-label">players you can match with</span>
     </div>
     ```
   - `.availability-preview` — `display: flex; align-items: baseline; gap: var(--space-sm); padding: var(--space-md) 0;`
   - `.availability-preview-count` — `font-variant-numeric: tabular-nums; font-size: var(--font-title-sm); font-weight: var(--weight-bold); color: var(--color-positive-primary);` Animates on change: number scales from `1.2` to `1.0` over 200ms.
   - `.availability-preview-label` — `font-size: var(--font-body-md); color: var(--color-text-secondary);`
   - The count is computed client-side: fetch lobby players for the user's county, count how many share at least one overlapping two-hour window with the user's current selection. This is a lightweight local computation (iterate `lobbyEntries`, compare availability arrays).
   - When count increases, append a brief message below the label: "Nice — that's enough for a full tournament group" (when count >= 5). Renders in `.availability-preview-hint` — `font-size: var(--font-body-sm); color: var(--color-positive-primary); margin-top: var(--space-xs);`
   - When count is low (1-2) and the user has only one slot selected, show instead: "Tip: adding a weekend morning matches you with more players" — `color: var(--color-warning-primary)`.

4. **"Set specific times instead" link** (existing `.btn-link`). Opens the detailed picker. No changes to the detailed picker UI itself (day/start/end selects + add button), but the matchable-player preview stays visible and updates as detailed slots are added.

5. **Weekly cap selector** (NEW — see Section 14.6 for full spec). Placed between the availability picker and the CTA button.

6. **CTA button** — "Start Competing" (existing `btn btn-primary btn-large`). Disabled when `selectedQuick.size === 0 && detailedSlots.length === 0`. The minimum-3-windows check happens at the store layer (`joinLobby` rejects if fewer than 3 two-hour windows), not via button disabling — the matchable-player preview naturally motivates adding enough.

7. **Remove the "Skip for now" path.** The current `handleFinish(true)` skip option is removed. Availability is mandatory. The only way forward is to select at least one slot and tap "Start Competing."

#### Interaction Flow

- User taps "Weekday evenings" -> 5 slots toggled, preview shows "8 players you can match with" (green number).
- User taps "Saturday mornings" -> count jumps to "12 players you can match with", hint says "Nice — that's enough for a full tournament group."
- User taps "Start Competing" -> profile created, availability saved, navigates to Home tab.

#### Data Integration

- On mount, fetch current lobby entries for the user's county: `getLobbyByCounty(county)`.
- For each lobby player, load their availability: `getAvailability(playerId)`.
- Compute overlap: for each lobby player, check if any of their slots overlaps with any of the user's currently-selected slots (a slot overlaps if same `day` and the time ranges intersect by at least 2 hours). Count distinct players with >= 1 overlap.

---

### 14.2 The "Aha Moment" Screen (Post-Scheduling Summary)

**When it appears:** Immediately after a tournament is created and the bulk scheduler runs. The user navigates (or is auto-navigated) to the Bracket tab. Instead of seeing the raw bracket, they see this summary screen first. It replaces the first render of the bracket view. A "View Full Bracket" button at the bottom transitions to the standard bracket view.

#### Above-the-Fold Layout (top to bottom, within viewport)

1. **Hero stat** (occupies ~30% of above-fold space)
   - Container: `.schedule-hero` — `text-align: center; padding: var(--space-xxl) var(--space-xl);`
   - Primary number: "12" — `font-size: 56px; font-weight: var(--weight-bold); font-variant-numeric: tabular-nums; color: var(--color-positive-primary); line-height: 1;`
   - Qualifier: "of 15 matches scheduled" — `font-size: var(--font-body-lg); color: var(--color-text-secondary); margin-top: var(--space-sm);`
   - Subtitle: "Your tournament is ready." — `font-size: var(--font-body-md); color: var(--color-text-muted); margin-top: var(--space-md);`

2. **Three-tier summary bar** (horizontal, compact — like a Polymarket outcome bar)
   - Container: `.schedule-tier-bar` — `display: flex; gap: 2px; height: 8px; border-radius: var(--radius-chip); overflow: hidden; margin: var(--space-lg) 0;`
   - Three segments, widths proportional to match counts:
     - Green segment (`background: var(--color-positive-primary)`) — auto-confirmed matches
     - Blue segment (`background: var(--color-accent-primary)`) — needs-accept matches
     - Orange segment (`background: var(--color-warning-primary)`) — needs-negotiation matches
   - Below the bar, three inline labels:
     ```
     <div class="schedule-tier-labels">
       <span class="schedule-tier-label tier-confirmed">
         <span class="schedule-tier-dot" style="background: var(--color-positive-primary)"></span>
         12 Scheduled
       </span>
       <span class="schedule-tier-label tier-proposed">
         <span class="schedule-tier-dot" style="background: var(--color-accent-primary)"></span>
         2 Need confirmation
       </span>
       <span class="schedule-tier-label tier-negotiation">
         <span class="schedule-tier-dot" style="background: var(--color-warning-primary)"></span>
         1 Pick a time
       </span>
     </div>
     ```
   - `.schedule-tier-labels` — `display: flex; justify-content: space-between; font-size: var(--font-body-sm); color: var(--color-text-secondary); margin-bottom: var(--space-xl);`
   - `.schedule-tier-dot` — `display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: var(--space-xs); vertical-align: middle;`

3. **Next-match card** (the most immediately actionable item)
   - Container: `.card` with `.match-card.sched-confirmed` border treatment (green `border-left: 4px solid var(--color-positive-primary)`)
   - Eyebrow: "NEXT MATCH" in `.match-card-eyebrow` — `color: var(--color-positive-primary); text-transform: uppercase; letter-spacing: 0.06em; font-size: var(--font-body-sm);`
   - Match row: opponent name (left-aligned, `--font-body-lg`, `--weight-semibold`) and time (right-aligned, `font-variant-numeric: tabular-nums`, `--font-body-md`).
     ```
     vs Alex Rivera          Sat Mar 21, 10:00 AM
     ```
   - Below the match row: "Both free Saturday mornings" — `font-size: var(--font-body-sm); color: var(--color-text-muted);` (the "why this time?" explanation, shown inline for the next match).

#### Below-the-Fold Content

4. **Week-by-week agenda** (scrollable, shows 3 weeks)
   - Section header: "Your Schedule" — `font-size: var(--font-title-sm); font-weight: var(--weight-semibold); margin-bottom: var(--space-md);`
   - Each week is a group:
     ```
     <div class="schedule-week">
       <div class="schedule-week-header">Week of Mar 17</div>
       <!-- match cards -->
     </div>
     ```
   - `.schedule-week-header` — `font-size: var(--font-body-sm); font-weight: var(--weight-semibold); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-divider); margin-bottom: var(--space-sm);`
   - Match cards within each week use the existing `.match-card` component with tier-specific border stripes:
     - **Auto-confirmed:** `border-left: 4px solid var(--color-positive-primary)`. Eyebrow: "SCHEDULED". Shows date + time in tabular-nums. No action button.
     - **Needs-accept:** `border-left: 4px solid var(--color-accent-primary)`. Eyebrow: "SUGGESTED TIME". Shows proposed date + time. Action button: "Confirm" (`.match-card-action-btn` with blue variant: `background: var(--color-accent-bg); color: var(--color-accent-primary);`). Tapping confirms the match, promoting it to green.
     - **Needs-negotiation:** `border-left: 4px solid var(--color-warning-primary)`. Eyebrow: "PICK A TIME". Shows opponent name, no time. Action button: "Find a time" (`.match-card-action-btn` with orange variant: `background: var(--color-warning-bg); color: var(--color-warning-primary);`). Tapping opens the existing `MatchSchedulePanel`.

5. **"View Full Bracket" button** — `btn btn-large` (secondary style, not primary). Centered at bottom. Navigates to the standard bracket view.

#### Animation

- On mount, the hero number counts up from 0 to the actual value over 600ms (use `requestAnimationFrame` + easing). The tier bar segments grow from 0% to their actual widths in sync.
- Match cards stagger in from below: each card delays 50ms after the previous (`animation-delay: calc(var(--card-index) * 50ms)`). Use `@keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }`, duration 300ms, ease-out.

---

### 14.3 Scheduling Dashboard (Calendar View)

**Where it lives:** The Bracket tab, after the user has dismissed the "aha moment" summary (or on subsequent visits). This replaces the default bracket grid for round-robin tournaments.

#### Top Summary Strip

- Sticky at top of scroll area (below the nav). Container: `.schedule-summary-strip` — `display: flex; justify-content: space-between; align-items: center; padding: var(--space-md) 20px; background: var(--color-bg-surface); border-bottom: 1px solid var(--color-divider); position: sticky; top: 56px; z-index: 5;`
- Left side: compact stat trio
  ```
  12 Scheduled  ·  2 Pending  ·  1 Unscheduled
  ```
  Each count uses `font-variant-numeric: tabular-nums; font-weight: var(--weight-semibold);` with its tier color. The labels are `--font-body-sm; --color-text-secondary`.
- Right side: toggle between "Calendar" and "Bracket" views — two small chip buttons (`.btn btn-small`), one with `selected` class. Calendar is default for round-robin.

#### Week-by-Week Agenda Structure

Each week renders as a `.schedule-week` section (same component as the aha-moment screen, but now the permanent view).

**Match Card Structure (all tiers):**

```html
<div class="match-card sched-{status} {my-match?}">
  <div class="match-card-eyebrow">{EYEBROW_TEXT}</div>
  <div class="match-card-body">
    <div class="match-card-opponent">vs {opponent name}</div>
    <div class="match-card-time">{formatted date + time OR "No time set"}</div>
  </div>
  <div class="match-card-detail">{why-this-time text}</div>
  <button class="match-card-action-btn">{action label}</button>
</div>
```

**Per-tier rendering:**

| Tier | `sched-` class | Eyebrow | Time display | Detail text | Action button |
|---|---|---|---|---|---|
| Auto-confirmed | `sched-confirmed` | "SCHEDULED" (green) | "Sat Mar 21, 10:00 AM" (tabular-nums, `--color-text-primary`) | Hidden by default. Tapping card reveals: "You're both free Saturday mornings. This was the best fit with your other matches." (`--font-body-sm`, `--color-text-muted`) | "Reschedule" (subtle: `btn-link` style, not a filled button) |
| Needs-accept | `sched-proposed` | "SUGGESTED TIME" (blue) | "Sat Mar 21, 10:00 AM" (tabular-nums, `--color-accent-primary`) | Always visible: "[Opponent] is free then. Tap to confirm or pick another time." (`--font-body-sm`, `--color-text-secondary`) | "Confirm" (blue filled: `background: var(--color-accent-bg); color: var(--color-accent-primary)`) + "Other times" (`btn-link`) |
| Needs-negotiation | `sched-unscheduled` | "PICK A TIME" (orange, using `--color-warning-primary`) | "No time set" (`--color-text-muted`) | Always visible: "Your schedules don't overlap much. Send [opponent] a few options." (`--font-body-sm`, `--color-text-secondary`) | "Find a time" (orange filled: `background: var(--color-warning-bg); color: var(--color-warning-primary)`) |

**"Why this time?" detail** (for confirmed matches):
- Collapsed by default. The card itself is tappable (`cursor: pointer`). On tap, a `.match-card-detail` div slides open below the time display (height animation: 0 -> auto, 200ms ease).
- Content: one sentence explaining the scheduler's reasoning. Examples:
  - "You're both free Saturday mornings. This was the earliest open slot."
  - "You're both free weekday evenings. Wednesday avoids your Monday match with Sam."
- Generated by the bulk scheduler as a `schedulingReason: string` field on each match.

**Completed matches** (after a score is entered):
- Border stripe: `border-left: 4px solid var(--color-positive-primary)` (win) or `border-left: 4px solid var(--color-negative-primary)` (loss).
- Eyebrow: "COMPLETED" in `--color-text-muted`.
- Shows score: "6-3, 7-5" in `font-variant-numeric: tabular-nums; font-weight: var(--weight-semibold);`
- Faded slightly: `opacity: 0.8;`

#### Empty States

- **No matches this week:** "No matches this week. Enjoy the break." (`--font-body-sm`, `--color-text-muted`, centered).
- **All matches completed:** Summary card at top replaces the summary strip. "Tournament Complete" hero with final standing.

---

### 14.4 Waitlist Experience

**When it triggers:** Clustering cannot place a player in any group because they share fewer than 3 two-hour windows with every member of any forming group. The player is waitlisted for the next clustering cycle.

#### Waitlist Screen (replaces normal tournament view for waitlisted players)

Rendered inside the Bracket tab when the player's tournament status is `waitlisted`.

1. **Status card** (`.card` container, no colored border stripe — uses default `--color-divider`)
   - Icon: a clock SVG (24x24), `color: var(--color-text-muted)`, centered.
   - Title: "We're finding you a group" — `font-size: var(--font-title-sm); font-weight: var(--weight-semibold); text-align: center; margin-top: var(--space-md);`
   - Body: "Your schedule didn't overlap enough with this round's groups. We'll match you in the next round." — `font-size: var(--font-body-md); color: var(--color-text-secondary); text-align: center; margin-top: var(--space-sm); line-height: 1.5;`
   - **Next cycle indicator:**
     ```
     <div class="waitlist-next">
       <span class="waitlist-next-label">Next round starts</span>
       <span class="waitlist-next-date">Monday, Mar 23</span>
     </div>
     ```
   - `.waitlist-next` — `background: var(--color-neutral-bg); border-radius: var(--radius-button); padding: var(--space-md) var(--space-lg); display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-lg);`
   - `.waitlist-next-label` — `font-size: var(--font-body-sm); color: var(--color-text-secondary);`
   - `.waitlist-next-date` — `font-size: var(--font-body-md); font-weight: var(--weight-semibold); font-variant-numeric: tabular-nums;`

2. **Availability improvement prompt** (`.card` container with `border-left: 4px solid var(--color-accent-primary)`)
   - Title: "Want to match faster?" — `font-size: var(--font-body-lg); font-weight: var(--weight-semibold);`
   - Body: "Players with flexible schedules get matched 3x faster. Adding just one more time slot could put you in a group." — `font-size: var(--font-body-md); color: var(--color-text-secondary); line-height: 1.5;`
   - Specific suggestion (computed from lobby data): "Most players in {county} are free Saturday mornings." — `font-size: var(--font-body-sm); color: var(--color-accent-primary); font-weight: var(--weight-medium); margin-top: var(--space-sm);`
   - Action button: "Update availability" — `btn btn-primary` (navigates to Profile availability editor).

3. **Notification opt-in** (only if push notifications are not yet granted)
   - Inline row: "Get notified when your group is ready" with a toggle switch or "Enable notifications" `btn-link`.

4. **Find Match fallback** (bridge to the spontaneous-play flow)
   - Card with `border-left: 4px solid var(--color-positive-primary)`:
   - "Play this weekend instead?" — `font-weight: var(--weight-semibold);`
   - "Find a one-off match while you wait for the next tournament round." — `color: var(--color-text-secondary);`
   - Button: "Find a Match" — `btn btn-primary` (navigates to Find Match tab, `onNavigate('playnow')`).

#### Re-engagement

- When the next clustering cycle begins and the player is placed in a group, they receive a push notification (see Section 14.5) and the waitlist screen is replaced by the normal aha-moment flow.
- If the player updates their availability while waitlisted, re-run a lightweight compatibility check immediately. If they now overlap with a forming group, show: "Your updated schedule matches a group. You'll be included in the next round." — green text, `--color-positive-primary`.

---

### 14.5 Notification Patterns

All notifications follow the app's voice: direct, specific, no exclamation marks on bad news. Times always include day-of-week and time in the player's local timezone. Player names are first name only.

#### Push Notifications (via web push / service worker)

| Trigger | Timing | Title | Body |
|---|---|---|---|
| Tournament created & scheduled | Within 1 minute of bracket generation | "Your tournament is ready" | "12 of 15 matches already scheduled. Tap to see your calendar." |
| Needs-accept match assigned | Batched: all needs-accept matches in one notification, sent with the tournament-created notification | "2 matches need your input" | "Alex — Sat 10 AM. Jordan — Tue 6 PM. Tap to confirm or pick other times." |
| Opponent confirms a needs-accept match | Within 30 seconds of confirmation | "Match confirmed" | "vs Alex — Saturday Mar 21, 10:00 AM. See you on the court." |
| Opponent counter-proposes a time | Within 30 seconds | "Alex suggested a new time" | "How about Sunday 9 AM instead? Tap to accept or suggest another." |
| Needs-negotiation reminder (if no action after 48h) | 48 hours after tournament creation | "Still need to schedule" | "You and Jordan haven't picked a time yet. Tap to send some options." |
| Availability conflict detected | Within 5 minutes of the player's availability update | "Schedule conflict" | "Your Saturday 10 AM match with Alex may need rescheduling. Tap to find a new time." |
| Waitlisted — group found | When next clustering cycle places the player | "You're in a group" | "Tournament starts now — 11 of 15 matches already scheduled. Tap to see your calendar." |
| Waitlisted — next cycle reminder | 24 hours before next clustering cycle | "Next round tomorrow" | "A new round of groups forms tomorrow. Update your availability to improve your chances." |
| Match tomorrow reminder | 6:00 PM the day before a confirmed match | "Match tomorrow" | "vs Alex — Saturday Mar 21, 10:00 AM. Good luck." |
| Match result prompt | 2 hours after a confirmed match's scheduled end time | "How'd it go?" | "vs Alex — ready to enter your score? Tap to report." |

#### In-App Notifications (banner at top of screen)

These appear as a `.notification-banner` element: `position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: var(--space-md) 20px; display: flex; align-items: center; gap: var(--space-md);` with tier-specific background:
- Confirmed: `background: var(--color-positive-bg); border-bottom: 1px solid var(--color-positive-primary);`
- Action needed: `background: var(--color-accent-bg); border-bottom: 1px solid var(--color-accent-primary);`
- Warning: `background: var(--color-warning-bg); border-bottom: 1px solid var(--color-warning-primary);`

Auto-dismiss after 5 seconds. Tap anywhere on the banner to navigate to the relevant screen.

| Event | Banner color | Copy |
|---|---|---|
| Opponent confirmed your suggested time | Green (positive) | "Alex confirmed — Sat Mar 21, 10 AM" |
| New counter-proposal | Blue (accent) | "Alex suggested Sun 9 AM instead — tap to respond" |
| Scheduling escalation (day 3) | Orange (warning) | "Match with Jordan auto-assigned to Tue 6 PM — tap for details" |
| Score reported by opponent | Blue (accent) | "Alex reported a score — tap to confirm" |

#### Notification Preferences

Accessible from Profile. Three toggles:
- "Match reminders" (on by default) — day-before and post-match prompts
- "Scheduling updates" (on by default) — confirmations, proposals, conflicts
- "Tournament news" (on by default) — new round, waitlist updates

---

### 14.6 Weekly Cap Preference UI

**Where it lives:** Two locations — (1) the availability step during registration, and (2) the Profile availability editor.

#### During Registration (availability step)

Placed between the availability picker and the "Start Competing" CTA button. Separated from the slot picker by a `1px solid var(--color-divider)` divider with `var(--space-lg)` margin above and below.

**Layout:**

```html
<div class="weekly-cap-picker">
  <div class="weekly-cap-header">
    <span class="weekly-cap-title">Matches per week</span>
    <span class="weekly-cap-hint">We'll spread your matches out</span>
  </div>
  <div class="weekly-cap-options">
    <button class="weekly-cap-option {selected?}">1</button>
    <button class="weekly-cap-option {selected?}">2</button>
    <button class="weekly-cap-option selected">3</button>
  </div>
</div>
```

**Styling:**

- `.weekly-cap-picker` — `padding: 0;`
- `.weekly-cap-header` — `display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-md);`
- `.weekly-cap-title` — `font-size: var(--font-body-md); font-weight: var(--weight-semibold); color: var(--color-text-primary);`
- `.weekly-cap-hint` — `font-size: var(--font-body-sm); color: var(--color-text-muted);`
- `.weekly-cap-options` — `display: flex; gap: var(--space-sm);`
- `.weekly-cap-option` — `flex: 1; height: 48px; border-radius: var(--radius-button); border: 1px solid var(--color-divider); background: var(--color-bg-surface); font-size: var(--font-title-sm); font-weight: var(--weight-bold); font-variant-numeric: tabular-nums; color: var(--color-text-primary); cursor: pointer; transition: all 0.15s;`
- `.weekly-cap-option.selected` — `border-color: var(--color-accent-primary); background: var(--color-accent-bg); color: var(--color-accent-primary);`
- `.weekly-cap-option:active` — `transform: scale(0.97);`

**Default value:** 2 (pre-selected). This is the sweet spot: a 6-player round-robin (15 matches) takes ~2.5 weeks at 2/week vs ~5 weeks at 1/week.

**Contextual hint that updates on selection:**
- Cap = 1: "Tournament takes ~5 weeks" — `--color-text-muted`
- Cap = 2: "Tournament takes ~3 weeks" — `--color-text-muted`
- Cap = 3: "Tournament takes ~2 weeks" — `--color-text-muted`

Rendered as `.weekly-cap-duration` — `font-size: var(--font-body-sm); color: var(--color-text-muted); margin-top: var(--space-sm); text-align: center;`

#### In Profile (availability editor)

When the user taps "Edit" on their availability card in Profile, the weekly cap selector appears below the slot picker, using the same component. The current value is loaded from the player's stored preferences. Saving availability also saves the cap preference.

**Data model addition:** Add `weeklyCap: 1 | 2 | 3` to `PlayerProfile` in `types.ts`. Default: `2`. Stored alongside availability in localStorage and synced to Supabase.

---

## 15. Systems Architecture

### 15.1 Data Flow Diagram

```
 PLAYER DEVICE                         SUPABASE (us-west-2)
 ────────────                          ─────────────────────

 ┌──────────────────┐
 │  Register.tsx     │
 │  (name, county,   │
 │   skill, gender)  │
 └────────┬─────────┘
          │
          ▼
 ┌──────────────────┐     saveAvailability()     ┌─────────────────────┐
 │  Availability     │──── localStorage ────────▶│  AVAILABILITY_KEY    │
 │  Picker           │     (play-tennis-         │  localStorage ONLY   │
 │  (presets/custom)  │      availability)        │  *** NOT SYNCED ***  │
 └────────┬─────────┘                            └─────────────────────┘
          │                                                │
          ▼                                                │
 ┌──────────────────┐     syncLobbyEntry()       ┌────────┴──────────┐
 │  joinLobby()      │────────────────────────▶  │  lobby table       │
 │  store.ts:97      │     localStorage ──┐      │  (player_id,       │
 │                   │◀── dispatchSync() ──┤      │   county, name,    │
 └────────┬─────────┘     SYNC_EVENT      │      │   joined_at)       │
          │                               │      └────────┬──────────┘
          │  6+ players                   │               │
          ▼                               │    Realtime   │
 ┌──────────────────┐                     │   postgres_   │
 │  startTournament  │                    │   changes     │
 │  FromLobby()      │                    │       │       │
 │  store.ts:183     │                    │       ▼       │
 │                   │                    │  refreshLobby  │
 │  ┌──────────────┐│                    │  FromRemote()  │
 │  │ clusterPlayers││  getAvailability() │  sync.ts:211  │
 │  │ ByAvailability││◀── reads from ─────┘               │
 │  │ clustering.ts ││     localStorage                   │
 │  └──────┬───────┘│                                     │
 │         │        │                                     │
 │         ▼        │                                     │
 │  ┌──────────────┐│                                     │
 │  │ createTournamt││                                     │
 │  │ per cluster  ││                                     │
 │  └──────┬───────┘│                                     │
 └─────────┼────────┘                                     │
           │                                              │
           ▼                                              │
 ┌──────────────────┐     syncTournament()       ┌────────┴──────────┐
 │  generateBracket()│────────────────────────▶  │  tournaments table │
 │  store.ts:899     │     (optimistic lock:     │  (id, county,      │
 │                   │      updated_at check)    │   data JSONB)      │
 │  ┌──────────────┐│                            └────────┬──────────┘
 │  │ Round-robin   ││                                     │
 │  │ pairings      ││                            Realtime │
 │  └──────┬───────┘│                            postgres_ │
 │         │        │                            changes   │
 │         ▼        │                                │     │
 │  ┌──────────────┐│                                ▼     │
 │  │ bulkSchedule  ││◀── reads availability    refreshTournaments │
 │  │ Matches()     ││     from localStorage    FromRemote()       │
 │  │ bulkScheduler ││                          sync.ts:233        │
 │  │ .ts           ││                                             │
 │  └──────┬───────┘│                                              │
 │         │        │                                              │
 │  ┌──────┴───────┐│                                              │
 │  │ 3 tiers:     ││                                              │
 │  │ confirmed    ││  saveAndSync() ──▶ localStorage + Supabase   │
 │  │ needsAccept  ││  store.ts:756                                │
 │  │ needsNegot.  ││                                              │
 │  └──────────────┘│                                              │
 └──────────────────┘                                              │
           │                                                       │
           ▼                                                       │
 ┌──────────────────┐     dispatchSync()                           │
 │  Match Display    │◀── SYNC_EVENT ──────────────────────────────┘
 │  (Bracket view,   │     (rally-sync-update)
 │   calendar view)  │
 └──────────────────┘
```

**Key observation:** Availability data is stored ONLY in localStorage (`syncAvailability()` in `sync.ts:184` is a no-op). This means clustering and bulk scheduling run against local-only data. This is the single largest architectural gap for multi-device scheduling.

### 15.2 Tournament Lifecycle State Machine

**Current states** (defined in `types.ts:103`):

```
                       6+ players join lobby
                              │
                              ▼
                    ┌────────────────────┐
                    │      setup         │
                    │                    │
                    │  countdownStartedAt│
                    │  set on creation   │
                    └────────┬───────────┘
                             │
              ┌──────────────┼───────────────┐
              │              │               │
         48h countdown   8 players hit   forceStart
         expires         MAX_PLAYERS     (dev tool)
              │              │               │
              └──────────────┼───────────────┘
                             │
                    generateBracket()
                    bulkScheduleMatches()
                             │
                             ▼
                    ┌────────────────────┐
                    │   in-progress      │
                    │                    │
                    │  matches[].schedule│
                    │  .schedulingTier:  │
                    │   auto |           │
                    │   needs-accept |   │
                    │   needs-negotiation│
                    └────────┬───────────┘
                             │
                    all matches completed
                             │
                             ▼
                    ┌────────────────────┐
                    │    completed       │
                    │                    │
                    │  trophies awarded  │
                    │  ratings updated   │
                    └────────────────────┘
```

**Proposed new states for scheduling tiers:**

```
                    ┌────────────────────┐
                    │      setup         │
                    └────────┬───────────┘
                             │
                    generateBracket()
                             │
                             ▼
                    ┌────────────────────┐
                    │    scheduling      │◄──── NEW STATE
                    │                    │
                    │  bulkScheduleMatches│
                    │  runs, assigns      │
                    │  tiers to matches   │
                    └────────┬───────────┘
                             │
              bulk scheduler returns BulkScheduleResult
                             │
                             ▼
                    ┌────────────────────┐
                    │   in-progress      │
                    │                    │
                    │  Sub-states per    │
                    │  match (tracked on │
                    │  Match.schedule):  │
                    └────────┬───────────┘
                             │
              ┌──────────────┼───────────────┐
              │              │               │
              ▼              ▼               ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ auto         │ │ needs-accept │ │ needs-       │
     │ (confirmed)  │ │ (proposed)   │ │ negotiation  │
     │              │ │              │ │ (unscheduled)│
     │ schedule.    │ │ schedule.    │ │ schedule.    │
     │ status =     │ │ status =     │ │ status =     │
     │ 'confirmed'  │ │ 'proposed'   │ │ 'proposed'/  │
     │              │ │              │ │ 'unscheduled'│
     └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
            │                │               │
            │         player accepts   day 3: escalated
            │                │               │
            │                ▼               ▼
            │         ┌──────────────┐ ┌──────────────┐
            │         │ confirmed    │ │ escalated    │
            │         └──────┬───────┘ └──────┬───────┘
            │                │               │
            │                │          day 4: resolved
            │                │               │
            └────────────────┼───────────────┘
                             │
                    all matches completed
                             │
                             ▼
                    ┌────────────────────┐
                    │    completed       │
                    └────────────────────┘
```

**Rationale for `scheduling` state:** Currently `generateBracket()` (store.ts:899) does bracket creation AND bulk scheduling in a single synchronous pass, then immediately sets `status = 'in-progress'` (store.ts:1070). Adding a `scheduling` state allows the UI to show a "Generating your schedule..." transition screen, and provides a checkpoint if the bulk scheduler needs to become async (e.g., server-side for large groups). Add to `Tournament.status` in `types.ts:103`:

```typescript
status: 'setup' | 'scheduling' | 'in-progress' | 'completed'
```

### 15.3 Sync Strategy

**Current state: Availability is local-only.**

`syncAvailability()` in `sync.ts:184` is an empty function:
```typescript
export function syncAvailability(playerId: string, slots: AvailabilitySlot[]): void {
  // Availability stays local-only
}
```

This means: when Player A sets availability on their phone, Player B's device never sees it. The clustering algorithm in `startTournamentFromLobby()` (store.ts:252-256) calls `getAvailability()` which reads from the initiating device's localStorage only. If Player B triggered tournament creation, they would use whatever availability data they have locally -- which may be stale or empty for other players.

**Proposed sync strategy:**

```
WRITE PATH (Player A updates availability on phone):
  1. saveAvailability() writes to localStorage (immediate, offline-safe)
  2. NEW: syncAvailabilityToRemote() upserts to `availability` table in Supabase
  3. On failure: enqueue('availability', { playerId, slots }) in offline-queue

READ PATH (Player B's device needs Player A's availability):
  1. Supabase Realtime fires postgres_changes on `availability` table
  2. refreshAvailabilityFromRemote() fetches all availability for the county
  3. Merges into localStorage under AVAILABILITY_KEY
  4. dispatchSync() notifies UI components

CONFLICT RESOLUTION:
  - Last-write-wins at the player level (not slot level)
  - Each player owns their own availability; there is no shared-edit conflict
  - Supabase row: (player_id PK, slots JSONB, updated_at timestamptz)
  - When Player A updates on phone, then opens laptop, the phone's write
    propagates via Realtime. If the laptop was offline and also edited,
    flushQueue() fires on reconnect -- last upsert wins.
  - This is acceptable because availability is self-authored: only Player A
    edits Player A's availability. Cross-player conflict is impossible.

SCHEDULE CONFLICT (Player A updates availability AFTER scheduling):
  - Confirmed matches are NOT auto-rescheduled (trust principle from briefing S6)
  - UI shows: "Your availability changed. This match may need rescheduling."
  - Player taps "Reschedule" to enter the negotiation flow
  - The bulk scheduler is NOT re-run globally; only the single match is rescheduled
    via the existing generateMatchSchedule() per-match path (store.ts:440)
```

**Race condition already fixed:** `joinLobby()` (store.ts:107-110) writes to localStorage BEFORE syncing to Supabase, preventing the Realtime refresh callback from overwriting the new entry. The same pattern must be applied to availability writes.

### 15.4 Performance Budget

**Clustering: `clusterPlayersByAvailability()`** (`clustering.ts:126`)

| Input | Operation | Complexity | Concrete cost |
|---|---|---|---|
| N players | Build overlap graph | O(N^2 * S^2) where S = avg slots per player | N=30, S=7: 30*29/2 * 49 = ~21,000 slot comparisons |
| N players | Sort by total overlap | O(N log N) | Negligible |
| N players | Greedy group assignment | O(N * G * K) where G = groups, K = max group size | N=30, G=5, K=8: 1,200 compatibility checks |
| Undersized groups | Post-process merge | O(G^2 * K) | G=5, K=8: 200 operations |

**Total clustering for 30 players: ~22,000 operations. Sub-1ms on any modern device.** Client-side is fine.

**Breakpoint:** At N=200, overlap graph becomes O(200^2 * 49) = ~2M comparisons. Still under 50ms. Move server-side only if N > 500 per county (unlikely for local tennis).

**Bulk Scheduler: `bulkScheduleMatches()`** (`bulkScheduler.ts:179`)

| Input | Operation | Complexity | Concrete cost |
|---|---|---|---|
| M matches, S slots/player, W weeks | Compute candidate slots per match | O(M * S^2 * W) | M=15, S=7, W=3: 15 * 49 * 3 = 2,205 candidates |
| M matches | Sort by fewest candidates | O(M log M) | Negligible |
| M matches | Greedy assignment with backtracking | O(M * C * A) where C = avg candidates, A = assignments to check | Worst case with backtrack depth 2: M=15, C=50, A=15: 11,250 conflict checks |
| Conflict check | Per-check: iterate all assignments | O(A) per check | A=15: 15 comparisons |

**Total bulk scheduling for 6-player round-robin (15 matches): ~15,000 operations. Sub-5ms.** Client-side is fine.

**Backtracking concern:** The `tryAssign()` function (`bulkScheduler.ts:203`) uses recursion with `maxBacktrackDepth = 2`. With 15 matches and depth 2, the worst-case search tree is bounded at 15 * C * 2 nodes. The depth limit (`bulkScheduler.ts:219`) prevents exponential blowup. Matches that cannot be placed are skipped and classified as `needsAccept`.

**Bottlenecks:**

| Bottleneck | Location | Severity | Fix |
|---|---|---|---|
| Availability reads from localStorage during clustering | `store.ts:255`, `getAvailability()` reads per-player | Low: N reads of JSON.parse on same key | Cache the parsed result for the duration of `startTournamentFromLobby()` |
| Linear scan for match lookup in scheduler results | `store.ts:1013`, `t.matches.find(x => x.id === matchId)` in loop | Low: 15 * 15 = 225 comparisons | Convert to Map if M > 50 |
| `saveAndSync()` called per tournament in loop | `store.ts:274-276` | Medium: N sequential HTTP round-trips to Supabase | Batch into single upsert: `client.from('tournaments').upsert(rows[])` |
| `hasConflict()` iterates all assignments | `bulkScheduler.ts:116` | Low for M=15, quadratic growth | For M > 50: index assignments by (player, week, day) |

**What should be client-side vs server-side:**

| Operation | Where | Rationale |
|---|---|---|
| Availability storage/sync | Client + Supabase | Self-authored data, low volume |
| Clustering | Client | O(N^2) is fine for N < 200; no server dependency needed |
| Bulk scheduling | Client | Constraint solver is fast at M=15; needs availability data already in localStorage |
| Tournament creation + sync | Client -> Supabase | Already implemented via `saveAndSync()` |
| Cross-group playoff bracket | Server (future) | Requires coordination across groups on different devices |

### 15.5 Offline Resilience

**Current offline infrastructure:** `offline-queue.ts` provides a localStorage-backed write queue. When Supabase is unreachable, failed writes are enqueued. On next `initSync()` (app startup), `flushQueue()` replays them.

**Behavior by operation when offline:**

| Operation | Offline behavior | Degradation | Blocks? |
|---|---|---|---|
| **Player registration** | Fully local (localStorage profile) | None | No |
| **Save availability** | Writes to localStorage immediately | Invisible to other players until online | No |
| **Join lobby** | Writes to localStorage (`store.ts:110`), Supabase write fails, enqueued (`store.ts:115`) | Player appears in local lobby count; other devices don't see them until queue flushes | No |
| **Trigger tournament creation** | `startTournamentFromLobby()` reads local lobby + local availability. Creates tournament in localStorage. `saveAndSync()` fails, enqueues tournament (`store.ts:767`) | Tournament exists locally, not on Supabase. Other players don't see it. | **Partial block**: other devices are unaware |
| **Generate bracket + bulk schedule** | `generateBracket()` runs entirely from localStorage (`store.ts:1004-1007`). `saveAndSync()` fails, enqueues. | Schedule is computed and stored locally. Opponents on other devices see stale state. | **Partial block**: opponents don't see their schedule |
| **Accept proposal** | `acceptProposal()` updates local tournament. `saveAndSync()` fails, enqueues. Optimistic lock conflict possible on reconnect. | If opponent also acted while offline, `updated_at` check will detect conflict (`sync.ts:57`). The later write loses; `refreshTournamentById()` fetches the winner. | **Conflict risk** on reconnect |
| **Record match score** | Local update + enqueue. Same conflict risk as accept proposal. | Both players recording different scores while offline creates a conflict that must be manually resolved. | **Conflict risk** |
| **Realtime subscriptions** | Channel disconnects. Supabase JS client auto-reconnects with backoff. On reconnect, `initSync()` re-fetches all data for the county. | Stale lobby counts, stale tournament state until reconnect. `SYNC_EVENT` fires on refresh. | No (auto-recovers) |

**Queue strategy for scheduling operations:**

```
Current queue types (offline-queue.ts:8):
  'tournament' | 'lobby_add' | 'lobby_remove' | 'rating'

Proposed additions:
  'availability'     — player availability upsert
  'match_schedule'   — individual match reschedule (not bulk; bulk runs at creation time)

Queue replay order on flushQueue():
  1. availability (needed before tournament creation on remote)
  2. lobby_add / lobby_remove
  3. tournament (includes embedded schedule from bulk scheduler)
  4. rating
  5. match_schedule (post-creation updates)
```

**What degrades gracefully:**
- Registration, availability entry, lobby join -- all work offline with local-first writes
- Viewing existing tournaments and schedules -- cached in localStorage
- The bulk scheduler itself -- pure computation, no network dependency

**What blocks:**
- Multi-device tournament creation -- if Device A creates a tournament offline and Device B does too, both will attempt to upsert different tournaments for the same players. The lobby entries won't be cleaned up on the other device until sync. Result: potential duplicate tournaments.
- Mitigation: On `flushQueue()`, check if the player IDs in a queued tournament creation are still in the lobby. If they've been removed (by another device's tournament), discard the queued tournament.

### 15.6 Database Schema Changes

**Existing tables** (inferred from `sync.ts` and Supabase dashboard):

```sql
-- Current schema (inferred from sync.ts)
lobby (
  player_id    text PRIMARY KEY,
  player_name  text,
  county       text,
  joined_at    timestamptz,
  auth_id      uuid  -- added in Phase 3 (sync.ts:377)
)

tournaments (
  id          text PRIMARY KEY,
  county      text,
  data        jsonb,         -- entire Tournament object serialized
  updated_at  timestamptz    -- used for optimistic locking (sync.ts:57)
)

ratings (
  player_id   text PRIMARY KEY,
  data        jsonb,         -- PlayerRating object
  auth_id     uuid
)

players (
  player_id   text PRIMARY KEY,
  auth_id     uuid,
  player_name text,
  county      text
)
```

**New tables and columns needed:**

```sql
-- NEW TABLE: Player availability (currently localStorage-only)
CREATE TABLE availability (
  player_id    text PRIMARY KEY REFERENCES players(player_id),
  county       text NOT NULL,
  slots        jsonb NOT NULL DEFAULT '[]',   -- AvailabilitySlot[]
  weekly_cap   integer NOT NULL DEFAULT 2,     -- max matches per week (1, 2, or 3)
  updated_at   timestamptz DEFAULT now()
);

-- Enable RLS (open read, owner-write)
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read availability"
  ON availability FOR SELECT USING (true);
CREATE POLICY "Players update own availability"
  ON availability FOR ALL USING (auth.uid()::text = player_id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE availability;

-- NEW TABLE: Cluster metadata (for debugging + analytics)
CREATE TABLE cluster_runs (
  id              text PRIMARY KEY,
  county          text NOT NULL,
  tournament_id   text REFERENCES tournaments(id),
  player_count    integer NOT NULL,
  group_count     integer NOT NULL,
  waitlisted_count integer NOT NULL DEFAULT 0,
  avg_overlap     real,             -- average overlap score across groups
  min_overlap     real,             -- lowest pairwise overlap in any group
  created_at      timestamptz DEFAULT now()
);

-- NEW COLUMNS on tournaments.data JSONB (no schema migration needed;
-- these are fields within the serialized Tournament object):
--
-- Tournament.status: add 'scheduling' to union type
-- Tournament.clusterRunId: text (links to cluster_runs for traceability)
-- Tournament.schedulingSummary: {
--   confirmed: number,
--   needsAccept: number,
--   needsNegotiation: number,
--   scheduledAt: string (ISO timestamp)
-- }

-- NEW COLUMN on lobby table (for pre-tournament scheduling preview):
ALTER TABLE lobby ADD COLUMN IF NOT EXISTS
  availability_slot_count integer DEFAULT 0;
  -- Denormalized count for "scheduling confidence" preview.
  -- Updated whenever availability table changes (via app code on save).
```

**Index additions:**

```sql
CREATE INDEX idx_availability_county ON availability(county);
CREATE INDEX idx_cluster_runs_county ON cluster_runs(county);
CREATE INDEX idx_lobby_county_joined ON lobby(county, joined_at);
```

### 15.7 Realtime Subscription Strategy

**Current subscriptions** (from `sync.ts:198-208`):

```typescript
// Single channel per county, listening to 3 tables:
channel = client.channel(`county-${countyKey}`)
  .on('postgres_changes', { event: '*', table: 'lobby',
       filter: `county=eq.${countyKey}` }, ...)
  .on('postgres_changes', { event: '*', table: 'tournaments',
       filter: `county=eq.${countyKey}` }, ...)
  .on('postgres_changes', { event: '*', table: 'ratings' }, ...)
  .subscribe()
```

**Problems with current approach:**
1. `ratings` has no county filter -- every device receives every rating update globally.
2. No subscription on `availability` -- because availability is local-only (the gap from 15.3).
3. The `*` event wildcard means INSERT, UPDATE, and DELETE all trigger the same full-table refresh. For tournaments, this means every match score update fetches all tournaments for the county.

**Proposed subscription strategy:**

```typescript
// Channel 1: County-scoped lobby + availability (high-frequency during pre-tournament)
const lobbyChannel = client.channel(`lobby-${countyKey}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'lobby',
    filter: `county=eq.${countyKey}`,
  }, handleLobbyChange)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'availability',         // NEW
    filter: `county=eq.${countyKey}`,
  }, handleAvailabilityChange)
  .subscribe()

// Channel 2: Tournament updates (scoped to active tournaments only)
// Subscribe per-tournament when a player is in that tournament.
// Unsubscribe when tournament completes.
function subscribeTournament(tournamentId: string) {
  return client.channel(`tournament-${tournamentId}`)
    .on('postgres_changes', {
      event: 'UPDATE',   // Only updates; inserts handled by lobby channel
      schema: 'public',
      table: 'tournaments',
      filter: `id=eq.${tournamentId}`,
    }, handleTournamentUpdate)
    .subscribe()
}

// Channel 3: Player-scoped ratings (only when viewing profile/leaderboard)
// Lazy subscription -- not on app startup.
function subscribeRatings(countyKey: string) {
  return client.channel(`ratings-${countyKey}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'ratings',
      // Future: add county filter once ratings table has county column
    }, handleRatingsChange)
    .subscribe()
}
```

**Event handlers:**

| Table | Event | Handler | Action |
|---|---|---|---|
| `lobby` | INSERT | `handleLobbyChange` | Add entry to localStorage lobby, `dispatchSync()` |
| `lobby` | DELETE | `handleLobbyChange` | Remove entry from localStorage lobby, `dispatchSync()` |
| `availability` | INSERT/UPDATE | `handleAvailabilityChange` | Upsert player's slots into localStorage `AVAILABILITY_KEY`, `dispatchSync()` |
| `tournaments` | UPDATE | `handleTournamentUpdate` | Fetch full tournament by ID (`refreshTournamentById()`), check `updated_at` for optimistic lock, update localStorage, `dispatchSync()` |

**Race condition prevention (building on the fix referenced in CLAUDE.md):**

1. **Write-before-subscribe pattern:** Already applied in `joinLobby()` (store.ts:107-110). localStorage is written before the Supabase upsert. When the Realtime callback fires (from our own write), the merge in `refreshLobbyFromRemote()` (sync.ts:226-228) preserves local-only entries. Apply this same pattern to availability writes.

2. **Optimistic lock on tournaments:** `saveAndSync()` (store.ts:756) checks `updated_at` via `syncTournament()` (sync.ts:51-58). If another device updated first, `count === 0` triggers a conflict path: fetch remote state, let caller re-read. This prevents two devices from overwriting each other's match scores.

3. **Availability race during tournament creation:** If Device A triggers `startTournamentFromLobby()` while Device B is still syncing availability, Device A may cluster with stale data. Mitigation: before clustering, fetch latest availability from Supabase if online:

```typescript
// Proposed addition to startTournamentFromLobby(), before line 252:
if (getClient()) {
  const { data } = await getClient()!
    .from('availability')
    .select('player_id, slots')
    .in('player_id', allCounty.map(e => e.playerId))
  if (data) {
    for (const row of data) {
      saveAvailability(row.player_id, row.slots)
    }
  }
}
```

4. **Subscription lifecycle:** Unsubscribe from tournament channels when the tournament completes. This prevents accumulating zombie subscriptions for players who have participated in many tournaments. Supabase has a default limit of 100 concurrent channels per client.

**Realtime delivery guarantees:** Supabase Realtime uses PostgreSQL logical replication. Messages are at-least-once delivery. The refresh handlers (`refreshLobbyFromRemote`, `refreshTournamentsFromRemote`) are idempotent -- they fetch the full current state from the table, not incremental diffs. Duplicate deliveries are harmless.

---

## 16. Engineering Implementation

### 16.1 Current State Audit

**What's built:**

| Component | File | Status | Notes |
|---|---|---|---|
| Round-robin generator | `tennis-core.ts:generateRoundRobin()` | Working | Produces correct pairings for 4-8 players |
| Bracket generator | `store.ts:generateBracket()` | Working | Creates tournament with matches, calls bulk scheduler |
| Bulk scheduler | `bulkScheduler.ts` | Partially working | Assigns slots, sets `schedulingTier`, but UI never reads tier data |
| Availability clustering | `clustering.ts` | Partially working | `clusterPlayersByAvailability()` exists but falls back to random grouping when availability data is missing |
| Availability picker | `Register.tsx` | Working | Preset slots + custom picker in registration flow |
| Availability storage | `store.ts:saveAvailability()` | Working (local only) | Saves to localStorage under `AVAILABILITY_KEY`; **not synced to Supabase** |
| Lobby sync | `sync.ts` + `store.ts` | Working | Fixed: localStorage-first write, joiningRef guard, Supabase realtime |
| Tournament sync | `sync.ts:syncTournament()` | Working | Optimistic locking via `updated_at` |
| Offline queue | `offline-queue.ts` | Working | Replays failed writes on reconnect |
| Match scheduling UI | `MatchCard.tsx` | Partial | Shows proposed time, accept/decline buttons; **does not show scheduling tier or confidence** |
| Scheduling tier data | `types.ts:Match.schedule.schedulingTier` | Defined | `'auto' | 'needs-accept' | 'needs-negotiation'` — set by bulk scheduler but never consumed by UI |

**What's missing:**

| Component | Priority | Effort | Depends on |
|---|---|---|---|
| Availability sync to Supabase | P0 | Medium | New `availability` table (Section 15.6) |
| "Aha moment" screen (schedule summary) | P0 | Medium | Scheduling tier data (already set) |
| Scheduling tier badges on match cards | P1 | Small | Tier data (already set) |
| Scheduling confidence preview in lobby | P1 | Medium | Availability sync |
| Calendar/agenda view for scheduled matches | P1 | Large | None (new component) |
| Weekly cap preference | P2 | Small | `PlayerProfile.weeklyCap` field |
| Waitlist experience | P2 | Medium | Clustering producing overflow |
| Cross-group playoff | P3 | Large | Multiple round-robin groups completing |

### 16.2 Known Bugs

**Bug 1: Clustering falls back silently**

Location: `clustering.ts:156-160`
When `getAvailability()` returns empty for most players (common since availability isn't synced), the overlap graph is sparse. The algorithm produces a single group or falls back to random batching. No log or metric is emitted.

Fix: Add a `clusterQuality` metric to the return value. If `minOverlap < 3`, set `quality: 'degraded'` and surface this in the tournament creation flow ("Some matches may need manual scheduling").

**Bug 2: `generateRoundRobin()` produces bye rounds for odd player counts but `bulkScheduleMatches()` doesn't skip byes**

Location: `tennis-core.ts:89`, `bulkScheduler.ts:195`
When a 7-player group is formed, round-robin generates matches including bye placeholders. The bulk scheduler attempts to schedule byes, fails to find a valid slot (no opponent availability), and classifies them as `needs-negotiation`. This inflates the "needs negotiation" count.

Fix: Filter out bye matches before passing to `bulkScheduleMatches()`. Add `match.isBye` check at `bulkScheduler.ts:195`.

**Bug 3: `saveAndSync()` doesn't batch tournament writes**

Location: `store.ts:756-770`
When clustering produces multiple groups (e.g., 18 players → 3 groups of 6), `startTournamentFromLobby()` calls `saveAndSync()` in a loop, producing N sequential HTTP requests to Supabase. Each takes ~200ms.

Fix: Batch into a single `client.from('tournaments').upsert(rows)` call. Requires refactoring `saveAndSync()` to accept an array.

### 16.3 Code Changes Required

**Phase 1 — Availability Sync (unblocks everything else)**

```
Files to modify:
  sync.ts
    - Implement syncAvailabilityToRemote() (currently a no-op at line 184)
    - Add handleAvailabilityChange() callback for Realtime
    - Add refreshAvailabilityFromRemote() to fetch county availability
    - Add 'availability' channel to subscription setup (line 198)

  store.ts
    - Update saveAvailability() to call syncAvailabilityToRemote()
    - Add 'availability' to QueuedWrite union type in offline-queue.ts
    - Add flushQueue handler for 'availability' type

  offline-queue.ts
    - Add 'availability' to QueuedWrite type union (line 8)

New file:
  None — all changes fit within existing files

Supabase migration:
  - CREATE TABLE availability (see Section 15.6)
  - ALTER PUBLICATION supabase_realtime ADD TABLE availability
  - CREATE INDEX idx_availability_county
```

**Phase 2 — Scheduling UI (the "aha moment")**

```
Files to modify:
  Bracket.tsx (or new ScheduleSummary.tsx component)
    - Read schedulingTier from match data
    - Render tier-colored badges (green/blue/orange)
    - Show summary stats: "12 of 15 matches auto-scheduled"

  MatchCard.tsx
    - Add scheduling tier badge
    - Show "Auto-confirmed" / "Needs your OK" / "Needs scheduling" labels
    - Color-code left border by tier (Section 17 specs)

  styles.css
    - Add .scheduling-tier-badge, .match-card--auto, .match-card--needs-accept,
      .match-card--needs-negotiation classes
```

**Phase 3 — Calendar View**

```
New component:
  MatchCalendar.tsx
    - Week-by-week agenda view
    - Groups matches by week
    - Shows day, time, opponent, venue (if available)
    - Highlights "this week" matches
    - Compact mode for the "aha moment" screen

Files to modify:
  Bracket.tsx
    - Add toggle: "List view" / "Calendar view"
    - Import and render MatchCalendar

  styles.css
    - Add .match-calendar, .calendar-week, .calendar-day,
      .calendar-match classes
```

**Phase 4 — Lobby Enhancements**

```
Files to modify:
  Lobby.tsx
    - Add "scheduling confidence" preview
    - Show availability overlap indicator when 4+ players have synced availability
    - Display: "High scheduling confidence" / "Medium" / "Need more availability data"

  store.ts
    - Add getSchedulingConfidence(county): computes pairwise overlap for current
      lobby members using synced availability data
    - Returns { score: 0-100, label: 'high' | 'medium' | 'low' }
```

### 16.4 Integration Sequence (PR order)

```
PR 1: Availability sync infrastructure
  - availability table in Supabase
  - syncAvailabilityToRemote() implementation
  - Realtime subscription for availability
  - offline-queue support
  Tests: availability round-trips through Supabase, offline queue replays

PR 2: Scheduling tier UI
  - ScheduleSummary component (the "aha moment")
  - Tier badges on MatchCard
  - Updated styles
  Tests: renders correct tier counts, badges show correct colors

PR 3: Calendar view
  - MatchCalendar component
  - List/Calendar toggle in Bracket
  Tests: renders weeks correctly, handles empty weeks

PR 4: Lobby scheduling confidence
  - getSchedulingConfidence() in store
  - Confidence indicator in Lobby.tsx
  Tests: correct confidence levels for various overlap scenarios

PR 5: Weekly cap preference
  - weeklyCap field in PlayerProfile
  - Cap selector in Register.tsx and Profile.tsx
  - Bulk scheduler respects cap
  Tests: scheduler doesn't exceed weekly cap

PR 6: Clustering improvements
  - clusterQuality metric
  - Degraded quality warning in UI
  - Bug fix: skip bye matches in bulk scheduler
  Tests: clustering with sparse availability, bye match handling

PR 7: Waitlist experience
  - Waitlist state for overflow players
  - Waitlist card UI
  - Auto-promotion when spots open
  Tests: waitlist ordering, promotion logic

PR 8: Batch tournament sync
  - Refactor saveAndSync() for array support
  - Batch upsert for multi-group creation
  Tests: 3 tournaments created in single HTTP call
```

### 16.5 Error Handling Matrix

| Scenario | Detection | User-facing behavior | Recovery |
|---|---|---|---|
| Supabase unavailable during availability sync | `syncAvailabilityToRemote()` returns `{ success: false }` | Silent — availability saved locally, syncs later | `enqueue('availability', ...)`, replayed on reconnect |
| Availability stale during clustering | `clusterQuality === 'degraded'` | "Some matches may need manual scheduling" banner | Player can update availability; matches auto-reschedule on change |
| Bulk scheduler can't place a match | `schedulingTier === 'needs-negotiation'` | Match card shows orange "Needs scheduling" badge | Player sees chat/propose flow for that match |
| Two devices create tournament simultaneously | `saveAndSync()` optimistic lock fails (count === 0) | "Tournament already created" — redirects to existing tournament | `refreshTournamentById()` fetches the winning write |
| Player updates availability after scheduling | Change detected in `handleAvailabilityChange` | Affected confirmed matches show "Availability changed" warning | Player taps "Reschedule" for specific match |
| Offline for >24 hours, queue has stale writes | `flushQueue()` runs on reconnect; lobby entries may be removed by another device's tournament | Queue items silently dropped if lobby state has moved past them | Full state refresh from Supabase after flush |

---

## 17. UI Component Specifications

### 17.1 Design System Integration — Polymarket Indoor-Inspired

All scheduling UI components follow the established Polymarket indoor-inspired design system. Key principles:

- **Data-forward:** Numbers and status are the primary visual elements, not decorative chrome
- **Monospace numerals:** All counts, percentages, and timers use `font-variant-numeric: tabular-nums; font-family: var(--font-mono)`
- **Color-coded left borders:** Cards use a 3px left border to indicate status tier:
  - `var(--color-positive-primary)` (green): auto-confirmed / high confidence
  - `var(--color-accent-primary)` (blue): needs-accept / medium confidence
  - `var(--color-warning)` (orange): needs-negotiation / low confidence
- **Clean typography hierarchy:** Section headers use `var(--font-heading)`, body uses `var(--font-body)`, data labels use `var(--font-body-sm)` in `var(--color-text-muted)`
- **Minimal borders:** Cards use `background: var(--color-surface); border-radius: var(--radius-md); box-shadow: var(--shadow-sm)` — no visible border except the status left-border

### 17.2 Schedule Summary Card (The "Aha Moment")

Appears at the top of the Bracket view when a tournament transitions to `in-progress`.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Your matches are scheduled!                │  ← .schedule-summary-title
│                                             │     font: var(--font-heading)
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │   12    │ │    2    │ │    1    │       │  ← .tier-stat-value
│  │confirmed│ │ pending │ │  needs  │       │     font-variant-numeric: tabular-nums
│  │         │ │         │ │ schedul.│       │     font-size: 2rem; font-weight: 700
│  └─────────┘ └─────────┘ └─────────┘       │
│   ■ green     ■ blue      ■ orange          │  ← .tier-stat-label
│                                             │     color: var(--color-text-muted)
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │  ← .schedule-progress
│  ████████████████████████████░░░░           │     80% green, 13% blue, 7% orange
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                             │
│  Next match: Sat, Mar 21 at 10:00 AM        │  ← .schedule-next-match
│  vs. James O'Brien                          │     font-weight: 600
│                                             │
└─────────────────────────────────────────────┘
```

**CSS classes:**

```css
.schedule-summary {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  margin-bottom: var(--space-md);
  box-shadow: var(--shadow-sm);
}

.schedule-summary-title {
  font-size: var(--font-heading);
  font-weight: 700;
  margin-bottom: var(--space-md);
}

.tier-stats {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  margin-bottom: var(--space-md);
}

.tier-stat {
  text-align: center;
  min-width: 80px;
}

.tier-stat-value {
  font-size: 2rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  font-family: var(--font-mono);
  line-height: 1;
}

.tier-stat-value--auto { color: var(--color-positive-primary); }
.tier-stat-value--accept { color: var(--color-accent-primary); }
.tier-stat-value--negotiate { color: var(--color-warning); }

.tier-stat-label {
  font-size: var(--font-body-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
}

.schedule-progress {
  height: 6px;
  border-radius: 3px;
  background: var(--color-border);
  overflow: hidden;
  display: flex;
}

.schedule-progress-segment {
  height: 100%;
  transition: width 0.6s ease;
}

.schedule-next-match {
  margin-top: var(--space-md);
  font-size: var(--font-body);
  color: var(--color-text-secondary);
}

.schedule-next-match strong {
  font-weight: 600;
  color: var(--color-text-primary);
}
```

### 17.3 Match Calendar View

Week-by-week agenda replacing or augmenting the current match list.

```
┌─────────────────────────────────────────────┐
│                                             │
│  ● This Week                                │  ← .calendar-week-header
│                                             │     (● = green dot for current week)
│  ┌──┬──────────────────────────────────────┐│
│  │▌ │ Sat, Mar 21 · 10:00 AM              ││  ← .calendar-match
│  │▌ │ vs. James O'Brien                   ││     left-border: green (auto)
│  │▌ │ Auto-confirmed                      ││     .calendar-match-status
│  └──┴──────────────────────────────────────┘│
│                                             │
│  ┌──┬──────────────────────────────────────┐│
│  │▌ │ Sun, Mar 22 · 2:00 PM               ││
│  │▌ │ vs. Sarah Mitchell                  ││  ← left-border: blue (needs-accept)
│  │▌ │ Tap to confirm                      ││     .calendar-match-action
│  └──┴──────────────────────────────────────┘│
│                                             │
│  ○ Week of Mar 28                           │  ← .calendar-week-header--future
│                                             │     (○ = hollow dot for future week)
│  ┌──┬──────────────────────────────────────┐│
│  │▌ │ Wed, Apr 1 · 7:00 PM                ││
│  │▌ │ vs. Tom Burke                       ││  ← left-border: green
│  │▌ │ Auto-confirmed                      ││
│  └──┴──────────────────────────────────────┘│
│                                             │
│  ┌──┬──────────────────────────────────────┐│
│  │▌ │ Needs scheduling                     ││
│  │▌ │ vs. Pat Donnelly                    ││  ← left-border: orange
│  │▌ │ Tap to propose a time               ││     (needs-negotiation)
│  └──┴──────────────────────────────────────┘│
│                                             │
└─────────────────────────────────────────────┘
```

**CSS classes:**

```css
.match-calendar {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.calendar-week-header {
  font-size: var(--font-body-sm);
  font-weight: 600;
  color: var(--color-text-secondary);
  padding: var(--space-sm) 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.calendar-week-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.calendar-week-dot--current {
  background: var(--color-positive-primary);
}

.calendar-week-dot--future {
  border: 2px solid var(--color-text-muted);
  background: transparent;
}

.calendar-match {
  background: var(--color-surface);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  box-shadow: var(--shadow-sm);
  border-left: 3px solid transparent;
}

.calendar-match--auto {
  border-left-color: var(--color-positive-primary);
}

.calendar-match--needs-accept {
  border-left-color: var(--color-accent-primary);
}

.calendar-match--needs-negotiation {
  border-left-color: var(--color-warning);
}

.calendar-match-time {
  font-size: var(--font-body-sm);
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.calendar-match-opponent {
  font-size: var(--font-body);
  font-weight: 600;
  color: var(--color-text-primary);
}

.calendar-match-status {
  font-size: var(--font-body-sm);
  margin-top: var(--space-xxs);
}

.calendar-match-status--auto {
  color: var(--color-positive-primary);
}

.calendar-match-status--accept {
  color: var(--color-accent-primary);
}

.calendar-match-status--negotiate {
  color: var(--color-warning);
}
```

### 17.4 Matchable Players Preview (Lobby)

Shows scheduling confidence while players are still gathering in the lobby.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Scheduling confidence                      │  ← .confidence-header
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  ████████████████████████████████           │  ← 82% fill, green
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                             │
│   82%                                       │  ← .confidence-value (tabular-nums)
│   High — most matches can be auto-scheduled │  ← .confidence-label
│                                             │
│  Based on 5 players' availability           │  ← .confidence-footnote
│                                             │
└─────────────────────────────────────────────┘
```

**Confidence thresholds:**

| Score | Label | Color | Meaning |
|---|---|---|---|
| 70-100% | High | `var(--color-positive-primary)` | 3+ shared 2hr windows across most pairs |
| 40-69% | Medium | `var(--color-accent-primary)` | Some pairs have limited overlap |
| 0-39% | Low | `var(--color-warning)` | Many pairs have no overlap; some matches will need negotiation |

### 17.5 Weekly Cap Selector

Used in registration flow and Profile availability editor.

```
┌─────────────────────────────────────────────┐
│                                             │
│  Matches per week                           │  ← .weekly-cap-label
│                                             │
│  ┌───────┐  ┌───────┐  ┌───────┐           │
│  │       │  │       │  │       │           │
│  │   1   │  │   2   │  │   3   │           │  ← .weekly-cap-option
│  │       │  │ (sel) │  │       │           │     selected: --color-accent-primary bg
│  └───────┘  └───────┘  └───────┘           │     font-variant-numeric: tabular-nums
│                                             │
│  Tournament takes ~3 weeks                  │  ← .weekly-cap-duration
│                                             │     updates on selection
└─────────────────────────────────────────────┘
```

### 17.6 Waitlist Card

Shown when a player doesn't fit into the initial clustering.

```
┌──┬──────────────────────────────────────────┐
│▌ │                                          │  ← left-border: var(--color-text-muted)
│▌ │  You're on the waitlist                  │     (gray — neutral status)
│▌ │                                          │
│▌ │  Position: 2nd                           │  ← .waitlist-position (tabular-nums)
│▌ │                                          │
│▌ │  When a spot opens or 6 more players     │
│▌ │  join, a new group will form.            │  ← .waitlist-explanation
│▌ │                                          │
│▌ │  We'll notify you.                       │
│▌ │                                          │
└──┴──────────────────────────────────────────┘
```

### 17.7 Scheduling Tier Badges

Inline badges used on match cards and in the calendar view.

```
Auto-confirmed:    [  ✓ Confirmed  ]     background: var(--color-positive-bg)
                                          color: var(--color-positive-primary)
                                          border-radius: var(--radius-sm)

Needs accept:      [  ● Pending    ]     background: var(--color-accent-bg)
                                          color: var(--color-accent-primary)

Needs negotiation: [  ○ Unscheduled]     background: var(--color-warning-bg)
                                          color: var(--color-warning)
```

**CSS:**

```css
.scheduling-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xxs);
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-body-sm);
  font-weight: 600;
  white-space: nowrap;
}

.scheduling-badge--auto {
  background: var(--color-positive-bg);
  color: var(--color-positive-primary);
}

.scheduling-badge--accept {
  background: var(--color-accent-bg);
  color: var(--color-accent-primary);
}

.scheduling-badge--negotiate {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.scheduling-badge-icon {
  font-size: 0.75em;
}
```

---

## 18. Summary & Next Steps

This briefing covers the complete scheduling and grouping system across 17 sections:

- **Sections 1-13:** Original briefing — problem, vision, algorithms, edge cases, implementation phases
- **Section 14:** UX specification — detailed screen and interaction specs from UX expert analysis
- **Section 15:** Systems architecture — data flow, state machine, sync strategy, performance, database schema
- **Section 16:** Engineering implementation — current state audit, known bugs, code changes, PR sequence
- **Section 17:** UI component specifications — Polymarket indoor-inspired mockups and CSS for all scheduling components

**Critical path:**
1. PR 1 (Availability sync) unblocks everything else
2. PR 2 (Scheduling tier UI) delivers the "aha moment" — the single highest-impact UX improvement
3. PR 3 (Calendar view) completes the player-facing experience

**Architectural decisions locked in:**
- Client-side clustering and scheduling (performance budget confirms sub-5ms for target group sizes)
- localStorage-first writes with Supabase sync (proven pattern from lobby fix)
- Three scheduling tiers already set in data — UI just needs to read them
- `scheduling` intermediate state added to tournament lifecycle
