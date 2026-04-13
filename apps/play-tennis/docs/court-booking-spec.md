# PART 2: DETAILED SPEC DOCUMENT

# Court Booking Coordination — V3 Final Spec

*Co-authored by Maya (UI), James (UX), Sarah (PM), Dev (Engineering Lead)*

*Last updated after User Panel Round 3 — all feedback incorporated*

---

## 1. Feature Overview

**Elevator Pitch (Sarah):** Court booking coordination lets Rally tournament players set up where they're playing directly on their match cards. Players save their home courts to their profile, the app auto-suggests venues for each match, and booking responsibility is handled implicitly — no extra workflow, no forced roles, no separate tab.

**Goals:**
- Eliminate the "where are we playing?" text thread that precedes every recreational match
- Make court setup take fewer than 10 seconds for matches between players who have profiles set up
- Surface cost and guest logistics before match day, not day-of
- Maintain Rally's design philosophy: data-forward, progressive disclosure, no forced workflows

**Non-Goals:**
- No real-time court availability or inventory integration (no API to public park systems)
- No payment processing or cost splitting
- No court rating or review system
- No map embed or in-app navigation (use deep links to Maps)
- No mandatory booking gate — matches can happen with no court set

---

## 2. Data Model Changes

**Dev:**

### 2.1 New Type: `Court`

```typescript
interface Court {
  id: string;                    // UUID, generated client-side
  venue_name: string;            // Required. Max 100 chars. e.g. "Riverside Park Courts"
  label?: string;                // Optional. Max 50 chars. e.g. "Court 3 (the shaded one)"
  booking_needed: boolean;       // Does this court require advance booking?
  cost_applies: boolean;         // Does playing here cost money?
  cost_description?: string;     // If cost_applies=true. Max 100 chars. e.g. "$8/hr per person"
  covers_guests: boolean;        // If cost_applies=true: does the owner cover guest fees?
  guest_instructions?: string;   // Max 300 chars. e.g. "Meet me in lobby at 9:45, I sign you in"
  notes?: string;                // Max 300 chars. General notes. e.g. "Bring water, no fountain"
  directions_url?: string;       // Optional Maps/Google Maps link. Max 500 chars.
  always_play_here: boolean;     // "I always want to play here" toggle
  sort_order: number;            // 0-indexed. Used for profile ordering and auto-suggest priority
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}
```

### 2.2 Profile Extension: `PlayerProfile.courts`

```typescript
interface PlayerProfile {
  // ... existing fields ...
  courts: Court[];               // Max 3 courts. Ordered by sort_order.
}
```

### 2.3 New Type: `MatchCourt`

Stored on each match in the tournament data structure.

```typescript
interface MatchCourt {
  venue_name: string;              // The selected venue name
  label?: string;                  // Optional court label
  court_id?: string;               // Reference to Court.id if from a profile (null for inline entries)
  source: 'auto' | 'player';      // How was this court set?
  suggested_by?: string;           // player_id of who suggested it (null for 'auto')
  confirmed: boolean;              // Has the opponent confirmed?
  confirmed_by?: string;           // player_id who confirmed
  confirmed_at?: string;           // ISO 8601
  booking_needed: boolean;
  booking_claimed: boolean;        // Has someone claimed booking responsibility?
  booking_claimed_by?: string;     // player_id
  booking_confirmed: boolean;      // Has the booker confirmed the booking is done?
  cost_applies: boolean;
  cost_description?: string;
  covers_guests: boolean;
  guest_instructions?: string;
  notes?: string;
  directions_url?: string;
  created_at: string;
  updated_at: string;
}
```

### 2.4 New Type: `InlineCourt`

For courts entered directly on a match card without saving to profile.

```typescript
interface InlineCourt {
  venue_name: string;            // Required. Max 100 chars.
  notes?: string;                // Max 300 chars.
  save_to_profile: boolean;      // User's choice to persist this to their Court[] array
}
```

### 2.5 Supabase Schema Changes

**New columns on `lobby` table (player profile):**

```sql
ALTER TABLE lobby ADD COLUMN courts JSONB DEFAULT '[]'::jsonb;
```

**New columns on tournament match data:**

Matches are stored as JSONB within the `tournaments` table. The `MatchCourt` structure is added as a `court` field on each match object within the tournament's `matches` array.

**Migration plan:**
1. Add `courts` column to `lobby` table (default empty array, no existing data affected)
2. No migration needed for tournament matches — they're JSONB, new matches get the field, old matches remain null
3. Client code treats `match.court === undefined` as "no court set" (empty state)

### 2.6 Sync Considerations

**Dev:** Court data follows the existing sync pattern: write to memoryStore first, then sync to Supabase via the `sync.ts` layer. Courts on player profiles sync with the lobby table. Courts on matches sync with the tournament data.

Realtime subscription on the `tournaments` table already exists. When Player A confirms a court, Player B sees the update via the existing Supabase realtime channel — no new subscription needed.

---

## 3. Profile: "Your Courts"

### 3.1 Location in App

**Maya:** Located in the Availability tab (formerly Profile), below the availability editor. New section header: "Your Courts."

**Placement rationale:** Courts are part of player logistics, same as availability. Keeping them on the same tab avoids a new navigation destination.

### 3.2 Section Header

