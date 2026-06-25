# ==============================================================================
# MEGA MILLIONS PRODUCTION SALES & TICKET PREDICTOR (v1.0)
# Purpose: Dynamic sales and ticket-sales forecasting for upcoming draws
#          using M7 Constrained GAM + Reset Gate + Recency Momentum Modifier.
#
# Prerequisites: System DSN "ubiba" must be configured in ODBC.
# ==============================================================================

# ------------------------------------------------------------------------------
# SECTION 1: UPCOMING DRAW CONFIGURATION (EDIT THIS FOR NEW DRAWS)
# ------------------------------------------------------------------------------

target_draw_date <- as.Date("2026-06-26") # Upcoming draw date
target_jackpot   <- 95000000              # Estimated Jackpot amount in dollars

# ------------------------------------------------------------------------------
# SECTION 2: LIBRARIES & SYSTEM SETUP
# ------------------------------------------------------------------------------

suppressPackageStartupMessages({
  library(DBI)
  library(odbc)
  library(dplyr)
  library(tidyr)
  library(lubridate)
  library(mgcv)
  library(splines)
  library(zoo)
})

options(scipen = 999) # Avoid scientific notation

cfg <- list(
  MM_PRICE_CHANGE_DATE = as.Date("2025-04-08"),
  COVID_START          = as.Date("2020-03-01"),
  COVID_END            = as.Date("2021-06-30"),
  PRICES = list(MM_PRE = 2, MM_POST = 5, PB = 2, SLP = 1),
  BASE_JP = c(MM = 20e6, PB = 20e6, SLP = 7e6),
  DB_DSN = "ubiba",
  DB_CONN_STRING = "Driver=SQLServer;Server=P-BIBA-DW;Database=BIDW;Trusted_Connection=yes;port=1443",
  CONSERVATIVE_DISCOUNT = 0.95 # 5% discount to protect against overprediction risk
)

# ------------------------------------------------------------------------------
# SECTION 3: MODEL DEFINITIONS (M7 CONSTRAINED GAM)
# ------------------------------------------------------------------------------

calculate_smear <- function(model) {
  if (is.null(model)) return(1.0)
  mean(exp(residuals(model)), na.rm = TRUE)
}

get_price <- function(game, draw_date, cfg) {
  if (game == "MM") return(ifelse(draw_date >= cfg$MM_PRICE_CHANGE_DATE, cfg$PRICES$MM_POST, cfg$PRICES$MM_PRE))
  if (game == "PB") return(rep(cfg$PRICES$PB, length(draw_date)))
  if (game == "SLP") return(rep(cfg$PRICES$SLP, length(draw_date)))
}

calc_roll_count <- function(draw_dates, jackpots, drop_threshold = 0.50) {
  n <- length(jackpots)
  counts <- integer(n)
  counts[1] <- 1
  for (i in 2:n) {
    if (!is.na(jackpots[i]) && !is.na(jackpots[i-1]) &&
        jackpots[i-1] > 0 && jackpots[i] < jackpots[i-1] * (1 - drop_threshold)) {
      counts[i] <- 1
    } else {
      counts[i] <- counts[i-1] + 1
    }
  }
  counts
}

