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

TOTAL_STEPS=20
CURRENT_STEP=0
START_TIME=$(date +%s)

# ── Helpers ───────────────────────────────────────────────────
bar() {
  local pct=$1
  local filled=$(( pct / 5 ))
  local b=""
  for i in $(seq 1 $filled);        do b="${b}█"; done
  for i in $(seq $((filled+1)) 20); do b="${b}░"; done
  echo "$b"
}

progress() {
  CURRENT_STEP=$(( CURRENT_STEP + 1 ))
  local pct=$(( CURRENT_STEP * 100 / TOTAL_STEPS ))
  local elapsed=$(( $(date +%s) - START_TIME ))
  echo ""
  echo "  $(bar $pct) ${pct}%  (step ${CURRENT_STEP}/${TOTAL_STEPS})"
  echo "  ▶  $1  [${elapsed}s elapsed]"
  echo ""
}

pkg_count() {
  # Count non-blank, non-comment lines in a requirements/package file
  local file=$1
  grep -cve '^\s*$' -e '^\s*#' "$file" 2>/dev/null || echo "?"
}

npm_pkg_count() {
  # Count dependencies + devDependencies keys in package.json
  python3 -c "
import json,sys
d=json.load(open('$1'))
print(len(d.get('dependencies',{}))+len(d.get('devDependencies',{})))
" 2>/dev/null || echo "?"
}

# ── Header ────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Ascentt Platform Deployment"
echo "  Target EC2: $EC2_IP"
echo "  Total steps: $TOTAL_STEPS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ══════════════════════════════════════════════════════════════
#  MODULE 1 — System Packages
# ══════════════════════════════════════════════════════════════
progress "MODULE 1/6 · System — apt-get update"
sudo apt-get update -qq

progress "MODULE 1/6 · System — installing nginx, python3, git, curl"
sudo apt-get install -y nginx python3 python3-pip python3-venv git curl 2>&1 \
  | grep -E "^(Get|Setting|Unpacking|Selecting)" | sed 's/^/    /' || true
echo "  ✓ System packages installed"

# ══════════════════════════════════════════════════════════════
#  MODULE 2 — Node.js + PM2
# ══════════════════════════════════════════════════════════════
progress "MODULE 2/6 · Node.js 20 — adding NodeSource repo"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1

progress "MODULE 2/6 · Node.js 20 — installing nodejs"
sudo apt-get install -y -qq nodejs
echo "  ✓ Node $(node -v) installed"

progress "MODULE 2/6 · PM2 — global install"
sudo npm install -g pm2 --silent
echo "  ✓ PM2 $(pm2 -v) installed"

# ══════════════════════════════════════════════════════════════
#  MODULE 3 — Repository
# ══════════════════════════════════════════════════════════════
progress "MODULE 3/6 · Repository — clone / pull"
if [ -d "$REPO_DIR/.git" ]; then
  echo "  → Existing repo found, pulling latest..."
  cd "$REPO_DIR" && git pull
else
  echo "  → Cloning from GitHub..."
  git clone https://github.com/Dhruvil0803/Cuasal-Gains-Petrol.git "$REPO_DIR"
  cd "$REPO_DIR"
fi
echo "  ✓ Repo ready at $REPO_DIR"

# ══════════════════════════════════════════════════════════════
#  MODULE 4 — Python Backends
# ══════════════════════════════════════════════════════════════
progress "MODULE 4/6 · Python — Petrol IoT backend"
cd "$REPO_DIR/backend"
COUNT=$(pkg_count requirements.txt)
echo "  → Creating venv and installing $COUNT packages..."
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
INSTALLED=$(pip list 2>/dev/null | wc -l)
deactivate
chmod +x start_petrol.sh
echo "  ✓ Petrol IoT: $INSTALLED packages installed (port 8001)"

progress "MODULE 4/6 · Python — Causal backend"
cd "$REPO_DIR/Causal/backend"
COUNT=$(pkg_count requirements.txt)
echo "  → Creating venv and installing $COUNT packages..."
python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt
INSTALLED=$(pip list 2>/dev/null | wc -l)
deactivate
chmod +x start_causal.sh
echo "  ✓ Causal: $INSTALLED packages installed (port 8002)"

