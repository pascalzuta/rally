# The Painful Dollar - Project Plan

## 1) Product Goal
Build a web app that:
- Checks in every morning.
- Forces clarity on the day's top priorities.
- Tracks whether yesterday's priorities were completed.
- Challenges the user when priorities are vague or ignored.
- Enforces fast response accountability with a $1 late-response consequence model.

Long-term goal:
- Use this React web app as the foundation for a mobile app.

Product name:
- `The Painful Dollar`

## 2) Core User Experience
### Morning Check-In (Primary Flow)
1. User opens app (or notification deep-link).
2. App shows yesterday's priorities and completion status.
3. App asks:
   - What are your top 1-3 priorities today?
   - Why do these matter today?
   - What could block you?
4. App enforces quality:
   - Reject vague priorities.
   - Require measurable outcomes.
5. App saves check-in and schedules accountability prompts.

### Accountability Flow
1. During day: reminder prompts ask progress by priority.
2. End of day: user marks each priority as done, partial, or missed.
3. Next morning: app references missed/partial priorities and asks for explanation + adjustment.

## 3) MVP Scope (Web First)
### Must Have
- Auth (email magic link or OAuth).
- Daily check-in form.
- Priority quality validator (basic rule-based).
- Priority list with status tracking.
- Morning reminder + optional midday reminder + evening review reminder.
- History page (last 7-30 days).
- Basic streak/accountability score.

### Nice to Have (Post-MVP)
- AI challenge prompts ("This is too broad, rewrite with an outcome.").
- Weekly review summary.
- Calendar integration.
- Team/shared accountability mode.

## 4) Product Rules (Behavior)
- Max 3 priorities per day.
- Each priority must include:
  - action verb
  - measurable result
  - time context (today/by specific time)
- Missed priorities roll into next day review, not auto-copied.
- User must intentionally re-commit or discard each carryover.

## 5) Technical Direction
### Stack (Web MVP)
- Frontend: React + TypeScript + Vite.
- UI: Tailwind CSS + component primitives.
- State/Data fetching: TanStack Query.
- Backend: Supabase (Postgres + Auth + Edge Functions) or Firebase.
- Notifications:
  - Web push (where possible).
  - Email fallback for reliable morning check-in prompts.
- Analytics: PostHog or simple event logging.

### Architecture for Future Mobile Reuse
Use a monorepo from day one:
- `apps/web` -> React web app (Vite).
- `apps/mobile` -> React Native (Expo) later.
- `packages/core` -> shared domain logic (priority validation, scoring).
- `packages/ui` -> shared design tokens/components where practical.
- `packages/api` -> typed API client + shared schemas (zod).

This keeps business logic portable while allowing web/mobile-specific UI.

## 6) Data Model (Initial)
### User
- id
- email
- timezone
- notification_preferences

### DailyCheckin
- id
- user_id
- date
- intention_note
- accountability_score_snapshot
- created_at

### Priority
- id
- checkin_id
- title
- why
- blockers
- status (`pending`, `done`, `partial`, `missed`)
- quality_score

### ReminderLog
- id
- user_id
- type (`morning`, `midday`, `evening`)
- sent_at
- response_at

## 7) API Endpoints (Draft)
- `POST /checkins` create daily check-in + priorities.
- `GET /checkins/today` fetch today's check-in.
- `GET /checkins/yesterday` fetch prior day accountability context.
- `PATCH /priorities/:id/status` update outcome.
- `GET /history?range=30d` accountability timeline.
- `POST /reminders/send` trigger reminder job.

## 8) Milestones & Checkpoints
### Milestone 1: Foundation (Week 1)
- Initialize monorepo and React web app.
- Set up auth + database.
- Define schema + migrations.

Checkpoint:
- User can sign in and reach protected dashboard.

### Milestone 2: Morning Check-In (Week 2)
- Build check-in form and save flow.
- Add priority validation rules.
- Add yesterday context panel.

Checkpoint:
- User can complete check-in with validated priorities.

### Milestone 3: Accountability Loop (Week 3)
- Build status update UI.
- Add evening review flow.
- Add streak/accountability scoring.

Checkpoint:
- End-to-end day cycle works (morning -> updates -> evening -> next morning reflection).

### Milestone 4: Reminder System (Week 4)
- Add scheduled reminder jobs.
- Implement email fallback + web push where supported.
- Add user notification settings page.

Checkpoint:
- Reminders deliver consistently in user's timezone.

### Milestone 5: Stability + Beta (Week 5)
- Improve UX polish and error handling.
- Add basic analytics.
- Run small beta with feedback loop.

Checkpoint:
- At least 7 consecutive days of successful user check-ins in beta.

## 9) Implementation Steps (Actionable)
1. Set up repo structure (`apps/`, `packages/`).
2. Scaffold `apps/web` with React + TypeScript + routing.
3. Implement auth and protected routes.
4. Create DB schema and migrations.
5. Build check-in screen and form validation.
6. Build "yesterday review" component.
7. Build priorities status tracker.
8. Add reminder scheduler and delivery adapters.
9. Build history/dashboard page.
10. Add analytics and event instrumentation.
11. QA pass with seed data and timezone testing.
12. Prepare mobile app starter (`apps/mobile`) reusing `packages/core`.

## 10) Risks & Mitigations
- Risk: users ignore reminders.
  - Mitigation: configurable schedule + stronger copy + email fallback.
- Risk: priorities become generic and low-quality.
  - Mitigation: strict validation + challenge prompts.
- Risk: web-to-mobile code reuse is low.
  - Mitigation: keep domain logic in shared packages, avoid UI coupling.

## 11) Definition of Done (MVP)
- User receives morning reminder in local timezone.
- User sets up to 3 measurable daily priorities.
- User can track outcomes and complete evening review.
- Next-day flow references prior commitments.
- History shows accountability trend over time.

## 12) Next Session Backlog
- Decide backend choice: Supabase vs Firebase.
- Decide notification providers (email/push).
- Create wireframes for:
  - Morning check-in
  - Daily dashboard
  - Evening review
  - History view
- Start implementation of Milestone 1.

## 12.1) Build Log (Current Session)
Implemented initial web app scaffold using a sub-agent style split:
- Sub-agent A (Platform): monorepo structure and workspace setup.
- Sub-agent B (Core Logic): shared validation + accountability logic in `packages/core`.
- Sub-agent C (Web UX): React app with Lark-inspired guided check-in and dashboard.

Delivered artifacts:
- `apps/web` React + TypeScript + Vite app shell.
- `packages/core` shared domain logic for validation, scoring, streaks.
- Local persistence for check-ins and priority status updates.
- Morning check-in form with quality scoring and challenge hints.
- Accountability dashboard with streak and small-win messaging.

Immediate next checkpoints:
- Integrate real auth + database persistence.
- Replace local storage with API-backed data.
- Add scheduled reminder delivery and settings UI.

## 13) Lark-Inspired Product & UI Direction
Use `https://www.lark.com` as inspiration for tone and experience:
- Coaching-first UX, not task-list UX.
- Outcome-oriented language ("small wins", progress over perfection).
- Guided journey format (clear step-by-step daily flow).
- Strong emphasis on personalization and accountability.
- On-demand support feel (assistant/check-in available anytime).

### UX Patterns to Adapt
- Daily flow as a compact 4-step sequence:
  1) Reflect yesterday.
  2) Define today's top 1-3 priorities.
  3) Identify blockers and mitigation.
  4) Commit with a confidence score.
- Product onboarding as a 5-step path:
  1) Set timezone + reminder windows.
  2) Choose accountability style.
  3) Complete first daily check-in.
  4) Configure reminder channels.
  5) Track first week of "small wins".
- Dashboard highlights:
  - Today's priorities.
  - Completion trend (7-day visual).
  - Accountability streak and "small wins" callouts.
- Check-in prompts should feel conversational and coaching-oriented.

### Visual Direction
- Clean, high-contrast cards with generous spacing.
- Friendly, encouraging microcopy and labels.
- Progress-forward components (streak chip, trend line, completion rings).
- Clear primary CTA per screen (avoid crowded actions).

### Content Style Rules
- Prefer supportive challenge language:
  - "Make this more specific."
  - "What outcome proves this is done?"
  - "If this slips, what is your recovery plan?"
- Celebrate consistency:
  - Highlight small daily completions.
  - Show momentum even on partial days.

### Implementation Notes for React Web
- Build reusable coaching components in `packages/ui`:
  - `CoachPromptCard`
  - `PriorityQualityHint`
  - `DailyStepTimeline`
  - `StreakBadge`
- Keep challenge/prompt logic in `packages/core` so mobile can reuse unchanged.
- Create a design token set early (color, spacing, typography) to keep web/mobile visual parity.

## 14) Full Experience Spec: Conversational + Snapchat-Like + Game-Inspired
### 14.1 Product Positioning
Working name: `The Painful Dollar`

Promise:
- "Every morning, you and your AI lock in today's mission."
- "Every night, you level up by proving what got done."

Target persona:
- 16-year-old male student/early creator.
- Short attention span, high phone usage, responds to challenge + reward loops.
- Wants to feel in control, respected, and supported without formal productivity jargon.

### 14.2 Core Experience Principle
- Entire primary experience is chat-first.
- No traditional form screen as default.
- User talks with an AI coach in a message thread that feels like a Snapchat chat.
- Priorities, blockers, confidence, reminders, and end-of-day review are all captured through conversation cards and quick-reply chips.

### 14.3 UX Architecture (Chat-Only Primary Flow)
1. Morning "Mission Start" chat
2. Midday "Status Ping" chat
3. Evening "Scoreboard" chat
4. Weekly "Boss Battle Recap" chat

Fallback:
- Optional structured panel can be opened from chat for power users.
- Chat remains source of truth.

### 14.4 Conversation Design
AI coach style:
- Empathetic, direct, confident, never preachy.
- Uses short, high-energy lines.
- Reinforces identity: "You're building discipline, not just checking boxes."

Tone examples:
- "Solid pick. Now make it measurable."
- "You're close. Give me the exact finish line."
- "Missed it today? No shame. What's the comeback move for tomorrow?"

Message mechanics:
- AI bubble + user bubble layout similar to modern chat apps.
- Quick replies for speed (`Lock it in`, `Rewrite it`, `Need help`, `Done`, `Partial`, `Missed`).
- Voice note input (phase 2).
- Reactions and emoji badges for progress moments (phase 2).

### 14.5 Snapchat-Inspired Interface Spec
- Vertical conversation feed, edge-to-edge on mobile.
- Rounded message bubbles with strong contrast.
- Persistent bottom composer with text input + quick action chips.
- Story-like progress strip at top showing:
  - Morning mission
  - Midday check
  - Evening review
- Full-screen card transitions between chat "moments."
- Camera/AR features are not required for MVP, but layout should leave room for future media replies.

### 14.6 Game-Inspired AI Presence & Animation
AI identity:
- A futuristic "coach core" visual (orb/avatar) that appears when AI is thinking/responding.

Animation system:
- Idle pulse when waiting.
- Charge-up effect while generating a challenge.
- Hit/impact flash when user locks priority.
- Combo streak animation when completing consecutive days.
- End-of-day scoreboard reveal with animated rank tier.

Visual effects direction:
- Inspired by game UI/HUD effects: glow trails, particle bursts, subtle scan lines.
- Keep performance high with lightweight effects.
- Use motion to reward action, not distract from tasks.

Implementation guidance:
- Use `framer-motion` for layout + transitions.
- Use Lottie or Rive for AI avatar loops.
- Reserve WebGL/Three.js for optional premium effects only.
- Respect `prefers-reduced-motion` and provide low-motion mode.

### 14.7 Teen-Focused Visual Design System (16-year-old male audience)
Color direction:
- Electric blue, neon lime, graphite, and warning amber accents.
- Dark-on-dark primary surfaces with bright interactive highlights.
- Strong color coding for status: complete/partial/missed.

Typography:
- Bold, sporty headline font with modern readable body font.
- Large touch-friendly type scale for mobile-first usage.

Graphics:
- Angular badges, mission cards, tier icons, streak flames.
- Subtle competitive motifs (levels, XP, rank bars) without toxic pressure.

Accessibility:
- Contrast ratio minimum AA.
- Every effect has non-animated equivalent.
- Color-only meaning is always paired with text/icon.

### 14.8 Empathetic Language Framework
Language pillars:
- Validation: recognize effort.
- Clarity: request specifics.
- Accountability: ask for ownership.
- Recovery: always provide a comeback path.

Copy rules:
- No guilt/shame language.
- Replace "failure" with "missed target."
- Always end difficult feedback with one concrete next move.

Examples:
- "Respect for checking in. Let's tighten this target."
- "You didn't miss the day, you missed one mission. Reset now."
- "Pick one fast win in the next hour and send it."

### 14.9 Feature Spec (Detailed)
MVP features:
- Chat-based onboarding.
- Chat-based morning mission setup (1-3 priorities).
- AI quality challenge loop until priorities are measurable.
- Midday and evening conversational check-ins.
- Scoreboard: daily score, streak, weekly consistency.
- Push/email reminders with deep-link directly into chat.

Phase 2:
- Voice replies.
- Meme/GIF reactions for celebration.
- Friend accountability squads.
- Avatar progression customization.

### 14.10 Data + Event Requirements for Chat UX
New entities:
- `ConversationSession`
- `Message`
- `AIResponseMeta` (latency, challenge_type, confidence_prompt)
- `UserEngagement` (response_time, skipped_prompt_count)

Critical events:
- `mission_started`
- `priority_submitted`
- `priority_rewrite_requested`
- `priority_locked`
- `midday_ping_answered`
- `evening_review_completed`
- `streak_increased`
- `streak_broken`

### 14.11 Screen/State Inventory
Required screens:
- Auth/entry
- Chat Home (primary)
- Scoreboard view
- History replay (chat transcript + outcomes)
- Settings (reminders, motion, tone intensity)

System states:
- AI typing
- AI challenge mode
- User idle/reminder pending
- Completed day summary
- Recovery mode (after missed day)

### 14.12 Delivery Plan Update
Milestone A (2 weeks):
- Replace form-first UX with chat-first shell.
- Implement AI bubble + quick replies + mission flow.

Milestone B (2 weeks):
- Add animation system (AI orb, streak effects, scoreboard reveal).
- Add reduced-motion and performance budgets.

Milestone C (2 weeks):
- Add real backend, reminder engine, and analytics events.
- Internal pilot with teen-focused usability testing.

Acceptance criteria for this spec:
- User can complete full day flow entirely in chat.
- At least 80% of users can set measurable priorities in under 3 minutes.
- Animation frame rate stays smooth on mid-range phones.
- Tone testing confirms language feels supportive, not judgmental.

## 15) Business Model + Viral Growth Spec (The Painful Dollar)
### 15.1 Core Business Rule
Daily accountability pricing mechanic:
- Morning notification triggers a 10-minute response window.
- If the user opens and completes daily priority lock-in within 10 minutes: charge is `$0`.
- If the user does not respond within 10 minutes: charge is `$1`.

Definition of "respond":
- User must complete the full morning mission:
  - submit 1-3 valid priorities,
  - pass quality checks,
  - press final commit action.
- Opening the app without mission completion does not stop the timer.

### 15.2 Billing Engine Rules
- One potential charge event per calendar day.
- Daily cap: `$1`.
- Monthly cap (default): `$15` to reduce runaway penalties.
- Grace allowance (default): 2 late misses/month before charging starts.
- Charge settlement is batched daily to reduce failed micro-transactions.

### 15.3 User Trust + Compliance Guardrails
- Explicit pre-consent flow with clear examples of when a charge happens.
- Prominent countdown timer in the notification deep-link screen.
- Real-time "No Charge Locked" confirmation once mission is completed.
- Transparent ledger page:
  - date,
  - mission status,
  - charged/not charged,
  - reason code.
- Dispute flow for false negatives (notification failure, outage, school policy conflicts).

High-school audience safeguards:
- Age gate and parental/guardian consent flow where required by jurisdiction.
- Option for "points-only accountability mode" when payment is not permitted.
- Strict limits on daily/weekly charges and clear cancellation/refund policy.

### 15.4 Viral Hooks for High School Communities
Core growth loops:
- Streak flex cards: one-tap shareable visual of streak + mission win to social/chat apps.
- Friend challenge squads: small private groups that run weekly accountability competitions.
- Referral unlocks: invite friends to unlock avatar effects/theme packs (non-cash rewards).
- Weekly class leaderboard mode (opt-in): compares consistency score, not money spent.
- Shareable comeback stories: auto-generated "missed then recovered" recap cards.

Top-chart-inspired hook patterns to implement:
- Fast chat loops with quick reply chips.
- Daily streak pressure with visible near-loss warnings.
- Reward animations on completion moments.
- Lightweight profile identity (avatar + rank tier + badge frame).
- Social proof surfaces ("12 friends completed Mission Start today").

### 15.5 Safety Constraints for Viral Systems
- Default private account for minors.
- No public money-shaming or "most charged" boards.
- Leaderboards rank completion consistency only.
- Anti-bullying reporting and block/mute controls.
- School-safe mode that disables social features during class hours.

### 15.6 Product Copy for Business Model
Headline options:
- "Miss the check-in, feel the dollar."
- "Ten minutes to lock your mission. Zero excuses."

Empathetic accountability lines:
- "You still have time. Lock one clear mission now."
- "Missed today's window. That's one dollar. Tomorrow starts fresh."
- "You paid for the miss. Now cash in the comeback."

### 15.7 Technical Additions Required
New backend entities:
- `DailyAccountabilityWindow` (start_at, expires_at, completed_at, status)
- `ChargeEvent` (user_id, date, amount_cents, reason, disputed, settled_at)
- `Referral` (inviter_id, invitee_id, reward_state)
- `Squad` and `SquadMembership`

New event instrumentation:
- `window_started`
- `window_expired`
- `mission_completed_in_window`
- `late_fee_applied`
- `late_fee_waived_grace`
- `ledger_viewed`
- `referral_sent`
- `squad_joined`
- `share_card_generated`

### 15.8 Updated Success Metrics
- D1 morning response-within-10-min rate.
- Percent of days with `$0` charge by active users.
- 7-day streak retention.
- Viral coefficient in school clusters (invites per active user).
- Dispute rate on fee events (must remain low).