**Visual spec:**
- Section title: "Your Courts" — `font-size: var(--font-size-lg)`, `font-weight: 600`, `color: var(--color-text-primary)`
- Subtitle: "Add your favorite courts so matches auto-fill." — `font-size: var(--font-size-sm)`, `color: var(--color-text-secondary)`
- "Add Court" button: right-aligned with header, secondary style, `+ Add Court` label
- Button disabled with tooltip "Maximum 3 courts" when 3 courts exist

### 3.3 Empty State

**James:** When no courts are saved:

```
[Icon: tennis court outline, 48x48, color: var(--color-text-tertiary)]

Your courts will show up here

Add your favorite courts so we can auto-suggest venues
for your matches. You can also set one up on any match card.

[+ Add a Court]  (primary button)
```

- Container: `var(--color-surface)`, `var(--radius-md)`, `padding: 24px`, center-aligned
- Icon: line-art tennis court, decorative only (aria-hidden)
- Body text: `font-size: var(--font-size-sm)`, `color: var(--color-text-secondary)`, max-width 280px

### 3.4 Court Card (Saved Court)

**Maya:** Each saved court renders as a card within the "Your Courts" section.

**Layout:**
```
┌─────────────────────────────────────────────┐
│  🏟 Riverside Park Courts                  │
│  Court 3 (the shaded one)                   │
│                                             │
│  No booking needed · Free                   │
│  "Bring water, no fountain nearby"          │
│                                             │
│  ☐ I always want to play here               │
│                                             │
│  [Directions ↗]        [Edit] [Delete]      │
└─────────────────────────────────────────────┘
```

**Specifications:**
- Card: `var(--color-surface)`, `var(--radius-md)`, `var(--shadow-sm)`, `padding: 16px`
- Venue name: `font-size: var(--font-size-md)`, `font-weight: 600`
- Label: `font-size: var(--font-size-sm)`, `color: var(--color-text-secondary)`, displayed below venue name
- Status line: `font-size: var(--font-size-xs)`, `color: var(--color-text-secondary)`
  - Booking: "No booking needed" or "Booking required"
  - Cost: nothing if free, or cost_description value (e.g. "$8/hr per person")
  - Separator: ` · ` between items
- Notes: `font-size: var(--font-size-xs)`, `color: var(--color-text-secondary)`, italic, displayed in quotes
- "Always play here" toggle: standard toggle component, label `font-size: var(--font-size-sm)`
- Directions link: `font-size: var(--font-size-sm)`, `color: var(--color-accent)`, opens in Maps app via deep link
- Edit/Delete: icon buttons, `var(--color-text-tertiary)`, 24x24 tap target minimum 44x44

**Card ordering:** Cards render in `sort_order` sequence. Drag-to-reorder supported (reorder updates `sort_order` values).

### 3.5 Add/Edit Court Form

**James:** Modal sheet (bottom sheet on mobile). Same form for add and edit.

**Fields (in order):**

| Field | Type | Required | Validation | Max Length |
|-------|------|----------|------------|------------|
| Venue name | Text input | Yes | Non-empty, trimmed | 100 chars |
| Label | Text input | No | Trimmed | 50 chars |
| Booking needed | Toggle | Yes (default: No) | — | — |
| Does this cost anything? | Toggle | Yes (default: No) | — | — |
| Cost description | Text input | If cost=Yes | Non-empty when visible | 100 chars |
| I cover guests | Checkbox | If cost=Yes | — | — |
| Guest instructions | Textarea | No | — | 300 chars |
| Notes | Textarea | No | — | 300 chars |
| Directions link | URL input | No | Valid URL if provided | 500 chars |
| I always want to play here | Toggle | Yes (default: No) | — | — |

**Form behavior:**
- Cost description and "I cover guests" only visible when "Does this cost anything?" is toggled on
- Character count shown below Guest instructions and Notes fields (e.g., "42/300")
- Directions link: helper text "Paste a Google Maps or Apple Maps link"
- "Save" button: primary, disabled until venue_name is non-empty
- "Cancel" button: secondary, confirms discard if form has unsaved changes

**Validation errors:**
- Empty venue name on save attempt: inline error "Enter a venue name", field highlighted red
- Invalid URL in directions: inline error "Enter a valid URL", shown on blur

**Edit mode:** Pre-fills all fields. "Save" updates existing court. "Delete" button visible in edit mode with confirmation dialog: "Remove [Venue Name] from your courts? This won't affect matches where it's already set."

### 3.6 "Always Play Here" Toggle Behavior

**James:**
- Only one court can have "always play here" enabled at a time
- Toggling it on for Court B automatically toggles it off for Court A
- When toggled on, brief toast: "Matches will default to [Venue Name] when possible"
- When toggled off: no toast, silent
- This toggle feeds the suggestion algorithm (see Section 5)

### 3.7 Court Limit

**Sarah:** Maximum 3 courts per player in V1. Limit chosen based on user research — no panelist across 3 rounds needed more than 3.

When user has 3 courts and taps "Add Court": "You can save up to 3 courts. Remove one to add a new one."

---

## 4. Match Card: Court Section

### 4.1 Placement on Match Card

**Maya:** The court section sits below the match score area (or match time/date if unplayed) and above the quick message shortcuts. It's part of the existing match card — no new component or screen.

### 4.2 Chip States

