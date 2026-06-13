"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "../../components/Sidebar";
import { 
  Settings, Zap, Check, Save, RotateCcw, 
  Users, BarChart3, Store, Package, FileSpreadsheet, 
  Grid, Folders, Briefcase, Map, TrendingUp, 
  Megaphone, Ticket, Dices, Layers, Handshake, 
  FileText, Car, Building2, Globe, Monitor, ShieldAlert,
  Lock
} from "lucide-react";
import Link from "next/link";

const FEATURE_META = {
  feature_organization: { label: "Organization & Leadership", section: "Platform", icon: <Users size={16} />, desc: "Organizational structures, division leads, and bureau roles." },
  
  feature_analytics_overview: { label: "Executive Overview", section: "Finance & Analytics", icon: <BarChart3 size={16} />, desc: "Top-line performance KPIs and ledger balance rollups." },
  feature_analytics_retailers: { label: "Retailer Profitability", section: "Finance & Analytics", icon: <Store size={16} />, desc: "Detailed sales and profit matrices for the retailer network." },
  feature_analytics_portfolio: { label: "Portfolio Mix", section: "Finance & Analytics", icon: <Package size={16} />, desc: "Breakdown of product portfolios, categories, and sales volumes." },
  feature_reporting: { label: "GFPA Financial Administration", section: "Finance & Analytics", icon: <FileSpreadsheet size={16} />, desc: "Governed Financial & Performance Administration cockpit." },
  feature_reporting_prep: { label: "Data Prep Studio", section: "Finance & Analytics", icon: <Settings size={16} />, desc: "Ingest, map, and balance raw trial balance records." },
  feature_reporting_grid: { label: "Governed Grid", section: "Finance & Analytics", icon: <Grid size={16} />, desc: "Pivot-ready dynamic financial ledger view." },
  feature_reporting_workflow: { label: "Workflow & Binders", section: "Finance & Analytics", icon: <Folders size={16} />, desc: "Interactive statutory audit binders and commentary pipelines." },
  feature_budgeting: { label: "Divisional Budgeting", section: "Finance & Analytics", icon: <Briefcase size={16} />, desc: "Division-level budget proposals, approval flows, and PO sync." },

  feature_analytics_geography: { label: "Geography & Network", section: "Marketing", icon: <Map size={16} />, desc: "Spatial maps of stores, county sales, and rep balance." },
  feature_analytics_forecast: { label: "Forecast & Outlook", section: "Marketing", icon: <TrendingUp size={16} />, desc: "Predictive model outlooks for ticket sales and revenue streams." },
  feature_marketing: { label: "Marketing MRM", section: "Marketing", icon: <Megaphone size={16} />, desc: "Multi-channel campaign tracking, budgets, and milestones." },
  feature_instant_tickets: { label: "Instant Tickets Planner", section: "Marketing", icon: <Ticket size={16} />, desc: "Scratch-off production games, vendors, and pricing scales." },
  feature_draw_planning: { label: "Draw Game Planning", section: "Marketing", icon: <Dices size={16} />, desc: "Mathematical planning models for draw jackpots and matrix odds." },
  feature_products: { label: "Product Catalog", section: "Marketing", icon: <Layers size={16} />, desc: "Shared product and game listings database." },

  feature_fomo: { label: "VCRM Operations", section: "Operations", icon: <Handshake size={16} />, desc: "Visitations, Coaching & Relationship Management for field reps." },
  feature_contracts: { label: "Contract Management", section: "Operations", icon: <FileText size={16} />, desc: "Track legal agreements, compliance terms, and spent thresholds." },
  feature_fleet: { label: "Fleet Management", section: "Operations", icon: <Car size={16} />, desc: "Vehicle logs, replacement mileage milestones, and depreciation." },
  feature_vendors: { label: "Vendor Registry", section: "Operations", icon: <Building2 size={16} />, desc: "Shared profiles of lottery printers, agencies, and suppliers." },
  feature_spatial_ops: { label: "SOLR Risk & Logistics", section: "Operations", icon: <Globe size={16} />, desc: "Spatial Ops, Logistics & Risk dashboard for weather alerts." },

  feature_assets: { label: "Asset Management", section: "Operations", icon: <Monitor size={16} />, desc: "Corporate hardware inventory, EOL tracking, and label printing." }
};

