import os
import csv
import math

# Output folder for synthetic files
OUTPUT_DIR = r"c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\synthetic_trial_balances"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Seasonal curve weights for 12 months (starting April, ending March)
# Monthly sales weights: Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar
SEASONAL_WEIGHTS = [0.08, 0.08, 0.08, 0.085, 0.085, 0.08, 0.08, 0.085, 0.095, 0.08, 0.08, 0.09]
assert abs(sum(SEASONAL_WEIGHTS) - 1.0) < 1e-9

# Detailed game code structures matching California COA prefixing
DRAW_GAMES = ["D3", "D4", "DD", "F5", "HS", "MM", "PB", "SLP"]
DRAW_WEIGHTS = [0.05, 0.03, 0.02, 0.05, 0.10, 0.40, 0.30, 0.05]
assert abs(sum(DRAW_WEIGHTS) - 1.0) < 1e-9

SCRATCHER_GAMES = ["1159", "1200", "1213", "1223", "1234", "1250", "1300", "1350", "1400", "1450", "1460", "1470", "1480", "1490", "1500"]
# Distribute scratcher weight (equal for active games, rest 0)
SCRATCHER_WEIGHTS = [1.0 / len(SCRATCHER_GAMES)] * len(SCRATCHER_GAMES)

# Base audited annual statements data from seed-ny-2025.js
# Formatted as: (account_code, account_name, start_value, end_value)
# Note: Revenues are credit (negative), expenses are debit (positive)
# Assets are debit (positive), liabilities and equity are credit (negative)

# For FY25
FY25_ACCOUNTS = {
    # Balance Sheet (interpolated from FY24 end to FY25 end)
    "1-1200": ("Accounts receivable, net", 418862000.00, 430389000.00),
    "1-1310": ("Instant ticket inventory", 16885000.00, 18496000.00),
    "1-1400": ("Investments", 97160000.00, 78206000.00),
    "1-2200": ("Long-term investments, net", 740498000.00, 618506000.00),
    "1-2300": ("Leases", 18142000.00, 16340000.00),
    "1-2400": ("Capital assets", 501000.00, 1273000.00),
    "1-3000": ("Deferred outflows of resources", 13152000.00, 11824000.00),
    "2-1100": ("Prizes payable", -122110000.00, -129202000.00),
    "2-1010": ("Leases payable", -1702000.00, -1713000.00),
    "2-1150": ("Unclaimed prizes", -434687000.00, -519647000.00),
    "2-1200": ("Due to Lottery Aid to Education", -941780000.00, -623280000.00),
    "2-1000": ("Accounts payable and accrued liabilities", -7045000.00, -7930000.00),
    "2-1300": ("Unearned ticket sales", -8922000.00, -5896000.00),
    "2-1400": ("Compensated absences", -835000.00, -791000.00),
    "2-2400": ("Compensated absences, noncurrent", -168000.00, -159000.00),
    "2-2010": ("Long-term leases payable", -16645000.00, -15144000.00),
    "2-2500": ("Net pension liability", -8845000.00, -6017000.00),
    "2-2600": ("Other postemployment benefits", -58582000.00, -62704000.00),
    "2-2100": ("Long-term prizes payable", -834874000.00, -780841000.00),
    "2-3000": ("Deferred inflows of resources", -12773000.00, -11951000.00),
    "3-1000": ("Invested in capital assets", 0.00, -501000.00),
    "3-1100": ("Restricted for future prizes", -399500000.00, -445613000.00),
    "3-1200": ("Unrestricted", 34241000.00, 63499000.00),
    # Fixed Revenues and Expenses (represented as annual totals)
    "4-3000": ("Investment gain", 0.00, -75673000.00),
    "4-4000": ("Other revenue, net", 0.00, -50328000.00),
    "5-3000": ("Investment expense, net", 0.00, 36297000.00),
    "5-2200": ("Gaming contractor fees", 0.00, 277716000.00),
    "5-2400": ("Instant ticket direct expenses", 0.00, 18757000.00),
    "5-2500": ("Telecommunications expenses", 0.00, 16173000.00),
    "6-4000": ("Marketing and advertising expenses", 0.00, 86500000.00),
    "6-4100": ("Personal service and fringe benefits", 0.00, 27952000.00),
    "6-4200": ("Other administrative costs", 0.00, 5438000.00),
    "6-4300": ("State agency charges", 0.00, 7877000.00),
    "6-4400": ("Amortization - leases", 0.00, 2053000.00),
    "6-4500": ("Depreciation", 0.00, 121000.00),
    "5-2300": ("Required allocation for Lottery Aid to Education", 0.00, 3584491000.00),
    "5-2350": ("Lottery Aid Guarantee", 0.00, 0.00),
}
FY25_SALES = -10255571000.00
FY25_PRIZE = 4751626000.00
FY25_COMM = 1622388000.00

