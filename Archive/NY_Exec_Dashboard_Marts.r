# ==========================================================================
# Stochos Analytics: New York Lottery
# Executive Dashboard — Mart Builder
# ==========================================================================
#
# Purpose:
#   Build all mart tables for the NY Executive Dashboard.
#   Separate from the SaaS dashboard marts.
#
# Product Group Classification (Draw / Scratch):
#   Draw:    standard_category IN ('pick_3','pick_4','lotto_jackpot','monitor')
#   Scratch: standard_category IN ('scratch_off','instant_win')
#   Other:   standard_category IN ('unknown')
#   Excluded: metric_class IN ('payout') OR is_revenue = FALSE
#
#   Instant-win variants (Numbers IW, Win4 IW, etc.) are classified as
#   Scratch because they share scratch-off economics (65% payout rate).
#   Add-on games (Megaplier, Power Play, etc.) follow their parent's
#   product group based on standard_category.
#
# Source: v_unified_lottery_truth (read-only from existing warehouse)
#
# ==========================================================================

library(DBI)
library(duckdb)

# --- Configuration --------------------------------------------------------

duckdb_file <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"

con <- dbConnect(duckdb(), duckdb_file)
on.exit(dbDisconnect(con, shutdown = FALSE), add = TRUE)

cat("Connected to DuckDB:", duckdb_file, "\n")
cat("Building Executive Dashboard marts...\n\n")


# --- Product group classification SQL fragment ---
# Reusable across all mart queries
PG_CASE <- "
  CASE
    WHEN standard_category IN ('scratch_off','instant_win') THEN 'Scratch'
    WHEN standard_category IN ('pick_3','pick_4','lotto_jackpot','monitor') THEN 'Draw'
    ELSE 'Other'
  END
"


# ==========================================================================
# SPRINT 1: EXECUTIVE OVERVIEW
# ==========================================================================

cat("=== Sprint 1: Executive Overview ===\n")

