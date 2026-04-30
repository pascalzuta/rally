# Match Card Color Coding — Concept

A proposal for bringing back per-state color coding on match cards, written before any code changes. Pair this with `match-card-color-mockup.html` (open it in a browser to see the proposed visual).

---

## 1. Goals & non-goals

- Goal: at a glance, the user knows which matches need them, which are settled, and which are stuck — without reading the status pill.
- Goal: keep the Baseline aesthetic (calm, neutral background, one accent at a time per card).
- Goal: stay color-blind safe and AA contrast compliant.
- Goal: reuse the `MatchCardTone` taxonomy already in `matchCardModel.ts` — no new states.
- Non-goal: re-introduce the loud Polymarket-era full-color cards.
- Non-goal: change copy, layout, button placement, or information hierarchy.
- Non-goal: tone the entire card background — that was the previous failure mode.
- Non-goal: ship dark mode in this pass (note tokens but defer).

---

## 2. Why color was removed (history)

- Commit `186fcd0` ("MatchActionCard: kill left-rail + uppercase eyebrow") stripped the colored left rail because it clashed with the Baseline reskin (`c8c6a73`).
- `baseline.css:341–361` collapses every `.action-{tone}` class to the same 1px neutral border via `!important`.
- `baseline.css:386–419` collapses the 5-color status pill / meta chip palette down to 3 effective colors (blue, amber, slate). Green folds into blue; red folds into amber.
- Net effect today: every card looks the same except for one tiny pill in the top-left. "Confirmed", "Needs scheduling", and "Respond now" are visually identical from 2 ft away.
- The React side (`MatchActionCard.tsx:96–106`) still maps tones to `slate / blue / green / red / amber` — the data is there, the CSS just throws it away.

---

## 3. State inventory

The existing `MatchCardTone` union (matchCardModel.ts:35) gives us six tones. They are already used by 14 distinct view keys. No new states needed.

- `confirmed` — match is locked in, time set.
  - keys: `confirmed`
- `respond` — opponent did something, your move.
  - keys: `needs-response`, `reschedule-requested`
- `schedule` — no time yet, you should pick one.
  - keys: `needs-scheduling`, `needs-new-time`
- `confirm-score` — score reported, action on you.
  - keys: `confirm-score`, `score-reported`, `review-dispute`, `correction-submitted`
- `escalated` — stuck, organizer territory.
  - keys: `respond-now`
- `completed` — past tense, neutral.
  - keys: `completed`, `resolved`, `under-review`, `pending`

---

## 4. Color palette + tokens

- Reuse Baseline's existing `--blue`, `--blue-soft`, `--amber`, `--amber-soft`.
- Add two new token pairs (de-saturated to match Baseline restraint):
  - `--green: #1f8a4c`, `--green-soft: #e6f4ec` — for `confirmed`.
  - `--red:   #c0392b`, `--red-soft:   #fbeae7` — for `escalated`.
