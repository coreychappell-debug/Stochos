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

