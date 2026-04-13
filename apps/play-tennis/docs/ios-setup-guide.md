# iOS App Setup Guide

## What's Already Done ✅

1. **Capacitor configured** — `capacitor.config.ts` with app ID `com.playrally.app`
2. **iOS Xcode project** — generated and committed at `ios/App/`
3. **Push notification client code** — permission flow, token registration, deep linking
4. **Push notification server** — APNs HTTP/2 service (direct, no Firebase)
5. **Database tables** — `device_tokens` and `notification_preferences` created in Supabase
6. **AppDelegate** — push notification delegate methods added
7. **Entitlements** — push + Universal Links configured
8. **NotificationSettings UI** — toggle component for user preferences

## What You Need to Do (Apple Developer Portal)

### 1. Register the Bundle ID
1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Click "+" to register a new identifier
3. Select "App IDs" → "App"
4. Description: `Rally`
5. Bundle ID (Explicit): `com.playrally.app`
6. Enable capabilities:
   - ✅ Push Notifications
   - ✅ Associated Domains (for Universal Links)
7. Click "Continue" → "Register"

### 2. Create an APNs Auth Key (.p8)
1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Click "+" to create a new key
3. Name: `Rally APNs Key`
4. Enable: ✅ Apple Push Notifications service (APNs)
5. Click "Continue" → "Register"
6. **Download the .p8 file** (you can only download it ONCE!)
7. Note the **Key ID** (10-character string, e.g. `ABC1234DEF`)
8. Note your **Team ID** from the top-right of the Developer portal page

### 3. Set Server Environment Variables
On the tennis-server (wherever it's deployed), set these env vars:

```bash
# The 10-character Key ID from step 2
APNS_KEY_ID=ABC1234DEF

# Your Apple Developer Team ID (top-right of developer.apple.com)
APNS_TEAM_ID=XYZ9876543

# Base64-encode the .p8 file contents:
# cat AuthKey_ABC1234DEF.p8 | base64 | tr -d '\n'
APNS_KEY_BASE64=LS0tLS1CRUdJTi...

# App bundle ID (default is com.playrally.app, only set if different)
# APNS_BUNDLE_ID=com.playrally.app

# Use "development" for testing, "production" for App Store builds
APNS_ENVIRONMENT=development
```

### 4. Update Universal Links
Replace `TEAM_ID` in `public/.well-known/apple-app-site-association`:
```json
"appIDs": ["YOUR_TEAM_ID.com.playrally.app"]
```

### 5. Open in Xcode & Configure Signing
```bash
cd apps/play-tennis
npm run build:native    # Builds web assets + syncs to iOS
npm run cap:open:ios    # Opens Xcode
```

In Xcode:
1. Select the "App" target
2. Go to "Signing & Capabilities"
3. Select your team / provisioning profile
4. Verify "Push Notifications" capability is listed
5. Verify "Associated Domains" has `applinks:play-rally.com`

### 6. Test on Device
```bash
npm run cap:run:ios    # Builds and runs on connected device
```
Note: Push notifications do NOT work in the iOS Simulator. You must test on a physical device.

### 7. App Store Submission (Later)
- App icon (1024x1024) needed for App Store Connect
- Screenshots (6.7" and 5.5" sizes minimum)
- Privacy policy URL
- App description and keywords
- Change `APNS_ENVIRONMENT` to `production`
- Change entitlements `aps-environment` from `development` to `production`
