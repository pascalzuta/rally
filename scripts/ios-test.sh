#!/usr/bin/env bash
# ios:test — build the Rally web app, sync to the iOS project, open Xcode.
# You hit Play in Xcode to install on your connected iPhone (dev build).
#
# Works from any Conductor workspace. Builds from whatever branch the
# workspace is on. Never use /tmp/rally-bugfix — that directory is dead.

set -euo pipefail

# Resolve monorepo root from this script's location so it works from anywhere
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WEB_APP="$REPO_ROOT/apps/play-tennis"
IOS_PROJECT="$WEB_APP/ios/App/App.xcodeproj"

cd "$REPO_ROOT"

echo ""
echo "=== Rally ios:test — dev build to your iPhone ==="
echo "Workspace: $REPO_ROOT"
echo "Branch:    $(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
echo ""

# Verify iOS project exists in this workspace (it should — it's checked in)
if [ ! -d "$IOS_PROJECT" ]; then
  echo "ERROR: iOS project not found at $IOS_PROJECT"
  echo "This workspace may be on a branch that predates the iOS setup."
  exit 1
fi

# Install deps only if node_modules missing (fast path for repeat runs)
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

=== Next step ===
In Xcode:
  1. Select your iPhone in the device dropdown (top-left, near the Play button)
  2. Hit Play (or Cmd+R)
  3. Wait for build — first run takes ~2 min, later runs are faster

If Xcode is already open on a different workspace, quit it first and re-run.

EOF
