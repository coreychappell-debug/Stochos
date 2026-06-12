# Stochos Platform: New York Lottery Trial Balance Testing Guide & Operational Manual

This guide outlines the structure, design, and step-by-step verification procedures for the **Stochos Governed Financials (GFPA) module** using synthetic, double-entry balanced Trial Balance (GL) files matching the audited financial scales of the New York State Lottery (NYSGC Division of the Lottery) for Fiscal Years 2023, 2024, and 2025.

---

## 1. The Synthetic New York Lottery Chart of Accounts (COA)

To enable advanced sub-ledger testing, by-game rollups, and compliance audits, our synthetic files utilize the **California Lottery detailed account code structure** embedded within the official **New York State Lottery accounting classifications**.

### A. Account Types & Signage Standards
Under standard double-entry accounting rules, accounts are grouped by code prefixes and utilize standard sign conventions:

| Code Range | Account Type | Normal Balance | Balance Sign in CSV |
| :--- | :--- | :--- | :--- |
| **`1-XXXX`** | Assets (Cash, Receivables, Investments) | Debit | **Positive (`+`)** |
| **`2-XXXX`** | Liabilities (Prizes Payable, Due to Education) | Credit | **Negative (`-`)** |
| **`3-XXXX`** | Net Position / Equity (Unrestricted, Restricted) | Credit | **Negative (`-`)** |
| **`4-XXXX`** | Revenues (Ticket Sales, Investment Gains) | Credit | **Negative (`-`)** |
| **`5-XXXX`** | Direct Expenses (Prize Payouts, Commissions, Contractor Fees) | Debit | **Positive (`+`)** |
| **`6-XXXX`** | Indirect / Overhead Expenses (Salaries, Marketing, G&A) | Debit | **Positive (`+`)** |

### B. Detailed Game Suffix Mappings
For revenues (`4-1000`), prize expenses (`5-2000`), and retailer commissions (`5-2100`), the `Account Name` column includes the sub-ledger code in parentheses to test pipeline transformation rules:

*   **Draw Games (Prefix `40000` for sales, `64101` for prizes, `64201` for commissions):**
    *   `D3` (Daily 3)
    *   `D4` (Daily 4)
    *   `DD` (Daily Derby)
    *   `F5` (Fantasy 5)
    *   `HS` (Hot Spot)
    *   `MM` (Mega Millions)
    *   `PB` (Powerball)
    *   `SLP` (SuperLotto Plus)
*   **Scratchers Games (Prefix `40100` for sales, `64100` for prizes, `64200` for commissions):**
    *   Represented by fifteen active games (e.g., `1159`, `1200`, `1213`, ..., `1500`).

*Example CSV Rows:*
```csv
Account Code,Account Name,Balance
1-1000,Cash and cash equivalents,1461588170.00
4-1000,Sales - Draw Games Sales (40000-00-00-0000-MM),-164089136.00
5-2000,Prize Expense - Draw Games Prize Expense (64101-00-00-0000-MM),75973270.00
5-2100,Retailer Commission - Draw Games Retailer Commission (64201-00-00-0000-MM),25926088.00
```

### C. Statement of Cash Flows Virtual Accounts (Prefix `cf-`)
To populate the **Statement of Cash Flows** in the GASB 34 dashboard, the trial balance files contain virtual cash flow offset records (starting with `cf-`). These track YTD inflows (credits, negative) and outflows (debits, positive) and sum to exactly `$0.00` within each file.

---

## 2. Double-Entry Balancing & Roll-Forward Mechanics

A fundamental rule of the Stochos Data Prep Studio is that **every trial balance uploaded must balance to exactly $0.00 net sum**. If a file is out of balance by even one cent, the system flags it as **Out of Balance** and blocks period locking to prevent corrupt data entry.

### How the Generator Achieves Perfect Balancing:
1.  **Revenue Seasonality:** Monthly revenues are distributed using a historical seasonal lottery curve (higher sales in December/March, standard volumes in summer).
2.  **Expense Variables:** Prize expenses, commissions, and gaming contractor fees are computed as a percentage of sales, while overhead expenses (salaries, G&A) are divided evenly across 12 months.
3.  **Balance Sheet Roll-Forward:** Balance sheet accounts are interpolated from their starting values (ending values of the prior year) to their ending audited values.
4.  **Cash as the Balancing Figure:** Cash is dynamically calculated as the negative sum of all other accounts:
    $$Cash = - \sum (OtherAssets + Liabilities + NetPosition + YTDRevenues + YTDExpenses)$$
    This guarantees that every generated file sums to exactly `0.00` and cash rolls forward realistically month-over-month.

---

