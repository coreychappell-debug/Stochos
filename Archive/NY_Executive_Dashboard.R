# ==========================================================================
# Stochos Analytics: New York Lottery
# Executive Dashboard v2
# ==========================================================================
#
# Audience: Executive, Sales, and Finance leadership
# Design: Decision-oriented. No player-facing content.
#
# Tabs:
#   1. Executive Overview
#   2. Retailer Mix & Profitability (CENTERPIECE)
#   3. Product & Portfolio Mix
#   4. Sales Network & Geography
#   5. Forecast & Outlook
#
# Prerequisites:
#   Run NY_Exec_Dashboard_Marts.r to build all mart tables.
#
# Architecture:
#   All queries read pre-aggregated mart tables (read-only).
#   No raw fact queries. No joins in Shiny.
#
# Draw / Scratch classification:
#   Draw:    pick_3, pick_4, lotto_jackpot, monitor
#   Scratch: scratch_off, instant_win
#   Defined in mart script, consumed here as-is.
#
# ==========================================================================

library(shiny)
library(shinydashboard)
library(DBI)
library(duckdb)
library(dplyr)
library(plotly)
library(leaflet)
library(DT)
library(scales)
library(shinycssloaders)
library(htmltools)


# ==========================================================================
# CONSTANTS
# ==========================================================================

DUCKDB_FILE <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

# Stochos Executive palette — refined
EXEC_COLORS <- list(
  navy      = "#0a1628",
  dark_bg   = "#0d1b2a",
  card_bg   = "#1b2838",
  blue      = "#00b4d8",
  green     = "#06d6a0",
  gold      = "#ffd166",
  red       = "#ef476f",
  purple    = "#7b68ee",
  text      = "#e0e6ed",
  muted     = "#667788",
  draw      = "#00b4d8",
  scratch   = "#ffd166"
)


# ==========================================================================
# HELPERS
# ==========================================================================

safe_query <- function(con, sql) {
  tryCatch(
    dbGetQuery(con, sql),
    error = function(e) {
      warning("Query failed: ", conditionMessage(e))
      data.frame()
    }
  )
}

fmt_dollar <- function(x) {
  ifelse(abs(x) >= 1e9, paste0("$", round(x / 1e9, 2), "B"),
    ifelse(abs(x) >= 1e6, paste0("$", round(x / 1e6, 1), "M"),
      ifelse(abs(x) >= 1e3, paste0("$", round(x / 1e3, 0), "K"),
        paste0("$", round(x, 0))
      )
    )
  )
}

fmt_pct <- function(x) paste0(round(x * 100, 1), "%")

stochos_layout <- function(p) {
  p %>% layout(
    paper_bgcolor = "rgba(0,0,0,0)",
    plot_bgcolor  = "rgba(0,0,0,0)",
    font          = list(color = "#b0bec5", family = "Inter, sans-serif"),
    xaxis         = list(gridcolor = "rgba(255,255,255,0.05)",
                         zerolinecolor = "rgba(255,255,255,0.05)"),
    yaxis         = list(gridcolor = "rgba(255,255,255,0.05)",
                         zerolinecolor = "rgba(255,255,255,0.05)"),
    margin        = list(t = 40, r = 20)
  )
}

stochos_empty_plot <- function(msg = "No data available for current selection.") {
  plot_ly() %>%
    layout(
      annotations = list(list(
        text = msg, showarrow = FALSE,
        font = list(color = "#667788", size = 14),
        xref = "paper", yref = "paper", x = 0.5, y = 0.5
      )),
      paper_bgcolor = "rgba(0,0,0,0)",
      plot_bgcolor  = "rgba(0,0,0,0)",
      xaxis = list(visible = FALSE),
      yaxis = list(visible = FALSE)
    )
}

scope_label_ui <- function(label, style = "filtered") {
  bg <- if (style == "filtered") "rgba(0,180,216,0.08)" else "rgba(255,209,102,0.08)"
  border <- if (style == "filtered") "#00b4d8" else "#ffd166"
  icon_name <- if (style == "filtered") "filter" else "clock"
  fluidRow(
    column(12,
      div(style = paste0(
        "background:", bg, "; border-left:3px solid ", border,
        "; padding:8px 14px; margin-bottom:14px; border-radius:4px;",
        "color:#8899aa; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;"
      ), icon(icon_name), " ", label)
    )
  )
}

source_note_ui <- function(id) {
  div(style = "color:#556677; font-size:10px; padding:8px 0; text-align:right;
               border-top:1px solid rgba(255,255,255,0.04); margin-top:10px;",
    textOutput(id, inline = TRUE)
  )
}

# KPI card helper with comparison
kpi_card <- function(title, value, subtitle = "", color = "aqua", icon_name = "chart-line") {
  valueBox(value, title, subtitle = subtitle, icon = icon(icon_name), color = color)
}


# ==========================================================================
# CSS
# ==========================================================================

