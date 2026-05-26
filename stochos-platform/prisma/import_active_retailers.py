#!/usr/bin/env python3
import os
import sys
import uuid
import datetime
import duckdb
import psycopg2
from psycopg2.extras import execute_values

DUCKDB_PATH = "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
PG_CONN_STR = "postgresql://stochos:stochos_dev_2026@127.0.0.1:5433/stochos_platform"

def main():
    print("Connecting to DuckDB...")
    try:
        duck_conn = duckdb.connect(DUCKDB_PATH, read_only=True)
    except Exception as e:
        print(f"Error connecting to DuckDB at {DUCKDB_PATH}: {e}")
        sys.exit(1)

    print("Fetching active retailers...")
    try:
        # dim_retailers contains the NY active retailers list.
        # We query and map street to address, master_name to name, zip_code to zipCode, etc.
        rows = duck_conn.execute("""
            SELECT 
                retailer_id, 
                master_name, 
                street, 
                city, 
                zip_code, 
                latitude, 
                longitude 
            FROM dim_retailers
            WHERE retailer_id IS NOT NULL AND master_name IS NOT NULL AND street IS NOT NULL
        """).fetchall()
    except Exception as e:
        print(f"Error querying DuckDB: {e}")
        duck_conn.close()
        sys.exit(1)
    
    duck_conn.close()
    print(f"Found {len(rows)} retailers in DuckDB.")

    if not rows:
        print("No retailers found in DuckDB.")
        return

    print("Connecting to PostgreSQL...")
    try:
        pg_conn = psycopg2.connect(PG_CONN_STR)
        pg_cur = pg_conn.cursor()
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        sys.exit(1)

    print("Importing/Upserting retailers in batches...")
    
    # We will insert in batches of 1000
    batch_size = 1000
    total = len(rows)
    inserted_updated = 0

    # SQL query for upserting
    insert_query = """
        INSERT INTO crm_retailers (
            id, external_id, name, address, city, zip_code, phone, status, 
            application_status, training_status, visit_cadence, route_order, 
            latitude, longitude, geodata_bypassed, geodata_host_correction_requested, 
            created_at, updated_at
        ) VALUES %s
        ON CONFLICT (external_id) DO UPDATE SET
            name = EXCLUDED.name,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            zip_code = EXCLUDED.zip_code,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            updated_at = NOW();
    """

    data_to_upsert = []
    now = datetime.datetime.now()
    for r in rows:
        ext_id, name, street, city, zip_code, lat, lng = r
        
        # Clean values
        ext_id = str(ext_id).strip()
        name = str(name).strip()
        street = str(street).strip()
        city = str(city).strip()
        zip_code = str(zip_code).strip()
        
        # Geolocation numeric clean
        try:
            latitude = float(lat) if lat is not None else None
        except ValueError:
            latitude = None
            
        try:
            longitude = float(lng) if lng is not None else None
        except ValueError:
            longitude = None

        row_uuid = str(uuid.uuid4())
        
        data_to_upsert.append((
            row_uuid, ext_id, name, street, city, zip_code, '555-019-2026', 'active',
            'approved', 'not_trained', 'weekly', 0,
            latitude, longitude, False, False,
            now, now
        ))

    try:
        for i in range(0, total, batch_size):
            batch = data_to_upsert[i : i + batch_size]
            execute_values(pg_cur, insert_query, batch)
            pg_conn.commit()
            inserted_updated += len(batch)
            print(f"Processed {inserted_updated}/{total} retailers...")
    except Exception as e:
        pg_conn.rollback()
        print(f"Error during import: {e}")
        pg_conn.close()
        sys.exit(1)

    pg_conn.close()
    print("Retailer synchronization completed successfully!")

if __name__ == "__main__":
    main()
