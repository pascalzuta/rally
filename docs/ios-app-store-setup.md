# iOS App Store Connect Setup (One-Time)

This is the first-time setup to get Rally into **TestFlight** (staging for iOS) and **App Store** (live for iOS). After this is done, all future ships use `npm run ios:ship` from any Conductor workspace.

Expected time: ~30 minutes of form-filling.

## Prerequisites

- Apple Developer account (Team ID: `RTNLY3UZSV` — already set up)
- Bundle ID `com.playrally.app` already registered in Apple Developer portal (from push notification setup)
- Xcode logged in with the Developer account (Xcode → Settings → Accounts)

## Step 1: Create the app record in App Store Connect (~10 min)

1. Go to https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**
2. Fill in:
   - **Platforms**: iOS
   - **Name**: `Rally` (this is the public App Store name, 30 char max)
   - **Primary language**: English (U.S.)
   - **Bundle ID**: select `com.playrally.app` from the dropdown
   - **SKU**: `rally-001` (internal-only, any unique string)
   - **User access**: Full Access
3. Click **Create**

## Step 2: Minimum TestFlight metadata (~5 min)

The app record is created but TestFlight needs a few fields before builds can be distributed.

1. In the app, click the **TestFlight** tab
2. Left sidebar → **Test Information**
3. Fill in:
   - **Beta App Description**: `Tennis tournament app for local communities. Join your county, get matched with nearby players, auto-scheduled round-robin tournaments.`
   - **Feedback email**: your email
   - **Marketing URL** (optional): https://play-rally.com
   - **Privacy Policy URL**: https://play-rally.com/privacy (create this page if it doesn't exist — even a one-liner satisfies Apple)
4. Left sidebar → **Test Details** (one per language, English is default)
   - **What to Test**: `Everything — this is a beta. Focus on: joining a lobby, creating a tournament, reporting scores.`
5. Save

## Step 3: Add external testers (~5 min)

External testing is what you want for "me + friends."

1. TestFlight tab → **External Testing** (sidebar)
2. Click **+** next to "Groups" → name it `Friends`
3. Inside the group: click **Add Testers** → **Add New Testers**
4. Add each friend's email (name + email, one per row, up to 10,000)
5. They'll get an email with a link once the first build is approved

**To get a public invite link** (share on socials, in ads, etc.):
- Inside the group → **Public Link** → toggle ON → copy the URL
- Anyone with the link can install (up to your set tester limit)

## Step 4: First upload (one-time Beta App Review)

1. In a Conductor workspace with the code you want to ship, run:
   ```bash
   npm run ios:ship
   ```
2. Follow the Xcode prompts (archive → Organizer → Distribute → Upload).
3. Build appears in App Store Connect within ~15 min as "Processing."
4. Once processed, it enters **Beta App Review** (Apple checks it's not malware). This takes ~24 hours the first time only.
5. After approval, testers get a push notification automatically.

**Subsequent ships**: no review, testers get the update in ~15 min.

## Step 5: Graduating to App Store (when ready)

Once a TestFlight build has been proven by testers:

1. App Store Connect → Rally app → **App Store** tab (top)
2. **iOS App** version → **Build** section → **Select a build before you submit your app**
3. Pick the TestFlight build you want to promote
4. Fill in App Store metadata:
   - Description (long-form, 4000 chars)
   - Keywords (100 chars)
   - Support URL
   - Screenshots (6.7" iPhone required; tool like `simctl` or Xcode screenshots)
   - Age rating questionnaire (Rally is 4+)
   - App privacy questionnaire (what data you collect — Supabase, push tokens, county/name)
5. Submit for review. Apple reviews (~24hr typical), then live.

For future versions: just promote TestFlight builds without re-filling metadata.

## Troubleshooting

**"No matching provisioning profile found"**: Xcode → Project → Signing & Capabilities → check "Automatically manage signing" and select your team (`RTNLY3UZSV`). Xcode will create the profile.

**Archive fails with Capacitor 8.x errors**: your workspace somehow got on Capacitor 8.x. Check `apps/play-tennis/package.json` — all `@capacitor/*` deps should start with `~7.`. If not, see CLAUDE.md "Capacitor must stay on 7.x."

**Build stuck in "Processing" for >1hr**: rare, but happens. Wait it out, or contact App Store Connect support. Usually resolves on its own.

**Testers don't see the build**: TestFlight builds expire after 90 days. Also, testers must accept the invite email before they can install. Check the External Testing group's tester status column.
