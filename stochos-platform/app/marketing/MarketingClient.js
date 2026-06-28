"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
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
  SlidersHorizontal 
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
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("portfolio"); // "portfolio" | "analytics"
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // "all" | "live" | "planning" | "completed"
  const [typeFilter, setTypeFilter] = useState("all");
  const [analyticsScope, setAnalyticsScope] = useState("active"); // "active" (live/in_production) | "all"

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
    
    // Initialize channels
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
          // fallback if new channel types are added
          channelMap[key] = { 
            name: key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()), 
            planned: parseFloat(ch.plannedSpend) || 0, 
            actual: parseFloat(ch.actualSpend) || 0 
          };
        }
      });
    });

    // Filter out channels with zero planned and actual spend to keep chart clean
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

  return (
    <>
      <div className="tab-nav" style={{ marginBottom: 20 }}>
        <button className={`tab-btn ${tab === "portfolio" ? "active" : ""}`} onClick={() => setTab("portfolio")}>
          <SlidersHorizontal size={14} style={{ marginRight: 6, display: "inline" }} /> Campaign Portfolio
        </button>
        <button className={`tab-btn ${tab === "analytics" ? "active" : ""}`} onClick={() => setTab("analytics")}>
          <BarChart3 size={14} style={{ marginRight: 6, display: "inline" }} /> Advanced Spend Analytics
        </button>
      </div>

      {tab === "portfolio" && (
        <>
          {/* Portfolio KPI summary cards */}
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
            {/* Filter controls */}
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

      {tab === "analytics" && (
        <>
          {/* Analytics Header / Scope selector */}
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
                  Active Campaigns Only (Live/In Production)
                </button>
                <button 
                  className={`btn btn-sm ${analyticsScope === "all" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setAnalyticsScope("all")}
                >
                  All Campaigns (All Statuses)
                </button>
              </div>
            </div>
          </div>

          {/* Analytics KPI summary cards */}
          <div className="kpi-grid" style={{ marginBottom: 20 }}>
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Portfolio Budget</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(metrics.totalBudget)}</div>
              <div className="kpi-subtitle">Sum of campaign budgets</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Planned Channel Spend</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(metrics.totalPlanned)}</div>
              <div className="kpi-subtitle">Allocated across channels ({metrics.totalBudget ? Math.round((metrics.totalPlanned / metrics.totalBudget) * 100) : 0}% of budget)</div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Actual Spend To Date</div>
              <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(metrics.totalActual)}</div>
              <div className="kpi-subtitle">Realized channel expenses ({metrics.totalBudget ? Math.round((metrics.totalActual / metrics.totalBudget) * 100) : 0}% of budget)</div>
            </div>
            <div className={`kpi-card ${metrics.isOverspent ? "kpi-red" : "kpi-gold"}`}>
              <div className="kpi-label">{metrics.isOverspent ? "Overspent Amount" : "Remaining Budget"}</div>
              <div className="kpi-value" style={{ fontSize: 22, color: metrics.isOverspent ? "var(--red)" : "inherit" }}>
                {fmt$(Math.abs(metrics.remaining))}
              </div>
              <div className="kpi-subtitle">{metrics.isOverspent ? "⚠️ Over portfolio limit" : "Available to allocate"}</div>
            </div>
          </div>

          {/* Visual Charts */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 20, marginBottom: 20 }}>
            {/* Chart 1: Spend by Channel */}
            <div className="card">
              <div className="card-header">
                <h3>Planned vs. Actual Spend by Channel</h3>
              </div>
              <div className="card-body" style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                      <XAxis 
                        dataKey="name" 
                        stroke="var(--text-secondary)" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} 
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-dim)' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="planned" name="Planned Spend" fill="#00a651" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Spend" fill="#fed103" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart 2: Spend by Campaign */}
            <div className="card">
              <div className="card-header">
                <h3>Planned vs. Actual Spend by Campaign</h3>
              </div>
              <div className="card-body" style={{ height: 350, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {!mounted ? (
                  <div className="muted">Loading spend visualization...</div>
                ) : campaignChartData.length === 0 ? (
                  <div className="empty-state">
                    <h3>No Campaign Spend Tracked</h3>
                    <p>Configure campaign budgets and channels to view breakdown.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={campaignChartData} margin={{ top: 20, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-dim)" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        stroke="var(--text-secondary)" 
                        fontSize={11} 
                        tickLine={false} 
                      />
                      <YAxis 
                        stroke="var(--text-secondary)" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} 
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--border-dim)' }} />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="planned" name="Planned Spend" fill="#00a651" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actual" name="Actual Spend" fill="#fed103" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Spend Analysis Grid */}
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