fit_M7_ConstrainedGAM <- function(train) {
  d <- train %>% filter(!COVID, Tickets > 0)
  if (nrow(d) < 20) return(NULL)
  d$PostChange_f <- factor(d$PostChange, levels = c("0","1"))
  
  fit <- tryCatch(
    gam(log(Tickets) ~ s(log(Jackpot+1), by=PostChange_f, bs="ps", m=1, k=7) + 
          PostChange + DayOfWeek + RollCount, 
        data = d, method = "REML"),
    error = function(e) NULL
  )
  if (is.null(fit)) return(NULL)
  
  # Create a monotonic spline interpolation for shape enforcement
  jp_grid <- exp(seq(log(20e6+1), log(2.5e9+1), length.out = 500)) - 1
  log_jp_grid <- log(jp_grid + 1)
  constrained_shapes <- list()
  present_levels <- as.character(unique(d$PostChange))
  
  for (post_str in present_levels) {
    post_val <- as.integer(post_str)
    ref_df <- data.frame(
      Jackpot = jp_grid, PostChange = post_val,
      PostChange_f = factor(post_val, levels = c("0","1")),
      DayOfWeek = d$DayOfWeek[1], RollCount = 0 
    )
    
    raw_pred <- tryCatch(predict(fit, newdata = ref_df), error = function(e) NULL)
    if (is.null(raw_pred)) next
    
    # Enforce Monotonicity
    mod_pred <- cummax(raw_pred)
    for (i in 2:length(jp_grid)) {
      dx <- log_jp_grid[i] - log_jp_grid[i-1]
      dy <- mod_pred[i] - mod_pred[i-1]
      slope <- dy / dx
      
      # Constrain maximum elasticity by jackpot size to prevent high-tail explosion
      max_e <- 0.85
      if (jp_grid[i] > 500e6) max_e <- 0.50
      if (jp_grid[i] > 700e6) max_e <- 0.25
      if (jp_grid[i] > 1e9)   max_e <- 0.10
      if (jp_grid[i] > 1.5e9) max_e <- 0.02
      
      if (slope > max_e) mod_pred[i] <- mod_pred[i-1] + max_e * dx
    }
    constrained_shapes[[post_str]] <- splinefun(jp_grid, mod_pred, method = "monoH.FC")
  }
  
  list(fit = fit, shapes = constrained_shapes, ref_dow = d$DayOfWeek[1])
}

pred_M7_ConstrainedGAM <- function(model, newdata) {
  if (is.null(model)) return(rep(NA_real_, nrow(newdata)))
  
  nd_base <- newdata
  nd_base$Jackpot <- 20e6
  nd_base$PostChange_f <- factor(nd_base$PostChange, levels = c("0","1"))
  nd_ref <- nd_base
  nd_ref$DayOfWeek <- model$ref_dow
  nd_ref$RollCount <- 0
  
  pred_base <- tryCatch(predict(model$fit, newdata = nd_base), error = function(e) rep(NA_real_, nrow(newdata)))
  pred_ref  <- tryCatch(predict(model$fit, newdata = nd_ref), error = function(e) rep(NA_real_, nrow(newdata)))
  shift <- pred_base - pred_ref
  
  shape_pred <- numeric(nrow(newdata))
  for (i in seq_len(nrow(newdata))) {
    post_str <- as.character(newdata$PostChange[i])
    if (!(post_str %in% names(model$shapes))) post_str <- names(model$shapes)[1]
    shape_pred[i] <- model$shapes[[post_str]](newdata$Jackpot[i])
  }
  
  exp(shape_pred + shift)
}

get_adaptive_weights <- function(jackpot, n_recent) {
  if (n_recent <= 0) return(numeric(0))
  
  # Define base weights for 3 draws based on jackpot bands
  if (jackpot <= 150e6) {
    w_base <- c(0.50, 0.30, 0.20) # Smooth out low-jackpot noise
  } else if (jackpot <= 600e6) {
    w_base <- c(0.95, 0.04, 0.01) # Rely heavily on recent momentum during growth
  } else {
    w_base <- c(0.70, 0.20, 0.10) # Balance recency and saturation risk at high tails
  }
  
  # Subset and normalize based on actual available draws
  w <- w_base[1:n_recent]
  w <- w / sum(w)
  w
}

# ------------------------------------------------------------------------------
# SECTION 4: DATA LOADING PIPELINE
# ------------------------------------------------------------------------------