### 15.9 Top-Chart Viral Hook Map (US App Store-Informed)
Reference baseline (captured February 2026):
- Apple "Top Apps Right Now" and "Get the US's Top Apps of 2025" lists include high engagement leaders such as ChatGPT, TikTok, Snapchat, Instagram, WhatsApp, CapCut, YouTube, and Telegram.
- Apple "Get the US's Top Games of 2025" includes sticky progression-driven titles such as Roblox, Clash Royale, and Block Blast.
- Source pages:
  - https://apps.apple.com/us/story/id1527837711
  - https://apps.apple.com/us/story/id1847717004
  - https://apps.apple.com/us/story/id1847717604

Hook-to-feature translation for The Painful Dollar:
- ChatGPT/AI apps pattern -> instant conversational utility:
  - Implement immediate-value AI replies in under 2 seconds for morning mission prompts.
- Snapchat/Instagram pattern -> camera-era social proof + streak identity:
  - Shareable streak cards, daily mission badges, and quick friend reactions.
- TikTok/YouTube pattern -> short-loop session design:
  - Keep check-in interactions in rapid 10-45 second chat steps with progressive reveal.
- CapCut pattern -> templated creation + one-tap sharing:
  - Prebuilt "mission locked" and "comeback" card templates users can export instantly.
- WhatsApp/Telegram pattern -> low-friction messaging:
  - Fast quick-reply chips, minimal taps, reliable notification-to-action deep-link.
- Top mobile game pattern (Roblox/Clash Royale/Block Blast style) -> progression and rank:
  - Add non-monetary XP, rank tiers, weekly resets, and squad-based consistency challenges.

Non-negotiable growth constraints:
- Viral mechanics must reward consistency and teamwork, not missed-fee events.
- No social exposure of payment/charge behavior.
- User can disable sharing features while still using core accountability model.

## 16) Security + Production Readiness Review (Current Build)
Review date:
- February 18, 2026

Scope reviewed:
- `apps/web` React implementation
- `packages/core` shared logic
- Current repository standards and release posture

### 16.1 Executive Summary
- Current codebase is a functional prototype, not production-ready.
- For an app with monetary consequences (`$1` late fee), current architecture is high risk because critical business logic is entirely client-controlled.
- Primary requirement before launch: move all authoritative logic (timers, charges, eligibility, and ledger integrity) to trusted backend services.

### 16.2 Security Findings (Prioritized)
P0 - Client-side source of truth for accountability and future billing
- Evidence: app state is loaded and persisted via `localStorage` in `apps/web/src/App.tsx` (`loadState` and write path).
- Risk: users can edit browser storage/devtools to avoid fees, fabricate completion, or alter history.
- Required fix: server-authoritative check-in windows, immutable event logs, signed API actions, and idempotent charge processing.

P0 - No authentication or authorization boundary
- Evidence: no auth provider, protected routes, or user identity checks in current web app.
- Risk: no user ownership guarantees; impossible to enforce per-user billing, privacy, or access controls.
- Required fix: implement auth (OIDC/Supabase/Firebase Auth), session management, and resource-level authorization policies.

P0 - No backend integrity layer for chargeable events
- Evidence: no API/server component currently exists for daily windows, charge events, or dispute tracking.
- Risk: charge disputes cannot be resolved reliably; financial and legal exposure.
- Required fix: backend event model with tamper-evident audit trail and reconciled payment records.

P1 - No abuse/fraud controls
- Evidence: no rate limits, bot detection, replay protection, or device/session anomaly checks.
- Risk: scripted account abuse, fake referrals, charge evasion, reminder spam.
- Required fix: API gateway rate limiting, signed nonces, anti-automation controls, and fraud monitoring rules.

P1 - Missing data protection baseline
- Evidence: no encryption/key strategy, no secrets policy, no secure headers/CSP documented.
- Risk: data leakage, injection surface, weak transport/browser hardening.
- Required fix: TLS-only, encryption at rest, managed secrets, CSP/HSTS/XFO/Referrer-Policy, strict CORS.

P1 - Minor-focused compliance not implemented
- Evidence: spec mentions high school users, but no shipped enforcement for age handling/consent/parental controls.
- Risk: regulatory non-compliance and store policy violations.
- Required fix: age gate workflow, consent requirements by jurisdiction, youth privacy controls, and policy/legal review.

P2 - Supply chain and dependency governance missing
- Evidence: dependencies present, but no lockfile, CI vulnerability scanning, or pinned update policy.
- Risk: vulnerable transitive packages and non-reproducible builds.
- Required fix: commit lockfile, enable `npm audit`/SCA scanning, Dependabot/Renovate, signed releases.

P2 - No test coverage for critical domain rules
- Evidence: no unit/integration/e2e tests for validation, streak, and future charging logic.
- Risk: regressions in monetary logic and dispute-critical behavior.
- Required fix: unit tests for `packages/core`, API integration tests for billing windows, e2e tests for check-in deadlines.

### 16.3 Maintainability & Code Quality Assessment
Strengths:
- Clear separation with monorepo structure (`apps/web` and `packages/core`).
- Core scoring/validation logic is isolated and reusable.
- TypeScript strict mode is enabled in web config.

Gaps to reach production-grade maintainability:
- No lint/format/type-check gates in CI.
- No architecture decision records (ADR) for billing and trust model.
- No error boundaries/observability strategy.
- No environment configuration schema validation.
- No migration strategy because database layer is not yet implemented.

### 16.4 Production Architecture Requirements (Minimum)
1. Trusted backend for mission windows and billing decisions only.
2. Payment processor integration with idempotency keys and retry-safe charge jobs.
3. Immutable append-only event log for dispute investigation.
4. AuthN/AuthZ with role-aware policies and secure session lifecycle.
5. Notification service with signed deep links and replay expiry.
6. Observability stack: structured logs, traces, alerting, abuse dashboards.
7. Privacy/security controls for minors and social features.

### 16.5 Secure SDLC Checklist (Must Add Before Beta)
- CI pipeline with:
  - type check
  - lint
  - unit tests
  - dependency vulnerability scan
- Branch protections and mandatory code review.
- Threat model for:
  - fee evasion,
  - referral fraud,
  - account takeover,
  - data exposure.
- Incident response runbook and charge dispute runbook.
- Security test plan including authZ tests, replay tests, and rate-limit tests.

### 16.6 Readiness Verdict
- Current status: Prototype only.
- Recommended release posture:
  - No public launch with real charges.
  - Build backend trust model and compliance controls first.
  - Re-run security review after billing/auth infrastructure is implemented.

## 17) Implementation Update: Backend Skeleton + Security Gates (Completed)
Update date:
- February 18, 2026

### 17.1 What Was Implemented
Backend workspace:
- Added `apps/server` with Express + TypeScript skeleton.
- Added auth token issuing/verification scaffolding.
- Added signed accountability window lifecycle:
  - start window,
  - complete within signed 10-minute token,
  - expire and create ledger decision event.
- Added fee decision engine with grace and monthly cap rules.
- Added in-memory repositories as replaceable adapters.

Schema and persistence contracts:
- Added PostgreSQL migration:
  - `app_user`
  - `conversation_session`
  - `daily_accountability_window`
  - `charge_event`
- Added indexes and update trigger for integrity/performance baseline.

Quality and security pipeline:
- Added root/workspace lint, typecheck, test, and audit scripts.
- Added GitHub Actions CI workflow (`lint`, `typecheck`, `test`, `audit`).
- Added security threat model document under `docs/security/threat-model.md`.
- Added initial unit tests for core domain rules and server charge/window logic.

### 17.2 Files Added/Updated (Key)
- `apps/server/src/http/routes.ts`
- `apps/server/src/domain/window.ts`
- `apps/server/src/domain/ledger.ts`
- `apps/server/db/migrations/001_core_schema.sql`
- `.github/workflows/ci.yml`
- `docs/security/threat-model.md`
- `package.json` (workspace quality gates)
- `README.md` (project/runtime updates)

### 17.3 Remaining Work Before Production
- Replace in-memory repos with real database adapters and transactions.
- Integrate real auth provider (OIDC/Supabase/Firebase Auth).
- Add payment processor integration with idempotent settlement jobs.
- Add endpoint rate limiting and anti-replay nonce storage.
- Add webhook signature verification for external provider callbacks.
- Add compliance-ready age/consent enforcement flows.
- Add full integration/e2e tests for auth/window/charge dispute paths.

### 17.4 Launch Guardrail
- Real `$1` charging must remain disabled until:
  - persistent backend storage is live,
  - auth + abuse controls are validated,
  - legal/compliance review for minor users is completed.

## 18) Detailed Delivery Spec (Updated)
Update date:
- February 18, 2026

### 18.1 Architecture Decision Record (Current Default)
Primary database decision:
- Use PostgreSQL as system of record for all authoritative data.
- Recommended managed option: Supabase Postgres for speed of delivery.

Why PostgreSQL is the default:
- ACID transactions required for fee-window and ledger correctness.
- Strong relational constraints for user/window/charge integrity.
- Good fit for auditable monetary events and disputes.

Secondary datastore:
- Add Redis for rate limiting, replay nonce TTL, and job locking.
- Redis is performance/supporting infra only; never source of truth for money logic.

### 18.2 Production Data Ownership
System of record tables:
- `app_user`
- `daily_accountability_window`
- `charge_event`
- `conversation_session`
- `message` (to be added)
- `referral`, `squad`, `squad_membership` (to be added)

Authoritative rule:
- Client UI may display status.
- Only backend may decide:
  - window open/expire/complete,
  - fee eligibility,
  - charge amount,
  - waiver reason.

### 18.3 Security Controls by Layer
Client/Web:
- Use secure cookies or short-lived bearer tokens with refresh flow.
- No fee or deadline logic in trusted client state.
- CSP + strict origin policy + reduced PII in local storage.

API:
- Auth middleware on all non-public endpoints.
- Request schema validation on every write endpoint.
- Idempotency keys for charge-affecting operations.
- Rate limiting and anti-replay checks.
- Signed deep-link and signed window token validation.

Database:
- Unique constraints to prevent duplicate daily windows and duplicate charge events.
- Immutable ledger write model (append-only, no hard delete).
- Audit columns on all financially relevant tables.

Infra/Ops:
- Secrets in managed secret store, not repo.
- Environment split: dev/staging/prod with separate keys and DBs.
- Alerting on charge anomalies and auth failures.

### 18.4 Billing Logic Contract (Non-Negotiable)
Daily charging policy:
- One daily accountability window.
- 10-minute deadline from notification/window start.
- `$0` if mission fully completed in window.
- `$1` only when window expires unresolved and grace/cap rules permit.

Monthly policy:
- Grace misses: 2 by default.
- Monthly cap: `$15` default (`1500` cents).
- Every charge decision must emit machine-readable reason code.

Dispute policy:
- Every charge event has:
  - timestamp,
  - decision inputs snapshot,
  - reason code,
  - dispute status.

### 18.5 Backend API Contract (v1 Expanded)
Already scaffolded:
- `POST /v1/auth/dev-login`
- `POST /v1/checkins/window/start`
- `POST /v1/checkins/window/complete`
- `POST /v1/checkins/window/expire`
- `GET /v1/ledger`

Required next endpoints:
- `POST /v1/checkins/morning-mission` (submit priorities tied to active window)
- `GET /v1/checkins/today`
- `GET /v1/checkins/history?range=30d`
- `POST /v1/charges/dispute`
- `GET /v1/profile/settings`
- `PATCH /v1/profile/settings`

### 18.6 CI/CD and Quality Gates
Required checks on every PR:
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run audit`

Required branch protection:
- 1+ reviewer.
- All CI checks green.
- No high/critical dependency vulnerability unresolved.

Release gate:
- Staging smoke test must pass for auth, window lifecycle, ledger flow.
- Charge simulation test suite must pass before any billing toggle.

### 18.7 Test Plan (Detailed)
Unit tests:
- window transition correctness (`open -> completed`, `open -> expired`).
- fee decision rules (grace/cap/edge month boundaries).

Integration tests:
- auth token issuance and protected route behavior.
- signed window token mismatch/replay rejection.
- ledger entry creation on expiration path.

E2E tests:
- morning notification deep-link -> mission commit -> no charge.
- no response -> expire -> charge/waive based on grace/cap.
- dispute submission and audit visibility.

### 18.8 Environment & Runbook
Development run commands:
1. `cd /Users/pascal/Desktop/experimentation`
2. `npm install`
3. Create `/Users/pascal/Desktop/experimentation/apps/server/.env`
4. `npm run dev:server`
5. `npm run dev:web`
6. Open `http://localhost:5173`

Server environment variables:
- `NODE_ENV`
- `PORT`
- `AUTH_TOKEN_SECRET`
- `WINDOW_TOKEN_SECRET`
- `CORS_ORIGIN`
- `GRACE_MISSES_PER_MONTH`
- `MONTHLY_CHARGE_CAP_CENTS`

### 18.9 Immediate 2-Week Execution Plan
Week 1:
- Replace in-memory repos with Postgres adapters.
- Wire migration execution into deployment/start scripts.
- Integrate real auth provider and session lifecycle.

Week 2:
- Add rate limiting + replay nonce store (Redis).
- Add dispute endpoint and ledger reason detail expansion.
- Connect web app from local storage to backend APIs.
- Add integration tests for end-to-end window and fee paths.

Exit criteria for this phase:
- No critical security findings open.
- End-to-end accountable flow works against persistent backend.
- Charge simulation is reproducible and auditable from logs + DB.

## 19) Frontend Rebuild Status (Chat-First UI Delivered)
Update date:
- February 18, 2026

### 19.1 What Changed in the Web App
- Replaced previous dashboard/form-first interface with a new chat-first `The Painful Dollar` experience.
- New interface now includes:
  - Snapchat-like conversation thread with AI/user/system bubbles.
  - Story-strip progression (`Morning Mission`, `Midday Ping`, `Evening Scoreboard`).
  - Animated AI orb and game-inspired visual effects.
  - 10-minute mission window countdown display.
  - Explicit charge state panel (`Pending`, `$0`, `$1`) tied to mission lock/expiry state.
  - Quick-reply chip controls for fast conversational interaction.
  - Mission composer panel for structured priority capture inside chat flow.
  - Priority status board (`pending`, `done`, `partial`, `missed`) with score feedback.

### 19.2 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 19.3 Runtime Notes
- `npm run dev:web` starts Vite successfully.
- In restricted sandbox environments, browser port binding may fail; local machine run should use:
  - `cd /Users/pascal/Desktop/experimentation`
  - `npm run dev:web`
  - open `http://localhost:5173`

### 19.4 Next Frontend Iteration Tasks
- Replace local UI-only mission state with backend API integration (`/v1/checkins/window/*`).
- Swap dev chat simulation with real AI response service.
- Add accessibility pass on motion + contrast for all chat/FX elements.
- Add mobile viewport QA and device performance budget checks.

## 20) UI Simplification Update (Friend-Like + Functional)
Update date:
- February 18, 2026

### 20.1 Why We Simplified
- The previous interface was visually heavy and felt too much like a game shell.
- Product goal now prioritizes clarity, low friction, and emotional safety.
- The chat should feel like support from a trusted friend, while still providing strong accountability tools.

### 20.2 New Interaction Principles
- Chat-first, but not chatbot-only:
  - conversation drives behavior,
  - side functionality helps execution.
- One-screen focus:
  - chat thread,
  - simple composer,
  - lightweight \"Today Board\" for status.
- Success is always visible:
  - time left,
  - charge state,
  - progress bar,
  - completed count,
  - daily score.

### 20.3 What Changed in the UI
- Removed dense visual effects and reduced animation intensity.
- Switched to cleaner, brighter, easier-to-read styling.
- Simplified message tone to friend-like coaching language.
- Reduced action complexity to core controls:
  - `Add Priority`
  - `Lock Day`
  - status chips (`pending`, `done`, `partial`, `missed`)
- Added clearer progress feedback for \"feeling successful\":
  - completion ratio,
  - progress bar,
  - encouraging summary message.

### 20.4 Functional Layout (Current)
- Header:
  - app identity,
  - current day state (`Open`, `Locked`, `Late`).
- Summary strip:
  - countdown,
  - expected charge,
  - completion count,
  - score.
- Chat panel:
  - friend/you/system bubbles,
  - quick priority submission flow.
- Today Board:
  - confidence slider,
  - priority list,
  - fast status updates.

### 20.5 Tone Requirements (Updated)
- Use short, human, non-robotic messages.
- Sound like a supportive friend:
  - direct,
  - calm,
  - encouraging,
  - accountable.
- Never shame the user for misses; always give a next move.