**Maya:** The court section has two layers: a collapsed chip (always visible) and an expandable detail area.

**State 1: No Court (Gray chip)**
```
┌──────────────────────────┐
│  ○  No court yet         │
└──────────────────────────┘
```
- Background: `var(--color-surface-secondary)` (light gray)
- Text: `var(--color-text-secondary)`
- Icon: empty circle outline, 16x16
- Tap: expands to show empty state detail area

**State 2: Suggested (Blue chip)**
```
┌──────────────────────────────────────┐
│  ◐  Suggested: Riverside Park       │
└──────────────────────────────────────┘
```
- Background: `var(--color-info-surface)` (light blue)
- Text: `var(--color-info-text)`
- Icon: half-filled circle, 16x16
- Tap: expands to show suggestion detail area

**State 3: Confirmed (Green chip)**
```
┌──────────────────────────────────────┐
│  ●  Riverside Park ✓                │
└──────────────────────────────────────┘
```
- Background: `var(--color-success-surface)` (light green)
- Text: `var(--color-success-text)`
- Icon: filled circle, 16x16
- Checkmark: `var(--color-success-text)`
- Tap: expands to show confirmed detail area

**State 4: Conflict — Both Want to Host (Amber chip)**
```
┌──────────────────────────────────────────┐
│  ◑  Both have home courts — pick one    │
└──────────────────────────────────────────┘
```
- Background: `var(--color-warning-surface)` (light amber)
- Text: `var(--color-warning-text)`
- Icon: split circle, 16x16
- Tap: expands to show dual-venue picker

**All chips:**
- Height: 36px
- Border radius: `var(--radius-full)` (pill shape)
- Padding: `4px 12px`
- Font: `var(--font-size-sm)`, `font-weight: 500`
- Chevron: right side, rotates 90° on expand, `var(--color-text-tertiary)`
- Transition: expand/collapse 200ms ease-out

### 4.3 Expanded Area — Empty State (No Court)

**James:** Shown when chip is "No court yet" and tapped.

```
┌─────────────────────────────────────────────┐
│  No court yet                               │
│                                             │
│  Chat with [Opponent Name] to pick a court, │
│  or add one here.                           │
│                                             │
│  [Venue name _______________]               │
│  [Notes (optional) _________]               │
│  ☐ Save to my profile                       │
│                                             │
│  [Set Court]                                │
│                                             │
│  Or add your home courts in your profile →  │
└─────────────────────────────────────────────┘
```

- Inline court entry: venue name (required, 100 chars), notes (optional, 300 chars)
- "Save to my profile" checkbox: default unchecked
- "Set Court" button: primary, disabled until venue_name non-empty
- Profile link: `font-size: var(--font-size-xs)`, tappable, navigates to Availability tab's "Your Courts" section
- When "Set Court" is tapped: court is set as `source: 'player'`, `suggested_by: current_player_id`, `confirmed: false`
- If "Save to my profile" is checked: court is also added to player's `courts[]` array (if under 3 limit)

### 4.4 Expanded Area — Suggestion (Auto or Player)

**James:** Shown when a venue has been suggested but not confirmed.

```
┌─────────────────────────────────────────────┐
│  Auto-suggested based on your profiles      │
│                                             │
│  🏟 Riverside Park Courts                  │
│  Court 3 (the shaded one)                   │
│  No booking needed                          │
│  "Bring water, no fountain nearby"          │
│                                             │
│  [Directions ↗]                             │
│                                             │
│  [Confirm]        [Suggest Different]       │
└─────────────────────────────────────────────┘
```

**Source label (top line):**
- Auto-suggested: "Auto-suggested based on your profiles" — `font-size: var(--font-size-xs)`, `color: var(--color-text-tertiary)`
- Player-suggested: "[Name] suggested this court" — same styling

**Venue details:** Same rendering as profile court card (venue name, label, booking status, cost, notes)

**Cost badge:** Only visible when `cost_applies === true`. Rendered as inline badge:
- Text: cost_description value (e.g., "$8/hr per person")
- If `covers_guests === true`: append " · [Name] covers your fee"
- Badge: `font-size: var(--font-size-xs)`, `background: var(--color-warning-surface)`, `color: var(--color-warning-text)`, `border-radius: var(--radius-sm)`, `padding: 2px 8px`

**Guest instructions:** If present, shown below venue details:
- Label: "Guest info" — `font-weight: 600`, `font-size: var(--font-size-xs)`
- Content: the guest_instructions text — `font-size: var(--font-size-xs)`, `color: var(--color-text-secondary)`

**Directions link:** `font-size: var(--font-size-sm)`, `color: var(--color-accent)`, opens Maps. Only shown when `directions_url` is present.

**Buttons:**
- "Confirm": primary button. Sets `confirmed: true`, `confirmed_by: current_player_id`, `confirmed_at: now()`
- "Suggest Different": secondary button. Opens the inline court entry form (same as empty state), or a picker of the current player's profile courts

**"Suggest Different" flow:**
1. Tap "Suggest Different"
2. If current player has profile courts: show a list of their courts with a "Or enter a different venue" option at the bottom
3. If current player has no profile courts: show inline entry form directly
4. Selected/entered court replaces the suggestion: `source: 'player'`, `suggested_by: current_player_id`, `confirmed: false`
5. Opponent sees the new suggestion on their match card