load_db_data <- function(cfg) {
  message(">>> Querying database...")
  sql <- "
    WITH ProductMap AS (
      SELECT ProductKey, ProductNumber
      FROM dbo.DimProduct WHERE ProductKey IN (703, 700)
    ),
    SalesByDraw AS (
      SELECT DrawGameInfoKey, ProductKey,
             SUM(NetSalesAmount) AS NetSalesAmount
      FROM dbo.FactDrawGameSalesDetail
      WHERE ProductKey IN (703, 700)
      GROUP BY DrawGameInfoKey, ProductKey
    ),
    GameDraws AS (
      SELECT dgi.DrawGameInfoKey, CAST(dgi.DrawDate AS date) AS DrawDate,
             pm.ProductKey, dgi.EstimatedJackpotAmount AS Jackpot
      FROM dbo.DimDrawGameInfo dgi
      JOIN ProductMap pm ON pm.ProductNumber = dgi.ProductNumber
    )
    SELECT CASE WHEN g.ProductKey = 703 THEN 'MM'
                WHEN g.ProductKey = 700 THEN 'PB' END AS Game,
           g.DrawDate, g.Jackpot, s.NetSalesAmount AS Sales
    FROM GameDraws g
    JOIN SalesByDraw s ON s.DrawGameInfoKey = g.DrawGameInfoKey
                      AND s.ProductKey = g.ProductKey
    WHERE s.NetSalesAmount > 0
    ORDER BY g.DrawDate, g.ProductKey;
  "
  
  con <- tryCatch({
    if (!is.null(cfg$DB_DSN) && cfg$DB_DSN != "") {
      dbConnect(odbc::odbc(), dsn = cfg$DB_DSN)
    } else {
      stop("No DSN specified")
    }
  }, error = function(e) {
    message("   DSN connection failed: ", conditionMessage(e))
    message("   Falling back to connection string...")
    tryCatch(
      dbConnect(odbc::odbc(), .connection_string = cfg$DB_CONN_STRING),
      error = function(e2) stop("SQL connection failed: ", conditionMessage(e2))
    )
  })
  on.exit(dbDisconnect(con), add = TRUE)
  
  df_raw <- dbGetQuery(con, sql) %>% mutate(DrawDate = as.Date(DrawDate))
  
  # Build historical MM dataset
  mm <- df_raw %>%
    filter(Game == "MM") %>%
    arrange(DrawDate) %>%
    mutate(
      Price = get_price("MM", DrawDate, cfg),
      Tickets = Sales / Price,
      COVID = as.integer(DrawDate >= cfg$COVID_START & DrawDate <= cfg$COVID_END),
      PostChange = as.integer(DrawDate >= cfg$MM_PRICE_CHANGE_DATE),
      DayOfWeek = factor(c("Sun","Mon","Tue","Wed","Thu","Fri","Sat")[wday(DrawDate)],
                         levels = c("Mon","Tue","Wed","Thu","Fri","Sat","Sun")),
      RollCount = calc_roll_count(DrawDate, Jackpot),
      Lag_JP = lag(Jackpot, default = cfg$BASE_JP["MM"])
    )
  
  # Add Reset classification
  mm <- mm %>%
    mutate(
      Is_Reset_A = as.integer(Jackpot <= 50e6),
      Is_Reset_B = as.integer(RollCount <= 1),
      Is_Reset_C = as.integer(Jackpot < 0.5 * Lag_JP),
      Is_Reset_Final = as.integer(Is_Reset_A | Is_Reset_B | Is_Reset_C)
    )
  
  mm
}

# ------------------------------------------------------------------------------
# SECTION 5: ENGINE EXECUTION & PREDICTION
# ------------------------------------------------------------------------------

