#!/usr/bin/env python3
import os
import sys
import math
import json
import time
import datetime
import urllib.request
import urllib.parse
import psycopg2

PG_CONN_STR = "postgresql://stochos:stochos_dev_2026@127.0.0.1:5433/stochos_platform"
BATCH_LIMIT = 1000
RATE_LIMIT_DELAY = 0.2  # 200ms delay between API requests

def calculate_distance(lat1, lon1, lat2, lon2):
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    R = 6371000 # Radius of Earth in meters
    phi1 = lat1 * math.pi / 180
    phi2 = lat2 * math.pi / 180
    dphi = (lat2 - lat1) * math.pi / 180
    dlambda = (lon2 - lon1) * math.pi / 180
    
    a = math.sin(dphi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return int(round(R * c))

def geocode_address(street, city, zip_code):
    street_enc = urllib.parse.quote(street)
    city_enc = urllib.parse.quote(city)
    zip_enc = urllib.parse.quote(zip_code)
    url = f"https://geocoding.geo.census.gov/geocoder/locations/address?street={street_enc}&city={city_enc}&state=NY&zip={zip_enc}&benchmark=Public_AR_Current&format=json"
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'StochosGeodataAuditor/1.0'}
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status != 200:
                return None, f"HTTP Status {response.status}"
            data = json.loads(response.read().decode('utf-8'))
            return data, None
    except Exception as e:
        return None, str(e)

def geocode_address_with_retry(street, city, zip_code):
    retries = 3
    delay = 1
    for attempt in range(retries):
        data, err = geocode_address(street, city, zip_code)
        if err is None:
            return data, None
        print(f"  Attempt {attempt + 1} failed for '{street}, {city}': {err}. Retrying in {delay}s...")
        time.sleep(delay)
        delay *= 2
    return None, f"Failed after {retries} attempts."

def main():
    print(f"=== Starting Nightly Geodata Audit Job: {datetime.datetime.now()} ===")
    
    print("Connecting to PostgreSQL...")
    try:
        conn = psycopg2.connect(PG_CONN_STR)
        cur = conn.cursor()
    except Exception as e:
        print(f"Error connecting to PostgreSQL: {e}")
        sys.exit(1)

    # Fetch retailers to audit (prioritizing unchecked ones, limiting to BATCH_LIMIT)
    query = """
        SELECT 
            id, 
            external_id, 
            name, 
            address, 
            city, 
            zip_code, 
            latitude, 
            longitude 
        FROM crm_retailers 
        WHERE geodata_bypassed = FALSE 
          AND (
            geodata_status IS NULL 
            OR geodata_last_checked IS NULL 
            OR geodata_last_checked < NOW() - INTERVAL '30 days'
          )
        ORDER BY COALESCE(geodata_last_checked, '1970-01-01 00:00:00'::timestamp) ASC
        LIMIT %s;
    """
    
    try:
        cur.execute(query, (BATCH_LIMIT,))
        retailers = cur.fetchall()
    except Exception as e:
        print(f"Error querying retailers from database: {e}")
        conn.close()
        sys.exit(1)

    print(f"Found {len(retailers)} retailers to audit in this run.")
    if not retailers:
        print("No retailers require auditing. Exiting.")
        conn.close()
        return

    success_count = 0
    failure_count = 0

    for idx, r in enumerate(retailers):
        r_id, ext_id, name, street, city, zip_code, stored_lat, stored_lng = r
        print(f"[{idx+1}/{len(retailers)}] Auditing {name} (ID: {ext_id})...")
        
        # Geocode the address
        data, err = geocode_address_with_retry(street, city, zip_code)
        
        if err is not None:
            print(f"  Geocoding failed: {err}")
            failure_count += 1
            # Mark last checked to avoid getting stuck in a retry loop on this retailer
            try:
                cur.execute("""
                    UPDATE crm_retailers 
                    SET geodata_last_checked = NOW() 
                    WHERE id = %s;
                """, (r_id,))
                conn.commit()
            except Exception as update_err:
                conn.rollback()
                print(f"  Error updating last checked timestamp: {update_err}")
            time.sleep(RATE_LIMIT_DELAY)
            continue
            
        matches = data.get("result", {}).get("addressMatches", [])
        
        if not matches:
            print("  No address match found in geocoding database.")
            computed_status = "unmatched"
            distance_meters = None
            standard_address = None
            standard_lat = None
            standard_lng = None
        else:
            best_match = matches[0]
            standard_address = best_match.get("matchedAddress")
            standard_lat = best_match.get("coordinates", {}).get("y")
            standard_lng = best_match.get("coordinates", {}).get("x")
            
            # Calculate distance
            distance_meters = calculate_distance(stored_lat, stored_lng, standard_lat, standard_lng)
            
            if distance_meters is None:
                # Store coordinates are missing
                computed_status = "unmatched"
            else:
                # Coords match if within 150 meters
                computed_status = "verified" if distance_meters < 150 else "mismatch"
                print(f"  Match: {standard_address} | Distance: {distance_meters}m | Status: {computed_status}")

        # Update database with results
        try:
            cur.execute("""
                UPDATE crm_retailers 
                SET 
                    geodata_status = %s,
                    geodata_distance = %s,
                    geodata_last_checked = NOW(),
                    geodata_standard_address = %s,
                    geodata_standard_latitude = %s,
                    geodata_standard_longitude = %s
                WHERE id = %s;
            """, (computed_status, distance_meters, standard_address, standard_lat, standard_lng, r_id))
            conn.commit()
            success_count += 1
        except Exception as update_err:
            conn.rollback()
            print(f"  Error updating database for retailer {ext_id}: {update_err}")
            failure_count += 1
            
        # Throttling to respect Census geocoding API rate limits
        time.sleep(RATE_LIMIT_DELAY)

    conn.close()
    print(f"=== Geodata Audit Job Complete: {datetime.datetime.now()} ===")
    print(f"Processed: {success_count} succeeded, {failure_count} failed.")

if __name__ == "__main__":
    main()
