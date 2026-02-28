# Rally — Comprehensive Test Report vs. Briefing Document

**Date:** 2026-02-25
**Tested against:** `apps/tennis-web/project.md` (briefing/spec document)
**Methodology:** Three parallel test agents (API/backend, frontend/UI, core logic/code audit) + manual verification

---

## Executive Summary

| Category | Pass | Fail | Warning |
|---|---|---|---|
| API Routes & Backend | 18 | 3 | 4 |
| Frontend UI & Screens | 14 | 2 | 5 |
| Core Logic & Code | 18 | 4 | 5 |
| **TOTALS** | **50** | **9** | **14** |

**Critical failures:** 9 items where the implementation contradicts the briefing specification.
**Warnings:** 14 items that are technically working but deviate from the briefing in minor ways, have edge cases, or represent incomplete implementations.

---

## SECTION 1: BUGS (Runtime Errors & Broken Functionality)

### BUG-1: React crash when navigating to logged-in state after HMR ❌
**Severity:** Medium
**Reproduction:** After Vite hot-module reload, clicking a test account card sometimes causes the App component to crash with a blank screen. Console shows `Error occurred in the <App> component` at the compiled line. Clearing `sessionStorage` and reloading fixes it.
**Root cause:** Stale session state in `sessionStorage` after HMR causes the app to attempt rendering with an inconsistent player/token state.
**Affected file:** `apps/tennis-web/src/App.tsx`

### BUG-2: `DELETE /v1/pool/leave` silently succeeds when not in pool ❌
**Severity:** Low
**Reproduction:** Call `DELETE /v1/pool/leave` without ever signing up for the pool. Returns `{"ok": true}` instead of an error.
**Expected:** 404 or 409 error indicating the player is not in the pool.
**Affected file:** `apps/tennis-server/src/http/routes.ts` line 417-420

### BUG-3: `PUT /v1/players/me` is a full replace, not a partial update ⚠️
**Severity:** Medium
**Reproduction:** Send `PUT /v1/players/me` with only `{"city": "San Francisco"}` — it fails validation because `name` and `level` are required fields. Must send ALL fields every time.
**Briefing says:** "Update name / city / county / level / ntrp" (implies partial update)
**Impact:** Frontend must always send all profile fields, even unchanged ones, or the request will be rejected.
**Affected file:** `packages/tennis-core/src/validation.ts` (playerProfileSchema), `apps/tennis-server/src/http/routes.ts`

---

## SECTION 2: BRIEFING SPEC vs. IMPLEMENTATION DISCREPANCIES

### DISC-1: Standings tiebreaker #5 — Lexicographic, NOT SHA-256 ❌
**Briefing says:** "Deterministic hash (SHA-256 of sorted player IDs + month)"
**Code does:** Simple lexicographic string comparison (`idA < idB ? -1 : 1`)
**Code comment says:** "This avoids needing crypto (SHA-256) which would not work in browser contexts."
**Additionally:** The `computeStandings` function does not accept a `month` parameter at all.
**Affected file:** `packages/tennis-core/src/standings.ts` lines 140-146

### DISC-2: NTRP band 4.0 threshold mismatch ❌
**Briefing says:** Band 4.0 covers "NTRP 4.0+"
**Code does:** Band 4.0 covers NTRP > 3.5 (i.e., 3.6+)
**Impact:** A player self-rating at NTRP 3.6, 3.7, 3.8, or 3.9 would be placed in the 4.0 band instead of the 3.5 band. In practice, the frontend only allows 0.5 increments so 3.6-3.9 cannot be selected via the UI, but the API accepts arbitrary decimals.
**Affected file:** `packages/tennis-core/src/rating.ts` lines 135-139
**Fix:** Change `if (ntrp <= 3.5) return "3.5"` to `if (ntrp < 4.0) return "3.5"`

### DISC-3: No Stripe webhook handler implemented ❌
**Briefing says:** "Stripe (checkout sessions, webhooks, customer portal)"
**Code does:** `STRIPE_WEBHOOK_SECRET` is in the config schema, but there is zero webhook handling code anywhere in the codebase. `grep -r "webhook"` in the entire server directory returns no results.
**Impact:** In production, Stripe payment confirmations would never update a player's subscription status server-side. Currently works only because dev mode auto-activates subscriptions.
**Affected file:** `apps/tennis-server/src/http/routes.ts` (missing route), `apps/tennis-server/src/services/stripe.ts` (missing handler)

