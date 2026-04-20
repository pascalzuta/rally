# Rally — Reskin Handoff

**Version:** 1.0
**Date:** April 21, 2026
**Target repo:** the existing Rally React Native / React app
**Scope:** full visual reskin + Home tab IA change (Home now leads with the match queue)

---

## 1. What this is

This bundle is a **design reference package** — a set of high-fidelity HTML/React prototypes and a design-token spec. The HTML prototypes are *not* production code to copy and ship. The task is to **recreate these designs in the real Rally codebase**, using its existing component library, navigation, data layer, and platform conventions (React Native if that's what Rally ships on; React for web).

Treat the HTML files as a spec you implement against — like a Figma file, but with working layout math and working interactive states you can poke at to understand intent.

## 2. Fidelity

**High-fidelity (hifi).** Pixel-perfect mockups with:
- Final colors (exact hex values in `tokens.css`)
- Final typography (system SF stack, weights, sizes, letter-spacing)
- Final spacing, radii, shadows
- Final copy
- Final interactive states (pending / confirmed / waiting / TBD / urgent)

Where the mocks use web-only CSS (e.g. `backdropFilter`), translate to the platform-idiomatic equivalent (React Native `BlurView`, etc.).

## 3. What's changing

Two kinds of change. Read both before scoping.

### 3a. Visual reskin (every screen)
The app's current palette uses Polymarket-adjacent grey + orange. The new palette is:
- **Primary accent:** court-green `#1F7A4D` (replaces orange everywhere)
- **Canvas:** warm off-white `#F7F5F2` (replaces cool grey)
- **Ink:** near-black with a blue undertone `#0E1421`
- **Type:** SF Pro Display for numbers/display, SF Pro Text for body, tabular-nums utility on anything numeric
- **Shape language:** 18–22px radii on cards, 999px pills, softer shadows with an inset white highlight
- **Status system:** four states only — `confirmed` (green), `response` (blue), `warn` (slate; NOT amber), `urgent` (red)

### 3b. IA change — Home tab now leads with the match queue
The existing Home tab was a dashboard (hero card + standings + lobby mini). **New Home** is a match queue:

1. **Filter row:** Upcoming · Needs you · Past
2. **Urgent hero card** — the single match that most needs your action, with 3 tappable "both free" time chips
3. **Match queue** — the rest of your matches as Variant B cards (one per match, body adapts to state)
4. **Tournament mini strip** — a one-line bracket peek at the bottom

The Bracket tab (tournament structure, swim-lane view) stays as a separate peer. Rating and Profile tabs stay as peers. **Four tabs total; no new tabs added.**

## 4. Screens in this bundle

Each screen lives as a React component in `mocks/`. Open `mocks/Rally Redesign.html` in a browser to see them all on a single canvas.

| Screen | File | Status |
|---|---|---|
| Logged-out home (marketing) | `LoggedOutHome.jsx` | hifi |
| **Home tab (primary surface)** | `HomeTab.jsx` | **hifi — ship this first** |
| Bracket tab (swim lanes) | `BracketTab.jsx` | hifi |
| Rating tab | `RatingTab.jsx` | hifi |
| Profile tab v4 (the synthesis — ship this) | `ProfileTabV4.jsx` | hifi |
| Profile tab A/B/C (alternatives — reference only) | `ProfileTab.jsx` | hifi |
| Onboarding (4 steps) | `Onboarding.jsx` | hifi |
| Match detail sheet | `MatchDetailSheet.jsx` | hifi |
| Post-match victory | `PostMatchVictory.jsx` | hifi |
| Brand atoms (Avatar, Wordmark, etc.) | `brand.jsx` | hifi |

---

## 5. The Home tab (detail)

This is the highest-impact surface — ship it first, measure, then roll out the rest behind a feature flag.

### Layout, top → bottom
1. **Top bar** (62px top inset for safe area): "Monday · April 21" eyebrow + "Hi, Alex" heading (28/800/-0.8), inbox bell with count badge, 40px avatar.
2. **Filter row:** 3 underlined tabs — Upcoming (active), Needs you, Past. Each has a count chip. Active tab is `--ink` + green underline + green filled count; inactive is `--ink-3` + grey count.
3. **Urgent hero card:**
   - Pulse dot + "Needs you" pill (red, `--urgent` / `--urgent-tint`)
   - "2d to confirm" meta text (right-aligned)
   - 48px avatar + opponent name (17/800/-0.3) + meta (`1378 · H2H 3–2 · Round 1 · Hyde Park Summer`)
   - One-sentence copy: *"Pick a time that works for both of you — all 3 slots below, you're both free."*
   - 3-column grid of **hero time chips** (SAT 20 / 10:00 / Hyde Park · C3 etc.); the first chip is featured (filled green, white text).
4. **Queue cards** (one per remaining match; gap 10px):
   - **Pending** cards: 3 smaller time chips inline under the opponent row
   - **Confirmed** cards: a mint-tinted strip with date block + time + court + "Details →"
   - **Waiting** cards: a blue-tinted strip with "Send a nudge" action
5. **Tournament mini strip:** single row — green icon tile + tournament name + "3 of 15 matches · you're #3" + "Bracket →" link.
6. **Glass tab bar:** Home (active) · Bracket · Rating · Profile. Backdrop-blur 20px saturate 180%, 85% white fill, 22px radius, 12px side margin, 24px bottom inset.

### Card states — the source of truth
A match card's body changes based on its state. Implement as a discriminated union:

```ts
type MatchState =
  | { kind: 'needs';     opp; round; slots: Slot[]; deadline: string }
  | { kind: 'confirmed'; opp; round; when: { day, date, time }; court: string }
  | { kind: 'waiting';   opp; round; note: string }
  | { kind: 'tbd';             round; note: string };
```

### The scheduling wedge — non-negotiable
The whole product pivots on this: **tapping a time chip is a one-tap commit.** No modal, no confirmation dialog, no second screen. Optimistic UI, toast on success, undo available in the toast for ~5 seconds.

---

## 6. Design tokens

**Single source of truth: `tokens.css` in this bundle.** Import it at your app root; all components reference `var(--token-name)`. Port the same values into your mobile theme file (React Native / SwiftUI / Compose) — same hex codes, same names, same semantics.

### Colors
```
--rally-green        #1F7A4D   /* primary accent + confirmed state */
--rally-green-tint   #E6F2EC
--rally-green-deep   #16603A
--rally-green-soft   #C9E4D5

--ink                #0E1421
--ink-2              #3A4151
--ink-3              #6B7280
--ink-4              #9AA0AB

--canvas             #F7F5F2
--surface            #FFFFFF
--hairline           #E6E4DF
--hairline-2         #EFEDE8

--confirmed          = --rally-green
--response           #2F6FEB
--response-tint      #E8F0FE
--warn               #4B5563
--warn-tint          #EEF0F3
--urgent             #D92D20
--urgent-tint        #FBE9E7
```

### Radii
- Time chips: 10px
- Inputs: 12px
- Buttons: 14px
- Cards: 18px
- Hero cards: 22px
- Pills: 999px

### Spacing (4px grid)
Use px literals against the 4px grid: 4, 8, 10, 12, 14, 16, 18, 20, 22, 24, 32, 48, 62 (top safe area), 80.

### Typography
- Family: SF Pro Display (`--font-sans`) for numbers + display; SF Pro Text (`--font-text`) for body.
- Scale (px): 9, 10, 11, 12, 13, 14, 15, 17, 22, 26, 28, 44.
- Display weights: 700 / 800. Body: 400 / 500 / 600.
- Letter-spacing: tighten display (-0.2 to -2); widen eyebrow (+0.08em uppercase).
- **Always apply `.num` class to numeric text** (scores, times, elo, counts).

### Shadows
```
shadow-card:   0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 24px -18px rgba(14,20,33,0.35)
shadow-hero:   0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 36px -20px rgba(14,20,33,0.3)
shadow-tabbar: 0 20px 40px -16px rgba(14,20,33,0.2)
```

---

## 7. Suggested implementation order

1. **Port `tokens.css`** into the app's theme layer. Resolve any current refs to `orange` / the old grey. This alone gets you ~50% of the reskin visible.
2. **Rebuild the Home tab** end-to-end from `HomeTab.jsx`. Ship behind a feature flag. Measure scheduling completion rate before/after.
3. **Rebuild remaining tabs** in order of traffic: Bracket → Profile (use v4) → Rating.
4. **Rebuild onboarding** (`Onboarding.jsx`) — same 4-step flow, just re-skinned.
5. **Rebuild the logged-out marketing home** (`LoggedOutHome.jsx`).

---

## 8. What's NOT in this bundle

If you need any of the below, ping the designer before implementing:
- **Match scoring flow** (courtside, one-thumb)
- **Walkover / no-show escalation UI**
- **Post-match loss screen** (victory exists; loss is its counterpart)
- **Push notification copy + layouts**
- **Empty states** beyond what's shown inline
- **Error states** (network, validation) — use your existing system for now
- **Dark mode** — the mocks are light-mode only; a dark-mode token set should follow

---

## 9. File map

```
design_handoff_rally_reskin/
├── README.md              ← this file
├── tokens.css             ← drop-in theme — START HERE
└── mocks/
    ├── Rally Redesign.html  ← open in a browser to see everything
    ├── styles.css           ← source for tokens.css (has extra notes)
    ├── HomeTab.jsx          ← PRIMARY SURFACE
    ├── BracketTab.jsx
    ├── RatingTab.jsx
    ├── ProfileTabV4.jsx     ← ship this Profile
    ├── ProfileTab.jsx       ← A/B/C alternatives (reference)
    ├── LoggedOutHome.jsx
    ├── Onboarding.jsx
    ├── MatchDetailSheet.jsx
    ├── PostMatchVictory.jsx
    └── brand.jsx            ← Avatar, RallyWordmark, MedalGlyph
```

## 10. Running the mocks locally

The mocks are inline-Babel React in a single HTML file — no build step:
```
cd design_handoff_rally_reskin/mocks
python3 -m http.server 8000
# open http://localhost:8000/Rally%20Redesign.html
```

Or just open `Rally Redesign.html` directly in a browser.

---

## 11. Open questions for the developer

1. **Is Rally React Native, native iOS, or web?** The mocks assume web. If native, the backdrop-blur tab bar + the keyboard-aware sheets need platform equivalents.
2. **Availability data model:** the urgent hero card assumes the server computes "both-free" overlap windows and returns 3 top slots. If your backend doesn't do this yet, that's a prerequisite to the whole wedge.
3. **Tab bar iconography:** the mocks use stroke icons drawn inline. Substitute with your existing icon set if you have one.
4. **Avatars:** mocks render a deterministic initials-on-color-background. If the app already shows real user photos, keep those and fall back to the initials version only when no photo.
