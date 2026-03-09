# Rally v3 — QA Findings Report (Cycle 1)

**Date:** 2026-03-09
**Auditor:** Automated QA (Claude)
**Scope:** Full codebase audit + functional/logical/usability/edge-case/technical testing

---

## Executive Summary

**Launch Readiness: NOT READY**

The v3 app has a solid foundation — it compiles cleanly, builds successfully, and the core architecture is sound. However, multiple critical and high-severity issues must be addressed before consumer launch. The most significant problems are:

1. **Profile state sync bug** — after setup, player data may not refresh
2. **Score validation gaps** — winner/set count mismatch not validated
3. **Missing error feedback** — multiple flows use `console.error` instead of user feedback
4. **Availability state desync** — ProfileScreen initializes from stale props
5. **TestBar always visible** — confusing for real consumers
6. **No loading indicators** — many async operations lack feedback
7. **Missing dispute flow** — "Dispute" button does nothing
8. **Action items may show stale data** — no polling/refresh mechanism

---

## 1. CRITICAL BUGS (Launch Blockers)

### BUG-001: Score validation doesn't verify winner matches set outcomes
**File:** `ScoreEntrySheet.tsx:83-101`
**Severity:** CRITICAL
**Description:** The `isValid` check validates individual set scores but never verifies that the declared winner actually won the majority of sets. A user can declare "I won" but enter scores where the opponent won 2 sets.
**Impact:** Corrupted tournament data, incorrect standings.
**Fix:** Add winner consistency check — count sets won by each side and verify winner declaration matches.

### BUG-002: ProfileScreen availability state initialized from stale props
**File:** `ProfileScreen.tsx:21-23`
**Severity:** CRITICAL
**Description:** `useState` only uses the initial prop value. If `availability` prop changes after mount (e.g., after saving or refreshing), the local `slots` state won't update. User sees stale data.
**Impact:** User thinks they saved availability but sees old data on next visit.
**Fix:** Use `useEffect` to sync `slots` state when `availability` prop changes, or derive state directly from props.

### BUG-003: handleSetupComplete doesn't refresh player after profile update
**File:** `App.tsx:349-360`
**Severity:** CRITICAL
**Description:** `handleSetupComplete` calls `updateProfile(data)` which calls `apiUpdateProfile` then `refreshPlayer()`. The `refreshPlayer` in useAuth uses `token` from state, but if this is the very first login, the token may not have been established when `refreshPlayer` was defined (stale closure). Also, `updateProfile` doesn't await properly — the setup screen may not transition.
**Impact:** User completes setup but gets stuck or sees stale state.
**Fix:** Ensure `updateProfile` awaits both the API call and player refresh, and the setup screen transitions correctly.

### BUG-004: onLogin prop type mismatch in LoginScreen
**File:** `LoginScreen.tsx:4` vs `App.tsx:398`
**Severity:** HIGH
**Description:** `LoginScreen` declares `onLogin: (email: string) => void` but `useAuth.login` returns `Promise<void>`. The LoginScreen calls `await onLogin(trimmed)` which works at runtime, but the type says it returns void, meaning the `try/catch` around it won't properly catch async errors from the login function.
**Impact:** Login errors may not be caught and displayed. The await on void is technically fine in JS but semantically wrong.
**Fix:** Change prop type to `(email: string) => Promise<void>`.

### BUG-005: Missing error feedback in scheduling/flex flows from home actions
**File:** `App.tsx:160-176`
**Severity:** HIGH
**Description:** When `getSchedulingInfo` fails in `handleAction` for "propose-times" and "pick-time" action types, the error is only logged to console. The user clicks an action card and nothing happens — no error message, no feedback.
**Impact:** Silent failures — user clicks buttons with zero feedback.
**Fix:** Show error toast/alert when scheduling info fails to load.

---

## 2. HIGH-SEVERITY BUGS

### BUG-006: Dispute button has no implementation
**File:** `ConfirmScoreSheet.tsx:64`
**Severity:** HIGH
**Description:** The "Dispute" button just calls `onClose()` — it does nothing to dispute the score. Users expecting to contest an incorrect score have no recourse.
**Impact:** Users cannot dispute incorrect scores. Trust erosion.
**Fix:** Either implement a dispute flow (API + UI) or remove the button and add a note about contacting the organizer.

