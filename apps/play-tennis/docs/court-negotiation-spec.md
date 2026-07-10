# Rally Court Booking Negotiation — Engineering Spec (Marin County V1)

> Status: Ready to build · Owner: (author) · Target: `staging` → `main` after QA
> Scope tag: `court-negotiation-v1` · Feature area: MatchSchedule + MatchSchedulePanel + notifications
> Hardened against three adversarial reviews — see **"Changes from review"** near the end.

---

## 1. Summary & goal

### The reframe
Rally does **not** book courts. In Marin, the overwhelming majority of tennis courts are **free walk-on** (Boyle, Larkspur, Albert, Pioneer, Ross Commons, College of Marin, etc.). "Booking" is the wrong mental model and would drag us into per-venue reservation APIs, payments, membership eligibility, and key logistics we cannot own in V1.

What Rally actually coordinates is a smaller, tractable problem: **once two players have confirmed a time, who is responsible for making sure there is a court to play on?** For walk-on courts that means "who arrives first / grabs the court." For the handful of reservable courts it means "who clicks the reservation link (and, for paid venues, pays)." Internally we call that person the **captain**.

> **Naming decision (2026-07-11).** "Captain" tested as unclear to first-time users — it implies team-captain seniority and doesn't say *what* the person does. **User-facing copy no longer uses the word "captain."** Instead we name the job directly: **"getting the court"** (e.g. "You're getting the court", "Alex is getting the court", "I'll get it instead"). The completed state stays **"Court secured ✓"**. A one-time, per-device explainer card ("That just means you'll make sure there's a court…") appears the first time a player is getting the court. The **internal data model and identifiers are unchanged** (`court.captainId`, `CaptainNegotiation`, `claimCaptain`, `captain_assigned`, etc.) — renaming them would be a large, risky refactor across sync/persistence/tests for zero user benefit, since users never see identifiers. So throughout this spec, wherever you read "captain," the UI now says "getting the court."

### What we ship
1. A synced **`court` sub-object** on `MatchSchedule` carrying the chosen venue, the captain, and a secured flag — visible identically to both players, propagated over the existing `tournaments` realtime channel (the ONLY cross-device transport; see §8 on why notifications are not).
2. A **provisional-captain default** = the human who proposed the confirmed time, set atomically in `acceptProposal`, so there is never a captain vacuum. When the proposal was `'system'`-generated (the common auto/needs-accept path), the **acceptor** becomes provisional captain — never the literal `'system'` (§6.3, P0 fix).
3. A real, low-friction **captain negotiation**: one-tap "I'll be captain" (claim, immediate — this IS "volunteer yourself") and "Can you take this one?" (delegate, requires acceptance) — both cloned from the proven `RescheduleRequest` propose→respond engine.
4. A synced **venue picker** over a bundled `marinVenues.ts` directory (replacing the current localStorage-only, opponent-invisible `getVenueSuggestion`), biased to free walk-on courts, with a "show all courts" escape hatch and an "Other" free-text fallback.
5. A captain-owned **"Court secured" toggle** — one boolean, distinct from "time confirmed", that **never gates score entry or play**.
6. **Dedicated captain notifications** (device-local, derived-from-court banners as the cross-device source of truth) + a "secure the court" prompt driven off `court.status`, not a rolling weekday date (§8, P0 fix).

### Non-goals (V1)
No booking API integrations, no payments/cost-splitting, no geo/"closer venue" logic, no alternating-captain rotation across a series, no persisted membership/eligibility profile, **no doubles support for court negotiation** (singles only; §12). See §12.

### Success metric
One metric: **does setting `court.venueId` + `court.captainId` lift the rate of "score logged" for a match?** Instrument the funnel `time-confirmed → venue-set → captain-set → secured → score-logged` (§12).

---

## 2. Data model

### 2.1 `court` sub-object on `MatchSchedule`

Add a single optional field `court?` to `MatchSchedule` (`apps/play-tennis/src/types.ts:107`). Everything nests under it so the diff is one field and backward-compat is trivial.

```ts
// types.ts — new types, placed just above MatchSchedule (near line 106)

/** How a venue is obtained. Drives the captain-duty CTA copy. */
export type ReservationMethod =
  | 'walk-on'         // free, first-come-first-served
  | 'reserve-online'  // reservable via a URL (may be free or paid)
  | 'key-required'    // needs an annual physical key
  | 'members-only'    // private club
  | 'school-walk-on'  // public when not in class use

export type VenueAccessType =
  | 'public-free'
  | 'public-reservable'
  | 'private-club'
  | 'school'

/** Court lifecycle, distinct from schedule.status. */
export type CourtStatus = 'assigned' | 'secured'

/** Captain negotiation, cloned from RescheduleRequest (types.ts:82). */
export type CaptainNegotiationKind = 'delegate'   // "can you take this one?" — the ONLY round-trip kind (see §3.2)
export type CaptainNegotiationStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export interface CaptainNegotiation {
  id: string
  kind: CaptainNegotiationKind          // only 'delegate' needs a round-trip in V1
  requestedBy: string                   // playerId proposing the hand-off
  requestedTo: string                   // playerId being asked to become captain
  requestedAt: string                   // ISO
  note?: string
  status: CaptainNegotiationStatus
  respondedBy?: string                  // playerId who accepted/declined
  respondedAt?: string                  // ISO
}

export interface MatchCourt {
  venueId: string | null                // marinVenues slug, or 'other', or null (venue not yet chosen)
  venueLabel?: string                   // only set when venueId === 'other' (free-text)
  captainId: string | null              // MUST be player1Id or player2Id, or null. NEVER 'system'. (§6.3)
  status: CourtStatus                   // 'assigned' (default) | 'secured'
  assignedBy: string                    // playerId who set/last-changed the captain (audit)
  assignedAt: string                    // ISO — when captainId last changed
  securedAt?: string                    // ISO — set when status flips to 'secured'
  handedOffAt?: string                  // ISO — set when a delegate negotiation is accepted
  negotiation?: CaptainNegotiation      // present iff a delegate hand-off is pending; DELETED on resolve (§3.3)
}
```

**captainId invariant (hard):** `court.captainId`, when non-null, is always one of the match's two participant ids (`match.player1Id` / `match.player2Id`). It is **never** the literal `'system'` and never a non-participant. Every write path (§6.3, T1/T3/T9) must uphold this; §11 test #1 asserts it explicitly for the system-proposal case.

Then extend `MatchSchedule` (`types.ts:107`) with exactly one field:

```ts
export interface MatchSchedule {
  // ...existing fields unchanged...
  scheduleHistory?: ScheduleHistoryEntry[]
  court?: MatchCourt          // NEW — optional; absent on legacy blobs
}
```

Extend the notification union (`types.ts:361`) — see §8. **Note:** these types drive **device-local** banners/badges only; the cross-device signal is the synced `court` object, not the notification (§8, P0).

```ts
export type NotificationType =
  | 'match_offer' | 'offer_accepted' | 'offer_declined' | 'offer_expired'
  | 'match_reminder' | 'score_reported' | 'score_correction_proposed'
  | 'score_correction_resolved' | 'score_issue_reported'
  | 'feedback_requested' | 'reliability_nudge'
  // NEW captain events (device-local; see §8):
  | 'captain_assigned'
  | 'captain_delegation_suggested'
  | 'captain_handoff_accepted'
  | 'captain_handoff_declined'
  | 'court_secured'
  | 'court_unsecured_nudge'
```

### 2.2 `marinVenues.ts` record type

Model exactly on `apps/play-tennis/src/counties.ts` — a bundled TS constant, no table, no migration. New file `apps/play-tennis/src/marinVenues.ts`:

```ts
import { ReservationMethod, VenueAccessType } from './types'

export interface MarinVenue {
  id: string                         // slug, stored in court.venueId
  name: string
  city: string
  accessType: VenueAccessType
  reservationMethod: ReservationMethod
  reservationUrl?: string            // present for reserve-online
  feeNote?: string                   // human DISPLAY copy only — never used for money semantics
  keyNote?: string                   // present for key-required
  isPaid: boolean                    // EXPLICIT money semantics (P2 fix — no regex sniffing of feeNote)
  inDefaults: boolean                // true only for free walk-on + free reserve-online
}

export const MARIN_VENUES: MarinVenue[] = [ /* ...25 entries, full literal in Appendix A... */ ]

export function getVenue(id: string | null | undefined): MarinVenue | undefined {
  if (!id || id === 'other') return undefined
  return MARIN_VENUES.find(v => v.id === id)
}

/** Default suggestions: free walk-on + free reserve-online only. */
export function defaultVenues(): MarinVenue[] {
  return MARIN_VENUES.filter(v => v.inDefaults)
}

/** Everything selectable behind "show all courts". */
export function allSelectableVenues(): MarinVenue[] {
  return MARIN_VENUES
}

/** True when the captain should expect to pay. Reads the explicit field — never parses feeNote. */
export function isPaidVenue(v: MarinVenue): boolean {
  return v.isPaid
}
```

