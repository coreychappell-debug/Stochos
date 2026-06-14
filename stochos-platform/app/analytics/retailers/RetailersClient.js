"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  BarChart,
  Bar,
  Cell
} from "recharts";
import {
  Search,
  Filter,
  Layers,
  TrendingUp,
  Percent,
  Activity,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Compass
} from "lucide-react";

export default function RetailersClient({ initialChannels, initialRetailers, initialQuadrants }) {
  const [mounted, setMounted] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("grossRevenue");
  const [sortAsc, setSortAsc] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Cast string numeric fields to Numbers
  const retailers = useMemo(() => {
    return initialRetailers.map((r) => ({
      ...r,
      grossRevenue: Number(r.grossRevenue || 0),
      netContribution: Number(r.netContribution || 0),
      estimatedPayout: Number(r.estimatedPayout || 0),
      retailerCommission: Number(r.retailerCommission || 0),
      drawRevenue: Number(r.drawRevenue || 0),
      scratchRevenue: Number(r.scratchRevenue || 0),
      drawShare: Number(r.drawShare || 0),
      scratchShare: Number(r.scratchShare || 0),
      contributionRate: Number(r.contributionRate || 0),
      activeDays: Number(r.activeDays || 0),
      avgDailySales: Number(r.avgDailySales || 0),
      distinctProducts: Number(r.distinctProducts || 0)
    }));
  }, [initialRetailers]);

  const quadrants = useMemo(() => {
    return initialQuadrants.map((q) => ({
      ...q,
      grossRevenue: Number(q.grossRevenue || 0),
      netContribution: Number(q.netContribution || 0),
      drawShare: Number(q.drawShare || 0),
      scratchShare: Number(q.scratchShare || 0),
      contributionRate: Number(q.contributionRate || 0),
      avgDailySales: Number(q.avgDailySales || 0),
      medianDrawShare: Number(q.medianDrawShare || 0.44),
      medianContributionRate: Number(q.medianContributionRate || 0.36)
    }));
  }, [initialQuadrants]);

  // Extract unique filters dynamically
  const uniqueCounties = useMemo(() => {
    const set = new Set(retailers.map((r) => r.county).filter(Boolean));
    return Array.from(set).sort();
  }, [retailers]);

  const uniqueChannels = useMemo(() => {
    const set = new Set(retailers.map((r) => r.businessType).filter(Boolean));
    return Array.from(set).sort();
  }, [retailers]);

  // 2. Apply filters to retailers
  const filteredRetailers = useMemo(() => {
    return retailers.filter((r) => {
      if (selectedCounty && r.county !== selectedCounty) return false;
      if (selectedChannels.length > 0 && !selectedChannels.includes(r.businessType)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (r.retailerName || "").toLowerCase().includes(query);
        const idMatch = (r.retailerId || "").toLowerCase().includes(query);
        const cityMatch = (r.city || "").toLowerCase().includes(query);
        const countyMatch = (r.county || "").toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !cityMatch && !countyMatch) return false;
      }
      return true;
    });
  }, [retailers, selectedCounty, selectedChannels, searchQuery]);

  // Apply filters to quadrants (matching logic)
  const filteredQuadrants = useMemo(() => {
    return quadrants.filter((q) => {
      if (selectedCounty && q.county !== selectedCounty) return false;
      if (selectedChannels.length > 0 && !selectedChannels.includes(q.businessType)) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = (q.retailerName || "").toLowerCase().includes(query);
        const idMatch = (q.retailerId || "").toLowerCase().includes(query);
        const cityMatch = (q.city || "").toLowerCase().includes(query);
        const countyMatch = (q.county || "").toLowerCase().includes(query);
        if (!nameMatch && !idMatch && !cityMatch && !countyMatch) return false;
      }
      return true;
    });
  }, [quadrants, selectedCounty, selectedChannels, searchQuery]);

  // 3. Compute dynamic channel aggregates based on filtered set
  const channelMix = useMemo(() => {
    const groups = {};
    filteredRetailers.forEach((r) => {
      const type = r.businessType || "Other";
      if (!groups[type]) {
        groups[type] = {
          businessType: type,
          retailerCount: 0,
          grossRevenue: 0,
          netContribution: 0,
          drawRevenue: 0,
          scratchRevenue: 0
        };
      }
      const g = groups[type];
      g.retailerCount += 1;
      g.grossRevenue += r.grossRevenue;
      g.netContribution += r.netContribution;
      g.drawRevenue += r.drawRevenue;
      g.scratchRevenue += r.scratchRevenue;
    });

    return Object.values(groups)
      .map((g) => ({
        ...g,
        drawShare: g.grossRevenue > 0 ? g.drawRevenue / g.grossRevenue : 0,
        scratchShare: g.grossRevenue > 0 ? g.scratchRevenue / g.grossRevenue : 0,
        avgSalesPerRetailer: g.retailerCount > 0 ? g.grossRevenue / g.retailerCount : 0,
        contributionRate: g.grossRevenue > 0 ? g.netContribution / g.grossRevenue : 0
      }))
      .sort((a, b) => b.grossRevenue - a.grossRevenue);
  }, [filteredRetailers]);

  // 4. Compute dynamic quadrant counts for the KPI summary cards
  const quadrantMetrics = useMemo(() => {
    const counts = {
      hd_hc: 0,
      hd_lc: 0,
      hs_hc: 0,
      hs_lc: 0,
      total: filteredQuadrants.length
    };
    filteredQuadrants.forEach((q) => {
      const label = q.quadrantLabel;
      if (label === "High Draw / High Contribution") counts.hd_hc++;
      else if (label === "High Draw / Low Contribution") counts.hd_lc++;
      else if (label === "High Scratch / High Contribution") counts.hs_hc++;
      else if (label === "High Scratch / Low Contribution") counts.hs_lc++;
    });
    return counts;
  }, [filteredQuadrants]);

  // 5. Sorted Retailer list for detailed table representation
  const sortedRetailers = useMemo(() => {
    const data = [...filteredRetailers];
    data.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });
    return data;
  }, [filteredRetailers, sortField, sortAsc]);

  // Pagination slice
  const paginatedRetailers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedRetailers.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRetailers, currentPage]);

  const totalPages = Math.max(1, Math.ceil(sortedRetailers.length / itemsPerPage));

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCounty, selectedChannels, searchQuery]);

  const handleChannelToggle = (channel) => {
    if (selectedChannels.includes(channel)) {
      setSelectedChannels((prev) => prev.filter((c) => c !== channel));
    } else {
      setSelectedChannels((prev) => [...prev, channel]);
    }
  };

  // Slice top 1000 retailers for the scatter plot to avoid DOM lag
  const scatterPlotData = useMemo(() => {
    return filteredQuadrants.slice(0, 1000);
  }, [filteredQuadrants]);

  // Medians from the dataset
  const medianDrawShare = filteredQuadrants[0]?.medianDrawShare || 0.44;
  const medianContributionRate = filteredQuadrants[0]?.medianContributionRate || 0.36;

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

  const formatCount = (val) => {
    if (val === null || val === undefined) return "—";
    return Math.round(val).toLocaleString();
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Custom tooltips
  const CustomScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const q = payload[0].payload;
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
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{q.retailerName}</p>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: 6 }}>
            ID: {q.retailerId} | {q.city}, {q.county}
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Gross: <span style={{ color: "var(--text)" }}>{formatDollar(q.grossRevenue)}</span>
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Draw Share: <span style={{ color: "var(--blue)" }}>{formatPercent(q.drawShare)}</span>
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Margin: <span style={{ color: "var(--green)" }}>{formatPercent(q.contributionRate)}</span>
          </p>
          <p style={{ fontSize: "11px", color: "var(--gold)", fontWeight: 500, marginTop: 4 }}>
            {q.quadrantLabel}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload }) => {
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
          <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{data.businessType}</p>
          <p style={{ color: "var(--text-secondary)" }}>
            Retailers: <span style={{ color: "var(--text)" }}>{formatCount(data.retailerCount)}</span>
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Gross: <span style={{ color: "var(--blue)" }}>{formatDollar(data.grossRevenue)}</span>
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Net Cont: <span style={{ color: "var(--green)" }}>{formatDollar(data.netContribution)}</span>
          </p>
          <p style={{ color: "var(--text-secondary)" }}>
            Profit Margin: <span style={{ color: "var(--gold)" }}>{formatPercent(data.contributionRate)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (!mounted) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
        Loading Retailer Dashboard...
      </div>
    );
  }

  // Total sales of the current filtered set
  const filteredSales = filteredRetailers.reduce((acc, curr) => acc + curr.grossRevenue, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Search and Filter Panel */}
      <div
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          flexWrap: "wrap",
          gap: "16px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", flex: 1 }}>
          {/* Search Box */}
          <div style={{ position: "relative", minWidth: "240px", flex: 1 }}>
            <Search
              size={16}
              style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="Search by name, ID, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                backgroundColor: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: "var(--text)",
                fontSize: "13px"
              }}
            />
          </div>

          {/* County Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Filter size={14} style={{ color: "var(--text-muted)" }} />
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              style={{
                padding: "8px 12px",
                backgroundColor: "var(--surface-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: "var(--text)",
                fontSize: "13px",
                cursor: "pointer"
              }}
            >
              <option value="">All Counties</option>
              {uniqueCounties.map((c, idx) => (
                <option key={idx} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Channel Selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
            <ShoppingBag size={14} style={{ color: "var(--text-muted)" }} />
            <span>Channels:</span>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              {selectedChannels.length === 0 ? (
                <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>All Channels</span>
              ) : (
                selectedChannels.map((ch) => (
                  <span
                    key={ch}
                    onClick={() => handleChannelToggle(ch)}
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
                    {ch} &times;
                  </span>
                ))
              )}
            </div>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  handleChannelToggle(e.target.value);
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
              <option value="">+ Add Channel</option>
              {uniqueChannels
                .filter((ch) => !selectedChannels.includes(ch))
                .map((ch, idx) => (
                  <option key={idx} value={ch}>
                    {ch}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Filter Summary */}
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)", textAlign: "right" }}>
          <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatCount(filteredRetailers.length)}</span> retailers |{" "}
          <span style={{ color: "var(--blue)", fontWeight: 600 }}>{formatDollar(filteredSales)}</span> gross revenue
        </div>
      </div>

      {/* Dynamic Quadrant Count Cards Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div className="kpi-card kpi-green">
          <div className="kpi-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>High Draw / High Cont.</span>
            <span style={{ color: "var(--green)", fontWeight: "bold" }}>HD-HC</span>
          </div>
          <div className="kpi-value">{formatCount(quadrantMetrics.hd_hc)}</div>
          <div className="kpi-subtitle">
            {formatPercent(quadrantMetrics.total > 0 ? quadrantMetrics.hd_hc / quadrantMetrics.total : 0)} of filtered network
          </div>
        </div>

        <div className="kpi-card kpi-blue">
          <div className="kpi-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>High Scratch / High Cont.</span>
            <span style={{ color: "var(--blue)", fontWeight: "bold" }}>HS-HC</span>
          </div>
          <div className="kpi-value">{formatCount(quadrantMetrics.hs_hc)}</div>
          <div className="kpi-subtitle">
            {formatPercent(quadrantMetrics.total > 0 ? quadrantMetrics.hs_hc / quadrantMetrics.total : 0)} of filtered network
          </div>
        </div>

        <div className="kpi-card kpi-gold">
          <div className="kpi-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>High Draw / Low Cont.</span>
            <span style={{ color: "var(--gold)", fontWeight: "bold" }}>HD-LC</span>
          </div>
          <div className="kpi-value">{formatCount(quadrantMetrics.hd_lc)}</div>
          <div className="kpi-subtitle">
            {formatPercent(quadrantMetrics.total > 0 ? quadrantMetrics.hd_lc / quadrantMetrics.total : 0)} of filtered network
          </div>
        </div>

        <div className="kpi-card kpi-red">
          <div className="kpi-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>High Scratch / Low Cont.</span>
            <span style={{ color: "var(--red)", fontWeight: "bold" }}>HS-LC</span>
          </div>
          <div className="kpi-value">{formatCount(quadrantMetrics.hs_lc)}</div>
          <div className="kpi-subtitle">
            {formatPercent(quadrantMetrics.total > 0 ? quadrantMetrics.hs_lc / quadrantMetrics.total : 0)} of filtered network
          </div>
        </div>
      </div>

      {/* Visualizations: Quadrant Scatter and Channel Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "24px" }}>
        {/* Scatter Plot */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3>Retailer Quadrants</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Top 1,000 retailers by sales volume
            </span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "400px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="drawShare"
                  name="Draw Share"
                  domain={[0, 1]}
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                  stroke="var(--text-muted)"
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <YAxis
                  type="number"
                  dataKey="contributionRate"
                  name="Margin"
                  domain={[0.2, 0.6]}
                  tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                  stroke="var(--text-muted)"
                  style={{ fontSize: 11, fontFamily: "var(--font-sans)" }}
                />
                <Tooltip content={<CustomScatterTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                <ReferenceLine x={medianDrawShare} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="3 3" />
                <ReferenceLine y={medianContributionRate} stroke="rgba(255, 255, 255, 0.2)" strokeDasharray="3 3" />

                <Scatter
                  name="High Draw / High Contribution"
                  data={scatterPlotData.filter((q) => q.quadrantLabel === "High Draw / High Contribution")}
                  fill="#06d6a0"
                  line={false}
                />
                <Scatter
                  name="High Draw / Low Contribution"
                  data={scatterPlotData.filter((q) => q.quadrantLabel === "High Draw / Low Contribution")}
                  fill="#ffd166"
                  line={false}
                />
                <Scatter
                  name="High Scratch / High Contribution"
                  data={scatterPlotData.filter((q) => q.quadrantLabel === "High Scratch / High Contribution")}
                  fill="#00b4d8"
                  line={false}
                />
                <Scatter
                  name="High Scratch / Low Contribution"
                  data={scatterPlotData.filter((q) => q.quadrantLabel === "High Scratch / Low Contribution")}
                  fill="#ef476f"
                  line={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Channel Bar Chart */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-header">
            <h3>Channel Profitability</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Revenues and profit margins by store type</span>
          </div>
          <div className="card-body" style={{ flex: 1, minHeight: "400px", position: "relative" }}>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={channelMix.slice(0, 8)} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid stroke="var(--border-dim)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="businessType"
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
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "var(--border-dim)" }} />
                <Legend iconType="circle" />
                <Bar dataKey="grossRevenue" name="Gross Revenue" fill="var(--blue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="netContribution" name="Net Contribution" fill="var(--green)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sortable Searchable Retailer List */}
      <div className="card">
        <div className="card-header">
          <h3>Retailer Directory</h3>
          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Showing {sortedRetailers.length.toLocaleString()} locations
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("retailerId")}>
                    ID {sortField === "retailerId" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("retailerName")}>
                    Retailer Name {sortField === "retailerName" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("businessType")}>
                    Channel {sortField === "businessType" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("city")}>
                    City {sortField === "city" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer" }} onClick={() => handleSort("county")}>
                    County {sortField === "county" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("grossRevenue")}>
                    Gross Rev {sortField === "grossRevenue" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("netContribution")}>
                    Net Cont. {sortField === "netContribution" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("contributionRate")}>
                    Margin {sortField === "contributionRate" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th style={{ cursor: "pointer", textAlign: "right" }} onClick={() => handleSort("avgDailySales")}>
                    Daily Sales {sortField === "avgDailySales" && (sortAsc ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRetailers.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ color: "var(--text-muted)", fontFamily: "monospace" }}>{r.retailerId}</td>
                    <td style={{ fontWeight: 500 }}>{r.retailerName}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: "var(--surface-3)", color: "var(--text-secondary)" }}>
                        {r.businessType}
                      </span>
                    </td>
                    <td>{r.city}</td>
                    <td style={{ color: "var(--text-secondary)" }}>{r.county}</td>
                    <td style={{ textAlign: "right", color: "var(--text)", fontWeight: 500 }}>
                      {formatDollar(r.grossRevenue)}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--green)" }}>{formatDollar(r.netContribution)}</td>
                    <td style={{ textAlign: "right", color: "var(--gold)", fontWeight: 600 }}>
                      {formatPercent(r.contributionRate)}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--text-secondary)" }}>
                      {formatDollar(r.avgDailySales)}
                    </td>
                  </tr>
                ))}
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
              Showing <span style={{ color: "var(--text)", fontWeight: 600 }}>{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {Math.min(currentPage * itemsPerPage, sortedRetailers.length)}
              </span>{" "}
              of <span style={{ color: "var(--text)", fontWeight: 600 }}>{sortedRetailers.length.toLocaleString()}</span> retailers
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
    </div>
  );
}
