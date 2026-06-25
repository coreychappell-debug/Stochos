# ==============================================================================
# POWERBALL RECENCY MOMENTUM VALIDATION & BACKTEST
# Purpose: Historically backtest the Recency Momentum Modifier across
#          multiple weight schemes (e.g., 50/30/20, 70/20/10, Equal, t-1 only)
#          to validate accuracy gains and optimize weight parameters.
#
# Prerequisites: System DSN "ubiba" must be configured in ODBC.
# ==============================================================================

# ------------------------------------------------------------------------------
# SECTION 1: CONFIGURATION & ENVIRONMENT
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

options(scipen = 999)

cfg <- list(
  COVID_START          = as.Date("2020-03-01"),
  COVID_END            = as.Date("2021-06-30"),
  PRICES = list(MM_PRE = 2, MM_POST = 5, PB = 2, SLP = 1),
  BASE_JP = c(MM = 20e6, PB = 20e6, SLP = 7e6),
  MIN_TRAIN = 200,
  TRAINING_YEARS = 3,
  REFIT_EVERY = 1,
  DB_DSN = "ubiba",
  DB_CONN_STRING = "Driver=SQLServer;Server=P-BIBA-DW;Database=BIDW;Trusted_Connection=yes;port=1443",
  OUTPUT_DIR = file.path(getwd(), "outputs", "momentum_validation")
)

# ------------------------------------------------------------------------------
# SECTION 2: INFRASTRUCTURE & MODEL DEFINITIONS
# ------------------------------------------------------------------------------

calculate_smear <- function(model) {
  if (is.null(model)) return(1.0)
  mean(exp(residuals(model)), na.rm = TRUE)
}

align_levels <- function(model, newdata, default_day = "Wed") {
  fit_obj <- if (is.list(model) && !is.null(model$fit)) model$fit else model
  
  if (is.null(fit_obj) || is.null(fit_obj$xlevels) || is.null(fit_obj$xlevels$DayOfWeek)) {
    return(newdata)
  }
  
  valid_levels <- fit_obj$xlevels$DayOfWeek
  
  if ("DayOfWeek" %in% names(newdata)) {
    dow_char <- as.character(newdata$DayOfWeek)
    invalid_idx <- !(dow_char %in% valid_levels)
    if (any(invalid_idx)) {
      fallback_day <- if (default_day %in% valid_levels) default_day else valid_levels[1]
      dow_char[invalid_idx] <- fallback_day
    }
    newdata$DayOfWeek <- factor(dow_char, levels = valid_levels)
  }
  
  newdata
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
  
  fit <- tryCatch(
    gam(log(Tickets) ~ s(log(Jackpot+1), bs="ps", m=1, k=7) + 
          DayOfWeek + RollCount, 
        data = d, method = "REML"),
    error = function(e) NULL
  )
  if (is.null(fit)) return(NULL)
  
  # Create a monotonic spline interpolation for shape enforcement
  jp_grid <- exp(seq(log(20e6+1), log(2.5e9+1), length.out = 500)) - 1
  log_jp_grid <- log(jp_grid + 1)
  
  ref_df <- data.frame(
    Jackpot = jp_grid,
    DayOfWeek = d$DayOfWeek[1], RollCount = 0 
  )
  
  raw_pred <- tryCatch(predict(fit, newdata = ref_df), error = function(e) NULL)
  if (is.null(raw_pred)) return(NULL)
  
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
  
  shape_fun <- splinefun(jp_grid, mod_pred, method = "monoH.FC")
  
  list(fit = fit, shape = shape_fun, ref_dow = d$DayOfWeek[1])
}

