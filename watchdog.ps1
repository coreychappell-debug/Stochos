# Stochos Platform Watchdog Script
# Automates checking and restarting R, Shiny, and database services in WSL2.

$logFile = "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\watchdog.log"

function Log-Message($msg) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$timestamp] $msg"
    Write-Host $line
    try {
        Add-Content -Path $logFile -Value $line -ErrorAction Stop
    } catch {
        # Log to host only if log file is locked by another running instance
        Write-Host "  [LOG FILE LOCKED] $line" -ForegroundColor Gray
    }
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
    $wslTest = (wsl -d Ubuntu-22.04 -u root echo "alive" 2>$null).Trim()
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

# 1.1 Start a persistent background keep-alive process on the Windows host
# to prevent WSL from automatically shutting down when idle.
try {
    $keepAlive = Get-CimInstance Win32_Process -Filter "Name = 'wsl.exe'" 2>$null | Where-Object { $_.CommandLine -like "*sleep 1000d*" }
    if (-not $keepAlive) {
        Log-Message "  [INFO] Launching WSL keep-alive background process..."
        Start-Process wsl.exe -ArgumentList "-d Ubuntu-22.04 -u root sleep 1000d" -WindowStyle Hidden
    }
} catch {
    Log-Message "  [WARNING] Failed to verify or start WSL keep-alive: $_"
}

# 2. Check if Docker service is active in WSL
$dockerStatus = (wsl -d Ubuntu-22.04 -u root systemctl is-active docker 2>$null).Trim()
if ($dockerStatus -ne "active") {
    Log-Message "[WARNING] Docker service is inactive ($dockerStatus). Starting docker..."
    wsl -d Ubuntu-22.04 -u root systemctl start docker | Out-Null
    Start-Sleep -Seconds 5
    $dockerStatus = (wsl -d Ubuntu-22.04 -u root systemctl is-active docker 2>$null).Trim()
    Log-Message "Docker service status after start: $dockerStatus"
} else {
    Log-Message "[OK] Docker service is active."
}

# 2.1 Verify Docker daemon is responding to client queries
$dockerReady = $false
for ($i = 1; $i -le 5; $i++) {
    $testDocker = wsl -d Ubuntu-22.04 -u root docker ps -q 2>$null
    if ($LastExitCode -eq 0) {
        $dockerReady = $true
        break
    }
    Log-Message "  -> Docker daemon is starting, waiting 3 seconds (Attempt $i/5)..."
    Start-Sleep -Seconds 3
}

if (-not $dockerReady) {
    Log-Message "[ERROR] Docker daemon is not responding to queries. Skipping container checks to prevent false restarts."
    exit 1
}

# 3. Check and start individual containers with retries to allow startup time
$prodContainers = @("analyst_lab_prod_shiny", "analyst_lab_prod_rstudio", "analyst_lab_prod_rstudio_tyler", "analyst_lab_prod_rstudio_caitlin")
$devContainers = @("shiny_server", "rstudio_server", "rstudio_server_tylercabral")
$postgresContainer = "stochos_postgres"

$composeNeeded = $false
$devComposeNeeded = $false
$postgresNeeded = $false

# Determine retry attempts based on WSL uptime. If WSL booted recently, allow more time for Docker containers to start.
$maxAttempts = 3
try {
    $uptimeRaw = wsl -d Ubuntu-22.04 -u root cat /proc/uptime 2>$null
    if ($uptimeRaw) {
        $uptime = [double]($uptimeRaw.Split(' ')[0].Trim())
        if ($uptime -lt 90) {
            $maxAttempts = 9  # Up to 45 seconds total delay for cold starts
            Log-Message "  [INFO] WSL booted recently (Uptime: $uptime s). Allowing up to 45 seconds for containers to initialize..."
        }
    }
} catch {
    # Fallback to standard 3 attempts if uptime cannot be retrieved
}

$prodDown = @()
$devDown = @()
$postgresDown = $false

for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    $prodDown = @()
    $devDown = @()
    $postgresDown = $false

    foreach ($c in $prodContainers) {
        $rawState = wsl -d Ubuntu-22.04 -u root docker inspect -f '{{.State.Running}}' $c 2>$null
        $isRunning = if ($rawState) { $rawState.Trim() } else { "false" }
        if ($isRunning -ne "true") {
            $prodDown += $c
        }
    }

    foreach ($c in $devContainers) {
        $rawState = wsl -d Ubuntu-22.04 -u root docker inspect -f '{{.State.Running}}' $c 2>$null
        $isRunning = if ($rawState) { $rawState.Trim() } else { "false" }
        if ($isRunning -ne "true") {
            $devDown += $c
        }
    }

    $rawState = wsl -d Ubuntu-22.04 -u root docker inspect -f '{{.State.Running}}' $postgresContainer 2>$null
    $isRunning = if ($rawState) { $rawState.Trim() } else { "false" }
    if ($isRunning -ne "true") {
        $postgresDown = $true
    }

    # If all containers are up and running, we can stop retrying
    if ($prodDown.Count -eq 0 -and $devDown.Count -eq 0 -and -not $postgresDown) {
        break
    }

    if ($attempt -lt $maxAttempts) {
        Log-Message "  [INFO] Some containers are not running yet. Waiting 5 seconds (Attempt $attempt/$maxAttempts)..."
        Start-Sleep -Seconds 5
    }
}