### 4.5 Expanded Area — Confirmed

**James:** Shown when court is confirmed.

```
┌─────────────────────────────────────────────┐
│  Court confirmed ✓                          │
│                                             │
│  🏟 Riverside Park Courts                  │
│  Court 3 (the shaded one)                   │
│  No booking needed                          │
│                                             │
│  [Directions ↗]  [Add to Calendar]          │
│                                             │
│  [Change Court]                             │
└─────────────────────────────────────────────┘
```

- "Add to Calendar" button: secondary style, appears only after confirmation
- "Change Court" link: `font-size: var(--font-size-xs)`, `color: var(--color-text-tertiary)`. Reopens the suggestion flow. Sets `confirmed: false`.
- Guest instructions still visible if applicable
- Cost badge still visible if applicable

**Booking responsibility line:** If `booking_needed === true`, show below venue details:
- If court is from a profile (court_id set): "[Court owner's name]'s court — they'll handle booking"
- If custom venue and no one claimed: show soft prompt (see Section 6)
- If someone claimed: "[Name] is handling the booking" with checkmark if booking_confirmed

### 4.6 Expanded Area — Both Want to Host (Conflict)

**James:** Shown when both players have "always play here" toggled on.

```
┌─────────────────────────────────────────────┐
│  You both have home courts                  │
│                                             │
│  Pick one, or chat to decide:               │
│                                             │
│  ┌─────────────────────────────┐            │
│  │ 🏟 Riverside Park (yours)  │            │
│  │ Free · No booking          │ [Pick]     │
│  └─────────────────────────────┘            │
│                                             │
│  ┌─────────────────────────────┐            │
│  │ 🏟 Faculty Club (Nina's)   │            │
│  │ $5/guest · Booking needed  │ [Pick]     │
│  └─────────────────────────────┘            │
│                                             │
│  Or suggest a different court               │
└─────────────────────────────────────────────┘
```

- Both "always play here" courts shown as mini-cards with "Pick" buttons
- Tapping "Pick" on either: sets that court as the suggestion, `source: 'player'`, `suggested_by: current_player_id`, `confirmed: false` — opponent still needs to confirm
- "Or suggest a different court" link: opens inline entry
- This state only occurs when BOTH players have `always_play_here === true` on one of their courts. If only one does, the algorithm auto-suggests that court (no conflict).

### 4.7 First-Time Tooltip

**James:** Shown once per player, on the first match card that has an auto-suggestion.

- Tooltip arrow points to the blue chip
- Text: "We picked this court based on your profiles. Tap to see details or change it."
- Dismiss: tap anywhere, or tap the chip (which also opens the detail area)
- Stored in player preferences: `seen_court_tooltip: boolean`
- Light overlay behind tooltip, chip remains tappable

### 4.8 Animations & Transitions

**Maya:**
- Chip expand/collapse: height animation, 200ms, ease-out. Content fades in 150ms after height settles.
- State change (gray → blue, blue → green): background color cross-fade 300ms
- "Add to Calendar" button: fades in 200ms after confirmation state renders
- Conflict state: both mini-cards slide in from left, staggered 100ms

---

## 5. Court Suggestion Algorithm

**Dev:** Runs client-side when a match is created or when court data changes. Pure function, deterministic, no randomness.

### 5.1 Input

```typescript
function suggestCourt(
  player1: PlayerProfile,
  player2: PlayerProfile,
  matchIndex: number,         // 0-indexed position in round-robin schedule
  tournamentMatches: Match[]  // all matches in tournament (for alternation tracking)
): MatchCourt | 'conflict' | null
```

### 5.2 Priority Rules (evaluated in order, first match wins)

**Rule 1: Both have "always play here"**
- If both players have a court with `always_play_here === true`: return `'conflict'`
- UI shows the dual-venue picker (Section 4.6)

**Rule 2: One player has "always play here"**
- If exactly one player has a court with `always_play_here === true`: suggest that court
- Source: `'auto'`

**Rule 3: Both have courts, neither "always" — alternate**
- Count prior matches between these two players in the tournament
- Even count (0, 2, 4...): suggest Player 1's first court (by sort_order)
- Odd count (1, 3, 5...): suggest Player 2's first court (by sort_order)
- Player 1 is determined by alphabetical order of player_id (deterministic tiebreaker)
- Source: `'auto'`

**Rule 4: Only one player has courts**
- Suggest that player's first court (by sort_order)
- Source: `'auto'`

**Rule 5: Neither player has courts**
- Return `null`
- UI shows empty state (Section 4.3)

### 5.3 Auto-Suggestion Timing

- Runs when tournament is created (bulk pass over all matches)
- Runs when a player adds/edits/deletes a court from their profile (re-evaluate all that player's unconfirmed matches)
- Does NOT run on matches where court is already confirmed (`confirmed === true`)
- Does NOT overwrite player-suggested courts (`source === 'player'`)

### 5.4 Alternation Tracking

**Dev:** Alternation is per-pair across the tournament. For a round-robin with N players, each pair plays once, so alternation only matters in leagues or multi-round tournaments. For V1's single round-robin format, Rule 3 effectively always uses even-count (first match between pair = Player 1's court). Future tournament formats will benefit from the alternation logic without changes.

---

## 6. Booking Responsibility Flow

### 6.1 States

