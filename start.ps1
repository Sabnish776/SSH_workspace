# SSH Workspace Manager - PowerShell Startup Script
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Starting SSH Workspace Manager (Windows PowerShell)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Java
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] Java 21+ is not installed or not in PATH."
    exit 1
}

# 2. Check Node & NPM
if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "[ERROR] Node.js 20+ and npm are not installed or not in PATH."
    exit 1
}

# 3. First-time dependencies
if (-not (Test-Path "$ScriptDir\frontend\node_modules")) {
    Write-Host "--> First-time clone detected: Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location "$ScriptDir\frontend"
    npm install
    Pop-Location
}

# 4. Clean up ports 8080 & 5173
Write-Host "--> Releasing ports 8080 & 5173 if busy..." -ForegroundColor Yellow
@(8080, 5173) | ForEach-Object {
    $port = $_
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "  Terminated process on port $port (PID: $($conn.OwningProcess))" -ForegroundColor Gray
            } catch {}
        }
    }
}

# 5. Start Backend
Write-Host "=== 1. Starting Spring Boot Backend (port 8080) ===" -ForegroundColor Green
$backendMvn = if (Test-Path "$ScriptDir\backend\mvnw.cmd") { "$ScriptDir\backend\mvnw.cmd" } else { "mvn" }
Start-Process -FilePath "cmd.exe" -ArgumentList "/c $backendMvn spring-boot:run > backend.log 2>&1" -WorkingDirectory "$ScriptDir\backend" -WindowStyle Minimized

# 6. Start Frontend
Write-Host "=== 2. Starting React Frontend (port 5173) ===" -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev > frontend.log 2>&1" -WorkingDirectory "$ScriptDir\frontend" -WindowStyle Minimized

# 7. Wait for Backend readiness
Write-Host ""
Write-Host "Waiting for backend services to initialize..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $res = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" -Method GET -TimeoutSec 1 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($res.StatusCode -eq 200 -or $res.StatusCode -eq 405) {
            $ready = $true
            break
        }
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -gt 0) {
            $ready = $true
            break
        }
    }
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SSH Workspace Manager is LIVE!" -ForegroundColor Green
Write-Host "  URL:         http://localhost:5173/" -ForegroundColor Yellow
Write-Host "  Credentials: admin@example.com / password123" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process "http://localhost:5173/"
