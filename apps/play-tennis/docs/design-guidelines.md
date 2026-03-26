# Rally UI Design Guidelines

This document is the UI source of truth for `apps/play-tennis`.

It exists to prevent drift when new features are added. The goal is not to invent a new design system. The goal is to preserve the best parts of the current app, make decisions repeatable, and keep the product visually coherent.

## Product Reference

Rally is inspired by the clarity and discipline of Polymarket, adapted for amateur tennis scheduling.

That means:

- data-forward cards
- strong status signals
- compact, scannable layouts
- one clear primary action
- minimal visual noise
- consistent structure across states

Do not copy Polymarket literally. Use it as a standard for discipline, hierarchy, and consistency.

## Core Principles

### 1. Stable shells

Do not create a new card design for every state.

Use the same structural shell for the same object:

- one shell for upcoming matches
- one shell for completed matches
- one shell for tournaments
- one shell for inbox / action items

State changes should mostly affect:

- badge / eyebrow
- accent color
- time row
- primary action
- expanded content

State changes should not re-invent:

- spacing
- typography
- alignment
- action placement
- overall card anatomy

### 2. Capability-driven UI

Do not let raw backend status control the entire interface.

For any match, first compute user-facing capabilities:

- `canConfirmTime`
- `canReschedule`
- `canScore`
- `canMessage`
- `needsResponse`
- `isReadOnly`

Then render UI from those capabilities.

This keeps the experience coherent across:

- Home
- BracketTab
- Tournament views
- expanded match panels

### 3. In-card interaction by default

Scheduling interaction should happen inside the card whenever possible.

This is the preferred Rally interaction model because it:

- reduces navigation overhead
- keeps context visible
- makes scanning easier
- fits the product's quick-response nature

Use this structure:

- collapsed card: summary + primary action
- expanded card: full action area

Do not switch to a completely different presentation just because the user is now scoring instead of rescheduling.

### 4. One primary action

Every interactive card should have one obvious primary action.

Examples:

- unscheduled match: `Pick Time`
- proposed match: `Confirm Time`
- confirmed match: `View Match`
- confirmed match on Home: `Change Time`
- score pending from opponent: `Confirm Score`

Secondary actions must stay secondary:

- `Message`
- `Change Time`
- `Enter Score`
- `Cancel Match`

Do not place multiple competing primary buttons on the same card.

### 5. Status should clarify, not dominate

Status belongs in:

- eyebrow text
- left rail / accent
- small badge

Status should not create entirely different layouts.

Good:

- same card, different accent and action

Bad:

- same match rendered like three different products depending on state

## Match Card Standard

All upcoming match cards should follow this anatomy:

1. Eyebrow or status row
2. Opponent row
3. Time row
4. Primary action row
5. Optional secondary actions
6. Expanded detail area

The order stays fixed.

### Upcoming Match Rules

- Any match that is not completed should support rescheduling.
- Once a time is confirmed, score entry may be available, but the object is still a match card, not a score card.
- A confirmed match should not lose its reschedule affordance just because score entry is also possible.
- Pending reschedule requests should still use the same card shell.

### Completed Match Rules

Completed matches can simplify:

- winner / result
- date played
- score summary
- feedback / aftermath

Completed cards do not need the full upcoming-match action model.

## Visual Language

### Logo

The only approved Rally logo is `brand/rally-logo.svg` (sourced from `rally_logo_page4_lower_left.svg`). This is the Rally wordmark and must be used everywhere the Rally brand appears:

- email templates (embedded as base64 data URI)
- browser favicon (`public/favicon.svg`)
- any marketing or onboarding surfaces

Do not use `rally-logo-mark.svg` (the tennis ball trajectory shape) as the logo. It is not the Rally logo.

When embedding in emails, convert to base64 data URI (`data:image/svg+xml;base64,...`) for maximum client compatibility.

### Typography

- keep current Rally typography scale
- reserve the strongest emphasis for opponent name, time, and primary status
- use uppercase micro-labels for eyebrows only
- keep numbers legible and compact
- use tabular / monospace treatment for times, scores, percentages, counts where appropriate

### Color

Use color as state support, not decoration.

Default Rally status mapping:

- green: confirmed / positive / ready
- blue: response needed / proposed / informational
- orange: warning / negotiation / needs attention
- red: destructive / failed / canceled / urgent conflict
- neutral gray: completed / inactive / secondary

Do not introduce new colors unless a real semantic need exists.

### Borders and emphasis

- use left rail or subtle accent as the main state signal
- avoid heavy borders around whole cards
- keep surfaces calm and white
- use shadows lightly

### Spacing

- preserve existing card padding rhythm
- do not create tighter or looser spacing for one-off features unless the whole pattern changes
- expanded panels should feel like a continuation of the card, not a separate module glued underneath

## Home Surface Rules

Home should be a compressed, action-first version of the same system.

That means:

- the same match should still look recognizably like the same match
- Home can be denser, but not different in kind
- confirmed Home cards should expose `Change Time`
- Home should not invent a custom state presentation that conflicts with bracket / tournament views

Home is not allowed to become a separate mini-app.

## Bracket and Tournament Surface Rules

Bracket and tournament views may show more context, but should still use the same action logic as Home.

Allowed differences:

- more metadata
- richer time display
- more expansion space
- more secondary stats

Not allowed:

- different primary action logic for the same match state
- different card anatomy for the same match
- different terminology for the same action

## Copy Standards

Prefer direct, short labels:

- `Pick Time`
- `Confirm Time`
- `Change Time`
- `View Time`
- `Enter Score`
- `Confirm Score`
- `Needs Response`
- `Needs New Time`

Avoid:

- vague labels
- multiple labels for the same action
- overly conversational copy on high-frequency actions

## Implementation Rules

Before adding a new UI feature:

1. Identify the object type.
2. Decide whether it belongs in an existing shell.
3. Reuse the existing shell unless there is a strong reason not to.
4. Derive actions from capabilities, not raw status alone.
5. Keep the same action names everywhere.
6. If a new state appears, first try to represent it with:
   - a new badge
   - a different primary action
   - different expanded content
   before creating a new card pattern.

## Component Guidance

For match surfaces, the long-term target is:

- one shared upcoming match card component
- one shared action computation function
- one shared expanded action region

Feature work should move toward that, not away from it.

If a new feature needs match-card UI in:

- `Home.tsx`
- `BracketTab.tsx`
- `TournamentView.tsx`

then the implementation should first ask:

"Can this be expressed through the shared card model?"

If the answer is no, document why.

## Review Checklist

Before shipping UI work, check:

- Does this reuse an existing shell?
- Does this match existing spacing and typography?
- Does the same match state behave the same way across Home and bracket views?
- Is the primary action obvious?
- Are secondary actions truly secondary?
- Can a user still reschedule any unplayed match?
- Is score entry available without turning the match into a different visual object?
- Does the feature feel like Rally, not a bolt-on?

## Non-goals

These guidelines are not meant to:

- freeze the UI forever
- block iteration
- prevent better patterns

They are meant to prevent accidental inconsistency.

If the product direction changes, update this document first, then implement the UI.