### 20.6 Implementation Status
- Simplified UI is implemented in:
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles/app.css`
- Build verification:
  - `npm run build:web` passes.

### 20.7 Next Refinement Tasks
- Add inline \"small win\" celebration when a priority flips to `done`.
- Add optional \"focus mode\" that hides non-essential metrics during work sessions.
- Add backend persistence so success feedback reflects real user history across devices.

## 21) Visual Theme Update (Casual Lifestyle Direction)
Update date:
- February 18, 2026

### 21.1 Direction Shift
- Moved away from sci-fi/game-heavy appearance.
- New direction is casual lifestyle app:
  - friendly,
  - social,
  - colorful,
  - lightweight.
- Inspiration profile: short-form social/chat apps with approachable UI energy (Snap/TikTok style cues).

### 21.2 Typography Update
- Primary UI font: `Nunito` (friendly, rounded, informal readability).
- Headings/accent font: `DM Sans` (clean, modern, social-app feel).
- Removed previous futuristic display-style typography.

### 21.3 Color System Update
- Base remains bright and clean:
  - soft cool background,
  - white cards,
  - low-contrast lines.
- Accent palette shifted to social/lifestyle tones:
  - blue (`--primary`) for main actions,
  - pink (`--secondary`) for identity/highlight,
  - mint (`--mint`) for progress/success,
  - warm sun (`--sun`) for system/attention moments.

### 21.4 UI Feel Improvements
- Softer bubble colors and rounded geometry.
- Lighter surfaces and gentler contrast for less "tool-like" vibe.
- Better emotional tone: supportive, low-pressure, and easy to engage.
- Success visibility kept clear via:
  - progress bar,
  - status chips,
  - score + charge state,
  - encouraging copy.

### 21.5 Implementation Notes
- Theme changes implemented in:
  - `apps/web/src/styles/app.css`
- Verified with build:
  - `npm run build:web` passes.

## 22) Charge Visibility Upgrade (Dollar-Risk Clarity)
Update date:
- February 18, 2026

### 22.1 Goal
- Make the dollar consequence impossible to miss.
- User should instantly understand:
  - when they are safe,
  - when risk is rising,
  - when a `$1` charge has happened.

### 22.2 UX Changes Implemented
- Added dedicated fee-warning banner above core metrics.
- Added explicit copy:
  - before lock: \"If the timer hits 00:00 before Lock Day, you are charged $1.\"
  - after lock: \"Charge avoided. You are at $0 for today.\"
  - after expiry: \"Time is up. You are charged $1 today.\"
- Added visual risk states across status pill and key summary cards:
  - `open`,
  - `warning` (5:00 to 2:01),
  - `urgent` (2:00 to 0:01),
  - `late`,
  - `safe`.
- Elevated urgency visually with stronger color and emphasis for timer/charge values.

### 22.3 Implementation Notes
- Logic updates in:
  - `apps/web/src/App.tsx`
- Styling updates in:
  - `apps/web/src/styles/app.css`
- Build verification:
  - `npm run build:web` passes.

## 23) Validation Fix: Action Verb False Positives
Update date:
- February 18, 2026

### 23.1 Issue
- Users could receive \"Start with a concrete action verb.\" even when using valid verbs.
- Root cause: narrow verb dictionary + brittle substring matching.

### 23.2 Fix Implemented
- Expanded action verb coverage (e.g., `finish`, `complete`, `study`, `practice`, `submit`, `update`, `improve`, `start`).
- Replaced naive substring-only logic with more robust detection:
  - checks first meaningful word,
  - accepts common imperative phrasing,
  - supports `-ing` / `-ed` forms,
  - still falls back to dictionary match across full title.
- Added non-action starter guard words to reduce false positives.

### 23.3 Files Updated
- `packages/core/src/validation.ts`

### 23.4 Verification
- `npm run build:web` passes after validator update.

## 24) Check-In Policy Update (Accept-First, Low Friction)
Update date:
- February 18, 2026

### 24.1 Product Decision
- The morning check-in should be easy to complete, not strict.
- User now enters only one field:
  - `What will you do?`
- Any non-empty response is accepted as a valid check-in input.

### 24.2 Validation Behavior Change
- Previous behavior:
  - blocked submission when wording was not measurable/specific enough.
- New behavior:
  - no blocking challenge for non-empty priority text,
  - priority is accepted immediately,
  - app may ask one optional clarifying follow-up in chat.

### 24.3 UX Impact
- Fewer frustrating validation errors.
- Faster mission lock completion.
- Better balance between accountability and ease of use.
- Clarification now feels conversational instead of punitive.

### 24.4 Implementation Notes
- Updated:
  - `apps/web/src/App.tsx`
- Changes made:
  - removed required `why` field from composer,
  - removed strict rejection path for validation hints,
  - converted hints into optional friend-like prompts,
  - check-in succeeds as long as input is non-empty.

### 24.5 Verification
- `npm run build:web` passes.

## 25) Chat Container Behavior Update (Fixed Height + Scroll)
Update date:
- February 18, 2026

### 25.1 UX Requirement Applied
- Chat panel now has fixed vertical height.
- If message content exceeds visible area, only message history scrolls.
- Composer stays anchored at the bottom for consistent input behavior.

### 25.2 Implementation Notes
- Updated:
  - `apps/web/src/App.tsx` (introduced `chat-messages` container)
  - `apps/web/src/styles/app.css` (fixed height and `overflow-y: auto`)
- Heights:
  - desktop chat height: `520px`
  - mobile chat height: `460px`

### 25.3 Verification
- `npm run build:web` passes.

## 26) First-Open Start Screen Experience
Update date:
- February 18, 2026

### 26.1 First-Time Flow
- On first app open, user lands on a dedicated start screen instead of entering chat immediately.
- Start screen explains:
  - 10-minute accountability window,
  - `$0` if lock-in is completed in time,
  - `$1` if timer expires before lock.
- Primary action:
  - `Start Today` enters the mission chat flow.

### 26.2 Returning User Flow
- After first start, app remembers onboarding and opens directly into mission chat on next launches.
- User can still return to start screen anytime with `Start Screen` button in header.

### 26.3 Implementation Notes
- Updated:
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles/app.css`
- State persistence:
  - local storage key `painful-dollar-start-seen` controls first-open behavior.

### 26.4 Verification
- `npm run build:web` passes.

## 27) Start Screen Copy Simplification + 3 Viral Hooks
Update date:
- February 18, 2026

### 27.1 Start Screen Copy (Now Minimal)
- Start screen now states only the core mission:
  - hold users accountable to goals,
  - if no clear priorities are locked in time, charge `$1`.
- Removed long explanatory copy and reduced onboarding text density.

### 27.2 Viral Hook #1 (Entry/Start): Friend Invite
- Added `Invite Friend` action directly on the start screen.
- Behavior:
  - uses native share sheet when available,
  - falls back to clipboard copy with message + invite link.
- Purpose:
  - immediate social loop before mission begins.

### 27.3 Viral Hook #2 (Start -> Mission): 7-Day Challenge
- Added `Join 7-Day Challenge` toggle on start screen.
- If enabled, mission begins with a challenge message nudging friend invites.
- Purpose:
  - commitment loop that increases return behavior and friend pull-in.

### 27.4 Viral Hook #3 (Active Use): Squad Pulse + Social Actions
- Added `Squad Pulse` module in the live board.
- Includes:
  - social proof (`friends locked today`),
  - `Nudge Squad` quick action (copies motivational prompt),
  - `Share Lock Win` after mission lock (shares/copies success message).
- Purpose:
  - keeps social virality alive during normal daily usage.

### 27.5 Implementation Notes
- Updated:
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles/app.css`
- Build verification:
  - `npm run build:web` passes.

## 28) Brand Logo Implementation (Original Icon)
Update date:
- February 18, 2026

### 28.1 Logo Direction
- Implemented an original app icon with a bold rounded-square mark and custom monogram-like symbol.
- Kept a mobile-app style feel while avoiding close similarity to existing brand logos.

### 28.2 Files Added
- `apps/web/public/logo.svg`
- `apps/web/public/favicon.svg`

### 28.3 App Integration
- Start screen uses full logo mark.
- Mission header uses compact logo mark.
- Browser tab favicon now uses `favicon.svg`.

### 28.4 Files Updated
- `apps/web/index.html`
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 28.5 Verification
- `npm run build:web` passes.

## 29) Whatnot-Inspired Theme Pass (Fonts + Colors)
Update date:
- February 18, 2026

### 29.1 Inspiration Applied
- Used Whatnot’s visual direction as inspiration:
  - bright yellow energy,
  - strong contrast,
  - social-first, casual feel,
  - playful but clean interface.
- Source reference:
  - https://news.whatnot.com/whatnots-refreshed-look/

### 29.2 Font Direction
- Updated typography to a more casual social-app stack:
  - primary: `Plus Jakarta Sans`
  - headings: `Manrope`
- Goal: less futuristic/tool-like, more friendly and lifestyle-oriented.

### 29.3 Color Direction
- Shifted theme to yellow-forward accents with charcoal anchors:
  - bright yellow highlights for urgency and progress,
  - dark neutral CTAs for contrast,
  - lighter soft neutrals for background/surfaces.
- Updated chat bubbles, status pills, fee banner, and squad card accordingly.

### 29.4 Implementation Notes
- Updated:
  - `apps/web/src/styles/app.css`
- Verification:
  - `npm run build:web` passes.

## 30) Logo Revision (Dollar-Green Bubbly P)
Update date:
- February 18, 2026

### 30.1 Design Changes
- Updated logo to a greener dollar-themed identity.
- Removed previous heart-like accent shape.
- Made the `P` mark more rounded/bubbly.
- Added dollar-like vertical bar treatment to reinforce money/accountability theme.

### 30.2 Files Updated
- `apps/web/public/logo.svg`
- `apps/web/public/favicon.svg`

### 30.3 Verification
- `npm run build:web` passes.

## 31) Start Screen Copy Revision (User-Specified)
Update date:
- February 18, 2026

### 31.1 Headline Update
- Start screen headline now matches requested copy exactly:
  - \"Set your priorities daily. If you don't, I'll charge you a dollar.\"

### 31.2 Messaging Cleanup
- Removed \"win the day with your squad\" phrasing from onboarding steps.
- Replaced with neutral progress-oriented line:
  - \"Track progress and finish strong.\"

### 31.3 Challenge Copy Update
- Updated challenge CTA language to:
  - \"Seven-day challenge. Get your dollar back.\"

### 31.4 Files Updated
- `apps/web/src/App.tsx`

### 31.5 Verification
- `npm run build:web` passes.

## 32) Start Screen CTA Position + Label Update
Update date:
- February 18, 2026

### 32.1 Layout Change
- Removed the 3-point onboarding box from the start screen.
- Moved the primary CTA up to that position for clearer action focus.

### 32.2 CTA Label Update
- Changed CTA text from `Start Today` to:
  - `Set today's priorities`

### 32.3 Files Updated
- `apps/web/src/App.tsx`

### 32.4 Verification
- `npm run build:web` passes.

## 33) Seven Day Challenge Label Formatting Update
Update date:
- February 18, 2026

### 33.1 Copy Formatting Change
- Updated challenge button copy to include:
  - a colon after `Seven Day Challenge`
  - a forced line break before the second line

### 33.2 Current Text
- Inactive:
  - `Seven Day Challenge:`
  - `Get your dollar back.`
- Active:
  - `Seven Day Challenge:`
  - `On`

### 33.3 Files Updated
- `apps/web/src/App.tsx`

### 33.4 Verification
- `npm run build:web` passes.

## 34) Main Screen Functional Check + Share/Nudge Reliability Update
Update date:
- February 18, 2026

### 34.1 Functional Check Scope
Main mission screen behavior reviewed and hardened for:
- timer + charge state progression,
- add priority flow,
- lock day action,
- status chip updates,
- confidence slider updates,
- start screen return,
- invite/share/nudge actions.

### 34.2 Fixes Applied
- Start flow reset bug fixed:
  - beginning a new mission now resets timer/session state cleanly.
- Clipboard/share reliability improved:
  - added safe copy helper with fallback path if `navigator.clipboard` is unavailable.
- Share actions now provide clear chat feedback messages for success/fallback outcomes.
- Added platform-specific share/nudge actions for best-effort social delivery:
  - `Invite via Snapchat`
  - `Invite via Instagram`
  - `Nudge on Snapchat`
  - `Nudge on Instagram`
  - `Share Win on Snapchat`
  - `Share Win on Instagram`
- Platform routing behavior:
  - attempts app deep-link first,
  - falls back to corresponding platform web route.

### 34.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 34.4 Verification
- `npm run build:web` passes.
- Note:
  - Snapchat/Instagram deep-link success depends on device OS/browser/app install state.
  - fallback routes and copy-to-paste flow are included for non-installed or unsupported environments.

## 35) Main Header Navigation Update (Logo -> Start Screen)
Update date:
- February 18, 2026

### 35.1 UX Change
- Removed `Start Screen` button from main mission header.
- Logo is now the navigation control back to start screen.

### 35.2 Implementation Notes
- Updated:
  - `apps/web/src/App.tsx`
  - `apps/web/src/styles/app.css`
- Added clickable logo button (`logo-home`) with accessible label:
  - `aria-label=\"Go to start screen\"`

### 35.3 Verification
- `npm run build:web` passes.

## 36) Header Account Menu Update (Replace Open Badge)
Update date:
- February 18, 2026

### 36.1 UX Change
- Removed main header `Open/Locked/Late` badge.
- Added account icon button in header (`👤`) to open account info panel.

### 36.2 Account Panel Contents
- Email
- Current daily status (`Open`, `Locked`, `Late`)
- Today's charge (`Pending`, `$0`, `$1`)
- Priority count (`x/3`)
- Seven-day challenge status (`On`/`Off`)
- `Sign out` action

### 36.3 Sign Out Behavior
- Clears local session/start-state key.
- Resets mission state (messages, priorities, timer, challenge state).
- Returns user to start screen.

### 36.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 36.5 Verification
- `npm run build:web` passes.

## 39) Nudge Flow Simplification (Single Button -> App Chooser)
Update date:
- February 18, 2026

### 39.1 UX Rule
- Main screen now has only one nudge entry:
  - `Nudge Squad`
- No separate per-platform nudge buttons on the board.

### 39.2 Nudge Interaction
- Tapping `Nudge Squad` opens a lightweight chooser modal:
  - Snapchat
  - Instagram
  - More apps
  - Cancel
- Selection behavior:
  - Snapchat/Instagram use best-effort deep-link open with web fallback.
  - Message is pre-copied to clipboard so the user can paste/send quickly.
  - `More apps` uses native share sheet when available, copy fallback otherwise.

### 39.3 Viral Pattern Rationale
- Modeled after high-performing social app share patterns:
  - single primary share action in-context,
  - fast destination choices,
  - fallback to system share for wider reach.
- External references informing this pattern:
  - Apple Activity Views (Share Sheet) guidance
  - Android Sharesheet guidance and Direct Share targets

### 39.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 39.5 Verification
- `npm run build:web` passes.

## 40) Morning Ping Time Persistence
Update date:
- February 18, 2026

### 40.1 Behavior
- Morning ping time now persists in local storage.
- Selected value survives:
  - full page reload,
  - app reopen,
  - sign-out/sign-in cycle.

### 40.2 Storage Details
- Added local storage key:
  - `painful-dollar-ping-time`
- Default remains:
  - `08:10` (8:10 AM weekdays) when no saved value exists.
- Added format validation for saved time values.

### 40.3 Files Updated
- `apps/web/src/App.tsx`

### 40.4 Verification
- `npm run build:web` passes.

## 41) Schedule Screen Copy + Spacing Cleanup
Update date:
- February 18, 2026

### 41.1 Copy Removed
- Removed label text:
  - `Morning ping time`
- Removed helper line:
  - `Default schedule: weekdays at 8:10 AM.`

### 41.2 Spacing Adjustment
- Increased vertical spacing around time input and action row.
- Increased input padding for easier touch interaction and improved visual breathing room.

### 41.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 41.4 Verification
- `npm run build:web` passes.

## 42) Payment Setup Step + Mobile Billing Preparation
Update date:
- February 18, 2026

### 42.1 UX Flow Update
- After saving morning ping time, user is now taken to a payment setup step before mission chat.
- Payment setup requires selecting one mode:
  - `iPhone (App Store billing)`
  - `Android (Google Play billing)`
  - `Web test mode (simulated charges)`
- Mission flow continues only after payment mode is selected.

### 42.2 Current Web Capability
- Web prototype cannot execute true StoreKit / Play Billing in-app transactions.
- Web mode now clearly distinguishes:
  - real-charge capable profile (`ios` / `android`, prepared mode),
  - simulated profile (`web_test`).
- Expiry charge messaging reflects this:
  - real mode: `$1 charge is triggered`
  - web test mode: `$1 charge simulated`

### 42.3 Persistence
- Billing selection and readiness now persist locally:
  - `painful-dollar-billing-platform`
  - `painful-dollar-billing-ready`
- Ping time persistence remains active:
  - `painful-dollar-ping-time`

### 42.4 Backend Preparation Added
- Added billing preparation migration:
  - `apps/server/db/migrations/002_billing_preparation.sql`
- New prepared tables:
  - `payment_profile` (platform + setup status)
  - `charge_attempt` (attempt result, transaction refs, failure reason)

### 42.5 Mobile Implementation Plan (Next)
Native iOS app:
- Integrate StoreKit 2 purchase flow for consumable/top-up or one-time charge token model.
- Verify transactions server-side and map to user/accountability events.

Native Android app:
- Integrate Google Play Billing one-time product flow.
- Process purchases in backend using purchase token verification and lifecycle handling.

Backend:
- Convert charge simulation to real provider-backed charge attempts.
- Add idempotent charge worker + retry policy.
- Add App Store / Play purchase verification endpoints and webhook/notification ingestion.

### 42.6 Compliance/Platform Notes
- For digital app functionality, App Store requires in-app purchase usage in standard cases.
- Google Play billing should use one-time product/subscription lifecycle with backend verification.
- This project remains in prototype mode until native billing integration is completed and validated.

### 42.7 Key References (Official)
- Apple App Review Guidelines (Payments 3.1.1): https://developer.apple.com/app-store/review/guidelines/
- Apple StoreKit 2 overview: https://developer.apple.com/storekit/
- Apple transaction history (server API): https://developer.apple.com/documentation/appstoreserverapi/get-transaction-history
- Google Play Billing integrate: https://developer.android.com/google/play/billing/integrate
- Google one-time products: https://developer.android.com/google/play/billing/one-time-products
- Google purchase lifecycle + RTDN: https://developer.android.com/google/play/billing/lifecycle

### 42.8 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`
- `apps/server/db/migrations/002_billing_preparation.sql`

### 42.9 Verification
- `npm run build:web` passes.

## 43) Seven-Day Challenge Logic + Rainbow Progress Bar
Update date:
- February 18, 2026

### 43.1 Challenge Rule Implemented
- Seven-day challenge now means:
  - user sets priorities successfully (locks day) for 7 consecutive days.
- On day 7 completion:
  - user receives `$1` back (prototype credit counter),
  - challenge streak resets for the next cycle.

### 43.2 Streak Tracking
- Added local persistence keys:
  - `painful-dollar-challenge-streak`
  - `painful-dollar-challenge-last-day`
  - `painful-dollar-challenge-rewards`
- Streak behavior:
  - same-day duplicate lock does not increment,
  - consecutive day increments streak,
  - non-consecutive day resets streak to 1 on next successful lock.

### 43.3 Main Screen Rainbow Progress Bar
- Added colorful rainbow challenge progress bar on mission screen.
- Visibility rule:
  - appears once the first priority is successfully set.
- Shows:
  - current progress (`x/7`)
  - challenge explainer text:
    - `Set priorities 7 days straight and get $1 back.`

### 43.4 Account Panel Additions
- Added:
  - `7-day progress: x/7`
  - `Dollars back earned: $n`

### 43.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 43.6 Verification
- `npm run build:web` passes.

