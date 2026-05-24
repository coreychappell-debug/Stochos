# Stochos — Startup Runbook (Test Environment)

**Last Updated:** 2026-05-17  
**Purpose:** Step-by-step procedures for starting and stopping the Stochos test environment.

> [!NOTE]
> This runbook covers the **test environment** running on a Windows workstation via WSL2. For the daily 10-point verification checklist, see [OPERATIONS.md §13](../stochos-platform/OPERATIONS.md#13-daily-startup-and-verification-checklist).

---

## Full System Startup

Use after a Windows reboot or when all services are stopped.

### Step 1: Verify WSL2 Is Running
```powershell
wsl --list --verbose
# Expected: Ubuntu-22.04 = Running
```

### Step 2: Start Platform Database
```powershell
wsl -d Ubuntu-22.04 -- docker start stochos_postgres

# Verify
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres pg_isready -U stochos
# Expected: accepting connections
```

> The `stochos_postgres` container has `--restart unless-stopped`, so it should auto-start with WSL2. This step is a verification.

### Step 3: Start Analytics Stack
```powershell
# If analytics containers are not set to auto-restart:
wsl -d Ubuntu-22.04 -- sh -c "cd ~/analyst_lab && docker compose up -d"
```

### Step 4: Verify All Containers
```powershell
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output should show:
- `stochos_postgres` — Up — `0.0.0.0:5433->5432/tcp`
- `rstudio_server` — Up — `0.0.0.0:8787->8787/tcp`
- `shiny_server` — Up — `0.0.0.0:3838->3838/tcp`

### Step 5: Start Platform Application
```powershell
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
# Server starts on http://localhost:3000
```

### Step 6: Verify Services
- **Platform:** http://localhost:3000 → login page
- **RStudio:** http://localhost:8787 → RStudio login
- **Shiny:** http://localhost:3838 → Shiny app index

---

## Platform-Only Startup

Use when analytics stack is already running and you only need the platform.

```powershell
# 1. Ensure PostgreSQL is running
wsl -d Ubuntu-22.04 -- docker start stochos_postgres

# 2. Start Next.js
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
```

---

## Full System Shutdown

### Graceful Shutdown
```powershell
# 1. Stop Next.js (Ctrl+C in terminal)

# 2. Stop platform database
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres

# 3. Stop analytics stack
wsl -d Ubuntu-22.04 -- sh -c "cd ~/analyst_lab && docker compose stop"
```

### Emergency Shutdown
```powershell
wsl --shutdown
# This stops ALL WSL2 processes and containers immediately
```

---

## Platform-Only Shutdown

```powershell
# Stop Next.js (Ctrl+C)
# Optionally stop PostgreSQL:
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
```

The analytics stack continues operating independently.