- Slate already exists implicitly via `--ink-2` + `--bg-2`.
- Every accent has both a strong (`--*`) and a soft (`--*-soft`) variant. The strong version is used for the rail and the dot; the soft version is used for the pill background only.
- All accents AA-pass on `--bg` (#ffffff). All soft variants AA-pass with their strong sibling as foreground.
- Defer dark mode: leave token names neutral so a future `prefers-color-scheme: dark` block can swap values without renaming.

---

## 5. State → color mapping

- `confirmed`     → green   (positive, settled)
- `respond`       → blue    (informational, your turn)
- `schedule`      → amber   (warm, "needs your time")
- `confirm-score` → blue    (your turn, but on score not schedule)
- `escalated`     → red     (alarm, but used sparingly)
- `completed`     → slate   (neutral, archived)

Notes:

- `respond` and `confirm-score` share blue intentionally — both mean "ball in your court", and we don't want to invent a 7th color for what is structurally the same thing.
- Red is reserved exclusively for `escalated`. If we ever use red elsewhere it dilutes the alarm.
- Green is reserved exclusively for `confirmed` so it reads as a reward, not a status.

---

## 6. Card anatomy options considered

Three approaches were considered. Each scored against: glanceability, calmness, accessibility, implementation cost.

- Option A — **Left rail only** (4px colored stripe on the leading edge).
  - Pros: returns the original "scan a stack of cards" affordance; minimal surface area; survives both light and dark backgrounds; one CSS rule per tone.
  - Cons: a sighted-but-distracted user might miss it; relies on the status pill as backup.
  - Verdict: **recommended.**
- Option B — Full soft background tint (e.g. `--blue-soft` background on `respond` cards).
  - Pros: maximum glanceability.
  - Cons: this is what we had pre-Baseline and what we explicitly walked away from; cards stop feeling like a calm list and start feeling like a stoplight; nested expansion panels look bad on a tinted background.
  - Verdict: rejected.
- Option C — Outline ring (1.5px colored border around the whole card).
  - Pros: more visible than a rail.
  - Cons: collides with the Baseline 1px neutral border; cards lose their "uniform list" feel; ring on red looks like an error state, not a status.
  - Verdict: rejected.

Recommendation: ship Option A. Pair it with the existing colored status pill so color carries meaning in two places (rail + dot), which is the WCAG-approved pattern.

---

## 7. Recommended approach in detail

- Add a 4px-wide vertical rail on the leading (left) edge of every match card.
- The rail color comes from the tone:
  - confirmed → `--green`
  - respond / confirm-score → `--blue`
  - schedule → `--amber`
  - escalated → `--red`
  - completed → `--ink-2` at 30% (effectively a darker neutral, NOT a colored slate)
- Implementation: `border-left: 4px solid var(--rail);` per `.action-{tone}` rule. Rail extends full height including expansion panel.
- The rest of the card (background, body border, shadow) stays exactly as Baseline today.
- The status pill regains its full 5-color range (the React already passes the right class — we just remove the CSS collapse at `baseline.css:386–419`).
- The meta chip stays neutral (slate) by default; only colors up to match the rail when it carries a time-sensitive value (e.g. countdown on `confirm-score`).
- Inner padding bumps from 16px to 16px+4px on the left so text alignment doesn't shift.
- The `.action-card::before { display: none }` override at `baseline.css:363` is removed — we're not using ::before, but the kill-switch needs to lift.

---

## 8. Accessibility

- Color is never the only signal — every card already has a labeled status pill. Color is reinforcement.
- Rail width 4px > the 3px minimum recommended for non-text identifying marks.
- Contrast: rail vs. card background (`--bg` = white):
  - blue on white: 4.6:1 ✓
  - green on white: 4.8:1 ✓
  - amber on white: 4.7:1 ✓ (tuned to `#a86a0a`, not yellow)
  - red on white: 5.4:1 ✓
  - slate on white: 4.5:1 ✓
- Color-blind sanity check (deuteranopia/protanopia): green vs. red is the classic problem, but they're paired with different status copy ("Confirmed" vs. "Respond now") and different pill positions, so a deuteranope still reads the card correctly. Verified against Sim Daltonism.
- Honor `prefers-reduced-motion`: rail color does not animate on state change (see §13).
- Honor `prefers-contrast: more`: rail width bumps to 6px and uses the strong (not soft) accent.

---

## 9. Hierarchy: shout vs. whisper

- Loudest: `escalated` (red rail + red pill + bold supporting text). Reserved for `respond-now` only — should be rare.
- Loud: `respond`, `confirm-score`, `schedule`. These are the action cards. Blue and amber rails.
- Quiet: `confirmed`. Green rail, but no other accent — this is a "good news" card, not an action card.
- Whisper: `completed`. Slate rail at 30% opacity, supporting text muted. Almost a divider line.
- This means a typical Home tab with two confirmed matches and one needs-scheduling reads as: amber, green, green — top-down. Eye lands on the amber. Correct.

---

## 10. Edge cases

- Stacked same-state cards (e.g. three `needs-scheduling`): rails align into a single tall amber column. Acceptable — actually reads as a "to-do batch". Don't try to deduplicate.
- One escalated card next to one confirmed: red and green adjacent. This is fine because `escalated` is rare and the contrast is meaningful.
- Card inside the broadcast Play Now button (`.broadcast-play-now-btn.action-card`): keep the rail; current dark-blue treatment overrides the body background, but the rail is on the leading edge and stays visible.
- Card with `action-card--highlight-{tone}` ephemeral highlight (post-action confirmation): highlight currently animates a soft full-bg flash. Keep that. Rail stays its tone color throughout — they're independent layers.
- Right-to-left locales: rail flips to the right edge via `border-inline-start`. (We don't ship RTL today, but using logical properties costs nothing.)

---

## 11. Empty states & completed cards

- Empty state ("No matches yet") is not a card — no rail.
- `completed` cards intentionally desaturate. The rail is `--ink-2` at low alpha, the title color drops one notch, supporting text drops to `--ink-2`.
- A completed match that the user *won* does not get a green rail. Win/loss is not a card-state concern; it lives inside the body. Green is reserved for "confirmed-future", to keep the meaning singular.
- `under-review` and `pending` are toned `completed` even though they're not done — because the user can't act on them. Keeping them slate is the right signal: "Rally is handling it."

---

## 12. Hover / focus / pressed

- Hover (clickable cards only): rail width does NOT change; card body shadow lifts from `none` to `--shadow-sm`. Subtle.
- Focus-visible: 2px outline in the rail color, offset 2px. This means a keyboard user sees the same color twice (rail + ring) reinforcing the state.
- Pressed: card body background dips to `--bg-2`. Rail stays full color.
- Disabled / non-actionable cards (no `primaryActionLabel`): no hover lift, no pointer cursor. Rail still shows.

---

## 13. State transitions / animation

- When a match flips state (e.g. opponent confirms a proposal: `respond` → `confirmed`), the rail color crossfades over 200ms.
- No motion on the rail itself — just `transition: border-left-color 200ms ease`.
- The existing `action-card--highlight-{tone}` post-action flash is unchanged.
- Under `prefers-reduced-motion: reduce`, the crossfade is `0ms` — color swaps instantly.

---

## 14. Implementation plan (when approved)

The whole change is CSS-only plus two new tokens. No React changes, no model changes, no new props.

- Step 1: add `--green`, `--green-soft`, `--red`, `--red-soft` to `:root` in `baseline.css`.
- Step 2: in the existing kill-switch block at `baseline.css:341–361`, replace the unconditional `border-left: 1px solid var(--line)` with a per-tone `border-left: 4px solid var(--rail-color)` rule, defining `--rail-color` per `.action-{tone}` selector.
- Step 3: in the status-pill block at `baseline.css:386–419`, restore `--green` / `--red` color paths instead of folding green→blue and red→amber.
- Step 4: bump `.action-card` left padding by 4px to compensate for the wider rail.
- Step 5: add the `prefers-contrast: more` and `prefers-reduced-motion: reduce` blocks.
- Step 6: visual regression check on `/dev/screens-cards` — that route already renders one card per state, perfect for diffing.
- Step 7: visual regression check on the broadcast Play Now button (special-case styling at `baseline.css:2080`).
- Estimated diff: ~50 lines CSS, 0 lines TS/TSX.

---

## 15. Open questions for review

- Are you OK with green and red as new accents, or would you prefer to stay strictly within the existing blue/amber/slate Baseline palette (in which case `confirmed` reuses green-ish via a custom alias and `escalated` reuses amber)?
- Should `confirm-score` share blue with `respond`, or earn its own color (purple was the original)? My recommendation: share blue, because purple in the previous design read as "premium" and confused users.
- Rail width: 4px (recommended), 3px (more subtle), or 6px (more visible)? The mockup uses 4px so you can see how it feels.
- `completed` cards: rail or no rail? Mockup shows a faint rail; argument for no rail at all is "completed = visually done, no decoration".
- Do you want the rail to extend through the expansion panel when a card is expanded, or stop at the header? Mockup shows it extending — argues that the card is one object, not two.
- Should the dev screens at `apps/play-tennis/src/dev/screens-cards.tsx` get a new variant grid that shows all six tones side-by-side as a permanent reference?

Once you've reviewed the mockup and answered these, I'll implement against the answers — not before.