## 44) Confidence Bar Removal
Update date:
- February 18, 2026

### 44.1 UX Change
- Removed confidence slider from main screen.
- Removed related confidence text and controls entirely.

### 44.2 Scoring Change
- Daily score now depends only on priority completion outcomes:
  - `done` = 100 points
  - `partial` = 50 points
  - `pending`/`missed` = 0 points
- Final score is average across current priorities.

### 44.3 Files Updated
- `apps/web/src/App.tsx`

### 44.4 Verification
- `npm run build:web` passes.

## 45) Contextual Chatty Priority Replies
Update date:
- February 18, 2026

### 45.1 UX Goal
- Make coach responses feel more human, contextual, and conversational after user submits a priority.

### 45.2 Behavior Update
- Replaced generic fixed response strings with contextual reply builder logic.
- Reply now references the user’s entered priority text and uses friend-like tone.
- If priority wording is less structured, app still accepts it and gives a gentle optional tweak.

### 45.3 Files Updated
- `apps/web/src/App.tsx`

### 45.4 Verification
- `npm run build:web` passes.

## 46) Day 2 Experience (Yesterday Review + Today's Setup)
Update date:
- February 18, 2026

### 46.1 Day 2 Flow Implemented
- After a successful locked day, the next mission start now prompts:
  - whether yesterday's priorities were `done`, `partial`, or `missed`.
- The mission screen shows a dedicated `Yesterday check-in` block with status buttons for each carried item.
- Once yesterday items are answered, user is explicitly guided to set today's priorities.

### 46.2 Sequencing Rule
- If yesterday review items exist, today's priority input is disabled until yesterday statuses are answered.
- This makes the intended Day 2 flow clear:
  1. Account for yesterday.
  2. Set today's priorities.

### 46.3 Persistence Added
- Stored key:
  - `painful-dollar-last-locked-priorities`
- On lock day:
  - current priorities are saved as next-session \"yesterday\" items.
- On next mission:
  - saved items load into the review block as `unanswered`.

### 46.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 46.5 Verification
- `npm run build:web` passes.

## 47) Day 2 Demo Link (Skip Countdown)
Update date:
- February 18, 2026

### 47.1 Behavior Added
- Added URL-based demo mode for quickly showing Day 2 flow.
- Query parameter:
  - `?demo=day2`

### 47.2 What It Does
- Opens directly into mission screen.
- Preloads yesterday priorities for done/partial/missed review.
- Pauses countdown behavior in this demo mode.
- Adds chat context indicating Day 2 review-first flow.

### 47.3 File Updated
- `apps/web/src/App.tsx`

### 47.4 Verification
- `npm run build:web` passes.

## 48) Day 2 UX Update: Yesterday Review Inside Main Chat
Update date:
- February 18, 2026

### 48.1 Flow Update
- Moved yesterday review entirely into the main chat stream.
- New sequence:
  1. Chat asks: `Did you finish your first priority which was "...?"`
  2. User taps one of three chat actions: `done`, `partial`, `missed`
  3. Chat asks the next priority in sequence (second, then third if present)
  4. After all answered, chat prompts user to set today's priorities

### 48.2 Interaction Model
- Removed separate \"yesterday check-in\" panel from outside chat.
- Day-2 review is now conversational and bubble-based.
- Priority input remains locked until all yesterday prompts are answered.

### 48.3 Files Updated
- `apps/web/src/App.tsx`

### 48.4 Verification
- `npm run build:web` passes.

## 49) Chat Auto-Scroll to Latest Bubble
Update date:
- February 18, 2026

### 49.1 UX Guarantee
- Chat view now auto-scrolls to the newest bubble/prompt.
- Users no longer need to manually scroll to see latest messages.

### 49.2 Trigger Conditions
- Auto-scroll runs when:
  - mission screen loads,
  - new chat messages are appended,
  - yesterday-review prompt state changes.

### 49.3 Implementation Notes
- Added bottom anchor ref inside chat message container.
- Added effect that scrolls anchor into view on updates.

### 49.4 Files Updated
- `apps/web/src/App.tsx`

### 49.5 Verification
- `npm run build:web` passes.

## 50) Keyboard UX: Enter Adds Priority
Update date:
- February 18, 2026

### 50.1 Behavior
- Pressing `Enter` in the priority input now triggers `Add Priority`.
- This mirrors the button action for faster keyboard flow.

### 50.2 Implementation
- Added `onKeyDown` handler on priority input:
  - detects `Enter`
  - prevents default behavior
  - calls `addPriority()`

### 50.3 Files Updated
- `apps/web/src/App.tsx`

### 50.4 Verification
- `npm run build:web` passes.

## 51) Seven-Day Rainbow Bar Pastel Color Update
Update date:
- February 18, 2026

### 51.1 Visual Change
- Updated seven-day challenge progress bar rainbow gradient to a softer pastel palette.
- Kept full rainbow hue sequence while reducing saturation/intensity.

### 51.2 File Updated
- `apps/web/src/styles/app.css`

### 51.3 Verification
- `npm run build:web` passes.

## 52) Crawler Block File Added (`robits.txt`)
Update date:
- February 18, 2026

### 52.1 File Added
- `apps/web/public/robits.txt`

### 52.2 Contents
- `User-agent: *`
- `Disallow: /`

### 52.3 Purpose
- Blocks all crawler access for environments where this file is honored as configured.

## 53) Password Gate Added for Private Access
Update date:
- February 18, 2026

### 53.1 Access Control
- Added app-entry password screen.
- Required password:
  - `painful`

### 53.2 Behavior
- App remains locked until correct password is entered.
- `Enter` key on password field triggers unlock.
- Access state persists locally via:
  - `painful-dollar-access-granted`
- `Sign out` now clears access and returns to locked screen.

### 53.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 53.4 Verification
- `npm run build:web` passes.

## 54) Test Recommendation Implementation Pass (All Items Addressed)
Update date:
- February 18, 2026

### 54.1 Recommendation 1: Persist Challenge Opt-In
Status: Implemented
- Seven-day challenge toggle is now persisted in local storage:
  - `painful-dollar-challenge-enabled`
- Challenge setting survives reload/reopen/sign-out cycle.

### 54.2 Recommendation 2: Fix \"Yesterday\" Accuracy
Status: Implemented
- Last locked priorities are now stored with lock date metadata:
  - `painful-dollar-last-locked-priorities` now stores `{ day, items }`.
- Day 2 copy now switches correctly:
  - uses `yesterday` when prior lock is previous calendar day,
  - uses `your last check-in (MMM DD)` when prior lock is older.

### 54.3 Recommendation 3: Fast Daily Re-Entry
Status: Implemented
- Added onboarding completion marker:
  - `painful-dollar-onboarding-done`
- Start-screen CTA behavior:
  - first-time users go through schedule/payment setup,
  - returning users with completed setup jump directly to mission flow.

### 54.4 Recommendation 4: Move Streak/Reward Toward Backend Authority
Status: Prepared (schema-level)
- Added backend migration for server-authoritative challenge state:
  - `apps/server/db/migrations/003_challenge_state.sql`
- New table:
  - `challenge_state` with streak/reward/last-success-day/challenge-enabled fields.
- This enables cross-device + tamper-resistant challenge continuity once API wiring is connected.

### 54.5 Additional Bug Fixes Included
- Day 2 prompt wording now stays context-correct in chat.
- Stored legacy last-priority payloads continue to parse safely.
- Sign-out no longer unintentionally resets challenge preference state.

### 54.6 Files Updated
- `apps/web/src/App.tsx`
- `apps/server/db/migrations/003_challenge_state.sql`

### 54.7 Verification
- `npm run build:web` passes.

## 55) Multi-Day Test Mode (Fast Day Simulation)
Update date:
- February 18, 2026

### 55.1 What Was Added
- Added built-in multi-day simulation mode for realistic consecutive-day testing.
- Enable with URL param:
  - `?testdays=1`

### 55.2 Test Toolbar (Mission Screen)
- In test mode, mission screen now shows a toolbar with:
  - `Previous day`
  - `Next day`
  - `Reset to real today`
  - `Start this day`
- The app uses simulated date for:
  - streak progression,
  - broken streak detection,
  - last-check-in date wording,
  - stored lock-day metadata.

### 55.3 Persistence
- Simulated date is persisted via:
  - `painful-dollar-test-day`
- This allows repeatable testing across reloads.

### 55.4 Fast Test Links
- Standard app:
  - `/`
- Day 2 demo:
  - `/?demo=day2`
- Multi-day simulation:
  - `/?testdays=1`

### 55.5 Verification
- `npm run build:web` passes.

## 56) Always-On Rainbow Bar + New-Day Streak Risk Pulse
Update date:
- February 18, 2026

### 56.1 UX Change
- Seven-day rainbow progress bar now always shows on main screen.
- On a new day (before any priority is set), bar enters danger pulse mode.

### 56.2 Risk State Logic
- Added persistent `last priority set day` tracking:
  - `painful-dollar-last-priority-day`
- If current day has no priority set yet:
  - streak risk state is active,
  - rainbow card pulses to draw attention.
- Once first priority is set:
  - pulse stops,
  - card switches to safe message state.

### 56.3 Copy Update (Short, Target-Friendly)
- Risk state:
  - `No priorities today. Streak at risk.`
- Safe state:
  - `Nice. Your streak is safe today.`

### 56.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 56.5 Verification
- `npm run build:web` passes.

## 57) Test Toolbar Streak-Reached Shortcut
Update date:
- February 18, 2026

### 57.1 Test Utility Added
- In `?testdays=1` mode, test toolbar now includes:
  - `Simulate 7-day reward`

### 57.2 What It Does
- Immediately simulates reaching the challenge milestone:
  - turns challenge on,
  - awards `$1 back`,
  - resets streak state as if reward was completed,
  - posts a system chat message confirming reward event.

### 57.3 File Updated
- `apps/web/src/App.tsx`

### 57.4 Verification
- `npm run build:web` passes.

## 58) Test Toolbar Layout + Visual Separation Update
Update date:
- February 18, 2026

### 58.1 Layout Change
- Test toolbar moved to the top of mission screen, above all app UI (above logo/header).
- This makes test controls clearly separate from product controls.

### 58.2 Visual Style Change
- Restyled toolbar to plain utility appearance:
  - neutral gray background,
  - simple borders,
  - compact non-branded buttons,
  - reduced emphasis styling.
- Goal: obvious \"testing harness\" look, not part of user-facing design system.

### 58.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 58.4 Verification
- `npm run build:web` passes.

## 37) Main Header + Summary Simplification
Update date:
- February 18, 2026

### 37.1 Header Copy Change
- Removed the sentence:
  - `Check-in with your accountability friend`
- Header now keeps only brand identity and controls.

### 37.2 Summary Metrics Change
- Removed `Progress` metric card.
- Removed `Score` metric card.
- Summary now focuses only on:
  - `Time left`
  - `Charge`

### 37.3 Files Updated
- `apps/web/src/App.tsx`

### 37.4 Verification
- `npm run build:web` passes.

## 38) First-User Scheduling Question (Before Mission Start)
Update date:
- February 18, 2026

### 38.1 UX Flow Change
- Updated first-user journey:
  1. Start screen
  2. Tap `Set today's priorities`
  3. Scheduling question screen
  4. Enter mission chat

### 38.2 Single Required Question
- Question shown:
  - `At what time in the morning should I ping you to set your priorities?`
- Supporting line:
  - `You will have 10 minutes before I charge you a dollar.`

### 38.3 Default Setting
- Default morning ping time is set to `8:10 AM`.
- Default cadence is weekdays.

### 38.4 Account Visibility
- Morning ping schedule is now visible in the account panel:
  - `Morning ping: <time> (weekdays)`

### 38.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 38.6 Verification
- `npm run build:web` passes.

---
This file is intended to be a living project source of truth. Update milestones, scope, and checkpoints as decisions evolve.

## 59) 7-Day Reward Firework Celebration (Equalizer-Inspired)
Update date:
- February 22, 2026

### 59.1 Goal
- Make the 7-day reward moment feel high-energy and visibly celebratory inside the streak card.
- Visual direction inspired by Apple Logic-style equalizer motion (not copied), adapted to the app brand.

### 59.2 Interaction Behavior
- Celebration triggers when the user reaches the 7-day streak reward threshold.
- Animation appears directly inside the rainbow streak box.
- Celebration auto-hides after a short duration so it does not block normal usage.

### 59.3 Visual System
- Added animated vertical equalizer bars with staggered timing.
- Added spark bursts for a “firework” finish.
- Added temporary reward glow treatment to the streak card while celebration is active.

### 59.4 Implementation Notes
- New state flag and timer-driven lifecycle for reward celebration.
- Reward trigger integrated in both:
  - normal streak completion path,
  - test-toolbar simulation path ("Simulate 7-day reward").

### 59.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 59.6 Verification
- `npm run build:web` passes.

## 60) Coach Personality + Priority Wording + 10-Minute Clarifier Fallback
Update date:
- February 22, 2026

### 60.1 Personality Direction Implemented
- Chat voice updated to feel like a young executive-function coach friend:
  - succinct by default,
  - warm but direct,
  - action-focused,
  - avoids over-chatty copy.
- Updated mission chat copy to be shorter and more assertive.

### 60.2 Priority Wording Upgrade
- Added priority rewording layer so saved priorities are not a raw repeat of user input.
- Behavior:
  - if user starts with an action verb, app normalizes and keeps it concise,
  - short noun-style entries are converted into an action commitment,
  - longer entries are formatted into a clear completion statement.

### 60.3 Clarifier Logic (Less Strict, Still Useful)
- For very short entries, app asks one quick clarifying follow-up (finish line).
- Clarifier is not required for acceptance; priority is already counted as set.

### 60.4 10-Minute No-Reply Fallback
- If no reply arrives to the clarifying question for 10 minutes:
  - app auto-keeps the user’s original intent,
  - posts confirmation in chat,
  - priority remains counted as successfully set.

### 60.5 Clarifier Reply Handling
- If user responds to clarifier:
  - response updates that same priority's finish-line context,
  - does not create a duplicate/new priority item.

### 60.6 Files Updated
- `apps/web/src/App.tsx`

### 60.7 Verification
- `npm run build:web` passes.

## 61) Conversational Coach Spec (Implementation Contract)
Update date:
- February 22, 2026

### 61.1 Voice Profile
- Persona: young coach (early 20s), strong executive-function guidance.
- Tone: empathetic, direct, succinct.
- Default response length: 1-2 short sentences.
- Avoid: over-chatty banter, empty hype, soft evasive phrasing.

### 61.2 Coaching Rules
- Accept user input quickly; do not over-challenge.
- Push toward action clarity with one practical next step.
- If input is vague, ask at most one clarifying question.
- Maintain accountability language without sounding punitive.

### 61.3 Priority Handling Rules
- User input is always accepted as a valid priority (unless empty).
- Priority title is normalized/reworded for clarity (not pure repetition).
- Rewording keeps the user's intent and language as source.
- Maximum priorities per day remains 3.

### 61.4 Clarifier + Timeout Rules
- Clarifier is only prompted for very short/vague entries.
- Priority is counted as set immediately, even while clarifier is pending.
- If user replies, clarifier response updates the same priority metadata.
- If no clarifier reply after 10 minutes, app auto-confirms and keeps the original intent wording.

### 61.5 UX Impact
- Chat feels like a real coach-friend: short, focused, and hard to game.
- Friction is minimized; users are guided, not blocked.
- Accountability remains clear while preserving momentum.

### 61.6 Source of Truth
- Implementation: `apps/web/src/App.tsx`
- Product history log: `project.MD` sections 60 and 61.

## 62) Gen-AI Coach Responses (Natural Chat) Integration
Update date:
- February 22, 2026

### 62.1 Objective
- Replace repetitive template replies with natural, context-aware coach responses generated by an LLM.
- Keep coach persona constraints:
  - young executive-function coach voice,
  - concise responses,
  - empathetic + direct,
  - accountability-first language.

### 62.2 Architecture
- Added server-side AI endpoint to keep API keys off the client:
  - `POST /v1/coach/respond`
- Frontend now requests coach replies from backend on priority submissions and clarifier responses.
- Added fallback behavior so app still works if AI is unavailable.

### 62.3 Backend Implementation
- New service:
  - `apps/server/src/services/coach.ts`
- New route:
  - `apps/server/src/http/routes.ts` -> `POST /v1/coach/respond`
- Configuration additions:
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default `gpt-4.1-mini`)
  - `COACH_API_TIMEOUT_MS` (default `4500`)
- Config file updated:
  - `apps/server/src/config.ts`

### 62.4 Frontend Implementation
- Added API call path in mission chat:
  - `apps/web/src/App.tsx`
- Priority flow now:
  1. User adds priority
  2. Priority is accepted and stored
  3. Coach reply fetched from `/v1/coach/respond`
  4. If request fails, local fallback response used
- Clarifier reply flow now also uses AI endpoint.

### 62.5 Clarifier Timeout Rule (Requested Behavior)
- If clarifier receives no reply after 10 minutes:
  - priority remains successful,
  - app restores/keeps the user's original wording,
  - app posts confirmation message in chat.

### 62.6 Local Dev Connectivity
- Web app default API base changed to relative `/v1`.
- Vite dev proxy forwards `/v1` -> `http://localhost:8787`.
- File updated:
  - `apps/web/vite.config.ts`

### 62.7 Environment + Docs
- Server README updated with new environment variables and route:
  - `apps/server/README.md`
- Added Vite env typing:
  - `apps/web/src/vite-env.d.ts`

### 62.8 Verification Status
- Web build: pass (`npm run build:web`).
- Server build: blocked in current workspace because server dependencies/types are not installed in local node_modules (environment issue not introduced by this feature).

## 63) Server Auto-Loads .env (Startup Reliability)
Update date:
- February 22, 2026

### 63.1 Problem
- Local runs repeatedly failed with:
  - `AUTH_TOKEN_SECRET: Required`
  - `WINDOW_TOKEN_SECRET: Required`
- Root cause: server process did not load `apps/server/.env` automatically.

### 63.2 Fix Implemented
- Backend startup now loads env variables from `apps/server/.env` on boot.
- Added explicit `.env` load in:
  - `apps/server/src/index.ts`
- Added dependency:
  - `dotenv` in `apps/server/package.json`

