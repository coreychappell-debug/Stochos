# ==============================================================================
# SCRIPT: ny_ews_ingest.R
# PURPOSE: Connects to NWS and USGS APIs, filters for New York hazards, and stores in DuckDB.
# ==============================================================================

library(duckdb)
library(DBI)
library(sf)
library(dplyr)
library(jsonlite)
library(httr)

# Database path
db_path <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
con <- dbConnect(duckdb(), db_path, read_only = FALSE)
dbExecute(con, "INSTALL spatial;")
dbExecute(con, "LOAD spatial;")
dbExecute(con, "INSTALL json;")
dbExecute(con, "LOAD json;")

run_id <- paste0("RUN_", format(Sys.time(), "%Y%m%d_%H%M%S", tz = "UTC"))
ingest_timestamp <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")

message(paste("Starting Ingestion Run:", run_id))

# --- NWS Alerts Ingestion ---
message("\nProcessing source: nws_alerts (NY Area)")
nws_url <- "https://api.weather.gov/alerts/active?area=NY"
res_nws <- tryCatch({
  GET(nws_url, add_headers("User-Agent" = "Stochos-EWS-NY"))
}, error = function(e) NULL)

nws_data <- NULL
if (!is.null(res_nws) && res_nws$status_code == 200) {
  temp_file <- tempfile(fileext = ".json")
  writeBin(content(res_nws, "raw"), temp_file)
  nws_data <- tryCatch({ st_read(temp_file, quiet = TRUE) }, error = function(e) NULL)
  unlink(temp_file)
}

if (!is.null(nws_data) && nrow(nws_data) > 0) {
  # Normalize and insert NWS alerts
  message(paste("Fetched", nrow(nws_data), "NWS features. Processing..."))
  
  nws_data <- nws_data %>%
    mutate(
      run_id = run_id,
      ingest_timestamp = ingest_timestamp,
      hazard_type = "weather",
      severity_rank = case_when(
        severity == "Extreme" ~ 1,
        severity == "Severe" ~ 2,
        severity == "Moderate" ~ 3,
        TRUE ~ 4
      ),
      source_name = "nws_alerts",
      source_feature_id = as.character(id),
      emergency_id = paste("nws", id, sep = "_"),
      status = as.character(event),
      event_name = as.character(event),
      county = if("areaDesc" %in% names(.)) as.character(areaDesc) else "Unknown",
      geometry_type = as.character(st_geometry_type(nws_data)),
      source_timestamp = ingest_timestamp
    )
  
  # Serialize metadata to JSON and get WKT
  wkt_geom <- st_as_text(st_geometry(nws_data))
  df_no_geom <- st_drop_geometry(nws_data)
  raw_meta_list <- lapply(1:nrow(df_no_geom), function(idx) toJSON(as.list(df_no_geom[idx, ]), auto_unbox=TRUE))
  df_no_geom$raw_metadata <- unlist(raw_meta_list)
  df_no_geom$geom_wkt <- wkt_geom
  
  # Write normalized data to temp table
  dbWriteTable(con, "temp_nws", df_no_geom, overwrite = TRUE)
  
  # Insert into normalized emergencies
  dbExecute(con, "
    INSERT INTO ny_normalized_emergencies (run_id, emergency_id, source_name, source_feature_id, hazard_type, status, severity_rank, event_name, county, geometry_type, source_timestamp, ingest_timestamp, raw_metadata, geom)
    SELECT run_id, emergency_id, source_name, source_feature_id, hazard_type, status, severity_rank, event_name, county, geometry_type, source_timestamp::TIMESTAMP, ingest_timestamp::TIMESTAMP, raw_metadata::JSON, ST_GeomFromText(geom_wkt)
    FROM temp_nws
  ")
  
  # Insert into raw log
  dbExecute(con, "
    INSERT INTO ny_raw_emergency_features (run_id, source_name, source_feature_id, source_timestamp, ingest_timestamp, raw_metadata, geom)
    SELECT run_id, source_name, source_feature_id, source_timestamp::TIMESTAMP, ingest_timestamp::TIMESTAMP, raw_metadata::JSON, ST_GeomFromText(geom_wkt)
    FROM temp_nws
  ")
  
  dbExecute(con, "DROP TABLE temp_nws")
  message("-> NWS Ingestion complete.")
} else {
  message("No active NWS alerts found for NY area.")
}

# --- USGS Earthquakes Ingestion ---
message("\nProcessing source: usgs_earthquakes")
usgs_url <- "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson"
res_eq <- tryCatch({
  GET(usgs_url)
}, error = function(e) NULL)

usgs_data <- NULL
if (!is.null(res_eq) && res_eq$status_code == 200) {
  temp_file <- tempfile(fileext = ".json")
  writeBin(content(res_eq, "raw"), temp_file)
  usgs_data <- tryCatch({ st_read(temp_file, quiet = TRUE) }, error = function(e) NULL)
  unlink(temp_file)
}

if (!is.null(usgs_data) && nrow(usgs_data) > 0) {
  # Bounding box filter for NY region: Lat [40.0, 45.5], Lng [-80.0, -71.5]
  coords <- st_coordinates(usgs_data)
  usgs_data$lng <- coords[, 1]
  usgs_data$lat <- coords[, 2]
  
  ny_eqs <- usgs_data %>%
    filter(lat >= 40.0 & lat <= 45.5 & lng >= -80.0 & lng <= -71.5)
  
  if (nrow(ny_eqs) > 0) {
    message(paste("Fetched", nrow(ny_eqs), "USGS features in NY region. Processing..."))
    
    ny_eqs <- ny_eqs %>%
      mutate(
        run_id = run_id,
        ingest_timestamp = ingest_timestamp,
        hazard_type = "earthquake",
        severity_rank = ifelse(mag >= 4.0, 1, 2),
        source_name = "usgs_earthquakes",
        source_feature_id = as.character(id),
        emergency_id = paste("usgs", id, sep = "_"),
        status = "Active",
        event_name = paste("M", mag, "-", place),
        county = "Unknown",
        geometry_type = as.character(st_geometry_type(ny_eqs)),
        source_timestamp = ingest_timestamp
      )
    
    wkt_geom <- st_as_text(st_geometry(ny_eqs))
    df_no_geom <- st_drop_geometry(ny_eqs)
    raw_meta_list <- lapply(1:nrow(df_no_geom), function(idx) toJSON(as.list(df_no_geom[idx, ]), auto_unbox=TRUE))
    df_no_geom$raw_metadata <- unlist(raw_meta_list)
    df_no_geom$geom_wkt <- wkt_geom
    
    dbWriteTable(con, "temp_usgs", df_no_geom, overwrite = TRUE)
    
    dbExecute(con, "
      INSERT INTO ny_normalized_emergencies (run_id, emergency_id, source_name, source_feature_id, hazard_type, status, severity_rank, event_name, county, geometry_type, source_timestamp, ingest_timestamp, raw_metadata, geom)
      SELECT run_id, emergency_id, source_name, source_feature_id, hazard_type, status, severity_rank, event_name, county, geometry_type, source_timestamp::TIMESTAMP, ingest_timestamp::TIMESTAMP, raw_metadata::JSON, ST_GeomFromText(geom_wkt)
      FROM temp_usgs
    ")
    
    dbExecute(con, "DROP TABLE temp_usgs")
    message("-> USGS Ingestion complete.")
  } else {
    message("No recent earthquakes within NY bounding box.")
  }
} else {
  message("No earthquake data fetched.")
}

dbDisconnect(con)
message("\nIngestion Run Completed.")
