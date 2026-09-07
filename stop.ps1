# SSH Workspace Manager - PowerShell Stop Script
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Stopping SSH Workspace Manager Services (PowerShell)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Terminate listeners on ports 8080 and 5173
@(8080, 5173) | ForEach-Object {
    $port = $_
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            try {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "  Terminated process on port $port (PID: $($conn.OwningProcess))" -ForegroundColor Yellow
            } catch {}
        }
    }
}

# Clean up any lingering processes
Get-Process -Name "java" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*SSH Workspace*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*SSH Workspace*" } | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  All services have been stopped." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