### 63.3 Impact
- Users no longer need manual `export ...` commands before `npm run dev:server`.
- Expected flow becomes:
  1. ensure `.env` exists,
  2. run `npm install`,
  3. run `npm run dev:server`.

### 63.4 Note
- OpenAI key previously shared in chat should be revoked and replaced before continuing.

## 64) Priority Entry Relaxation (Accept-First, Optional Coaching)
Update date:
- February 22, 2026

### 64.1 Product Decision
- Priority entry should not feel harder than necessary.
- If user gives a priority, accept it immediately.
- Coaching should be optional, not blocking.

### 64.2 Behavior Changes
- Removed forced clarifier flow from priority entry.
- Removed pending-clarifier capture behavior that could redirect next input.
- Priority is now always stored and counted as set once submitted (unless empty).

### 64.3 Coaching UX
- Coach can still suggest optional improvement when a goal is vague.
- Suggestion language is non-blocking:
  - user can keep original wording as-is.
- Once user has added at least 2 priorities, coach explicitly offers:
  - lock now (done), or
  - add one more.

### 64.4 Files Updated
- `apps/web/src/App.tsx`

### 64.5 Verification
- `npm run build:web` passes.

## 65) Brand Palette Shift: Yellow -> Modern Purple (Green-Complementary)
Update date:
- February 22, 2026

### 65.1 Design Decision
- Replaced yellow-led primary accents with a modern purple system.
- Goal: complement the green logo while keeping a youthful lifestyle feel.

### 65.2 Palette Changes
- Updated core tokens (`:root`) in app stylesheet:
  - background, line, muted, primary, secondary, supporting tones.
- Preserved green accents for positive/active states to align with dollar/goal success cues.

### 65.3 Component Updates
- Updated purple-forward styling across:
  - primary and secondary buttons,
  - fee alert default/warning styles,
  - progress fill,
  - friend/system chat bubbles,
  - squad and chip components,
  - active payment option styling.

### 65.4 Files Updated
- `apps/web/src/styles/app.css`

### 65.5 Verification
- `npm run build:web` passes.

## 66) First Priority Chat Actions (Refine vs Add Next)
Update date:
- February 22, 2026

### 66.1 UX Change
- After user adds the first priority, chat now shows two quick-action bubbles:
  - `Refine priority`
  - `Add next priority`

### 66.2 Behavior
- `Refine priority`:
  - opens edit mode for that first priority,
  - pre-fills composer with current text,
  - next submit replaces the existing priority (does not create a new one).
- `Add next priority`:
  - exits refine mode,
  - prompts user to submit priority #2.

### 66.3 Interaction Notes
- Actions render inline in chat as bubble chips.
- Composer input auto-focuses after either action for fast continuation.

### 66.4 Files Updated
- `apps/web/src/App.tsx`

### 66.5 Verification
- `npm run build:web` passes.

## 67) First-Priority Reply Simplification + Refine/Add Branch Copy
Update date:
- February 22, 2026

### 67.1 First Priority Response
- After first priority submission, chat now gives a short understanding echo plus choice prompt only:
  - `Your priority is ... Want to refine that one or add your next priority?`
- Removed extra stacked guidance text at this moment.

### 67.2 Branch Behavior
- If user taps `Refine priority`:
  - chat gives practical start-choice guidance (kitchen-specific wording supported),
  - then user submits refined version.
- If user taps `Add next priority`:
  - chat responds only: `Okay, what's next?`

### 67.3 Files Updated
- `apps/web/src/App.tsx`

### 67.4 Verification
- `npm run build:web` passes.

## 68) Test Toolbar Visibility Restore (Always Visible)
Update date:
- February 22, 2026

### 68.1 Problem
- Test toolbar appeared to be missing because it only rendered when URL included `?testdays=1`.

### 68.2 Update
- Test toolbar now always renders at the top of mission UI.
- Toolbar now shows mode state:
  - `Mode: Off` (with `Turn test mode on` button)
  - `Mode: On` (full test controls + `Turn test mode off` button)

### 68.3 Mode Toggle Behavior
- Turning test mode on adds `testdays=1` to URL.
- Turning test mode off removes `testdays` from URL.
- Existing controls (day shift, start day, simulate reward) remain available when mode is on.

### 68.4 Files Updated
- `apps/web/src/App.tsx`

### 68.5 Verification
- `npm run build:web` passes.

## 69) Seven-Day Reward Animation: Fountain Bubbles (Logic-Inspired)
Update date:
- February 23, 2026

### 69.1 Visual Direction
- Extended the 7-day reward celebration with fountain-like bubble motion inspired by Apple Logic equalizer energy.
- Kept effect distinct (no direct copy) while matching the requested “little bubbles” vibe.

### 69.2 Implementation
- Added a `bubble-fountain` animation layer inside `challenge-firework`.
- Added 10 bubble particles with staggered sizes, positions, and delays.
- New `bubbleFountain` keyframe animates bubbles rising and fading like a celebratory fountain.

### 69.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 69.4 Verification
- `npm run build:web` passes.

## 70) Seven-Day Reward Rework: Logic-Style Bloom Fountain
Update date:
- February 23, 2026

### 70.1 Reference Alignment
- Updated reward animation to match requested inspiration (Logic "Bloom" style vibe):
  - dark EQ-like panel,
  - dense warm-to-green-to-cyan particle fountain,
  - rising/decaying particle plume shape.

### 70.2 Visual Changes
- Replaced prior simple bubble/spark firework with a bloom particle system.
- Added layered effect:
  - grid background,
  - colored haze base,
  - multi-particle spray with staggered timing, size, hue, and trajectory.
- Color gradient now reads from warm (left) to green/cyan (right), with fountain decay.

### 70.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 70.4 Verification
- `npm run build:web` passes.

## 71) Reward Animation Duration Increase (3x)
Update date:
- February 23, 2026

### 71.1 Change
- Increased 7-day reward celebration runtime from ~3.2s to ~9.6s (3x longer).

### 71.2 Implementation
- Updated reward auto-hide timeout in `apps/web/src/App.tsx`:
  - `3200ms` -> `9600ms`

### 71.3 Verification
- `npm run build:web` passes.

## 72) Full Visual Redesign (Hoop-Inspired, Logo Preserved)
Update date:
- February 23, 2026

### 72.1 Direction
- Preserved existing logo.
- Reworked the rest of the UI toward a Hoop-inspired social app look:
  - vibrant pink/purple lifestyle palette,
  - soft bright gradients,
  - rounded high-radius cards and chips,
  - bolder, friendlier typography,
  - mobile-first polished card feel.

### 72.2 Design System Updates
- Typography switched to:
  - `Outfit` for UI/body,
  - `Manrope` for headings and emphasis.
- Core color tokens updated for warm social identity (purple/pink with green-compatible accents).
- Background updated with layered radial gradient blobs.

### 72.3 Component Restyling
- Restyled primary/secondary buttons to social-style pill controls.
- Updated start card, chat card, board card, summary cards, fee alert, squad card, and priority cards.
- Chat bubbles adjusted for friend/you/system readability with softer color contrast.
- Inputs and chips updated with cleaner rounded visual language.

### 72.4 Files Updated
- `apps/web/src/styles/app.css`

### 72.5 Verification
- `npm run build:web` passes.

## 73) Design Direction Correction: Hoop (Not Snapchat-Yellow Heavy)
Update date:
- February 23, 2026

### 73.1 Clarification Applied
- Updated visual direction to align with Hoop-style boldness.
- Reduced yellow-heavy Snapchat-like accents introduced in prior pass.

### 73.2 Style Adjustments
- Primary/CTA system moved to vivid purple/pink gradient.
- Accent elements (eyebrow, fee alert stripe, progress fill) updated to purple/pink family.
- Active option styling and system bubble updated to match Hoop-like color language.

### 73.3 Files Updated
- `apps/web/src/styles/app.css`

### 73.4 Verification
- `npm run build:web` passes.

## 74) iPhone Viewport Fit: Key Mission Controls Visible Without Swipe
Update date:
- February 23, 2026

### 74.1 Goal
- Ensure key mission navigation and priority input/composer are visible on iPhone-class viewport (including iPhone 16) without page scrolling.

### 74.2 Implementation
- Added mission-specific root class:
  - `app mission-app` (mission screen only).
- Added compact mobile viewport rules at `@media (max-width: 440px)`:
  - mission app locked to `100dvh` with internal layout fit,
  - reduced spacing/padding across header, alerts, summary, challenge, and controls,
  - chat area set to flex + internal scroll,
  - priority composer remains visible at bottom of chat,
  - board/secondary pane hidden on small viewport to prioritize core controls.

### 74.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 74.4 Verification
- `npm run build:web` passes.

## 75) Test Toolbar Placement Update (Below App)
Update date:
- February 23, 2026

### 75.1 UX Change
- Moved test toolbar from top-of-app to below the main app container.
- Toolbar now sits outside core mission viewport so it does not consume visible iPhone mission space.

### 75.2 Mobile Behavior
- On iPhone-sized screens, mission UI remains full-height and focused.
- Test toolbar is still accessible below the app (outside typical first viewport), as requested.

### 75.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 75.4 Verification
- `npm run build:web` passes.

## 76) Icon Background Update (Purple Tile)
Update date:
- February 23, 2026

### 76.1 Change
- Kept the green `P` mark.
- Switched icon tile background from dark black/blue to purple for better contrast against the current dark UI.

### 76.2 Files Updated
- `apps/web/public/logo.svg`
- `apps/web/public/favicon.svg`

### 76.3 Verification
- `npm run build:web` passes.

## 77) Chat Sender Avatars (Snap-Style Visual Cues)
Update date:
- February 23, 2026

### 77.1 UX Change
- Added sender avatar icons next to chat bubbles so users can instantly tell who sent each message.
- Applied to standard chat messages and interactive coach rows.

### 77.2 Icon Mapping
- Coach/friend: `C` badge
- You/user: `Y` badge
- System: `$` badge

### 77.3 Style Direction
- Playful, social-style circular badges inspired by snap-like chat cues.
- Kept implementation original and aligned with app color system.

### 77.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 77.5 Verification
- `npm run build:web` passes.

## 78) Coach Icon Semantics + Color Direction Decision (Expert-Informed)
Update date:
- February 23, 2026

### 78.1 Decision A: `P` Icon vs "Hi, I'm your coach"
- Chosen: `P` icon (logo-correlated) for coach sender badge.
- Rejected: adding intro text line in every bubble.

Reasoning:
- Persistent visual identity scales better than repetitive text in a fast chat interface.
- Repeating explanatory lines in each bubble increases noise and reduces scan speed.
- `P` aligns coach identity with brand mark and is present in every coach row.

### 78.2 Decision B: Yellow vs Purple/Green
- Chosen: reduce yellow in core UI and use purple + green as main signals.
- Purple remains primary action/accent family.
- Green now marks coach badge for quick identity recognition.

### 78.3 Implemented Changes
- Coach sender icon switched from `C` to `P`.
- Interactive coach rows updated to show `P` badge.
- Coach badge color switched from yellow to green.
- Reduced remaining yellow-heavy background accent in the main UI.

### 78.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 78.5 Verification
- `npm run build:web` passes.

## 79) Expired Charge Alert Restyle (Old Visual Removed)
Update date:
- February 23, 2026

### 79.1 Issue
- The fee alert state showing `Time is up. A $1 charge is triggered.` still used legacy light/pink styling.

### 79.2 Fix
- Updated `fee-alert` state variants (`warning`, `urgent`, `late`, `safe`) to the new bold dark design system.
- Kept semantic border-left accent colors while aligning panel backgrounds with the current theme.

### 79.3 Files Updated
- `apps/web/src/styles/app.css`

### 79.4 Verification
- `npm run build:web` passes.

## 80) Natural Priority Echo Fix (Use User Wording)
Update date:
- February 23, 2026

### 80.1 Issue
- Priority acknowledgments felt less natural and sometimes rewrote user text too aggressively.

### 80.2 Fix
- Priority normalization now preserves user intent and wording (light cleanup only).
- Removed forced phrasing patterns like `Complete: ...` / automatic action-verb rewrites.
- First-priority acknowledgment now explicitly echoes user entry in natural language:
  - `Your priority is "...". Want to refine that one or add your next priority?`
- Non-AI fallback acknowledgments now mirror user text naturally.

### 80.3 Files Updated
- `apps/web/src/App.tsx`

### 80.4 Verification
- `npm run build:web` passes.

## 81) Natural AI Priority Acknowledgment (First Priority Included)
Update date:
- February 23, 2026

### 81.1 User Intent
- Ensure responses feel natural/ChatGPT-like and explicitly reflect what user entered as priority.
- Example behavior target: for `clean room`, response should acknowledge understanding naturally.

### 81.2 Frontend Changes
- First-priority response now requests an AI-generated acknowledgment (instead of fixed template-only line).
- Fallback text explicitly mirrors intent in natural language:
  - `I understood that you want to ...`
- First-priority follow-up choice remains:
  - `Want to refine that one or add your next priority?`

### 81.3 Backend Coach Changes
- Updated coach persona prompt to prioritize clearly echoing user intent in natural wording.
- Added fallback handler for first-priority instruction payloads so fallback still sounds natural.

### 81.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/server/src/services/coach.ts`

### 81.5 Verification
- `npm run build:web` passes.

## 82) Natural Acknowledgment Variation (No Repetitive "I understood that")
Update date:
- February 23, 2026

### 82.1 Issue
- Acknowledgment fallback felt repetitive by always starting with `I understood that...`.

### 82.2 Update
- Added varied natural confirmation phrasing while still reflecting user intent.
- Maintains explicit understanding signal without repetitive wording.

### 82.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/server/src/services/coach.ts`

### 82.4 Verification
- `npm run build:web` passes.

## 83) Recent Changes Summary (Conversation + UI)
Update date:
- February 23, 2026

### 83.1 Conversation Quality
- Priority acknowledgments now reflect user intent in natural language without repetitive phrasing.
- Removed rigid repeated opener style; responses now vary while staying concise.
- First-priority acknowledgment remains paired with:
  - `Want to refine that one or add your next priority?`

### 83.2 AI/Natural Reply Path
- First-priority response uses AI endpoint when available.
- Frontend and backend fallback responses both updated to sound natural if AI call is unavailable.

### 83.3 Chat Identity + Visuals
- Coach sender badge switched to `P` (logo-linked identity).
- Core UI yellow emphasis reduced; purple + green retained as main interaction colors.
- Expired-charge alert state updated to match current bold dark visual system.

### 83.4 Mobile Layout + Test Tools
- Mission layout optimized for iPhone viewport so core controls (including input/composer) remain visible.
- Test toolbar moved below app container so it does not consume mission viewport space.

### 83.5 Verification
- `npm run build:web` passes after these changes.

## 84) Priority-Only Coaching Guardrails (No Execution/Ordering Prompts)
Update date:
- February 23, 2026

### 84.1 Issue
- First-priority acknowledgment occasionally asked action-planning questions (e.g., `Which one do you want to tackle right now?`).

### 84.2 Product Rule Reinforced
- App goal is setting priorities, not planning execution order.
- Any goal-sharpening prompt must remain optional.

### 84.3 Frontend Changes
- First-priority AI request now explicitly forbids execution/ordering follow-up questions.
- Added safety filter for first-priority reply:
  - if AI response contains action-planning question patterns, fallback natural acknowledgment is used.
- Refine prompt changed from execution coaching to optional wording/definition sharpening.

### 84.4 Backend Changes
- Coach persona prompt updated to:
  - prioritize priority-setting over execution coaching,
  - avoid ordering/tackle-first questions unless user explicitly asks,
  - keep sharpening help optional.
- Short-input fallback changed from execution question to optional sharpening wording.

### 84.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/server/src/services/coach.ts`

### 84.6 Verification
- `npm run build:web` passes.

## 85) Lock Day Recap UX Implementation (Summary + Saved Priorities)
Update date:
- February 23, 2026

### 85.1 Implemented After `Lock Day`
- Added a dedicated `Day Locked` recap card shown immediately after lock.
- Recap shows:
  - success state (`No $1 charge today`),
  - one-line summary sentence generated from locked priorities,
  - numbered chips for all locked priorities,
  - carry-over note (`These will be used for tomorrow's check-in.`).

### 85.2 Summary Generation
- Added deterministic summary builder that composes a natural one-line day focus sentence from locked priorities.

### 85.3 Collapsed Board Under Chat
- Added post-lock inline board section below composer:
  - default collapsed,
  - `Open Today Board` / `Hide Today Board` toggle,
  - shows locked priorities when expanded.

### 85.4 State Management
- Added locked snapshot state captured at lock time.
- Resets lock recap state on mission reset/sign-out/start.

### 85.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 85.6 Verification
- `npm run build:web` passes.

## 86) Mistake Recovery + Confirm-Before-Count Priority Flow
Update date:
- February 23, 2026

### 86.1 Goal
- If user says a priority was wrong/mistyped, it should not count toward the 3 until corrected and confirmed.

### 86.2 Implemented Conversation Behavior
- Added correction signal detection (e.g., wrong/mistake/meant/typo/fix/change that).
- When correction is signaled:
  - last priority is removed from list immediately,
  - app asks for corrected priority,
  - corrected text is stored as draft only (not counted yet),
  - user must confirm via `Confirm add` before it is added/counts.

### 86.3 Confirmation UI
- Added in-chat confirmation bubble for pending draft:
  - `Confirm add`
  - `Change it`
- If user types while draft pending, draft is updated (still not counted) until confirmed.

### 86.4 Edit/Delete Controls (Pre-Lock)
- Added pre-lock priority row actions:
  - `edit`
  - `delete`
- Supports quick correction without adding unintended items.

### 86.5 Files Updated
- `apps/web/src/App.tsx`

### 86.6 Verification
- `npm run build:web` passes.

## 87) Today Board Upgrade (Visual + Cleaned Priorities + Tick Celebration)
Update date:
- February 23, 2026

### 87.1 Board Visual Emphasis
- Updated Today Board container to stand out with a brighter purple treatment.
- Board now has distinct purple background/border compared to chat card.

### 87.2 Cleaned Priority Titles from AI Path
- Priority titles shown on board now use AI-cleaned title generation path (not raw user text).
- Applied consistently to:
  - normal priority add,
  - refine edits,
  - correction draft + confirm flow.

