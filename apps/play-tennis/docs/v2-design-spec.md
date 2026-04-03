# Rally V2 Design Specification

Derived from the Rally Design Guidelines (.docx) and the V2 Navy & Gold palette. This document specifies the visual treatment for match cards across all statuses, buttons, in-app messaging, in-app scoring, and fairness/etiquette dialogue layouts.

---

## 1. Design Tokens

### Brand Palette

| Token | Hex | Usage |
|-------|-----|-------|
| Navy | `#1B2B4B` | Headings, dark fills, hero cards, text emphasis |
| Gold | `#C5993E` | Primary CTA, accent borders, progress fills, pending states |
| Cream | `#FAF5ED` | Page background, surfaces |
| Warm Grey | `#F5EFE4` | Secondary backgrounds, neutral badges |

### Semantic Colors

| Semantic | Background | Foreground | Usage |
|----------|-----------|------------|-------|
| Positive | `#E8F5E9` | `#2E8B57` | Confirmed, success, ready to play |
| Respond | `#EBF0F7` | `#1B2B4B` | Needs response, proposed time, informational |
| Warning | `#FEF3C7` | `#D97706` | Needs negotiation, scheduling attention |
| Danger | `#FDECEC` | `#E74C3C` | Escalated, dispute, urgent, destructive |
| Neutral | `#F5EFE4` | `#374151` | Completed, inactive, resolved |
| Purple | `#F0EAFF` | `#7C3AED` | Score confirmation, pending review |
| Accent | `rgba(197,153,62,0.1)` | `#C5993E` | Gold highlights, pending scheduling |

### Typography

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Card title (opponent name) | Playfair Display | 600 | 18px |
| Status eyebrow | Inter | 600 | 11px, uppercase, 1.5px letter-spacing |
| Time/meta label | Inter | 500 | 13px, tabular-nums |
| Supporting text | Inter | 400 | 14px |
| Button label | Inter | 600 | 14px |
| Score digits | Inter | 700 | 16px, tabular-nums |

### Spacing & Shape

| Property | Value |
|----------|-------|
| Card border-radius | 12px |
| Card border | 1px solid `#E5E0D5` |
| Card box-shadow | none |
| Card padding | 16px |
| Accent bar width | 4px (left border) |
| Button border-radius | 28px (pill) |
| Button height | 48px (primary), 36px (secondary/compact) |
| Avatar size | 40px circle |

---

## 2. Match Card Anatomy

Every match card follows a fixed 6-row anatomy regardless of state:

```
+--[accent bar]-------------------------------------------+
|  1. EYEBROW          status badge          [meta label]  |
|  2. [Avatar] Opponent Name    NTRP 4.0                   |
|  3. [icon] Sat, Apr 5  ·  3:00 PM  ·  Memorial Courts   |
|  4. [Primary Action Button]                              |
|  5. [secondary links: Message | Change Time]             |
|  6. [expanded panel: scheduling / scoring / messaging]   |
+----------------------------------------------------------+
```

**Rules:**
- Row order is fixed; rows can be hidden but never reordered
- State changes affect: accent color, eyebrow text, primary action, expanded content
- State changes never alter: spacing, typography scale, alignment, overall structure

---

## 3. Match Card States & Color Coding

### 3.1 CONFIRMED

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#2E8B57` (green) |
| Eyebrow | `CONFIRMED` — green text on `#E8F5E9` badge |
| Supporting | "Confirmed and ready to play." |
| Meta | Date/time of confirmed slot |
| Primary action | `View Match` (secondary outlined button) |
| Expanded | Match details, venue, Message button |

### 3.2 NEEDS RESPONSE (proposed time)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#1B2B4B` (navy) |
| Eyebrow | `NEEDS RESPONSE` — navy text on `#EBF0F7` badge |
| Supporting | "Review the proposed time and confirm if it works." |
| Meta | Proposed date/time |
| Primary action | `Confirm Time` (gold primary button) |
| Secondary | `Propose Different Time` text link |
| Expanded | Time proposal panel with Accept / Decline / Propose |

### 3.3 NEEDS SCHEDULING (unscheduled)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#C5993E` (gold) |
| Eyebrow | `NEEDS SCHEDULING` — gold text on gold-tinted badge |
| Supporting | "Set a time with your opponent." |
| Meta | none |
| Primary action | `Pick Time` (gold primary button) |
| Expanded | Day/hour picker, availability overlap display |

