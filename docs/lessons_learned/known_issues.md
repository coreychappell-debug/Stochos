# Stochos — Known Issues and Lessons Learned

**Last Updated:** 2026-05-17  
**Purpose:** Documents resolved issues, architectural decisions made under pressure, and gotchas that future developers must be aware of.

---

## 1. Prisma v7 + Next.js Edge Runtime Incompatibility

**Date discovered:** 2026-05-17  
**Severity:** Blocking (prevented application startup)  
**Status:** Resolved

### Problem

The initial route protection middleware (`middleware.js`) imported the `auth` function from `lib/auth.js`, which transitively imported:

```
middleware.js → lib/auth.js → lib/db.js → @prisma/adapter-pg → Node.js crypto module
```

Next.js middleware runs in **Edge Runtime** (a lightweight V8 isolate). Edge Runtime does not support Node.js built-in modules (`crypto`, `net`, `tls`). The PrismaPg adapter requires these modules for PostgreSQL wire protocol communication.

### Error

```
Module not found: Can't resolve 'crypto'
```

### Root Cause

Prisma v7's mandatory driver adapter (`@prisma/adapter-pg`) is incompatible with Edge Runtime. Any import chain that reaches the adapter will fail in middleware.

### Resolution

Redesigned middleware to be completely standalone — no Prisma imports, no auth library imports. The middleware performs only a lightweight cookie-presence check:

```javascript
// middleware.js — Edge-compatible
const sessionToken =
  request.cookies.get("authjs.session-token")?.value ||
  request.cookies.get("__Secure-authjs.session-token")?.value;

if (!sessionToken) {
  return NextResponse.redirect(new URL("/login", request.url));
}
```

Full session validation (database queries, role checking, permission enforcement) happens in server components via the `auth()` function, which runs in the Node.js runtime.

### Design Principle

> **Middleware must remain thin and Edge-compatible.** Never import database clients, ORMs, or Node.js-dependent libraries into Next.js middleware.

---

## 2. Prisma v7 Breaking Changes from v6

**Date discovered:** 2026-05-17  
**Severity:** Medium (required multiple code adjustments)  
**Status:** Resolved

### Changes Encountered

| Change | v6 Pattern | v7 Pattern |
|--------|-----------|-----------|
| Datasource URL | `url = env("DATABASE_URL")` in schema | URL provided via `prisma.config.ts` only |
| Client construction | `new PrismaClient()` | `new PrismaClient({ adapter })` with `PrismaPg` |
| Seed configuration | `package.json: prisma.seed` | `prisma.config.ts: migrations.seed` |
| Seed script | Uses bare `PrismaClient()` | Must construct own `PrismaPg` adapter |

### Resolution

- Schema `datasource` block contains only `provider = "postgresql"`
- `prisma.config.ts` provides URL via `dotenv/config` and `defineConfig()`
- Both `prisma.config.ts` and `package.json` define seed command (belt-and-suspenders)
- `lib/db.js` and `prisma/seed.js` both construct `PrismaPg` adapters independently

---

## 3. npm Script-Shell Misconfiguration on Windows

**Date discovered:** 2026-05-17  
**Severity:** Low (development environment only)  
**Status:** Resolved

### Problem

npm attempted to use a Python path (`C:\Users\corey\AppData\Local\Programs\Python\Python314\Scripts`) as the `ComSpec` / script shell, likely due to a PATH ordering conflict on Windows.

### Resolution

```powershell
npm config set script-shell "C:\Windows\System32\cmd.exe"
```

### Note

This must be verified on any new development machine. The npm config is per-user and does not transfer with the project.

---

## 4. PowerShell Execution Policy for npm

**Date discovered:** 2026-05-17  
**Severity:** Low  
**Status:** Resolved

npm scripts require `RemoteSigned` execution policy:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

Without this, npm scripts fail silently or with permission errors on Windows.

---

## 5. Next.js Static Generation vs. Dynamic Rendering

**Date discovered:** 2026-05-17  
**Severity:** Medium (build failures)  
**Status:** Resolved

### Problem

Next.js attempts to statically generate pages at build time by default. Pages that query PostgreSQL via Prisma fail during `npm run build` because the database may not be available at build time.

### Resolution

All database-backed server component pages include:

```javascript
export const dynamic = 'force-dynamic';
```

This forces server-side rendering at request time instead of static generation at build time.

### Future Consideration

When moving to production, consider using `generateStaticParams` for known routes and `revalidate` for cached dynamic routes instead of blanket `force-dynamic`.

---

## 6. DuckDB Concurrent Write Risk

**Date discovered:** Pre-platform (established doctrine)  
**Severity:** High (potential data corruption)  
**Status:** Mitigated by operational discipline

### Problem

