#!/usr/bin/env bash
# PayGuard AI — local startup script
# Starts both backend (FastAPI) and frontend (Vite) in parallel.
# Usage: ./start.sh

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

RED='\033[0;31m'
GRN='\033[0;32m'
YEL='\033[1;33m'
CYN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${CYN}[payguard]${NC} $1"; }
ok()  { echo -e "${GRN}[payguard]${NC} $1"; }
warn(){ echo -e "${YEL}[payguard]${NC} $1"; }
err() { echo -e "${RED}[payguard]${NC} $1" >&2; }

# ── Backend ─────────────────────────────────────────────────────────────────
log "Setting up backend..."
cd "$BACKEND"

if [ ! -d venv ]; then
  log "Creating Python virtual environment..."
  python3 -m venv venv
fi

. venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt
ok "Backend dependencies installed."

if [ ! -f .env ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" .env
  warn "Copied .env.example → backend/.env (edit as needed)"
fi

log "Starting FastAPI backend on http://localhost:8000 ..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
sleep 3
ok "Backend running (PID $BACKEND_PID)"

# ── Frontend ─────────────────────────────────────────────────────────────────
log "Setting up frontend..."
cd "$FRONTEND"

if [ ! -d node_modules ]; then
  log "Installing npm dependencies (this may take a minute)..."
  npm install --silent
fi

log "Starting Vite dev server on http://localhost:5173 ..."
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!
sleep 3
ok "Frontend running (PID $FRONTEND_PID)"

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GRN}  PayGuard AI is running!${NC}"
echo -e "${GRN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  🖥  Dashboard:   ${CYN}http://localhost:5173${NC}"
echo -e "  🔌  API:         ${CYN}http://localhost:8000${NC}"
echo -e "  📄  API Docs:    ${CYN}http://localhost:8000/docs${NC}"
echo ""
echo -e "  Press ${YEL}Ctrl+C${NC} to stop both servers."
echo ""

# Wait for either process to exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait $BACKEND_PID $FRONTEND_PID
