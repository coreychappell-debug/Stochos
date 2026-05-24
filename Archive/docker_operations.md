# Stochos — Docker Operations

**Last Updated:** 2026-05-17  
**Purpose:** Container lifecycle management for all Stochos Docker services.

---

## Runtime Model

Docker Engine runs **natively inside WSL2 Ubuntu-22.04** — not through Docker Desktop.

```powershell
# All Docker commands from Windows PowerShell:
wsl -d Ubuntu-22.04 -- docker <command>

# Or from within a WSL2 terminal:
docker <command>
```

---

## Container Lifecycle

### Start All Services
```powershell
# Start platform database
wsl -d Ubuntu-22.04 -- docker start stochos_postgres

# Start analytics stack (from compose directory)
wsl -d Ubuntu-22.04 -- sh -c "cd /path/to/compose && docker compose up -d"
```

### Stop All Services
```powershell
wsl -d Ubuntu-22.04 -- docker stop stochos_postgres
wsl -d Ubuntu-22.04 -- sh -c "cd /path/to/compose && docker compose stop"
```

### View Status
```powershell
wsl -d Ubuntu-22.04 -- docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
```

### View Resource Usage
```powershell
wsl -d Ubuntu-22.04 -- docker stats --no-stream
```

---

## Image Management

### Update Images
```bash
# Pull latest versions
docker compose pull

# Recreate containers with new images
docker compose up -d --force-recreate
```

### Cleanup
```bash
# Remove unused images, networks, and build cache
docker system prune

# Remove unused volumes (CAUTION: may delete data)
docker volume prune
```

---

## Volume Management

| Volume | Owner | Backup Command |
|--------|-------|---------------|
| `stochos_pg_data` | Platform | `docker exec stochos_postgres pg_dump -U stochos stochos_platform > backup.sql` |
| Compose volumes | Analytics | Backup mounted Windows directories directly |

### Volume Inspection
```bash
docker volume ls
docker volume inspect stochos_pg_data
```

---

## Troubleshooting

### Docker command not found
```powershell
wsl --shutdown
# Then restart WSL2 terminal
```

### Container won't start (port conflict)
```powershell
# Check what's using the port
wsl -d Ubuntu-22.04 -- ss -tlnp | grep <port>
```

### WSL2 memory pressure
Check `.wslconfig` settings. Monitor with `docker stats`.

---

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Security patches (Ubuntu) | Monthly | `sudo apt update && sudo apt upgrade -y` |
| Image updates | Quarterly | `docker compose pull && docker compose up -d --force-recreate` |
| System cleanup | Monthly | `docker system prune` |
| Resource monitoring | As needed | `docker stats` |
