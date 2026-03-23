# Reschedule Implementation Plan

## Objective

Implement the revised confirmed-match rescheduling model for the `play-tennis` app:

- **soft reschedule**: ask to move a confirmed match while keeping the original slot active
- **hard reschedule**: explicitly cancel the original confirmed slot because the requester cannot make it

This plan is intentionally implementation-facing. It maps the product spec in `reschedule-state-model.md` onto the current codebase and keeps the scope as small as possible.

## Why this shape

The current prototype clears `confirmedSlot` and pushes the match back into `proposed` immediately. That is too destructive for soft changes, but a hard conflict does need to break the current slot.

So the right code shape is:

- soft requests stay layered on top of `schedule.status = 'confirmed'`
- hard requests reuse the existing `proposed` / `unscheduled` scheduling states after the slot is explicitly released

That lets us preserve trust for normal changes without inventing a second scheduling engine.

## Scope Decision

### Build in this step

- both soft and hard reschedule intents
- one active reschedule request per match
- accept / keep current / suggest another / withdraw
- history label for accepted changes
- minimal notifications
- primary UI updates in match card flows and action surfaces

### Do not build in this step

- separate timer rules for rescheduling
- reason-specific exception logic
- new admin controls
- calendar sync
- threaded negotiation UI
- automatic tournament-wide reshuffling

## Code Reality Check

The main implementation constraints in the current app are:

- `MatchSchedule` currently has no nested reschedule object
- `rescheduleMatch()` in `store.ts` is destructive
- several screens infer "scheduled" from `schedule.status === 'confirmed' && confirmedSlot`
- `MatchSchedulePanel.tsx` owns the current confirmed-match UI and is the right primary entry point

The main impacted files are:

- `apps/play-tennis/src/types.ts`
- `apps/play-tennis/src/store.ts`
- `apps/play-tennis/src/components/MatchSchedulePanel.tsx`
- `apps/play-tennis/src/components/Home.tsx`
- `apps/play-tennis/src/components/TournamentView.tsx`
- `apps/play-tennis/src/components/BracketTab.tsx`
- `apps/play-tennis/src/App.tsx`
- `apps/play-tennis/src/components/Inbox.tsx`

## Phase 1: Data Model

### File

- `apps/play-tennis/src/types.ts`

### Changes

1. Add a reusable slot type instead of duplicating `{ day, startHour, endHour }`.

Suggested shape:

```ts
export interface MatchSlot {
  day: DayOfWeek
  startHour: number
  endHour: number
}
```

2. Add reschedule types:

- `RescheduleIntent = 'soft' | 'hard'`
- `RescheduleReason`
- `RescheduleRequestStatus`
- `RescheduleRequest`
- `ScheduleHistoryEntry`

3. Extend `MatchSchedule`:

- `activeRescheduleRequest?: RescheduleRequest`
- `scheduleHistory?: ScheduleHistoryEntry[]`
- keep `rescheduleCount?: number`

4. Keep `confirmedSlot: MatchSlot | null`.

This is important because hard reschedules should explicitly clear it.

### Reasoning

Do not add a new top-level `SchedulingStatus` for this feature. The existing statuses are enough if the request intent is modeled separately.

## Phase 2: Store and Scheduling Logic

### File

- `apps/play-tennis/src/store.ts`

### Core strategy

Keep the new reschedule behavior inside a small set of mutation helpers, instead of spreading logic across components.

### Add helper functions

1. `buildRescheduleProposals(match, requestedBy, preferredSlots?)`

Purpose:
- generate up to 3 replacement proposals from availability overlap
- fall back to requester-supplied manual slots when needed

2. `createScheduleHistoryEntry(...)`

Purpose:
- centralize accepted-change and released-slot history writes

3. `clearActiveRescheduleRequest(match)`

Purpose:
- avoid duplicated cleanup logic

4. `getOpponentId(match, currentPlayerId)`

Purpose:
- reduce repeated player lookup logic when sending notifications

### Replace current reschedule API

Replace the current `rescheduleMatch()` behavior with explicit operations:

- `requestSoftReschedule(tournamentId, matchId, requesterId, reason, slots?, note?)`
- `requestHardReschedule(tournamentId, matchId, requesterId, reason, slots?, note?)`
- `acceptRescheduleProposal(tournamentId, matchId, proposalId, responderId)`
- `declineSoftReschedule(tournamentId, matchId, responderId)`
- `counterReschedule(tournamentId, matchId, responderId, slots, note?)`
- `withdrawSoftReschedule(tournamentId, matchId, requesterId)`

