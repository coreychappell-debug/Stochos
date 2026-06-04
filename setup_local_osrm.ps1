# =============================================================================
# Stochos Platform — Local OSRM Setup Automator (WSL Docker Mode)
# =============================================================================
# Downloads the NY OSM map extract, processes the road graph via WSL Docker, 
# launches the OSRM container, and configures Next.js to use it.
# =============================================================================

$ErrorActionPreference = "Stop"

$workspaceDir = "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process"
$osrmDataDir = Join-Path $workspaceDir "osrm-data"
$envLocalPath = Join-Path $workspaceDir "stochos-platform\.env.local"
$mapUrl = "https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf"
$mapFile = Join-Path $osrmDataDir "new-york-latest.osm.pbf"

# WSL-compatible data path for docker volume mount mapping
$wslDataDir = "/mnt/c/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/osrm-data"

Write-Host "=== Starting Local OSRM Routing Server Setup (WSL Docker) ===" -ForegroundColor Cyan
Write-Host ""

# 1. Create OSRM Directory
if (-not (Test-Path $osrmDataDir)) {
    Write-Host "Creating data directory at: $osrmDataDir..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $osrmDataDir | Out-Null
    Write-Host "  [OK] Directory created." -ForegroundColor Green
} else {
    Write-Host "[OK] Data directory already exists: $osrmDataDir" -ForegroundColor Green
}

# 2. Download NY Map Extract
if (-not (Test-Path $mapFile)) {
    Write-Host "Downloading New York road map data (~250 MB)..." -ForegroundColor Yellow
    Write-Host "This might take a minute or two depending on your connection." -ForegroundColor Gray
    Start-BitsTransfer -Source $mapUrl -Destination $mapFile
    Write-Host "  [OK] Download complete." -ForegroundColor Green
} else {
    Write-Host "[OK] Map data file already exists at: $mapFile" -ForegroundColor Green
}

# 3. Process the Road Network Graph (Docker sequential tasks via WSL)
Write-Host ""
Write-Host "Executing OSRM pre-processing steps via WSL Docker. This will compile the road graph (approx 3-5 mins)..." -ForegroundColor Cyan
Write-Host ""

# Step 3.1: Extract
Write-Host "[1/3] Running OSRM Extract (car profile) inside WSL..." -ForegroundColor Yellow
wsl docker run --rm -t -v "${wslDataDir}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/new-york-latest.osm.pbf
if ($LASTEXITCODE -ne 0) { throw "OSRM Extract failed inside WSL with exit code $LASTEXITCODE" }
Write-Host "  [OK] Extract complete." -ForegroundColor Green

# Step 3.2: Partition
Write-Host "[2/3] Running OSRM Partition inside WSL..." -ForegroundColor Yellow
wsl docker run --rm -t -v "${wslDataDir}:/data" osrm/osrm-backend osrm-partition /data/new-york-latest.osm.pbf
if ($LASTEXITCODE -ne 0) { throw "OSRM Partition failed inside WSL with exit code $LASTEXITCODE" }
Write-Host "  [OK] Partition complete." -ForegroundColor Green

# Step 3.3: Customize
Write-Host "[3/3] Running OSRM Customize inside WSL..." -ForegroundColor Yellow
wsl docker run --rm -t -v "${wslDataDir}:/data" osrm/osrm-backend osrm-customize /data/new-york-latest.osm.pbf
if ($LASTEXITCODE -ne 0) { throw "OSRM Customize failed inside WSL with exit code $LASTEXITCODE" }
Write-Host "  [OK] Road graph customization complete." -ForegroundColor Green

# 4. Stop existing container if running, and start the local routing engine in WSL
Write-Host ""
Write-Host "Launching local OSRM server container inside WSL on port 5001..." -ForegroundColor Yellow

$existingContainer = wsl docker ps -a -q --filter "name=local_osrm"
if ($existingContainer) {
    Write-Host "  -> Removing existing 'local_osrm' container inside WSL..." -ForegroundColor DarkYellow
    wsl docker rm -f local_osrm | Out-Null
}

wsl docker run -d --name local_osrm -p 5001:5000 -v "${wslDataDir}:/data" osrm/osrm-backend osrm-routed --algorithm mld --max-table-size 1000 /data/new-york-latest.osrm
if ($LASTEXITCODE -ne 0) { throw "Failed to start OSRM container inside WSL" }
Write-Host "  [OK] OSRM Server container 'local_osrm' is running in WSL on http://localhost:5001." -ForegroundColor Green

# 5. Configure Next.js environment file (.env.local)
Write-Host ""
Write-Host "Configuring Next.js environment configuration..." -ForegroundColor Yellow

if (Test-Path $envLocalPath) {
    $content = Get-Content $envLocalPath
    if ($content -match "OSRM_URL=") {
        $content = $content -replace "OSRM_URL=.*", "OSRM_URL=`"http://localhost:5001`""
        Set-Content $envLocalPath -Value $content
    } else {
        Add-Content $envLocalPath -Value "`nOSRM_URL=`"http://localhost:5001`""
    }
} else {
    Set-Content $envLocalPath -Value "OSRM_URL=`"http://localhost:5001`""
}

Write-Host "  [OK] .env.local updated with OSRM_URL='http://localhost:5001'." -ForegroundColor Green

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Local OSRM Routing Engine Setup Complete!" -ForegroundColor Green
Write-Host "Next.js routing queries will now run locally and privately." -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
