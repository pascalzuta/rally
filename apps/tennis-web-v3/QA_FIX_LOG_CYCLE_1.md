# Rally v3 — Fix Log (Cycle 1)

**Date:** 2026-03-09
**Fixes implemented:** 15

---

## Critical Fixes

### FIX-001: Score validation winner consistency (BUG-001)
**File:** `ScoreEntrySheet.tsx:83-108`
**Change:** Added winner/set outcome verification. After validating individual sets, the code now counts sets won by each side (aSetsWon vs bSetsWon) and rejects submissions where the declared winner doesn't match who actually won more sets.
**Impact:** Prevents corrupted tournament data from inconsistent score submissions.

### FIX-002: ProfileScreen availability state sync (BUG-002)
**File:** `ProfileScreen.tsx:21-31`
**Change:** Added `useEffect` to sync local `slots` state when the `availability` prop changes. Previously, `useState` only used the initial value, causing stale data display after saves or refreshes.
**Impact:** Users now see correct availability data after saving or navigating away/back.

### FIX-003: Error feedback for scheduling failures (BUG-005)
**File:** `App.tsx` (4 locations)
**Change:** Replaced all `console.error("Failed to load scheduling info:", e)` with `alert(e instanceof Error ? e.message : "Failed to load scheduling info")` to provide user-visible error feedback.
**Impact:** Users now see clear error messages instead of silent failures when scheduling info can't be loaded.

### FIX-004: Tournament detail fetch loop prevention (BUG-009)
**File:** `App.tsx:80,102-116`
**Change:** Added `fetchedDetailIds` ref to track which tournament IDs have already been fetched. The effect now skips tournaments already in the set, preventing infinite re-fetch loops when `getTournamentDetail` updates tournament state.
**Impact:** Eliminates potential infinite API call loop and excessive battery/network usage.

---

## High-Severity Fixes

### FIX-005: Action cards scroll CSS class (BUG-012)
**File:** `HomeScreen.tsx:108`
**Change:** Changed `className="action-cards-scroll"` to `className="action-scroll"` to match the CSS class definition.
**Impact:** Action cards now properly scroll horizontally with snap behavior as designed.

### FIX-006: Join button CSS class (CSS-005)
**File:** `HomeScreen.tsx:199`
**Change:** Changed `className="join-btn"` to `className="nearby-join-btn"` to match the CSS definition.
**Impact:** Join button is now properly styled with red background and rounded corners.

### FIX-007: City dropdown positioning and accessibility (BUG-015, CSS-003)
**File:** `SetupScreen.tsx:86-118`
**Change:** Wrapped city input + dropdown in a `position: relative` container so the absolutely-positioned dropdown appears correctly. Added `role="option"`, `tabIndex`, and `onKeyDown` handlers to city options for keyboard accessibility.
**Impact:** City dropdown positions correctly and is keyboard accessible.

### FIX-008: LoginScreen onLogin type fix (BUG-004)
**File:** `LoginScreen.tsx:4`
**Change:** Changed `onLogin: (email: string) => void` to `onLogin: (email: string) => void | Promise<void>` to match the actual async function signature.
**Impact:** TypeScript correctly recognizes the async nature of the login function.

### FIX-009: Dispute button behavior (BUG-006)
**File:** `ConfirmScoreSheet.tsx:63-68`
**Change:** Added a confirmation dialog explaining that disputing will leave the match pending. Previously, "Dispute" silently closed the sheet with no feedback.
**Impact:** Users now understand what happens when they dispute, and the action is intentional.

### FIX-010: TestBar Reset implementation (BUG-008)
**File:** `App.tsx:608`
**Change:** Changed `onReset={() => {}}` to `onReset={() => { if (token) reloadAll(); }}` so the Reset button actually refreshes app data.
**Impact:** TestBar Reset now properly reloads tournament and match data.

### FIX-011: Error Boundary (BUG-016)
**Files:** New `ErrorBoundary.tsx`, `main.tsx`
**Change:** Created class-based ErrorBoundary component that catches runtime errors and displays a user-friendly error screen with "Reload App" button. Wrapped `<App />` in `main.tsx`.
**Impact:** Unhandled errors no longer show a blank white screen.

### FIX-012: Save availability feedback (BUG-017)
**File:** `ProfileScreen.tsx:36-52,128`
**Change:** Added `saveStatus` state ("idle"/"saving"/"saved"/"error"), made `handleSave` async with try/catch, and updated button text to show current status. Updated prop type to accept `Promise<void>`.
**Impact:** Users see "Saving...", "Saved!", or "Failed — Try Again" feedback.

### FIX-013: Score entry player labels (UX-006)
**Files:** `ScoreEntrySheet.tsx:207-212`, `main.css`
**Change:** Added "You" and opponent name labels above the score input columns. Added CSS for `.score-player-labels`, `.score-player-label`, and spacer elements.
**Impact:** Users clearly see which column belongs to which player.

### FIX-014: TestBar gating (UX-007)
**File:** `App.tsx:374-378`
**Change:** TestBar now only shows when `?test` or `?dev` URL parameter is present, or when running in Vite dev mode (`import.meta.env.DEV`). Regular production users won't see it.
**Impact:** Consumer-facing app is clean; test functionality available via URL param.

### FIX-015: Data refresh polling (FEAT-001)
**File:** `App.tsx:124-130`
**Change:** Added a 30-second polling interval that calls `loadTournaments(token)` to keep tournament and match data fresh. Cleans up on unmount.
**Impact:** Users see opponent actions (score confirmations, schedule accepts) within 30 seconds without manual refresh.

---

## Build Verification

- TypeScript compilation: **PASS** (0 errors)
- Vite build: **PASS** (57 modules, 867ms)
- Bundle size: 197.96 kB JS (60.91 kB gzip), 39.29 kB CSS (6.04 kB gzip)