## 3. Ingested Data Baseline (The First 24 Periods)

To save you time, we have programmatically ingested the baseline data for **FY 2023** (12 months + Annual) and **FY 2024** (12 months + Annual). This establishes a full historical trend.

### Programmatic Ingestion Log:
*   The script `import_first_24.js` uploaded these 26 files sequentially to the platform API.
*   You will see these batches marked as `complete` and their validation statuses as `passed` in the **Data Prep Studio** history.
*   The historical comparisons in the YoY reports and GASB 34 statements are now fully functional and populated with this baseline data.

---

## 4. Step-by-Step Manual Ingestion Testing (The Last 12 Periods)

You will test the system's operational readiness by manually uploading the **12 monthly periods of FY 2025** (April 2024 to March 2025), along with the corresponding quarterly and annual files.

### Step 4.1: Locate the Generated Files
All synthetic trial balance files are saved in the New York folder under:
`c:\Users\corey\Downloads\Corey - Code Stuff\R Server Project folder\New York Scripts and Process\synthetic_trial_balances\`

Filenames follow the convention:
*   Monthly: `ny_tb_fy2025_p01.csv` (April) through `ny_tb_fy2025_p12.csv` (March)
*   Quarterly: `ny_tb_fy2025_q1.csv` through `ny_tb_fy2025_q4.csv`
*   Annual Year-End: `ny_tb_fy2025_annual.csv`

### Step 4.2: Upload a Monthly Period
1. Open the Stochos platform in your browser (typically `http://localhost:3000`).
2. Click **Data Prep Studio** in the sidebar.
3. In the top filter bar, ensure the settings are:
   * **Jurisdiction:** `New York Lottery`
   * **Fiscal Year:** `2025`
   * **Period:** `Period 1 (April)`
4. Review the status card. It should show **No Active Ledger** or **Unlocked**.
5. Drag and drop the file `ny_tb_fy2025_p01.csv` into the upload card.
6. Click **Ingest Trial Balance**.
7. **Verify Ingest Success:**
   * A success alert should appear indicating that 69 records were imported.
   * The **Double-Entry Audit** status card should change to **Balanced ($0.00)**.
   * The ledger table below will load, displaying the imported accounts.

### Step 4.3: Test Period Locking
1. After uploading P01 and verifying it is balanced, look at the status card in the Data Prep Studio.
2. Click **Lock Period**.
3. **Verify Lock Enforcement:**
   * The status changes to **Locked (Ready for Reporting)**.
   * The upload card is disabled.
   * Attempt to drop a file or click upload; the system should block the action with a lock notification.
   * This ensures that historical accounting periods cannot be modified once approved.

### Step 4.4: Test Adjusting Journal Entries (Out of Balance Enforcement)
To test how the system handles unbalanced ledgers and adjusting entries:
1. Open the file `ny_tb_fy2025_p02.csv` in a text editor.
2. Edit the balance of any line to make it unbalanced (e.g., change Cash balance by adding `$100.00`). Save the file.
3. In Stochos, select **Period 2 (May)** in the top bar.
4. Upload your modified, unbalanced `ny_tb_fy2025_p02.csv`.
5. **Verify Double-Entry Rejection:**
   * The system will ingest the file, but the status card will show a red warning: **Out of Balance ($100.00)**.
   * The **Lock Period** button is disabled, blocking period close.
6. **Post an Adjusting Entry:**
   * Scroll down to the **Adjusting Journal Entries** section.
   * Add a new row to correct the offset:
     * **Account Code:** `6-4200` (G&A Overhead)
     * **Account Name:** `Audit Adjustment`
     * **Balance:** `-100.00`
   * Click **Post Adjustment**.
   * The **Double-Entry Audit** status will recalculate, return to **Balanced ($0.00)**, and the **Lock Period** button will become enabled.

### Step 4.5: Verify Dashboard Financial Statements
Once you have uploaded several periods of FY 2025, verify that the reporting views update dynamically:
1. Click **GASB 34 Statements** in the sidebar (or navigate to `/reporting/gasb34`).
2. Select **Fiscal Year 2025** and **Period 3 (June)** or **Period 12 (March)**.
3. Verify that the:
   * **Statement of Net Position** displays Cash, AR, Liabilities, and Net Position correctly.
   * **Statement of Revenues & Expenses** displays sales, prizes, commissions, and the required education allocation.
   * **Statement of Cash Flows** displays receipts and payments.
   * The prior year comparison columns display the correct FY 2024 audited numbers.

---

## 5. Contact & Support
For issues with database connections, ensure your local PostgreSQL database is running on port `5433` and the `.env` file matches the connection string.
