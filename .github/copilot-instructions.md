# Rally Design System

## Design Context

### Users
Local recreational and competitive tennis players (adults, mixed skill levels) who want to play more tennis in their county. They open Rally on their phone, usually on the go or between activities, to check upcoming matches, coordinate schedules, and track their progress. The job to be done: **remove all friction from finding and playing local tennis matches** -- from signup to stepping on the court.

### Brand Personality
**Friendly, Effortless, Precise.**
- **Friendly**: Approachable and warm, never intimidating. This is community tennis, not corporate software.
- **Effortless**: Complexity is hidden. Scheduling, grouping, and matchmaking happen automatically. The UI feels like it just works.
- **Precise**: Data is trustworthy and clear. Times, scores, ratings, and status are always accurate and easy to scan.

### Emotional Goals
Rally should simultaneously evoke:
- **Excitement + anticipation**: "My next match is coming up, let's go" -- the app should feel alive with upcoming activity
- **Calm confidence**: "Everything is organized, I just show up and play" -- no anxiety about logistics

### Aesthetic Direction
**Athletic social app meets clean fintech.** Moving away from the Polymarket prediction-market aesthetic toward something warmer and more active.

**References**:
- **Strava / Nike Run Club**: Athletic identity, social community feel, celebration of activity and progress, bold use of brand color
- **Robinhood / Coinbase**: Clean data presentation, clear primary actions, minimal chrome, confidence-inspiring UI

**Anti-references**:
- Polymarket / prediction markets (too cold, too transactional)
- Generic sports apps with busy layouts and ad-heavy interfaces
- Enterprise/corporate tools (too sterile)

**Theme**: Light mode only. Green brand identity (`#16a34a`).

### Design Principles

1. **Data is the interface.** Numbers, times, and status are the primary visual elements. Let data breathe -- don't decorate it. Use monospace/tabular figures for scores, ratings, and counts.

2. **One action per moment.** Every screen and card has one obvious thing to do next. Secondary actions exist but never compete for attention. Progressive disclosure over information overload.

3. **Status at a glance.** Use color-coded signals (green = confirmed, blue = needs response, orange = needs negotiation, red = canceled) consistently across all views. A player should understand their match status in under 2 seconds.

4. **Warm precision.** Combine the trustworthiness of clean data presentation (Robinhood) with the warmth and energy of athletic social apps (Strava). Rounded corners, generous spacing, and friendly copy soften the precision.

5. **Mobile-first, thumb-friendly.** Every interaction is designed for one-handed phone use. Tap targets are 44px minimum. Critical actions are reachable in the thumb zone. The app caps at 480px width.

### Design Tokens Summary

**Colors**: Green brand (`#16a34a`), semantic status palette (green/blue/orange/red), neutral grays for text hierarchy
**Typography**: Inter (system font stack), monospace for numbers. Scale from 11px (micro) to 40px (hero)
**Spacing**: 4px base unit (4/8/12/16/24/32/48)
**Radii**: 4px (small) to 16px (cards), 999px (pills)
**Shadows**: Subtle and layered (1px-8px blur), blue-tinted focus rings
**Motion**: 100-400ms durations, expo/quart easing, spring bounce for emphasis

### Accessibility
Standard best practices: good contrast ratios, visible focus states, semantic HTML, meaningful alt text. No formal WCAG compliance target yet, but aim for AA-level contrast on text.
