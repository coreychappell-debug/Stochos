# Stochos — Internal Financial Model & Compensation Guide

**Last Updated:** 2026-05-26  
**Audience:** Internal Team Only (Corey, Caitlin, Tyler)  
**Purpose:** Documents the internal equity-split mechanism, partner compensation, labor burden calculations, and billing markup strategies.

> [!WARNING]
> **Strictly Confidential.** This document contains proprietary financial formulas, internal cost rates, and profit-sharing logic. Do not share this document with clients, vendors, or external parties.

---

## 1. Partner Compensation & Profit Sharing
*   **Initial Bootstrapping Phase:** Partners (Corey, Caitlin, Tyler) contribute sweat equity to build the platform intellectual property and secure the first contracts.
*   **Operating Revenue Flow:** All client setup fees, annual subscription revenues, and research contract payments are deposited into the Stochos business bank account.
*   **Cash Reserves Policy:** Before any distributions are paid, a standard cash reserve (e.g., 20% of net revenue) is withheld to fund infrastructure scaling (GCP hosting), software licenses, legal overhead, and tax obligations.
*   **Partner Distributions:** Net profit (remaining after operating costs and reserves) is distributed to the partners as dividends or draws, determined by agreed equity split percentages.

---

## 2. Fully Burdened Labor Math
When hiring external support or estimating project budgets, Stochos uses a **2.0x Burden Multiplier** to translate raw hourly wages into the actual cost borne by the company.

$$\text{Fully Burdened Cost} = \text{Hourly Wage} \times 2.0$$

The 2.0x multiplier accounts for:
*   **Payroll Taxes:** FICA, FUTA, and state unemployment taxes (SUTA).
*   **Benefits & Overhead:** Health insurance, retirement matching, workstation equipment, and software licenses (Slack, GitHub, RStudio Server, GCP developer seats).
*   **Non-Billable Hours:** Time spent on administration, internal meetings, training, holidays, and paid time off (PTO).

### Illustrative Comparison (Base Pay vs. Burdened Cost)
*   **Base Hourly Pay:** $75.00 / hour
*   **Burdened Cost to Stochos:** **$150.00 / hour**

---

## 3. Client Billing Rate & Markup Strategy
To ensure Stochos remains profitable and generates capital, our **Billing Rate** to the client must include a healthy profit margin (typically 30% to 50%) on top of the burdened cost:

$$\text{Client Billing Rate} = \text{Burdened Cost} \times 1.4 \text{ to } 2.0$$

### Scenario A: Partner Research Labor
*   **Partner Base Equivalent Pay:** $75 / hour (burdened to $150 / hour)
*   **Client Billing Rate:** **$250 / hour**
*   **The Margin:** The $100/hour difference represents company profit. It flows directly into the partner distribution pool.

### Scenario B: Future Hourly Hires
*   **Hourly Contractor Pay:** $50 / hour
*   **Burdened Cost to Stochos:** $100 / hour
*   **Client Billing Rate:** **$175 to $200 / hour**
*   **The Margin:** Stochos retains **$75 to $100/hour** in net profit off the contractor's labor. This allows the business to scale its revenue beyond the founders' personal working hours.

---

## 4. Illustrative Contract Estimation Template
When estimating a custom research contract (SOW) of **80 hours** of analytical effort:
*   **Developer/Analyst Base Wages:** $6,000 (80 hours × $75/hr)
*   **Fully Burdened Cost:** $12,000 (80 hours × $150/hr)
*   **Client Project Price (at $250/hr billing rate):** **$20,000**
*   **Net Profit Margin to Stochos:** **$8,000 (40%)**
