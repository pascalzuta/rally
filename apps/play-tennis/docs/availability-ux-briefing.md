# Availability UX Redesign — Internal Panel Briefing

## Panel: PM, UX Designer, UI Designer

### Problem
Availability input is the single highest-friction step in onboarding. Current implementation shows a mode toggle (Custom times / Quick presets), 7 quick-slot options, and a weekly cap picker — too many decisions for a new user who just wants to start playing.

### Research Summary
Studied Calendly, Google Calendar, Superhuman, Doodle, When2meet, Cal.com, Reclaim.ai, SavvyCal, and rec sports apps. Key finding: chip-based selection is the gold standard for mobile time input. Grids (When2meet) fail on phones. Calendar sync is wrong for this audience — rec players' calendars don't reflect tennis availability.

---

## Decisions (with dissent)

### 1. Frequency question comes first: "How often do you want to play?"

**PM:** Frames the interaction as commitment, not data entry. Maps directly to weekly cap. Two taps to answer.
**UX (challenge):** Isn't this redundant with the time slots they pick? If they pick 3 slots, we know they want 2-3x/week.
**PM (response):** It sets intent. A player who picks 5 slots but only wants 1 match/week gives the scheduler better data. It also front-loads an easy question — reduces perceived effort of the step.
**Decision:** Keep it. Place above time slots. Three options: 1-2x, 2-3x, 3+ per week.

### 2. Reduce quick slots from 7 to 5, merge weekend days

**UI:** Current 7 options overwhelm. Combine Saturday/Sunday into "Weekend mornings" and "Weekend afternoons." Gets us to 5 options — within the 3-5 sweet spot from UX research.
**UX (challenge):** Players who want Saturday but not Sunday lose granularity.
**PM:** That's what Profile edit is for. Onboarding collects rough; Profile allows precise. Research from NNGroup: each additional option increases decision time. 5 is the right ceiling.
**Decision:** 5 options in onboarding. Weekday evenings, Weekend mornings, Weekend afternoons, Weekday mornings, Weekday afternoons.

### 3. Pre-select "Weekday evenings" by default

**UX:** Opt-out beats opt-in for completion rates. Weekday evenings is the most popular rec tennis time slot.
**UI (challenge):** Pre-selection can feel presumptuous. Users might submit without reviewing.
**PM:** That's a feature, not a bug. One-tap completion for the majority case. The "enough to start" message makes the selection visible.
**Decision:** Pre-select weekday evenings. Show clear visual feedback that it's selected.

### 4. Remove mode toggle — chips only, custom times as progressive disclosure

**UI:** The mode toggle (Custom times / Quick presets) creates a decision before the real decision. Most onboarding users will never need custom times.
**UX:** Agree. Hide "Add specific times" behind a text link at the bottom. Only power users will need it.
**PM (challenge):** Won't some users feel trapped by the presets?
**UX (response):** The link is always visible. It just doesn't compete visually with the primary flow. This is textbook progressive disclosure.
**Decision:** Remove the segmented toggle. Show chips as the default. "+ Add specific times" link reveals the custom day/start/end row.

### 5. "Enough to start" progress threshold

**PM:** Show "X slots selected — enough to start matching!" as soon as ≥1 slot is selected. This eliminates the "am I done?" anxiety.
**UX:** The live matchable player count already serves this purpose.
**PM:** Different function. The matchable count shows social proof. The threshold message confirms task completion. Both matter.
**Decision:** Show threshold message above the CTA. Keep matchable count as a separate feedback element.

### 6. Social proof: "X players share your times"

**UX:** Already implemented but buried. Make it more prominent — it's the immediate reward for inputting availability.
**UI:** Keep it compact. One line, green accent on the number, tabular-nums per design guidelines.
**Decision:** Keep existing implementation, ensure visibility. Already aligns with design guidelines (data-forward, monospace counts).

---

## Design Guidelines Compliance

| Guideline | How we comply |
|-----------|--------------|
| Data-forward | Frequency count, matchable players, slot count — all prominent |
| One clear primary action | "Start Competing" is the only CTA |
| Compact, scannable | 5 chips instead of 7, no mode toggle |
| Stable shells | Same card/button patterns as existing quick-slot chips |
| Color as state support | Green for positive feedback, blue accent for selected chips |
| Typography discipline | Monospace tabular-nums for counts, consistent scale |
| In-card interaction | All input happens in one scrollable view, no navigation |

---

## What we're NOT doing (and why)

- **Two-tier availability (preferred vs flexible):** Good idea from SavvyCal research but adds data model complexity. Revisit in v2.
- **Calendar sync:** Wrong for this audience. Rec players' Google Calendars don't reflect tennis time.
- **AI/natural language input:** Overkill for 5 tap targets. Reserve for future.
- **Post-registration match-yield nudge:** Requires tournament context. Ship separately.

## Implementation scope

1. Register.tsx: Redesign availability step (frequency → chips → progressive disclosure)
2. Profile.tsx: Update QUICK_SLOTS to match new 5-option set
3. styles.css: Frequency picker styles, progress indicator styles
