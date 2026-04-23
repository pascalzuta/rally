# Home Tab Redesign Plan

## Goal
Home = glance + next action. Bracket = canonical match list. Remove duplicate match cards from Home. Add tab badges and a "Needs You" summary row so users discover pending work on other tabs without re-rendering it on Home.

## Core principle
**Summary vs. substance.** Home tells you something needs doing and where. Bracket/Messages is where you do it.

## State matrix

**Note:** `HomeHeroCard` keeps its 8 internal states (`new`, `returning`, `joined-needs-availability`, `joined-ready`, `countdown-needs-availability`, `countdown-ready`, `active-needs-availability`, `active`) unchanged. This matrix controls which **supporting surfaces** render below the hero.

| Meta-state | Covers hero states | Up Next card | Needs You block | Leaderboard | Activation checklist |
|---|---|---|---|---|---|
| new / returning | `new`, `returning` | hidden | hidden* | shown | shown |
| in-lobby | `joined-*`, `countdown-*` | hidden | hidden* | shown | shown |
| tournament-forming | `active-needs-availability` | hidden | shown if count>0 | shown | hidden |
| active | `active` | shown (primary) | shown if count>0 (below Up Next) | shown | hidden |

**\* Override rule (critical):** A pending score-confirmation ALWAYS surfaces Needs You, regardless of meta-state. A player can finish a tournament and still have a 48h score-dispute window — that must not be hidden.

## Primary CTA per state
- **new** → "Join {County} lobby"
- **in-lobby** → "Invite a friend"
- **tournament-forming** → "Confirm availability"
- **active** → tap Up Next card

## What to remove from Home
- `actionCards` array and its render block (lines ~330-407 of Home.tsx)
- `messageCards` array and its render block
- `pendingFeedback` inline card (moves to Bracket)
- Match Offers summary card (moves to Find Match tab where it belongs)

## What stays on Home
- `HomeHeroCard` (the 8-state hero — unchanged)
- `FriendTournamentSection`
- Up Next card (single `MatchActionCard` for the one confirmed-next match)
- Leaderboard teaser
- "View full bracket →" link
- Sign out

## What's new on Home

### Needs You block (below Up Next, above leaderboard)
Data-forward row style. Hidden when empty. No card chrome, one 2px left accent border.

```
NEEDS YOU
──────────────────────────────────────
1  score to confirm · 4h left   →  Bracket    ← orange when urgent
2  matches need a time          →  Bracket
1  proposed time to accept      →  Bracket
3  unread messages              →  Messages
```

**Rules:**
- Monospace tabular-nums count column (2-char wide, left-aligned)
- One tap routes via URL (`navigate('/bracket?section=pending&focus=score-confirm')`) — react-router already owns tab routing
- Hide the whole block when empty — no "all caught up" sizzle
- Row ordering: score confirmations (48h expiring) → unscheduled matches → needs-accept → unread messages
- Left accent color of the block follows most-urgent row: **orange** if any score confirmation `< 6h` from expiry, **blue** otherwise
- Position: always below Up Next (decision locked — Option A)
- **Override:** pending score-confirmation rows render even when state matrix says "hidden" — never swallow a time-sensitive dispute window

### Score-confirmation urgency banner (defense in depth)
When `expiresAt - now < 6h` for any pending score-confirm:
- One-line orange strip directly above Up Next (or above activation if no Up Next)
- Copy: `"Confirm score vs {name} — {N}h left"` + tap → Bracket
- This is intentionally redundant with the Needs You row. High-stakes, time-sensitive. Defense in depth.

### Tab badges (bottom nav)
- **Bracket badge:** count of `needs-accept` + score-confirmations pending + unscheduled matches for current player
- **Messages top icon:** unread count (existing convention)
- **Notifications top icon:** unread count
- Dots for presence, numbers when count ≤ 99
- `aria-label="Bracket, 2 actions needed"`

## Interaction states

