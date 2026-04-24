#!/bin/bash
source venv/bin/activate
set -a; [ -f "$(dirname "$0")/.env" ] && source "$(dirname "$0")/.env"; set +a
exec python -m uvicorn main:app --host 0.0.0.0 --port 8001
