#!/usr/bin/env bash
# deploy.sh — Jalankan setiap kali ada update ke branch main
# Usage: bash scripts/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

echo "==> [1/4] Pull latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> [2/4] Build image API..."
$COMPOSE build api

echo "==> [3/4] Up services..."
$COMPOSE up -d

echo "==> [4/4] Running Database Migrations..."
$COMPOSE exec --workdir /app api alembic upgrade head

echo ""
echo "Deployment Done."
echo "API running at http://$(curl -s ifconfig.me):8000/docs"
