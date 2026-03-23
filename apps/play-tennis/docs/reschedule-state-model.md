# Confirmed Match Rescheduling

## Goal

Handle the case where a match is already confirmed but one player needs to move it, without making scheduling feel heavy, confusing, or easy to abuse.

This spec is intentionally narrow. It is meant to preserve the core Rally promise:

- scheduling should stay simple
- matching quality should stay high
- confirmed matches should feel trustworthy

It is also written as the bridge to the next step: an executable implementation plan.

## Current State

The prototype already exposes a reschedule action in `MatchSchedulePanel.tsx` and `store.ts`, but the current behavior is too destructive for production:

- a confirmed slot is cleared immediately
- the match is pushed back into proposal mode
- the old time effectively disappears before the opponent agrees

That is risky because it breaks the most important trust rule in scheduling: once a match is confirmed, both players need to know what time is still "real".

## Product Position

### Recommended approach

Split rescheduling into **two explicit intents**:

- **soft reschedule**: "Can we move this?"
- **hard reschedule**: "I can't make this time"

The soft path keeps the confirmed time active until a replacement is explicitly accepted.

The hard path explicitly cancels the current confirmed slot and moves the match back into a focused needs-new-time state.

This is the best tradeoff between simplicity, trust, and empathy because it:

- keeps confirmed matches trustworthy by default
- lets players honestly say when the original time no longer works
- avoids reopening the full scheduling flow for every date change
- does not require admins
- preserves the "great matching" promise by still using availability-derived suggestions

### Alternatives considered

#### 1. Direct edit of the confirmed time

One player changes the match time immediately.

Why not:

- too easy to surprise the opponent
- high trust cost
- creates messaging and no-show disputes

#### 2. Reopen the whole match into scheduling mode

The confirmed match becomes unscheduled/proposed again.

Why not as the default:

- too much state churn
- the old time disappears too early
- makes a small change feel like starting over

#### 3. Auto-reschedule confirmed matches based on updated availability

Why not:

- violates the principle that confirmed means confirmed
- feels controlling
- hard to explain when the system moves a real appointment

### Final recommendation

Keep the confirmed match intact for ordinary change requests, but support a separate explicit path for breaking the original slot when a player truly cannot make it.

## Scope

### In scope

- one player asks to move a confirmed match
- the system suggests replacement times based on current availability
- the opponent can accept, decline, or counter
- soft requests keep the old time active until a new time is agreed
- hard requests explicitly release the old time and move the match back into scheduling
- a simple history of changes is visible

### Out of scope for v1

- admin override flows
- weather-specific exception logic
- automatic reprioritization of surrounding tournament matches
- multi-step negotiation threads
- calendar sync
- auto-moving a confirmed match without player consent

Keeping these out matters. The moment rescheduling becomes a mini scheduling product of its own, it starts competing with the main scheduling experience instead of supporting it.

## Design Principles

1. Confirmed still means confirmed.
2. Rescheduling is a request, not a rewrite.
3. A player should be able to act in one sheet and one follow-up tap.
4. The system should offer good alternatives, not make players start from zero.
5. If no replacement is accepted on a soft request, the original time still stands.
6. If a player explicitly says they cannot make the current time, the UI must stop pretending the old slot is still valid.
7. Canceling a match and moving a match are separate actions.

## Simplest Viable State Model

### Core decision

Do **not** add a new top-level match status just for soft rescheduling.

Use a nested change-request object to represent intent, accountability, and proposed replacement slots.

For hard rescheduling, reuse the existing scheduling states after the original slot is explicitly canceled, rather than inventing a special new lifecycle.

That keeps the model smaller and avoids rewriting existing scheduling logic.

### Proposed data additions