# For FY24
FY24_ACCOUNTS = {
    "1-1200": ("Accounts receivable, net", 455416000.00, 418862000.00),
    "1-1310": ("Instant ticket inventory", 13267000.00, 16885000.00),
    "1-1400": ("Investments", 111023000.00, 97160000.00),
    "1-2200": ("Long-term investments, net", 1309603000.00, 740498000.00),
    "1-2300": ("Leases", 0.00, 18142000.00), # Leases was 0 in FY20
    "1-2400": ("Capital assets", 72000.00, 501000.00),
    "1-3000": ("Deferred outflows of resources", 6047000.00, 13152000.00),
    "2-1100": ("Prizes payable", -136190000.00, -122110000.00),
    "2-1010": ("Leases payable", 0.00, -1702000.00),
    "2-1150": ("Unclaimed prizes", -529612000.00, -434687000.00),
    "2-1200": ("Due to Lottery Aid to Education", -269361000.00, -941780000.00),
    "2-1000": ("Accounts payable and accrued liabilities", -3878000.00, -7045000.00),
    "2-1300": ("Unearned ticket sales", -9879000.00, -8922000.00),
    "2-1400": ("Compensated absences", -1006000.00, -835000.00),
    "2-2400": ("Compensated absences, noncurrent", -203000.00, -168000.00),
    "2-2010": ("Long-term leases payable", 0.00, -16645000.00),
    "2-2500": ("Net pension liability", -3604000.00, -8845000.00),
    "2-2600": ("Other postemployment benefits", -65491000.00, -58582000.00),
    "2-2100": ("Long-term prizes payable", -1048494000.00, -834874000.00),
    "2-3000": ("Deferred inflows of resources", -7228000.00, -12773000.00),
    "3-1000": ("Invested in capital assets", -92000.00, 0.00),
    "3-1100": ("Restricted for future prizes", -255249000.00, -399500000.00),
    "3-1200": ("Unrestricted", -90144000.00, 34241000.00),
    "4-3000": ("Investment gain", 0.00, -71690000.00),
    "4-4000": ("Other revenue, net", 0.00, -12597000.00),
    "5-3000": ("Investment expense, net", 0.00, 44020000.00),
    "5-2200": ("Gaming contractor fees", 0.00, 272731000.00),
    "5-2400": ("Instant ticket direct expenses", 0.00, 16963000.00),
    "5-2500": ("Telecommunications expenses", 0.00, 16418000.00),
    "6-4000": ("Marketing and advertising expenses", 0.00, 79371000.00),
    "6-4100": ("Personal service and fringe benefits", 0.00, 24358000.00),
    "6-4200": ("Other administrative costs", 0.00, 4760000.00),
    "6-4300": ("State agency charges", 0.00, 5948000.00),
    "6-4400": ("Amortization - leases", 0.00, 2530000.00),
    "6-4500": ("Depreciation", 0.00, 14000.00),
    "5-2300": ("Required allocation for Lottery Aid to Education", 0.00, 3775370000.00),
    "5-2350": ("Lottery Aid Guarantee", 0.00, -140000000.00),
}
FY24_SALES = -10549755000.00
FY24_PRIZE = 4917882000.00
FY24_COMM = 1596321000.00

# For FY23 (Scaled from FY24 by 0.96)
FY23_ACCOUNTS = {
    k: (v[0], v[1] * 0.96, v[2] * 0.96) for k, v in FY24_ACCOUNTS.items()
}
FY23_SALES = FY24_SALES * 0.96
FY23_PRIZE = FY24_PRIZE * 0.96
FY23_COMM = FY24_COMM * 0.96


