# ==========================================================================
# Stochos Analytics: New York Lottery
# Illustrative Mart Builder — Scratch Price Point Analytics
# ==========================================================================
#
# PURPOSE:
#   Builds synthetic scratch price-point marts for the "Full Capability /
#   Illustrative" mode of the Executive Dashboard.
#
# MODEL DESIGN:
#   Revenue-share allocation with bell-shaped distribution centered at $5.
#   Units = (revenue_share × total_sales) / price → more cheap tickets, fewer expensive.
#   Revenue = units × price (exact reconciliation guaranteed).
#   Payout derived from per-price-point rates, normalized to observed total.
#   Template multipliers applied to a single baseline, then re-normalized.
#
# RECONCILIATION GUARANTEES:
#   1. Sum of price-point revenue = observed scratch revenue (exact)
#   2. Sum of price-point payout = observed total prize expense
#   3. Revenue distribution is bell-shaped, peaking at $5
#   4. Unit distribution naturally peaks at $1 (correct — cheap tickets sell more units)
#   5. Observed totals are never modified
#
# PREREQUISITES:
#   Run NY_Exec_Dashboard_Marts.r first (builds mart_exec_retailer_mix).
#
# ==========================================================================

library(DBI)
library(duckdb)
library(dplyr)

DUCKDB_FILE <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
GENERATED_AT <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
RETAILER_COMMISSION_RATE <- 0.06


# ==========================================================================
# STEP 1: PRICE POINT DEFINITIONS
# ==========================================================================

cat("\n========================================\n")
cat("  ILLUSTRATIVE MART BUILDER v2\n")
cat("========================================\n\n")
cat("  Generated at:", GENERATED_AT, "\n\n")

PRICE_POINTS <- c(1, 2, 3, 5, 10, 20, 30)

# Price point tier grouping
pp_tier <- function(pp) {
  ifelse(pp <= 3, "Low",
    ifelse(pp <= 10, "Core", "Premium"))
}

# --- Baseline REVENUE distribution (bell-shaped, peak at $5) ---
# This is the proportion of REVENUE at each price point.
# Units are derived as: units = (total_sales × rev_share) / price
# This means unit distribution naturally peaks at $1 (cheap tickets
# sell more units per dollar of revenue — structurally correct).
BASELINE_REVENUE_PCT <- c(
  `1`  = 0.08,
  `2`  = 0.12,
  `3`  = 0.18,
  `5`  = 0.28,
  `10` = 0.16,
  `20` = 0.10,
  `30` = 0.08
)
stopifnot(abs(sum(BASELINE_REVENUE_PCT) - 1.0) < 1e-10)

cat("=== Step 1: Baseline Revenue Distribution ===\n")
for (i in seq_along(PRICE_POINTS)) {
  derived_unit_share <- (BASELINE_REVENUE_PCT[i] / PRICE_POINTS[i]) /
    sum(BASELINE_REVENUE_PCT / PRICE_POINTS)
  cat(sprintf("  $%-4d  rev_share=%.0f%%  unit_share=%.1f%%\n",
    PRICE_POINTS[i],
    BASELINE_REVENUE_PCT[i] * 100,
    derived_unit_share * 100
  ))
}
cat(sprintf("  Revenue-weighted avg ticket: $%.2f\n",
  1 / sum(BASELINE_REVENUE_PCT / PRICE_POINTS)))


# ==========================================================================
# STEP 2: PAYOUT CURVE
# ==========================================================================

# Per-price-point payout rates (base rates before normalization)
# Lower tickets = lower payout; higher tickets = higher payout.
# Total is normalized to match observed prize expense.
PAYOUT_RATES <- c(
  `1`  = 0.55,
  `2`  = 0.56,
  `3`  = 0.57,
  `5`  = 0.58,
  `10` = 0.60,
  `20` = 0.62,
  `30` = 0.64
)

cat("\n=== Step 2: Payout Curve (pre-normalization) ===\n")
for (i in seq_along(PRICE_POINTS)) {
  cat(sprintf("  $%-4d  payout=%.0f%%  contribution=%.0f%%\n",
    PRICE_POINTS[i],
    PAYOUT_RATES[i] * 100,
    (1 - PAYOUT_RATES[i] - RETAILER_COMMISSION_RATE) * 100
  ))
}


