# Stochos Platform Future Roadmap & Backlog

This document outlines key technical items, feature improvements, and deferred development items to address in future phases of the Stochos Platform.

## 1. Asset & Fleet Inventory Improvements

### 1.1 Simplified Data Entry for Assets
- **Objective:** Streamline the registration of large volumes of physical and IT assets to reduce manual data-entry overhead.
- **Potential Strategies:**
  - Standard templates/defaults by category (e.g. autofilling useful life, category, and vendor details when creating a "Laptop").
  - CSV drag-and-drop batch imports (leveraging the check-and-reject validation rules).
  - Bulk duplicate/copy features in the UI.

### 1.2 Physical Asset Tag Printing
- **Objective:** Enable generating and printing physical barcode/QR labels from registered asset tags so they can be affixed to hardware.
- **Implementation Strategy:**
  - A **Print Label** button in the Asset Profile drawer.
  - Integration of standard printer templates (e.g. Avery sheets, Zebra label printers, DYMO) using browser print styles or SVG-to-PDF conversion.
  - Dynamically generated barcodes/QR codes encoding the `assetTag` string.

### 1.3 Asset Segregation & Consolidated Reporting Rollup
- **Objective:** Separate asset tracking screens by organizational ownership (e.g., IT manages computers, Operations manages vehicles), while maintaining a consolidated administrative overview.
- **Implementation Strategy:**
  - Introduce role-based filters to restrict write/read access on specific asset categories to designated departments.
  - Implement a consolidated **Executive Asset Reporting Dashboard** showing total capital value, accumulated depreciation schedules, and replacement forecasts across both IT Assets and Fleet in a single unified view.

---

## 2. Platform & Enterprise Controls

### 2.1 Enterprise Administrator Roles & Permissions
- **Objective:** Allow state/jurisdiction leads (such as an IT lead or Contracts Unit representative) to manage access permissions for their team members.
- **Features:**
  - Fine-grained access cards for managing individual users, contracts, and vendors within a specific jurisdiction.
  - Enterprise Admin dashboard to audit who has access to which contracts.
