"use client";
import { useState } from "react";

const guides = [
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
      overview: "The GFPA suite provides comprehensive governance over performance audits, analytical formulas, and narrative spreadsheets. Instead of copy-pasting values into insecure documents, the GFPA workflow establishes an immutable data pipeline from raw file ingestion to final board presentation packets.",
      steps: [
        "Visual ETL Data Prep: Upload weekly Trial Balance CSV exports inside the Data Prep Studio. Use the column mapping tools to align incoming schemas, map columns like 'gross_rev' to 'grossRevenue', normalize currencies, and run validation scripts.",
        "Centralized Metric Registry: Access the registry to review mathematical definitions for business indicators (e.g., Gross Sales, Prize Expense, Benefactor Transfers). Verify formula dependencies and check approval logs before committing code changes.",
        "Compliance Gates: Review compliance rules. Set threshold triggers (e.g. Variance > 10% compared to baseline scenarios). Discrepancies generate warning tags (yellow) or failure states (red) that automatically lock package compilation.",
        "Commentary Rules Engine: When a metric triggers a variance warning, the Commentary Rules engine forces the assigned operational lead to write a qualitative justification. Reports cannot be finalized until all commentaries are completed.",
        "Narrative Template Editor: Populate text blocks and spreadsheet matrices with live registry metrics using dynamic tags. Export the finalized document as a compiled Word/PDF packet or check draft values using the sandbox toggle."
      ],
      examples: "Example Use Case: A finance manager loads a new weekly ledger CSV into the Data Prep Studio. The system flags that 'Benefactor Transfers' fell 12% below last year's forecast. A commentary task is automatically generated and assigned to the regional analyst, requiring them to explain the variance before the ACFR binder can be compiled.",
      tips: "Troubleshooting: If a narrative compilation fails, open the Rules Gate panel to verify that all mandatory commentary blocks have been completed and approved by a reviewer, and check that no mathematical dependencies in the Metric Registry are marked as broken."
    }
  },
  {
    id: "fomo",
    category: "fomo",
    title: "Field Operations, Merchandising & Oversight (FOMO)",
    summary: "Track field visits, retail merchandising compliance, equipment inventory, and GIS coordinate geodata audits.",
    content: {
      overview: "The FOMO system manages field activities, merchandising compliance, and retail inventory across all lottery retail locations. It enables field representatives to schedule visits, run equipment audits, and report geocoding errors directly to regional offices.",
      steps: [
        "Retailer Registry: Search and filter accounts by route codes, chains, compliance scores, or training statuses.",
        "Conduct Store Audits: Use the Visit form to check off POS signage visibility, dispenser cleanliness, scratch-off ticket inventory levels, and observed equipment counts.",
        "Equipment Serial Audit: Log serial numbers of active terminals and scratch-off ticket dispensers. The system automatically cross-references these with expected registry counts. Any mismatch triggers an immediate 'Equipment Exception'.",
        "Geodata Mismatch Audit: The system flags if a representative logs a visit from coordinates that deviate from the retailer's registered lat/long location. Review and reconcile geocoding discrepancies using the mapping tool."
      ],
      examples: "Example Use Case: Representative Tyler Cabral visits a retail outlet. He notes that two expected ticket dispensers are missing from the counter. He opens the visit form, inputs the serial numbers of the active dispensers, and saves it. The system automatically raises an 'Equipment Exception' task for the supervisor's dashboard.",
      tips: "Troubleshooting: If the Visit Form fails to submit, verify that your GPS services are enabled on your device. The system requires location telemetry to validate the retailer's GIS geodata coordinates."
    }
  },
  {
    id: "solr",
    category: "solr",
    title: "Spatial Operations, Logistics & Risk (SOLR)",
    summary: "Real-time threat mapping, weather warning integration, and regional risk route planning.",
    content: {
      overview: "SOLR integrates live geographical data (NOAA, USGS) with Stochos retailer networks to evaluate spatial threats, analyze weather risk proximity, and plan safe logistics routes for ticket and equipment distribution.",
      steps: [
        "Threat Map Tracking: View live feeds of storms, floods, winter advisories, or seismic activities overlaying active transportation routes.",
        "Drawing Risk Zones: Use the Leaflet drawing tools to delineate custom zones. Draw rectangles, polylines, or circles to establish risk boundaries. The system automatically queries all retailers falling inside the drawn polygon.",
        "Buffer Radius Optimization: When drawing circles, specify a radius (in meters) to establish hazard boundaries. The backend projects coordinates and builds spatial buffers to calculate the count of highlighted retailer locations.",
        "Fleet Rerouting: Identify routes that intersect active hazard zones. Coordinate with dispatchers to flag route holds and safeguard delivery drivers."
      ],
      examples: "Example Use Case: A winter storm advisory is issued. The dispatcher draws a 25-mile circle buffer around the storm's predicted eye on the Leaflet map. The system immediately lists the 18 retailers falling within the risk zone and halts their ticket shipments for the next 24 hours.",
      tips: "Troubleshooting: If the circle drawing tool fails to register, ensure you are dragging the cursor outward from the center point to define the radius. The system projects WGS84 coordinates on the Shiny backend to compile the polygon buffer."
    }
  },
  {
    id: "contracts",
    category: "contracts",
    title: "Contract & Vendor Management",
    summary: "Manage active vendor agreements, PO budgets, row-level sharing rights, and compliance audit logs.",
    content: {
      overview: "The Contract suite oversees legal frameworks, budget caps, and compliance criteria. It regulates vendor relationships, tracks spent totals versus allocated limits, and controls secure sharing permissions for legal documents.",
      steps: [
        "Vendor Directory: Browse active vendor profiles, contact logs, active services, and minority-owned business certifications.",
        "Contract Parameters: Define parameters like start/end dates, notice intervals, and budget caps, and assign active workflows.",
        "Purchase Orders (PO): Track specific PO lines. The system computes real-time spent percentages compared to the contract ceiling.",
        "Access Management: Set up row-level security. Use the sharing widget to grant individual standard users read or write privileges on specific contracts. Non-admins can only see files shared with them or that they created.",
        "Audit Log Trail: Every change to a contract's metadata is stored in an immutable audit registry displaying the old values, new values, the actor email, and the timestamp."
      ],
      examples: "Example Use Case: A procurement officer reviews a media contract. They notice that the spent balance has reached 88% of the budget cap. They use the 'Add Access' tool to share the file with the finance analyst to coordinate a budget amendment.",
      tips: "Troubleshooting: If a user is unable to edit a contract, verify that they are listed inside the ContractAccess database table with the 'write' permission flag, or check if they are the contract creator or system admin."
    }
  },
  {
    id: "fleet",
    category: "fleet",
    title: "Fleet & IT Asset Registry",
    summary: "Track physical hardware inventories, vehicle logs, and straight-line asset depreciation.",
    content: {
      overview: "The Asset suite organizes both IT hardware and vehicle fleets, tracking custody, service logs, acquisition costs, and monthly straight-line financial depreciation records.",
      steps: [
        "Fleet Registry: Log delivery vans, license plates, assigned personnel, mileage counts, and service events.",
        "IT Hardware Registry: Record serial keys, software configurations, acquisition costs, and retirement schedules.",
        "Straight-Line Depreciation: The system automatically computes monthly depreciation values. Set the asset's acquisition price, expected salvage (scrap) value, and useful life (in years). The system divides the depreciable cost by the life in months.",
        "Assignment Workflow: Keep track of custody. Link vehicles to field representatives and hardware to specific office employees."
      ],
      examples: "Example Use Case: An IT director enters a new server costing $25,000 with a salvage value of $1,000 and a 4-year useful life. The system registers a monthly straight-line depreciation of $500.00 and logs the asset under the central registry.",
      tips: "Troubleshooting: If the depreciation field displays zero or throws an error, verify that the salvage value is less than the acquisition cost and that the useful life is set to an integer greater than zero."
    }
  },
  {
    id: "marketing",
    category: "marketing",
    title: "Marketing Campaign MRM",
    summary: "Track multi-channel campaigns, allocate media budgets, assign channels, and manage execution milestones.",
    content: {
      overview: "The Marketing MRM (Marketing Resource Management) system coordinates campaign execution, media placement scheduling, and marketing budget allocations across television, digital, radio, print, and point-of-sale display channels.",
      steps: [
        "Create Campaigns: Define active campaigns with targeted start/end dates, allocated budgets, and core promotional goals.",
        "Assign Channels: Segment marketing spend across media outlets. Set target reach, flight dates, and cost structures for each channel.",
        "Track Milestones: Create checklists for deliverables, such as copywriting approvals, asset exports, media booking confirmations, and compliance sign-offs.",
        "Budget Attribution: Monitor spent campaign funds in real-time. Link line item media bills to campaigns to trace variance percentages."
      ],
      examples: "Example Use Case: A marketing manager sets up the 'Summer Scratch Fest' campaign with a $150,000 budget. They allocate $60,000 to TV placements and $40,000 to digital social channels. They assign milestones to the graphics vendor for asset delivery and track approval tasks.",
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
  }
];

