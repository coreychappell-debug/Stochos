# Stochos Platform: Technical Architecture & Security Whitepaper

**Document Version:** 1.0.0  
**Target Audience:** Enterprise IT Directors, Security Officers, Database Administrators, and Procurement Reviewers  
**Subject System:** Stochos Lottery Business Platform (v0.2.0)

---

## Executive Summary

Stochos is a modular, high-performance business administration platform designed for state lottery agencies and municipal finance operations. Unlike legacy systems that require heavy, agent-based software installations on physical remote devices (e.g., lottery terminals, retail vending systems, signage), Stochos utilizes a **best-in-class, low-infrastructure model**.

By combining modern web protocols, mobile-based metadata verification, in-browser EXIF GPS parsing, dynamic receipt OCR, and relational database constraints, Stochos delivers enterprise-grade operational controls and financial audits at **zero hardware footprint** and **zero licensing overhead for external trackers**.

---

## 1. Core Technology Stack

The platform is engineered using modern, industry-standard technologies to ensure high performance, scalability, and long-term support (LTS):

* **Runtime Framework**: Next.js 16.2.6 (App Router) executing on Node.js 24 LTS.
* **Build Engine**: Next.js Turbopack compiler (optimized client bundles with dead-code elimination).
* **Database Layer**: PostgreSQL 16 (relational database).
* **Object Relational Mapper (ORM)**: Prisma 7.8.0 leveraging the `PrismaPg` native driver adapter.
* **Authentication**: NextAuth v5 (Beta 31) using secure JSON Web Tokens (JWT) for session management.
* **PDF Compilation**: PDFKit 0.19.0 drawing native vector graphics (guarantees scan-compliant barcode rendering).

---

## 2. Low-Infrastructure Asset & Fleet Tracking Model

For field operations (Merchandising, CRM routing, VCRM, and Fleet), Stochos eliminates expensive IoT tracking hardware (such as OBD-II telematics and cellular GPS trackers) by using software-driven workflows:

| Capability | Standard Low-Infra Tools | Stochos Asset & Fleet Management | IT Security Benefit |
| :--- | :--- | :--- | :--- |
| **Data Ingestion & Integrity** | **Basic Uploads**: Fails silently or imports corrupt entries when spreadsheet typos occur, causing database degradation. | **Import Sandbox**: Server-side dry-runs parse CSV data. Cell-level errors are flagged on an interactive grid, allowing admins to correct typos inline. | Prevents database contamination and reduces administrative troubleshooting. |
| **Physical Field Verification** | **Manual Logs**: Handheld scanning terminals requiring proprietary sync programs, or manual spreadsheets. | **Mobile Photo-Audit & Geotags**: Reps take smartphone photos of physical assets. Stochos extracts GPS/EXIF timestamps, blocking duplicates/recounts. | Verifies rep presence and asset compliance with no hardware scanner costs. |
| **Odometer & Safety Compliance** | **OBD-II Telematics**: Expensive plug-in vehicle trackers ($20 daily cellular logs). | **Dashboard QR Codes**: Drivers scan dash QR codes to submit odometer readings and pre-trip checklists. FOMO route planners predict vehicle wear. | Zero hardware install. Peer-escalation alerts notify supervisors of lapses. |
| **CapEx Projections** | **Static Lists**: Generates simple expiry lists, requiring manual compounding of inflation. | **Dynamic Inflation Forecasting**: Compounds costs from the asset's purchase year using \(Cost \times (1 + r)^n\) to project exact future budgets. | Delivers inflation-adjusted budget metrics directly to executive leadership. |
| **Financial Ledger Integration** | **Manual Sync**: Exporting files and copy-pasting numbers to billing portals. | **Prisma Sync & GASB 34**: Direct synchronization to Division Budget proposals and GASB 34 financial statements. | Removes manual entry errors between operational trackers and accounting. |
| **System performance at Scale** | **UI Freeze**: Browser stutters or lags when database tables exceed 10,000 items. | **Prisma Indexed Queries & DOM Slicing**: Debounced keystroke delays and sliced paginated tables handle **45,000+ assets** instantly. | Maintains sub-millisecond search performance for extensive inventories. |

---

## 3. Enterprise Security & Access Controls

Security is integrated at every tier of the application, conforming to corporate governance and municipal audit guidelines.

