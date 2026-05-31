# Stochos Platform Cloud Dev Deployment Plan

This document details the architecture, configurations, and deployment steps for launching a secure, cloud-hosted dev/testing instance of the Stochos Platform. It is designed to hit the "sweet spot" of operational readiness, allowing QA testers and Subject Matter Experts (SMEs) to perform exhaustive validation.

---

## 1. Target Infrastructure Model

The cloud dev environment is hosted on a single Linux Virtual Machine (e.g. AWS EC2 t3.large, GCP e2-standard-2, or Caddy-gated VPS) running Docker Compose.

```
                  [ Internet / Clients ]
                           │
                           ▼ (Port 80/443 HTTPS)
                   ┌───────────────┐
                   │  Caddy Proxy  │
                   └───────┬───────┘
                           │
             ┌─────────────┴─────────────┐
             ▼ (Port 3000 HTTP)          ▼ (Port 3838 WebSockets)
     ┌───────────────┐           ┌──────────────────────┐
     │  Next.js App  │           │   R/Shiny Server     │
     └───────┬───────┘           │ (analyst_lab_shiny)  │
             │                   └──────────┬───────────┘
             │ (Local Connection Only)      │
             └─────────────┬────────────────┘
                           ▼ (Port 5433 Localhost)
                   ┌───────────────┐
                   │  PostgreSQL   │ (Restricted to 127.0.0.1)
                   └───────────────┘
```

---

## 2. Ingress & Reverse Proxy (Caddyfile Configuration)

We utilize **Caddy** as our reverse proxy because it handles Let's Encrypt TLS certification automatically and natively supports WebSocket reverse-proxying with sticky sessions.

### 2.1 Caddyfile
Save the following configuration as `Caddyfile` on the cloud host:

```caddy
# Ingress routing for the Stochos dev subdomain
dev.thestochos.com {
    
    # Enforce standard Next.js routing on port 3000
    reverse_proxy 127.0.0.1:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }

    # Proxy the spatial SOLR analytics dashboards on port 3838
    # Enable sticky sessions (Session Affinity) to prevent R/Shiny memory drops
    reverse_proxy /executive/* 127.0.0.1:3838 {
        lb_policy cookie stochos_session
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up Connection "Upgrade"
        header_up Upgrade $http_upgrade
    }
}
```

---

## 3. Database Network Lockdown & Remote Administration

### 3.1 Network Security (Port Binding)
To ensure database credentials are never exposed to public internet scanners, the PostgreSQL service inside `stochos-platform/docker-compose.yml` is bound strictly to the local loopback interface:

```yaml
services:
  postgres:
    # ...
    ports:
      - "127.0.0.1:5433:5432"
```

### 3.2 Tailscale VPN Access
For developers or database administrators requiring remote query access (via pgAdmin, DBeaver, or command line):
1. **Join the Network**: The cloud server must join the Stochos private Tailscale network.
2. **Access Tunnel**: Tunnels are bound to the cloud VM's private Tailscale IP (e.g. `100.79.201.44`) on port `5433`. Direct public connections remain blocked.

---

## 4. Disaster Recovery (Automated S3 Backups)

To automate daily state saves, configure the following `db_backup.sh` script to run as a nightly cron job:

```bash
#!/bin/bash
# Stochos Database Backup Script
BACKUP_DIR="/srv/stochos/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/stochos_backup_$TIMESTAMP.sql"
S3_BUCKET="s3://stochos-dev-backups/postgres"

# Execute pg_dump from localhost
docker exec -t stochos_postgres pg_dump -U stochos -d stochos_platform > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Upload to S3 (requires aws-cli configured)
aws s3 cp "$BACKUP_FILE.gz" "$S3_BUCKET/stochos_backup_$TIMESTAMP.sql.gz"

# Clean up local backups older than 7 days
find "$BACKUP_DIR" -name "*.gz" -mtime +7 -exec rm {} \;

echo "✓ Stochos database backup completed and synced to S3."
```

---

## 5. Horizontal Scale Roadmap (ShinyProxy)

For our QA/SME phase (under 20 concurrent users), a single R/Shiny container with Caddy session affinity is highly stable. 

### Why Defer ShinyProxy?
* **Complexity**: ShinyProxy requires launching a separate Java runtime daemon and giving it root-level socket access (`/var/run/docker.sock`) to spin up/down containers dynamically.
* **Packaging**: Every R/Shiny app must be pre-packaged into separate Docker images, which introduces significant friction during dev iterations.

### Production Migration (Gate 4)
When transitioning to a GA Production environment with over 100 concurrent users, we will adopt ShinyProxy:
1. **Containerized Sessions**: User websocket handshakes trigger ShinyProxy to spin up a tiny container instance of `rocker/shiny-verse` specifically for that user's browser, preventing one user's heavy USGS circle query from slowing down others.
2. **Kubernetes Integration**: ShinyProxy integrates with Kubernetes pods, allowing R scripts to scale across multiple host VMs.
