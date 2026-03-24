# Welcome to Rally — Unified Onboarding Card Briefing

## The Problem Today

Right now, new users see **three separate pieces** of onboarding UI scattered across different states:

1. **"How Rally Works"** card — appears in lobby view only, dismissible with an X, generic explainer
2. **"Get Started" onboarding checklist** — appears only when a tournament is active, tracks 4 steps
3. **"Add your availability" reminder** — a warning-style card that appears in lobby/setup states

This fragmentation means:
- A user in the lobby sees "How Rally Works" + availability reminder, but not the checklist
- A user in a tournament sees the checklist, but not the explainer
- The availability reminder looks like an error (amber warning), not an invitation
- "How Rally Works" can be permanently dismissed before the user ever acts on it
- There's no single, clear activation path

## The Solution: One Card, One Journey

Replace all three with a single **"Welcome to Rally"** card that:
- Appears from lobby phase onward (not just active tournaments)
- Auto-retires when all activation steps are complete (no X button)
- Combines the checklist with an expandable "How it works" explainer
- Has a contextual primary CTA that changes based on what's needed next

---

## Visual Spec

### Card Structure

```
┌─────────────────────────────────────────────────┐
│  GETTING STARTED          2 of 4 complete       │
│                                                  │
│  Welcome to Rally                                │
│  Your matches, auto-scheduled.                   │
│  Your skills, accurately rated.                  │
│                                                  │
│  ✅  Set up your profile                         │
│  ○   Join the Washington County lobby            │
│  ○   Set your availability                       │
│  ○   Play your first match                       │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │     [ Join the Lobby ]                  │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
│  ▸ How does Rally work?                          │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Expanded "How it works" State

```
┌─────────────────────────────────────────────────┐
│  ...checklist + CTA above...                     │
│                                                  │
│  ▾ How does Rally work?                          │
│                                                  │
│  ┌─────────────────────────────────────────┐     │
│  │ 🔵 Join                                 │     │
│  │ Sign up and join your county lobby.     │     │
│  │ Once 6+ players join, the tournament    │     │
│  │ kicks off automatically.                │     │
│  │                                         │     │
│  │ 🟢 Play                                 │     │
│  │ Rally auto-schedules matches around     │     │
│  │ everyone's availability — no group      │     │
│  │ chats, no back-and-forth.               │     │
│  │                                         │     │
│  │ 🟠 Compete                              │     │
│  │ Every match updates your skill rating.  │     │
│  │ Top players advance to finals.          │     │
│  │ Seasons run ~30 days.                   │     │
│  └─────────────────────────────────────────┘     │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## Detailed Spec

### 1. Card Header

| Element | Value |
|---------|-------|
| Status label | `GETTING STARTED` (blue, uppercase, small) |
| Progress chip | `{completed} of {total} complete` — tabular-nums, muted background |

**Why "Getting Started" not "Onboarding":** "Getting Started" is active, forward-looking language. "Onboarding" is internal product jargon.

### 2. Hero Copy (Title + Subtitle)

**Title:** `Welcome to Rally`

**Subtitle — two lines, each a USP:**
```
Your matches, auto-scheduled.
Your skills, accurately rated.
```

This is the first time the user reads what Rally actually *does for them*. The current subtitle ("Finish these steps and Rally will handle the scheduling for you") is instructional but doesn't sell. The new copy is benefit-first and introduces both USPs — scheduling and ratings — in a scannable, parallel structure.

**Copywriting rationale:**
- Parallel construction ("Your X, Y-ed") creates rhythm and memorability
- "auto-scheduled" is the magic word — it implies zero effort
- "accurately rated" distinguishes Rally from informal "just hit around" tennis
- No exclamation marks — confident, not desperate
- Two lines, not a paragraph — mobile-scannable

### 3. Activation Checklist (4 Steps)

| Step | Label | Completed when | Notes |
|------|-------|----------------|-------|
| 1 | Set up your profile | Always true (completed during registration) | Instant win — starts the user at 25% progress |
| 2 | Join the {county} lobby | Player is in a lobby or tournament | Personalized with county name |
| 3 | Set your availability | `getAvailability(playerId).length > 0` | Critical conversion step |
| 4 | Play your first match | Any match with `completed: true` involving player | Final activation milestone |

