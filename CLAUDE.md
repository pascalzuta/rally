# Rally - Play Tennis

## Project Overview
Tennis tournament app for local communities. Players join by county, form lobbies, and auto-create tournaments when 6+ players join.

## Tech Stack
- React 18 + TypeScript + Vite
- Supabase (Realtime Database for multi-user sync)
- Vercel (staging + production deploys — automatic per branch)
- DNS (Namecheap): A 76.76.21.21, CNAME www → cname.vercel-dns.com, CNAME staging → cname.vercel-dns.com

## Deployment & Branch Rules (READ THIS FIRST)

There are two environments. Both share the same Supabase database. Both deploy via Vercel automatically on push.

| Environment | URL | Branch | Deploys via |
|-------------|-----|--------|-------------|
| **Staging** | staging.play-rally.com | `staging` | Vercel (automatic on push) |
| **Production** | play-rally.com | `main` | Vercel (automatic on push) |

Note: `rally-play-tennis.vercel.app` is Vercel's auto-generated domain — it points to **production** (`main`), not staging. Always use `staging.play-rally.com` for staging.

### How to deploy to staging (step by step)

**Do NOT create pull requests.** This is a solo project — deploy by direct merge + push.

**NEVER run `npm run dev` as a substitute for deploying.** The user cannot access local dev servers. "Deploy" always means merge to `staging` and push so the change is live at staging.play-rally.com. When the user says "deploy", "ship it", "make it live", or asks to see their changes — always deploy to staging via the steps below.

1. **Create a feature branch** off `staging` (not `main`)
2. **Do your work** on the feature branch, commit and push
3. **When the user says "deploy to staging"** (or any variant like "deploy", "ship it", "make it live"): checkout `staging`, merge the feature branch, push
   ```bash
   git checkout staging
   git merge <feature-branch> --no-edit
   git push origin staging
   ```
4. Vercel auto-deploys to staging.play-rally.com
5. **Verify the deploy succeeded** before telling the user it's live (check Vercel or load the URL)
6. **Stop here.** Do NOT touch `main`.

### How to deploy to production

7. **Only when the user explicitly says "deploy to live/production"**: merge `staging` into `main` and push
   ```bash
   git checkout main
   git merge staging --no-edit
   git push origin main
   ```
8. Vercel auto-deploys to play-rally.com

### Rules

- **NEVER push or merge to `main` unless the user explicitly says to deploy to live.** This is the #1 rule. `main` is production and updates play-rally.com immediately. There are no exceptions.
- **NEVER create pull requests.** Always merge directly. PRs require GitHub token permissions that may not be available in all environments (e.g. Conductor workspaces).
- **Always branch from `staging`**, not from `main`.
- **After merging to `staging`**, always push so Vercel picks it up.
- **After pushing to staging**, check the Vercel deployments page to confirm the build succeeded before telling the user it's live. Do not assume the deploy worked.
- **Do not ask the user whether to deploy to production.** Just deploy to staging and let them decide.
- **Never commit `package-lock.json` changes from a different branch.** If you stash/cherry-pick across branches, always exclude the lock file and run `npm install` on the target branch instead.
- If you cannot push (e.g. auth error), tell the user and stop. Do not force-push or use workarounds.
- **Worktree conflicts**: If `git checkout staging` fails because the branch is checked out in another Conductor workspace (worktree), create a temporary branch from `origin/staging`, merge into it, then `git push origin temp-branch:staging`.
- **CLAUDE.md is the source of truth for agent behavior.** If you update it, commit and merge to `staging` promptly so all workspaces pick up the changes.

## Monorepo Structure
This is a monorepo with `apps/*` and `packages/*` workspaces. Only Rally Tennis code lives here — all legacy apps (grp, cms, daily-priorities) were removed.

| Directory | Package | Purpose |
|-----------|---------|---------|
| `apps/play-tennis/` | `@play-tennis/web` | Rally Tennis web app (React 18 + Vite) |
| `apps/tennis-server/` | `@rally/server` | Rally backend (Express, port 8788) |
| `packages/tennis-core/` | `@rally/core` | Shared types, schemas, utilities |

### Key Files
- `apps/play-tennis/src/store.ts` — All game state (localStorage + Supabase sync)
- `apps/play-tennis/src/sync.ts` — Bi-directional Supabase sync layer
- `apps/play-tennis/src/supabase.ts` — Supabase client (hardcoded config, project ref: gxiflulfgqahlvdirecz)
- Data flows: localStorage (fast local cache) ↔ Supabase (shared persistence)

