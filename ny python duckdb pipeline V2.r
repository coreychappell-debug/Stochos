#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import duckdb
import sys
from datetime import datetime
import subprocess

"""
NY Lottery Data Normalization, Reporting Mart, and Canonical Build Script (v11)
-----------------------------------------------------------------------------
PURPOSE:
Builds the New York Lottery warehouse module in DuckDB from raw CSV files.

This script does four things:
1. Loads raw staging tables from CSV (bypassing corrupt lines)
2. Builds NY-local dimensions, facts, enriched tables, views, and summary marts
3. Builds geospatial and retailer summary marts for reporting
4. Builds shared canonical tables for future cross-state comparative reporting
5. Syncs solved retailer metadata (county, DMA, service center) to PostgreSQL

OPERATING PRINCIPLES:
- Python performs ETL and warehouse refresh
- DuckDB stores persistent analytical tables
- R / Shiny read prepared tables in read-only mode
- Local NY tables preserve fidelity
- Canonical shared tables support future multi-state comparisons
"""

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

STATE_CODE = "NY"
STATE_NAME = "New York"
NY_ROOT = Path("/srv/stochos/data/raw/new_york/nylottery_data")
SALES_CSV = NY_ROOT / "xyvi-fbb9_lottery-daily-retailer-sales-by-game-beginning-2024" / "data.csv"
RETAILERS_CSV = NY_ROOT / "2vvn-pdyi_nys-lottery-retailers" / "data.csv"
DB_PATH = Path("/srv/stochos/data/duckdb/stochos_lottery.duckdb")
DB_PATH_TEMP = Path("/srv/stochos/data/duckdb/stochos_lottery_temp.duckdb")

RETAILER_COMMISSION_RATE = 0.06
TODAY = datetime.now().strftime("%Y-%m-%d")
DAILY_SALES_START_DATE = "2024-01-01"

# New York display geography rule for maps and geospatial marts
NY_MIN_LAT = 40.45
NY_MAX_LAT = 45.10
NY_MIN_LON = -79.90
NY_MAX_LON = -71.80

# -----------------------------------------------------------------------------
# Table names
# -----------------------------------------------------------------------------

RAW_SALES_TABLE = f"stg_{STATE_CODE.lower()}_sales_raw"
RAW_RETAILER_TABLE = f"stg_{STATE_CODE.lower()}_retailers_raw"

NY_RETAILER_DIM_TABLE = "ny_retailer_dim"
NY_GAME_DIM_TABLE = "ny_game_dim"
FACT_MELT_TABLE = "fact_lottery_sales_melt"
FACT_SALES_TABLE = "fact_lottery_sales"
NY_ENRICHED_FACT_TABLE = "ny_daily_sales_fact_enriched"
UNIFIED_VIEW = "v_unified_lottery_truth"

# Existing generic-style tables retained for continuity
DIM_RETAILER_TABLE = "dim_retailers"
DIM_GAME_TABLE = "dim_games"

# New York reporting marts
NY_SALES_BY_GAME_TABLE = "ny_sales_by_game"
NY_SALES_BY_GAME_SALES_ONLY_TABLE = "ny_sales_by_game_sales_only"
NY_SALES_BY_CITY_TABLE = "ny_sales_by_city"
NY_SALES_BY_CITY_SALES_ONLY_TABLE = "ny_sales_by_city_sales_only"
NY_TOP_RETAILERS_TABLE = "ny_top_retailers"
NY_TOP_RETAILERS_SALES_ONLY_TABLE = "ny_top_retailers_sales_only"
NY_RETAILER_MAP_TABLE = "ny_retailer_map_v2"
NY_RETAILER_GEO_EXC_TABLE = "ny_retailer_geo_exceptions"
NY_COUNTY_SUMMARY_TABLE = "ny_county_summary_v1"
NY_RETAILER_PERF_TABLE = "ny_retailer_performance_v1"
NY_GAME_PERF_TABLE = "ny_game_performance_v1"
NY_RETAILER_ROI_TABLE = "ny_retailer_roi_v1"

