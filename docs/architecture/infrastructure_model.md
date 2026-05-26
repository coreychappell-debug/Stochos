# Stochos — Infrastructure Model

**Last Updated:** 2026-05-17  
**Purpose:** Documents the physical and virtual infrastructure that supports all Stochos services.

---

## Virtualization Layer

### WSL2 (Windows Subsystem for Linux 2)

All Docker containers run inside **WSL2 Ubuntu 22.04**, not through Docker Desktop.

| Property | Value |
|----------|-------|
| WSL2 Distribution | Ubuntu-22.04 (default, running) |
| WSL Version | 2 |
| Docker Engine | 29.1.3 (native Linux install inside Ubuntu-22.04) |
| Docker Desktop | Installed but **stopped**. Not used for container management. |
| Memory Allocation | Configured in `C:\Users\<user>\.wslconfig` |
| Processor Allocation | Configured in `C:\Users\<user>\.wslconfig` |

**Why not Docker Desktop?** Docker Desktop adds a management layer with licensing requirements and resource abstraction. The Stochos environment uses Docker Engine directly inside WSL2 for simpler, more predictable behavior. Docker Desktop's WSL distro (`docker-desktop`) exists but is stopped.

**Command pattern from Windows:** All Docker commands from PowerShell must be prefixed:
```powershell
wsl -d Ubuntu-22.04 -- docker <command>
```

**WSL2 Idle Auto-Shutdown Keep-Alive:**
By default, WSL2 automatically shuts down the Linux utility VM 60 seconds after all active Windows command prompts or shells (`wsl.exe`) interacting with it exit. This causes background services like native Docker containers and systemd services to stop. 

To prevent this in the Stochos environment, a persistent background client process is launched on the Windows host when the watchdog runs:
```powershell
Start-Process wsl.exe -ArgumentList "-d Ubuntu-22.04 -u root sleep 1000d" -WindowStyle Hidden
```
This hidden process acts as an active client connection, keeping WSL2 and all internal Docker containers continuously running even when no interactive users are logged in.

### Resource Configuration

The `.wslconfig` file (in the Windows user profile) controls:
```ini
[wsl2]
memory=32GB
processors=8
```

Changes require `wsl --shutdown` and WSL restart.

---

## Container Inventory

### Active Containers

| Container | Image | Host Port | Container Port | Volume | Restart Policy | Layer |
|-----------|-------|-----------|----------------|--------|----------------|-------|
| `stochos_postgres` | `postgres:16-alpine` | 5433 | 5432 | `stochos_pg_data` | unless-stopped | Platform |
| `analyst_lab_prod_shiny` | `analyst_lab_prod_shiny` | 3838 | 3838 | `/home/analyst1/analyst_lab/shiny_apps/` | unless-stopped | Analytics (Prod) |
| `analyst_lab_prod_rstudio` | `rocker/tidyverse` | 8787 | 8787 | `/home/analyst1/analyst_lab/` | unless-stopped | Analytics (Prod) |
| `analyst_lab_prod_rstudio_tyler` | `rocker/tidyverse` | 8788 | 8787 | `/home/analyst1/analyst_lab/` | unless-stopped | Analytics (Prod) |
| `analyst_lab_prod_rstudio_caitlin` | `rocker/tidyverse` | 8789 | 8787 | `/home/analyst1/analyst_lab/` | unless-stopped | Analytics (Prod) |
| `shiny_server` | `rocker/shiny-verse` | 3535 | 3838 | `/home/coreychappell/analyst_lab/shiny_apps/` | unless-stopped | Analytics (Dev) |
| `rstudio_server` | `rocker/tidyverse` | 8585 | 8787 | `/home/coreychappell/analyst_lab/` | unless-stopped | Analytics (Dev) |
| `rstudio_server_tylercabral` | `rocker/tidyverse` | 8586 | 8787 | `/home/coreychappell/analyst_lab/` | unless-stopped | Analytics (Dev) |

