# ==========================================================================
# Stochos Analytics: New York Lottery
# Phase 1 Dashboard Mart Builder
# ==========================================================================
#
# Purpose:
#   Build pre-aggregated mart tables in DuckDB to power the NY SaaS Dashboard.
#   These marts aggregate from v_unified_lottery_truth and related tables,
#   keeping the Shiny dashboard thin and fast.
#
# Prerequisites:
#   The following warehouse objects must exist:
#     - v_unified_lottery_truth
#     - ny_retailer_dim          (for coordinates, zip, quick_draw)
#     - ny_daily_sales_fact_enriched  (for business_type)
#
# Usage:
#   Run this script on the Stochos analytics server before launching the dashboard.
#   It creates/replaces mart tables in the DuckDB warehouse.
#
# Engineering rule:
#   Develop in stochos_dev, then promote after validation.
#   Adjust duckdb_file to point at the dev database during development.
#
# ==========================================================================

library(DBI)
library(duckdb)

# --- Configuration --------------------------------------------------------

duckdb_file <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

# Connect in read-write mode for table creation
con <- dbConnect(duckdb(), duckdb_file)
on.exit(dbDisconnect(con, shutdown = FALSE), add = TRUE)

cat("Connected to DuckDB:", duckdb_file, "\n")
cat("Building Phase 1 dashboard marts...\n\n")


# ==========================================================================
# SPRINT 1: Executive Summary Marts
# ==========================================================================

cat("--- Sprint 1: Executive Summary ---\n")

# --------------------------------------------------------------------------
# 1. mart_ny_exec_timeseries_daily
#    Daily economic time series.
#    Used for: KPI calculation (with date filter), trend chart, waterfall.
# --------------------------------------------------------------------------