### DISC-4: Stripe customer portal route missing ❌
**Briefing says:** "customer portal" is part of the Stripe integration
**Code does:** `createPortalSession()` function exists in `apps/tennis-server/src/services/stripe.ts` but NO route exposes it. There is no `POST /subscription/portal` or similar endpoint.
**Impact:** Subscribers have no way to manage or cancel their subscriptions.
**Affected file:** `apps/tennis-server/src/http/routes.ts` (missing route)

### DISC-5: "Live now" pulsing dot is RED, not GREEN ❌
**Briefing says:** "Live now: tournaments with status: active | finals (pulsing green dot)"
**Code does:** `.live-dot { background: #D50A0A; }` — This is NFL Red, not green. The `pulse-live` animation keyframes also use `rgba(213, 10, 10, ...)` (red).
**Affected file:** `apps/tennis-web/src/styles/main.css` lines 1051-1063

### DISC-6: Nav tab labels use Inter font, not Oswald ❌
**Briefing says:** "Oswald 700 for ALL headings + buttons + labels (uppercase, tracked)"
**Code does:** `.nav-btn { font-family: "Inter", sans-serif; }` — Nav labels (Home, Matches, Players, Schedule, Me) use Inter instead of Oswald.
**Verified via:** `preview_inspect` on `.nav-btn` returns `font-family: "Inter, sans-serif"`
**Affected file:** `apps/tennis-web/src/styles/main.css` (`.nav-btn` class, around line 179)

### DISC-7: Nearby players filter is county OR city, not just city ❌
**Briefing says:** "GET /players/nearby — Same city, +/-300 ELO"
**Code does:** Filters by `(same county OR same city) AND +/-300 ELO`
**Impact:** Returns a broader set of players than the briefing specifies. Players in the same county but different cities appear in results.
**Affected file:** `apps/tennis-server/src/domain/rating.ts` lines 57-60

### DISC-8: Bob & Charlie (NTRP 3.0) seeded into NTRP 3.5 tournament ❌
**Briefing says:** "NTRP 3.5 Active tournament (Greater London) with Alice, Ethan, Bob, Charlie"
**Issue:** Bob (NTRP 3.0, band "3.0") and Charlie (NTRP 3.0, band "3.0") are placed in a 3.5-band tournament. The `skillBandFromNtrp(3.0)` function returns `"3.0"`, so the tournament engine would never naturally group them with 3.5 players. The seed data manually forces this cross-band grouping.
**Note:** The briefing itself is inconsistent — it both specifies the band logic (3.0 band = NTRP 2.5-3.0) and the seed tournament (3.5 band with 3.0 players). Either the briefing or the seed needs correcting.
**Affected file:** `apps/tennis-server/src/http/seed.ts`

---

## SECTION 3: WARNINGS (Minor Deviations & Edge Cases)