### 3.4 RESCHEDULE REQUESTED (you sent)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#D97706` (amber) |
| Eyebrow | `RESCHEDULE REQUESTED` — amber text on `#FEF3C7` badge |
| Supporting | "Waiting for your opponent to respond to the change request." |
| Meta | Current confirmed time |
| Primary action | `View Match` (secondary outlined button) |
| Expanded | Reschedule status, cancel request option |

### 3.5 NEEDS RESPONSE (reschedule received)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#D97706` (amber) |
| Eyebrow | `NEEDS RESPONSE` — amber text on `#FEF3C7` badge |
| Supporting | "Your opponent asked to move the current time." |
| Meta | Proposed new time |
| Primary action | `Change Time` (gold primary button) |
| Expanded | Accept / Decline / Counter-propose panel |

### 3.6 NEEDS NEW TIME (hard reschedule)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#D97706` (amber) |
| Eyebrow | `NEEDS NEW TIME` — amber text on `#FEF3C7` badge |
| Supporting | "This match needs a new confirmed time." |
| Meta | Last proposed time (if any) |
| Primary action | `Pick Time` (gold primary button) |
| Expanded | Full scheduling panel |

### 3.7 RESPOND NOW (escalated)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#E74C3C` (red) |
| Eyebrow | `RESPOND NOW` — red text on `#FDECEC` badge |
| Supporting | "Scheduling needs your response." |
| Meta | Proposed time (if any) |
| Primary action | `Respond Now` (red-accented primary button) |
| Expanded | Escalation details, respond panel |

### 3.8 CONFIRM SCORE (opponent reported)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#7C3AED` (purple) |
| Eyebrow | `CONFIRM SCORE` — purple text on `#F0EAFF` badge |
| Supporting | "Reported 6-4, 6-3. Review and confirm." |
| Meta | Countdown: "1d 22h left" |
| Primary action | `Confirm Score` (gold primary button) |
| Secondary | `Request Correction` text link |
| Expanded | Score confirmation panel |

### 3.9 SCORE REPORTED (you reported)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#7C3AED` (purple) |
| Eyebrow | `SCORE REPORTED` — purple text on `#F0EAFF` badge |
| Supporting | "Reported 6-4, 6-3. Waiting for opponent confirmation." |
| Meta | Countdown: "1d 22h left" |
| Primary action | `Correct Score` (secondary outlined button) |
| Expanded | Score correction form |

### 3.10 REVIEW DISPUTE

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#E74C3C` (red) |
| Eyebrow | `REVIEW DISPUTE` — red text on `#FDECEC` badge |
| Supporting | "Your opponent requested a correction." |
| Meta | Countdown remaining |
| Primary action | `Review Dispute` (red-accented primary button) |
| Expanded | Dispute review panel with Accept / Reject correction |

### 3.11 CORRECTION SUBMITTED

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#7C3AED` (purple) |
| Eyebrow | `CORRECTION SUBMITTED` — purple text on `#F0EAFF` badge |
| Supporting | "Waiting for your opponent to review the correction." |
| Meta | Countdown remaining |
| Primary action | none |

### 3.12 UNDER REVIEW

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#374151` (grey) |
| Eyebrow | `UNDER REVIEW` — grey text on `#F5EFE4` badge |
| Supporting | "Rally is reviewing the reported result." |
| Primary action | none |

### 3.13 COMPLETED

| Property | Value |
|----------|-------|
| Accent bar | none (or 4px left `#E5E0D5` muted) |
| Eyebrow | `COMPLETED` — grey text on `#F5EFE4` badge |
| Supporting | Score summary: "6-4, 6-3" |
| Meta | Date played |
| Primary action | none |
| Card opacity | 0.85 for visual de-emphasis |

### 3.14 RESOLVED (walkover / canceled)

| Property | Value |
|----------|-------|
| Accent bar | none |
| Eyebrow | `WALKOVER` or `CANCELED` — grey text on `#F5EFE4` badge |
| Supporting | "Recorded as a walkover." / "Recorded as canceled." |
| Primary action | none |

### 3.15 PENDING (system processing)

| Property | Value |
|----------|-------|
| Accent bar | 4px left, `#E5E0D5` (muted) |
| Eyebrow | `PENDING` — muted grey text |
| Supporting | "Rally is still creating a match time." |
| Primary action | none |

---

## 4. Status Badge Component

All eyebrow badges use the same structural pattern:

```css
.match-status-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
```

| Tone | Background | Text Color |
|------|-----------|------------|
| confirmed | `#E8F5E9` | `#2E8B57` |
| respond | `#EBF0F7` | `#1B2B4B` |
| schedule | `rgba(197,153,62,0.1)` | `#C5993E` |
| confirm-score | `#F0EAFF` | `#7C3AED` |
| escalated | `#FDECEC` | `#E74C3C` |
| completed | `#F5EFE4` | `#374151` |

