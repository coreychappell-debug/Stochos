# ==========================================================================
# Stochos Analytics: New York Lottery
# Phase 2 Dashboard Mart Builder
# ==========================================================================
#
# Purpose:
#   Build mart tables for Phase 2 dashboard tabs:
#     Tab 5: Winning Numbers Center
#     Tab 6: Scratch-Off Intelligence
#     Tab 7: Education Funding
#
# Data strategy:
#   Phase 2 datasets are NOT in the warehouse yet.
#   This script reads raw CSVs directly via DuckDB read_csv_auto()
#   and builds staging + mart tables in one pass.
#
# Prerequisites:
#   Raw CSV files at:
#     /srv/stochos/data/raw/new_york/nylottery_data/{dataset_id}/data.csv
#
# ==========================================================================

library(DBI)
library(duckdb)

# --- Configuration --------------------------------------------------------

duckdb_file <- "/srv/stochos/data/duckdb/stochos_lottery.duckdb"
raw_root    <- "/srv/stochos/data/raw/new_york/nylottery_data"

# Connect in read-write mode for table creation
con <- dbConnect(duckdb(), duckdb_file)
on.exit(dbDisconnect(con, shutdown = FALSE), add = TRUE)

cat("Connected to DuckDB:", duckdb_file, "\n")
cat("Raw data root:", raw_root, "\n")
cat("Building Phase 2 dashboard marts...\n\n")


# ==========================================================================
# HELPER: safe CSV loader
# ==========================================================================

load_csv <- function(con, dataset_id, table_name) {
  csv_path <- file.path(raw_root, dataset_id, "data.csv")
  if (!file.exists(csv_path)) {
    warning("CSV not found: ", csv_path, " — skipping ", table_name)
    return(FALSE)
  }
  dbExecute(con, paste0(
    "CREATE OR REPLACE TABLE ", table_name,
    " AS SELECT * FROM read_csv_auto('", csv_path, "', header=true)"
  ))
  n <- dbGetQuery(con, paste0("SELECT COUNT(*) AS n FROM ", table_name))$n
  cat("    ", table_name, ":", format(n, big.mark = ","), "rows\n")
  return(TRUE)
}


# ==========================================================================
# SECTION 1: EDUCATION FUNDING (Tab 7 — simplest, build first)
# ==========================================================================

cat("=== Tab 7: Education Funding ===\n")
cat("  Loading raw CSV...\n")

edu_ok <- load_csv(con,
  "9ypc-vjiq_lottery-aid-to-education-beginning-2002",
  "stg_aid_to_education"
)

