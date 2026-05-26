# Stochos Platform — Remote IT Administrator Guide

**Prepared for:** Caitlin Chappell (cchappell404@gmail.com)  
**Prepared by:** Corey Chappell  
**Date:** 2026-05-24

---

## Step 1: Join the Tailscale Network

Tailscale creates a private, encrypted network between all team machines. Once connected, you can access the Stochos server from anywhere in the world as if you were on the same local network.

### 1.1 Install Tailscale

1. Go to **https://tailscale.com/download**
2. Download and install for your OS (Windows, Mac, or Linux)
3. Open Tailscale after installation

### 1.2 Accept the Invitation

Corey will send you a Tailscale invite link. Click it while logged in with your Google account (`cchappell404@gmail.com`). This adds your machine to the `coreychappell@` tailnet.

> **Corey:** Generate the invite from https://login.tailscale.com/admin/invite — use the "Invite users" option and enter cchappell404@gmail.com.

### 1.3 Verify Connection

Once connected, open a terminal and run:
```
ping 100.79.201.44
```
If you get replies, you're on the network.

---

## Step 2: Sign Into the Platform

### 2.1 Stochos Business Platform (Next.js)

| Field | Value |
|-------|-------|
| **URL** | http://100.79.201.44:3000 |
| **Email** | cchappell404@gmail.com |
| **Password** | Stochos2026! |
| **Role** | Admin (full access) |

> ⚠️ **Change your password** after first login if a password-change feature is available. Otherwise, Corey can update it via the database.

### 2.2 Analytics Dashboards (Shiny)

| Environment | URL | Notes |
|-------------|-----|-------|
| **Production Dashboards** | http://100.79.201.44:3838/ | Serves live client-ready views (e.g. `/executive`, `/ews`) |
| **Development Dashboards** | http://100.79.201.44:3535/ | Development sandbox Shiny applications |

No login required — these are read-only analytical dashboards.

### 2.3 RStudio Server (Data Science)

| User / Environment | URL | Username | Password |
|--------------------|-----|----------|----------|
| **Corey (Production)** | http://100.79.201.44:8787 | `analyst1` | *(ask Corey)* |
| **Tyler (Production)** | http://100.79.201.44:8788 | `analyst1` | *(ask Corey)* |
| **Caitlin (Production)** | http://100.79.201.44:8789 | `analyst1` | *(ask Corey)* |
| **Corey (Development)** | http://100.79.201.44:8585 | `coreychappell` | *(ask Corey)* |
| **Tyler (Development)** | http://100.79.201.44:8586 | `tylercabral` | *(ask Corey)* |

---

## Step 3: Server Management

The Stochos infrastructure runs on the Windows host (`100.79.201.44`) with Docker containers inside WSL2 (Ubuntu 22.04).

### 3.1 Accessing the Server via SSH

To manage Docker containers and the Linux environment, SSH into the WSL2 instance:

```bash
# From your machine (after Tailscale is connected)
ssh analyst1@100.94.253.6
```

> **Note:** SSH may need to be enabled inside WSL2. If it doesn't connect, Corey will need to run `sudo service ssh start` inside the WSL2 terminal on the host machine.

### 3.2 Remote Desktop (Windows Host)

For full GUI access to the Windows host machine:

1. Open **Remote Desktop Connection** (Windows) or install **Microsoft Remote Desktop** (Mac)
2. Computer: `100.79.201.44`
3. Credentials: *(ask Corey for Windows login credentials)*

---

## Step 4: System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Windows Host (100.79.201.44)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Next.js Platform            → localhost:3000                   │   │
│   │ (runs natively on Node.js)                                     │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ WSL2 Ubuntu 22.04 (100.94.253.6 VM / Keep-Alive process active)│   │
│   │                                                                │   │
│   │   Docker Containers:                                           │   │
│   │   ├─ PostgreSQL (stochos_postgres)       → localhost:5433      │   │
│   │   │                                                            │   │
│   │   ├─ Production Stack (/home/analyst1/analyst_lab):            │   │
│   │   │  ├─ Shiny (analyst_lab_prod_shiny)   → localhost:3838      │   │
│   │   │  ├─ Corey RStudio (analyst_lab_prod_rstudio) → localhost:8787│   │
│   │   │  ├─ Tyler RStudio (analyst_lab_prod_rstudio_tyler) → port 8788│   │
│   │   │  └─ Caitlin RStudio (analyst_lab_prod_rstudio_caitlin) → port 8789│   │
│   │   │                                                            │   │
│   │   └─ Development Stack (/home/coreychappell/analyst_lab):      │   │
│   │      ├─ Shiny (shiny_server)             → localhost:3535      │   │
│   │      ├─ Corey RStudio (rstudio_server)   → localhost:8585      │   │
│   │      └─ Tyler RStudio (rstudio_server_tylercabral) → port 8586 │   │
│   │                                                                │   │
│   │   DuckDB (file-based database)                                 │   │
│   │   └─ /srv/stochos/data/duckdb/                                 │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Port Map

| Service | Port | Protocol | Host | Layer |
|---------|------|----------|------|-------|
| Next.js Platform | 3000 | HTTP | Windows | Platform |
| Shiny (Production) | 3838 | HTTP | Docker/WSL2 | Analytics (Prod) |
| Shiny (Development) | 3535 | HTTP | Docker/WSL2 | Analytics (Dev) |
| RStudio (Corey Prod) | 8787 | HTTP | Docker/WSL2 | Analytics (Prod) |
| RStudio (Tyler Prod) | 8788 | HTTP | Docker/WSL2 | Analytics (Prod) |
| RStudio (Caitlin Prod)| 8789 | HTTP | Docker/WSL2 | Analytics (Prod) |
| RStudio (Corey Dev) | 8585 | HTTP | Docker/WSL2 | Analytics (Dev) |
| RStudio (Tyler Dev) | 8586 | HTTP | Docker/WSL2 | Analytics (Dev) |
| PostgreSQL | 5433 | TCP | Docker/WSL2 | Platform |

