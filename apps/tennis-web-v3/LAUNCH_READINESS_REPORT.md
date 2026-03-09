# Rally v3 — Launch Readiness Report

**Date:** 2026-03-09
**Version:** v3.0.0-rc1
**QA Cycles Completed:** 2

---

## Launch Status: NEAR READY, ONE MORE DEPLOYMENT STEP REQUIRED

The Rally v3 app is code-complete and QA-validated. All critical and high-severity bugs have been fixed. The app needs to be deployed and tested against the live backend to confirm production readiness.

---

## 1. Executive Assessment

### What's Ready
- All core user journeys work reliably
- Onboarding flow (gate → login → setup → home) is clear and functional
- Tournament lifecycle (join → schedule → play → score → confirm → standings) is complete
- All 3 scheduling tiers (auto, flex, propose & pick) work correctly
- Score entry with tennis rule validation is robust
- Error handling provides user-visible feedback
- Double-click protection prevents duplicate submissions
- Data refreshes automatically every 30 seconds
- Error boundary catches unexpected crashes gracefully
- TestBar is gated behind URL parameter (clean for consumers)
- TypeScript strict mode — zero errors
- 684 tests pass with no regressions

### What Still Needs Attention
- **Deployment configuration:** `VITE_API_URL` must be set in Netlify to point to the production backend
- **Timezone handling:** Datetime strings lack timezone info (medium risk in multi-timezone usage)
- **10 remaining low/medium issues** documented in retest report (non-blocking)

---

## 2. Quality Metrics

| Metric | Value |
|--------|-------|
| Total bugs found | 28 |
| Critical bugs fixed | 5 |
| High-severity bugs fixed | 10 |
| Medium-severity bugs fixed | 3 |
| Remaining unfixed issues | 10 (all low/medium) |
| Fix success rate | 100% (18/18 verified) |
| Regression count | 0 |
| Build success | Yes (57 modules, <1s) |
| Test suite | 684/684 passing |
| Bundle size (JS) | 198 kB (61 kB gzip) |
| Bundle size (CSS) | 39 kB (6 kB gzip) |

---

## 3. User Journey Validation

| Journey | Status | Notes |
|---------|--------|-------|
| Gate password | PASS | Shake animation, error messages, reset flow |
| Email login/signup | PASS | Error handling, loading states |
| Profile setup | PASS | City autocomplete with keyboard access, validation |
| Home screen | PASS | Action cards scroll, next match, tournaments |
| Join tournament | PASS | Availability check, double-click protection |
| Tournament matches view | PASS | Round grouping, finals support |
| Standings | PASS | Correct sorting, rating deltas, highlight current user |
| Scheduling (tier 1-3) | PASS | All 3 tiers with error feedback |
| Score entry | PASS | Tennis validation, winner consistency, tiebreaks |
| Score confirmation | PASS | Confirm + dispute with dialog |
| Availability management | PASS | CRUD with save feedback |
| TestBar (dev mode) | PASS | 6-step lifecycle, gated behind URL param |

---

## 4. What Was Fixed (Summary)

### Cycle 1 (15 fixes)
1. Score validation verifies winner matches set outcomes
2. Availability state syncs when props change
3. Scheduling errors show user-visible alerts (not just console)
4. Tournament detail fetch prevents infinite loop
5. Action cards scroll horizontally (CSS class fixed)
6. Join button properly styled (CSS class fixed)
7. City dropdown positions correctly with keyboard support
8. Login screen accepts async onLogin
9. Dispute button shows confirmation dialog
10. TestBar Reset reloads app data
11. Error boundary catches runtime crashes
12. Save availability shows feedback (saving/saved/error)
13. Score entry shows "You" vs opponent labels above columns
14. TestBar gated behind ?test URL parameter
15. 30-second data polling keeps matches fresh

### Cycle 2 (3 fixes)
16. Token expiration gracefully redirects to login
17. Double-click protection on all critical actions
18. Long player names truncate with ellipsis

---

## 5. Remaining Issues Log

| # | Issue | Severity | Rationale for Deferral |
|---|-------|----------|----------------------|
| 1 | Timezone in datetime strings | Medium | Requires server-side coordination; low impact when users are in same timezone |
| 2 | Action items proposer/picker logic | Medium | Server must provide reporter info; edge case |
| 3 | "Reset key" terminology | Low | Cosmetic; only admin-facing |
| 4 | No tap feedback on completed matches | Low | Polish item |
| 5 | Browser back exits app | Low | Requires router (v4 feature) |
| 6 | Tiebreak explanation text | Low | Power users understand; tooltip sufficient |
| 7 | Setup traps user | Low | By design — must complete profile |
| 8 | Concurrent accept unclear error | Low | Race condition; server handles correctly |
| 9 | API URL env var for production | Medium | Deployment config, not code |
| 10 | No request timeout | Low-Medium | Nice to have; server responds fast |

---

## 6. Deployment Checklist

- [ ] Merge branch `claude/github-access-check-aDDBD` to `main`
- [ ] Create Netlify site for v3 (separate from v2)
- [ ] Set build command: `npm run build -w @rally/web-v3`
- [ ] Set publish directory: `apps/tennis-web-v3/dist`
- [ ] Set env var: `VITE_API_URL` = `https://rally-tennis-server.onrender.com/v1`
- [ ] Deploy and verify gate screen loads
- [ ] Test login flow against live backend
- [ ] Test TestBar at `?test` URL
- [ ] Run through full tournament lifecycle
- [ ] Confirm 30-second polling works

---

## 7. Recommendation

**The app is ready for consumer launch** once deployed and verified against the live backend. All critical user journeys are reliable, major bugs are fixed, and the remaining issues are minor polish items that can be addressed post-launch.

The 10 remaining issues are categorized as non-blocking and can be resolved in a follow-up release. The app meets the bar for a credible initial launch to early users/beta testers.
