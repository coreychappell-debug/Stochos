# ==============================================================================
# SCRIPT: ny_ews_risk_logic.R
# PURPOSE: Computes spatial threat intersection and buffers for NY retailers.
# ==============================================================================

library(duckdb)
library(DBI)

# Database path
db_path <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
con <- dbConnect(duckdb(), db_path, read_only = FALSE)
dbExecute(con, "INSTALL spatial;")
dbExecute(con, "LOAD spatial;")
dbExecute(con, "INSTALL json;")
dbExecute(con, "LOAD json;")

run_id <- paste0("RUN_", format(Sys.time(), "%Y%m%d_%H%M%S", tz = "UTC"))
ingest_timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")

message("Starting Spatial Risk Evaluation for NY Retailers...")

# Core Spatial Join Logic
# 1 degree of lat/long is approx 111,000 meters (111 km).
# Using ST_Point(longitude, latitude) cast on-the-fly for ny_retailer_dim.
# We intersect points with warning polygons and compute distance in meters.
dbExecute(con, sprintf("
INSERT INTO ny_retailer_risk_history (
    run_id, ingest_timestamp, retailer_id, emergency_id, source_name, hazard_type, status,
    inside_polygon, distance_to_boundary_meters, within_buffer, action_level
)
WITH projected_emergencies AS (
    SELECT 
        emergency_id, 
        source_name, 
        hazard_type, 
        status, 
        severity_rank, 
        geom,
        COALESCE((raw_metadata->>'$.mag')::DOUBLE, 2.5) AS eq_mag
    FROM ny_normalized_emergencies
    -- Evaluate alerts from the latest run and filter out empty geometries
    WHERE run_id = (SELECT MAX(run_id) FROM ny_normalized_emergencies)
      AND NOT ST_IsEmpty(geom)
)
SELECT 
    '%s' AS run_id,
    '%s'::TIMESTAMP AS ingest_timestamp,
    r.retailer_id,
    e.emergency_id,
    e.source_name,
    e.hazard_type,
    e.status,
    ST_Intersects(ST_Point(r.longitude, r.latitude), e.geom) AS inside_polygon,
    ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 AS distance_to_boundary_meters,
    (ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 15000) AS within_buffer,
    CASE 
        -- WEATHER / NWS
        -- Escalated damaging weather events (Flood, Tsunami, Hurricane)
        WHEN e.hazard_type = 'weather' AND (e.event_name ILIKE '%Flood%' OR e.event_name ILIKE '%Tsunami%' OR e.event_name ILIKE '%Hurricane%') AND ST_Intersects(ST_Point(r.longitude, r.latitude), e.geom) THEN 'CRITICAL'
        WHEN e.hazard_type = 'weather' AND (e.event_name ILIKE '%Flood%' OR e.event_name ILIKE '%Tsunami%' OR e.event_name ILIKE '%Hurricane%') AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 15000 THEN 'WARNING'
        WHEN e.hazard_type = 'weather' AND ST_Intersects(ST_Point(r.longitude, r.latitude), e.geom) THEN 'CRITICAL'
        WHEN e.hazard_type = 'weather' AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 5000 THEN 'WARNING'
        WHEN e.hazard_type = 'weather' AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 15000 THEN 'MONITOR'
        
        -- EARTHQUAKE (Scaled dynamically by magnitude)
        WHEN e.hazard_type = 'earthquake' THEN
            CASE
                -- Moderate/Strong (4.5 - 6.0): Potential damage
                WHEN e.eq_mag >= 4.5 AND e.eq_mag < 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 10000 THEN 'CRITICAL'
                WHEN e.eq_mag >= 4.5 AND e.eq_mag < 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 30000 THEN 'WARNING'
                WHEN e.eq_mag >= 4.5 AND e.eq_mag < 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 50000 THEN 'MONITOR'
                -- Major (> 6.0): Widespread damage
                WHEN e.eq_mag >= 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 30000 THEN 'CRITICAL'
                WHEN e.eq_mag >= 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 80000 THEN 'WARNING'
                WHEN e.eq_mag >= 6.0 AND ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 150000 THEN 'MONITOR'
                ELSE 'INFO'
            END
        
        ELSE 'INFO'
    END AS action_level
FROM ny_retailer_dim r
CROSS JOIN projected_emergencies e
WHERE ST_Distance(ST_Point(r.longitude, r.latitude), e.geom) * 111000 <= 
    CASE 
        WHEN e.hazard_type = 'earthquake' AND e.eq_mag < 6.0 THEN 50000
        WHEN e.hazard_type = 'earthquake' AND e.eq_mag >= 6.0 THEN 150000
        ELSE 100000 
    END;
", run_id, ingest_timestamp))

message("- Inserted evaluations into ny_retailer_risk_history")

# Update Current Risk View
dbExecute(con, "
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
    COALESCE(rr.distance_to_boundary_meters, 999999.0) as distance_to_boundary_meters,
    COALESCE(rr.within_buffer, FALSE) as within_buffer,
    COALESCE(rr.action_level, 'SAFE') as action_level,
    COALESCE(rr.severity_rank, 999) as severity_rank,
    rr.source_timestamp,
    rr.ingest_timestamp,
    r.latitude,
    r.longitude
FROM ny_retailer_dim r
LEFT JOIN ranked_risks rr ON r.retailer_id = rr.retailer_id AND rr.rnk = 1;
")

message("- Updated ny_retailer_risk_current View")

dbDisconnect(con)
message("Risk Logic Execution Complete.")
