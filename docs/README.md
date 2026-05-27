# Stochos Documentation Index

**Last Updated:** 2026-05-17

This is the master index for all Stochos platform and infrastructure documentation. When in doubt about where something lives, start here.

---

## Root Documents

| Document | Purpose |
|----------|---------|
| [SYSTEM_OF_RECORD.md](./SYSTEM_OF_RECORD.md) | **Start here.** Canonical authority map — which engine owns which data. |
| [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) | Honest readiness assessment — what's done, partial, missing, and blocked. Graduation gates for each deployment milestone. |

---

## Architecture

| Document | Covers |
|----------|--------|
| [infrastructure_model.md](./architecture/infrastructure_model.md) | WSL2, Docker, networking, port registry, volume registry, dependency chain |
| [database_scaling_roadmap.md](./architecture/database_scaling_roadmap.md) | Active rolling database windows, jurisdiction segmentation, and cloud Parquet archives |

**Planned:**
- `platform_architecture.md` — Next.js, PostgreSQL, Prisma, auth stack details
- `analytics_architecture.md` — DuckDB warehouse layers, R/Shiny pipeline, mart design
- `auth_architecture.md` — Authentication flow, RBAC model, session management

---

## Operations

| Document | Covers |
|----------|--------|
| [duckdb_operations.md](./operations/duckdb_operations.md) | Warehouse philosophy, writer/reader rules, backup, concurrency |
| [docker_operations.md](./operations/docker_operations.md) | Container lifecycle, image updates, volume management, troubleshooting |

**Also see:**
- [stochos-platform/OPERATIONS.md](../stochos-platform/OPERATIONS.md) — Platform-specific operations (PostgreSQL, Prisma, Next.js, auth, middleware)

**Planned:**
- `backup_restore.md` — Unified backup procedures across both stacks
- `analyst_access.md` — Onboarding, RStudio user setup, Tailscale access

---

## Commercial

| Document | Audience / Purpose |
|----------|--------------------|
| [sales_talking_points.md](./business/sales_talking_points.md) | **External.** Client-facing talking points, milestone billing, and modular tiers. |
| [internal_financial_model.md](./business/internal_financial_model.md) | **Internal.** Strictly confidential labor burden math, partner equity, and billing markups. |

---

## Runbooks

| Document | When To Use |
|----------|------------|
| [startup_runbook.md](./runbooks/startup_runbook.md) | After reboot, or when starting the full environment |
| [rollback_runbook.md](./runbooks/rollback_runbook.md) | When stopping, removing, or rolling back the platform layer |

**Planned:**
- `schema_migration_runbook.md` — Prisma migrate workflow for production
- `postgres_runbook.md` — PostgreSQL maintenance, vacuuming, connection pooling
- `ingest_runbook.md` — DuckDB ETL execution, monitoring, failure recovery

---

## Schemas

**Planned:**
- `ny_schema_reference.md` — Consolidated DuckDB warehouse schema (from existing `.txt` docs)
- `platform_schema_reference.md` — PostgreSQL schema (from `prisma/schema.prisma`)
- `canonical_dimensions.md` — Shared dimension definitions across both engines

---

## Standards

**Planned:**
- `naming_conventions.md` — Table, column, file, and container naming rules
- `sql_standards.md` — Query patterns, join conventions, view naming
- `etl_standards.md` — Ingest script structure, error handling, logging
- `security_principles.md` — Authentication, secrets management, access control

---

## Lessons Learned

| Document | Covers |
|----------|--------|
| [known_issues.md](./lessons_learned/known_issues.md) | Prisma Edge runtime issue, v7 breaking changes, DuckDB concurrency, Windows dev environment gotchas |

---

## Legacy Documentation (Source Material)

These files predate the formal documentation hierarchy. Their content has been consolidated into the documents above but the originals are preserved for reference:

| File | Location | Status |
|------|----------|--------|
| `Docker-Based R and Shiny Server Set.txt` | OneDrive/The Stochos Group/ | Consolidated into infrastructure_model.md and docker_operations.md |
| `Procedures for the servers.txt` | OneDrive/The Stochos Group/ | Consolidated into startup_runbook.md |
| `Stochos Lottery Data Warehouse - New York Schema Documentation.txt` | NY Scripts/ | Consolidated into duckdb_operations.md; planned full schema doc |
| `Stochos NY Pipeline Rebuild and Automation Procedure.txt` | NY Scripts/ | Pending consolidation into ingest_runbook.md |
| `stochos-platform/OPERATIONS.md` | stochos-platform/ | Active — platform-specific operations |
