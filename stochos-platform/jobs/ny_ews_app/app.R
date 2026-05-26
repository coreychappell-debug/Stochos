# ==============================================================================
# SCRIPT: app.R
# PURPOSE: Web interface for visualizing the NY Lottery Early Warning System.
#          Migrated to corporate shinydashboard layout with Day/Night mode support.
# ==============================================================================

library(shiny)
library(shinydashboard)
library(duckdb)
library(DBI)
library(leaflet)
library(leaflet.extras)
library(dplyr)
library(sf)
library(jsonlite)

# Canonical New York database path
db_path <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

# 1. UI Definition (shinydashboard)
ui <- dashboardPage(
  skin = "black",
  dashboardHeader(title = "Early Warning System (EWS)", titleWidth = 280),
  
  dashboardSidebar(
    width = 280,
    sidebarMenu(
      menuItem("Risk Map", tabName = "map", icon = icon("map")),
      menuItem("Retailer List", tabName = "table", icon = icon("table")),
      hr(),
      h4("System Status", style = "padding-left: 15px; color: var(--text-secondary); font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"),
      div(style = "padding-left: 15px; color: var(--text-color); font-size: 13px; margin-bottom: 10px;", textOutput("last_run")),
      hr(),
      h4("Risk Filters", style = "padding-left: 15px; color: var(--text-secondary); font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;"),
      div(style = "padding-left: 15px; margin-right: 15px; color: var(--text-color);",
          checkboxGroupInput("action_filter", "Action Levels:", 
                             choices = c("CRITICAL", "WARNING", "MONITOR", "INFO", "SAFE"),
                             selected = c("CRITICAL", "WARNING", "MONITOR"))
      ),
      hr(),
      p(style = "padding: 15px; color: #556677; font-size: 11px; font-style: italic;",
        "Note: This dashboard automatically refreshes when new ingestion runs complete.")
    )
  ),
  
  dashboardBody(
    tags$head(
      tags$style(HTML("
        /* Design system CSS variables for Light and Dark themes */
        :root {
          --bg-color: #0d1b2a;
          --card-bg: #1b2838;
          --text-color: #e0e6ed;
          --text-secondary: #8899aa;
          --border-color: #2d3a4a;
          --accent-color: #00b4d8;
        }
        :root.light-theme {
          --bg-color: #f4f6f9;
          --card-bg: #ffffff;
          --text-color: #2b3a4a;
          --text-secondary: #5e6e7d;
          --border-color: #dbe2eb;
          --accent-color: #3f51b5;
        }

        body, .content-wrapper, .right-side { background-color: var(--bg-color) !important; color: var(--text-color) !important; }
        .box { background-color: var(--card-bg) !important; border-top-color: var(--accent-color) !important; border-radius: 8px; border: 1px solid var(--border-color); color: var(--text-color) !important; }
        .box-header { color: var(--text-color) !important; border-bottom: 1px solid var(--border-color); }
        .main-header .logo { background-color: var(--card-bg) !important; color: var(--accent-color) !important; border-bottom: 1px solid var(--border-color); font-weight: 800; font-family: 'Inter', sans-serif; letter-spacing: 0.5px; }
        .main-header .navbar { background-color: var(--card-bg) !important; border-bottom: 1px solid var(--border-color); }
        .main-sidebar { background-color: var(--card-bg) !important; border-right: 1px solid var(--border-color); }
        .sidebar-menu > li > a { color: var(--text-color) !important; }
        .sidebar-menu > li.active > a, .sidebar-menu > li:hover > a { background-color: var(--bg-color) !important; color: var(--accent-color) !important; }
        .nav-tabs-custom { background-color: var(--card-bg) !important; }
        
        /* Table styling */
        table.dataTable tbody tr { background-color: var(--card-bg) !important; color: var(--text-color) !important; }
        table.dataTable thead th { background-color: var(--bg-color) !important; color: var(--text-color) !important; border-bottom: 1px solid var(--border-color) !important; }
        .dataTables_wrapper { color: var(--text-color) !important; }
        .dataTables_info, .dataTables_length, .dataTables_filter, .dataTables_paginate { color: var(--text-color) !important; }
        .paginate_button { color: var(--text-color) !important; }
        
        /* Checkbox overrides */
        .checkbox label { color: var(--text-color); }
      ")),
      tags$script(HTML("
        // Client-side theme detection from Next.js iframe URL queries
        const urlParams = new URLSearchParams(window.location.search);
        const theme = urlParams.get('theme') || 'dark';
        if (theme === 'light') {
          document.documentElement.classList.add('light-theme');
        }
      "))
    ),
    
    tabItems(
      tabItem(tabName = "map",
              box(width = 12, height = "800px", title = "Geographic Risk Map", solidHeader = TRUE,
                  leafletOutput("risk_map", height = "740px")
              )
      ),
      tabItem(tabName = "table",
              box(width = 12, title = "Lottery Retailer Threat Table", solidHeader = TRUE,
                  DT::dataTableOutput("risk_table")
              )
      )
    )
  )
)

# 2. Server Definition
server <- function(input, output, session) {
  
  # Polling function: Check if a new run_id exists in the history table
  check_latest_run <- function() {
    con <- dbConnect(duckdb(), db_path, read_only = TRUE)
    on.exit(dbDisconnect(con))
    res <- tryCatch(dbGetQuery(con, "SELECT MAX(run_id) AS run_id FROM ny_retailer_risk_history"),
                    error = function(e) data.frame(run_id = NA))
    res$run_id[1]
  }
  
  # Fetch data function: Triggered when check_latest_run() changes
  fetch_current_risk <- function() {
    con <- dbConnect(duckdb(), db_path, read_only = TRUE)
    on.exit(dbDisconnect(con))
    
    query <- "SELECT * FROM ny_retailer_risk_current"
    df <- dbGetQuery(con, query)
    
    if(nrow(df) > 0) {
      sf_obj <- st_as_sf(df, coords = c("longitude", "latitude"), crs = 4326, remove = FALSE)
      return(sf_obj)
    } else {
      return(NULL)
    }
  }
  
  # Fetch data function for emergencies: Triggered when check_latest_run() changes
  fetch_current_emergencies <- function() {
    con <- dbConnect(duckdb(), db_path, read_only = TRUE)
    on.exit(dbDisconnect(con))
    dbExecute(con, "INSTALL spatial;")
    dbExecute(con, "LOAD spatial;")
    dbExecute(con, "INSTALL json;")
    dbExecute(con, "LOAD json;")
    
    query <- "
      SELECT emergency_id, source_name, hazard_type, event_name, status, ST_AsText(geom) as wkt 
      FROM ny_normalized_emergencies 
      WHERE run_id = (SELECT MAX(run_id) FROM ny_normalized_emergencies)
    "
    df <- dbGetQuery(con, query)
    
    if(nrow(df) > 0) {
      sf_obj <- st_as_sf(df, wkt = "wkt", crs = 4326)
      return(sf_obj)
    } else {
      return(NULL)
    }
  }

  # Create the reactive poll for risks
  current_risk_data <- reactivePoll(
    intervalMillis = 30000, 
    session = session,
    checkFunc = check_latest_run,
    valueFunc = fetch_current_risk
  )
  
  # Create the reactive poll for emergencies
  current_emergencies <- reactivePoll(
    intervalMillis = 30000,
    session = session,
    checkFunc = check_latest_run,
    valueFunc = fetch_current_emergencies
  )
  
  drawn_polygon <- reactiveVal(NULL)
  
  filtered_risk <- reactive({
    data <- current_risk_data()
    if (is.null(data)) return(NULL)
    
    custom_geom <- drawn_polygon()
    if(!is.null(custom_geom) && nrow(data) > 0) {
      data_proj <- st_transform(data, 32118) # NY Central Projected CRS
      geom_proj <- st_transform(custom_geom, 32118)
      
      distances <- st_distance(data_proj, geom_proj)
      dist_num <- as.numeric(distances)
      
      data$action_level <- case_when(
        dist_num == 0 ~ "CRITICAL",
        dist_num <= 1609.34 ~ "WARNING",
        TRUE ~ data$action_level
      )
      
      data$hazard_type <- ifelse(dist_num <= 1609.34, "CUSTOM DRAWN ZONE", data$hazard_type)
      data$status <- ifelse(dist_num <= 1609.34, "User Defined Impact", data$status)
      data$distance_to_boundary_meters <- ifelse(dist_num <= 1609.34, dist_num, data$distance_to_boundary_meters)
    }
    
    data %>% filter(action_level %in% input$action_filter)
  })
  
  output$last_run <- renderText({
    run_id <- check_latest_run()
    if(is.na(run_id) || is.null(run_id)) "No runs executed yet." else paste("Latest Run:", run_id)
  })
  
  # Render the Map (without hardcoded base tiles; observer handles tiles dynamically)
  output$risk_map <- renderLeaflet({
    leaflet(options = leafletOptions(zoomControl = TRUE, minZoom = 5)) %>%
      setView(lng = -75.5, lat = 42.8, zoom = 7) %>%
      addDrawToolbar(
        targetGroup = "drawn_features",
        editOptions = editToolbarOptions(selectedPathOptions = selectedPathOptions())
      )
  })
  
  # Dynamic Theme Observer (Toggles Map Tiles based on Parent URL theme param)
  observe({
    query <- getQueryString()
    theme <- query$theme
    
    map_proxy <- leafletProxy("risk_map")
    map_proxy %>% clearTiles()
    
    if (!is.null(theme) && theme == "light") {
      map_proxy %>% addProviderTiles(providers$CartoDB.Positron)
    } else {
      map_proxy %>% addProviderTiles(providers$CartoDB.DarkMatter)
    }
  })
  
  # Proxy the Map Updates dynamically
  observe({
    data <- filtered_risk()
    em_data <- current_emergencies()
    
    map_proxy <- leafletProxy("risk_map")
    
    map_proxy %>% clearGroup("Risk Buffers") %>% clearGroup("Threat Polygons") %>% clearGroup("Retailers") %>% clearControls()
    
    # Plot Custom Drawn Polygon Buffer
    custom_geom <- drawn_polygon()
    if(!is.null(custom_geom)) {
       geom_proj <- st_transform(custom_geom, 32118)
       buffer_1mi <- st_transform(st_buffer(geom_proj, dist = 1609.34), 4326)
       map_proxy %>% addPolygons(
         data = buffer_1mi, color = "#fd7e14", weight = 1, fillOpacity = 0.1,
         stroke = TRUE, dashArray = "3, 3", group = "Risk Buffers"
       )
    }
    
    # Plot Emergency Polygons / Points
    if (!is.null(em_data) && nrow(em_data) > 0) {
      
      em_data$event_name[is.na(em_data$event_name)] <- "Unknown"
      em_data$status[is.na(em_data$status)] <- "Unknown"
      
      # Generate Concentric Buffer Rings (1-mile and 2-mile)
      em_proj <- st_transform(em_data, 32118)
      buffer_1mi <- st_transform(st_buffer(em_proj, dist = 1609.34), 4326)
      buffer_2mi <- st_transform(st_buffer(em_proj, dist = 3218.69), 4326)
      
      # Draw Outer 2-mile ring
      map_proxy %>% addPolygons(
        data = buffer_2mi, color = "#ffc107", weight = 1, fillOpacity = 0.05,
        stroke = TRUE, dashArray = "5, 5", group = "Risk Buffers"
      )
      
      # Draw Inner 1-mile ring
      map_proxy %>% addPolygons(
        data = buffer_1mi, color = "#fd7e14", weight = 1, fillOpacity = 0.1,
        stroke = TRUE, dashArray = "3, 3", group = "Risk Buffers"
      )
      
      # Plot Polygons
      polys <- em_data[st_geometry_type(em_data) %in% c("POLYGON", "MULTIPOLYGON"), ]
      if(nrow(polys) > 0) {
        poly_colors <- case_when(
          polys$hazard_type == "weather" ~ "#17becf",
          polys$hazard_type == "earthquake" ~ "#8c564b",
          TRUE ~ "#7f7f7f"
        )
        map_proxy %>% addPolygons(
          data = polys,
          color = poly_colors,
          weight = 2,
          opacity = 0.8,
          fillOpacity = 0.2,
          group = "Threat Polygons",
          popup = paste("<b>", polys$event_name, "</b><br/>", polys$hazard_type, "-", polys$status)
        )
      }
      
      # Plot Points
      pts <- em_data[st_geometry_type(em_data) %in% c("POINT", "MULTIPOINT"), ]
      if(nrow(pts) > 0) {
        pt_colors <- case_when(
          pts$hazard_type == "weather" ~ "#17becf",
          pts$hazard_type == "earthquake" ~ "#8c564b",
          TRUE ~ "#7f7f7f"
        )
        map_proxy %>% addCircleMarkers(
          data = pts,
          radius = 8,
          color = pt_colors,
          fillOpacity = 0.5,
          stroke = TRUE,
          weight = 2,
          group = "Threat Polygons",
          popup = paste("<b>", pts$event_name, "</b><br/>", pts$hazard_type, "-", pts$status)
        )
      }
    }
    
    # Plot Retailers
    if (!is.null(data) && nrow(data) > 0) {
      
      safe_data <- data[data$action_level == "SAFE", ]
      risk_data <- data[data$action_level != "SAFE", ]
      
      # Draw SAFE retailers (small, faded)
      if(nrow(safe_data) > 0) {
        map_proxy %>% addCircleMarkers(
          data = safe_data,
          radius = 3,
          color = "#adb5bd",
          fillOpacity = 0.4,
          stroke = FALSE,
          group = "Retailers",
          popup = ~paste("<b>", retailer_name, "</b><br/>County: ", district_name, "<br/>Status: <b>SAFE</b>")
        )
      }
      
      # Draw AT-RISK retailers
      if(nrow(risk_data) > 0) {
        pal <- colorFactor(
          palette = c("#d1495b", "#edae49", "#00798c", "#6c757d"), 
          domain = c("CRITICAL", "WARNING", "MONITOR", "INFO")
        )
        
        map_proxy %>% addCircleMarkers(
          data = risk_data,
          radius = 6,
          color = ~pal(action_level),
          fillOpacity = 0.8,
          stroke = FALSE,
          group = "Retailers",
          popup = ~paste(
            "<b>", retailer_name, "</b><br/>",
            "County: ", district_name, "<br/>",
            "Action Level: <b>", action_level, "</b><br/>",
            "Hazard: ", hazard_type, "(", status, ")<br/>",
            "Distance (m): ", round(distance_to_boundary_meters, 0)
          )
        ) %>%
        addLegend("bottomright", pal = pal, values = risk_data$action_level, title = "Action Level")
      }
    }
  })
  
  # Render the Table
  output$risk_table <- DT::renderDataTable({
    data <- filtered_risk()
    if(is.null(data) || nrow(data) == 0) return(data.frame(Message="No data available"))
    
    st_drop_geometry(data) %>%
      select(retailer_id, retailer_name, district_name, hazard_type, status, action_level, distance_to_boundary_meters) %>%
      arrange(match(action_level, c("CRITICAL", "WARNING", "MONITOR", "INFO", "SAFE")), distance_to_boundary_meters)
  }, options = list(pageLength = 25))
  
  # Handle User Drawing Intersections
  observeEvent(input$risk_map_draw_new_feature, {
    feat <- input$risk_map_draw_new_feature
    
    geojson_str <- jsonlite::toJSON(
      list(type = "FeatureCollection", features = list(feat)),
      auto_unbox = TRUE, force = TRUE
    )
    geom <- sf::st_read(geojson_str, quiet = TRUE)
    st_crs(geom) <- 4326
    
    drawn_polygon(geom)
  })
  
  observeEvent(input$risk_map_draw_deleted_features, {
    drawn_polygon(NULL)
  })
}

# Run the app
shinyApp(ui = ui, server = server)
