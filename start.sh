#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== 1. Starting Test SSH Container (port 2222) ==="
docker compose up -d

echo "=== 2. Starting Spring Boot Backend (port 8080) ==="
cd "$DIR/backend"
nohup mvn spring-boot:run </dev/null > backend.log 2>&1 &
BACKEND_PID=$!
disown "$BACKEND_PID" 2>/dev/null || true
echo "Backend started (PID: $BACKEND_PID, logs: backend/backend.log)"

echo "=== 3. Starting React Frontend Dev Server (port 5173) ==="
cd "$DIR/frontend"
nohup npm run dev </dev/null > frontend.log 2>&1 &
FRONTEND_PID=$!
disown "$FRONTEND_PID" 2>/dev/null || true
echo "Frontend started (PID: $FRONTEND_PID, logs: frontend/frontend.log)"

echo ""
echo "=========================================================="
echo "  SSH Workspace Manager is LIVE!"
echo "  URL:         http://localhost:5173/"
echo "  Credentials: admin@example.com / password123"
echo "  SSH Target:  localhost:2222 (demo / demopassword123)"
echo "=========================================================="
