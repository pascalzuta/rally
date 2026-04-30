# iOS Native Auth + Notifications — Morning Handoff

This is a wrap-up of the work done overnight on **claude/reverent-lewin-b205b8**. The goal was: get Rally back on your phone with Google sign-in that **never opens a browser**, plus push notifications wired end-to-end.

## What got fixed

The previous iOS attempt (the "trap") used `Browser.open()` with SFSafariViewController for Google sign-in. That's why it always kicked you to the browser — Supabase's `signInWithOAuth` requires a browser-based redirect, no matter how you wrap it. The fix is to skip Supabase OAuth entirely on iOS and use the native Google Sign-In SDK (and Apple's `ASAuthorizationController`) to get an ID token directly, then exchange it via `supabase.auth.signInWithIdToken()`. Zero browser. Zero universal-link round-trips.

## What was changed in code

- **New plugin**: `@capgo/capacitor-social-login@7.20.0` (Google + Apple in one package, Capacitor 7 compatible)
- **New file**: [`src/native/social-auth.ts`](apps/play-tennis/src/native/social-auth.ts) — wraps the plugin, handles nonce generation, exchanges tokens with Supabase
- **`src/supabase.ts`**: `signInWithGoogle()` now delegates to native on iOS (no more `Browser.open`); new `signInWithApple()`
- **`src/native/init.ts`**: calls `initSocialLogin()` at startup
- **`src/components/Login.tsx`** + **`src/components/Register.tsx`**: Apple button shown on iOS only (Apple HIG); Google button now uses the native flow
- **`src/styles.css`**: `.sh-btn-apple` styling (black button per Apple HIG)
- **`ios/App/App/App.entitlements`**: added `com.apple.developer.applesignin = ["Default"]`

The build is green and `npx cap sync ios` succeeded with 9 plugins including capgo.

## What you must do in the morning

These are 3 portal-level tasks I cannot do for you. Total time: ~10 minutes.

### 1. Create the iOS Google OAuth client ID (5 min)

This is **the actual root cause** of why sign-in opened a browser before — there was no iOS-side Google client to hand the ID token off to.

1. Go to <https://console.cloud.google.com/apis/credentials>
2. Make sure you're in the same Google project that hosts your existing Web OAuth client (the one Supabase uses for `accounts.google.com` redirects)
3. Click **+ CREATE CREDENTIALS → OAuth client ID**
4. Application type: **iOS**
5. Name: `Rally iOS`
6. Bundle ID: `com.playrally.app`
7. Click **Create**
8. Copy the **iOS client ID** (looks like `123456-abcdef.apps.googleusercontent.com`)
9. Copy the **iOS URL scheme** (the *reversed* form — looks like `com.googleusercontent.apps.123456-abcdef`)

### 2. Add the client ID to Vercel + a local `.env` (1 min)

The code reads `VITE_GOOGLE_IOS_CLIENT_ID` at build time.

**For local iOS test builds** — add to `apps/play-tennis/.env.local`:
```
VITE_GOOGLE_IOS_CLIENT_ID=123456-abcdef.apps.googleusercontent.com
```

**For staging.play-rally.com web builds** — add the same env var in Vercel (Settings → Environment Variables → both Production and Preview). This is harmless on web since web uses the redirect flow regardless, but it keeps the value consistent.

### 3. Add the reversed iOS URL scheme to Info.plist (1 min)

Open `apps/play-tennis/ios/App/App/Info.plist` and **add a second dict** inside the existing `CFBundleURLTypes` array (don't remove the existing `com.playrally.app` entry — that's for the OAuth Universal-Link fallback and deep links):

```xml
<key>CFBundleURLTypes</key>
<array>
    <!-- existing entry -->
    <dict>
        <key>CFBundleURLName</key>
        <string>com.playrally.app</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.playrally.app</string>
        </array>
    </dict>
    <!-- ADD THIS — paste the reversed iOS client ID from step 1 -->
    <dict>
        <key>CFBundleURLName</key>
        <string>google</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.123456-abcdef</string>
        </array>
    </dict>
</array>
```

### 4. Add Sign in with Apple capability in Xcode (2 min)

The entitlement file already declares it, but Xcode needs to know to provision it:

1. Open Xcode (or run `npm run ios:test` and let it open)
2. Select the **App** target → **Signing & Capabilities** tab
3. Click **+ Capability** → search for **Sign in with Apple** → double-click to add
4. (Push Notifications and Associated Domains should already be present — if not, add those too the same way)

This step also tells Apple's portal to enable Sign in with Apple on the App ID. Without it, the Apple button will throw a signing error at runtime.

### 5. Tell Supabase to trust the iOS Google client (1 min)

In the Supabase dashboard → Authentication → Providers → Google → **Authorized Client IDs** → add the iOS client ID from step 1. Without this, `signInWithIdToken` rejects with "invalid audience". Your existing Web client ID stays as the primary.

### 6. Build and test

```bash
npm run ios:test
```

Xcode opens. Hit Play. On your iPhone:
- Tap **Continue with Apple** → system sheet appears, fingerprint/Face ID, signed in. No browser.
- Sign out, tap **Continue with Google** → Google's native sheet appears, signed in. No browser.

If Apple works but Google fails with `ios_google_client_id_missing`, you skipped step 2. If Google fails with `invalid audience`, you skipped step 5.

## Push notifications — status check

The whole pipeline already exists and is wired to fire automatically. You don't need to write any new code:

- **Client side** (`pushRegistration.ts` + `NotificationPermission.tsx`): asks for permission on first profile load, registers the APNs device token in the `device_tokens` table via the `upsert_device_token` RPC.
- **Server side** (`apps/tennis-server/src/services/`): `notificationService` queues notifications with a 6-hour de-dupe window and a Phase 1 allow-list (6 templates: `N-01` Tournament Activated, `N-13` Final Scheduling Warning, `N-30` Match Confirmed, `N-40` Score Reminder, `N-42` Score Submitted, `N-61` Match Tomorrow). `pushService` sends them via APNs HTTP/2 directly — no Firebase, no OneSignal.
- **Triggers**: `tournamentEngine.ts` calls `notificationService.queueNotification()` and `processQueue()` at all the relevant lifecycle points. There are 16+ call sites already.

What you still need for push to actually fire:

### A. Server APNs creds (one-time, must be set in Render/Vercel/wherever tennis-server runs)

Per `docs/ios-setup-guide.md`:
```
APNS_KEY_ID=<10-char key id from developer.apple.com>
APNS_TEAM_ID=<your 10-char Team ID>
APNS_KEY_BASE64=<base64 of the .p8 file>
APNS_ENVIRONMENT=development   # change to "production" for App Store builds
```

You may already have a key from the xCloud app — check Apple Developer → Keys. APNs keys are not app-specific; one key works for all your apps. If you find one and have the .p8 file saved, reuse it.

### B. The `device_tokens` table needs RLS that lets the server read it

Migration `20260413_push_notification_infrastructure.sql` should already have this. Verify in Supabase dashboard if push doesn't fire.

### C. Test the full loop

After signing in via the new native flow:
1. The `NotificationPermission` modal appears the first time you visit your profile (or trigger it from DevTools)
2. Tap **Enable** → iOS system prompt → grant
3. The token gets POSTed to `device_tokens`
4. Trigger any Phase 1 event (e.g. confirm a match) → notification queues → tournamentEngine ticks → push fires

Run the integration test on staging from your iPhone, with the app **backgrounded** (push only delivers when the app isn't foregrounded — this caught me last time).

## Branch state

All changes are on this Conductor worktree's branch `claude/reverent-lewin-b205b8`. Nothing is pushed to `staging` or `main` yet — iOS code doesn't auto-deploy via Vercel anyway, and the portal steps above need to land before this is shippable. When you're ready:

```bash
git checkout staging
git merge claude/reverent-lewin-b205b8 --no-edit
git push origin staging
```

The web app on staging.play-rally.com keeps working exactly as before — only the iOS native build behaves differently. Web Google OAuth is unchanged.

## What I deliberately did NOT change

- **Web auth flow**: still uses `signInWithOAuth` with `redirectTo = window.location.origin`. Unchanged.
- **Existing Universal Link callback** (`/auth/callback` page + `handleOAuthCallback`): kept as a fallback. If the iOS Google client ID is missing for some reason, the native button shows a clear error rather than silently falling through to a browser — that's intentional, you said never again.
- **Notification templates and triggers**: untouched — they were already complete.
- **Capacitor version**: still 7.x per CLAUDE.md.

## TL;DR

1. ☐ Create iOS Google client ID in Google Cloud Console (5 min)
2. ☐ Paste it into `.env.local` and Vercel as `VITE_GOOGLE_IOS_CLIENT_ID`
3. ☐ Paste the reversed scheme into `Info.plist` URL types
4. ☐ Add Sign in with Apple capability in Xcode
5. ☐ Add the iOS Google client ID to Supabase → Auth → Providers → Google → Authorized Client IDs
6. ☐ (If push doesn't fire) verify APNs creds on the server
7. `npm run ios:test` → tap **Continue with Google** → no browser, signed in.
