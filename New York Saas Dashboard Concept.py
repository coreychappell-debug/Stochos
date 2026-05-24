# ==========================================================================
# Stochos Analytics: New York Lottery
# SaaS Dashboard — Phase 1 + Phase 2
# ==========================================================================
#
# Tabs:
#   1. Executive Summary
#   2. Retailer Intelligence
#   3. Game Performance
#   4. Geographic Analytics
#   5. Winning Numbers Center
#   6. Scratch-Off Intelligence
#   7. Education Funding
#
# Prerequisites:
#   Run NY_Dashboard_Marts_Phase1.r and NY_Dashboard_Marts_Phase2.r
#   to build all mart tables before launching.
#
# Data strategy:
#   All queries read pre-aggregated mart tables in DuckDB (read-only).
#   Shiny does filtering, formatting, and display only.
#
# Acceptance criteria:
#   - All metrics from DuckDB marts (no raw fact queries)
#   - Global date filter applied on Tab 1 and Tab 3 trend; Tab 2 and 4 labeled
#     as lifetime performance
#   - "Data as of" and source mart name on every tab
#   - validate/need wrappers on every output for empty-state messaging
#   - 5 KPIs on Tab 1: Gross, Payout, Commission, Net, Active Retailers
#   - Cross-tab reconciliation: totals consistent across tabs
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

STOCHOS_COLORS <- c(
  "#00b4d8", "#06d6a0", "#ffd166", "#ef476f", "#7b68ee",
  "#fca311", "#4cc9f0", "#f72585", "#4895ef", "#3f37c9",
  "#80ed99", "#c77dff", "#48bfe3", "#64dfdf", "#e0aaff"
)


# ==========================================================================
# HELPER FUNCTIONS
# ==========================================================================

# Safe DuckDB query — returns empty data.frame on error
safe_query <- function(con, sql) {
  tryCatch(
    dbGetQuery(con, sql),
    error = function(e) {
      warning("Query failed: ", e$message)
      data.frame()
    }
  )
}

# Consistent plotly dark theme layout
stochos_layout <- function(p, title = "") {
  p %>% layout(
    title = list(
      text   = title,
      font   = list(color = "#e0e6ed", size = 16, family = "Inter"),
      x      = 0.02
    ),
    paper_bgcolor = "transparent",
    plot_bgcolor  = "transparent",
    font          = list(color = "#8899aa", family = "Inter, sans-serif", size = 12),
    xaxis         = list(gridcolor = "#1e2d3d", zerolinecolor = "#1e2d3d"),
    yaxis         = list(gridcolor = "#1e2d3d", zerolinecolor = "#1e2d3d"),
    legend        = list(font = list(color = "#8899aa", size = 11),
                         bgcolor = "transparent"),
    margin        = list(t = if (title == "") 20 else 50, b = 40, l = 60, r = 20)
  )
}

# Plotly empty fallback with message
stochos_empty_plot <- function(msg = "No data available for the selected period.") {
  plot_ly() %>%
    add_annotations(
      text      = msg,
      x         = 0.5,
      y         = 0.5,
      xref      = "paper",
      yref      = "paper",
      showarrow = FALSE,
      font      = list(color = "#556677", size = 14, family = "Inter")
    ) %>%
    stochos_layout() %>%
    layout(
      xaxis = list(visible = FALSE),
      yaxis = list(visible = FALSE)
    )
}

# Format large dollar values for KPI display
fmt_dollar <- function(val, scale = "auto") {
  if (is.na(val) || val == 0) return("$0")
  if (scale == "auto") {
    if (abs(val) >= 1e9)       scale <- "B"
    else if (abs(val) >= 1e6)  scale <- "M"
    else if (abs(val) >= 1e3)  scale <- "K"
    else                       scale <- ""
  }
  switch(scale,
    "B" = paste0("$", format(round(val / 1e9, 2), nsmall = 2, big.mark = ","), "B"),
    "M" = paste0("$", format(round(val / 1e6, 1), nsmall = 1, big.mark = ","), "M"),
    "K" = paste0("$", format(round(val / 1e3, 1), nsmall = 1, big.mark = ","), "K"),
    paste0("$", format(round(val), big.mark = ","))
  )
}

# Source note builder
source_note_ui <- function(output_id) {
  div(class = "source-note", icon("database"), " ", textOutput(output_id, inline = TRUE))
}

# Scope label builder (for tabs that show lifetime vs filtered data)
scope_label_ui <- function(text, style = "lifetime") {
  cls <- if (style == "lifetime") "scope-label scope-lifetime" else "scope-label scope-filtered"
  div(class = cls, icon(if (style == "lifetime") "clock-rotate-left" else "filter"), " ", text)
}


# ==========================================================================
# CUSTOM CSS
# ==========================================================================

custom_css <- "
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