---

## 5. Button Specifications

### 5.1 Primary Button (Gold Pill)

```
Background:  #C5993E
Text:        #1B2B4B
Font:        Inter 600, 14px
Height:      48px
Padding:     0 32px
Radius:      28px
Hover:       brightness(1.08)
Active:      brightness(0.95)
Full-width:  yes (within card context)
```

**Used for:** `Pick Time`, `Confirm Time`, `Confirm Score`, `Enter Score`, `Submit`

### 5.2 Secondary Button (Outlined Pill)

```
Background:  transparent
Border:      1.5px solid #1B2B4B
Text:        #1B2B4B
Font:        Inter 600, 14px
Height:      48px
Padding:     0 32px
Radius:      28px
Hover:       background #1B2B4B, text #FFFFFF
```

**Used for:** `View Match`, `Change Time`, `Message`, `Correct Score`, `Cancel`

### 5.3 Dark Button (Navy Pill)

```
Background:  #1B2B4B
Text:        #FFFFFF
Font:        Inter 600, 14px
Height:      48px
Padding:     0 32px
Radius:      28px
Hover:       brightness(1.15)
```

**Used for:** `Sign Up`, `Join Rally`, hero CTAs

### 5.4 Danger Button (Red Pill)

```
Background:  #E74C3C
Text:        #FFFFFF
Font:        Inter 600, 14px
Height:      48px
Padding:     0 32px
Radius:      28px
Hover:       brightness(1.08)
```

**Used for:** `Respond Now` (escalated), `Report Issue`, destructive confirmations

### 5.5 Compact Button (Small Pill)

```
Height:      36px
Padding:     0 20px
Font:        Inter 500, 13px
Radius:      20px
```

Inherits color from any of the above variants. Used in expanded panels, inline actions, quick message chips.

### 5.6 Text Link Button

```
Background:  none
Border:      none
Text:        #C5993E (gold) or #1B2B4B (navy)
Font:        Inter 500, 13px
Decoration:  none; underline on hover
Padding:     4px 0
```

**Used for:** secondary actions like `Propose Different Time`, `Skip`, `Cancel`

---

## 6. In-App Messaging Layout

### 6.1 Message Panel (embedded in match card)

The message panel renders inside the match card's expanded area (row 6), maintaining card context.

```
+----------------------------------------------------------+
|  [Match Card Header — rows 1-4]                          |
+----------------------------------------------------------+
|  MESSAGES                           [Close X]            |
|  --------------------------------------------------------|
|  [scrollable message body]                               |
|                                                          |
|    [bubble] Running late, be there in 10     3:42 PM     |
|                                                          |
|         No worries, I'll warm up [bubble]    3:43 PM     |
|                                                          |
|  --------------------------------------------------------|
|  [Quick chips: Running late | What court? | Looking...] |
|  --------------------------------------------------------|
|  [ message input                        ] [Send button]  |
+----------------------------------------------------------+
```

### 6.2 Message Bubbles

**Sent (current user):**
```
Background:  #1B2B4B (navy)
Text:        #FFFFFF
Border-radius: 16px 16px 4px 16px
Max-width:   75%
Alignment:   right
```

**Received (opponent):**
```
Background:  #F5EFE4 (warm grey)
Text:        #333333
Border-radius: 16px 16px 16px 4px
Max-width:   75%
Alignment:   left
```

**Timestamp:** Inter 400, 11px, `#9CA3AF`, shown on last message of a consecutive group.

### 6.3 Quick Message Chips

```
Background:  #EBF0F7
Text:        #1B2B4B
Font:        Inter 500, 13px
Padding:     8px 16px
Radius:      20px
Border:      1px solid #E5E0D5
Hover:       background #1B2B4B, text #FFFFFF
```

Preset options: "Running late", "What court?", "Looking forward to it!"

### 6.4 Message Input Bar

```
Background:  #FFFFFF
Border:      1px solid #E5E0D5
Radius:      24px
Height:      44px
Padding:     0 16px
Font:        Inter 400, 14px
Placeholder: "Type a message..."
Send button: 36px gold circle, white arrow icon
```

### 6.5 Inbox / Conversations List

Each conversation row in the Messages tab:

```
+----------------------------------------------------------+
|  [40px avatar]  Opponent Name              3:42 PM       |
|                 Last message preview...    [unread dot]   |
+----------------------------------------------------------+
```

