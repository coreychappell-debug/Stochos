# Stochos Platform — Test Environment Operations Manual

**Document Version:** 1.1  
**Last Updated:** 2026-05-17  
**Platform Version:** 0.1.0 (Phase 1 — Contract Management Foundation)  
**Environment:** Stochos Test Environment (Development / Validation / Demo)

> [!IMPORTANT]
> **This document governs the Stochos Test Environment only.** This is not a production deployment. The test environment runs on a Windows workstation using Ubuntu-22.04 under WSL2, with Docker running natively inside Ubuntu. It includes the existing RStudio/Shiny/DuckDB analytics stack and the new PostgreSQL/Next.js platform layer. A separate Production Deployment Guide will be created when a specific hosting decision is made.

---

## Table of Contents

1. [Infrastructure Model](#1-infrastructure-model)
2. [PostgreSQL Container Setup](#2-postgresql-container-setup)
3. [Active Container Inventory](#3-active-container-inventory)
4. [Prisma Setup and Schema Workflow](#4-prisma-setup-and-schema-workflow)
5. [Startup and Shutdown Procedures](#5-startup-and-shutdown-procedures)
6. [Environment Variables and Configuration](#6-environment-variables-and-configuration)
7. [Authentication and Session Architecture](#7-authentication-and-session-architecture)
8. [Stack Separation Boundaries](#8-stack-separation-boundaries)
9. [Verification and Testing Walkthrough](#9-verification-and-testing-walkthrough)
10. [Backup and Restore](#10-backup-and-restore)
11. [Rollback and Removal](#11-rollback-and-removal)
12. [Known Issues and Lessons Learned](#12-known-issues-and-lessons-learned)
13. [Daily Startup and Verification Checklist](#13-daily-startup-and-verification-checklist)
14. [Deployment Philosophy](#14-deployment-philosophy)
15. [Environment Classification](#15-environment-classification)

---

## 1. Infrastructure Model

### 1.1 WSL2 + Docker Operational Model

The Stochos platform runs Docker containers through **WSL2 (Windows Subsystem for Linux 2)**, not through Docker Desktop.

**Key facts:**

- **WSL2 Distribution:** Ubuntu-22.04 (default, running)
- **Docker Engine Version:** 29.1.3 (installed natively inside Ubuntu-22.04)
- **Docker Desktop:** Installed but **stopped and unused**. The `docker-desktop` WSL distro exists but is not the active Docker runtime.
- **Docker daemon:** Runs inside the Ubuntu-22.04 WSL2 instance as a native Linux service.

**Why this matters:**

Docker Desktop is a separate product with its own WSL integration layer, licensing requirements, and resource management. The Stochos environment bypasses Docker Desktop entirely by running the Docker Engine directly inside Ubuntu-22.04. This means:

- Docker commands must be prefixed with `wsl -d Ubuntu-22.04 --` when run from Windows PowerShell
- Container lifecycle is managed by the WSL2 Linux init system, not by Docker Desktop
- If Docker Desktop is started, it may attempt to take over Docker socket management — avoid running both simultaneously
- Containers persist across Windows reboots as long as WSL2 auto-starts (which it does by default)

**Verification command:**

```powershell
# From Windows PowerShell — confirm Docker runs via WSL2, not Desktop
wsl -d Ubuntu-22.04 -- docker version --format "Server: {{.Server.Version}}"
# Expected: Server: 29.1.3

# Confirm WSL distro status
wsl --list --verbose
# Expected: Ubuntu-22.04 = Running, docker-desktop = Stopped
```

### 1.2 Host Environment

| Component | Version | Install Method |
|-----------|---------|---------------|
| Node.js LTS | 24.15.0 | `winget install OpenJS.NodeJS.LTS` |
| npm | 11.12.1 | Bundled with Node.js |
| PowerShell ExecutionPolicy | RemoteSigned (CurrentUser) | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` |

> **Note:** Node.js runs on the Windows host (not inside WSL2). The Next.js dev server runs natively on Windows and connects to PostgreSQL inside WSL2 via `localhost:5433`.

---

## 2. PostgreSQL Container Setup

### 2.1 First-Time Creation

The PostgreSQL container was created with a direct `docker run` command through WSL2 — not via `docker compose up`. This is the authoritative creation command:

```powershell
wsl -d Ubuntu-22.04 -- docker run -d \
  --name stochos_postgres \
  --restart unless-stopped \
  -e POSTGRES_DB=stochos_platform \
  -e POSTGRES_USER=stochos \
  -e POSTGRES_PASSWORD=stochos_dev_2026 \
  -p 5433:5432 \
  -v stochos_pg_data:/var/lib/postgresql/data \
  postgres:16-alpine
```

**Parameter reference:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `--name` | `stochos_postgres` | Container identifier |
| `--restart` | `unless-stopped` | Auto-restart on WSL2/Docker restart; stays stopped if manually stopped |
| `-e POSTGRES_DB` | `stochos_platform` | Default database name |
| `-e POSTGRES_USER` | `stochos` | Database superuser |
| `-e POSTGRES_PASSWORD` | `stochos_dev_2026` | Database password (**change for production**) |
| `-p` | `5433:5432` | Host port 5433 → container port 5432 |
| `-v` | `stochos_pg_data:/var/lib/postgresql/data` | Named volume for persistent storage |
| Image | `postgres:16-alpine` | PostgreSQL 16 on Alpine Linux (minimal footprint) |

### 2.2 Docker Compose Reference

A `docker-compose.yml` file also exists in the project root as a declarative reference for the same configuration. It can be used for future container orchestration but was **not** used for the initial deployment. The running container matches this specification:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: stochos_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: stochos_platform
      POSTGRES_USER: stochos
      POSTGRES_PASSWORD: stochos_dev_2026
    ports:
      - "5433:5432"
    volumes:
      - stochos_pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stochos -d stochos_platform"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  stochos_pg_data:
    name: stochos_pg_data
```

### 2.3 Volume Details

| Property | Value |
|----------|-------|
| Volume Name | `stochos_pg_data` |
| Driver | local |
| Mountpoint (inside WSL2) | `/var/lib/docker/volumes/stochos_pg_data/_data` |
| Created | 2026-05-16T20:36:31-07:00 |

This volume is managed entirely by Docker inside WSL2. It is **not** mounted to any Windows host path. Data persists across container restarts and removals (unless the volume is explicitly deleted).

---

## 3. Active Container Inventory

### 3.1 Platform Layer (New)

| Container | Image | Port | Network | Restart Policy | Status |
|-----------|-------|------|---------|----------------|--------|
| `stochos_postgres` | `postgres:16-alpine` | 5433 → 5432 | bridge (default) | unless-stopped | Running |

### 3.2 Analytics Layer (Existing — Unchanged)

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| RStudio Server | rocker/rstudio | 8787 | R development environment |
| Shiny Server | rocker/shiny | 3838 | Dashboard hosting |
| *(varies)* | *(varies)* | *(varies)* | Additional analytics containers |

### 3.3 Port Allocation Map

| Port | Service | Layer | Status |
|------|---------|-------|--------|
| **3000** | Next.js (Stochos Platform) | Platform (new) | Development server |
| **5433** | PostgreSQL | Platform (new) | Container mapped |
| 3838 | Shiny Server | Analytics (existing) | Unchanged |
| 8787 | RStudio Server | Analytics (existing) | Unchanged |

> Port 5433 was deliberately chosen to avoid conflict with any default PostgreSQL installation on port 5432.

### 3.4 Verification Command

```powershell
# Show all running containers with ports
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

---

## 4. Prisma Setup and Schema Workflow

### 4.1 Prisma v7 Architecture

Prisma v7 introduced breaking changes from earlier versions. The key architectural difference is the **mandatory driver adapter pattern**:

- The `datasource` block in `schema.prisma` specifies only `provider = "postgresql"` — no `url` field
- The database URL is provided at runtime through `prisma.config.ts` and environment variables
- The application code uses `@prisma/adapter-pg` (the PrismaPg driver adapter) instead of Prisma's built-in query engine

**File: `prisma.config.ts`**

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

**File: `lib/db.js`** (application-level Prisma client)

```javascript
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Singleton pattern: reuse client during hot reload
const prisma = globalThis.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

### 4.2 Prisma v7 Seed Configuration

Prisma v7 moved the seed command configuration from `package.json` to `prisma.config.ts`. Both locations currently exist for compatibility:

- **`prisma.config.ts`:** `seed: "node prisma/seed.js"` (Prisma v7 canonical location)
- **`package.json`:** `"prisma": { "seed": "node prisma/seed.js" }` (legacy, kept for `npx prisma db seed` compatibility)

The seed script (`prisma/seed.js`) must also use the PrismaPg adapter pattern:

```javascript
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

### 4.3 Schema Push and Seed Workflow

```powershell
# Push schema to PostgreSQL (creates/updates tables, no migration files)
npm run db:push

# Seed reference data (idempotent for roles and jurisdiction, additive for vendors)
npm run db:seed

# Destructive reset: drops all tables, recreates schema, re-seeds
npm run db:reset

# Open visual database editor
npm run db:studio
```

### 4.4 Schema Overview (16 Tables)

**Shared Dimensions:** `jurisdictions`, `products`, `vendors`, `roles`, `users`  
**Contract Management:** `contracts`, `contract_line_items`, `contract_amendments`, `contract_compliance`, `invoices`  
**Marketing MRM:** `campaigns`, `campaign_channels`, `campaign_assets`, `campaign_milestones` *(Expanded in Phase B Steps 3, 4, & 5 with operational flighting, vendor ownership, review workflows, and dependencies)*  
**Workflow:** `approvals`, `audit_log`

See `prisma/schema.prisma` for the complete, authoritative schema definition.

### 4.5 Schema Rollback / Backup Policy

Because the Stochos Test Environment currently relies on `npx prisma db push` (which directly synchronizes the schema without generating versioned migration files), **always create a manual backup of the schema file** before making structural changes.

```powershell
# Create a backup before making changes (e.g., prior to Phase B)
Copy-Item "prisma\schema.prisma" -Destination "prisma\schema.prisma.bak"
```

If a schema update causes unexpected application errors, you can restore the backup and push it again to revert the database structure to its previous state:

```powershell
Copy-Item "prisma\schema.prisma.bak" -Destination "prisma\schema.prisma"
npx prisma db push
```

---

## 5. Startup and Shutdown Procedures

### 5.1 Full Platform Startup

```powershell
# Step 1: Ensure PostgreSQL container is running
wsl -d Ubuntu-22.04 -- docker start stochos_postgres

# Step 2: Verify PostgreSQL is accepting connections
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres pg_isready -U stochos
# Expected: /var/run/postgresql:5432 - accepting connections

# Step 3: Start the Next.js development server
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
# Server starts on http://localhost:3000
```

### 5.2 Platform Shutdown

```powershell
# Step 1: Stop the Next.js dev server
# Press Ctrl+C in the terminal running npm run dev

# Step 2 (optional): Stop PostgreSQL
# Only if you want to free port 5433. Data is preserved.
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
```

### 5.3 Restart After Windows Reboot

PostgreSQL has `--restart unless-stopped`, so it will auto-start when WSL2 initializes. The Next.js dev server must be started manually:

```powershell
# Verify PostgreSQL came back automatically
wsl -d Ubuntu-22.04 -- docker ps --filter name=stochos_postgres

# Start dev server
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
```

---

## 6. Environment Variables and Configuration

### 6.1 File Locations

| File | Purpose | Git-tracked? |
|------|---------|-------------|
| `.env` | Prisma CLI reads `DATABASE_URL` from here | No (in .gitignore) |
| `.env.local` | Next.js runtime reads all variables from here | No (in .gitignore) |
| `prisma.config.ts` | Prisma v7 config (loads dotenv, provides URL to Prisma) | Yes |

### 6.2 Required Variables

| Variable | Location | Value | Purpose |
|----------|----------|-------|---------|
| `DATABASE_URL` | `.env` and `.env.local` | `postgresql://stochos:stochos_dev_2026@localhost:5433/stochos_platform` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | `.env.local` | *(generate with `openssl rand -base64 32`)* | JWT signing key |
| `NEXTAUTH_URL` | `.env.local` | `http://localhost:3000` | Auth callback base URL |
| `NODE_ENV` | `.env.local` | `development` | Runtime mode |

### 6.3 Production Checklist

- [ ] Generate unique `NEXTAUTH_SECRET`
- [ ] Change PostgreSQL password from `stochos_dev_2026`
- [ ] Set `NODE_ENV=production`
- [ ] Update `NEXTAUTH_URL` to production domain
- [ ] Use secrets manager instead of `.env` files

---

## 7. Authentication and Session Architecture

### 7.1 Auth Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Auth Framework | NextAuth.js v5 (beta) | 5.0.0-beta.31 |
| Credential Provider | Email + password | — |
| Password Hashing | bcryptjs (12 rounds) | 3.0.3 |
| Session Strategy | JWT (stateless, cookie-based) | — |

### 7.2 Authentication Flow

1. User navigates to any protected route
2. **Middleware** (`middleware.js`) checks for `authjs.session-token` cookie
3. If no cookie → redirect to `/login` with `callbackUrl` parameter
4. User submits email/password to `/api/auth/callback/credentials`
5. **NextAuth** queries PostgreSQL for user record, verifies bcrypt hash
6. On success: JWT cookie set containing `id`, `role`, `permissions`, `jurisdictionId`
7. Subsequent requests pass through middleware (cookie present) and server components read full session via `auth()`

### 7.3 JWT Session Payload

Every authenticated request carries this session data:

```json
{
  "user": {
    "id": "uuid",
    "email": "admin@stochos.io",
    "name": "Platform Admin",
    "role": "admin",
    "permissions": { "contracts": "write", "analytics": "write", "marketing": "write" },
    "jurisdictionId": "uuid",
    "jurisdictionName": "New York Lottery"
  }
}
```

### 7.4 Middleware Architecture (Edge Runtime)

The route protection middleware runs in Next.js **Edge Runtime** — a lightweight V8 isolate that does **not** support Node.js built-in modules. See [§12.1](#121-prisma-edge-runtime-incompatibility) for the design issue this caused and how it was resolved.

**Current middleware design:**
- Checks only for the presence of the `authjs.session-token` cookie
- Does **not** import Prisma, the PG adapter, or any Node.js-specific modules
- Full session validation and database queries happen in server components

### 7.5 Seed Credentials

| Field | Value |
|-------|-------|
| Email | `admin@stochos.io` |
| Password | `stochos2026` |
| Role | `admin` (full write access to all modules) |

---

## 8. Stack Separation Boundaries

### 8.1 Isolation Guarantee

The Stochos platform layer and the existing analytics layer are **completely independent**. Neither system has any dependency on the other.

| Boundary | Platform Layer (New) | Analytics Layer (Existing) |
|----------|---------------------|---------------------------|
| **Runtime** | Node.js 24 (Windows host) | R / RStudio (WSL2 container) |
| **Database** | PostgreSQL 16 (Docker container) | DuckDB (file-based, R process) |
| **Ports** | 3000, 5433 | 8787, 3838 |
| **Docker Network** | Default bridge | Existing bridge |
| **Docker Volumes** | `stochos_pg_data` | R project volumes |
| **Data Flow** | No reads from DuckDB | No reads from PostgreSQL |
| **Configuration** | `.env.local`, `prisma.config.ts` | R scripts, Shiny configs |

### 8.2 What Can Be Verified

```powershell
# Confirm no shared Docker networks
wsl -d Ubuntu-22.04 -- docker network inspect bridge --format "{{range .Containers}}{{.Name}} {{end}}"

# Confirm no shared Docker volumes
wsl -d Ubuntu-22.04 -- docker volume ls --format "{{.Name}}"
# stochos_pg_data should be the ONLY volume owned by the platform

# Confirm DuckDB is not referenced in platform code
Select-String -Path "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\lib\*" -Pattern "duckdb" -CaseSensitive:$false
# Expected: No matches (only a commented-out env var in .env.local)
```

### 8.3 Independence Test

Stop the entire platform layer and verify the analytics stack continues operating:

```powershell
# Stop platform
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
# (stop Next.js dev server with Ctrl+C)

# Verify analytics containers still running
wsl -d Ubuntu-22.04 -- docker ps
# RStudio and Shiny containers should be unaffected
```

---

## 9. Verification and Testing Walkthrough

### 9.1 Infrastructure Verification

```powershell
# 1. Confirm PostgreSQL is running and healthy
wsl -d Ubuntu-22.04 -- docker ps --filter name=stochos_postgres
# STATUS should show "Up" with health status

# 2. Confirm PostgreSQL accepts connections
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres pg_isready -U stochos -d stochos_platform
# Expected: accepting connections

# 3. Confirm tables exist
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres psql -U stochos -d stochos_platform -c "\dt"
# Expected: 12 tables listed

# 4. Confirm seed data loaded
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres psql -U stochos -d stochos_platform -c "SELECT COUNT(*) FROM products;"
# Expected: 12
```

### 9.2 Application Verification

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000` — should redirect to `/login`
3. Login with `admin@stochos.io` / `stochos2026`
4. Dashboard should show KPI cards (0 contracts, 7 vendors, 12 products)
5. Navigate to Contracts → New Contract
6. Create a contract with any vendor, save
7. View contract detail page — verify tabs (Overview, Deliverables, Documents, Audit)
8. Navigate to Vendors — verify 7 vendors listed
9. Navigate to Products — verify 12 products listed

### 9.3 Separation Verification

```powershell
# After platform verification, confirm analytics stack is untouched
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Status}}"
# All containers (both stacks) should show healthy status
```

---

## 10. Backup and Restore

### 10.1 Database Backup

```bash
# From WSL2 terminal (or prefix with: wsl -d Ubuntu-22.04 --)
docker exec stochos_postgres pg_dump -U stochos stochos_platform > stochos_backup_$(date +%Y%m%d).sql
```

### 10.2 Database Restore

```bash
cat stochos_backup_20260517.sql | docker exec -i stochos_postgres psql -U stochos stochos_platform
```

### 10.3 Full Volume Backup

```bash
docker run --rm \
  -v stochos_pg_data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/stochos_pg_volume_$(date +%Y%m%d).tar.gz -C /data .
```

---

## 11. Rollback and Removal

### 11.1 Complete Platform Removal

This procedure removes the entire platform layer. The analytics stack is unaffected.

```powershell
# Step 1: Stop and remove the PostgreSQL container
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
wsl -d Ubuntu-22.04 -- docker rm stochos_postgres

# Step 2: Remove the Docker volume (DELETES ALL DATABASE DATA)
wsl -d Ubuntu-22.04 -- docker volume rm stochos_pg_data

# Step 3: Delete the project directory
Remove-Item -Recurse -Force "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"

# Step 4 (optional): Uninstall Node.js from Windows
winget uninstall OpenJS.NodeJS.LTS
```

### 11.2 Post-Rollback Verification

```powershell
# Confirm platform containers gone
wsl -d Ubuntu-22.04 -- docker ps -a --filter name=stochos
# Expected: No results

# Confirm platform volume gone
wsl -d Ubuntu-22.04 -- docker volume ls --filter name=stochos
# Expected: No results

# Confirm analytics containers still running
wsl -d Ubuntu-22.04 -- docker ps
# Expected: RStudio, Shiny, and any other existing containers — healthy

# Confirm ports freed
Test-NetConnection -ComputerName localhost -Port 5433
# Expected: TcpTestSucceeded = False (freed)
```

### 11.3 Partial Rollback (Preserve Data)

To stop the platform without deleting data:

```powershell
# Stop container but preserve volume
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
# Data remains in stochos_pg_data volume
# Restart later with: wsl -d Ubuntu-22.04 -- docker start stochos_postgres
```

---

## 12. Known Issues and Lessons Learned

### 12.1 Prisma Edge Runtime Incompatibility

**Problem:** The initial middleware implementation imported the `auth` function from `lib/auth.js`, which transitively imported `@prisma/client` and `@prisma/adapter-pg`. The PrismaPg adapter uses Node.js built-in modules (`crypto`, `net`, `tls`) that are **not available** in Next.js Edge Runtime.

**Error observed:**
```
Module not found: Can't resolve 'crypto'
  in middleware.js → lib/auth.js → lib/db.js → @prisma/adapter-pg
```

The Next.js middleware runs in Edge Runtime (a lightweight V8 isolate) by default. Edge Runtime supports only Web Standard APIs — not Node.js built-ins.

**Resolution:** The middleware was redesigned to be completely standalone. Instead of importing the full auth stack to validate sessions, it performs a lightweight cookie-presence check:

```javascript
// middleware.js — Edge-compatible, no Prisma imports
import { NextResponse } from "next/server";

export function middleware(request) {
  // Check for NextAuth session cookie — no database query needed
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}
```

Full session validation (including role, permissions, and jurisdiction context) happens in server components via the `auth()` function, which runs in the Node.js runtime where Prisma and the PG adapter are fully supported.

**Design principle:** Middleware must remain thin and Edge-compatible. Never import database clients, ORMs, or Node.js-dependent libraries into middleware.

### 12.2 Prisma v7 Breaking Changes

Prisma v7 introduced several breaking changes from v6 that required adjustments:

1. **No `url` in datasource block:** The `schema.prisma` datasource block must contain only `provider`. The connection URL is provided via `prisma.config.ts`.

2. **Mandatory driver adapter:** Application code must use `@prisma/adapter-pg` explicitly. The old pattern of `new PrismaClient()` without an adapter no longer works.

3. **Seed configuration moved:** The seed command moved from `package.json` (`"prisma": { "seed": "..." }`) to `prisma.config.ts` (`migrations: { seed: "..." }`). Both locations are currently maintained for compatibility.

4. **Seed script requires adapter:** The seed script (`prisma/seed.js`) must also construct its own `PrismaPg` adapter — it cannot use the application's singleton from `lib/db.js` because it runs as a standalone Node.js process.

### 12.3 npm Script-Shell Configuration

On Windows, npm attempted to use a Python path as the `script-shell` (likely from a PATH conflict). This was resolved by explicitly setting:

```powershell
npm config set script-shell "C:\Windows\System32\cmd.exe"
```

This should be verified on any new development machine.

### 12.4 PowerShell Execution Policy

npm scripts require `RemoteSigned` execution policy for the current user:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

Without this, npm scripts fail silently or with permission errors.

### 12.5 Static Generation vs. Dynamic Rendering

Next.js attempts to statically generate pages at build time by default. Pages that query PostgreSQL via Prisma fail during `npm run build` because the database may not be available at build time. All database-backed pages include:

```javascript
export const dynamic = 'force-dynamic';
```

This forces server-side rendering at request time instead of static generation at build time.

---

## Appendix A: Dependency Inventory

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.6 | Full-stack React framework |
| `react` / `react-dom` | 19.2.4 | UI rendering |
| `next-auth` | 5.0.0-beta.31 | Authentication framework |
| `prisma` | 7.8.0 | Schema management, CLI tools |
| `@prisma/client` | 7.8.0 | Database query client |
| `@prisma/adapter-pg` | 7.8.0 | PostgreSQL driver adapter for Prisma v7 |
| `bcryptjs` | 3.0.3 | Password hashing |
| `dotenv` | 17.4.2 | Environment variable loading |
| `uuid` | 14.0.0 | UUID generation |

## Appendix B: Database Table Summary

| Table | Records (Seed) | Purpose |
|-------|----------------|---------|
| `jurisdictions` | 1 (NY) | Multi-lottery scope |
| `products` | 12 | Game/product catalog |
| `vendors` | 7 | Vendor organizations |
| `roles` | 4 | Permission sets |
| `users` | 1 (admin) | Platform accounts |
| `contracts` | 0 | Contract records |
| `contract_line_items` | 0 | Deliverables/budget tracking |
| `contract_amendments` | 0 | Value/date modifications |
| `contract_compliance` | 0 | Document tracking |
| `invoices` | 0 | Payment tracking |
| `approvals` | 0 | Approval workflow |
| `audit_log` | 0 | Mutation history |

---

## 13. Daily Startup and Verification Checklist

Use this checklist each time you start the test environment or need to confirm all services are operational. Every item must pass before the environment is considered ready.

### 13.1 Infrastructure Verification

```powershell
# ┌─────────────────────────────────────────────────────────────────┐
# │  STOCHOS TEST ENVIRONMENT — DAILY STARTUP CHECKLIST           │
# └─────────────────────────────────────────────────────────────────┘

# 1. Confirm Ubuntu-22.04 is running
wsl --list --verbose
# Expected: Ubuntu-22.04 = Running, Version 2

# 2. Confirm Docker is available inside WSL2
wsl -d Ubuntu-22.04 -- docker version --format "Server: {{.Server.Version}}"
# Expected: Server: 29.1.3 (or later)

# 3. Confirm RStudio container is running
wsl -d Ubuntu-22.04 -- docker ps --filter name=rstudio --format "{{.Names}}: {{.Status}}"
# Expected: rstudio_server: Up

# 4. Confirm Shiny container is running
wsl -d Ubuntu-22.04 -- docker ps --filter name=shiny --format "{{.Names}}: {{.Status}}"
# Expected: shiny_server: Up

# 5. Confirm PostgreSQL container is running
wsl -d Ubuntu-22.04 -- docker ps --filter name=stochos_postgres --format "{{.Names}}: {{.Status}}"
# Expected: stochos_postgres: Up

# 6. Confirm PostgreSQL is accepting connections on port 5433
wsl -d Ubuntu-22.04 -- docker exec stochos_postgres pg_isready -U stochos -d stochos_platform
# Expected: accepting connections
```

### 13.2 Application Verification

> [!WARNING]
> **You must `cd` into the `stochos-platform` directory before running `npm run dev`.** Running `npm` from your home directory (`C:\Users\corey\`) will fail with `ENOENT: Could not read package.json` because there is no `package.json` in your home folder. This is the most common startup mistake.

```powershell
# 7. Start Next.js platform (if not already running)
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
# Expected: ✓ Ready on http://localhost:3000
# If port 3000 shows "in use", the server is already running from a previous session.
```

### 13.3 Service Endpoint Verification

| # | Service | URL | Expected |  
|---|---------|-----|----------|
| 7 | Next.js Platform | http://localhost:3000 | Login page (or dashboard if authenticated) |
| 8 | RStudio Server | http://localhost:8787 | RStudio login page |
| 9 | Shiny Server | http://localhost:3838 | Shiny app index or welcome page |

### 13.4 Isolation Verification

| # | Check | How to Verify |
|---|-------|---------------|
| 10 | DuckDB untouched | DuckDB is a file-based database used only by R/Python. It is not accessed by the platform layer. No verification action needed unless an intentional analytics integration test is in progress. |

### 13.5 Quick All-in-One Status Command

```powershell
# Single command to verify all containers
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:
```
NAMES              STATUS       PORTS
stochos_postgres   Up X hours   0.0.0.0:5433->5432/tcp
rstudio_server     Up X hours   0.0.0.0:8787->8787/tcp
shiny_server       Up X hours   0.0.0.0:3838->3838/tcp
```

---

## 14. Deployment Philosophy

### 14.1 Design Goal: Portable Ubuntu Deployment

The Stochos platform is designed to be **as portable as possible**. We do not yet know whether a client will want Stochos to host the full stack, install it on a dedicated Ubuntu server, deploy it to AWS, or operate it in their own environment.

The design goal is a **plug-and-play Ubuntu deployment package** that can be installed on any target without architectural rework.

### 14.2 Portability Requirements

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Containerized services | ✅ | PostgreSQL in Docker; RStudio/Shiny in Docker |
| Clear environment variables | ✅ | `.env` / `.env.local` with documented variables |
| Documented ports | ✅ | Port registry in §3 and infrastructure_model.md |
| Backup and restore scripts | ✅ | pg_dump/restore documented in §10 |
| Isolated volumes | ✅ | Named Docker volumes, no cross-stack mounts |
| Reproducible database migrations | ✅ | Prisma schema + seed script; `db:push` / `db:seed` |
| No hardcoded local paths | ✅ | All paths via environment variables or relative references |
| No dependency on California Lottery servers | ✅ | Zero BIDW/CA references in platform code |
| No dependency on specific lottery schemas | ✅ | Lottery-agnostic schema with optional external_code mapping |
| DuckDB for analytics | ✅ | Read-only analytical warehouse, separate from platform |
| PostgreSQL for transactional records | ✅ | All platform CRUD via Prisma ORM |

### 14.3 What Portability Means in Practice

To deploy Stochos on a new Ubuntu server, the operator needs:

1. **Docker Engine** installed
2. **Node.js LTS** installed
3. The `stochos-platform/` directory (or a git clone)
4. A `.env.local` file with environment-specific values
5. Run: `docker compose up -d` → `npm run db:push` → `npm run db:seed` → `npm run build && npm start`

No Windows, no WSL2, no Docker Desktop required. The test environment uses WSL2 because it runs on a Windows workstation, but the platform itself is Linux-native.

### 14.4 Product Deployment Models

The platform architecture must support three future deployment models without requiring application code changes:

```
┌──────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT MODELS                             │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Model 1: Stochos-Hosted SaaS                                   │
│  ─────────────────────────────                                   │
│  Stochos operates the infrastructure.                            │
│  Client accesses via browser.                                    │
│  Multi-tenant or dedicated instance per client.                  │
│  Stochos manages updates, backups, and uptime.                   │
│                                                                  │
│  Model 2: Client-Hosted Ubuntu Server                            │
│  ────────────────────────────────────                             │
│  Client provides a dedicated Ubuntu server or VM.                │
│  Stochos delivers the deployment package.                        │
│  Client IT manages infrastructure; Stochos provides support.     │
│  Client controls their own data and network.                     │
│                                                                  │
│  Model 3: Stochos-Managed Dedicated Client Server                │
│  ─────────────────────────────────────────────────                │
│  Stochos provisions and manages a dedicated server               │
│  (cloud VPS or on-prem) on behalf of the client.                 │
│  Full Stochos operational control with client data isolation.     │
│  Client pays for hosting + management.                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**The application code is the same across all three models.** Only environment variables, network configuration, TLS termination, and backup automation differ.

### 14.5 What This Runbook Does NOT Cover

This runbook governs the **test environment** only. The following topics are deferred to a future **Production Deployment Guide**:

- AWS, GCP, or Azure-specific configuration
- Managed database services (RDS, Cloud SQL)
- Load balancing and horizontal scaling
- TLS certificate management and HTTPS
- CI/CD pipeline and automated deployments
- Multi-tenant data isolation
- Monitoring, alerting, and SLA management
- Compliance and audit requirements for production data

These decisions will be made intentionally when a specific client deployment model is selected.

---

## 15. Environment Classification

### 15.1 Current Environment

| Property | Value |
|----------|-------|
| **Environment Name** | Stochos Test Environment |
| **Purpose** | Development, validation, demos, controlled testing |
| **Host** | Windows workstation (personal dev machine) |
| **Virtualization** | WSL2 (Ubuntu-22.04) |
| **Container Runtime** | Docker Engine 29.1.3 (native inside WSL2) |
| **Data Classification** | Test / seed data only — no production client data |
| **Access** | Local only (`localhost`) — no external network exposure |
| **SLA** | None — best-effort availability |
| **Backups** | Manual, on-demand |

### 15.2 Environment Lifecycle

| Document | Scope |
|----------|-------|
| **This runbook** (`OPERATIONS.md`) | How to operate the test environment |
| **Future: Production Deployment Guide** | How to install Stochos on a target server (AWS, client Ubuntu, or Stochos-managed) |
| **Future: Production Operations Runbook** | How to operate a production instance (monitoring, backups, incident response) |

### 15.3 Graduation Criteria

Before this environment can be promoted to production or used to serve client data:

- [ ] Generate unique `NEXTAUTH_SECRET` (not the dev placeholder)
- [ ] Change PostgreSQL password from `stochos_dev_2026`
- [ ] Enable TLS termination (HTTPS)
- [ ] Configure automated daily backups
- [ ] Add rate limiting to authentication endpoints
- [ ] Move from `npm run dev` to `npm run build && npm start`
- [ ] Set `NODE_ENV=production`
- [ ] Implement connection pooling for PostgreSQL
- [ ] Remove seed credentials and create real user accounts
- [ ] Complete security review and penetration testing
- [ ] Create Production Deployment Guide for chosen hosting model