if (edu_ok) {

  # --- mart_ny_edu_summary: statewide by fiscal year ---
  cat("  Building mart_ny_edu_summary...")
  dbExecute(con, '
  CREATE OR REPLACE TABLE mart_ny_edu_summary AS
  SELECT
      "Beginning Fiscal Year"                      AS fiscal_year_start,
      "Ending Fiscal Year"                         AS fiscal_year_end,
      SUM("Amount of Aid")                         AS total_aid,
      COUNT(DISTINCT "County")                     AS county_count,
      COUNT(DISTINCT "School District")            AS district_count,
      SUM("Amount of Aid") /
          NULLIF(COUNT(DISTINCT "School District"), 0) AS avg_aid_per_district
  FROM stg_aid_to_education
  GROUP BY "Beginning Fiscal Year", "Ending Fiscal Year"
  ORDER BY "Beginning Fiscal Year"
  ')
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_edu_summary")
  cat("    fiscal years:", n$n, "\n")

  # --- mart_ny_edu_county_trend: county × fiscal year ---
  cat("  Building mart_ny_edu_county_trend...")
  dbExecute(con, '
  CREATE OR REPLACE TABLE mart_ny_edu_county_trend AS
  SELECT
      "Beginning Fiscal Year"                      AS fiscal_year_start,
      "Ending Fiscal Year"                         AS fiscal_year_end,
      "County"                                     AS county,
      SUM("Amount of Aid")                         AS total_aid,
      COUNT(DISTINCT "School District")            AS district_count
  FROM stg_aid_to_education
  GROUP BY "Beginning Fiscal Year", "Ending Fiscal Year", "County"
  ORDER BY "Beginning Fiscal Year", total_aid DESC
  ')
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_edu_county_trend")
  cat("    county-year rows:", n$n, "\n")

  # --- mart_ny_edu_district_detail: full district detail ---
  cat("  Building mart_ny_edu_district_detail...")
  dbExecute(con, '
  CREATE OR REPLACE TABLE mart_ny_edu_district_detail AS
  SELECT
      "Beginning Fiscal Year"                      AS fiscal_year_start,
      "Ending Fiscal Year"                         AS fiscal_year_end,
      "County"                                     AS county,
      "School District"                            AS school_district,
      "Amount of Aid"                              AS amount_of_aid
  FROM stg_aid_to_education
  ORDER BY "Beginning Fiscal Year", "County", "School District"
  ')
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_edu_district_detail")
  cat("    district rows:", n$n, "\n")

} else {
  cat("  SKIPPED: Education data not available\n")
}


# ==========================================================================
# SECTION 2: SCRATCH-OFF INTELLIGENCE (Tab 6)
# ==========================================================================

cat("\n=== Tab 6: Scratch-Off Intelligence ===\n")
cat("  Loading raw CSV...\n")

scratch_ok <- load_csv(con,
  "nzqa-7unk_scratch-off-game-daily-prize-status-report",
  "stg_scratch_off_prizes"
)

if (scratch_ok) {

  # --- mart_ny_scratch_prize_detail: prize tier per game ---
  cat("  Building mart_ny_scratch_prize_detail...")
  dbExecute(con, "
  CREATE OR REPLACE TABLE mart_ny_scratch_prize_detail AS
  SELECT
      \"Game Number\"                                AS game_number,
      \"Game Name\"                                  AS game_name,
      REPLACE(REPLACE(\"Prize Amount\", '$', ''), ',', '') AS prize_amount_raw,
      TRY_CAST(
        REPLACE(REPLACE(\"Prize Amount\", '$', ''), ',', '')
        AS DOUBLE
      )                                            AS prize_amount,
      \"Paid\"                                       AS paid,
      \"Unpaid\"                                     AS unpaid,
      \"Total\"                                      AS total,
      CASE WHEN \"Total\" > 0
           THEN CAST(\"Paid\" AS DOUBLE) / \"Total\"
           ELSE 0 END                              AS pct_claimed
  FROM stg_scratch_off_prizes
  ORDER BY game_number, prize_amount DESC
  ")
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_scratch_prize_detail")
  cat("    prize tier rows:", n$n, "\n")

  # --- mart_ny_scratch_game_summary: game-level summary ---
  cat("  Building mart_ny_scratch_game_summary...")
  dbExecute(con, "
  CREATE OR REPLACE TABLE mart_ny_scratch_game_summary AS
  WITH game_agg AS (
      SELECT
          game_number,
          game_name,
          SUM(total)                               AS total_prizes,
          SUM(paid)                                AS total_paid,
          SUM(unpaid)                              AS total_unpaid,
          MAX(prize_amount)                        AS top_prize_amount,
          COUNT(DISTINCT prize_amount_raw)         AS prize_tier_count
      FROM mart_ny_scratch_prize_detail
      GROUP BY game_number, game_name
  ),
  top_remaining AS (
      SELECT
          game_number,
          MAX(CASE WHEN unpaid > 0 THEN prize_amount ELSE 0 END) AS top_prize_remaining
      FROM mart_ny_scratch_prize_detail
      GROUP BY game_number
  )
  SELECT
      g.game_number,
      g.game_name,
      g.total_prizes,
      g.total_paid,
      g.total_unpaid,
      CASE WHEN g.total_prizes > 0
           THEN CAST(g.total_paid AS DOUBLE) / g.total_prizes
           ELSE 0 END                             AS pct_claimed,
      g.top_prize_amount,
      COALESCE(t.top_prize_remaining, 0)          AS top_prize_remaining,
      g.prize_tier_count
  FROM game_agg g
  LEFT JOIN top_remaining t ON g.game_number = t.game_number
  ORDER BY g.total_prizes DESC
  ")
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_scratch_game_summary")
  cat("    scratch games:", n$n, "\n")

  # --- mart_ny_scratch_opportunity: value-based ranking ---
  cat("  Building mart_ny_scratch_opportunity...")
  dbExecute(con, "
  CREATE OR REPLACE TABLE mart_ny_scratch_opportunity AS
  SELECT
      game_number,
      game_name,
      top_prize_remaining,
      total_unpaid,
      total_prizes,
      pct_claimed,
      -- Simple opportunity score: remaining prizes weighted by top prize
      CASE WHEN total_prizes > 0
           THEN (1.0 - pct_claimed) * LOG(GREATEST(top_prize_remaining, 1) + 1)
           ELSE 0 END                             AS opportunity_score
  FROM mart_ny_scratch_game_summary
  WHERE total_unpaid > 0
  ORDER BY opportunity_score DESC
  ")
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_scratch_opportunity")
  cat("    opportunity-ranked games:", n$n, "\n")

} else {
  cat("  SKIPPED: Scratch-off data not available\n")
}


# ==========================================================================
# SECTION 3: WINNING NUMBERS CENTER (Tab 5)
# ==========================================================================

cat("\n=== Tab 5: Winning Numbers Center ===\n")
cat("  Loading raw CSVs...\n")

# Load each game's winning numbers
mm_ok   <- load_csv(con, "5xaw-6ayf_lottery-mega-millions-winning-numbers-beginning-2002", "stg_winning_mega_millions")
pb_ok   <- load_csv(con, "d6yy-54nr_lottery-powerball-winning-numbers-beginning-2010",     "stg_winning_powerball")
lotto_ok <- load_csv(con, "6nbc-h7bj_lottery-ny-lotto-winning-numbers-beginning-2001",     "stg_winning_ny_lotto")
t5_ok   <- load_csv(con, "dg63-4siq_lottery-take-5-winning-numbers-beginning-1992",        "stg_winning_take5")
c4l_ok  <- load_csv(con, "kwxv-fwze_lottery-cash-4-life-winning-numbers-beginning-2014",   "stg_winning_cash4life")
m4l_ok  <- load_csv(con, "a4w9-a3tp_lottery-millionaire-for-life-winning-numbers-beginning-2026", "stg_winning_mill4life")
dn_ok   <- load_csv(con, "hsys-3def_lottery-daily-numbers-win-4-winning-numbers-beginning-1980", "stg_winning_daily_win4")
p10_ok  <- load_csv(con, "bycu-cw7c_lottery-pick-10-winning-numbers-beginning-1987",       "stg_winning_pick10")


# --------------------------------------------------------------------------
# 3a. mart_ny_recent_draws — unified recent draws across all games
# --------------------------------------------------------------------------

cat("  Building mart_ny_recent_draws...")

# Build UNION of all games into a normalized format
union_parts <- c()

if (mm_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Mega Millions' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Winning Numbers\" AS winning_numbers,
      CAST(\"Mega Ball\" AS VARCHAR) AS bonus_number,
      TRY_CAST(\"Multiplier\" AS VARCHAR) AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_mega_millions
    WHERE TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (pb_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Powerball' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Winning Numbers\" AS winning_numbers,
      NULL AS bonus_number,
      TRY_CAST(\"Multiplier\" AS VARCHAR) AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_powerball
    WHERE TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (lotto_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'NY Lotto' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Winning Numbers\" AS winning_numbers,
      TRY_CAST(\"Bonus #\" AS VARCHAR) AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_ny_lotto
    WHERE TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (t5_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Take 5 Evening' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Evening Winning Numbers\" AS winning_numbers,
      TRY_CAST(\"Evening Bonus #\" AS VARCHAR) AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_take5
    WHERE \"Evening Winning Numbers\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
  union_parts <- c(union_parts, "
    SELECT
      'Take 5 Midday' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Midday Winning Numbers\" AS winning_numbers,
      TRY_CAST(\"Midday Bonus #\" AS VARCHAR) AS bonus_number,
      NULL AS multiplier,
      'Midday' AS draw_session
    FROM stg_winning_take5
    WHERE \"Midday Winning Numbers\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (c4l_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Cash 4 Life' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Winning Numbers\" AS winning_numbers,
      CAST(\"Cash Ball\" AS VARCHAR) AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_cash4life
    WHERE TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (m4l_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Millionaire for Life' AS game_name,
      TRY_CAST(draw_date AS DATE) AS draw_date,
      winning_numbers AS winning_numbers,
      CAST(mill_ball AS VARCHAR) AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_mill4life
    WHERE TRY_CAST(draw_date AS DATE) IS NOT NULL
  ")
}

if (dn_ok) {
  # Daily Numbers and Win 4 have midday + evening draws
  union_parts <- c(union_parts, "
    SELECT
      'Numbers Midday' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Midday Daily #\" AS winning_numbers,
      NULL AS bonus_number,
      TRY_CAST(\"Midday Daily Booster\" AS VARCHAR) AS multiplier,
      'Midday' AS draw_session
    FROM stg_winning_daily_win4
    WHERE \"Midday Daily #\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
  union_parts <- c(union_parts, "
    SELECT
      'Numbers Evening' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Evening Daily #\" AS winning_numbers,
      NULL AS bonus_number,
      TRY_CAST(\"Evening Daily Booster\" AS VARCHAR) AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_daily_win4
    WHERE \"Evening Daily #\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
  union_parts <- c(union_parts, "
    SELECT
      'Win 4 Midday' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Midday Win 4 #\" AS winning_numbers,
      NULL AS bonus_number,
      NULL AS multiplier,
      'Midday' AS draw_session
    FROM stg_winning_daily_win4
    WHERE \"Midday Win 4 #\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
  union_parts <- c(union_parts, "
    SELECT
      'Win 4 Evening' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Evening Win 4 #\" AS winning_numbers,
      NULL AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_daily_win4
    WHERE \"Evening Win 4 #\" IS NOT NULL
      AND TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (p10_ok) {
  union_parts <- c(union_parts, "
    SELECT
      'Pick 10' AS game_name,
      TRY_CAST(\"Draw Date\" AS DATE) AS draw_date,
      \"Winning Numbers\" AS winning_numbers,
      NULL AS bonus_number,
      NULL AS multiplier,
      'Evening' AS draw_session
    FROM stg_winning_pick10
    WHERE TRY_CAST(\"Draw Date\" AS DATE) IS NOT NULL
  ")
}

if (length(union_parts) > 0) {
  full_union <- paste(union_parts, collapse = "\nUNION ALL\n")

  dbExecute(con, paste0("
    CREATE OR REPLACE TABLE mart_ny_all_draws AS
    SELECT *
    FROM (", full_union, ")
    WHERE winning_numbers IS NOT NULL
      AND TRIM(winning_numbers) != ''
    ORDER BY game_name, draw_date DESC
  "))

  # Recent draws: last 50 per game
  dbExecute(con, "
    CREATE OR REPLACE TABLE mart_ny_recent_draws AS
    WITH ranked AS (
        SELECT *,
            ROW_NUMBER() OVER (PARTITION BY game_name ORDER BY draw_date DESC) AS rn
        FROM mart_ny_all_draws
    )
    SELECT game_name, draw_date, winning_numbers, bonus_number, multiplier, draw_session
    FROM ranked
    WHERE rn <= 50
    ORDER BY game_name, draw_date DESC
  ")
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_recent_draws")
  cat("    recent draws:", n$n, "\n")


  # --------------------------------------------------------------------------
  # 3b. mart_ny_draw_summary — cadence and volume per game
  # --------------------------------------------------------------------------

  cat("  Building mart_ny_draw_summary...")
  dbExecute(con, "
    CREATE OR REPLACE TABLE mart_ny_draw_summary AS
    SELECT
        game_name,
        COUNT(*)                               AS total_draws,
        MIN(draw_date)                         AS first_draw,
        MAX(draw_date)                         AS last_draw,
        DATEDIFF('day', MIN(draw_date), MAX(draw_date)) AS span_days,
        COUNT(*) * 7.0 /
            NULLIF(DATEDIFF('day', MIN(draw_date), MAX(draw_date)), 0) AS draws_per_week
    FROM mart_ny_all_draws
    GROUP BY game_name
    ORDER BY total_draws DESC
  ")
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_draw_summary")
  cat("    game summaries:", n$n, "\n")


  # --------------------------------------------------------------------------
  # 3c. mart_ny_number_frequency — ball frequency per game
  #     Only for games with space-separated numbers (5+ digits)
  # --------------------------------------------------------------------------

  cat("  Building mart_ny_number_frequency...")
  # Use R for string splitting to avoid DuckDB ICU extension dependency
  draws_df <- dbGetQuery(con, "
    SELECT game_name, draw_date, winning_numbers
    FROM mart_ny_all_draws
    WHERE LENGTH(winning_numbers) > 4
  ")

  if (nrow(draws_df) > 0) {
    # Split winning numbers and explode to one row per ball
    exploded <- do.call(rbind, lapply(seq_len(nrow(draws_df)), function(i) {
      nums <- trimws(unlist(strsplit(draws_df$winning_numbers[i], " ")))
      nums <- nums[nums != ""]
      ball_nums <- suppressWarnings(as.integer(nums))
      ball_nums <- ball_nums[!is.na(ball_nums) & ball_nums > 0]
      if (length(ball_nums) == 0) return(NULL)
      data.frame(
        game_name   = draws_df$game_name[i],
        draw_date   = draws_df$draw_date[i],
        ball_number = ball_nums,
        stringsAsFactors = FALSE
      )
    }))

    if (!is.null(exploded) && nrow(exploded) > 0) {
      # Compute frequency stats per game + ball
      freq <- aggregate(
        draw_date ~ game_name + ball_number,
        data = exploded,
        FUN = function(x) c(
          frequency   = length(x),
          last_drawn  = as.character(max(x)),
          first_drawn = as.character(min(x))
        )
      )
      # Flatten the matrix column
      freq_df <- data.frame(
        game_name   = freq$game_name,
        ball_number = freq$ball_number,
        frequency   = as.integer(freq$draw_date[, "frequency"]),
        last_drawn  = as.Date(freq$draw_date[, "last_drawn"]),
        first_drawn = as.Date(freq$draw_date[, "first_drawn"]),
        stringsAsFactors = FALSE
      )

      # Compute draws per game for pct_of_draws
      game_draws <- aggregate(draw_date ~ game_name, data = draws_df, FUN = length)
      names(game_draws) <- c("game_name", "total_draws")

      freq_df <- merge(freq_df, game_draws, by = "game_name", all.x = TRUE)
      freq_df$pct_of_draws <- freq_df$frequency / freq_df$total_draws
      freq_df$days_since_last <- as.integer(Sys.Date() - freq_df$last_drawn)

      # Drop helper column and order
      freq_df$total_draws <- NULL
      freq_df <- freq_df[order(freq_df$game_name, -freq_df$frequency), ]

      # Write to DuckDB
      dbExecute(con, "DROP TABLE IF EXISTS mart_ny_number_frequency")
      dbWriteTable(con, "mart_ny_number_frequency", freq_df, overwrite = TRUE)
    } else {
      dbExecute(con, "CREATE OR REPLACE TABLE mart_ny_number_frequency (
        game_name VARCHAR, ball_number INTEGER, frequency INTEGER,
        last_drawn DATE, first_drawn DATE, pct_of_draws DOUBLE, days_since_last INTEGER
      )")
    }
  } else {
    dbExecute(con, "CREATE OR REPLACE TABLE mart_ny_number_frequency (
      game_name VARCHAR, ball_number INTEGER, frequency INTEGER,
      last_drawn DATE, first_drawn DATE, pct_of_draws DOUBLE, days_since_last INTEGER
    )")
  }
  cat(" done.\n")

  n <- dbGetQuery(con, "SELECT COUNT(*) AS n FROM mart_ny_number_frequency")
  cat("    frequency rows:", n$n, "\n")

} else {
  cat("  SKIPPED: No winning number CSVs found\n")
}


# ==========================================================================
# VALIDATION SUMMARY
# ==========================================================================

cat("\n\n========================================\n")
cat("  PHASE 2 MART BUILD COMPLETE\n")
cat("========================================\n\n")

tables <- c(
  # Education
  "mart_ny_edu_summary",
  "mart_ny_edu_county_trend",
  "mart_ny_edu_district_detail",
  # Scratch-off
  "mart_ny_scratch_prize_detail",
  "mart_ny_scratch_game_summary",
  "mart_ny_scratch_opportunity",
  # Winning numbers
  "mart_ny_all_draws",
  "mart_ny_recent_draws",
  "mart_ny_draw_summary",
  "mart_ny_number_frequency"
)

for (tbl_name in tables) {
  n <- tryCatch(
    dbGetQuery(con, paste0("SELECT COUNT(*) AS n FROM ", tbl_name))$n,
    error = function(e) "NOT BUILT"
  )
  cat(sprintf("  %-40s  %s\n", tbl_name, format(n, big.mark = ",")))
}

cat("\nPhase 2 marts are ready for the SaaS Dashboard.\n")