# Canonical shared tables for future cross-state comparison
DIM_JURISDICTION_TABLE = "dim_jurisdiction"
CANONICAL_RETAILER_TABLE = "canonical_dim_retailer"
CANONICAL_GAME_TABLE = "canonical_dim_game"
CANONICAL_FACT_SALES_EVENT_TABLE = "fact_sales_event"
CANONICAL_RETAILER_DAILY_TABLE = "fact_retailer_daily"

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def qstr(value: str | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


# (game_code: (game_name, game_family, metric_class, is_revenue, standard_category, theoretical_payout_rate))
GAME_CLASSIFICATIONS = {
    "numbers_day": ("Numbers Day", "Numbers", "sales", True, "pick_3", 0.50),
    "numbers_eve": ("Numbers Evening", "Numbers", "sales", True, "pick_3", 0.50),
    "numbers_iw": ("Numbers Instant Win", "Numbers", "sales", True, "instant_win", 0.65),
    "win4_day": ("Win 4 Day", "Win 4", "sales", True, "pick_4", 0.50),
    "win4_eve": ("Win 4 Evening", "Win 4", "sales", True, "pick_4", 0.50),
    "win4_iw": ("Win 4 Instant Win", "Win 4", "sales", True, "instant_win", 0.65),
    "t5_day": ("Take 5 Day", "Take 5", "sales", True, "lotto_jackpot", 0.50),
    "t5_eve": ("Take 5 Evening", "Take 5", "sales", True, "lotto_jackpot", 0.50),
    "take5_iw": ("Take 5 Instant Win", "Take 5", "sales", True, "instant_win", 0.65),
    "pick10": ("Pick 10", "Pick 10", "sales", True, "lotto_jackpot", 0.50),
    "lotto": ("NY Lotto", "Lotto", "sales", True, "lotto_jackpot", 0.40),
    "mega": ("Mega Millions", "Mega Millions", "sales", True, "lotto_jackpot", 0.50),
    "megaplier": ("Megaplier", "Mega Millions", "add_on", True, "lotto_jackpot", 0.00),
    "powerball": ("Powerball", "Powerball", "sales", True, "lotto_jackpot", 0.50),
    "powerplay": ("Power Play", "Powerball", "add_on", True, "lotto_jackpot", 0.00),
    "doubleplay": ("Double Play", "Powerball", "add_on", True, "lotto_jackpot", 0.00),
    "c4l": ("Cash 4 Life", "Cash 4 Life", "sales", True, "lotto_jackpot", 0.55),
    "m4l": ("Millionaire for Life", "Millionaire for Life", "sales", True, "lotto_jackpot", 0.55),
    "quick_draw": ("Quick Draw", "Quick Draw", "sales", True, "monitor", 0.62),
    "qd_extra": ("Quick Draw Extra", "Quick Draw", "add_on", True, "monitor", 0.00),
    "money_dots": ("Money Dots", "Money Dots", "sales", True, "monitor", 0.62),
    "promo": ("Promo", "Promo", "unknown", False, "unknown", 0.00),
    "draw_paid": ("Draw Paid", "Payout", "payout", False, "payout", 0.00),
    "ig_settles": ("Instant Game Settles", "Scratchers", "sales", True, "scratch_off", 0.65),
    "ig_paid": ("Instant Game Paid", "Scratchers", "payout", False, "payout", 0.00),
    "game0 (mm_iw)": ("Mega Millions Instant Win", "Mega Millions", "sales", True, "instant_win", 0.65),
    "game1": ("Game 1", "Unknown", "sales", True, "unknown", 0.50),
    "game2": ("Game 2", "Unknown", "sales", True, "unknown", 0.50),
    "game3": ("Game 3", "Unknown", "sales", True, "unknown", 0.50),
    "game4": ("Game 4", "Unknown", "sales", True, "unknown", 0.50),
}

# -----------------------------------------------------------------------------
# Raw staging
# -----------------------------------------------------------------------------

def create_raw_tables(con: duckdb.DuckDBPyConnection) -> None:
    if not SALES_CSV.exists():
        raise FileNotFoundError(f"Sales CSV not found: {SALES_CSV}")
    if not RETAILERS_CSV.exists():
        raise FileNotFoundError(f"Retailers CSV not found: {RETAILERS_CSV}")

    con.execute(f"DROP TABLE IF EXISTS {RAW_SALES_TABLE}")
    con.execute(f"DROP TABLE IF EXISTS {RAW_RETAILER_TABLE}")

    print(f"Loading raw sales data (ignoring bad rows)...")
    con.execute(f"""
    CREATE TABLE {RAW_SALES_TABLE} AS
    SELECT *
    FROM read_csv_auto({qstr(str(SALES_CSV))}, header=true, ignore_errors=true)
    """)

    print(f"Loading raw retailers data...")
    con.execute(f"""
    CREATE TABLE {RAW_RETAILER_TABLE} AS
    SELECT *
    FROM read_csv_auto({qstr(str(RETAILERS_CSV))}, header=true)
    """)

# -----------------------------------------------------------------------------
# Dimensions
# -----------------------------------------------------------------------------

def build_dimensions(con: duckdb.DuckDBPyConnection) -> None:
    # 1. Execute SQL Seed file to create/refresh ny_county_regions_dim
    seed_path = Path("/srv/stochos/data/seeds/lmr_districts.sql")
    if not seed_path.exists():
        # Fallback path inside the workspace
        seed_path = Path(__file__).parent / "stochos-platform" / "data" / "seeds" / "lmr_districts.sql"
    
    if seed_path.exists():
        print(f"Seeding county regions from {seed_path}...")
        con.execute("INSTALL spatial; LOAD spatial;")
        sql_content = seed_path.read_text()
        for statement in sql_content.split(";"):
            stmt = statement.strip()
            if stmt:
                con.execute(stmt)
    else:
        print("[WARNING] lmr_districts.sql seed file not found. Schema update skipped.")

    # 1.5. Ensure tmp_ny_retailer_county_lookup is populated from live_db if it exists, or create it empty
    has_lookup = False
    if DB_PATH.exists():
        print(f"Attaching live database {DB_PATH} to copy historical county lookup...")
        try:
            con.execute(f"ATTACH '{DB_PATH}' AS live_db (READ_ONLY)")
            # Check if table exists in live_db
            tables = con.execute("SELECT table_name FROM information_schema.tables WHERE table_catalog = 'live_db' AND table_schema = 'main' AND table_name = 'tmp_ny_retailer_county_lookup'").fetchall()
            if tables:
                print("Found tmp_ny_retailer_county_lookup in live database. Copying...")
                con.execute("CREATE TABLE tmp_ny_retailer_county_lookup AS SELECT * FROM live_db.tmp_ny_retailer_county_lookup")
                has_lookup = True
            con.execute("DETACH live_db")
        except Exception as e:
            print(f"[WARNING] Failed to copy tmp_ny_retailer_county_lookup from live database: {e}")
            try:
                con.execute("DETACH live_db")
            except Exception:
                pass

    if not has_lookup:
        print("Creating empty tmp_ny_retailer_county_lookup table...")
        con.execute("CREATE TABLE tmp_ny_retailer_county_lookup (retailer_id VARCHAR, county VARCHAR)")

    # 1.6. Ensure ny_county_demographics_dim and v_ny_county_demographics_latest exist
    has_demo = False
    if DB_PATH.exists():
        print(f"Attaching live database {DB_PATH} to copy county demographics...")
        try:
            con.execute(f"ATTACH '{DB_PATH}' AS live_db (READ_ONLY)")
            tables = con.execute("SELECT table_name FROM information_schema.tables WHERE table_catalog = 'live_db' AND table_schema = 'main' AND table_name = 'ny_county_demographics_dim'").fetchall()
            if tables:
                print("Found ny_county_demographics_dim in live database. Copying...")
                con.execute("CREATE TABLE ny_county_demographics_dim AS SELECT * FROM live_db.ny_county_demographics_dim")
                has_demo = True
            con.execute("DETACH live_db")
        except Exception as e:
            print(f"[WARNING] Failed to copy demographics from live database: {e}")
            try:
                con.execute("DETACH live_db")
            except Exception:
                pass

    if not has_demo:
        print("ny_county_demographics_dim not found. Sourcing demographics from CORGIS fallback...")
        con.execute("""
            CREATE TABLE ny_county_demographics_dim (
                county VARCHAR,
                population INTEGER,
                land_area DOUBLE,
                median_income DOUBLE,
                data_year INTEGER,
                PRIMARY KEY (county, data_year)
            );
        """)
        try:
            import urllib.request
            import csv
            corgis_url = "https://corgis-edu.github.io/corgis/datasets/csv/county_demographics/county_demographics.csv"
            req = urllib.request.Request(corgis_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                lines = [line.decode('utf-8') for line in response.read().splitlines()]
            reader = csv.reader(lines)
            header = next(reader)
            county_idx = header.index("County")
            state_idx = header.index("State")
            area_idx = header.index("Miscellaneous.Land Area")
            income_idx = header.index("Income.Median Houseold Income")
            pop_idx = header.index("Population.2020 Population")
            
            for row in reader:
                if row[state_idx].strip() == "NY":
                    cleaned_county = row[county_idx].replace(" County", "").strip()
                    pop = int(row[pop_idx].replace(",", "").strip())
                    area = float(row[area_idx].replace(",", "").strip())
                    income = float(row[income_idx].replace(",", "").strip())
                    con.execute("""
                        INSERT OR REPLACE INTO ny_county_demographics_dim 
                        (county, population, land_area, median_income, data_year)
                        VALUES (?, ?, ?, ?, 2020);
                    """, (cleaned_county, pop, area, income))
            print("Successfully seeded demographics from CORGIS fallback.")
        except Exception as e:
            print(f"[WARNING] Failed to seed demographics from CORGIS: {e}")

    # Recreate the view v_ny_county_demographics_latest
    con.execute("""
        CREATE OR REPLACE VIEW v_ny_county_demographics_latest AS
        WITH ranked AS (
            SELECT *,
                   ROW_NUMBER() OVER (PARTITION BY county ORDER BY data_year DESC) as rn
            FROM ny_county_demographics_dim
        )
        SELECT county, population, land_area, median_income, data_year
        FROM ranked
        WHERE rn = 1;
    """)

    # 1.7. Ensure EWS tables are copied or created empty
    ews_tables = {
        "ny_source_registry": """
            CREATE TABLE IF NOT EXISTS ny_source_registry (
                source_name VARCHAR PRIMARY KEY,
                source_url VARCHAR,
                hazard_type VARCHAR,
                status_field VARCHAR,
                priority_rank INTEGER,
                enabled_flag BOOLEAN,
                notes VARCHAR
            );
        """,
        "ny_raw_emergency_features": """
            CREATE TABLE IF NOT EXISTS ny_raw_emergency_features (
                run_id VARCHAR,
                source_name VARCHAR,
                source_feature_id VARCHAR,
                source_timestamp TIMESTAMP,
                ingest_timestamp TIMESTAMP,
                raw_metadata JSON,
                geom GEOMETRY
            );
        """,
        "ny_normalized_emergencies": """
            CREATE TABLE IF NOT EXISTS ny_normalized_emergencies (
                run_id VARCHAR,
                emergency_id VARCHAR,
                source_name VARCHAR,
                source_feature_id VARCHAR,
                hazard_type VARCHAR,
                status VARCHAR,
                severity_rank INTEGER,
                event_name VARCHAR,
                county VARCHAR,
                geometry_type VARCHAR,
                source_timestamp TIMESTAMP,
                ingest_timestamp TIMESTAMP,
                raw_metadata JSON,
                geom GEOMETRY
            );
        """,
        "ny_retailer_risk_history": """
            CREATE TABLE IF NOT EXISTS ny_retailer_risk_history (
                run_id VARCHAR,
                ingest_timestamp TIMESTAMP,
                retailer_id VARCHAR,
                emergency_id VARCHAR,
                source_name VARCHAR,
                hazard_type VARCHAR,
                status VARCHAR,
                inside_polygon BOOLEAN,
                distance_to_boundary_meters DOUBLE,
                within_buffer BOOLEAN,
                action_level VARCHAR
            );
        """
    }

    for tbl, create_sql in ews_tables.items():
        has_tbl = False
        if DB_PATH.exists():
            try:
                con.execute(f"ATTACH '{DB_PATH}' AS live_db (READ_ONLY)")
                tables = con.execute(f"SELECT table_name FROM information_schema.tables WHERE table_catalog = 'live_db' AND table_schema = 'main' AND table_name = '{tbl}'").fetchall()
                if tables:
                    print(f"Found {tbl} in live database. Copying...")
                    con.execute(f"CREATE TABLE {tbl} AS SELECT * FROM live_db.{tbl}")
                    has_tbl = True
                con.execute("DETACH live_db")
            except Exception as e:
                print(f"[WARNING] Failed to copy {tbl} from live database: {e}")
                try:
                    con.execute("DETACH live_db")
                except:
                    pass
        if not has_tbl:
            print(f"Creating empty fallback for {tbl}...")
            con.execute(create_sql)
            if tbl == "ny_source_registry":
                # Seed source registry
                con.execute("""
                    INSERT INTO ny_source_registry (source_name, source_url, hazard_type, status_field, priority_rank, enabled_flag, notes)
                    VALUES 
                    ('nws_alerts', 'https://api.weather.gov/alerts/active', 'weather', 'event', 1, TRUE, 'National Weather Service active alerts'),
                    ('usgs_earthquakes', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson', 'earthquake', 'status', 2, TRUE, 'USGS earthquakes magnitude 4.5+')
                    ON CONFLICT (source_name) DO UPDATE SET 
                        source_url = EXCLUDED.source_url,
                        priority_rank = EXCLUDED.priority_rank;
                """)

    # Recreate view ny_retailer_risk_current
    con.execute("""
        CREATE OR REPLACE VIEW ny_retailer_risk_current AS
        WITH latest_run AS (
            SELECT MAX(run_id) as run_id FROM ny_retailer_risk_history
        ),
        ranked_risks AS (
            SELECT 
                h.retailer_id,
                r.retailer_name,
                r.county as district_name,
                h.emergency_id,
                h.source_name,
                h.hazard_type,
                h.status,
                h.inside_polygon,
                h.distance_to_boundary_meters,
                h.within_buffer,
                h.action_level,
                e.severity_rank,
                e.source_timestamp,
                h.ingest_timestamp,
                ROW_NUMBER() OVER (
                    PARTITION BY h.retailer_id 
                    ORDER BY 
                        CASE h.action_level 
                            WHEN 'CRITICAL' THEN 1 
                            WHEN 'WARNING' THEN 2 
                            WHEN 'MONITOR' THEN 3 
                            WHEN 'INFO' THEN 4 
                            ELSE 5 
                        END,
                        e.severity_rank ASC,
                        h.distance_to_boundary_meters ASC
                ) as rnk
            FROM ny_retailer_risk_history h
            JOIN ny_retailer_dim r ON r.retailer_id = h.retailer_id
            JOIN ny_normalized_emergencies e ON h.emergency_id = e.emergency_id AND e.run_id = (SELECT MAX(run_id) FROM ny_normalized_emergencies)
            WHERE h.run_id = (SELECT run_id FROM latest_run)
        )
        SELECT 
            r.retailer_id,
            r.retailer_name,
            COALESCE(r.county, 'Unknown') as district_name,
            COALESCE(rr.emergency_id, 'NONE') as emergency_id,
            COALESCE(rr.source_name, 'NONE') as source_name,
            COALESCE(rr.hazard_type, 'NONE') as hazard_type,
            COALESCE(rr.status, 'SAFE') as status,
            COALESCE(rr.inside_polygon, FALSE) as inside_polygon,
            COALESCE(rr.distance_to_boundary_meters, -1.0) as distance_to_boundary_meters,
            COALESCE(rr.within_buffer, FALSE) as within_buffer,
            COALESCE(rr.action_level, 'SAFE') as action_level,
            COALESCE(rr.severity_rank, 99) as severity_rank,
            rr.source_timestamp,
            rr.ingest_timestamp
        FROM ny_retailer_dim r
        LEFT JOIN ranked_risks rr ON r.retailer_id = rr.retailer_id AND rr.rnk = 1;
    """)

    # 2. Build ny_retailer_dim using historical lookup and automated spatial joins
    print("Building ny_retailer_dim with spatial boundaries & regions...")
    con.execute("INSTALL spatial; LOAD spatial;")
    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_RETAILER_DIM_TABLE} AS
    WITH raw_retailers AS (
        SELECT DISTINCT
            '{STATE_CODE}' AS state_code,
            CAST({qident('Retailer')} AS VARCHAR) AS retailer_id,
            {qident('Name')} AS retailer_name,
            {qident('Street')} AS street,
            {qident('City')} AS city,
            {qident('State')} AS state,
            CAST({qident('Zip')} AS VARCHAR) AS zip_code,
            {qident('Quick Draw')} AS quick_draw,
            TRY_CAST({qident('Latitude')} AS DOUBLE) AS latitude,
            TRY_CAST({qident('Longitude')} AS DOUBLE) AS longitude,
            {qident('Georeference')} AS georeference,
            NULL::VARCHAR AS business_type
        FROM {RAW_RETAILER_TABLE}
        WHERE CAST({qident('Retailer')} AS VARCHAR) IS NOT NULL
    ),
    spatial_lookup AS (
        SELECT 
            r.retailer_id,
            REPLACE(c.name, ' County', '') AS spatial_county
        FROM raw_retailers r
        JOIN ST_Read('/srv/stochos/new-york-counties.geojson') c
          ON ST_Within(ST_Point(r.longitude, r.latitude), c.geom)
        WHERE r.latitude IS NOT NULL AND r.longitude IS NOT NULL
    ),
    resolved_county AS (
        SELECT
            r.*,
            COALESCE(lk.county, sp.spatial_county) AS county,
            CASE WHEN lk.county IS NULL AND sp.spatial_county IS NOT NULL THEN TRUE ELSE FALSE END AS is_new_connection
        FROM raw_retailers r
        LEFT JOIN tmp_ny_retailer_county_lookup lk ON r.retailer_id = lk.retailer_id
        LEFT JOIN spatial_lookup sp ON r.retailer_id = sp.retailer_id
    )
    SELECT
        rc.state_code,
        rc.retailer_id,
        rc.retailer_name,
        rc.street,
        rc.city,
        rc.state,
        rc.zip_code,
        rc.quick_draw,
        rc.latitude,
        rc.longitude,
        rc.georeference,
        rc.county,
        rc.business_type,
        reg.dma,
        reg.service_center,
        rc.is_new_connection
    FROM resolved_county rc
    LEFT JOIN ny_county_regions_dim reg ON rc.county = reg.county
    """)

    # Generic-style retailer table retained for compatibility with prior work
    con.execute(f"""
    CREATE OR REPLACE TABLE {DIM_RETAILER_TABLE} AS
    SELECT
        state_code,
        retailer_id,
        retailer_name AS master_name,
        city,
        zip_code,
        street,
        state,
        county,
        quick_draw,
        latitude,
        longitude,
        georeference,
        business_type,
        dma,
        service_center,
        is_new_connection
    FROM {NY_RETAILER_DIM_TABLE}
    """)

    values = ",\n".join([
        f"('{STATE_CODE}', {qstr(code)}, {qstr(meta[0])}, {qstr(meta[1])}, {qstr(meta[2])}, {str(meta[3]).upper()}, {qstr(meta[4])}, {meta[5]}, {RETAILER_COMMISSION_RATE})"
        for code, meta in GAME_CLASSIFICATIONS.items()
    ])

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_GAME_DIM_TABLE} AS
    SELECT
        col0 AS state_code,
        col1 AS game_code,
        col2 AS game_name,
        col3 AS game_family,
        col4 AS metric_class,
        col5 AS is_revenue,
        col6 AS standard_category,
        col7 AS theoretical_payout_rate,
        col8 AS retailer_commission_rate
    FROM (VALUES {values})
    """)

    # Generic-style game table retained for compatibility with prior work
    con.execute(f"""
    CREATE OR REPLACE TABLE {DIM_GAME_TABLE} AS
    SELECT *
    FROM {NY_GAME_DIM_TABLE}
    """)