export default function HelpClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState("welcome");
  const [activeTab, setActiveTab] = useState("overview");

  const filteredGuides = guides.filter(g => 
    g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedGuide = guides.find(g => g.id === selectedGuideId) || guides[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: "calc(100vh - 120px)" }}>
      
      {/* Help Banner Header */}
      <div style={{ 
        padding: "24px 32px", 
        borderBottom: "1px solid var(--border)", 
        backgroundColor: "var(--card-bg)",
        borderRadius: "8px 8px 0 0",
        marginBottom: "24px"
      }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700" }}>📖 Stochos User Guide & Help Center</h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary)", fontSize: "14px" }}>
          Browse step-by-step instructions, examples, and troubleshooting for every module in the platform.
        </p>
        <div style={{ position: "relative", maxWidth: "480px" }}>
          <input 
            type="text" 
            placeholder="🔍 Search user guide topics (e.g. ETL, visit, SOLR)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-2)",
              color: "var(--text)",
              fontSize: "14px"
            }}
          />
        </div>
      </div>

      {/* Main Split Interface */}
      <div style={{ display: "flex", gap: "24px", flex: 1 }}>
        
        {/* Left Topics List */}
        <div style={{ 
          width: "320px", 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "8px", 
          border: "1px solid var(--border)",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto"
        }}>
          <h4 style={{ margin: "0 0 4px 0", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Help Categories</h4>
          
          {filteredGuides.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
              No matches found.
            </div>
          ) : (
            filteredGuides.map(g => (
              <button
                key={g.id}
                onClick={() => {
                  setSelectedGuideId(g.id);
                  setActiveTab("overview");
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "6px",
                  border: selectedGuideId === g.id ? "1px solid var(--primary-border)" : "1px solid transparent",
                  backgroundColor: selectedGuideId === g.id ? "var(--surface-3)" : "transparent",
                  color: selectedGuideId === g.id ? "var(--primary)" : "var(--text)",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px"
                }}
                className="help-topic-btn"
              >
                <div style={{ fontWeight: "600", fontSize: "13px" }}>{g.title}</div>
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.3" }}>{g.summary}</div>
              </button>
            ))
          )}
        </div>

        {/* Right Active Article Pane */}
        <div style={{ 
          flex: 1, 
          backgroundColor: "var(--card-bg)", 
          borderRadius: "8px", 
          border: "1px solid var(--border)",
          padding: "24px",
          display: "flex",
          flexDirection: "column"
        }}>
          
          {/* Article Header */}
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "20px" }}>
            <span style={{ 
              fontSize: "11px", 
              backgroundColor: "var(--surface-3)", 
              color: "var(--primary)", 
              padding: "4px 8px", 
              borderRadius: "4px", 
              textTransform: "uppercase", 
              fontWeight: "700" 
            }}>
              {selectedGuide.category}
            </span>
            <h3 style={{ margin: "8px 0 4px 0", fontSize: "20px", fontWeight: "700" }}>{selectedGuide.title}</h3>
            <p style={{ margin: "0", color: "var(--text-secondary)", fontSize: "13px" }}>{selectedGuide.summary}</p>
          </div>

          {/* Tab Selection */}
          <div className="flex space-x-2 mb-6 border-b border-gray-200" style={{ marginBottom: "20px" }}>
            <button
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "500",
                backgroundColor: activeTab === "overview" ? "var(--surface-3)" : "transparent",
                color: activeTab === "overview" ? "var(--primary)" : "var(--text-secondary)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("steps")}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "500",
                backgroundColor: activeTab === "steps" ? "var(--surface-3)" : "transparent",
                color: activeTab === "steps" ? "var(--primary)" : "var(--text-secondary)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Step-by-Step Instructions
            </button>
            <button
              onClick={() => setActiveTab("examples")}
              style={{
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: "500",
                backgroundColor: activeTab === "examples" ? "var(--surface-3)" : "transparent",
                color: activeTab === "examples" ? "var(--primary)" : "var(--text-secondary)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer"
              }}
            >
              Use-Case Examples & Tips
            </button>
          </div>

          {/* Article Body Content */}
          <div style={{ flex: 1, overflowY: "auto", fontSize: "14px", lineHeight: "1.6", color: "var(--text)" }}>
            
            {activeTab === "overview" && (
              <div>
                <p>{selectedGuide.content.overview}</p>
                <div style={{ 
                  marginTop: "24px", 
                  padding: "16px", 
                  backgroundColor: "var(--surface-2)", 
                  borderLeft: "4px solid var(--blue)",
                  borderRadius: "0 6px 6px 0",
                  fontSize: "13px"
                }}>
                  <strong>🔍 Purpose Indicator:</strong> This guide covers business workflows, compliance validations, and telemetry maps relevant to the New York Lottery operations.
                </div>
              </div>
            )}

            {activeTab === "steps" && (
              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>System Checklist:</h4>
                <ol style={{ paddingLeft: "20px", margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {selectedGuide.content.steps.map((step, idx) => (
                    <li key={idx}>
                      <span style={{ fontWeight: "600" }}>{step.split(":")[0]}:</span>
                      {step.split(":")[1]}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {activeTab === "examples" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ 
                  padding: "16px", 
                  backgroundColor: "rgba(16, 124, 65, 0.08)", 
                  border: "1px solid rgba(16, 124, 65, 0.3)",
                  borderRadius: "6px",
                  color: "var(--text)"
                }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#107c41", fontSize: "14px", fontWeight: "700" }}>💡 Practical Example</h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>{selectedGuide.content.examples}</p>
                </div>

                <div style={{ 
                  padding: "16px", 
                  backgroundColor: "rgba(255, 193, 7, 0.08)", 
                  border: "1px solid rgba(255, 193, 7, 0.3)",
                  borderRadius: "6px",
                  color: "var(--text)"
                }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#b45309", fontSize: "14px", fontWeight: "700" }}>⚠️ Operational Tip</h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>{selectedGuide.content.tips}</p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