```typescript
type BookingState =
  | 'not_needed'           // booking_needed === false
  | 'implicit_owner'       // court from profile, owner is implicit booker
  | 'unclaimed'            // custom venue, no one claimed booking
  | 'claimed'              // someone tapped "I'll handle it"
  | 'confirmed'            // booker confirmed the booking is done
```

### 6.2 State Transitions

```
                     ┌─── booking_needed=false ───→ NOT_NEEDED
                     │
Court set ──────────┤
                     │                              ┌──→ CONFIRMED
                     │    court from profile        │
                     ├──→ IMPLICIT_OWNER ──────────┘
                     │                   (owner taps "Confirm booking")
                     │
                     │    custom venue
                     └──→ UNCLAIMED ──→ CLAIMED ──→ CONFIRMED
                              │            │
                              │            └── (claimer taps "Confirm booking")
                              │
                              └── auto-dismiss after 24hr (stays UNCLAIMED,
                                  no further prompt shown)
```

### 6.3 UI for Each State

**NOT_NEEDED:** No booking UI shown. Status line reads "No booking needed."

**IMPLICIT_OWNER:**
- Line on match card: "[Name]'s court — they'll handle booking"
- Owner sees: "Your court — [Confirm booking done]" button
- Once confirmed: "Booking confirmed ✓" with green checkmark

**UNCLAIMED (custom venue, first 24 hours):**
- Soft prompt visible to both players:
  ```
  Who's booking?
  [I'll handle it]    [Can you?]
  ```
- "I'll handle it": sets `booking_claimed: true`, `booking_claimed_by: current_player_id`
- "Can you?": sends a quick message to opponent: "Can you book the court?" — does NOT change state
- After 24 hours with no action: prompt disappears, state remains UNCLAIMED, no further nagging

**CLAIMED:**
- Line: "[Name] is handling the booking"
- Claimer sees: "[Confirm booking done]" button
- Once confirmed: "Booking confirmed ✓"

**CONFIRMED:**
- "Booking confirmed ✓" — `color: var(--color-success-text)`
- No further actions

### 6.4 Booking State on Notifications

- 48-hour reminder (Section 7) includes booking state in the notification copy
- If IMPLICIT_OWNER and not confirmed: reminder sent to court owner specifically
- If UNCLAIMED: reminder sent to both players

---

## 7. Notifications & Reminders

### 7.1 Notification Types

| Type | When | Who | Copy | Actionable? |
|------|------|-----|------|-------------|
| Court suggested | When auto-suggestion runs for a new match | Both players | "Court suggested for your match vs. [Name]: [Venue]" | Yes — tap opens match card |
| Court changed | When opponent suggests different court | The other player | "[Name] suggested [Venue] for your match — tap to review" | Yes — tap opens match card |
| Court confirmed | When opponent confirms court | The player who suggested | "[Name] confirmed [Venue] for your match" | No — informational |
| No court reminder | 48hr before match, if no court set | Both players | "Your match vs. [Name] is in 2 days — tap to set up a court" | Yes — tap opens match card |
| Booking reminder | 48hr before match, if booking_needed and not booking_confirmed | Implicit booker or both if unclaimed | "Your match at [Venue] is in 2 days — confirm your booking" | Yes — one-tap confirm |
| Booking confirmed | When booker confirms booking | The other player | "[Name] confirmed the booking at [Venue]" | No — informational |

### 7.2 Notification Delivery

**Dev:** V1 notifications are in-app only (the existing notification bell in top nav). Push notifications are a V2 consideration.

In-app notifications are stored in the existing notification system. Each notification includes:
- `type`: one of the types above
- `match_id`: reference to the match
- `tournament_id`: reference to the tournament
- `created_at`: ISO 8601
- `read`: boolean
- `action_url`: deep link to the match card (internal navigation)

### 7.3 Actionable Notifications

**James:** Two notification types support one-tap action:

1. **No court reminder:** Tapping opens the match card with the court section expanded. No one-tap action (player needs to pick a court).

2. **Booking reminder:** Tapping opens the match card. If the current player is the implicit booker, a "Confirm Booking" button is prominently shown at the top of the expanded court section. This is the one-tap confirm path.

### 7.4 Reminder Scheduling

**Dev:** Reminders are evaluated client-side. On app open, check all upcoming matches within a 72-hour window. For any match within 48 hours that meets the reminder criteria and hasn't already triggered a reminder (tracked via `reminder_sent_at` field on MatchCourt), generate the notification.

This is a pragmatic V1 approach. Server-side scheduled reminders are a V2 item (requires the tennis-server to run cron jobs).

**Edge case: match time changes after reminder sent.** If a match is rescheduled to be more than 48 hours away after the reminder was sent, the reminder is already delivered. No retraction. The match card will show updated time. A new reminder fires when the match is again within 48 hours.

---

## 8. Cost & Guest Display

### 8.1 Cost Badge Visibility Rules

| cost_applies | covers_guests | Badge shown |
|-------------|---------------|-------------|
| false | — | No badge |
| true | false | "[cost_description]" (e.g., "$8/hr per person") |
| true | true | "[cost_description] · [Owner name] covers your fee" |

**Maya:** Badge renders as an inline pill:
- Background: `var(--color-warning-surface)`
- Text: `var(--color-warning-text)`
- Font: `var(--font-size-xs)`, `font-weight: 500`
- Padding: `2px 8px`
- Border radius: `var(--radius-sm)`
- Position: below venue name, above notes