- Avatar: 40px circle, navy background, white initials (Playfair Display 600)
- Unread indicator: 8px gold dot (`#C5993E`)
- Name: Inter 600, 15px, `#1B2B4B`
- Preview: Inter 400, 13px, `#6B7280`, single-line truncation
- Divider: 1px solid `#E5E0D5`

---

## 7. In-App Scoring Layout

### 7.1 Score Entry Panel (inline, expanded from match card)

```
+----------------------------------------------------------+
|  ENTER SCORE                                              |
|  "Enter the final score for your match."                 |
|  --------------------------------------------------------|
|                    Set 1    Set 2    Set 3                |
|  You (Pascal)     [ 6 ]    [ 6 ]    [   ]               |
|  vs                                                       |
|  James K.         [ 4 ]    [ 3 ]    [   ]               |
|  --------------------------------------------------------|
|  [Submit Score — gold primary button, full width]        |
+----------------------------------------------------------+
```

**Score Input Fields:**
```
Width:       48px
Height:      48px
Border:      1.5px solid #E5E0D5
Radius:      8px
Text-align:  center
Font:        Inter 700, 18px, tabular-nums
Focus border: #C5993E (gold)
Invalid:     border #E74C3C, subtle red bg
```

**Set Labels:** Inter 600, 12px, `#6B7280`, uppercase

**Player Names:**
- "You" label: Inter 600, 14px, `#1B2B4B`
- Opponent: Inter 400, 14px, `#333333`

**Validation feedback:** Inline, below input row. Inter 400, 12px, `#E74C3C`. Example: "Invalid set score."

### 7.2 Score Confirmation Panel

When opponent has reported a score and you need to confirm:

```
+----------------------------------------------------------+
|  CONFIRM SCORE                    [countdown: 1d 22h]    |
|  --------------------------------------------------------|
|  Reported by James K.                                    |
|  Score: 6-4, 6-3                                         |
|  Winner: Pascal                                          |
|  --------------------------------------------------------|
|  Auto-confirmed by: Sat, Apr 5 at 3:00 PM               |
|  --------------------------------------------------------|
|  [Confirm Score — gold primary, full width]              |
|  [Request Correction — secondary outlined]               |
|  [Report Issue — text link, red]                         |
+----------------------------------------------------------+
```

**Countdown badge:**
```
Background:  #F0EAFF
Text:        #7C3AED
Font:        Inter 600, 12px, tabular-nums
Padding:     4px 10px
Radius:      12px
```

**Score display:** Inter 700, 20px, `#1B2B4B`, tabular-nums

### 7.3 Score Correction Form

```
+----------------------------------------------------------+
|  CORRECTION                                               |
|  "Enter the correct score."                              |
|  --------------------------------------------------------|
|  [Same score input grid as 7.1]                          |
|  --------------------------------------------------------|
|  [Submit Correction — gold primary]                      |
|  [Cancel — text link]                                    |
+----------------------------------------------------------+
```

### 7.4 Dispute Review Panel

```
+----------------------------------------------------------+
|  REVIEW DISPUTE                   [countdown]            |
|  --------------------------------------------------------|
|  Original: 6-4, 6-3 (reported by you)                   |
|  Correction: 4-6, 6-3, 7-5 (proposed by James K.)      |
|  --------------------------------------------------------|
|  [Accept Correction — gold primary]                      |
|  [Reject Correction — secondary outlined]                |
|  --------------------------------------------------------|
|  "If you can't agree, Rally will review."               |
+----------------------------------------------------------+
```

---

## 8. Post-Match Feedback & Fairness Etiquette

### 8.1 Feedback Prompt (inline, after score submission)

Appears automatically after score is submitted or confirmed.

```
+----------------------------------------------------------+
|  HOW WAS YOUR MATCH?                                     |
|  "This stays private — only Rally sees it."              |
|  --------------------------------------------------------|
|  [  :)  Good match  ]     [  :(  Report issue  ]        |
|  --------------------------------------------------------|
```

**Sentiment Buttons:**
```
Good match:
  Background:  #E8F5E9
  Text:        #2E8B57
  Icon:        thumbs-up or smiley
  Radius:      12px
  Padding:     12px 24px

Report issue:
  Background:  #FDECEC
  Text:        #E74C3C
  Icon:        flag or frown
  Radius:      12px
  Padding:     12px 24px
```

### 8.2 Issue Report Form (expanded from "Report issue")

