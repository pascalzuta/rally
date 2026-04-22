#!/usr/bin/env bash
# ios:ship — build the Rally app and open Xcode ready for archive + upload
# to App Store Connect (TestFlight + App Store).
#
# Works from any Conductor workspace. Ships whatever branch this workspace is on.
# After upload, the build appears in App Store Connect within ~15 min and
# TestFlight testers get it automatically. Promote to App Store when ready.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_APP="$REPO_ROOT/apps/play-tennis"
IOS_PROJECT="$WEB_APP/ios/App/App.xcodeproj"

cd "$REPO_ROOT"

CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"

echo ""
echo "=== Rally ios:ship — upload to TestFlight / App Store Connect ==="
echo "Workspace: $REPO_ROOT"
echo "Branch:    $CURRENT_BRANCH"
echo ""

# Warn if shipping from a feature branch instead of staging/main
if [ "$CURRENT_BRANCH" != "staging" ] && [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  You're on '$CURRENT_BRANCH', not staging or main."
  echo "   This is fine for TestFlight testing, but the build won't include"
  echo "   other merged-to-staging changes. Press Enter to continue or Ctrl+C to abort."
  read -r
fi

if [ ! -d "$IOS_PROJECT" ]; then
  echo "ERROR: iOS project not found at $IOS_PROJECT"
  exit 1
fi

if [ ! -d "$REPO_ROOT/node_modules" ]; then
  echo "--> node_modules missing, running npm install..."
  npm install
fi

echo "--> Building web assets (CAPACITOR_BUILD=1)..."
CAPACITOR_BUILD=1 npm run build:play-tennis

echo "--> Syncing web assets into iOS project..."
(cd "$WEB_APP" && npx cap sync ios)

echo "--> Opening Xcode..."
open "$IOS_PROJECT"

cat <<'EOF'

=== Next steps in Xcode (4 clicks) ===

1. Device selector (top-left): pick "Any iOS Device (arm64)"
   (Not your iPhone — that's only for dev testing. "Any iOS Device" is
    required for distribution builds.)

2. Menu: Product → Archive
   Wait ~2 min. When done, the Organizer window opens automatically.

3. In Organizer: click "Distribute App"
   Choose: App Store Connect → Upload → (defaults for everything else) → Upload.
   Xcode signs and uploads the build. Takes ~3-5 min.

4. Done. Go to https://appstoreconnect.apple.com → My Apps → Rally → TestFlight.
   Build appears within ~15 min ("Processing"). Once processed, external
   testers get a push notification automatically.

=== First-time only ===
If this is your first ship, TestFlight will require a one-time Beta App Review
(~24hr). Subsequent ships distribute instantly.

EOF