generate_prediction <- function(mm_data, target_date, target_jp, cfg) {
  # 1. Determine upcoming draw parameters
  post_change <- as.integer(target_date >= cfg$MM_PRICE_CHANGE_DATE)
  price <- ifelse(post_change == 1, cfg$PRICES$MM_POST, cfg$PRICES$MM_PRE)
  dow <- factor(c("Sun","Mon","Tue","Wed","Thu","Fri","Sat")[wday(target_date)],
                levels = c("Mon","Tue","Wed","Thu","Fri","Sat","Sun"))
  
  # 2. Get previous draw's parameters
  previous_draw <- mm_data %>% filter(DrawDate < target_date) %>% arrange(desc(DrawDate)) %>% head(1)
  prev_jp <- previous_draw$Jackpot[1]
  prev_roll <- previous_draw$RollCount[1]
  prev_date <- previous_draw$DrawDate[1]
  
  # Helper to count drawings (Tuesdays/Fridays) in interval (start, end]
  count_draws_between <- function(start_date, end_date) {
    if (start_date >= end_date) return(0)
    dates <- seq(start_date + 1, end_date, by = "1 day")
    sum(wday(dates) %in% c(3, 6))
  }
  n_draws <- max(1, count_draws_between(prev_date, target_date))
  
  # 3. Calculate roll count and reset state for target draw
  is_reset_a <- target_jp <= 50e6
  is_reset_b <- (prev_jp < 0.5 * target_jp)
  is_reset_c <- target_jp < 0.5 * prev_jp
  
  # Detect if a reset draw occurred
  is_reset_final <- as.integer(is_reset_a | is_reset_c)
  roll_count <- if (is_reset_final == 1) 1 else prev_roll + n_draws
  if (prev_jp >= 0.5 * target_jp && target_jp <= 50e6) {
    is_reset_final <- 1
    roll_count <- 1
  }
  
  # Define test row
  test_row <- data.frame(
    DrawDate = target_date, Jackpot = target_jp, PostChange = post_change,
    DayOfWeek = dow, RollCount = roll_count, Is_Reset_Final = is_reset_final,
    stringsAsFactors = FALSE
  )
  
  # 4. Train Models on historical data (prior to target date)
  train_data <- mm_data %>% filter(DrawDate < target_date)
  
  # Fit base model
  base_train <- train_data %>% filter(Is_Reset_Final == 0)
  m_base <- fit_M7_ConstrainedGAM(base_train)
  
  # Fit reset model
  reset_train <- train_data %>% filter(Is_Reset_Final == 1)
  m_reset <- if (nrow(reset_train) >= 5) lm(log(Tickets) ~ DayOfWeek, data = reset_train) else NULL
  sm_reset <- if (!is.null(m_reset)) calculate_smear(m_reset) else 1.0
  r_mean <- mean(reset_train$Tickets, na.rm = TRUE)
  
  # 5. Base Prediction Calculation
  base_tickets <- NA_real_
  if (is_reset_final == 1) {
    if (!is.null(m_reset)) {
      p <- predict(m_reset, newdata = test_row)
      base_tickets <- exp(p) * sm_reset
    } else {
      base_tickets <- r_mean
    }
  } else {
    base_tickets <- pred_M7_ConstrainedGAM(m_base, test_row)[1]
  }
  
  # --------------------------------------------------------
  # 6. Recency Momentum Modifier (Last 3 Draws)
  # --------------------------------------------------------
  momentum_multiplier <- 1.0
  momentum_details <- data.frame()
  
  if (is_reset_final == 1) {
    # Reset draws start with a clean slate; do not carry over momentum from the previous roll run
    message("   Reset draw detected. Momentum multiplier defaults to 1.000x.")
  } else {
    active_roll <- train_data %>%
      arrange(desc(DrawDate))
    
    # Isolate draws in the current active roll run (stop looking back once RollCount == 1 is found)
    roll_start_idx <- which(active_roll$RollCount == 1)
    if (length(roll_start_idx) > 0) {
      active_roll <- active_roll[1:(roll_start_idx[1]), ]
    }
    
    recent_draws <- head(active_roll, 3)
    n_recent <- nrow(recent_draws)
    
    if (n_recent > 0) {
      recent_ratios <- numeric(n_recent)
      weights <- get_adaptive_weights(target_jp, n_recent)
      
      for (idx in seq_len(n_recent)) {
        rd <- recent_draws[idx, ]
        
        # Predict tickets for this historical draw using model status at that point
        rd_train <- train_data %>% filter(DrawDate < rd$DrawDate)
        
        rd_tickets <- NA_real_
        if (rd$Is_Reset_Final == 1) {
          rd_reset_train <- rd_train %>% filter(Is_Reset_Final == 1)
          rd_m_reset <- if (nrow(rd_reset_train) >= 5) lm(log(Tickets) ~ DayOfWeek, data = rd_reset_train) else NULL
          rd_sm_reset <- if (!is.null(rd_m_reset)) calculate_smear(rd_m_reset) else 1.0
          if (!is.null(rd_m_reset)) {
            rd_tickets <- exp(predict(rd_m_reset, newdata = rd)) * rd_sm_reset
          } else {
            rd_tickets <- mean(rd_reset_train$Tickets, na.rm = TRUE)
          }
        } else {
          rd_base_train <- rd_train %>% filter(Is_Reset_Final == 0)
          rd_m_base <- fit_M7_ConstrainedGAM(rd_base_train)
          rd_tickets <- pred_M7_ConstrainedGAM(rd_m_base, rd)[1]
        }
        
        ratio <- max(0.50, min(1.50, rd$Tickets / rd_tickets))
        recent_ratios[idx] = ratio
        
        momentum_details <- bind_rows(momentum_details, data.frame(
          DrawDate = rd$DrawDate,
          Jackpot = rd$Jackpot,
          Actual_Sales = rd$Sales,
          Actual_Tickets = rd$Tickets,
          Model_Pred_Tickets = rd_tickets,
          Ratio = ratio,
          Weight = weights[idx]
        ))
      }
      
      momentum_multiplier <- sum(recent_ratios * weights)
    }
  }
  
  # 7. Final Prediction Calculations
  final_tickets <- base_tickets * momentum_multiplier
  base_sales <- base_tickets * price
  final_sales <- final_tickets * price
  
  # 8. Risk-Adjusted Conservative Prediction
  final_sales_conservative <- final_sales * cfg$CONSERVATIVE_DISCOUNT
  final_tickets_conservative <- final_tickets * cfg$CONSERVATIVE_DISCOUNT
  
  # 9. Find Historical Analogues (Same Day of Week, Same Price Point, Jackpot +/- 20%)
  analogues <- mm_data %>%
    filter(
      PostChange == post_change,
      DayOfWeek == dow,
      Jackpot >= target_jp * 0.80,
      Jackpot <= target_jp * 1.20,
      DrawDate < target_date
    ) %>%
    select(DrawDate, Jackpot, Sales, Tickets) %>%
    arrange(desc(DrawDate))
  
  list(
    inputs = test_row,
    price = price,
    base_tickets = base_tickets,
    base_sales = base_sales,
    momentum_multiplier = momentum_multiplier,
    final_tickets = final_tickets,
    final_sales = final_sales,
    final_sales_conservative = final_sales_conservative,
    final_tickets_conservative = final_tickets_conservative,
    momentum_details = momentum_details,
    analogues = analogues
  )
}

