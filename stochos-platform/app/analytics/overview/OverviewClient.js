"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  DollarSign,
  Coins,
  Percent,
  Store,
  Ticket,
  Bell,
  RefreshCw,
  TrendingUp,
  Activity,
  Award,
  Calendar,
  AlertTriangle
} from "lucide-react";

export default function OverviewClient({ initialDaily, initialMix, initialAlerts }) {
  const [mounted, setMounted] = useState(false);
  const [dateRange, setDateRange] = useState("all"); // "all", "12m", "6m", "30d"
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null); // "success", "error"
  const [alerts, setAlerts] = useState(initialAlerts);
  const [daily, setDaily] = useState(initialDaily);
  const [mix, setMix] = useState(initialMix);
  const [mixViewMode, setMixViewMode] = useState("bar");

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Cast string numeric fields to Numbers
  const dailyData = useMemo(() => {
    return daily.map((d) => ({
      ...d,
      grossRevenue: Number(d.grossRevenue || 0),
      estimatedPayout: Number(d.estimatedPayout || 0),
      retailerCommission: Number(d.retailerCommission || 0),
      netContribution: Number(d.netContribution || 0),
      activeRetailers: Number(d.activeRetailers || 0),
      activeGames: Number(d.activeGames || 0),
      avgSalesPerRetailer: Number(d.avgSalesPerRetailer || 0),
      drawRevenue: Number(d.drawRevenue || 0),
      scratchRevenue: Number(d.scratchRevenue || 0)
    }));
  }, [daily]);

  const mixData = useMemo(() => {
    return mix
      .filter((m) => m.productGroup !== "Other")
      .map((m) => ({
        ...m,
        grossRevenue: Number(m.grossRevenue || 0),
        netContribution: Number(m.netContribution || 0),
        pctSales: Number(m.pctSales || 0),
        pctContribution: Number(m.pctContribution || 0),
        contributionRate: Number(m.contributionRate || 0)
      }));
  }, [mix]);

  const alertsData = useMemo(() => {
    return alerts.map((a) => ({
      ...a,
      alertValue: Number(a.alertValue || 0),
      comparisonValue: Number(a.comparisonValue || 0),
      varianceAbs: a.varianceAbs !== null && a.varianceAbs !== undefined ? Number(a.varianceAbs) : null,
      variancePct: a.variancePct !== null && a.variancePct !== undefined ? Number(a.variancePct) : null
    }));
  }, [alerts]);

  // 2. Filter daily data based on Date Range
  const filteredDailyData = useMemo(() => {
    if (dailyData.length === 0) return [];
    if (dateRange === "all") return dailyData;

    // Find the latest date in the dataset (for static anchor filtering)
    const maxDate = new Date(Math.max(...dailyData.map((d) => new Date(d.date))));

    let filterDate = new Date(maxDate);
    if (dateRange === "12m") {
      filterDate.setMonth(filterDate.getMonth() - 12);
    } else if (dateRange === "6m") {
      filterDate.setMonth(filterDate.getMonth() - 6);
    } else if (dateRange === "30d") {
      filterDate.setDate(filterDate.getDate() - 30);
    }

    return dailyData.filter((d) => new Date(d.date) >= filterDate);
  }, [dailyData, dateRange]);

  // 3. Compute Aggregated Summary Metrics
  const summaryMetrics = useMemo(() => {
    if (filteredDailyData.length === 0) {
      return {
        grossRevenue: 0,
        netContribution: 0,
        estimatedPayout: 0,
        retailerCommission: 0,
        activeRetailers: 0,
        drawShare: 0,
        contributionRate: 0,
        avgDailySales: 0,
        activeGames: 0
      };
    }

    let gross = 0;
    let net = 0;
    let payout = 0;
    let commission = 0;
    let drawRev = 0;
    let maxRetailers = 0;
    let totalAvgSales = 0;
    let maxGames = 0;

    filteredDailyData.forEach((d) => {
      gross += d.grossRevenue;
      net += d.netContribution;
      payout += d.estimatedPayout;
      commission += d.retailerCommission;
      drawRev += d.drawRevenue;
      if (d.activeRetailers > maxRetailers) maxRetailers = d.activeRetailers;
      if (d.activeGames > maxGames) maxGames = d.activeGames;
      totalAvgSales += d.avgSalesPerRetailer;
    });

    return {
      grossRevenue: gross,
      netContribution: net,
      estimatedPayout: payout,
      retailerCommission: commission,
      activeRetailers: maxRetailers,
      drawShare: gross > 0 ? drawRev / gross : 0,
      contributionRate: gross > 0 ? net / gross : 0,
      avgDailySales: totalAvgSales / filteredDailyData.length,
      activeGames: maxGames
    };
  }, [filteredDailyData]);

  // 4. Trend Chart Data (aggregate monthly unless 30d range is picked)
  const trendChartData = useMemo(() => {
    if (dateRange === "30d") {
      return filteredDailyData.map((d) => {
        const date = new Date(d.date);
        return {
          ...d,
          label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        };
      });
    }

    const groups = {};
    filteredDailyData.forEach((d) => {
      const date = new Date(d.date);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const monthKey = `${year}-${month}-01`;
      const label = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });

      if (!groups[monthKey]) {
        groups[monthKey] = {
          monthKey,
          label,
          grossRevenue: 0,
          netContribution: 0
        };
      }
      groups[monthKey].grossRevenue += d.grossRevenue;
      groups[monthKey].netContribution += d.netContribution;
    });

    return Object.values(groups).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [filteredDailyData, dateRange]);

  // 5. Floating Bar Waterfall Data
  const waterfallData = useMemo(() => {
    const { grossRevenue, estimatedPayout, retailerCommission, netContribution } = summaryMetrics;

    const step1 = grossRevenue;
    const step2 = step1 - estimatedPayout;
    const step3 = step2 - retailerCommission;

    return [
      {
        step: "Gross Sales",
        value: [0, grossRevenue],
        amount: grossRevenue,
        change: grossRevenue,
        color: "var(--blue)"
      },
      {
        step: "Est. Payouts",
        value: [step2, step1],
        amount: estimatedPayout,
        change: -estimatedPayout,
        color: "var(--red)"
      },
      {
        step: "Retailer Comm.",
        value: [step3, step2],
        amount: retailerCommission,
        change: -retailerCommission,
        color: "var(--red)"
      },
      {
        step: "Net Contribution",
        value: [0, netContribution],
        amount: netContribution,
        change: netContribution,
        color: "var(--green)"
      }
    ];
  }, [summaryMetrics]);

  // Formatting Helpers
  const formatDollar = (val) => {
    if (val === null || val === undefined) return "—";
    const absVal = Math.abs(val);
    if (absVal >= 1e9) {
      return `${val < 0 ? "-" : ""}$${(absVal / 1e9).toFixed(2)}B`;
    }
    if (absVal >= 1e6) {
      return `${val < 0 ? "-" : ""}$${(absVal / 1e6).toFixed(2)}M`;
    }
    return `${val < 0 ? "-" : ""}$${Math.round(absVal).toLocaleString()}`;
  };

  const formatPercent = (val) => {
    if (val === null || val === undefined) return "—";
    return `${(val * 100).toFixed(2)}%`;
  };

  const formatCount = (val) => {
    if (val === null || val === undefined) return "—";
    return Math.round(val).toLocaleString();
  };

  const formatAlertValue = (val, type) => {
    if (type === "rate_change" || type === "mix_shift") {
      return formatPercent(val);
    }
    return formatDollar(val);
  };

  const formatAlertVariance = (abs, pct, type) => {
    if (type === "rate_change" || type === "mix_shift") {
      return `${abs >= 0 ? "+" : ""}${(abs * 100).toFixed(2)} pts`;
    }
    if (pct !== null && pct !== undefined) {
      return `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(1)}%`;
    }
    return "—";
  };

  const getSeverityBadge = (severity) => {
    const sev = (severity || "").toLowerCase();
    if (sev === "high") {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "var(--status-failed-bg)",
            color: "var(--status-failed-text)",
            border: "1px solid var(--status-failed-border)"
          }}
        >
          High
        </span>
      );
    }
    if (sev === "medium") {
      return (
        <span
          className="badge"
          style={{
            backgroundColor: "var(--status-warning-bg)",
            color: "var(--status-warning-text)",
            border: "1px solid var(--status-warning-border)"
          }}
        >
          Medium
        </span>
      );
    }
    return (
      <span
        className="badge"
        style={{
          backgroundColor: "var(--status-draft-bg)",
          color: "var(--status-draft-text)",
          border: "1px solid var(--status-draft-border)"
        }}
      >
        Low
      </span>
    );
  };

  // Trigger Database Synchronization via POST API
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/analytics/overview/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncStatus("success");
        setSyncMessage("Marts synced successfully! Refreshing data...");
        // Re-fetch the page data
        const getRes = await fetch("/api/analytics/overview");
        const fresh = await getRes.json();
        if (fresh.success) {
          setDaily(fresh.daily);
          setMix(fresh.mix);
          setAlerts(fresh.alerts);
        }
      } else {
        setSyncStatus("error");
        setSyncMessage(`Sync failed: ${data.error}`);
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage(`Network error: ${err.message}`);
    } finally {
      setIsSyncing(false);
      // Auto-clear success message after 4 seconds
      setTimeout(() => {
        setSyncMessage(null);
      }, 4000);
    }
  };

  // Custom tooltips to guarantee elegant styles
  const CustomTrendTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "13px"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color, margin: "2px 0" }}>
              {entry.name}: {formatDollar(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomWaterfallTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "13px"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{data.step}</p>
          <p style={{ color: "var(--text)" }}>
            Flow:{" "}
            <span style={{ color: data.change >= 0 ? "var(--green)" : "var(--red)", fontWeight: 600 }}>
              {data.change >= 0 ? "+" : ""}
              {formatDollar(data.change)}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomMixTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "13px"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{label} Category</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color, margin: "2px 0" }}>
              {entry.name}: {formatPercent(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (!mounted) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
        Loading Executive Dashboard...
      </div>
    );
  }

  // Find max date in raw daily data to display data freshness info
  const rawDates = daily.map((d) => new Date(d.date));
  const maxDataDate = rawDates.length > 0 ? new Date(Math.max(...rawDates)) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Sync Status Alert Banner */}
      {syncMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: syncStatus === "success" ? "var(--status-passed-bg)" : "var(--status-failed-bg)",
            color: syncStatus === "success" ? "var(--status-passed-text)" : "var(--status-failed-text)",
            border: `1px solid ${syncStatus === "success" ? "var(--status-passed-border)" : "var(--status-failed-border)"}`,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "13px"
          }}
        >
          <Activity size={16} />
          {syncMessage}
        </div>
      )}

      {/* Control Filters Toolbar */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 20px",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={16} style={{ color: "var(--text-muted)" }} />
          <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>Timeframe:</span>
          <div style={{ display: "flex", gap: "4px", backgroundColor: "var(--surface-1)", padding: "2px", borderRadius: "var(--radius-sm)" }}>
            <button
              onClick={() => setDateRange("all")}
              style={{
                border: "none",
                background: dateRange === "all" ? "var(--surface-3)" : "transparent",
                color: dateRange === "all" ? "var(--text)" : "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              All Time
            </button>
            <button
              onClick={() => setDateRange("12m")}
              style={{
                border: "none",
                background: dateRange === "12m" ? "var(--surface-3)" : "transparent",
                color: dateRange === "12m" ? "var(--text)" : "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              L12M
            </button>
            <button
              onClick={() => setDateRange("6m")}
              style={{
                border: "none",
                background: dateRange === "6m" ? "var(--surface-3)" : "transparent",
                color: dateRange === "6m" ? "var(--text)" : "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              L6M
            </button>
            <button
              onClick={() => setDateRange("30d")}
              style={{
                border: "none",
                background: dateRange === "30d" ? "var(--surface-3)" : "transparent",
                color: dateRange === "30d" ? "var(--text)" : "var(--text-secondary)",
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              L30D
            </button>
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="btn"
          style={{
            backgroundColor: "var(--surface-3)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            cursor: isSyncing ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            fontWeight: 500,
            opacity: isSyncing ? 0.7 : 1
          }}
        >
          <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} style={{ animation: isSyncing ? "spin 1s linear infinite" : "none" }} />
          {isSyncing ? "Syncing..." : "Sync Marts"}
        </button>
      </div>

      {/* Primary KPI Grid (large widgets) */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">Gross Revenue</div>
          <div className="kpi-value">{formatDollar(summaryMetrics.grossRevenue)}</div>
          <div className="kpi-subtitle">Total sales for selected period</div>
        </div>

        <div className="kpi-card kpi-green">
          <div className="kpi-label">Net Contribution</div>
          <div className="kpi-value">{formatDollar(summaryMetrics.netContribution)}</div>
          <div className="kpi-subtitle">Transferred to education fund ({formatPercent(summaryMetrics.contributionRate)})</div>
        </div>

        <div className="kpi-card kpi-gold">
          <div className="kpi-label">Estimated Payouts</div>
          <div className="kpi-value">{formatDollar(summaryMetrics.estimatedPayout)}</div>
          <div className="kpi-subtitle">
            Prizes paid out to players (Avg {(summaryMetrics.estimatedPayout / Math.max(summaryMetrics.grossRevenue, 1) * 100).toFixed(1)}%)
          </div>
        </div>

        <div className="kpi-card kpi-red">
          <div className="kpi-label">Retailer Commissions</div>
          <div className="kpi-value">{formatDollar(summaryMetrics.retailerCommission)}</div>
          <div className="kpi-subtitle">
            Earned by sales agents (Avg {(summaryMetrics.retailerCommission / Math.max(summaryMetrics.grossRevenue, 1) * 100).toFixed(1)}%)
          </div>
        </div>
      </div>

      {/* Secondary KPI Grid (smaller widgets) */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div className="kpi-card kpi-blue" style={{ padding: "16px 20px" }}>
          <div className="kpi-label">Active Retailers</div>
          <div className="kpi-value" style={{ fontSize: "22px" }}>{formatCount(summaryMetrics.activeRetailers)}</div>
          <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Peak active sales agents</div>
        </div>

        <div className="kpi-card kpi-green" style={{ padding: "16px 20px" }}>
          <div className="kpi-label">Draw Share of Sales</div>
          <div className="kpi-value" style={{ fontSize: "22px" }}>{formatPercent(summaryMetrics.drawShare)}</div>
          <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Draw vs. instant ticket split</div>
        </div>

        <div className="kpi-card kpi-gold" style={{ padding: "16px 20px" }}>
          <div className="kpi-label">Contribution Rate</div>
          <div className="kpi-value" style={{ fontSize: "22px" }}>{formatPercent(summaryMetrics.contributionRate)}</div>
          <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Net profit margin index</div>
        </div>

        <div className="kpi-card kpi-purple" style={{ padding: "16px 20px" }}>
          <div className="kpi-label">Avg Daily Sales / Retailer</div>
          <div className="kpi-value" style={{ fontSize: "22px" }}>{formatDollar(summaryMetrics.avgDailySales)}</div>
          <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Sales velocity per location</div>
        </div>
      </div>

      {/* Visualizations row: Trend & Waterfall */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "24px" }}>
        {/* Trend Chart */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3>Performance Trend</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {dateRange === "30d" ? "Daily View" : "Monthly View"}
            </span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "360px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={trendChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--blue)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--blue)" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--green)" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="var(--green)" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  stroke="var(--text-muted)" 
                  tickLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1e6).toFixed(0)}M`}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                />
                <Tooltip content={<CustomTrendTooltip />} />
                <Legend verticalAlign="top" height={36} iconType="circle" />
                <Area 
                  type="monotone" 
                  name="Gross Revenue" 
                  dataKey="grossRevenue" 
                  stroke="var(--blue)" 
                  strokeWidth={2}
                  fill="url(#colorGross)" 
                />
                <Area 
                  type="monotone" 
                  name="Net Contribution" 
                  dataKey="netContribution" 
                  stroke="var(--green)" 
                  strokeWidth={2}
                  fill="url(#colorNet)" 
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Economic Waterfall Chart */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3>Economic Flow</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Gross Sales to Net Profit</span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "360px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={waterfallData} margin={{ top: 15, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="step" 
                  stroke="var(--text-muted)" 
                  tickLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1e6).toFixed(0)}M`}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                />
                <Tooltip content={<CustomWaterfallTooltip />} cursor={{ fill: "var(--border-dim)" }} />
                <Bar 
                  dataKey="value" 
                  radius={[4, 4, 0, 0]}
                  label={{ 
                    position: "top", 
                    formatter: (val, entry) => {
                      if (!entry || !entry.payload) return "";
                      const amount = entry.payload.change;
                      if (amount === undefined || amount === null) return "";
                      return amount >= 0 ? `+${formatDollar(amount)}` : formatDollar(amount);
                    },
                    style: { fill: "var(--text-secondary)", fontSize: 10, fontWeight: 500 }
                  }}
                >
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product Mix Share & Alerts Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "24px" }}>
        {/* Sales vs Contribution Mix */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>Product Mix Shares</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Sales Share vs Contribution Share</span>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
              <button
                onClick={() => setMixViewMode("bar")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: mixViewMode === "bar" ? "var(--blue-dim)" : "var(--surface-3)",
                  color: mixViewMode === "bar" ? "var(--blue)" : "var(--text)",
                  border: "none",
                  borderRight: "1px solid var(--border)",
                  cursor: "pointer",
                  transition: "all var(--transition)"
                }}
              >
                Bar Chart
              </button>
              <button
                onClick={() => setMixViewMode("pie")}
                style={{
                  padding: "4px 8px",
                  fontSize: "11px",
                  fontWeight: 500,
                  backgroundColor: mixViewMode === "pie" ? "var(--blue-dim)" : "var(--surface-3)",
                  color: mixViewMode === "pie" ? "var(--blue)" : "var(--text)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all var(--transition)"
                }}
              >
                Pie Chart
              </button>
            </div>
          </div>
          <div className="card-body" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "360px" }}>
            {mixViewMode === "bar" ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={mixData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }} barGap={8}>
                  <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="productGroup" 
                    stroke="var(--text-muted)" 
                    tickLine={false}
                    style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                    style={{ fontSize: 11, fontFamily: "var(--font-sans)" }} 
                  />
                  <Tooltip content={<CustomMixTooltip />} cursor={{ fill: "var(--border-dim)" }} />
                  <Legend iconType="circle" />
                  <Bar dataKey="pctSales" name="% of Sales" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pctContribution" name="% of Contribution" fill="var(--green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", height: 260 }}>
                {/* Sales Share Pie */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "45%" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Sales Volume Share</span>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={mixData}
                        dataKey="pctSales"
                        nameKey="productGroup"
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={4}
                      >
                        {mixData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={idx === 0 ? "var(--chart-1)" : "var(--chart-2)"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatPercent(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", marginTop: "4px" }}>
                    {mixData.map((m, idx) => (
                      <span key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: idx === 0 ? "var(--chart-1)" : "var(--chart-2)" }} />
                        {m.productGroup}: {formatPercent(m.pctSales)}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Contribution Share Pie */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "45%" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "8px" }}>Net Profit Share</span>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={mixData}
                        dataKey="pctContribution"
                        nameKey="productGroup"
                        cx="50%"
                        cy="50%"
                        innerRadius={36}
                        outerRadius={56}
                        paddingAngle={4}
                      >
                        {mixData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={idx === 0 ? "var(--chart-1)" : "var(--chart-2)"} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val) => formatPercent(val)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", marginTop: "4px" }}>
                    {mixData.map((m, idx) => (
                      <span key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: idx === 0 ? "var(--chart-1)" : "var(--chart-2)" }} />
                        {m.productGroup}: {formatPercent(m.pctContribution)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Small inline stats table */}
            <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-secondary)", fontWeight: 600, paddingBottom: "6px" }}>
                <span>Product Group</span>
                <span style={{ width: "80px", textAlign: "right" }}>Gross Rev</span>
                <span style={{ width: "80px", textAlign: "right" }}>Net Cont.</span>
                <span style={{ width: "80px", textAlign: "right" }}>Net Margin</span>
              </div>
              {mixData.map((m, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "6px 0", borderTop: "1px solid var(--border-dim)" }}>
                  <span style={{ fontWeight: 500 }}>{m.productGroup}</span>
                  <span style={{ width: "80px", textAlign: "right", color: "var(--text)" }}>{formatDollar(m.grossRevenue)}</span>
                  <span style={{ width: "80px", textAlign: "right", color: "var(--green)" }}>{formatDollar(m.netContribution)}</span>
                  <span style={{ width: "80px", textAlign: "right", fontWeight: 600, color: "var(--gold)" }}>{formatPercent(m.contributionRate)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Performance Alerts Table */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3>Performance Alerts</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Last 30-day alerts</span>
          </div>
          <div className="card-body" style={{ flex: 1, padding: 0, overflowY: "auto", minHeight: "360px" }}>
            {alertsData.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
                <AlertTriangle size={20} style={{ margin: "0 auto 8px", color: "var(--green)" }} />
                No active performance variances detected.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Metric Indicator</th>
                    <th style={{ textAlign: "right" }}>Current</th>
                    <th style={{ textAlign: "right" }}>Prior</th>
                    <th style={{ textAlign: "right" }}>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {alertsData.map((item, idx) => (
                    <tr key={idx}>
                      <td>{getSeverityBadge(item.severity)}</td>
                      <td style={{ fontWeight: 500 }}>{item.alertLabel}</td>
                      <td style={{ textAlign: "right", color: "var(--text)" }}>
                        {formatAlertValue(item.alertValue, item.alertType)}
                      </td>
                      <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                        {formatAlertValue(item.comparisonValue, item.alertType)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: item.varianceAbs >= 0 || item.variancePct >= 0 ? "var(--green)" : "var(--red)" }}>
                        {formatAlertVariance(item.varianceAbs, item.variancePct, item.alertType)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Data Source Footer Info */}
      <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)", marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
        Data as of: {maxDataDate ? maxDataDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—"} |
        Source: mart_exec_overview_daily, mart_exec_mix_summary, mart_exec_alerts | Stochos Analytics Platform
      </div>
    </div>
  );
}