### Behavioral rules to encode

#### Soft request

- guard: match must be confirmed and unscored
- create `activeRescheduleRequest`
- keep `schedule.status = 'confirmed'`
- keep `confirmedSlot` intact
- do not increment `rescheduleCount` yet

#### Hard request

- guard: match must be confirmed and unscored
- create `activeRescheduleRequest` with `intent = 'hard'`
- append history entry `original-slot-released`
- clear `confirmedSlot`
- set `schedule.status` to:
  - `proposed` if proposals exist
  - `unscheduled` if not
- do not increment `rescheduleCount` yet

#### Accept replacement

- set accepted proposal
- reject other pending proposals
- set `schedule.status = 'confirmed'`
- restore `confirmedSlot`
- append `rescheduled` history entry
- increment `rescheduleCount`
- clear `activeRescheduleRequest`

#### Decline soft request

- only valid when `intent = 'soft'`
- leave `confirmedSlot` unchanged
- leave `schedule.status = 'confirmed'`
- clear `activeRescheduleRequest`

#### Counter proposal

- replace pending proposals on the same request
- keep request active
- for soft requests: keep original slot active
- for hard requests: keep original slot canceled

#### Withdraw

- only valid when `intent = 'soft'`
- clear request
- leave original slot unchanged

### Compatibility rules

1. Existing matches without the new fields must continue to work.

Implementation note:
- default missing `activeRescheduleRequest` and `scheduleHistory` to `undefined`

2. Existing escalation logic should continue to work for hard conflicts because they reuse `proposed` / `unscheduled`.

3. Soft requests should not enter escalation while the confirmed slot still exists.

Implementation note:
- treat soft requests as confirmed matches, not as unresolved scheduling

### Notifications

Keep this minimal.

Two options:

- simplest:
  reuse the existing `match_reminder` notification type with reschedule-specific messages

- slightly cleaner:
  add 2-3 new notification enum values

Recommendation:
- reuse the current notification system and keep any type expansion minimal

Messages needed:

- soft request created
- hard request created
- replacement accepted
- soft request declined

## Phase 3: Confirmed Match UI

### File

- `apps/play-tennis/src/components/MatchSchedulePanel.tsx`

### Core strategy

This should remain the main editing surface. Do not create a separate reschedule screen.

### Changes

1. Replace the current confirmed-state `Reschedule` action with an intent-driven sheet.

2. Add local state for:

- selected intent: soft / hard
- selected reason
- optional note
- replacement slot inputs
- pending response actions

3. Render four confirmed-match branches:

- normal confirmed
- soft request sent
- soft request received
- hard request sent / received

4. Preserve the current cancel-match flow as a separate action.

### UI details

#### Normal confirmed card

Show:

- confirmed time
- venue suggestion
- `Change time`
- `Cancel match`

Reasoning:
- the entry action should describe the player’s intention more naturally than `Reschedule`

#### Soft request sent

Show:

- amber label `Reschedule requested`
- current confirmed time still visible
- proposed replacements
- `Edit request`
- `Withdraw request`

#### Soft request received

Show:

- amber label `Change requested`
- current confirmed time
- replacement proposals
- `Accept new time`
- `Keep current time`
- `Suggest another`

#### Hard request sent

Show:

- amber or red label `Needs new time`
- old slot shown as canceled
- replacement proposals
- `Suggest another`
- `Cancel match`

#### Hard request received

Show:

- amber or red label `Needs new time`
- line indicating who released the original slot
- old slot shown as canceled
- replacement proposals
- `Accept new time`
- `Suggest another`
- `Cancel match`

### Implementation note

Keep this in the same file for the first pass unless the confirmed-state branch becomes unmanageable. Avoid a premature component split.

## Phase 4: Derived State on Home and Match Lists

### Files

- `apps/play-tennis/src/components/Home.tsx`
- `apps/play-tennis/src/App.tsx`
- `apps/play-tennis/src/components/TournamentView.tsx`
- `apps/play-tennis/src/components/BracketTab.tsx`
- `apps/play-tennis/src/components/Inbox.tsx`

### Core strategy

Patch the places that currently assume:

- `confirmed + confirmedSlot` means the match is ready for score entry
- `proposed` means general scheduling, not hard reschedule