# -----------------------------------------------------------------------------
# Facts
# -----------------------------------------------------------------------------

def build_fact_table(con: duckdb.DuckDBPyConnection) -> None:
    raw_cols = {r[0] for r in con.execute(f"DESCRIBE {RAW_SALES_TABLE}").fetchall()}
    sample = con.execute(f"SELECT {qident('BUS_DAY')} FROM {RAW_SALES_TABLE} LIMIT 1").fetchone()

    if sample is None:
        raise RuntimeError(f"{RAW_SALES_TABLE} appears to be empty.")

    # Handle BUS_DAY whether read as string or DATE
    bus_day_value = sample[0]
    if isinstance(bus_day_value, str) and "/" in bus_day_value:
        date_expr = f"strptime({qident('BUS_DAY')}, '%m/%d/%Y')::DATE"
    else:
        date_expr = f"TRY_CAST({qident('BUS_DAY')} AS DATE)"

    union_parts = []
    for target_key in GAME_CLASSIFICATIONS.keys():
        matches = [rc for rc in raw_cols if rc.strip().upper() == target_key.upper()]
        if matches:
            orig_col = matches[0]
            union_parts.append(f"""
            SELECT
                '{STATE_CODE}' AS state_code,
                {date_expr} AS sales_date,
                CAST({qident('AGTNO')} AS VARCHAR) AS retailer_id,
                {qident('BUSNM')} AS retailer_name,
                {qident('BUSCITY')} AS city,
                {qident('BUSTYPE')} AS business_type,
                '{target_key}' AS game_code,
                TRY_CAST(REPLACE(CAST({qident(orig_col)} AS VARCHAR), ',', '') AS DOUBLE) AS amount
            FROM {RAW_SALES_TABLE}
            WHERE {date_expr} >= DATE '{DAILY_SALES_START_DATE}'
              AND {date_expr} <= DATE '{TODAY}'
            """)

    if not union_parts:
        raise RuntimeError("No game columns matched the classification keys. Nothing to melt.")

    con.execute(f"CREATE OR REPLACE TABLE {FACT_MELT_TABLE} AS " + "\nUNION ALL\n".join(union_parts))

    con.execute(f"""
    CREATE OR REPLACE TABLE {FACT_SALES_TABLE} AS
    SELECT
        f.state_code,
        f.sales_date,
        f.retailer_id,
        f.retailer_name,
        f.city,
        f.business_type,
        f.game_code,
        f.amount,
        g.game_name,
        g.game_family,
        g.metric_class,
        g.is_revenue,
        g.standard_category,
        g.theoretical_payout_rate,
        g.retailer_commission_rate
    FROM {FACT_MELT_TABLE} f
    LEFT JOIN {DIM_GAME_TABLE} g
      ON f.state_code = g.state_code
     AND f.game_code = g.game_code
    WHERE f.amount IS NOT NULL
      AND f.amount <> 0
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_ENRICHED_FACT_TABLE} AS
    SELECT
        f.state_code,
        f.sales_date,
        f.retailer_id,
        COALESCE(r.master_name, f.retailer_name) AS retailer_name,
        r.street,
        COALESCE(r.city, f.city) AS city,
        r.county,
        r.state,
        r.zip_code,
        COALESCE(r.business_type, f.business_type) AS business_type,
        r.quick_draw,
        r.latitude,
        r.longitude,
        r.dma,
        r.service_center,
        r.is_new_connection,
        f.game_code,
        f.game_name,
        f.game_family,
        f.metric_class,
        f.standard_category,
        f.amount,
        f.is_revenue,
        f.theoretical_payout_rate,
        f.retailer_commission_rate
    FROM {FACT_SALES_TABLE} f
    LEFT JOIN {DIM_RETAILER_TABLE} r
      ON f.state_code = r.state_code
     AND f.retailer_id = r.retailer_id
    """)