### 8.2 Cost on Chip (Collapsed State)

- No cost information on the collapsed chip. Cost only visible in expanded area.
- Keeps the chip clean and scannable (per user feedback: no "FREE" badge on free courts).

### 8.3 Guest Instructions Display

**James:**
- Only shown when `guest_instructions` is non-empty
- Section label: "Guest info" — bold, `var(--font-size-xs)`
- Content: the full text, `var(--font-size-xs)`, `color: var(--color-text-secondary)`
- Position: below cost badge (if present), above notes
- Maximum rendered height: 4 lines. "Show more" link if content exceeds.
- 300 character limit enforced at input time

---

## 9. Calendar Integration

### 9.1 "Add to Calendar" Button

**Maya:**
- Appears in the expanded confirmed court section
- Button style: secondary (outlined), icon: calendar icon 16x16 + "Add to Calendar" text
- Position: inline with Directions link

### 9.2 Calendar Event Data

**Dev:** Generates a deep link to the platform's native calendar. Detection logic:

```typescript
function addToCalendar(match: Match, court: MatchCourt) {
  const event = {
    title: `Tennis vs. ${opponentName}`,
    location: court.venue_name + (court.label ? ` — ${court.label}` : ''),
    startTime: match.scheduled_time,       // ISO 8601
    endTime: match.scheduled_time + 90min, // default 90 minutes
    notes: [
      court.guest_instructions,
      court.notes,
      court.directions_url ? `Directions: ${court.directions_url}` : null
    ].filter(Boolean).join('\n')
  };

  // Platform detection
  if (iOS) {
    // Use webcal:// deep link or /api/calendar-event endpoint
    window.open(generateAppleCalendarURL(event));
  } else if (Android) {
    window.open(generateGoogleCalendarURL(event));
  } else {
    // Fallback: .ics download (desktop only)
    downloadICS(event);
  }
}
```

### 9.3 Google Calendar URL Format

```
https://calendar.google.com/calendar/render?action=TEMPLATE
  &text=Tennis+vs.+Sandra
  &dates=20260415T140000Z/20260415T153000Z
  &location=Riverside+Park+Courts
  &details=Court+3+(the+shaded+one)%0ABring+water
```

### 9.4 Apple Calendar Deep Link

Uses a minimal .ics served from a data URI or a server endpoint. This is the established pattern for iOS web apps.

### 9.5 Edge Cases

- If match has no scheduled_time: button disabled, tooltip "Set a match time first"
- If court is unconfirmed: button not shown (only appears after confirmation)

---

## 10. Empty States & First-Time Experience

### 10.1 Catalog of Empty States

| Location | Trigger | Content | CTA |
|----------|---------|---------|-----|
| Profile: Your Courts | No courts saved | "Your courts will show up here. Add your favorite courts so we can auto-suggest venues for your matches. You can also set one up on any match card." | "Add a Court" button |
| Match card: Court chip | Neither player has courts | Gray chip: "No court yet" | Tap to expand |
| Match card: Court expanded | Neither player has courts | "No court yet. Chat with [Name] to pick a court, or add one here." + inline entry form | "Set Court" button + profile link |
| Match card: Court expanded | Opponent has court, current player doesn't | Auto-suggests opponent's court | "Confirm" / "Suggest Different" |

### 10.2 First-Time Tooltip

- Trigger: player's first auto-suggested court on any match card
- Content: "We picked this court based on your profiles. Tap to see details or change it."
- Style: tooltip with arrow pointing at the chip, dark background, white text, 12px padding, max-width 240px
- Dismiss: any tap
- Persistence: `seen_court_tooltip` flag in player profile (localStorage + Supabase sync)
- Does not re-show after dismissal, even on new matches

### 10.3 Onboarding Connection

**Sarah:** No changes to the existing registration flow. Courts are optional and post-registration. The empty state in the profile is the onboarding prompt. Users who come from the registration flow will see the availability section first (which they just filled out) and the empty courts section below — naturally inviting them to add courts when ready, not forcing it during signup.

---

## 11. Quick Messages

### 11.1 New Court-Related Shortcuts

**James:** Added to the existing quick message shortcuts on the match card. These appear in the messaging area, below the court section.

| Shortcut | Message sent |
|----------|-------------|
| "Can you book?" | "Can you handle the booking for [Venue]?" |
| "I booked it" | "I booked [Venue] — see you there!" |
| "Let's play at..." | Opens a mini-form: venue name field → sends "How about we play at [Venue]?" |
| "What time works?" | "What time works for you at [Venue]?" |

**Visibility rules:**
- "Can you book?" — visible when court is set and booking_needed=true and booking is unclaimed
- "I booked it" — visible when current player claimed booking and booking not yet confirmed
- "Let's play at..." — always visible
- "What time works?" — visible when court is set but match time is not scheduled

### 11.2 Shortcut Rendering

**Maya:** Same as existing quick message shortcuts — horizontal scrollable row of pills below the court section. Each pill: `var(--color-surface-secondary)` background, `var(--font-size-xs)`, `padding: 6px 12px`, `border-radius: var(--radius-full)`.

---

## 12. Edge Cases

### 12.1 Player Leaves Tournament

