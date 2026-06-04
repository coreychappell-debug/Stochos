library(shiny)
library(leaflet)
library(dplyr)

# ==============================================================================
# 1. DATABASE-FREE DATA STRUCTURES
# ==============================================================================

# District Office starting coordinates (depots)
DISTRICT_OFFICES <- list(
  "SAC" = c(38.5912, -121.4902),
  "SFO" = c(37.6547, -122.4078),
  "HAY" = c(37.6341, -122.0911),
  "SJS" = c(37.3821, -121.9056),
  "FRE" = c(36.7681, -119.7214),
  "SFS" = c(33.9172, -118.0664),
  "RIV" = c(33.9039, -117.4878),
  "SAN" = c(33.9922, -117.8967),
  "SDG" = c(32.8123, -117.1511)
)

# Mock California Lottery Retailers list
MOCK_RETAILERS <- data.frame(
  id = 1:8,
  terminal_id = c("CA5001", "CA5002", "CA5003", "CA5004", "CA6001", "CA6002", "CA7001", "CA7002"),
  name = c("Bel Air Market #511", "7-Eleven #1405", "Raley's Supermarket", "Safeway #2810", 
           "Safeway #1240", "Target Store T-24", "CVS Pharmacy #9480", "Vons Supermarket #21"),
  address = c("5100 Manzanita Ave", "4301 El Camino Ave", "4840 San Juan Ave", "5040 Arena Blvd",
              "840 Blossom Hill Rd", "950 Eastridge Mall", "6215 El Cajon Blvd", "3645 Midway Dr"),
  city = c("Carmichael", "Sacramento", "Fair Oaks", "Sacramento", "San Jose", "San Jose", "San Diego", "San Diego"),
  latitude = c(38.6586, 38.6083, 38.6541, 38.6392, 37.2519, 37.3275, 32.7761, 32.7511),
  longitude = c(-121.3283, -121.3711, -121.2721, -121.5115, -121.8624, -121.8122, -117.0631, -117.2069),
  county = c("Sacramento", "Sacramento", "Sacramento", "Sacramento", "Santa Clara", "Santa Clara", "San Diego", "San Diego"),
  district_office = c("SAC", "SAC", "SAC", "SAC", "SJS", "SJS", "SDG", "SDG"),
  last_visit = as.Date(c("2026-06-01", "2026-05-15", "2026-06-03", "2026-04-01", 
                         "2026-04-10", "2026-05-28", "2026-03-01", "2026-06-03")),
  cadence_days = c(7, 14, 14, 30, 30, 30, 14, 7), # Visit cadence (7=weekly, 14=biweekly, 30=monthly)
  stringsAsFactors = FALSE
)

