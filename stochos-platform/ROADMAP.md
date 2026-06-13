# Stochos Platform Future Roadmap & Backlog

This document outlines key technical items, feature improvements, and completed milestones of the Stochos Platform.

## 1. Asset & Fleet Inventory Improvements

### 1.1 Simplified Data Entry for Assets [COMPLETED]
- **Objective:** Streamline the registration of large volumes of physical and IT assets to reduce manual data-entry overhead.
- **Implementation:**
  - Dynamic CSV template generator (`/api/assets/template`) providing database-referenced guidelines.
  - CSV drag-and-drop validation endpoint (`/api/assets/validate`) reporting errors at cell-level.
  - Interactive **Import Sandbox** spreadsheet view (`activeView === "sandbox"`) in the client with inline cell-editing and local validator re-runs to resolve conflicts dynamically.

### 1.2 Physical Asset Tag Printing [COMPLETED]
- **Objective:** Enable generating and printing physical barcode/QR labels from registered asset tags so they can be affixed to hardware.
- **Implementation:**
  - Avery 5163 Vector Barcode Sticker Compiler endpoint (`/api/assets/print-tags`) drawing direct high-resolution Code 39 barcode vectors using PDFKit graphics paths.
  - Dynamic QR code vector printing options to redirect scanner cameras to mobile-friendly route audit checks.
  - Multi-select "Print Tags" action bars.

### 1.3 Asset Segregation & Consolidated Reporting Rollup [COMPLETED]
- **Objective:** Separate asset tracking screens by organizational ownership (e.g., IT manages computers, Operations manages vehicles), while maintaining a consolidated administrative overview.
- **Implementation:**
  - Added `deploymentType` (retail vs. office) and relation queries (`orgUnitId` vs. `retailerId`) to `schema.prisma`.
  - Added client-side dropdown filters and DOM pagination to `AssetsClient.js` preventing rendering lag.
  - Created 10-Year projected Capital Expenditure (CapEx) timelines under the `forecasting` tab.

---

## 2. Platform & Enterprise Controls

### 2.1 Enterprise Administrator Roles & Permissions [COMPLETED]
- **Objective:** Allow state/jurisdiction leads (such as an IT lead or Contracts Unit representative) to manage access permissions for their team members.
- **Implementation:**
  - Database role-permission grids and user personnel update forms in `OrganizationClient.js`.
  - Strict security audit logging endpoints (`/api/organization/audit`) with old/new change diff visualizers.
  - Platform-wide **Audit Log Foreign Key Safety** query extension in `lib/db.js` preventing session cookie mismatches from crashing API writes.

---

## 3. Financial Ingestion & Statutory Reporting

### 3.1 Trial Balance CSV Ingestion & Dynamic Calendars [COMPLETED]
- **Objective:** Streamline the importing of trial balances and dynamically adapt the dashboard reporting views to each jurisdiction's configuration.
- **Implementation:**
  - Automated CSV direct trial balance validator and parser (`/api/reporting/upload`).
  - Dynamic selector helpers that load calendar periods on-the-fly depending on the jurisdiction's `startMonth`.

### 3.2 Government Statutory Financial Statement Compiler (GASB 34) [COMPLETED]
- **Objective:** Enable automated reporting output matching GASB 34 and ACFR standards.
- **Implementation:**
  - Compiled and balanced Statement of Net Position, Revenues/Expenses/Changes, and Statement of Cash Flows (HTML previews).
  - Landscape multi-page PDF compilation engine `/api/reporting/gasb34/export-pdf` utilizing direct accounting grids, double-line total underlines, and negative value bracket maps.

---

## 4. VCRM Field Sales & Route Optimization APIs

### 4.1 Automated Territory Balancing & Fleet Routing [COMPLETED]
- **Objective:** Maximize representative site visit efficiency and optimize workload allocation across regional office hubs.
- **Implementation:**
  - OSRM-based 2-opt driving route solver with a request-queuing optimizer API (`/api/fomo/route/optimize`).
  - Home origin geocoding and automatic PII home address scrubbing API (`/api/fomo/users/[id]/home-address`).
  - Mileage-balanced spatial partitioning algorithm that clusters store visits equitably across reps.
  - Real-time geolocation snap overlays in DSR photo audits.

---

## 5. Upcoming Feature Roadmap & Backlog

### 5.1 GFPA & Budgeting Statutory Reporting
- **Objective:** Expand the GFPA reporting module into a comprehensive, audit-ready public filing package.
- **Key Enhancements:**
  - **Footnote Disclosures**: Integrate a customizable notes grid (Significant Accounting Policies, cash pooling, capital asset depreciation) into both HTML previews and PDF compilations.
  - **ACFR Package Compilation**: Expand the PDF compiler to generate a cover sheet, introductory transmittal section, and statistical tables forming a complete Annual Comprehensive Financial Report.
  - **Budget vs. Actual Reconciliation**: Calculate and compare actual Trial Balance ledger figures against approved divisional budgets, generating dollar and percentage variance schedules.

### 5.2 Scratchers Planning Tool (Instant Tickets)
- **Objective:** Make the planning tool highly engaging, visually clear, and constrained by vendor capabilities.
- **Key Enhancements:**
  - **Interactive Onboarding Wizard**: Add a step-by-step guided tour highlighting target mixes, game rosters, and vendor pricing tables to quickly onboard new users.
  - **Visual Data Visualization**: Embed real-time SVG/Canvas chart rollups showing denomination mix percentages and vendor volume share.
  - **Contractor Capability Auditing**: Flag warnings when game sizes or total volume exceed defined vendor contract printing bounds.

### 5.3 Robust Marketing MRM
- **Objective:** Enrich the marketing tool with Gantt charts, cost rollups, and design workflows.
- **Key Enhancements:**
  - **Campaign Gantt Calendar**: Render timeline calendars showing campaigns, durations, and overlapping launch waves.
  - **Creative Asset Review Board**: Integrate digital design sign-off flows (Draft, Under Review, Approved) for TV/Radio ads and creative mockups.
  - **Channel Spend Breakdown**: Track advertising channel costs (TV, Radio, Digital, POS) with ROI impression and sales uplift estimators.



