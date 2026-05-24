# Stochos Master IT Operations Manual

**Document Version:** 1.0  
**Last Updated:** 2026-05-22  
**Purpose:** This is the authoritative, holistic IT operations manual for the entire Stochos Platform ecosystem. It unifies all administrative procedures for the OS, Analytics, Database, and Application layers.

---

## 1. System Architecture Overview

The Stochos ecosystem is composed of three decoupled layers running on a single host machine (or server):

### 1.1 The Operating System Layer
* **Host:** Windows Workstation / Server
* **Hypervisor:** WSL2 (Windows Subsystem for Linux 2) running **Ubuntu-22.04**
* **Container Engine:** Docker Engine (v29.1.3+) runs *natively* inside Ubuntu-22.04. Docker Desktop is explicitly bypassed.

### 1.2 The Analytics Layer
* **DuckDB:** Embedded analytical data warehouse. File-based (`/srv/stochos/data/duckdb/stochos_lottery.duckdb`).
* **Posit (RStudio) Server:** Runs in a Docker container (`rstudio_server` on port 8787).
* **Shiny Server:** Runs in a Docker container (`shiny_server` on port 3838).
* **Automated Pipelines:** R/Python scripts that extract from external APIs and write to DuckDB.

### 1.3 The Application Layer (Stochos Platform)
* **PostgreSQL:** Primary transactional database. Runs in a Docker container (`stochos_postgres` on port 5433).
* **Next.js Server:** Node.js application running natively on the Windows host on port 3000.

---

## 2. Daily Health Checks (Monitoring)

Run this checklist daily to verify full system uptime.

### Step 1: Verify Ubuntu & Docker
Open Windows PowerShell:
```powershell
# Verify Ubuntu is running
wsl --list --verbose

# Verify all containers are UP
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```
*Expected: `stochos_postgres`, `rstudio_server`, and `shiny_server` should show 'Up'.*

### Step 2: Verify Application Services
Open a web browser and ping the following:
* **Next.js Platform:** `http://localhost:3000` (Should show login page)
* **RStudio Server:** `http://localhost:8787` (Should show Posit login)
* **Shiny Server:** `http://localhost:3838` (Should show dashboard index)

---

## 3. Backup and Disaster Recovery

### 3.1 PostgreSQL Backup (Transactional Data)
Run from PowerShell:
```powershell
# Dumps the entire Postgres platform database to a SQL file
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres pg_dump -U stochos stochos_platform > stochos_pg_backup_$(Get-Date -f yyyyMMdd).sql
```

### 3.2 DuckDB & Raw Data Backup (Analytical Data)
Run from within the Ubuntu WSL2 terminal:
```bash
# Backup the DuckDB file
cp /srv/stochos/data/duckdb/stochos_lottery.duckdb /srv/stochos/backups/stochos_lottery_$(date +%Y%m%d).duckdb

# Compress and backup the Raw Data directory
tar czf /srv/stochos/backups/raw_ny_$(date +%Y%m%d).tar.gz /srv/stochos/data/raw/new_york/
```

---

## 4. Patching & Maintenance Procedures

### 4.1 Ubuntu Server Patching
Run monthly inside the Ubuntu WSL2 terminal:
```bash
sudo apt update && sudo apt upgrade -y
```

### 4.2 Docker Image Updates
Run quarterly inside the Ubuntu WSL2 terminal to pull the newest RStudio/Postgres security patches:
```bash
# Pull new images
docker compose pull

# Recreate containers
docker compose up -d --force-recreate

# Prune old images to save disk space
docker system prune -a --volumes
```

### 4.3 Node.js / Application Patching
Run monthly on the Windows Host inside the `stochos-platform` directory:
```powershell
npm audit
npm update
```

---

## 5. Automated Pipeline Management

The Early Warning System and New York Analytics pipelines run on an automated schedule.

### 5.1 On Windows (Task Scheduler)
If orchestrated via PowerShell (`automate_pipeline.ps1`):
1. Open **Windows Task Scheduler**.
2. Locate the "Stochos Pipeline" task.
3. Check the "Last Run Result" column (Must read `0x0`).
4. To modify frequency, right-click -> Properties -> Triggers tab.

### 5.2 On Ubuntu (Cron)
If orchestrated via Bash (`automate_pipeline.sh`):
1. Open the crontab: `crontab -e`
2. Ensure the following line is active (runs every 15 mins):
   `*/15 * * * * /path/to/automate_pipeline.sh >> /path/to/pipeline_log.txt 2>&1`
3. Check logs for failures: `tail -n 50 /path/to/pipeline_log.txt`

