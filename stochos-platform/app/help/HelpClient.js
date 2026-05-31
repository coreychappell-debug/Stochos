"use client";
import { useState } from "react";

const guides = [
  {
    id: "welcome",
    category: "general",
    title: "Getting Started with Stochos",
    summary: "An overview of the Stochos business dashboard and navigating the enterprise platform.",
    content: {
      overview: "Welcome to Stochos, the unified operations and compliance platform. Stochos brings together financial oversight, merchandising audit records, logistics risk planning, and legal contract management in one streamlined environment.",
      steps: [
        "Dashboard Navigation: The homepage serves as an operational summary containing active warnings, financial totals, and direct links to active modules.",
        "Theme Customization: Toggle between Day Mode (clean, Microsoft/Google office spreadsheet styling) and Night Mode (high-contrast dark dashboard layout) using the toggle button at the bottom left of the sidebar.",
        "Role Authentication: Access to administrative panels (data normalization, contract approvals, metric auditing) requires corresponding clearance roles which are checked at the login portal."
      ],
      examples: "Example: Start your morning by checking the 'Operational Alerts' box on the Dashboard to see if any vendor contracts are expiring within 60 days or if any budget items are currently over-budget.",
      tips: "Tip: The sidebar is pinned and scrollable, ensuring that you can jump between analytical dashboards, Fomo logs, and contracts without losing context."
    }
  },
  {
    id: "gfpa",
    category: "gfpa",
    title: "Governed Financial & Performance Administration (GFPA)",
    summary: "Manage data preparation, metric formulas, compliance workflows, and template compilation.",
    content: {
      overview: "The GFPA suite provides comprehensive governance over performance audits, analytical formulas, and narrative spreadsheets. It contains five major sub-modules designed to guarantee that all reporting conforms to strict corporate guidelines.",
      steps: [
        "Data Prep Studio: Use the visual ETL editor to import raw csv data, map columns, apply filters, and normalize metrics before they hit the ledger.",
        "Metric Registry: Manage the mathematical formulas and rules that define business indicators. Check formulas, add new variables, and review approval history.",
        "Compliance Rules: Review active rules audits. Any discrepancies trigger warnings (yellow) or failures (red) that block template compilation until resolved.",
        "Workflow & Binders: Track package compilation stages. Set reviewers, assign tasks, and drop supporting evidence documents directly into the binder panels.",
        "Template Studio: Populate Word-like documents with live database metrics. Toggle preview modes to see mock data or compiled production values."
      ],
      examples: "Example: A corporate auditor opens 'Data Prep Studio', uploads the weekly sales CSV, maps 'gross_rev' to 'grossRevenue', Normalizes the currency rows, and runs the export pipeline to automatically update the registry.",
      tips: "Note: The narrative document editor features dynamic style parity, mirroring the Google Docs and Microsoft Word layouts for a comfortable document environment."
    }
  },
  {
    id: "fomo",
    category: "fomo",
    title: "Field Operations, Merchandising & Oversight (FOMO)",
    summary: "Track field visits, retail merchandising compliance, inventory logs, and geodata audits.",
    content: {
      overview: "The FOMO system is the operational hub for the field sales and merchandising teams. It helps coordinate store visits, audit lottery machines, track POS display installations, and resolve retailer discrepancies.",
      steps: [
        "Retailer Registry: View and filter all active retail store accounts by route, chain account, or training status.",
        "Log Store Visit: When visiting a retailer, field representatives log active visits, check if dispensers are clean and filled, verify POS signage visibility, and record ticket inventory levels.",
        "Geodata Audit: Ensure that spatial coordinates for retailers map correctly to GIS systems to prevent logistics routing delays. Flags and corrects coordinate mismatches.",
        "Equipment Exceptions: When expected equipment (e.g. instant ticket dispensers) does not match what is observed in the field, an exception is opened. Resolve exceptions by uploading photos or checking serial numbers."
      ],
      examples: "Example: Rep Tyler Cabral completes a routine audit at 'Broadway Newsstand' on Route NY-104. He notes that ticket inventory is adequate but POS signage was blocked. The system registers a merchandising score of 67% and flags a warning.",
      tips: "Fact: Reconciled geodata corrections are pushed directly to the SOLR logistics engine to calculate hazard buffer circles dynamically."
    }
  },
  {
    id: "solr",
    category: "solr",
    title: "Spatial Operations, Logistics & Risk (SOLR)",
    summary: "Real-time weather warning systems, earthquake trackers, and route risk planning.",
    content: {
      overview: "SOLR integrates live spatial data streams (USGS, NOAA) with retailer locations to monitor risk and optimize delivery logistics.",
      steps: [
        "Active Alerts: The map renders live weather hazards (flood zones, high winds, winter warnings) and seismic events.",
        "Hazard Buffer Circles: Displays proximity rings around retailers. Red highlights indicate high-risk locations that may require delivery holds.",
        "Logistics Route Verification: View route codes and evaluate if routes intersect active threat zones to ensure fleet safety."
      ],
      examples: "Example: During a winter storm, a 50-mile proximity buffer highlights 12 retailers on Route NY-108. The system updates the dispatcher console to reroute fleet vehicles away from blocked roads.",
      tips: "Tip: Switch to Day Mode to view a clean greyscale basemap, or Night Mode for a dark spatial dashboard with glowing heatmaps."
    }
  },
  {
    id: "contracts",
    category: "contracts",
    title: "Contract & Vendor Management",
    summary: "Track active contracts, purchase orders, vendor registry, and compliance records.",
    content: {
      overview: "The Contract Management system bridges legal documents with financial records. It manages deliverables, milestones, budgets, and compliance checks across all platform vendors.",
      steps: [
        "Contract Lifecycle: Monitor status flags (Active, Draft, Completed, Under Review) and set key parameters like start/end dates.",
        "Purchase Orders (PO): Track specific PO line items, verify spent amounts versus allocated budgets, and submit invoices for approval.",
        "Vendor Registry: Browse profiles, review certifications (e.g. minority-owned business status), and track association histories."
      ],
      examples: "Example: An administrator opens the 'Vendor Registry', selects 'Lottery Supplier Inc.', clicks 'Create PO', allocates $50,000 for ticket roll printing, and maps it to the active product supply contract.",
      tips: "Warning: If spent PO amounts exceed the budgeted contract cap, the Dashboard immediately triggers a red 'Budget Warning' banner."
    }
  },
  {
    id: "fleet",
    category: "fleet",
    title: "Fleet & IT Asset Registry",
    summary: "Track operational assets, vehicle logs, hardware lifecycles, and straight-line depreciation.",
    content: {
      overview: "The Asset Management suite provides registries for both transport fleet vehicles and IT department hardware, tracking maintenance and book values.",
      steps: [
        "Fleet Tracking: Log vehicle acquisitions, license plate numbers, assigned personnel, mileage counts, and maintenance checks.",
        "IT Asset Registry: Register hardware models, serial keys, software licenses, acquisition dates, and lifecycle boundaries.",
        "Straight-Line Depreciation: The system automatically computes monthly asset depreciation based on acquisition costs and estimated salvage values."
      ],
      examples: "Example: The fleet manager registers a new Ford Transit delivery van costing $45,000 with a salvage value of $5,000 and a 5-year life. The system calculates a monthly straight-line depreciation of $666.67.",
      tips: "Tip: Configure maintenance intervals on vehicles to trigger alerts when mileage margins are reached."
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