# Determine required corrective actions based on the final check result
if ($prodDown.Count -gt 0) {
    Log-Message "[WARNING] Production containers not running: $($prodDown -join ', '). (Re-check states: raw output empty or false)"
    $composeNeeded = $true
}

if ($devDown.Count -gt 0) {
    Log-Message "[WARNING] Development containers not running: $($devDown -join ', '). (Re-check states: raw output empty or false)"
    $devComposeNeeded = $true
}

if ($postgresDown) {
    Log-Message "[WARNING] PostgreSQL container is not running."
    $postgresNeeded = $true
}

# 4. Perform corrective action
if ($composeNeeded) {
    Log-Message "[RESTART] Restarting R and Shiny Production Docker Compose stack..."
    # Force-remove all containers matching the project name (including short-ID prefixed or crashed leftovers)
    # to bypass the ContainerConfig bug in docker-compose 1.29.2 during container recreation.
    wsl -d Ubuntu-22.04 -u root bash -c "docker ps -a --filter 'name=analyst_lab_prod' -q | xargs -r docker rm -f; cd /home/analyst1/analyst_lab && docker-compose up -d" | Out-Null
    Log-Message "[OK] R and Shiny Production stack restarted."
}

if ($devComposeNeeded) {
    Log-Message "[RESTART] Restarting R and Shiny Development Docker Compose stack..."
    # Force-remove all dev R/Shiny containers (including leftovers) to bypass the ContainerConfig bug.
    wsl -d Ubuntu-22.04 -u root bash -c "docker ps -a --filter 'name=shiny_server' -q | xargs -r docker rm -f; docker ps -a --filter 'name=rstudio_server' -q | xargs -r docker rm -f; cd /home/coreychappell/analyst_lab && docker-compose up -d" | Out-Null
    Log-Message "[OK] R and Shiny Development stack restarted."
}

if ($postgresNeeded) {
    Log-Message "[RESTART] Starting PostgreSQL container..."
    wsl -d Ubuntu-22.04 -u root docker start stochos_postgres | Out-Null
    Log-Message "[OK] PostgreSQL container started."
}

# 5. Check if Shiny port 3838 (Production) is responding
if (-not $composeNeeded) {
    $shinyUrl = "http://localhost:3838/"
    $shinyOk = $false
    for ($pAttempt = 1; $pAttempt -le 3; $pAttempt++) {
        try {
            $response = Invoke-WebRequest -Uri $shinyUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $shinyOk = $true
            break
        } catch {
            if ($pAttempt -lt 3) {
                Start-Sleep -Seconds 3
            }
        }
    }
    if ($shinyOk) {
        Log-Message "[OK] Shiny server (Production) is responding on port 3838."
    } else {
        Log-Message "[ERROR] Shiny port 3838 is not responding after retries. Restarting production Shiny container..."
        wsl -d Ubuntu-22.04 -u root docker restart analyst_lab_prod_shiny | Out-Null
    }
}

# 5.1 Check if Shiny port 3535 (Development) is responding
if (-not $devComposeNeeded) {
    $devShinyUrl = "http://localhost:3535/"
    $devShinyOk = $false
    for ($pAttempt = 1; $pAttempt -le 3; $pAttempt++) {
        try {
            $response = Invoke-WebRequest -Uri $devShinyUrl -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
            $devShinyOk = $true
            break
        } catch {
            if ($pAttempt -lt 3) {
                Start-Sleep -Seconds 3
            }
        }
    }
    if ($devShinyOk) {
        Log-Message "[OK] Shiny server (Development) is responding on port 3535."
    } else {
        Log-Message "[ERROR] Shiny port 3535 is not responding after retries. Restarting development Shiny container..."
        wsl -d Ubuntu-22.04 -u root docker restart shiny_server | Out-Null
    }
}

# 6. Check if Next.js port 3000 is active and healthy (using HTTP health check)
$nextResponding = $false
try {
    # 6.1 Run a quick TCP pre-check to avoid slow timeouts if server is completely offline
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $connect = $tcpClient.BeginConnect("127.0.0.1", 3000, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(1000, $false)
    $tcpConnected = $false
    if ($wait) {
        $tcpClient.EndConnect($connect)
        $tcpConnected = $true
    }
    $tcpClient.Close()

    if ($tcpConnected) {
        # 6.2 Execute HTTP GET query to the public health check endpoint
        $healthUrl = "http://localhost:3000/api/health/"
        $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5 -ErrorAction Stop
        
        if ($response -and $response.status -eq "healthy") {
            $nextResponding = $true
            Log-Message "[OK] Next.js platform is healthy on port 3000 (Database Connected, Schema Synced)."
        } else {
            Log-Message "[WARNING] Next.js platform health status returned: $($response.status). Restarting..."
        }
    } else {
        Log-Message "[WARNING] Next.js platform is NOT responding on port 3000 (TCP Offline). Attempting to start it..."
    }
} catch {
    Log-Message "[WARNING] Next.js health check failed: $_. Attempting to restart..."
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