### BUG-007: No loading states for async operations
**File:** Multiple files
**Severity:** HIGH
**Description:** Most action handlers (score submit, schedule, flex accept, propose times, accept time, join tournament) show no loading indicator. The user clicks and waits with no feedback.
**Affected flows:**
- `handleScoreSubmit` (App.tsx:226-247)
- `handleSchedule` (App.tsx:249-261)
- `handleFlexAccept` (App.tsx:263-275)
- `handlePropose` (App.tsx:277-292)
- `handleAcceptProposal` (App.tsx:294-306)
**Impact:** Users double-click, abandon, or lose trust.
**Fix:** Add loading state to bottom sheet actions.

### BUG-008: TestBar Reset doesn't clear app state
**File:** `App.tsx:604`
**Severity:** MEDIUM-HIGH
**Description:** `onReset` is `() => {}` — it does nothing. The TestBar's Reset button clears TestBar's internal state (completedSteps) but doesn't reload app data, logout, or reset the actual application state.
**Impact:** Confusing behavior during testing — reset appears to work but data persists.
**Fix:** Implement proper reset that reloads data or optionally logouts and resets.

### BUG-009: Tournament detail fetching in infinite loop risk
**File:** `App.tsx:102-112`
**Severity:** HIGH
**Description:** The useEffect that calls `getTournamentDetail` for each active tournament fires every time `tournamentKey` changes. But `getTournamentDetail` updates `tournaments` state (via setTournaments), which changes `tournamentKey`, which re-triggers the effect. This creates a potential infinite loop if the tournament data returned differs from what's already in state.
**Impact:** Excessive API calls, potential infinite loop, battery drain.
**Fix:** Use a separate ref to track which tournaments have been fetched, or compare data before updating.

### BUG-010: FlexSheet date calculation ignores timezone
**File:** `FlexSheet.tsx:39-40`
**Severity:** MEDIUM-HIGH
**Description:** The datetime is constructed as `${nearMiss.date}T${nearMiss.flexedWindow.startTime}` without timezone info. This will be parsed differently depending on the user's timezone, potentially scheduling for the wrong time.
**Impact:** Matches scheduled for wrong times across timezones.
**Fix:** Include timezone offset or use UTC consistently.

### BUG-011: ProposeSheet date generation timezone sensitive
**File:** `ProposeSheet.tsx:23-24`
**Severity:** MEDIUM-HIGH
**Description:** `generateOccurrences` uses `new Date()` and local timezone for date calculations. The generated datetime strings like `2026-03-10T09:00` don't include timezone, so they'll be interpreted differently on the server vs client.
**Impact:** Proposed times may be off by hours depending on timezone difference.
**Fix:** Use consistent timezone handling throughout.

---

## 3. MEDIUM-SEVERITY BUGS

### BUG-012: Action cards scroll container uses wrong CSS class
**File:** `HomeScreen.tsx:108` vs `main.css:227`
**Severity:** MEDIUM
**Description:** HomeScreen uses `className="action-cards-scroll"` but the CSS defines `.action-scroll`. The scroll container styles won't apply.
**Impact:** Action cards won't scroll horizontally as designed — they'll stack or overflow.
**Fix:** Change class to match: either update JSX to `action-scroll` or CSS to `action-cards-scroll`.

### BUG-013: Setup screen uses `login-btn` class instead of `setup-btn`
**File:** `SetupScreen.tsx:142-143`
**Severity:** LOW-MEDIUM
**Description:** The setup "Let's Go!" button uses `className="login-btn"` instead of the purpose-built `setup-btn` class. While both are styled, this is inconsistent.
**Impact:** Minor visual inconsistency.
**Fix:** Use `setup-btn` class.

### BUG-014: Setup form input classes inconsistent with CSS
**File:** `SetupScreen.tsx:77-137`
**Severity:** MEDIUM
**Description:** Setup form uses classes like `setup-input`, `setup-select`, `setup-label` but the CSS defines styles under `.setup-step input` and `.setup-step select` selectors. The `setup-screen` doesn't have a `setup-step` wrapper, so these CSS styles don't apply.
**Impact:** Setup form inputs may not be styled correctly.
**Fix:** Either add `setup-step` wrapper class or update CSS selectors.

### BUG-015: City dropdown not keyboard accessible
**File:** `SetupScreen.tsx:97-108`
**Severity:** MEDIUM
**Description:** City autocomplete dropdown items are `<div>` elements with `onClick` but no keyboard support (no `role`, no `tabIndex`, no `onKeyDown`). Users using keyboard or screen readers can't select a city.
**Impact:** Accessibility violation, keyboard users blocked.
**Fix:** Add proper ARIA roles and keyboard navigation.

### BUG-016: No error boundary for runtime crashes
**File:** App-wide
**Severity:** MEDIUM
**Description:** No React error boundary exists. An unhandled error in any component crashes the entire app with a blank screen.
**Impact:** Any runtime error = complete app death.
**Fix:** Add error boundary component wrapping the main app.

