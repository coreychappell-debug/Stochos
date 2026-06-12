# Stochos — Commercial Model & Sales Talking Points

**Last Updated:** May 31, 2026  
**Audience:** Sales Team & Prospective Clients  
**Purpose:** Outlines the commercial pitching strategy, licensing structure, and billing model for state lottery agencies.

---

## 1. The Risk-Free Integration Guarantee
*   **The Talking Point:** *"We do not bill you for subscription services until the platform is fully connected to your data environment and verified functional."*
*   **The Problem It Solves:** Government IT projects frequently run over-budget and stall during the database integration phase. This guarantee removes procurement risk and builds immediate trust.
*   **How it Works:** 
    *   A one-time **Setup & Integration Fee** is billed upfront to cover custom Socrata/ERP data connection and FOMO route imports.
    *   Annual subscription billing for the software begins *only* after a successful **Go-Live Milestone** (e.g., 14 consecutive days of verified data synchronization).

## 2. The Stochos Modular Product Suite
*   **The Talking Point:** *"Adopt at your own pace. Select only the modules your agency needs today, and activate advanced operations, forecasting, or logistics when your team is ready."*
*   **The Core Pillars & Modules:**

### A. Executive Administration & Financial Control
*   **Contract Lifecycle Management (CLM):** Track contracts, deliverables, line-item budgets vs. actual spend, compliance document expirations, and multi-tier approval workflows with secure division-level gating.
*   **Governed Financial & Performance Administration (GFPA):** A powerful alternative to Workiva for lotteries. Finance teams drag-and-drop raw Trial Balance exports into a visual ETL pipeline, linking them to a centralized Metric Registry (Gross Sales, Game-Level Prize Expense, Benefactor Transfers) for audited board-packet generation.
*   **Vendor & Product Registry:** A unified database mapping vendors to their approved product catalogs (Draw & Scratch games), linking procurement documents directly to live operational items.
*   **Fleet & IT Asset Management:** Operational tracking for hardware assets and vehicle fleets, complete with maintenance logs and automated straight-line depreciation schedules.
    *   **Avery-Compatible Barcode & QR Code Tag Generator:** Generate bulk sticker sheets matching Avery 5163 layouts (or compatible templates 5263, 5963, 8163, etc.) directly from the dashboard.
    *   **Deep-Link Smartphone Audits:** Print tags with 2D QR codes that encode unique dynamic URLs. Field reps scan stickers to instantly launch the asset uploader context on their phones without searching or logging into complex systems.
    *   **High-Volume Folder Ingestion:** Drag-and-drop hundreds of photos at once. Stochos reads client-side geolocations, ignores invalid/HEIC files to save storage space, and runs matching scripts in parallel chunks with built-in corporate proxy retry fallbacks.
    *   **Three-Tier Verification Audits:** Separate asset compliance into `[Fully Verified]` (tag scan matches), `[Presence Verified]` (GPS location matched and correct store count verified, resolving blurry or unreadable photos automatically), and `[Pending]`.

### B. Retail Operations & Marketing Excellence
*   **Instant Ticket Planner & Budgetary Tool:** An interactive, local-first PWA for modeling scratcher game portfolios. Rapidly design game mixes, configure multi-vendor printing cost models (per-thousand vs. percentage of sales), calculate margins, apply upcharges for custom features (foil, holographic), and generate procurement-ready purchase orders.
*   **Field Operations, Merchandising & Oversight (FOMO) with Proprietary Hybrid Territory Balancer:** 
    *   **Route Optimization:** Optimizes retail sales by allowing field reps to manage store directories, schedule efficient visit routes, log on-site audits, and track physical inventory. Sequenced using a local OSRM road travel routing matrix and a Traveling Salesperson Problem (TSP) solver (Nearest Neighbor + 2-opt refinement).
    *   **The Mixed-Zone Balancing Engine (The "Friction Solver"):** Traditional software fails in mixed-density jurisdictions (such as Buffalo or Upstate NY) because it balances either *purely* by store counts or *purely* by geographical distance. Stochos uses a **dynamic, triple-variable cost function** that blends driving time, workload density, and sales potential.
    *   **Adjusted Workload (Friction-Index) modeling:** Instead of a naive store count, the system calculates workload as `Visit Duration + Transit Overhead`. A representative covering a sparse rural area may be assigned 90 stores, while an urban representative covers 180 stores—yet both represent an identical 40-hour work week. This maximizes geographical compactness, eliminates travel time penalties, and guarantees fair representative workload equity.
    *   **B2B SaaS Horizon:** By balancing travel time, work friction, and sales potential visually on a map, the tool transitions from a niche lottery utility to a high-value horizontal B2B SaaS platform that can be licensed to any CPG distribution, medical sales, or field services organization.
