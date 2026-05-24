# Illustrative Model Assumptions — Scratch Price Point Analytics (v2)

## Purpose

This document describes the assumptions used to generate the illustrative scratch price-point analytics layer in the Stochos NY Executive Dashboard.

These outputs appear **only** in Full Capability / Illustrative mode and are clearly labeled as synthetic.

---

## What Is Real (Preserved Exactly)

| Data Element | Source |
|-------------|--------|
| Statewide total scratch sales | `v_unified_lottery_truth`, game code `ig_settles` |
| County-level scratch totals | Aggregated from observed retailer sales |
| City-level scratch totals | Aggregated from observed retailer sales |
| Retailer-level scratch totals | `mart_exec_retailer_mix.scratch_revenue` |
| Business type classifications | Source data (`BUSTYPE` field) |
| Retailer geography | Source data (city, county, lat/lon) |

**These values are preserved exactly.** No synthetic logic changes observed totals.

---

## What Is Synthetic (Modeled)

### 1. Unit-Based Allocation

The model allocates **units sold** using a bell-shaped distribution centered at $5, then derives revenue as `units × price`. This preserves the revenue total exactly because unit shares sum to 1.0.

**Baseline Unit Distribution:**

| Price Point | Unit Share | Tier |
|------------|-----------|------|
| $1 | 8% | Low |
| $2 | 12% | Low |
| $3 | 18% | Low |
| $5 | **28%** (peak) | Core |
| $10 | 16% | Core |
| $20 | 10% | Premium |
| $30 | 8% | Premium |

The unit distribution is bell-shaped by design. Revenue naturally shifts toward higher price points because revenue = units × price.

### 2. Template Multiplier System

Five retailer archetypes adjust the baseline using multipliers (not fixed shares), then re-normalize to sum to 1.0. This preserves the bell shape while shifting weight.

| Template | $1 | $2 | $3 | $5 | $10 | $20 | $30 | Assignment |
|----------|-----|-----|-----|-----|------|------|------|-----------|
| Convenience Heavy | 1.2× | 1.1× | 1.05× | 1.0× | 0.9× | 0.7× | 0.6× | Liquor, deli, newsstand, tobacco |
| Balanced | 1.0× | 1.0× | 1.0× | 1.0× | 1.0× | 1.0× | 1.0× | Default (unmatched business types) |
| Premium Skew | 0.7× | 0.8× | 0.9× | 1.0× | 1.15× | 1.25× | 1.3× | Drug store, dept store, hotel |
| Value Heavy Rural | 1.3× | 1.2× | 1.1× | 1.05× | 0.8× | 0.4× | 0.2× | Gas station, farm, hardware |
| High Performance | 0.9× | 0.95× | 1.0× | 1.05× | 1.05× | 1.1× | 1.1× | Top-quartile sales volume |

### 3. Payout Model (Normalized)

Per-price-point base rates, then **normalized** so total payout matches the observed prize expense target.

| Price Point | Base Payout Rate |
|------------|-----------------|
| $1 | 55% |
| $2 | 56% |
| $3 | 57% |
| $5 | 58% |
| $10 | 60% |
| $20 | 62% |
| $30 | 64% |

**Normalization process:**
1. Calculate raw payout per price point: `revenue × base_rate`
2. Sum total raw payout
3. Calculate observed total prize expense: `scratch_revenue × 0.58`
4. Scale factor = target / raw_total
5. Adjusted payout = raw × scale_factor

This ensures total payout reconciles exactly to the observed target.

**Global target payout rate:** 58% (industry-consistent, conservative)

### 4. Commission

Retailer commission: **6%** flat across all price points (standard NY rate).

### 5. Net Contribution

`net_contribution = gross_revenue − prize_expense − retailer_commission`

`contribution_rate = net_contribution / gross_revenue`

---

## Reconciliation Guarantees

### Revenue

```
sum(price_point_revenue per retailer) = observed scratch revenue
```
Enforced: script halts if delta > $1.00.

### Payout

```
sum(price_point_payout) = observed_scratch_revenue × 0.58
```
Enforced: warning if delta > $1.00.

### Distribution Shape

```
Peak unit share must be at $5
```
Enforced: `stopifnot(peak_pp == 5)`.

---

## Price Point Tiers

| Tier | Price Points | Typical Role |
|------|-------------|-------------|
| Low | $1, $2, $3 | High margin rate, low absolute revenue per ticket |
| Core | $5, $10 | Balanced — primary volume and contribution drivers |
| Premium | $20, $30 | Volume revenue drivers, thinner contribution margins |

---

## What This Shows (and Doesn't)

**Shows**: What price-point analytics look like when product-level sales data is integrated. The structural patterns (bell-shaped unit distribution, contribution rate declining with ticket price, geographic mix variation) are directionally realistic and consistent with published lottery industry mechanics.

**Does NOT show**: Actual NY Lottery scratch product sales by price point. The specific mix percentages are modeled, not observed.

---

## Generation

- **Script**: `NY_Exec_Dashboard_Illustrative_Marts.r`
- **Method**: Unit-based allocation → revenue derivation → payout normalization
- **Granularity**: Lifetime aggregate per retailer (no synthetic time series)
- **Reconciliation**: Exact revenue match + normalized payout match

---

*This document should be reviewed whenever the illustrative model logic is modified.*
