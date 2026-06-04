#!/usr/bin/env python3
import psycopg2
import duckdb
from pathlib import Path
import sys

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
PG_CONN_STR = "postgresql://stochos:stochos_dev_2026@127.0.0.1:5433/stochos_platform"

def main():
    print("=== Starting CRM Retailer Metadata Sync ===")
    
    # 1. Connect to DuckDB
    duckdb_file = Path(DUCKDB_PATH)
    if not duckdb_file.exists():
        print(f"[ERROR] DuckDB file not found at {DUCKDB_PATH}")
        sys.exit(1)
        
    print(f"Connecting to DuckDB: {DUCKDB_PATH}...")
    try:
        duck_conn = duckdb.connect(str(duckdb_file), read_only=True)
    except Exception as e:
        print(f"[ERROR] Failed to connect to DuckDB: {e}")
        sys.exit(1)
        
    # 2. Query resolved retailer metadata from DuckDB
    print("Querying retailer county, DMA, and service center from DuckDB...")
    try:
        retailers = duck_conn.execute("SELECT retailer_id, county, dma, service_center FROM ny_retailer_dim").fetchall()
        print(f"Retrieved {len(retailers)} retailers from DuckDB.")
    except Exception as e:
        print(f"[ERROR] Failed to query DuckDB: {e}")
        duck_conn.close()
        sys.exit(1)
    finally:
        duck_conn.close()
        
    if not retailers:
        print("No retailers found in DuckDB. Exiting.")
        return
        
    # 3. Connect to PostgreSQL
    print("Connecting to PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(PG_CONN_STR)
        pg_cur = pg_conn.cursor()
    except Exception as e:
        print(f"[ERROR] Failed to connect to PostgreSQL: {e}")
        sys.exit(1)
        
    # 4. Perform set-based batch update in PostgreSQL via temporary staging table
    print("Syncing metadata to PostgreSQL...")
    try:
        # Create staging table
        pg_cur.execute("""
            CREATE TEMP TABLE temp_retailer_sync (
                external_id VARCHAR,
                county VARCHAR,
                dma VARCHAR,
                service_center VARCHAR
            ) ON COMMIT DROP;
        """)
        
        # Bulk load metadata into the temp table
        from psycopg2.extras import execute_values
        insert_query = "INSERT INTO temp_retailer_sync (external_id, county, dma, service_center) VALUES %s"
        execute_values(pg_cur, insert_query, retailers)
        
        # Execute single set-based update query
        update_query = """
            UPDATE crm_retailers AS r
            SET 
                county = t.county,
                dma = t.dma,
                service_center = t.service_center
            FROM temp_retailer_sync AS t
            WHERE r.external_id = t.external_id;
        """
        pg_cur.execute(update_query)
        sync_count = pg_cur.rowcount
        
        pg_conn.commit()
        print(f"Successfully synced {sync_count} retailer records in PostgreSQL.")
    except Exception as e:
        pg_conn.rollback()
        print(f"[ERROR] Failed to update PostgreSQL: {e}")
        sys.exit(1)
    finally:
        pg_cur.close()
        pg_conn.close()
        
    print("=== CRM Retailer Metadata Sync Complete ===")

if __name__ == "__main__":
    main()