# -----------------------------------------------------------------------------
# Unified analytical view
# -----------------------------------------------------------------------------

def create_unified_view(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
    CREATE OR REPLACE VIEW {UNIFIED_VIEW} AS
    SELECT
        state_code,
        sales_date,
        retailer_id,
        retailer_name,
        street,
        city,
        county,
        state,
        zip_code,
        business_type,
        quick_draw,
        latitude,
        longitude,
        dma,
        service_center,
        is_new_connection,
        game_code,
        game_name,
        game_family,
        metric_class,
        standard_category,
        amount,
        is_revenue,
        CASE WHEN is_revenue THEN amount ELSE 0 END AS gross_revenue,
        CASE WHEN is_revenue THEN amount * COALESCE(theoretical_payout_rate, 0) ELSE 0 END AS estimated_payout,
        CASE WHEN is_revenue THEN amount * COALESCE(retailer_commission_rate, 0) ELSE 0 END AS retailer_commission,
        CASE WHEN is_revenue THEN amount
             - (amount * COALESCE(theoretical_payout_rate, 0))
             - (amount * COALESCE(retailer_commission_rate, 0))
             ELSE 0 END AS net_contribution
    FROM {NY_ENRICHED_FACT_TABLE}
    """)

# -----------------------------------------------------------------------------
# Reporting marts
# -----------------------------------------------------------------------------

def build_reporting_marts(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_SALES_BY_GAME_TABLE} AS
    SELECT
        game_code,
        game_name,
        game_family,
        metric_class,
        standard_category,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT retailer_id) AS retailer_count,
        COUNT(DISTINCT sales_date) AS active_days
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY 1,2,3,4,5
    ORDER BY total_amount DESC
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_SALES_BY_GAME_SALES_ONLY_TABLE} AS
    SELECT *
    FROM {NY_SALES_BY_GAME_TABLE}
    WHERE metric_class IN ('sales', 'add_on')
    ORDER BY total_amount DESC
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_SALES_BY_CITY_TABLE} AS
    SELECT
        city,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT retailer_id) AS retailer_count,
        COUNT(DISTINCT sales_date) AS active_days
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY city
    ORDER BY total_amount DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_SALES_BY_CITY_SALES_ONLY_TABLE} AS
    SELECT
        city,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT retailer_id) AS retailer_count,
        COUNT(DISTINCT sales_date) AS active_days
    FROM {NY_ENRICHED_FACT_TABLE}
    WHERE metric_class IN ('sales', 'add_on')
    GROUP BY city
    ORDER BY total_amount DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_TOP_RETAILERS_TABLE} AS
    SELECT
        retailer_id,
        retailer_name,
        city,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT sales_date) AS active_days,
        COUNT(DISTINCT game_code) AS game_count
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY 1,2,3
    ORDER BY total_amount DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_TOP_RETAILERS_SALES_ONLY_TABLE} AS
    SELECT
        retailer_id,
        retailer_name,
        city,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT sales_date) AS active_days,
        COUNT(DISTINCT game_code) AS game_count
    FROM {NY_ENRICHED_FACT_TABLE}
    WHERE metric_class IN ('sales', 'add_on')
    GROUP BY 1,2,3
    ORDER BY total_amount DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_RETAILER_GEO_EXC_TABLE} AS
    SELECT
        retailer_id,
        retailer_name,
        street,
        city,
        state,
        zip_code,
        quick_draw,
        latitude,
        longitude
    FROM {NY_RETAILER_DIM_TABLE}
    WHERE latitude IS NULL
       OR longitude IS NULL
       OR latitude < {NY_MIN_LAT}
       OR latitude > {NY_MAX_LAT}
       OR longitude < {NY_MIN_LON}
       OR longitude > {NY_MAX_LON}
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_RETAILER_MAP_TABLE} AS
    WITH retailer_sales AS (
        SELECT
            retailer_id,
            SUM(amount) AS total_sales,
            COUNT(DISTINCT sales_date) AS active_days,
            COUNT(DISTINCT game_code) AS game_count
        FROM {NY_ENRICHED_FACT_TABLE}
        WHERE metric_class IN ('sales', 'add_on')
        GROUP BY retailer_id
    ),
    retailer_top_game AS (
        SELECT
            retailer_id,
            game_code,
            game_name,
            ROW_NUMBER() OVER (
                PARTITION BY retailer_id
                ORDER BY SUM(amount) DESC, game_code
            ) AS rn
        FROM {NY_ENRICHED_FACT_TABLE}
        WHERE metric_class IN ('sales', 'add_on')
        GROUP BY retailer_id, game_code, game_name
    )
    SELECT
        r.retailer_id,
        r.retailer_name,
        r.street,
        r.city,
        r.state,
        r.zip_code,
        r.quick_draw,
        r.latitude,
        r.longitude,
        s.total_sales,
        CASE WHEN s.active_days > 0 THEN s.total_sales / s.active_days ELSE NULL END AS avg_daily_sales,
        s.active_days,
        s.game_count,
        tg.game_code AS top_game_code,
        tg.game_name AS top_game,
        r.dma,
        r.service_center,
        r.is_new_connection
    FROM {NY_RETAILER_DIM_TABLE} r
    LEFT JOIN retailer_sales s
      ON r.retailer_id = s.retailer_id
    LEFT JOIN retailer_top_game tg
      ON r.retailer_id = tg.retailer_id
     AND tg.rn = 1
    WHERE r.latitude IS NOT NULL
      AND r.longitude IS NOT NULL
      AND r.latitude BETWEEN {NY_MIN_LAT} AND {NY_MAX_LAT}
      AND r.longitude BETWEEN {NY_MIN_LON} AND {NY_MAX_LON}
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_COUNTY_SUMMARY_TABLE} AS
    SELECT
        COALESCE(county, 'Unknown') AS county,
        COUNT(DISTINCT retailer_id) AS retailer_count,
        SUM(CASE WHEN metric_class IN ('sales', 'add_on') THEN amount ELSE 0 END) AS total_sales,
        CASE WHEN COUNT(DISTINCT retailer_id) > 0
             THEN SUM(CASE WHEN metric_class IN ('sales', 'add_on') THEN amount ELSE 0 END) / COUNT(DISTINCT retailer_id)
             ELSE NULL END AS avg_sales_per_retailer,
        COUNT(DISTINCT CASE WHEN COALESCE(quick_draw, '') IN ('Y', 'Yes', 'YES') THEN retailer_id END) AS quick_draw_retailer_count,
        CASE WHEN COUNT(DISTINCT retailer_id) > 0
             THEN COUNT(DISTINCT CASE WHEN COALESCE(quick_draw, '') IN ('Y', 'Yes', 'YES') THEN retailer_id END)::DOUBLE / COUNT(DISTINCT retailer_id)
             ELSE NULL END AS quick_draw_share
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY 1
    ORDER BY total_sales DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_RETAILER_PERF_TABLE} AS
    WITH retailer_top_game AS (
        SELECT
            retailer_id,
            game_code,
            game_name,
            ROW_NUMBER() OVER (
                PARTITION BY retailer_id
                ORDER BY SUM(amount) DESC, game_code
            ) AS rn
        FROM {NY_ENRICHED_FACT_TABLE}
        WHERE metric_class IN ('sales', 'add_on')
        GROUP BY retailer_id, game_code, game_name
    )
    SELECT
        e.retailer_id,
        MAX(e.retailer_name) AS retailer_name,
        MAX(e.city) AS city,
        MAX(e.county) AS county,
        MAX(e.business_type) AS business_type,
        MAX(e.quick_draw) AS quick_draw,
        SUM(CASE WHEN e.metric_class IN ('sales', 'add_on') THEN e.amount ELSE 0 END) AS total_sales,
        COUNT(DISTINCT e.sales_date) AS active_days,
        COUNT(DISTINCT e.game_code) AS game_count,
        CASE WHEN COUNT(DISTINCT e.sales_date) > 0
             THEN SUM(CASE WHEN e.metric_class IN ('sales', 'add_on') THEN e.amount ELSE 0 END) / COUNT(DISTINCT e.sales_date)
             ELSE NULL END AS avg_daily_sales,
        MAX(CASE WHEN tg.rn = 1 THEN tg.game_name END) AS top_game,
        MAX(e.dma) AS dma,
        MAX(e.service_center) AS service_center,
        MAX(CAST(e.is_new_connection AS INTEGER))::BOOLEAN AS is_new_connection
    FROM {NY_ENRICHED_FACT_TABLE} e
    LEFT JOIN retailer_top_game tg
      ON e.retailer_id = tg.retailer_id
    GROUP BY e.retailer_id
    ORDER BY total_sales DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_GAME_PERF_TABLE} AS
    SELECT
        game_code,
        game_name,
        game_family,
        standard_category,
        metric_class,
        SUM(amount) AS total_amount,
        COUNT(DISTINCT retailer_id) AS retailer_count,
        COUNT(DISTINCT sales_date) AS active_days,
        COUNT(DISTINCT city) AS city_count
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY 1,2,3,4,5
    ORDER BY total_amount DESC NULLS LAST
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {NY_RETAILER_ROI_TABLE} AS
    SELECT
        retailer_id,
        retailer_name,
        city,
        county,
        SUM(gross_revenue) AS total_gross_revenue,
        SUM(estimated_payout) AS estimated_payout,
        SUM(retailer_commission) AS estimated_retailer_commission,
        SUM(net_contribution) AS estimated_net_contribution,
        COUNT(DISTINCT sales_date) AS active_days,
        CASE WHEN COUNT(DISTINCT sales_date) > 0
             THEN SUM(net_contribution) / COUNT(DISTINCT sales_date)
             ELSE NULL END AS estimated_net_contribution_per_day
    FROM {UNIFIED_VIEW}
    GROUP BY 1,2,3,4
    ORDER BY estimated_net_contribution DESC NULLS LAST
    """)

