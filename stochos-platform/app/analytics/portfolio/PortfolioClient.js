"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  Cell
} from "recharts";
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
  Percent,
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Package,
  Calendar,
  DollarSign,
  Coins,
  Award
} from "lucide-react";

export default function PortfolioClient({ initialMix, initialLifecycle, initialTimeseries }) {
  const [mounted, setMounted] = useState(false);
  
  // Filtering states
  const [selectedGroup, setSelectedGroup] = useState("all"); // "all", "Draw", "Scratch"
  const [selectedFamilies, setSelectedFamilies] = useState([]); // Array of strings (empty means all)
  const [lifecycleStatus, setLifecycleStatus] = useState("all"); // "all", "Active", "Dormant"
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState("all"); // "all", "12m", "6m"
  
  // Sort states for the directory table
  const [sortField, setSortField] = useState("grossRevenue");
  const [sortAsc, setSortAsc] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null); // "success", "error"

  // Internal client-side states for refreshing
  const [mix, setMix] = useState(initialMix);
  const [lifecycle, setLifecycle] = useState(initialLifecycle);
  const [timeseries, setTimeseries] = useState(initialTimeseries);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGroup, selectedFamilies, lifecycleStatus, searchQuery]);

  // 1. Cast string numeric fields to Numbers for all datasets
  const mixData = useMemo(() => {
    return mix.map((m) => ({
      ...m,
      grossRevenue: Number(m.grossRevenue || 0),
      netContribution: Number(m.netContribution || 0),
      pctSales: Number(m.pctSales || 0),
      pctContribution: Number(m.pctContribution || 0),
      contributionRate: Number(m.contributionRate || 0),
      retailerCount: Number(m.retailerCount || 0)
    }));
  }, [mix]);

  const lifecycleData = useMemo(() => {
    return lifecycle.map((l) => ({
      ...l,
      grossRevenue: Number(l.grossRevenue || 0),
      netContribution: Number(l.netContribution || 0),
      contributionRate: Number(l.contributionRate || 0),
      activeDays: Number(l.activeDays || 0)
    }));
  }, [lifecycle]);

  const timeseriesData = useMemo(() => {
    return timeseries.map((t) => ({
      ...t,
      grossRevenue: Number(t.grossRevenue || 0),
      netContribution: Number(t.netContribution || 0),
      contributionRate: Number(t.contributionRate || 0)
    }));
  }, [timeseries]);

  // Extract unique filter choices dynamically
  const uniqueGroups = useMemo(() => {
    const set = new Set(mixData.map((m) => m.productGroup).filter(Boolean));
    return Array.from(set).sort();
  }, [mixData]);

  const uniqueFamilies = useMemo(() => {
    const set = new Set(mixData.map((m) => m.gameFamily).filter(Boolean));
    return Array.from(set).sort();
  }, [mixData]);

  const uniqueStatuses = useMemo(() => {
    const set = new Set(lifecycleData.map((l) => l.lifecycleStatus).filter(Boolean));
    return Array.from(set).sort();
  }, [lifecycleData]);

  // 2. Apply filters to Mix Data (used for family bar charts)
  const filteredMixData = useMemo(() => {
    return mixData.filter((m) => {
      if (selectedGroup !== "all" && m.productGroup !== selectedGroup) return false;
      if (selectedFamilies.length > 0 && !selectedFamilies.includes(m.gameFamily)) return false;
      return true;
    });
  }, [mixData, selectedGroup, selectedFamilies]);

  // 3. Apply filters to Lifecycle Data (used for directory table and KPIs)
  const filteredLifecycleData = useMemo(() => {
    return lifecycleData.filter((l) => {
      if (selectedGroup !== "all" && l.productGroup !== selectedGroup) return false;
      if (selectedFamilies.length > 0 && !selectedFamilies.includes(l.gameFamily)) return false;
      if (lifecycleStatus !== "all" && l.lifecycleStatus !== lifecycleStatus) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const codeMatch = (l.gameCode || "").toLowerCase().includes(query);
        const nameMatch = (l.gameName || "").toLowerCase().includes(query);
        const familyMatch = (l.gameFamily || "").toLowerCase().includes(query);
        if (!codeMatch && !nameMatch && !familyMatch) return false;
      }
      return true;
    });
  }, [lifecycleData, selectedGroup, selectedFamilies, lifecycleStatus, searchQuery]);

  // 4. Timeseries Filtering & Aggregation
  // We aggregate timeseries monthly and pivot by productGroup (Draw vs Scratch) for the line chart
  const filteredTimeseriesData = useMemo(() => {
    let rawSeries = timeseriesData;

    if (dateRange !== "all" && timeseriesData.length > 0) {
      const maxDate = new Date(Math.max(...timeseriesData.map((t) => new Date(t.month))));
      let filterDate = new Date(maxDate);

      if (dateRange === "12m") {
        filterDate.setMonth(filterDate.getMonth() - 12);
      } else if (dateRange === "6m") {
        filterDate.setMonth(filterDate.getMonth() - 6);
      }

      rawSeries = timeseriesData.filter((t) => new Date(t.month) >= filterDate);
    }

    // Group raw timeseries by month and productGroup
    const monthlyGroups = {};

    rawSeries.forEach((t) => {
      const monthStr = new Date(t.month).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC"
      });
      const key = t.month.substring(0, 7); // "YYYY-MM"

      if (!monthlyGroups[key]) {
        monthlyGroups[key] = {
          key,
          label: monthStr,
          Draw: 0,
          Scratch: 0,
          Total: 0
        };
      }

      const grp = t.productGroup === "Draw" ? "Draw" : "Scratch";
      monthlyGroups[key][grp] += t.grossRevenue;
      monthlyGroups[key].Total += t.grossRevenue;
    });

    return Object.values(monthlyGroups).sort((a, b) => a.key.localeCompare(b.key));
  }, [timeseriesData, dateRange]);

  // 5. Dynamic KPIs based on filtered lifecycle set
  const kpis = useMemo(() => {
    let sales = 0;
    let contribution = 0;
    let count = filteredLifecycleData.length;

    filteredLifecycleData.forEach((l) => {
      sales += l.grossRevenue;
      contribution += l.netContribution;
    });

    const margin = sales > 0 ? contribution / sales : 0;

    return {
      sales,
      contribution,
      margin,
      count
    };
  }, [filteredLifecycleData]);

  // 6. Game family bar chart data
  // Since mix data can have duplicate families (e.g. Win 4 in Draw and Win 4 in Scratch),
  // we aggregate by family for the top-level mix chart
  const familySalesChartData = useMemo(() => {
    const families = {};
    filteredMixData.forEach((m) => {
      const name = m.gameFamily;
      if (!families[name]) {
        families[name] = {
          gameFamily: name,
          grossRevenue: 0,
          netContribution: 0,
          retailerCount: 0
        };
      }
      families[name].grossRevenue += m.grossRevenue;
      families[name].netContribution += m.netContribution;
      families[name].retailerCount = Math.max(families[name].retailerCount, m.retailerCount);
    });

    return Object.values(families)
      .map((f) => ({
        ...f,
        contributionRate: f.grossRevenue > 0 ? f.netContribution / f.grossRevenue : 0
      }))
      .sort((a, b) => b.grossRevenue - a.grossRevenue)
      .slice(0, 12); // Limit to top 12
  }, [filteredMixData]);

  // Game families sorted by contribution rate
  const familyRateChartData = useMemo(() => {
    const families = {};
    filteredMixData.forEach((m) => {
      const name = m.gameFamily;
      if (!families[name]) {
        families[name] = {
          gameFamily: name,
          grossRevenue: 0,
          netContribution: 0
        };
      }
      families[name].grossRevenue += m.grossRevenue;
      families[name].netContribution += m.netContribution;
    });

    return Object.values(families)
      .map((f) => ({
        gameFamily: f.gameFamily,
        contributionRate: f.grossRevenue > 0 ? f.netContribution / f.grossRevenue : 0
      }))
      .filter((f) => f.contributionRate > 0)
      .sort((a, b) => b.contributionRate - a.contributionRate);
  }, [filteredMixData]);

  // 7. Table sorting and pagination
  const sortedLifecycleData = useMemo(() => {
    const sorted = [...filteredLifecycleData];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle nulls
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string") {
        return sortAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
    });
    return sorted;
  }, [filteredLifecycleData, sortField, sortAsc]);

  const paginatedLifecycle = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedLifecycleData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedLifecycleData, currentPage]);

  const totalPages = Math.max(1, Math.ceil(sortedLifecycleData.length / itemsPerPage));

  // Toggle family helper
  const handleFamilyToggle = (family) => {
    if (selectedFamilies.includes(family)) {
      setSelectedFamilies((prev) => prev.filter((f) => f !== family));
    } else {
      setSelectedFamilies((prev) => [...prev, family]);
    }
  };

  // Sort helper
  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc((a) => !a);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Sync Database Marts
  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/analytics/overview/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncStatus("success");
        setSyncMessage("Product marts synced successfully! Refreshing view...");
        
        // Fetch fresh product data
        const getRes = await fetch("/api/analytics/portfolio");
        const fresh = await getRes.json();
        if (fresh.success) {
          setMix(fresh.mix);
          setLifecycle(fresh.lifecycle);
          setTimeseries(fresh.timeseries);
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
      setTimeout(() => {
        setSyncMessage(null);
      }, 4000);
    }
  };

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
    return `${(val * 100).toFixed(1)}%`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  };

  // Color mapper for margin bars
  const getRateColor = (rate) => {
    if (rate >= 0.45) return "var(--green)";
    if (rate >= 0.30) return "var(--gold)";
    return "var(--red)";
  };

  // Custom tooltips to guarantee elegant styles
  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            boxShadow: "var(--shadow-elevated)"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px", fontSize: "13px" }}>
            {label}
          </p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color, fontSize: "12px", margin: "4px 0" }}>
              {item.name}: <span style={{ fontWeight: 600 }}>{formatDollar(item.value)}</span>
            </p>
          ))}
          {payload[0]?.payload?.retailerCount && (
            <p style={{ color: "var(--text-secondary)", fontSize: "11px", marginTop: "8px", borderTop: "1px solid var(--border-dim)", paddingTop: "4px" }}>
              Retailer Penetration: <span style={{ color: "var(--text)", fontWeight: 500 }}>{payload[0].payload.retailerCount.toLocaleString()} stores</span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const CustomLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            boxShadow: "var(--shadow-elevated)"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "8px", fontSize: "13px" }}>
            {label}
          </p>
          {payload.map((item, idx) => (
            <p key={idx} style={{ color: item.color, fontSize: "12px", margin: "4px 0" }}>
              {item.name}: <span style={{ fontWeight: 600 }}>{formatDollar(item.value)}</span>
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomRateTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      return (
        <div
          style={{
            backgroundColor: "var(--card-bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "12px",
            boxShadow: "var(--shadow-elevated)"
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px", fontSize: "13px" }}>
            {data.gameFamily}
          </p>
          <p style={{ color: getRateColor(data.contributionRate), fontSize: "12px", fontWeight: 600 }}>
            Margin: {formatPercent(data.contributionRate)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (!mounted) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
        <div className="animate-spin" style={{ width: "32px", height: "32px", border: "3px solid var(--border)", borderTopColor: "var(--gold)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Top Filter & Sync Panel */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          padding: "16px 20px",
          backgroundColor: "var(--card-bg)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)"
        }}
      >
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Product Group Filters */}
          <div style={{ display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              onClick={() => setSelectedGroup("all")}
              style={{
                padding: "8px 16px",
                border: "none",
                background: selectedGroup === "all" ? "var(--surface-3)" : "transparent",
                color: selectedGroup === "all" ? "var(--text)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              All Categories
            </button>
            {uniqueGroups.map((g) => (
              <button
                key={g}
                onClick={() => setSelectedGroup(g)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderLeft: "1px solid var(--border)",
                  background: selectedGroup === g ? "var(--surface-3)" : "transparent",
                  color: selectedGroup === g ? "var(--text)" : "var(--text-secondary)",
                  fontWeight: 500,
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                {g === "Draw" ? "Draw Games" : "Scratch Games"}
              </button>
            ))}
          </div>

          {/* Duration Filters */}
          <div style={{ display: "flex", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <button
              onClick={() => setDateRange("all")}
              style={{
                padding: "8px 16px",
                border: "none",
                background: dateRange === "all" ? "var(--surface-3)" : "transparent",
                color: dateRange === "all" ? "var(--text)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              All Time
            </button>
            <button
              onClick={() => setDateRange("12m")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderLeft: "1px solid var(--border)",
                background: dateRange === "12m" ? "var(--surface-3)" : "transparent",
                color: dateRange === "12m" ? "var(--text)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              12 Months
            </button>
            <button
              onClick={() => setDateRange("6m")}
              style={{
                padding: "8px 16px",
                border: "none",
                borderLeft: "1px solid var(--border)",
                background: dateRange === "6m" ? "var(--surface-3)" : "transparent",
                color: dateRange === "6m" ? "var(--text)" : "var(--text-secondary)",
                fontWeight: 500,
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              6 Months
            </button>
          </div>

          {/* Families Multiselect Dropdown Checkboxes */}
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "var(--text-secondary)" }}>
              <Filter size={16} />
              <span>Families:</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxHeight: "34px", overflowY: "auto" }}>
                {selectedFamilies.length === 0 ? (
                  <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>All Families</span>
                ) : (
                  selectedFamilies.map((fam) => (
                    <span
                      key={fam}
                      onClick={() => handleFamilyToggle(fam)}
                      style={{
                        padding: "2px 8px",
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        color: "var(--blue)",
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: "11px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      {fam} &times;
                    </span>
                  ))
                )}
              </div>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleFamilyToggle(e.target.value);
                    e.target.value = "";
                  }
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "13px",
                  cursor: "pointer",
                  width: "140px"
                }}
              >
                <option value="">+ Select Family</option>
                {uniqueFamilies
                  .filter((fam) => !selectedFamilies.includes(fam))
                  .map((fam, idx) => (
                    <option key={idx} value={fam}>
                      {fam}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sync Button */}
        <div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              color: "var(--text)",
              fontSize: "13px",
              fontWeight: 500,
              cursor: isSyncing ? "not-allowed" : "pointer",
              transition: "var(--transition)"
            }}
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            {isSyncing ? "Syncing..." : "Sync Marts"}
          </button>
        </div>
      </div>

      {/* Sync Status Notifications */}
      {syncMessage && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "var(--radius-md)",
            backgroundColor: syncStatus === "success" ? "var(--status-passed-bg)" : "var(--status-failed-bg)",
            color: syncStatus === "success" ? "var(--status-passed-text)" : "var(--status-failed-text)",
            border: `1px solid ${syncStatus === "success" ? "var(--status-passed-border)" : "var(--status-failed-border)"}`,
            fontSize: "13px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <Activity size={16} />
          {syncMessage}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">Matched Categories</div>
          <div className="kpi-value">{kpis.count}</div>
          <div className="kpi-subtitle">Product codes matching filters</div>
        </div>

        <div className="kpi-card kpi-blue">
          <div className="kpi-label">Gross Sales</div>
          <div className="kpi-value">{formatDollar(kpis.sales)}</div>
          <div className="kpi-subtitle">Cumulative gross revenue</div>
        </div>

        <div className="kpi-card kpi-green">
          <div className="kpi-label">Net Contribution</div>
          <div className="kpi-value">{formatDollar(kpis.contribution)}</div>
          <div className="kpi-subtitle">Government lottery funds generated</div>
        </div>

        <div className="kpi-card kpi-gold">
          <div className="kpi-label">Average Margin</div>
          <div className="kpi-value">{formatPercent(kpis.margin)}</div>
          <div className="kpi-subtitle">Weighted net contribution rate</div>
        </div>
      </div>

      {/* Visualization Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "24px" }}>
        {/* Game Family Sales & Net Contribution */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Package size={18} className="text-blue-500" style={{ color: "var(--blue)" }} />
              <h3>Game Family Performance</h3>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Top 12 categories by gross sales volume
            </span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "350px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={familySalesChartData} margin={{ top: 15, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="gameFamily"
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                  angle={-25}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1e6).toFixed(0)}M`}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "var(--border-dim)" }} />
                <Legend iconType="circle" style={{ fontSize: "12px" }} />
                <Bar dataKey="grossRevenue" name="Sales" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netContribution" name="Net Contribution" fill="var(--green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Longitudinal Mix (Trend Line Chart) */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={18} style={{ color: "var(--gold)" }} />
              <h3>Longitudinal Product Mix</h3>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Monthly sales trend by product category
            </span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "350px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={filteredTimeseriesData} margin={{ top: 15, right: 20, left: 10, bottom: 10 }}>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${(val / 1e6).toFixed(0)}M`}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <Tooltip content={<CustomLineTooltip />} />
                <Legend iconType="circle" />
                {selectedGroup !== "Scratch" && (
                  <Line
                    type="monotone"
                    dataKey="Draw"
                    name="Draw Games"
                    stroke="var(--blue)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
                {selectedGroup !== "Draw" && (
                  <Line
                    type="monotone"
                    dataKey="Scratch"
                    name="Scratch Games"
                    stroke="var(--gold)"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Visualization Row 2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        {/* Game Family Margin Comparison */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Award size={18} style={{ color: "var(--green)" }} />
              <h3>Contribution Rate by Game Family</h3>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Net margin efficiency rankings
            </span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "300px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={Math.max(260, familyRateChartData.length * 28)}>
              <BarChart
                data={familyRateChartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
              >
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                  stroke="var(--text-muted)"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <YAxis
                  type="category"
                  dataKey="gameFamily"
                  stroke="var(--text-secondary)"
                  tickLine={false}
                  axisLine={false}
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                  width={110}
                />
                <Tooltip content={<CustomRateTooltip />} cursor={{ fill: "var(--border-dim)" }} />
                <Bar dataKey="contributionRate" name="Margin" radius={[0, 4, 4, 0]} barSize={14}>
                  {familyRateChartData.map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={getRateColor(entry.contributionRate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Product Lifecycle Table Card */}
      <div className="card">
        <div
          className="card-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Activity size={18} style={{ color: "var(--blue)" }} />
              <h3>Product Lifecycle Directory</h3>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Detailed inventory performance & lifecycle statuses
            </span>
          </div>

          {/* Table Level Search & Filter */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)"
                }}
              />
              <input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  padding: "6px 12px 6px 36px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "13px",
                  width: "200px"
                }}
              />
            </div>

            <select
              value={lifecycleStatus}
              onChange={(e) => setLifecycleStatus(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-1)",
                color: "var(--text)",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              <option value="all">All Statuses</option>
              {uniqueStatuses.map((st, idx) => (
                <option key={idx} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("gameName")}>
                    Game Name {sortField === "gameName" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("productGroup")}>
                    Category {sortField === "productGroup" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("gameFamily")}>
                    Family {sortField === "gameFamily" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("lifecycleStatus")}>
                    Status {sortField === "lifecycleStatus" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("trendDirection")}>
                    Trend {sortField === "trendDirection" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("grossRevenue")}>
                    Gross Rev {sortField === "grossRevenue" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("contributionRate")}>
                    Margin {sortField === "contributionRate" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("firstObserved")}>
                    Observed Range {sortField === "firstObserved" && (sortAsc ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedLifecycle.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>
                      No product records matched the selected filters.
                    </td>
                  </tr>
                ) : (
                  paginatedLifecycle.map((game, idx) => {
                    // Status badge mapping
                    let badgeClass = "badge";
                    let badgeStyle = { backgroundColor: "var(--surface-3)", color: "var(--text-secondary)" };
                    
                    if (game.lifecycleStatus === "Active") {
                      badgeStyle = { backgroundColor: "var(--status-passed-bg)", color: "var(--status-passed-text)", border: "1px solid var(--status-passed-border)" };
                    } else if (game.lifecycleStatus === "Dormant") {
                      badgeStyle = { backgroundColor: "var(--status-warning-bg)", color: "var(--status-warning-text)", border: "1px solid var(--status-warning-border)" };
                    } else if (game.lifecycleStatus === "Inactive") {
                      badgeStyle = { backgroundColor: "var(--status-failed-bg)", color: "var(--status-failed-text)", border: "1px solid var(--status-failed-border)" };
                    }

                    // Trend icon
                    let trendIcon = null;
                    if (game.trendDirection === "Growing" || game.trendDirection === "Up") {
                      trendIcon = <span style={{ color: "var(--green)", display: "inline-flex", alignItems: "center", gap: "4px" }}><TrendingUp size={14} /> Growing</span>;
                    } else if (game.trendDirection === "Declining" || game.trendDirection === "Down") {
                      trendIcon = <span style={{ color: "var(--red)", display: "inline-flex", alignItems: "center", gap: "4px" }}><TrendingDown size={14} /> Declining</span>;
                    } else if (game.trendDirection === "Stable") {
                      trendIcon = <span style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }}><Minus size={14} /> Stable</span>;
                    } else {
                      trendIcon = <span style={{ color: "var(--text-muted)" }}>—</span>;
                    }

                    return (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>
                          {game.gameName}
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                            ID: {game.gameCode}
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: "var(--surface-3)", color: "var(--text-secondary)" }}>
                            {game.productGroup}
                          </span>
                        </td>
                        <td>{game.gameFamily}</td>
                        <td>
                          <span className="badge" style={badgeStyle}>
                            {game.lifecycleStatus}
                          </span>
                        </td>
                        <td>{trendIcon}</td>
                        <td style={{ textAlign: "right", color: "var(--text)", fontWeight: 500 }}>
                          {formatDollar(game.grossRevenue)}
                        </td>
                        <td style={{ textAlign: "right", color: getRateColor(game.contributionRate), fontWeight: 600 }}>
                          {formatPercent(game.contributionRate)}
                        </td>
                        <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span>First: {formatDate(game.firstObserved)}</span>
                            <span>Last: {formatDate(game.lastObserved)}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 20px",
              borderTop: "1px solid var(--border)",
              fontSize: "13px",
              color: "var(--text-secondary)"
            }}
          >
            <div>
              Showing <span style={{ color: "var(--text)", fontWeight: 600 }}>{sortedLifecycleData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {Math.min(currentPage * itemsPerPage, sortedLifecycleData.length)}
              </span>{" "}
              of <span style={{ color: "var(--text)", fontWeight: 600 }}>{sortedLifecycleData.length.toLocaleString()}</span> products
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: "6px 12px",
                  background: currentPage === 1 ? "transparent" : "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: currentPage === 1 ? "var(--text-muted)" : "var(--text)",
                  cursor: currentPage === 1 ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span style={{ padding: "0 8px" }}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: "6px 12px",
                  background: currentPage === totalPages ? "transparent" : "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  color: currentPage === totalPages ? "var(--text-muted)" : "var(--text)",
                  cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: "11px", color: "var(--text-muted)", marginTop: "12px" }}>
        Data Marts Source: mart_exec_product_mix, mart_exec_product_lifecycle, mart_exec_product_timeseries | Stochos Analytics Platform
      </div>
    </div>
  );
}