# ------------------------------------------------------------------------------
# SECTION 6: EXECUTION & CONSOLE REPORTING
# ------------------------------------------------------------------------------

# Run Data Query & Predict
mm_data <- load_db_data(cfg)
pred <- generate_prediction(mm_data, target_draw_date, target_jackpot, cfg)

# Print Detailed Predictor Report
cat("\n")
cat(strrep("=", 80), "\n")
cat("          MEGA MILLIONS SALES & TICKET PREDICT REPORT\n")
cat(strrep("=", 80), "\n\n")

cat(sprintf("  Target Draw Date:   %s (%s)\n", target_draw_date, pred$inputs$DayOfWeek[1]))
cat(sprintf("  Target Jackpot:     $%s\n", format(target_jackpot, big.mark = ",")))
cat(sprintf("  Post-Change State:  %s ($%d ticket price)\n", 
            ifelse(pred$inputs$PostChange[1] == 1, "YES", "NO"), pred$price))
cat(sprintf("  Reset State Gate:   %s (Active Roll Count: %d)\n\n", 
            ifelse(pred$inputs$Is_Reset_Final[1] == 1, "ACTIVE (Reset Draw)", "INACTIVE"), 
            pred$inputs$RollCount[1]))

cat(strrep("-", 80), "\n")
cat("  RECENCY MOMENTUM AUDIT (Last 3 Draws of Active Roll)\n")
cat(strrep("-", 80), "\n")