**Visual treatment:**
- Completed steps: green circle with white checkmark + slightly bolder label (medium weight, primary text color)
- Incomplete steps: hollow circle (border only, divider color) + secondary text color
- No strikethrough — completed steps should feel like achievements, not deletions
- Compact vertical spacing (8px gap between steps)

**Step label personalization:**
- Step 2 says "Join the **{county}** lobby" (e.g., "Join the Washington County lobby") — makes it feel local and real
- Step 3 says "Set your availability" (shorter than current "Tell us when you're free") — more direct

### 4. Contextual Primary CTA

The CTA button changes based on the **first incomplete step**:

| Next incomplete step | CTA label | Action |
|---------------------|-----------|--------|
| Join lobby | **Join the Lobby** | Scrolls to / triggers lobby join |
| Set availability | **Set Your Availability** | Navigates to Profile tab, availability section |
| Play first match | **Find a Match** | Navigates to bracket/schedule |
| All complete | *(card auto-hides)* | — |

**Button style:** Full-width, primary blue (`--color-accent-primary`), 48px height, 15px semibold text. Same as existing `.onboarding-cta` styling.

**Why contextual CTA matters (conversion perspective):**
- Static CTAs ("Invite Friends") don't match user intent at most stages
- A user who hasn't joined the lobby doesn't care about inviting friends yet
- Matching the CTA to the next action reduces cognitive overhead from "what should I do?" to "just tap this"
- This is the Linear/Notion pattern — checklist + single "do the next thing" button

### 5. "How Does Rally Work?" Expandable Section

**Collapsed state (default):**
- Text link: `How does Rally work?` — secondary text color, 14px
- Chevron indicator: `▸` (right arrow, rotates to `▾` when expanded)
- Positioned below the CTA button, with 12px top margin
- No background or border — just a subtle inline link

**Expanded state:**
- Slides down with a 200ms ease-out CSS transition (`max-height` + `opacity`)
- Shows 3 steps in a vertical layout, each with:
  - Colored circle icon (32px, same as current): blue (Join), green (Play), amber (Compete)
  - Step title in bold
  - 1-2 line description in secondary text
- Footer line: `Seasons run ~30 days` in muted text, 13px
- Stays expanded until user collapses it or navigates away (state resets per session, not persisted)

**Expanded content — rewritten for clarity and excitement:**

| Step | Title | Description |
|------|-------|-------------|
| 1 | **Join** | Sign up and join your county lobby. Once 6+ players join, the tournament kicks off automatically. |
| 2 | **Play** | Rally auto-schedules matches around everyone's availability — no group chats, no back-and-forth. |
| 3 | **Compete** | Every match updates your skill rating. Top players advance to finals. Seasons run ~30 days. |

**Why these descriptions are better than current:**
- Current "Sign up for a tournament in your area" → new copy explains the *mechanism* (6+ players, auto-kickoff)
- Current "Matches auto-scheduled from your availability" → new copy names the *pain it eliminates* (no group chats)
- Current "Top 4 advance to finals for the championship" → new copy adds *ratings* as a benefit and explains seasons

### 6. Auto-Retirement Behavior

- Card **disappears** when `activationSteps.every(s => s.completed)` — same logic as today
- **No X/dismiss button** — this is intentional:
  - X buttons create guilt ("should I have read that?") and FOMO
  - Auto-retirement means the card disappears exactly when it's no longer useful
  - Users who complete steps fast won't even notice the transition
- **No localStorage persistence** for dismissal — the card is purely state-driven

### 7. Where It Appears

The card renders in **all Home tab states** where onboarding is incomplete:

| Home state | Currently shows | New behavior |
|------------|----------------|--------------|
| No tournament (lobby view) | "How Rally Works" + availability reminder | Welcome card (replaces both) |
| Setup tournament (forming) | Availability reminder only | Welcome card |
| Active tournament | "Get Started" checklist | Welcome card (same position) |