DuckDB is an embedded database that does not support concurrent write sessions. If two processes (e.g., a Python ETL script and an interactive R session) attempt to write simultaneously, one will fail or data corruption may occur.

### Mitigation

- ETL scripts run on scheduled intervals, not continuously
- R/Shiny analytics layer operates in read-only mode
- Documented in DuckDB operations as a hard rule
- No automated enforcement exists — this is an operational discipline requirement

### Future Consideration

If concurrent write pressure increases, consider adding file-level locking or migrating write-heavy workflows to PostgreSQL per the `SYSTEM_OF_RECORD.md` authority map.

---

## 7. npm Must Run From Project Directory

**Date discovered:** 2026-05-18  
**Severity:** Low (operator error, not a code bug)  
**Status:** Documented

### Problem

Running `npm run dev` from the Windows home directory (`C:\Users\corey\`) instead of from the `stochos-platform/` directory produces:

```
npm error code ENOENT
npm error syscall open
npm error path C:\Users\corey\package.json
npm error enoent Could not read package.json
```

This is because npm looks for `package.json` in the current working directory. There is no `package.json` in the user's home folder.

### Resolution

Always `cd` into the project directory first:

```powershell
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
```

### Note

This error was encountered during the first formal walkthrough of the daily startup checklist (OPERATIONS.md §13). A warning callout was added to the checklist to prevent recurrence. This is a common Node.js gotcha for operators who are not regular Node.js developers.

---

## 8. WSL2 Idle Auto-Shutdown stops background Docker Containers

**Date discovered:** 2026-05-24  
**Severity:** High (caused complete service downtime when the system was idle)  
**Status:** Resolved

### Problem

Even though Docker systemd and containers were configured to run and restart automatically inside WSL2, the entire WSL2 VM would shut down when the local Windows workstation was left idle or after all interactive Windows shell sessions running `wsl.exe` were closed. This caused the platform's transactional DB (`stochos_postgres`) and R/Shiny analytics containers to stop responding.

### Root Cause

By design, WSL2 is a utility VM that automatically stops itself after 60 seconds of idle host command shell activity to conserve Windows system memory. Background systemd services running inside the VM do NOT count as active command shell connections, meaning WSL2 will shutdown regardless of active containers.

### Resolution

Implemented a persistent keep-alive client process running in a hidden window on the Windows host. The watchdog script `watchdog.ps1` checks for this process and, if missing, starts it:
```powershell
Start-Process wsl.exe -ArgumentList "-d Ubuntu-22.04 -u root sleep 1000d" -WindowStyle Hidden
```
This keeps a single persistent shell wrapper active indefinitely on the Windows host, preventing WSL2 from initiating its idle timeout shutdown.

---

## 9. Docker Compose `ContainerConfig` recreation bug (Compose v1)

**Date discovered:** 2026-05-25  
**Severity:** High (prevented Docker container updates and restarts)  
**Status:** Bypassed

### Problem

Executing `docker-compose up -d` or `--force-recreate` returned a blocking exception:
```
KeyError: 'ContainerConfig'
```
This prevented the automated watchdog or administrators from starting or updating existing containers that were already present in the Docker daemon, leaving services in a stopped or partially renamed state (e.g., prefixing containers with a short-ID like `a45c7b_analyst_lab_prod_shiny`).

### Root Cause

This is a known bug in Docker Compose v1 (v1.29.2, which is installed inside Ubuntu-22.04) when communicating with newer versions of Docker Engine (v29.1.3+). The old Compose client fails to parse newer engine schema definitions of `ContainerConfig` when attempting to converge/recreate existing containers.

### Resolution

To bypass this behavior without doing a major version upgrade of Docker Compose (which would impact existing scripts and operational setup), the watchdog task was updated to force-remove existing container instances prior to calling Compose up:
```bash
docker ps -a --filter "name=analyst_lab_prod" -q | xargs -r docker rm -f
cd /home/analyst1/analyst_lab && docker-compose up -d
```
Deleting the old container metadata completely bypasses the Compose convergence phase and forces a clean build from scratch, avoiding the `ContainerConfig` parser error.

---

## 10. Google Drive Sync I/O Deadlock during Large Backups

**Date discovered:** 2026-06-02  
**Severity:** High (caused total server and filesystem hang)  
**Status:** Resolved

### Problem

When backing up the 21+ GB analytical databases and workspaces, copying the files directly into the active Google Drive synchronized folder triggered complete system deadlocks. The WSL VM and Windows host disk I/O would spike to 100% and freeze.

### Root Cause

The Google Drive cloud client immediately detects new writes in the synced folder and attempts to lock the file to calculate hashes and start chunk uploads. It does this *while* the backup script is still actively writing, causing file system access contentions and deadlocks between the host and WSL virtual disk mount.

### Resolution

Modified `/usr/local/bin/stochos-backup` to stage all writes through an un-synced temporary workspace directory (`C:\stochos_backup_temp` or `/mnt/c/stochos_backup_temp`). Once compression and compilation are 100% complete and closed, the backup performs a sub-millisecond atomic rename (`mv`) into the target synced directory. Google Drive only sees the file after it is fully written.

---

## 11. WSL2 Docker Credential Helper Exec Format Error (Error 125)

**Date discovered:** 2026-06-03  
**Severity:** Medium (blocked docker run/pull operations inside WSL)  
**Status:** Resolved

### Problem

Running `docker run` or `docker pull` inside WSL2 Ubuntu terminal returned execution error `125` indicating a script execution error.

### Root Cause

The user's home or root Docker configuration (`/root/.docker/config.json`) was generated with a credential helper bridge pointing to the Windows Host `docker-credential-desktop.exe` binary. Since WSL runs in a pure Linux environment, attempting to execute the Windows `.exe` helper natively causes an exec format error, crashing the docker command process.

### Resolution

Renamed or backed up the `/root/.docker/config.json` configuration file, which disables the credential helper bridge. The Linux Docker daemon now executes standard registry queries directly.

---

## 12. OSRM Profile Resolution Error in Compiler Containers

**Date discovered:** 2026-06-03  
**Severity:** Medium (prevented local OSRM road graph compilation)  
**Status:** Resolved

### Problem

Executing the map compiler container (`osrm/osrm-backend`) with the profile argument `/profile/car.lua` crashed instantly, reporting that the script file was missing.

### Root Cause

Legacy documentations reference the car profile path at `/profile/car.lua` inside the container image, but newer versions of `osrm/osrm-backend` have updated the internal container structure, relocating the car profile template to `/opt/car.lua`.

### Resolution

Updated `setup_local_osrm.ps1` to mount and call `/opt/car.lua` for the OSRM compiler containers.

---

## 13. DuckDB User Reading Crashes during Ingest Refreshes

**Date discovered:** 2026-06-04  
**Severity:** High (crashed active user dashboards during data syncs)  
**Status:** Resolved

### Problem

When the automated pipeline executed daily or weekly lottery log refreshes to the DuckDB analytical warehouse, active users viewing the dashboards faced query timeouts or crash exceptions.

### Root Cause

DuckDB does not support concurrent write transactions on a single file due to its single-writer design. Running updates directly on the active database locks the file. When analytical readers (Shiny dashboards) attempt to read during this write lock, they crash.

### Resolution

Implemented a **Blue-Green Database Staging Swap** inside the `ny_duckdb_refresh.py` script. The ingestion script now performs all writes and compilations into a temporary staging database file (`stochos_lottery_temp.duckdb`). Once finalized and closed, it replaces the active `stochos_lottery.duckdb` file via a sub-millisecond atomic rename (`mv -f`). Active readers experience zero interruptions.

---

## 14. CRM Retailer Sync Timeout/Latency in Cloud Environments

**Date discovered:** 2026-06-04  
**Severity:** Medium (caused database timeouts when syncing larger datasets)  
**Status:** Resolved

### Problem

Syncing metadata (e.g. county, DMA, service center information) for 13,000+ New York lottery retailers from the analytical warehouse to the operational PostgreSQL database took minutes and risked connection timeouts.

### Root Cause

The initial sync script queried the list from DuckDB and ran updates in a row-by-row looping pattern (e.g. `UPDATE crm_retailers SET county = ... WHERE external_id = ...` inside a loop of 13,000 iterations). This generated massive database network overhead and transaction logging.

### Resolution

Refactored `sync_crm_retailers.py` to use a temporary staging table pattern. It bulk loads the 13,000+ metadata rows into PostgreSQL (`CREATE TEMP TABLE temp_retailer_sync`) in a single query via `psycopg2.extras.execute_values`, then runs a single set-based update:
```sql
UPDATE crm_retailers AS r
SET 
    county = t.county,
    dma = t.dma,
    service_center = t.service_center
FROM temp_retailer_sync AS t
WHERE r.external_id = t.external_id;
```
This optimization reduced total sync runtime from minutes to under 1.5 seconds.

---

## 15. Holt-Winters 30x Forecasting Underestimation (Daily-to-Monthly Grouping Mismatch)

**Date discovered:** 2026-06-13  
**Severity:** High (caused forecasts to show ~$106M instead of ~$2.1B)  
**Status:** Resolved

### Problem

When applying predictive forecasting for draw games, the cumulative 12-month outlook was underestimating sales by a factor of 30x.

### Root Cause

The database timeseries table `mart_ny_game_timeseries` aggregates lottery sales daily (`YYYY-MM-DD`). However, the Holt-Winters exponential smoothing model assumes monthly data buckets (period $L=12$ months). Running the model directly on daily records made it forecast the next 12 *days* of revenue instead of the next 12 *months*.

### Resolution

Modified the timeseries aggregation client-side in the forecasting engine and the planner pre-calculator loop to group daily records by calendar month (`YYYY-MM`) before running the forecasting model. Mapped dates to `"YYYY-MM-01"` to ensure correct monthly sorting, resulting in correct billions-range annual sales estimates.

---

## 16. Omitted Sales in Consolidated Budget (Scenario Product Alignment)

**Date discovered:** 2026-06-13  
**Severity:** Medium (caused Cash 4 Life sales to be left out of the budget)  
**Status:** Resolved

### Problem

Cash 4 Life sales (~$111.4M) were missing from the compiled master budget rollup, even though it was active in the product catalog.

### Root Cause

Cash 4 Life was activated in the product catalog *after* the initial draw scenario had been seeded in the database. Because scenarios were not dynamically kept in sync with the active products list, Cash 4 Life was omitted from the scenario, and consequently, from the budget rollup queries.

### Resolution

Executed a database migration script to align all existing scenarios, and updated the `GET /api/draw-games` endpoint to dynamically verify and insert any missing active products into the scenario on-the-fly, ensuring the compiler always receives the full product line. We also updated the budget rollup and commentary engines to fallback gracefully to the first available scenario if `"Base Plan"` is missing.

---

## 17. DuckDB View-Table Compile Dependency Constraint

**Date discovered:** 2026-06-15  
**Severity:** High (failed weekly database refresh job)  
**Status:** Resolved

### Problem

The weekly database normalization job (`ny_duckdb_refresh.py`) crashed with the following error during database build:
```
_duckdb.CatalogException: Catalog Error: Table with name ny_retailer_dim does not exist!
Did you mean "ny_retailer_risk_history"?
LINE 36:             JOIN ny_retailer_dim r ON r.retailer_id = h.retailer_id
```

### Root Cause

In PostgreSQL or other database systems, view compilation demands only syntactical correctness, deferring binding until execution. In DuckDB, view creation (`CREATE OR REPLACE VIEW`) demands that all referenced tables (specifically `ny_retailer_dim` here) exist at compile-time. Because view compilation was placed before the `ny_retailer_dim` table creation block in `build_dimensions()`, the engine threw a catalog exception.

### Resolution

Relocated the view creation statement `CREATE OR REPLACE VIEW ny_retailer_risk_current` to the end of the `build_dimensions()` function, ensuring that all dependent tables (specifically `ny_retailer_dim`) are created and populated beforehand.

---

## 18. Ingestion CPU Starvation & Operational Database Query Slowdowns

**Date discovered:** 2026-06-22  
**Severity:** Medium (caused operational query timeouts up to 6.5s)  
**Status:** Resolved

### Problem

During the weekly maintenance run, Next.js and PostgreSQL logged several `Slow Database Query` warnings (ranging from 1s to 6.5s) and the client dashboard suffered intermittent query delays.

### Root Cause

Ingesting the 3.1 GB daily sales CSV via DuckDB's multi-threaded `read_csv_auto` parser defaults to saturating all available CPU cores (pegging CPU usage at 1200% across 12 cores). This heavy resource contention starved the operational Next.js server and PostgreSQL container of CPU cycles, causing active queries to block and slow down.

### Resolution

Added a thread-limiting instruction (`con.execute("SET threads = 4;")`) inside the DuckDB pipeline ETL scripts right after establishing the connection. Limiting DuckDB to 4 cores leaves the remaining 8 cores fully open for Next.js, PostgreSQL, and other background tasks, ensuring responsive query runtimes during ingestion.

---

## 19. EWS Pipeline Container Shutdown Collision

**Date discovered:** 2026-06-22  
**Severity:** Low (triggered false-positive pipeline alerts)  
**Status:** Mitigated

### Problem

The automated Early Warning System (EWS) pipeline cron job reported intermittent `EWS Risk Pipeline Failure` alerts.

### Root Cause

The EWS cron job executes inside the active `analyst_lab_prod_shiny` Docker container. The weekly server maintenance job begins at the same time and executes `docker-compose down` to stop and remove all analytics containers. When the container was stopped mid-run, the EWS script process received a SIGTERM/SIGKILL, causing the cron executor to exit with an error code and trigger an alarm.

### Mitigation

The EWS pipeline self-heals as soon as the maintenance finishes and the containers are spun back up by the system. System operators should expect brief intermittent failures during the 2 AM PDT weekly maintenance window. For future deployment, we plan to schedule the weekly server maintenance and the EWS cron job with a 30-minute safety offset.



