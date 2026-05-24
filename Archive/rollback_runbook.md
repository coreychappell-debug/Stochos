# Stochos — Rollback Runbook

**Last Updated:** 2026-05-17  
**Purpose:** Procedures for stopping, removing, or rolling back the Stochos platform layer without affecting the analytics stack.

---

## Rollback Levels

| Level | What It Does | Data Impact | Reversible? |
|-------|-------------|-------------|-------------|
| **Level 1: Stop** | Stop platform services | None — all data preserved | Yes |
| **Level 2: Remove Container** | Remove PostgreSQL container | None — volume preserved | Yes |
| **Level 3: Remove Volume** | Delete PostgreSQL data volume | **All database data deleted** | No |
| **Level 4: Full Removal** | Delete project directory + Node.js | **All platform code and data deleted** | No |

---

## Level 1: Stop Platform (Preserves Everything)

```powershell
# Stop Next.js (Ctrl+C in terminal)
# Stop PostgreSQL container
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
```

**To resume:** `docker start stochos_postgres` + `npm run dev`

---

## Level 2: Remove Container (Preserves Data)

```powershell
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
wsl -d Ubuntu-22.04 -- docker rm stochos_postgres
```

The `stochos_pg_data` volume still exists with all data.

**To resume:** Re-run the container creation command from `OPERATIONS.md §2.1`, then `npm run dev`.

---

## Level 3: Remove Data Volume

> [!CAUTION]
> This permanently deletes all PostgreSQL data (contracts, users, vendors, etc.).

```powershell
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
wsl -d Ubuntu-22.04 -- docker rm stochos_postgres
wsl -d Ubuntu-22.04 -- docker volume rm stochos_pg_data
```

**To resume:** Re-create container, `npm run db:push`, `npm run db:seed`.

---

## Level 4: Full Platform Removal

> [!CAUTION]
> This removes the entire platform — code, data, and runtime.

```powershell
# 1. Remove container and volume
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
wsl -d Ubuntu-22.04 -- docker rm stochos_postgres
wsl -d Ubuntu-22.04 -- docker volume rm stochos_pg_data

# 2. Delete project directory
Remove-Item -Recurse -Force "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"

# 3. (Optional) Uninstall Node.js
winget uninstall OpenJS.NodeJS.LTS
```

---

## Post-Rollback Verification

After any rollback level, verify the analytics stack is unaffected:

```powershell
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Status}}"
# Expected: rstudio_server and shiny_server = Up

# Verify ports
Test-NetConnection -ComputerName localhost -Port 8787  # Should succeed
Test-NetConnection -ComputerName localhost -Port 3838  # Should succeed
```

---

## Analytics Stack Impact

**None.** At every rollback level, the analytics stack (RStudio, Shiny, DuckDB) continues operating without interruption. There are no shared volumes, no shared networks, and no shared dependencies between the two stacks.
