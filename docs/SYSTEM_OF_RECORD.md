# Stochos — System of Record

**Last Updated:** 2026-05-24  
**Purpose:** Canonical authority map for the Stochos hybrid architecture. When a question arises about where data lives, which system owns it, or which layer is responsible — this document is the answer.

> [!CAUTION]
> If this table disagrees with reality, update this table — do not create a second source of truth.

---

## Data Ownership

| Concern | System of Record | Engine | Access Pattern |
|---------|-----------------|--------|----------------|
| Transactional contracts | **PostgreSQL** | `stochos_platform` database | Platform API (Prisma) |
| Contract line items, amendments, compliance | **PostgreSQL** | `stochos_platform` database | Platform API (Prisma) |
| Vendor master | **PostgreSQL** | `vendors` table | Platform API (Prisma) |
| Product registry | **PostgreSQL** | `products` table | Platform API (Prisma) |
| User accounts and roles | **PostgreSQL** | `users`, `roles` tables | NextAuth + Prisma |
| Authentication sessions | **NextAuth / PostgreSQL** | JWT cookie + `users` table | NextAuth v5 |
| Audit log (platform mutations) | **PostgreSQL** | `audit_log` table | Platform API (Prisma) |
| Analytics warehouse | **DuckDB** | `stochos_lottery.duckdb` | R (read), Python (write) |
| Historical lottery sales facts | **DuckDB** | `fact_lottery_sales_melt`, `ny_daily_sales_fact_enriched` | R (read-only) |
| Dashboard marts | **DuckDB** | `ny_retailer_map_v2`, `ny_county_summary_v1`, etc. | R/Shiny (read-only) |
| Retailer master (CRM/Operational) & geocoding audit cache | **PostgreSQL** | `crm_retailers` table | Synced from DuckDB `dim_retailers` via [import_active_retailers.py](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/prisma/import_active_retailers.py); updated by nightly audit job |
| Retailer analytical master | **DuckDB** | `dim_retailers`, `ny_retailer_dim` | R (read-only) |
| Game dimension | **DuckDB** | `ny_game_dim` | R (read-only) |
| Modeled economics | **DuckDB** | `v_unified_lottery_truth` | R/Shiny (read-only) |
| Instant ticket fiscal year plans | **PostgreSQL** | `instant_ticket_plans`, `instant_ticket_scenarios` | Platform API (Prisma) |
| Instant ticket game rosters | **PostgreSQL** | `instant_ticket_games`, `instant_ticket_game_features` | Platform API (Prisma) |
| Instant ticket vendor pricing | **PostgreSQL** | `instant_ticket_vendor_pricing` | Platform API (Prisma) |
| Instant ticket marketing items | **PostgreSQL** | `instant_ticket_marketing_items` | Platform API (Prisma) |
| ETL orchestration | **R / Python scripts** | Cron-scheduled ingest jobs | Write to DuckDB |
| Operational documentation | **`docs/` directory** | Markdown files | Human-readable |

---

## Write Authority Rules

| Engine | Who Writes | Who Reads | Protocol |
|--------|-----------|-----------|----------|
| **PostgreSQL** | Next.js platform (Prisma ORM) | Next.js platform only | All mutations logged to `audit_log` |
| **DuckDB** | Python ingest scripts, R mart builders | R, Shiny, ad-hoc analysis | Single-writer discipline; no concurrent write sessions |
| **Neither** crosses into the other's domain | — | — | PostgreSQL does not read DuckDB. DuckDB does not read PostgreSQL. |

> [!IMPORTANT]
> **The firewall rule:** PostgreSQL and DuckDB must never query each other directly. If data needs to flow between them, it flows through an explicit ETL step with a documented script — never through a live cross-database join.

---

## Runtime Ownership

| Layer | Technology | Owner Process | Host |
|-------|-----------|---------------|------|
| Application server | Next.js 16.2.6 | Node.js (Windows host) | `localhost:3000` |
| Transactional database | PostgreSQL 16 | Docker container (WSL2) | `localhost:5433` |
| Analytical database | DuckDB | Embedded in R/Python process | File: `/srv/stochos/data/duckdb/stochos_lottery.duckdb` |
| R development | RStudio Server | Docker container (WSL2) | `localhost:8787` |
| Dashboard hosting | Shiny Server | Docker container (WSL2) | `localhost:3838` |
| Container orchestration | Docker Engine 29.1.3 | WSL2 (Ubuntu 22.04) | Native Linux daemon |

---

## Schema Ownership

| Schema Domain | Owner System | Schema Definition File |
|---------------|-------------|----------------------|
| Platform tables (18) | PostgreSQL | `stochos-platform/prisma/schema.prisma` |
| Warehouse tables (30+) | DuckDB | `Stochos Lottery Data Warehouse - New York Schema Documentation.txt` |
| Platform seed data & active retailer sync | PostgreSQL | [seed.js](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/prisma/seed.js), [import_active_retailers.py](file:///c:/Users/corey/Downloads/Corey%20-%20Code%20Stuff/R%20Server%20Project%20folder/New%20York%20Scripts%20and%20Process/stochos-platform/prisma/import_active_retailers.py) |
| Instant Ticket seed data | PostgreSQL | `stochos-platform/prisma/seed-instant-tickets.js` |
| Warehouse seed data | DuckDB | Python ingest scripts (`ny_duckdb_refresh.py`) |

---

## Documentation Ownership

| Document | Location | Covers |
|----------|----------|--------|
| Platform operations | `stochos-platform/OPERATIONS.md` | PostgreSQL, Prisma, Next.js, auth, startup/shutdown |
| Platform README | `stochos-platform/README.md` | Quick start, project structure, scripts |
| System of Record | `docs/SYSTEM_OF_RECORD.md` | This file — canonical authority map |
| Infrastructure model | `docs/architecture/infrastructure_model.md` | WSL2, Docker, networking, port map |
| DuckDB operations | `docs/operations/duckdb_operations.md` | Warehouse philosophy, writer/reader rules, backup |
| Docker operations | `docs/operations/docker_operations.md` | Container lifecycle, image updates, volume management |
| Analytics architecture | `docs/architecture/analytics_architecture.md` | DuckDB layers, R/Shiny pipeline, mart design |
| Platform architecture | `docs/architecture/platform_architecture.md` | Next.js, PostgreSQL, Prisma, auth stack |
| IT Manual | `docs/STOCHOS_MASTER_IT_MANUAL.md` | Deployment, module docs, R package manifest, change management |

---

## Change Control

When adding a new data concern to the system:

1. **Decide which engine owns it** — PostgreSQL (transactional) or DuckDB (analytical)
2. **Update this file** with the new row in the Data Ownership table
3. **Document the schema** in the appropriate schema reference
4. **Document the access pattern** — who writes, who reads, what protocol

When a concern moves between engines (e.g., from DuckDB to PostgreSQL):

1. **Update this file first**
2. **Build the migration script**
3. **Verify no downstream consumer breaks**
4. **Remove the old location only after the new one is validated**
