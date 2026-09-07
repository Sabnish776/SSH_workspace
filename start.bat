@echo off
setlocal enabledelayedexpansion

echo ==========================================================
echo   Starting SSH Workspace Manager (Windows)
echo ==========================================================

:: 1. Check Java Prerequisite
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Java is not installed or not in PATH.
    echo Please install Java 21+ (e.g. OpenJDK 21) to run the backend.
    pause
    exit /b 1
)

:: 2. Check Node & NPM Prerequisite
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    echo Please install Node.js 20+ and npm to run the frontend.
    pause
    exit /b 1
)

:: 3. First-time setup: install frontend dependencies if missing
if not exist "%~dp0frontend\node_modules\" (
    echo --^> First-time clone detected: Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
)

:: 4. Clean up stale processes on ports 8080 and 5173
echo --^> Releasing ports 8080 ^& 5173 if busy...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>nul
)

:: 5. Start Spring Boot Backend
echo === 1. Starting Spring Boot Backend (port 8080) ===
cd /d "%~dp0backend"
if exist mvnw.cmd (
    start "SSH Workspace - Backend" /min cmd /c "mvnw.cmd spring-boot:run > backend.log 2>&1"
) else (
    start "SSH Workspace - Backend" /min cmd /c "mvn spring-boot:run > backend.log 2>&1"
)

:: 6. Start React Frontend Dev Server
echo === 2. Starting React Frontend Dev Server (port 5173) ===
cd /d "%~dp0frontend"
start "SSH Workspace - Frontend" /min cmd /c "npm run dev > frontend.log 2>&1"

:: 7. Wait for Backend Readiness
echo.
echo Waiting for backend services to initialize...
for /l %%i in (1,1,30) do (
    curl -s http://localhost:8080/api/auth/login >nul 2>nul
    if !errorlevel! equ 0 (
        echo Backend is READY!
        goto :ready
    )
    timeout /t 1 /nobreak >nul
)

:ready
echo.
echo ==========================================================
echo   SSH Workspace Manager is LIVE!
echo   URL:         http://localhost:5173/
echo   Credentials: admin@example.com / password123
echo ==========================================================
start http://localhost:5173/