### 87.3 Green Tick Interaction
- Added a dedicated green tick button on each priority card.
- Tick toggles priority done/pending quickly (pre-day completion checkoff behavior).

### 87.4 Tick Celebration Animation
- Added full-screen purple/green sparkle celebration when ticking a priority done.
- Visual language reuses reward-animation vibe (particle/grid bloom style).
- Duration set to 1.5 seconds as requested.

### 87.5 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 87.6 Verification
- `npm run build:web` passes.

## 88) Natural + Precise Conversation Copy Pass (Correction Flow)
Update date:
- February 23, 2026

### 88.1 Goal
- Make correction-handling language sound more natural while staying precise and succinct.

### 88.2 Copy Updates
- Replaced rigid phrases with shorter conversational alternatives around:
  - corrected-priority capture,
  - add-confirm prompt,
  - removal + resend guidance,
  - draft update confirmation,
  - "change it" continuation prompt.

### 88.3 Outcome
- Tone is friendlier and more human.
- Instructions remain explicit enough for zero confusion.

### 88.4 Files Updated
- `apps/web/src/App.tsx`

### 88.5 Verification
- `npm run build:web` passes.

## 89) Today Board Completion Check + Visibility/Style Corrections
Update date:
- February 23, 2026

### 89.1 Audit Result
- Requested Today Board features were partially implemented, but one key issue remained:
  - board was hidden on iPhone-sized viewport due prior mobile-fit rule.

### 89.2 Corrections Applied
- Today Board now visible on iPhone-sized screens (compact, scrollable card).
- Board visual emphasis increased with brighter purple background/border.
- Board list simplified to show cleaned priority titles only (removed extra `why` text from board lists).
- Green tick action styling strengthened so checkoff affordance is clearer.

### 89.3 Existing Requested Behaviors Confirmed
- Tick action triggers full-screen purple/green sparkle effect.
- Tick celebration duration remains 1.5 seconds.
- Cleaned-title path remains active for priority titles shown on board.

### 89.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 89.5 Verification
- `npm run build:web` passes.

## 90) Today Board Expanded View + Easy Close UX
Update date:
- February 23, 2026

### 90.1 Change
- Replaced small inline open state with a larger dedicated Today Board sheet when opened.
- Board now appears as a high-visibility overlay panel that is fully viewable.

### 90.2 Close UX
- Added explicit close control in header:
  - `⌄ Close board`
- Added tap-outside-to-close behavior on backdrop.
- Keeps a clear visual indication of how to exit board view.

### 90.3 Board Content
- Board sheet lists locked priorities clearly with:
  - numbered clean titles,
  - green tick interaction,
  - status indicator.

### 90.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 90.5 Verification
- `npm run build:web` passes.

## 91) Tickmark Style Simplification
Update date:
- February 23, 2026

### 91.1 Change
- Simplified done tick control visual style:
  - removed rounded-pill/curved look,
  - moved to cleaner square-ish check button,
  - reduced visual ornamentation.

### 91.2 Files Updated
- `apps/web/src/styles/app.css`

### 91.3 Verification
- `npm run build:web` passes.

## 92) Today Board Viral Actions Restored + Close Label Simplified
Update date:
- February 23, 2026

### 92.1 Viral Features in Today Board
- Restored viral/share action block inside Today Board sheet, positioned under priorities.
- Included actions:
  - `Nudge Squad`
  - `Share Lock Win`
  - `Share on Snapchat`
  - `Share on Instagram`

### 92.2 Close Control Copy
- Simplified close bubble label from `⌄ Close board` to `Close`.

### 92.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 92.4 Verification
- `npm run build:web` passes.

## 93) Today Board Entry Moved to Bottom Dock
Update date:
- February 23, 2026

### 93.1 UX Change
- Moved default Today Board entry point to the lower part of mission screen.
- Replaced prior inline trigger with a dedicated bottom dock card.

### 93.2 Label + Affordance
- Primary label now simply: `Today Board`.
- Added secondary cue text: `Tap to open priorities`.
- Entire dock card is tappable.

### 93.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 93.4 Verification
- `npm run build:web` passes.

## 94) Lock Day Visibility Rule
Update date:
- February 23, 2026

### 94.1 Change
- `Lock Day` button now renders only after at least one priority has been set.

### 94.2 File Updated
- `apps/web/src/App.tsx`

### 94.3 Verification
- `npm run build:web` passes.

## 95) Squad Pulse Visibility Scope (Only Inside Open Today Board)
Update date:
- February 23, 2026

### 95.1 Change
- Removed default visible Squad Pulse area from main Today Board panel.
- Squad Pulse actions/content now appear only inside the opened Today Board sheet.

### 95.2 Placement
- In Today Board sheet, Squad Pulse now lives directly under the priority list, with:
  - lock count text,
  - nudge/share actions.

### 95.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 95.4 Verification
- `npm run build:web` passes.

## 96) Today Board Dock UX Correction (Slim Bottom Strip)
Update date:
- February 23, 2026

### 96.1 Requested Behavior Implemented
- Today Board now appears as a slim section at the bottom of mission screen.
- Dock copy updated to:
  - `Today Board`
  - `See today's priorities · Tap to open`
- Dock is always visible in mission view (not gated behind lock state).

### 96.2 Open Behavior
- Tapping the slim strip opens the full Today Board sheet.
- Full sheet contains priorities and social features as requested.

### 96.3 Styling
- Reduced dock height/weight to read as a slim entry strip.
- Added sticky bottom placement and subtle gradient support so it remains discoverable.

### 96.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 96.5 Verification
- `npm run build:web` passes.

## 97) Removed Old Today Board Surface (Single Entry Flow)
Update date:
- February 23, 2026

### 97.1 Issue
- Both old Today Board panel and new bottom-strip entry were visible, creating duplicate experiences.

### 97.2 Fix
- Removed the old in-layout Today Board panel entirely.
- Kept only the slim bottom `Today Board` strip as the single entry point.
- Tapping strip opens the full Today Board sheet (priorities + social features).

### 97.3 Cleanup
- Removed unused old-board handlers/imports tied to deleted panel.
- Updated main layout grid to single-column chat-first structure.

### 97.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 97.5 Verification
- `npm run build:web` passes.

## 98) Tickmark Shape Update (Thick Rounded Check Style)
Update date:
- February 23, 2026

### 98.1 Change
- Replaced simple text check glyph with custom thick check shape.
- New check style is white, rounded, and set on bright green square background.
- Visual direction aligned to requested reference vibe.

### 98.2 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 98.3 Verification
- `npm run build:web` passes.

## 99) Tickmark Color Alignment to Logo Green
Update date:
- February 23, 2026

### 99.1 Change
- Updated tick button green to match logo green palette:
  - `#7DFF8A` -> `#1DBE5B`

### 99.2 File Updated
- `apps/web/src/styles/app.css`

### 99.3 Verification
- `npm run build:web` passes.

## 100) Today Board Label Consistency (Closed vs Open)
Update date:
- February 23, 2026

### 100.1 Change
- Closed Today Board strip now uses the same label styling as open sheet header:
  - text: `TODAY BOARD` (all caps),
  - matching font treatment,
  - matching color tone.

### 100.2 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 100.3 Verification
- `npm run build:web` passes.

## 101) Removed Main-Screen "Day Locked" Recap Section
Update date:
- February 23, 2026

### 101.1 Change
- Removed `Day Locked` recap block from mission main screen (under Time left / Charge).
- Priorities are now accessed via `TODAY BOARD` only, per requested flow.

### 101.2 Cleanup
- Removed now-unused recap state/summary logic tied to that section.

### 101.3 Files Updated
- `apps/web/src/App.tsx`

### 101.4 Verification
- `npm run build:web` passes.

## 102) Chat Succinctness Pass (Fewer Bubbles, Buttons Only When Needed)
Update date:
- February 23, 2026

### 102.1 Goal
- Reduce bubble count across key flows (set priority, lock day, corrections).
- Avoid separate text bubbles when one combined bubble can communicate clearly.
- Keep clickable buttons only where they materially advance user action.

### 102.2 Key Refinements
- First-priority confirmation now uses one interactive coach bubble (prompt + action buttons) instead of separate text + button-only bubbles.
- Multi-part follow-ups after adding priorities now merged into a single concise coach bubble.
- Correction draft flow now avoids duplicate assistant prompt bubbles (interactive confirm bubble is source of action).
- Removed extra synthetic user action bubbles for button taps (`Refine priority`, `Add next priority`, `Confirm add`, `Change it`).
- Lock day flow removed redundant synthetic user bubble (`Lock Day`).

### 102.3 Buttons Scope
- Kept buttons where needed:
  - first-priority action choice,
  - correction confirm/change,
  - yesterday review statuses,
  - priority tick actions.
- Removed non-essential button-adjacent chatter.

### 102.4 Files Updated
- `apps/web/src/App.tsx`

### 102.5 Verification
- `npm run build:web` passes.

## 103) Tick Interaction Refinement (Smaller Icon + Concentric 2s Burst)
Update date:
- February 23, 2026

### 103.1 Tick Size + Spacing
- Reduced tick button size by ~30% (`26px` -> `18px`).
- Added vertical spacing between priority title text and tick/status row in Today Board sheet.

### 103.2 Tick Celebration Animation Rework
- Replaced prior generic tick overlay with a concentric burst effect originating from the clicked tickmark.
- Added expanding rings + radial particle sparks in purple/green theme.
- Effect now runs for 2.0 seconds.

### 103.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 103.4 Verification
- `npm run build:web` passes.

## 104) Build Fix for Tick Burst Update
Update date:
- February 23, 2026

### 104.1 Fix
- Resolved TypeScript event-type shadowing caused by React `MouseEvent` import name collision with DOM `MouseEvent`.
- Aliased React event type to avoid conflict.

### 104.2 File Updated
- `apps/web/src/App.tsx`

### 104.3 Verification
- `npm run build:web` passes.

## 105) Main + Today Board UI Overhaul (Clarity + Alignment Pass)
Update date:
- February 24, 2026

### 105.1 Main Screen Layout Cleanup
- Grouped top accountability elements into a single `mission-meta` container for clearer hierarchy.
- Tightened spacing and reduced card noise for:
  - dollar alert panel,
  - timer/charge cards,
  - challenge section,
  - progress divider.
- Kept color scheme intact (purple/green core palette) while reducing visual clutter.

### 105.2 Chat Area Polish
- Refined chat card density (padding, bubble radius, row spacing) to improve readability.
- Preserved fixed vertical chat area with auto-scroll behavior.
- Kept composer controls visible and aligned with cleaner action grouping.

### 105.3 Today Board Refinement
- Increased Today Board sheet height ceiling and improved internal spacing for better visibility.
- Refined dock button typography/spacing to make the closed-state entry point clearer.
- Improved priority card treatment in board for stronger separation and readability.

### 105.4 Button Hierarchy (Action Clarity)
- Standardized button tiers:
  - `primary`: core action (`Add Priority`, `Nudge Squad`, platform share options in picker),
  - `secondary`: supporting action (`Lock Day`, `Share Lock Win`),
  - `tertiary`: low-priority but visible actions (social share shortcuts),
  - `ghost`: dismissive/minimal actions (`Cancel`, low-friction chips).
- Applied this hierarchy to chat action chips and Today Board social actions.

### 105.5 Priority Interaction Visual Cleanup
- Improved status-row spacing/alignment around tick + status chip.
- Kept the previously implemented smaller tickmark and 2s concentric celebration effect.

### 105.6 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 105.7 Verification
- `npm run build:web` passes.

## 106) Top Accountability Strip Cleanup + Progress Bar Removal
Update date:
- February 24, 2026

### 106.1 Removed Unneeded Priority Progress Bar
- Removed the horizontal priority-completion progress strip below the seven-day card.
- Removed unused related logic in app state (`useMemo` scoring/progress helpers no longer needed).

### 106.2 Top Area Visual Cleanup (No Charge / Time Left / Charge)
- Cleaned spacing rhythm so the first three cards read as one coherent block.
- Removed extra outlines on:
  - `No charge locked in` card,
  - `Time left` card,
  - `Charge` card.
- Kept soft background separation instead of bordered boxes.

### 106.3 Seven-Day Challenge Treatment
- Kept `Seven-day challenge` as the separate outlined card as requested.
- Tuned vertical spacing between the top block and challenge card for cleaner alignment.

### 106.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 106.5 Verification
- `npm run build:web` passes.

## 107) Four-Specialist UI Panel Redesign (Snap/Hoop-Inspired)
Update date:
- February 24, 2026

### 107.1 Panel Setup
Applied redesign decisions using a 4-specialist lens:
- Specialist 1 (`Visual Hierarchy`): Make top status block scannable in under 1 second.
- Specialist 2 (`Social App Clarity`): Use bold, rounded, high-contrast tiles similar to social-first apps.
- Specialist 3 (`Mobile Ergonomics`): Ensure typography and spacing still fit iPhone viewport constraints.
- Specialist 4 (`Interaction Signaling`): Keep urgency/safety states legible through compact status chips and color states.

### 107.2 Implemented Redesign
- Added a compact top meta row (`Daily pressure` + dynamic state chip: Open/Live/Urgent/Safe/Charged).
- Reworked alert card into a stronger hero panel:
  - larger title weight/size,
  - richer gradient surfaces,
  - stronger state-based color mapping.
- Upgraded Time/Charge tiles to social-style metric cards:
  - larger numeric emphasis,
  - uppercase micro-labels,
  - consistent heights and spacing.
- Kept seven-day challenge as the only separately outlined card and made it slightly more premium with stronger surface treatment.

### 107.3 Responsive Tuning
- Added mobile overrides for new typography in top cards (`fee-alert` + metric values) to avoid crowding.

### 107.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 107.5 Verification
- `npm run build:web` passes.

## 108) Rollback to Prior Top-Area Visual (Per Screenshot Match)
Update date:
- February 24, 2026

### 108.1 Request
- Revert the top accountability area to the earlier visual state shown in reference screenshot.

### 108.2 Changes Applied
- Removed the newly added top meta row (`Daily pressure` + state chip).
- Reverted `Dollar alert` card typography/sizing back to prior compact style.
- Reverted `Time left` and `Charge` cards back to prior compact typography and spacing.
- Reverted seven-day challenge card styling to the prior card treatment.
- Restored the thin progress strip below seven-day challenge (including mobile sizing).

### 108.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 108.4 Verification
- `npm run build:web` passes.

## 109) Hard Reset Pass: Top Accountability Block
Update date:
- February 24, 2026

### 109.1 Goal
- Resolve persistent visual merge issue between `Dollar alert` and `Time left / Charge` by rebuilding that area with strict separation.

### 109.2 Structural Reset
- Replaced top wrapper with a clean `top-stack` layout containing:
  - `fee-alert` card,
  - `summary` row (time/charge cards).
- Kept seven-day challenge as a separate section below.

### 109.3 Visual Reset
- Reintroduced explicit card borders and shadows on:
  - alert card,
  - time card,
  - charge card.
- Removed shared container treatment that made cards feel visually merged.
- Kept spacing uniform and explicit between cards.
- Added matching mobile (`.mission-app`) spacing for the new `top-stack`.

### 109.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 109.5 Verification
- `npm run build:web` passes.

## 110) Challenge Outline Consistency Fix
Update date:
- February 24, 2026

### 110.1 Issue
- Seven-day challenge border could still appear different in state variants (`danger`, `reward`), even after base style alignment.

### 110.2 Fix
- Locked seven-day challenge border color to match `Time left` / `Charge` cards in all states.
- Replaced state-specific border color changes with subtle inset glow only.
- Preserved existing pulse/reward behavior without changing core outline color.

### 110.3 Files Updated
- `apps/web/src/styles/app.css`

### 110.4 Verification
- `npm run build:web` passes.

## 111) Top Area Minimal Merge (One Clear Section)
Update date:
- February 24, 2026

### 111.1 Goal
- Reduce visual clutter by merging `Dollar alert`, `Time left`, and `Charge` into one compact section without losing clarity.

### 111.2 Implementation
- Replaced separate top boxes with one `accountability-strip` container.
- Kept hierarchy inside the strip:
  - line 1: core alert title + explanation,
  - line 2: inline metrics (`Time left`, `Charge`) with a simple divider.
- Preserved risk-state color behavior (`warning`, `urgent`, `late`, `safe`) on the strip, with metric-value color accents per state.

### 111.3 Mobile
- Added mobile-specific sizing for strip padding and metric text to keep readability on iPhone viewport sizes.

### 111.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 111.5 Verification
- `npm run build:web` passes.

## 112) Typography System Streamline (Size/Weight/Color Consistency)
Update date:
- February 24, 2026

### 112.1 Goal
- Reduce inconsistent font sizes, weights, and text color usage across the app.
- Align with consumer-app typography best practices: small set of reusable text tokens.

### 112.2 System Added
- Added a centralized typography token set in `:root`:
  - size scale: `--fs-xxs`, `--fs-xs`, `--fs-sm`, `--fs-md`, `--fs-lg`, `--fs-xl`
  - weight scale: `--fw-medium`, `--fw-semibold`, `--fw-bold`, `--fw-heavy`
  - text color tiers: `--text-primary`, `--text-secondary`, `--text-muted`
- Set base body typography (`font-size`, `line-height`) to establish consistent defaults.

### 112.3 Component Remapping
- Mapped major UI text surfaces to token scale:
  - account panel/header labels
  - eyebrow and title hierarchy
  - status pills and strip metrics
  - chat bubbles/timestamps/sender icons
  - dock labels and helper text
  - button text sizing/weight
  - muted helper copy
  - priority titles/descriptions
  - mobile mission overrides
- Removed ad-hoc numeric `font-size` and `font-weight` declarations in favor of tokenized values.

### 112.4 Files Updated
- `apps/web/src/styles/app.css`

### 112.5 Verification
- `npm run build:web` passes.

## 113) Layout Experiment: Move Seven-Day Challenge Below Chat
Update date:
- February 24, 2026

### 113.1 Goal
- Test a different information hierarchy by moving the seven-day challenge lower in the flow.

### 113.2 Change
- Moved the entire seven-day challenge card block from above chat to below the main chat section.
- Left existing behavior unchanged (progress value, danger state pulse, reward firework).

### 113.3 Files Updated
- `apps/web/src/App.tsx`

### 113.4 Verification
- `npm run build:web` passes.