def generate_period_file(year, period_code, date_str, accounts_dict, sales_total, prize_total, comm_total, is_quarter=False, is_annual=False):
    """
    Generates a single trial balance CSV file.
    """
    records = []
    
    # Resolve multiplier for YTD accumulation
    # If monthly period, e.g. P03, it contains the cumulative sum of the first 3 months
    # P01 is month 1, P12 is month 12.
    if is_annual:
        # Annual adjusted is the final P12 closing adjustments, meaning 100% of year YTD
        ytd_factor = 1.0
        bs_factor = 1.0
    elif is_quarter:
        # Q1 = P03 (3/12), Q2 = P06 (6/12), Q3 = P09 (9/12), Q4 = P12 (12/12)
        q_map = {"q1": 3.0/12.0, "q2": 6.0/12.0, "q3": 9.0/12.0, "q4": 1.0}
        ytd_factor = q_map[period_code.lower()]
        bs_factor = q_map[period_code.lower()]
    else:
        # P01 = 1/12, etc. (we accumulate monthly weights for YTD revenue/expenses)
        p_num = int(period_code[1:]) # P01 -> 1
        ytd_factor = sum(SEASONAL_WEIGHTS[:p_num])
        bs_factor = p_num / 12.0

    # 1. Add balance sheet accounts (excluding Cash)
    for code, (name, start, end) in accounts_dict.items():
        # Exclude revenue/expense accounts which are handled separately
        if code.startswith(("4-", "5-", "6-")) and code not in ("4-3000", "4-4000", "5-3000", "5-2200", "5-2400", "5-2500", "6-4000", "6-4100", "6-4200", "6-4300", "6-4400", "6-4500", "5-2300", "5-2350"):
            continue
        # Only do balance sheet accounts (Assets, Liabilities, Equity)
        if code.startswith(("1-", "2-", "3-")) and code != "1-1000":
            # Interpolated value
            val = start + (end - start) * bs_factor
            records.append([code, name, round(val, 2)])

    # 2. Add fixed revenue and expense accounts (YTD cumulative)
    for code, (name, start, end) in accounts_dict.items():
        if code.startswith(("4-", "5-", "6-")) and code not in ("4-3000", "4-4000", "5-3000", "5-2200", "5-2400", "5-2500", "6-4000", "6-4100", "6-4200", "6-4300", "6-4400", "6-4500", "5-2300", "5-2350"):
            continue
        if code.startswith(("4-", "5-", "6-")):
            val = end * ytd_factor
            records.append([code, name, round(val, 2)])

    # 3. Add detailed Sales, Prize, and Commission rows
    # Draw Games Sales
    ytd_draw_sales = sales_total * 0.40 * ytd_factor
    for game, weight in zip(DRAW_GAMES, DRAW_WEIGHTS):
        g_sales = ytd_draw_sales * weight
        records.append(["4-1000", f"Sales - Draw Games Sales (40000-00-00-0000-{game})", round(g_sales, 2)])

    # Scratcher Sales
    ytd_scratcher_sales = sales_total * 0.60 * ytd_factor
    for game, weight in zip(SCRATCHER_GAMES, SCRATCHER_WEIGHTS):
        g_sales = ytd_scratcher_sales * weight
        records.append(["4-1000", f"Sales - Scratchers Sales (40100-00-00-0000-{game})", round(g_sales, 2)])

    # Draw Games Prizes
    ytd_draw_prizes = prize_total * 0.40 * ytd_factor
    for game, weight in zip(DRAW_GAMES, DRAW_WEIGHTS):
        g_prizes = ytd_draw_prizes * weight
        records.append(["5-2000", f"Prize Expense - Draw Games Prize Expense (64101-00-00-0000-{game})", round(g_prizes, 2)])

    # Scratcher Prizes
    ytd_scratcher_prizes = prize_total * 0.60 * ytd_factor
    for game, weight in zip(SCRATCHER_GAMES, SCRATCHER_WEIGHTS):
        g_prizes = ytd_scratcher_prizes * weight
        records.append(["5-2000", f"Prize Expense - Scratchers Prize Expense (64100-00-00-0000-{game})", round(g_prizes, 2)])

    # Draw Games Commissions
    ytd_draw_comm = comm_total * 0.40 * ytd_factor
    for game, weight in zip(DRAW_GAMES, DRAW_WEIGHTS):
        g_comm = ytd_draw_comm * weight
        records.append(["5-2100", f"Retailer Commission - Draw Games Retailer Commission (64201-00-00-0000-{game})", round(g_comm, 2)])

    # Scratcher Commissions
    ytd_scratcher_comm = comm_total * 0.60 * ytd_factor
    for game, weight in zip(SCRATCHER_GAMES, SCRATCHER_WEIGHTS):
        g_comm = ytd_scratcher_comm * weight
        records.append(["5-2100", f"Retailer Commission - Scratchers Retailer Commission (64200-00-00-0000-1459)", round(g_comm, 2)])

    # 4. Add Virtual Cash Flow accounts (sum to 0.00)
    # Define start/end cash flow values for FY25
    # (Yes, cash flow is also scaled proportionally for months)
    cf_data = {
        "cf-receipts": ("Cash received from net lottery revenue", -10266027000.00, -10508261000.00, -10087930560.00),
        "cf-other-receipts": ("Other cash receipts", -50328000.00, -12597000.00, -12093120.00),
        "cf-prizes": ("Cash payments for prizes", 4772052000.00, 4997180000.00, 4797292800.00),
        "cf-commissions": ("Cash payments for commissions", 1622521000.00, 1596347000.00, 1532493120.00),
        "cf-contractor": ("Cash payments for contractor fees", 277229000.00, 271369000.00, 260514240.00),
        "cf-telecom": ("Cash payments for telecommunications", 16173000.00, 16418000.00, 15761280.00),
        "cf-instant": ("Cash payments for instant ticket direct expenses", 21592000.00, 17676000.00, 16968960.00),
        "cf-admin": ("Cash payments for other operating expenses", 129975000.00, 129371000.00, 124196160.00),
        "cf-education": ("Cash transfer to State for Lottery Aid to Education", 3902991000.00, 3335992000.00, 3202552320.00),
        "cf-capital": ("Purchases of capital assets, net of disposals", 894000.00, 503000.00, 482880.00),
        "cf-inv-mat": ("Proceeds from investment maturities", -404349000.00, -94230000.00, -90460800.00),
        "cf-inv-purch": ("Purchases of investments", 254469000.00, 3538000.00, 3396480.00),
        "cf-inv-int": ("Interest on cash and cash equivalents and investments", -67848000.00, -79685000.00, -76497600.00),
    }

    # Select the right annual benchmark cash flow
    cf_records = []
    cf_sum = 0.0
    for code, (cf_name, fy25_v, fy24_v, fy23_v) in cf_data.items():
        if year == 2025:
            annual_val = fy25_v
        elif year == 2024:
            annual_val = fy24_v
        else:
            annual_val = fy23_v
        
        ytd_val = annual_val * ytd_factor
        cf_records.append([code, cf_name, round(ytd_val, 2)])
        cf_sum += round(ytd_val, 2)

    # Offset to balance cash flows exactly to 0.00
    cf_records.append(["cf-offset", "Cash Flow balance sheet offset", round(-cf_sum, 2)])
    records.extend(cf_records)

    # 5. Add Cash and cash equivalents (1-1000) as the balancing figure
    # Sum of all records added so far:
    total_non_cash = sum(r[2] for r in records)
    cash_val = -total_non_cash
    
    # Insert Cash at the top of the list (just like standard TBs)
    records.insert(0, ["1-1000", "Cash and cash equivalents", round(cash_val, 2)])

    # Double check that the file balances perfectly to 0.00
    final_sum = sum(r[2] for r in records)
    assert abs(final_sum) < 0.05, f"Ledger unbalanced! Sum: {final_sum}"

    # Write to CSV
    filename = f"ny_tb_fy{year}_{period_code.lower()}.csv"
    filepath = os.path.join(OUTPUT_DIR, filename)
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["Account Code", "Account Name", "Balance"])
        writer.writerows(records)
    
    print(f"Generated balanced file: {filename} (Sum: {final_sum:.2f}, Cash: {cash_val:,.2f})")


