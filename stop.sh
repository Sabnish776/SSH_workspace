#!/usr/bin/env bash

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=== Stopping Frontend & Backend Processes ==="
pkill -f "spring-boot-maven-plugin" || true
pkill -f "ssh-workspace-manager-backend" || true
pkill -f "vite" || true

echo "=== Stopping Docker Containers ==="
docker compose stop

echo "All services stopped."
