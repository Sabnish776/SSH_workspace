@echo off
echo ==========================================================
echo   Stopping SSH Workspace Manager Services (Windows)
echo ==========================================================

echo --^> Terminating Spring Boot Backend ^& Node processes on ports 8080 and 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo Terminating PID %%a on port 8080...
    taskkill /f /pid %%a >nul 2>nul
)

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo Terminating PID %%a on port 5173...
    taskkill /f /pid %%a >nul 2>nul
)

echo --^> Cleaning up lingering Java/Node processes if any...
taskkill /f /im java.exe /fi "WINDOWTITLE eq SSH Workspace - Backend*" >nul 2>nul
taskkill /f /im node.exe /fi "WINDOWTITLE eq SSH Workspace - Frontend*" >nul 2>nul

echo ==========================================================
echo   All services have been stopped.
echo ==========================================================
