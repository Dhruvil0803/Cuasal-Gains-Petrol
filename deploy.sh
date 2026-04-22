#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  Ascentt Platform — EC2 Deployment Script
#  Run once on a fresh Ubuntu 22.04 EC2 instance:
#    chmod +x deploy.sh && ./deploy.sh <EC2_PUBLIC_IP>
# ═══════════════════════════════════════════════════════════════

set -e

EC2_IP=${1:?"Usage: ./deploy.sh <EC2_PUBLIC_IP>"}
APP_DIR="/var/www/ascentt"
REPO_DIR="/home/ubuntu/app"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ascentt Platform Deployment"
echo "  EC2 IP: $EC2_IP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. System packages ────────────────────────────────────────
echo "[1/9] Installing system packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq nginx python3 python3-pip python3-venv git curl

# ── 2. Node.js 20 ────────────────────────────────────────────
echo "[2/9] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
sudo apt-get install -y -qq nodejs

# ── 3. PM2 ───────────────────────────────────────────────────
echo "[3/9] Installing PM2..."
sudo npm install -g pm2 --silent

# ── 4. Clone / pull repo ──────────────────────────────────────
echo "[4/9] Cloning repository..."
if [ -d "$REPO_DIR/.git" ]; then
  cd "$REPO_DIR" && git pull
else
  git clone https://github.com/Dhruvil0803/Cuasal-Gains-Petrol.git "$REPO_DIR"
  cd "$REPO_DIR"
fi

# ── 5. Python venvs & deps ────────────────────────────────────
echo "[5/9] Setting up Python backends..."

# Petrol IoT backend
cd "$REPO_DIR/backend"
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
deactivate
chmod +x start_petrol.sh

# Causal backend
cd "$REPO_DIR/Causal/backend"
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
deactivate
chmod +x start_causal.sh

# ── 6. Node deps ──────────────────────────────────────────────
echo "[6/9] Installing Node dependencies..."
cd "$REPO_DIR/landing"  && npm ci --silent
cd "$REPO_DIR/frontend" && npm ci --silent
cd "$REPO_DIR/Causal"   && npm ci --silent
cd "$REPO_DIR/GAINS"    && npm ci --silent

# ── 7. Build frontends ────────────────────────────────────────
echo "[7/9] Building frontends..."
sudo mkdir -p "$APP_DIR/landing" "$APP_DIR/petrol" "$APP_DIR/causal" "$APP_DIR/gains"

# Landing page — inject EC2 IP so buttons link correctly
cd "$REPO_DIR/landing"
echo "VITE_HOST=$EC2_IP" > .env.production
npm run build --silent
sudo cp -r dist/* "$APP_DIR/landing/"

# Petrol IoT frontend
cd "$REPO_DIR/frontend"
npm run build --silent
sudo cp -r build/* "$APP_DIR/petrol/"

# Causal frontend
cd "$REPO_DIR/Causal"
npm run build --silent
sudo cp -r build/* "$APP_DIR/causal/"

# GAINS frontend
cd "$REPO_DIR/GAINS"
npm run build --silent
sudo cp -r dist/* "$APP_DIR/gains/"

# ── 8. Nginx ─────────────────────────────────────────────────
echo "[8/9] Configuring Nginx..."
sudo cp "$REPO_DIR/nginx.conf" /etc/nginx/sites-available/ascentt
sudo ln -sf /etc/nginx/sites-available/ascentt /etc/nginx/sites-enabled/ascentt
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx

# ── 9. PM2 — start all backends ──────────────────────────────
echo "[9/9] Starting backends with PM2..."
cd "$REPO_DIR"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✓ Deployment complete!"
echo ""
echo "  Landing Page  →  http://$EC2_IP"
echo "  Petrol IoT    →  http://$EC2_IP:3001"
echo "  Causal        →  http://$EC2_IP:3002"
echo "  GAINS         →  http://$EC2_IP:5173"
echo ""
echo "  Backends:"
echo "  Petrol API    →  http://$EC2_IP:8001"
echo "  Causal API    →  http://$EC2_IP:8002"
echo "  GAINS API     →  http://$EC2_IP:3003"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
