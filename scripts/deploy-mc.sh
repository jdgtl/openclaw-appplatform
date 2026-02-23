#!/usr/bin/env bash
# Hot-deploy Mission Control to a running container via Tailscale SSH.
# Bypasses the full Docker build/deploy cycle for MC-only changes.
#
# Usage: ./scripts/deploy-mc.sh [hostname]
# Default hostname: clawdius.taila801b3.ts.net
set -euo pipefail

HOST="${1:-clawdius.taila801b3.ts.net}"
SSH_KEY="$HOME/.ssh/id_ed25519_github"
SSH_USER="openclaw"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REMOTE_MC="/opt/mission-control"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/mission-control/frontend"
SERVER_DIR="$REPO_ROOT/mission-control/server"

echo "==> Building MC frontend..."
(cd "$FRONTEND_DIR" && npm run build)

echo "==> Building MC server..."
(cd "$SERVER_DIR" && npx tsc)

echo "==> Deploying to $SSH_USER@$HOST..."

# Sync frontend dist
rsync -az --delete \
  -e "ssh $SSH_OPTS" \
  "$FRONTEND_DIR/dist/" \
  "$SSH_USER@$HOST:$REMOTE_MC/frontend/dist/"

# Sync server dist
rsync -az --delete \
  -e "ssh $SSH_OPTS" \
  "$SERVER_DIR/dist/" \
  "$SSH_USER@$HOST:$REMOTE_MC/server/dist/"

echo "==> Restarting Mission Control..."
ssh $SSH_OPTS "$SSH_USER@$HOST" "pkill -u openclaw -f 'node /opt/mission-control' || true"

echo "==> Done. MC deployed to $HOST"
