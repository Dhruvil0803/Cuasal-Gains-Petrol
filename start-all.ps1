# ─────────────────────────────────────────────
#  Ascentt Platform — Start All Services
# ─────────────────────────────────────────────
$Root = $PSScriptRoot

function Start-Service($title, $dir, $cmd) {
  $full = Join-Path $Root $dir
  Start-Process powershell -ArgumentList "-NoExit", "-Command",
    "`$host.UI.RawUI.WindowTitle = '$title'; Set-Location '$full'; $cmd"
}

Write-Host ""
Write-Host "  Starting Ascentt Platform..." -ForegroundColor Yellow
Write-Host ""

# ── Landing Page (port 3000) ──────────────────
Start-Service "Landing Page :3000" "landing" "npm run dev"
Write-Host "  [1/7] Landing Page         -> http://localhost:3000" -ForegroundColor Cyan

# ── Petrol IoT Backend (port 8001) ───────────
Start-Service "Petrol IoT Backend :8001" "backend" ".\venv\Scripts\activate; python -m uvicorn main:app --reload --port 8001"
Write-Host "  [2/7] Petrol IoT Backend   -> http://localhost:8001" -ForegroundColor Cyan

# ── Petrol IoT Frontend (port 3001) ──────────
Start-Service "Petrol IoT Frontend :3001" "frontend" "npm start"
Write-Host "  [3/7] Petrol IoT Frontend  -> http://localhost:3001" -ForegroundColor Cyan

# ── Causal Backend (port 8002) ───────────────
Start-Service "Causal Backend :8002" "Causal\backend" ".\venv\Scripts\activate; python -m uvicorn app.main:app --reload --port 8002"
Write-Host "  [4/7] Causal Backend       -> http://localhost:8002" -ForegroundColor Cyan

# ── Causal Frontend (port 3002) ──────────────
Start-Service "Causal Frontend :3002" "Causal" "npm start"
Write-Host "  [5/7] Causal Frontend      -> http://localhost:3002" -ForegroundColor Cyan

# ── GAINS Backend (port 3003) ────────────────
Start-Service "GAINS Backend :3003" "GAINS" "node server/index.js"
Write-Host "  [6/7] GAINS Backend        -> http://localhost:3003" -ForegroundColor Cyan

# ── GAINS Frontend (port 5173) ───────────────
Start-Service "GAINS Frontend :5173" "GAINS" "npm run dev"
Write-Host "  [7/7] GAINS Frontend       -> http://localhost:5173" -ForegroundColor Cyan

Write-Host ""
Write-Host "  All services launched. Opening landing page..." -ForegroundColor Green
Write-Host ""

# Wait a few seconds then open the landing page
Start-Sleep -Seconds 4
Start-Process "http://localhost:3000"
