# Stochos — DuckDB Operations

**Last Updated:** 2026-05-17  
**Purpose:** Operational doctrine for the DuckDB analytical warehouse.

---

## Canonical Philosophy

> **Database first, dashboards second.**

The DuckDB warehouse is not a single-report backend. It is a reusable analytical platform designed to support a portfolio of reporting products. Dashboards, maps, and summaries are consumers of the warehouse — they do not define it.

---

## Operating Rules

### Writer/Reader Discipline

| Role | Access | Protocol |
|------|--------|----------|
| **Python ingest scripts** | Read + Write | Build raw, dimension, fact, enriched, and mart tables |
| **R mart builders** | Read + Write | Build reporting marts from enriched layers |
| **R / Shiny analytics** | **Read only** | Query prepared tables and views; no ETL logic |
| **Ad hoc validation** | Read only | May inspect raw staging for QA; must not redefine truth |

> [!IMPORTANT]
> **Single-writer rule:** DuckDB does not support concurrent write sessions. Only one process may write at a time. All write operations go through scheduled scripts, never through ad-hoc interactive sessions.

### DuckDB Is NOT a Transactional Store

DuckDB is an embedded analytical database. It is not suitable for:
- Multi-user concurrent writes
- Web application backends
- Session management or authentication data
- High-frequency insert/update workloads

These concerns belong in PostgreSQL. See `SYSTEM_OF_RECORD.md` for the authority map.

---

## Warehouse Layers

The New York warehouse follows five logical layers:

| Layer | Purpose | Tables (examples) |
|-------|---------|-------------------|
| **1. Raw Staging** | Preserve source structure | `ny_daily_sales_raw`, `ny_retailers_raw` |
| **2. Dimensions** | Stable reference entities | `ny_retailer_dim`, `ny_game_dim`, `dim_retailers_master` |
| **3. Normalized Facts** | Atomic long-format transactions | `fact_lottery_sales_melt`, `ny_daily_sales_fact` |
| **4. Enriched Analytical** | Facts joined to dimensions with modeled economics | `ny_daily_sales_fact_enriched`, `v_unified_lottery_truth` |
| **5. Reporting Marts** | Purpose-built consumer tables | `ny_retailer_map_v2`, `ny_county_summary_v1` |

### Data Flow

```
Socrata API → Raw CSV → Staging Tables → Normalized Facts
                                              ↓
                                    Dimension Joins → Enriched Facts
                                                          ↓
                                                   Reporting Marts → R/Shiny Dashboards
```

---

## File Locations

| Asset | Path |
|-------|------|
| Database file | `/srv/stochos/data/duckdb/stochos_lottery.duckdb` |
| Raw data | `/srv/stochos/data/raw/new_york/nylottery_data/` |
| Ingest script | `/srv/stochos/jobs/ny_duckdb_refresh.py` |
| Schema documentation | `docs/schemas/ny_schema_reference.md` (or legacy `.txt` files) |

---

## Backup Procedures

### Database Backup
```bash
# From WSL2 — copy the DuckDB file
cp /srv/stochos/data/duckdb/stochos_lottery.duckdb \
   /srv/stochos/backups/stochos_lottery_$(date +%Y%m%d).duckdb
```

### Raw Data Backup
```bash
tar czf /srv/stochos/backups/raw_ny_$(date +%Y%m%d).tar.gz \
  /srv/stochos/data/raw/new_york/
```

### Rebuild From Source
The warehouse can be fully rebuilt from raw source files using the ingest script. Raw files are the ultimate source of truth — the DuckDB file is a derived artifact.

---

## Concurrency Warning

> [!CAUTION]
> If two processes attempt to write to the DuckDB file simultaneously, one will fail or data corruption may occur. Ensure ETL scripts and interactive R sessions do not overlap on write operations.

Read operations can run concurrently without issue.