### 5.3 Pipeline Rules (DuckDB Concurrency)
> [!CAUTION]
> **Single-Writer Rule:** DuckDB does not support concurrent write sessions. Do not run interactive ETL pipelines in RStudio while the automated Cron/Task Scheduler pipeline is executing, or database locks/corruption will occur. Read-only operations are perfectly safe to run concurrently.

### 5.4 Self-Healing Watchdog (Automated Recovery)
To guarantee high availability and self-healing for the R/Shiny and PostgreSQL servers, a Windows Task Scheduler task (`StochosPlatformWatchdog`) runs the PowerShell script `watchdog.ps1` every 5 minutes:
1. **WSL Verification:** Checks if the WSL2 Ubuntu-22.04 VM is active; starts it if stopped.
2. **Docker Service Verification:** Verifies the `docker` daemon inside WSL2 systemd is running; starts it if stopped.
3. **Container Verification:** Checks the health of `analyst_lab_shiny_1`, `analyst_lab_rstudio_1`, `analyst_lab_rstudio_tyler_1`, and `stochos_postgres`. Starts or recreates any exited or unresponsive containers.
4. **Port Health Check:** Performs an active HTTP ping to port 3838 (Shiny Server). If it doesn't respond, it automatically restarts the container.
5. **Log File:** Logs all checks and recovery actions to `watchdog.log`.

---

## 6. Dashboard Deployment & Scaling

To safely scale the Stochos Platform to support multiple states (e.g., New York, California, Nebraska), the Analytics layer strictly separates the "Windows Development Sandbox" from the "Ubuntu Production Server". 

**Rule:** Never hard-mount a Windows development folder directly into the production Shiny Server container.

### 6.1 The Universal Deployment Script
A PowerShell deployment robot (`deploy_shiny_app.ps1`) is located in the root `Corey - Code Stuff` directory.

When a data scientist completes a new dashboard in Windows, they use this script to securely push it to production. Follow these exact steps, copying and pasting the commands one line at a time.

#### Step 1: Open PowerShell and Navigate to the Root Folder
Copy and paste this command into PowerShell and press Enter:
```powershell
cd "C:\Users\corey\Downloads\Corey - Code Stuff"
```

#### Step 2: Run the Deployment Script
Copy and paste this command and press Enter:
```powershell
.\deploy_shiny_app.ps1
```

#### Step 3: Answer the 3 Interactive Prompts
Once the script is running, the terminal will pause and ask you three questions.

**Example 1: Deploying the New York Executive Dashboard**
1. **Prompt 1 (Source Folder):** Paste in the exact path to your local Windows development folder and hit Enter.
   * *Example:* `C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process`
2. **Prompt 2 (Main Script):** Type the exact name of your main R file and hit Enter.
   * *Example:* `NY_Executive_Dashboard.R`
3. **Prompt 3 (Target Name):** Type the production name you want it to have on the server (no spaces) and hit Enter.
   * *Example:* `executive`

**Example 2: Deploying the FMU Early Warning System**
1. **Prompt 1 (Source Folder):** `C:\Users\corey\Downloads\Corey - Code Stuff\R test script`
2. **Prompt 2 (Main Script):** `04_shiny_app.R`
3. **Prompt 3 (Target Name):** `ews`

### 6.2 What the Script Does
The script automates the release pipeline:
* It connects to the `\\wsl$\Ubuntu-22.04` file system.
* It creates `/home/analyst1/analyst_lab/shiny_apps/[Target Name]`.
* It copies all local dependencies (DuckDB files, images, modules).
* It **renames** the main script to `app.R` (which is required by Shiny Server).
* **Automated Dependency Resolution:** It uses Regex to parse your `app.R` script, extracts all `library(package)` calls, connects to the Shiny Docker container, and silently installs any missing R packages from CRAN so your app never crashes on boot.
* The dashboard instantly becomes live at `http://localhost:3838/[Target Name]`.

> [!WARNING]
> **System-level dependencies:** The deploy script cannot install system libraries (e.g., GDAL, GEOS, PROJ) required by geospatial R packages like `leaflet` and `sf`. If a dashboard requires these, you must install system dependencies manually first — see §8 below.

---

## 7. Instant Ticket Planner

The Instant Ticket Planner is a database-integrated module for managing fiscal year scratcher game portfolios, vendor pricing, and procurement pipelines.

### 7.1 Architecture
| Component | Technology | Location |
|-----------|-----------|----------|
| Database tables | PostgreSQL (6 tables) | `stochos_platform` database |
| API routes | Next.js API | `app/api/instant-tickets/` |
| Platform pages | Next.js Server Components | `app/instant-tickets/` |
| Standalone planner tool | HTML/JS PWA (reference copy) | `instant-ticket-planner/` |

