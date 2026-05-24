#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import duckdb
import sys
from datetime import datetime

"""
NY Lottery Data Normalization & Payout Estimation Script (v9)
------------------------------------------------------------
PURPOSE:
Normalizes NY Lottery retail data for multi-state comparison. 

LOGIC, REASON, & TRUTH NOTES:
1. RETAILER COMMISSIONS (The Missing Variable):
   Retailers in NY typically earn a 6% commission on sales. This money is 
   retained by the retailer and is NOT part of the state's net profit. 
   To find the "Pure" contribution to the state, we must subtract this.

2. THE REDEMPTION GAP:
   The ~$1.8B gap between 'Estimated Payouts' and 'Actual terminal payouts' 
   confirms that terminal data only tracks prizes <$600. Our theoretical 
   model captures the liability of high-tier winners.

3. REVENUE DEFINITION:
   'Money In' is defined as Draw Sales + Scratch-off Inventory Settlements.

COLUMN DEFINITIONS:
- gross_revenue: Total ticket volume.
- est_retailer_commission: gross_revenue * 0.06.
- est_payout_liability: gross_revenue * theoretical_payout_rate.
- est_net_state_profit: gross_revenue - commission - payout_liability.
"""

# Configuration
STATE_CODE = "NY"
NY_ROOT = Path("/srv/stochos/data/raw/new_york/nylottery_data")
SALES_CSV = NY_ROOT / "xyvi-fbb9_lottery-daily-retailer-sales-by-game-beginning-2024" / "data.csv"
RETAILERS_CSV = NY_ROOT / "2vvn-pdyi_nys-lottery-retailers" / "data.csv"
DB_PATH = Path("/srv/stochos/data/duckdb/stochos_lottery.duckdb")

# Standard commission rate for NY retailers
RETAILER_COMMISSION_RATE = 0.06

# Safety guard: Filter out future projections
TODAY = datetime.now().strftime('%Y-%m-%d')
DAILY_SALES_START_DATE = "2024-01-01"

# Standardized Table Names
RAW_SALES_TABLE = f"stg_{STATE_CODE.lower()}_sales_raw"
RAW_RETAILER_TABLE = f"stg_{STATE_CODE.lower()}_retailers_raw"
DIM_RETAILER_TABLE = "dim_retailers"
DIM_GAME_TABLE = "dim_games"
FACT_SALES_TABLE = "fact_lottery_sales"

def qident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'

def qstr(value: str) -> str:
    if value is None: return "NULL"
    return "'" + str(value).replace("'", "''") + "'"

# (Name, Family, MetricClass, IsRevenue, StandardCategory, TheoreticalPayoutRate)
GAME_CLASSIFICATIONS = {
    "numbers_day": ("Numbers Day", "Numbers", "sales", True, "pick_3", 0.50),
    "numbers_eve": ("Numbers Evening", "Numbers", "sales", True, "pick_3", 0.50),
    "numbers_iw": ("Numbers Instant Win", "Numbers", "sales", True, "instant_win", 0.65),
    "win4_day": ("Win 4 Day", "Win 4", "sales", True, "pick_4", 0.50),
    "win4_eve": ("Win 4 Evening", "Win 4", "sales", True, "pick_4", 0.50),
    "win4_iw": ("Win 4 Instant Win", "Win 4", "sales", True, "instant_win", 0.65),
    "t5_day": ("Take 5 Day", "Take 5", "sales", True, "lotto_jackpot", 0.50),
    "t5_eve": ("Take 5 Evening", "Take 5", "sales", True, "lotto_jackpot", 0.50),
    "take5_iw": ("Take 5 Instant Win", "Take 5", "sales", True, "instant_win", 0.65),
    "pick10": ("Pick 10", "Pick 10", "sales", True, "lotto_jackpot", 0.50),
    "lotto": ("NY Lotto", "Lotto", "sales", True, "lotto_jackpot", 0.40),
    "mega": ("Mega Millions", "Mega Millions", "sales", True, "lotto_jackpot", 0.50),
    "megaplier": ("Megaplier", "Mega Millions", "add_on", True, "lotto_jackpot", 0.00),
    "powerball": ("Powerball", "Powerball", "sales", True, "lotto_jackpot", 0.50),
    "powerplay": ("Power Play", "Powerball", "add_on", True, "lotto_jackpot", 0.00),
    "doubleplay": ("Double Play", "Powerball", "add_on", True, "lotto_jackpot", 0.00),
    "c4l": ("Cash 4 Life", "Cash 4 Life", "sales", True, "lotto_jackpot", 0.55),
    "m4l": ("Millionaire for Life", "Millionaire for Life", "sales", True, "lotto_jackpot", 0.55),
    "quick_draw": ("Quick Draw", "Quick Draw", "sales", True, "monitor", 0.60),
    "qd_extra": ("Quick Draw Extra", "Quick Draw", "add_on", True, "monitor", 0.00),
    "money_dots": ("Money Dots", "Quick Draw", "add_on", True, "monitor", 0.00),
    "ig_settles": ("IG Settles", "Instant", "sales", True, "scratch_off", 0.65),
    "draw_paid": ("Draw Paid", "Settlement", "payout", False, "accounting", 0.00),
    "ig_paid": ("IG Paid", "Settlement", "payout", False, "accounting", 0.00),
    "promo": ("Promo", "Other", "unknown", False, "accounting", 0.00),
}