### Changes

1. Add a small helper for derived UI state.

Suggested helper name:
- `getRescheduleUiState(match, currentPlayerId)`

Suggested return values:
- `none`
- `soft_request_sent`
- `soft_request_received`
- `hard_request_sent`
- `hard_request_received`

Recommendation:
- place this helper in `store.ts` or a small new utility file if it gets reused in more than two components

2. Update `Home.tsx` action cards:

- inbound soft request:
  `Respond`
- inbound hard request:
  `Needs New Time`
- hard request sent:
  likely no urgent card unless it is awaiting the user’s next action
- confirmed with no request:
  keep existing score card behavior

3. Update `App.tsx` notification badge logic:

- count inbound hard and soft requests as action-needed states
- stop counting every confirmed match as a generic action unless it is actually scoreable

4. Update `TournamentView.tsx` and `BracketTab.tsx` badges and time chips:

- confirmed match:
  unchanged
- hard request:
  show `Needs new time`
- soft request:
  show `Change requested` or `Reschedule requested`

5. Update `Inbox.tsx` match context:

- if no `confirmedSlot` because of hard reschedule, do not show stale match-date text

## Phase 5: History and Copy

### Files

- primarily `MatchSchedulePanel.tsx`
- secondarily any match card labels in `TournamentView.tsx` and `BracketTab.tsx`

### Changes

1. After an accepted replacement, show:

- `Rescheduled from Tue Mar 24, 7:00 PM`

2. After a hard request, show:

- `Original time canceled`

3. Keep copy direct and action-based. Avoid legalistic language.

### Reasoning

The feature becomes confusing if history and current state are visually mixed. The UI should always separate:

- current reality
- past schedule

## Phase 6: Cleanup and Removal

### File

- `apps/play-tennis/src/store.ts`
- `apps/play-tennis/src/components/MatchSchedulePanel.tsx`

### Changes

1. Remove or deprecate the old `rescheduleMatch()` helper once all callers are migrated.

2. Remove confirmed-state UI that assumes rescheduling always creates a fresh proposal set by clearing the slot.

3. Keep `cancelMatch()` separate.

## Acceptance Criteria

### Soft reschedule

- requester can ask to move a confirmed match without clearing the current slot
- opponent sees the request and can accept, keep current time, or suggest another
- current confirmed time remains visible until a replacement is accepted

### Hard reschedule

- requester can explicitly cancel the current confirmed slot
- both players see that the match now needs a new time
- old slot is shown as canceled, not as active
- the match returns to existing scheduling behavior with proposed or unscheduled state

### Shared behavior

- only one active reschedule request can exist at a time
- reschedule is blocked after score reporting starts
- `rescheduleCount` increments only after a replacement is accepted
- accepted replacement creates a visible history entry
- inbound reschedule states show up in action surfaces

## Manual QA Checklist

1. Confirm a match, then create a soft reschedule request.
Expected:
- card shows request pending
- confirmed time still visible
- opponent can keep current time

2. Confirm a match, then create a hard reschedule request.
Expected:
- confirmed slot disappears
- card changes to `Needs new time`
- opponent sees canceled original slot and replacement options

3. Accept a replacement from both soft and hard flows.
Expected:
- match returns to confirmed
- history label appears
- reschedule count increments once

4. Decline a soft request.
Expected:
- match remains confirmed at original time
- request clears

5. Counter a request from the responder side.
Expected:
- proposals update
- only one request thread exists

6. Try to reschedule after score entry starts.
Expected:
- action blocked

7. Check Home, Tournament, Bracket, and Inbox.
Expected:
- no stale confirmed time displayed after hard request
- inbound requests show up as actionable

## Sequencing Recommendation

Implement in this order:

1. `types.ts`
2. `store.ts` data mutations and helpers
3. `MatchSchedulePanel.tsx`
4. `Home.tsx`, `TournamentView.tsx`, `BracketTab.tsx`, `App.tsx`, `Inbox.tsx`
5. cleanup of old reschedule code

This order minimizes the time spent with half-migrated behavior.

## Recommended Delivery Cut

If we want the smallest reviewable change set, split the work into two commits:

1. data model + store mutations + `MatchSchedulePanel.tsx`
2. secondary surfaces + polish + cleanup

That keeps the core behavior reviewable before the broader UX ripple effects land.