## UI Structure
- **Bottom tabs**: Home, Bracket, Play Now, Availability (renamed from Profile)
- **Top nav icons**: Messages, Notifications, Trophy (opens Rating panel)
- `App.tsx` → `BracketTab` is the main tournament view (NOT `TournamentView.tsx`)
- `BracketTab` renders `ScheduleSummary` as the default "aha moment" view for round-robin tournaments
- `TournamentView.tsx` exists but is a secondary/legacy code path — changes there may not be visible on the live site
- `Profile.tsx` — The Availability tab: player profile, tennis profile, availability editor
- `RatingPanel.tsx` — Trophy overlay: Rally Rating, record, trophies, rating chart, match history

## Supabase Project
- Name: rally-tennis
- Region: us-west-2
- Tables: lobby, tournaments, ratings (all with RLS open + Realtime enabled)
- Dashboard: https://supabase.com/dashboard/project/gxiflulfgqahlvdirecz

## Registration Flow
1. Onboarding screens (3 screens: problem, solution, motivation)
2. Signup form (first name, last name, county)
3. Skill level & gender selection ("About your game" step)
4. Availability picker (quick slots or detailed custom times)
5. Confirmation screen → auto-navigates to Home tab

## Important Patterns
- **Post-registration**: New players must land on Home tab (not Profile). `handleRegistered` sets `activeTab('home')`.
- **Lobby sync listener**: Lobby component listens for `SYNC_EVENT` (`rally-sync-update`) to stay in sync with Supabase realtime updates. Without this, the counter can go stale.
- **DevTools seeding**: `seedLobby()` syncs seeded players to Supabase (not just localStorage). This prevents seeded players from disappearing when remote refresh fires.
- **No availability gate on lobby join**: Registration already makes availability mandatory. Do not add a second availability check in `joinLobby()` — it blocks re-joining after registration.

## Scheduling & Grouping System
Full briefing: `apps/play-tennis/docs/scheduling-briefing.md` (18 sections)

### Core Concept
- **Availability-clustered grouping**: Players grouped by shared 2-hour windows (min 3 overlap), not random
- **Bulk auto-scheduler**: Assigns all round-robin match times in one pass at tournament creation
- **Three scheduling tiers**: `auto` (confirmed), `needs-accept` (proposed), `needs-negotiation` (unscheduled)
- Tier data already set by `bulkScheduleMatches()` in `bulkScheduler.ts` — UI needs to read it

### Key Files
- `apps/play-tennis/src/clustering.ts` — `clusterPlayersByAvailability()` groups players by overlap
- `apps/play-tennis/src/bulkScheduler.ts` — `bulkScheduleMatches()` assigns times, sets scheduling tiers
- `apps/play-tennis/src/tennis-core.ts` — `generateRoundRobin()` creates all match pairings

### Architecture Decisions
- **Client-side scheduling**: Clustering is O(N²), sub-1ms for N<200. Bulk scheduling sub-5ms for 15 matches.
- **localStorage-first writes**: Same pattern as lobby fix — write local, then sync to Supabase
- **Availability sync gap**: Availability currently stored in localStorage only (`syncAvailability()` is a no-op). Must be synced to Supabase for multi-device scheduling. New `availability` table required.
- **Tournament lifecycle**: `setup` → `scheduling` (new) → `in-progress` → `completed`

### Design System (Polymarket Indoor-Inspired)
- Data-forward: numbers and status as primary visual elements
- Monospace tabular-nums for all counts, percentages, timers
- Color-coded left borders: green (auto/confirmed), blue (needs-accept), orange (needs-negotiation)
- Card style: `var(--color-surface)`, `var(--radius-md)`, `var(--shadow-sm)`, no visible border except status
- Full UI standards: `apps/play-tennis/docs/design-guidelines.md`

### Implementation Priority
1. **P0**: Availability sync to Supabase (unblocks everything)
2. **P0**: "Aha moment" screen — schedule summary showing "12 of 15 matches auto-scheduled"
3. **P1**: Scheduling tier badges on match cards
4. **P1**: Calendar/agenda view for scheduled matches
5. **P2**: Weekly cap preference, waitlist experience

## Pending Tasks
- Test multi-user sync end-to-end with real users
- Implement availability sync to Supabase (PR 1 — critical path)
- Build scheduling tier UI and "aha moment" screen (PR 2)