custom_css <- "
/* ===== GLOBAL ===== */
body, .content-wrapper, .main-sidebar, .left-side {
  background-color: #0a1628 !important;
  font-family: 'Inter', 'Segoe UI', sans-serif !important;
}
.content-wrapper { background-color: #0d1b2a !important; }

/* ===== HEADER ===== */
.main-header .navbar,
.main-header .logo { background-color: #0d1b2a !important; border-bottom: 1px solid #1b263b !important; }
.main-header .logo { color: #00b4d8 !important; font-weight: 700 !important; letter-spacing: 1px !important; }

/* ===== SIDEBAR ===== */
.main-sidebar, .left-side { background-color: #0a1628 !important; border-right: 1px solid #1b263b !important; }
.sidebar-menu > li > a { color: #8899aa !important; font-size: 13px !important; }
.sidebar-menu > li > a:hover,
.sidebar-menu > li.active > a { color: #e0e6ed !important; background-color: rgba(0,180,216,0.08) !important; border-left: 3px solid #00b4d8 !important; }

/* ===== BOXES / CARDS ===== */
.box { background: #1b2838 !important; border: 1px solid #2d3a4a !important; border-top: none !important; border-radius: 6px !important; }
.box-header { border-bottom: 1px solid #2d3a4a !important; }
.box-header .box-title { color: #c5d0dc !important; font-weight: 600 !important; font-size: 13px !important; }

/* ===== VALUE BOXES ===== */
.small-box { background: linear-gradient(135deg, #1b2838 0%, #0d1b2a 100%) !important; border: 1px solid #2d3a4a !important; border-radius: 8px !important; }
.small-box h3 { font-size: 22px !important; color: #e0e6ed !important; font-weight: 700 !important; }
.small-box p { color: #8899aa !important; font-size: 12px !important; }
.small-box .icon-large { color: rgba(0,180,216,0.15) !important; }
.small-box .small-box-footer { background: rgba(0,0,0,0.15) !important; color: #667788 !important; border-top: 1px solid #2d3a4a !important; }
.bg-aqua { border-left: 3px solid #00b4d8 !important; }
.bg-green { border-left: 3px solid #06d6a0 !important; }
.bg-yellow { border-left: 3px solid #ffd166 !important; }
.bg-red { border-left: 3px solid #ef476f !important; }
.bg-purple { border-left: 3px solid #7b68ee !important; }

/* ===== DATATABLES ===== */
.dataTables_wrapper { color: #8899aa !important; }
table.dataTable { background: transparent !important; color: #c5d0dc !important; }
table.dataTable thead th { background: #0d1b2a !important; color: #8899aa !important; border-bottom: 1px solid #2d3a4a !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
table.dataTable tbody tr { background: transparent !important; }
table.dataTable tbody tr:hover { background: rgba(0,180,216,0.06) !important; }
table.dataTable tbody td { border-bottom: 1px solid rgba(255,255,255,0.03) !important; font-size: 12px !important; }
.dataTables_info, .dataTables_length, .dataTables_filter { color: #667788 !important; font-size: 11px !important; }
.dataTables_filter input { background: #0d1b2a !important; border: 1px solid #2d3a4a !important; color: #c5d0dc !important; border-radius: 4px !important; }
.dataTables_paginate .paginate_button { color: #667788 !important; }
.dataTables_paginate .paginate_button.current { background: #00b4d8 !important; color: #fff !important; border-radius: 4px !important; }

/* ===== INPUTS ===== */
.form-control, .selectize-input { background: #0d1b2a !important; border: 1px solid #2d3a4a !important; color: #c5d0dc !important; border-radius: 4px !important; }
.selectize-dropdown { background: #1b2838 !important; color: #c5d0dc !important; border: 1px solid #2d3a4a !important; }
.selectize-dropdown .option:hover { background: rgba(0,180,216,0.15) !important; }
label { color: #8899aa !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }

/* ===== PLOTLY ===== */
.plotly .modebar-btn path { fill: #556677 !important; }
.plotly .modebar-btn:hover path { fill: #00b4d8 !important; }

/* ===== LEAFLET ===== */
.leaflet-container { background: #0a1628 !important; }

/* ===== SPINNERS ===== */
.shiny-spinner-output-container { background-color: transparent !important; }

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: #0a1628; }
::-webkit-scrollbar-thumb { background: #2d3a4a; border-radius: 4px; }

/* ===== SIDEBAR BRAND ===== */
.sidebar-brand { text-align:center; padding:18px 15px 12px; }
.sidebar-brand h4 { color:#00b4d8; font-weight:700; font-size:18px; margin:0; letter-spacing:2px; }
.sidebar-brand p { color:#556677; font-size:10px; margin:4px 0 0; text-transform:uppercase; letter-spacing:1px; }
.sidebar-divider { border-color:#1b263b !important; margin:8px 15px !important; }
.sidebar-version { position:absolute; bottom:0; width:100%; text-align:center; padding:10px 0; }
.sidebar-version p { color:#3d4a5a; font-size:9px; margin:2px 0; }

/* ===== ALERT SEVERITY ===== */
.alert-high { border-left: 3px solid #ef476f; }
.alert-medium { border-left: 3px solid #ffd166; }
.alert-low { border-left: 3px solid #06d6a0; }
"


# ==========================================================================
# UI DEFINITION
# ==========================================================================

ui <- dashboardPage(
  skin = "black",

  dashboardHeader(
    title = span(icon("chart-line"), " Stochos: Executive"),
    titleWidth = 280
  ),

  dashboardSidebar(
    width = 280,
    div(class = "sidebar-brand",
      h4("STOCHOS"),
      p("Executive Dashboard")
    ),
    hr(class = "sidebar-divider"),

    # Global date filter
    div(style = "padding: 5px 18px 8px;",
      dateRangeInput("date_range", "Analysis Period",
        start     = "2024-01-01",
        end       = Sys.Date(),
        min       = "2020-01-01",
        max       = Sys.Date() + 365,
        separator = " to "
      )
    ),
    hr(class = "sidebar-divider"),

    sidebarMenu(
      id = "main_tabs",
      menuItem("Executive Overview",     tabName = "exec_overview",     icon = icon("gauge-high")),
      menuItem("Retailer Mix & Profit",  tabName = "retailer_mix",      icon = icon("store")),
      menuItem("Product & Portfolio",    tabName = "product_mix",       icon = icon("cubes")),
      menuItem("Network & Geography",   tabName = "geo_network",       icon = icon("earth-americas")),
      menuItem("Forecast & Outlook",    tabName = "forecast_outlook",  icon = icon("chart-area"))
    ),

    div(class = "sidebar-version",
      p("Executive Dashboard v1.0"),
      p("Stochos Analytics Platform")
    )
  ),

  dashboardBody(
    tags$head(
      tags$style(HTML(custom_css)),
      tags$link(
        href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        rel = "stylesheet"
      )
    ),

    tabItems(

      # ================================================================
      # TAB 1: EXECUTIVE OVERVIEW
      # ================================================================
      tabItem(tabName = "exec_overview",

        scope_label_ui("Filtered by selected period", style = "filtered"),

        # Primary KPIs
        fluidRow(
          valueBoxOutput("exec_kpi_gross",      width = 3),
          valueBoxOutput("exec_kpi_net",        width = 3),
          valueBoxOutput("exec_kpi_payout",     width = 3),
          valueBoxOutput("exec_kpi_commission", width = 3)
        ),

        # Secondary KPIs
        fluidRow(
          valueBoxOutput("exec_kpi_retailers",  width = 3),
          valueBoxOutput("exec_kpi_draw_share", width = 3),
          valueBoxOutput("exec_kpi_rate",       width = 3),
          valueBoxOutput("exec_kpi_avg_retail", width = 3)
        ),

        # Trend + Waterfall
        fluidRow(
          box(title = "Monthly Performance Trend", width = 7,
            withSpinner(plotlyOutput("exec_trend", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Economic Waterfall", width = 5,
            withSpinner(plotlyOutput("exec_waterfall", height = "380px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Mix comparison + Alerts
        fluidRow(
          box(title = "Sales Mix vs Contribution Mix", width = 6,
            withSpinner(plotlyOutput("exec_mix_compare", height = "320px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Performance Alerts", width = 6,
            withSpinner(DTOutput("exec_alerts_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("exec_source")))
      ),

      # ================================================================
      # TAB 2: RETAILER MIX & PROFITABILITY (CENTERPIECE)
      # ================================================================
      tabItem(tabName = "retailer_mix",

        scope_label_ui("Lifetime performance — all available history", style = "lifetime"),

        # Tab-level filters
        fluidRow(
          column(4,
            selectizeInput("rtl_filter_county", "County",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All counties"))
          ),
          column(4,
            selectizeInput("rtl_filter_channel", "Business Type",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All channels"))
          ),
          column(4,
            div(style = "padding-top: 25px; color: #8899aa; font-size: 12px;",
              textOutput("rtl_filter_summary")
            )
          )
        ),

        # Quadrant summary cards
        fluidRow(
          valueBoxOutput("rtl_quad_hd_hc", width = 3),
          valueBoxOutput("rtl_quad_hd_lc", width = 3),
          valueBoxOutput("rtl_quad_hs_hc", width = 3),
          valueBoxOutput("rtl_quad_hs_lc", width = 3)
        ),

        # Scatterplot + Channel summary
        fluidRow(
          box(title = "Retailer Scatterplot: Draw Share vs Contribution Rate",
              width = 8,
            withSpinner(plotlyOutput("rtl_scatter", height = "480px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Channel Mix", width = 4,
            withSpinner(plotlyOutput("rtl_channel_bar", height = "480px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Retailer ranking table
        fluidRow(
          box(title = "Retailer Ranking — Sortable by Any Column", width = 12,
            withSpinner(DTOutput("rtl_table"), type = 6, color = "#00b4d8")
          )
        ),

        # Map filters
        fluidRow(
          box(title = "Retailer Contribution Map", width = 12,
            fluidRow(
              column(4,
                selectizeInput("map_county", "Filter by County",
                  choices = NULL, multiple = TRUE,
                  options = list(placeholder = "All counties"))
              ),
              column(3,
                selectInput("map_quadrant", "Filter by Quadrant",
                  choices = c("All" = "all",
                              "High Draw / High Contribution" = "High Draw / High Contribution",
                              "High Draw / Low Contribution"  = "High Draw / Low Contribution",
                              "High Scratch / High Contribution" = "High Scratch / High Contribution",
                              "High Scratch / Low Contribution"  = "High Scratch / Low Contribution"),
                  selected = "all")
              ),
              column(3,
                sliderInput("map_min_revenue", "Min Gross Revenue",
                  min = 0, max = 5000000, value = 0,
                  step = 50000, pre = "$", sep = ",")
              ),
              column(2,
                div(style = "padding-top: 25px;",
                  textOutput("map_retailer_count")
                )
              )
            ),
            withSpinner(leafletOutput("rtl_map", height = "500px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("rtl_source")))
      ),

      # ================================================================
      # TAB 3: PRODUCT & PORTFOLIO MIX
      # ================================================================
      tabItem(tabName = "product_mix",

        scope_label_ui("Lifetime performance — all available history", style = "lifetime"),

        # Tab-level filters
        fluidRow(
          column(4,
            selectInput("prod_filter_group", "Product Group",
              choices = c("All" = "all", "Draw" = "Draw", "Scratch" = "Scratch"),
              selected = "all")
          ),
          column(4,
            selectizeInput("prod_filter_family", "Game Family",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All families"))
          ),
          column(4,
            div(style = "padding-top: 25px; color: #8899aa; font-size: 12px;",
              textOutput("prod_filter_summary")
            )
          )
        ),

        # Category bar + Contribution rate
        fluidRow(
          box(title = "Sales vs Contribution by Product Family", width = 7,
            withSpinner(plotlyOutput("prod_category_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Contribution Rate by Product Family", width = 5,
            withSpinner(plotlyOutput("prod_rate_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Monthly trend + lifecycle
        fluidRow(
          box(title = "Draw vs Scratch — Monthly Trend", width = 7,
            withSpinner(plotlyOutput("prod_trend", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Product Lifecycle Status", width = 5,
            withSpinner(DTOutput("prod_lifecycle_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("prod_source")))
      ),

      # ================================================================
      # TAB 4: SALES NETWORK & GEOGRAPHY
      # ================================================================
      tabItem(tabName = "geo_network",

        scope_label_ui("Lifetime performance — all available history", style = "lifetime"),

        # Tab-level filters
        fluidRow(
          column(4,
            selectizeInput("geo_filter_county", "Filter by County",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All counties — showing statewide"))
          ),
          column(4,
            selectizeInput("geo_filter_channel", "Filter by Channel",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All channels"))
          ),
          column(4,
            div(style = "padding-top: 25px; color: #8899aa; font-size: 12px;",
              textOutput("geo_filter_summary")
            )
          )
        ),

        # KPIs
        fluidRow(
          valueBoxOutput("geo_counties",  width = 4),
          valueBoxOutput("geo_top_county", width = 4),
          valueBoxOutput("geo_top_city",  width = 4)
        ),

        # County bar + City table
        fluidRow(
          box(title = "Top 20 Counties — Net Contribution", width = 7,
            withSpinner(plotlyOutput("geo_county_bar", height = "450px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "County Leaderboard", width = 5,
            withSpinner(DTOutput("geo_county_table"), type = 6, color = "#00b4d8")
          )
        ),

        # Geo-channel mix + city leaderboard
        fluidRow(
          box(title = "Channel Mix by Top Counties", width = 6,
            withSpinner(DTOutput("geo_channel_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "City Leaderboard", width = 6,
            withSpinner(DTOutput("geo_city_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("geo_source")))
      ),

      # ================================================================
      # TAB 5: FORECAST & OUTLOOK
      # ================================================================
      tabItem(tabName = "forecast_outlook",

        scope_label_ui("Forecast from latest available actuals — preliminary, limited history",
                       style = "lifetime"),

        # Summary cards
        fluidRow(
          valueBoxOutput("fc_3mo",  width = 4),
          valueBoxOutput("fc_12mo", width = 4),
          valueBoxOutput("fc_24mo", width = 4)
        ),

        # Forecast charts
        fluidRow(
          box(title = "Gross Revenue — Actual vs Forecast", width = 6,
            withSpinner(plotlyOutput("fc_gross_chart", height = "400px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Net Contribution — Actual vs Forecast", width = 6,
            withSpinner(plotlyOutput("fc_net_chart", height = "400px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Assumptions
        fluidRow(
          box(title = "Forecast Assumptions", width = 12,
            div(style = "color: #8899aa; font-size: 12px; padding: 10px;",
              textOutput("fc_assumptions")
            )
          )
        ),

        fluidRow(column(12, source_note_ui("fc_source")))
      )

    ) # end tabItems
  ) # end dashboardBody
) # end dashboardPage


# ==========================================================================
# SERVER
# ==========================================================================

server <- function(input, output, session) {

  # --- DuckDB Connection (read-only) ---
  con <- dbConnect(duckdb(), DUCKDB_FILE, read_only = TRUE)
  session$onSessionEnded(function() { dbDisconnect(con, shutdown = FALSE) })

  # --- Data max date ---
  data_max_date <- reactive({
    d <- safe_query(con, "SELECT MAX(date) AS d FROM mart_exec_overview_daily")
    if (nrow(d) > 0 && !is.na(d$d)) as.Date(d$d) else Sys.Date()
  })


  # ======================================================================
  # DATA REACTIVES
  # ======================================================================

  # Executive Overview (date-filtered)
  exec_daily <- reactive({
    d1 <- format(input$date_range[1], "%Y-%m-%d")
    d2 <- format(input$date_range[2], "%Y-%m-%d")
    safe_query(con, paste0(
      "SELECT * FROM mart_exec_overview_daily WHERE date >= '", d1,
      "' AND date <= '", d2, "' ORDER BY date"
    ))
  })

  exec_mix <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_mix_summary")
  })

  exec_alerts <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_alerts ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END")
  })

  # Retailer (lifetime)
  retailer_mix_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_retailer_mix ORDER BY gross_revenue DESC")
  })

  retailer_quad_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_retailer_quadrants ORDER BY gross_revenue DESC")
  })

  channel_mix_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_channel_mix ORDER BY gross_revenue DESC")
  })

  # Product (lifetime)
  product_mix_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_product_mix ORDER BY gross_revenue DESC")
  })

  product_lifecycle_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_product_lifecycle ORDER BY gross_revenue DESC")
  })

  product_ts_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_product_timeseries ORDER BY month, product_group")
  })

  # Geography
  geo_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_geo_contribution ORDER BY gross_revenue DESC")
  })

  geo_channel_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_geo_channel_mix ORDER BY gross_revenue DESC")
  })

  # Forecast
  forecast_monthly <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_forecast_monthly ORDER BY forecast_month")
  })

  forecast_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_forecast_summary")
  })


  # ======================================================================
  # TAB 1: EXECUTIVE OVERVIEW
  # ======================================================================

  # --- Primary KPIs ---
  output$exec_kpi_gross <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data for selected period"))
    valueBox(fmt_dollar(sum(df$gross_revenue, na.rm = TRUE)),
             "Gross Revenue", icon = icon("dollar-sign"), color = "aqua")
  })

  output$exec_kpi_net <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    valueBox(fmt_dollar(sum(df$net_contribution, na.rm = TRUE)),
             "Net Contribution", icon = icon("coins"), color = "green")
  })

  output$exec_kpi_payout <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    valueBox(fmt_dollar(sum(df$estimated_payout, na.rm = TRUE)),
             "Estimated Payout", icon = icon("hand-holding-dollar"), color = "yellow")
  })

  output$exec_kpi_commission <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    valueBox(fmt_dollar(sum(df$retailer_commission, na.rm = TRUE)),
             "Retailer Commission", icon = icon("handshake"), color = "red")
  })

  # --- Secondary KPIs ---
  output$exec_kpi_retailers <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    peak <- max(df$active_retailers, na.rm = TRUE)
    valueBox(format(peak, big.mark = ","),
             "Active Retailers (Daily Peak)", icon = icon("store"), color = "aqua")
  })

  output$exec_kpi_draw_share <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    total_draw <- sum(df$draw_revenue, na.rm = TRUE)
    total_all  <- sum(df$gross_revenue, na.rm = TRUE)
    valueBox(fmt_pct(total_draw / max(total_all, 1)),
             "Draw Share of Sales", icon = icon("ticket"), color = "green")
  })

  output$exec_kpi_rate <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    rate <- sum(df$net_contribution, na.rm = TRUE) / max(sum(df$gross_revenue, na.rm = TRUE), 1)
    valueBox(fmt_pct(rate),
             "Contribution Rate", icon = icon("percent"), color = "yellow")
  })

  output$exec_kpi_avg_retail <- renderValueBox({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data"))
    avg <- mean(df$avg_sales_per_retailer, na.rm = TRUE)
    valueBox(fmt_dollar(avg),
             "Avg Daily Sales / Retailer", icon = icon("chart-bar"), color = "purple")
  })

  # --- Trend chart ---
  output$exec_trend <- renderPlotly({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data for selected period."))

    monthly <- df %>%
      mutate(month = as.Date(format(date, "%Y-%m-01"))) %>%
      group_by(month) %>%
      summarise(
        gross_revenue    = sum(gross_revenue, na.rm = TRUE),
        net_contribution = sum(net_contribution, na.rm = TRUE),
        .groups = "drop"
      )

    plot_ly(monthly, x = ~month) %>%
      add_trace(y = ~gross_revenue, name = "Gross Revenue",
                type = "scatter", mode = "lines+markers",
                line = list(color = "#00b4d8", width = 2.5),
                marker = list(color = "#00b4d8", size = 5)) %>%
      add_trace(y = ~net_contribution, name = "Net Contribution",
                type = "scatter", mode = "lines+markers",
                line = list(color = "#06d6a0", width = 2.5),
                marker = list(color = "#06d6a0", size = 5)) %>%
      stochos_layout() %>%
      layout(
        xaxis = list(title = ""),
        yaxis = list(title = "", tickformat = "$,.0s"),
        legend = list(orientation = "h", y = -0.12, x = 0.3),
        hovermode = "x unified"
      )
  })

  # --- Waterfall ---
  output$exec_waterfall <- renderPlotly({
    df <- exec_daily()
    validate(need(nrow(df) > 0, "No data."))

    gross  <- sum(df$gross_revenue, na.rm = TRUE)
    payout <- sum(df$estimated_payout, na.rm = TRUE)
    comm   <- sum(df$retailer_commission, na.rm = TRUE)
    net    <- sum(df$net_contribution, na.rm = TRUE)

    wf <- data.frame(
      step = c("Gross Revenue", "Est. Payouts", "Retailer Comm.", "Net Contribution"),
      value = c(gross, -payout, -comm, net),
      measure = c("absolute", "relative", "relative", "total"),
      stringsAsFactors = FALSE
    )

    plot_ly(wf, x = ~factor(step, levels = step), y = ~value,
            type = "waterfall", measure = ~measure,
            increasing = list(marker = list(color = "#00b4d8")),
            decreasing = list(marker = list(color = "#ef476f")),
            totals     = list(marker = list(color = "#06d6a0")),
            textposition = "outside",
            text = ~paste0(ifelse(value >= 0, "+", ""), fmt_dollar(value)),
            textfont = list(color = "#8899aa", size = 11),
            hoverinfo = "text",
            hovertext = ~paste0(step, ": ", dollar(abs(value)))
    ) %>%
      stochos_layout() %>%
      layout(xaxis = list(title = ""), yaxis = list(title = "", tickformat = "$,.0s"))
  })

  # --- Mix comparison ---
  output$exec_mix_compare <- renderPlotly({
    df <- exec_mix()
    validate(need(nrow(df) > 0, "No mix data."))

    df <- df %>% filter(product_group != "Other")

    plot_ly(df) %>%
      add_trace(x = ~product_group, y = ~pct_sales, name = "% of Sales",
                type = "bar", marker = list(color = "#00b4d8"),
                text = ~fmt_pct(pct_sales), textposition = "outside",
                textfont = list(color = "#8899aa", size = 11)) %>%
      add_trace(x = ~product_group, y = ~pct_contribution, name = "% of Contribution",
                type = "bar", marker = list(color = "#06d6a0"),
                text = ~fmt_pct(pct_contribution), textposition = "outside",
                textfont = list(color = "#8899aa", size = 11)) %>%
      stochos_layout() %>%
      layout(
        barmode = "group",
        xaxis = list(title = ""),
        yaxis = list(title = "", tickformat = ".0%"),
        legend = list(orientation = "h", y = -0.15, x = 0.2)
      )
  })

  # --- Alerts ---
  output$exec_alerts_table <- renderDT({
    df <- exec_alerts()
    validate(need(nrow(df) > 0, "No alerts generated."))

    tbl <- df %>%
      mutate(
        `Variance` = case_when(
          alert_type == "rate_change" ~ paste0(round(variance_abs * 100, 2), " pts"),
          alert_type == "mix_shift" ~ paste0(round(variance_abs * 100, 2), " pts"),
          !is.na(variance_pct) ~ paste0(ifelse(variance_pct > 0, "+", ""), round(variance_pct * 100, 1), "%"),
          TRUE ~ "—"
        )
      ) %>%
      select(
        Severity = severity,
        Alert = alert_label,
        Current = alert_value,
        Prior = comparison_value,
        Variance
      )

    datatable(tbl,
      options = list(pageLength = 10, dom = "t", scrollX = TRUE,
                     columnDefs = list(list(className = "dt-right", targets = 2:4))),
      rownames = FALSE
    )
  })

  output$exec_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_exec_overview_daily, mart_exec_mix_summary, mart_exec_alerts",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 2: RETAILER MIX & PROFITABILITY
  # ======================================================================

  # --- Tab-level filter initialization ---
  observe({
    df <- retailer_mix_data()
    if (nrow(df) > 0) {
      counties <- sort(unique(df$county[!is.na(df$county) & df$county != ""]))
      channels <- sort(unique(df$business_type[!is.na(df$business_type) & df$business_type != ""]))
      updateSelectizeInput(session, "rtl_filter_county", choices = counties, selected = character(0))
      updateSelectizeInput(session, "rtl_filter_channel", choices = channels, selected = character(0))
    }
  })

  # --- Tab-level filtered reactive ---
  rtl_filtered <- reactive({
    df <- retailer_mix_data()
    if (!is.null(input$rtl_filter_county) && length(input$rtl_filter_county) > 0) {
      df <- df %>% filter(county %in% input$rtl_filter_county)
    }
    if (!is.null(input$rtl_filter_channel) && length(input$rtl_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$rtl_filter_channel)
    }
    df
  })

  rtl_quad_filtered <- reactive({
    df <- retailer_quad_data()
    if (!is.null(input$rtl_filter_county) && length(input$rtl_filter_county) > 0) {
      df <- df %>% filter(county %in% input$rtl_filter_county)
    }
    if (!is.null(input$rtl_filter_channel) && length(input$rtl_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$rtl_filter_channel)
    }
    df
  })

  output$rtl_filter_summary <- renderText({
    df <- rtl_filtered()
    paste0(format(nrow(df), big.mark = ","), " retailers  |  ",
           fmt_dollar(sum(df$gross_revenue, na.rm = TRUE)), " gross revenue")
  })

  # Quadrant summary cards
  output$rtl_quad_hd_hc <- renderValueBox({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No data"))
    n <- sum(df$quadrant_label == "High Draw / High Contribution")
    valueBox(n, "High Draw / High Contribution",
             icon = icon("star"), color = "green")
  })

  output$rtl_quad_hd_lc <- renderValueBox({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No data"))
    n <- sum(df$quadrant_label == "High Draw / Low Contribution")
    valueBox(n, "High Draw / Low Contribution",
             icon = icon("arrow-trend-down"), color = "yellow")
  })

  output$rtl_quad_hs_hc <- renderValueBox({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No data"))
    n <- sum(df$quadrant_label == "High Scratch / High Contribution")
    valueBox(n, "High Scratch / High Contribution",
             icon = icon("arrow-trend-up"), color = "aqua")
  })

  output$rtl_quad_hs_lc <- renderValueBox({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No data"))
    n <- sum(df$quadrant_label == "High Scratch / Low Contribution")
    valueBox(n, "High Scratch / Low Contribution",
             icon = icon("exclamation-triangle"), color = "red")
  })

  # --- Scatterplot ---
  output$rtl_scatter <- renderPlotly({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No retailer data for selected filters."))

    plot_ly(df,
      x    = ~draw_share,
      y    = ~contribution_rate,
      size = ~gross_revenue,
      color = ~quadrant_label,
      colors = c(
        "High Draw / High Contribution"    = "#06d6a0",
        "High Draw / Low Contribution"     = "#ffd166",
        "High Scratch / High Contribution" = "#00b4d8",
        "High Scratch / Low Contribution"  = "#ef476f"
      ),
      type = "scatter", mode = "markers",
      marker = list(opacity = 0.6, line = list(width = 0.5, color = "#0a1628")),
      sizes = c(4, 30),
      text = ~paste0(retailer_name,
                     "<br>City: ", city,
                     "<br>Gross: ", dollar(gross_revenue),
                     "<br>Net: ", dollar(net_contribution),
                     "<br>Draw Share: ", round(draw_share * 100, 1), "%",
                     "<br>Contrib Rate: ", round(contribution_rate * 100, 1), "%"),
      hoverinfo = "text"
    ) %>%
      stochos_layout() %>%
      layout(
        xaxis = list(title = "Draw Share of Sales", tickformat = ".0%"),
        yaxis = list(title = "Contribution Rate", tickformat = ".0%"),
        legend = list(orientation = "h", y = -0.15, x = 0, font = list(size = 10)),
        shapes = list(
          list(type = "line", x0 = df$median_draw_share[1], x1 = df$median_draw_share[1],
               y0 = 0, y1 = 1, yref = "paper",
               line = list(color = "rgba(255,255,255,0.15)", dash = "dot", width = 1)),
          list(type = "line", y0 = df$median_contribution_rate[1], y1 = df$median_contribution_rate[1],
               x0 = 0, x1 = 1, xref = "paper",
               line = list(color = "rgba(255,255,255,0.15)", dash = "dot", width = 1))
        )
      )
  })

  # --- Channel bar ---
  output$rtl_channel_bar <- renderPlotly({
    df <- channel_mix_data()
    validate(need(nrow(df) > 0, "No channel data."))

    # If channel filter is set, filter here too
    if (!is.null(input$rtl_filter_channel) && length(input$rtl_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$rtl_filter_channel)
    }
    df <- df %>% head(10)

    plot_ly(df, y = ~reorder(business_type, gross_revenue), x = ~gross_revenue,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#ef476f"), c(0.5, "#ffd166"), c(1, "#06d6a0")),
                          colorbar = list(title = list(text = "Contrib Rate", font = list(color = "#8899aa")),
                                          tickformat = ".0%", tickfont = list(color = "#8899aa")),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~paste0(fmt_pct(contribution_rate)),
            textposition = "auto",
            textfont = list(color = "#e0e6ed", size = 10),
            hoverinfo = "text",
            hovertext = ~paste0(business_type,
                               "<br>Revenue: ", dollar(gross_revenue),
                               "<br>Contribution: ", dollar(net_contribution),
                               "<br>Rate: ", round(contribution_rate * 100, 1), "%",
                               "<br>Draw Share: ", round(draw_share * 100, 1), "%",
                               "<br>Retailers: ", retailer_count)
    ) %>%
      stochos_layout() %>%
      layout(yaxis = list(title = ""), xaxis = list(title = "", tickformat = "$,.0s"),
             margin = list(l = 140))
  })

  # --- Retailer table ---
  output$rtl_table <- renderDT({
    df <- rtl_filtered()
    validate(need(nrow(df) > 0, "No retailer data for selected filters."))

    tbl <- df %>%
      select(
        Retailer = retailer_name,
        City     = city,
        County   = county,
        Channel  = business_type,
        `Gross Revenue`    = gross_revenue,
        `Net Contribution` = net_contribution,
        `Draw Share`       = draw_share,
        `Scratch Share`    = scratch_share,
        `Contrib Rate`     = contribution_rate,
        `Avg Daily $`      = avg_daily_sales
      )

    datatable(tbl,
      options = list(pageLength = 20, scrollX = TRUE, dom = "frtip",
                     order = list(list(4, "desc")),
                     columnDefs = list(list(className = "dt-right", targets = 4:9))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution", "Avg Daily $"), digits = 0) %>%
      formatPercentage(c("Draw Share", "Scratch Share", "Contrib Rate"), digits = 1)
  })

  # --- Retailer map ---
  # Populate county choices dynamically
  observe({
    df <- retailer_mix_data()
    if (nrow(df) > 0) {
      counties <- sort(unique(df$county[!is.na(df$county) & df$county != ""]))
      updateSelectizeInput(session, "map_county", choices = counties, selected = character(0))
    }
  })

  # Filtered map data reactive (cascades from tab-level filters)
  map_filtered <- reactive({
    df <- rtl_filtered() %>%
      filter(!is.na(latitude) & !is.na(longitude) &
             latitude >= 40.45 & latitude <= 45.10 &
             longitude >= -79.90 & longitude <= -71.80)

    # County filter
    if (!is.null(input$map_county) && length(input$map_county) > 0) {
      df <- df %>% filter(county %in% input$map_county)
    }

    # Quadrant filter (join quadrant labels)
    if (!is.null(input$map_quadrant) && input$map_quadrant != "all") {
      quad_df <- retailer_quad_data() %>% select(retailer_id, quadrant_label)
      df <- df %>%
        inner_join(quad_df, by = "retailer_id") %>%
        filter(quadrant_label == input$map_quadrant)
    }

    # Revenue floor
    if (!is.null(input$map_min_revenue) && input$map_min_revenue > 0) {
      df <- df %>% filter(gross_revenue >= input$map_min_revenue)
    }

    df
  })

  output$map_retailer_count <- renderText({
    df <- map_filtered()
    paste0(format(nrow(df), big.mark = ","), " retailers shown")
  })

  output$rtl_map <- renderLeaflet({
    df <- map_filtered()
    validate(need(nrow(df) > 0, "No retailers match the current filters."))

    pal <- colorNumeric(
      palette = c("#ef476f", "#ffd166", "#06d6a0"),
      domain = df$contribution_rate, na.color = "#556677"
    )

    leaflet(df) %>%
      addProviderTiles(providers$CartoDB.DarkMatter) %>%
      addCircleMarkers(
        lng = ~longitude, lat = ~latitude,
        radius = ~pmin(pmax(sqrt(gross_revenue / 5000), 3), 12),
        color = ~pal(contribution_rate),
        fillOpacity = 0.6, stroke = FALSE,
        popup = ~paste0(
          "<b>", retailer_name, "</b><br>",
          city, ", ", county, "<br>",
          "Gross: ", dollar(gross_revenue), "<br>",
          "Net: ", dollar(net_contribution), "<br>",
          "Contrib Rate: ", round(contribution_rate * 100, 1), "%<br>",
          "Draw Share: ", round(draw_share * 100, 1), "%"
        )
      ) %>%
      addLegend("bottomright", pal = pal, values = df$contribution_rate,
                title = "Contrib Rate", labFormat = labelFormat(suffix = "%", transform = function(x) x * 100),
                opacity = 0.8)
  })

  output$rtl_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_exec_retailer_mix, mart_exec_retailer_quadrants, mart_exec_channel_mix",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 3: PRODUCT & PORTFOLIO MIX
  # ======================================================================

  # --- Tab-level filter initialization ---
  observe({
    df <- product_mix_data()
    if (nrow(df) > 0) {
      families <- sort(unique(df$game_family[!is.na(df$game_family)]))
      updateSelectizeInput(session, "prod_filter_family", choices = families, selected = character(0))
    }
  })

  # --- Filter helper ---
  prod_filtered <- reactive({
    df <- product_mix_data()
    if (!is.null(input$prod_filter_group) && input$prod_filter_group != "all") {
      df <- df %>% filter(product_group == input$prod_filter_group)
    }
    if (!is.null(input$prod_filter_family) && length(input$prod_filter_family) > 0) {
      df <- df %>% filter(game_family %in% input$prod_filter_family)
    }
    df
  })

  prod_lifecycle_filtered <- reactive({
    df <- product_lifecycle_data()
    if (!is.null(input$prod_filter_group) && input$prod_filter_group != "all") {
      df <- df %>% filter(product_group == input$prod_filter_group)
    }
    if (!is.null(input$prod_filter_family) && length(input$prod_filter_family) > 0) {
      df <- df %>% filter(game_family %in% input$prod_filter_family)
    }
    df
  })

  prod_ts_filtered <- reactive({
    df <- product_ts_data()
    if (!is.null(input$prod_filter_group) && input$prod_filter_group != "all") {
      df <- df %>% filter(product_group == input$prod_filter_group)
    }
    df
  })

  output$prod_filter_summary <- renderText({
    df <- prod_filtered()
    paste0(nrow(df), " product families  |  ",
           fmt_dollar(sum(df$gross_revenue, na.rm = TRUE)), " gross revenue")
  })

  output$prod_category_bar <- renderPlotly({
    df <- prod_filtered()
    validate(need(nrow(df) > 0, "No product data for selected filters."))

    df <- df %>% arrange(desc(gross_revenue)) %>% head(12)

    plot_ly(df) %>%
      add_trace(x = ~reorder(game_family, gross_revenue), y = ~gross_revenue,
                name = "Sales", type = "bar", marker = list(color = "#00b4d8"),
                text = ~fmt_dollar(gross_revenue), textposition = "outside",
                textfont = list(color = "#8899aa", size = 9)) %>%
      add_trace(x = ~reorder(game_family, gross_revenue), y = ~net_contribution,
                name = "Net Contribution", type = "bar", marker = list(color = "#06d6a0"),
                text = ~fmt_dollar(net_contribution), textposition = "outside",
                textfont = list(color = "#8899aa", size = 9)) %>%
      stochos_layout() %>%
      layout(barmode = "group", xaxis = list(title = "", tickangle = -30),
             yaxis = list(title = "", tickformat = "$,.0s"),
             legend = list(orientation = "h", y = -0.2, x = 0.3),
             margin = list(b = 80))
  })

  output$prod_rate_bar <- renderPlotly({
    df <- prod_filtered() %>%
      filter(!is.na(contribution_rate)) %>%
      arrange(desc(contribution_rate))
    validate(need(nrow(df) > 0, "No data for selected filters."))

    plot_ly(df, y = ~reorder(game_family, contribution_rate), x = ~contribution_rate,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#ef476f"), c(0.5, "#ffd166"), c(1, "#06d6a0")),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~fmt_pct(contribution_rate), textposition = "auto",
            textfont = list(color = "#e0e6ed", size = 10)
    ) %>%
      stochos_layout() %>%
      layout(yaxis = list(title = ""), xaxis = list(title = "Contribution Rate", tickformat = ".0%"),
             margin = list(l = 130))
  })

  output$prod_trend <- renderPlotly({
    df <- prod_ts_filtered()
    validate(need(nrow(df) > 0, "No time series data."))

    df <- df %>% filter(product_group %in% c("Draw", "Scratch"))

    plot_ly(df, x = ~month, y = ~gross_revenue, color = ~product_group,
            colors = c("Draw" = "#00b4d8", "Scratch" = "#ffd166"),
            type = "scatter", mode = "lines+markers",
            line = list(width = 2.5), marker = list(size = 5)) %>%
      stochos_layout() %>%
      layout(xaxis = list(title = ""), yaxis = list(title = "", tickformat = "$,.0s"),
             legend = list(orientation = "h", y = -0.12, x = 0.3),
             hovermode = "x unified")
  })

  output$prod_lifecycle_table <- renderDT({
    df <- prod_lifecycle_filtered()
    validate(need(nrow(df) > 0, "No lifecycle data for selected filters."))

    tbl <- df %>%
      select(
        Game        = game_name,
        Group       = product_group,
        Family      = game_family,
        Status      = lifecycle_status,
        Trend       = trend_direction,
        `Gross $`   = gross_revenue,
        `Rate`      = contribution_rate
      )

    datatable(tbl,
      options = list(pageLength = 15, dom = "frtip", scrollX = TRUE,
                     columnDefs = list(list(className = "dt-right", targets = 5:6))),
      rownames = FALSE
    ) %>%
      formatCurrency("Gross $", digits = 0) %>%
      formatPercentage("Rate", digits = 1)
  })

  output$prod_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_exec_product_mix, mart_exec_product_lifecycle, mart_exec_product_timeseries",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 4: NETWORK & GEOGRAPHY
  # ======================================================================

  # --- Tab-level filter initialization ---
  observe({
    df <- geo_data() %>% filter(geo_level == "county", county != "Unknown")
    ch <- geo_channel_data()
    if (nrow(df) > 0) {
      counties <- sort(unique(df$county))
      updateSelectizeInput(session, "geo_filter_county", choices = counties, selected = character(0))
    }
    if (nrow(ch) > 0) {
      channels <- sort(unique(ch$business_type[ch$business_type != "Unknown"]))
      updateSelectizeInput(session, "geo_filter_channel", choices = channels, selected = character(0))
    }
  })

  geo_filtered <- reactive({
    df <- geo_data()
    if (!is.null(input$geo_filter_county) && length(input$geo_filter_county) > 0) {
      df <- df %>% filter(county %in% input$geo_filter_county)
    }
    df
  })

  geo_channel_filtered <- reactive({
    df <- geo_channel_data()
    if (!is.null(input$geo_filter_county) && length(input$geo_filter_county) > 0) {
      df <- df %>% filter(county %in% input$geo_filter_county)
    }
    if (!is.null(input$geo_filter_channel) && length(input$geo_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$geo_filter_channel)
    }
    df
  })

  output$geo_filter_summary <- renderText({
    df <- geo_filtered() %>% filter(geo_level == "county", county != "Unknown")
    paste0(nrow(df), " counties  |  ",
           fmt_dollar(sum(df$net_contribution, na.rm = TRUE)), " net contribution")
  })

  output$geo_counties <- renderValueBox({
    df <- geo_filtered() %>% filter(geo_level == "county", county != "Unknown")
    validate(need(nrow(df) > 0, "No data"))
    valueBox(nrow(df), "Counties", icon = icon("map"), color = "aqua")
  })

  output$geo_top_county <- renderValueBox({
    df <- geo_filtered() %>% filter(geo_level == "county", county != "Unknown") %>%
      arrange(desc(net_contribution)) %>% head(1)
    validate(need(nrow(df) > 0, "No data"))
    valueBox(df$county, paste0("Top County — ", fmt_dollar(df$net_contribution)),
             icon = icon("trophy"), color = "green")
  })

  output$geo_top_city <- renderValueBox({
    df <- geo_filtered() %>% filter(geo_level == "city", city != "Unknown") %>%
      arrange(desc(net_contribution)) %>% head(1)
    validate(need(nrow(df) > 0, "No data"))
    valueBox(df$city, paste0("Top City — ", fmt_dollar(df$net_contribution)),
             icon = icon("city"), color = "yellow")
  })

  output$geo_county_bar <- renderPlotly({
    df <- geo_filtered() %>%
      filter(geo_level == "county", county != "Unknown") %>%
      arrange(desc(net_contribution)) %>% head(20)
    validate(need(nrow(df) > 0, "No county data for selected filters."))

    plot_ly(df, y = ~reorder(county, net_contribution), x = ~net_contribution,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#1b263b"), c(0.5, "#00b4d8"), c(1, "#06d6a0")),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~fmt_dollar(net_contribution), textposition = "auto",
            textfont = list(color = "#e0e6ed", size = 10),
            hoverinfo = "text",
            hovertext = ~paste0(county,
                               "<br>Net: ", dollar(net_contribution),
                               "<br>Gross: ", dollar(gross_revenue),
                               "<br>Rate: ", round(contribution_rate * 100, 1), "%",
                               "<br>Draw Share: ", round(draw_share * 100, 1), "%",
                               "<br>Retailers: ", retailer_count)
    ) %>%
      stochos_layout() %>%
      layout(yaxis = list(title = ""), xaxis = list(title = "Net Contribution", tickformat = "$,.0s"),
             margin = list(l = 130))
  })

  output$geo_county_table <- renderDT({
    df <- geo_filtered() %>% filter(geo_level == "county", county != "Unknown") %>%
      arrange(desc(net_contribution)) %>%
      mutate(rank = row_number()) %>%
      select(Rank = rank, County = county, `Gross $` = gross_revenue,
             `Net $` = net_contribution, Retailers = retailer_count,
             `Rate` = contribution_rate, `Draw Sh.` = draw_share)
    validate(need(nrow(df) > 0, "No data."))

    datatable(df, options = list(pageLength = 15, dom = "tip", scrollX = TRUE,
                                 columnDefs = list(list(className = "dt-right", targets = 2:6))),
              rownames = FALSE) %>%
      formatCurrency(c("Gross $", "Net $"), digits = 0) %>%
      formatPercentage(c("Rate", "Draw Sh."), digits = 1)
  })

  output$geo_channel_table <- renderDT({
    df <- geo_channel_filtered() %>%
      filter(county != "Unknown") %>%
      arrange(desc(gross_revenue)) %>% head(50) %>%
      select(County = county, Channel = business_type, `Gross $` = gross_revenue,
             `Net $` = net_contribution, Retailers = retailer_count,
             `Draw Sh.` = draw_share, `Scratch Sh.` = scratch_share)
    validate(need(nrow(df) > 0, "No data."))

    datatable(df, options = list(pageLength = 15, dom = "frtip", scrollX = TRUE,
                                 columnDefs = list(list(className = "dt-right", targets = 2:6))),
              rownames = FALSE) %>%
      formatCurrency(c("Gross $", "Net $"), digits = 0) %>%
      formatPercentage(c("Draw Sh.", "Scratch Sh."), digits = 1)
  })

  output$geo_city_table <- renderDT({
    df <- geo_filtered() %>% filter(geo_level == "city", city != "Unknown") %>%
      arrange(desc(net_contribution)) %>% head(50) %>%
      mutate(rank = row_number()) %>%
      select(Rank = rank, City = city, County = county,
             `Gross $` = gross_revenue, `Net $` = net_contribution,
             Retailers = retailer_count, `Rate` = contribution_rate)
    validate(need(nrow(df) > 0, "No data."))

    datatable(df, options = list(pageLength = 15, dom = "tip", scrollX = TRUE,
                                 columnDefs = list(list(className = "dt-right", targets = 3:6))),
              rownames = FALSE) %>%
      formatCurrency(c("Gross $", "Net $"), digits = 0) %>%
      formatPercentage("Rate", digits = 1)
  })

  output$geo_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_exec_geo_contribution, mart_exec_geo_channel_mix",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 5: FORECAST & OUTLOOK
  # ======================================================================

  output$fc_3mo <- renderValueBox({
    df <- forecast_summary()
    validate(need(nrow(df) > 0, "No forecast data"))
    row <- df %>% filter(horizon == "3mo", metric_name == "gross_revenue")
    if (nrow(row) == 0) return(valueBox("—", "3-Month Outlook", icon = icon("calendar"), color = "aqua"))
    growth_label <- if (!is.na(row$growth_vs_prior) && is.finite(row$growth_vs_prior)) {
      paste0(" (", ifelse(row$growth_vs_prior > 0, "+", ""), round(row$growth_vs_prior * 100, 1), "%)")
    } else ""
    valueBox(fmt_dollar(row$forecast_total),
             paste0("3-Month Gross Revenue", growth_label),
             icon = icon("calendar"), color = "aqua")
  })

  output$fc_12mo <- renderValueBox({
    df <- forecast_summary()
    validate(need(nrow(df) > 0, "No forecast data"))
    row <- df %>% filter(horizon == "12mo", metric_name == "gross_revenue")
    if (nrow(row) == 0) return(valueBox("—", "12-Month Outlook", icon = icon("calendar-alt"), color = "green"))
    valueBox(fmt_dollar(row$forecast_total),
             "12-Month Gross Revenue Outlook",
             icon = icon("calendar-alt"), color = "green")
  })

  output$fc_24mo <- renderValueBox({
    df <- forecast_summary()
    validate(need(nrow(df) > 0, "No forecast data"))
    row <- df %>% filter(horizon == "24mo", metric_name == "net_contribution")
    if (nrow(row) == 0) return(valueBox("—", "24-Month Net Outlook", icon = icon("chart-area"), color = "yellow"))
    valueBox(fmt_dollar(row$forecast_total),
             "24-Month Net Contribution Outlook",
             icon = icon("chart-area"), color = "yellow")
  })

  # Forecast chart builder
  build_forecast_chart <- function(metric) {
    df <- forecast_monthly()
    validate(need(nrow(df) > 0, "No forecast data."))

    metric_df <- df %>% filter(metric_name == metric)
    actuals  <- metric_df %>% filter(!is.na(actual_value))
    forecasts <- metric_df %>% filter(!is.na(forecast_value))

    if (nrow(actuals) == 0 && nrow(forecasts) == 0) {
      return(stochos_empty_plot("No forecast data for this metric."))
    }

    p <- plot_ly()

    if (nrow(actuals) > 0) {
      p <- p %>% add_trace(data = actuals, x = ~forecast_month, y = ~actual_value,
                           name = "Actual", type = "scatter", mode = "lines+markers",
                           line = list(color = "#00b4d8", width = 2.5),
                           marker = list(color = "#00b4d8", size = 5))
    }

    if (nrow(forecasts) > 0) {
      p <- p %>%
        add_trace(data = forecasts, x = ~forecast_month, y = ~upper_bound,
                  name = "Upper", type = "scatter", mode = "lines",
                  line = list(color = "transparent"), showlegend = FALSE) %>%
        add_trace(data = forecasts, x = ~forecast_month, y = ~lower_bound,
                  name = "Interval", type = "scatter", mode = "lines",
                  line = list(color = "transparent"),
                  fill = "tonexty", fillcolor = "rgba(6,214,160,0.1)") %>%
        add_trace(data = forecasts, x = ~forecast_month, y = ~forecast_value,
                  name = "Forecast", type = "scatter", mode = "lines+markers",
                  line = list(color = "#06d6a0", width = 2, dash = "dash"),
                  marker = list(color = "#06d6a0", size = 4))
    }

    p %>% stochos_layout() %>%
      layout(xaxis = list(title = ""), yaxis = list(title = "", tickformat = "$,.0s"),
             legend = list(orientation = "h", y = -0.12, x = 0.2),
             hovermode = "x unified")
  }

  output$fc_gross_chart <- renderPlotly({ build_forecast_chart("gross_revenue") })
  output$fc_net_chart   <- renderPlotly({ build_forecast_chart("net_contribution") })

  output$fc_assumptions <- renderText({
    df <- forecast_monthly() %>% filter(!is.na(forecast_value)) %>% head(1)
    version <- if (nrow(df) > 0) df$model_version else "unknown"
    gen_at  <- if (nrow(df) > 0) as.character(df$generated_at) else "unknown"
    paste0(
      "Model: ", version,
      "  |  Generated: ", gen_at,
      "  |  Method: Holt-Winters exponential smoothing with additive seasonality (12-month period)",
      "  |  Intervals: 80% prediction interval",
      "  |  Note: Preliminary forecast based on ~27 months of history. ",
      "Confidence intervals are wide due to limited seasonal cycles. ",
      "This forecast is intended for directional planning, not precision budgeting."
    )
  })

  output$fc_source <- renderText({
    paste0("Source: mart_exec_forecast_monthly, mart_exec_forecast_summary",
           "  |  Stochos Analytics Platform")
  })


} # end server


# ==========================================================================
# LAUNCH
# ==========================================================================

shinyApp(ui, server)