*   **Marketing Resource Management (MRM):** Orchestrates multi-channel campaign planning, tracks advertising media placements, and attributes marketing spend directly to performance metrics.

### C. Analytics, Logistics & Risk Intelligence
*   **Executive Dashboard & Performance Portal:** A unified hub displaying high-level operational KPIs, real-time alerts, and quick navigation across all active business segments.
*   **Spatial Operations, Logistics & Risk (SOLR):** Links GIS geocoding with active weather and seismic alerts to map retail locations, assess risk proximity, and coordinate crisis logistics. Built on standard parameterized spatial queries with automated pipeline telemetry checks to prevent data stagnation or parser failures.
*   **Custom Research SOWs:** Deep-dive forecasting models (e.g., GAM spline jackpot sensitivity or jackpot fever tracking) and customized econometric reports built on top of the agency's DuckDB warehouse.

## 3. Unlimited User Licensing (No "Seat Tax")
*   **The Talking Point:** *"Stochos is licensed by jurisdiction, not by user. Your regional sales reps, agency executives, and external media buyers can all collaborate without seat-based fees."*
*   **The Benefit:** Encourages wide organizational adoption across marketing, procurement, sales, and executive leadership without the friction of license limits.

## 4. Enterprise-Grade Accessibility Compliance (Global Reach)
*   **The Talking Point:** *"Stochos is built from the ground up to meet strict global accessibility standards, ensuring procurement readiness out of the box."*
*   **The Problem It Solves:** Government IT procurement processes mandate accessibility compliance. Without it, software adoption is often blocked. Stochos removes this procurement friction.
*   **The Standards Met:**
    *   **WCAG 2.1 AA:** Fully compliant baseline for keyboard navigability, screen readers, and high-visibility focus indicators across both modern web apps and legacy dashboards.
    *   **United States:** ADA (Americans with Disabilities Act) and Section 508 compliant, crucial for state and federal lottery RFPs.
    *   **European Union:** Aligns with the EN 301 549 standard and the EU Web Accessibility Directive.
    *   **Greater Asia & Beyond:** Because WCAG 2.1 AA serves as the internationally recognized gold standard, Stochos is equipped to clear localized compliance reviews in mature markets worldwide.

---

## Illustrative Pricing Structure

| Module / Component | Billing Structure | What it Covers |
| :--- | :--- | :--- |
| **Setup & Integration** | One-time Fee | Ingest pipeline setup, ERP/Socrata database connection, custom schema mapping, historical data import, and user onboarding. |
| **Stochos Core Suite (Contracts, Vendors, Products)** | Annual Subscription | Web platform hosting, secure auth/RBAC, contract tracking, vendor registry, and product catalog. |
| **Governed Financials (GFPA)** | Annual Subscription (Add-on) | Trial Balance visual ETL pipelines, commentary rules engine, metric registry, and XBRL lottery-specific benchmarking. |
| **Instant Ticket & Budget Planner** | Annual Subscription (Add-on) | The local-first planning PWA, vendor cost matrices, upcharge calculators, and PO export tools. |
| **Field Ops (FOMO) & MRM** | Annual Subscription (Add-on) | Field rep routing, retail visit audits, merchandise inventory tracking, and campaign planners. |
| **Spatial Ops & Logistics (SOLR)** | Annual Subscription (Add-on) | Real-time meteorological/hazard feeds, geolocated risk analysis maps, and terminal logistics monitors. |
| **Custom Research SOWs** | Fixed-Price / Hourly | Bespoke forecasting, GAM jackpot modeling, demographic analysis, and expert analyst consulting. |