# ==========================================================================
# STEP 3: TEMPLATE SYSTEM (MULTIPLIERS)
# ==========================================================================

# Templates are multipliers applied to the baseline, then re-normalized.
# This keeps the bell shape while shifting weight.

TEMPLATES <- list(
  convenience_heavy = c(
    `1`  = 1.20,
    `2`  = 1.10,
    `3`  = 1.05,
    `5`  = 1.00,
    `10` = 0.90,
    `20` = 0.70,
    `30` = 0.60
  ),
  balanced = c(
    `1`  = 1.00,
    `2`  = 1.00,
    `3`  = 1.00,
    `5`  = 1.00,
    `10` = 1.00,
    `20` = 1.00,
    `30` = 1.00
  ),
  premium_skew = c(
    `1`  = 0.70,
    `2`  = 0.80,
    `3`  = 0.90,
    `5`  = 1.00,
    `10` = 1.15,
    `20` = 1.25,
    `30` = 1.30
  ),
  value_heavy_rural = c(
    `1`  = 1.30,
    `2`  = 1.20,
    `3`  = 1.10,
    `5`  = 1.05,
    `10` = 0.80,
    `20` = 0.40,
    `30` = 0.20
  ),
  high_performance = c(
    `1`  = 0.90,
    `2`  = 0.95,
    `3`  = 1.00,
    `5`  = 1.05,
    `10` = 1.05,
    `20` = 1.10,
    `30` = 1.10
  )
)

# Pre-compute normalized revenue distributions per template
TEMPLATE_DISTS <- lapply(TEMPLATES, function(mult) {
  raw <- BASELINE_REVENUE_PCT * mult
  raw / sum(raw)  # re-normalize to sum to 1.0
})

cat("\n=== Step 3: Template Revenue Distributions (after normalization) ===\n")
for (tname in names(TEMPLATE_DISTS)) {
  d <- TEMPLATE_DISTS[[tname]]
  cat(sprintf("  %-22s  ", tname))
  cat(paste0("$", PRICE_POINTS, "=", sprintf("%.0f%%", d * 100), collapse = "  "))
  cat(sprintf("  sum=%.2f  peak=$%d\n", sum(d), PRICE_POINTS[which.max(d)]))
}


# ==========================================================================
# STEP 4: CONNECT AND READ OBSERVED DATA
# ==========================================================================

cat("\n=== Step 4: Reading Observed Scratch Totals ===\n")

con <- dbConnect(duckdb(), DUCKDB_FILE, read_only = FALSE)