### 7.2 Database Tables
| Table | Purpose |
|-------|---------|
| `instant_ticket_plans` | Top-level fiscal year plan (sales target, commission rates) |
| `instant_ticket_scenarios` | Scenarios within a plan (Base, Aggressive, etc.) |
| `instant_ticket_games` | Individual scratch games with denomination, units, payout, vendor FK |
| `instant_ticket_game_features` | Features per game (holographic foil, scented ink, etc.) |
| `instant_ticket_marketing_items` | Non-scratcher budget items (POS displays, licensing, etc.) |
| `instant_ticket_vendor_pricing` | Vendor cost models per ticket size |

### 7.3 Vendor Integration
Printing vendors are linked to the existing `vendors` table. The three primary instant ticket vendors:
* **Scientific Games** — % of sales cost model
* **Pollard Banknote** — per-thousand cost model
* **International Game Technology (IGT)** — per-thousand cost model

### 7.4 Access
* **Plan listing:** `http://localhost:3000/instant-tickets`
* **Plan detail:** `http://localhost:3000/instant-tickets/{plan-id}`
* **API:** `GET/POST /api/instant-tickets/plans`, `GET/PUT/DELETE /api/instant-tickets/plans/{id}`

---

## 8. Shiny R Package Manifest

> [!NOTE]
> As of Version 1.1, the Shiny server container builds from a custom `Dockerfile.shiny`. All system-level dependencies (GDAL, GEOS, PROJ) and required R packages are compiled and baked directly into the custom Docker image. Rebuilding or recreating the container will **not** lose these packages.

### 8.1 Active Packages Built into the Image
* **Analytical UI Frameworks:** `shiny`, `shinydashboard`, `shinycssloaders`
* **Visualization & Tables:** `plotly`, `leaflet`, `DT`, `scales`, `htmltools`
* **Data Access & Processing:** `DBI`, `duckdb`, `dplyr`, `tidyr`
* **Geospatial & Spatial Indexing:** `sf`, `s2`