## 114) Focused Typography Rework: Start Screen + Today Board
Update date:
- February 24, 2026

### 114.1 Scope
- Reworked typography specifically on:
  - Start screen
  - Today Board (dock + sheet)

### 114.2 Start Screen
- Tightened hierarchy and readability:
  - clearer eyebrow scale/weight,
  - stronger H1 rhythm (size + line-height + weight),
  - normalized helper copy (`.muted`) size and color,
  - consistent CTA/action button text sizing/weights.

### 114.3 Today Board
- Improved readability and consistency:
  - stronger sheet title hierarchy (`TODAY BOARD` eyebrow + heading),
  - clearer dock text scale (title + support line),
  - refined viral section heading/body sizing,
  - larger and cleaner priority title type for scanability.

### 114.4 Mobile
- Added/adjusted mobile typography overrides for start card and Today Board labels to preserve legibility on small viewports.

### 114.5 Files Updated
- `apps/web/src/styles/app.css`

### 114.6 Verification
- `npm run build:web` passes.

## 115) Today Board Typography Simplification (Minimal System)
Update date:
- February 24, 2026

### 115.1 Goal
- Reduce visual chaos in Today Board by limiting typography variance:
  - fewer font sizes,
  - fewer weights,
  - fewer text colors,
  - clear caps/no-caps rules.

### 115.2 Rules Applied
- Font family:
  - standardized Today Board surfaces to one family (`Outfit`).
- Weights:
  - reduced to two practical weights (`semibold` and `bold`) across board text.
- Colors:
  - primary text = `--text-primary`,
  - secondary/support text = `--text-secondary`.
  - removed extra purple-tinted text treatment in board helper copy.
- Caps:
  - section labels remain uppercase (`TODAY BOARD`),
  - content text remains normal case for readability.

### 115.3 Component Adjustments
- Sheet header title reduced to a cleaner, less aggressive size/weight.
- Dock label and support line normalized to a tighter hierarchy.
- Priority titles reduced to a single consistent headline size.
- Viral section typography aligned to the same size scale.
- Board-local status chips normalized in size/weight/color to reduce visual noise.

### 115.4 Mobile
- Kept the same simplified hierarchy on mobile with tighter size pair (`xs/xxs`) for dock text.

### 115.5 Files Updated
- `apps/web/src/styles/app.css`

### 115.6 Verification
- `npm run build:web` passes.

## 116) Post-Lock Chat Follow-Up (Coach Recap + Next-Morning Time Choice)
Update date:
- February 24, 2026

### 116.1 Goal
- After `Lock Day`, provide a clearer close-out in chat:
  - recap priorities in coach language,
  - remind user they can mark done in Today Board,
  - confirm next-morning check-in time and ask whether to keep or change it.

### 116.2 Implemented Behavior
- `Lock Day` now posts:
  1. existing lock confirmation,
  2. coach recap bubble that restates up to the first two locked priorities and mentions Today Board done-marking.
- Then renders a dedicated interactive bubble:
  - “I’ll check in tomorrow at [time]. Keep this time or change it for tomorrow?”
  - buttons:
    - `Keep time` -> confirms current ping time.
    - `Change time` -> prompts for new `HH:MM` and updates stored ping time.

### 116.3 Technical Notes
- Converted `lockDay` to async to allow coach-generated recap.
- Added new UI state: `postLockTimePromptOpen`.
- Ensured chat auto-scroll includes this new post-lock prompt state.
- Reset new state on mission start/sign-out flows.

### 116.4 Files Updated
- `apps/web/src/App.tsx`

### 116.5 Verification
- `npm run build:web` passes.

## 117) Seven-Day Challenge Relocation into Today Board
Update date:
- February 24, 2026

### 117.1 Goal
- Reduce distraction on the main mission screen by moving seven-day challenge into Today Board flow.

### 117.2 Changes
- Removed standalone seven-day challenge card from the main screen.
- Updated Today Board dock copy to:
  - `See today's priorities · Check your 7-day challenge · Tap to open`
- Added a new Today Board section under priorities:
  - compact challenge row (`7-day challenge` + `x/7 · Tap to open`)
  - tap-to-expand challenge details panel.
- Kept existing challenge logic and visuals in the expanded panel:
  - progress bar,
  - reward firework,
  - risk/reward status text.

### 117.3 Styling
- Added dedicated styles for:
  - `today-board-challenge`
  - `today-board-challenge-toggle`
  - expanded challenge card appearance inside Today Board.
- Added mobile adjustments for the new row and text scale.

### 117.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 117.5 Verification
- `npm run build:web` passes.

## 118) Dollar Alert State Color Update (Red While Running, Green When Locked)
Update date:
- February 24, 2026

### 118.1 Goal
- Reintroduce urgency tint in Dollar Alert:
  - slightly red while countdown is active,
  - red when charged,
  - green when priorities are set and day is locked.

### 118.2 Changes
- Updated `accountability-strip` base/running state to subtle red background + red accent border.
- Updated `warning` and `urgent` states to stronger red-family tones.
- Kept `late` (charged) state red.
- Kept `safe` (locked) state green.
- Updated metric value tint to subtle red during running states and green in safe state.

### 118.3 File Updated
- `apps/web/src/styles/app.css`

### 118.4 Verification
- `npm run build:web` passes.

## 119) Seven-Day Challenge Always Visible in Today Board
Update date:
- February 24, 2026

### 119.1 Request
- Keep seven-day challenge in Today Board but remove collapse/expand interaction.

### 119.2 Changes
- Removed tap-to-open challenge toggle row.
- Seven-day challenge card now renders permanently under locked priorities in Today Board.
- Retained challenge behavior:
  - progress bar,
  - reward animation,
  - streak risk/safe messaging.

### 119.3 Cleanup
- Removed now-unused collapse state and related toggle CSS selectors.

### 119.4 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 119.5 Verification
- `npm run build:web` passes.

## 120) Removed Vertical Separator Bar Above Chat
Update date:
- February 24, 2026

### 120.1 Request
- Remove large separation bar between Dollar Alert section and chat to save vertical space.

### 120.2 Changes
- Removed the mission-level `progress-wrap` separator element from layout.
- Removed now-unused progress helper logic in `App.tsx`.
- Removed associated CSS blocks (including mobile override).

### 120.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 120.4 Verification
- `npm run build:web` passes.

## 121) Lock Recap Priorities Rendered as Bullets in Chat
Update date:
- February 24, 2026

### 121.1 Request
- When coach repeats locked priorities in chat, present them as bullet points for easier scanning.

### 121.2 Changes
- Updated post-lock recap fallback message to render priorities as:
  - one bullet per line (`• ...`).
- Updated coach prompt to request bullet-list output (`•`) one per line.
- Enabled multi-line rendering in chat bubbles via `white-space: pre-line` on bubble text.

### 121.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 121.4 Verification
- `npm run build:web` passes.

## 122) Post-Lock Composer Simplification
Update date:
- February 24, 2026

### 122.1 Request
- After day is locked, remove:
  - text input box,
  - `Add Priority`,
  - `Lock Day`.
- Show only one action button: `Rework todays priorities`.

### 122.2 Changes
- Added locked-state composer mode:
  - renders only `Rework todays priorities`.
- Added `reworkTodaysPriorities()` handler:
  - unlocks mission for current day,
  - closes post-lock time prompt,
  - posts a short coach instruction to rework and lock again,
  - refocuses input.
- Kept existing composer behavior unchanged for unlocked state.

### 122.3 File Updated
- `apps/web/src/App.tsx`

### 122.4 Verification
- `npm run build:web` passes.

## 123) Fine Divider Lines Between Main Sections
Update date:
- February 24, 2026

### 123.1 Request
- Use the same fine separator style as Today Board internals to separate:
  - Dollar Alert block,
  - Chat block,
  - Today Board dock.

### 123.2 Changes
- Added reusable divider token: `--section-divider`.
- Added fine top divider line on mission `layout` section (between alert and chat).
- Added fine top divider line on `today-board-dock` (between chat and today board).
- Tuned spacing around both dividers (desktop + mobile) to preserve compactness.

### 123.3 File Updated
- `apps/web/src/styles/app.css`

### 123.4 Verification
- `npm run build:web` passes.

## 124) Revert Fine Divider Lines on Main Screen
Update date:
- February 24, 2026

### 124.1 Request
- Remove the newly added fine separator lines on the main screen.

### 124.2 Changes
- Removed main-screen divider token and divider borders introduced in previous pass.
- Restored original section spacing:
  - `layout` spacing reset,
  - `today-board-dock` top spacing reset,
  - corresponding mobile spacing reset.

### 124.3 File Updated
- `apps/web/src/styles/app.css`

### 124.4 Verification
- `npm run build:web` passes.

## 125) Missed-Window Charge Message Update (Challenge Callout)
Update date:
- February 24, 2026

### 125.1 Request
- When showing missed-window charge message, add concise copy that points user to 7-day challenge as the way to earn the dollar back.

### 125.2 Change
- Updated lock-day missed-window chat/system message to:
  - `Window missed. $1 charge triggered. Want it back? Finish the 7-day challenge.`

### 125.3 File Updated
- `apps/web/src/App.tsx`

### 125.4 Verification
- `npm run build:web` passes.

## 126) Test Bar: Simulate Missed 10-Minute Window
Update date:
- February 24, 2026

### 126.1 Request
- Add a test-bar control to simulate missing the 10-minute window.

### 126.2 Change
- Added `Simulate window missed` button in test mode controls.
- Button forces the mission into expired state by:
  - ensuring mission is unlocked,
  - setting timer to 0,
  - moving start time back by window duration.
- Posts a test-mode system line in chat for traceability.

### 126.3 File Updated
- `apps/web/src/App.tsx`

### 126.4 Verification
- `npm run build:web` passes.

## 127) Enforced Bullet-Per-Line Lock Recap
Update date:
- February 24, 2026

### 127.1 Request
- Ensure locked priorities in chat recap appear as bullets with each bullet on a new line.

### 127.2 Change
- Updated post-lock recap composition to deterministic format:
  - one lead-in line,
  - one bullet per line for each priority (`• ...`),
  - closing line about Today Board done-marking.
- AI output now only supplies optional lead-in sentence; bullet lines are always generated by app logic.

### 127.3 File Updated
- `apps/web/src/App.tsx`

### 127.4 Verification
- `npm run build:web` passes.

## 128) Keep/Change Time Chips Unified Styling
Update date:
- February 24, 2026

### 128.1 Request
- In chat time-choice prompt, avoid green-highlighted `Keep time`; make both chips use same neutral color style as `Change time`.

### 128.2 Change
- Updated `Keep time` button from `chip active` to `chip ghost`.
- `Keep time` and `Change time` now render with matching neutral styling.

### 128.3 File Updated
- `apps/web/src/App.tsx`

### 128.4 Verification
- `npm run build:web` passes.

## 129) Test Bar: Start Fresh as New User
Update date:
- February 24, 2026

### 129.1 Request
- Add a test button to reset app as if opened by a new user.

### 129.2 Change
- Added `Start fresh (new user)` button to test controls.
- Button behavior:
  - clears all local storage keys with prefix `painful-dollar-`,
  - reloads app to base route (`window.location.pathname`) to restart first-run flow.

### 129.3 File Updated
- `apps/web/src/App.tsx`

### 129.4 Verification
- `npm run build:web` passes.

## 130) Core Product Line Messaging Update
Update date:
- February 24, 2026

### 130.1 Requested Line
- `Pick daily goals. Make progress every day. Set them - or pay $1.`

### 130.2 Applied Copy Updates
- Start screen hero headline now uses the requested line (split across two lines for readability).
- Main accountability strip running-state message now uses the same line.
- Schedule step helper copy updated to concise variation:
  - `Set them in 10 minutes - or pay $1.`
- Primary start CTA updated to:
  - `Set today's goals`

### 130.3 File Updated
- `apps/web/src/App.tsx`

### 130.4 Verification
- `npm run build:web` passes.

## 131) Expiry Behavior Update: Auto Charge Message + Continue Planning
Update date:
- February 24, 2026

### 131.1 Request
- When timer hits zero, always send chat message that $1 was charged.
- User should still be able to set priorities for today after charge.

### 131.2 Changes
- Added automatic one-time chat notice at expiry:
  - `$1 charged. You can still set priorities for today.`
- Added session-level guard so this auto message is sent once per mission session.
- Re-enabled priority input/add flow after expiry:
  - removed `expired` gating from input/button disable logic,
  - removed `expired` early-return from add-priority path.
- Updated expired lock-day message to clarify:
  - charge already happened, but planning can continue.

### 131.3 File Updated
- `apps/web/src/App.tsx`

### 131.4 Verification
- `npm run build:web` passes.

## 132) Core Copy Refresh (Start + Dollar Alert)
Update date:
- February 24, 2026

### 132.1 Requested Core Copy
- Start page:
  - `Set daily goals.`
  - `Make progress every day.`
  - `No goals? That's $1.`
- Main page (under Dollar alert):
  - `Set daily goals. Make progress every day.`
  - `No goals? That's $1.`

### 132.2 Changes Applied
- Replaced start hero headline with requested 3-line copy (explicit line breaks).
- Replaced main running-state Dollar alert copy with requested 2-line variant.
- Added `white-space: pre-line` on Dollar alert detail text to preserve intended line breaks.

### 132.3 Files Updated
- `apps/web/src/App.tsx`
- `apps/web/src/styles/app.css`

### 132.4 Verification
- `npm run build:web` passes.

## 133) Terminology Update: Priorities -> Goals (User-Facing Copy)
Update date:
- February 24, 2026

### 133.1 Request
- Replace `priority/priorities` wording with `goal/goals` across the app experience.

### 133.2 Changes Applied
- Updated user-visible copy in mission/start/schedule/chat/today-board flows, including:
  - prompts and confirmations,
  - correction and refine wording,
  - lock recap labels,
  - dock and empty-state text,
  - account summary label,
  - CTA labels (`Add Goal`, `Rework todays goals`),
  - challenge risk text (`No goals today...`),
  - viral/share text references.
- Updated coach-cleanup prompt wording from `priority title` to `goal title`.
- Kept internal variable/type names unchanged for implementation stability.

### 133.3 File Updated
- `apps/web/src/App.tsx`

### 133.4 Verification
- `npm run build:web` passes.

## 134) Chat Action Chip Color Unification (No Green)
Update date:
- February 24, 2026

### 134.1 Request
- Ensure clickable chat bubbles/chips are all same color and not green.

### 134.2 Change
- Removed green styling from `.chip.active`.
- Set `.chip.active` to same neutral palette as non-green chip variant:
  - transparent background,
  - neutral blue-gray border,
  - light neutral text.

### 134.3 File Updated
- `apps/web/src/styles/app.css`

### 134.4 Verification
- `npm run build:web` passes.

## 135) Lock Recap De-Duplication (Bullets Only)
Update date:
- February 24, 2026

### 135.1 Request
- Avoid repeating goals in lock recap (inline sentence + bullets).
- Keep recap as:
  - fixed header line,
  - bullet list only,
  - Today Board reminder,
  - then existing time check-in prompt.

### 135.2 Change
- Removed AI-generated lead-in for lock recap.
- Set deterministic header:
  - `Locked goals for today:`
- Kept one bullet per goal on new lines.
- Cleaned reminder wording:
  - `You can come back to Today Board anytime and mark them done.`

### 135.3 File Updated
- `apps/web/src/App.tsx`

### 135.4 Verification
- `npm run build:web` passes.

## 136) Test Bar New-User Reset: Skip Password Gate
Update date:
- February 24, 2026

### 136.1 Request
- When using test-bar `Start fresh (new user)`, start at app start screen (not password screen).

### 136.2 Change
- Updated `resetAsNewUser()`:
  - still clears all `painful-dollar-*` local keys,
  - then re-sets access flag (`ACCESS_GRANTED_KEY=1`) so test reset lands on start experience directly.

### 136.3 File Updated
- `apps/web/src/App.tsx`

### 136.4 Verification
- `npm run build:web` passes.

## 137) Goals Terminology Follow-Up + Unlimited Goals Enforcement
Update date:
- February 24, 2026

### 137.1 Follow-Up Fixes
- Completed user-facing terminology cleanup in remaining visible spots:
  - removed leftover duplicate `priority` wording in yesterday-review prompt.
- Fixed malformed placeholder conditional introduced during copy swap:
  - `Enter corrected goal` now renders correctly.

### 137.2 Unlimited Goals
- Removed hard cap guard that blocked adding more than 3 goals.
- Lock recap now includes **all** goals (no `slice(0,2)` truncation).
- Account summary now shows total goals count without `/3` suffix.

### 137.3 File Updated
- `apps/web/src/App.tsx`

### 137.4 Verification
- `npm run build:web` passes.

## 138) iOS Accountability Payment Skeleton (Backend + Web Simulation Scope)
Update date:
- February 24, 2026

### 138.1 Confirmed Product Decisions Implemented
- Scope: `1b` (backend skeleton + web simulation support surface)
- Required goals default/minimum: `2`
- Late goals after deadline: do **not** count as successful day for charge avoidance
- Charge caps:
  - max charges per day: `1` (enforced via one charge-history entry per user/day)
  - max charges per month: number of days in that month
- Timezone policy: user local timezone (stored per user)
- Notifications policy in API behavior messaging: reminder + one neutral missed follow-up model
- Payment method model: Apple Pay only (via Stripe setup session semantics)
- Failed off-session charge: disable accountability immediately
- Charge history fields exposed: date/time, amount, reason, status, receipt link, provider charge id

### 138.2 Backend Domain/Type Additions
- Added accountability/payment types:
  - settings
  - daily goals reports
  - charge history
  - due-evaluation results
- Added due-charge domain engine with deterministic rules:
  - evaluate only at/after deadline in local timezone
  - goals-met waiver
  - daily duplicate prevention
  - monthly cap by days in month
  - payment readiness checks
  - charge failure path that disables accountability

### 138.3 New API Endpoints
- `GET /v1/accountability/settings`
- `PUT /v1/accountability/settings`
- `POST /v1/accountability/goals/report`
- `POST /v1/accountability/payment/setup-session`
- `POST /v1/accountability/payment/confirm`
- `DELETE /v1/accountability/payment-method`
- `POST /v1/accountability/charges/run-due`
- `GET /v1/accountability/charge-history`