# -----------------------------------------------------------------------------
# Canonical shared tables
# -----------------------------------------------------------------------------

def build_canonical_tables(con: duckdb.DuckDBPyConnection) -> None:
    con.execute(f"""
    CREATE OR REPLACE TABLE {DIM_JURISDICTION_TABLE} AS
    SELECT
        '{STATE_CODE}' AS jurisdiction_id,
        '{STATE_CODE}' AS state_code,
        '{STATE_NAME}' AS state_name
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {CANONICAL_RETAILER_TABLE} AS
    SELECT DISTINCT
        state_code AS jurisdiction_id,
        retailer_id,
        retailer_name,
        city,
        county,
        state,
        zip_code,
        latitude,
        longitude,
        business_type AS retailer_type,
        quick_draw AS quick_draw_flag
    FROM {NY_RETAILER_DIM_TABLE}
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {CANONICAL_GAME_TABLE} AS
    SELECT DISTINCT
        state_code AS jurisdiction_id,
        game_code,
        game_name,
        game_family,
        standard_category,
        metric_class,
        is_revenue,
        theoretical_payout_rate,
        retailer_commission_rate
    FROM {NY_GAME_DIM_TABLE}
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {CANONICAL_FACT_SALES_EVENT_TABLE} AS
    SELECT
        state_code AS jurisdiction_id,
        sales_date AS event_date,
        retailer_id,
        game_code,
        amount,
        metric_class,
        is_revenue,
        '{RAW_SALES_TABLE}' AS source_dataset,
        FALSE AS is_modeled,
        CURRENT_TIMESTAMP AS load_timestamp
    FROM {NY_ENRICHED_FACT_TABLE}
    WHERE amount IS NOT NULL
      AND amount <> 0
    """)

    con.execute(f"""
    CREATE OR REPLACE TABLE {CANONICAL_RETAILER_DAILY_TABLE} AS
    SELECT
        state_code AS jurisdiction_id,
        sales_date AS event_date,
        retailer_id,
        SUM(CASE WHEN metric_class = 'sales' THEN amount ELSE 0 END) AS total_sales,
        SUM(CASE WHEN metric_class = 'add_on' THEN amount ELSE 0 END) AS add_on_sales,
        SUM(CASE WHEN standard_category = 'scratch_off' AND metric_class = 'sales' THEN amount ELSE 0 END) AS instant_sales,
        SUM(CASE WHEN standard_category <> 'scratch_off' AND metric_class IN ('sales', 'add_on') THEN amount ELSE 0 END) AS draw_sales,
        SUM(CASE WHEN is_revenue THEN amount * COALESCE(theoretical_payout_rate, 0) ELSE 0 END) AS estimated_payout,
        SUM(CASE WHEN is_revenue THEN amount * COALESCE(retailer_commission_rate, 0) ELSE 0 END) AS estimated_commission,
        SUM(CASE WHEN is_revenue THEN amount - (amount * COALESCE(theoretical_payout_rate, 0)) - (amount * COALESCE(retailer_commission_rate, 0)) ELSE 0 END) AS estimated_net
    FROM {NY_ENRICHED_FACT_TABLE}
    GROUP BY 1,2,3
    """)

