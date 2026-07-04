# Product

## Register

product

> Note: the app UI (logged-in) is the primary surface — register `product`. The pre-login
> surfaces (marketing homepage, blog "The Baseline", support) are brand surfaces and may be
> treated per-task as `brand`, but they inherit the same Baseline visual system.

## Users

Recreational and competitive tennis players (NTRP 2.0–5.0+) in US counties who want to
play real matches without organizing them. Context: mobile-first, checking between work
and family time. Job to be done: "get me on a court with a fair opponent at a time I'm
free, without 20 texts of back-and-forth."

## Product Purpose

Rally auto-schedules local tennis matches and tournaments. Players join their county,
set availability once, and Rally forms round-robin tournaments (6+ players), matches by
skill level, and confirms times from overlapping availability windows. Success = matches
played per player per week with minimal coordination effort. Free.

## Brand Personality

Calm, typographic, minimal. Three words: calm · confident · effortless. The voice is
direct and lightly playful ("Stop texting. Start playing.", "Play tennis. Skip the
texting."). Emotional goal: relief — the app removes a chore. Italic + blue is the
signature emphasis; it marks names, verbs, and key values, never whole paragraphs.

## Anti-references

- Polymarket-style data-dense dashboards (the legacy pre-Baseline look — explicitly retired)
- Sports-app clichés: neon green tennis balls, gradients, aggressive "beast mode" energy
- Colored left-border accent rails on cards, uppercase eyebrow labels, box-in-box nesting
- Monospace/decorative fonts, more than two font weights (500/700 only)
- Emoji in UI (except the leaderboard trophy)

## Design Principles

1. **One font, two weights, four sizes, four colors.** Inter 500/700; ink/ink-2/line/blue.
   Restraint is the identity.
2. **Italic is the signature.** Emphasis via italic blue (.bg-em), never via color-coded
   rails or uppercase labels.
3. **Status = dot + pill.** Color communicates state through a small dot and a rounded
   pill, inside white cards on --bg-2.
4. **Copy does the selling.** Marketing surfaces lean on the headline voice, not imagery
   or decoration.
5. **Every surface reads as one product.** Blog, support, auth, and app share tokens from
   `src/baseline.css` (documented in `docs/DESIGN-SYSTEM.md`).

## Accessibility & Inclusion

- WCAG AA contrast target for body text (ink #0b0d10 / ink-2 #6a7079 on white or #f6f7f9)
- Touch targets ≥ 44px on mobile app surfaces
- Reduced-motion alternatives for scroll-reveal and card animations
- Semantic HTML on static pages (blog/support) for SEO and screen readers