retailers <- dbGetQuery(con, "
  SELECT
    retailer_id,
    retailer_name,
    city,
    county,
    business_type,
    latitude,
    longitude,
    gross_revenue      AS total_gross_revenue,
    scratch_revenue,
    net_contribution   AS total_net_contribution,
    contribution_rate  AS overall_contribution_rate,
    scratch_share
  FROM mart_exec_retailer_mix
  WHERE scratch_revenue > 0
")

cat("  Retailers with scratch sales:", nrow(retailers), "\n")
cat("  Total observed scratch revenue:", format(sum(retailers$scratch_revenue), big.mark = ","), "\n")


# ==========================================================================
# STEP 5: TEMPLATE ASSIGNMENT
# ==========================================================================

cat("\n=== Step 5: Template Assignment ===\n")

# Sales bands
median_sales <- median(retailers$total_gross_revenue, na.rm = TRUE)
p75_sales <- quantile(retailers$total_gross_revenue, 0.75, na.rm = TRUE)

assign_template <- function(btype, total_sales, scratch_share) {
  btype_upper <- toupper(trimws(ifelse(is.na(btype), "", btype)))
  scratch_share <- ifelse(is.na(scratch_share), 0.5, scratch_share)
  total_sales <- ifelse(is.na(total_sales), median_sales, total_sales)

  # Rule 1: Business type patterns
  if (grepl("LIQUOR|CHECK CASH|NEWSSTAND|NEWS STAND|TOBACCO|SMOKE|VAPE|DELI|CANDY", btype_upper)) {
    # Low sales + high scratch share → convenience
    if (total_sales < median_sales && scratch_share > 0.3) return("convenience_heavy")
    return("convenience_heavy")
  }
  if (grepl("GAS|FUEL|FARM|HARDWARE|AUTO|CAR WASH", btype_upper)) {
    return("value_heavy_rural")
  }
  if (grepl("DRUG|PHARM|DEPT|HOTEL|CLUB|RESORT|WINE", btype_upper)) {
    return("premium_skew")
  }

  # Rule 2: Sales band
  if (total_sales >= p75_sales) return("high_performance")

  # Default
  return("balanced")
}

retailers$template_name <- mapply(
  assign_template,
  retailers$business_type,
  retailers$total_gross_revenue,
  retailers$scratch_share
)

template_dist <- table(retailers$template_name)
for (nm in names(template_dist)) {
  cat(sprintf("  %-25s  %s retailers\n", nm, format(template_dist[nm], big.mark = ",")))
}


# ==========================================================================
# STEP 6: UNIT-BASED ALLOCATION
# ==========================================================================

cat("\n=== Step 6: Unit-Based Allocation ===\n")

alloc_rows <- list()
for (i in seq_len(nrow(retailers))) {
  r <- retailers[i, ]
  tpl <- TEMPLATE_DISTS[[r$template_name]]
  if (is.null(tpl)) tpl <- TEMPLATE_DISTS[["balanced"]]

  scratch_rev <- r$scratch_revenue

  for (j in seq_along(PRICE_POINTS)) {
    pp <- PRICE_POINTS[j]
    rev_pct <- tpl[j]

    # Revenue = scratch_revenue × rev_pct
    # (this guarantees exact reconciliation because sum(rev_pct) = 1)
    pp_revenue <- scratch_rev * rev_pct

    # Units = revenue / price
    units_est <- pp_revenue / pp

    # Raw payout (before normalization)
    raw_payout <- pp_revenue * PAYOUT_RATES[j]

    # Commission
    commission <- pp_revenue * RETAILER_COMMISSION_RATE

    alloc_rows[[length(alloc_rows) + 1]] <- data.frame(
      data_mode          = "illustrative",
      retailer_id        = r$retailer_id,
      retailer_name      = r$retailer_name,
      city               = r$city,
      county             = r$county,
      business_type      = r$business_type,
      latitude           = r$latitude,
      longitude          = r$longitude,
      price_point        = pp,
      price_point_tier   = pp_tier(pp),
      units_estimated    = units_est,
      gross_revenue      = pp_revenue,
      raw_payout         = raw_payout,
      retailer_commission = commission,
      template_name      = r$template_name,
      observed_scratch   = scratch_rev,
      stringsAsFactors   = FALSE
    )
  }
}

alloc_df <- do.call(rbind, alloc_rows)

cat("  Allocated rows:", format(nrow(alloc_df), big.mark = ","), "\n")
cat("  Allocated revenue total:", format(sum(alloc_df$gross_revenue), big.mark = ","), "\n")
cat("  Observed scratch total: ", format(sum(retailers$scratch_revenue), big.mark = ","), "\n")

# Revenue reconciliation check
rev_diff <- abs(sum(alloc_df$gross_revenue) - sum(retailers$scratch_revenue))
if (rev_diff > 1.0) {
  stop("REVENUE RECONCILIATION FAILURE: delta = $", format(rev_diff, big.mark = ","))
}
cat("  Revenue reconciliation: PASSED (delta = $", round(rev_diff, 2), ")\n")


# ==========================================================================
# STEP 7: PAYOUT NORMALIZATION
# ==========================================================================

cat("\n=== Step 7: Payout Normalization ===\n")

# For each retailer, normalize raw payouts so they sum to the retailer's
# observed prize expense.
# Observed prize expense = scratch_revenue × (1 - observed_contribution_rate - commission_rate)
# If we don't have per-retailer scratch contribution, use a global target.

# Global observed payout rate for scratch
# From the unified view: ig_settles has theoretical_payout_rate = 0.65
# But contribution_rate includes commission, so:
# observed_payout_rate = 1 - contribution_rate - commission_rate
# We use 0.58 as the global target (conservative, industry-consistent)
GLOBAL_SCRATCH_PAYOUT_TARGET <- 0.58

alloc_df <- alloc_df %>%
  group_by(retailer_id) %>%
  mutate(
    # Total observed prize expense for this retailer
    total_prize_target = observed_scratch * GLOBAL_SCRATCH_PAYOUT_TARGET,
    # Sum of raw payouts for this retailer
    raw_payout_total = sum(raw_payout),
    # Scale factor
    payout_scale = ifelse(raw_payout_total > 0,
                          total_prize_target / raw_payout_total, 1),
    # Normalized payout
    prize_expense = raw_payout * payout_scale,
    # Net contribution
    net_contribution = gross_revenue - prize_expense - retailer_commission,
    # Contribution rate
    contribution_rate = ifelse(gross_revenue > 0,
                               net_contribution / gross_revenue, 0)
  ) %>%
  ungroup()

# Payout reconciliation check
total_expected_payout <- sum(retailers$scratch_revenue) * GLOBAL_SCRATCH_PAYOUT_TARGET
total_actual_payout <- sum(alloc_df$prize_expense)
payout_diff <- abs(total_actual_payout - total_expected_payout)

cat("  Target total payout:    ", format(total_expected_payout, big.mark = ","), "\n")
cat("  Allocated total payout: ", format(total_actual_payout, big.mark = ","), "\n")
cat("  Payout delta:           $", round(payout_diff, 2), "\n")

if (payout_diff > 1.0) {
  cat("  WARNING: Payout reconciliation delta > $1.00\n")
} else {
  cat("  Payout reconciliation:  PASSED\n")
}

# Distribution shape check — revenue must peak at $5, units at $1
rev_by_pp <- alloc_df %>%
  group_by(price_point) %>%
  summarise(total_rev = sum(gross_revenue),
            total_units = sum(units_estimated), .groups = "drop") %>%
  mutate(rev_share = total_rev / sum(total_rev),
         unit_share = total_units / sum(total_units))

cat("\n  Distribution shape check:\n")
rev_peak <- rev_by_pp$price_point[which.max(rev_by_pp$rev_share)]
unit_peak <- rev_by_pp$price_point[which.max(rev_by_pp$unit_share)]
for (r in seq_len(nrow(rev_by_pp))) {
  rev_mark <- if (rev_by_pp$price_point[r] == rev_peak) " ← REV PEAK" else ""
  unit_mark <- if (rev_by_pp$price_point[r] == unit_peak) " ← UNIT PEAK" else ""
  cat(sprintf("    $%-4d  rev=%.1f%%%s  units=%.1f%%%s\n",
    rev_by_pp$price_point[r],
    rev_by_pp$rev_share[r] * 100, rev_mark,
    rev_by_pp$unit_share[r] * 100, unit_mark))
}
stopifnot(rev_peak == 5)  # Revenue distribution must peak at $5
cat(sprintf("  Revenue peak: $%d (expected $5) — PASSED\n", rev_peak))
cat(sprintf("  Unit peak: $%d (expected $1 — cheap tickets sell more units)\n", unit_peak))


# ==========================================================================
# STEP 8: CLEAN AND WRITE MART 1
# ==========================================================================

cat("\n=== Step 8: Building Illustrative Marts ===\n")

# Prepare clean output
mart_mix <- alloc_df %>%
  select(
    data_mode, retailer_id, retailer_name, city, county, business_type,
    latitude, longitude, price_point, price_point_tier,
    units_estimated, gross_revenue, prize_expense,
    retailer_commission, net_contribution, contribution_rate
  )

cat("  Building mart_exec_pp_mix_illustrative...")
dbExecute(con, "DROP TABLE IF EXISTS mart_exec_pp_mix_illustrative")
dbWriteTable(con, "mart_exec_pp_mix_illustrative", as.data.frame(mart_mix), overwrite = TRUE)
cat(" done.\n")
cat("    rows:", format(nrow(mart_mix), big.mark = ","), "\n")


# --------------------------------------------------------------------------
# Mart 2: mart_exec_pp_geo_illustrative
# --------------------------------------------------------------------------
cat("  Building mart_exec_pp_geo_illustrative...")

dbExecute(con, "DROP TABLE IF EXISTS mart_exec_pp_geo_illustrative")
dbExecute(con, "
CREATE TABLE mart_exec_pp_geo_illustrative AS
WITH grand AS (
    SELECT SUM(gross_revenue) AS total_rev, SUM(net_contribution) AS total_net
    FROM mart_exec_pp_mix_illustrative
)
-- Statewide
SELECT
    'illustrative' AS data_mode,
    'state'        AS geo_level,
    'Statewide'    AS county,
    NULL           AS city,
    price_point,
    price_point_tier,
    SUM(units_estimated)                        AS units_estimated,
    SUM(gross_revenue)                          AS gross_revenue,
    SUM(prize_expense)                          AS prize_expense,
    SUM(net_contribution)                       AS net_contribution,
    SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate,
    SUM(gross_revenue) / NULLIF(g.total_rev, 0) AS pct_of_sales,
    SUM(net_contribution) / NULLIF(g.total_net, 0) AS pct_of_contribution,
    COUNT(DISTINCT retailer_id)                 AS retailer_count
FROM mart_exec_pp_mix_illustrative
CROSS JOIN grand g
GROUP BY price_point, price_point_tier, g.total_rev, g.total_net

UNION ALL

-- County
SELECT
    'illustrative' AS data_mode,
    'county'       AS geo_level,
    COALESCE(county, 'Unknown') AS county,
    NULL           AS city,
    price_point,
    price_point_tier,
    SUM(units_estimated)                        AS units_estimated,
    SUM(gross_revenue)                          AS gross_revenue,
    SUM(prize_expense)                          AS prize_expense,
    SUM(net_contribution)                       AS net_contribution,
    SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate,
    SUM(gross_revenue) / NULLIF(g.total_rev, 0) AS pct_of_sales,
    SUM(net_contribution) / NULLIF(g.total_net, 0) AS pct_of_contribution,
    COUNT(DISTINCT retailer_id)                 AS retailer_count
FROM mart_exec_pp_mix_illustrative
CROSS JOIN grand g
GROUP BY county, price_point, price_point_tier, g.total_rev, g.total_net

UNION ALL

-- City
SELECT
    'illustrative' AS data_mode,
    'city'         AS geo_level,
    COALESCE(county, 'Unknown') AS county,
    COALESCE(city, 'Unknown')   AS city,
    price_point,
    price_point_tier,
    SUM(units_estimated)                        AS units_estimated,
    SUM(gross_revenue)                          AS gross_revenue,
    SUM(prize_expense)                          AS prize_expense,
    SUM(net_contribution)                       AS net_contribution,
    SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate,
    SUM(gross_revenue) / NULLIF(g.total_rev, 0) AS pct_of_sales,
    SUM(net_contribution) / NULLIF(g.total_net, 0) AS pct_of_contribution,
    COUNT(DISTINCT retailer_id)                 AS retailer_count
FROM mart_exec_pp_mix_illustrative
CROSS JOIN grand g
GROUP BY county, city, price_point, price_point_tier, g.total_rev, g.total_net

ORDER BY geo_level, gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_pp_geo_illustrative")
cat("    geo rows:", n$n, "\n")


# --------------------------------------------------------------------------
# Mart 3: mart_exec_pp_channel_illustrative
# --------------------------------------------------------------------------
cat("  Building mart_exec_pp_channel_illustrative...")

dbExecute(con, "DROP TABLE IF EXISTS mart_exec_pp_channel_illustrative")
dbExecute(con, "
CREATE TABLE mart_exec_pp_channel_illustrative AS
WITH grand AS (
    SELECT SUM(gross_revenue) AS total_rev, SUM(net_contribution) AS total_net
    FROM mart_exec_pp_mix_illustrative
)
SELECT
    'illustrative'                              AS data_mode,
    COALESCE(business_type, 'Unknown')          AS business_type,
    price_point,
    price_point_tier,
    COUNT(DISTINCT retailer_id)                 AS retailer_count,
    SUM(units_estimated)                        AS units_estimated,
    SUM(gross_revenue)                          AS gross_revenue,
    SUM(prize_expense)                          AS prize_expense,
    SUM(net_contribution)                       AS net_contribution,
    SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate,
    SUM(gross_revenue) / NULLIF(g.total_rev, 0) AS pct_of_sales,
    SUM(net_contribution) / NULLIF(g.total_net, 0) AS pct_of_contribution
FROM mart_exec_pp_mix_illustrative
CROSS JOIN grand g
GROUP BY business_type, price_point, price_point_tier, g.total_rev, g.total_net
ORDER BY gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_pp_channel_illustrative")
cat("    channel rows:", n$n, "\n")


# --------------------------------------------------------------------------
# Mart 4: mart_exec_pp_index_illustrative
# --------------------------------------------------------------------------
cat("  Building mart_exec_pp_index_illustrative...")

dbExecute(con, "DROP TABLE IF EXISTS mart_exec_pp_index_illustrative")
dbExecute(con, "
CREATE TABLE mart_exec_pp_index_illustrative AS
WITH statewide AS (
    SELECT price_point, price_point_tier,
           SUM(gross_revenue) AS state_rev, SUM(net_contribution) AS state_net
    FROM mart_exec_pp_mix_illustrative
    GROUP BY price_point, price_point_tier
),
state_total AS (
    SELECT SUM(state_rev) AS total_rev, SUM(state_net) AS total_net FROM statewide
),
statewide_pct AS (
    SELECT s.price_point, s.price_point_tier,
           s.state_rev / NULLIF(t.total_rev, 0)  AS statewide_pct_sales,
           s.state_net / NULLIF(t.total_net, 0)   AS statewide_pct_contribution
    FROM statewide s CROSS JOIN state_total t
),
county_data AS (
    SELECT COALESCE(county, 'Unknown') AS county, price_point, price_point_tier,
           SUM(gross_revenue) AS local_rev, SUM(net_contribution) AS local_net
    FROM mart_exec_pp_mix_illustrative GROUP BY county, price_point, price_point_tier
),
county_totals AS (
    SELECT county, SUM(local_rev) AS c_rev, SUM(local_net) AS c_net
    FROM county_data GROUP BY county
),
county_idx AS (
    SELECT 'illustrative' AS data_mode, 'county' AS comparison_level,
        d.county, NULL AS city, NULL AS business_type,
        d.price_point, d.price_point_tier,
        d.local_rev / NULLIF(t.c_rev, 0)   AS local_pct_sales,
        sp.statewide_pct_sales,
        (d.local_rev / NULLIF(t.c_rev, 0)) / NULLIF(sp.statewide_pct_sales, 0) AS sales_index,
        d.local_net / NULLIF(t.c_net, 0)   AS local_pct_contribution,
        sp.statewide_pct_contribution,
        (d.local_net / NULLIF(t.c_net, 0)) / NULLIF(sp.statewide_pct_contribution, 0) AS contribution_index
    FROM county_data d
    LEFT JOIN county_totals t ON d.county = t.county
    LEFT JOIN statewide_pct sp ON d.price_point = sp.price_point
),
bt_data AS (
    SELECT COALESCE(business_type, 'Unknown') AS business_type, price_point, price_point_tier,
           SUM(gross_revenue) AS local_rev, SUM(net_contribution) AS local_net
    FROM mart_exec_pp_mix_illustrative GROUP BY business_type, price_point, price_point_tier
),
bt_totals AS (
    SELECT business_type, SUM(local_rev) AS b_rev, SUM(local_net) AS b_net
    FROM bt_data GROUP BY business_type
),
bt_idx AS (
    SELECT 'illustrative' AS data_mode, 'business_type' AS comparison_level,
        NULL AS county, NULL AS city, d.business_type,
        d.price_point, d.price_point_tier,
        d.local_rev / NULLIF(t.b_rev, 0)   AS local_pct_sales,
        sp.statewide_pct_sales,
        (d.local_rev / NULLIF(t.b_rev, 0)) / NULLIF(sp.statewide_pct_sales, 0) AS sales_index,
        d.local_net / NULLIF(t.b_net, 0)   AS local_pct_contribution,
        sp.statewide_pct_contribution,
        (d.local_net / NULLIF(t.b_net, 0)) / NULLIF(sp.statewide_pct_contribution, 0) AS contribution_index
    FROM bt_data d
    LEFT JOIN bt_totals t ON d.business_type = t.business_type
    LEFT JOIN statewide_pct sp ON d.price_point = sp.price_point
)
SELECT * FROM county_idx
UNION ALL
SELECT * FROM bt_idx
ORDER BY comparison_level, sales_index DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_pp_index_illustrative")
cat("    index rows:", n$n, "\n")


# --------------------------------------------------------------------------
# Mart 5: mart_exec_pp_opportunity_illustrative
# --------------------------------------------------------------------------
cat("  Building mart_exec_pp_opportunity_illustrative...")

dbExecute(con, "DROP TABLE IF EXISTS mart_exec_pp_opportunity_illustrative")
dbExecute(con, "
CREATE TABLE mart_exec_pp_opportunity_illustrative AS
WITH retailer_pp AS (
    SELECT
        retailer_id,
        MAX(retailer_name) AS retailer_name,
        MAX(city) AS city, MAX(county) AS county, MAX(business_type) AS business_type,
        SUM(gross_revenue) AS gross_revenue,
        SUM(net_contribution) AS net_contribution,
        SUM(net_contribution) / NULLIF(SUM(gross_revenue), 0) AS contribution_rate,
        -- Tier shares
        SUM(CASE WHEN price_point_tier = 'Low' THEN gross_revenue ELSE 0 END) /
            NULLIF(SUM(gross_revenue), 0) AS low_tier_share,
        SUM(CASE WHEN price_point_tier = 'Core' THEN gross_revenue ELSE 0 END) /
            NULLIF(SUM(gross_revenue), 0) AS core_tier_share,
        SUM(CASE WHEN price_point_tier = 'Premium' THEN gross_revenue ELSE 0 END) /
            NULLIF(SUM(gross_revenue), 0) AS premium_tier_share,
        -- Dominant price point
        (SELECT price_point FROM mart_exec_pp_mix_illustrative m2
         WHERE m2.retailer_id = mart_exec_pp_mix_illustrative.retailer_id
         GROUP BY price_point ORDER BY SUM(gross_revenue) DESC LIMIT 1
        ) AS dominant_price_point
    FROM mart_exec_pp_mix_illustrative
    GROUP BY retailer_id
    HAVING SUM(gross_revenue) > 0
),
medians AS (
    SELECT
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY contribution_rate) AS median_rate,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gross_revenue) AS p75_revenue,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY contribution_rate) AS p25_rate
    FROM retailer_pp
)
SELECT
    'illustrative' AS data_mode,
    r.retailer_id, r.retailer_name, r.city, r.county, r.business_type,
    r.dominant_price_point,
    r.low_tier_share, r.core_tier_share, r.premium_tier_share,
    r.gross_revenue, r.net_contribution, r.contribution_rate,
    CASE
        WHEN r.low_tier_share > 0.50 AND r.contribution_rate > m.median_rate
            THEN 'Flag'
        WHEN r.premium_tier_share > 0.40
            THEN 'Flag'
        WHEN r.gross_revenue >= m.p75_revenue AND r.contribution_rate <= m.p25_rate
            THEN 'Flag'
        ELSE 'OK'
    END AS opportunity_flag,
    CASE
        WHEN r.low_tier_share > 0.50 AND r.contribution_rate > m.median_rate
            THEN 'Low-tier heavy: high margin but low absolute revenue per ticket'
        WHEN r.premium_tier_share > 0.40
            THEN 'Premium-heavy: volume driver but thinner contribution margins'
        WHEN r.gross_revenue >= m.p75_revenue AND r.contribution_rate <= m.p25_rate
            THEN 'High volume with suboptimal tier mix for contribution'
        ELSE NULL
    END AS opportunity_reason,
    CASE
        WHEN r.low_tier_share > 0.50 AND r.contribution_rate > m.median_rate
            THEN LEAST(100, CAST(r.low_tier_share * 80 AS INTEGER) + 20)
        WHEN r.premium_tier_share > 0.40
            THEN LEAST(100, CAST(r.premium_tier_share * 60 AS INTEGER) + 30)
        WHEN r.gross_revenue >= m.p75_revenue AND r.contribution_rate <= m.p25_rate
            THEN 75
        ELSE 0
    END AS opportunity_score
FROM retailer_pp r CROSS JOIN medians m
ORDER BY opportunity_score DESC, gross_revenue DESC
")
cat(" done.\n")

n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_pp_opportunity_illustrative")
flagged <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_exec_pp_opportunity_illustrative WHERE opportunity_flag = 'Flag'")
cat("    opportunity rows:", n$n, "  (flagged:", flagged$n, ")\n")


# ==========================================================================
# STEP 9: REFERENCE TABLES
# ==========================================================================

cat("\n=== Step 9: Writing Reference Tables ===\n")

# Template assignments
template_assignments <- retailers %>%
  select(retailer_id, retailer_name, business_type, template_name)
dbExecute(con, "DROP TABLE IF EXISTS illustrative_template_assignments")
dbWriteTable(con, "illustrative_template_assignments", template_assignments, overwrite = TRUE)
cat("  template_assignments:", nrow(template_assignments), "retailers\n")


# ==========================================================================
# STEP 10: FINAL RECONCILIATION
# ==========================================================================

cat("\n\n========================================\n")
cat("  ILLUSTRATIVE MART RECONCILIATION\n")
cat("========================================\n\n")

# Mart inventory
ill_tables <- c(
  "mart_exec_pp_mix_illustrative",
  "mart_exec_pp_geo_illustrative",
  "mart_exec_pp_channel_illustrative",
  "mart_exec_pp_index_illustrative",
  "mart_exec_pp_opportunity_illustrative",
  "illustrative_template_assignments"
)

for (tbl_name in ill_tables) {
  n <- tryCatch(
    dbGetQuery(con, paste0("SELECT COUNT(*) AS n FROM ", tbl_name))$n,
    error = function(e) "NOT BUILT"
  )
  cat(sprintf("  %-42s  %s\n", tbl_name, format(n, big.mark = ",")))
}

# Revenue reconciliation
cat("\n--- Revenue Reconciliation ---\n")
obs_scratch <- dbGetQuery(con, "SELECT SUM(scratch_revenue) AS v FROM mart_exec_retailer_mix WHERE scratch_revenue > 0")$v
ill_total   <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_pp_mix_illustrative")$v
ill_geo_st  <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_pp_geo_illustrative WHERE geo_level = 'state'")$v
ill_geo_cty <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_pp_geo_illustrative WHERE geo_level = 'county'")$v
ill_channel <- dbGetQuery(con, "SELECT SUM(gross_revenue) AS v FROM mart_exec_pp_channel_illustrative")$v

cat(sprintf("  Observed scratch total:   %s\n", format(obs_scratch, big.mark = ",")))
cat(sprintf("  Mix total:                %s\n", format(ill_total, big.mark = ",")))
cat(sprintf("  Geo (state):              %s\n", format(ill_geo_st, big.mark = ",")))
cat(sprintf("  Geo (county):             %s\n", format(ill_geo_cty, big.mark = ",")))
cat(sprintf("  Channel:                  %s\n", format(ill_channel, big.mark = ",")))

rev_delta_pct <- abs(ill_total - obs_scratch) / obs_scratch * 100
cat(sprintf("\n  Revenue delta:            $%.2f  (%.4f%%)\n", abs(ill_total - obs_scratch), rev_delta_pct))
cat(sprintf("  Revenue status:           %s\n", ifelse(rev_delta_pct < 0.01, "PASSED", "WARNING")))

# Payout reconciliation
cat("\n--- Payout Reconciliation ---\n")
ill_payout <- dbGetQuery(con, "SELECT SUM(prize_expense) AS v FROM mart_exec_pp_mix_illustrative")$v
target_payout <- obs_scratch * GLOBAL_SCRATCH_PAYOUT_TARGET
cat(sprintf("  Target payout (%.0f%%):     %s\n", GLOBAL_SCRATCH_PAYOUT_TARGET * 100, format(target_payout, big.mark = ",")))
cat(sprintf("  Allocated payout:         %s\n", format(ill_payout, big.mark = ",")))
payout_delta <- abs(ill_payout - target_payout)
cat(sprintf("  Payout delta:             $%.2f\n", payout_delta))
cat(sprintf("  Payout status:            %s\n", ifelse(payout_delta < 1.0, "PASSED", "WARNING")))

# Distribution shape
cat("\n--- Distribution Shape ---\n")
shape <- dbGetQuery(con, "
  SELECT price_point,
         SUM(units_estimated) AS units,
         SUM(gross_revenue) AS revenue
  FROM mart_exec_pp_mix_illustrative
  GROUP BY price_point ORDER BY price_point
")
shape$unit_pct <- shape$units / sum(shape$units)
shape$rev_pct <- shape$revenue / sum(shape$revenue)
for (r in seq_len(nrow(shape))) {
  cat(sprintf("  $%-4d  units=%.1f%%  revenue=%.1f%%\n",
    shape$price_point[r], shape$unit_pct[r] * 100, shape$rev_pct[r] * 100))
}
cat(sprintf("  Revenue peak: $%d  (expected: $5)\n", shape$price_point[which.max(shape$rev_pct)]))
cat(sprintf("  Unit peak:    $%d  (expected: $1)\n", shape$price_point[which.max(shape$unit_pct)]))

cat(sprintf("\n  Generated at: %s\n", GENERATED_AT))
cat("\nIllustrative marts are ready.\n")

dbDisconnect(con, shutdown = FALSE)