if (nrow(pred$momentum_details) > 0) {
  for (i in seq_len(nrow(pred$momentum_details))) {
    r <- pred$momentum_details[i, ]
    cat(sprintf("   ➔ Draw %s (JP: $%7sM): Actual = %7s tix | Pred = %7s tix | Ratio: %.3f | Weight: %.2f\n",
                r$DrawDate,
                format(round(r$Jackpot / 1e6), big.mark = ","),
                format(round(r$Actual_Tickets), big.mark = ","),
                format(round(r$Model_Pred_Tickets), big.mark = ","),
                r$Ratio,
                r$Weight))
  }
  cat(sprintf("\n   ★ COMBINED RECENCY MOMENTUM MULTIPLIER: %.3fx\n", pred$momentum_multiplier))
} else {
  cat("   No previous draws in the current roll run. Multiplier defaults to 1.000x.\n")
}
cat("\n")

cat(strrep("-", 80), "\n")
cat("  HISTORICAL ANALOGUES (Same Day of Week, Same Price Point, Jackpot +/-20%)\n")
cat(strrep("-", 80), "\n")

if (nrow(pred$analogues) > 0) {
  for (i in seq_len(nrow(pred$analogues))) {
    an <- pred$analogues[i, ]
    cat(sprintf("   ➔ Draw %s (JP: $%7sM): Actual Sales = $%10s | Tickets = %s\n",
                an$DrawDate,
                format(round(an$Jackpot / 1e6), big.mark = ","),
                format(round(an$Sales), big.mark = ","),
                format(round(an$Tickets), big.mark = ",")))
  }
} else {
  cat("   No similar historical jackpots found on this day under the current price point.\n")
}
cat("\n")

cat(strrep("=", 80), "\n")
cat("  FINAL FORECAST RESULTS\n")
cat(strrep("=", 80), "\n\n")

cat(sprintf("  Base Model Predict (Sales):    $%14s  (%s tickets)\n", 
            format(round(pred$base_sales), big.mark = ","),
            format(round(pred$base_tickets), big.mark = ",")))
cat(sprintf("  Recency Momentum Adjustment:    %14s  (%.1f%% adjustment)\n", 
            sprintf("%.3fx", pred$momentum_multiplier),
            (pred$momentum_multiplier - 1) * 100))
cat(sprintf("  FINAL ADJ. PREDICTION (Sales):  $%14s  (%s tickets)\n", 
            format(round(pred$final_sales), big.mark = ","),
            format(round(pred$final_tickets), big.mark = ",")))
cat(sprintf("  CONSERVATIVE PREDICTION (%d%% disc):  $%14s  (%s tickets)\n\n",
            round((1 - cfg$CONSERVATIVE_DISCOUNT) * 100),
            format(round(pred$final_sales_conservative), big.mark = ","),
            format(round(pred$final_tickets_conservative), big.mark = ",")))

cat(strrep("=", 80), "\n")
cat("  Summary file exported to the outputs folder.\n")
cat(strrep("=", 80), "\n\n")

# Save outputs to disk
out_dir <- file.path(getwd(), "outputs")
if (!dir.exists(out_dir)) dir.create(out_dir, recursive = TRUE)
write.csv(data.frame(
  TargetDrawDate = target_draw_date,
  TargetJackpot = target_jackpot,
  IsReset = pred$inputs$Is_Reset_Final[1],
  RollCount = pred$inputs$RollCount[1],
  BaseSales = round(pred$base_sales),
  MomentumMultiplier = round(pred$momentum_multiplier, 4),
  FinalSales = round(pred$final_sales),
  ConservativeSales = round(pred$final_sales_conservative)
), file.path(out_dir, "upcoming_draw_prediction.csv"), row.names = FALSE)
