#!/usr/bin/env bash
# deploy.sh — Jalankan setiap kali ada update ke branch main
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

echo "==> [1/3] Pull latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> [2/3] Build image API..."
$COMPOSE build api

echo "==> [3/3] Up services (migrations run automatically via entrypoint.sh)..."
$COMPOSE up -d

echo ""
echo "Deployment Done."
echo "API running at http://$(curl -s ifconfig.me):8000/docs"
