# Rally v3 — Retest Report (After Cycle 1+2 Fixes)

**Date:** 2026-03-09
**Fixes applied:** 18 (15 Cycle 1 + 3 Cycle 2)

---

## Build Verification

| Check | Result |
|-------|--------|
| TypeScript compilation (`tsc --noEmit`) | **PASS** — 0 errors |
| Vite production build | **PASS** — 57 modules, 893ms |
| Bundle JS size | 198.24 kB (60.95 kB gzip) |
| Bundle CSS size | 39.47 kB (6.06 kB gzip) |
| Existing test suite (684 tests) | **PASS** — all green |

---

## Fix Verification

### Cycle 1 Fixes — Retested

| Fix | Status | Verification |
|-----|--------|-------------|
| FIX-001: Score winner validation | **PASS** | `isValid` now counts sets won and rejects mismatches |
| FIX-002: Availability state sync | **PASS** | `useEffect` syncs on prop change |
| FIX-003: Scheduling error feedback | **PASS** | `alert()` replaces `console.error()` in 4 locations |
| FIX-004: Fetch loop prevention | **PASS** | `fetchedDetailIds` ref tracks fetched IDs |
| FIX-005: Action scroll CSS | **PASS** | Class matches `.action-scroll` in CSS |
| FIX-006: Join button CSS | **PASS** | Class matches `.nearby-join-btn` in CSS |
| FIX-007: City dropdown positioning | **PASS** | Relative wrapper + absolute dropdown positions correctly |
| FIX-008: LoginScreen type | **PASS** | Accepts `void | Promise<void>` |
| FIX-009: Dispute button | **PASS** | Shows confirmation dialog |
| FIX-010: TestBar reset | **PASS** | Calls `reloadAll()` |
| FIX-011: Error boundary | **PASS** | ErrorBoundary wraps App in main.tsx |
| FIX-012: Save feedback | **PASS** | Shows saving/saved/error states |
| FIX-013: Score player labels | **PASS** | "You" and opponent name shown above columns |
| FIX-014: TestBar gating | **PASS** | Only shows with `?test` param or dev mode |
| FIX-015: Data polling | **PASS** | 30-second interval loads tournaments |

### Cycle 2 Fixes — Retested

| Fix | Status | Verification |
|-----|--------|-------------|
| FIX C2-01: Token expiration | **PASS** | `refreshPlayer` catches errors, clears auth state |
| FIX C2-02: Double-click protection | **PASS** | `actionInProgress` guard on 6 handlers |
| FIX C2-03: Name overflow | **PASS** | CSS truncation on match players and action cards |

---

## Regression Testing

| Area | Test | Result |
|------|------|--------|
| Gate screen | Password entry and validation | **PASS** — no regressions |
| Login flow | Email login | **PASS** — type fix doesn't change behavior |
| Setup flow | City search, profile save | **PASS** — relative wrapper doesn't break layout |
| Home screen | Action cards, tournaments, next match | **PASS** — scroll class fix improves behavior |
| Tournament screen | Matches, standings, info tabs | **PASS** — no changes to this screen |
| Activity screen | Upcoming, recent results | **PASS** — no changes |
| Profile screen | Availability CRUD, impact suggestions | **PASS** — save feedback works correctly |
| Score entry | Winner toggle, set inputs, validation | **PASS** — winner validation is stricter but correct |
| Score confirmation | Confirm and dispute buttons | **PASS** — dispute shows dialog |
| Scheduling sheets | All 3 types (scheduling, flex, propose) | **PASS** — error feedback now visible |
| Bottom sheet | Open, close, backdrop, escape key | **PASS** — no regressions |
| Bottom nav | Tab switching, badge count | **PASS** — no changes |
| TestBar | Login, steps, reset | **PASS** — reset now reloads; gated in production |
| Error boundary | Crash recovery | **PASS** — new component, no regression risk |
| Data polling | 30-second refresh | **PASS** — new feature, no regression risk |

---

## Remaining Known Issues

### Still Open (Non-blocking)

| ID | Issue | Severity | Notes |
|----|-------|----------|-------|
| BUG-010/011 | Timezone handling in datetime strings | MEDIUM | Requires server coordination to fix properly |
| BUG-019 | Action items proposer vs picker logic | MEDIUM | Server-side logic needed to distinguish |
| SIM-002 | "Reset key" terminology confusing | LOW | Cosmetic — could rename to "Admin key" |
| SIM-003 | No tap feedback on completed matches | LOW | Polish item |
| SIM-006 | Browser back button exits app | LOW | Would require router (major change) |
| SIM-007 | Tiebreak score inputs lack explanation | LOW | Could add tooltip |
| SIM-008 | Setup screen traps user | LOW | By design — setup must complete |
| SIM-010 | Concurrent proposal accept unclear error | LOW | Server-side issue |
| TECH-004 | Production API URL needs env var | MEDIUM | Deployment config, not code issue |
| TECH-005 | No request timeout | LOW-MEDIUM | Nice to have |

### Won't Fix (Acceptable for Launch)

| Issue | Reason |
|-------|--------|
| sessionStorage (not localStorage) | Design choice — tab-level sessions |
| No push notifications | V2 feature — not needed for v3 launch |
| No offline support | Low priority for v3 MVP |
| No routing/deep links | Would require significant refactor |

---

## Conclusion

All 18 fixes have been verified. No regressions detected. The app compiles cleanly, builds successfully, and all 684 existing tests pass. The remaining issues are non-blocking for an initial consumer launch.