### 8.2 Adding or Updating Dependencies
If a dashboard requires a new R package or system library:
1. Open the [Dockerfile.shiny](file:///home/analyst1/analyst_lab/Dockerfile.shiny) file.
2. Add the package to the appropriate list (`apt-get install` for system libraries, or `install.packages` for CRAN libraries).
3. Rebuild the image:
   ```bash
   wsl -d Ubuntu-22.04 bash -c "cd /home/analyst1/analyst_lab && docker-compose build shiny"
   ```
4. Recreate the container to apply the updated image:
   ```bash
   wsl -d Ubuntu-22.04 bash -c "cd /home/analyst1/analyst_lab && docker-compose up -d --force-recreate shiny"
   ```

### 8.3 Early Warning System (`/ews`)
**R Packages:** Automatically resolved by `deploy_shiny_app.ps1` at runtime if they are standard CRAN packages. If they require system-level compilation libraries, follow the instructions in §8.2.

---

## 9. Change Management — Update Procedures by Component

Each stack component has its own deployment path. This section documents how to make changes to each one and get them into the running system.

### 9.1 Next.js Platform (Application Code)

**What it covers:** Dashboard pages, API routes, sidebar navigation, CSS styling, Instant Ticket Planner UI, Marketing MRM, Contract Management.

**Where the code lives:** `stochos-platform/` directory on Windows.

**How to update:**
1. Edit files in the `stochos-platform/` directory
2. If the dev server is running (`npm run dev`), changes appear immediately (hot reload)
3. If the dev server is stopped, restart it:
```powershell
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
```

**For production builds:**
```powershell
npm run build
npm start
```

> [!NOTE]
> No Docker or WSL2 involvement. The Next.js app runs natively on Windows.

---

### 9.2 PostgreSQL Database (Schema Changes)

**What it covers:** All platform tables — contracts, vendors, products, campaigns, instant ticket plans, users, audit logs.

**Where the schema lives:** `stochos-platform/prisma/schema.prisma`

**How to update:**
1. Edit `schema.prisma` to add/modify models
2. Regenerate the client and push the schema:
```powershell
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npx prisma generate
npx prisma db push
```
3. If seed data is needed, run the appropriate seed script:
```powershell
npx prisma db seed                          # Base platform seed
node prisma/seed-instant-tickets.js         # Instant ticket data
```

> [!WARNING]
> `db push` applies schema changes directly. In production, use `npx prisma migrate` for versioned, reversible migrations.

---

### 9.3 Shiny Dashboards (R Analytics)

**What it covers:** Executive Dashboard, Early Warning System, and any future R/Shiny apps.

**Where the code lives:** Windows development folders (varies per project).

**How to update:**
1. Edit the R script in its Windows development folder
2. Run the universal deployment script:
```powershell
cd "C:\Users\corey\Downloads\Corey - Code Stuff"
.\deploy_shiny_app.ps1
```
3. Follow the 3 interactive prompts (see §6.1)
4. The script copies files to Ubuntu, renames to `app.R`, and auto-installs R packages

**If the container was rebuilt:**
Packages are preserved because they are built into the custom image (see §8).

---

### 9.4 DuckDB Analytical Warehouse

**What it covers:** Historical sales data, retailer dimensions, game dimensions, executive dashboard marts.

**Where the data lives:** `/srv/stochos/data/duckdb/stochos_lottery.duckdb` (inside WSL2)

**How to update:**
* **ETL refresh:** Run the Python ingest scripts (cron-scheduled or manual)
* **Schema changes:** Modify the R/Python scripts that create tables
* **No deployment step** — DuckDB is an embedded file database; changes are immediate

> [!CAUTION]
> **Single-writer rule:** Never run two write sessions to DuckDB simultaneously. Read-only access (Shiny dashboards) is always safe.

---

### 9.5 Docker Containers (Infrastructure)

**What it covers:** PostgreSQL, RStudio Server, Shiny Server containers.

**How to update images:**
```bash
# Inside WSL2 Ubuntu terminal
docker compose pull              # Pull latest images
docker compose up -d --force-recreate   # Recreate containers
```

> [!NOTE]
> The Shiny container uses a custom image. Recreating the container will **not** lose packages. To update dependencies, modify `Dockerfile.shiny` and run `docker compose build`.

**How to temporarily install R packages in a running container (for testing):**
```powershell
wsl -d Ubuntu-22.04 -- docker exec <container_name> Rscript -e "install.packages('package_name', repos='https://cloud.r-project.org')"
```

---

### 9.6 Quick Reference Matrix

| Component | Edit Location | Deploy Command | Restart Required? | Risk on Rebuild |
|-----------|--------------|----------------|-------------------|-----------------|
| **Next.js pages/API** | `stochos-platform/app/` | Hot reload (dev) or `npm run build` | No (hot reload) | None |
| **Database schema** | `prisma/schema.prisma` | `npx prisma db push` | No | None (data persists) |
| **Seed data** | `prisma/seed*.js` | `node prisma/seed-*.js` | No | None |
| **Shiny dashboards** | Windows R scripts | `deploy_shiny_app.ps1` | No (auto-detected) | None |
| **DuckDB warehouse** | Python/R ETL scripts | Run script directly | No | None (file-based) |
| **Docker containers** | `docker-compose.yml` | `docker compose up -d` | Yes | None (baked into Dockerfile) |
| **Ubuntu OS** | WSL2 terminal | `apt update && apt upgrade` | Sometimes | None |

---

## 10. Version Control and Documentation Backup (Git/GitHub)

### 10.1 Docs-as-Code Philosophy
All Stochos platform code, database schemas, analytical scripts, and **IT procedures/documentation** live in the same Git repository. This ensures that:
1. **Unification:** Version changes to code and documentation happen together.
2. **Backup:** Documentation is backed up on the cloud (GitHub) and not tied to a single local machine.
3. **Change Log:** Every addition or deletion to the runbooks has a timestamped history.

* **Repository URL:** `https://github.com/coreychappell-debug/Stochos`
* **Default Branch:** `main`

### 10.2 Procedure: Pushing Backups to GitHub
Whenever you edit code, scripts, or markdown documentation files under the `New York Scripts and Process` folder:

1. Open a PowerShell terminal in the root directory:
   ```powershell
   cd "C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process"
   ```
2. Check the status of modified files:
   ```powershell
   git status
   ```
3. Stage all changed files and documentation:
   ```powershell
   git add .
   ```
4. Commit the changes locally:
   ```powershell
   git commit -m "Describe what was modified (e.g., Update IT manual rebuild steps)"
   ```
5. Push the backup to the remote GitHub repository:
   ```powershell
   git push
   ```

### 10.3 Deployment Strategy via Git (Target Servers)
For future cloud servers, manual copy-pasting is obsolete. To deploy code or documentation changes to an active server:
1. SSH into the cloud server.
2. Navigate to the project directory:
   ```bash
   cd /srv/stochos/analyst_lab
   ```
3. Pull the latest commits from the main branch:
   ```bash
   git pull origin main
   ```
4. Rebuild the running container stack (if dependencies or compose configuration changed):
   ```bash
   docker compose up -d --build
   ```

