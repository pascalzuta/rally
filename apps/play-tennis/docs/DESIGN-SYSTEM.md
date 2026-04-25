# Rally — Baseline Design System

## Overview

Rally is a local tennis tournament app. The visual identity is calm, typographic, and minimal. One font family, two weights, four sizes, four colors. Italic is the signature.

---

## Brand Mark

**"Rally"** set in Inter Bold Italic with a blue dot (●) floating to the upper-right of the "y".

- Font: Inter 700 italic, letter-spacing: -0.035em
- Dot: 18% of font-size circle, `#2563ff`, positioned above and to the right of the final letter
- The dot's bottom edge aligns with the top of the "y"

---

## Typography

**Family:** Inter (Google Fonts)
**Weights:** 500 (body), 700 (display/headings)
**Italic:** Reserved for emphasis — names, verbs, totals, key values. Never used for body text.

### Scale

| Token    | Size | Weight | Line-height | Letter-spacing | Usage                        |
|----------|------|--------|-------------|----------------|------------------------------|
| `h1`     | 44px | 700    | 1.02        | -0.035em       | Marketing hero headlines     |
| `h2`     | 28px | 700    | 1.05        | -0.03em        | Section headers              |
| `h3`     | 22px | 700    | 1.1         | -0.025em       | Card titles, screen headers  |
| `body`   | 14px | 500    | 1.5         | -0.005em       | Body text (color: ink-2)     |
| `micro`  | 11px | 500    | 1.3         | 0              | Labels, timestamps, metadata |

### Emphasis class: `.bg-em`

```css
font-style: italic;
color: var(--blue);
```

Used inline within headings and body text to highlight key words: names, scores, actions.

---

## Color Tokens

| Token         | Value     | Usage                                              |
|---------------|-----------|-----------------------------------------------------|
| `--bg`        | `#ffffff` | Page/card background                                |
| `--bg-2`      | `#f6f7f9` | Secondary background (page behind cards, input bg)  |
| `--ink`       | `#0b0d10` | Primary text                                        |
| `--ink-2`     | `#6a7079` | Secondary text, labels, metadata                    |
| `--line`      | `#e7e9ec` | Borders, dividers, separators                       |
| `--blue`      | `#2563ff` | Primary action, active states, links, system state  |
| `--blue-soft` | `#eaf0ff` | Blue tinted backgrounds (pills, buttons)            |
| `--amber`     | `#a86a0a` | Attention/warning state                             |

### Additional derived colors

- Amber soft background: `#fbf1de`
- Destructive/sign-out: `#c0392b`

### Color rules

- Blue = system state, active, interactive, progress
- Amber = needs attention, warnings
- Never use colored left-border accents on cards
- Color-coding is done via **status dots + pills** (see Components)

---

## Spacing & Radius

| Element            | Value   |
|--------------------|---------|
| Card border-radius | 16px    |
| Button radius      | 10–12px |
| Pill radius        | 999px (full round) |
| Input radius       | 12px    |
| Card padding       | 20px 18px |
| Page padding       | 14px    |
| Section divider    | 1px solid var(--line) |

---

## Components

### Card (`BCard`)

- White background, 1px solid `--line` border, 16px radius
- Padding: 20px top/bottom, 18px sides
- **No left accent rail** — status is conveyed via dot + pill inside
- Cards stack with ~10px gap

### Status Dot (`BStatusDot`)

- Small colored circle (8px default, 6px for section labels)
- Used inline with pills or headings to convey status color
- Colors: `--blue` (active/confirmed), `--amber` (needs attention)

### Pill (`BPill`)

- Rounded-full (999px radius), micro text size (11px), weight 500
- Padding: 3px 9px
- Tones:
  - **neutral:** bg `--bg-2`, text `--ink-2`
  - **blue:** bg `--blue-soft`, text `--blue`
  - **amber:** bg `#fbf1de`, text `--amber`
  - **ink:** bg `--ink`, text `#fff`
- Pills combine status label + metadata: "Score reported · 1d 7h left", "Confirmed · Thu, Apr 30 5pm"

### Status pattern (dot + pill)

Status is conveyed by a row with a colored dot and a pill:
```
[● dot] [pill: Status label · metadata]
```
This replaces the old eyebrow-text pattern. No uppercase labels above cards.

### Buttons

**Primary:**
- Background: `--blue`, text: white
- Padding: 14–17px, radius: 12–14px
- Font: 14px, weight 500

**Secondary/ghost:**
- Background: `--blue-soft`, text: `--blue`
- Same sizing as primary

**Outline:**
- Background: white, border: 1px solid `--line`
- Same sizing

**Icon button (circle):**
- 38px circle, white bg, 1px border
- Contains a 16px stroke icon

### Segmented control (tabs)

- Container: `--bg-2` background, 1px border, 999px radius, 4px padding
- Active tab: white bg, subtle shadow
- Inactive: transparent bg, `--ink-2` text
- Font: 13px, weight 500

### Bottom navigation

- 5 tabs: Home, Tournament, Quick Play, Rating, Availability
- Sticky bottom, white bg, top border
- Active: `--blue` color, inactive: `--ink-2`
- Icon: 20×20 stroke icons, 1.8 weight
- Badge: blue circle with white text, positioned top-right of icon
- Label: 11px, weight 500

### Top bar (header)

- Sticky top, white bg, bottom border
- Left: Rally logo mark (20px)
- Right: mail icon, notification bell (with badge), avatar circle (30px, `--ink` bg, white initials)

### Toast

- Positioned absolute bottom of content area
- White bg, 1px border, left 3px blue accent, 12px radius
- Shadow: `0 6px 24px rgba(11,13,16,0.08)`
- Contains checkmark circle + message text

### Notification row

- Left: 3px colored rail (blue or amber)
- Icon circle: 36px, tinted background matching rail color
- Title: 14.5px bold, subtitle: 13px body color

### Form inputs

- Border: 1px solid `--line` (focused: `--blue`)
- Radius: 12px
- Padding: 14px
- Font: 14px, weight 500

### Avatar

- Circle, `--ink` background, white text
- Sizes: 30px (header), 38px (player card), 68px (profile)
- Font: bold, size proportional

### Dividers

- Full-bleed within cards: `margin: 0 -18px`, 1px solid `--line`
- Between sections: 1px solid `--line` with ~14px vertical margin

---

## Icon style

- Stroke-only SVGs, 1.6–1.8 stroke width
- 20×20 viewBox for nav, 16×16 for inline
- Color: `#6a7079` (ink-2) default, `currentColor` for nav items
- No filled icons except badges and avatar circles

---

## Layout patterns

### App screens (logged-in)
- Top bar (sticky)
- Content area: `--bg-2` background, 14px padding, scrollable
- Bottom nav (sticky)
- Cards stack vertically with 10px gap

### Marketing / web pages
- No bottom nav
- White background
- Top bar with logo + CTA button (blue pill)
- Content padding: 22px sides, generous vertical spacing

### Match cards
- Dot + pill row at top (status + timer/date)
- Opponent name as h3 with italic emphasis
- Description as body text
- Action buttons below
- Divider line separating sections within card
- No nested bordered containers — inner content (score grids, rate options, forms) sits flat in the card

---

## Anti-patterns (do NOT do)

1. **No colored left-border accents** on cards
2. **No eyebrow text labels** (small colored uppercase text above card content)
3. **No box-in-box** — never nest a bordered container inside a bordered card
4. **No extra font weights** beyond 500 and 700
5. **No monospace or decorative fonts**
6. **No gradient backgrounds**
7. **No emoji in UI** (except leaderboard trophy)
8. Italic is for emphasis only — never for full paragraphs
