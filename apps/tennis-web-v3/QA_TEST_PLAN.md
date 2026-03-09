# Rally v3 — QA Test Plan

**Date:** 2026-03-09
**App:** Rally Tennis v3 (React 18 + Vite + TypeScript)
**Backend:** Express + Supabase (tennis-server on port 8788)
**Status:** Pre-launch QA Cycle 1

---

## 1. Architecture Overview

### Stack
- **Frontend:** React 18, Vite 5, TypeScript 5.7
- **Styling:** Single CSS file (main.css), mobile-first dark theme
- **State:** React hooks (no external state library)
- **API:** REST via fetch, proxied `/v1` → localhost:8788
- **Auth:** Token-based (sessionStorage), gate password + email login
- **Routing:** None (tab-based SPA with manual state)

### Screen Flow
```
GateScreen → LoginScreen → SetupScreen → MainApp
                                          ├── HomeScreen
                                          ├── TourneyScreen
                                          ├── ActivityScreen
                                          └── ProfileScreen
```

### Data Flow
```
App.tsx (orchestrator)
├── useAuth (token, player, login/logout)
├── useTournaments (list, join, detail, playerNames)
├── useMatches (per-tournament matches, score/schedule actions)
├── useActionItems (derived from matches → action cards)
├── useAvailability (slots, save, impact suggestions)
└── useBottomSheet (modal state)
```

### Key Components
- **BottomNav:** 4-tab navigation with action badge
- **BottomSheet:** Modal overlay for score entry, scheduling, etc.
- **ActionCard:** Horizontally scrollable action items on home
- **TestBar:** Always-visible 6-step test flow at bottom
- **ScoreEntrySheet:** Tennis score entry with validation
- **ConfirmScoreSheet:** Score confirmation from opponent
- **SchedulingSheet:** Time picker from overlapping availability
- **FlexSheet:** Near-miss flex scheduling
- **ProposeSheet:** Propose up to 3 times

---

## 2. Critical User Journeys

### Journey 1: First-Time User Onboarding
1. Enter gate password
2. Enter email → sign in/up
3. Complete setup (name, city, county, level)
4. Land on home screen
5. See nearby tournaments, join one
6. Set availability in profile

### Journey 2: Tournament Lifecycle
1. Join tournament during registration
2. Tournament activates (enough players)
3. View matches in Tourney tab
4. Handle scheduling (auto/flex/propose)
5. Play match, enter score
6. Opponent confirms score
7. View updated standings
8. Finals matches (championship + 3rd place)
9. Tournament completes

### Journey 3: Scheduling Flow
1. Auto-scheduled (tier 1): No user action needed
2. Flex scheduling (tier 2): Accept near-miss window
3. Propose & pick (tier 3): Propose times → opponent picks

### Journey 4: Score Entry & Confirmation
1. Match is scheduled → "Enter Score" action appears
2. Select winner, enter set scores (2 or 3 sets)
3. Tiebreak detection (6-6 → show TB inputs)
4. Submit → opponent gets "Confirm Score" action
5. Opponent confirms → match completed

### Journey 5: TestBar Flow
1. Click T1–T6 to login as test account
2. Step 1: Seed (creates test data)
3. Step 2: Simulate (creates tournament with player)
4. Step 3: Schedule (accept proposals)
5. Step 4: Scores (submit scores)
6. Step 5: Confirm (confirm scores)
7. Step 6: Finals (advance to finals)

---

## 3. Test Categories & Priority

### A. Functional Testing (CRITICAL)
| Test Area | Priority | Risk |
|-----------|----------|------|
| Gate password entry | High | Auth blocking |
| Gate password reset | High | Recovery flow |
| Email login/signup | Critical | Core auth |
| Profile setup | Critical | Onboarding |
| Tournament listing | High | Core feature |
| Tournament join | Critical | Core feature |
| Match display | High | Core feature |
| Score entry validation | Critical | Data integrity |
| Score confirmation | Critical | Data integrity |
| Scheduling (all 3 tiers) | Critical | Core feature |
| Availability CRUD | High | Scheduling dependency |
| Action items generation | High | User engagement |
| TestBar functionality | Medium | Testing tool |
| Bottom sheet open/close | High | UX foundation |
| Tab navigation | High | UX foundation |