## Development
```bash
npm run dev:play-tennis     # Local dev server (port 5180) — for debugging only, NOT for deploying
npm run build:play-tennis   # TypeScript check + Vite build (used by pre-push hook)
npm run dev:tennis-server   # Backend on port 8788
```
**Note:** `npm run dev` is only useful for local debugging during development. The user works through Conductor and cannot access local dev servers. To show the user changes, always deploy to staging (merge to `staging` branch + push).

## Native iOS Build (Capacitor)

### iOS deployment — READ THIS FIRST

**The iOS app is the primary product.** Rally's mental model for deploys:

| Environment | Web | iOS |
|---|---|---|
| Dev / personal testing | `npm run dev:play-tennis` (localhost — rarely used) | `npm run ios:test` — builds + opens Xcode → user hits Play → app on their iPhone |
| Staging (testers) | staging.play-rally.com (auto-deploy on push to `staging`) | `npm run ios:ship` — builds + archives + uploads to App Store Connect → TestFlight distributes to testers within ~15 min |
| Live (public) | play-rally.com (auto-deploy on push to `main`) | Promote current TestFlight build in App Store Connect → Apple reviews → App Store |

### The two commands (work from any Conductor workspace)

```bash
npm run ios:test    # Dev build on user's iPhone (personal testing)
npm run ios:ship    # Upload to TestFlight + App Store Connect (staging for iOS)
```

**Both commands build from the current workspace's branch.** That's the whole point — if the user is in the `pascalzuta/smart-notifications` workspace and says "deploy to my phone," the notifications code is what lands on their phone.

### CRITICAL RULES

1. **NEVER use `/tmp/rally-bugfix`** — that directory was a temporary workaround from April 13 that got stuck and caused 2+ weeks of stale iOS builds (push notifications, OAuth bridge, tab bar fixes all failed to appear on device because Xcode was building from there). It's been archived as `/tmp/rally-bugfix-archived-2026-04-16`. Do not build from it. Do not pull from it. If you find yourself told to use it, stop and tell the user.

2. **Build from the Conductor workspace the user is currently in.** Every workspace has its own full iOS project (checked into git) and its own node_modules. The `ios:test` / `ios:ship` scripts resolve paths from their own location, so they always build from the workspace they live in.

3. **Capacitor must stay on 7.x.** Capacitor 8.x has a known Swift PM incompatibility — `capacitor-swift-pm` 8.x removed APIs (`call.reject()`, etc.) that the 8.x plugins still use, causing Xcode build failures. All `@capacitor/*` packages are pinned to 7.x with `~` (tilde) ranges. Never upgrade to 8.x.

4. **Xcode can only show one workspace at a time.** If the user opens a different Conductor workspace and runs `ios:test`/`ios:ship`, they should quit Xcode first (or close the old project window). The scripts open Xcode on the current workspace's project — two Xcode windows on different projects is confusing and a recipe for building the wrong branch.

### What each command does

**`npm run ios:test`** (in `scripts/ios-test.sh`):
1. Resolves the current monorepo root from the script's location
2. `npm install` if node_modules missing
3. `CAPACITOR_BUILD=1 npm run build:play-tennis` (builds web with `.native-app` CSS class injected)
4. `npx cap sync ios` (copies `dist/` into iOS project)
5. Opens `apps/play-tennis/ios/App/App.xcodeproj`
6. Prints next-step instructions for Xcode

**`npm run ios:ship`** (in `scripts/ios-ship.sh`):
1. Same as `ios:test` through step 5
2. Prints Xcode distribution steps: "Any iOS Device" → Product → Archive → Organizer → Distribute → Upload to App Store Connect

### First-time App Store Connect setup (one-time, user does this)
See `docs/ios-app-store-setup.md` for the step-by-step checklist.

### OAuth redirect (custom URL scheme)
- The iOS app uses `com.playrally.app://auth/callback` for Google OAuth redirect
- Registered in `Info.plist` as `CFBundleURLTypes` and in Supabase redirect URLs
- The `appUrlOpen` listener in `native/init.ts` handles the callback

### Native-only CSS
Use `.native-app` class on `<html>` (injected at build time by `vite.config.ts` when `CAPACITOR_BUILD=1`). **Never change web styles to fix app-only layout issues** — scope everything to `.native-app`.

## Git Hooks
- **pre-commit**: Runs `tsc --noEmit` on play-tennis (type check only, no build)
- **pre-push**: Runs full `build:play-tennis` (ensures deployable code)

## Branch Strategy
See "Deployment & Branch Rules" above — that section is the single source of truth for branching and deployment.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