# -----------------------------------------------------------------------------
# Checks
# -----------------------------------------------------------------------------

def print_checks(con: duckdb.DuckDBPyConnection) -> None:
    print("\n--- NY Warehouse Checks ---")
    print(f"raw sales rows: {con.execute(f'SELECT COUNT(*) FROM {RAW_SALES_TABLE}').fetchone()[0]}")
    print(f"raw retailer rows: {con.execute(f'SELECT COUNT(*) FROM {RAW_RETAILER_TABLE}').fetchone()[0]}")
    print(f"ny_retailer_dim rows: {con.execute(f'SELECT COUNT(*) FROM {NY_RETAILER_DIM_TABLE}').fetchone()[0]}")
    print(f"ny_game_dim rows: {con.execute(f'SELECT COUNT(*) FROM {NY_GAME_DIM_TABLE}').fetchone()[0]}")
    print(f"fact_lottery_sales_melt rows: {con.execute(f'SELECT COUNT(*) FROM {FACT_MELT_TABLE}').fetchone()[0]}")
    print(f"fact_lottery_sales rows: {con.execute(f'SELECT COUNT(*) FROM {FACT_SALES_TABLE}').fetchone()[0]}")
    print(f"ny_daily_sales_fact_enriched rows: {con.execute(f'SELECT COUNT(*) FROM {NY_ENRICHED_FACT_TABLE}').fetchone()[0]}")
    print(f"ny_retailer_map_v2 rows: {con.execute(f'SELECT COUNT(*) FROM {NY_RETAILER_MAP_TABLE}').fetchone()[0]}")
    print(f"ny_retailer_geo_exceptions rows: {con.execute(f'SELECT COUNT(*) FROM {NY_RETAILER_GEO_EXC_TABLE}').fetchone()[0]}")

    print("\n--- Canonical Table Checks ---")
    print(f"dim_jurisdiction rows: {con.execute(f'SELECT COUNT(*) FROM {DIM_JURISDICTION_TABLE}').fetchone()[0]}")
    print(f"canonical_dim_retailer rows: {con.execute(f'SELECT COUNT(*) FROM {CANONICAL_RETAILER_TABLE}').fetchone()[0]}")
    print(f"canonical_dim_game rows: {con.execute(f'SELECT COUNT(*) FROM {CANONICAL_GAME_TABLE}').fetchone()[0]}")
    print(f"fact_sales_event rows: {con.execute(f'SELECT COUNT(*) FROM {CANONICAL_FACT_SALES_EVENT_TABLE}').fetchone()[0]}")
    print(f"fact_retailer_daily rows: {con.execute(f'SELECT COUNT(*) FROM {CANONICAL_RETAILER_DAILY_TABLE}').fetchone()[0]}")

    dupes = con.execute(f"""
    SELECT COUNT(*)
    FROM (
        SELECT jurisdiction_id, event_date, retailer_id, game_code, COUNT(*) AS n
        FROM {CANONICAL_FACT_SALES_EVENT_TABLE}
        GROUP BY 1,2,3,4
        HAVING COUNT(*) > 1
    ) d
    """).fetchone()[0]
    print(f"fact_sales_event duplicate retailer-date-game keys: {dupes}")

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