# --------------------------------------------------------------------------
# 1. mart_exec_overview_daily
# --------------------------------------------------------------------------
cat("  Building mart_exec_overview_daily...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_exec_overview_daily AS
SELECT
    sales_date                             AS date,
    SUM(gross_revenue)                     AS gross_revenue,
    SUM(estimated_payout)                  AS estimated_payout,
    SUM(retailer_commission)               AS retailer_commission,
    SUM(net_contribution)                  AS net_contribution,
    COUNT(DISTINCT retailer_id)            AS active_retailers,
    COUNT(DISTINCT game_code)              AS active_games,
    SUM(gross_revenue) /
        NULLIF(COUNT(DISTINCT retailer_id), 0) AS avg_sales_per_retailer,
    -- Draw vs Scratch daily
    SUM(CASE WHEN standard_category IN ('pick_3','pick_4','lotto_jackpot','monitor')
             THEN gross_revenue ELSE 0 END) AS draw_revenue,
    SUM(CASE WHEN standard_category IN ('scratch_off','instant_win')
             THEN gross_revenue ELSE 0 END) AS scratch_revenue
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY sales_date
ORDER BY sales_date
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_overview_daily")
cat("    rows:", n$n, "\n")


# --------------------------------------------------------------------------
# 2. mart_exec_mix_summary
# --------------------------------------------------------------------------
cat("  Building mart_exec_mix_summary...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_mix_summary AS
WITH grouped AS (
    SELECT
        ", PG_CASE, " AS product_group,
        SUM(gross_revenue)     AS gross_revenue,
        SUM(net_contribution)  AS net_contribution
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY 1
)
SELECT
    product_group,
    gross_revenue,
    net_contribution,
    gross_revenue / NULLIF(SUM(gross_revenue) OVER (), 0)     AS pct_sales,
    net_contribution / NULLIF(SUM(net_contribution) OVER (), 0) AS pct_contribution,
    net_contribution / NULLIF(gross_revenue, 0)                AS contribution_rate
FROM grouped
ORDER BY gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_mix_summary")
cat("    product groups:", n$n, "\n")


# --------------------------------------------------------------------------
# 3. mart_exec_alerts
# --------------------------------------------------------------------------
cat("  Building mart_exec_alerts...")
  dbExecute(con, "
CREATE OR REPLACE TABLE mart_exec_alerts AS
SELECT * FROM (
  WITH recent AS (
      SELECT
          SUM(gross_revenue)     AS gross_revenue,
          SUM(net_contribution)  AS net_contribution,
          SUM(draw_revenue)      AS draw_revenue,
          SUM(scratch_revenue)   AS scratch_revenue,
          COUNT(DISTINCT date)   AS days,
          SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate
      FROM mart_exec_overview_daily
      WHERE date >= (SELECT MAX(date) - INTERVAL '30 days' FROM mart_exec_overview_daily)
  ),
  prior AS (
      SELECT
          SUM(gross_revenue)     AS gross_revenue,
          SUM(net_contribution)  AS net_contribution,
          SUM(draw_revenue)      AS draw_revenue,
          SUM(scratch_revenue)   AS scratch_revenue,
          COUNT(DISTINCT date)   AS days,
          SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate
      FROM mart_exec_overview_daily
      WHERE date >= (SELECT MAX(date) - INTERVAL '60 days' FROM mart_exec_overview_daily)
        AND date <  (SELECT MAX(date) - INTERVAL '30 days' FROM mart_exec_overview_daily)
  )
  SELECT
      'revenue_change' AS alert_type,
      'Gross Revenue (30d vs prior 30d)' AS alert_label,
      r.gross_revenue AS alert_value,
      p.gross_revenue AS comparison_value,
      r.gross_revenue - p.gross_revenue AS variance_abs,
      (r.gross_revenue - p.gross_revenue) / NULLIF(p.gross_revenue, 0) AS variance_pct,
      CASE WHEN ABS((r.gross_revenue - p.gross_revenue) / NULLIF(p.gross_revenue, 0)) > 0.10
           THEN 'high' WHEN ABS((r.gross_revenue - p.gross_revenue) / NULLIF(p.gross_revenue, 0)) > 0.05
           THEN 'medium' ELSE 'low' END AS severity,
      (SELECT MAX(date) FROM mart_exec_overview_daily) AS alert_date
  FROM recent r, prior p
  UNION ALL
  SELECT
      'contribution_change',
      'Net Contribution (30d vs prior 30d)',
      r.net_contribution, p.net_contribution,
      r.net_contribution - p.net_contribution,
      (r.net_contribution - p.net_contribution) / NULLIF(p.net_contribution, 0),
      CASE WHEN ABS((r.net_contribution - p.net_contribution) / NULLIF(p.net_contribution, 0)) > 0.10
           THEN 'high' WHEN ABS((r.net_contribution - p.net_contribution) / NULLIF(p.net_contribution, 0)) > 0.05
           THEN 'medium' ELSE 'low' END,
      (SELECT MAX(date) FROM mart_exec_overview_daily)
  FROM recent r, prior p
  UNION ALL
  SELECT
      'rate_change',
      'Contribution Rate (30d vs prior 30d)',
      r.contribution_rate, p.contribution_rate,
      r.contribution_rate - p.contribution_rate,
      (r.contribution_rate - p.contribution_rate) / NULLIF(p.contribution_rate, 0),
      CASE WHEN ABS(r.contribution_rate - p.contribution_rate) > 0.02
           THEN 'high' WHEN ABS(r.contribution_rate - p.contribution_rate) > 0.01
           THEN 'medium' ELSE 'low' END,
      (SELECT MAX(date) FROM mart_exec_overview_daily)
  FROM recent r, prior p
  UNION ALL
  SELECT
      'mix_shift',
      'Draw Share of Sales (30d vs prior 30d)',
      r.draw_revenue / NULLIF(r.draw_revenue + r.scratch_revenue, 0),
      p.draw_revenue / NULLIF(p.draw_revenue + p.scratch_revenue, 0),
      r.draw_revenue / NULLIF(r.draw_revenue + r.scratch_revenue, 0)
        - p.draw_revenue / NULLIF(p.draw_revenue + p.scratch_revenue, 0),
      NULL,
      CASE WHEN ABS(
        r.draw_revenue / NULLIF(r.draw_revenue + r.scratch_revenue, 0)
        - p.draw_revenue / NULLIF(p.draw_revenue + p.scratch_revenue, 0)
      ) > 0.03 THEN 'high'
      WHEN ABS(
        r.draw_revenue / NULLIF(r.draw_revenue + r.scratch_revenue, 0)
        - p.draw_revenue / NULLIF(p.draw_revenue + p.scratch_revenue, 0)
      ) > 0.01 THEN 'medium' ELSE 'low' END,
      (SELECT MAX(date) FROM mart_exec_overview_daily)
  FROM recent r, prior p
) alerts_raw
ORDER BY CASE severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_alerts")
cat("    alerts:", n$n, "\n")


# ==========================================================================
# SPRINT 2: RETAILER MIX & PROFITABILITY (CENTERPIECE)
# ==========================================================================

cat("\n=== Sprint 2: Retailer Mix & Profitability ===\n")

# --------------------------------------------------------------------------
# 4. mart_exec_retailer_mix
# --------------------------------------------------------------------------
cat("  Building mart_exec_retailer_mix...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_retailer_mix AS
SELECT
    retailer_id,
    MAX(retailer_name)                          AS retailer_name,
    MAX(city)                                   AS city,
    MAX(county)                                 AS county,
    MAX(business_type)                          AS business_type,
    MAX(quick_draw)                             AS quick_draw_flag,
    MAX(latitude)                               AS latitude,
    MAX(longitude)                              AS longitude,
    SUM(gross_revenue)                          AS gross_revenue,
    SUM(net_contribution)                       AS net_contribution,
    SUM(estimated_payout)                       AS estimated_payout,
    SUM(retailer_commission)                    AS retailer_commission,
    -- Draw / Scratch split
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END)     AS draw_revenue,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END)     AS scratch_revenue,
    -- Shares
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)           AS draw_share,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)           AS scratch_share,
    -- Economics
    SUM(net_contribution) /
        NULLIF(SUM(gross_revenue), 0)           AS contribution_rate,
    COUNT(DISTINCT sales_date)                  AS active_days,
    SUM(gross_revenue) /
        NULLIF(COUNT(DISTINCT sales_date), 0)   AS avg_daily_sales,
    COUNT(DISTINCT game_code)                   AS distinct_products
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY retailer_id
ORDER BY gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_retailer_mix")
cat("    retailers:", n$n, "\n")


