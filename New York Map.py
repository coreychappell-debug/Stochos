library(DBI)
library(duckdb)
library(dplyr)
library(leaflet)
library(htmltools)
library(scales)

duckdb_file <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

con <- dbConnect(duckdb(), duckdb_file, read_only = TRUE)
on.exit(dbDisconnect(con, shutdown = FALSE), add = TRUE)

df <- dbGetQuery(con, "
SELECT
    retailer_id,
    retailer_name,
    street,
    city,
    state,
    zip,
    quick_draw,
    latitude,
    longitude,
    total_sales,
    avg_daily_sales,
    active_days,
    game_count,
    top_game
FROM ny.ny_retailer_map_v1
WHERE latitude IS NOT NULL
  AND longitude IS NOT NULL
  AND total_sales IS NOT NULL
")

df <- df %>%
  mutate(
    total_sales = as.numeric(total_sales),
    avg_daily_sales = as.numeric(avg_daily_sales),
    latitude = as.numeric(latitude),
    longitude = as.numeric(longitude)
  )

# New York display bounding box
# This is a visualization rule, not a data deletion rule.
df_ny <- df %>%
  filter(
    latitude >= 40.45,
    latitude <= 45.10,
    longitude >= -79.90,
    longitude <= -71.80
  )

# Optional diagnostic: see what got excluded
df_outside <- df %>%
  filter(
    !(latitude >= 40.45 &
        latitude <= 45.10 &
        longitude >= -79.90 &
        longitude <= -71.80)
  )

cat("\nRows inside NY display box:\n")
print(nrow(df_ny))

cat("\nRows outside NY display box:\n")
print(nrow(df_outside))

if (nrow(df_outside) > 0) {
  cat("\nSample rows outside NY display box:\n")
  print(
    df_outside %>%
      select(retailer_id, retailer_name, city, state, latitude, longitude, total_sales) %>%
      arrange(desc(total_sales)) %>%
      head(20)
  )
}

# Much smaller, capped radius
# Use log scaling, then cap tightly for statewide readability
df_ny <- df_ny %>%
  mutate(
    point_radius = pmax(1.5, pmin(7, log10(total_sales + 1) * 0.9)),
    popup_html = paste0(
      "<b>", htmlEscape(retailer_name), "</b><br/>",
      htmlEscape(street), "<br/>",
      htmlEscape(city), ", ", htmlEscape(state), " ", htmlEscape(zip), "<br/><br/>",
      "<b>Retailer ID:</b> ", retailer_id, "<br/>",
      "<b>Total Sales:</b> ", dollar(total_sales), "<br/>",
      "<b>Avg Daily Sales:</b> ", dollar(avg_daily_sales), "<br/>",
      "<b>Active Days:</b> ", comma(active_days), "<br/>",
      "<b>Game Count:</b> ", comma(game_count), "<br/>",
      "<b>Top Game:</b> ", htmlEscape(top_game), "<br/>",
      "<b>Quick Draw:</b> ", ifelse(is.na(quick_draw), "No/Unknown", quick_draw)
    )
  )

pal <- colorNumeric(
  palette = "viridis",
  domain = df_ny$total_sales,
  na.color = "#bdbdbd"
)

leaflet(df_ny) %>%
  addProviderTiles(providers$CartoDB.Positron) %>%
  fitBounds(
    lng1 = -79.90, lat1 = 40.45,
    lng2 = -71.80, lat2 = 45.10
  ) %>%
  addCircleMarkers(
    lng = ~longitude,
    lat = ~latitude,
    radius = ~point_radius,
    fillColor = ~pal(total_sales),
    fillOpacity = 0.55,
    stroke = FALSE,
    popup = ~popup_html,
    clusterOptions = markerClusterOptions(
      spiderfyOnMaxZoom = TRUE,
      showCoverageOnHover = FALSE,
      zoomToBoundsOnClick = TRUE
    )
  ) %>%
  addLegend(
    position = "bottomright",
    pal = pal,
    values = ~total_sales,
    title = "Total Sales",
    labFormat = labelFormat(prefix = "$", big.mark = ",")
  )
