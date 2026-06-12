"use client";
import { useState, useEffect } from "react";
import { guides } from "../lib/guidesData";
import { BookOpen, Search, Lightbulb, AlertTriangle, FileSpreadsheet, Briefcase, Handshake, Globe, FileText, Car, Megaphone, Ticket, Layers, UploadCloud, Grid, Settings, Shield, GitBranch, Calendar, FileCheck, Sliders } from "lucide-react";

const getGuideIcon = (id, size = 16) => {
  switch (id) {
    case "welcome":
      return <BookOpen size={size} style={{ color: "var(--primary)" }} />;
    case "gfpa":
      return <FileSpreadsheet size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_upload":
      return <UploadCloud size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_grid":
      return <Grid size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_prep":
      return <Settings size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_rules":
      return <Shield size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_template":
      return <FileText size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_workflow":
      return <GitBranch size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_calendar":
      return <Calendar size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_registry":
      return <Sliders size={size} style={{ color: "var(--primary)" }} />;
    case "reporting_gasb34":
      return <FileCheck size={size} style={{ color: "var(--primary)" }} />;
    case "budget":
      return <Briefcase size={size} style={{ color: "var(--primary)" }} />;
    case "fomo":
      return <Handshake size={size} style={{ color: "var(--primary)" }} />;
    case "solr":
      return <Globe size={size} style={{ color: "var(--primary)" }} />;
    case "contracts":
      return <FileText size={size} style={{ color: "var(--primary)" }} />;
    case "fleet":
      return <Car size={size} style={{ color: "var(--primary)" }} />;
    case "marketing":
      return <Megaphone size={size} style={{ color: "var(--primary)" }} />;
    case "tickets":
      return <Ticket size={size} style={{ color: "var(--primary)" }} />;
    case "products":
      return <Layers size={size} style={{ color: "var(--primary)" }} />;
    case "auditor_playbook":
      return <FileSpreadsheet size={size} style={{ color: "var(--primary)" }} />;
    case "bureau_chief_playbook":
      return <Briefcase size={size} style={{ color: "var(--primary)" }} />;
    case "division_lead_playbook":
      return <Layers size={size} style={{ color: "var(--primary)" }} />;
    case "sales_rep_playbook":
      return <Car size={size} style={{ color: "var(--primary)" }} />;
    default:
      return <BookOpen size={size} style={{ color: "var(--primary)" }} />;
  }
};

export default function HelpClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGuideId, setSelectedGuideId] = useState("welcome");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const topic = params.get("topic");
      if (topic && guides.some(g => g.id === topic)) {
        setSelectedGuideId(topic);
      }
    }
  }, []);

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
        <h2 style={{ margin: "0 0 8px 0", fontSize: "22px", fontWeight: "700", display: "flex", alignItems: "center", gap: "10px" }}>
          <BookOpen size={24} style={{ color: "var(--primary)" }} /> Stochos User Guide & Help Center
        </h2>
        <p style={{ margin: "0 0 16px 0", color: "var(--text-secondary)", fontSize: "14px" }}>
          Browse step-by-step instructions, examples, and troubleshooting for every module in the platform.
        </p>
        <div style={{ position: "relative", maxWidth: "480px" }}>
          <input 
            type="text" 
            placeholder="Search user guide topics (e.g. ETL, visit, SOLR)..." 
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
          {filteredGuides.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "13px", textAlign: "center" }}>
              No matches found.
            </div>
          ) : (
            <>
              {/* Playbooks Section */}
              {filteredGuides.some(g => g.category === 'playbooks') && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <h4 style={{ margin: "12px 0 4px 0", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Role-Based Playbooks</h4>
                  {filteredGuides.filter(g => g.category === 'playbooks').map(g => (
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
                      <div style={{ fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>{getGuideIcon(g.id, 16)} {g.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.3" }}>{g.summary}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Module Guides Section */}
              {filteredGuides.some(g => g.category !== 'playbooks') && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <h4 style={{ margin: "16px 0 4px 0", fontSize: "11px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "bold" }}>Module User Guides</h4>
                  {filteredGuides.filter(g => g.category !== 'playbooks').map(g => (
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
                      <div style={{ fontWeight: "600", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>{getGuideIcon(g.id, 16)} {g.title}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.3" }}>{g.summary}</div>
                    </button>
                  ))}
                </div>
              )}
            </>
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
            <h3 style={{ margin: "8px 0 4px 0", fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>{getGuideIcon(selectedGuide.id, 20)} {selectedGuide.title}</h3>
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
            {selectedGuide.content.comparison && (
              <button
                onClick={() => setActiveTab("comparison")}
                style={{
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: "500",
                  backgroundColor: activeTab === "comparison" ? "var(--surface-3)" : "transparent",
                  color: activeTab === "comparison" ? "var(--primary)" : "var(--text-secondary)",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Sales &amp; Industry Standards
              </button>
            )}
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
                  <strong style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <Search size={14} style={{ color: "var(--blue)" }} /> Purpose Indicator:
                  </strong>{" "}
                  This guide covers business workflows, compliance validations, and telemetry maps relevant to the New York Lottery operations.
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
                  <h4 style={{ margin: "0 0 8px 0", color: "#107c41", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Lightbulb size={16} /> Practical Example
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>{selectedGuide.content.examples}</p>
                </div>

                <div style={{ 
                  padding: "16px", 
                  backgroundColor: "rgba(255, 193, 7, 0.08)", 
                  border: "1px solid rgba(255, 193, 7, 0.3)",
                  borderRadius: "6px",
                  color: "var(--text)"
                }}>
                  <h4 style={{ margin: "0 0 8px 0", color: "#b45309", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                    <AlertTriangle size={16} /> Operational Tip
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>{selectedGuide.content.tips}</p>
                </div>
              </div>
            )}

            {activeTab === "comparison" && selectedGuide.content.comparison && (
              <div>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "15px", fontWeight: "600" }}>Sales Positioning &amp; Industry Standards Comparison</h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "16px" }}>
                  Stochos provides a best-in-class, low-infrastructure asset registry optimized for remote networks, retail hardware, and physical inventory.
                </p>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ fontSize: "13px", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", width: "25%" }}>Capability</th>
                        <th style={{ textAlign: "left", width: "35%" }}>Standard Low-Infra Tools</th>
                        <th style={{ textAlign: "left", width: "40%" }}>Stochos Asset Management</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedGuide.content.comparison.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: "600" }}>{row.capability}</td>
                          <td className="muted">{row.standard}</td>
                          <td style={{ color: "var(--blue)", fontWeight: "600" }}>{row.stochos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
}