cat("  Building mart_ny_exec_timeseries_daily...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_exec_timeseries_daily AS
SELECT
    sales_date                           AS date,
    SUM(gross_revenue)                   AS gross_revenue,
    SUM(estimated_payout)                AS estimated_payout,
    SUM(retailer_commission)             AS retailer_commission,
    SUM(net_contribution)                AS net_contribution,
    COUNT(DISTINCT retailer_id)          AS active_retailers,
    COUNT(DISTINCT game_code)            AS active_games
FROM v_unified_lottery_truth
GROUP BY sales_date
ORDER BY sales_date
")
cat(" done.\n")

n <- dbGetQuery(con, "
  SELECT COUNT(*) AS n, MIN(date) AS min_dt, MAX(date) AS max_dt
  FROM mart_ny_exec_timeseries_daily
")
cat("    rows:", n$n, " | range:", as.character(n$min_dt), "to", as.character(n$max_dt), "\n")


# --------------------------------------------------------------------------
# 2. mart_ny_exec_game_mix
#    Game-level sales mix with percentage shares.
#    Used for: donut chart, top games table.
# --------------------------------------------------------------------------

cat("  Building mart_ny_exec_game_mix...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_exec_game_mix AS
WITH game_totals AS (
    SELECT
        COALESCE(game_family, 'Unknown')        AS category,
        game_code,
        COALESCE(game_name, game_code)          AS game_name,
        SUM(gross_revenue)                      AS gross_revenue,
        SUM(net_contribution)                   AS net_contribution,
        COUNT(DISTINCT retailer_id)             AS retailer_count
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY game_family, game_code, game_name
)
SELECT
    *,
    gross_revenue / NULLIF(SUM(gross_revenue) OVER (), 0) AS pct_of_sales
FROM game_totals
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_exec_game_mix")
cat("    games:", n$n, "\n")


# --------------------------------------------------------------------------
# 2b. mart_ny_exec_kpis
#     Full-period KPI summary (one row).
#     Used for: Tab 1 KPIs when no date filter is active; cross-tab reconciliation.
# --------------------------------------------------------------------------

cat("  Building mart_ny_exec_kpis...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_exec_kpis AS
SELECT
    MIN(sales_date)                          AS date_min,
    MAX(sales_date)                          AS date_max,
    SUM(gross_revenue)                       AS gross_revenue,
    SUM(estimated_payout)                    AS estimated_payout,
    SUM(retailer_commission)                 AS retailer_commission,
    SUM(net_contribution)                    AS net_contribution,
    COUNT(DISTINCT retailer_id)              AS distinct_retailers,
    COUNT(DISTINCT game_code)                AS distinct_games,
    SUM(gross_revenue) /
        NULLIF(DATEDIFF('day', MIN(sales_date), MAX(sales_date)) + 1, 0) AS avg_daily_sales
FROM v_unified_lottery_truth
")
cat(" done.\n")


# --------------------------------------------------------------------------
# 2c. mart_ny_exec_waterfall
#     Pre-computed waterfall steps for the economic flow chart.
#     4 rows: Gross Revenue, Estimated Payouts, Retailer Commission, Net Contribution.
# --------------------------------------------------------------------------

cat("  Building mart_ny_exec_waterfall...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_exec_waterfall AS
WITH totals AS (
    SELECT
        SUM(gross_revenue)         AS gross_revenue,
        SUM(estimated_payout)      AS estimated_payout,
        SUM(retailer_commission)   AS retailer_commission,
        SUM(net_contribution)      AS net_contribution
    FROM v_unified_lottery_truth
)
SELECT 1 AS step_order, 'Gross Revenue'       AS step_label, gross_revenue         AS step_value, 'absolute' AS measure FROM totals
UNION ALL
SELECT 2,              'Est. Payouts',         -estimated_payout,                    'relative'              FROM totals
UNION ALL
SELECT 3,              'Retailer Commission',  -retailer_commission,                 'relative'              FROM totals
UNION ALL
SELECT 4,              'Net Contribution',     net_contribution,                     'total'                 FROM totals
ORDER BY step_order
")
cat(" done.\n")


# ==========================================================================
# SPRINT 2: Retailer Intelligence Marts
# ==========================================================================

cat("\n--- Sprint 2: Retailer Intelligence ---\n")

# --------------------------------------------------------------------------
# 3. mart_ny_retailer_performance
#    Retailer-level economic summary with coordinates and metadata.
#    Joins v_unified_lottery_truth → ny_retailer_dim for geo,
#    and ny_daily_sales_fact_enriched for business_type.
# --------------------------------------------------------------------------

cat("  Building mart_ny_retailer_performance...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_retailer_performance AS
WITH retailer_econ AS (
    SELECT
        retailer_id,
        MAX(retailer_name)                      AS retailer_name,
        MAX(city)                               AS city,
        MAX(county)                             AS county,
        SUM(gross_revenue)                      AS gross_revenue,
        SUM(net_contribution)                   AS net_contribution,
        SUM(estimated_payout)                   AS estimated_payout,
        SUM(retailer_commission)                AS retailer_commission,
        COUNT(DISTINCT sales_date)              AS days_active,
        COUNT(DISTINCT game_code)               AS distinct_games,
        MAX(sales_date)                         AS latest_sale_date
    FROM v_unified_lottery_truth
    GROUP BY retailer_id
),
retailer_bustype AS (
    SELECT
        retailer_id,
        MIN(business_type)                      AS business_type
    FROM ny_daily_sales_fact_enriched
    WHERE business_type IS NOT NULL
    GROUP BY retailer_id
)
SELECT
    e.retailer_id,
    e.retailer_name,
    e.city,
    e.county,
    COALESCE(r.zip_code, '')                    AS zip,
    COALESCE(r.quick_draw, '')                  AS quick_draw,
    r.latitude,
    r.longitude,
    COALESCE(b.business_type, 'Unknown')        AS business_type,
    e.gross_revenue,
    e.net_contribution,
    e.estimated_payout,
    e.retailer_commission,
    e.days_active,
    e.gross_revenue / NULLIF(e.days_active, 0)  AS avg_daily_sales,
    e.distinct_games,
    e.latest_sale_date
FROM retailer_econ e
LEFT JOIN ny_retailer_dim r
    ON e.retailer_id = r.retailer_id
LEFT JOIN retailer_bustype b
    ON e.retailer_id = b.retailer_id
ORDER BY e.gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_retailer_performance")
cat("    retailers:", n$n, "\n")


# --------------------------------------------------------------------------
# 4. mart_ny_retailer_business_type
#    Aggregate performance by business type.
#    Derived from mart_ny_retailer_performance (downstream mart).
# --------------------------------------------------------------------------

cat("  Building mart_ny_retailer_business_type...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_retailer_business_type AS
SELECT
    business_type,
    COUNT(*)                                            AS retailer_count,
    SUM(gross_revenue)                                  AS gross_revenue,
    SUM(net_contribution)                               AS net_contribution,
    SUM(gross_revenue) / NULLIF(COUNT(*), 0)            AS avg_sales_per_retailer
FROM mart_ny_retailer_performance
GROUP BY business_type
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_retailer_business_type")
cat("    business types:", n$n, "\n")


# --------------------------------------------------------------------------
# 4b. mart_ny_retailer_map
#     Map-ready retailer data: only retailers with valid NY coordinates.
#     Downstream view on mart_ny_retailer_performance.
# --------------------------------------------------------------------------

cat("  Building mart_ny_retailer_map...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_retailer_map AS
SELECT
    retailer_id,
    retailer_name,
    city,
    county,
    zip,
    latitude,
    longitude,
    gross_revenue,
    net_contribution,
    avg_daily_sales,
    days_active,
    distinct_games,
    quick_draw,
    business_type
FROM mart_ny_retailer_performance
WHERE latitude  IS NOT NULL
  AND longitude IS NOT NULL
  AND latitude  BETWEEN 40.45 AND 45.10
  AND longitude BETWEEN -79.90 AND -71.80
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_retailer_map")
cat("    map retailers:", n$n, "\n")


# ==========================================================================
# SPRINT 3: Game Performance Marts
# ==========================================================================

cat("\n--- Sprint 3: Game Performance ---\n")

# --------------------------------------------------------------------------
# 5. mart_ny_game_performance
#    Game-level performance summary.
# --------------------------------------------------------------------------

cat("  Building mart_ny_game_performance...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_game_performance AS
WITH game_agg AS (
    SELECT
        game_code,
        COALESCE(game_name, game_code)          AS game_name,
        COALESCE(game_family, 'Unknown')        AS category,
        SUM(gross_revenue)                      AS gross_revenue,
        SUM(net_contribution)                   AS net_contribution,
        SUM(estimated_payout)                   AS estimated_payout,
        SUM(retailer_commission)                AS retailer_commission,
        COUNT(DISTINCT retailer_id)             AS distinct_retailers,
        COUNT(DISTINCT sales_date)              AS active_days
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY game_code, game_name, game_family
)
SELECT
    *,
    gross_revenue / NULLIF(distinct_retailers, 0)                   AS avg_sales_per_retailer,
    gross_revenue / NULLIF(SUM(gross_revenue) OVER (), 0)           AS pct_of_total_sales
FROM game_agg
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_game_performance")
cat("    games:", n$n, "\n")


# --------------------------------------------------------------------------
# 6. mart_ny_game_timeseries
#    Daily time series by game family for trend analysis.
#    Also used by Tab 1 for date-filtered game mix.
# --------------------------------------------------------------------------

cat("  Building mart_ny_game_timeseries...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_game_timeseries AS
SELECT
    sales_date                               AS date,
    COALESCE(game_family, 'Unknown')         AS category,
    SUM(gross_revenue)                       AS gross_revenue,
    SUM(net_contribution)                    AS net_contribution,
    COUNT(DISTINCT retailer_id)              AS active_retailers
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY sales_date, game_family
ORDER BY sales_date, category
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_game_timeseries")
cat("    rows:", n$n, "\n")


# --------------------------------------------------------------------------
# 7. mart_ny_category_summary
#    Category (game family) level summary.
# --------------------------------------------------------------------------

cat("  Building mart_ny_category_summary...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_category_summary AS
SELECT
    COALESCE(game_family, 'Unknown')         AS category,
    SUM(gross_revenue)                       AS gross_revenue,
    SUM(net_contribution)                    AS net_contribution,
    COUNT(DISTINCT game_code)                AS distinct_games,
    COUNT(DISTINCT retailer_id)              AS distinct_retailers,
    SUM(gross_revenue) /
        NULLIF(SUM(SUM(gross_revenue)) OVER (), 0) AS pct_of_total_sales
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY game_family
ORDER BY gross_revenue DESC
")
cat(" done.\n")


# --------------------------------------------------------------------------
# 8. mart_ny_game_penetration
#    Retailer penetration per game.
# --------------------------------------------------------------------------

cat("  Building mart_ny_game_penetration...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_game_penetration AS
WITH total_retailers AS (
    SELECT COUNT(DISTINCT retailer_id) AS total_retailers
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
)
SELECT
    t.game_code,
    COALESCE(t.game_name, t.game_code)      AS game_name,
    COALESCE(t.game_family, 'Unknown')       AS category,
    COUNT(DISTINCT t.retailer_id)            AS retailers_carrying_game,
    tr.total_retailers,
    CAST(COUNT(DISTINCT t.retailer_id) AS DOUBLE) /
        NULLIF(tr.total_retailers, 0)        AS penetration_rate,
    SUM(t.gross_revenue) /
        NULLIF(COUNT(DISTINCT t.retailer_id), 0) AS avg_sales_per_carrying_retailer
FROM v_unified_lottery_truth t
CROSS JOIN total_retailers tr
WHERE t.gross_revenue > 0
GROUP BY t.game_code, t.game_name, t.game_family, tr.total_retailers
ORDER BY retailers_carrying_game DESC
")
cat(" done.\n")


# ==========================================================================
# SPRINT 4: Geographic Analytics Marts
# ==========================================================================

cat("\n--- Sprint 4: Geographic Analytics ---\n")

# --------------------------------------------------------------------------
# 9. mart_ny_county_summary
#    County-level economic aggregation.
# --------------------------------------------------------------------------

cat("  Building mart_ny_county_summary...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_county_summary AS
WITH base AS (
    SELECT
        COALESCE(r_dim.county, 'Unknown')        AS county,
        SUM(t.gross_revenue)                     AS gross_revenue,
        SUM(t.net_contribution)                  AS net_contribution,
        COUNT(DISTINCT t.retailer_id)            AS retailer_count
    FROM v_unified_lottery_truth t
    LEFT JOIN ny_retailer_dim r_dim ON t.retailer_id = r_dim.retailer_id
    WHERE t.gross_revenue > 0
    GROUP BY COALESCE(r_dim.county, 'Unknown')
)
SELECT
    b.county,
    b.gross_revenue,
    b.net_contribution,
    b.retailer_count,
    b.gross_revenue / NULLIF(b.retailer_count, 0) AS avg_sales_per_retailer,
    RANK() OVER (ORDER BY b.gross_revenue DESC) AS rank_sales,
    RANK() OVER (ORDER BY b.net_contribution DESC) AS rank_contribution,
    d.population,
    d.land_area,
    d.median_income,
    r.region,
    r.lmr_district,
    r.rep_count,
    b.gross_revenue / NULLIF(d.population, 0) AS sales_per_capita,
    b.net_contribution / NULLIF(d.population, 0) AS net_contribution_per_capita,
    b.retailer_count / NULLIF(d.land_area, 0) AS retailers_per_sq_mile,
    d.population / NULLIF(b.retailer_count, 0) AS residents_per_retailer
FROM base b
LEFT JOIN v_ny_county_demographics_latest d ON b.county = d.county
LEFT JOIN ny_county_regions_dim r ON b.county = r.county
ORDER BY b.gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_county_summary")
cat("    counties:", n$n, "\n")


# --------------------------------------------------------------------------
# 10. mart_ny_city_summary
#     City-level economic aggregation.
# --------------------------------------------------------------------------

cat("  Building mart_ny_city_summary...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_city_summary AS
SELECT
    COALESCE(r_dim.city, 'Unknown')          AS city,
    COALESCE(r_dim.county, 'Unknown')        AS county,
    SUM(t.gross_revenue)                     AS gross_revenue,
    SUM(t.net_contribution)                  AS net_contribution,
    COUNT(DISTINCT t.retailer_id)            AS retailer_count,
    SUM(t.gross_revenue) /
        NULLIF(COUNT(DISTINCT t.retailer_id), 0) AS avg_sales_per_retailer
FROM v_unified_lottery_truth t
LEFT JOIN ny_retailer_dim r_dim ON t.retailer_id = r_dim.retailer_id
WHERE t.gross_revenue > 0
GROUP BY COALESCE(r_dim.city, 'Unknown'), COALESCE(r_dim.county, 'Unknown')
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_city_summary")
cat("    cities:", n$n, "\n")


# --------------------------------------------------------------------------
# 11. mart_ny_geo_density
#     City-level retailer density and revenue density.
#     Used for: Geographic Analytics density overlays.
# --------------------------------------------------------------------------

cat("  Building mart_ny_geo_density...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_ny_geo_density AS
SELECT
    COALESCE(c.city, 'Unknown')                      AS city,
    COALESCE(c.county, 'Unknown')                    AS county,
    c.gross_revenue,
    c.net_contribution,
    c.retailer_count,
    c.avg_sales_per_retailer,
    -- Density proxy: revenue per retailer relative to state average
    c.avg_sales_per_retailer /
        NULLIF(state_avg.avg_sales_per_retailer, 0)  AS sales_density_index,
    -- Concentration: city share of county revenue
    c.gross_revenue /
        NULLIF(county_totals.county_revenue, 0)      AS county_share
FROM mart_ny_city_summary c
CROSS JOIN (
    SELECT AVG(avg_sales_per_retailer) AS avg_sales_per_retailer
    FROM mart_ny_city_summary
    WHERE city != 'Unknown'
) state_avg
LEFT JOIN (
    SELECT county, SUM(gross_revenue) AS county_revenue
    FROM mart_ny_city_summary
    GROUP BY county
) county_totals
    ON c.county = county_totals.county
WHERE c.city != 'Unknown'
ORDER BY c.gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_geo_density")
cat("    density rows:", n$n, "\n")


# ==========================================================================
# VALIDATION SUMMARY
# ==========================================================================

cat("\n\n========================================\n")
cat("  MART BUILD COMPLETE\n")
cat("========================================\n\n")

tables <- c(
    "mart_ny_exec_timeseries_daily",
    "mart_ny_exec_game_mix",
    "mart_ny_exec_kpis",
    "mart_ny_exec_waterfall",
    "mart_ny_retailer_performance",
    "mart_ny_retailer_business_type",
    "mart_ny_retailer_map",
    "mart_ny_game_performance",
    "mart_ny_game_timeseries",
    "mart_ny_category_summary",
    "mart_ny_game_penetration",
    "mart_ny_county_summary",
    "mart_ny_city_summary",
    "mart_ny_geo_density"
)

for (tbl_name in tables) {
    n <- tryCatch(
        dbGetQuery(con, paste0("SELECT COUNT(*) AS n FROM ", tbl_name))$n,
        error = function(e) "ERROR"
    )
    cat(sprintf("  %-40s  %s rows\n", tbl_name, format(n, big.mark = ",")))
}

cat("\nData range:\n")
print(dbGetQuery(con, "
  SELECT MIN(date) AS from_date, MAX(date) AS to_date
  FROM mart_ny_exec_timeseries_daily
"))

cat("\nMarts are ready for the SaaS Dashboard.\n")
