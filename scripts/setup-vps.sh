#!/usr/bin/env bash
# setup-vps.sh — Jalankan SEKALI di VPS baru (Ubuntu 24.04)
# Usage: bash setup-vps.sh
set -euo pipefail

REPO_URL="https://github.com/Carylen/StockManagement.git"
APP_DIR="$HOME/ut-stock"

echo "==> [1/6] Update & upgrade system..."
sudo apt-get update -y
sudo apt-get upgrade -y

echo "==> [2/6] Install Docker (2024 version)..."
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin

# Izinkan user menjalankan docker tanpa sudo
sudo usermod -aG docker "$USER"
echo "    Docker $(docker --version) installed."

echo "==> [3/6] Install Nginx..."
sudo apt-get install -y nginx
sudo systemctl enable nginx

echo "==> [4/6] Configure UFW firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 8000/tcp
sudo ufw allow 5432/tcp
sudo ufw --force enable
echo "    UFW status:"
sudo ufw status

echo "==> [5/6] Clone repository..."
if [ -d "$APP_DIR" ]; then
    echo "    Directory $APP_DIR already exists, skip clone."
else
    git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> [6/6] Prepare environment files..."
cd "$APP_DIR"
if [ ! -f .env.prod ]; then
    cp .env.prod.example .env.prod
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  IMPORTANT: Edit .env.prod before running the app!"
    echo "  Command: nano $APP_DIR/.env.prod"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "    .env.prod already exists, skip."
fi

echo ""
echo "Setup done. Next steps:"
echo "  1. Edit .env.prod  →  nano $APP_DIR/.env.prod"
echo "  2. Copy nginx config → sudo cp $APP_DIR/nginx/nginx.conf /etc/nginx/sites-available/utstock"
echo "  3.                   → sudo ln -s /etc/nginx/sites-available/utstock /etc/nginx/sites-enabled/"
echo "  4.                   → sudo nginx -t && sudo systemctl reload nginx"
echo "  5. Run first-run → bash $APP_DIR/scripts/first-run.sh"
echo ""
echo "NOTES: log out and log in again for the docker group changes to take effect."