### A. Authentication and Role-Based Access Control (RBAC)
Stochos enforces role-based security gates. A user cannot access pages or API endpoints without verifying their session role permissions:
* **Session Security**: NextAuth v5 uses secure, signed JWT cookies to persist user sessions.
* **Server-Side API Gates**: Every API route (e.g. `/api/organization/users`) performs an active server-side permission check using the active session. If an unauthorized user attempts to call a write/delete API directly via script, the route aborts and returns a `403 Forbidden` header.
* **Role Options**: Supports granular read, write, or admin permissions across system resources (Reporting, Budgeting, CRM, Contracts, Fleet, Assets).

### B. Prevention of Injection Attacks
* **SQL Injection**: Stochos uses Prisma ORM, which executes parameterized SQL queries natively. User inputs are never concatenated directly into raw database commands, neutralizing SQL injection vulnerabilities.
* **Cross-Site Scripting (XSS)**: Payload inputs are processed using **AJV JSON Schema Validation** and sanitized upon import to prevent malicious scripts from executing in client browsers.

### C. Concurrency Controls (System Job Locks)
* **The Problem**: Two administrators executing heavy bulk operations simultaneously (e.g., compiling a division budget or importing 10,000 assets) can trigger database deadlocks or duplicate records.
* **The Solution**: Stochos features a database-backed **Mutex Concurrency Lock** (`SystemJobLock`).
    - Before starting a heavy background task, the API route attempts to acquire a lock.
    - If the lock is already held by another session, duplicate requests are blocked with a `429 Conflict` status.
    - Hung locks are pruned automatically using a 120-second timeout loop.

### D. Payload and Denial of Service (DoS) Protections
* **Stream Size Limits**: To prevent malicious payload uploads (e.g., uploading a 1GB file to crash the single-threaded Node.js server), the platform enforces a **strict 5MB limit** on client uploads.
* **Stream Truncation**: We utilize streaming parsers (`busboy`) that count bytes on-the-fly and close connections immediately if limits are exceeded, saving server memory.

---

## 4. Data Integrity & Relational Safety

### A. Atomic Database Operations (All-or-Nothing Rollbacks)
Every bulk operation (importing trial balances, committing corrected records from the Sandbox, bulk reassigning employee assets) runs inside a **Prisma Database Transaction (`$transaction`)**.
* If 999 assets write successfully but the 1,000th fails database validation, **the entire batch rolls back**. 
* This prevents database fragmentation and ensures the system remains in a clean, consistent state.

### B. Relational Mutual Exclusion
Database schemas enforce strict relational integrity. For example, an asset can belong to a `retailerId` (CRM Store Location) OR an `orgUnitId` (Corporate Office location), but **never both simultaneously**. This prevents contradictory inventory records.

---

## 5. Walkthrough of High-Impact Workflows

### A. The CSV Import Sandbox
Instead of rejecting spreadsheet uploads due to typos, the Stochos sandbox isolates the data:
1. The backend parses the CSV and returns a structured list of rows, marking validation errors (e.g. invalid location codes, misspelled categories).
2. The UI renders the spreadsheet in an interactive grid, coloring error cells red (⚠️).
3. The user double-clicks and edits cells directly in the browser.
4. On edit, a client-side validator (`validateSandboxRowLocally`) re-checks inputs. Once all flags are green, the user clicks "Commit" to trigger the atomic database write.

### B. The EXIF-Geotagged Photo Audit
To reconcile physical terminal inventories at retail outlets:
1. The auditor snaps a photo of the vending machine or terminal on their phone and uploads it.
2. The browser parses the EXIF metadata to retrieve GPS coordinates and the camera's original creation date.
3. The system queries the database to find CRM retailers within a 500-meter radius.
4. The auditor snaps the coordinates directly to the official retail store location, correcting phone GPS drift and creating an audit trail.

---

## 6. Architectural Conclusion

The Stochos platform is structured for **modular independence**. If a client disables Fleet Management or Marketing Modules, the remaining modules (like VCRM or Budget Proposals) degrade gracefully, swapping database lookups for simple text-based fallbacks. 

This decoupling, combined with robust transaction safety, server-side RBAC, and client-side DOM optimizations, ensures that Stochos is a highly secure, reliable, and cost-effective system of record for corporate and government partners.