/* ===== GLOBAL ===== */
body, .wrapper {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

.content-wrapper, .right-side {
  background-color: #0a1628 !important;
}

.content-header { display: none !important; }

/* ===== HEADER ===== */
.main-header .logo {
  background-color: #0d1b2a !important;
  color: #00b4d8 !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  letter-spacing: 0.3px !important;
}
.main-header .logo:hover { background-color: #0d1b2a !important; }
.main-header .navbar {
  background-color: #0d1b2a !important;
  border-bottom: 1px solid #1e2d3d !important;
}
.main-header .sidebar-toggle { color: #8899aa !important; }
.main-header .sidebar-toggle:hover { background-color: #1b263b !important; }

/* ===== SIDEBAR ===== */
.main-sidebar, .left-side {
  background-color: #0d1b2a !important;
}
.sidebar { padding-top: 0 !important; }

.sidebar-menu > li > a {
  color: #8899aa !important;
  font-weight: 500 !important;
  font-size: 13px !important;
  border-left: 3px solid transparent !important;
  transition: all 0.2s ease !important;
  padding: 12px 15px 12px 18px !important;
}
.sidebar-menu > li > a:hover {
  background-color: #1b263b !important;
  color: #00b4d8 !important;
  border-left-color: #00b4d8 !important;
}
.sidebar-menu > li.active > a {
  background-color: #1b2838 !important;
  color: #00b4d8 !important;
  border-left-color: #00b4d8 !important;
}
.sidebar-menu > li > a > .fa {
  color: inherit !important;
  width: 22px !important;
  text-align: center !important;
}

/* ===== BOXES / CARDS ===== */
.box {
  background-color: #1b2838 !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
  border-top: none !important;
}
.box-header {
  background-color: transparent !important;
  border-bottom: 1px solid #2d3a4a !important;
  padding: 12px 15px !important;
}
.box-header .box-title {
  color: #e0e6ed !important;
  font-weight: 600 !important;
  font-size: 13px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}
.box-body {
  background-color: transparent !important;
  color: #e0e6ed !important;
}
.box-header .btn-box-tool { color: #556677 !important; }

/* ===== VALUE BOXES ===== */
.small-box {
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease !important;
  margin-bottom: 15px !important;
}
.small-box:hover {
  transform: translateY(-3px) !important;
  box-shadow: 0 8px 30px rgba(0,0,0,0.4) !important;
}
.small-box h3 {
  font-weight: 700 !important;
  font-size: 26px !important;
  margin: 0 0 5px 0 !important;
}
.small-box p {
  font-size: 12px !important;
  font-weight: 500 !important;
  opacity: 0.9 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}
.small-box .icon-large { font-size: 55px !important; opacity: 0.15 !important; }
.small-box .small-box-footer { display: none !important; }

.small-box.bg-aqua  { background: linear-gradient(135deg, #00b4d8, #0096c7) !important; }
.small-box.bg-red   { background: linear-gradient(135deg, #ef476f, #d63d5e) !important; }
.small-box.bg-yellow{ background: linear-gradient(135deg, #fca311, #e8940e) !important; }
.small-box.bg-green { background: linear-gradient(135deg, #06d6a0, #05b589) !important; }
.small-box.bg-purple{ background: linear-gradient(135deg, #7b68ee, #6854d4) !important; }
.small-box.bg-teal  { background: linear-gradient(135deg, #4cc9f0, #38b3d6) !important; }
.small-box.bg-navy  { background: linear-gradient(135deg, #1b263b, #2d3a4a) !important;
                       border: 1px solid #3d4a5a !important; }

/* ===== DATA TABLES ===== */
.dataTables_wrapper { color: #8899aa !important; }
table.dataTable {
  color: #e0e6ed !important;
  background-color: #1b2838 !important;
  border-collapse: separate !important;
  border-spacing: 0 !important;
}
table.dataTable thead th {
  background-color: #0d1b2a !important;
  color: #00b4d8 !important;
  border-bottom: 2px solid #2d3a4a !important;
  font-weight: 600 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  padding: 10px 12px !important;
}
table.dataTable tbody tr { background-color: #1b2838 !important; }
table.dataTable tbody tr:hover { background-color: #243447 !important; }
table.dataTable tbody td {
  border-top: 1px solid #2d3a4a !important;
  padding: 8px 12px !important;
  font-size: 13px !important;
}
.dataTables_filter input {
  background-color: #0d1b2a !important;
  color: #e0e6ed !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 6px !important;
  padding: 5px 10px !important;
}
.dataTables_length select {
  background-color: #0d1b2a !important;
  color: #e0e6ed !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 6px !important;
}
.dataTables_info { color: #556677 !important; }
.dataTables_paginate .paginate_button { color: #8899aa !important; }
.dataTables_paginate .paginate_button.current {
  background: #00b4d8 !important;
  color: #ffffff !important;
  border-color: #00b4d8 !important;
  border-radius: 6px !important;
}

/* ===== SOURCE NOTES ===== */
.source-note {
  color: #445566 !important;
  font-size: 11px !important;
  padding: 12px 15px !important;
  font-style: italic !important;
  border-top: 1px solid #1e2d3d !important;
  margin-top: 8px !important;
}

/* ===== SCOPE LABELS ===== */
.scope-label {
  color: #667788 !important;
  font-size: 11px !important;
  padding: 4px 12px 10px !important;
  font-weight: 500 !important;
  letter-spacing: 0.3px !important;
}
.scope-lifetime { color: #fca311 !important; }
.scope-filtered { color: #06d6a0 !important; }

/* ===== TAB FILTER PANEL ===== */
.tab-filter-panel {
  background-color: #12233a !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 10px !important;
  padding: 12px 18px !important;
  margin-bottom: 15px !important;
}
.tab-filter-panel label {
  color: #8899aa !important;
  font-weight: 500 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}
.tab-filter-panel .form-control,
.tab-filter-panel .selectize-input {
  background-color: #1b263b !important;
  color: #e0e6ed !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 6px !important;
  font-size: 12px !important;
}
.tab-filter-panel .selectize-dropdown {
  background-color: #1b263b !important;
  color: #e0e6ed !important;
  border: 1px solid #2d3a4a !important;
}
.tab-filter-panel .selectize-dropdown-content .option:hover {
  background-color: #243447 !important;
}
.tab-filter-panel .selectize-input .item {
  color: #e0e6ed !important;
  background-color: #2d3a4a !important;
  border-radius: 4px !important;
  padding: 1px 6px !important;
}

/* ===== SIDEBAR FILTER CONTROLS ===== */
.sidebar .form-control {
  background-color: #1b263b !important;
  color: #e0e6ed !important;
  border: 1px solid #2d3a4a !important;
  border-radius: 6px !important;
  font-size: 12px !important;
}
.sidebar label {
  color: #8899aa !important;
  font-weight: 500 !important;
  font-size: 11px !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

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
::-webkit-scrollbar-thumb:hover { background: #3d4a5a; }

/* ===== BRAND HEADER IN SIDEBAR ===== */
.sidebar-brand {
  text-align: center;
  padding: 18px 15px 12px;
}
.sidebar-brand h4 {
  color: #00b4d8;
  font-weight: 700;
  font-size: 18px;
  margin: 0;
  letter-spacing: 2px;
}
.sidebar-brand p {
  color: #556677;
  font-size: 10px;
  margin: 4px 0 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.sidebar-divider {
  border-color: #1e2d3d;
  margin: 8px 18px;
}
.sidebar-version {
  position: absolute;
  bottom: 15px;
  width: 100%;
  text-align: center;
  color: #334455;
  font-size: 10px;
}

/* ===== ACTION BUTTON ===== */
.btn-stochos-reset {
  background-color: #2d3a4a !important;
  color: #8899aa !important;
  border: 1px solid #3d4a5a !important;
  border-radius: 6px !important;
  font-size: 11px !important;
  font-weight: 500 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
  margin-top: 25px !important;
  transition: all 0.2s ease !important;
}
.btn-stochos-reset:hover {
  background-color: #3d4a5a !important;
  color: #e0e6ed !important;
}
"


# ==========================================================================
# UI DEFINITION
# ==========================================================================

ui <- dashboardPage(
  skin = "black",

  # --- Header ---
  dashboardHeader(
    title = span(icon("chart-line"), " Stochos: NY Lottery"),
    titleWidth = 280
  ),

  # --- Sidebar ---
  dashboardSidebar(
    width = 280,
    div(class = "sidebar-brand",
      h4("STOCHOS"),
      p("Lottery Analytics Platform")
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
      menuItem("Executive Summary",      tabName = "exec_summary",   icon = icon("gauge-high")),
      menuItem("Retailer Intelligence",   tabName = "retailer_intel",  icon = icon("map-location-dot")),
      menuItem("Game Performance",       tabName = "game_perf",       icon = icon("dice")),
      menuItem("Geographic Analytics",   tabName = "geo_analytics",   icon = icon("earth-americas")),
      hr(class = "sidebar-divider"),
      menuItem("Winning Numbers",        tabName = "winning_numbers", icon = icon("hashtag")),
      menuItem("Scratch-Off Intel",      tabName = "scratch_off",     icon = icon("ticket")),
      menuItem("Education Funding",      tabName = "edu_funding",     icon = icon("graduation-cap"))
    ),

    div(class = "sidebar-version",
      p("Stochos Analytics v0.3.0"),
      p("Phase 1 + 2")
    )
  ),

  # --- Body ---
  dashboardBody(
    tags$head(tags$style(HTML(custom_css))),

    tabItems(

      # ================================================================
      # TAB 1: EXECUTIVE SUMMARY
      # ================================================================
      tabItem(tabName = "exec_summary",

        # Scope label: filtered by date
        scope_label_ui(
          "Filtered by Analysis Period (sidebar date range)",
          style = "filtered"
        ),

        # KPI row — 5 KPIs
        fluidRow(
          valueBoxOutput("kpi_gross",       width = 3),
          valueBoxOutput("kpi_payout",      width = 2),
          valueBoxOutput("kpi_commission",  width = 2),
          valueBoxOutput("kpi_net",         width = 3),
          valueBoxOutput("kpi_retailers",   width = 2)
        ),

        # Trend + Donut
        fluidRow(
          box(title = "Revenue & Net Contribution Trend", width = 8,
            withSpinner(plotlyOutput("exec_trend", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Sales Mix by Game Family", width = 4,
            withSpinner(plotlyOutput("exec_donut", height = "380px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Waterfall + Top Games
        fluidRow(
          box(title = "Economic Flow", width = 6,
            withSpinner(plotlyOutput("exec_waterfall", height = "340px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Top Game Families", width = 6,
            withSpinner(DTOutput("exec_top_table"), type = 6, color = "#00b4d8")
          )
        ),

        # Source note
        fluidRow(column(12, source_note_ui("exec_source")))
      ),

      # ================================================================
      # TAB 2: RETAILER INTELLIGENCE
      # ================================================================
      tabItem(tabName = "retailer_intel",

        # Scope label: lifetime
        scope_label_ui(
          "Lifetime Performance — metrics reflect all available data, not filtered by date range",
          style = "lifetime"
        ),

        # KPI row
        fluidRow(
          valueBoxOutput("ret_total",     width = 3),
          valueBoxOutput("ret_qd_pct",    width = 3),
          valueBoxOutput("ret_avg_daily", width = 3),
          valueBoxOutput("ret_top_city",  width = 3)
        ),

        # Map + Business Type
        fluidRow(
          box(title = "Retailer Network — New York State", width = 8,
            withSpinner(leafletOutput("retailer_map", height = "520px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = tags$span(
                "Sales by Business Type",
                tags$span(style = "float:right; font-size:10px; color:#fca311; font-weight:400; text-transform:none;",
                          icon("triangle-exclamation"), " Provisional — includes 'Unknown'")),
              width = 4,
            withSpinner(plotlyOutput("ret_bustype", height = "520px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Top retailers table
        fluidRow(
          box(title = "Top Retailers by Gross Revenue", width = 12,
            withSpinner(DTOutput("ret_top_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("ret_source")))
      ),

      # ================================================================
      # TAB 3: GAME PERFORMANCE
      # ================================================================
      tabItem(tabName = "game_perf",

        # Scope label: mixed
        scope_label_ui(
          "Trend chart filtered by Analysis Period. Summary tables show lifetime totals.",
          style = "filtered"
        ),

        # Per-tab filter panel
        fluidRow(
          column(12,
            div(class = "tab-filter-panel",
              fluidRow(
                column(4,
                  selectizeInput("game_cat_filter", "Filter by Category",
                    choices  = NULL,
                    multiple = TRUE,
                    options  = list(placeholder = "All categories")
                  )
                ),
                column(4,
                  selectizeInput("game_game_filter", "Filter by Game",
                    choices  = NULL,
                    multiple = TRUE,
                    options  = list(placeholder = "All games")
                  )
                ),
                column(2,
                  actionButton("game_reset_filters", "Reset Filters",
                               class = "btn-stochos-reset",
                               icon  = icon("rotate-left"))
                ),
                column(2,
                  div(style = "margin-top: 25px; color: #556677; font-size: 11px;",
                    textOutput("game_filter_status", inline = TRUE)
                  )
                )
              )
            )
          )
        ),

        # Category bar + summary table
        fluidRow(
          box(title = "Category Performance Comparison", width = 7,
            withSpinner(plotlyOutput("game_cat_bar", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Category Summary", width = 5,
            withSpinner(DTOutput("game_cat_table"), type = 6, color = "#00b4d8")
          )
        ),

        # Game family trend
        fluidRow(
          box(title = "Game Family Sales Trend (Weekly)", width = 12,
            withSpinner(plotlyOutput("game_trend", height = "400px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Penetration + Ranking
        fluidRow(
          box(title = "Retailer Penetration by Game", width = 6,
            withSpinner(plotlyOutput("game_penetration", height = "400px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Game Performance Ranking", width = 6,
            withSpinner(DTOutput("game_rank_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("game_source")))
      ),

      # ================================================================
      # TAB 4: GEOGRAPHIC ANALYTICS
      # ================================================================
      tabItem(tabName = "geo_analytics",

        # Scope label: lifetime
        scope_label_ui(
          "Lifetime Performance — metrics reflect all available data, not filtered by date range",
          style = "lifetime"
        ),

        # KPI row
        fluidRow(
          valueBoxOutput("geo_counties",    width = 4),
          valueBoxOutput("geo_top_county",  width = 4),
          valueBoxOutput("geo_top_city",    width = 4)
        ),

        # County + City tables
        fluidRow(
          box(title = "County Leaderboard", width = 6,
            withSpinner(DTOutput("geo_county_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "City Leaderboard", width = 6,
            withSpinner(DTOutput("geo_city_table"), type = 6, color = "#00b4d8")
          )
        ),

        # County bar chart + density
        fluidRow(
          box(title = "Top 20 Counties — Gross Revenue", width = 7,
            withSpinner(plotlyOutput("geo_county_bar", height = "450px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "City Sales Density Index", width = 5,
            withSpinner(DTOutput("geo_density_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("geo_source")))
      ),

      # ================================================================
      # TAB 5: WINNING NUMBERS CENTER
      # ================================================================
      tabItem(tabName = "winning_numbers",

        scope_label_ui(
          "Full history — all available draw results",
          style = "lifetime"
        ),

        # Game selector
        fluidRow(
          column(12,
            div(class = "tab-filter-panel",
              fluidRow(
                column(4,
                  selectInput("wn_game_select", "Select Game",
                    choices  = NULL,
                    selected = NULL
                  )
                ),
                column(8,
                  div(style = "margin-top: 25px; color: #667788; font-size: 12px;",
                    textOutput("wn_game_info", inline = TRUE)
                  )
                )
              )
            )
          )
        ),

        # Recent draws + frequency
        fluidRow(
          box(title = "Recent Draws", width = 7,
            withSpinner(DTOutput("wn_recent_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "Most Drawn Numbers — Top 20", width = 5,
            withSpinner(plotlyOutput("wn_freq_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Hot/Cold + Draw cadence
        fluidRow(
          box(title = "Hot Numbers (Most Frequent)", width = 3,
            withSpinner(DTOutput("wn_hot_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "Cold Numbers (Least Frequent)", width = 3,
            withSpinner(DTOutput("wn_cold_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "Draw Cadence — All Games", width = 6,
            withSpinner(DTOutput("wn_cadence_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("wn_source")))
      ),

      # ================================================================
      # TAB 6: SCRATCH-OFF INTELLIGENCE
      # ================================================================
      tabItem(tabName = "scratch_off",

        scope_label_ui(
          "Point-in-time snapshot — reflects latest available prize status report",
          style = "lifetime"
        ),

        # KPI row
        fluidRow(
          valueBoxOutput("scratch_total_games", width = 4),
          valueBoxOutput("scratch_total_unclaimed", width = 4),
          valueBoxOutput("scratch_top_prize", width = 4)
        ),

        # Game health table + prize breakdown
        fluidRow(
          box(title = "Game Prize Health", width = 7,
            withSpinner(DTOutput("scratch_game_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "Prize Tier Breakdown — Select a Game", width = 5,
            selectInput("scratch_game_select", "Game",
              choices = NULL, selected = NULL
            ),
            withSpinner(plotlyOutput("scratch_prize_bar", height = "350px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Opportunity ranking
        fluidRow(
          box(title = "Best Remaining Value — Opportunity Ranking", width = 12,
            withSpinner(plotlyOutput("scratch_opportunity_bar", height = "400px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("scratch_source")))
      ),

      # ================================================================
      # TAB 7: EDUCATION FUNDING
      # ================================================================
      tabItem(tabName = "edu_funding",

        scope_label_ui(
          "Historical — Lottery Aid to Education since 2002",
          style = "lifetime"
        ),

        # KPI row
        fluidRow(
          valueBoxOutput("edu_latest_total", width = 4),
          valueBoxOutput("edu_district_count", width = 4),
          valueBoxOutput("edu_avg_per_district", width = 4)
        ),

        # Trend + county bar
        fluidRow(
          box(title = "Statewide Aid to Education — Annual Trend", width = 7,
            withSpinner(plotlyOutput("edu_trend", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Top 20 Counties — Cumulative Aid", width = 5,
            withSpinner(plotlyOutput("edu_county_bar", height = "380px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # County leaderboard + district search
        fluidRow(
          box(title = "County Leaderboard (Latest Year)", width = 5,
            withSpinner(DTOutput("edu_county_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "School District Search", width = 7,
            withSpinner(DTOutput("edu_district_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("edu_source")))
      )

    ) # end tabItems
  ) # end dashboardBody
) # end dashboardPage


# ==========================================================================
# SERVER LOGIC
# ==========================================================================

server <- function(input, output, session) {

  # --- DuckDB Connection ---
  con <- DBI::dbConnect(
    duckdb::duckdb(),
    dbdir     = DUCKDB_FILE,
    read_only = TRUE
  )

  onSessionEnded(function() {
    try(DBI::dbDisconnect(con, shutdown = TRUE), silent = TRUE)
  })


  # ======================================================================
  # DATA REACTIVES — load mart tables once per session
  # ======================================================================

  exec_ts <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_exec_timeseries_daily ORDER BY date")
  })

  exec_kpis_all <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_exec_kpis")
  })

  exec_waterfall_all <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_exec_waterfall ORDER BY step_order")
  })

  game_mix_all <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_exec_game_mix")
  })

  game_ts_all <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_game_timeseries ORDER BY date, category")
  })

  retailer_map_data <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_retailer_map ORDER BY gross_revenue DESC")
  })

  retailer_perf <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_retailer_performance")
  })

  retailer_bustype <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_retailer_business_type ORDER BY gross_revenue DESC")
  })

  cat_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_category_summary ORDER BY gross_revenue DESC")
  })

  game_perf_data <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_game_performance ORDER BY gross_revenue DESC")
  })

  game_penetration_data <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_game_penetration ORDER BY penetration_rate DESC")
  })

  county_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_county_summary ORDER BY gross_revenue DESC")
  })

  city_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_city_summary ORDER BY gross_revenue DESC")
  })

  geo_density <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_geo_density ORDER BY gross_revenue DESC")
  })


  # ======================================================================
  # FILTERED REACTIVES — apply global date range
  # ======================================================================

  filtered_ts <- reactive({
    df <- exec_ts()
    if (nrow(df) == 0) return(df)
    df %>% filter(
      date >= as.Date(input$date_range[1]),
      date <= as.Date(input$date_range[2])
    )
  })

  filtered_game_ts <- reactive({
    df <- game_ts_all()
    if (nrow(df) == 0) return(df)
    df %>% filter(
      date >= as.Date(input$date_range[1]),
      date <= as.Date(input$date_range[2])
    )
  })


  # ======================================================================
  # TAB 3: GAME FILTERS — category + game cascading
  # ======================================================================

  # Populate filter choices from mart data
  observe({
    cats <- sort(unique(cat_summary()$category))
    updateSelectizeInput(session, "game_cat_filter", choices = cats, selected = NULL, server = TRUE)
  })

  # Cascade: when category is selected, update game choices
  observe({
    df <- game_perf_data()
    if (nrow(df) == 0) return()
    sel_cats <- input$game_cat_filter
    if (!is.null(sel_cats) && length(sel_cats) > 0) {
      df <- df %>% filter(category %in% sel_cats)
    }
    games <- sort(unique(df$game_name))
    updateSelectizeInput(session, "game_game_filter", choices = games, selected = input$game_game_filter, server = TRUE)
  })

  # Reset button
  observeEvent(input$game_reset_filters, {
    updateSelectizeInput(session, "game_cat_filter", selected = character(0))
    updateSelectizeInput(session, "game_game_filter", selected = character(0))
  })

  # Filtered cat summary
  filtered_cat_summary <- reactive({
    df <- cat_summary()
    sel_cats <- input$game_cat_filter
    if (!is.null(sel_cats) && length(sel_cats) > 0) {
      df <- df %>% filter(category %in% sel_cats)
    }
    df
  })

  # Filtered game perf
  filtered_game_perf <- reactive({
    df <- game_perf_data()
    sel_cats  <- input$game_cat_filter
    sel_games <- input$game_game_filter
    if (!is.null(sel_cats) && length(sel_cats) > 0) {
      df <- df %>% filter(category %in% sel_cats)
    }
    if (!is.null(sel_games) && length(sel_games) > 0) {
      df <- df %>% filter(game_name %in% sel_games)
    }
    df
  })

  # Filtered penetration
  filtered_penetration <- reactive({
    df <- game_penetration_data()
    sel_cats  <- input$game_cat_filter
    sel_games <- input$game_game_filter
    if (!is.null(sel_cats) && length(sel_cats) > 0) {
      df <- df %>% filter(category %in% sel_cats)
    }
    if (!is.null(sel_games) && length(sel_games) > 0) {
      df <- df %>% filter(game_name %in% sel_games)
    }
    df
  })

  # Filtered game time series (date + category)
  filtered_game_ts_tab3 <- reactive({
    df <- filtered_game_ts()
    sel_cats <- input$game_cat_filter
    if (!is.null(sel_cats) && length(sel_cats) > 0) {
      df <- df %>% filter(category %in% sel_cats)
    }
    df
  })

  # Filter status text
  output$game_filter_status <- renderText({
    n_cats  <- length(input$game_cat_filter)
    n_games <- length(input$game_game_filter)
    if (n_cats == 0 && n_games == 0) {
      "Showing all"
    } else {
      parts <- c()
      if (n_cats > 0) parts <- c(parts, paste0(n_cats, " categor", ifelse(n_cats == 1, "y", "ies")))
      if (n_games > 0) parts <- c(parts, paste0(n_games, " game", ifelse(n_games == 1, "", "s")))
      paste0("Filtered: ", paste(parts, collapse = ", "))
    }
  })


  # ======================================================================
  # SHARED: Data-as-of date
  # ======================================================================

  data_max_date <- reactive({
    df <- exec_ts()
    if (nrow(df) == 0) return(Sys.Date())
    max(df$date, na.rm = TRUE)
  })


  # ======================================================================
  # TAB 1: EXECUTIVE SUMMARY
  # ======================================================================

  # --- KPIs (5 required) ---
  output$kpi_gross <- renderValueBox({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data for selected period"))
    val <- sum(df$gross_revenue, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Gross Revenue",
             icon = icon("dollar-sign"), color = "aqua")
  })

  output$kpi_payout <- renderValueBox({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data"))
    val <- sum(df$estimated_payout, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Estimated Payouts",
             icon = icon("hand-holding-dollar"), color = "red")
  })

  output$kpi_commission <- renderValueBox({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data"))
    val <- sum(df$retailer_commission, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Retailer Commission",
             icon = icon("handshake"), color = "yellow")
  })

  output$kpi_net <- renderValueBox({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data"))
    val <- sum(df$net_contribution, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Net Contribution",
             icon = icon("chart-line"), color = "green")
  })

  output$kpi_retailers <- renderValueBox({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data"))
    # Period distinct: COUNT(DISTINCT retailer_id) equivalent from daily grain
    # Using max of daily active_retailers as a conservative upper bound.
    # Cross-tab note: this is daily peak during selected period.
    val <- max(df$active_retailers, na.rm = TRUE)
    valueBox(format(val, big.mark = ","), "Active Retailers (Daily Peak)",
             icon = icon("store"), color = "purple")
  })

  # --- Revenue Trend ---
  output$exec_trend <- renderPlotly({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data available for the selected period."))

    # Aggregate to weekly for cleaner trend
    df <- df %>%
      mutate(week = as.Date(cut(date, "week"))) %>%
      group_by(week) %>%
      summarise(
        gross_revenue    = sum(gross_revenue, na.rm = TRUE),
        net_contribution = sum(net_contribution, na.rm = TRUE),
        .groups = "drop"
      )

    if (nrow(df) == 0) return(stochos_empty_plot())

    plot_ly(df, x = ~week) %>%
      add_trace(y = ~gross_revenue, name = "Gross Revenue",
                type = "scatter", mode = "lines",
                line = list(color = "#00b4d8", width = 2.5),
                fill = "tozeroy", fillcolor = "rgba(0,180,216,0.08)") %>%
      add_trace(y = ~net_contribution, name = "Net Contribution",
                type = "scatter", mode = "lines",
                line = list(color = "#06d6a0", width = 2.5),
                fill = "tozeroy", fillcolor = "rgba(6,214,160,0.08)") %>%
      stochos_layout() %>%
      layout(
        xaxis  = list(title = ""),
        yaxis  = list(title = "", tickformat = "$,.0s"),
        legend = list(orientation = "h", y = 1.08, x = 0),
        hovermode = "x unified"
      )
  })

  # --- Game Mix Donut ---
  output$exec_donut <- renderPlotly({
    df <- filtered_game_ts()
    validate(need(nrow(df) > 0, "No data available for the selected period."))

    cat_df <- df %>%
      group_by(category) %>%
      summarise(revenue = sum(gross_revenue, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(revenue)) %>%
      head(10)

    if (nrow(cat_df) == 0) return(stochos_empty_plot())

    plot_ly(cat_df, labels = ~category, values = ~revenue,
            type = "pie", hole = 0.6,
            textinfo = "label+percent", textposition = "outside",
            marker = list(colors = STOCHOS_COLORS,
                          line = list(color = "#0a1628", width = 2)),
            hoverinfo = "label+value+percent",
            textfont = list(color = "#8899aa", size = 11)) %>%
      stochos_layout() %>%
      layout(showlegend = FALSE,
             margin = list(t = 10, b = 10, l = 10, r = 10))
  })

  # --- Waterfall ---
  output$exec_waterfall <- renderPlotly({
    df <- filtered_ts()
    validate(need(nrow(df) > 0, "No data available for the selected period."))

    # Derive waterfall values from filtered time series (date-responsive)
    gross      <- sum(df$gross_revenue, na.rm = TRUE)
    payout     <- sum(df$estimated_payout, na.rm = TRUE)
    commission <- sum(df$retailer_commission, na.rm = TRUE)
    net        <- sum(df$net_contribution, na.rm = TRUE)

    plot_ly(
      type    = "waterfall",
      x       = c("Gross Revenue", "Est. Payouts", "Retailer Commission", "Net Contribution"),
      y       = c(gross, -payout, -commission, net),
      measure = c("absolute", "relative", "relative", "total"),
      connector  = list(line = list(color = "#2d3a4a", width = 1)),
      decreasing = list(marker = list(color = "#ef476f")),
      increasing = list(marker = list(color = "#06d6a0")),
      totals     = list(marker = list(color = "#00b4d8")),
      textposition = "outside",
      texttemplate = "%{y:$,.3s}",
      textfont     = list(color = "#8899aa", size = 11)
    ) %>%
      stochos_layout() %>%
      layout(
        xaxis = list(title = "", tickfont = list(size = 11)),
        yaxis = list(title = "", tickformat = "$,.0s", showgrid = FALSE),
        margin = list(t = 20, b = 60)
      )
  })

  # --- Top Games Table ---
  output$exec_top_table <- renderDT({
    df <- filtered_game_ts()
    validate(need(nrow(df) > 0, "No data available for the selected period."))

    tbl <- df %>%
      group_by(Category = category) %>%
      summarise(
        `Gross Revenue`    = sum(gross_revenue, na.rm = TRUE),
        `Net Contribution` = sum(net_contribution, na.rm = TRUE),
        .groups = "drop"
      ) %>%
      mutate(`% of Sales` = `Gross Revenue` / sum(`Gross Revenue`)) %>%
      arrange(desc(`Gross Revenue`))

    datatable(tbl,
      options  = list(pageLength = 10, dom = "tip", scrollX = TRUE,
                      columnDefs = list(list(className = "dt-right", targets = 1:3))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution"), digits = 0) %>%
      formatPercentage("% of Sales", digits = 1)
  })

  # --- Source note ---
  output$exec_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_ny_exec_timeseries_daily, mart_ny_exec_kpis, mart_ny_exec_waterfall",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 2: RETAILER INTELLIGENCE
  # ======================================================================

  # --- KPIs ---
  output$ret_total <- renderValueBox({
    df <- retailer_perf()
    validate(need(nrow(df) > 0, "No retailer data loaded"))
    valueBox(format(nrow(df), big.mark = ","), "Active Retailers",
             icon = icon("store"), color = "aqua")
  })

  output$ret_qd_pct <- renderValueBox({
    df <- retailer_perf()
    validate(need(nrow(df) > 0, "No retailer data loaded"))
    qd <- sum(df$quick_draw == "Y", na.rm = TRUE) / nrow(df) * 100
    valueBox(paste0(round(qd, 1), "%"), "Quick Draw Penetration",
             icon = icon("bolt"), color = "teal")
  })

  output$ret_avg_daily <- renderValueBox({
    df <- retailer_perf()
    validate(need(nrow(df) > 0, "No retailer data loaded"))
    avg_val <- mean(df$avg_daily_sales, na.rm = TRUE)
    valueBox(paste0("$", format(round(avg_val), big.mark = ",")),
             "Avg Daily Sales / Retailer",
             icon = icon("receipt"), color = "green")
  })

  output$ret_top_city <- renderValueBox({
    df <- retailer_perf()
    validate(need(nrow(df) > 0, "No retailer data loaded"))
    top <- df %>%
      group_by(city) %>%
      summarise(rev = sum(gross_revenue, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(rev)) %>%
      head(1)
    valueBox(top$city, "Top Revenue City",
             icon = icon("city"), color = "navy")
  })

  # --- Retailer Map (from mart_ny_retailer_map) ---
  output$retailer_map <- renderLeaflet({
    df <- retailer_map_data()
    validate(need(nrow(df) > 0, "No map data available. Ensure mart_ny_retailer_map table exists."))

    df <- df %>%
      mutate(
        point_radius = pmax(1.5, pmin(7, log10(pmax(gross_revenue, 1)) * 0.9)),
        popup_html = paste0(
          "<div style='font-family:Inter,sans-serif; min-width: 220px;'>",
          "<b style='color:#00b4d8; font-size:14px;'>",
          htmlEscape(retailer_name), "</b><br/>",
          "<span style='color:#8899aa;'>",
          htmlEscape(city), ", NY ", htmlEscape(zip), "</span>",
          "<hr style='border-color:#2d3a4a; margin:8px 0;'/>",
          "<table style='width:100%; font-size:12px; color:#ccc;'>",
          "<tr><td><b>Gross Revenue</b></td><td style='text-align:right;'>",
          dollar(gross_revenue), "</td></tr>",
          "<tr><td><b>Net Contribution</b></td><td style='text-align:right;'>",
          dollar(net_contribution), "</td></tr>",
          "<tr><td><b>Avg Daily Sales</b></td><td style='text-align:right;'>",
          dollar(avg_daily_sales), "</td></tr>",
          "<tr><td><b>Days Active</b></td><td style='text-align:right;'>",
          comma(days_active), "</td></tr>",
          "<tr><td><b>Games Sold</b></td><td style='text-align:right;'>",
          distinct_games, "</td></tr>",
          "<tr><td><b>Quick Draw</b></td><td style='text-align:right;'>",
          quick_draw, "</td></tr>",
          "<tr><td><b>Type</b></td><td style='text-align:right;'>",
          htmlEscape(business_type), "</td></tr>",
          "</table></div>"
        )
      )

    pal <- colorNumeric("viridis", domain = df$gross_revenue, na.color = "#555")

    leaflet(df, options = leafletOptions(zoomControl = TRUE)) %>%
      addProviderTiles(providers$CartoDB.DarkMatter) %>%
      fitBounds(lng1 = -79.90, lat1 = 40.45,
                lng2 = -71.80, lat2 = 45.10) %>%
      addCircleMarkers(
        lng         = ~longitude,
        lat         = ~latitude,
        radius      = ~point_radius,
        fillColor   = ~pal(gross_revenue),
        fillOpacity = 0.65,
        stroke      = FALSE,
        popup       = ~popup_html,
        clusterOptions = markerClusterOptions(
          spiderfyOnMaxZoom    = TRUE,
          showCoverageOnHover  = FALSE,
          zoomToBoundsOnClick  = TRUE
        )
      ) %>%
      addLegend(
        position  = "bottomright",
        pal       = pal,
        values    = ~gross_revenue,
        title     = "Gross Revenue",
        labFormat = labelFormat(prefix = "$", big.mark = ",")
      )
  })

  # --- Business Type Bar ---
  output$ret_bustype <- renderPlotly({
    df <- retailer_bustype() %>% head(12)
    validate(need(nrow(df) > 0, "No business type data available."))

    plot_ly(df,
      y    = ~reorder(business_type, gross_revenue),
      x    = ~gross_revenue,
      type = "bar", orientation = "h",
      marker = list(
        color = ~gross_revenue,
        colorscale = list(c(0, "#1b263b"), c(1, "#00b4d8")),
        line  = list(color = "#0096c7", width = 0.5)
      ),
      text         = ~paste0(dollar(gross_revenue)),
      textposition = "auto",
      textfont     = list(color = "#e0e6ed", size = 11),
      hoverinfo    = "text",
      hovertext    = ~paste0(business_type, "<br>Revenue: ", dollar(gross_revenue),
                             "<br>Retailers: ", comma(retailer_count))
    ) %>%
      stochos_layout() %>%
      layout(
        yaxis  = list(title = "", tickfont = list(size = 11)),
        xaxis  = list(title = "", tickformat = "$,.0s"),
        margin = list(l = 150)
      )
  })

  # --- Top Retailers Table ---
  output$ret_top_table <- renderDT({
    df <- retailer_perf()
    validate(need(nrow(df) > 0, "No retailer data available."))

    tbl <- df %>%
      head(100) %>%
      select(
        ID = retailer_id,
        Name = retailer_name,
        City = city,
        County = county,
        Type = business_type,
        `Gross Revenue` = gross_revenue,
        `Net Contribution` = net_contribution,
        `Avg Daily` = avg_daily_sales,
        `Days Active` = days_active,
        Games = distinct_games
      )

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "frtip",
                      columnDefs = list(list(className = "dt-right", targets = 5:9))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution", "Avg Daily"), digits = 0) %>%
      formatRound("Days Active", digits = 0)
  })

  output$ret_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_ny_retailer_performance, mart_ny_retailer_map, mart_ny_retailer_business_type",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 3: GAME PERFORMANCE
  # ======================================================================

  # --- Category Bar Chart (filtered) ---
  output$game_cat_bar <- renderPlotly({
    df <- filtered_cat_summary()
    validate(need(nrow(df) > 0, "No categories match the current filter."))

    plot_ly(df,
      x    = ~reorder(category, gross_revenue),
      y    = ~gross_revenue,
      type = "bar",
      marker = list(
        color = STOCHOS_COLORS[seq_len(min(nrow(df), length(STOCHOS_COLORS)))],
        line  = list(color = "#0a1628", width = 1)
      ),
      text         = ~paste0(dollar(gross_revenue)),
      textposition = "outside",
      textfont     = list(color = "#8899aa", size = 11),
      hoverinfo    = "text",
      hovertext    = ~paste0(category,
                             "<br>Revenue: ", dollar(gross_revenue),
                             "<br>Net: ", dollar(net_contribution),
                             "<br>Games: ", distinct_games,
                             "<br>Retailers: ", comma(distinct_retailers))
    ) %>%
      stochos_layout() %>%
      layout(
        xaxis  = list(title = "", tickangle = -30, tickfont = list(size = 11)),
        yaxis  = list(title = "", tickformat = "$,.0s"),
        margin = list(b = 80)
      )
  })

  # --- Category Summary Table (filtered) ---
  output$game_cat_table <- renderDT({
    df <- filtered_cat_summary()
    validate(need(nrow(df) > 0, "No categories match the current filter."))

    # Recalculate pct_of_total_sales within the filtered set
    tbl <- df %>%
      mutate(pct_recalc = gross_revenue / sum(gross_revenue, na.rm = TRUE)) %>%
      select(
        Category = category,
        `Gross Revenue` = gross_revenue,
        `Net Contribution` = net_contribution,
        Games = distinct_games,
        Retailers = distinct_retailers,
        `% of Sales` = pct_recalc
      )

    datatable(tbl,
      options  = list(pageLength = 15, dom = "tip", scrollX = TRUE,
                      columnDefs = list(list(className = "dt-right", targets = 1:5))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution"), digits = 0) %>%
      formatPercentage("% of Sales", digits = 1) %>%
      formatRound(c("Games", "Retailers"), digits = 0)
  })

  # --- Game Family Weekly Trend (filtered by date + category) ---
  output$game_trend <- renderPlotly({
    df <- filtered_game_ts_tab3()
    validate(need(nrow(df) > 0, "No data available for the selected filters and period."))

    # Aggregate to weekly
    df <- df %>%
      mutate(week = as.Date(cut(date, "week"))) %>%
      group_by(week, category) %>%
      summarise(gross_revenue = sum(gross_revenue, na.rm = TRUE), .groups = "drop")

    # Top 8 categories by total revenue (within filtered set)
    top_cats <- df %>%
      group_by(category) %>%
      summarise(total = sum(gross_revenue, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(total)) %>%
      head(8) %>%
      pull(category)

    df <- df %>% filter(category %in% top_cats)

    if (nrow(df) == 0) return(stochos_empty_plot())

    plot_ly(df, x = ~week, y = ~gross_revenue,
            color = ~category, colors = STOCHOS_COLORS,
            type = "scatter", mode = "lines",
            line = list(width = 1.8)) %>%
      stochos_layout() %>%
      layout(
        xaxis     = list(title = ""),
        yaxis     = list(title = "", tickformat = "$,.0s"),
        legend    = list(orientation = "h", y = -0.15, x = 0, font = list(size = 10)),
        hovermode = "x unified"
      )
  })

  # --- Penetration Chart (filtered) ---
  output$game_penetration <- renderPlotly({
    df <- filtered_penetration() %>% head(20)
    validate(need(nrow(df) > 0, "No games match the current filter."))

    plot_ly(df,
      y    = ~reorder(game_name, penetration_rate),
      x    = ~penetration_rate,
      type = "bar", orientation = "h",
      marker = list(
        color = ~penetration_rate,
        colorscale = list(c(0, "#1b263b"), c(0.5, "#00b4d8"), c(1, "#06d6a0")),
        line = list(color = "#0a1628", width = 0.5)
      ),
      text         = ~paste0(round(penetration_rate * 100, 1), "%"),
      textposition = "auto",
      textfont     = list(color = "#e0e6ed", size = 10),
      hoverinfo    = "text",
      hovertext    = ~paste0(game_name,
                             "<br>Penetration: ", round(penetration_rate * 100, 1), "%",
                             "<br>Retailers: ", comma(retailers_carrying_game),
                             "<br>Avg Sales/Retailer: ", dollar(avg_sales_per_carrying_retailer))
    ) %>%
      stochos_layout() %>%
      layout(
        yaxis  = list(title = "", tickfont = list(size = 10)),
        xaxis  = list(title = "Penetration Rate", tickformat = ".0%"),
        margin = list(l = 160)
      )
  })

  # --- Game Ranking Table (filtered) ---
  output$game_rank_table <- renderDT({
    df <- filtered_game_perf()
    validate(need(nrow(df) > 0, "No games match the current filter."))

    tbl <- df %>%
      select(
        Game = game_name,
        Category = category,
        `Gross Revenue` = gross_revenue,
        `Net Contribution` = net_contribution,
        Retailers = distinct_retailers,
        `Avg/Retailer` = avg_sales_per_retailer,
        `% of Total` = pct_of_total_sales
      )

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "frtip",
                      order = list(list(2, "desc")),
                      columnDefs = list(list(className = "dt-right", targets = 2:6))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution", "Avg/Retailer"), digits = 0) %>%
      formatPercentage("% of Total", digits = 1) %>%
      formatRound("Retailers", digits = 0)
  })

  output$game_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_ny_game_performance, mart_ny_game_timeseries, mart_ny_category_summary, mart_ny_game_penetration",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 4: GEOGRAPHIC ANALYTICS
  # ======================================================================

  # --- KPIs ---
  output$geo_counties <- renderValueBox({
    df <- county_summary() %>% filter(county != "Unknown")
    validate(need(nrow(df) > 0, "No county data loaded"))
    valueBox(nrow(df), "Active Counties",
             icon = icon("map"), color = "aqua")
  })

  output$geo_top_county <- renderValueBox({
    df <- county_summary() %>% filter(county != "Unknown") %>% head(1)
    validate(need(nrow(df) > 0, "No county data loaded"))
    valueBox(df$county,
             paste0("Top County — ", fmt_dollar(df$gross_revenue)),
             icon = icon("trophy"), color = "green")
  })

  output$geo_top_city <- renderValueBox({
    df <- city_summary() %>% filter(city != "Unknown") %>% head(1)
    validate(need(nrow(df) > 0, "No city data loaded"))
    valueBox(df$city,
             paste0("Top City — ", fmt_dollar(df$gross_revenue)),
             icon = icon("building"), color = "yellow")
  })

  # --- County Table ---
  output$geo_county_table <- renderDT({
    df <- county_summary() %>% filter(county != "Unknown")
    validate(need(nrow(df) > 0, "No county data available."))

    tbl <- df %>%
      select(
        Rank = rank_sales,
        County = county,
        `Gross Revenue` = gross_revenue,
        `Net Contribution` = net_contribution,
        Retailers = retailer_count,
        `Avg/Retailer` = avg_sales_per_retailer
      )

    datatable(tbl,
      options  = list(pageLength = 20, scrollX = TRUE, dom = "frtip",
                      columnDefs = list(list(className = "dt-right", targets = 2:5))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution", "Avg/Retailer"), digits = 0) %>%
      formatRound("Retailers", digits = 0)
  })

  # --- City Table ---
  output$geo_city_table <- renderDT({
    df <- city_summary() %>% filter(city != "Unknown") %>% head(50)
    validate(need(nrow(df) > 0, "No city data available."))

    tbl <- df %>%
      mutate(rank = row_number()) %>%
      select(
        Rank = rank,
        City = city,
        County = county,
        `Gross Revenue` = gross_revenue,
        `Net Contribution` = net_contribution,
        Retailers = retailer_count,
        `Avg/Retailer` = avg_sales_per_retailer
      )

    datatable(tbl,
      options  = list(pageLength = 20, scrollX = TRUE, dom = "frtip",
                      columnDefs = list(list(className = "dt-right", targets = 3:6))),
      rownames = FALSE
    ) %>%
      formatCurrency(c("Gross Revenue", "Net Contribution", "Avg/Retailer"), digits = 0) %>%
      formatRound("Retailers", digits = 0)
  })

  # --- County Bar Chart ---
  output$geo_county_bar <- renderPlotly({
    df <- county_summary() %>%
      filter(county != "Unknown") %>%
      head(20)
    validate(need(nrow(df) > 0, "No county data available."))

    plot_ly(df,
      y    = ~reorder(county, gross_revenue),
      x    = ~gross_revenue,
      type = "bar", orientation = "h",
      marker = list(
        color = ~gross_revenue,
        colorscale = list(c(0, "#1b263b"), c(0.5, "#00b4d8"), c(1, "#06d6a0")),
        line = list(color = "#0a1628", width = 0.5)
      ),
      text         = ~paste0(dollar(gross_revenue)),
      textposition = "auto",
      textfont    = list(color = "#e0e6ed", size = 11),
      hoverinfo   = "text",
      hovertext   = ~paste0(county,
                            "<br>Revenue: ", dollar(gross_revenue),
                            "<br>Net: ", dollar(net_contribution),
                            "<br>Retailers: ", comma(retailer_count),
                            "<br>Avg/Retailer: ", dollar(avg_sales_per_retailer))
    ) %>%
      stochos_layout() %>%
      layout(
        yaxis  = list(title = "", tickfont = list(size = 11)),
        xaxis  = list(title = "Gross Revenue", tickformat = "$,.0s"),
        margin = list(l = 140)
      )
  })

  # --- Density Table (from mart_ny_geo_density) ---
  output$geo_density_table <- renderDT({
    df <- geo_density()
    validate(need(nrow(df) > 0, "No density data available. Ensure mart_ny_geo_density exists."))

    tbl <- df %>%
      head(30) %>%
      mutate(rank = row_number()) %>%
      select(
        Rank = rank,
        City = city,
        County = county,
        `Revenue` = gross_revenue,
        Retailers = retailer_count,
        `Density Index` = sales_density_index,
        `County Share` = county_share
      )

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "tip",
                      columnDefs = list(list(className = "dt-right", targets = 3:6))),
      rownames = FALSE,
      caption  = htmltools::tags$caption(
        style = "color:#667788; font-size:10px; caption-side:bottom;",
        "Density Index = city avg sales/retailer ÷ state avg sales/retailer. Source: mart_ny_geo_density"
      )
    ) %>%
      formatCurrency("Revenue", digits = 0) %>%
      formatRound(c("Retailers", "Density Index"), digits = 1) %>%
      formatPercentage("County Share", digits = 1)
  })

  output$geo_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_ny_county_summary, mart_ny_city_summary, mart_ny_geo_density",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # PHASE 2 DATA REACTIVES
  # ======================================================================

  # --- Education ---
  edu_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_edu_summary ORDER BY fiscal_year_start")
  })

  edu_county_trend <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_edu_county_trend ORDER BY fiscal_year_start, total_aid DESC")
  })

  edu_district_detail <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_edu_district_detail ORDER BY fiscal_year_start DESC, county, school_district")
  })

  # --- Scratch-Off ---
  scratch_game_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_scratch_game_summary ORDER BY total_prizes DESC")
  })

  scratch_prize_detail <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_scratch_prize_detail ORDER BY game_number, prize_amount DESC")
  })

  scratch_opportunity <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_scratch_opportunity ORDER BY opportunity_score DESC")
  })

  # --- Winning Numbers ---
  wn_recent_draws <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_recent_draws ORDER BY game_name, draw_date DESC")
  })

  wn_draw_summary <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_draw_summary ORDER BY total_draws DESC")
  })

  wn_frequency <- reactive({
    safe_query(con, "SELECT * FROM mart_ny_number_frequency ORDER BY game_name, frequency DESC")
  })


  # ======================================================================
  # TAB 5: WINNING NUMBERS CENTER
  # ======================================================================

  # Populate game selector
  observe({
    df <- wn_draw_summary()
    if (nrow(df) > 0) {
      games <- df$game_name
      # Default to Mega Millions if available
      default <- if ("Mega Millions" %in% games) "Mega Millions" else games[1]
      updateSelectInput(session, "wn_game_select",
        choices  = games,
        selected = default
      )
    }
  })

  # Game info text
  output$wn_game_info <- renderText({
    df <- wn_draw_summary()
    sel <- input$wn_game_select
    if (is.null(sel) || nrow(df) == 0) return("")
    row <- df %>% filter(game_name == sel)
    if (nrow(row) == 0) return("")
    paste0(format(row$total_draws, big.mark = ","), " total draws  |  ",
           "First: ", format(row$first_draw, "%b %d, %Y"), "  |  ",
           "Last: ", format(row$last_draw, "%b %d, %Y"), "  |  ",
           round(row$draws_per_week, 1), " draws/week")
  })

  # Recent draws table
  output$wn_recent_table <- renderDT({
    df <- wn_recent_draws()
    sel <- input$wn_game_select
    validate(need(nrow(df) > 0, "No draw data available."))
    validate(need(!is.null(sel), "Select a game."))

    tbl <- df %>%
      filter(game_name == sel) %>%
      select(
        Date = draw_date,
        `Winning Numbers` = winning_numbers,
        Bonus = bonus_number,
        Multiplier = multiplier,
        Session = draw_session
      )

    datatable(tbl,
      options  = list(pageLength = 20, dom = "tip", scrollX = TRUE),
      rownames = FALSE
    )
  })

  # Frequency bar chart
  output$wn_freq_bar <- renderPlotly({
    df <- wn_frequency()
    sel <- input$wn_game_select
    validate(need(nrow(df) > 0, "No frequency data available."))
    validate(need(!is.null(sel), "Select a game."))

    game_df <- df %>%
      filter(game_name == sel) %>%
      arrange(desc(frequency)) %>%
      head(20)

    if (nrow(game_df) == 0) return(stochos_empty_plot("No frequency data for this game."))

    plot_ly(game_df,
      x    = ~reorder(as.character(ball_number), frequency),
      y    = ~frequency,
      type = "bar",
      marker = list(
        color = ~frequency,
        colorscale = list(c(0, "#1b263b"), c(0.5, "#00b4d8"), c(1, "#06d6a0")),
        line = list(color = "#0a1628", width = 0.5)
      ),
      text         = ~paste0("#", ball_number, ": ", comma(frequency), " times"),
      textposition = "outside",
      textfont     = list(color = "#8899aa", size = 10),
      hoverinfo    = "text",
      hovertext    = ~paste0("Ball #", ball_number,
                             "<br>Drawn: ", comma(frequency), " times",
                             "<br>", round(pct_of_draws * 100, 1), "% of draws",
                             "<br>Last drawn: ", format(last_drawn, "%b %d, %Y"),
                             "<br>Days ago: ", days_since_last)
    ) %>%
      stochos_layout() %>%
      layout(
        xaxis  = list(title = "Ball Number", tickfont = list(size = 10)),
        yaxis  = list(title = "Times Drawn"),
        margin = list(b = 60)
      )
  })

  # Hot numbers
  output$wn_hot_table <- renderDT({
    df <- wn_frequency()
    sel <- input$wn_game_select
    validate(need(nrow(df) > 0 && !is.null(sel), "No data."))

    tbl <- df %>%
      filter(game_name == sel) %>%
      arrange(desc(frequency)) %>%
      head(10) %>%
      mutate(rank = row_number()) %>%
      select(Rank = rank, `#` = ball_number, Drawn = frequency,
             `Last` = last_drawn)

    datatable(tbl,
      options  = list(pageLength = 10, dom = "t", scrollX = TRUE),
      rownames = FALSE
    )
  })

  # Cold numbers
  output$wn_cold_table <- renderDT({
    df <- wn_frequency()
    sel <- input$wn_game_select
    validate(need(nrow(df) > 0 && !is.null(sel), "No data."))

    tbl <- df %>%
      filter(game_name == sel) %>%
      arrange(frequency) %>%
      head(10) %>%
      mutate(rank = row_number()) %>%
      select(Rank = rank, `#` = ball_number, Drawn = frequency,
             `Days Ago` = days_since_last)

    datatable(tbl,
      options  = list(pageLength = 10, dom = "t", scrollX = TRUE),
      rownames = FALSE
    )
  })

  # Draw cadence
  output$wn_cadence_table <- renderDT({
    df <- wn_draw_summary()
    validate(need(nrow(df) > 0, "No cadence data available."))

    tbl <- df %>%
      select(
        Game = game_name,
        `Total Draws` = total_draws,
        `First Draw` = first_draw,
        `Last Draw` = last_draw,
        `Draws/Week` = draws_per_week
      )

    datatable(tbl,
      options  = list(pageLength = 15, dom = "tip", scrollX = TRUE,
                      columnDefs = list(list(className = "dt-right", targets = 1:4))),
      rownames = FALSE
    ) %>%
      formatRound(c("Total Draws"), digits = 0) %>%
      formatRound("Draws/Week", digits = 1)
  })

  output$wn_source <- renderText({
    paste0("Source: mart_ny_recent_draws, mart_ny_number_frequency, mart_ny_draw_summary",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 6: SCRATCH-OFF INTELLIGENCE
  # ======================================================================

  # Populate game selector
  observe({
    df <- scratch_game_summary()
    if (nrow(df) > 0) {
      choices <- setNames(df$game_number, paste0(df$game_name, " (#", df$game_number, ")"))
      updateSelectInput(session, "scratch_game_select",
        choices  = choices,
        selected = choices[1]
      )
    }
  })

  # KPIs
  output$scratch_total_games <- renderValueBox({
    df <- scratch_game_summary()
    validate(need(nrow(df) > 0, "No scratch-off data loaded"))
    valueBox(nrow(df), "Active Games",
             icon = icon("ticket"), color = "aqua")
  })

  output$scratch_total_unclaimed <- renderValueBox({
    df <- scratch_game_summary()
    validate(need(nrow(df) > 0, "No scratch-off data loaded"))
    val <- sum(df$total_unpaid, na.rm = TRUE)
    valueBox(format(val, big.mark = ","), "Total Unclaimed Prizes",
             icon = icon("gift"), color = "green")
  })

  output$scratch_top_prize <- renderValueBox({
    df <- scratch_game_summary()
    validate(need(nrow(df) > 0, "No scratch-off data loaded"))
    val <- max(df$top_prize_remaining, na.rm = TRUE)
    valueBox(paste0("$", format(val, big.mark = ",")),
             "Highest Remaining Top Prize",
             icon = icon("crown"), color = "yellow")
  })

  # Game health table
  output$scratch_game_table <- renderDT({
    df <- scratch_game_summary()
    validate(need(nrow(df) > 0, "No scratch-off data available."))

    tbl <- df %>%
      select(
        `#` = game_number,
        Game = game_name,
        `Total Prizes` = total_prizes,
        Paid = total_paid,
        Unpaid = total_unpaid,
        `% Claimed` = pct_claimed,
        `Top Prize $` = top_prize_amount,
        `Top Remaining $` = top_prize_remaining
      )

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "frtip",
                      order = list(list(4, "desc")),
                      columnDefs = list(list(className = "dt-right", targets = 2:7))),
      rownames = FALSE
    ) %>%
      formatRound(c("Total Prizes", "Paid", "Unpaid"), digits = 0) %>%
      formatPercentage("% Claimed", digits = 1) %>%
      formatCurrency(c("Top Prize $", "Top Remaining $"), digits = 0)
  })

  # Prize tier bar (for selected game)
  output$scratch_prize_bar <- renderPlotly({
    df <- scratch_prize_detail()
    sel <- input$scratch_game_select
    validate(need(nrow(df) > 0, "No prize detail data."))
    validate(need(!is.null(sel), "Select a game."))

    game_df <- df %>%
      filter(game_number == as.numeric(sel)) %>%
      filter(!is.na(prize_amount)) %>%
      arrange(prize_amount)

    if (nrow(game_df) == 0) return(stochos_empty_plot("No prize data for this game."))

    plot_ly(game_df) %>%
      add_trace(
        y    = ~paste0("$", format(prize_amount, big.mark = ",")),
        x    = ~paid,
        name = "Paid",
        type = "bar", orientation = "h",
        marker = list(color = "#06d6a0")
      ) %>%
      add_trace(
        y    = ~paste0("$", format(prize_amount, big.mark = ",")),
        x    = ~unpaid,
        name = "Unpaid",
        type = "bar", orientation = "h",
        marker = list(color = "#ef476f")
      ) %>%
      stochos_layout() %>%
      layout(
        barmode = "stack",
        yaxis   = list(title = "", tickfont = list(size = 10),
                       categoryorder = "array",
                       categoryarray = ~paste0("$", format(prize_amount, big.mark = ","))),
        xaxis   = list(title = "Number of Prizes"),
        legend  = list(orientation = "h", y = -0.15, x = 0.3),
        margin  = list(l = 100)
      )
  })

  # Opportunity bar
  output$scratch_opportunity_bar <- renderPlotly({
    df <- scratch_opportunity() %>% head(25)
    validate(need(nrow(df) > 0, "No opportunity data available."))

    plot_ly(df,
      y    = ~reorder(paste0(game_name, " #", game_number), opportunity_score),
      x    = ~opportunity_score,
      type = "bar", orientation = "h",
      marker = list(
        color = ~opportunity_score,
        colorscale = list(c(0, "#1b263b"), c(0.5, "#fca311"), c(1, "#06d6a0")),
        line = list(color = "#0a1628", width = 0.5)
      ),
      text         = ~paste0(round(opportunity_score, 2)),
      textposition = "auto",
      textfont     = list(color = "#e0e6ed", size = 10),
      hoverinfo    = "text",
      hovertext    = ~paste0(game_name, " #", game_number,
                             "<br>Score: ", round(opportunity_score, 2),
                             "<br>Top Prize Remaining: $", format(top_prize_remaining, big.mark = ","),
                             "<br>Unclaimed: ", format(total_unpaid, big.mark = ","),
                             "<br>% Claimed: ", round(pct_claimed * 100, 1), "%")
    ) %>%
      stochos_layout() %>%
      layout(
        yaxis  = list(title = "", tickfont = list(size = 10)),
        xaxis  = list(title = "Opportunity Score"),
        margin = list(l = 200)
      )
  })

  output$scratch_source <- renderText({
    paste0("Source: mart_ny_scratch_game_summary, mart_ny_scratch_prize_detail, mart_ny_scratch_opportunity",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 7: EDUCATION FUNDING
  # ======================================================================

  # KPIs (use latest fiscal year)
  output$edu_latest_total <- renderValueBox({
    df <- edu_summary()
    validate(need(nrow(df) > 0, "No education data loaded"))
    latest <- df %>% arrange(desc(fiscal_year_start)) %>% head(1)
    valueBox(fmt_dollar(latest$total_aid),
             paste0("FY ", latest$fiscal_year_start, "-", latest$fiscal_year_end, " Total Aid"),
             icon = icon("graduation-cap"), color = "aqua")
  })

  output$edu_district_count <- renderValueBox({
    df <- edu_summary()
    validate(need(nrow(df) > 0, "No education data loaded"))
    latest <- df %>% arrange(desc(fiscal_year_start)) %>% head(1)
    valueBox(format(latest$district_count, big.mark = ","),
             "School Districts Funded",
             icon = icon("school"), color = "green")
  })

  output$edu_avg_per_district <- renderValueBox({
    df <- edu_summary()
    validate(need(nrow(df) > 0, "No education data loaded"))
    latest <- df %>% arrange(desc(fiscal_year_start)) %>% head(1)
    valueBox(fmt_dollar(latest$avg_aid_per_district),
             "Avg Aid per District",
             icon = icon("calculator"), color = "yellow")
  })

  # Statewide trend
  output$edu_trend <- renderPlotly({
    df <- edu_summary()
    validate(need(nrow(df) > 0, "No education data available."))

    plot_ly(df, x = ~fiscal_year_start) %>%
      add_trace(y = ~total_aid, name = "Total Aid",
                type = "scatter", mode = "lines+markers",
                line = list(color = "#00b4d8", width = 2.5),
                marker = list(color = "#00b4d8", size = 6),
                fill = "tozeroy", fillcolor = "rgba(0,180,216,0.08)") %>%
      stochos_layout() %>%
      layout(
        xaxis = list(title = "Fiscal Year Start", dtick = 2),
        yaxis = list(title = "", tickformat = "$,.0s"),
        hovermode = "x unified"
      )
  })

  # County bar — cumulative across all years
  output$edu_county_bar <- renderPlotly({
    df <- edu_county_trend()
    validate(need(nrow(df) > 0, "No county education data available."))

    county_totals <- df %>%
      group_by(county) %>%
      summarise(total_aid = sum(total_aid, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(total_aid)) %>%
      head(20)

    plot_ly(county_totals,
      y    = ~reorder(county, total_aid),
      x    = ~total_aid,
      type = "bar", orientation = "h",
      marker = list(
        color = ~total_aid,
        colorscale = list(c(0, "#1b263b"), c(0.5, "#00b4d8"), c(1, "#06d6a0")),
        line = list(color = "#0a1628", width = 0.5)
      ),
      text         = ~paste0(dollar(total_aid)),
      textposition = "auto",
      textfont     = list(color = "#e0e6ed", size = 10),
      hoverinfo    = "text",
      hovertext    = ~paste0(county, "<br>Cumulative Aid: ", dollar(total_aid))
    ) %>%
      stochos_layout() %>%
      layout(
        yaxis  = list(title = "", tickfont = list(size = 10)),
        xaxis  = list(title = "Cumulative Aid", tickformat = "$,.0s"),
        margin = list(l = 130)
      )
  })

  # County table — latest year
  output$edu_county_table <- renderDT({
    df <- edu_county_trend()
    validate(need(nrow(df) > 0, "No county data available."))

    latest_year <- max(df$fiscal_year_start, na.rm = TRUE)
    tbl <- df %>%
      filter(fiscal_year_start == latest_year) %>%
      arrange(desc(total_aid)) %>%
      mutate(rank = row_number()) %>%
      select(
        Rank = rank,
        County = county,
        `Total Aid` = total_aid,
        Districts = district_count
      )

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "tip",
                      columnDefs = list(list(className = "dt-right", targets = 2:3))),
      rownames = FALSE
    ) %>%
      formatCurrency("Total Aid", digits = 0) %>%
      formatRound("Districts", digits = 0)
  })

  # District detail table — full search
  output$edu_district_table <- renderDT({
    df <- edu_district_detail()
    validate(need(nrow(df) > 0, "No district data available."))

    # Show latest year by default
    latest_year <- max(df$fiscal_year_start, na.rm = TRUE)
    tbl <- df %>%
      filter(fiscal_year_start == latest_year) %>%
      select(
        County = county,
        `School District` = school_district,
        `Amount of Aid` = amount_of_aid
      ) %>%
      arrange(desc(`Amount of Aid`))

    datatable(tbl,
      options  = list(pageLength = 15, scrollX = TRUE, dom = "frtip",
                      columnDefs = list(list(className = "dt-right", targets = 2))),
      rownames = FALSE,
      caption  = htmltools::tags$caption(
        style = "color:#667788; font-size:10px; caption-side:bottom;",
        paste0("Showing FY ", latest_year, "-", latest_year + 1, ". Use search to find specific districts.")
      )
    ) %>%
      formatCurrency("Amount of Aid", digits = 0)
  })

  output$edu_source <- renderText({
    paste0("Source: mart_ny_edu_summary, mart_ny_edu_county_trend, mart_ny_edu_district_detail",
           "  |  Stochos Analytics Platform")
  })

} # end server


# ==========================================================================
# LAUNCH
# ==========================================================================

shinyApp(ui, server)
