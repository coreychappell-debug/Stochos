"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { 
  Megaphone, 
  Search, 
  BarChart3, 
  DollarSign, 
  Calendar, 
  FileText, 
  AlertTriangle, 
  Check, 
  SlidersHorizontal,
  Clock,
  User,
  Image,
  TrendingUp,
  Settings,
  X
} from "lucide-react";

const STATUS_LABELS = {
  planning: "Planning",
  briefed: "Briefed",
  in_production: "In Production",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CAMPAIGN_TYPES = {
  jackpot_awareness: "Jackpot Awareness",
  new_game_launch: "New Game Launch",
  seasonal: "Seasonal",
  brand: "Brand",
  retail_activation: "Retail Activation",
  digital: "Digital / Social",
};

const CHANNEL_LABELS = {
  tv: "Television",
  radio: "Radio",
  digital_display: "Digital Display",
  social_media: "Social Media",
  search: "Search Engine",
  outdoor: "Outdoor / Billboard",
  pos_retail: "Retail POS",
  print: "Print / Signage",
  experiential: "Experiential",
  influencer: "Influencer",
  email: "Email / CRM"
};

// Industry Standard Benchmarks Defaults
const DEFAULT_CPM = {
  tv: 15.00,
  radio: 8.00,
  digital_display: 5.00,
  social_media: 4.00,
  search: 12.00,
  pos_retail: 2.00,
  outdoor: 6.00,
  print: 10.00,
  experiential: 25.00,
  influencer: 8.00,
  email: 1.00
};

const DEFAULT_MULTIPLIER = {
  tv: 2.5,
  radio: 1.8,
  digital_display: 1.5,
  social_media: 1.6,
  search: 1.4,
  pos_retail: 3.0,
  outdoor: 1.2,
  print: 1.1,
  experiential: 1.3,
  influencer: 1.7,
  email: 2.0
};

function fmt$(val) {
  if (val === null || val === undefined) return "—";
  const num = parseFloat(val);
  return isNaN(num) ? "—" : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function MarketingClient({ campaigns }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("portfolio"); // "portfolio" | "timeline" | "assets" | "analytics"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); 
  const [typeFilter, setTypeFilter] = useState("all");
  const [analyticsScope, setAnalyticsScope] = useState("active"); 
  
  // Drag & Drop / Kanban States
  const [savingAssetId, setSavingAssetId] = useState(null);
  
  // ROI Calculator States
  const [cpmSettings, setCpmSettings] = useState(DEFAULT_CPM);
  const [multiplierSettings, setMultiplierSettings] = useState(DEFAULT_MULTIPLIER);
  const [roiSpendMetric, setRoiSpendMetric] = useState("actual"); // "planned" | "actual"
  const [showRoiSettings, setShowRoiSettings] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (c.vendor?.name && c.vendor.name.toLowerCase().includes(searchQuery.toLowerCase()));
      
      let matchesStatus = true;
      if (statusFilter === "live") {
        matchesStatus = c.status === "live" || c.status === "in_production";
      } else if (statusFilter === "planning") {
        matchesStatus = c.status === "planning" || c.status === "briefed";
      } else if (statusFilter === "completed") {
        matchesStatus = c.status === "completed";
      } else if (statusFilter !== "all") {
        matchesStatus = c.status === statusFilter;
      }

      let matchesType = true;
      if (typeFilter !== "all") {
        matchesType = c.campaignType === typeFilter;
      }

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [campaigns, searchQuery, statusFilter, typeFilter]);

  // Analytics Calculations
  const analyticsCampaigns = useMemo(() => {
    if (analyticsScope === "active") {
      return campaigns.filter(c => c.status === "live" || c.status === "in_production");
    }
    return campaigns;
  }, [campaigns, analyticsScope]);

  const metrics = useMemo(() => {
    let totalBudget = 0;
    let totalPlanned = 0;
    let totalActual = 0;

    analyticsCampaigns.forEach(c => {
      totalBudget += parseFloat(c.totalBudget) || 0;
      (c.channels || []).forEach(ch => {
        totalPlanned += parseFloat(ch.plannedSpend) || 0;
        totalActual += parseFloat(ch.actualSpend) || 0;
      });
    });

    const remaining = totalBudget - totalActual;
    const isOverspent = remaining < 0;

    return {
      totalBudget,
      totalPlanned,
      totalActual,
      remaining,
      isOverspent
    };
  }, [analyticsCampaigns]);

  // Channel Spend Data for Chart
  const channelChartData = useMemo(() => {
    const channelMap = {};
    
    Object.keys(CHANNEL_LABELS).forEach(key => {
      channelMap[key] = { name: CHANNEL_LABELS[key], planned: 0, actual: 0 };
    });

    analyticsCampaigns.forEach(c => {
      (c.channels || []).forEach(ch => {
        const key = ch.channel;
        if (channelMap[key]) {
          channelMap[key].planned += parseFloat(ch.plannedSpend) || 0;
          channelMap[key].actual += parseFloat(ch.actualSpend) || 0;
        } else {
          channelMap[key] = { 
            name: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), 
            planned: parseFloat(ch.plannedSpend) || 0, 
            actual: parseFloat(ch.actualSpend) || 0 
          };
        }
      });
    });

    return Object.values(channelMap).filter(d => d.planned > 0 || d.actual > 0);
  }, [analyticsCampaigns]);

  // Campaign Spend Data for Chart
  const campaignChartData = useMemo(() => {
    return analyticsCampaigns.map(c => {
      const planned = (c.channels || []).reduce((sum, ch) => sum + (parseFloat(ch.plannedSpend) || 0), 0);
      const actual = (c.channels || []).reduce((sum, ch) => sum + (parseFloat(ch.actualSpend) || 0), 0);
      return {
        name: c.name.length > 25 ? c.name.substring(0, 22) + "..." : c.name,
        planned,
        actual,
        budget: parseFloat(c.totalBudget) || 0
      };
    }).filter(d => d.planned > 0 || d.actual > 0 || d.budget > 0);
  }, [analyticsCampaigns]);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--text)" }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
          {payload.map((p, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 20, margin: "2px 0" }}>
              <span style={{ color: p.color }}>{p.name}:</span>
              <span style={{ fontWeight: 700 }}>{fmt$(p.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // --- 1. Gantt Timeline Computations ---
  const timelineData = useMemo(() => {
    const datedCampaigns = campaigns.filter(c => c.startDate && c.endDate && c.status !== "cancelled");
    if (datedCampaigns.length === 0) return { campaigns: [], months: [] };

    // Find min and max dates
    let minDate = new Date(Math.min(...datedCampaigns.map(c => new Date(c.startDate))));
    let maxDate = new Date(Math.max(...datedCampaigns.map(c => new Date(c.endDate))));

    // Buffer dates to align with start and end of months
    minDate = new Date(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1);
    maxDate = new Date(maxDate.getUTCFullYear(), maxDate.getUTCMonth() + 1, 0);

    // Build array of month boundaries
    const months = [];
    let current = new Date(minDate);
    while (current <= maxDate) {
      months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }

    const totalTimelineMs = maxDate.getTime() - minDate.getTime();

    const formattedCampaigns = datedCampaigns.map(c => {
      const cStart = new Date(c.startDate);
      const cEnd = new Date(c.endDate);
      const leftPct = ((cStart.getTime() - minDate.getTime()) / totalTimelineMs) * 100;
      const widthPct = ((cEnd.getTime() - cStart.getTime()) / totalTimelineMs) * 100;

      // Color coding status
      let barColor = "var(--green)"; // live / completed
      if (c.status === "planning" || c.status === "briefed") barColor = "var(--gold)";
      if (c.status === "in_production") barColor = "var(--blue)";
      if (c.status === "cancelled") barColor = "#94a3b8";

      return {
        ...c,
        leftPct: Math.max(0, leftPct),
        widthPct: Math.max(1.5, widthPct),
        barColor
      };
    });

    return {
      campaigns: formattedCampaigns,
      months,
      minDate,
      maxDate,
      totalTimelineMs
    };
  }, [campaigns]);

  // --- 2. Kanban Creative Asset Board Logic ---
  const kanbanAssets = useMemo(() => {
    // Gather all assets across all campaigns
    const allAssets = [];
    campaigns.forEach(c => {
      if (c.assets && c.assets.length > 0) {
        c.assets.forEach(a => {
          allAssets.push({
            ...a,
            campaignName: c.name,
            campaignId: c.id
          });
        });
      }
    });

    // Group into columns
    const columns = {
      draft: [],
      in_review: [],
      approved: [],
      rejected: []
    };

    allAssets.forEach(a => {
      if (a.status === "retired" || a.approvalStatus === "rejected") {
        columns.rejected.push(a);
      } else if (a.status === "approved" || a.status === "live" || a.approvalStatus === "approved") {
        columns.approved.push(a);
      } else if (a.status === "in_review" || a.approvalStatus === "pending") {
        columns.in_review.push(a);
      } else {
        columns.draft.push(a);
      }
    });

    return columns;
  }, [campaigns]);

  const handleDragStart = (e, assetId, campaignId) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ assetId, campaignId }));
  };

  const handleDrop = async (e, targetCol) => {
    e.preventDefault();
    const dataStr = e.dataTransfer.getData("text/plain");
    if (!dataStr) return;

    try {
      const { assetId, campaignId } = JSON.parse(dataStr);
      setSavingAssetId(assetId);

      // Map target columns to status and approvalStatus values
      let status = "draft";
      let approvalStatus = null;

      if (targetCol === "in_review") {
        status = "in_review";
        approvalStatus = "pending";
      } else if (targetCol === "approved") {
        status = "approved";
        approvalStatus = "approved";
      } else if (targetCol === "rejected") {
        status = "retired";
        approvalStatus = "rejected";
      }

      const res = await fetch(`/api/campaigns/${campaignId}/assets/${assetId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, approvalStatus, name: "Status Update" }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      
      router.refresh();
    } catch (err) {
      console.error("Failed to move asset:", err);
      alert("Error moving asset: " + err.message);
    } finally {
      setSavingAssetId(null);
    }
  };

  // --- 3. ROI & Sales Uplift Calculations ---
  const roiCalculations = useMemo(() => {
    const channelSpend = {};
    
    // Group all channel spends across portfolio scope
    analyticsCampaigns.forEach(c => {
      (c.channels || []).forEach(ch => {
        const type = ch.channel;
        const spend = roiSpendMetric === "planned" 
          ? (parseFloat(ch.plannedSpend) || 0) 
          : (parseFloat(ch.actualSpend) || 0);

        if (!channelSpend[type]) {
          channelSpend[type] = 0;
        }
        channelSpend[type] += spend;
      });
    });

    // Compute details for each channel type
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalUplift = 0;

    const rows = Object.keys(CHANNEL_LABELS).map(key => {
      const spend = channelSpend[key] || 0;
      const cpm = cpmSettings[key] || DEFAULT_CPM[key] || 5.00;
      const multiplier = multiplierSettings[key] || DEFAULT_MULTIPLIER[key] || 1.5;

      const impressions = cpm > 0 ? (spend / cpm) * 1000 : 0;
      const salesUplift = spend * multiplier;
      const netRoi = salesUplift - spend;
      const roiPercent = spend > 0 ? (netRoi / spend) * 100 : 0;

      totalSpend += spend;
      totalImpressions += impressions;
      totalUplift += salesUplift;

      return {
        key,
        name: CHANNEL_LABELS[key],
        spend,
        cpm,
        multiplier,
        impressions,
        salesUplift,
        netRoi,
        roiPercent
      };
    }).filter(row => row.spend > 0);

    const totalNetRoi = totalUplift - totalSpend;
    const totalRoiPercent = totalSpend > 0 ? (totalNetRoi / totalSpend) * 100 : 0;

    return {
      rows,
      totalSpend,
      totalImpressions,
      totalUplift,
      totalNetRoi,
      totalRoiPercent
    };
  }, [analyticsCampaigns, roiSpendMetric, cpmSettings, multiplierSettings]);

  // Chart Data for ROI
  const roiChartData = useMemo(() => {
    return roiCalculations.rows.map(row => ({
      name: row.name,
      Cost: row.spend,
      Uplift: row.salesUplift
    }));
  }, [roiCalculations]);

  return (
    <>
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${tab === "portfolio" ? "active" : ""}`} onClick={() => setTab("portfolio")}>
          <SlidersHorizontal size={14} style={{ marginRight: 6, display: "inline" }} /> Campaign Portfolio
        </button>
        <button className={`tab-btn ${tab === "timeline" ? "active" : ""}`} onClick={() => setTab("timeline")}>
          <Calendar size={14} style={{ marginRight: 6, display: "inline" }} /> Gantt Calendar
        </button>
        <button className={`tab-btn ${tab === "assets" ? "active" : ""}`} onClick={() => setTab("assets")}>
          <FileText size={14} style={{ marginRight: 6, display: "inline" }} /> Creative Review Board
        </button>
        <button className={`tab-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>
          <BarChart3 size={14} style={{ marginRight: 6, display: "inline" }} /> Spend & ROI Analytics
        </button>
      </div>

      {/* TABS 1: CAMPAIGN PORTFOLIO */}
      {tab === "portfolio" && (
        <>
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Active Campaigns</div>
              <div className="kpi-value">{campaigns.filter(c => c.status === "live" || c.status === "in_production").length}</div>
              <div className="kpi-subtitle">Live or in production</div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">In Planning</div>
              <div className="kpi-value">{campaigns.filter(c => c.status === "planning" || c.status === "briefed").length}</div>
              <div className="kpi-subtitle">Concept stage or briefed</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Total Portfolio Budget</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>
                {fmt$(campaigns.reduce((sum, c) => sum + (parseFloat(c.totalBudget) || 0), 0))}
              </div>
              <div className="kpi-subtitle">Across all {campaigns.length} campaigns</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex justify-between items-center" style={{ flexWrap: "wrap", gap: 12 }}>
              <h3>Campaign Portfolio</h3>
              <div className="flex gap-2" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
                  <input 
                    type="text" 
                    placeholder="Search campaigns..." 
                    className="form-input" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: 30, fontSize: 13, height: 32, width: 200 }}
                  />
                </div>
                
                <select 
                  className="form-select" 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ fontSize: 13, height: 32, padding: "0 10px", width: 130 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="live">Live / Active</option>
                  <option value="planning">In Planning</option>
                  <option value="completed">Completed</option>
                  <option value="briefed">Briefed</option>
                  <option value="in_production">In Production</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select 
                  className="form-select" 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  style={{ fontSize: 13, height: 32, padding: "0 10px", width: 160 }}
                >
                  <option value="all">All Types</option>
                  {Object.entries(CAMPAIGN_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="card-body">
              {filteredCampaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <Megaphone size={48} style={{ strokeWidth: 1.5, color: "var(--text-muted)" }} />
                  </div>
                  <h3>No campaigns found</h3>
                  <p>Try adjusting your search query or filters.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Agency (Vendor)</th>
                      <th>Type</th>
                      <th>Total Budget</th>
                      <th>Allocated Spend</th>
                      <th>Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCampaigns.map((c) => {
                      const totalAllocated = (c.channels || []).reduce((s, ch) => s + (parseFloat(ch.plannedSpend) || 0), 0);
                      const actualSp = (c.channels || []).reduce((s, ch) => s + (parseFloat(ch.actualSpend) || 0), 0);
                      const isOverplanned = totalAllocated > parseFloat(c.totalBudget);

                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 500 }}>
                            <Link href={`/marketing/${c.id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{c.name}</Link>
                            <div className="kpi-subtitle" style={{ marginTop: 2 }}>{c._count.channels} channels · {c._count.assets} assets · {c._count.milestones} milestones</div>
                          </td>
                          <td className="muted">{c.vendor?.name || "Internal"}</td>
                          <td className="muted" style={{ textTransform: "capitalize" }}>{c.campaignType?.replace(/_/g, " ") || "—"}</td>
                          <td>
                            <div>{fmt$(c.totalBudget)}</div>
                          </td>
                          <td>
                            <div style={{ color: isOverplanned ? "var(--red)" : "inherit" }}>{fmt$(totalAllocated)}</div>
                            <div className="kpi-subtitle" style={{ fontSize: 10 }}>Actual: {fmt$(actualSp)}</div>
                          </td>
                          <td className="muted" style={{ fontSize: 12 }}>{fmtDate(c.startDate)}<br/>{fmtDate(c.endDate)}</td>
                          <td>
                            <span className={`badge badge-${c.status === "live" ? "active" : c.status === "completed" ? "completed" : "submitted"}`}>
                              {STATUS_LABELS[c.status] || c.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* TABS 2: GANTT CAMPAIGN TIMELINE */}
      {tab === "timeline" && (
        <div className="card">
          <div className="card-header">
            <h3>Campaign Gantt Calendar</h3>
            <span className="muted" style={{ fontSize: 13 }}>Visual mapping of active campaign flights</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {timelineData.campaigns.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <h3>No dated campaigns</h3>
                <p>Ensure your active campaigns have start and end dates configured to display on the Gantt timeline.</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: 800, padding: 20 }}>
                  
                  {/* Grid Header Months */}
                  <div style={{ display: "grid", gridTemplateColumns: `220px repeat(${timelineData.months.length}, 1fr)`, borderBottom: "2px solid var(--border)", paddingBottom: 10, marginBottom: 15 }}>
                    <div style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Campaign / Wave</div>
                    {timelineData.months.map((m, idx) => (
                      <div key={idx} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", borderLeft: "1px dashed var(--border-dim)", paddingLeft: 4 }}>
                        {m.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
                      </div>
                    ))}
                  </div>

                  {/* Gantt Rows */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {timelineData.campaigns.map((c) => (
                      <div key={c.id} style={{ display: "grid", gridTemplateColumns: `220px 1fr`, alignItems: "center" }}>
                        
                        {/* Title Row */}
                        <div style={{ pr: 12 }}>
                          <Link href={`/marketing/${c.id}`} style={{ fontWeight: 600, color: "var(--text)", textDecoration: "none", fontSize: 13, display: "block" }}>
                            {c.name}
                          </Link>
                          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                            {STATUS_LABELS[c.status]} · {fmt$(c.totalBudget)}
                          </span>
                        </div>

                        {/* Bar Rail */}
                        <div style={{ position: "relative", height: 28, background: "var(--surface-1)", borderRadius: 4, width: "100%" }}>
                          
                          {/* Inner Month Lines */}
                          {timelineData.months.map((_, idx) => (
                            <div 
                              key={idx} 
                              style={{ 
                                position: "absolute", 
                                left: `${(idx / timelineData.months.length) * 100}%`, 
                                top: 0, 
                                bottom: 0, 
                                width: 1, 
                                borderLeft: "1px dashed var(--border-dim)", 
                                zIndex: 1 
                              }} 
                            />
                          ))}

                          {/* Hover Details & Flight Bar */}
                          <div 
                            className="gantt-bar-hover"
                            style={{
                              position: "absolute",
                              left: `${c.leftPct}%`,
                              width: `${c.widthPct}%`,
                              top: 4,
                              height: 20,
                              backgroundColor: c.barColor,
                              borderRadius: 4,
                              zIndex: 2,
                              cursor: "pointer",
                              transition: "all 0.2s ease"
                            }}
                            onClick={() => router.push(`/marketing/${c.id}`)}
                          >
                            {/* Hover tooltip built into CSS popover */}
                            <div className="gantt-tooltip">
                              <strong>{c.name}</strong>
                              <div>Objective: {c.objective || "—"}</div>
                              <div>Dates: {fmtDate(c.startDate)} → {fmtDate(c.endDate)}</div>
                              <div>Budget: {fmt$(c.totalBudget)}</div>
                              <div>Vendor: {c.vendor?.name || "Internal"}</div>
                            </div>
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TABS 3: CREATIVE REVIEW KANBAN BOARD */}
      {tab === "assets" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-body flex justify-between items-center" style={{ padding: "12px 20px" }}>
              <div>
                <h3 style={{ margin: 0 }}>Creative Asset Review Board</h3>
                <p style={{ margin: "2px 0 0 0", color: "var(--text-muted)", fontSize: 13 }}>
                  Drag and drop creative asset cards between columns to change sign-off stages.
                </p>
              </div>
              <span className="badge badge-active" style={{ fontSize: 11 }}>PostgreSQL Live Sync</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, minHeight: 600 }}>
            
            {/* COLUMN 1: DRAFT */}
            <div 
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, "draft")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "var(--text-secondary)" }}>Draft / In Prep</span>
                <span className="badge badge-submitted">{kanbanAssets.draft.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 400 }}>
                {kanbanAssets.draft.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onDragStart={handleDragStart} savingAssetId={savingAssetId} />
                ))}
              </div>
            </div>

            {/* COLUMN 2: IN REVIEW */}
            <div 
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, "in_review")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "var(--text-secondary)" }}>Pending / Under Review</span>
                <span className="badge badge-warning">{kanbanAssets.in_review.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 400 }}>
                {kanbanAssets.in_review.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onDragStart={handleDragStart} savingAssetId={savingAssetId} />
                ))}
              </div>
            </div>

            {/* COLUMN 3: APPROVED */}
            <div 
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, "approved")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "var(--text-secondary)" }}>Approved / Live</span>
                <span className="badge badge-active">{kanbanAssets.approved.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 400 }}>
                {kanbanAssets.approved.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onDragStart={handleDragStart} savingAssetId={savingAssetId} />
                ))}
              </div>
            </div>

            {/* COLUMN 4: REJECTED */}
            <div 
              style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 12, display: "flex", flexDirection: "column" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, "rejected")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", color: "var(--text-secondary)" }}>Rejected / Retired</span>
                <span className="badge badge-expired">{kanbanAssets.rejected.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 400 }}>
                {kanbanAssets.rejected.map(asset => (
                  <AssetCard key={asset.id} asset={asset} onDragStart={handleDragStart} savingAssetId={savingAssetId} />
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TABS 4: SPEND & ROI ANALYTICS */}
      {tab === "analytics" && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body flex justify-between items-center" style={{ padding: "12px 20px", flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="badge badge-submitted" style={{ textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>Analytics</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>Portfolio Rollup Scope:</span>
              </div>
              <div className="flex gap-2">
                <button 
                  className={`btn btn-sm ${analyticsScope === "active" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAnalyticsScope("active")}
                >
                  Active Campaigns Only
                </button>
                <button 
                  className={`btn btn-sm ${analyticsScope === "all" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAnalyticsScope("all")}
                >
                  All Campaigns
                </button>
              </div>
            </div>
          </div>

          {/* Visual Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20, marginBottom: 20 }}>
            {/* Chart 1: Spend by Channel */}
            <div className="card">
              <div className="card-header">
                <h3>Planned vs. Actual Spend by Channel</h3>
              </div>
              <div className="card-body" style={{ height: 320 }}>
                {!mounted ? (
                  <div className="muted">Loading spend visualization...</div>
                ) : channelChartData.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Channel Spend Tracked</h3>
                    <p>Allocate channel budgets and enter actual spends to view reporting.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-dim)' }} />
                      <Bar dataKey="planned" name="Planned Spend" fill="#00a651" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Spend" fill="#fed103" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Estimated Sales Uplift vs Spend */}
            <div className="card">
              <div className="card-header">
                <h3>Channel Net ROI Lift Comparison</h3>
              </div>
              <div className="card-body" style={{ height: 320 }}>
                {!mounted ? (
                  <div className="muted">Loading ROI comparisons...</div>
                ) : roiChartData.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Sales Uplift Data</h3>
                    <p>Calculations will display once budget is allocated to campaigns.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={roiChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--text-secondary)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-dim)' }} />
                      <Bar dataKey="Cost" name="Media Spend" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Uplift" name="Est. Sales Uplift" fill="#00a651" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Calculator Section */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header flex justify-between items-center">
              <div>
                <h3>Lottery Sales Uplift & ROI Estimator</h3>
                <span className="muted" style={{ fontSize: 12 }}>Calculate campaign projections based on lottery media CPM and sales lift factors</span>
              </div>
              <div className="flex gap-2">
                <button 
                  className={`btn btn-secondary btn-sm ${showRoiSettings ? "active" : ""}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  onClick={() => setShowRoiSettings(!showRoiSettings)}
                >
                  <Settings size={14} /> Adjust Benchmarks
                </button>
                <div style={{ display: "inline-flex", background: "var(--surface-1)", borderRadius: 6, padding: 3, border: "1px solid var(--border)" }}>
                  <button 
                    className={`btn btn-sm btn-flat ${roiSpendMetric === "planned" ? "active" : ""}`}
                    onClick={() => setRoiSpendMetric("planned")}
                    style={{ fontSize: 11, padding: "2px 8px" }}
                  >
                    Planned Spend
                  </button>
                  <button 
                    className={`btn btn-sm btn-flat ${roiSpendMetric === "actual" ? "active" : ""}`}
                    onClick={() => setRoiSpendMetric("actual")}
                    style={{ fontSize: 11, padding: "2px 8px" }}
                  >
                    Actual Spend
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body">
              {/* ROI Adjust Settings Drawer */}
              {showRoiSettings && (
                <div style={{ background: "var(--surface-1)", padding: 15, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, display: "flex", alignItems: "center", gap: 6 }}><Settings size={16} /> Override Industry Multipliers & CPM</h4>
                    <button className="btn btn-sm btn-secondary" onClick={() => {
                      setCpmSettings(DEFAULT_CPM);
                      setMultiplierSettings(DEFAULT_MULTIPLIER);
                    }}>Reset defaults</button>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    {Object.keys(CHANNEL_LABELS).map(key => (
                      <div key={key} style={{ background: "var(--surface-2)", padding: 10, borderRadius: 6, border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 8, textTransform: "capitalize" }}>{CHANNEL_LABELS[key]}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>CPM ($)</label>
                            <input 
                              type="number" 
                              step="0.01" 
                              className="form-input" 
                              style={{ height: 26, fontSize: 11, padding: "0 6px" }}
                              value={cpmSettings[key] || ""}
                              onChange={(e) => setCpmSettings({ ...cpmSettings, [key]: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", display: "block" }}>Sales Uplift</label>
                            <input 
                              type="number" 
                              step="0.1" 
                              className="form-input" 
                              style={{ height: 26, fontSize: 11, padding: "0 6px" }}
                              value={multiplierSettings[key] || ""}
                              onChange={(e) => setMultiplierSettings({ ...multiplierSettings, [key]: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {roiCalculations.rows.length === 0 ? (
                <div className="empty-state">
                  <h3>No Spend Tracked</h3>
                  <p>Allocate spends to channels to activate the ROI calculator.</p>
                </div>
              ) : (
                <>
                  {/* Estimator KPIs */}
                  <div className="kpi-grid" style={{ marginBottom: 20 }}>
                    <div className="kpi-card kpi-blue">
                      <div className="kpi-label">Selected Spend</div>
                      <div className="kpi-value" style={{ fontSize: 20 }}>{fmt$(roiCalculations.totalSpend)}</div>
                      <div className="kpi-subtitle">Calculated base budget</div>
                    </div>
                    <div className="kpi-card kpi-purple">
                      <div className="kpi-label">Est. Impressions</div>
                      <div className="kpi-value" style={{ fontSize: 20 }}>
                        {roiCalculations.totalImpressions >= 1000000 
                          ? `${(roiCalculations.totalImpressions / 1000000).toFixed(1)}M` 
                          : roiCalculations.totalImpressions.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="kpi-subtitle">Impressions delivered</div>
                    </div>
                    <div className="kpi-card kpi-green">
                      <div className="kpi-label">Est. Sales Uplift</div>
                      <div className="kpi-value" style={{ fontSize: 20 }}>{fmt$(roiCalculations.totalUplift)}</div>
                      <div className="kpi-subtitle">Incremental sales created</div>
                    </div>
                    <div className="kpi-card kpi-gold">
                      <div className="kpi-label">Portfolio Net ROI</div>
                      <div className="kpi-value" style={{ fontSize: 20 }}>{fmt$(roiCalculations.totalNetRoi)}</div>
                      <div className="kpi-subtitle">{Math.round(roiCalculations.totalRoiPercent)}% average return</div>
                    </div>
                  </div>

                  {/* Calculator Table */}
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Channel Type</th>
                        <th style={{ textAlign: "right" }}>Spend</th>
                        <th style={{ textAlign: "right" }}>CPM</th>
                        <th style={{ textAlign: "right" }}>Est. Impressions</th>
                        <th style={{ textAlign: "right" }}>Sales Lift</th>
                        <th style={{ textAlign: "right" }}>Sales Uplift ($)</th>
                        <th style={{ textAlign: "right" }}>Net Return</th>
                        <th style={{ textAlign: "right" }}>ROI %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roiCalculations.rows.map(row => (
                        <tr key={row.key}>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td style={{ textAlign: "right" }}>{fmt$(row.spend)}</td>
                          <td style={{ textAlign: "right" }}>${row.cpm.toFixed(2)}</td>
                          <td style={{ textAlign: "right" }}>
                            {row.impressions >= 1000000 
                              ? `${(row.impressions / 1000000).toFixed(2)}M` 
                              : row.impressions.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 500 }}>{row.multiplier.toFixed(1)}x</td>
                          <td style={{ textAlign: "right", color: "var(--green)" }}>{fmt$(row.salesUplift)}</td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>{fmt$(row.netRoi)}</td>
                          <td style={{ textAlign: "right" }}>{Math.round(row.roiPercent)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>

          {/* Existing Campaign Spend Analysis Grid */}
          <div className="card">
            <div className="card-header">
              <h3>Portfolio Spend & Budget Reconciliation</h3>
            </div>
            <div className="card-body">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Total Budget</th>
                    <th style={{ textAlign: "right" }}>Planned Spend</th>
                    <th style={{ textAlign: "right" }}>Actual Spend</th>
                    <th style={{ textAlign: "right" }}>Remaining Budget</th>
                    <th>Burn Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsCampaigns.map((c) => {
                    const budget = parseFloat(c.totalBudget) || 0;
                    const planned = (c.channels || []).reduce((s, ch) => s + (parseFloat(ch.plannedSpend) || 0), 0);
                    const actual = (c.channels || []).reduce((s, ch) => s + (parseFloat(ch.actualSpend) || 0), 0);
                    const remaining = budget - actual;
                    const burnRate = budget > 0 ? (actual / budget) * 100 : 0;
                    
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>
                          <Link href={`/marketing/${c.id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{c.name}</Link>
                        </td>
                        <td className="muted" style={{ textTransform: "capitalize", fontSize: 12 }}>{c.campaignType?.replace(/_/g, " ") || "—"}</td>
                        <td>
                          <span className={`badge badge-${c.status === "live" ? "active" : c.status === "completed" ? "completed" : "submitted"}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 500 }}>{fmt$(budget)}</td>
                        <td style={{ textAlign: "right" }}>{fmt$(planned)}</td>
                        <td style={{ textAlign: "right", color: actual > planned ? "var(--red)" : "inherit" }}>{fmt$(actual)}</td>
                        <td style={{ textAlign: "right", fontWeight: "600", color: remaining < 0 ? "var(--red)" : "#06d6a0" }}>
                          {fmt$(remaining)}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="budget-meter-bar" style={{ width: 60, margin: 0 }}>
                              <div 
                                className={`budget-meter-fill ${burnRate > 100 ? "over" : "under"}`} 
                                style={{ width: `${Math.min(burnRate, 100)}%` }} 
                              />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 500 }}>{Math.round(burnRate)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// --- 4. Sub-Component: Kanban Card ---
function AssetCard({ asset, onDragStart, savingAssetId }) {
  const isSaving = savingAssetId === asset.id;
  
  const now = new Date();
  const isOverdue = asset.dueDate && new Date(asset.dueDate) < now && asset.status !== "retired" && asset.status !== "approved" && asset.status !== "live";

  return (
    <div 
      draggable={!isSaving}
      onDragStart={(e) => onDragStart(e, asset.id, asset.campaignId)}
      style={{
        background: "var(--surface-1)",
        border: isOverdue ? "1px solid var(--red)" : "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 12,
        cursor: isSaving ? "not-allowed" : "grab",
        opacity: isSaving ? 0.6 : 1,
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        position: "relative"
      }}
      className="kanban-card-hover"
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 6 }}>
        <span className="badge badge-submitted" style={{ fontSize: 9, textTransform: "uppercase" }}>{asset.assetType}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{asset.version}</span>
      </div>

      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", marginBottom: 2 }}>{asset.name}</div>
      
      <div style={{ fontSize: 11, marginBottom: 8 }}>
        <Link href={`/marketing/${asset.campaignId}`} style={{ color: "var(--primary)", textDecoration: "none" }}>
          {asset.campaignName}
        </Link>
      </div>

      <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 8, marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--text-secondary)" }}>
        {asset.reviewOwner && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <User size={11} /> <span>Owner: {asset.reviewOwner}</span>
          </div>
        )}
        {asset.dueDate && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: isOverdue ? "var(--red)" : "var(--text-secondary)" }}>
            <Clock size={11} /> 
            <span>
              Due: {fmtDate(asset.dueDate)} {isOverdue && <strong style={{ color: "var(--red)", fontSize: 9, marginLeft: 2 }}>⚠️ OVERDUE</strong>}
            </span>
          </div>
        )}
        {asset.formatSpecs && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <FileText size={11} /> <span>Specs: {asset.formatSpecs}</span>
          </div>
        )}
      </div>

      {isSaving && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(255, 255, 255, 0.7)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-md)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>Saving...</span>
        </div>
      )}
    </div>
  );
}
