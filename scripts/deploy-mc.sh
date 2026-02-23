#!/usr/bin/env bash
# Hot-deploy Mission Control to a running container via Tailscale SSH.
# Bypasses the full Docker build/deploy cycle for MC-only changes.
#
# NOTE: This only deploys compiled artifacts (dist/). If you add or change
# npm dependencies, you need a full Docker build/deploy to update node_modules.
#
# Usage: ./scripts/deploy-mc.sh [hostname]
# Default hostname: clawdius.taila801b3.ts.net
set -euo pipefail

HOST="${1:-clawdius.taila801b3.ts.net}"
SSH_KEY="$HOME/.ssh/id_ed25519_github"
SSH_USER="openclaw"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -o ServerAliveInterval=5"
REMOTE_MC="/opt/mission-control"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/mission-control/frontend"
SERVER_DIR="$REPO_ROOT/mission-control/server"

# Pre-flight: verify host is reachable and MC directory exists
echo "==> Checking connectivity to $HOST..."
if ! ssh $SSH_OPTS "$SSH_USER@$HOST" "test -d $REMOTE_MC" 2>/dev/null; then
  echo "ERROR: Cannot reach $SSH_USER@$HOST or $REMOTE_MC does not exist" >&2
  exit 1
fi

echo "==> Building MC frontend..."
(cd "$FRONTEND_DIR" && npm run build)

echo "==> Building MC server..."
(cd "$SERVER_DIR" && npx tsc)

echo "==> Deploying to $SSH_USER@$HOST..."

# Upload to temp dirs then atomically swap to avoid serving partial builds
# if s6 restarts MC mid-transfer
STAGING="/tmp/mc-deploy-$$"
ssh $SSH_OPTS "$SSH_USER@$HOST" "mkdir -p $STAGING"

tar -czf - -C "$FRONTEND_DIR" dist | ssh $SSH_OPTS "$SSH_USER@$HOST" "tar -xzf - -C $STAGING && mv $STAGING/dist $STAGING/frontend-dist"
tar -czf - -C "$SERVER_DIR" dist | ssh $SSH_OPTS "$SSH_USER@$HOST" "tar -xzf - -C $STAGING && mv $STAGING/dist $STAGING/server-dist"

# Atomic swap: remove old, move new into place
ssh $SSH_OPTS "$SSH_USER@$HOST" "\
  rm -rf $REMOTE_MC/frontend/dist $REMOTE_MC/server/dist && \
  mv $STAGING/frontend-dist $REMOTE_MC/frontend/dist && \
  mv $STAGING/server-dist $REMOTE_MC/server/dist && \
  rm -rf $STAGING"

echo "==> Restarting Mission Control..."
ssh $SSH_OPTS "$SSH_USER@$HOST" "pkill -f 'node /opt/mission-control/server' || true" 2>/dev/null || true

echo "==> Done. MC deployed to $HOST"