### WARN-1: No 0.5-step enforcement on NTRP in API validation ⚠️
**Briefing says:** "Self-rated NTRP: 2.5-5.0 in 0.5 steps"
**Frontend does:** Correct — uses button selector with [2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
**API does:** Zod schema is `z.number().min(2.5).max(5.0)` — accepts arbitrary decimals like 3.3, 3.7, 4.1
**Risk:** Direct API callers can bypass the 0.5-step constraint
**Fix:** Add `.multipleOf(0.5)` or `.refine(v => (v * 2) % 1 === 0)` to the schema
**Affected file:** `packages/tennis-core/src/validation.ts` line 10

### WARN-2: Casual (non-tournament) matches skip two-player confirmation ⚠️
**Briefing says:** Score reporting uses a two-player confirmation flow
**Code does:** Tournament matches follow the full pending → confirmed → disputed flow. BUT casual matches (`POST /matches/:id/result`) use a single-report flow — one player reports and it's immediately confirmed with ELO update.
**Impact:** Casual match results can be unilaterally set by one player
**Affected file:** `apps/tennis-server/src/http/routes.ts` lines 291-347

### WARN-3: Pool signup uses ad-hoc validation instead of Zod schema ⚠️
**Briefing says:** "Zod schemas for all API requests"
**Code does:** `POST /pool/signup` does inline `typeof req.body.county === "string"` checks instead of using a Zod schema. No `poolSignupSchema` exists in `validation.ts`.
**Affected file:** `apps/tennis-server/src/http/routes.ts`, `packages/tennis-core/src/validation.ts`

### WARN-4: Two ELO systems coexist — undocumented distinction ⚠️
**Code has:** Basic ELO (`computeRatingUpdate`, K=32/K=16 by games played) AND Enhanced ELO (`computeEnhancedRatingUpdate`, K=32/K=48 by provisional flag, with margin multiplier)
**Usage:** Basic ELO is used for casual matches; Enhanced ELO for tournament matches
**Briefing says:** Only describes Enhanced ELO. Does not mention two separate systems or that casual matches use a different formula.
**Impact:** Could confuse developers maintaining the codebase
**Affected file:** `packages/tennis-core/src/rating.ts`

### WARN-5: Subscription auto-activation in dev mode is undocumented ⚠️
**Code does:** When `STRIPE_SECRET_KEY` is not set, `POST /subscription/checkout` automatically sets the player's subscription to `"active"` and returns `{ activated: true }`.
**Briefing says:** Nothing about this dev-mode fallback behavior
**Impact:** All demo testing shows subscriptions as working, but the actual Stripe flow is untested
**Affected file:** `apps/tennis-server/src/http/routes.ts` (subscription checkout route)

### WARN-6: CORS origin is hardcoded ⚠️
**Code does:** Only `http://localhost:5174` is returned as `Access-Control-Allow-Origin`
**Impact:** Will block any other frontend origin in production deployment
**Affected file:** `apps/tennis-server/src/http/app.ts`

### WARN-7: Session-based login uses `sessionStorage` — no refresh token ⚠️
**Briefing says:** "HMAC tokens (HS256, 24h TTL)"
**Code does:** Token stored in `sessionStorage`. After 24h expiry, user must re-login. No refresh token mechanism.
**Impact:** Users will be silently logged out after 24h without warning
**Affected file:** `apps/tennis-web/src/App.tsx`

### WARN-8: Tournament engine 30-second tick not verified at runtime ⚠️
**Briefing says:** "runs on a 30-second interval"
**Code does:** `setInterval(() => this.tick(), 30_000)` — correct in code
**Note:** Engine only processes pools when entries exist. No telemetry or logging of tick execution, making production debugging difficult.
**Affected file:** `apps/tennis-server/src/services/tournamentEngine.ts`

### WARN-9: Pool CTA card not shown on home screen ⚠️
**Briefing says:** "Pool CTA card: shown when player has no active tournament. Shows NTRP band, county, signup progress bar, countdown."
**Code does:** The home screen shows tournaments and city search, but there is no explicit "Pool CTA card" widget as described — the pool functionality is accessed only via the empty state after searching a city with no tournaments.
**Impact:** Users in their home county with no tournaments won't see a proactive prompt to join the pool unless they explicitly search.
**Affected file:** `apps/tennis-web/src/App.tsx`

### WARN-10: `findByCity` query is case-sensitive ⚠️
**Code does:** `apps/tennis-server/src/repo/memory.ts` — `findByCity` uses `p.city === city` (exact match, case-sensitive). If a player's city is stored as "london" but queried as "London", they won't match.
**Impact:** Nearby players search may miss players due to case mismatch
**Affected file:** `apps/tennis-server/src/repo/memory.ts`

### WARN-11: No edit-profile option visible in the Profile/Me screen ⚠️
**Briefing says:** Profile screen includes "edit profile option"
**Code does:** The profile screen shows stats, subscription, tournaments, and a sign-out button. There IS a `ProfileEdit` component that renders when `editingProfile` state is true, but it appears to toggle inline rather than being a separate screen. Navigation flow could be clearer.
**Affected file:** `apps/tennis-web/src/App.tsx`

### WARN-12: Missing explicit "countdown" timer for pool ⚠️
**Briefing says:** Pool CTA shows "signup progress bar, countdown"
**Code does:** Shows pool progress bar ("X of 8 players"), and `daysRemaining` is returned by the API, but no visible countdown timer is rendered in the pool UI sections (empty state card or tournament requested confirmation).
**Affected file:** `apps/tennis-web/src/App.tsx`

### WARN-13: Briefing mentions "ELO: K=32 first 20 games, K=16 after, floor 100" in "Earlier" section ⚠️
**Briefing's "Earlier — Initial build"** section says: "ELO: K=32 first 20 games, K=16 after, floor 100"
**Current code:** This basic ELO still exists in `rating.ts` and is used for casual matches. The Enhanced ELO (K=32/48 provisional) was added later. Both coexist.
**Impact:** The briefing progress log doesn't clearly state the basic ELO was preserved for casual matches

### WARN-14: iPhone 16 safe-area CSS exists but untestable in browser ⚠️
**Briefing says:** "viewport-fit=cover, env(safe-area-inset-*) on header + bottom nav, apple-mobile-web-app-capable, 16px minimum input font-size"
**Code does:** CSS includes `env(safe-area-inset-*)` and header padding uses `max(14px, env(safe-area-inset-top))`. However, the meta tag `apple-mobile-web-app-capable` and `viewport-fit=cover` could not be verified in the current test environment (desktop preview).
**Affected file:** `apps/tennis-web/index.html`

---

## SECTION 4: PASSING ITEMS (Verified Correct)

### API Routes
- ✅ `GET /v1/health` — returns `{"ok": true}`
- ✅ `GET /v1/cities/search?q=` — no auth required, smart ranked search works (exact > starts-with > contains)
- ✅ `POST /v1/auth/login` — works as both register (new email) and login (existing email)
- ✅ `GET /v1/players/me` — returns player profile with auth
- ✅ `PUT /v1/players/me` — updates profile (full replace)
- ✅ `GET /v1/players/me/availability` — returns slots array
- ✅ `PUT /v1/players/me/availability` — replaces availability
- ✅ `GET /v1/players/:id` — returns any player's profile
- ✅ `GET /v1/matches` — returns player's matches
- ✅ `POST /v1/matches` — creates challenge with AI proposals
- ✅ `GET /v1/tournaments` — lists with county/band/status filters
- ✅ `GET /v1/tournaments/:id` — detail with player names
- ✅ `GET /v1/tournaments/:id/matches` — all tournament matches
- ✅ `POST /v1/tournaments/:id/join` — join registration tournament
- ✅ `DELETE /v1/tournaments/:id/leave` — leave tournament
- ✅ `POST /v1/pool/signup` — join pool with optional county
- ✅ `GET /v1/pool/status` — returns county interest with `totalCountyInterest` and `bandBreakdown`
- ✅ `POST /v1/subscription/checkout` — works (dev mode auto-activates)
- ✅ `GET /v1/subscription/status` — returns subscription info

### Auth System
- ✅ HS256 JWT tokens with `createHmac("sha256", secret)`
- ✅ 24-hour TTL (`60 * 60 * 24` seconds)
- ✅ `timingSafeEqual` for signature verification
- ✅ Email-only login acts as both register and login

### Seed Data
- ✅ All 6 players match briefing values (name, email, rating, NTRP)
- ✅ All in Greater London
- ✅ All subscriptions set to "active"
- ✅ 2 tournaments seeded

### Tournament Engine
- ✅ 5 lifecycle steps execute in correct order: processPoolSignups → checkRegistrationWindows → checkFinals → checkTournamentCompletion → autoResolveDisputes
- ✅ Registration activates at 8 players immediately OR 4+ players after 7 days
- ✅ Finals creates #1v#2 championship and #3v#4 match
- ✅ Score reporting: pending → confirmed/disputed → 48h auto-resolve
- ✅ Pool entries grouped by (county, band)

### Round-Robin Algorithm
- ✅ Circle method with fixed player 0 and rotation
- ✅ (N-1) rounds for even N, N rounds for odd N
- ✅ Target weeks distributed across 4 weeks
- ✅ Bye index -1 for odd player count

### Standings (first 4 tiebreakers)
- ✅ Wins descending
- ✅ Head-to-head (2-way only)
- ✅ Set differential
- ✅ Game differential

### Enhanced ELO
- ✅ Base K=32, Provisional K=48
- ✅ Margin multiplier 1.0-1.5 via `Math.min(1.5, 1 + 0.05 * setDiff + 0.01 * gameDiff)`
- ✅ Confidence 0.0-1.0 scales K-factor
- ✅ Rating floor of 100

### AI Scheduling
- ✅ Uses OpenAI `gpt-4.1-mini` model
- ✅ Hits `https://api.openai.com/v1/chat/completions`
- ✅ Algorithmic fallback when API key missing or API fails

### City Data
- ✅ 468 cities (exceeds "400+" claim)
- ✅ 12 Marin County cities present
- ✅ 13 UK cities for demo compatibility
- ✅ Search ranking: exact > starts-with > contains

### Design (verified)
- ✅ Colors: `#D50A0A` red primary, `#060e1e` bg, `#0c1a2e` surface
- ✅ Header: `#030810` with `3px solid` red bottom border
- ✅ Buttons: `border-radius: 4px`, uppercase, `letter-spacing: 0.08em`, Oswald 700
- ✅ Cards: `border-radius: 8px`, `border: 1px solid #1c3050`
- ✅ Typography: Oswald for headings, Inter for body
- ✅ Logo: `r.png` in upper-left on all screens
- ✅ `logo.png` used in hero/landing

### Screen Flow
- ✅ Start → Login (signup: "Join Rally" / signin: "Welcome back") → Setup → Home
- ✅ 5 nav tabs: Home, Matches, Players, Schedule, Me
- ✅ Tournament cards clickable → tournament-detail
- ✅ Setup screen: name, city autocomplete, NTRP selector [2.5, 3.0, 3.5, 4.0, 4.5, 5.0]
- ✅ City autocomplete auto-fills county
- ✅ City search debounced (250ms)
- ✅ Area pill with clear button
- ✅ Empty state with "Start a tournament" / "Join the waitlist" CTA
- ✅ Session per tab via `sessionStorage`

### Config
- ✅ All env vars match briefing specification

### Project Structure
- ✅ All listed files exist in specified locations

---

## SECTION 5: RANKED PRIORITY LIST

### Must Fix (Functional Bugs / Spec Violations)

| # | Issue | Type | Severity | File(s) |
|---|-------|------|----------|---------|
| 1 | Live dot is red, briefing says green | DISC-5 | Medium | `main.css:1055` |
| 2 | Nav labels use Inter, briefing says Oswald | DISC-6 | Medium | `main.css:179` |
| 3 | Bob/Charlie (3.0) in 3.5 tournament | DISC-8 | Medium | `seed.ts` or `project.md` |
| 4 | Tiebreaker #5 is lexicographic, not SHA-256 | DISC-1 | Low | `standings.ts:144` |
| 5 | Band 4.0 threshold > 3.5 vs briefing "4.0+" | DISC-2 | Low | `rating.ts:137` |
| 6 | Nearby players uses county OR city, not just city | DISC-7 | Low | `domain/rating.ts:59` |
| 7 | DELETE /pool/leave returns ok when not in pool | BUG-2 | Low | `routes.ts:417` |

### Should Fix (Missing Features / Incomplete Implementation)

| # | Issue | Type | Severity | File(s) |
|---|-------|------|----------|---------|
| 8 | No Stripe webhook handler | DISC-3 | High | `routes.ts`, `stripe.ts` |
| 9 | Stripe customer portal unreachable | DISC-4 | High | `routes.ts` |
| 10 | No Pool CTA card on home screen | WARN-9 | Medium | `App.tsx` |
| 11 | No countdown timer in pool UI | WARN-12 | Low | `App.tsx` |
| 12 | NTRP 0.5-step not enforced in API | WARN-1 | Low | `validation.ts` |
| 13 | Pool signup missing Zod schema | WARN-3 | Low | `validation.ts`, `routes.ts` |

### Nice to Have (Robustness / Code Quality)

| # | Issue | Type | File(s) |
|---|-------|------|---------|
| 14 | PUT /players/me should support partial updates | BUG-3 | `validation.ts` |
| 15 | Casual matches skip 2-player confirmation | WARN-2 | `routes.ts` |
| 16 | Two ELO systems undocumented | WARN-4 | `rating.ts` |
| 17 | findByCity is case-sensitive | WARN-10 | `memory.ts` |
| 18 | Dev-mode subscription auto-activate undocumented | WARN-5 | `routes.ts` |
| 19 | CORS origin hardcoded | WARN-6 | `app.ts` |
| 20 | No refresh token mechanism | WARN-7 | `App.tsx` |
| 21 | React crash after HMR with stale session | BUG-1 | `App.tsx` |

---

*Report generated by three parallel test agents covering API/backend, frontend/UI, and core logic/code audit.*