```ts
type RescheduleReason =
  | 'conflict'
  | 'weather'
  | 'court_issue'
  | 'injury_illness'
  | 'other'

type RescheduleRequestStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'withdrawn'
  | 'expired'

interface RescheduleProposal {
  id: string
  day: DayOfWeek
  startHour: number
  endHour: number
  source: 'system' | 'requester' | 'responder'
}

interface RescheduleRequest {
  id: string
  intent: 'soft' | 'hard'
  requestedBy: string
  requestedAt: string
  reason: RescheduleReason
  note?: string
  originalSlot: {
    day: DayOfWeek
    startHour: number
    endHour: number
  }
  proposals: RescheduleProposal[]
  status: RescheduleRequestStatus
  respondedBy?: string
  respondedAt?: string
  selectedProposalId?: string
  countsTowardLimit: boolean
  originalSlotReleasedAt?: string
}

interface ScheduleHistoryEntry {
  id: string
  type: 'initial-confirmation' | 'rescheduled' | 'original-slot-released'
  changedBy: string
  changedAt: string
  fromSlot?: {
    day: DayOfWeek
    startHour: number
    endHour: number
  }
  toSlot?: {
    day: DayOfWeek
    startHour: number
    endHour: number
  }
}
```

### Existing objects to keep

- `schedule.status = 'confirmed'` during soft requests
- `schedule.confirmedSlot` remains the currently valid appointment during soft requests
- `schedule.rescheduleCount` remains, but only increments when a new slot is actually accepted

### Existing states to reuse

- soft request:
  keep `schedule.status = 'confirmed'`

- hard request:
  clear `schedule.confirmedSlot`
  move the match into existing `proposed` or `unscheduled` scheduling behavior depending on whether replacement options are available

This is important because a hard request means the original slot is no longer real.

### Important simplification

Only allow **one active reschedule request per match**.

That avoids stacked requests, conflicting counters, and complex message reconciliation.

## Derived UI States

The product only needs six user-facing states:

1. `confirmed`
Current time is locked in. No active change request.

2. `confirmed_soft_request_sent`
You asked to move the match. Old time still stands until accepted.

3. `confirmed_soft_request_received`
Your opponent asked to move the match. You need to respond.

4. `needs_new_time_sent`
You said you cannot make the current time. The original slot has been canceled.

5. `needs_new_time_received`
Your opponent canceled the original slot and the match needs a new time.

6. `confirmed_rescheduled`
The replacement time was accepted. Show a short history label.

These are derived states, not new backend statuses.

## Event Model

### 1. Create soft request

Trigger:
- requester taps `Request new time`

Effects:
- create `rescheduleRequest`
- do not change `schedule.status`
- do not clear `confirmedSlot`
- generate 2-3 suggested replacement slots

Guardrails:
- match must be confirmed
- match must not be completed
- no score may be reported yet
- no other active reschedule request may exist

### 2. Create hard request

Trigger:
- requester taps `I can't make this time`

Effects:
- create `rescheduleRequest` with `intent = 'hard'`
- record history entry `original-slot-released`
- clear `schedule.confirmedSlot`
- move match into `proposed` or `unscheduled` state based on whether replacement options exist
- generate 2-3 suggested replacement slots if possible

Guardrails:
- match must be confirmed
- match must not be completed
- no score may be reported yet
- no other active reschedule request may exist

Important consequence:
- the original confirmed slot is no longer treated as valid once the hard request is sent
- the requester owns the accountability for breaking that commitment if rescheduling fails

### 3. Accept replacement

Trigger:
- responder picks one proposed slot

Effects:
- update `confirmedSlot` to selected slot
- mark request `accepted`
- append `scheduleHistory` entry
- increment `rescheduleCount`
- clear active request

### 4. Decline and keep current time

Trigger:
- responder chooses `Keep current time`

Effects:
- mark request `declined`
- leave `confirmedSlot` unchanged
- clear active request

Availability:
- only valid on soft requests

### 5. Counter with other time

Trigger:
- responder chooses `Suggest another`

Effects:
- replace request proposals with responder-generated proposals
- keep same request thread
- keep status `pending`
- soft request:
  keep original confirmed slot active
- hard request:
  keep original slot canceled