### BUG-017: Profile screen doesn't show save success/failure feedback
**File:** `ProfileScreen.tsx:36-44`
**Severity:** MEDIUM
**Description:** `handleSave` calls `onSaveAvailability(slots)` but has no try/catch, no success message, and no error feedback. User doesn't know if save worked.
**Impact:** User uncertainty about whether availability was saved.
**Fix:** Add try/catch with success/error feedback.

### BUG-018: Missing `login-input` class in setup screen
**File:** `SetupScreen.tsx`
**Severity:** LOW-MEDIUM
**Description:** The setup screen uses `setup-input` class for inputs, but the CSS styles are nested under `.setup-step`. Without the wrapper, native/default styling applies.
**Impact:** Unstyled or partially styled inputs on setup screen.

### BUG-019: useActionItems doesn't handle scheduling status correctly
**File:** `useActionItems.ts:66-71`
**Severity:** MEDIUM
**Description:** For `scheduling` status matches, it checks if any proposal's `acceptedBy` array doesn't include the player. But if the player is the one who proposed (not the one who needs to pick), they shouldn't see a "pick-time" action. The logic doesn't distinguish proposer from picker.
**Impact:** Both players may see "pick a time" when only the receiver should.
**Fix:** Check if the player is the proposal originator vs recipient.

---

## 4. USABILITY ISSUES

### UX-001: No visual hierarchy between home screen sections
**Severity:** MEDIUM
**Description:** All sections (action cards, next match, my tournaments, nearby) run together with minimal visual separation.
**Fix:** Add section dividers or spacing.

### UX-002: Tournament card on home doesn't show match progress
**Severity:** MEDIUM
**Description:** My Tournaments section shows tournament name and player count but not how many matches are completed out of total.
**Fix:** Add progress indicator (e.g., "3/6 matches completed").

### UX-003: No confirmation before joining tournament
**Severity:** MEDIUM
**Description:** Clicking "Join" immediately joins the tournament. If the user accidentally taps, there's no undo.
**Fix:** Add confirmation dialog or undo option.

### UX-004: Activity screen lacks filtering
**Severity:** LOW-MEDIUM
**Description:** No way to filter by tournament, status, or opponent.
**Fix:** Add basic filter options.

### UX-005: Availability form is cumbersome
**Severity:** MEDIUM
**Description:** Adding availability requires: select day → set start time → set end time → click Add → click Save. No visual preview of the week's schedule.
**Fix:** Consider visual week grid or simpler input pattern.

### UX-006: Score entry labels are ambiguous for home/away
**Severity:** MEDIUM
**Description:** ScoreEntrySheet shows score inputs as just two columns without labels indicating which column is for which player. User may enter scores in wrong order.
**Fix:** Label columns with player names.

### UX-007: TestBar is always visible and confusing for consumers
**Severity:** HIGH
**Description:** The TestBar at the bottom (T1-T6 buttons, step buttons, reset) is always shown. Regular consumers will be confused by test accounts and debug steps.
**Fix:** Gate behind URL parameter or environment variable, not always-on.

### UX-008: No pull-to-refresh or manual refresh
**Severity:** MEDIUM
**Description:** No way to manually refresh data. User must navigate away and back.
**Fix:** Add pull-to-refresh or refresh button.

### UX-009: Empty state on TourneyScreen when no tournament selected
**Severity:** LOW
**Description:** Shows "Select a tournament above to view details" but the selector might be empty.
**Fix:** Better empty state messaging based on context.

### UX-010: No back navigation from tournament detail
**Severity:** LOW-MEDIUM
**Description:** Once viewing a tournament in the Tourney tab, there's no back button to go back to a tournament list (there isn't a list — just a selector dropdown).
**Fix:** Consider tournament list view.

---

## 5. TECHNICAL RISKS

### TECH-001: No API request deduplication
**Severity:** MEDIUM
**Description:** Multiple effects can fire simultaneously, causing duplicate API calls. For example, `loadTournaments` and `loadMatchesForTournaments` can race.
**Fix:** Add request deduplication or use React Query/SWR.

### TECH-002: sessionStorage for auth is session-only
**Severity:** LOW (design choice)
**Description:** Using sessionStorage means users lose auth when closing the tab. This is intentional for v3 but may confuse users.
**Fix:** Consider localStorage with explicit logout, or document as intended.

### TECH-003: No CSP or security headers beyond _headers file
**Severity:** LOW
**Description:** The `_headers` file exists but only has basic headers. No Content-Security-Policy.
**Fix:** Add appropriate CSP headers.