### Port Allocation Registry

| Port | Service | Layer | Protocol | Notes |
|------|---------|-------|----------|-------|
| 3000 | Next.js Platform | Platform | HTTP | Runs on Windows host (not containerized in dev) |
| 3535 | Shiny Server (Dev Sandbox) | Analytics (Dev) | HTTP | Development Shiny server, no authentication |
| 3838 | Shiny Server (Production) | Analytics (Prod) | HTTP | Production Shiny server, no authentication |
| 5433 | PostgreSQL | Platform | TCP | Main platform database, avoids default 5432 |
| 8585 | RStudio Server (Corey Dev) | Analytics (Dev) | HTTP | Corey's sandbox RStudio environment |
| 8586 | RStudio Server (Tyler Dev) | Analytics (Dev) | HTTP | Tyler's sandbox RStudio environment |
| 8787 | RStudio Server (Corey Prod) | Analytics (Prod) | HTTP | Corey's production RStudio environment |
| 8788 | RStudio Server (Tyler Prod) | Analytics (Prod) | HTTP | Tyler's production RStudio environment |
| 8789 | RStudio Server (Caitlin Prod) | Analytics (Prod) | HTTP | Caitlin's production RStudio environment |

> No ports overlap between the platform and analytics layers.

### Volume Registry

| Volume Name | Owner Layer | Mount Point | Purpose |
|-------------|------------|-------------|---------|
| `stochos_pg_data` | Platform | `/var/lib/docker/volumes/stochos_pg_data/_data` | PostgreSQL persistent data |
| Windows project mounts | Analytics | Various `/mnt/c/...` paths | R projects, Shiny apps |
| DuckDB file | Analytics | `/srv/stochos/data/duckdb/stochos_lottery.duckdb` | Analytical warehouse |

> No shared volumes exist between the platform and analytics layers.

### Network Isolation

| Layer | Docker Network | Containers |
|-------|---------------|------------|
| Platform | Default bridge | `stochos_postgres` |
| Analytics | Compose-defined bridge | `rstudio_server`, `shiny_server` |

These are separate Docker networks. Containers cannot communicate across layers unless explicitly configured.

---

## Host Services (Non-Containerized)

| Service | Runtime | Host | Purpose |
|---------|---------|------|---------|
| Next.js dev server | Node.js 24.15.0 LTS | Windows | Stochos Platform application |
| npm / npx | npm 11.12.1 | Windows | Package management, Prisma CLI |

---

## File System Layout

### WSL2 (Ubuntu 22.04)

```
/srv/stochos/
├── data/
│   ├── duckdb/stochos_lottery.duckdb     # Analytical warehouse
│   └── raw/new_york/                      # Raw source data
├── jobs/
│   └── ny_duckdb_refresh.py               # ETL scripts
└── (Docker volumes managed separately)
```

### Windows Host

```
c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\
└── New York Scripts and Process\
    ├── stochos-platform\                  # Next.js application
    ├── docs\                              # Consolidated documentation
    ├── *.R                                # R analytics scripts
    └── *.txt                              # Legacy documentation
```

---

## Dependency Chain

```
Windows Host
  └── WSL2 (Ubuntu 22.04)
       ├── Docker Engine 29.1.3
       │    ├── stochos_postgres (PostgreSQL 16)
       │    ├── rstudio_server (R + RStudio)
       │    └── shiny_server (R + Shiny)
       └── /srv/stochos/ (DuckDB, raw data, ETL scripts)
  └── Node.js 24.15.0 LTS
       └── Next.js 16.2.6 (Stochos Platform)
```

If WSL2 stops → all Docker containers stop → PostgreSQL, RStudio, and Shiny become unavailable.  
If Docker stops → containers stop, but DuckDB file is unaffected (embedded in R process).  
If Node.js stops → Platform UI is unavailable, but PostgreSQL data is preserved.