Simplification:
- this is still the same request, not a second request

### 6. Withdraw request

Trigger:
- requester chooses `Never mind`

Effects:
- mark request `withdrawn`
- leave original confirmed slot unchanged

Availability:
- only valid on soft requests

### 7. Time passes with request still pending

Trigger:
- relevant scheduling window passes

Effects:
- no automatic rewrite to the proposed replacement
- soft request:
  original time still governs missed-match handling
- hard request:
  existing cancellation / fault / forfeit rules govern based on who released the original slot and whether a new time was found

This is a deliberate simplification. It avoids building a separate deadline engine for rescheduling in v1.

## Guardrails

### Hard rules

- reschedule is only available for confirmed matches
- reschedule is disabled after score reporting starts
- only one active request at a time
- soft request leaves the original time valid until explicit acceptance
- hard request explicitly cancels the original time
- maximum 2 accepted player-initiated reschedules per match
- the player who breaks the original slot is the accountable actor if no replacement is agreed

### Soft rules

- suggest up to 3 slots, not more
- prefer availability overlap first
- if there is no overlap, allow manual custom proposal

### What not to build yet

- separate reschedule countdown timers
- automatic expiration logic beyond basic cleanup
- special-case exception policies by reason
- multi-party arbitration logic

## Questions That Matter

These are the only questions that seem materially important before implementation. Everything else should be treated as deferable.

### 1. Do we want counter-proposals in v1?

Recommendation:
- yes, but keep it to a single active request thread

Why:
- declining without a counter is too rigid
- allowing a full proposal thread would be too much

### 2. Should every reschedule request pause the original obligation?

Recommendation:
- no

Why:
- simplest rule
- easiest to explain
- protects trust in confirmed matches

Clarification:
- soft requests do not pause the original obligation
- hard requests explicitly release the original slot by design

### 3. Should every accepted reschedule count toward the limit?

Recommendation:
- yes for player-initiated changes
- no for future system-level exceptions, if those are ever added

Why:
- preserves fairness
- discourages repeated churn

### 4. Do we need a separate "I cannot make this anymore" flow?

Recommendation:
- yes

Why:
- it is a distinct user intent
- it lets players be honest when the original slot is no longer real
- it is more empathetic than pretending the confirmed time still stands

Constraint:
- keep it narrow
- do not turn it into a separate negotiation product

## Screenflow

## 1. Scheduled Match Card

Entry point for both players.

Contents:

- green status: `Scheduled`
- confirmed time
- venue if known
- subtle secondary action: `Request new time`
- tertiary action: `Cancel match` stays separate
- optional history label if previously moved:
  `Rescheduled from Tue Mar 24, 7:00 PM`

### UX copy

Button:
- `Request new time`

Helper copy:
- none by default; keep card quiet until needed

## 2. Reschedule Intent Sheet

Opened from the scheduled card.

### Step A: intent

Ask:

- `Ask to move the match`
- `I can't make this time`

Copy for the second option:

- `This will cancel the current confirmed time and ask your opponent to choose a new one.`

### Step B: reason

Show 5 chips:

- Schedule conflict
- Weather
- Court issue
- Injury / illness
- Other

Optional note field:
- `Add a short message`

### Step C: replacement suggestions

Show:

- soft flow:
  `Current time stays on until a new time is accepted`

- hard flow:
  `The current confirmed time will be canceled and this match will need a new time`

- 2-3 suggested times based on availability overlap
- `Pick another time` for manual selection

### Primary action

- `Send request`

### Exit action

- `Back`

## 3. Request Sent State

Visible on the scheduled card for a soft requester.

Contents:

- amber label: `Reschedule requested`
- original confirmed time still visible
- requested alternatives listed in compact form
- small explanatory line:
  `Your match is still on at the current time unless your opponent accepts a new one.`

Actions:

- `Edit request`
- `Withdraw request`

Recommendation:
- `Edit request` can simply reopen the sheet and overwrite proposals rather than creating a new request

## 4. Soft Request Received State