### B. Logical Testing (HIGH)
| Test Area | Priority |
|-----------|----------|
| Action items correct for match state | Critical |
| Standings calculation accuracy | High |
| Score validation rules (tennis rules) | Critical |
| Match status transitions | Critical |
| Scheduling tier assignment | High |
| Tournament status filtering | High |
| Near-miss gap/overlap calculation | Medium |

### C. Usability Testing (HIGH)
| Test Area | Priority |
|-----------|----------|
| Onboarding clarity | Critical |
| Action card discoverability | High |
| Score entry UX | High |
| Scheduling flow clarity | High |
| Empty states messaging | Medium |
| Error messages quality | High |
| Loading states | Medium |

### D. Edge-Case Testing (MEDIUM-HIGH)
| Test Area | Priority |
|-----------|----------|
| Double-click/rapid actions | High |
| Empty tournament list | Medium |
| No availability set | High |
| Network errors during actions | High |
| Token expiration mid-session | High |
| Browser refresh during action | Medium |
| Escape key on bottom sheets | Low |
| Extremely long player names | Low |

### E. Technical Testing (HIGH)
| Test Area | Priority |
|-----------|----------|
| TypeScript compilation | Critical |
| Vite build success | Critical |
| API error handling | High |
| Memory leaks (intervals, listeners) | Medium |
| React dependency arrays | High |
| CSS responsive design | High |
| Accessibility basics | Medium |

---

## 4. Simulated User Test Design (250 Users)

### User Archetypes
| Archetype | Count | Behavior |
|-----------|-------|----------|
| Happy-path first-timer | 50 | Complete onboarding, join tournament, play all matches |
| Impatient user | 25 | Rapid clicks, skips, back-button |
| Confused user | 25 | Wrong inputs, abandons flows |
| Returning user | 30 | Has session, checks standings |
| Power user | 20 | Multiple tournaments, all features |
| Low-attention user | 25 | Starts flows, doesn't finish |
| Error-prone user | 25 | Bad emails, wrong scores |
| Multi-device user | 15 | Different sessions |
| Edge-case user | 20 | Unusual sequences, rare states |
| Stress-test user | 15 | Rapid concurrent actions |

### Scenarios
1. **Onboarding funnel** (250 users): Gate → Login → Setup completion rate
2. **Tournament join** (200 users): Find → Join → Check matches
3. **Scheduling flow** (150 users): Each tier tested
4. **Score entry** (100 users): Valid/invalid entries
5. **Abandonment** (50 users): Mid-flow exits
6. **Multi-user conflicts** (30 pairs): Simultaneous score entry
7. **Session continuity** (30 users): Refresh, return

---

## 5. Risk Map

| Area | Risk Level | Impact | Notes |
|------|-----------|--------|-------|
| Score validation | HIGH | Data corruption | Incorrect tennis scores accepted |
| Auth token handling | HIGH | Security | Stale tokens, missing cleanup |
| Action item logic | HIGH | UX confusion | Wrong actions shown |
| Scheduling race conditions | MEDIUM | Data integrity | Concurrent accepts |
| CSS layout on mobile | MEDIUM | UX | Overflow, truncation |
| Error boundaries | MEDIUM | Crash recovery | Unhandled promise rejections |
| Profile state sync | MEDIUM | Stale data | After update, data not refreshed |
| TestBar in production | LOW | UX confusion | Always visible |

---

## 6. Test Execution Order

1. **Build & compile verification** ✅ (already confirmed)
2. **Static code analysis** (in progress via audit agents)
3. **Functional flow testing** (each screen, each action)
4. **Logical consistency testing** (business rules)
5. **Edge-case testing** (error states, empty states)
6. **250-user simulation** (scenario-based)
7. **Findings consolidation**
8. **Fix implementation**
9. **Regression testing**
10. **Final readiness assessment**
