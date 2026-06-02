# ==========================================================================
# Stochos Analytics: New York Lottery
# Executive Dashboard v2
# ==========================================================================
#
# Audience: Executive, Sales, and Finance leadership
# Design: Decision-oriented. No player-facing content.
#
#
# Tabs:
#   1. Executive Overview
#   2. Retailer Mix & Profitability (CENTERPIECE)
#   3. Product & Portfolio Mix
#   4. Sales Network & Geography
#   5. Forecast & Outlook
#   6. Price Point Mix
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
library(sf)
library(shinycssloaders)
library(htmltools)
library(tidyr)


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

stochos_layout <- function(p, theme = "dark") {
  text_color <- if (!is.null(theme) && theme == "light") "#2b3a4a" else "#b0bec5"
  grid_color <- if (!is.null(theme) && theme == "light") "rgba(0,0,0,0.08)" else "rgba(255,255,255,0.05)"
  
  p %>% layout(
    paper_bgcolor = "rgba(0,0,0,0)",
    plot_bgcolor  = "rgba(0,0,0,0)",
    font          = list(color = text_color, family = "Inter, sans-serif"),
    xaxis         = list(gridcolor = grid_color,
                         zerolinecolor = grid_color),
    yaxis         = list(gridcolor = grid_color,
                         zerolinecolor = grid_color),
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

# Illustrative banner helper
illustrative_banner_ui <- function(title = NULL) {
  div(class = "illustrative-banner",
    span(class = "ill-badge", "ILLUSTRATIVE"),
    if (!is.null(title)) title else
      "Illustrative View \u2014 requires product-level source data not present in the current NY public dataset"
  )
}

illustrative_source_note <- function(id) {
  div(class = "illustrative-source",
    textOutput(id, inline = TRUE)
  )
}


# ==========================================================================
# CSS
# ==========================================================================

custom_css <- "
/* ===== THEMES ===== */
:root {
  --bg-color-darker: #0a1628;
  --bg-color: #0d1b2a;
  --card-bg: #1b2838;
  --card-gradient: linear-gradient(135deg, #1b2838 0%, #0d1b2a 100%);
  --border-color: #2d3a4a;
  --accent-color: #00b4d8;
  --accent-hover: rgba(0, 180, 216, 0.08);
  --text-color: #e0e6ed;
  --text-secondary: #8899aa;
  --text-muted: #667788;
  --header-border: #1b263b;
  --table-hover: rgba(0, 180, 216, 0.06);
  --scroll-track: #0a1628;
  --scroll-thumb: #2d3a4a;
  --brand-color: #00b4d8;
  --brand-subtitle: #556677;
}

:root.light-theme {
  --bg-color-darker: #e9ecef;
  --bg-color: #f4f6f9;
  --card-bg: #ffffff;
  --card-gradient: linear-gradient(135deg, #ffffff 0%, #f4f6f9 100%);
  --border-color: #dbe2eb;
  --accent-color: #0077b6;
  --accent-hover: rgba(0, 119, 182, 0.08);
  --text-color: #2b3a4a;
  --text-secondary: #5e6e7d;
  --text-muted: #788896;
  --header-border: #dbe2eb;
  --table-hover: rgba(0, 119, 182, 0.06);
  --scroll-track: #f4f6f9;
  --scroll-thumb: #ced4da;
  --brand-color: #0077b6;
  --brand-subtitle: #788896;
}

/* ===== GLOBAL ===== */
body, .content-wrapper, .main-sidebar, .left-side {
  background-color: var(--bg-color-darker) !important;
  font-family: 'Inter', 'Segoe UI', sans-serif !important;
  color: var(--text-color) !important;
}
.content-wrapper { background-color: var(--bg-color) !important; }

/* ===== HEADER ===== */
.main-header .navbar,
.main-header .logo { background-color: var(--bg-color) !important; border-bottom: 1px solid var(--header-border) !important; }
.main-header .logo { color: var(--accent-color) !important; font-weight: 700 !important; letter-spacing: 1px !important; }

/* ===== SIDEBAR ===== */
.main-sidebar, .left-side { background-color: var(--bg-color-darker) !important; border-right: 1px solid var(--header-border) !important; }
.sidebar-menu > li > a { color: var(--text-secondary) !important; font-size: 13px !important; }
.sidebar-menu > li > a:hover,
.sidebar-menu > li.active > a { color: var(--text-color) !important; background-color: var(--accent-hover) !important; border-left: 3px solid var(--accent-color) !important; }

/* ===== BOXES / CARDS ===== */
.box { background: var(--card-bg) !important; border: 1px solid var(--border-color) !important; border-top: none !important; border-radius: 6px !important; }
.box-header { border-bottom: 1px solid var(--border-color) !important; }
.box-header .box-title { color: var(--text-color) !important; font-weight: 600 !important; font-size: 13px !important; }

/* ===== VALUE BOXES ===== */
.small-box { background: var(--card-gradient) !important; border: 1px solid var(--border-color) !important; border-radius: 8px !important; }
.small-box h3 { font-size: 22px !important; color: var(--text-color) !important; font-weight: 700 !important; }
.small-box p { color: var(--text-secondary) !important; font-size: 12px !important; }
.small-box .icon-large { color: var(--accent-hover) !important; opacity: 0.3 !important; }
.small-box .small-box-footer { background: rgba(0,0,0,0.1) !important; color: var(--text-muted) !important; border-top: 1px solid var(--border-color) !important; }
.bg-aqua { border-left: 3px solid #00b4d8 !important; }
.bg-green { border-left: 3px solid #06d6a0 !important; }
.bg-yellow { border-left: 3px solid #ffd166 !important; }
.bg-red { border-left: 3px solid #ef476f !important; }
.bg-purple { border-left: 3px solid #7b68ee !important; }

/* ===== DATATABLES ===== */
.dataTables_wrapper { color: var(--text-secondary) !important; }
table.dataTable { background: transparent !important; color: var(--text-color) !important; }
table.dataTable thead th { background: var(--bg-color) !important; color: var(--text-secondary) !important; border-bottom: 1px solid var(--border-color) !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }
table.dataTable tbody tr { background: transparent !important; }
table.dataTable tbody tr:hover { background: var(--table-hover) !important; }
table.dataTable tbody td { border-bottom: 1px solid var(--border-color) !important; font-size: 12px !important; }
.dataTables_info, .dataTables_length, .dataTables_filter { color: var(--text-muted) !important; font-size: 11px !important; }
.dataTables_filter input { background: var(--bg-color) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 4px !important; }
.dataTables_paginate .paginate_button { color: var(--text-muted) !important; }
.dataTables_paginate .paginate_button.current { background: var(--accent-color) !important; color: #fff !important; border-radius: 4px !important; }

/* ===== INPUTS ===== */
.form-control, .selectize-input { background: var(--bg-color) !important; border: 1px solid var(--border-color) !important; color: var(--text-color) !important; border-radius: 4px !important; }
.selectize-dropdown { background: var(--card-bg) !important; color: var(--text-color) !important; border: 1px solid var(--border-color) !important; }
.selectize-dropdown .option:hover { background: var(--accent-hover) !important; }
label { color: var(--text-secondary) !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }

/* ===== PLOTLY ===== */
.plotly .modebar-btn path { fill: var(--text-secondary) !important; }
.plotly .modebar-btn:hover path { fill: var(--accent-color) !important; }

/* ===== LEAFLET ===== */
.leaflet-container { background: var(--bg-color-darker) !important; }

/* ===== SPINNERS ===== */
.shiny-spinner-output-container { background-color: transparent !important; }

/* ===== SCROLLBAR ===== */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--scroll-track); }
::-webkit-scrollbar-thumb { background: var(--scroll-thumb); border-radius: 4px; }

/* ===== SIDEBAR BRAND ===== */
.sidebar-brand { text-align:center; padding:18px 15px 12px; }
.sidebar-brand h4 { color:var(--brand-color); font-weight:700; font-size:18px; margin:0; letter-spacing:2px; }
.sidebar-brand p { color:var(--brand-subtitle); font-size:10px; margin:4px 0 0; text-transform:uppercase; letter-spacing:1px; }
.sidebar-divider { border-color:var(--header-border) !important; margin:8px 15px !important; }
.sidebar-version { position:absolute; bottom:0; width:100%; text-align:center; padding:10px 0; }
.sidebar-version p { color:var(--text-muted); font-size:9px; margin:2px 0; }

/* ===== ALERT SEVERITY ===== */
.alert-high { border-left: 3px solid #ef476f; }
.alert-medium { border-left: 3px solid #ffd166; }
.alert-low { border-left: 3px solid #06d6a0; }

/* ===== ILLUSTRATIVE MODE ===== */
.illustrative-banner {
  background: rgba(240,173,78,0.10);
  border: 1px dashed #f0ad4e;
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 14px;
  color: #f0ad4e;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.illustrative-banner .ill-badge {
  background: #f0ad4e;
  color: #1b2838;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 700;
  margin-right: 8px;
}
.illustrative-box {
  border: 1px dashed rgba(240,173,78,0.4) !important;
}
.illustrative-box .box-header .box-title {
  color: #f0ad4e !important;
}
.illustrative-source {
  color: #b08840;
  font-size: 10px;
  font-style: italic;
  padding: 6px 0;
  border-top: 1px dashed rgba(240,173,78,0.2);
  margin-top: 8px;
}
.transition-card {
  background: rgba(240,173,78,0.06);
  border: 1px dashed rgba(240,173,78,0.3);
  border-radius: 8px;
  padding: 16px 20px;
  margin: 24px 0;
  text-align: center;
}
.transition-card h4 {
  color: #f0ad4e;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 6px 0;
}
.transition-card p {
  color: var(--text-secondary);
  font-size: 12px;
  margin: 0;
}
.data-mode-selector label {
  font-size: 10px !important;
  color: var(--text-secondary) !important;
}
.data-mode-selector .radio label {
  color: var(--text-color) !important;
  font-size: 12px !important;
  text-transform: none !important;
  letter-spacing: 0 !important;
}
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

    # Data mode selector
    div(class = "data-mode-selector", style = "padding: 4px 18px 8px;",
      radioButtons("data_mode", "Data Mode",
        choices = c("Observed Data" = "observed",
                    "Full Capability / Illustrative" = "illustrative"),
        selected = "observed",
        inline = FALSE
      )
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
      menuItem("Forecast & Outlook",    tabName = "forecast_outlook",  icon = icon("chart-area")),
      menuItem("Price Point Mix",       tabName = "price_point",       icon = icon("tags")),
      menuItem("Scratchers Budget vs Actual", tabName = "budget_vs_actual", icon = icon("chart-line"))
    ),

    # Conditional panel for Budget vs Actual selectors
    conditionalPanel(
      condition = "input.main_tabs == 'budget_vs_actual'",
      hr(class = "sidebar-divider"),
      div(style = "padding: 5px 18px 8px;",
        selectizeInput("budget_plan", "Select Plan", choices = NULL),
        selectizeInput("budget_scenario", "Select Scenario", choices = NULL)
      )
    ),


    # Global date presets
    div(style = "padding: 8px 18px 4px;",
      dateRangeInput("date_range", "Analysis Period",
        start     = "2024-01-01",
        end       = Sys.Date(),
        min       = "2020-01-01",
        max       = Sys.Date() + 365,
        separator = " to "
      ),
      div(style = "margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;",
        actionButton("dt_mtd",   "MTD",   style = "padding:3px 8px; font-size:10px; background:#1b2838; color:#8899aa; border:1px solid #2d3a4a; border-radius:3px;"),
        actionButton("dt_ytd",   "YTD",   style = "padding:3px 8px; font-size:10px; background:#1b2838; color:#8899aa; border:1px solid #2d3a4a; border-radius:3px;"),
        actionButton("dt_30d",   "30d",   style = "padding:3px 8px; font-size:10px; background:#1b2838; color:#8899aa; border:1px solid #2d3a4a; border-radius:3px;"),
        actionButton("dt_90d",   "90d",   style = "padding:3px 8px; font-size:10px; background:#1b2838; color:#8899aa; border:1px solid #2d3a4a; border-radius:3px;"),
        actionButton("dt_all",   "All",   style = "padding:3px 8px; font-size:10px; background:#1b2838; color:#8899aa; border:1px solid #2d3a4a; border-radius:3px;")
      )
    ),

    div(class = "sidebar-version",
      p("Executive Dashboard v2.0"),
      p("Stochos Analytics Platform")
    )
  ),

  dashboardBody(
    tags$head(
      tags$style(HTML(custom_css)),
      tags$link(
        href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        rel = "stylesheet"
      ),
      tags$script(HTML("
        // Client-side theme detection from Next.js iframe URL queries
        const urlParams = new URLSearchParams(window.location.search);
        const theme = urlParams.get('theme') || 'dark';
        if (theme === 'light') {
          document.documentElement.classList.add('light-theme');
        }
        // Client-side embed detection
        const embed = urlParams.get('embed');
        if (embed === '1') {
          document.documentElement.classList.add('embed-mode');
          const style = document.createElement('style');
          style.innerHTML = `
            .main-header, .main-sidebar { display: none !important; }
            .content-wrapper, .right-side { margin-left: 0 !important; padding-top: 0 !important; }
            .wrapper { background: transparent !important; }
            .content-wrapper { background: transparent !important; }
          `;
          document.head.appendChild(style);
        }
      "))
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

        # Socio-Demographic Map Box
        fluidRow(
          box(title = "Socio-Demographic & Research Map", width = 12,
            leafletOutput("geo_map", height = "550px")
          )
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
      ),

      # ================================================================
      # TAB 6: PRICE POINT MIX
      # ================================================================
      tabItem(tabName = "price_point",

        scope_label_ui("Draw game price points — Scratch excluded (aggregate data, no product-level detail)",
                       style = "filtered"),

        # Tab-level filters
        fluidRow(
          column(3,
            selectizeInput("pp_filter_price", "Price Point",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All price points"))
          ),
          column(3,
            selectizeInput("pp_filter_county", "County",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All counties"))
          ),
          column(3,
            selectizeInput("pp_filter_channel", "Business Type",
              choices = NULL, multiple = TRUE,
              options = list(placeholder = "All channels"))
          ),
          column(3,
            div(style = "padding-top: 25px; color: #8899aa; font-size: 12px;",
              textOutput("pp_filter_summary")
            )
          )
        ),

        # KPI cards
        fluidRow(
          valueBoxOutput("pp_kpi_price_points", width = 3),
          valueBoxOutput("pp_kpi_dominant",     width = 3),
          valueBoxOutput("pp_kpi_best_rate",    width = 3),
          valueBoxOutput("pp_kpi_units",        width = 3)
        ),

        # Statewide mix + Contribution rate
        fluidRow(
          box(title = "Statewide Price Point Mix — Sales vs Contribution Share",
              width = 7,
            withSpinner(plotlyOutput("pp_mix_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Contribution Rate by Price Point", width = 5,
            withSpinner(plotlyOutput("pp_rate_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Geography index heatmap + Channel comparison
        fluidRow(
          box(title = "County vs Statewide — Sales Index by Price Point", width = 7,
            withSpinner(DTOutput("pp_geo_index_table"), type = 6, color = "#00b4d8")
          ),
          box(title = "Business Type — Price Point Mix", width = 5,
            withSpinner(plotlyOutput("pp_channel_bar", height = "420px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Opportunity table
        fluidRow(
          box(title = "Price Point Opportunity — Flagged Retailers", width = 12,
            withSpinner(DTOutput("pp_opportunity_table"), type = 6, color = "#00b4d8")
          )
        ),

        fluidRow(column(12, source_note_ui("pp_source"))),

        # ==============================================================
        # TRANSITION CARD — Observed to Illustrative
        # ==============================================================
        fluidRow(column(12,
          conditionalPanel(
            condition = "input.data_mode == 'observed'",
            div(class = "transition-card",
              h4(icon("lock"), " Scratch Price Point Analytics"),
              p("This view requires product-level ticket data, including scratch ticket",
                "price point and product-master linkage. That data is not present in",
                "the current NY public dataset."),
              p(style = "margin-top: 8px; color: #667788; font-size: 11px;",
                "Switch to ", tags$b("Full Capability / Illustrative"),
                " mode to see a demonstration of this capability.")
            )
          ),
          conditionalPanel(
            condition = "input.data_mode == 'illustrative'",
            div(class = "transition-card",
              h4(icon("flask"), " Illustrative Capability Views"),
              p("The views below demonstrate scratch price-point analytics available",
                "when product-level ticket catalog data is integrated."),
              p(style = "margin-top: 6px; color: #b08840; font-size: 11px;",
                "Sales totals are anchored to observed NY scratch sales.",
                " Price-point distributions and economics are synthetic.")
            )
          )
        )),

        # ==============================================================
        # ILLUSTRATIVE SECTION — Scratch Price Point Analytics
        # ==============================================================
        conditionalPanel(
          condition = "input.data_mode == 'illustrative'",

          # Scratch mix + contribution rate
          fluidRow(
            column(7,
              illustrative_banner_ui("Scratch Sales Mix by Price Point"),
              div(class = "illustrative-box",
                box(title = span(icon("tags"), " ILLUSTRATIVE — Scratch Price Point Mix"),
                    width = 12,
                  withSpinner(plotlyOutput("ill_scratch_mix_bar", height = "420px"),
                              type = 6, color = "#f0ad4e")
                )
              ),
              illustrative_source_note("ill_mix_source")
            ),
            column(5,
              illustrative_banner_ui("Scratch Contribution Rate by Price Point"),
              div(class = "illustrative-box",
                box(title = span(icon("percent"), " ILLUSTRATIVE — Scratch Contribution Rate"),
                    width = 12,
                  withSpinner(plotlyOutput("ill_scratch_rate_bar", height = "420px"),
                              type = 6, color = "#f0ad4e")
                )
              ),
              illustrative_source_note("ill_rate_source")
            )
          ),

          # Geography + channel
          fluidRow(
            column(7,
              illustrative_banner_ui("Scratch Price Point Index — County vs Statewide"),
              div(class = "illustrative-box",
                box(title = span(icon("map"), " ILLUSTRATIVE — County Scratch Index"),
                    width = 12,
                  withSpinner(DTOutput("ill_geo_index_table"), type = 6, color = "#f0ad4e")
                )
              ),
              illustrative_source_note("ill_geo_source")
            ),
            column(5,
              illustrative_banner_ui("Scratch Price Point Mix by Business Type"),
              div(class = "illustrative-box",
                box(title = span(icon("store"), " ILLUSTRATIVE — Channel Scratch Mix"),
                    width = 12,
                  withSpinner(plotlyOutput("ill_channel_bar", height = "420px"),
                              type = 6, color = "#f0ad4e")
                )
              ),
              illustrative_source_note("ill_channel_source")
            )
          ),

          # Opportunity table
          fluidRow(column(12,
            illustrative_banner_ui("Scratch Price Point Opportunity — Flagged Retailers"),
            div(class = "illustrative-box",
              box(title = span(icon("flag"), " ILLUSTRATIVE — Scratch Opportunity Table"),
                  width = 12,
                withSpinner(DTOutput("ill_opportunity_table"), type = 6, color = "#f0ad4e")
              )
            ),
            illustrative_source_note("ill_opp_source")
          )),

          # Assumptions expander
          fluidRow(column(12,
            div(style = "margin-top: 12px;",
              tags$details(
                tags$summary(style = "cursor:pointer; color:#f0ad4e; font-size:12px; font-weight:600;",
                  icon("info-circle"), " Assumptions & Methodology"
                ),
                div(style = "background:rgba(240,173,78,0.06); border:1px dashed rgba(240,173,78,0.2);
                             border-radius:6px; padding:14px 18px; margin-top:8px; color:#8899aa; font-size:11px;",
                  tags$h5(style = "color:#f0ad4e; margin-top:0;", "What is real"),
                  tags$ul(
                    tags$li("Statewide, county, city, and retailer scratch sales totals are observed NY data"),
                    tags$li("Business type classifications and geographic assignments are from source data")
                  ),
                  tags$h5(style = "color:#f0ad4e;", "What is synthetic"),
                  tags$ul(
                    tags$li("Unit allocation uses a bell-shaped distribution centered at $5 (8%/12%/18%/28%/16%/10%/8%)"),
                    tags$li("5 multiplier-based templates shift the baseline by retailer type, then re-normalize"),
                    tags$li("Payout base rates: $1=55%, $2=56%, $3=57%, $5=58%, $10=60%, $20=62%, $30=64%"),
                    tags$li("Payouts are normalized so total matches observed prize expense (58% target)"),
                    tags$li("Retailer commission: 6% flat across all price points"),
                    tags$li("Revenue = units × price; reconciles exactly to observed scratch totals")
                  ),
                  tags$h5(style = "color:#f0ad4e;", "Price Point Tiers"),
                  tags$ul(
                    tags$li("Low ($1-$3): Higher contribution rate, lower absolute revenue per ticket"),
                    tags$li("Core ($5-$10): Primary volume and contribution drivers"),
                    tags$li("Premium ($20-$30): Volume revenue drivers, thinner margins")
                  ),
                  tags$h5(style = "color:#f0ad4e;", "Purpose"),
                  tags$p("This illustrative layer demonstrates the scratch price-point analytics ",
                         "available when internal product-level data access is granted. ",
                         "It is not a substitute for observed product sales data."),
                  tags$p(style = "color:#667788; font-size:10px; margin-top:8px;",
                    textOutput("ill_generated_at", inline = TRUE))
                )
              )
            )
          ))

        ) # end conditionalPanel illustrative

      ) # end tabItem price_point
      ,

      # ================================================================
      # TAB 7: SCRATCHERS BUDGET VS ACTUAL
      # ================================================================
      tabItem(tabName = "budget_vs_actual",
        scope_label_ui("Comparison of planned budget vs actual sales", style = "filtered"),

        # KPI Row
        fluidRow(
          valueBoxOutput("budget_kpi_planned_rev", width = 3),
          valueBoxOutput("budget_kpi_actual_rev",  width = 3),
          valueBoxOutput("budget_kpi_variance",    width = 3),
          valueBoxOutput("budget_kpi_payout_var",   width = 3)
        ),

        # Cumulative Chart + Monthly Variance
        fluidRow(
          box(title = "Cumulative Revenue (S-Curve)", width = 7,
            withSpinner(plotlyOutput("budget_cumulative_chart", height = "380px"),
                        type = 6, color = "#00b4d8")
          ),
          box(title = "Monthly Revenue Variance", width = 5,
            withSpinner(plotlyOutput("budget_monthly_variance_chart", height = "380px"),
                        type = 6, color = "#00b4d8")
          )
        ),

        # Price Point Comparison
        fluidRow(
          box(title = "Price Point Sales: Budget vs Actual", width = 12,
            withSpinner(plotlyOutput("budget_pp_comparison_chart", height = "360px"),
                        type = 6, color = "#00b4d8"),
            uiOutput("budget_pp_notes")
          )
        )
      )

    ) # end tabItems
  ) # end dashboardBody
) # end dashboardPage


# ==========================================================================
# SERVER
# ==========================================================================

server <- function(input, output, session) {

  # --- URL parameter tab switching ---
  observe({
    query <- getQueryString()
    if (!is.null(query$tab)) {
      updateTabItems(session, "main_tabs", selected = query$tab)
    }
  })

  # --- DuckDB Connection (read-only) ---
  con <- dbConnect(duckdb(), DUCKDB_FILE, read_only = TRUE)
  session$onSessionEnded(function() { dbDisconnect(con, shutdown = FALSE) })

  # --- Theme Mode ---
  theme_mode <- reactive({
    query <- getQueryString()
    if (!is.null(query$theme) && query$theme == "light") "light" else "dark"
  })

  # --- Data max date ---
  data_max_date <- reactive({
    d <- safe_query(con, "SELECT MAX(date) AS d FROM mart_exec_overview_daily")
    if (nrow(d) > 0 && !is.na(d$d)) as.Date(d$d) else Sys.Date()
  })


  # --- Date preset buttons ---
  observeEvent(input$dt_mtd, {
    updateDateRangeInput(session, "date_range",
      start = as.Date(format(Sys.Date(), "%Y-%m-01")), end = Sys.Date())
  })
  observeEvent(input$dt_ytd, {
    updateDateRangeInput(session, "date_range",
      start = as.Date(format(Sys.Date(), "%Y-01-01")), end = Sys.Date())
  })
  observeEvent(input$dt_30d, {
    updateDateRangeInput(session, "date_range",
      start = Sys.Date() - 30, end = Sys.Date())
  })
  observeEvent(input$dt_90d, {
    updateDateRangeInput(session, "date_range",
      start = Sys.Date() - 90, end = Sys.Date())
  })
  observeEvent(input$dt_all, {
    updateDateRangeInput(session, "date_range",
      start = as.Date("2024-01-01"), end = Sys.Date())
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

  # Price point
  pp_geo_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_price_point_geo_summary ORDER BY gross_revenue DESC")
  })

  pp_channel_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_price_point_channel_summary ORDER BY gross_revenue DESC")
  })

  pp_index_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_price_point_index")
  })

  pp_opportunity_data <- reactive({
    safe_query(con, "SELECT * FROM mart_exec_price_point_opportunity ORDER BY opportunity_score DESC")
  })

  # Illustrative (only queried in illustrative mode)
  ill_geo_data <- reactive({
    req(input$data_mode == "illustrative")
    safe_query(con, "SELECT * FROM mart_exec_pp_geo_illustrative ORDER BY gross_revenue DESC")
  })

  ill_channel_data <- reactive({
    req(input$data_mode == "illustrative")
    safe_query(con, "SELECT * FROM mart_exec_pp_channel_illustrative ORDER BY gross_revenue DESC")
  })

  ill_index_data <- reactive({
    req(input$data_mode == "illustrative")
    safe_query(con, "SELECT * FROM mart_exec_pp_index_illustrative")
  })

  ill_opportunity_data <- reactive({
    req(input$data_mode == "illustrative")
    safe_query(con, "SELECT * FROM mart_exec_pp_opportunity_illustrative ORDER BY opportunity_score DESC")
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
      stochos_layout(theme = theme_mode()) %>%
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

    text_font_color <- if (theme_mode() == "light") "#2b3a4a" else "#8899aa"

    plot_ly(wf, x = ~factor(step, levels = step), y = ~value,
            type = "waterfall", measure = ~measure,
            increasing = list(marker = list(color = "#00b4d8")),
            decreasing = list(marker = list(color = "#ef476f")),
            totals     = list(marker = list(color = "#06d6a0")),
            textposition = "outside",
            text = ~paste0(ifelse(value >= 0, "+", ""), fmt_dollar(value)),
            textfont = list(color = text_font_color, size = 11),
            hoverinfo = "text",
            hovertext = ~paste0(step, ": ", dollar(abs(value)))
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(xaxis = list(title = ""), yaxis = list(title = "", tickformat = "$,.0s"))
  })

  # --- Mix comparison ---
  output$exec_mix_compare <- renderPlotly({
    df <- exec_mix()
    validate(need(nrow(df) > 0, "No mix data."))

    df <- df %>% filter(product_group != "Other")

    text_font_color <- if (theme_mode() == "light") "#2b3a4a" else "#8899aa"

    plot_ly(df) %>%
      add_trace(x = ~product_group, y = ~pct_sales, name = "% of Sales",
                type = "bar", marker = list(color = "#00b4d8"),
                text = ~fmt_pct(pct_sales), textposition = "outside",
                textfont = list(color = text_font_color, size = 11)) %>%
      add_trace(x = ~product_group, y = ~pct_contribution, name = "% of Contribution",
                type = "bar", marker = list(color = "#06d6a0"),
                text = ~fmt_pct(pct_contribution), textposition = "outside",
                textfont = list(color = text_font_color, size = 11)) %>%
      stochos_layout(theme = theme_mode()) %>%
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

  output$rtl_scatter <- renderPlotly({
    df <- rtl_quad_filtered()
    validate(need(nrow(df) > 0, "No retailer data for selected filters."))

    median_line_color <- if (theme_mode() == "light") "rgba(0,0,0,0.25)" else "rgba(255,255,255,0.15)"

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
      stochos_layout(theme = theme_mode()) %>%
      layout(
        xaxis = list(title = "Draw Share of Sales", tickformat = ".0%"),
        yaxis = list(title = "Contribution Rate", tickformat = ".0%"),
        legend = list(orientation = "h", y = -0.15, x = 0, font = list(size = 10)),
        shapes = list(
          list(type = "line", x0 = df$median_draw_share[1], x1 = df$median_draw_share[1],
               y0 = 0, y1 = 1, yref = "paper",
               line = list(color = median_line_color, dash = "dot", width = 1)),
          list(type = "line", y0 = df$median_contribution_rate[1], y1 = df$median_contribution_rate[1],
               x0 = 0, x1 = 1, xref = "paper",
               line = list(color = median_line_color, dash = "dot", width = 1))
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

    colorbar_text_color <- if (theme_mode() == "light") "#2b3a4a" else "#8899aa"
    bar_text_color <- if (theme_mode() == "light") "#ffffff" else "#e0e6ed"

    plot_ly(df, y = ~reorder(business_type, gross_revenue), x = ~gross_revenue,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#ef476f"), c(0.5, "#ffd166"), c(1, "#06d6a0")),
                          colorbar = list(title = list(text = "Contrib Rate", font = list(color = colorbar_text_color)),
                                          tickformat = ".0%", tickfont = list(color = colorbar_text_color)),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~paste0(fmt_pct(contribution_rate)),
            textposition = "auto",
            textfont = list(color = bar_text_color, size = 10),
            hoverinfo = "text",
            hovertext = ~paste0(business_type,
                               "<br>Revenue: ", dollar(gross_revenue),
                               "<br>Contribution: ", dollar(net_contribution),
                               "<br>Rate: ", round(contribution_rate * 100, 1), "%",
                               "<br>Draw Share: ", round(draw_share * 100, 1), "%",
                               "<br>Retailers: ", retailer_count)
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
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

    tile_provider <- if (theme_mode() == "light") providers$CartoDB.Positron else providers$CartoDB.DarkMatter

    leaflet(df) %>%
      addProviderTiles(tile_provider) %>%
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

    text_font_color <- if (theme_mode() == "light") "#2b3a4a" else "#8899aa"

    plot_ly(df) %>%
      add_trace(x = ~reorder(game_family, gross_revenue), y = ~gross_revenue,
                name = "Sales", type = "bar", marker = list(color = "#00b4d8"),
                text = ~fmt_dollar(gross_revenue), textposition = "outside",
                textfont = list(color = text_font_color, size = 9)) %>%
      add_trace(x = ~reorder(game_family, gross_revenue), y = ~net_contribution,
                name = "Net Contribution", type = "bar", marker = list(color = "#06d6a0"),
                text = ~fmt_dollar(net_contribution), textposition = "outside",
                textfont = list(color = text_font_color, size = 9)) %>%
      stochos_layout(theme = theme_mode()) %>%
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
      stochos_layout(theme = theme_mode()) %>%
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
      stochos_layout(theme = theme_mode()) %>%
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

  output$geo_map <- renderLeaflet({
    # Load NY county shapes
    counties_sf <- tryCatch({
      sf::st_read("/srv/stochos/new-york-counties.geojson", quiet = TRUE)
    }, error = function(e) {
      NULL
    })
    
    validate(need(!is.null(counties_sf), "Error loading NY County boundaries. Please ensure new-york-counties.geojson is located in /srv/stochos/"))
    
    # Clean county name
    counties_sf$county_clean <- gsub(" County", "", counties_sf$name)
    
    # Get county summary data
    county_data <- safe_query(con, "SELECT * FROM mart_ny_county_summary")
    
    # Merge county boundary geometries with aggregated summary metrics
    merged <- merge(counties_sf, county_data, by.x = "county_clean", by.y = "county", all.x = TRUE)
    
    # Setup static DMA mappings
    get_dma <- function(co) {
      nyc <- c("Bronx", "Kings", "New York", "Queens", "Richmond", "Nassau", "Suffolk", "Westchester", "Rockland", "Orange", "Putnam", "Dutchess", "Sullivan", "Ulster")
      albany <- c("Albany", "Rensselaer", "Schenectady", "Saratoga", "Warren", "Washington", "Clinton", "Essex", "Franklin", "Fulton", "Montgomery", "Schoharie", "Greene", "Columbia", "Delaware", "Otsego", "Hamilton")
      buffalo <- c("Erie", "Niagara", "Chautauqua", "Cattaraugus", "Allegany", "Wyoming")
      rochester <- c("Monroe", "Wayne", "Ontario", "Orleans", "Genesee", "Livingston", "Yates", "Seneca")
      syracuse <- c("Onondaga", "Cayuga", "Cortland", "Madison", "Oswego", "Jefferson", "Lewis", "St. Lawrence", "Tompkins")
      binghamton <- c("Broome", "Chenango", "Tioga", "Schuyler", "Chemung")
      utica <- c("Oneida", "Herkimer")
      if (co %in% nyc) return("New York City DMA")
      if (co %in% albany) return("Albany-Schenectady-Troy DMA")
      if (co %in% buffalo) return("Buffalo DMA")
      if (co %in% rochester) return("Rochester DMA")
      if (co %in% syracuse) return("Syracuse DMA")
      if (co %in% binghamton) return("Binghamton DMA")
      if (co %in% utica) return("Utica DMA")
      return("Other/Upstate DMA")
    }
    merged$dma <- sapply(merged$county_clean, get_dma)
    
    # Safe defaults for missing attributes
    merged$sales_per_capita[is.na(merged$sales_per_capita)] <- 0
    merged$residents_per_retailer[is.na(merged$residents_per_retailer)] <- 0
    merged$median_income[is.na(merged$median_income)] <- 0
    merged$net_contribution[is.na(merged$net_contribution)] <- 0
    merged$gross_revenue[is.na(merged$gross_revenue)] <- 0
    merged$retailer_count[is.na(merged$retailer_count)] <- 0
    
    # Setup responsive palettes
    pal_sales <- colorNumeric(palette = "viridis", domain = merged$sales_per_capita)
    pal_density <- colorNumeric(palette = "plasma", domain = merged$residents_per_retailer)
    pal_income <- colorNumeric(palette = "YlOrRd", domain = merged$median_income)
    pal_earmarks <- colorNumeric(palette = "PuBu", domain = merged$net_contribution)
    
    dma_factors <- factor(merged$dma)
    pal_dma <- colorFactor(palette = "Set3", domain = dma_factors)
    
    tile_provider <- if (theme_mode() == "light") providers$CartoDB.Positron else providers$CartoDB.DarkMatter
    
    m <- leaflet(merged) %>%
      addProviderTiles(tile_provider) %>%
      setView(lng = -75.5, lat = 42.8, zoom = 7)
      
    # 1. Sales Per Capita
    m <- m %>% addPolygons(
      group = "Sales Per Capita",
      fillColor = ~pal_sales(sales_per_capita),
      fillOpacity = 0.6, color = "#666", weight = 1,
      highlightOptions = highlightOptions(weight = 3, color = "#fff", bringToFront = TRUE),
      label = ~paste0(
        "<strong>County:</strong> ", county_clean, "<br>",
        "<strong>Sales Per Capita:</strong> ", scales::dollar(sales_per_capita), "<br>",
        "<strong>Total Sales:</strong> ", scales::dollar(gross_revenue), "<br>",
        "<strong>Population:</strong> ", format(population, big.mark = ",")
      ) %>% lapply(htmltools::HTML)
    )
    
    # 2. Retailer Density
    m <- m %>% addPolygons(
      group = "Retailer Density (Residents/Retailer)",
      fillColor = ~pal_density(residents_per_retailer),
      fillOpacity = 0.6, color = "#666", weight = 1,
      highlightOptions = highlightOptions(weight = 3, color = "#fff", bringToFront = TRUE),
      label = ~paste0(
        "<strong>County:</strong> ", county_clean, "<br>",
        "<strong>Residents per Retailer:</strong> ", format(round(residents_per_retailer), big.mark = ","), "<br>",
        "<strong>Retailers per Sq Mile:</strong> ", round(retailers_per_sq_mile, 3), "<br>",
        "<strong>Retailer Count:</strong> ", format(retailer_count, big.mark = ",")
      ) %>% lapply(htmltools::HTML)
    )
    
    # 3. Median Income
    m <- m %>% addPolygons(
      group = "Median Household Income",
      fillColor = ~pal_income(median_income),
      fillOpacity = 0.6, color = "#666", weight = 1,
      highlightOptions = highlightOptions(weight = 3, color = "#fff", bringToFront = TRUE),
      label = ~paste0(
        "<strong>County:</strong> ", county_clean, "<br>",
        "<strong>Median Household Income:</strong> ", scales::dollar(median_income), "<br>",
        "<strong>Population:</strong> ", format(population, big.mark = ",")
      ) %>% lapply(htmltools::HTML)
    )
    
    # 4. Education Earmarks
    m <- m %>% addPolygons(
      group = "Education Earmarks (Aid)",
      fillColor = ~pal_earmarks(net_contribution),
      fillOpacity = 0.6, color = "#666", weight = 1,
      highlightOptions = highlightOptions(weight = 3, color = "#fff", bringToFront = TRUE),
      label = ~paste0(
        "<strong>County:</strong> ", county_clean, "<br>",
        "<strong>Education Aid (Net Contrib):</strong> ", scales::dollar(net_contribution), "<br>",
        "<strong>Total Gross Revenue:</strong> ", scales::dollar(gross_revenue)
      ) %>% lapply(htmltools::HTML)
    )
    
    # 5. DMA Boundaries
    m <- m %>% addPolygons(
      group = "DMA Boundaries",
      fillColor = ~pal_dma(dma_factors),
      fillOpacity = 0.4, color = "#444", weight = 2,
      highlightOptions = highlightOptions(weight = 4, color = "#fff", bringToFront = TRUE),
      label = ~paste0("<strong>County:</strong> ", county_clean, "<br><strong>DMA:</strong> ", dma) %>% lapply(htmltools::HTML)
    )
    
    m %>% addLayersControl(
      baseGroups = c(
        "Sales Per Capita", 
        "Retailer Density (Residents/Retailer)", 
        "Median Household Income", 
        "Education Earmarks (Aid)",
        "DMA Boundaries"
      ),
      options = layersControlOptions(collapsed = FALSE)
    )
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
      stochos_layout(theme = theme_mode()) %>%
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

    p %>% stochos_layout(theme = theme_mode()) %>%
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



  # ======================================================================
  # TAB 6: PRICE POINT MIX
  # ======================================================================

  # --- Filter initialization ---
  observe({
    df <- pp_geo_data() %>% filter(geo_level == "state")
    if (nrow(df) > 0) {
      prices <- sort(unique(df$price_point[!is.na(df$price_point)]))
      updateSelectizeInput(session, "pp_filter_price",
        choices = paste0("$", format(prices, nsmall = 2)),
        selected = character(0))
    }
    geo <- pp_geo_data() %>% filter(geo_level == "county", county != "Unknown")
    if (nrow(geo) > 0) {
      counties <- sort(unique(geo$county))
      updateSelectizeInput(session, "pp_filter_county", choices = counties, selected = character(0))
    }
    ch <- pp_channel_data()
    if (nrow(ch) > 0) {
      channels <- sort(unique(ch$business_type[ch$business_type != "Unknown"]))
      updateSelectizeInput(session, "pp_filter_channel", choices = channels, selected = character(0))
    }
  })

  # Filtered geo data
  pp_geo_filtered <- reactive({
    df <- pp_geo_data()
    if (!is.null(input$pp_filter_price) && length(input$pp_filter_price) > 0) {
      pp_vals <- as.numeric(gsub("\\$", "", input$pp_filter_price))
      df <- df %>% filter(price_point %in% pp_vals)
    }
    if (!is.null(input$pp_filter_county) && length(input$pp_filter_county) > 0) {
      df <- df %>% filter(county %in% input$pp_filter_county | geo_level == "state")
    }
    df
  })

  pp_channel_filtered <- reactive({
    df <- pp_channel_data()
    if (!is.null(input$pp_filter_price) && length(input$pp_filter_price) > 0) {
      pp_vals <- as.numeric(gsub("\\$", "", input$pp_filter_price))
      df <- df %>% filter(price_point %in% pp_vals)
    }
    if (!is.null(input$pp_filter_channel) && length(input$pp_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$pp_filter_channel)
    }
    df
  })

  pp_opp_filtered <- reactive({
    df <- pp_opportunity_data()
    if (!is.null(input$pp_filter_county) && length(input$pp_filter_county) > 0) {
      df <- df %>% filter(county %in% input$pp_filter_county)
    }
    if (!is.null(input$pp_filter_channel) && length(input$pp_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$pp_filter_channel)
    }
    df
  })

  output$pp_filter_summary <- renderText({
    df <- pp_geo_filtered() %>% filter(geo_level == "state")
    total <- sum(df$gross_revenue, na.rm = TRUE)
    n_pp <- length(unique(df$price_point[!is.na(df$price_point)]))
    paste0(n_pp, " price points  |  ", fmt_dollar(total), " draw game revenue")
  })

  # --- KPI Cards ---
  output$pp_kpi_price_points <- renderValueBox({
    df <- pp_geo_filtered() %>% filter(geo_level == "state")
    validate(need(nrow(df) > 0, "No data"))
    valueBox(length(unique(df$price_point)), "Distinct Price Points",
             icon = icon("tags"), color = "aqua")
  })

  output$pp_kpi_dominant <- renderValueBox({
    df <- pp_geo_filtered() %>% filter(geo_level == "state") %>%
      arrange(desc(gross_revenue)) %>% head(1)
    validate(need(nrow(df) > 0, "No data"))
    valueBox(paste0("$", format(df$price_point, nsmall = 2)),
             paste0("Dominant Price — ", fmt_pct(df$pct_of_sales), " of sales"),
             icon = icon("crown"), color = "green")
  })

  output$pp_kpi_best_rate <- renderValueBox({
    df <- pp_geo_filtered() %>% filter(geo_level == "state") %>%
      arrange(desc(contribution_rate)) %>% head(1)
    validate(need(nrow(df) > 0, "No data"))
    valueBox(paste0("$", format(df$price_point, nsmall = 2)),
             paste0("Highest Rate — ", fmt_pct(df$contribution_rate)),
             icon = icon("percent"), color = "yellow")
  })

  output$pp_kpi_units <- renderValueBox({
    df <- pp_geo_filtered() %>% filter(geo_level == "state")
    validate(need(nrow(df) > 0, "No data"))
    total_rev <- sum(df$gross_revenue, na.rm = TRUE)
    # Weighted average price for unit estimate
    avg_pp <- sum(df$price_point * df$gross_revenue, na.rm = TRUE) / max(total_rev, 1)
    est_units <- total_rev / max(avg_pp, 0.01)
    valueBox(format(round(est_units), big.mark = ","),
             "Estimated Draw Tickets", icon = icon("ticket"), color = "purple")
  })

  # --- Visual A: Statewide mix bar ---
  output$pp_mix_bar <- renderPlotly({
    df <- pp_geo_filtered() %>% filter(geo_level == "state") %>%
      arrange(price_point)
    validate(need(nrow(df) > 0, "No price point data."))

    df$pp_label <- paste0("$", format(df$price_point, nsmall = 2))

    text_font_color <- if (theme_mode() == "light") "#2b3a4a" else "#8899aa"

    plot_ly(df) %>%
      add_trace(x = ~pp_label, y = ~pct_of_sales, name = "% of Sales",
                type = "bar", marker = list(color = "#00b4d8"),
                text = ~fmt_pct(pct_of_sales), textposition = "outside",
                textfont = list(color = text_font_color, size = 10)) %>%
      add_trace(x = ~pp_label, y = ~pct_of_contribution, name = "% of Contribution",
                type = "bar", marker = list(color = "#06d6a0"),
                text = ~fmt_pct(pct_of_contribution), textposition = "outside",
                textfont = list(color = text_font_color, size = 10)) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(barmode = "group",
             xaxis = list(title = "Ticket Price", categoryorder = "array",
                          categoryarray = df$pp_label),
             yaxis = list(title = "", tickformat = ".0%"),
             legend = list(orientation = "h", y = -0.15, x = 0.2))
  })

  # --- Visual B: Contribution rate by price point ---
  output$pp_rate_bar <- renderPlotly({
    df <- pp_geo_filtered() %>% filter(geo_level == "state") %>%
      filter(!is.na(contribution_rate)) %>%
      arrange(price_point)
    validate(need(nrow(df) > 0, "No data."))

    df$pp_label <- paste0("$", format(df$price_point, nsmall = 2))

    plot_ly(df, y = ~reorder(pp_label, price_point), x = ~contribution_rate,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#ef476f"), c(0.5, "#ffd166"), c(1, "#06d6a0")),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~fmt_pct(contribution_rate), textposition = "auto",
            textfont = list(color = "#e0e6ed", size = 11)
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(yaxis = list(title = ""),
             xaxis = list(title = "Contribution Rate", tickformat = ".0%"),
             margin = list(l = 80))
  })

  # --- Visual C: Geography index heatmap ---
  output$pp_geo_index_table <- renderDT({
    idx <- pp_index_data() %>% filter(comparison_level == "county")
    validate(need(nrow(idx) > 0, "No index data."))

    # County filter
    if (!is.null(input$pp_filter_county) && length(input$pp_filter_county) > 0) {
      idx <- idx %>% filter(county %in% input$pp_filter_county)
    }
    # Price filter
    if (!is.null(input$pp_filter_price) && length(input$pp_filter_price) > 0) {
      pp_vals <- as.numeric(gsub("\\$", "", input$pp_filter_price))
      idx <- idx %>% filter(price_point %in% pp_vals)
    }

    # Pivot: rows = county, columns = price points
    wide <- idx %>%
      mutate(pp_label = paste0("$", format(price_point, nsmall = 2))) %>%
      select(county, pp_label, sales_index) %>%
      tidyr::pivot_wider(names_from = pp_label, values_from = sales_index)

    datatable(wide,
      options = list(pageLength = 20, dom = "frtip", scrollX = TRUE),
      rownames = FALSE
    ) %>%
      formatRound(names(wide)[-1], digits = 2) %>%
      formatStyle(names(wide)[-1],
        backgroundColor = styleInterval(
          c(0.8, 1.2),
          c("rgba(239,71,111,0.15)", "transparent", "rgba(6,214,160,0.15)")
        ),
        color = styleInterval(
          c(0.8, 1.2),
          c("#ef476f", "#c5d0dc", "#06d6a0")
        )
      )
  })

  # --- Visual D: Channel price point mix ---
  output$pp_channel_bar <- renderPlotly({
    df <- pp_channel_filtered() %>%
      filter(business_type != "Unknown") %>%
      mutate(pp_label = paste0("$", format(price_point, nsmall = 2)))
    validate(need(nrow(df) > 0, "No channel data."))

    # Get top channels by total revenue
    top_channels <- df %>% group_by(business_type) %>%
      summarise(total = sum(gross_revenue, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(total)) %>% head(8) %>% pull(business_type)
    df <- df %>% filter(business_type %in% top_channels)

    # Compute within-channel shares
    df <- df %>% group_by(business_type) %>%
      mutate(channel_pct = gross_revenue / sum(gross_revenue, na.rm = TRUE)) %>%
      ungroup()

    pp_colors <- c("$0.50" = "#7b68ee", "$1.00" = "#00b4d8", "$2.00" = "#06d6a0",
                   "$5.00" = "#ffd166")

    plot_ly(df, y = ~reorder(business_type, -gross_revenue),
            x = ~channel_pct, color = ~pp_label,
            colors = pp_colors,
            type = "bar", orientation = "h",
            text = ~ifelse(channel_pct > 0.05, fmt_pct(channel_pct), ""),
            textposition = "inside",
            textfont = list(color = "#fff", size = 9),
            hoverinfo = "text",
            hovertext = ~paste0(business_type, " — ", pp_label,
                               "<br>Share: ", fmt_pct(channel_pct),
                               "<br>Revenue: ", dollar(gross_revenue))
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(barmode = "stack",
             yaxis = list(title = ""),
             xaxis = list(title = "Share of Channel Revenue", tickformat = ".0%"),
             legend = list(orientation = "h", y = -0.15, x = 0.1),
             margin = list(l = 130))
  })

  # --- Visual E: Opportunity table ---
  output$pp_opportunity_table <- renderDT({
    df <- pp_opp_filtered() %>% filter(opportunity_flag == "Flag")
    validate(need(nrow(df) > 0, "No flagged opportunities for current filters."))

    tbl <- df %>%
      arrange(desc(opportunity_score)) %>%
      head(100) %>%
      mutate(
        dominant_price_point = paste0("$", format(dominant_price_point, nsmall = 2))
      ) %>%
      select(
        Retailer      = retailer_name,
        County        = county,
        City          = city,
        Channel       = business_type,
        `Dom. Price`  = dominant_price_point,
        `Low $ Share` = low_price_share,
        `Hi $ Share`  = high_price_share,
        `Gross $`     = gross_revenue,
        `Rate`        = contribution_rate,
        Score         = opportunity_score,
        Reason        = opportunity_reason
      )

    datatable(tbl,
      options = list(pageLength = 20, scrollX = TRUE, dom = "frtip",
                     order = list(list(9, "desc")),
                     columnDefs = list(list(className = "dt-right", targets = 5:9))),
      rownames = FALSE
    ) %>%
      formatPercentage(c("Low $ Share", "Hi $ Share", "Rate"), digits = 1) %>%
      formatCurrency("Gross $", digits = 0) %>%
      formatStyle("Score",
        background = styleColorBar(c(0, 100), "rgba(239,71,111,0.3)"),
        backgroundSize = "100% 80%",
        backgroundRepeat = "no-repeat",
        backgroundPosition = "center"
      )
  })

  output$pp_source <- renderText({
    paste0("Data as of: ", format(data_max_date(), "%B %d, %Y"),
           "  |  Source: mart_exec_price_point_* (draw games only, scratch excluded)",
           "  |  Ticket prices from NY Lottery published rates",
           "  |  Stochos Analytics Platform")
  })


  # ======================================================================
  # TAB 6 CONTINUED: ILLUSTRATIVE SCRATCH PRICE POINT VIEWS
  # ======================================================================

  ill_source_text <- paste0(
    "Illustrative view. Synthetic price-point allocation anchored to observed NY ",
    "scratch sales totals. Modeled using industry-consistent bell-shaped unit distribution ",
    "and normalized payout assumptions. Generated on ", format(Sys.Date(), "%B %d, %Y"), "."
  )

  # --- Visual F: Scratch price point mix (grouped bar) ---
  output$ill_scratch_mix_bar <- renderPlotly({
    df <- ill_geo_data() %>% filter(geo_level == "state") %>% arrange(price_point)
    validate(need(nrow(df) > 0, "No illustrative data. Run NY_Exec_Dashboard_Illustrative_Marts.r first."))

    df$pp_label <- paste0("$", df$price_point)

    plot_ly(df) %>%
      add_trace(x = ~pp_label, y = ~pct_of_sales, name = "% of Scratch Sales",
                type = "bar", marker = list(color = "#f0ad4e"),
                text = ~fmt_pct(pct_of_sales), textposition = "outside",
                textfont = list(color = "#b08840", size = 10)) %>%
      add_trace(x = ~pp_label, y = ~pct_of_contribution, name = "% of Scratch Contribution",
                type = "bar", marker = list(color = "#d4a03c"),
                text = ~fmt_pct(pct_of_contribution), textposition = "outside",
                textfont = list(color = "#b08840", size = 10)) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(barmode = "group",
             xaxis = list(title = "Ticket Price", categoryorder = "array",
                          categoryarray = df$pp_label),
             yaxis = list(title = "", tickformat = ".0%"),
             legend = list(orientation = "h", y = -0.15, x = 0.1))
  })

  # --- Visual G: Scratch contribution rate bar ---
  output$ill_scratch_rate_bar <- renderPlotly({
    df <- ill_geo_data() %>% filter(geo_level == "state") %>%
      filter(!is.na(contribution_rate)) %>% arrange(price_point)
    validate(need(nrow(df) > 0, "No data."))

    df$pp_label <- paste0("$", df$price_point)

    plot_ly(df, y = ~reorder(pp_label, price_point), x = ~contribution_rate,
            type = "bar", orientation = "h",
            marker = list(color = ~contribution_rate,
                          colorscale = list(c(0, "#ef476f"), c(0.5, "#ffd166"), c(1, "#06d6a0")),
                          line = list(color = "#0a1628", width = 0.5)),
            text = ~fmt_pct(contribution_rate), textposition = "auto",
            textfont = list(color = "#e0e6ed", size = 11)
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(yaxis = list(title = ""),
             xaxis = list(title = "Contribution Rate", tickformat = ".0%"),
             margin = list(l = 60))
  })

  # --- Visual H: County vs statewide scratch index ---
  output$ill_geo_index_table <- renderDT({
    idx <- ill_index_data() %>% filter(comparison_level == "county")
    validate(need(nrow(idx) > 0, "No index data."))

    # County filter from tab
    if (!is.null(input$pp_filter_county) && length(input$pp_filter_county) > 0) {
      idx <- idx %>% filter(county %in% input$pp_filter_county)
    }

    wide <- idx %>%
      mutate(pp_label = paste0("$", price_point)) %>%
      select(county, pp_label, sales_index) %>%
      pivot_wider(names_from = pp_label, values_from = sales_index)

    datatable(wide,
      options = list(pageLength = 20, dom = "frtip", scrollX = TRUE),
      rownames = FALSE,
      caption = htmltools::tags$caption(
        style = "color:#b08840; font-size:11px; font-style:italic;",
        "Index > 1.0 = over-indexed vs statewide. < 1.0 = under-indexed."
      )
    ) %>%
      formatRound(names(wide)[-1], digits = 2) %>%
      formatStyle(names(wide)[-1],
        backgroundColor = styleInterval(
          c(0.8, 1.2),
          c("rgba(239,71,111,0.15)", "transparent", "rgba(6,214,160,0.15)")
        ),
        color = styleInterval(
          c(0.8, 1.2),
          c("#ef476f", "#c5d0dc", "#06d6a0")
        )
      )
  })

  # --- Visual I: Channel scratch mix ---
  output$ill_channel_bar <- renderPlotly({
    df <- ill_channel_data() %>%
      filter(business_type != "Unknown") %>%
      mutate(pp_label = paste0("$", price_point))
    validate(need(nrow(df) > 0, "No channel data."))

    top_channels <- df %>% group_by(business_type) %>%
      summarise(total = sum(gross_revenue, na.rm = TRUE), .groups = "drop") %>%
      arrange(desc(total)) %>% head(8) %>% pull(business_type)
    df <- df %>% filter(business_type %in% top_channels)

    df <- df %>% group_by(business_type) %>%
      mutate(channel_pct = gross_revenue / sum(gross_revenue, na.rm = TRUE)) %>%
      ungroup()

    pp_colors <- c("$1" = "#f0ad4e", "$2" = "#d4a03c", "$3" = "#b89530",
                   "$5" = "#9c8a24", "$10" = "#807f18", "$20" = "#64740c",
                   "$30" = "#486900")

    plot_ly(df, y = ~reorder(business_type, -gross_revenue),
            x = ~channel_pct, color = ~pp_label,
            colors = pp_colors,
            type = "bar", orientation = "h",
            text = ~ifelse(channel_pct > 0.05, fmt_pct(channel_pct), ""),
            textposition = "inside",
            textfont = list(color = "#fff", size = 9),
            hoverinfo = "text",
            hovertext = ~paste0(business_type, " \u2014 ", pp_label,
                               "<br>Share: ", fmt_pct(channel_pct),
                               "<br>Revenue: ", dollar(gross_revenue))
    ) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(barmode = "stack",
             yaxis = list(title = ""),
             xaxis = list(title = "Share of Scratch Revenue", tickformat = ".0%"),
             legend = list(orientation = "h", y = -0.15, x = 0.0),
             margin = list(l = 130))
  })

  # --- Visual J: Scratch opportunity table ---
  output$ill_opportunity_table <- renderDT({
    df <- ill_opportunity_data() %>% filter(opportunity_flag == "Flag")
    validate(need(nrow(df) > 0, "No flagged opportunities."))

    # Apply tab filters
    if (!is.null(input$pp_filter_county) && length(input$pp_filter_county) > 0) {
      df <- df %>% filter(county %in% input$pp_filter_county)
    }
    if (!is.null(input$pp_filter_channel) && length(input$pp_filter_channel) > 0) {
      df <- df %>% filter(business_type %in% input$pp_filter_channel)
    }

    tbl <- df %>%
      arrange(desc(opportunity_score)) %>% head(100) %>%
      mutate(dominant_price_point = paste0("$", dominant_price_point)) %>%
      select(
        Retailer      = retailer_name,
        County        = county,
        City          = city,
        Channel       = business_type,
        `Dom. Price`  = dominant_price_point,
        `Low Tier`    = low_tier_share,
        `Core Tier`   = core_tier_share,
        `Premium`     = premium_tier_share,
        `Scratch $`   = gross_revenue,
        `Rate`        = contribution_rate,
        Score         = opportunity_score,
        Reason        = opportunity_reason
      )

    datatable(tbl,
      options = list(pageLength = 20, scrollX = TRUE, dom = "frtip",
                     order = list(list(10, "desc")),
                     columnDefs = list(list(className = "dt-right", targets = 5:10))),
      rownames = FALSE,
      caption = htmltools::tags$caption(
        style = "color:#b08840; font-size:11px; font-style:italic;",
        "ILLUSTRATIVE: Opportunity flags based on synthetic price-point allocation. Tiers: Low ($1-$3), Core ($5-$10), Premium ($20-$30)."
      )
    ) %>%
      formatPercentage(c("Low Tier", "Core Tier", "Premium", "Rate"), digits = 1) %>%
      formatCurrency("Scratch $", digits = 0) %>%
      formatStyle("Score",
        background = styleColorBar(c(0, 100), "rgba(240,173,78,0.3)"),
        backgroundSize = "100% 80%",
        backgroundRepeat = "no-repeat",
        backgroundPosition = "center"
      )
  })

  # --- Illustrative source notes ---
  output$ill_mix_source     <- renderText({ ill_source_text })
  output$ill_rate_source    <- renderText({ ill_source_text })
  output$ill_geo_source     <- renderText({ ill_source_text })
  output$ill_channel_source <- renderText({ ill_source_text })
  output$ill_opp_source     <- renderText({ ill_source_text })
  output$ill_generated_at   <- renderText({
    paste0("Illustrative data generated on: ", format(Sys.Date(), "%B %d, %Y"))
  })


  # ======================================================================
  # BUDGET VS ACTUAL REACTIVES & OUTPUTS
  # ======================================================================

  # Dynamic selectize update for plans
  plans_data <- reactive({
    safe_query(con, "SELECT DISTINCT plan_id, plan_name FROM instant_ticket_plan_budget_raw")
  })

  observe({
    df <- plans_data()
    if (nrow(df) > 0) {
      choices <- setNames(df$plan_id, df$plan_name)
      updateSelectizeInput(session, "budget_plan", choices = choices, selected = df$plan_id[1])
    }
  })

  # Dynamic selectize update for scenarios based on plan
  scenarios_data <- reactive({
    req(input$budget_plan)
    safe_query(con, paste0(
      "SELECT DISTINCT scenario_id, scenario_name FROM instant_ticket_plan_budget_raw WHERE plan_id = '",
      input$budget_plan, "'"
    ))
  })

  observe({
    df <- scenarios_data()
    if (nrow(df) > 0) {
      choices <- setNames(df$scenario_id, df$scenario_name)
      updateSelectizeInput(session, "budget_scenario", choices = choices, selected = df$scenario_id[1])
    }
  })

  # Core query merging daily budget and daily actuals
  budget_vs_actual_data <- reactive({
    req(input$budget_scenario)
    d1 <- format(input$date_range[1], "%Y-%m-%d")
    d2 <- format(input$date_range[2], "%Y-%m-%d")

    q <- paste0("
      WITH budget AS (
          SELECT 
              date,
              SUM(planned_revenue) AS planned_revenue,
              SUM(planned_payout) AS planned_payout
          FROM instant_ticket_plan_budget_daily
          WHERE scenario_id = '", input$budget_scenario, "'
            AND date >= '", d1, "' AND date <= '", d2, "'
          GROUP BY date
      ),
      actual AS (
          SELECT 
              sales_date AS date,
              SUM(gross_revenue) AS actual_revenue,
              SUM(estimated_payout) AS actual_payout
          FROM v_unified_lottery_truth
          WHERE game_family = 'Scratchers'
            AND sales_date >= '", d1, "' AND sales_date <= '", d2, "'
          GROUP BY sales_date
      )
      SELECT 
          COALESCE(b.date, a.date) AS date,
          COALESCE(b.planned_revenue, 0) AS planned_revenue,
          COALESCE(b.planned_payout, 0) AS planned_payout,
          COALESCE(a.actual_revenue, 0) AS actual_revenue,
          COALESCE(a.actual_payout, 0) AS actual_payout
      FROM budget b
      FULL OUTER JOIN actual a ON b.date = a.date
      ORDER BY date
    ")

    safe_query(con, q)
  })

  # Cumulative calculations for the S-Curve chart
  cumulative_data <- reactive({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data for selected period."))

    df$date <- as.Date(df$date)

    # Determine the last date with actual sales to avoid flatlining cumulative line in the future
    max_actual_date <- max(df$date[df$actual_revenue > 0], na.rm = TRUE)
    if (is.infinite(max_actual_date)) max_actual_date <- min(df$date)

    df <- df %>%
      arrange(date) %>%
      mutate(
        cum_planned = cumsum(planned_revenue),
        cum_actual = ifelse(date <= max_actual_date, cumsum(actual_revenue), NA),
        cum_planned_payout = cumsum(planned_payout),
        cum_actual_payout = ifelse(date <= max_actual_date, cumsum(actual_payout), NA)
      )
    df
  })

  # Price point breakdown reactive
  budget_pp_data <- reactive({
    req(input$budget_scenario)
    d1 <- format(input$date_range[1], "%Y-%m-%d")
    d2 <- format(input$date_range[2], "%Y-%m-%d")

    # Planned by Price Point
    planned_pp <- safe_query(con, paste0("
      SELECT 
          CAST(denomination AS INTEGER) AS price_point,
          SUM(planned_revenue) AS planned_revenue
      FROM instant_ticket_plan_budget_daily
      WHERE scenario_id = '", input$budget_scenario, "'
        AND date >= '", d1, "' AND date <= '", d2, "'
      GROUP BY denomination
    "))

    # Actual by Price Point (scaled by category template mix if illustrative)
    actual_total <- safe_query(con, paste0("
      SELECT SUM(gross_revenue) AS val
      FROM v_unified_lottery_truth
      WHERE game_family = 'Scratchers'
        AND sales_date >= '", d1, "' AND sales_date <= '", d2, "'
    "))$val[1]
    if (is.na(actual_total)) actual_total <- 0

    if (input$data_mode == "illustrative") {
      shares <- safe_query(con, "
        WITH totals AS (SELECT SUM(gross_revenue) AS tot FROM mart_exec_pp_mix_illustrative),
        grouped AS (
            SELECT 
                CAST(price_point AS INTEGER) AS price_point,
                SUM(gross_revenue) AS pp_tot
            FROM mart_exec_pp_mix_illustrative
            GROUP BY price_point
        )
        SELECT 
            price_point,
            pp_tot / tot AS share
        FROM grouped, totals
      ")

      if (nrow(shares) > 0 && nrow(planned_pp) > 0) {
        shares$actual_revenue <- shares$share * actual_total
        res <- merge(planned_pp, shares[, c("price_point", "actual_revenue")], by = "price_point", all = TRUE)
      } else {
        res <- planned_pp
        res$actual_revenue <- 0
      }
    } else {
      res <- planned_pp
      res$actual_revenue <- NA
    }

    res[is.na(res)] <- 0
    res
  })

  # --- KPI Outputs ---

  output$budget_kpi_planned_rev <- renderValueBox({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data"))
    val <- sum(df$planned_revenue, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Planned Revenue (Budget)", icon = icon("chart-bar"), color = "aqua")
  })

  output$budget_kpi_actual_rev <- renderValueBox({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data"))
    val <- sum(df$actual_revenue, na.rm = TRUE)
    valueBox(fmt_dollar(val), "Actual Revenue", icon = icon("dollar-sign"), color = "green")
  })

  output$budget_kpi_variance <- renderValueBox({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data"))

    max_actual_date <- max(df$date[df$actual_revenue > 0], na.rm = TRUE)
    if (is.infinite(max_actual_date)) {
      planned <- sum(df$planned_revenue, na.rm = TRUE)
      actual <- sum(df$actual_revenue, na.rm = TRUE)
    } else {
      planned <- sum(df$planned_revenue[df$date <= max_actual_date], na.rm = TRUE)
      actual <- sum(df$actual_revenue[df$date <= max_actual_date], na.rm = TRUE)
    }

    diff <- actual - planned
    pct <- if (planned > 0) (diff / planned) * 100 else 0

    color <- if (diff >= 0) "green" else "red"
    prefix <- if (diff >= 0) "+" else ""

    valueBox(
      paste0(prefix, fmt_dollar(diff), " (", sprintf("%.1f%%", pct), ")"),
      "Revenue Variance (To Date)",
      icon = icon(ifelse(diff >= 0, "arrow-up", "arrow-down")),
      color = color
    )
  })

  output$budget_kpi_payout_var <- renderValueBox({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data"))

    actual_rev <- sum(df$actual_revenue, na.rm = TRUE)
    actual_payout <- sum(df$actual_payout, na.rm = TRUE)
    actual_rate <- if (actual_rev > 0) (actual_payout / actual_rev) * 100 else 0

    planned_rev <- sum(df$planned_revenue, na.rm = TRUE)
    planned_payout <- sum(df$planned_payout, na.rm = TRUE)
    planned_rate <- if (planned_rev > 0) (planned_payout / planned_rev) * 100 else 0

    diff <- actual_rate - planned_rate
    color <- if (diff <= 0) "green" else "yellow"
    prefix <- if (diff >= 0) "+" else ""

    valueBox(
      sprintf("%s%.1f%% pts", prefix, diff),
      paste0("Payout Rate Var (Act: ", sprintf("%.1f%%", actual_rate), " vs Plan: ", sprintf("%.1f%%", planned_rate), ")"),
      icon = icon("percent"),
      color = color
    )
  })

  # --- Chart Outputs ---

  output$budget_cumulative_chart <- renderPlotly({
    df <- cumulative_data()

    plot_ly(df, x = ~date) %>%
      add_trace(y = ~cum_planned, name = "Planned Revenue (Budget)",
                type = "scatter", mode = "lines",
                line = list(color = "#00b4d8", width = 2.5, dash = "dash")) %>%
      add_trace(y = ~cum_actual, name = "Actual Revenue",
                type = "scatter", mode = "lines",
                line = list(color = "#06d6a0", width = 3)) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(
        xaxis = list(title = ""),
        yaxis = list(title = "Cumulative Revenue", tickformat = "$,.0s"),
        legend = list(orientation = "h", y = -0.12, x = 0.2),
        hovermode = "x unified"
      )
  })

  output$budget_monthly_variance_chart <- renderPlotly({
    df <- budget_vs_actual_data()
    validate(need(nrow(df) > 0, "No data"))

    # Filter to dates with actuals
    max_actual_date <- max(df$date[df$actual_revenue > 0], na.rm = TRUE)
    if (!is.infinite(max_actual_date)) {
      df <- df %>% filter(date <= max_actual_date)
    }

    monthly <- df %>%
      mutate(month = format(as.Date(date), "%Y-%m")) %>%
      group_by(month) %>%
      summarise(
        planned = sum(planned_revenue, na.rm = TRUE),
        actual = sum(actual_revenue, na.rm = TRUE),
        .groups = "drop"
      ) %>%
      mutate(
        variance = actual - planned,
        color = ifelse(variance >= 0, "#06d6a0", "#ef476f")
      )

    plot_ly(monthly, x = ~month, y = ~variance, type = "bar",
            marker = list(color = ~color)) %>%
      stochos_layout(theme = theme_mode()) %>%
      layout(
        xaxis = list(title = ""),
        yaxis = list(title = "Variance", tickformat = "$,.0s"),
        hovermode = "closest"
      )
  })

  output$budget_pp_comparison_chart <- renderPlotly({
    df <- budget_pp_data()
    validate(need(nrow(df) > 0, "No planned budget data for this period."))

    df <- df %>% arrange(price_point)
    df$price_point_label <- paste0("$", df$price_point)

    p <- plot_ly(df, x = ~price_point_label) %>%
      add_trace(y = ~planned_revenue, name = "Planned Budget",
                type = "bar", marker = list(color = "#00b4d8"))

    if (input$data_mode == "illustrative") {
      p <- p %>% add_trace(y = ~actual_revenue, name = "Actual Sales (Illustrative)",
                            type = "bar", marker = list(color = "#06d6a0"))
    }

    p %>% stochos_layout(theme = theme_mode()) %>%
      layout(
        xaxis = list(title = "Price Point"),
        yaxis = list(title = "Revenue", tickformat = "$,.0s"),
        bgroupgap = 0.1,
        legend = list(orientation = "h", y = -0.15, x = 0.3)
      )
  })

  output$budget_pp_notes <- renderUI({
    if (input$data_mode == "observed") {
      tags$p(style = "color: #8899aa; font-style: italic; font-size: 11px; margin-top: 8px;",
             "Note: Observed actual sales are not available by individual price point in the current dataset. ",
             "Switch to 'Full Capability / Illustrative' mode in the sidebar to see estimated actuals.")
    } else {
      tags$p(style = "color: #06d6a0; font-size: 11px; margin-top: 8px;",
             "Showing estimated actual sales distributed by price point based on retailer category mix templates.")
    }
  })


} # end server


# ==========================================================================
# LAUNCH
# ==========================================================================

shinyApp(ui, server)
