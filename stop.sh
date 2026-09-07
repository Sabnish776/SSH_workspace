#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  Stopping SSH Workspace Manager Services"
echo "=========================================================="

echo "--> Terminating Spring Boot Backend..."
pkill -f "com.sshworkspace.SshWorkspaceApplication" 2>/dev/null || true
pkill -f "spring-boot:run" 2>/dev/null || true
pkill -f "ssh-workspace-manager" 2>/dev/null || true

echo "--> Terminating Frontend Dev Server..."
pkill -f "vite" 2>/dev/null || true

echo "--> Ensuring ports 8080 & 5173 are released..."
if command -v fuser >/dev/null 2>&1; then
    fuser -k 8080/tcp 2>/dev/null || true
    fuser -k 5173/tcp 2>/dev/null || true
elif command -v lsof >/dev/null 2>&1; then
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true
fi

echo "=========================================================="
echo "  All services have been stopped."
echo "=========================================================="