### TECH-004: API base URL fallback may break in production
**Severity:** MEDIUM
**Description:** `const API = import.meta.env.VITE_API_URL || "/v1"` — in production on Netlify, `/v1` won't proxy to the backend. Need to set `VITE_API_URL` in Netlify env.
**Fix:** Ensure Netlify deployment has `VITE_API_URL` set to the production API URL.

### TECH-005: No request timeout handling
**Severity:** MEDIUM
**Description:** All fetch calls have no timeout. A hung server = infinite loading.
**Fix:** Add AbortController with timeout to API calls.

---

## 6. CSS/VISUAL ISSUES

### CSS-001: action-cards-scroll class mismatch (see BUG-012)
### CSS-002: setup-step selector mismatch (see BUG-014)

### CSS-003: Missing city-dropdown styles
**File:** `SetupScreen.tsx:98` / `main.css`
**Severity:** MEDIUM
**Description:** SetupScreen uses `className="city-dropdown"` and `className="city-option"` but these classes are not defined in main.css. The `.setup-step .city-results` and `.city-result` classes exist but don't match.
**Impact:** City autocomplete dropdown is unstyled.
**Fix:** Add matching CSS or update class names.

### CSS-004: Tournament card in HomeScreen lacks full styling
**File:** `HomeScreen.tsx:157-176`
**Severity:** MEDIUM
**Description:** Uses `tournament-card` class which exists in CSS, but the card structure (header + details) doesn't fully match the CSS expectation.
**Impact:** Cards may look rough.

### CSS-005: Join button styling mismatch
**File:** `HomeScreen.tsx:198-205`
**Severity:** LOW-MEDIUM
**Description:** Uses `className="join-btn"` but CSS has `.nearby-join-btn`. Styles won't apply.
**Impact:** Join button appears unstyled.
**Fix:** Update to `nearby-join-btn` or add `.join-btn` styles.

---

## 7. MISSING FEATURES (Launch Blockers)

### FEAT-001: No data refresh/polling mechanism
**Severity:** HIGH
**Description:** Data is only loaded on mount and after explicit user actions. If the opponent schedules a match or confirms a score, the current user won't see the update until they navigate away and back.
**Fix:** Add periodic polling (every 30s) or WebSocket for real-time updates.

### FEAT-002: No notification that opponent has acted
**Severity:** MEDIUM
**Description:** No push notifications, no in-app notifications, no email. Users have no way to know when the opponent has proposed times, confirmed a score, etc.
**Fix:** At minimum, add polling with a "new updates" banner.

### FEAT-003: No loading skeleton/shimmer states
**Severity:** MEDIUM
**Description:** When data is loading, screens show nothing or empty states. No skeleton screens.
**Fix:** Add loading skeletons for main content areas.

### FEAT-004: No offline resilience
**Severity:** LOW
**Description:** No service worker, no offline detection, no cached data.
**Fix:** Add basic offline detection banner.

---

## 8. PRIORITIZED FIX PLAN

### Phase 1: Critical Fixes (Must fix for launch)
1. **BUG-001** Score validation winner consistency
2. **BUG-002** ProfileScreen availability state sync
3. **BUG-005** Error feedback for scheduling failures
4. **BUG-007** Loading states for async operations
5. **BUG-009** Tournament detail fetch loop prevention
6. **BUG-012** Action cards scroll CSS class fix
7. **CSS-003** City dropdown styling
8. **CSS-005** Join button styling
9. **BUG-014** Setup form CSS selectors
10. **UX-007** TestBar gating (env/URL param)

### Phase 2: High Priority Fixes
11. **BUG-006** Dispute button implementation or removal
12. **BUG-008** TestBar reset implementation
13. **BUG-004** LoginScreen onLogin type fix
14. **BUG-016** Error boundary
15. **BUG-017** Save availability feedback
16. **UX-006** Score entry column labels
17. **FEAT-001** Data refresh polling

### Phase 3: Medium Priority Fixes
18. **BUG-010/011** Timezone handling
19. **BUG-015** City dropdown keyboard accessibility
20. **BUG-019** Action items proposer vs picker logic
21. **UX-002** Tournament progress indicator
22. **UX-003** Join confirmation
23. **TECH-005** Request timeout handling

### Phase 4: Polish
24. **UX-001** Section spacing/visual hierarchy
25. **UX-005** Availability form UX
26. **UX-008** Pull-to-refresh
27. **FEAT-003** Loading skeletons
28. **BUG-003** Setup complete flow robustness