def main():
    # Helper to map period index to calendar date string
    def get_date_str(year, code):
        period_month_map = {
            "P01": {"month": "04", "day": "30"},
            "P02": {"month": "05", "day": "31"},
            "P03": {"month": "06", "day": "30"},
            "P04": {"month": "07", "day": "31"},
            "P05": {"month": "08", "day": "31"},
            "P06": {"month": "09", "day": "30"},
            "P07": {"month": "10", "day": "31"},
            "P08": {"month": "11", "day": "30"},
            "P09": {"month": "12", "day": "31"},
            "P10": {"month": "01", "day": "31"},
            "P11": {"month": "02", "day": "28"},
            "P12": {"month": "03", "day": "31"},
            "P13": {"month": "03", "day": "31"},
        }
        mapped = period_month_map[code]
        date_year = year if code in ["P10", "P11", "P12", "P13"] else year - 1
        return f"{date_year}-{mapped['month']}-{mapped['day']}"

    years_config = [
        (2023, FY23_ACCOUNTS, FY23_SALES, FY23_PRIZE, FY23_COMM),
        (2024, FY24_ACCOUNTS, FY24_SALES, FY24_PRIZE, FY24_COMM),
        (2025, FY25_ACCOUNTS, FY25_SALES, FY25_PRIZE, FY25_COMM),
    ]

    for year, accounts, sales, prize, comm in years_config:
        print(f"\n--- Generating FY {year} Ledgers ---")
        
        # Generate 12 monthly files (P01 - P12)
        for i in range(1, 13):
            p_code = f"P{i:02d}"
            date_str = get_date_str(year, p_code)
            generate_period_file(year, p_code, date_str, accounts, sales, prize, comm, is_quarter=False, is_annual=False)
        
        # Generate 4 quarterly files (Q1 - Q4)
        for q in range(1, 5):
            q_code = f"Q{q}"
            # Q1 corresponds to P03, Q2 to P06, Q3 to P09, Q4 to P12
            p_mapped = f"P{q*3:02d}"
            date_str = get_date_str(year, p_mapped)
            generate_period_file(year, q_code, date_str, accounts, sales, prize, comm, is_quarter=True, is_annual=False)
            
        # Generate 1 year-end Annual file (Annual)
        date_str = get_date_str(year, "P12")
        generate_period_file(year, "Annual", date_str, accounts, sales, prize, comm, is_quarter=False, is_annual=True)

if __name__ == "__main__":
    main()