The full 25-venue array is in **Appendix A** and is the single source of truth for that literal. Invariant enforced by test (§11 #10): **no `inDefaults:true` venue is `isPaid:true`** (paid stays out of defaults — locked decision #3).

### 2.3 Marin-county detection (P0 fix — the gate must actually turn on)

Counties are stored in **full census form** — `counties.ts` holds literals like `'Marin County, CA'`, and both tournament and profile county are trimmed but **not** shortened (`store.ts` county handling; `getLobbyByCounty` relies on the full-string form). A naive `county.toLowerCase() === 'marin'` is **always false** and would ship the feature dark.

Add a shared, unit-tested helper next to the venue directory:

```ts
// marinVenues.ts (or a small county util imported by it)
export function isMarinCounty(county: string | null | undefined): boolean {
  if (!county) return false
  const c = county.trim().toLowerCase()
  // Matches the exact stored form 'Marin County, CA' and defensive short forms.
  return c === 'marin county, ca' || c === 'marin' || c.startsWith('marin county')
}
```

Every gate in this spec (§12) uses `isMarinCounty(tournament.county)`. §11 test asserts `isMarinCounty('Marin County, CA') === true` against the exact stored literal.

### 2.4 Why it rides `tournaments.data` JSONB — no new table, no migration

- `MatchSchedule` is serialized inside `Match → Tournament → tournaments.data` (JSONB). Adding a nested optional object changes nothing about the row schema. There is **no ALTER TABLE, no migration, no RLS change.**
- Realtime already fires `postgres_changes` on `tournaments` (RallyDataProvider). A nested `court` object reaches the opponent's device automatically — **no new channel** (§9). Precondition and failure mode are spelled out in §9.
- We deliberately do **not** ride `MatchBroadcast`/`MatchOffer` (`types.ts:257-344`), which persist only to localStorage via `loadBroadcasts`/`saveBroadcasts` (`store.ts:3418`) and **never cross devices** (documented sync gap). Court negotiation must be device-visible to both players, so it must live on the synced `MatchSchedule`.

### 2.5 Backward compatibility (hard requirement)

- `court` is **optional**. Every old tournament blob lacks it and must keep working end-to-end (render, score entry, reschedule) with `court === undefined`.
- Read sites must treat `court === undefined` as "no captain assigned yet, no venue chosen." Any place that assumes `court` exists is a bug.
- **No backfill migration.** Legacy confirmed matches show the "Set who secures the court" empty state (§6.2); a captain/venue is set lazily on first interaction (T9). Only two writes ever **create** a `court`: `acceptProposal` on first confirm (§6.3) and `initLegacyCourt` (T9). Everything else mutates an existing `court`.
- Never `JSON.stringify`-compare schedules; only touch `court` through the helpers in §9.

---

## 3. Captain state machine

### 3.1 States

| State | Meaning | Encoding |
|---|---|---|
| **no-court** | Legacy/degenerate: confirmed match, no `court` object yet | `schedule.court === undefined` |
| **provisional-assigned** | Captain defaulted at confirmation; venue may or may not be chosen | `court.status === 'assigned'`, `court.captainId != null`, no pending `negotiation` |
| **delegation-pending** | Current captain asked the other player to take it; awaiting accept/decline | `court.negotiation?.status === 'pending'` (overlay on `assigned` or `secured`) |
| **secured** | Captain confirmed a court is locked in | `court.status === 'secured'`, `securedAt` set |
| **orphaned-captain** | `court` exists but `captainId` is null or ∉ {player1Id, player2Id} (rare — see E12) | `court != null && (court.captainId == null \|\| captainId not a participant)` |

`assigned` and `secured` are the only `CourtStatus` values. "delegation-pending" is not a status — it is the presence of a `pending` `negotiation`, so a match can be `assigned` **and** have a pending hand-off simultaneously. "orphaned-captain" is a **derived** read-state (not a persisted status): it renders exactly like "no-court" — the "Set who secures the court" affordance — and any remaining participant can claim via T1.

### 3.2 The claim vs delegate asymmetry (the core product decision)

- **Claim ("I'll be captain") — this is exactly "volunteer yourself."** *Adds work to yourself* → apply **immediately**, one tap, guarded only by the optimistic lock for simultaneous claims (§4). Reversible (you can claim back and forth). No acceptance needed. Sets `captainId = me`, `assignedBy = me`, `assignedAt = now`. If a delegation was pending *to* me and I instead just claim, the pending delegation is withdrawn (superseded). **Because volunteering adds work only to yourself, `CaptainNegotiationKind` intentionally has no `'volunteer'` round-trip — the T1 claim IS volunteering, immediate and reversible.** (Closes the apparent gap vs locked decision #1's "suggest/volunteer himself" wording.)
- **Delegate ("Can you take this one?")** *adds work to the other player* → **requires their acceptance**. Writes a `pending` `CaptainNegotiation` (`kind:'delegate'`, `requestedTo = other`). Captain does **not** change until the other player accepts. This is the exact `RescheduleRequest` propose→respond contract, and it honors "confirmed means confirmed" trust: you cannot silently offload work onto someone.

### 3.3 Transition table

Legend — "Sync effect" = the store helper that runs. Claim/accept/legacy-init use `commitCaptainClaim` (§4, first-writer-wins). **All other court mutations use `commitCourtMutation` (§4/§9), which — like the claim path — re-applies ONLY the court delta onto freshly-refreshed remote state before pushing, so a concurrent write to another match/field in the same tournament is never clobbered.** (This replaces the earlier, incorrect "plain saveAndSync last-writer-wins is fine" claim — see §4.) "Notify" = a **device-local** `addNotification` on the actor's device (§8); the opponent learns of the change via synced `court` re-render, not the notification.

| # | From | Action | Actor | Guard | Mutation | Commit path | Notify (local) |
|---|---|---|---|---|---|---|---|
| T0 | (confirming) | Confirm time | acceptor (via `acceptProposal`) | proposal pending; no same-day conflict (existing) | **only if `court===undefined`:** create `court = { venueId: <picked-or-null>, captainId: provisionalCaptain, status:'assigned', assignedBy: acceptedBy, assignedAt: now }` where `provisionalCaptain = proposal.proposedBy !== 'system' ? proposal.proposedBy : acceptedBy` | same write as confirm (§6.3) | `captain_assigned` → provisionalCaptain |
| T1 | provisional-assigned / secured / no-court / orphaned | **Claim** "I'll be captain" | either participant | `me !== court?.captainId` and `me ∈ {p1,p2}` | `captainId = me`, `assignedBy = me`, `assignedAt = now`; withdraw any pending delegation | `commitCaptainClaim` (§4) | `captain_assigned` |
| T2 | assigned / secured (no pending delegation) | **Delegate** "Can you take this one?" | current captain only | `me === court.captainId` AND no pending `negotiation` | set `court.negotiation = { id, kind:'delegate', requestedBy: me, requestedTo: other, requestedAt: now, status:'pending' }` (captainId unchanged) | `commitCourtMutation` | `captain_delegation_suggested` |
| T3 | delegation-pending | **Accept** hand-off | `negotiation.requestedTo` only | `negotiation.status === 'pending'` AND `me === requestedTo` | `captainId = me`, `assignedBy = me`, `assignedAt = now`, `handedOffAt = now`; **delete `court.negotiation`** | `commitCaptainClaim` (§4) | `captain_handoff_accepted` |
| T4 | delegation-pending | **Decline** hand-off | `negotiation.requestedTo` only | same as T3 | captainId unchanged; **delete `court.negotiation`** | `commitCourtMutation` | `captain_handoff_declined` |
| T5 | delegation-pending | **Withdraw** delegation | `negotiation.requestedBy` only | `negotiation.status==='pending'` AND `me===requestedBy` | **delete `court.negotiation`** | `commitCourtMutation` | none (silent, matches reschedule withdraw) |
| T6 | assigned | **Secure court** | current captain only | `me === court.captainId` AND `court.status==='assigned'` | `status='secured'`, `securedAt=now`; **auto-delete any pending delegation** (E4) | `commitCourtMutation` | `court_secured` |
| T7 | secured | **Un-secure** (toggle off) | current captain only | `me === court.captainId` AND `court.status==='secured'` | `status='assigned'`, delete `securedAt` | `commitCourtMutation` | none |
| T8 | any-with-court | **Change venue** | either participant | `court` exists | `venueId = picked` (`venueLabel` iff 'other'); **if `status==='secured'`, reset to `'assigned'` + delete `securedAt`** (venue changed ⇒ re-secure); captainId unchanged | `commitCourtMutation` | none (quiet; captain re-secures) |
| T9 | no-court (legacy) / orphaned | **Set captain** on legacy/orphaned confirmed match | either participant | `schedule.status==='confirmed'` AND (`court===undefined` OR captainId ∉ {p1,p2}) | create-or-repair `court` with `captainId = me` (claimer becomes captain), `assignedBy=me` | `commitCaptainClaim` (§4) | `captain_assigned` |

Notes:
- `negotiation` is **deleted on every resolve** (T3/T4/T5) after the local notification is emitted — no lingering resolved objects. Guards therefore only ever see a `pending` negotiation or none.
- Only **one** pending delegation at a time (guard in T2). A second "can you take this?" while one is pending is a no-op (button disabled).
- T0 is **conditional on `court===undefined`** so the reschedule-accept path (which runs inside the same `acceptProposal`) never overwrites an existing court — see §6.3 and E6.

---

## 4. Concurrency (simultaneous claims + all court writes)

Two players tap "I'll be captain" (T1) at the same instant, or one claims (T1) while the other accepts a delegation (T3). We resolve this with the **existing** optimistic lock — no new machinery — but we must be precise about what `saveAndSync` actually does.

### What `saveAndSync` really does (corrected)
`saveAndSync` (`store.ts:1414`) calls `syncTournament(t, getTournamentTimestamp(id))` (`sync.ts:26`), which does `.eq('updated_at', expectedUpdatedAt)` (`sync.ts:41`). On a moved row Supabase updates 0 rows and returns `{ success:false, conflict:true }` (`sync.ts:52`). **On conflict, `saveAndSync`'s built-in retry refreshes the cached timestamp and re-pushes the *original, unchanged* in-memory blob — it does NOT merge the concurrent winner's write.** `refreshTournamentById` (`sync.ts:227`) returns fresh remote state and updates the timestamp map, but does **not** itself write the bridge/localStorage. Therefore a blind `saveAndSync` retry is a **whole-tournament last-writer-wins clobber**: a court write that conflicts with a concurrent write to a *different* match or field in the same tournament would resurrect stale data.

**Consequence:** we do **not** rely on the built-in retry for any court write. All court mutations go through one of two claim-aware commit wrappers that re-fetch remote and re-apply only the court delta for the specific match before pushing.

### 4.1 `commitCourtMutation` — for all non-claim court writes (T2, T4, T5, T6, T7, T8)
Applies a pure mutator to `match.schedule.court`, syncs, and on conflict re-applies **only that mutator** onto the refreshed remote blob (never re-pushing the stale whole-tournament copy), then writes the bridge so the UI adopts the merged result.

```ts
// store.ts
async function commitCourtMutation(
  tournamentId: string,
  matchId: string,
  mutate: (court: MatchCourt, match: Match) => void
): Promise<{ ok: boolean }> {
  const applyOnce = (arr: Tournament[]) => {
    const t = arr.find(x => x.id === tournamentId)!
    const match = t.matches.find(m => m.id === matchId)!
    if (!match.schedule?.court) return { t, match, skipped: true }   // court must already exist
    mutate(match.schedule.court, match)
    return { t, match, skipped: false }
  }

  const all = load()
  const { t, skipped } = applyOnce(all)
  if (skipped) return { ok: false }
  const first = await syncTournament(t, getTournamentTimestamp(tournamentId))
  if (first.success || !first.conflict) { bridgeSetTournaments([...all]); return { ok: true } } // offline: keep local (§9)

  // Conflict: adopt fresh remote, re-apply ONLY our court delta, splice into bridge, retry once.
  const fresh = await refreshTournamentById(tournamentId)
  if (!fresh) { bridgeSetTournaments([...all]); return { ok: true } }
  const merged = load().map(x => x.id === tournamentId ? fresh : x)   // adopt winner's whole-tournament state
  const { t: mergedT, skipped: skip2 } = applyOnce(merged)
  bridgeSetTournaments([...merged])
  if (skip2) return { ok: false }
  const retry = await syncTournament(mergedT, getTournamentTimestamp(tournamentId))
  return { ok: retry.success }
}
```

### 4.2 `commitCaptainClaim` — first-writer-wins for T1 / T3-accept / T9

The one difference from §4.1: captaincy is **first-writer-wins** ("X already volunteered"), so on conflict we do **not** blindly re-apply — we compare the refreshed remote captain to the captain we observed **before our write** (not to any proposer baseline, which is the corrected detection — see below).

```ts
// store.ts — used by claimCaptain / respondCaptainDelegation('accept') / initLegacyCourt
async function commitCaptainClaim(
  tournamentId: string,
  matchId: string,
  me: string,
  applyClaim: (court: MatchCourt, match: Match) => void   // sets captainId = me, audit fields, etc.
): Promise<{ ok: true } | { ok: false; winnerId: string }> {
  const all = load()
  const t = all.find(x => x.id === tournamentId)!
  const match = t.matches.find(m => m.id === matchId)!
  const expectedPrevCaptainId = match.schedule?.court?.captainId ?? null   // what WE saw before claiming
  const court = ensureCourt(match, me)                                     // create/repair if legacy/orphaned (T9)
  applyClaim(court, match)

  const first = await syncTournament(t, getTournamentTimestamp(tournamentId))
  if (first.success) { bridgeSetTournaments([...all]); return { ok: true } }
  if (!first.conflict) { bridgeSetTournaments([...all]); return { ok: true } }  // offline: keep local (§9)

  // Conflict: the row moved. Refresh and DECIDE against the pre-write captain, not a proposer baseline.
  const fresh = await refreshTournamentById(tournamentId)
  const freshCourt = fresh?.matches.find(m => m.id === matchId)?.schedule?.court ?? null
  const merged = load().map(x => x.id === tournamentId ? (fresh ?? x) : x)      // adopt remote into the bridge
  const remoteCaptain = freshCourt?.captainId ?? null

  // Someone else claimed if the remote captain changed away from what we expected AND it isn't us.
  if (remoteCaptain && remoteCaptain !== expectedPrevCaptainId && remoteCaptain !== me) {
    bridgeSetTournaments([...merged])                                          // loser adopts winner
    return { ok: false, winnerId: remoteCaptain }
  }

  // No competing claim landed → re-apply OUR claim onto fresh state, splice, retry once.
  const mergedMatch = merged.find(x => x.id === tournamentId)!.matches.find(m => m.id === matchId)!
  applyClaim(ensureCourt(mergedMatch, me), mergedMatch)
  bridgeSetTournaments([...merged])
  const retry = await syncTournament(merged.find(x => x.id === tournamentId)!, getTournamentTimestamp(tournamentId))
  return retry.success
    ? { ok: true }
    : { ok: false, winnerId: mergedMatch.schedule!.court!.captainId! }
}
```

Two corrections baked in vs the draft:
1. **Detection uses `expectedPrevCaptainId`, not `proposerOf(match)`.** The provisional captain normally *is* the proposer, so comparing to the proposer would wrongly conclude "no competing claim" and clobber. Comparing to the captain we observed before our write is the correct optimistic signal. `proposerOf(match)` is removed entirely.
2. **Adopted remote is actually written to the bridge** (`bridgeSetTournaments([...merged])`), so the losing device's UI immediately shows the winner. The draft's `refreshTournamentById`-then-`load()` dance never wrote the refresh back and left the loser on stale local state; that is fixed here.

`ensureCourt(match, me)` creates a default court when `court===undefined` **or** repairs an orphaned court (captainId ∉ participants), setting `captainId = me` — used only by the claim/legacy/orphan path.

### User-visible outcome
- **Winner:** their claim stands; no toast.
- **Loser** (conflict, competing claim detected): UI adopts remote state and shows a non-blocking toast: **"{WinnerName} already volunteered to be captain."** The button now reads "{WinnerName} is captain" with a "Take over" affordance (which is just T1 again — reversible by design). No error, no data loss.

---

## 5. Venue selection UX

### 5.1 Picker structure
Replace `getVenueSuggestion` (`MatchSchedulePanel.tsx:83`) and its render at `:486` with a synced `<VenuePicker>` that writes `court.venueId` via `setCourtVenue` (T8).

Three tiers, one collapse-by-default control:
1. **Default list** — `defaultVenues()` (free walk-on + free reserve-online). Shown first, one tap to select.
2. **"Show all courts"** link — expands to `allSelectableVenues()`, including members-only, key-required, and paid. Filtered-out venues are *visible but annotated* with an honest barrier line (below). No membership profile is consulted (deferred, §12).
3. **"Other"** — free-text fallback (`venueId='other'`, `venueLabel=<text>`), for a court not in the directory.

The picker is available to **either** participant (venue is a shared decision, not captain-only), and edits sync to both. The **captain** owns securing (§7); the **venue** is jointly editable.

### 5.2 Per-`reservationMethod` copy & captain CTA (exact strings)

Rendered on the confirmed card. `{captainName}` is the captain; `{fee}` is `venue.feeNote`. "Paid" branches key off `venue.isPaid` (the explicit field), **not** any regex on `feeNote`.

| reservationMethod | Selection-list caption | Captain-side CTA (what the captain sees) | Non-captain sees |
|---|---|---|---|
| `walk-on` | "Free · first-come, first-served" | Button: **"I'll arrive first to grab a court"** → sets secured (T6). Helper: "Walk-on court — no reservation. Whoever gets there first holds it." | "{captainName} will grab a court on arrival." |
| `reserve-online` (`isPaid:false`) | "Free · reservable online" | Button: **"Reserve online"** → opens `reservationUrl` in new tab; then **"Mark court secured"** (T6). Helper: "Reserve through the site, then mark it secured here." | "{captainName} is reserving this court online." |
| `reserve-online` (`isPaid:true`) | "{fee}" (e.g. "$13/hr, 2hr min — captain pays") | Button: **"Reserve online (you'll pay {fee})"** → opens URL; then "Mark court secured". Helper: "Paid court — the captain covers it. Rally doesn't handle payment yet." | "{captainName} is booking a paid court ({fee})." |
| `key-required` | "Annual key required — {keyNote}" | **No secure-via-Rally shortcut.** Barrier text: "This court needs an annual key ({keyNote}). Only pick it if the captain has a key." Still selectable. | "{captainName} — this court needs a key ({keyNote})." |
| `members-only` | "Private club — members only" | Barrier text: "Members-only club. Only pick it if the captain is a member." Still selectable. | "{captainName} — members-only club." |
| `school-walk-on` | "Public when not in class use" | Same as `walk-on` CTA. Helper adds: "Open to the public sunrise–sunset when not reserved for classes." | "{captainName} will grab a court on arrival." |
| `other` (free-text) | (none) | Button: **"Mark court secured"** (T6). Helper: "You entered a custom court. Mark it secured once it's locked in." | "{captainName} chose {venueLabel}." |
| venue not yet set (`venueId===null`) | Empty state | Prompt: **"Choose where you'll play"** (opens picker). | "No court chosen yet." |

Copy rules: never claim Rally booked or paid for anything; paid/key/members lines are honest caveats, not blockers. Fee is always framed "captain pays," matching the locked decision.

---

## 6. UI touchpoints

### 6.1 `MatchSchedulePanel.tsx` — remove the fake suggestion, add the synced picker + captain card
- **Delete** `getVenueSuggestion` (`:83–100`). It reads only the current player's `preferredCourts`, is never synced, and the opponent never sees it — exactly the anti-pattern we're replacing.
- **Delete** the render at `:486` (`{venue ? <div className="venue-suggestion">{venue}</div> : null}`) and the `venue` local it derives from.
- **Add** `<VenuePicker match={match} court={match.schedule?.court} currentPlayerId={...} onChange={setCourtVenue}/>` in the confirmed-card block (the same block that renders `.confirmed-slot` at `:482`).
- **Add** `<CaptainCard>` immediately below the confirmed slot — see §6.2.
- **Doubles guard:** render neither `<VenuePicker>` nor `<CaptainCard>` when `tournament.mode === 'doubles'` (V1 is singles-only; §12).

### 6.1a Cross-surface visibility audit (P1 — opponent must actually see it)

The feature dies if the **opponent's** surfaces don't render captain/venue/secured state. `MatchSchedulePanel` is embedded via `UpcomingMatchPanel` (`UpcomingMatchPanel.tsx:35`); `canExpandMatch` (`matchCapabilities.ts:30`) lets participants expand a confirmed match. That covers the expanded panel, but the "aha" surfaces are the collapsed Home card and the Bracket summary. Required read-only touchpoints, each showing `captainName` + venue + secured checkmark for **both** participants:

| Surface | What it must show (read-only) |
|---|---|
| `MatchSchedulePanel` confirmed block (`:482`) | Full `<CaptainCard>` + `<VenuePicker>` (interactive per Actor guards). |
| Home card (matchCardModel-driven) | One line: "{captainName} · {venueName}{ secured ✓ }" when `court` set; nothing when `court===undefined`. |
| Bracket `ScheduleSummary` | Same one-line captain/venue/secured summary on each confirmed match row. |

Cross-device tests 17/18 (§11) assert the state appears on the **non-actor's** Home/Bracket card, not only inside an expanded panel.

### 6.2 Confirmed-card render — captain vs non-captain

`<CaptainCard>` reads `court` and `currentPlayerId` and branches:

```
court === undefined (legacy)                      → "Set who secures the court" → button (T9)
court exists, captainId ∉ {p1,p2} (orphaned)      → "Set who secures the court" → button (T9 repair)
I am captain, status 'assigned'                   → "You're captain" + [Secure CTA per §5.2] + "Ask {opp} to take it" (T2)
I am captain, status 'secured'                    → "You're captain · Court secured ✓" + "Un-secure" (T7) + "Ask {opp} to take it"
I am NOT captain, no pending delegation            → "{captainName} is captain" + "I'll take it instead" (T1 claim) + status line per §5.2
delegation pending, I am requestedTo               → "{captainName} asked you to secure the court" + [Accept (T3)] [Decline (T4)]
delegation pending, I am requestedBy               → "Waiting for {opp} to accept captain duty" + [Withdraw (T5)]
match completed                                    → read-only summary; no action buttons (E11)
```

Captain identity is rendered **identically to both players** (name + "captain" badge + secured checkmark). The only differences are the *action buttons* (guarded by the transition table's Actor column).

### 6.3 `acceptProposal` (store.ts:930) — set provisional captain + venue atomically, conditionally

The confirm write is the single place the `court` object is *born*. **Create it only on first confirm** (`court === undefined`) so the reschedule-accept branch that runs inside the same function (existing `activeRescheduleRequest` handling at `store.ts:970`) never overwrites an existing captain/venue. Insert immediately after `match.schedule.confirmedSlot = nextSlot` (`store.ts:964`), **before** `saveAndSync`:

```ts
// types.ts:56 — proposedBy is 'system' | string. 'system' is used by the bulk auto-scheduler
// and the needs-accept tier (store.ts:807, 826, 1748, 1772) — the COMMON path. NEVER use it as captainId.
const nowIso = new Date().toISOString()

if (match.schedule.court === undefined) {
  // FIRST CONFIRM — create the court object.
  // Provisional captain = the HUMAN who proposed the time; if the proposal was system-generated,
  // the acceptor (who chose the slot) becomes provisional captain. Never the literal 'system'.
  const provisionalCaptain =
    (proposal.proposedBy && proposal.proposedBy !== 'system')
      ? proposal.proposedBy
      : acceptedBy
  // Invariant guard: captain must be a match participant.
  const captainId =
    (provisionalCaptain === match.player1Id || provisionalCaptain === match.player2Id)
      ? provisionalCaptain
      : acceptedBy
  match.schedule.court = {
    venueId: pickedVenueId ?? null,
    venueLabel: pickedVenueId === 'other' ? pickedVenueLabel : undefined,
    captainId,
    status: 'assigned',
    assignedBy: acceptedBy,
    assignedAt: nowIso,
  }
  addNotification({
    type: 'captain_assigned',
    recipientId: captainId,
    senderId: acceptedBy,
    message: "You're the court captain",
    detail: "You're on the court by default. Tap to hand it off.",
    relatedMatchId: matchId,
    relatedTournamentId: tournamentId,
  })
} else {
  // RESCHEDULE-ACCEPT (or re-confirm) — court already exists. Do NOT recreate (E6).
  // Keep captainId; new time ⇒ must re-secure.
  const court = match.schedule.court
  court.status = 'assigned'
  delete court.securedAt
  // If the reschedule reason is a court problem, the venue itself was the issue — clear it.
  if (acceptedRescheduleReason === 'court_issue') {
    court.venueId = null
    court.venueLabel = undefined
  }
}
```

- `acceptProposal` signature gains two optional params: `acceptProposal(tournamentId, matchId, proposalId, acceptedBy, pickedVenueId?, pickedVenueLabel?)`. Existing callers pass nothing → `venueId` starts `null` and the venue is chosen later via the picker. This keeps every current call site compiling.
- This is one write; the `court` object (or the E6 mutation) lands atomically with `status:'confirmed'` and rides the same `saveAndSync`. No second round-trip.
- `addNotification` is called here legally because §6.3 executes **inside `store.ts`**, where `addNotification` (private, `store.ts:3606`) is in scope. See §8 for the module-boundary rule that governs out-of-store emitters.
- If the accept flow surfaces the venue picker inline (recommended for the "aha" moment), the chosen `venueId` flows straight in here.

---

## 7. "Court secured" toggle

### Behavior
- One boolean, encoded as `court.status === 'secured'`. **Captain-owned:** only `court.captainId === me` can flip it (T6/T7). Non-captains see the flag read-only.
- Distinct from time confirmation: `schedule.status` ('confirmed') answers "do we agree on a time?"; `court.status` answers "is there a court?". They are orthogonal.
- Flipping to secured sets `securedAt`, auto-withdraws any pending delegation (E4), and emits a local `court_secured` (the opponent sees the ✓ via synced `court`, §8). Un-securing clears it silently. Changing venue on a secured court resets it to `assigned` (T8) so the captain re-confirms.

### The P0 guard — it must NEVER gate score entry
`canEnterScore` (`matchCapabilities.ts:7`) keys off `match.schedule?.status === 'confirmed'` (line 13). **Do not add any `court`/`secured` condition to `canEnterScore`, `canCorrectScore`, `canExpandMatch`, or any play/score gate.** A player can log a score whether or not a court was ever marked secured — people play on walk-on courts without ever touching the toggle. Adding `secured` to the gate would silently block legitimate scores (the exact trap called out in the brief).

Add a regression test that fails if anyone couples them:

```ts
// matchCapabilities.test.ts
it('court secured status does NOT gate score entry', () => {
  const base = confirmedMatchForPlayers('p1', 'p2') // schedule.status='confirmed', confirmedSlot set
  const unsecured = withCourt(base, { status: 'assigned', captainId: 'p1' })
  const secured   = withCourt(base, { status: 'secured', captainId: 'p1', securedAt: NOW })
  const noCourt   = base // court === undefined (legacy)
  expect(canEnterScore(unsecured, 'p1')).toBe(true)
  expect(canEnterScore(secured,   'p1')).toBe(true)
  expect(canEnterScore(noCourt,   'p1')).toBe(true) // legacy still enters score
})
```

---

## 8. Notifications — device-local, with court state as the cross-device source of truth

**Critical correction (P0).** `RallyNotification` is **in-memory-only React state**: RallyDataProvider labels the group *"Ephemeral state (no Supabase table — lost on refresh, and that's OK)"* (`RallyDataProvider.tsx:214`), `notifications` is `useState<RallyNotification[]>([])` (`:217`), there is **no notification helper in `sync.ts`**, and the `postgres_changes` subscription covers only `lobby`/`tournaments`/`availability`/`ratings` — **never notifications**. `addNotification` (`store.ts:3606`) is a **private, non-exported** function that unshifts into a local last-50 array. **Notifications therefore fire only on the actor's own device and vanish on refresh.**

So captain notifications are **not** the cross-device transport. The **only** thing that crosses devices is the synced `court` sub-object on `MatchSchedule`; the opponent "sees" a captain/venue/secured change because their confirmed card **re-renders from synced `court` data** (§9), not because a notification arrives. All captain/secured banners on a given device must be **derivable from `court` state**, so a missed local notification never leaves a permanent gap.

### Rules
1. **Every cross-device fact is read from `court`.** The dedicated `NotificationType`s (locked decision #7) exist for the actor's own in-app badge/toast and are best-effort, device-local side effects.
2. **Atomicity scope:** the `tournaments` write covers **only** the `court` sub-object. `addNotification` is a separate local store and is **outside** that transaction. To avoid divergence, emit the local notification **after** a successful (non-conflict) commit returns, and never depend on a notification for correctness — always re-derive banners from `court`.
3. **Module boundary (P0):** `addNotification` is private to `store.ts`. All notification-emitting court helpers (`claimCaptain`, `requestCaptainDelegation`, `respondCaptainDelegation`, `setCourtSecured`) **live in `store.ts`** alongside it. `matchCardModel.ts` and any other module **must not** call `addNotification`. For any store-external emission, add and export a dedicated `store.ts` function (e.g. `export function emitCourtNudge(matchId: string)`) and call that.

### Notification catalogue (all device-local)

| Type | Emitted when (transition) | On which device | Message / detail |
|---|---|---|---|
| `captain_assigned` | T0 (confirm), T1 (claim), T9 | actor's device | "You're the court captain" / "{name} is now court captain" |
| `captain_delegation_suggested` | T2 (delegate) | actor's device | "You asked {opp} to secure the court" (opponent sees the Accept/Decline prompt via synced `court.negotiation`) |
| `captain_handoff_accepted` | T3 (accept) | actor's device | "You took over as captain" |
| `captain_handoff_declined` | T4 (decline) | actor's device | "You declined captain duty" |
| `court_secured` | T6 | actor's device | "You secured a court ✓" |
| `court_unsecured_nudge` | see below | captain's device (or fallback claimant's) | "Your match is coming up — got a court?" |

Because banners are court-derived, the **opponent** still sees the right state (e.g. "{captainName} secured a court ✓") — it's rendered from synced `court.status`, not from a delivered notification.

### "Secure the court" prompt — driven by `court.status`, NOT a rolling weekday date (P0)

The draft's day-before nudge reused `slotToDate` (`matchCardModel.ts:126`), which only yields an absolute date when the slot carries a `week` field **and** `weekOneMonday` is set; otherwise it falls through to `resolveNextDate(slot.day)`, which returns the **next upcoming** occurrence of that weekday. `MatchSlot` is `{day, startHour, endHour}` with **no `week` field** (`types.ts:65`), so `confirmedSlot` rolls forward a week every time that weekday passes — a `0 < msUntil ≤ 24h` window would fire for a match a week away and never for the real one, and `relatedMatchId` dedupe would misbehave as the target date slid.

**Decision:** drop the timed "day-before" trigger from V1. Surface the "secure the court" prompt **purely from `court.status === 'assigned'`** on the confirmed card, for the captain:

- **Captain, `court.status === 'assigned'`:** the confirmed card shows statusLabel "Secure the court", supporting copy "Grab or reserve a court, then mark it secured.", primary action = the §5.2 captain CTA. No date math; the prompt is present whenever a captain has an unsecured court on a confirmed match.
- **Non-captain fallback:** when `court.status === 'assigned'`, the non-captain's card shows "Offer to secure it" → one-tap **claim** (T1). Copy: "{captainName} hasn't secured a court yet — want to take it?" This is just a claim, so it's immediate and reversible.
- `court_unsecured_nudge` is emitted **once per match** as a device-local badge when this card first renders for the captain, deduped by `relatedMatchId` in the last-50 list. It is emitted via the exported `emitCourtNudge` from `store.ts` (module-boundary rule above) — **never** by `matchCardModel.ts` calling `addNotification` directly.

*(If a future version adds a true absolute match date — e.g. persisting `slot.week` + week-one anchor at confirm time — a real time-windowed nudge can be layered on. Out of scope for V1.)*

The prompt never blocks anything; it is purely a reminder surface.

---

## 9. Sync & persistence

### Write path
1. Mutate the in-memory tournament's `match.schedule.court` inside a store helper (`claimCaptain`, `requestCaptainDelegation`, `respondCaptainDelegation`, `withdrawCaptainDelegation`, `setCourtSecured`, `setCourtVenue`, `initLegacyCourt`).
2. Persist + push via the appropriate commit wrapper:
   - **Claim / accept-handoff / legacy-or-orphan init** → `commitCaptainClaim` (§4.2, first-writer-wins).
   - **All other court writes** (venue T8, secure/un-secure T6/T7, delegate T2, decline T4, withdraw T5) → `commitCourtMutation` (§4.1, court-delta re-apply — **not** blind `saveAndSync`, which whole-tournament-clobbers on conflict).
3. Both wrappers call `syncTournament` with the cached `updated_at` and, on conflict, refresh remote and re-apply **only the court delta** for the specific match before retrying. Neither ever re-pushes a stale whole-tournament blob.

### Realtime propagation — precondition + failure mode (P1)
No new channel. RallyDataProvider's `postgres_changes` subscription on `tournaments` delivers the whole `data` blob (including nested `court`) to the opponent's device; the provider replaces the tournament in memory and the confirmed card re-renders with the new captain/venue/secured state.

**Precondition (must hold for the opponent to receive the change in realtime):** the subscription is **county-filtered** — `syncTournament` writes `county: tournament.county.toLowerCase()` (`sync.ts:32`) and the channel filters on the **subscriber's** `profile.county.toLowerCase()` (`RallyDataProvider.tsx`). Court sync reaches the opponent **only if both participants' active realtime channel matches the tournament's stored (lowercased) county.**

**Failure mode:** if the two players' profile counties differ in casing/spelling from the tournament's stored county (or a legitimately out-of-county player is participating), one device will **not** receive the `postgres_changes` event; the change reconciles only on the next manual refresh/refetch. This is a pre-existing property of the realtime layer, not introduced here — but court UX must degrade gracefully (state is still correct after any refresh; nothing is lost). The Marin gate (§12) keys on **tournament** county, not viewer county, so a valid out-of-county participant still gets the UI (their realtime may lag until refresh).

### Offline retry
`commitCourtMutation` / `commitCaptainClaim` inherit `saveAndSync`'s offline behavior: on network error (non-conflict) the change is kept locally (`bridgeSetTournaments([...all])`) and the standard "Changes saved locally but may not sync until you're back online" toast shows (`store.ts:1432/1438`). The next successful sync/refresh reconciles; for claims, first-writer-wins keeps the earliest volunteer.

### Hard prohibition
Court negotiation **must not** call `loadBroadcasts`/`saveBroadcasts`/`loadOffers`/`saveOffers` or touch `MatchBroadcast`/`MatchOffer`. Those are localStorage-only, never cross devices, and would recreate the exact bug this feature exists to avoid. Grep gate in review: **no new references to `Broadcast`/`Offer` symbols from court code.**

---

## 10. Edge cases & failure modes

| # | Case | Behavior |
|---|---|---|
| E1 | **Cold-start / captain vacuum** | Prevented by T0: confirmation always sets a provisional captain — the human proposer, or the **acceptor** when the proposal was `'system'`-generated (the common auto/needs-accept path). Never `'system'`. There is never a "no one is captain" limbo on a fresh confirm. |
| E2 | **Unsecured at match time** | Play/score are never gated (§7). The court-state prompt (§8) nudges the captain; if still unsecured, players just walk on (Marin default). Post-match, normal score-decay reminders fire. |
| E3 | **Hand-off declined (T4)** | captainId unchanged; original captain stays on the hook (local `captain_handoff_declined` on the decliner's device; original captain's card re-derives "still captain" from synced `court`). Negotiation deleted. No dead state. |
| E4 | **Delegation pending, captain secures (T6)** | **Auto-withdraw** the pending delegation when the captain secures (baked into T6). Keeps state simple: you secured it yourself, so the ask is moot. |
| E5 | **Venue changed after captain/secured set (T8)** | Venue is jointly editable. Changing it on a `secured` court resets to `assigned` (must re-secure) so "secured" never lies about a stale venue. captainId unchanged. |
| E6 | **Reschedule interaction (`court_issue`)** | Handled inside `acceptProposal`'s existing reschedule-accept branch, in the `else` path of §6.3 (court already exists ⇒ **not** recreated): **keep captainId, reset `status` to `assigned`, delete `securedAt`.** If reason is `court_issue`, additionally **null `venueId`/`venueLabel`** (the venue was the problem) and prompt re-pick. A plain time reschedule keeps the venue. |
| E7 | **Members-only / key-required selected anyway** | Fully allowed (selectable via "show all"). No profile check (deferred). Barrier copy (§5.2) is the only guardrail; the captain self-asserts eligibility. `feeNote`/`keyNote` stay visible as an honest reminder. |
| E8 | **Paid venue** | `isPaidVenue(v)` reads the explicit `v.isPaid` field; card shows "captain pays {fee}". No payment handling — deferred (§12). Paid venues stay out of default suggestions (`inDefaults:false`); test enforces no `inDefaults:true` venue is `isPaid`. |
| E9 | **Simultaneous claims** | Resolved by `commitCaptainClaim` first-writer-wins (§4.2), detected against the **pre-write** captainId; loser adopts remote and sees "{winner} already volunteered." |
| E10 | **Legacy confirmed match (no `court`)** | Renders "Set who secures the court" (T9); first tapper becomes captain via `commitCaptainClaim`/`ensureCourt`. No backfill. |
| E11 | **Match completed / score reported while delegation pending** | Court UI collapses to read-only on completed matches (mirror existing schedule read-only at `MatchSchedulePanel.tsx:475`). Any pending delegation is inert; no further notifications. |
| E12 | **Orphaned captain (captainId ∉ participants, or player removed)** | Modeled as the derived `orphaned-captain` state (§3.1). CaptainCard renders the "Set who secures the court" affordance; any remaining participant claims via T9 (`ensureCourt` repairs `captainId = me`). *(If player-removal mid-tournament is impossible in V1, this state simply never occurs — but it is handled defensively rather than left as an unenumerated read state.)* |
| E13 | **System-proposed slot accepted** | `proposal.proposedBy === 'system'` ⇒ provisional captain = acceptor (§6.3). Notification recipient is the acceptor, never `'system'`. Covered by a dedicated §11 test. |
| E14 | **Doubles tournament** | Court negotiation is singles-only in V1. `<CaptainCard>`/`<VenuePicker>` are not rendered when `tournament.mode === 'doubles'` (§6.1). Captaincy across four humans is out of scope (§12). |

---

## 11. Test plan

### Unit (Vitest)
1. **P0 (system + invariant):** `acceptProposal` sets `court.captainId ∈ {player1Id, player2Id}` and never `'system'` — assert for a **human**-proposed slot (`captainId === proposal.proposedBy`) **and** a `'system'`-proposed slot (`captainId === acceptedBy`); both fire `captain_assigned` to a real participant. (T0/E13)
2. `claimCaptain` flips `captainId` to caller, updates `assignedBy/assignedAt`, deletes any pending delegation. (T1)
3. `requestCaptainDelegation` writes a `pending` negotiation, leaves `captainId` unchanged, emits `captain_delegation_suggested`. Guard: non-captain caller is a no-op. (T2)
4. `respondCaptainDelegation('accept')` transfers captaincy, sets `handedOffAt`, **deletes** negotiation, emits `captain_handoff_accepted`; only `requestedTo` may accept. (T3)
5. `respondCaptainDelegation('decline')` leaves captaincy, deletes negotiation, emits `captain_handoff_declined`. (T4)
6. `withdrawCaptainDelegation` only by `requestedBy`; deletes negotiation silently. (T5)
7. `setCourtSecured(true/false)` guarded to captain; toggles `status` + `securedAt`; on true, auto-withdraws any pending delegation and emits `court_secured`. (T6/T7/E4)
8. `setCourtVenue` on a secured court resets to `assigned` and clears `securedAt`. (T8/E5)
9. **P0:** `canEnterScore` is `true` for assigned, secured, and no-court confirmed matches (§7 test). Guards it can never regress.
10. `defaultVenues().length === 12`; `allSelectableVenues().length === 25`; `getVenue('mcinnis-park').feeNote` mentions "$13" and `isPaid === true`; `isPaidVenue` true for McInnis/Marinship, false for Boyle; **no `inDefaults:true` venue has `isPaid:true`**.
11. `isMarinCounty('Marin County, CA') === true` (exact stored literal); `isMarinCounty('marin') === true`; `isMarinCounty('Napa County, CA') === false`. (§2.3 gate)
12. Backward-compat: a tournament blob with `court === undefined` round-trips through `load()`/commit unchanged and renders the legacy "Set who secures the court" path.
13. Reschedule-accept keeps `captainId`, resets to `assigned` + clears `securedAt`; `court_issue` reason also nulls `venueId`; a first confirm on the SAME match does NOT double-create/overwrite the court. (§6.3/E6)
14. Orphaned court (captainId ∉ participants) renders the "Set captain" path and `ensureCourt` repairs `captainId = me` on claim. (E12)

### Integration (store + sync, mocked Supabase)
15. `commitCaptainClaim` first-writer-wins: remote `updated_at` moved AND remote `captainId !== expectedPrevCaptainId && !== me` → `{ ok:false, winnerId: other }` and the **bridge is updated** to the winner's state (loser no longer shows self as captain). (§4.2/E9)
16. `commitCaptainClaim` no-competing-claim conflict: remote moved but captain unchanged → re-applies our claim onto refreshed state, splices bridge, retries, `{ ok:true }`.
17. `commitCourtMutation` conflict: a concurrent write to a **different** match in the same tournament moved the row → our court delta is re-applied onto the refreshed blob and the other match's change is **preserved** (no whole-tournament clobber). (§4.1)
18. Offline: `syncTournament` returns network error → change persisted locally, no throw, error toast shown. (§9)
19. Notification dedupe: `court_unsecured_nudge` for the same `relatedMatchId` isn't added twice. Module boundary: `emitCourtNudge` is exported from `store.ts` and `matchCardModel.ts` never imports `addNotification`.

### Cross-device manual test (the thing broadcasts/offers fail at)
Two devices, two accounts (Pascal + a DEV test player), **both profiles in Marin**, same tournament, same match confirmed:
20. **Device A** picks venue "Boyle Park" → **Device B** sees "Boyle Park" on the confirmed card AND on B's Home/Bracket summary within realtime latency (proves venue crosses devices to the non-actor's surfaces — the exact failure of `MatchBroadcast`).
21. **Device B** taps "I'll take it instead" (claim) → **Device A**'s card and Home/Bracket summary show "{B} is captain" (proves captain crosses devices, immediately, on the non-actor's surfaces).
22. **Device A** taps "Can you take this one?" (delegate) → **Device B** sees an Accept/Decline prompt (rendered from synced `court.negotiation`); B accepts → **Device A** sees "{B} took over" (proves the negotiation round-trip crosses devices).
23. **Device A** and **Device B** tap "I'll be captain" within ~1s → exactly one wins; the loser adopts remote and sees "{winner} already volunteered" (proves first-writer-wins concurrency, no data loss, loser bridge updated).
24. Captain marks "Court secured" → other device shows secured ✓ (rendered from synced `court.status`).
25. **P0 live check:** with court left **unsecured**, both players can still open score entry and log a score (proves the toggle never gates play).

---

## 12. Rollout & scope

### Marin V1 cut (in scope)
- `court` sub-object + `marinVenues.ts` (Appendix A) with explicit `isPaid`.
- Provisional captain at confirm (human proposer, or acceptor for `'system'` proposals); claim (immediate — "volunteer yourself") + delegate (accept-required) negotiation.
- Synced venue picker (defaults / show-all / other) with honest per-method copy.
- Captain-owned "Court secured" toggle, never gating score.
- 6 device-local notification types + court-state-driven "secure the court" prompt with claim fallback.
- Court-delta-preserving concurrency for all court writes; first-writer-wins for claims.
- Singles only.

### Deferred (explicitly out)
- Any real booking/reservation API integration (we deep-link out only).
- Payments / cost-splitting for paid venues (McInnis, Marinship) — captain-pays note only.
- Geo / "closer venue" ranking (Marin is county-local).
- Alternating-captain rotation across a round-robin series (captain is per-match).
- Persisted membership/eligibility profile flag (members-only/keyed are self-asserted).
- **Doubles court negotiation.** Captain is one of the two match participant ids (`player1Id`/`player2Id`); captaincy across four humans is undefined in V1. Hide captain/venue UI when `tournament.mode === 'doubles'`.
- **Cross-device notification delivery.** Notifications are device-local (§8); a synced notifications table + realtime subscription is a separate future PR if push-to-opponent is ever required. Court state itself already crosses devices.
- **Time-windowed day-before nudge.** Requires persisting an absolute match date (`slot.week` + week-one anchor); V1 uses court-state-driven prompts instead (§8).

### Gating / feature flag
- No server flag needed (no schema change). Gate the UI behind a client constant `COURT_NEGOTIATION_ENABLED` **and** `isMarinCounty(tournament.county)` (§2.3) — keyed on the **tournament's** stored county (full census form, e.g. `'Marin County, CA'`), **not** a naive `=== 'marin'` (which never matches and would ship dark) and **not** the viewer's county (which would hide the UI from a legitimately-participating out-of-county player). Non-Marin tournaments keep today's behavior. Reversible via one constant; venue directory stays Marin-scoped.
- Ship to `staging` first; verify cross-device tests 20–25 on `staging.play-rally.com` (and via `npm run ios:test` on device) before any `main` merge.

### Success metric (single)
Instrument the funnel and watch one thing: **conditional lift** — for matches where `court.venueId` and `court.captainId` are both set, does the "score logged" rate exceed matches where they aren't? Emit lightweight funnel events (or derive from stored `court`/`scoreReportedAt` timestamps) for `time-confirmed → venue-set → captain-set → secured → score-logged`. If setting venue+captain doesn't lift score-logging, the feature isn't earning its complexity.

---

## Changes from review

Material hardening applied after three adversarial reviews (senior-eng sync/concurrency lens, completeness/conformance lens, plus the P2 hygiene passes). Each item is a real code-verified fix, not cosmetic:

- **P0 — Provisional captain could become the literal `'system'`.** The common auto/needs-accept path creates proposals with `proposedBy: 'system'` (verified: `types.ts:56`, `store.ts:807/826/1748/1772`). §6.3 now sets `provisionalCaptain = proposedBy !== 'system' ? proposedBy : acceptedBy`, with an invariant guard that `captainId ∈ {player1Id, player2Id}`. Restores locked decision #1 and the E1 no-vacuum guarantee. New tests #1/E13.
- **P0 — Marin feature gate could never turn true (feature shipped dark).** County is stored as `'Marin County, CA'` (verified: `counties.ts`), so `=== 'marin'` is always false. Replaced with a shared, unit-tested `isMarinCounty()` helper (§2.3) gating on **tournament** county. New test #11.
- **P0 — Captain notifications cannot cross devices.** `RallyNotification` is ephemeral React state with no Supabase table and no realtime sub (verified: `RallyDataProvider.tsx:214/217`); `addNotification` is private (`store.ts:3606`). §8 rewritten: notifications are **device-local**; the **synced `court` object is the sole cross-device transport**, and all banners are re-derived from `court` state. Module-boundary rule added (store-external code, incl. `matchCardModel.ts`, must use an exported `emitCourtNudge`, not `addNotification`).
- **P0 — `saveAndSync` conflict path is a whole-tournament last-writer-wins clobber, not a merge.** Verified against `store.ts:1414`/`sync.ts:227`. Introduced `commitCourtMutation` (§4.1) so **all** non-claim court writes re-apply only the court delta onto refreshed remote state; the "plain saveAndSync is fine" claim is removed. New test #17.
- **P0 — `commitCaptainClaim` never wrote adopted remote back, and detected conflicts against the wrong baseline.** Rewritten (§4.2): (a) `bridgeSetTournaments([...merged])` actually adopts the winner's state on the losing device; (b) competing-claim detection compares to the **pre-write `expectedPrevCaptainId`**, not `proposerOf(match)` (which equals the proposer/default captain and would false-negative and clobber). `proposerOf` removed. New tests #15/#16.
- **P0 — Day-before nudge rode a rolling weekday date.** `slotToDate` falls through to `resolveNextDate(slot.day)` because `MatchSlot` has no `week` field (verified: `types.ts:65`, `matchCardModel.ts:126`), so it never anchors to the real match. Dropped the timed nudge; the "secure the court" prompt is now driven purely by `court.status === 'assigned'` (§8). Time-windowed nudge deferred to a version that persists an absolute date.
- **P1 — `acceptProposal` double-path.** T0/§6.3 court creation is now **conditional on `court === undefined`**, with the reschedule-accept branch handled in an explicit `else` that keeps `captainId`, resets to `assigned`, clears `securedAt`, and nulls `venueId` only for `court_issue`. Fixes the overwrite that contradicted E6. New test #13.
- **P1 — Opponent-visibility was asserted but not audited.** Added §6.1a cross-surface audit (expanded panel + Home card + Bracket `ScheduleSummary`) and asserted non-actor visibility in cross-device tests #20/#21.
- **P1 — Realtime county precondition.** §9 now states the explicit precondition (both participants' channel county must match the tournament's lowercased county) and the graceful-degradation failure mode; the gate keys on tournament (not viewer) county.
- **P1 — Notification/court atomicity overstated.** §8 clarifies the `tournaments` write covers only `court`; notifications are best-effort local side effects emitted after a successful commit, and every banner is re-derivable from `court`.
- **P1 — Orphaned-captain read state.** Added to the state machine (§3.1) and CaptainCard branches (§6.2) with `ensureCourt` repair (E12), instead of an unenumerated read state.
- **P1 — "Volunteer yourself" clarity.** §3.2 states explicitly that the T1 claim IS volunteering (immediate, reversible), so the absence of a `'volunteer'` negotiation kind is intentional, not a gap vs decision #1.
- **P2 — Paid-venue detection.** Replaced the brittle `/pays|paid|\$/i` regex over free-text `feeNote` with an explicit `isPaid: boolean` field on `MarinVenue`; `feeNote` is display-only. Test enforces `inDefaults` ⇏ `isPaid`.
- **P2 — Appendix A count reconciled** to exactly **12 default / 13 non-default = 25**, with tests asserting the literal counts.
- **P2 — Doubles guard.** Court UI hidden for `tournament.mode === 'doubles'`; singles-only stated in non-goals (§12).

---

## Appendix A — `marinVenues.ts` (full literal)

`inDefaults:true` **12** venues (free walk-on + free reserve-online) · `inDefaults:false` **13** (paid / members-only / key-required) · **25 total**. No `inDefaults:true` venue is `isPaid:true`.

```ts
// apps/play-tennis/src/marinVenues.ts
import { ReservationMethod, VenueAccessType } from './types'

export interface MarinVenue {
  id: string
  name: string
  city: string
  accessType: VenueAccessType
  reservationMethod: ReservationMethod
  reservationUrl?: string
  feeNote?: string        // display copy only
  keyNote?: string
  isPaid: boolean         // explicit money semantics
  inDefaults: boolean
}

export const MARIN_VENUES: MarinVenue[] = [
  { id: 'albert-park', name: 'Albert Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '4 courts · free first-come-first-served (key fee removed)', isPaid: false, inDefaults: true },
  { id: 'freitas-park', name: 'Freitas Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'peacock-gap', name: 'Peacock Gap Park', city: 'San Rafael', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '2 courts', isPaid: false, inDefaults: true },
  { id: 'mcinnis-park', name: 'McInnis Park', city: 'San Rafael', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://reserve.marincountyparks.org', feeNote: '$13/hr, 2hr min, up to 5mo ahead — captain pays', isPaid: true, inDefaults: false },
  { id: 'marin-tennis-club', name: 'Marin Tennis Club', city: 'San Rafael', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'boyle-park', name: 'Boyle Park', city: 'Mill Valley', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '6 courts · popular drop-in', isPaid: false, inDefaults: true },
  { id: 'eastwood-park', name: 'Eastwood Park', city: 'Mill Valley', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '2 tennis courts (pickleball overlay)', isPaid: false, inDefaults: true },
  { id: 'strawberry-rec', name: 'Strawberry Rec District', city: 'Mill Valley (Strawberry)', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'pioneer-park', name: 'Pioneer Park', city: 'Novato', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: 'Open 6a–10p', isPaid: false, inDefaults: true },
  { id: 'bay-club-rolling-hills', name: 'Bay Club Rolling Hills', city: 'Novato', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'larkspur-courts', name: 'Larkspur Courts', city: 'Larkspur', accessType: 'public-free', reservationMethod: 'walk-on', feeNote: '8 courts · free drop-in', isPaid: false, inDefaults: true },
  { id: 'corte-madera-town-park', name: 'Corte Madera Town Park', city: 'Corte Madera', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://rec.us/cortemadera', feeNote: 'Free reservable + open play 10a–1p', isPaid: false, inDefaults: true },
  { id: 'granada-park', name: 'Granada Park', city: 'Corte Madera', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://rec.us/cortemadera', feeNote: 'Free', isPaid: false, inDefaults: true },
  { id: 'marinship-park', name: 'Marinship Park', city: 'Sausalito', accessType: 'public-reservable', reservationMethod: 'reserve-online', reservationUrl: 'https://www.sausalito.gov/departments/parks-recreation', feeNote: 'Paid, up to 90 days ahead — captain pays', isPaid: true, inDefaults: false },
  { id: 'the-ranch-tiburon', name: 'The Ranch', city: 'Tiburon', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Annual key required to use online reservations', isPaid: false, inDefaults: false },
  { id: 'tiburon-linear-park', name: 'Tiburon Linear Park', city: 'Tiburon', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'tiburon-peninsula-club', name: 'Tiburon Peninsula Club', city: 'Tiburon', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'belvedere-tennis-club', name: 'Belvedere Tennis Club', city: 'Belvedere/Tiburon', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'memorial-park-sa', name: 'Memorial Park', city: 'San Anselmo', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Annual key $41 resident / $98 non-resident, bought in person', isPaid: false, inDefaults: false },
  { id: 'robson-harrington', name: 'Robson Harrington Park', city: 'San Anselmo', accessType: 'public-reservable', reservationMethod: 'key-required', keyNote: 'Same annual key as Memorial Park', isPaid: false, inDefaults: false },
  { id: 'canon-swim-tennis', name: 'Canon Swim & Tennis Club', city: 'Fairfax', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'ross-commons', name: 'Ross Commons', city: 'Ross', accessType: 'public-free', reservationMethod: 'walk-on', isPaid: false, inDefaults: true },
  { id: 'lagunitas-cc', name: 'Lagunitas Country Club', city: 'Ross', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'bay-club-ross-valley', name: 'Bay Club Ross Valley', city: 'San Anselmo', accessType: 'private-club', reservationMethod: 'members-only', isPaid: false, inDefaults: false },
  { id: 'college-of-marin', name: 'College of Marin (Kentfield)', city: 'Kentfield', accessType: 'school', reservationMethod: 'school-walk-on', feeNote: 'Public sunrise–sunset when not in class use · 6 courts', isPaid: false, inDefaults: true },
]

export function isMarinCounty(county: string | null | undefined): boolean {
  if (!county) return false
  const c = county.trim().toLowerCase()
  return c === 'marin county, ca' || c === 'marin' || c.startsWith('marin county')
}

export function getVenue(id: string | null | undefined): MarinVenue | undefined {
  if (!id || id === 'other') return undefined
  return MARIN_VENUES.find(v => v.id === id)
}
export function defaultVenues(): MarinVenue[] { return MARIN_VENUES.filter(v => v.inDefaults) }
export function allSelectableVenues(): MarinVenue[] { return MARIN_VENUES }
export function isPaidVenue(v: MarinVenue): boolean { return v.isPaid }
```

**Directory count (authoritative — array is the single source of truth):** 25 venues.
- `inDefaults:true` (**12**): albert-park, freitas-park, peacock-gap, boyle-park, eastwood-park, pioneer-park, larkspur-courts, corte-madera-town-park, granada-park, tiburon-linear-park, ross-commons, college-of-marin.
- `inDefaults:false` (**13**): mcinnis-park, marin-tennis-club, strawberry-rec, bay-club-rolling-hills, marinship-park, the-ranch-tiburon, tiburon-peninsula-club, belvedere-tennis-club, memorial-park-sa, robson-harrington, canon-swim-tennis, lagunitas-cc, bay-club-ross-valley.
- `isPaid:true` (**2**): mcinnis-park, marinship-park (both `inDefaults:false`).

---

### Implementation note on verified symbols
Every file:symbol anchor in this spec was read and confirmed against the current tree:
- `MatchSchedule` `types.ts:107`, `MatchSlot` `types.ts:65` (no `week` field — drives the §8 nudge decision), `RescheduleRequest` `types.ts:82`, `MatchProposal.proposedBy: 'system' | string` `types.ts:56` (the `'system'` value drives the §6.3 P0 fix; used at `store.ts:807/826/1748/1772`).
- `acceptProposal` `store.ts:930` (court insert after `confirmedSlot` at `:964`; reschedule-accept branch at `:970`), `saveAndSync` `store.ts:1414` (conflict = whole-tournament clobber, §4), `addNotification` **private** `store.ts:3606` (module-boundary rule, §8).
- `syncTournament` `sync.ts:26`/`:32`/`:41`/`:52`, `refreshTournamentById` `sync.ts:227` (returns fresh state, does not write bridge — §4).
- `canEnterScore` `matchCapabilities.ts:7`/`:13`, `canExpandMatch` `matchCapabilities.ts:30`, `getVenueSuggestion` `MatchSchedulePanel.tsx:83`/render `:486`/read-only `:475`, `UpcomingMatchPanel.tsx:35`.
- `RallyNotification`/`NotificationType` `types.ts:361-363`, ephemeral-notification state `RallyDataProvider.tsx:214/217`, `slotToDate`/`resolveNextDate` `matchCardModel.ts:126`, decay thresholds `matchCardModel.ts:429-452`.
- County storage: full census form `'Marin County, CA'` in `counties.ts` (drives §2.3 `isMarinCounty`). `MatchBroadcast`/`MatchOffer` localStorage-only at `types.ts:257-344` / `store.ts:3418` (the prohibited path, §9).