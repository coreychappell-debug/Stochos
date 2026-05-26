# Stochos Local Environment Restart Script
# Restarts the Next.js Windows server, checks/restarts WSL, Docker, PostgreSQL, and Shiny Server containers.

$Host.UI.RawUI.WindowTitle = "Stochos Environment Restart Utility"
Clear-Host

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          STOCHOS PLATFORM FULL RESTART UTILITY           " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Stop Next.js Platform running on Windows (Port 3000)
Write-Host "[1/3] Terminating existing Next.js processes on port 3000..." -ForegroundColor Yellow
try {
    $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pid in $pids) {
            Write-Host "  -> Killing Process ID: $pid" -ForegroundColor DarkYellow
            Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  [OK] Next.js process terminated." -ForegroundColor Green
    } else {
        Write-Host "  [OK] No Next.js process active on port 3000." -ForegroundColor Green
    }
} catch {
    Write-Host "  [WARNING] Could not check or terminate port 3000 process: $_" -ForegroundColor Yellow
}

Write-Host ""

# 2. Run the Watchdog Script to restart database and Shiny containers in WSL
Write-Host "[2/3] Running Stochos Watchdog to healthcheck & restart database + R/Shiny stack..." -ForegroundColor Yellow
$watchdogPath = "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.ps1"
if (Test-Path $watchdogPath) {
    & $watchdogPath
} else {
    Write-Host "  [ERROR] Watchdog script not found at: $watchdogPath" -ForegroundColor Red
}

Write-Host ""

# 3. Start Next.js Platform in a new PowerShell window
Write-Host "[3/3] Launching Next.js Platform in a new terminal window..." -ForegroundColor Yellow
$nextDir = "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
if (Test-Path $nextDir) {
    Start-Process powershell.exe -ArgumentList "-NoExit", "-Command", "Set-Location '$nextDir'; Write-Host 'Starting Next.js Server...'; npm run dev"
    Write-Host "  [OK] Next.js server launched. Please review the new terminal window." -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Next.js directory not found at: $nextDir" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Full Environment Restart Sequence Triggered Successfully! " -ForegroundColor Green
Write-Host "Allow 5-10 seconds for R/Shiny to spin up in WSL, then visit:" -ForegroundColor Green
Write-Host "   -> Next.js Web Interface: http://localhost:3000/" -ForegroundColor White
Write-Host "   -> Shiny Server (Direct): http://100.94.253.6:3838/" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