# --------------------------------------------------------------------------
# 5. mart_exec_retailer_quadrants
# --------------------------------------------------------------------------
cat("  Building mart_exec_retailer_quadrants...")
dbExecute(con, "
CREATE OR REPLACE TABLE mart_exec_retailer_quadrants AS
WITH medians AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY draw_share) AS median_draw_share,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY contribution_rate) AS median_contribution_rate,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gross_revenue) AS p75_revenue,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY gross_revenue) AS p25_revenue
    FROM mart_exec_retailer_mix
    WHERE gross_revenue > 0
)
SELECT
    r.retailer_id,
    r.retailer_name,
    r.city,
    r.county,
    r.business_type,
    r.draw_share,
    r.scratch_share,
    r.contribution_rate,
    r.gross_revenue,
    r.net_contribution,
    r.avg_daily_sales,
    CASE
        WHEN r.gross_revenue >= m.p75_revenue THEN 'Large'
        WHEN r.gross_revenue >= m.p25_revenue THEN 'Medium'
        ELSE 'Small'
    END AS sales_band,
    CASE
        WHEN r.draw_share >= m.median_draw_share AND r.contribution_rate >= m.median_contribution_rate
            THEN 'High Draw / High Contribution'
        WHEN r.draw_share >= m.median_draw_share AND r.contribution_rate < m.median_contribution_rate
            THEN 'High Draw / Low Contribution'
        WHEN r.draw_share < m.median_draw_share AND r.contribution_rate >= m.median_contribution_rate
            THEN 'High Scratch / High Contribution'
        ELSE 'High Scratch / Low Contribution'
    END AS quadrant_label,
    m.median_draw_share,
    m.median_contribution_rate
FROM mart_exec_retailer_mix r
CROSS JOIN medians m
WHERE r.gross_revenue > 0
ORDER BY r.gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_retailer_quadrants")
cat("    retailers with quadrants:", n$n, "\n")


