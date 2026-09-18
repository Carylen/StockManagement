#!/usr/bin/env bash
# deploy.sh — Run every incoming changes to main branch to production server.
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose --env-file $APP_DIR/.env.prod -f $APP_DIR/docker-compose.prod.yml"
LOCK_FILE="/tmp/utstock_deploy.lock"

exec 200>"$LOCK_FILE"
if ! flock -n 200; then
  echo "Another deployment is in progress; cancel it." >&2
  exit 1
fi

echo "==> [1/3] Pull latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> [2/3] Build image API..."
$COMPOSE build api

echo "==> [3/3] Up services (migrations run automatically via entrypoint.sh)..."
$COMPOSE up -d --remove-orphans

echo ""
echo "Deployment Done."
echo "API running at http://$(curl -s ifconfig.me):8000/docs"
