#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Starting SSH Workspace Manager"
echo "=========================================================="

# 1. Environment & Prerequisite Checks
if ! command -v java >/dev/null 2>&1; then
    echo "[ERROR] Java is not installed or not in PATH."
    echo "Please install Java 21+ (e.g. OpenJDK 21) to run the backend."
    exit 1
fi

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "[ERROR] Node.js or npm is not installed or not in PATH."
    echo "Please install Node.js 20+ and npm to run the frontend."
    exit 1
fi

# Determine Maven executable (global mvn or included ./mvnw wrapper)
if command -v mvn >/dev/null 2>&1; then
    MVN_CMD="mvn"
elif [ -f "$DIR/backend/mvnw" ]; then
    chmod +x "$DIR/backend/mvnw"
    MVN_CMD="./mvnw"
else
    echo "[ERROR] Neither 'mvn' nor 'backend/mvnw' was found."
    exit 1
fi

# 2. First-time setup: install frontend node_modules if missing
if [ ! -d "$DIR/frontend/node_modules" ]; then
    echo "--> First-time clone detected: Installing frontend dependencies..."
    (cd "$DIR/frontend" && npm install)
fi

# 3. Clean up any stale processes on ports 8080 & 5173
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

# 4. Start Spring Boot Backend
echo "=== 1. Starting Spring Boot Backend (port 8080) ==="
cd "$DIR/backend"
setsid nohup $MVN_CMD spring-boot:run </dev/null > backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID, logs: backend/backend.log)"

# 5. Start React Frontend Dev Server
echo "=== 2. Starting React Frontend Dev Server (port 5173) ==="
cd "$DIR/frontend"
setsid nohup npm run dev </dev/null > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID, logs: frontend/frontend.log)"

# 6. Wait for Backend readiness
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
echo "=========================================================="
