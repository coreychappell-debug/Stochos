export const guides = [
  {
    id: "welcome",
    category: "general",
    title: "Getting Started with Stochos",
    summary: "An overview of the Stochos business dashboard and navigating the enterprise platform.",
    content: {
      overview: "Welcome to Stochos, the unified operations, finance, and logistics compliance platform. Stochos is designed to serve as a secure, role-based cockpit for modern lottery management, integrating cross-department workflows into a single system of record. Whether you are managing legal contract frameworks, auditing field merchandising routes, planning advertising spend, or tracking asset depreciation, the platform keeps your teams aligned and audit-defensible.",
      steps: [
        "Dashboard Walkthrough: The landing page serves as your mission control center. It dynamically queries database alerts to display critical banners, such as contracts ending within 60 days, compliance document lapses, or purchase order budget cap warnings.",
        "Visual Customization: The sidebar footer contains a toggle for system themes. Toggle between Day Mode (featuring clean, high-visibility borders matching spreadsheet software) and Night Mode (a dark, premium operational dashboard designed for long-running analyst sessions). Check that the contrast meets WCAG 2.1 AA focus indicators.",
        "Secure Navigation: The sidebar gates modules using role-based routing checks. If you attempt to access an IT Asset registry, vendor database, or financial studio that your account role does not have authorization for, the middleware will catch your request and redirect you to the Access Control screen."
      ],
      examples: "Example Use Case: Start your workday by loading the Stochos Dashboard. Check the 'Operational Alerts' box to locate any over-budget line items. If a marketing campaign is flagged, click the contract link to review the current invoice balances.",
      tips: "Troubleshooting: If you are redirected to the Login or Unauthorized screen, verify with your system administrator that your NextAuth user account has been assigned the appropriate role (e.g. admin, analyst, manager, or procurement_officer) inside the PostgreSQL user table."
    }
  },
  {
    id: "gfpa",
    category: "gfpa",
    title: "Governed Financial & Performance Administration (GFPA)",
    summary: "Manage data preparation, metric formulas, compliance workflows, and template narrative compilation.",
    content: {
      overview: "The GFPA suite provides comprehensive governance over performance audits, analytical formulas, and narrative spreadsheets. The workflow establishes an immutable data pipeline from raw file ingestion to final board presentation packets. Standardized Trial Balances are clean-ingested into specific periods with full audit controls, double-entry validation checks, temporal Chart of Account mapping rules, and YoY variance comparisons.",
      steps: [
        "Ingest Trial Balance: Upload monthly Trial Balance CSV exports inside the Ingest cockpit. Select the Fiscal Year (e.g. FY2025) and Period (Month 1-12, or Period 13 for EOY adjustments). An atomic database transaction processes the files.",
        "Overwriting Open Periods: If you upload a file into an open period, the engine performs an atomic transaction rollback, clearing previous batch data while leaving manual adjusting entries intact. Historical uploads are marked superseded.",
        "Reconciliation Lock: Once audited, click 'Close & Lock Books'. The system runs a strict double-entry check: the sum of all general ledger balances must equal exactly $0.00. Locked periods are read-only to prevent tampering.",
        "Wildcard Crosswalk Mapping: Map a dynamic Chart of Accounts (COA) to system metrics using wildcard patterns (e.g., '40100-*-*-*' or '5-2000-*') and temporal start/end validity dates. Rules automatically group accounts into unified metrics.",
        "Year-over-Year (YoY) Variance: Navigate to the YoY Variance report to compare active period actuals against the same period in the prior fiscal year, identifying unexpected budget discrepancies and variance percentages."
      ],
      examples: "Example Use Case: A finance manager uploads a P03 (June) Trial Balance. The ledger balance audit flags an out-of-balance condition of $250.00 due to a missing bank fee. The manager adds a manual journal adjustment line for account '91200' of -$250.00 to balance the ledger. Once balanced, the manager closes the books for P03.",
      tips: "Troubleshooting: If a period lock is rejected, verify that the 'Ledger Balance Audit' shows exactly $0.00. Standard users cannot modify or upload to locked periods. An administrator must toggle the 'Unlock Period' button before changes can be submitted."
    }
  },
  {
    id: "budget",
    category: "budget",
    title: "Divisional Budgeting & ACFR Planning",
    summary: "Submit divisional G&A proposals, manage department budget caps, and roll up the master plan.",
    content: {
      overview: "The Divisional Budgeting Cockpit manages annual G&A and capital expense planning across the agency's primary divisions, mirroring the New York Lottery's Annual Comprehensive Financial Report (ACFR) division structure. Divisional leads submit proposals and justify line-item requests, while Finance and Executive officers compile, review, and approve the consolidated agency budget.",
      steps: [
        "ACFR Division Structures: Track budgets for IT, Marketing, Operations, Finance, Executive, and Procurement divisions. Each division operates under a strict target cap set by the Department of Budget (DOB).",
        "Target Allocation Limits: View divisional caps: IT ($5M), Operations ($30M), Procurement ($1.5M), Finance ($3M), Executive ($2M), and Marketing ($45M). Proposals exceeding caps trigger visual budget warnings.",
        "Fully Burdened Labor Costing: Estimate personnel expenses using fully burdened labor math. A standard 2.0x multiplier is applied to base wages to account for payroll taxes, health benefits, pension contributions, and SUTA.",
        "Save Draft & Submit: Edit items (Base Personnel, Supplies, Training, IT hardware) and save drafts. When complete, click 'Submit Proposal' to lock the document and forward it to Finance.",
        "Compile & Roll Up Budget: Finance administrators click 'Compile & Roll Up Budget' to consolidate all approved division proposals and write the master ledger parameters to the active database."
      ],
      examples: "Example Use Case: The IT Director submits a proposal of $5.3M. The system highlights a 'Cap Exceeded' warning of $300k. The director edits the 'Base Personnel' line to defer two hires, reducing the total to $4.9M. The validation turns green, and the proposal is successfully submitted.",
      tips: "Troubleshooting: If you are unable to edit your proposal, check if the status is marked 'SUBMITTED' or 'APPROVED'. Division leads cannot edit locked proposals. Contact the Finance Administrator to reset the status to 'DRAFT' if changes are required."
    }
  },
  {
    id: "fomo",
    category: "fomo",
    title: "Visitations, Coaching & Relationship Management (VCRM)",
    summary: "Track field visits, retail merchandising compliance, equipment inventory, and GIS coordinate geodata audits.",
    content: {
      overview: "The VCRM (FOMO) system governs field representative activity, retail merchandising audits, counter inventory, and optimized route coordination. Representatives build daily driving sequences, audit point-of-sale displays, and verify terminal serials while geolocation controls prevent compliance fraud.",
      steps: [
        "Retailer Registry: Search and filter accounts by status, route, and chain. Check key details like county, DMA, service center, and coordinates.",
        "Operational Trip Planner: Select up to 30 stores from the registry, designate a starting point (Schenectady HQ, regional service centers, or home geocoding), and click 'Calculate Optimized Visit Sequence' to run the OSRM/2-opt TSP solver.",
        "Weekly Route Planning: To coordinate a full week, review target stores on the dashboard. For each day of the week, build a daily selection (e.g. Route R001 active stores for Mon, Route R002 warning stores for Tue), optimize the sequence, export the route to Google Maps, and bookmark or save the resulting navigation link. This builds a complete 5-day calendar of optimized daily runs.",
        "Perform Visits & Audits: Complete digital audit forms tracking dispenser cleanliness, POS signage, and dispenser capacities directly from the store page.",
        "Equipment & GIS Audits: Log serial numbers to trigger mismatch exceptions, and submit GPS coordinates to check for registered lat/long deviations."
      ],
      examples: "Weekly Planning Example: A sales representative targets 12 stores in Albany for Monday and 15 in Troy for Tuesday. They filter the registry, add the Monday stops, optimize the route starting from Schenectady, and click 'Export to Google Maps' to save the Monday navigation URL. They clear, repeat the process for Tuesday, and save the Tuesday URL, compiling their weekly travel plan in minutes.",
      tips: "Troubleshooting & Best Practices: When using the Trip Planner, ensure you start or end routes at your designated service center or geocoded home address. Always export and save your optimized Google Maps URLs to build and preserve your weekly itinerary."
    }
  },
  {
    id: "solr",
    category: "solr",
    title: "Spatial Operations, Logistics & Risk (SOLR)",
    summary: "Real-time threat mapping, weather warning integration, and regional risk route planning.",
    content: {
      overview: "SOLR integrates spatial GIS telemetry (NOAA storm tracks, USGS seismic data) with the retailer network, protecting distribution logistics. Fleet dispatchers identify weather threats and reroute ticket and equipment delivery vans around high-risk zones.",
      steps: [
        "Real-Time Hazard Map: View active storms, floods, or winter advisories overlaid on transportation hubs and retailer routes.",
        "Draw custom Risk Polygons: Use Leaflet mapping tools to draw circles, rectangles, or custom paths around storm cells or disaster zones.",
        "Radial Proximity Calculation: Specify a storm buffer radius (e.g., 20 miles). The system projects WGS84 coordinates on the backend to count and list all retailers located within the danger circle.",
        "Active Fleet Rerouting: Pinpoint delivery trucks intersecting active risk zones and coordinate with dispatchers to flag holds."
      ],
      examples: "Example Use Case: A severe tornado watch is declared. A dispatcher draws a 15-mile buffer circle around the storm cell. The system identifies 12 retailers in the path. The system flags their scheduled deliveries on the shipping console, suspending cargo transit until the warning clears.",
      tips: "Troubleshooting: If the circle tool fails to register, ensure you drag the cursor outward from the center point on the Leaflet interface. The system computes coordinates dynamically to establish the boundary."
    }
  },
  {
    id: "contracts",
    category: "contracts",
    title: "Contract & Vendor Management",
    summary: "Manage active vendor agreements, PO budgets, row-level sharing rights, and compliance audit logs.",
    content: {
      overview: "The Contracts module tracks legal agreements, procurement limits, and compliance tasks. It regulates relationships with printing vendors and equipment suppliers, tracks spent totals versus contract caps, and controls file accessibility.",
      steps: [
        "Vendor Directory: Search active vendors, minority-owned business certifications (MWBE), and operational profiles.",
        "Contract Parameters: Establish ceilings, execution dates, notice intervals, and legal compliance tasks.",
        "Purchase Orders (PO): Link PO lines to contracts. The system computes spent percentages in real-time, warning if allocations approach the contract value.",
        "Row-Level Contract Sharing: Secure legal files. Admins and contract creators can share read/write permissions with specific users. Non-authorized accounts are locked out of viewing or editing the contract.",
        "Audit Log Trail: Track metadata changes in the audit registry, documenting old value, new value, actor email, and timestamp."
      ],
      examples: "Example Use Case: A procurement officer reviews a contract. The system warns that expenditures have reached 90% of the budget cap. The officer clicks the 'Sharing' widget to grant edit rights to the finance analyst to collaborate on a budget amendment.",
      tips: "Troubleshooting: If a user cannot view a contract, verify that they are the creator, an administrator, or have been added explicitly in the Contract Access list with active read permissions."
    }
  },
  {
    id: "fleet",
    category: "fleet",
    title: "Fleet & Asset Management",
    summary: "Track physical hardware inventories, vehicle logs, straight-line depreciation, and EOL forecasting.",
    content: {
      overview: "The Fleet & Asset Management module organizes physical assets, managing delivery vehicles (fleet) and corporate/retail hardware assets. It calculates straight-line financial depreciation, tracks custody logs, hosts mobile photo-audits, and forecasts equipment replacement budgets.",
      steps: [
        "Fleet Registry: Log delivery vans, assigned personnel, mileage logs, and scheduled maintenance events.",
        "Asset Management: Record serial keys, categories, procurement costs, and useful life spans.",
        "Straight-Line Depreciation: The system automatically computes monthly depreciation values. Define the asset's acquisition price, expected salvage (scrap) value, and useful life (in years). The system divides the depreciable cost by the life in months.",
        "Replacement Cycle Forecasting: Mapped assets monitor replacement thresholds. If an asset exceeds its useful life or mileage cap, the system generates an 'End of Life (EOL) Replacement warning'."
      ],
      examples: "Example Use Case: An administrator adds an asset costing $25,000, with a salvage value of $1,000 and a 4-year useful life. The system automatically computes a monthly straight-line depreciation of $500.00 and logs the asset under the registry.",
      tips: "Troubleshooting: If the depreciation field displays zero or throws an error, verify that the salvage value is less than the acquisition cost and that the useful life is set to an integer greater than zero.",
      comparison: [
        {
          capability: "Data Ingestion & Integrity",
          standard: "Basic Uploads: Fails silently or rejects entire files if a single row has a typo (e.g. category spelling).",
          stochos: "Import Sandbox: Interactive inline grid that highlights errors dynamically so users can edit cell typos before committing."
        },
        {
          capability: "Physical Audit Verification",
          standard: "Manual Sheet/Scan: Auditors carry clipboards or dedicated barcode scanner terminals requiring manual docking.",
          stochos: "Mobile Photo-Audit & Geotags: In-browser EXIF GPS parsing with proximity snapping that aligns phone GPS drift to official stores."
        },
        {
          capability: "CapEx Replacement Projections",
          standard: "Static Lists: Outputs replacement dates, requiring offline Excel math to calculate future inflated budgets.",
          stochos: "Dynamic Inflation Forecasting: 10-year interactive timeline compounding costs based on each asset's original deployment year."
        },
        {
          capability: "Financial Ledger Syncing",
          standard: "Isolated CSV dumps: Requires manual copy-pasting of ledgers between inventory tools and ERP systems.",
          stochos: "Prisma Sync & GASB 34: One-click sync to Division Budget proposals and direct integration with GASB 34 financial statements."
        },
        {
          capability: "Scale & Performance",
          standard: "Interface Lag: UI starts freezing or search lags when handling over 10,000 asset rows in the browser.",
          stochos: "DOM Pagination & Debounced Search: Handles 45,000+ assets instantly via sliced rendering views and debounced keystroke query delays."
        }
      ]
    }
  },
  {
    id: "marketing",
    category: "marketing",
    title: "Marketing Campaign MRM",
    summary: "Track multi-channel campaigns, allocate media budgets, assign channels, and manage execution milestones.",
    content: {
      overview: "The Marketing Resource Management (MRM) cockpit coordinates media scheduling, campaign execution, and ad spend. Marketers allocate campaign funds across TV, digital, radio, print, and retail point-of-sale channels and track compliance check gates.",
      steps: [
        "Campaign Creation: Set campaign flight dates, targeted audiences, and overall promotional budgets.",
        "Media Channel Allocations: Segment spend across media channels. Set target reach metrics and flight intervals for each channel.",
        "Milestone Gates: Follow compliance checklists, tracking copy approvals, legal review sign-offs, and final asset deliveries.",
        "Cost Attribution: Link media invoices directly to campaign channels to compute actual spent totals and variance metrics."
      ],
      examples: "Example Use Case: A campaign manager plans the 'Holiday Cash Splash' with a $500k budget. They allocate $300k to TV ads and $200k to digital ads. They create tasks for the creative agency and monitor asset deliveries directly on the campaign dashboard.",
      tips: "Troubleshooting: If a campaign is over-budget, check that the sum of the allocated media channels does not exceed the campaign's total budget. Overages will trigger a warning on the marketing dashboard."
    }
  },
  {
    id: "tickets",
    category: "tickets",
    title: "Instant Ticket Planning & Game Lifecycle",
    summary: "Manage game planning spreadsheets, vendor pricing brackets, and ticket print orders.",
    content: {
      overview: "The Instant Ticket planning system oversees scratch-off game design, pricing sheets, prize structures, production schedules, and print order fulfillment. It coordinates printing with suppliers and monitors ticket deliveries.",
      steps: [
        "Game Sheet Management: Outline new scratch-off games, setting details like ticket price, ticket size, game style, and total print run.",
        "Prize Matrix Design: Set up the prize payout structure. Define tier values, odds, count of winning tickets, and total prize fund liability.",
        "Vendor Pricing Brackets: Compare printing costs across vendors. Define sliding-scale volume pricing (price per thousand tickets based on print run sizes).",
        "Print Orders: Track order fulfillment. Monitor target print dates, shipping details, and invoice approvals."
      ],
      examples: "Example Use Case: A product planner designs a $5 game with a 10 million ticket print run. They use the prize matrix tool to calculate a 67% prize payout liability. They cross-reference vendor pricing brackets to select the supplier with the lowest rate for that volume.",
      tips: "Troubleshooting: If the prize payout percentage exceeds state legislative limits, the system will highlight the liability field in red. Adjust the tier counts or winning odds in the prize matrix to lower the payout percentage."
    }
  },
  {
    id: "products",
    category: "products",
    title: "Product Catalog Integration",
    summary: "Browse games, track specifications, and review vendor contract associations.",
    content: {
      overview: "The Product Catalog provides a centralized index of all active lottery games (both draw games and instant scratch-offs). It connects games to their respective vendor printing contracts, allowing analysts to trace operational performance.",
      steps: [
        "Browse Products: View draw games (e.g. Powerball, Mega Millions) and scratch-off portfolios, filtering by status, price point, or launch date.",
        "Technical Specifications: Track specifications, including pack sizes, tickets per pack, scratch-off coatings, and UPC codes.",
        "Vendor Contract Linkages: Link products to active vendor supply contracts. This maps ticket supply costs to the correct procurement records."
      ],
      examples: "Example Use Case: An analyst clicks on 'Cash Blast' in the catalog. They inspect the specifications sheet (pack size of 100, ticket cost of $10) and verify that it is linked to the active 'Supplier Printing Contract A' to audit supply costs.",
      tips: "Troubleshooting: If a game shows missing financial tracking, verify that it has been associated with the correct vendor contract inside the Product details edit form."
    }
  },
  {
    id: "auditor_playbook",
    category: "playbooks",
    title: "Auditor Playbook",
    summary: "Standard operating checklist for financial and operational compliance audits.",
    content: {
      overview: "As an Auditor on the Stochos platform, your primary mandate is to verify the accuracy, balancing, and regulatory compliance of all ledger submissions, contract records, and field activity logs.",
      steps: [
        "GL Double-Entry Verification: Navigate to the Data Ingest cockpit and verify that the Trial Balance record balances to exactly $0.00.",
        "Lock Period Sign-off: Inspect active ledger records and click 'Close & Lock Books' to enforce an immutable, read-only state for target periods.",
        "GASB 34 Compilation Audit: Review the Statement of Net Position, Revenues/Expenses, and Cash Flows, validating calculated subtotals against the underlying general ledger records."
      ],
      examples: "Example Use Case: Auditing a period close requires matching the compiled 'Restricted for Prizes' Net Position line against the corresponding restricted liability account balances in the Trial Balance.",
      tips: "Warning: Period locking is strictly blocked if the ledger balance audit flags any discrepancy amount. Make adjusting manual entries in the Active Ledger Grid to balance the ledger before locking."
    }
  },
  {
    id: "bureau_chief_playbook",
    category: "playbooks",
    title: "Bureau Chief Playbook",
    summary: "Operational guide for formulating, saving, and submitting bureau-level budget proposals.",
    content: {
      overview: "As a Bureau Chief, you are responsible for outlining your sub-unit's operational G&A and capital equipment budget demands for the upcoming fiscal year, justifying requests in detail.",
      steps: [
        "Formulate Budget Requests: Input specific line items under the divisional cockpit, including Category, Description, and Proposed Amount.",
        "Apply Labor Burden Math: Apply the standard 2.0x labor burden multiplier to base personnel wages to cover benefits, pension contributions, and insurance.",
        "Submit Draft to Division Lead: Review all lines against your unit goals, add justification comments, and click 'Submit Proposal' to hand off to your Division Lead."
      ],
      examples: "Example Use Case: An IT Bureau Chief adds a request of $2.4M for hardware upgrades and justifies the variance in the proposal comments before submitting.",
      tips: "Keep line items clear and map them to active vendor contracts to ensure streamlined approval by the Division Lead."
    }
  },
  {
    id: "division_lead_playbook",
    category: "playbooks",
    title: "Division Lead Playbook",
    summary: "Management guide for reviewing bureau budgets and compiling consolidated division proposals.",
    content: {
      overview: "As a Division Lead, you oversee the consolidated budget for your entire division, reviewing sub-unit bureau requests and ensuring alignment with DOB target caps.",
      steps: [
        "Review Sub-Unit Proposals: Review submissions from each Bureau Chief, approving or requesting revisions with inline notes.",
        "Verify Division Target Cap: Ensure the cumulative sum of approved bureau budgets does not exceed the division's limit.",
        "Compile Division Proposal: Click 'Compile Consolidated Division Budget' to roll up bureau line items into a single division-level proposal."
      ],
      examples: "Example Use Case: The Operations Lead reviews and approves the Fleet and Logistics bureau budgets, consolidates them, and submits the $28.5M package (below the $30M cap) to the Finance division.",
      tips: "If sub-unit budgets exceed the target cap, use the inline revision tool to request adjustments before consolidating."
    }
  },
  {
    id: "sales_rep_playbook",
    category: "playbooks",
    title: "Sales Representative Playbook",
    summary: "Field guide for executing retail audits, planning routes, and verifying merchandising compliance.",
    content: {
      overview: "As a Sales Representative, your goal is to optimize store visitation cadences, execute POS audits, and perform equipment verification scans in the field.",
      steps: [
        "Plan Weekly Routes: Select target stores from the registry, use the 2-opt TSP route calculator to sequence stops, and export the driving itinerary.",
        "Execute Merchandising Audits: Visit stores to confirm POS placement, dispenser cleanliness, and fill rates.",
        "Verify Equipment Inventory: Verify clerk terminals and vending serials to flag compliance mismatches."
      ],
      examples: "Example Use Case: A representative sets Schenectady HQ as start, adds 10 retail accounts, optimizes the route, and saves the Google Maps URL to their calendar.",
      tips: "Ensure GPS geocoding is active during audits; coordinates deviating from registered retailer coordinates will trigger alert flags."
    }
  },
  {
    id: "reporting_upload",
    category: "gfpa",
    title: "Financial Ingestion (Trial Balance Upload)",
    summary: "Bypass IT queues. Ingest Trial Balance CSV files directly into specific filing periods with strict audit logs and controls.",
    content: {
      overview: "The Financial Ingestion module enables accounting officers to upload raw Trial Balance CSV exports from ERP systems. The system processes uploads through database transactions, checking for period locks, managing active/rolled-back files, and logging audit trails.",
      steps: [
        "Select Parameters: Choose the target Fiscal Year (e.g. FY2027) and Period Code (P01-P12, or P13 for EOY adjustments) in the upload panel.",
        "Check Period Locks: If a period has been locked by an auditor, the upload zone will turn grey, block file selection, and prevent updates to protect closed books.",
        "Upload CSV File: Drag and drop your trial balance file. Column headers must include 'accountCode', 'accountName', and 'balance' (debits positive, credits negative). Use the starter template if needed.",
        "Reconcile Overwrite: Uploading a new batch to an open period automatically archives and rolls back previous uploads. All superseded files are marked with status 'rolled_back' and linked to the superceding batch ID for audit compliance.",
        "Review Audit Logs: Verify that the upload transaction completes successfully and logs details in the system audit registry (old value, new value, actor email, and timestamp)."
      ],
      examples: "Example Use Case: An analyst uploads the P04 (July) Trial Balance CSV. The system detects a previous draft upload for P04. It flags the previous file as 'rolled_back', marks the new upload as active, and logs a $0.00 General Ledger sum, indicating a balanced upload.",
      tips: "Warning & Best Practices: Always download the starter CSV template to verify your file headers match. If the ledger sum displays an out-of-balance alert (e.g., sum is not $0.00), use the Active Ledger Grid to locate the missing balance."
    }
  },
  {
    id: "reporting_grid",
    category: "gfpa",
    title: "Active Ledger Grid (Governed Trial Balance)",
    summary: "Read, filter, adjust, and audit trial balance ledger records in an interactive grid connected directly to the database.",
    content: {
      overview: "The Governed Grid provides real-time access to the General Ledger records for the active period. Analysts use the grid to inspect balances, filter accounts, add adjusting journal entries, and correct accounting errors before locking the books.",
      steps: [
        "Select Active Period: Choose the Fiscal Year and Period Code. The grid queries and renders the active trial balance records instantly.",
        "Filter and Paginate: Search for specific accounts using the search bar, or filter by category (Assets, Liabilities, Equity, Revenues, Expenses).",
        "Add Adjustment Entry: Click the 'Add Adjustment Entry' button. Input the General Ledger account code, account name, and adjustment balance (positive debit, negative credit).",
        "Delete Errors: If a line item is incorrect or duplicate, select the line and click the delete button. The grid will automatically recalculate check balances.",
        "Balance Check: Monitor the Ledger Balance Audit bar at the bottom. The system dynamically sums the active records to ensure the double-entry accounting equation holds."
      ],
      examples: "Example Use Case: Before closing period P03, the Auditor notices that bank interest income was not credited in the upload. They click 'Add Adjustment Entry', enter account '4-3000' (Investment Gain/Interest), and input a credit balance of -500.00. They add another line for account '1-1000' (Cash) with 500.00, returning the ledger sum to $0.00.",
      tips: "Troubleshooting: If edit controls or delete buttons are greyed out, check if the period is locked. Locked periods are read-only and require an administrator to unlock them."
    }
  },
  {
    id: "reporting_prep",
    category: "gfpa",
    title: "Data Prep Studio (Crosswalk Mapping Rules)",
    summary: "Create and govern wildcard rules mapping General Ledger accounts to system performance metrics with temporal validity gating.",
    content: {
      overview: "The Data Prep Studio is the translation engine of the platform. It maps raw Chart of Accounts (COA) codes to system metrics using specificity-based sorting and start/end dates. This allows the system to evaluate metrics even when account structures change.",
      steps: [
        "Select Mapping Schema: Open the Crosswalk Mapping list. You will see active wildcard rules and their assigned target metrics.",
        "Create Mapping Rule: Click 'Add Mapping Rule'. Enter the Account Pattern (e.g., '1-12*' or '5-2000-*'), specify the signage multiplier, and assign the target Metric.",
        "Signage Multiplier: Set multiplier to 1.0 to preserve value signs, or -1.0 to flip credit balances (e.g., revenues or liabilities) into positive numbers for reports.",
        "Set Temporal Dates: Input the effective start date and optional end date. Rules are active only within this window, supporting year-to-year GAAP adjustments.",
        "Specificity Sorting: The engine automatically sorts rules by pattern complexity, ensuring specific accounts (e.g. '1-1200') match before catch-all wildcards ('1-*')."
      ],
      examples: "Example Use Case: A new prize payout account '5-2000-502' is created. The analyst adds a crosswalk rule for pattern '5-2000-502' mapping to metric 'Prize Expense' with multiplier 1.0, ensuring it compiles into operating reports.",
      tips: "Troubleshooting: If a metric is missing values, check if a rule has expired. Verify the effective end date of the mapping rule or check for rule conflicts where a more generic rule has a higher specificity ranking."
    }
  },
  {
    id: "reporting_rules",
    category: "gfpa",
    title: "Governed Rules Engine (Compliance Gates)",
    summary: "Establish institutional audit gates, compliance validation rules, and commentary close triggers.",
    content: {
      overview: "The Rules Engine acts as the compliance gatekeeper. It defines and executes automated tests against financial and operational actuals, verifying audit balances, flag variances, and trigger commentary request forms.",
      steps: [
        "Browse Compliance Rules: Open the Rules Engine tab. Review validation guidelines (e.g., double-entry sum balance check, prize payout percentage limit).",
        "Check Rule Status: The engine runs rules automatically on data refreshes. Statuses display as Passed, Passed with Warnings, or Blocked.",
        "Blocked State resolution: If a rule fails in a 'Blocked' state (such as out-of-balance ledger), the Close Period button is disabled. You must balance the database before proceeding.",
        "Warnings Commentary: If a rule fails in a 'Passed with Warnings' state (e.g., payout exceeds 68%), the system prompts for a variance justification note.",
        "Lock Verification: The system logs all checks during period closing, archiving compliance results as part of the immutable binder."
      ],
      examples: "Example Use Case: An upload of FY2027 P03 shows a prize payout percentage of 71%, exceeding the warning threshold of 67%. The Rules Engine triggers a 'Passed with Warnings' flag. The division lead must submit a written narrative explaining the high jackpot payouts before they can lock the period.",
      tips: "Best Practices: Review compliance gates early in the close cycle. Resolving warning alerts and drafting explanations before EOY saves substantial review time."
    }
  },
  {
    id: "reporting_template",
    category: "gfpa",
    title: "Report Template Designer (MD&A Editor)",
    summary: "Draft financial narratives, disclosures, and board slides with embedded live database values.",
    content: {
      overview: "The Template Designer merges text editing with live financial actuals. Analysts write Management's Discussion & Analysis (MD&A) articles, financial footnotes, and audit disclosures while inserting dynamic pills that sync directly with the database.",
      steps: [
        "Open Template: Browse existing templates or click 'Create Report Template'. Provide a title and select the target financial binder.",
        "Edit Document Content: Write narrative text in the WYSIWYG editor. Standard formatting options (bold, headings, alignment) are available in the action bar.",
        "Insert Live Metric Pills: Click the 'Pill' icon or type '#' to select a system metric (e.g., 'Total Revenue', 'Cash Position'). The editor inserts a green dynamic capsule.",
        "Review Evaluated Data: The system replaces the capsule with its real-time numeric value. When the reporting period changes, the numbers update instantly.",
        "Publish and Export: Save the template. Once approved, templates can be exported to PDF, HTML, or compiled into the final reporting binder."
      ],
      examples: "Example Use Case: The analyst drafts the Q1 MD&A: 'Revenues reached [Lottery_Revenue_Net] compared to [Prior_Year_Revenue_Net] in the prior period.' The compiler replaces the brackets with '$2.48B' and '$2.81B' automatically.",
      tips: "Troubleshooting: If a pill displays '#VALUE!' or '0.00', check that the metric is registered and that active crosswalk mapping rules exist for the targeted period."
    }
  },
  {
    id: "reporting_workflow",
    category: "gfpa",
    title: "Workflow & Binders (Modular Closings)",
    summary: "Organize document segments, assign preparers/reviewers, and manage approvals for close binder assembly.",
    content: {
      overview: "The Workflow binder engine manages segment assignments, task allocations, and review gates. Large financial documents (such as the ACFR) are split into individual sections (e.g. Footnotes, Balance Sheets) with independent progress tracking.",
      steps: [
        "Access Binder Board: Open the Workflow Cockpit. Review assigned sections, active preparers, and step statuses (Draft, In-Review, Approved).",
        "Assign Team Members: Click 'Assign' on a section card. Select an Author (to draft/upload) and a Reviewer (to approve/sign-off).",
        "Submit for Review: Once the segment is complete, click 'Submit for Review'. The segment turns blue and locks against changes by the preparer.",
        "Review Actions: The assigned reviewer inspects the data, adds comments, and clicks 'Approve' (turning the section green) or 'Reject' (returning to Draft).",
        "Consolidated Compile: Once all binder sections are approved, the administrator consolidates the binder and locks the close period."
      ],
      examples: "Example Use Case: The Finance Lead assigns the 'Capital Assets Footnote' to the G&A accountant. The accountant drafts the text, inputs depreciation values, and submits. The Finance Lead reviews the numbers and approves, marking the footnote complete.",
      tips: "Troubleshooting: If a section says 'Read-Only', you have already submitted it. If changes are needed, ask the reviewer to select the 'Reject / Request Revisions' action to unlock the section."
    }
  },
  {
    id: "reporting_calendar",
    category: "gfpa",
    title: "Statutory Close Calendar",
    summary: "Track statutory filing timelines, closing tasks, countdown alerts, and legislative warning statuses.",
    content: {
      overview: "The Statutory Close Calendar governs administrative close schedules and regulatory filing dates. It warns teams of upcoming deadlines, displays checklist progress, and monitors compliance status.",
      steps: [
        "View Schedule Calendar: Open the Statutory Calendar module. Locate the timeline cards and monthly close dates.",
        "Check Milestone Progress: Each period features a list of closing milestones (Ingestion, Rules Audit, Segment sign-offs, Period lock). Completed items display green checkmarks.",
        "Monitor Deadlines: Review countdown indicators. The calendar displays days remaining until filing, highlighting overdue items in red.",
        "Review Warnings: If a period is past due, the calendar triggers a red alert banner, warning that the agency is out of compliance with statutory filing dates.",
        "Check Off Gates: Update milestones as you complete each reporting segment, keeping managers aligned."
      ],
      examples: "Example Use Case: The Finance Lead reviews the calendar and sees that the Q2 comparative audit is due in 5 days. They check the milestones card: 'Ingestion' and 'Rules Audit' are checked, but 'Segment Sign-off' is pending. They contact the department reviewer to expedite approval.",
      tips: "Best Practices: Integrate the calendar into your weekly team meetings. Completing milestones sequentially prevents bottleneck delays during statutory deadlines."
    }
  },
  {
    id: "reporting_registry",
    category: "gfpa",
    title: "Metric Registry (Filing Definitions)",
    summary: "Browse General Ledger accounts, active metrics, and formula calculation structures.",
    content: {
      overview: "The Metric Registry is the repository of filing definitions. It details all active Chart of Accounts (COA) records, system metrics, and formula trees, showing relationships and calculations.",
      steps: [
        "Browse Registry: Search for accounts or metrics using the search bar, filtering by type (Asset, Liability, Revenue, Expense).",
        "Review Formula Trees: Select a metric to view its calculation dependency. The registry shows which child metrics or accounts sum into the parent total.",
        "Verify Account Mappings: Cross-reference General Ledger accounts with the active crosswalk patterns to ensure values flow correctly.",
        "Audit Status: Check the calculation verification indicator to ensure formulas are mathematically sound."
      ],
      examples: "Example Use Case: An auditor searches for 'Prize Expense' in the registry. The system displays its formula, showing that it aggregates all records matching account pattern '5-2000' and lists its sub-accounts.",
      tips: "Best Practices: Before uploading a new trial balance structure, verify that all new General Ledger codes have been registered in the registry to prevent crosswalk failures."
    }
  },
  {
    id: "reporting_gasb34",
    category: "gfpa",
    title: "GASB 34 Statement Compiler",
    summary: "Generate comparative Statements of Net Position, Revenues & Expenses, and Cash Flows from underlying ledger balances.",
    content: {
      overview: "The GASB 34 Statement Compiler automates the preparation of governmental-format comparative financial statements. It computes all balance sheet and operating income subtotals, manages cash flow methods, and tracks version histories.",
      steps: [
        "Set Parameters: Select the Fiscal Year, Period Code, and Rounding Display option (Exact `$1`, Thousands `$K`, or Millions `$M`).",
        "Inspect Statements: Review compiled reports under three tabs: Statement of Net Position, Statement of Revenues & Expenses, and Statement of Cash Flows (with indirect reconciliation).",
        "Edit Layout: Click 'Statement Layout Manager' to open the edit drawer. You can rename row labels, resequence sorting order, add rows, or edit signage multipliers.",
        "Track Changes (Versions): Open the 'History & Snapshots' panel to review the list of previous compiles (showing dates, item counts, totals, and authors).",
        "Restore Previous Compiles: Select a version and click 'Restore Snapshot' to undo compile changes. The system automatically creates a backup of the current state."
      ],
      examples: "Example Use Case: The Division Lead compiles the FY 2025 comparative reports. They modify the 'Cash and cash equivalents' row name to match audit formats and save. Later, they review previous drafts in the history panel and restore version v1, which automatically backs up their name change draft.",
      tips: "Troubleshooting: If statements are out-of-balance, check the double-entry status banner. If it is red, use the Active Ledger Grid to locate the unbalanced entry."
    }
  }
];