def create_raw_tables(con):
    now = datetime.now().isoformat()
    con.execute(f"CREATE OR REPLACE TABLE {RAW_SALES_TABLE} AS SELECT *, '{now}' as ingested_at FROM read_csv_auto({qstr(SALES_CSV.as_posix())}, all_varchar=true)")
    con.execute(f"CREATE OR REPLACE TABLE {RAW_RETAILER_TABLE} AS SELECT *, '{now}' as ingested_at FROM read_csv_auto({qstr(RETAILERS_CSV.as_posix())}, all_varchar=true)")

def build_dimensions(con):
    con.execute(f"""
    CREATE OR REPLACE TABLE {DIM_RETAILER_TABLE} AS 
    SELECT '{STATE_CODE}' as state_code, CAST({qident('Retailer')} AS VARCHAR) AS retailer_id, 
           {qident('Name')} AS master_name, {qident('City')} AS city, CAST({qident('Zip')} AS VARCHAR) AS zip_code 
    FROM {RAW_RETAILER_TABLE}
    """)
    values = ",\n".join([f"('{STATE_CODE}', {qstr(c)}, {qstr(v[0])}, {qstr(v[1])}, {qstr(v[2])}, {str(v[3]).upper()}, {qstr(v[4])}, {v[5]}, {RETAILER_COMMISSION_RATE})" for c, v in GAME_CLASSIFICATIONS.items()])
    con.execute(f"""
    CREATE OR REPLACE TABLE {DIM_GAME_TABLE} AS 
    SELECT col0 as state_code, col1 as game_code, col2 as game_name, col3 as game_family, col4 as metric_class, 
           col5 as is_revenue, col6 as standard_category, col7 as theoretical_payout_rate, 
           col8 as retailer_commission_rate
    FROM (VALUES {values})
    """)

def build_fact_table(con):
    raw_cols = {r[0] for r in con.execute(f"DESCRIBE {RAW_SALES_TABLE}").fetchall()}
    sample = con.execute(f"SELECT {qident('BUS_DAY')} FROM {RAW_SALES_TABLE} LIMIT 1").fetchone()
    date_expr = f"strptime({qident('BUS_DAY')}, '%m/%d/%Y')" if "/" in sample[0] else f"TRY_CAST({qident('BUS_DAY')} AS DATE)"

    union_parts = []
    for target_key in GAME_CLASSIFICATIONS.keys():
        match = [rc for rc in raw_cols if rc.strip().upper() == target_key.upper()]
        if match:
            orig_col = match[0]
            union_parts.append(f"""
            SELECT '{STATE_CODE}' as state_code, {date_expr} as sales_date, CAST({qident("AGTNO")} AS VARCHAR) as retailer_id,
                   '{target_key}' as game_code, TRY_CAST(REPLACE({qident(orig_col)}, ',', '') AS DOUBLE) as amount
            FROM {RAW_SALES_TABLE}
            WHERE {date_expr} >= DATE '{DAILY_SALES_START_DATE}' AND {date_expr} <= DATE '{TODAY}'
            """)
    con.execute(f"CREATE OR REPLACE TABLE {FACT_SALES_TABLE}_melt AS " + "\nUNION ALL\n".join(union_parts))
    con.execute(f"""
    CREATE OR REPLACE TABLE {FACT_SALES_TABLE} AS
    SELECT f.*, g.is_revenue, g.metric_class, g.standard_category, g.theoretical_payout_rate, g.retailer_commission_rate
    FROM {FACT_SALES_TABLE}_melt f
    LEFT JOIN {DIM_GAME_TABLE} g ON f.state_code = g.state_code AND f.game_code = g.game_code
    WHERE amount IS NOT NULL AND amount <> 0
    """)