---

## Step 5: Common Maintenance Tasks

### 5.1 Restart the Next.js Platform

```powershell
# Open PowerShell on the Windows host (via Remote Desktop or SSH)
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npm run dev
```

### 5.2 Check Docker Container Status

```bash
# SSH into WSL2
ssh analyst1@100.94.253.6

# List running containers
docker ps

# Restart a container
docker restart <container_name>

# View container logs
docker logs <container_name> --tail 50
```

### 5.3 Restart All Docker Services

Because of a known Docker Compose v1 convergence bug, to restart or recreate the R/Shiny services safely, you must delete the existing containers first:

**Production Stack:**
```bash
# SSH into WSL2 and run:
docker ps -a --filter 'name=analyst_lab_prod' -q | xargs -r docker rm -f
cd /home/analyst1/analyst_lab
docker-compose up -d
```

**Development Stack:**
```bash
# SSH into WSL2 and run:
docker ps -a --filter 'name=shiny_server' -q | xargs -r docker rm -f
docker ps -a --filter 'name=rstudio_server' -q | xargs -r docker rm -f
cd /home/coreychappell/analyst_lab
docker-compose up -d
```

### 5.4 Database Management (PostgreSQL)

```bash
# Connect to PostgreSQL from WSL2
docker exec -it <postgres_container> psql -U stochos_admin -d stochos_platform

# Or from any machine with psql installed (via Tailscale)
psql -h 100.79.201.44 -p 5433 -U stochos_admin -d stochos_platform
```

### 5.5 Deploy a Shiny Dashboard Update

```powershell
# On the Windows host
cd "C:\Users\corey\Downloads\Corey - Code Stuff"
.\deploy_shiny_app.ps1
# Follow the 3 interactive prompts (see IT Manual §6.1)
```

### 5.6 Run Database Migrations

```powershell
cd "c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform"
npx prisma generate
npx prisma db push
```

### 5.7 Shiny Container R Package Updates

R packages and system dependencies are now baked directly into the custom Docker image using `Dockerfile.shiny`. Rebuilding or recreating the container will **not** lose these packages.

To update or add new packages:
1. Edit `/home/analyst1/analyst_lab/Dockerfile.shiny`.
2. Rebuild the image:
   ```bash
   docker compose build shiny
   ```
3. Recreate the container:
   ```bash
   docker compose up -d --force-recreate shiny
   ```

---

## Step 6: Key File Locations

| What | Where |
|------|-------|
| Platform source code | `C:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\stochos-platform\` |
| Database schema | `stochos-platform\prisma\schema.prisma` |
| Seed & Sync scripts | [seed.js](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/prisma/seed.js), [import_active_retailers.py](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/prisma/import_active_retailers.py) |
| Geodata audit script | [geodata_audit.py](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/jobs/geodata_audit.py) |
| Geodata audit logs | `/srv/stochos/logs/geodata_audit.log` (on WSL server) |
| IT Manual | `docs\STOCHOS_MASTER_IT_MANUAL.md` |
| System of Record | `docs\SYSTEM_OF_RECORD.md` |
| Shiny apps (Ubuntu) | `/home/analyst1/analyst_lab/shiny_apps/` |
| DuckDB warehouse | `/srv/stochos/data/duckdb/stochos_lottery.duckdb` |
| Deploy script | `C:\Users\corey\Downloads\Corey - Code Stuff\deploy_shiny_app.ps1` |

---

## Step 7: Troubleshooting

| Problem | Solution |
|---------|----------|
| Can't reach any services | Check Tailscale is connected (`tailscale status`) |
| Platform shows blank page | Restart Next.js: `npm run dev` in the stochos-platform directory |
| Shiny dashboard won't load | Check container: `docker ps`, then `docker restart <container>` |
| "Package not found" in Shiny | Add to Dockerfile.shiny and rebuild: see §5.7 above |
| PostgreSQL connection refused | Check container is running: `docker ps`, restart if needed |
| DuckDB locked | Only one write session allowed. Kill any stuck R/Python process |
| PostgreSQL loopback timeout | Node client attempts IPv6 loopback (`::1`). Modify connection string to explicitly use IPv4 loopback `127.0.0.1` (e.g. `127.0.0.1:5433`). |
| COMSPEC environment error (`ENOENT`) | Windows host has corrupted/altered shell variables. Avoid cmd wrappers: spawn processes like `wsl` directly rather than executing through the shell. |
| Geodata audit logs / status | Inspect logs in WSL: `cat /srv/stochos/logs/geodata_audit.log` to check nightly progress. |
| WSL2 stops running / idle sleep | A hidden background process `wsl.exe -d Ubuntu-22.04 -u root sleep 1000d` must run on the Windows host to keep WSL alive. Check if this task/process is active on the host. |
| docker-compose up fails with KeyError: 'ContainerConfig' | Compose v1 bug. Clean up project containers first via: `docker ps -a --filter 'name=...' -q \| xargs -r docker rm -f` then run `docker-compose up -d`. |

---

## Team Directory

| Name | Role | Email |
|------|------|-------|
| Corey Chappell | Lead / Architect | *(primary)* |
| Caitlin Chappell | IT Administrator | cchappell404@gmail.com |
| Tyler | Team Member | *(on Tailscale as `tyler`)* |

---

> **Questions?** Refer to `STOCHOS_MASTER_IT_MANUAL.md` in the docs folder for the comprehensive technical reference, or reach out to Corey.