# ══════════════════════════════════════════════════════════════
#  MODULE 5 — Node Dependencies + Builds
# ══════════════════════════════════════════════════════════════
progress "MODULE 5/6 · Node deps — Landing page"
cd "$REPO_DIR/landing"
COUNT=$(npm_pkg_count package.json)
echo "  → Installing $COUNT packages (npm ci)..."
npm ci --silent
echo "  ✓ Landing: node_modules ready"

progress "MODULE 5/6 · Node deps — Petrol IoT frontend"
cd "$REPO_DIR/frontend"
COUNT=$(npm_pkg_count package.json)
echo "  → Installing $COUNT packages (npm ci)..."
npm ci --silent
echo "  ✓ Petrol IoT frontend: node_modules ready"

progress "MODULE 5/6 · Node deps — Causal frontend"
cd "$REPO_DIR/Causal"
COUNT=$(npm_pkg_count package.json)
echo "  → Installing $COUNT packages (npm ci)..."
npm ci --silent
echo "  ✓ Causal frontend: node_modules ready"

progress "MODULE 5/6 · Node deps — GAINS frontend"
cd "$REPO_DIR/GAINS"
COUNT=$(npm_pkg_count package.json)
echo "  → Installing $COUNT packages (npm ci)..."
npm ci --silent
echo "  ✓ GAINS frontend: node_modules ready"

# ── Build all frontends ───────────────────────────────────────
sudo mkdir -p "$APP_DIR/landing" "$APP_DIR/petrol" "$APP_DIR/causal" "$APP_DIR/gains"

progress "MODULE 5/6 · Build — Landing page (Vite)"
cd "$REPO_DIR/landing"
echo "VITE_HOST=$EC2_IP" > .env.production
npm run build --silent
sudo cp -r dist/* "$APP_DIR/landing/"
echo "  ✓ Landing built → $APP_DIR/landing/"

progress "MODULE 5/6 · Build — Petrol IoT frontend (React CRA)"
cd "$REPO_DIR/frontend"
npm run build --silent
sudo cp -r build/* "$APP_DIR/petrol/"
echo "  ✓ Petrol IoT built → $APP_DIR/petrol/"

progress "MODULE 5/6 · Build — Causal frontend (React CRA)"
cd "$REPO_DIR/Causal"
npm run build --silent
sudo cp -r build/* "$APP_DIR/causal/"
echo "  ✓ Causal built → $APP_DIR/causal/"

progress "MODULE 5/6 · Build — GAINS frontend (Vite)"
cd "$REPO_DIR/GAINS"
npm run build --silent
sudo cp -r dist/* "$APP_DIR/gains/"
echo "  ✓ GAINS built → $APP_DIR/gains/"

# ══════════════════════════════════════════════════════════════
#  MODULE 6 — Nginx + PM2
# ══════════════════════════════════════════════════════════════
progress "MODULE 6/6 · Nginx — configure & reload"
sudo cp "$REPO_DIR/nginx.conf" /etc/nginx/sites-available/ascentt
sudo ln -sf /etc/nginx/sites-available/ascentt /etc/nginx/sites-enabled/ascentt
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl enable nginx
echo "  ✓ Nginx configured (ports: 80, 3001, 3002, 5173)"

progress "MODULE 6/6 · PM2 — starting all 3 backends"
cd "$REPO_DIR"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
echo ""
pm2 list
echo "  ✓ All backends online"

# ── Summary ───────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  $(bar 100) 100%"
echo "  ✓ Deployment complete in ${TOTAL_TIME}s!"
echo ""
echo "  MODULE          URL"
echo "  ─────────────────────────────────────────────────────"
echo "  Landing Page  → http://$EC2_IP"
echo "  Petrol IoT    → http://$EC2_IP:3001  (API: :8001)"
echo "  Causal        → http://$EC2_IP:3002  (API: :8002)"
echo "  GAINS         → http://$EC2_IP:5173  (API: :3003)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
