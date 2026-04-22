#!/bin/bash
source venv/bin/activate
exec python -m uvicorn main:app --host 0.0.0.0 --port 8001
