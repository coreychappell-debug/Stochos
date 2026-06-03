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
        
    # 4. Perform batch update in PostgreSQL
    print("Syncing metadata to PostgreSQL...")
    update_query = """
        UPDATE crm_retailers
        SET 
            county = %s,
            dma = %s,
            service_center = %s
        WHERE external_id = %s;
    """
    
    sync_count = 0
    try:
        for retailer_id, county, dma, service_center in retailers:
            pg_cur.execute(update_query, (county, dma, service_center, retailer_id))
            sync_count += pg_cur.rowcount
            
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