| Surface | Loading | Empty | Error | Partial |
|---|---|---|---|---|
| Activation card | Skeleton 4 rows | n/a | Show cached | Show completed count |
| Lobby status | "Checking..." | "Be the first in {County}" | "Can't reach lobby. Retry" | Stale timestamp badge |
| Up Next card | Skeleton card | Hidden (state matrix) | "Match data unavailable" | "Time pending" chip |
| Needs You block | Hidden during initial load | Hidden (whole block) | Hidden silently | Show partial, badge with "?" |
| Leaderboard teaser | 3 skeleton rows | "You'll appear after 1 match" | Hide silently | Show with "Updating..." |

## Responsive & a11y
- Mobile-first, single column, 16px side padding, max-width 560px centered on tablet+
- Activation steps as `<ol>` with `aria-current="step"` on next incomplete step
- Countdown uses `aria-live="polite"` updating every 10s (not 1s)
- Tap targets min 44×44px
- Color-coded borders always paired with text/icon label (colorblind safety)

## Design system compliance
- All new components use existing tokens: `var(--color-surface)`, `var(--radius-md)`, `var(--shadow-sm)`
- Tabular-nums monospace for all counts
- Color-coded left borders: green (auto/confirmed), blue (needs-accept/info), orange (needs-negotiation/urgent)
- No new vocabulary — Needs You row style follows existing data-forward patterns

## Data needs

**Shape as a React hook, not a store function** — lets it subscribe to reactive inputs cleanly and memoize for both Home and TabBar consumers:

```ts
// apps/play-tennis/src/hooks/usePendingActions.ts
function usePendingActions(playerId: string): PendingActions {
  const { tournaments } = useRallyData()
  // memo dependencies: tournaments, playerId, message signature, pendingFeedback
  return useMemo(() => ({
    needsScheduling: number,          // matches with no schedule and I'm a player
    needsAccept: number,              // schedule.status === 'proposed' && proposedBy !== me
    scoreConfirmPending: Array<{      // derived from matches where scoreReportedBy !== me
      opponentName: string              // and !match.completed
      expiresAt: string                // ISO (scoreReportedAt + 48h)
      msRemaining: number
      matchId: string
      tournamentId: string
      urgent: boolean                  // msRemaining < 6h
    }>,
    unreadMessages: number,           // uses getUnreadMessageCount, NOT getConversationList
    totalBadgeCount: number,          // sum for tab badge
  }), [...])
}
```

**Perf rules:**
- Use `getUnreadMessageCount(playerId)` for counts (single filter), NOT `getConversationList` (grouping + sort)
- Hook consumes `useRallyData()` internally — clean memo boundary, not passed as prop
- No new DB tables. No new sync logic. All inputs already reactive.

**IMPORTANT — score-confirm source clarification:**
`getPendingFeedback()` is for the *reporter's* post-match reliability feedback form (a different flow). The "score to confirm" we care about is derived from `Match.scoreReportedBy && scoreReportedBy !== playerId && !completed && scoreReportedAt` with expiry at `scoreReportedAt + 48h`. Classification delegated to `getMatchCardView` which returns `key === 'confirm-score'` for this case — the hook just adds the expiry math.

## New user journey (first 90s)
1. Lands post-registration → "Welcome, {name}. You're in Surrey." + activation checklist 2/4
2. Scans → sees next step in bold
3. Taps "Join lobby" → "You're in. 3 more players needed." + invite CTA
4. Next day → "5 of 6 joined. 1 more to start."
5. Tournament forms → "Confirm availability →" (Needs You block appears)
6. Active → Up Next + Needs You

## Files touched
- `apps/play-tennis/src/hooks/usePendingActions.ts` — NEW (the memoized derivation)
- `apps/play-tennis/src/hooks/usePendingActions.test.ts` — NEW (regression tests, see Test plan)
- `apps/play-tennis/src/components/NeedsYouBlock.tsx` — NEW (the UI block)
- `apps/play-tennis/src/components/ScoreConfirmBanner.tsx` — NEW (urgency banner)
- `apps/play-tennis/src/components/Home.tsx` — remove dead code, wire new components
- `apps/play-tennis/src/App.tsx` — tab badge on Bracket button (lines ~596)
- `apps/play-tennis/src/components/BracketTab.tsx` — scroll anchor + `useSearchParams` handler for `?section=pending`