def main() -> int:
    # 1. Clean up any leftover temp database from a previous crash
    if DB_PATH_TEMP.exists():
        DB_PATH_TEMP.unlink()

    # 2. Connect to the staging database
    print(f"Connecting to staging database: {DB_PATH_TEMP}...")
    con = duckdb.connect(str(DB_PATH_TEMP))
    try:
        print(f"Normalizing {STATE_CODE} warehouse and canonical layer (v11)...")
        create_raw_tables(con)
        build_dimensions(con)
        build_fact_table(con)
        create_unified_view(con)
        build_reporting_marts(con)
        build_canonical_tables(con)
        print_checks(con)
        
        # Close connection to release file lock before swapping
        con.close()

        # 3. Swap staging database to live database atomically
        print(f"Swapping staging database atomically to live: {DB_PATH}...")
        DB_PATH_TEMP.replace(DB_PATH)
        
        # Trigger Postgres Sync script
        print("Triggering PostgreSQL sync...")
        sync_script = Path("/srv/stochos/jobs/sync_crm_retailers.py")
        if not sync_script.exists():
            sync_script = Path(__file__).parent / "stochos-platform" / "jobs" / "sync_crm_retailers.py"
        
        if sync_script.exists():
            subprocess.run([sys.executable, str(sync_script)], check=False)
        else:
            # Fallback path if run locally
            sync_script = Path(__file__).parent / "sync_crm_retailers.py"
            if sync_script.exists():
                subprocess.run([sys.executable, str(sync_script)], check=False)
            else:
                print("[WARNING] sync_crm_retailers.py script not found.")
                
        print("\nDone.")
        return 0
    finally:
        try:
            con.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
