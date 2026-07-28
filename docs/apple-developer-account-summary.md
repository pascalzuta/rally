# Apple Developer Account & iOS Setup — Complete Summary

Everything we know about the Apple developer setup from the Rally project, in one place. Use this as the reference when bringing a **new app** live.

---

## 1. The Apple Developer account

| Item | Value |
|---|---|
| **Team ID** | `RTNLY3UZSV` |
| Developer portal | https://developer.apple.com/account |
| App Store Connect | https://appstoreconnect.apple.com |
| Xcode sign-in | Xcode → Settings → Accounts (already logged in with this account) |

The account is fully active — Rally already ships through it (device builds, TestFlight, push notifications, Sign in with Apple).

## 2. What's already registered for Rally (the existing app)

| Item | Value |
|---|---|
| App name (App Store) | Rally |
| Bundle ID | `com.playrally.app` (explicit App ID, registered in the portal) |
| SKU | `rally-001` |
| Marketing version / build | 1.0 (build 3) |
| Deployment target | iOS 15.0 |
| Signing | Automatic signing, team `RTNLY3UZSV` |
| Capabilities on the App ID | Push Notifications, Associated Domains, Sign in with Apple |
| Associated domains | `applinks:play-rally.com`, `www.`, `staging.` |
| OAuth URL schemes | `com.playrally.app://auth/callback` (Supabase) + Google reversed client ID `com.googleusercontent.apps.83968558734-slm88eb8v7hk1r03qv69k7sbacccg6du` |
| APNs environment | `development` in `App.entitlements` (must flip to `production` for App Store builds) |

## 3. APNs (push notifications) — account-level asset

- An **APNs Auth Key (.p8)** was created in the portal (Keys section). Key point: **APNs keys are account-wide, not app-specific — one key serves ALL apps on the team.** A new app reuses the existing key; do not create another one.
- The .p8 file can only be downloaded **once** from Apple. The contents live on the tennis-server as env vars:
  - `APNS_KEY_ID` (10-char key ID)
  - `APNS_TEAM_ID=RTNLY3UZSV`
  - `APNS_KEY_BASE64` (base64 of the .p8 contents)
  - `APNS_ENVIRONMENT` (`development` for dev builds, `production` for TestFlight/App Store)
- Rally's push server is a direct APNs HTTP/2 service (no Firebase), in `apps/tennis-server`. Device tokens live in the Supabase `device_tokens` table.

## 4. How Rally builds & ships iOS (the working pipeline)

- Stack: **Capacitor 7.x** wrapping the React web app. **Never upgrade to Capacitor 8.x** — known Swift PM incompatibility breaks Xcode builds. All `@capacitor/*` deps pinned with `~7.` ranges.
- Two commands, run from whichever workspace has the code you want:
  - `npm run ios:test` — build web → `cap sync ios` → opens Xcode → hit Play → app on iPhone.
  - `npm run ios:ship` — same, then Archive → Organizer → Distribute → Upload to App Store Connect → TestFlight (~15 min to testers).
- First-ever TestFlight build goes through **Beta App Review** (~24 hr, one time). Subsequent builds skip review and reach testers in ~15 min. TestFlight builds expire after 90 days.
- Going live: App Store Connect → App Store tab → select a TestFlight build → fill metadata → submit → Apple review (~24 hr typical).
- Xcode project is checked into git (`apps/play-tennis/ios/App/App.xcodeproj`); `.native-app` CSS class is injected when `CAPACITOR_BUILD=1`.

## 5. Checklist for bringing a NEW app live

### Reuse as-is (nothing to do)
- ✅ Apple Developer account + Team ID `RTNLY3UZSV`
- ✅ Xcode signed in to the account
- ✅ APNs .p8 key (if the new app needs push) — same key, just point the new app's server config at it with the new bundle ID
- ✅ The known-good process above (Capacitor 7.x pattern, ship scripts as a template)

### Must create fresh, per app
1. **Bundle ID** — portal → Identifiers → new explicit App ID (e.g. `com.yourname.newapp`), enabling only the capabilities the app needs (Push, Associated Domains, Sign in with Apple, etc.).
2. **App Store Connect app record** — My Apps → + → New App: name (30 chars max, must be unique on the App Store), primary language, select the new bundle ID, unique SKU, Full Access.
3. **Provisioning profile** — automatic: in Xcode, Signing & Capabilities → "Automatically manage signing" + team `RTNLY3UZSV`; Xcode creates it.
4. **TestFlight Test Information** — beta description, feedback email, **privacy policy URL** (required; a one-liner page satisfies Apple), "What to Test" notes.
5. **External tester group** — TestFlight → External Testing → new group → add emails or toggle on a public invite link.
6. **App Store metadata** (when going live) — long description (4000 chars), keywords (100 chars), support URL, **6.7" iPhone screenshots** (required), 1024×1024 app icon, age-rating questionnaire, app-privacy questionnaire (declare what you collect).
7. **If the app uses push**: new entitlements file with `aps-environment` (`development` → `production` at ship time), and register the new bundle ID with your push server.
8. **If the app uses OAuth/deep links**: register its custom URL scheme in Info.plist and, for universal links, host `apple-app-site-association` at the domain with `RTNLY3UZSV.<new-bundle-id>`.

### Timeline expectations
- Form-filling for a new app record: ~30 min.
- First TestFlight build: ~15 min processing + ~24 hr one-time Beta App Review.
- App Store review: ~24 hr typical.

## 6. Gotchas learned the hard way

- **Never build from `/tmp/rally-bugfix`** (archived stale checkout that caused weeks of wrong builds). Always build from the current workspace.
- **Capacitor stays on 7.x** — 8.x archive failures look like missing `call.reject()` APIs.
- **"No matching provisioning profile"** → Signing & Capabilities → automatic signing + team `RTNLY3UZSV`.
- **Push doesn't work in the Simulator** — physical device only.
- **The .p8 APNs key downloads once** — if it's ever lost, revoke and create a new key, then update server env vars.
- **One Xcode window at a time** — quit Xcode before opening a different workspace's project.
- Before an App Store (not TestFlight-dev) build: flip `aps-environment` and `APNS_ENVIRONMENT` to `production`.

## 7. Related docs in this repo

- `docs/ios-app-store-setup.md` — step-by-step App Store Connect first-time setup
- `apps/play-tennis/docs/ios-setup-guide.md` — portal setup: bundle ID, APNs key, server env vars
- `apps/play-tennis/docs/ios-auth-handoff.md` — Sign in with Apple + native Google OAuth setup
- `CLAUDE.md` → "Native iOS Build (Capacitor)" — the deploy mental model and rules
