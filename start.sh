#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Starting SSH Workspace Manager"
echo "=========================================================="

# 1. Clean up any stale processes on ports 8080 & 5173
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
fi

# 2. Start Test SSH Container (if Docker is available)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "=== 1. Starting Test SSH Container (port 2222) ==="
    docker compose up -d 2>/dev/null || echo "Docker compose up skipped."
else
    echo "=== 1. Docker daemon not running or unavailable (skipping demo container) ==="
fi

# 3. Start Spring Boot Backend
echo "=== 2. Starting Spring Boot Backend (port 8080) ==="
cd "$DIR/backend"
setsid nohup mvn spring-boot:run </dev/null > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID, logs: backend/backend.log)"

# 4. Start React Frontend Dev Server
echo "=== 3. Starting React Frontend Dev Server (port 5173) ==="
cd "$DIR/frontend"
setsid nohup npm run dev </dev/null > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID, logs: frontend/frontend.log)"

# 5. Wait for Backend readiness
echo ""
echo "Waiting for backend services to initialize..."
for i in {1..30}; do
    if curl -s http://localhost:8080/api/auth/login >/dev/null 2>&1 || curl -s http://localhost:8080/ >/dev/null 2>&1; then
        echo "Backend is READY!"
        break
    fi
    sleep 1
done

echo ""
echo "=========================================================="
echo "  SSH Workspace Manager is LIVE!"
echo "  URL:         http://localhost:5173/"
echo "  Credentials: admin@example.com / password123"
echo "  SSH Target:  localhost:2222 (demo / demopassword123)"
echo "=========================================================="