pred_M7_ConstrainedGAM <- function(model, newdata) {
  if (is.null(model)) return(rep(NA_real_, nrow(newdata)))
  
  newdata <- align_levels(model$fit, newdata, default_day = "Wed")
  
  nd_base <- newdata
  nd_base$Jackpot <- 20e6
  nd_ref <- nd_base
  nd_ref$DayOfWeek <- model$ref_dow
  nd_ref$RollCount <- 0
  
  pred_base <- tryCatch(predict(model$fit, newdata = nd_base), error = function(e) rep(NA_real_, nrow(newdata)))
  pred_ref  <- tryCatch(predict(model$fit, newdata = nd_ref), error = function(e) rep(NA_real_, nrow(newdata)))
  shift <- pred_base - pred_ref
  
  shape_pred <- sapply(newdata$Jackpot, function(jp) model$shape(jp))
  
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
# SECTION 3: DATA PIPELINE
# ------------------------------------------------------------------------------

assign_pb_band <- function(jp) {
  factor(case_when(
    jp < 100e6  ~ "Under 100M",
    jp < 150e6  ~ "100M-150M",
    jp < 300e6  ~ "150M-300M",
    jp < 500e6  ~ "300M-500M",
    TRUE        ~ "500M+"
  ), levels = c("Under 100M","100M-150M","150M-300M","300M-500M","500M+"))
}

load_data <- function(cfg) {
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
  
  pb <- df_raw %>%
    filter(Game == "PB") %>%
    arrange(DrawDate) %>%
    mutate(
      Price = cfg$PRICES$PB,
      Tickets = Sales / Price,
      COVID = as.integer(DrawDate >= cfg$COVID_START & DrawDate <= cfg$COVID_END),
      DayOfWeek = factor(c("Sun","Mon","Tue","Wed","Thu","Fri","Sat")[wday(DrawDate)],
                         levels = c("Mon","Tue","Wed","Thu","Fri","Sat","Sun")),
      RollCount = calc_roll_count(DrawDate, Jackpot),
      Lag_JP = lag(Jackpot, default = cfg$BASE_JP["PB"]),
      JP_Band = assign_pb_band(Jackpot)
    )
  
  # Reset Detection
  pb <- pb %>%
    mutate(
      Is_Reset_A = as.integer(Jackpot <= 20e6),
      Is_Reset_B = as.integer(RollCount <= 1),
      Is_Reset_C = as.integer(Jackpot < 0.5 * Lag_JP),
      Is_Reset_Final = as.integer(Is_Reset_A | Is_Reset_B | Is_Reset_C)
    )
  
  pb
}

# ------------------------------------------------------------------------------
# SECTION 4: ROLLING BACKTEST HARNESS WITH MULTIPLE MOMENTUM SCHEMES
# ------------------------------------------------------------------------------

get_lookahead_free_pred <- function(train_subset, rd) {
  if (rd$Is_Reset_Final[1] == 1) {
    reset_train <- train_subset %>% filter(Is_Reset_Final == 1)
    m_res <- if (nrow(reset_train) >= 5) lm(log(Tickets) ~ DayOfWeek, data = reset_train) else NULL
    if (!is.null(m_res)) {
      rd_aligned <- align_levels(m_res, rd, default_day = "Wed")
      sm <- mean(exp(residuals(m_res)), na.rm = TRUE)
      exp(predict(m_res, newdata = rd_aligned)) * sm
    } else {
      mean(reset_train$Tickets, na.rm = TRUE)
    }
  } else {
    base_train <- train_subset %>% filter(Is_Reset_Final == 0)
    m_base <- fit_M7_ConstrainedGAM(base_train)
    if (!is.null(m_base)) {
      pred_M7_ConstrainedGAM(m_base, rd)[1]
    } else {
      mean(base_train$Tickets, na.rm = TRUE)
    }
  }
}

run_momentum_backtest <- function(pb_data, cfg) {
  d <- pb_data %>% arrange(DrawDate)
  n <- nrow(d)
  min_train <- cfg$MIN_TRAIN
  
  results <- list()
  n_eval <- n - min_train
  message(sprintf(">>> Running rolling backtest over %d draws...", n_eval))
  
  model_base <- NULL
  model_reset <- NULL
  sm_reset <- 1.0
  r_mean <- 0
  last_fit_i <- 0
  
  for (i in (min_train + 1):n) {
    target_date <- d$DrawDate[i]
    
    # Refit model periodically
    if (is.null(model_base) || (i - last_fit_i) >= cfg$REFIT_EVERY) {
      train <- d[1:(i-1), ]
      
      cutoff <- target_date - years(cfg$TRAINING_YEARS)
      train_recent <- train %>% filter(DrawDate >= cutoff)
      if (nrow(train_recent) >= 50) train <- train_recent
      
      # Fit M7 Base Model
      base_train <- train %>% filter(Is_Reset_Final == 0)
      model_base <- fit_M7_ConstrainedGAM(base_train)
      
      # Fit Reset Model
      reset_train <- train %>% filter(Is_Reset_Final == 1)
      model_reset <- if (nrow(reset_train) >= 5) lm(log(Tickets) ~ DayOfWeek, data = reset_train) else NULL
      sm_reset <- if (!is.null(model_reset)) calculate_smear(model_reset) else 1.0
      r_mean <- mean(reset_train$Tickets, na.rm = TRUE)
      
      last_fit_i <- i
    }
    
    if (is.null(model_base)) next
    
    eval_row <- d[i, , drop = FALSE]
    
    # 1. Base Prediction (M7 ResetGated)
    pred_tickets_base <- NA_real_
    if (eval_row$Is_Reset_Final[1] == 1) {
      if (!is.null(model_reset)) {
        eval_row_aligned <- align_levels(model_reset, eval_row, default_day = "Wed")
        p <- tryCatch(predict(model_reset, newdata = eval_row_aligned), error = function(e) NA)
        pred_tickets_base <- exp(p) * sm_reset
      } else {
        pred_tickets_base <- r_mean
      }
    } else {
      pred_tickets_base <- pred_M7_ConstrainedGAM(model_base, eval_row)[1]
    }
    
    # 1.1 Find analogues in historical data prior to target_date
    pred_tickets_analogue <- NA_real_
    if (eval_row$Is_Reset_Final[1] == 1) {
      pred_tickets_analogue <- pred_tickets_base
    } else {
      hist_data <- d[1:(i-1), ]
      analogues <- hist_data %>%
        filter(
          Is_Reset_Final == 0,
          DayOfWeek == eval_row$DayOfWeek[1],
          Jackpot >= eval_row$Jackpot[1] * 0.80,
          Jackpot <= eval_row$Jackpot[1] * 1.20
        )
      if (nrow(analogues) > 0) {
        pred_tickets_analogue <- mean(analogues$Tickets, na.rm = TRUE)
      } else {
        pred_tickets_analogue <- pred_tickets_base
      }
    }
    
    actual_tickets <- eval_row$Tickets[1]
    if (!is.finite(pred_tickets_base) || is.na(actual_tickets) || actual_tickets <= 0) next
    
    # 2. Gather active roll history up to this draw to compute momentum
    mult_A <- 1.0 # 50/30/20
    mult_B <- 1.0 # 70/20/10
    mult_C <- 1.0 # Equal (33/33/33)
    mult_D <- 1.0 # t-1 only
    mult_E <- 1.0 # Adaptive (Dynamic)
    mult_F <- 1.0 # Analogue Hybrid
    
    if (eval_row$Is_Reset_Final[1] == 1) {
      # Reset draw: do not carry over momentum from the previous roll run
    } else {
      active_roll <- d[1:(i-1), ] %>%
        arrange(desc(DrawDate))
      
      # Isolate current roll run draws
      roll_start_idx <- which(active_roll$RollCount == 1)
      if (length(roll_start_idx) > 0) {
        active_roll <- active_roll[1:(roll_start_idx[1]), ]
      }
      
      recent_draws <- head(active_roll, 3)
      n_recent <- nrow(recent_draws)
      
      if (n_recent > 0) {
        ratios <- numeric(n_recent)
        for (idx in seq_len(n_recent)) {
          rd <- recent_draws[idx, ]
          j <- which(d$DrawDate == rd$DrawDate)
          
          # Check if we already have the base prediction for this draw from our results
          rd_pred <- NA_real_
          if (j > min_train && length(results) >= (j - min_train)) {
            res_idx <- j - min_train
            if (res_idx > 0 && res_idx <= length(results)) {
              rd_pred <- results[[res_idx]]$Pred_Base / rd$Price
            }
          }
          
          # Fallback to lookahead-free model if not available (e.g. at the very start of backtest)
          if (is.na(rd_pred)) {
            rd_train <- d[1:(j-1), ]
            rd_pred <- get_lookahead_free_pred(rd_train, rd)
          }
          ratios[idx] <- max(0.50, min(1.50, rd$Tickets / rd_pred))
        }
        
        # Assign weights based on actual available draws
        w_A <- if (n_recent == 3) c(0.50, 0.30, 0.20) else if (n_recent == 2) c(0.60, 0.40) else c(1.0)
        w_B <- if (n_recent == 3) c(0.70, 0.20, 0.10) else if (n_recent == 2) c(0.75, 0.25) else c(1.0)
        w_C <- if (n_recent == 3) c(0.333, 0.333, 0.333) else if (n_recent == 2) c(0.50, 0.50) else c(1.0)
        w_D <- if (n_recent >= 1) c(1.0, 0, 0)[1:n_recent] else c(1.0)
        w_E <- get_adaptive_weights(eval_row$Jackpot[1], n_recent)
        
        mult_A <- sum(ratios * w_A)
        mult_B <- sum(ratios * w_B)
        mult_C <- sum(ratios * w_C)
        mult_D <- sum(ratios * w_D)
        mult_E <- sum(ratios * w_E)
      }
    }
    
    # Apply momentum multipliers
    pred_tickets_A <- pred_tickets_base * mult_A
    pred_tickets_B <- pred_tickets_base * mult_B
    pred_tickets_C <- pred_tickets_base * mult_C
    pred_tickets_D <- pred_tickets_base * mult_D
    pred_tickets_E <- pred_tickets_base * mult_E
    pred_tickets_F <- pred_tickets_analogue * mult_E
    
    price <- eval_row$Price[1]
    
    results[[length(results) + 1]] <- data.frame(
      DrawDate = target_date,
      Jackpot = eval_row$Jackpot[1],
      JP_Band = as.character(eval_row$JP_Band[1]),
      Is_Reset_Final = eval_row$Is_Reset_Final[1],
      Actual_Sales = eval_row$Sales[1],
      Actual_Tickets = actual_tickets,
      
      Pred_Base = pred_tickets_base * price,
      Pred_A = pred_tickets_A * price,
      Pred_B = pred_tickets_B * price,
      Pred_C = pred_tickets_C * price,
      Pred_D = pred_tickets_D * price,
      Pred_E = pred_tickets_E * price,
      Pred_F = pred_tickets_F * price,
      
      Err_Base = abs(pred_tickets_base - actual_tickets)/actual_tickets * 100,
      Err_A = abs(pred_tickets_A - actual_tickets)/actual_tickets * 100,
      Err_B = abs(pred_tickets_B - actual_tickets)/actual_tickets * 100,
      Err_C = abs(pred_tickets_C - actual_tickets)/actual_tickets * 100,
      Err_D = abs(pred_tickets_D - actual_tickets)/actual_tickets * 100,
      Err_E = abs(pred_tickets_E - actual_tickets)/actual_tickets * 100,
      Err_F = abs(pred_tickets_F - actual_tickets)/actual_tickets * 100,
      
      Dollar_Err_Base = abs(pred_tickets_base * price - eval_row$Sales[1]),
      Dollar_Err_A = abs(pred_tickets_A * price - eval_row$Sales[1]),
      Dollar_Err_B = abs(pred_tickets_B * price - eval_row$Sales[1]),
      Dollar_Err_C = abs(pred_tickets_C * price - eval_row$Sales[1]),
      Dollar_Err_D = abs(pred_tickets_D * price - eval_row$Sales[1]),
      Dollar_Err_E = abs(pred_tickets_E * price - eval_row$Sales[1]),
      Dollar_Err_F = abs(pred_tickets_F * price - eval_row$Sales[1]),
      
      stringsAsFactors = FALSE
    )
    
    if (length(results) %% 100 == 0) message(sprintf("     ... %d draws evaluated", length(results)))
  }
  
  bind_rows(results)
}

# ------------------------------------------------------------------------------
# SECTION 5: REPORT GENERATION
# ------------------------------------------------------------------------------

compile_scorecard <- function(res) {
  variants <- c("Base", "A_50_30_20", "B_70_20_10", "C_Equal", "D_t1_Only", "E_Adaptive", "F_Analogue_Hybrid")
  
  scorecard <- list()
  
  for (v in variants) {
    suffix <- switch(v,
                     "Base" = "Base",
                     "E_Adaptive" = "E",
                     "F_Analogue_Hybrid" = "F",
                     substr(v, 1, 1))
    err_col <- paste0("Err_", suffix)
    dol_col <- paste0("Dollar_Err_", suffix)
    
    # Overall
    scorecard[[length(scorecard) + 1]] <- data.frame(
      Variant = v,
      Jackpot_Band = "Overall",
      MAPE = mean(res[[err_col]], na.rm = TRUE),
      Median_MAPE = median(res[[err_col]], na.rm = TRUE),
      MAE_Dollars = mean(res[[dol_col]], na.rm = TRUE),
      Median_AE_Dollars = median(res[[dol_col]], na.rm = TRUE),
      N = nrow(res)
    )
    
    # Split by Jackpot Band
    for (band in unique(res$JP_Band)) {
      sub <- res %>% filter(JP_Band == band)
      scorecard[[length(scorecard) + 1]] <- data.frame(
        Variant = v,
        Jackpot_Band = band,
        MAPE = mean(sub[[err_col]], na.rm = TRUE),
        Median_MAPE = median(sub[[err_col]], na.rm = TRUE),
        MAE_Dollars = mean(sub[[dol_col]], na.rm = TRUE),
        Median_AE_Dollars = median(sub[[dol_col]], na.rm = TRUE),
        N = nrow(sub)
      )
    }
  }
  
  bind_rows(scorecard) %>% arrange(Jackpot_Band, MAPE)
}

# ------------------------------------------------------------------------------
# MAIN EXECUTION
# ------------------------------------------------------------------------------

if (!dir.exists(cfg$OUTPUT_DIR)) dir.create(cfg$OUTPUT_DIR, recursive = TRUE)

pb_data <- load_data(cfg)
res <- run_momentum_backtest(pb_data, cfg)
scorecard <- compile_scorecard(res)

# Print Summary Console Report
cat("\n")
cat(strrep("=", 110), "\n")
cat("          POWERBALL RECENCY MOMENTUM AUDIT — VALIDATION RESULTS\n")
cat(strrep("=", 110), "\n\n")

cat("  OVERALL RESULTS COMPARISON:\n")
cat(strrep("-", 100), "\n")
cat(sprintf("  %-25s %8s %12s %16s %16s\n", 
            "Variant", "Mean MAPE", "Median MAPE", "Mean Dollar Err", "Median Dollar Err"))
cat(strrep("-", 100), "\n")

overall <- scorecard %>% filter(Jackpot_Band == "Overall")
for (i in seq_len(nrow(overall))) {
  r <- overall[i, ]
  marker <- if (i == 1) " <-- BEST OVERALL" else ""
  cat(sprintf("  %-25s %8.2f%% %11.2f%%  $%14s  $%14s %s\n",
              r$Variant, r$MAPE, r$Median_MAPE,
              format(round(r$MAE_Dollars), big.mark = ","),
              format(round(r$Median_AE_Dollars), big.mark = ","),
              marker))
}
cat(strrep("=", 110), "\n\n")

cat("  RESULTS BY JACKPOT BAND:\n")
cat(strrep("-", 100), "\n")
cat(sprintf("  %-16s %-20s %8s %12s %16s\n", 
            "Band", "Variant", "Mean MAPE", "Median MAPE", "Median Dollar Err"))
cat(strrep("-", 100), "\n")

bands <- unique(scorecard$Jackpot_Band)
bands <- bands[bands != "Overall"]

for (b in bands) {
  band_res <- scorecard %>% filter(Jackpot_Band == b) %>% arrange(Median_MAPE)
  for (i in seq_len(nrow(band_res))) {
    r <- band_res[i, ]
    marker <- if (i == 1) " <-- BEST IN BAND" else ""
    cat(sprintf("  %-16s %-20s %8.2f%% %11.2f%%  $%14s %s\n",
                r$Jackpot_Band, r$Variant, r$MAPE, r$Median_MAPE,
                format(round(r$Median_AE_Dollars), big.mark = ","),
                marker))
  }
  cat(strrep("-", 100), "\n")
}
cat("\n")

# Save outputs to disk
write.csv(res, file.path(cfg$OUTPUT_DIR, "pb_momentum_backtest_detail.csv"), row.names = FALSE)
write.csv(scorecard, file.path(cfg$OUTPUT_DIR, "pb_momentum_scorecard.csv"), row.names = FALSE)

message(">>> Powerball validation complete! Outputs exported to: ", cfg$OUTPUT_DIR)