# --------------------------------------------------------------------------
# 6. mart_exec_channel_mix
# --------------------------------------------------------------------------
cat("  Building mart_exec_channel_mix...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_channel_mix AS
SELECT
    COALESCE(business_type, 'Unknown')           AS business_type,
    COUNT(DISTINCT retailer_id)                  AS retailer_count,
    SUM(gross_revenue)                           AS gross_revenue,
    SUM(net_contribution)                        AS net_contribution,
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END)      AS draw_revenue,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END)      AS scratch_revenue,
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)            AS draw_share,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)            AS scratch_share,
    SUM(gross_revenue) /
        NULLIF(COUNT(DISTINCT retailer_id), 0)   AS avg_sales_per_retailer,
    SUM(net_contribution) /
        NULLIF(SUM(gross_revenue), 0)            AS contribution_rate
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY 1
ORDER BY gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_channel_mix")
cat("    channels:", n$n, "\n")


# ==========================================================================
# SPRINT 3: PRODUCT & PORTFOLIO MIX
# ==========================================================================

cat("\n=== Sprint 3: Product & Portfolio Mix ===\n")

# --------------------------------------------------------------------------
# 7. mart_exec_product_mix
# --------------------------------------------------------------------------
cat("  Building mart_exec_product_mix...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_product_mix AS
WITH product_totals AS (
    SELECT
        ", PG_CASE, "                               AS product_group,
        COALESCE(game_family, 'Unknown')            AS game_family,
        SUM(gross_revenue)                          AS gross_revenue,
        SUM(net_contribution)                       AS net_contribution,
        COUNT(DISTINCT retailer_id)                 AS retailer_count
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY 1, 2
)
SELECT
    product_group,
    game_family,
    gross_revenue,
    net_contribution,
    retailer_count,
    gross_revenue / NULLIF(SUM(gross_revenue) OVER (), 0)     AS pct_sales,
    net_contribution / NULLIF(SUM(net_contribution) OVER (), 0) AS pct_contribution,
    net_contribution / NULLIF(gross_revenue, 0)                AS contribution_rate
FROM product_totals
ORDER BY gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_product_mix")
cat("    product families:", n$n, "\n")


# --------------------------------------------------------------------------
# 8. mart_exec_product_lifecycle
# --------------------------------------------------------------------------
cat("  Building mart_exec_product_lifecycle...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_product_lifecycle AS
WITH game_stats AS (
    SELECT
        game_code,
        MAX(game_name)                              AS game_name,
        MAX(game_family)                            AS game_family,
        ", PG_CASE, "                               AS product_group,
        MIN(sales_date)                             AS first_observed,
        MAX(sales_date)                             AS last_observed,
        SUM(gross_revenue)                          AS gross_revenue,
        SUM(net_contribution)                       AS net_contribution,
        COUNT(DISTINCT sales_date)                  AS active_days
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY game_code, standard_category
),
recent_trend AS (
    SELECT
        game_code,
        SUM(CASE WHEN sales_date >= (SELECT MAX(sales_date) - INTERVAL '90 days' FROM v_unified_lottery_truth)
                 THEN gross_revenue ELSE 0 END)     AS recent_90d,
        SUM(CASE WHEN sales_date >= (SELECT MAX(sales_date) - INTERVAL '180 days' FROM v_unified_lottery_truth)
                  AND sales_date < (SELECT MAX(sales_date) - INTERVAL '90 days' FROM v_unified_lottery_truth)
                 THEN gross_revenue ELSE 0 END)     AS prior_90d
    FROM v_unified_lottery_truth
    WHERE gross_revenue > 0
    GROUP BY game_code
)
SELECT
    g.game_code,
    g.game_name,
    g.game_family,
    g.product_group,
    g.first_observed,
    g.last_observed,
    CASE
        WHEN g.last_observed >= (SELECT MAX(sales_date) - INTERVAL '30 days' FROM v_unified_lottery_truth)
            THEN 'Active'
        WHEN g.last_observed >= (SELECT MAX(sales_date) - INTERVAL '90 days' FROM v_unified_lottery_truth)
            THEN 'Declining'
        ELSE 'Dormant'
    END                                             AS lifecycle_status,
    g.gross_revenue,
    g.net_contribution,
    g.active_days,
    g.net_contribution / NULLIF(g.gross_revenue, 0) AS contribution_rate,
    CASE
        WHEN t.prior_90d > 0 AND t.recent_90d > t.prior_90d * 1.05 THEN 'Growing'
        WHEN t.prior_90d > 0 AND t.recent_90d < t.prior_90d * 0.95 THEN 'Declining'
        ELSE 'Stable'
    END                                             AS trend_direction
FROM game_stats g
LEFT JOIN recent_trend t ON g.game_code = t.game_code
ORDER BY g.gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_product_lifecycle")
cat("    products:", n$n, "\n")


# --------------------------------------------------------------------------
# 9. mart_exec_product_timeseries
# --------------------------------------------------------------------------
cat("  Building mart_exec_product_timeseries...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_product_timeseries AS
SELECT
    DATE_TRUNC('month', sales_date)::DATE         AS month,
    ", PG_CASE, "                                 AS product_group,
    SUM(gross_revenue)                            AS gross_revenue,
    SUM(net_contribution)                         AS net_contribution,
    SUM(net_contribution) /
        NULLIF(SUM(gross_revenue), 0)             AS contribution_rate
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY 1, 2
ORDER BY 1, 2
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_product_timeseries")
cat("    month-product rows:", n$n, "\n")


# ==========================================================================
# SPRINT 4: GEOGRAPHY & NETWORK
# ==========================================================================

cat("\n=== Sprint 4: Geography & Network ===\n")

# --------------------------------------------------------------------------
# 10. mart_exec_geo_contribution
# --------------------------------------------------------------------------
cat("  Building mart_exec_geo_contribution...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_geo_contribution AS
-- County level
SELECT
    'county'                                       AS geo_level,
    COALESCE(county, 'Unknown')                    AS county,
    NULL                                           AS city,
    SUM(gross_revenue)                             AS gross_revenue,
    SUM(net_contribution)                          AS net_contribution,
    COUNT(DISTINCT retailer_id)                    AS retailer_count,
    SUM(gross_revenue) /
        NULLIF(COUNT(DISTINCT retailer_id), 0)     AS avg_sales_per_retailer,
    SUM(net_contribution) /
        NULLIF(SUM(gross_revenue), 0)              AS contribution_rate,
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS draw_share,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS scratch_share
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY county

UNION ALL

-- City level
SELECT
    'city'                                         AS geo_level,
    COALESCE(county, 'Unknown')                    AS county,
    COALESCE(city, 'Unknown')                      AS city,
    SUM(gross_revenue)                             AS gross_revenue,
    SUM(net_contribution)                          AS net_contribution,
    COUNT(DISTINCT retailer_id)                    AS retailer_count,
    SUM(gross_revenue) /
        NULLIF(COUNT(DISTINCT retailer_id), 0)     AS avg_sales_per_retailer,
    SUM(net_contribution) /
        NULLIF(SUM(gross_revenue), 0)              AS contribution_rate,
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS draw_share,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS scratch_share
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY county, city

ORDER BY geo_level, gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_geo_contribution")
cat("    geo rows:", n$n, "\n")


# --------------------------------------------------------------------------
# 11. mart_exec_geo_channel_mix
# --------------------------------------------------------------------------
cat("  Building mart_exec_geo_channel_mix...")
dbExecute(con, paste0("
CREATE OR REPLACE TABLE mart_exec_geo_channel_mix AS
SELECT
    COALESCE(county, 'Unknown')                    AS county,
    COALESCE(business_type, 'Unknown')             AS business_type,
    COUNT(DISTINCT retailer_id)                    AS retailer_count,
    SUM(gross_revenue)                             AS gross_revenue,
    SUM(net_contribution)                          AS net_contribution,
    SUM(CASE WHEN ", PG_CASE, " = 'Draw'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS draw_share,
    SUM(CASE WHEN ", PG_CASE, " = 'Scratch'
             THEN gross_revenue ELSE 0 END) /
        NULLIF(SUM(gross_revenue), 0)              AS scratch_share
FROM v_unified_lottery_truth
WHERE gross_revenue > 0
GROUP BY county, business_type
ORDER BY gross_revenue DESC
"))
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_geo_channel_mix")
cat("    geo-channel rows:", n$n, "\n")


# ==========================================================================
# SPRINT 5: FORECAST
# ==========================================================================

cat("\n=== Sprint 5: Forecast ===\n")

# Build monthly actuals first
cat("  Building monthly actuals...")
monthly_df <- dbGetQuery(con, "
    SELECT
        DATE_TRUNC('month', date)::DATE AS month,
        SUM(gross_revenue)              AS gross_revenue,
        SUM(net_contribution)           AS net_contribution,
        SUM(draw_revenue)               AS draw_revenue,
        SUM(scratch_revenue)            AS scratch_revenue
    FROM mart_exec_overview_daily
    GROUP BY 1
    ORDER BY 1
")
cat(" done. (", nrow(monthly_df), " months)\n")

# --- Forecast function ---
run_forecast <- function(values, h = 24, metric_name = "metric",
                         model_version = "HW_v1") {
  n <- length(values)

  # Need at least 24 months for seasonal HW; fallback to simple trend
  if (n >= 24) {
    ts_data <- ts(values, frequency = 12)
    fit <- tryCatch(
      HoltWinters(ts_data, seasonal = "additive"),
      error = function(e) NULL
    )
  } else {
    fit <- NULL
  }

  if (!is.null(fit)) {
    # Manual forecast from HoltWinters
    pred <- predict(fit, n.ahead = h, prediction.interval = TRUE, level = 0.80)
    fc_values <- as.numeric(pred[, "fit"])
    fc_lower  <- as.numeric(pred[, "lwr"])
    fc_upper  <- as.numeric(pred[, "upr"])
  } else {
    # Fallback: linear trend
    x <- seq_len(n)
    lm_fit <- lm(values ~ x)
    future_x <- (n + 1):(n + h)
    fc_values <- predict(lm_fit, newdata = data.frame(x = future_x))
    residual_se <- summary(lm_fit)$sigma
    fc_lower <- fc_values - 1.28 * residual_se
    fc_upper <- fc_values + 1.28 * residual_se
  }

  # Floor at zero
  fc_values <- pmax(fc_values, 0)
  fc_lower  <- pmax(fc_lower, 0)
  fc_upper  <- pmax(fc_upper, 0)

  # Build forecast months
  last_month <- as.Date(paste0(format(max(monthly_df$month), "%Y-%m"), "-01"))
  forecast_months <- seq.Date(last_month, by = "month", length.out = h + 1)[-1]

  data.frame(
    forecast_month = forecast_months,
    metric_name    = metric_name,
    actual_value   = NA_real_,
    forecast_value = fc_values,
    lower_bound    = fc_lower,
    upper_bound    = fc_upper,
    model_version  = model_version,
    generated_at   = Sys.time(),
    stringsAsFactors = FALSE
  )
}

# Build actuals rows
actuals_rows <- data.frame(
  forecast_month = rep(monthly_df$month, 2),
  metric_name    = c(rep("gross_revenue", nrow(monthly_df)),
                     rep("net_contribution", nrow(monthly_df))),
  actual_value   = c(monthly_df$gross_revenue, monthly_df$net_contribution),
  forecast_value = NA_real_,
  lower_bound    = NA_real_,
  upper_bound    = NA_real_,
  model_version  = "actual",
  generated_at   = Sys.time(),
  stringsAsFactors = FALSE
)

# Generate forecasts
cat("  Running forecast models...\n")
fc_gross <- run_forecast(monthly_df$gross_revenue, h = 24,
                         metric_name = "gross_revenue")
fc_net   <- run_forecast(monthly_df$net_contribution, h = 24,
                         metric_name = "net_contribution")

forecast_rows <- rbind(actuals_rows, fc_gross, fc_net)

# Write to DuckDB
cat("  Writing mart_exec_forecast_monthly...")
dbExecute(con, "DROP TABLE IF EXISTS mart_exec_forecast_monthly")
dbWriteTable(con, "mart_exec_forecast_monthly", forecast_rows, overwrite = TRUE)
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_forecast_monthly")
cat("    forecast rows:", n$n, "\n")


# --------------------------------------------------------------------------
# 13. mart_exec_forecast_summary
# --------------------------------------------------------------------------
cat("  Building mart_exec_forecast_summary...")

# Compute summary for 3mo, 12mo, 24mo horizons
last_actual_month <- max(monthly_df$month)

summary_rows <- do.call(rbind, lapply(c(3, 12, 24), function(h) {
  horizon_label <- paste0(h, "mo")

  # End of forecast window: h months after last actual
  fc_end <- seq.Date(last_actual_month, by = "month", length.out = h + 1)[h + 1]

  # Start of prior comparison window: h months before last actual
  prior_start <- seq.Date(last_actual_month, by = paste0("-", h, " months"), length.out = 2)[2]

  do.call(rbind, lapply(c("gross_revenue", "net_contribution"), function(metric) {
    fc_subset <- forecast_rows[
      forecast_rows$metric_name == metric &
      !is.na(forecast_rows$forecast_value) &
      forecast_rows$forecast_month > last_actual_month &
      forecast_rows$forecast_month <= fc_end,
    ]
    actual_subset <- forecast_rows[
      forecast_rows$metric_name == metric &
      !is.na(forecast_rows$actual_value) &
      forecast_rows$forecast_month > prior_start &
      forecast_rows$forecast_month <= last_actual_month,
    ]
    prior_total <- sum(actual_subset$actual_value, na.rm = TRUE)

    data.frame(
      horizon             = horizon_label,
      metric_name         = metric,
      forecast_total      = sum(fc_subset$forecast_value, na.rm = TRUE),
      lower_bound         = sum(fc_subset$lower_bound, na.rm = TRUE),
      upper_bound         = sum(fc_subset$upper_bound, na.rm = TRUE),
      growth_vs_prior     = if (prior_total > 0) {
        (sum(fc_subset$forecast_value, na.rm = TRUE) - prior_total) / prior_total
      } else { NA_real_ },
      generated_at        = Sys.time(),
      stringsAsFactors    = FALSE
    )
  }))
}))

dbExecute(con, "DROP TABLE IF EXISTS mart_exec_forecast_summary")
dbWriteTable(con, "mart_exec_forecast_summary", summary_rows, overwrite = TRUE)
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_forecast_summary")
cat("    summary rows:", n$n, "\n")


# ==========================================================================
# VALIDATION SUMMARY
# ==========================================================================

cat("\n\n========================================\n")
cat("  EXECUTIVE DASHBOARD MARTS COMPLETE\n")
cat("========================================\n\n")

tables <- c(
  "mart_exec_overview_daily",
  "mart_exec_mix_summary",
  "mart_exec_alerts",
  "mart_exec_retailer_mix",
  "mart_exec_retailer_quadrants",
  "mart_exec_channel_mix",
  "mart_exec_product_mix",
  "mart_exec_product_lifecycle",
  "mart_exec_product_timeseries",
  "mart_exec_geo_contribution",
  "mart_exec_geo_channel_mix",
  "mart_exec_forecast_monthly",
  "mart_exec_forecast_summary"
)

for (tbl_name in tables) {
  n <- tryCatch(
    dbGetQuery(con, paste0("SELECT COUNT(*) AS n FROM ", tbl_name))$n,
    error = function(e) "NOT BUILT"
  )
  cat(sprintf("  %-40s  %s\n", tbl_name, format(n, big.mark = ",")))
}

# Cross-tab reconciliation check
cat("\n--- Reconciliation ---\n")
exec_total <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_overview_daily")$v
mix_total  <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_mix_summary")$v
rtl_total  <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_retailer_mix")$v
geo_total  <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_geo_contribution WHERE geo_level = 'county'")$v

cat(sprintf("  Exec overview total:  %s\n", format(exec_total, big.mark = ",")))
cat(sprintf("  Mix summary total:    %s\n", format(mix_total, big.mark = ",")))
cat(sprintf("  Retailer total:       %s\n", format(rtl_total, big.mark = ",")))
cat(sprintf("  Geo (county) total:   %s\n", format(geo_total, big.mark = ",")))

cat("\nExecutive Dashboard marts are ready.\n")
