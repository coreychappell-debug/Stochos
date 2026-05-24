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

| Field | Value |
|-------|-------|
| **Executive Dashboard** | http://100.79.201.44:3838/executive/ |
| **Early Warning System** | http://100.79.201.44:3838/ews/ |

No login required — these are read-only analytical dashboards.

### 2.3 RStudio Server (Data Science)

| Field | Value |
|-------|-------|
| **URL** | http://100.79.201.44:8787 |
| **Username** | analyst1 |
| **Password** | *(ask Corey for the RStudio password)* |

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
┌─────────────────────────────────────────────────────┐
│                 Windows Host (100.79.201.44)         │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │ Next.js Platform         → localhost:3000     │  │
│   │ (runs natively on Node.js)                    │  │
│   └──────────────────────────────────────────────┘  │
│                                                      │
│   ┌──────────────────────────────────────────────┐  │
│   │ WSL2 Ubuntu 22.04 (100.94.253.6)             │  │
│   │                                               │  │
│   │   Docker Containers:                          │  │
│   │   ├─ PostgreSQL 16      → localhost:5433      │  │
│   │   ├─ Shiny Server       → localhost:3838      │  │
│   │   └─ RStudio Server     → localhost:8787      │  │
│   │                                               │  │
│   │   DuckDB (file-based)                         │  │
│   │   └─ /srv/stochos/data/duckdb/               │  │
│   └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Port Map

| Service | Port | Protocol | Host |
|---------|------|----------|------|
| Next.js Platform | 3000 | HTTP | Windows |
| Shiny Server | 3838 | HTTP | Docker/WSL2 |
| RStudio Server | 8787 | HTTP | Docker/WSL2 |
| PostgreSQL | 5433 | TCP | Docker/WSL2 |

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

```bash
cd /path/to/docker-compose-directory
docker compose down
docker compose up -d
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
| Seed scripts | `stochos-platform\prisma\seed.js`, `seed-instant-tickets.js` |
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

---

## Team Directory

| Name | Role | Email |
|------|------|-------|
| Corey Chappell | Lead / Architect | *(primary)* |
| Caitlin Chappell | IT Administrator | cchappell404@gmail.com |
| Tyler | Team Member | *(on Tailscale as `tyler`)* |

---

> **Questions?** Refer to `STOCHOS_MASTER_IT_MANUAL.md` in the docs folder for the comprehensive technical reference, or reach out to Corey.