Visible on the scheduled card for the responder.

Contents:

- amber label: `Change requested`
- line:
  `[Name] asked to move this match`
- current confirmed time
- proposed alternatives

Actions:

- `Accept new time`
- `Keep current time`
- `Suggest another`

This is the key screen. It needs to be highly legible and decisive, not chat-like.

## 5. Hard Request Sent State

Visible after the requester chooses `I can't make this time`.

Contents:

- amber or red label: `Needs new time`
- original confirmed slot shown as canceled
- note:
  `You canceled the original confirmed time`
- replacement options shown immediately

Actions:

- `Suggest new time`
- `Cancel match`

## 6. Hard Request Received State

Visible for the other player when the original slot has been broken by the requester.

Contents:

- amber or red label: `Needs new time`
- line:
  `[Name] can't make the original time`
- old slot shown as canceled
- replacement options shown immediately

Actions:

- `Accept new time`
- `Suggest another`
- `Cancel match`

## 7. Counter-Proposal Sheet

Opened when responder taps `Suggest another`.

Contents:

- same slot picker pattern as request flow
- original confirmed time still referenced at top
- 1-3 replacement suggestions allowed

Primary action:

- `Send new options`

## 8. Accepted Reschedule

After acceptance:

- card returns to green `Scheduled`
- new confirmed time displayed
- history label:
  `Rescheduled from Tue Mar 24, 7:00 PM`

Optional transient toast:

- `Match moved to Thu Mar 26, 6:00 PM`

## 9. Declined Soft Reschedule

After responder keeps the original time:

- card remains green `Scheduled`
- no persistent warning state
- optional toast:
  `Match remains scheduled for Tue Mar 24, 7:00 PM`

This should feel like closing a request, not creating a conflict state.

## Notifications

Keep this minimal.

### Send on soft request creation

`Pascal asked to move your Tue Mar 24, 7:00 PM match.`

### Send on hard request creation

`Pascal can't make your Tue Mar 24, 7:00 PM match. This match now needs a new time.`

### Send on acceptance

`Your match with Alex has been moved to Thu Mar 26, 6:00 PM.`

### Send on soft decline

`Your match with Alex is still on for Tue Mar 24, 7:00 PM.`

No need for many more notification types beyond these in v1.

## Why this stays simple

This approach is probably the best version of the feature if the product goal is still "Rally handles scheduling for me" rather than "Rally is a full negotiation tool."

It stays simple because:

- it does not invent a second scheduling system
- it does not add a new top-level soft-reschedule lifecycle
- it keeps the confirmed slot as the single truth unless a player explicitly breaks it
- it uses the existing scheduling primitives: proposed slots, accept, confirm
- it limits the problem to one active change request at a time
- it separates ordinary preference changes from true conflicts

## What would make this unnecessarily complex

Avoid these unless real usage proves they are necessary:

- letting both players spawn overlapping reschedule requests
- adding separate SLA timers just for rescheduling
- automatically moving other matches to accommodate one change
- building a message-thread style negotiation UI
- introducing reason-specific business rules
- creating a dedicated reschedule inbox separate from the match card

## Implementation Notes

This is the likely minimal surface area:

- `types.ts`
  add `RescheduleRequest`, `ScheduleHistoryEntry`, and derived helpers

- `store.ts`
  replace the current destructive `rescheduleMatch()` behavior with request-based mutation helpers:
  - `requestSoftReschedule()`
  - `requestHardReschedule()`
  - `acceptReschedule()`
  - `declineReschedule()`
  - `counterReschedule()`
  - `withdrawReschedule()`

- `MatchSchedulePanel.tsx`
  change the confirmed-state UI from direct reschedule to request-based flow

- notifications
  reuse the existing in-app notification pattern with 3 focused cases

## Suggested Next Step

Turn this document into an executable implementation plan with:

1. type changes
2. store/API changes
3. component changes
4. migration strategy from the current prototype behavior
5. acceptance criteria
6. test cases