**Placement:** Always the **first card** after the Lobby component (in lobby/setup views) or the first card in the active tournament view. This ensures it's always visible without scrolling on mobile.

---

## What Gets Removed

1. **"How Rally Works" card** (lines 514-549 in Home.tsx) — replaced by expandable section
2. **`hiwDismissed` state and localStorage key** (`rally_hiw_dismissed`) — no longer needed
3. **`availabilityReminder` variable** (lines 435-445) — absorbed into checklist step 3 + contextual CTA
4. **Old onboarding card** (lines 582-613) — replaced by unified card
5. **Static "Invite Friends" CTA** — replaced by contextual CTA

## What Gets Added

1. **`WelcomeCard` component** — extracted from Home.tsx for cleanliness (optional, could stay inline)
2. **Expandable section CSS** — `max-height` transition, chevron rotation
3. **Contextual CTA logic** — simple function that reads first incomplete step
4. **Updated step labels** — personalized with county name

---

## CSS Spec

### New/Modified Classes

```css
/* Expandable "How it works" section */
.welcome-hiw-toggle {
  /* text button style, secondary color, 14px */
  /* flex row with chevron + label */
  /* cursor: pointer, no background */
}

.welcome-hiw-chevron {
  /* 12px, transitions transform 200ms */
  /* rotates 90deg when expanded */
}

.welcome-hiw-content {
  /* max-height: 0, overflow: hidden, opacity: 0 */
  /* transition: max-height 200ms ease-out, opacity 200ms ease-out */
}

.welcome-hiw-content.expanded {
  /* max-height: 400px (generous), opacity: 1 */
}
```

### Reused Classes (no changes needed)
- `.card`, `.card-status-row`, `.card-status-label--blue`, `.card-meta-chip`
- `.card-title`, `.card-supporting`, `.card-summary-main`
- `.onboarding-step`, `.onboarding-step.completed`, `.onboarding-step-icon`, `.onboarding-step-label`
- `.onboarding-cta` (button)
- `.how-rally-step`, `.how-rally-step-icon`, `.how-rally-step-text` (inside expandable)

---

## Copy Summary (Final)

| Element | Copy |
|---------|------|
| Status label | `GETTING STARTED` |
| Progress chip | `{n} of 4 complete` |
| Title | `Welcome to Rally` |
| Subtitle line 1 | `Your matches, auto-scheduled.` |
| Subtitle line 2 | `Your skills, accurately rated.` |
| Step 1 | `Set up your profile` |
| Step 2 | `Join the {county} lobby` |
| Step 3 | `Set your availability` |
| Step 4 | `Play your first match` |
| CTA (lobby) | `Join the Lobby` |
| CTA (availability) | `Set Your Availability` |
| CTA (play) | `Find a Match` |
| Expand toggle | `How does Rally work?` |
| Join description | `Sign up and join your county lobby. Once 6+ players join, the tournament kicks off automatically.` |
| Play description | `Rally auto-schedules matches around everyone's availability — no group chats, no back-and-forth.` |
| Compete description | `Every match updates your skill rating. Top players advance to finals.` |
| Season note | `Seasons run ~30 days` |

---

## Implementation Checklist

- [ ] Create `WelcomeCard` component (or inline in Home.tsx)
- [ ] Add contextual CTA logic (`getNextAction` function)
- [ ] Add expandable "How it works" section with slide-down animation
- [ ] Add CSS for expand/collapse transition + chevron rotation
- [ ] Remove old "How Rally Works" card from lobby view
- [ ] Remove `availabilityReminder` from lobby and setup views
- [ ] Remove old onboarding card from active tournament view
- [ ] Remove `hiwDismissed` state + `rally_hiw_dismissed` localStorage usage
- [ ] Render WelcomeCard in all three Home states (no tournament, setup, active)
- [ ] Personalize step 2 label with `profile.county`
- [ ] Verify auto-dismiss works when all 4 steps complete
- [ ] Test on mobile viewport (card should not require horizontal scroll)