```
+----------------------------------------------------------+
|  REPORT ISSUE                                            |
|  "What happened?"                                        |
|  "Choose the issue that best describes the match."       |
|  --------------------------------------------------------|
|  Choose all that apply:                                  |
|                                                          |
|  [ ] Showed up late                                      |
|      Arrived more than 10 min after scheduled time.      |
|                                                          |
|  [ ] Left early / didn't finish                          |
|      The match ended early or could not be completed.    |
|                                                          |
|  [ ] Disputed the score unfairly                         |
|      The score report was challenged unreasonably.       |
|                                                          |
|  [ ] Unsportsmanlike behavior                            |
|      Behavior during the match was disrespectful.        |
|                                                          |
|  [ ] Other                                               |
|      Something else happened.                            |
|  --------------------------------------------------------|
|  [Optional: add details]                                 |
|  [ text area                                        ]    |
|  --------------------------------------------------------|
|  [Submit Report — danger button, full width]             |
|  [Go Back — text link]                                   |
+----------------------------------------------------------+
```

**Issue Checkboxes:**
```
Unchecked:
  Border:      1.5px solid #E5E0D5
  Background:  #FFFFFF
  Radius:      6px
  Size:        20px

Checked:
  Border:      1.5px solid #E74C3C
  Background:  #FDECEC
  Checkmark:   #E74C3C
```

**Issue Labels:** Inter 600, 14px, `#333333`
**Issue Details:** Inter 400, 13px, `#6B7280`

**Detail Text Area:**
```
Border:      1px solid #E5E0D5
Radius:      8px
Min-height:  80px
Padding:     12px
Font:        Inter 400, 14px
Placeholder: "Optional: tell us more..."
Focus:       border #C5993E
```

### 8.3 Feedback Confirmation

```
+----------------------------------------------------------+
|  [green check]  Feedback Saved                           |
|  "Thanks for your feedback"                              |
|  "This information is only for us at Play Rally."        |
+----------------------------------------------------------+
```

Green check icon, Inter 600, `#2E8B57`. Auto-dismisses after 1.5s.

### 8.4 Reliability Indicator (organizer-only)

Shown on player cards visible to tournament organizers:

```
[dot] Reliable player          — green dot (#2E8B57)
[dot] Some reliability concerns — amber dot (#D97706)
[dot] Low reliability           — red dot (#E74C3C)
```

Dot size: 8px. Label: Inter 400, 12px, color matches dot.

### 8.5 Reliability Nudge Notification

When a player's reliability score drops:

```
+----------------------------------------------------------+
|  [amber icon]  Reliability Notice                        |
|  "Your reliability is declining. Please respond to       |
|   scheduling requests promptly and show up on time."     |
+----------------------------------------------------------+
```

Critical level (red):
```
"Your reliability is critically low. Organizers may
 deprioritize your match scheduling."
```

---

## 9. Color Coding Quick Reference

| Color | Hex | Left Accent | Badge BG | Semantic Meaning |
|-------|-----|-------------|----------|------------------|
| Green | `#2E8B57` | Confirmed matches | `#E8F5E9` | Ready, confirmed, positive |
| Navy | `#1B2B4B` | Proposed time (needs response) | `#EBF0F7` | Action needed, informational |
| Gold | `#C5993E` | Unscheduled (needs scheduling) | `rgba(197,153,62,0.1)` | Pending, in progress |
| Amber | `#D97706` | Reschedule in progress | `#FEF3C7` | Warning, negotiation |
| Red | `#E74C3C` | Escalated, dispute | `#FDECEC` | Urgent, danger, destructive |
| Purple | `#7C3AED` | Score confirmation cycle | `#F0EAFF` | Review, pending confirmation |
| Grey | `#374151` | Completed, resolved | `#F5EFE4` | Inactive, past, muted |

---

## 10. Accent Bar Summary (Left Border)

Every match card uses a 4px left border as the primary status signal:

| Status | Accent Color | Tone |
|--------|-------------|------|
| Confirmed | `#2E8B57` green | confirmed |
| Needs Response (proposed) | `#1B2B4B` navy | respond |
| Needs Response (reschedule) | `#D97706` amber | respond |
| Needs Scheduling | `#C5993E` gold | schedule |
| Reschedule Requested | `#D97706` amber | respond |
| Needs New Time | `#D97706` amber | schedule |
| Respond Now (escalated) | `#E74C3C` red | escalated |
| Confirm Score | `#7C3AED` purple | confirm-score |
| Score Reported | `#7C3AED` purple | confirm-score |
| Review Dispute | `#E74C3C` red | confirm-score |
| Correction Submitted | `#7C3AED` purple | confirm-score |
| Under Review | `#374151` grey | completed |
| Completed | `#E5E0D5` muted | completed |
| Walkover / Canceled | none | completed |
| Pending | `#E5E0D5` muted | completed |