**Dead code to remove from `Home.tsx`:**
- `buildHomeMatchCards` fn and callers (lines 55-77)
- `buildMessageCards` fn and callers (lines 79-110)
- `matchCards`, `messageCards`, `actionCards` memos (lines 171-220)
- The rendered action-cards block (lines 330-407)
- Inline `pendingFeedback` card render (lines 409-450)
- Match offers summary card (lines 311-328)
- `expandedCardKey`/`messagingCardKey` state if nothing else consumes them
- Module-level `pinnedUpNextKey` — move into new `UpNextCard.tsx` if extracted, or keep as-is only if Up Next stays inline in Home.tsx

## Test plan (required, not deferred)

### Critical regression tests (iron rule)
`apps/play-tennis/src/hooks/usePendingActions.test.ts`:
1. **Returns score-confirm entry when `getPendingFeedback()` is non-null** — proves score-confirm surfaces post-refactor
2. **Flags `urgent: true` when `expiresAt - now < 6h`** — proves urgency banner trigger works
3. **Score-confirm surfaces regardless of tournament meta-state** — the override rule

### Coverage (0/19 paths → target 19/19)
- `needsScheduling`: zero matches, only completed, multiple unscheduled, player not in tournament
- `needsAccept`: proposed by other, proposed by me (NOT counted), already accepted (NOT counted)
- `scoreConfirmPending`: non-null, urgent flag, null case, unknown opponent lookup
- `unreadMessages`: uses `getUnreadMessageCount` (verify by mock), returns 0 when none
- State matrix render (component test):
  - new + no pending → activation only, no Needs You, no banner
  - new + score to confirm → Needs You visible (override), banner if urgent
  - active + Up Next + 2 pending → correct order (Up Next above, Needs You below)
  - active + no pending → Up Next shown, Needs You hidden
- Deep-link (E2E): `?section=pending` scrolls Bracket, clears param on mount
- Tab badge: sum correct, hidden at 0, shows "99+" beyond 99

### User flow coverage
- Home → tap Needs You row → Bracket scrolls to pending section (E2E)
- Score expires in 5h → banner visible → tap → confirm flow completes
- Tournament ends → score still pending → banner stays visible until confirmed or expired

## Out of scope
- Redesigning Bracket itself (only add scroll anchor for pending section)
- Changing Messages tab UI
- Changing Play Now / Availability tabs
- Push notifications (tracked separately)

## Design scores
- Info Architecture: 9/10
- Interaction states: 8/10
- Journey: 9/10
- AI slop risk: 9/10
- Design system: 9/10
- Responsive/a11y: 8/10
- **Overall: 9/10**

## Eng review resolutions (locked)
- **Derivation shape:** React hook `usePendingActions(playerId)`, consumes `useRallyData()` internally. Memoized on tournaments + playerId + message signature + pendingFeedback. [resolved]
- **Tab badge perf:** Single hook instance wraps the top-level layout. Uses `getUnreadMessageCount` (single filter), not `getConversationList` (grouping + sort). [resolved]
- **Deep-link routing:** URL-based via `useSearchParams`. React-router already owns tab routes. BracketTab clears `?section` param on mount after scroll. [resolved, Layer 1]
- **Score-confirmation 48h regression:** Addressed with 4-layer defense:
  1. Override rule: score-confirm row always in Needs You regardless of state
  2. Time-remaining chip on the row (`4h left`)
  3. Separate orange banner above Up Next when `< 6h`
  4. Tab badge on Bracket always counts pending confirmations
- **State matrix correctness:** HeroCard's 8 internal states unchanged. Matrix only controls supporting surfaces. `returning` state treated same as `new` (activation checklist shown).

## Parallelization lanes
- **Lane A (sequential chain):** `usePendingActions` + tests → `NeedsYouBlock` + `ScoreConfirmBanner` → Home.tsx integration
- **Lane B (parallel):** Tab badge on Bracket (`App.tsx`)
- **Lane C (parallel):** BracketTab scroll anchor + `useSearchParams` handler

Launch B and C in parallel with A. Merge all, then smoke test.