### 138.4 Repository/Data Layer
- Added in-memory repos for:
  - accountability settings
  - daily goal reports
  - charge history
- Wired into app bootstrap and route dependencies.

### 138.5 Database Skeleton
- Added migration:
  - `004_accountability_schedule_and_offsession.sql`
- Introduces tables for:
  - `accountability_setting`
  - `daily_goal_report`
  - `offsession_charge_history`
- Includes constraints, unique keys, indexes, and update triggers.

### 138.6 Technical Hardening
- Added global Express `Request.user` typing via declaration merge.
- Updated auth middleware typing to standard Express request handler shape.
- Fixed strict TypeScript issues (`exactOptionalPropertyTypes`, token parsing edge cases, coach fallback indexing).
- Added optional Stripe env placeholders in server config:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`

### 138.7 Files Updated
- `apps/server/src/types/accountability.ts` (new)
- `apps/server/src/repo/interfaces.ts`
- `apps/server/src/repo/memory.ts`
- `apps/server/src/domain/accountability.ts` (new)
- `apps/server/src/http/routes.ts`
- `apps/server/src/http/app.ts`
- `apps/server/src/types/api.ts`
- `apps/server/src/middleware/auth.ts`
- `apps/server/src/security/hmacToken.ts`
- `apps/server/src/services/coach.ts`
- `apps/server/src/config.ts`
- `apps/server/db/migrations/004_accountability_schedule_and_offsession.sql` (new)
- `apps/server/README.md`

### 138.8 Verification
- `npm run build:server` passes.
- `npm run build:web` passes.

## 139) Charged-Day Lock Behavior Alignment (2026-02-24)

### 139.1 Goal
- If the $1 has already been charged (missed window), `Lock Day` should still behave like normal lock flow:
  - allow lock,
  - show same bullet recap of goals,
  - add a concise supportive line that $1 already charged but setting goals still helps.

### 139.2 UI/State Changes
- Added day-level charge state in web app:
  - `chargeAppliedForToday` tracks whether today's charge has already fired.
- Status/labels now stay consistent after lock:
  - charged day + locked still shows `$1` (not `$0`),
  - alert title becomes `$1 already charged.` when applicable,
  - account panel uses same charge truth source.

### 139.3 Lock Flow Update
- Removed early return that previously blocked locking when window expired.
- `lockDay()` now:
  - validates at least one goal,
  - locks regardless of charge status,
  - posts normal lock recap bubble with bullets,
  - includes a charged-day line when applicable:
    - "$1 already hit today, but locking your goals still helps your day."

### 139.4 Reset/Simulation Integrity
- `beginMission()` and `signOut()` reset `chargeAppliedForToday`.
- "Simulate window missed" marks charge as applied for deterministic testing.

### 139.5 Files Updated
- `apps/web/src/App.tsx`

## 140) Charged Copy Wording Update (2026-02-24)

### 140.1 Goal
- Standardize charged-state copy to:
  - "The painful dollar has been charged."

### 140.2 Changes
- Updated timer-expiry system bubble wording.
- Updated charged lock confirmation wording.
- Updated charged recap/support line in lock summary.
- Updated top alert title/message wording for charged states (live and locked).
- Updated simulated web-mode charged message to same phrase.

### 140.3 File Updated
- `apps/web/src/App.tsx`

## 141) Rally — End-to-End Tournament Playthrough & Bug Fixes (2026-02-26)

### 141.1 Goal
Play through a complete 6-player round-robin tournament end-to-end via the API (all 15 round-robin matches + 2 finals) and fix every bug discovered along the way.

### 141.2 Bugs Found & Fixed

**Bug 1: Tournament status badge always showed "LIVE"**
- The `cardStatusPill()` function in the tournament card had an early `if (live)` override that prevented "Finals" and "Completed" from ever displaying.
- Fix: Removed the `live` prop override; now switches on `t.status` to show the correct pill for each lifecycle state (Registration, Live, Finals, Completed).

**Bug 2: Multiple stale tournaments from repeated simulations**
- The debug `simulate-tournament` endpoint only marked the first existing SF County 3.5 tournament as completed. Repeated simulations left orphan tournaments.
- Fix: Iterate ALL tournaments matching county+band and fully delete them via `deps.tournaments.remove()`. Added `remove(id)` method to both `TournamentRepo` interface and `InMemoryTournamentRepo`.

**Bug 3: Match data shape mismatch between server and frontend**
- The `/tournaments/:id/matches` endpoint returned raw `Match` objects with `challengerId`/`opponentId`, but the frontend `TournamentMatch` interface expected `homePlayerId`/`awayPlayerId`, `round` number, and `result.score` as a formatted string.
- Fix: Added server-side transformation that maps field names, derives round numbers from the tournament's rounds structure, and formats set scores into display strings (e.g. "6-4, 7-5").

**Bug 4: Score submission perspective mismatch**
- The score entry UI captures `myGames`/`theirGames` but always mapped them to `aGames`/`bGames` (challenger's perspective). When the current player is the opponent (away), the games need to be swapped.
- Fix: Added `isHome` check in `handleTournamentScoreSubmit` — if the player is away, `myGames`→`bGames` and `theirGames`→`aGames` (and same for tiebreak points).

**Bug 5: Screen not scrolling — content hidden behind fixed nav**
- `.app` container had `min-height: 100dvh` which allowed it to grow beyond viewport, preventing `.screen` from scrolling with `overflow-y: auto`.
- Fix: Changed to `height: 100dvh` + `overflow: hidden` on `.app`, so `.screen` properly overflows and scrolls.

**Bug 6: Player name truncation in standings**
- Names like "T4-Dana [3.5]" were shortened to "T4-Dana [." because the shortening code took the first char of the bracket-prefixed word "[3.5]".
- Fix: Filter out bracket-prefixed parts (`p.startsWith("[")`) before applying name shortening logic.

**Bug 7: Debug endpoint doesn't reset player stats**
- Repeated simulations accumulated wins/losses/ELO from previous runs.
- Fix: Reset all 6 tournament test players' stats (rating, confidence, wins, losses) back to their seed values during simulation.

### 141.3 Tournament Engine Verification
Full lifecycle verified end-to-end:
1. `POST /v1/debug/simulate-tournament` → Creates 6-player tournament in "active" status with 15 matches across 5 rounds
2. Score reporting via `POST /v1/tournaments/:id/matches/:matchId/score` — first player reports → `awaiting_confirmation`, second player confirms → `confirmed` + ELO update
3. After all 15 round-robin matches confirmed, engine tick auto-transitions to "finals" and creates championship (#1 vs #2) + 3rd place (#3 vs #4) matches
4. After both finals confirmed, engine tick auto-transitions to "completed"
5. Final standings: Dana 6W-0L (rating 1159), Alex 4W-2L (1088), Faye 4W-2L (1028), Beth 2W-4L (997), Eli 1W-4L (917), Chris 0W-5L (911)

### 141.4 UI Verification
All tournament detail sections verified in the frontend:
- Standings table with correct names, W/L, sets differential, games differential
- "Your matches" section with per-round results and formatted scores
- Rounds section with all 5 expandable rounds showing pairings and scores
- Finals section showing Championship and 3rd Place with winners highlighted in green
- Tournament card status pill correctly displays lifecycle state

### 141.5 Files Updated
- `apps/tennis-server/src/http/routes.ts` — match data transformation, debug endpoint cleanup/reset
- `apps/tennis-server/src/repo/interfaces.ts` — added `remove()` to TournamentRepo
- `apps/tennis-server/src/repo/memory.ts` — implemented `remove()` on InMemoryTournamentRepo
- `apps/tennis-web/src/App.tsx` — status pill fix, score perspective fix, name truncation fix
- `apps/tennis-web/src/styles/main.css` — scroll fix (height + overflow)

## 142) Rally — Usability Overhaul: Tournament-First Navigation (2026-02-26)

### 142.1 Goal
Comprehensive usability assessment and overhaul focused on making tournament participation as easy as possible. Reduce clicks to core actions (enter score, view standings), add clear action prompts, and eliminate confusion in navigation labels.

### 142.2 Changes Implemented

**1. Dedicated "Tourneys" tab (6th nav button)**
- Added `"tournaments"` to Screen type union
- Created `IconTournaments` SVG (medal/cross icon, distinct from Home's trophy)
- Inserted between Home and Matches: Home | Tourneys | Matches | Players | Avail. | Me
- Active when on tournaments or tournament-detail screens
- Tournament detail "← Back" button now returns to Tourneys tab (not Home)

**2. "Action Needed" section on Tourneys screen**
- Scans all active tournament matches for the current player
- Shows cards for: matches needing score entry, matches needing confirmation
- Each card has tournament name, opponent, round number, and a prominent "Enter Score" or "Confirm Score" CTA
- Tapping navigates to tournament-detail with the score entry form pre-opened
- Reduces score entry from 4+ taps to 2 taps

**3. Tournament matches on Matches tab**
- Added "Tournament Matches" section at top of Matches tab
- Shows all tournament matches with opponent, tournament name, round, and status
- Active matches show "Enter score" / "Confirm score" / "Awaiting confirmation" pills
- Completed matches show "Won"/"Lost" with scores
- Challenge matches moved to a separate "Challenge matches" section below

**4. Tourneys tab badge**
- Computed `tourneyActionCount` — count of matches needing action
- Displayed as a red badge on the Tourneys tab (same style as Matches pending badge)

**5. Renamed "Schedule" → "Avail."**
- Tab label changed to accurately reflect that it manages availability slots, not a match schedule

**6. Fixed avatar initials for bracket names**
- `initials()` now filters out words starting with `[` before extracting first characters
- "T4-Dana [3.5]" → "TD" instead of "T["

**7. `displayName()` helper strips [3.5] suffix**
- Created helper: `name.replace(/\s*\[[\d.]+\]$/, "").trim()`
- Applied throughout: player list, header, standings, match names, score entry, match detail

**8. Level badge uses rating**
- Changed from `levelClass(p.level)` to `levelClass(levelLabel(p.rating).toLowerCase())`
- Ensures badge color matches the player's actual rating tier

**9. Tournament cards tap affordance**
- Added `cursor: pointer`, `:active { transform: scale(0.98) }` press feedback
- Added `›` chevron when card has navigation handler

**10. Rounds collapsed by default**
- Changed from `expandedRounds[round] !== false` to `expandedRounds[round] === true`
- Reduces visual noise on tournament detail; users tap to expand

**11. Auto-select winner from set scores**
- Set inputs moved above winner field
- When 2+ sets favor one side, winner auto-detected and displayed as green text
- Manual dropdown only shown as fallback when scores are ambiguous

**12. Score input empty placeholders**
- Changed `placeholder="0"` to `placeholder=""` on all set score inputs
- Prevents confusion with pre-filled zero scores

**13. Simplified Home pool CTA**
- Removed band breakdown and verbose messaging from tournament request success state
- Kept simple progress bar and clear count

### 142.3 New State & Data Loading
- `allMyTournamentMatches` — flattened list of the player's matches across all active tournaments
- `allTournamentPlayerNames` — merged player name map across all tournaments
- `loadAllMyTournamentMatches()` — fetches tournament list + matches for each active tournament the player is in
- Loaded when navigating to Tournaments or Matches screens

### 142.4 Files Updated
- `apps/tennis-web/src/App.tsx` — all 13 changes (Screen type, icon, nav, screens, helpers, score entry)
- `apps/tennis-web/src/styles/main.css` — tournament card tap affordance, action-needed card border

## 143) Rally — Rich Seeding & Auto-Scheduling (2026-02-26)

### 143.1 Goal
Enable realistic testing with 200 players and 10 tournaments across 10 Irish counties, and automatically schedule all tournament matches when the tournament activates — eliminating manual scheduling where player availability overlaps.

### 143.2 Rich Seed Data

**New file: `apps/tennis-server/src/http/seedRich.ts`**
- `seedRichData()` creates 200 players (20 per county) across 10 Irish counties: Dublin, Cork, Galway, Limerick, Waterford, Kilkenny, Wexford, Kerry, Clare, Tipperary
- Each player: intermediate level, NTRP 3.5, rating 950-1150, 5-7 one-hour availability slots
- 5 availability patterns cycle across players: morning person, evening player, weekend warrior, lunch+evening, flexible
- 10 tournaments created (one per county), status "registration", 7 of 20 county players pre-registered
- User joining as 8th player triggers activation
- Endpoint: `POST /v1/debug/seed-rich` (no auth required)
- Frontend "Seed Rich Data" button added to test bar

### 143.3 Auto-Scheduling Algorithm

**New file: `apps/tennis-server/src/services/autoScheduler.ts`**
- `autoScheduleTournament(matches, playerAvailability, fromDate)` → `{ result: SchedulingResult, updatedMatches: Match[] }`
- Greedy round-by-round algorithm:
  1. For each match, call `findOverlaps(slotsA, slotsB, fromDate)` to find 2-hour windows in next 14 days
  2. Filter out dates already booked for either player (max 1 match/day per player)
  3. Pick first available window, create auto-accepted TimeProposal, set match status to "scheduled"
  4. Matches with no overlapping availability left as "pending" (failed)
- Returns `SchedulingResult { scheduledCount, failedCount, failedMatchIds }`

### 143.4 Engine Integration

**`apps/tennis-server/src/services/tournamentEngine.ts`**
- Added `availability: AvailabilityRepo` to `EngineDeps` interface
- After `activateTournament()` creates round-robin matches, it loads all player availability and calls `autoScheduleTournament()`
- Saves updated matches with scheduling info and stores `schedulingResult` on tournament
- New public method: `activateTournamentIfReady(tournamentId)` — called synchronously from join endpoint

**`apps/tennis-server/src/services/scheduler.ts`**
- Exported `findOverlaps()` and `formatProposalLabel()` (previously private) for reuse by auto-scheduler

### 143.5 Synchronous Activation on Join

**`apps/tennis-server/src/http/app.ts`**
- Engine created before routes, passed as dependency: `createRoutes({ ...deps, engine })`

**`apps/tennis-server/src/http/routes.ts`**
- Added `engine: TournamentEngine` to `RouteDeps`
- Join endpoint (`POST /tournaments/:id/join`) calls `engine.activateTournamentIfReady()` after adding player
- If activated, response includes `{ activated: true, schedulingResult: {...} }`
- New endpoint: `GET /v1/matches/:id/scheduling-options` — returns overlap windows for two players in a match
- New endpoint: `POST /v1/matches/:id/schedule` — manually schedules a match with chosen datetime

### 143.6 Core Type Updates

**`packages/tennis-core/src/types.ts`**
- Added `SchedulingResult` interface (exported)
- Added `schedulingResult?: SchedulingResult` to `Tournament` interface

### 143.7 Frontend Changes

**`apps/tennis-web/src/App.tsx`**
- Updated `TournamentMatch` interface: added `proposals`, `scheduledAt` fields
- Updated `Tournament` interface: added `schedulingResult` field
- Added scheduling modal state: `schedulingModalMatchId`, `schedulingOptions`, `schedulingOpponentName`, `schedulingLoading`
- `openSchedulingModal(matchId)` — fetches `/matches/:id/scheduling-options` and opens modal
- `acceptSchedulingOption(matchId, option)` — calls `POST /matches/:id/schedule` and refreshes data
- `toggleTournament` — handles activation response with alert showing scheduling results
- `tourneyActionMatches` — now differentiates: pending (needs scheduling), scheduled (needs score), has pendingResult (needs confirmation)
- Tourneys screen Action Needed cards: "Schedule" button for unscheduled, "Enter Score" for scheduled, "Confirm Score" for pending confirmation
- Matches tab: same differentiation with "Schedule match" / "Enter score" pills
- Tournament detail: scheduling result banner (green "All X scheduled!" or amber "X of Y scheduled — Z need manual scheduling")
- Tournament detail Your Matches: shows scheduled datetime, "Schedule" button for unscheduled matches, "Enter Score" for scheduled
- Scheduling modal: overlay with time slot buttons, loading state, no-overlap fallback message
- "Seed Rich Data" button in test bar

**`apps/tennis-web/src/styles/main.css`**
- Modal overlay styles (`.modal-overlay`, `.modal-content`, `.modal-header`, `.modal-close`)
- Scheduling option button styles (`.scheduling-option-btn`) with hover/active states

### 143.8 Files Created/Modified

| File | Change |
|------|--------|
| `packages/tennis-core/src/types.ts` | Added `SchedulingResult` interface, `schedulingResult` on `Tournament` |
| `apps/tennis-server/src/services/scheduler.ts` | Exported `findOverlaps`, `formatProposalLabel` |
| `apps/tennis-server/src/services/autoScheduler.ts` | **NEW** — greedy auto-scheduling algorithm |
| `apps/tennis-server/src/services/tournamentEngine.ts` | Added `availability` dep, auto-scheduling in `activateTournament`, `activateTournamentIfReady` |
| `apps/tennis-server/src/http/seedRich.ts` | **NEW** — 200 players + 10 tournaments seed |
| `apps/tennis-server/src/http/app.ts` | Engine created before routes, passed to `createRoutes` |
| `apps/tennis-server/src/http/routes.ts` | Engine dep, seed-rich endpoint, scheduling-options endpoint, schedule endpoint, updated join |
| `apps/tennis-web/src/App.tsx` | Scheduling UI, modal, Seed Rich button, action differentiation |
| `apps/tennis-web/src/styles/main.css` | Modal and scheduling option styles |

### 142.5 Visual Verification
All items verified in browser preview:
1. ✅ Bottom nav: 6 tabs (Home, Tourneys, Matches, Players, Avail., Me)
2. ✅ Tourneys tab: "Action Needed" cards with Enter Score CTAs, "My Tournaments" section
3. ✅ Badge: "5" on Tourneys tab for unplayed matches
4. ✅ Score entry: 2-tap flow from Tourneys → Enter Score on tournament detail
5. ✅ Matches tab: Tournament matches section with status pills
6. ✅ Players tab: Clean names "T1-Alex" (no "[3.5]"), initials "T" (not "T[")
7. ✅ Level badges: Correct colors matching ratings
8. ✅ Rounds: Collapsed by default with ▸ expand arrows
9. ✅ Auto-winner: Entering 6-3, 6-4 → "Winner: T4-Dana (you)" in green
10. ✅ Back button: Returns to Tourneys tab from tournament detail
