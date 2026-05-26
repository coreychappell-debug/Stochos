# Stochos Platform Watchdog Script
# Automates checking and restarting R, Shiny, and database services in WSL2.

$logFile = "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.log"

function Log-Message($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line
}

# Ensure log directory exists
$logDir = [System.IO.Path]::GetDirectoryName($logFile)
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}

Log-Message "----------------------------------------"
Log-Message "Starting Stochos Watchdog check..."

# 1. Verify WSL is running
try {
    $wslTest = wsl -d Ubuntu-22.04 echo "alive" 2>$null
    if ($wslTest -ne "alive") {
        Log-Message "[WARNING] WSL (Ubuntu-22.04) is NOT responding. Attempting to start it..."
        wsl -d Ubuntu-22.04 -u root echo "booting" | Out-Null
        Start-Sleep -Seconds 5
    }
    Log-Message "[OK] WSL is running."
} catch {
    Log-Message "[ERROR] Failed to check or start WSL: $_"
    exit 1
}

# 2. Check if Docker service is active in WSL
$dockerStatus = wsl -d Ubuntu-22.04 systemctl is-active docker 2>$null
if ($dockerStatus -ne "active") {
    Log-Message "[WARNING] Docker service is inactive ($dockerStatus). Starting docker..."
    wsl -d Ubuntu-22.04 sudo systemctl start docker | Out-Null
    Start-Sleep -Seconds 5
    $dockerStatus = wsl -d Ubuntu-22.04 systemctl is-active docker 2>$null
    Log-Message "Docker service status after start: $dockerStatus"
} else {
    Log-Message "[OK] Docker service is active."
}

# 3. Check and start individual containers
$containers = @("analyst_lab_shiny_1", "analyst_lab_rstudio_1", "analyst_lab_rstudio_tyler_1", "analyst_lab_rstudio_caitlin_1", "stochos_postgres")
$composeNeeded = $false
$postgresNeeded = $false

foreach ($c in $containers) {
    $isRunning = wsl -d Ubuntu-22.04 docker inspect -f '{{.State.Running}}' $c 2>$null
    if ($isRunning -ne "true") {
        Log-Message "[WARNING] Container $c is NOT running (State: $isRunning)."
        if ($c -like "analyst_lab_*") {
            $composeNeeded = $true
        } elseif ($c -eq "stochos_postgres") {
            $postgresNeeded = $true
        }
    }
}

# 4. Perform corrective action
if ($composeNeeded) {
    Log-Message "[RESTART] Restarting R and Shiny Docker Compose stack..."
    # Perform a down/up cycle to avoid ContainerConfig error with older docker-compose versions
    wsl -d Ubuntu-22.04 bash -c "cd /home/analyst1/analyst_lab && docker-compose down && docker-compose up -d" | Out-Null
    Log-Message "[OK] R and Shiny stack restarted."
}

if ($postgresNeeded) {
    Log-Message "[RESTART] Starting PostgreSQL container..."
    wsl -d Ubuntu-22.04 docker start stochos_postgres | Out-Null
    Log-Message "[OK] PostgreSQL container started."
}

# 5. Check if Shiny port 3838 is responding
if (-not $composeNeeded) {
    $shinyUrl = "http://localhost:3838/"
    try {
        $response = Invoke-WebRequest -Uri $shinyUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        Log-Message "[OK] Shiny server is responding on port 3838."
    } catch {
        Log-Message "[ERROR] Shiny port 3838 is not responding. Restarting Shiny container..."
        wsl -d Ubuntu-22.04 docker restart analyst_lab_shiny_1 | Out-Null
    }
}

# 6. Check if Next.js port 3000 is responding
$nextUrl = "http://localhost:3000/"
$nextResponding = $false
try {
    $response = Invoke-WebRequest -Uri $nextUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    $nextResponding = $true
    Log-Message "[OK] Next.js platform is responding on port 3000."
} catch {
    Log-Message "[WARNING] Next.js platform is NOT responding on port 3000. Attempting to start it..."
}

if (-not $nextResponding) {
    # 6.1 Clean up any hung Next.js processes on port 3000
    try {
        $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
            foreach ($procId in $pids) {
                Log-Message "  -> Killing zombie process ID: $procId on port 3000"
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
            Start-Sleep -Seconds 2
        }
    } catch {
        Log-Message "  [WARNING] Failed to clean up port 3000 processes: $_"
    }

    # 6.2 Start Next.js in a hidden background window
    $nextDir = "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
    if (Test-Path $nextDir) {
        Start-Process powershell.exe -WorkingDirectory $nextDir -ArgumentList "-WindowStyle Hidden -Command npm run dev" -PassThru | Out-Null
        Log-Message "[OK] Next.js platform dev server started in the background."
    } else {
        Log-Message "[ERROR] Next.js directory not found at: $nextDir"
    }
}

Log-Message "Stochos Watchdog check complete."
Log-Message "----------------------------------------"
