#!/usr/bin/env bash
# first-run.sh — Jalankan SEKALI setelah setup VPS, sebelum deploy.sh
# Usage: bash scripts/first-run.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.prod.yml"

# Pastikan .env.prod sudah diisi
if grep -q "CHANGE_WITH" "$APP_DIR/.env.prod" 2>/dev/null; then
    echo "ERROR: .env.prod still contains placeholder values."
    echo "Edit file: nano $APP_DIR/.env.prod"
    exit 1
fi

echo "==> [1/4] Start database..."
$COMPOSE up -d db

echo "==> [2/4] Waiting for database to be ready (health check)..."
until $COMPOSE exec db pg_isready -U "${POSTGRES_USER:-utstock_user}" > /dev/null 2>&1; do
    echo "    Database not ready yet, waiting 3 seconds..."
    sleep 3
done
echo "    Database ready."

echo "==> [3/4] Build & start API..."
$COMPOSE build api
$COMPOSE up -d api

echo "==> [4/4] Run migrations..."
sleep 3
$COMPOSE exec api alembic upgrade head

echo ""
echo "First run done."
IP=$(curl -s ifconfig.me 2>/dev/null || echo "<IP-VPS>")
echo "Check API: http://$IP:8000/docs"
echo "For subsequent updates, use: bash $APP_DIR/scripts/deploy.sh"