const PRESETS = {
  full: {
    label: "Full Platform Suite",
    desc: "Enables all available features and tools across the entire platform.",
    flags: {
      feature_organization: true, feature_analytics_overview: true, feature_analytics_retailers: true,
      feature_analytics_portfolio: true, feature_reporting: true, feature_reporting_prep: true,
      feature_reporting_grid: true, feature_reporting_workflow: true, feature_budgeting: true,
      feature_analytics_geography: true, feature_analytics_forecast: true, feature_marketing: true,
      feature_instant_tickets: true, feature_draw_planning: true, feature_products: true,
      feature_fomo: true, feature_contracts: true, feature_fleet: true, feature_vendors: true,
      feature_spatial_ops: true, feature_assets: true
    }
  },
  financials: {
    label: "Finance & Administration Only",
    desc: "Locks down marketing/ops tools. Shows only GFPA, Budgeting, and Financial Analytics.",
    flags: {
      feature_organization: true, feature_analytics_overview: true, feature_analytics_retailers: true,
      feature_analytics_portfolio: true, feature_reporting: true, feature_reporting_prep: true,
      feature_reporting_grid: true, feature_reporting_workflow: true, feature_budgeting: true,
      feature_analytics_geography: false, feature_analytics_forecast: false, feature_marketing: false,
      feature_instant_tickets: false, feature_draw_planning: false, feature_products: false,
      feature_fomo: false, feature_contracts: true, feature_fleet: false, feature_vendors: true,
      feature_spatial_ops: false, feature_assets: false
    }
  },
  operations: {
    label: "Field Operations & Procurement Only",
    desc: "Hides financial ledgers/marketing forecasting. Opens FOMO, Fleet, SOLR, and Contracts.",
    flags: {
      feature_organization: true, feature_analytics_overview: false, feature_analytics_retailers: false,
      feature_analytics_portfolio: false, feature_reporting: false, feature_reporting_prep: false,
      feature_reporting_grid: false, feature_reporting_workflow: false, feature_budgeting: false,
      feature_analytics_geography: true, feature_analytics_forecast: false, feature_marketing: false,
      feature_instant_tickets: false, feature_draw_planning: false, feature_products: true,
      feature_fomo: true, feature_contracts: true, feature_fleet: true, feature_vendors: true,
      feature_spatial_ops: true, feature_assets: true
    }
  },
  light: {
    label: "Minimalist / Trial Demo",
    desc: "A simplified trial version showcasing only Asset Management and core dashboards.",
    flags: {
      feature_organization: false, feature_analytics_overview: false, feature_analytics_retailers: false,
      feature_analytics_portfolio: false, feature_reporting: false, feature_reporting_prep: false,
      feature_reporting_grid: false, feature_reporting_workflow: false, feature_budgeting: false,
      feature_analytics_geography: false, feature_analytics_forecast: false, feature_marketing: false,
      feature_instant_tickets: false, feature_draw_planning: false, feature_products: false,
      feature_fomo: false, feature_contracts: false, feature_fleet: false, feature_vendors: false,
      feature_spatial_ops: false, feature_assets: true
    }
  }
};

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const [features, setFeatures] = useState({});
  const [licensed, setLicensed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lockedModalModule, setLockedModalModule] = useState(null);

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/admin/settings")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load settings");
          return res.json();
        })
        .then((data) => {
          setFeatures(data.features || {});
          setLicensed(data.licensed || []);
        })
        .catch((err) => {
          setErrorMessage(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [status]);

  const handleToggle = (key) => {
    const isCurrentlyEnabled = features[key] !== false;
    // Gating: If turning ON but not licensed under the contract, block and show the upgrade modal
    if (!isCurrentlyEnabled && !licensed.includes(key)) {
      const meta = FEATURE_META[key];
      setLockedModalModule(meta ? meta.label : "Selected Module");
      return;
    }
    setFeatures((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const applyPreset = (presetName) => {
    const preset = PRESETS[presetName];
    if (preset) {
      const filteredFlags = {};
      Object.entries(preset.flags).forEach(([key, val]) => {
        // Enforce license boundaries when applying presets
        if (val === true) {
          filteredFlags[key] = licensed.includes(key);
        } else {
          filteredFlags[key] = false;
        }
      });

      setFeatures(filteredFlags);
      setSuccessMessage(`Applied preset: ${preset.label} (filtered by contract license limits). Remember to save!`);
      setTimeout(() => setSuccessMessage(""), 4000);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(features),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to update configurations");
      }

      const data = await res.json();
      setFeatures(data.features);
      setSuccessMessage("Licensing configurations and feature toggles saved successfully! Sidebars will reload.");
      setTimeout(() => setSuccessMessage(""), 5000);
      window.dispatchEvent(new Event("storage")); // Trigger sidebar update
    } catch (err) {
      setErrorMessage(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <h2>Administrative Cockpit</h2>
            <p>Loading licensing presets...</p>
          </div>
        </main>
      </div>
    );
  }

  // Deny access if user is not authenticated or lacks the admin role
  if (status === "unauthenticated" || session?.user?.role !== "admin") {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <div className="page-header">
            <h2>Access Denied</h2>
            <p>Administrative Privileges Required</p>
          </div>
          <div className="page-body" style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "40px" }}>
            <div className="card" style={{ maxWidth: "500px", width: "100%", borderLeft: "4px solid var(--red)", background: "var(--surface-1)" }}>
              <div className="card-body" style={{ padding: "40px 32px", textAlign: "center" }}>
                <ShieldAlert size={64} style={{ color: "var(--red)", marginBottom: "20px" }} />
                <h3>Admin Privileges Required</h3>
                <p style={{ color: "var(--text-secondary)", marginBottom: "28px" }}>
                  You must be logged in as an administrator to toggle Stochos platform features.
                </p>
                <Link href="/" className="btn btn-primary">
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Group features by section
  const sections = {};
  Object.entries(FEATURE_META).forEach(([key, meta]) => {
    if (!sections[meta.section]) {
      sections[meta.section] = [];
    }
    sections[meta.section].push({ key, ...meta });
  });

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text)", margin: 0 }}>
              Feature Toggles &amp; Licensing Cockpit
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", margin: 0 }}>
              Manage platform complexity on-the-fly. Toggle modules off/on to scale demo profiles or target contracts.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                setLoading(true);
                fetch("/api/admin/settings")
                  .then(r => r.json())
                  .then(d => {
                    setFeatures(d.features || {});
                    setLicensed(d.licensed || []);
                  })
                  .finally(() => setLoading(false));
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <RotateCcw size={15} /> Reset Changes
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSave}
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "var(--gold)", border: "none" }}
            >
              <Save size={15} /> {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        {successMessage && (
          <div style={{ padding: "14px 18px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "8px", border: "1px solid #dcfce7", marginBottom: "1.5rem", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Check size={16} /> {successMessage}
          </div>
        )}

        {errorMessage && (
          <div style={{ padding: "14px 18px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "8px", border: "1px solid #fee2e2", marginBottom: "1.5rem", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldAlert size={16} /> {errorMessage}
          </div>
        )}

        {/* PRESES SECTION */}
        <div className="card" style={{ marginBottom: "24px", background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-2) 100%)", borderLeft: "4px solid var(--gold)" }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--gold)", margin: 0 }}>
              <Zap size={18} /> Sales Demo Preset Profiles
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "13px", margin: "4px 0 0 0" }}>
              One-click targets to configure the Stochos suite for specialized lottery procurement meetings.
            </p>
          </div>
          <div className="card-body" style={{ padding: "24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                style={{
                  textAlign: "left",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "16px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
                className="preset-card"
              >
                <strong style={{ fontSize: "14px", color: "var(--text)" }}>{preset.label}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>{preset.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* TOGGLES GRID */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {Object.entries(sections).map(([sectionName, items]) => (
            <div className="card" key={sectionName}>
              <div className="card-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--text)" }}>{sectionName}</h3>
              </div>
              <div className="card-body" style={{ padding: "0" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {items.map((item) => {
                    const isLicensed = licensed.includes(item.key);
                    const isEnabled = features[item.key] !== false;
                    return (
                      <div 
                        key={item.key} 
                        onClick={!isLicensed ? () => handleToggle(item.key) : undefined}
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between", 
                          padding: "18px 24px", 
                          borderBottom: "1px solid var(--border-dim)",
                          background: isEnabled ? "transparent" : "var(--surface-3)",
                          opacity: isLicensed ? (isEnabled ? 1 : 0.75) : 0.6,
                          cursor: !isLicensed ? "pointer" : "default",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, paddingRight: "20px" }}>
                          <div style={{ 
                            width: "32px", 
                            height: "32px", 
                            borderRadius: "6px", 
                            backgroundColor: (isEnabled && isLicensed) ? "rgba(217, 119, 6, 0.1)" : "var(--surface-2)", 
                            color: (isEnabled && isLicensed) ? "var(--gold)" : "var(--text-secondary)",
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "center" 
                          }}>
                            {item.icon}
                          </div>
                          <div>
                            <strong style={{ display: "inline-flex", alignItems: "center", fontSize: "14px", color: "var(--text)" }}>
                              {item.label}
                              {!isLicensed && (
                                <span style={{ 
                                  fontSize: "9px", 
                                  backgroundColor: "rgba(239, 68, 68, 0.08)", 
                                  color: "var(--red)", 
                                  border: "1px solid rgba(239, 68, 68, 0.2)", 
                                  borderRadius: "4px", 
                                  padding: "2px 6px", 
                                  marginLeft: "8px", 
                                  fontWeight: "700", 
                                  textTransform: "uppercase", 
                                  display: "inline-flex", 
                                  alignItems: "center", 
                                  gap: "4px" 
                                }}>
                                  <Lock size={9} /> Locked by Contract
                                </span>
                              )}
                            </strong>
                            <span style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                              {item.desc}
                            </span>
                          </div>
                        </div>
                        
                        {/* TOGGLE SWITCH */}
                        <label className="switch" style={{ position: "relative", display: "inline-block", width: "48px", height: "24px", opacity: isLicensed ? 1 : 0.5 }}>
                          <input 
                            type="checkbox" 
                            checked={isEnabled && isLicensed} 
                            disabled={!isLicensed}
                            onChange={() => handleToggle(item.key)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: "absolute",
                            cursor: isLicensed ? "pointer" : "not-allowed",
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: (isEnabled && isLicensed) ? "var(--gold)" : "#d1d5db",
                            borderRadius: "34px",
                            transition: "0.2s"
                          }}>
                            <span style={{
                              position: "absolute",
                              content: '""',
                              height: "18px", width: "18px",
                              left: (isEnabled && isLicensed) ? "26px" : "4px",
                              bottom: "3px",
                              backgroundColor: "white",
                              borderRadius: "50%",
                              transition: "0.2s",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}>
                              {!isLicensed && <Lock size={10} style={{ color: "#9ca3af" }} />}
                            </span>
                          </span>
                        </label>

                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* LOCKED MODULE UPGRADE MODAL */}
        {lockedModalModule && (
          <div style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}>
            <div className="card" style={{
              maxWidth: "480px",
              width: "100%",
              borderLeft: "4px solid var(--red)",
              background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-1) 100%)",
              boxShadow: "var(--shadow-elevated)",
              borderRadius: "12px",
              overflow: "hidden",
              animation: "scaleIn 0.2s ease-out"
            }}>
              <div className="card-body" style={{ padding: "32px", textAlign: "center" }}>
                <div style={{
                  display: "inline-flex",
                  justifyContent: "center",
                  marginBottom: "20px",
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  color: "var(--red)",
                  alignItems: "center"
                }}>
                  <Lock size={28} />
                </div>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--text)", marginBottom: "12px" }}>
                  Contract Upgrade Required
                </h3>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
                  The module <strong>{lockedModalModule}</strong> is not enabled under your current Stochos platform contract license. 
                  To request activation or schedule a product walkthrough, click the button below to notify your account representative.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: "8px 20px" }}
                    onClick={() => setLockedModalModule(null)}
                  >
                    Close
                  </button>
                  <button 
                    className="btn btn-primary" 
                    style={{ padding: "8px 20px", backgroundColor: "var(--red)", borderColor: "var(--red)", color: "white" }}
                    onClick={() => {
                      alert(`Your upgrade request for ${lockedModalModule} has been sent to Stochos support! Our team will contact you shortly.`);
                      setLockedModalModule(null);
                    }}
                  >
                    Request Activation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      <style jsx global>{`
        .preset-card:hover {
          border-color: var(--gold) !important;
          background-color: var(--surface-2) !important;
          transform: translateY(-2px);
          box-shadow: var(--shadow-sm);
        }
      `}</style>
    </div>
  );
}
