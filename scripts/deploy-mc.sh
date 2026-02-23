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

# Clear remote dist dirs and upload fresh builds via scp (rsync not available on container)
ssh $SSH_OPTS "$SSH_USER@$HOST" "rm -rf $REMOTE_MC/frontend/dist $REMOTE_MC/server/dist"
scp -r $SSH_OPTS "$FRONTEND_DIR/dist" "$SSH_USER@$HOST:$REMOTE_MC/frontend/dist"
scp -r $SSH_OPTS "$SERVER_DIR/dist" "$SSH_USER@$HOST:$REMOTE_MC/server/dist"

echo "==> Restarting Mission Control..."
ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 $SSH_OPTS "$SSH_USER@$HOST" "pkill -u openclaw -f 'node /opt/mission-control' || true" 2>/dev/null || true

echo "==> Done. MC deployed to $HOST"
