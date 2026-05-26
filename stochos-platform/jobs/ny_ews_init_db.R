# ==============================================================================
# SCRIPT: ny_ews_init_db.R
# PURPOSE: Initializes the DuckDB Spatial Database schema for the NY EWS.
# ==============================================================================

library(duckdb)
library(DBI)

# Connect to the canonical New York DuckDB database
db_path <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
con <- dbConnect(duckdb(), db_path, read_only = FALSE)

message("Initializing New York Lottery Early Warning System Database...")

# Enable spatial and json extensions
dbExecute(con, "INSTALL spatial;")
dbExecute(con, "LOAD spatial;")
dbExecute(con, "INSTALL json;")
dbExecute(con, "LOAD json;")

# 1. Source Registry
dbExecute(con, "
CREATE TABLE IF NOT EXISTS ny_source_registry (
    source_name VARCHAR PRIMARY KEY,
    source_url VARCHAR,
    hazard_type VARCHAR,
    status_field VARCHAR,
    priority_rank INTEGER,
    enabled_flag BOOLEAN,
    notes VARCHAR
);
")
message("- Table created: ny_source_registry")

# 2. Raw Emergency Features
dbExecute(con, "
CREATE TABLE IF NOT EXISTS ny_raw_emergency_features (
    run_id VARCHAR,
    source_name VARCHAR,
    source_feature_id VARCHAR,
    source_timestamp TIMESTAMP,
    ingest_timestamp TIMESTAMP,
    raw_metadata JSON,
    geom GEOMETRY
);
")
message("- Table created: ny_raw_emergency_features")

# 3. Normalized Emergencies
dbExecute(con, "
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
")
message("- Table created: ny_normalized_emergencies")

# 4. Retailer Risk History
dbExecute(con, "
CREATE TABLE IF NOT EXISTS ny_retailer_risk_history (
    run_id VARCHAR,
    ingest_timestamp TIMESTAMP,
    retailer_id VARCHAR,  -- Matches ny_retailer_dim.retailer_id VARCHAR type
    emergency_id VARCHAR,
    source_name VARCHAR,
    hazard_type VARCHAR,
    status VARCHAR,
    inside_polygon BOOLEAN,
    distance_to_boundary_meters DOUBLE,
    within_buffer BOOLEAN,
    action_level VARCHAR
);
")
message("- Table created: ny_retailer_risk_history")

# Seed the Source Registry with Weather and Earthquake feeds
dbExecute(con, "
INSERT INTO ny_source_registry (source_name, source_url, hazard_type, status_field, priority_rank, enabled_flag, notes)
VALUES 
('nws_alerts', 'https://api.weather.gov/alerts/active', 'weather', 'event', 1, TRUE, 'National Weather Service active alerts'),
('usgs_earthquakes', 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson', 'earthquake', 'status', 2, TRUE, 'USGS earthquakes magnitude 4.5+')
ON CONFLICT (source_name) DO UPDATE SET 
    source_url = EXCLUDED.source_url,
    priority_rank = EXCLUDED.priority_rank;
")
message("- Seeded ny_source_registry.")

dbDisconnect(con)
message("Initialization Complete.")