**James & Dev:**
- If a player leaves a tournament, all their matches are forfeited per existing logic
- Court data on forfeited matches is preserved (not deleted) but no longer actionable
- No notifications sent for forfeited match courts
- Opponent sees: "Match forfeited" — court section hidden

### 12.2 Court Deleted from Profile

- If a player deletes a court from their profile that is currently suggested (not confirmed) on a match: the auto-suggestion is re-evaluated. If they have other courts, next priority court is suggested. If no courts remain, state reverts to empty.
- If a court is deleted that is already confirmed on a match: confirmed court data persists on the match (it's a copy, not a reference). The match card continues to show the venue. A note appears: "This court was removed from [Name]'s profile, but your match is still set here."

### 12.3 Both Players "Always Host" (Conflict)

- Handled by Section 4.6 and Algorithm Rule 1 (Section 5.2)
- No algorithmic tiebreaker — both venues shown, players pick or chat
- If one player picks: that becomes the suggestion, opponent must confirm
- If neither picks within 48 hours: standard no-court reminder fires

### 12.4 Player Adds Court After Tournament Created

- Auto-suggestion re-runs for all that player's unconfirmed matches
- Confirmed matches are not affected
- Player-suggested (non-auto) matches are not overwritten

### 12.5 Opponent Has No Profile (Guest/Unregistered)

- V1 requires registration to be in a tournament, so this shouldn't occur
- Defensive code: treat opponent with no profile as "no courts" — empty state

### 12.6 Same Venue, Different Players

- Two players might save "Riverside Park Courts" independently
- These are treated as separate court entries (different court_id values)
- The alternation algorithm still alternates whose court object is used, even if the venue name is identical
- Display shows the selected player's version (their notes, their cost info, their guest instructions)

### 12.7 Directions URL Expired or Invalid

- Deep link opens in Maps app. If URL is invalid, Maps shows an error (not Rally's responsibility)
- No URL validation beyond format check at input time
- Rally does not verify that the Maps link resolves correctly

### 12.8 Very Long Venue Names

- Venue name truncated with ellipsis on the chip at approx 24 characters
- Full name visible in expanded area
- No truncation on profile court cards (they have more width)

### 12.9 Match Rescheduled After Court Confirmed

- Court data persists. No change to court state.
- "Add to Calendar" would add a new event (user must manually delete the old one if they already added it)
- V2 consideration: calendar event update API

### 12.10 Rapid Suggestion Ping-Pong

- If Player A suggests Court X, Player B suggests Court Y, Player A suggests Court Z...
- Each suggestion overwrites the previous. No history kept (V1 simplification).
- Notification sent for each change: "[Name] suggested a different court"
- V2 consideration: rate-limit suggestions (e.g., max 5 per match per day)

---

## 13. Accessibility

### 13.1 Screen Reader Labels

| Element | aria-label |
|---------|-----------|
| Gray chip | "No court set for match vs. [Name]. Tap to set a court." |
| Blue chip | "Court suggested: [Venue Name]. Tap for details." |
| Green chip | "Court confirmed: [Venue Name]. Tap for details." |
| Amber chip | "Both players have home courts. Tap to pick one." |
| Confirm button | "Confirm [Venue Name] as the court for this match" |
| Suggest Different button | "Suggest a different court for this match" |
| Add to Calendar button | "Add match vs. [Name] at [Venue] to your calendar" |
| Directions link | "Open directions to [Venue Name] in Maps" |
| Always play here toggle | "Always play at [Venue Name]. Currently [on/off]." |
| Cost badge | "Court cost: [cost_description]" |
| Booking prompt | "Who is booking [Venue]? Options: I'll handle it, or ask opponent" |

### 13.2 Contrast Ratios

All chip states meet WCAG AA (4.5:1 for normal text):
- Gray chip: `--color-text-secondary` on `--color-surface-secondary` — verified 5.2:1
- Blue chip: `--color-info-text` on `--color-info-surface` — verified 4.8:1
- Green chip: `--color-success-text` on `--color-success-surface` — verified 5.1:1
- Amber chip: `--color-warning-text` on `--color-warning-surface` — verified 4.6:1

### 13.3 Tap Targets

All interactive elements: minimum 44x44px tap target per WCAG 2.5.5. The chip itself is 36px tall but has 4px padding top/bottom (44px total touch area). Buttons within the expanded area are full-width or minimum 44px tall.

### 13.4 Keyboard Navigation

- Tab order: chip → (when expanded) venue details → Confirm → Suggest Different → Directions → Add to Calendar → Change Court
- Enter/Space on chip: toggle expand/collapse
- Escape when expanded: collapse
- Focus ring: 2px solid `var(--color-accent)`, offset 2px

### 13.5 Reduced Motion

- When `prefers-reduced-motion: reduce`: all animations replaced with instant state changes (no transitions)
- Chip expand/collapse: instant height change
- Color state changes: instant swap

---

## 14. Success Metrics

**Sarah:**

### 14.1 Primary Metrics (V1 Success Criteria)

| Metric | Definition | Target | Measurement |
|--------|-----------|--------|-------------|
| Court set rate | % of matches with a court set (any state) 24hr before match | 60% within 60 days of launch | Query MatchCourt data |
| Court confirmed rate | % of matches with confirmed court | 40% within 60 days | Query MatchCourt.confirmed |
| Profile court adoption | % of active players with at least 1 court saved | 50% within 60 days | Query lobby.courts |
| Auto-suggest acceptance | % of auto-suggestions confirmed without change | 70% (of matches that have auto-suggestions) | Compare source='auto' with confirmed=true |

### 14.2 Secondary Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Time to court | Median time from match creation to court confirmed | < 4 hours |
| Suggestion changes | Average number of "Suggest Different" actions per match | < 0.5 (most accept first suggestion) |
| Quick message usage | % of matches where a court-related quick message is sent | Track for learning, no target |
| Calendar adds | % of confirmed courts where "Add to Calendar" is tapped | Track for learning, no target |
| Profile courts per player | Average courts saved per player who has any | 1.5 - 2.0 |

### 14.3 Guardrail Metrics

| Metric | Concern | Threshold |
|--------|---------|-----------|
| Suggestion ping-pong | Players endlessly suggesting different courts | Alert if > 5 suggestions per match |
| Booking confusion | Booking never confirmed despite being needed | Alert if > 30% of booking-needed matches have no confirmation 24hr before |
| Feature abandonment | Players open court section but don't complete action | Track expansion-without-action rate |

---

## 15. Scope Boundaries

### 15.1 Explicit "NOT in V1" List

| Feature | Why not V1 | V2 candidate? |
|---------|-----------|---------------|
| Push notifications | Requires backend infrastructure (APNs/FCM) | Yes, high priority |
| Real-time court availability | No API to park/club booking systems | No — unlikely to exist |
| Payment splitting | Adds payment processing complexity | Maybe V3 |
| Court ratings/reviews | Not enough usage data yet | Maybe V3 |
| Map embed in-app | Adds mapping SDK dependency | Maybe V2 |
| Court photos | Storage and moderation overhead | Maybe V2 |
| Automatic calendar sync | Requires calendar API OAuth | Yes, V2 |
| Server-side reminders (cron) | Requires tennis-server cron infrastructure | Yes, V2 |
| Suggestion history / undo | Adds complexity to an already-nuanced flow | No for now |
| More than 3 courts per player | No user demand observed | Revisit based on data |
| Court search / directory | We are not a court booking platform | No |
| Recurring court preferences per opponent | Over-engineering for V1 scale | Maybe V3 |
| Booking calendar integration (book the court through Rally) | Requires partnerships with venues | No |

### 15.2 Intentional Simplifications

- Courts are free-text, not structured venues from a database. This is by design — recreational players use informal names ("the park by Trader Joe's") that wouldn't match any directory.
- No court validation. If a player types "asdfgh" as a venue, that's their problem.
- No deduplication. Two players saving "Riverside Park" independently creates two separate court objects. This is acceptable for V1 scale.
- Alternation tracking is simple count-based, not fairness-optimized. Good enough for round-robin.
- Inline court creation doesn't support cost or guest fields — just venue name and notes. Players who need those features should save the court to their profile.

---

## 16. Implementation Phases

**Dev & Sarah:**

### Phase 1: Data Model & Profile (3-4 days)
- Add `courts` JSONB column to lobby table
- Add `Court` type to tennis-core
- Build "Your Courts" profile section (CRUD for courts)
- Sync courts via existing lobby sync
- **Deliverable:** Players can save/edit/delete courts in their profile

### Phase 2: Match Card Court Section (4-5 days)
- Add `MatchCourt` type to tennis-core
- Build court chip component (all 4 states)
- Build expanded area (all variants: empty, suggested, confirmed, conflict)
- Build inline court entry form
- Wire up court data to match objects in tournament JSONB
- **Deliverable:** Court chips visible on all match cards, inline entry works

### Phase 3: Suggestion Algorithm (2 days)
- Implement `suggestCourt()` function
- Wire auto-suggestion to tournament creation
- Wire re-suggestion to profile court changes
- Add first-time tooltip
- **Deliverable:** Courts auto-populate on match cards based on profiles

### Phase 4: Booking Responsibility (2 days)
- Implement booking state machine
- Build "Who's booking?" prompt with 24hr auto-dismiss
- Build "Confirm booking" flow
- Add booking status to match card display
- **Deliverable:** Booking responsibility tracked and visible

### Phase 5: Notifications & Quick Messages (2-3 days)
- Add court notification types to existing notification system
- Implement 48hr reminder check (client-side, on app open)
- Build court-related quick message shortcuts
- Wire actionable notification taps to match card navigation
- **Deliverable:** Players notified of court events and reminded before matches

### Phase 6: Calendar & Polish (1-2 days)
- Implement "Add to Calendar" with platform-specific deep links
- Final accessibility audit (screen reader labels, contrast, tap targets)
- Edge case testing (delete court, leave tournament, rapid suggestion)
- **Deliverable:** Feature complete, ready for staging deploy

**Total estimated effort: 14-18 days of focused development.**

### Phase Dependency Graph
```
Phase 1 ──→ Phase 2 ──→ Phase 3
                │
                ├──→ Phase 4
                │
                └──→ Phase 5
                        │
                        └──→ Phase 6
```

Phases 3, 4, and 5 can run in parallel after Phase 2 is complete. Phase 6 depends on all prior phases.

---

*End of specification. This document covers every field, every state, every transition, and every edge case needed to build court booking coordination for Rally Tennis V1.*