# ==============================================================================
# 2. USER INTERFACE (UI)
# ==============================================================================
ui <- fluidPage(
  titlePanel("California State Lottery — VCRM Map & Route Optimizer"),
  
  # Inject styling for a modern, clean look
  tags$head(
    tags$style(HTML("
      body { background-color: #f1f5f9; color: #1e293b; font-family: 'Inter', -apple-system, sans-serif; }
      .well { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .btn-success { background-color: #107c41; border-color: #107c41; }
      .btn-success:hover { background-color: #0b5e31; border-color: #0b5e31; }
      .leaflet-container { border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      table.table { background: #ffffff; border-radius: 6px; overflow: hidden; border: 1px solid #e2e8f0; }
    "))
  ),
  
  sidebarLayout(
    sidebarPanel(
      h4("Filters & Selection"),
      selectInput("district", "Select Supervising District:", 
                  choices = c("Sacramento (SAC)" = "SAC", 
                              "San Jose (SJS)" = "SJS", 
                              "San Diego (SDG)" = "SDG")),
      
      checkboxGroupInput("freshness", "Filter Coaching Status:",
                         choices = c("🟢 Visited Recently" = "fresh",
                                     "🟡 Warning (Visit Approaching)" = "warning",
                                     "🔴 Overdue / Urgent Coaching" = "overdue"),
                         selected = c("fresh", "warning", "overdue")),
      
      hr(),
      h4(" Visitation Path (TSP)"),
      p("Sort selected stores in sequential order starting from the District Office depot to eliminate backtracks."),
      actionButton("optimize", "Calculate Optimized Sequence", class = "btn-primary btn-block"),
      uiOutput("export_ui")
    ),
    
    mainPanel(
      leafletOutput("map", height = "500px"),
      br(),
      h4("Visits Sequence"),
      tableOutput("itinerary_table")
    )
  )
)

# ==============================================================================
# 3. SERVER LOGIC
# ==============================================================================
server <- function(input, output, session) {
  
  # Reactive block: Calculate visit freshness relative to system date
  retailers_freshness <- reactive({
    df <- MOCK_RETAILERS
    today <- Sys.Date()
    
    df$days_since <- as.numeric(today - df$last_visit)
    df$freshness <- ifelse(df$days_since <= df$cadence_days, "fresh",
                           ifelse(df$days_since <= df$cadence_days * 2, "warning", "overdue"))
    return(df)
  })
  
  # Reactive block: Filter data by District and selected status checks
  filtered_retailers <- reactive({
    df <- retailers_freshness()
    df %>% 
      filter(district_office == input$district) %>%
      filter(freshness %in% input$freshness)
  })
  
  # Holds sequence order (resets when selections change)
  visit_sequence <- reactiveVal(NULL)
  
  observe({
    df <- filtered_retailers()
    if (nrow(df) > 0) {
      df$visit_order <- 1:nrow(df)
      visit_sequence(df)
    } else {
      visit_sequence(NULL)
    }
  })
  
  # Greedy Nearest Neighbor TSP Solver (using Straight-Line Distances)
  observeEvent(input$optimize, {
    df <- filtered_retailers()
    if (nrow(df) == 0) return()
    
    depot_coords <- DISTRICT_OFFICES[[input$district]]
    
    current_lat <- depot_coords[1]
    current_lng <- depot_coords[2]
    
    unvisited <- df
    ordered_list <- list()
    step <- 1
    
    # Trace nearest neighbors sequentially
    while(nrow(unvisited) > 0) {
      # Calculate simple distance (Euclidean geometry)
      dists <- sqrt((unvisited$latitude - current_lat)^2 + (unvisited$longitude - current_lng)^2)
      
      nearest_idx <- which.min(dists)
      nearest_store <- unvisited[nearest_idx, ]
      
      nearest_store$visit_order <- step
      ordered_list[[step]] <- nearest_store
      
      current_lat <- nearest_store$latitude
      current_lng <- nearest_store$longitude
      unvisited <- unvisited[-nearest_idx, ]
      step <- step + 1
    }
    
    visit_sequence(do.call(rbind, ordered_list))
  })
  
  # Initialize Base Leaflet Map
  output$map <- renderLeaflet({
    leaflet() %>%
      addProviderTiles(providers$CartoDB.Positron) %>%
      setView(lng = -119.4179, lat = 36.7783, zoom = 6) # Centers on California
  })
  
  # Update Leaflet Map layers dynamically
  observe({
    df <- visit_sequence()
    proxy <- leafletProxy("map")
    
    proxy %>% clearGroup("markers") %>% clearGroup("lines")
    if (is.null(df) || nrow(df) == 0) return()
    
    status_colors <- c("fresh" = "#06d6a0", "warning" = "#ffd166", "overdue" = "#ef476f")
    depot_coords <- DISTRICT_OFFICES[[input$district]]
    
    # 1. Add Supervising District Office Pin
    proxy %>% addMarkers(
      lng = depot_coords[2], lat = depot_coords[1],
      popup = paste0("<strong>Supervising District Office Depot (", input$district, ")</strong>"),
      group = "markers"
    )
    
    # 2. Add Retailer circles
    for (i in 1:nrow(df)) {
      proxy %>% addCircleMarkers(
        lng = df$longitude[i], lat = df$latitude[i],
        radius = 8,
        color = "#ffffff", weight = 1.5,
        fillColor = status_colors[df$freshness[i]], fillOpacity = 0.9,
        group = "markers",
        popup = paste0("<strong>", df$name[i], "</strong><br/>",
                       df$address[i], ", ", df$city[i], "<br/>",
                       "Sequence Stop: #", df$visit_order[i], "<br/>",
                       "Status: ", toupper(df$freshness[i]))
      )
    }
    
    # 3. Trace route paths polylines (depot -> stop 1 -> stop 2 ...)
    if (nrow(df) > 0) {
      sorted_df <- df %>% arrange(visit_order)
      
      route_lngs <- c(depot_coords[2], sorted_df$longitude)
      route_lats <- c(depot_coords[1], sorted_df$latitude)
      
      proxy %>% addPolylines(
        lng = route_lngs, lat = route_lats,
        color = "#1a73e8", weight = 3, opacity = 0.7, dashArray = "6, 6",
        group = "lines"
      )
      
      # Zoom to fit active locations
      proxy %>% fitBounds(
        lng1 = min(route_lngs), lat1 = min(route_lats),
        lng2 = max(route_lngs), lat2 = max(route_lats)
      )
    }
  })
  
  # Render sequence data table
  output$itinerary_table <- renderTable({
    df <- visit_sequence()
    if (is.null(df) || nrow(df) == 0) return(data.frame(Message = "No stores meet filters."))
    
    df %>% 
      arrange(visit_order) %>%
      select(Order = visit_order, Terminal = terminal_id, Name = name, City = city, Status = freshness) %>%
      mutate(Status = toupper(Status))
  })
  
  # Generate Google Maps turn-by-turn routing URL export button
  output$export_ui <- renderUI({
    df <- visit_sequence()
    if (is.null(df) || nrow(df) == 0) return(NULL)
    
    depot_coords <- DISTRICT_OFFICES[[input$district]]
    sorted_df <- df %>% arrange(visit_order)
    
    origin <- paste(depot_coords[1], depot_coords[2], sep = ",")
    stops <- paste(sorted_df$latitude, sorted_df$longitude, sep = ",", collapse = "/")
    
    gmaps_url <- paste0("https://www.google.com/maps/dir/", origin, "/", stops)
    
    tagList(
      br(),
      a("Open Navigation Route in Google Maps", href = gmaps_url, target = "_blank", 
        class = "btn btn-success btn-block")
    )
  })
}

shinyApp(ui, server)