def create_unified_view(con):
    con.execute(f"""
    CREATE OR REPLACE VIEW v_lottery_performance AS
    SELECT f.*, r.master_name, r.city, g.game_name,
        CASE WHEN f.is_revenue THEN f.amount ELSE 0 END as gross_revenue,
        CASE WHEN f.is_revenue THEN (f.amount * COALESCE(f.retailer_commission_rate, 0)) ELSE 0 END as est_retailer_commission,
        CASE WHEN f.is_revenue THEN (f.amount * COALESCE(f.theoretical_payout_rate, 0)) ELSE 0 END as est_payout_liability,
        CASE WHEN f.metric_class = 'payout' THEN f.amount ELSE 0 END as actual_terminal_payout
    FROM {FACT_SALES_TABLE} f
    LEFT JOIN {DIM_RETAILER_TABLE} r ON f.state_code = r.state_code AND f.retailer_id = r.retailer_id
    LEFT JOIN {DIM_GAME_TABLE} g ON f.state_code = g.state_code AND f.game_code = g.game_code
    """)

def print_checks(con):
    print(f"\n--- {STATE_CODE} Normalization Truth Check (Data through {TODAY}) ---")
    
    # Category Performance (Pure State Profit)
    print(f"\n{'Category':<15} | {'Gross Revenue':>15} | {'Est. Comm':>12} | {'Est. Net Profit'}")
    print("-" * 75)
    res = con.execute("""
        SELECT standard_category, SUM(gross_revenue), SUM(est_retailer_commission),
               SUM(gross_revenue) - SUM(est_retailer_commission) - SUM(est_payout_liability) 
        FROM v_lottery_performance WHERE is_revenue = TRUE GROUP BY 1 ORDER BY 2 DESC
    """).fetchall()
    for r in res:
        print(f"{r[0]:<15} | ${r[1]:>14,.2f} | ${r[2]:>11,.2f} | ${r[3]:>14,.2f}")

    # Final Reconciliation
    print("\n--- Final Multi-State Truth Reconciliation ---")
    totals = con.execute("""
        SELECT SUM(gross_revenue), SUM(est_retailer_commission), 
               SUM(est_payout_liability), SUM(actual_terminal_payout) 
        FROM v_lottery_performance
    """).fetchone()
    
    money_in, comm, est_payout, actual_payout = totals
    
    print(f"  1. Total Ticket Volume (Money In):    ${money_in:,.2f}")
    print(f"  2. Total Est. Retailer Commissions:   ${comm:,.2f}")
    print(f"  3. Total Theoretical Prizes Owed:     ${est_payout:,.2f}")
    print(f"  4. Actual Prizes Cashed at Terminal:  ${actual_payout:,.2f}")
    print(f"  5. PURE NET CONTRIBUTION TO STATE:    ${(money_in - comm - est_payout):,.2f}")
    print("-" * 50)
    print(f"  * Note: The 'Pure Net' represents the state's share after prizes and retailer pay.")

def main():
    con = duckdb.connect(str(DB_PATH))
    try:
        print(f"Normalizing {STATE_CODE} (Absolute Truth Model v9)...")
        create_raw_tables(con); build_dimensions(con); build_fact_table(con); create_unified_view(con); print_checks(con)
    finally:
        con.close()

if __name__ == "__main__":
    main()