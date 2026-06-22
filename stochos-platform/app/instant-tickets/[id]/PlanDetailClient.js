"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, BarChart4, Settings2, Info, Calendar, ChevronDown, ChevronRight, Layers, Copy, PlusCircle, Activity, Trash2, Pin, RotateCcw } from "lucide-react";


export const PRELOADED_TICKETS = [
  { id: 'theme-platinum', name: 'VIP Millions ($50)', price: 50, bgStyle: 'linear-gradient(135deg, #7c3aed, #4c1d95)' },
  { id: 'theme-gold', name: 'Gold Rush ($30)', price: 30, bgStyle: 'linear-gradient(135deg, #eab308, #ca8a04)' },
  { id: 'theme-black', name: 'Diamond Celebration ($20)', price: 20, bgStyle: 'linear-gradient(135deg, #374151, #111827)' },
  { id: 'theme-green', name: 'Emerald Crossword ($10)', price: 10, bgStyle: 'linear-gradient(135deg, #10b981, #047857)' },
  { id: 'theme-sapphire', name: 'Royal Sapphire ($10)', price: 10, bgStyle: 'linear-gradient(135deg, #2563eb, #1d4ed8)' },
  { id: 'theme-ruby', name: 'Ruby Bingo ($5)', price: 5, bgStyle: 'linear-gradient(135deg, #ef4444, #b91c1c)' },
  { id: 'theme-neon', name: 'Neon Cash ($3)', price: 3, bgStyle: 'linear-gradient(135deg, #ec4899, #be185d)' }
];

export const getTicketBgStyle = (imageUrl) => {
  if (!imageUrl) return { background: "rgba(255,255,255,0.03)" };
  const theme = PRELOADED_TICKETS.find(t => t.id === imageUrl);
  if (theme) {
    return { background: theme.bgStyle };
  }
  return { backgroundImage: `url(${imageUrl})`, backgroundPosition: "center", backgroundSize: "cover", backgroundRepeat: "no-repeat" };
};

export default function PlanDetailClient({ plan, stats }) {
  const [tab, setTab] = useState("summary");
  const [saving, setSaving] = useState(false);
  const [allocationBasis, setAllocationBasis] = useState("sales");
  const [collapsedQuarters, setCollapsedQuarters] = useState({ q1: false, q2: false, q3: false, q4: false, unscheduled: false });
  const [collapseGantt, setCollapseGantt] = useState(false);
  const [collapseOverhead, setCollapseOverhead] = useState(false);
  const [collapsedDenoms, setCollapsedDenoms] = useState({});
  const [ganttGroupBy, setGanttGroupBy] = useState("month");
  const [sellThroughOverride, setSellThroughOverride] = useState(parseFloat(plan.sellThroughPct) || 85.0);
  const [retailerCommOverride, setRetailerCommOverride] = useState(parseFloat(plan.retailerCommPct) || 6.0);
  const [printRunScale, setPrintRunScale] = useState(1.0);
  const [returnRateOffset, setReturnRateOffset] = useState(0.0);
  const [planogramMonth, setPlanogramMonth] = useState(0);
  const [dispenserProfile, setDispenserProfile] = useState("ny_vending_40");
  const [doubleFacedGames, setDoubleFacedGames] = useState({});
  const [carryoverGames, setCarryoverGames] = useState([]);
  const [collapseCarryover, setCollapseCarryover] = useState(true);
  const router = useRouter();

  const { totalRevenue, totalPrizeExpense, weightedPayout, totalMarketingCost, vendorAlloc, pipeline, gamesByDenom, marketingItems, games, scenario } = stats || {};

  const getFiscalMonthIndex = (launchDateStr) => {
    if (!launchDateStr) return -1;
    let dateStr = launchDateStr;
    if (typeof launchDateStr !== 'string') {
      dateStr = new Date(launchDateStr).toISOString().split('T')[0];
    }
    const parts = dateStr.split("-");
    if (parts.length < 2) return -1;
    const month = parseInt(parts[1], 10);
    return month >= 7 ? month - 7 : month + 5;
  };

  const getSalesDuration = (g) => {
    if (!g.launchDate || !g.closeDate) return 3; // default is 3 months
    const start = new Date(g.launchDate);
    const end = new Date(g.closeDate);
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    return Math.max(1, diffMonths);
  };

  const DEFAULT_CARRYOVER_GAMES = [
    { id: "c1", gameNumber: "990", name: "Set For Life", denomination: 10, imageUrl: "theme-green", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c2", gameNumber: "985", name: "Win $1,000 A Week For Life", denomination: 2, imageUrl: "theme-ruby", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c3", gameNumber: "978", name: "$10,000,000 Colossus", denomination: 30, imageUrl: "/uploads/tickets/ny_gold_rush_ticket.png", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c4", gameNumber: "960", name: "Cashword Extra", denomination: 5, imageUrl: "theme-neon", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c5", gameNumber: "955", name: "Take 5 Instant", denomination: 1, imageUrl: "theme-platinum", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c6", gameNumber: "931", name: "Triple 777", denomination: 10, imageUrl: "theme-sapphire", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    { id: "c7", gameNumber: "920", name: "Win $2,500 A Week For Life", denomination: 5, imageUrl: "theme-ruby", activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }
  ];

  const downloadRosterCSV = () => {
    const headers = [
      "Game Number",
      "Name",
      "Denomination",
      "Units",
      "Payout %",
      "Projected Return Rate %",
      "Projected Gross Sales",
      "Contractor",
      "Launch Date",
      "Close Date",
      "Est. Duration (Months)",
      "Procurement Status",
      "Is Reorder"
    ];

    const rows = (dynamicAllocatedGames || []).map(g => {
      const rr = parseFloat(g.projectedReturnRate || 0);
      const scaledReturnRate = Math.max(0, Math.min(100, rr + returnRateOffset));
      return [
        g.gameNumber || "",
        `"${(g.name || "").replace(/"/g, '""')}"`,
        g.denomination,
        g.units.toFixed(0),
        g.payoutPercent,
        scaledReturnRate.toFixed(1),
        g.grossSales.toFixed(2),
        `"${(g.vendor?.name || "").replace(/"/g, '""')}"`,
        g.launchDate || "Unscheduled",
        g.closeDate || "Unscheduled",
        getSalesDuration(g),
        g.deliveryStatus,
        g.isReorder ? "Yes" : "No"
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${(plan.name || "plan").replace(/[^a-z0-9]/gi, "_").toLowerCase()}_roster_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderGanttRow = (g) => {
    const startMonth = getFiscalMonthIndex(g.launchDate);
    const statusColor = STATUS_COLORS[g.deliveryStatus.toLowerCase()] || "#6b7280";
    const isReorder = g.isReorder;

    const sales = g.grossSales;

    // Custom gradients for status colors
    const barGradients = {
      planned: "linear-gradient(90deg, #f59e0bcc, #ca8a04cc)",
      ordered: "linear-gradient(90deg, #3b82f6cc, #1d4ed8cc)",
      delivered: "linear-gradient(90deg, #10b981cc, #047857cc)",
      cancelled: "linear-gradient(90deg, #ef4444cc, #b91c1ccc)",
      default: "linear-gradient(90deg, #6b7280cc, #4b5563cc)"
    };
    const gradient = barGradients[g.deliveryStatus.toLowerCase()] || barGradients.default;

    const duration = getSalesDuration(g);
    const launchDateObj = g.launchDate ? new Date(g.launchDate) : new Date();
    const closeDateObj = g.closeDate ? new Date(g.closeDate) : new Date(new Date(launchDateObj).setMonth(launchDateObj.getMonth() + 3));
    const activeText = `${launchDateObj.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})} - ${closeDateObj.toLocaleDateString('en-US', {month: 'short', year: 'numeric'})}`;

    const tooltipText = `${g.name} (${g.vendor?.name?.split(" ")[0] || 'Unknown'})
Price: $${g.denomination} | Game: #${g.gameNumber}
Status: ${g.deliveryStatus.toUpperCase()} ${isReorder ? '(Reorder)' : ''}
Launch: ${g.launchDate ? new Date(g.launchDate).toLocaleDateString() : 'TBD'}
Active Period: ${activeText} (${duration} Months)
Units: ${fmtUnits(g.units)} | Est. Sales: ${fmt$(sales)}`;

    return (
      <div key={g.id} style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "16px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
        {/* Game info */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{ fontSize: "11px", fontWeight: "700", background: "rgba(255,255,255,0.08)", border: "1px solid var(--border)", padding: "2px 6px", borderRadius: "4px", flexShrink: 0, color: "var(--text)" }}>
            ${g.denomination}
          </span>
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.name}>
              {g.name}
            </span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
              {g.vendor?.name?.split(" ")[0] || "Unknown"}
            </span>
          </div>
        </div>

        {/* Timeline bar container */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", height: "30px", position: "relative", background: "rgba(255,255,255,0.01)", borderRadius: "4px", overflow: "hidden" }}>
          {/* Grid background lines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ borderRight: i < 11 ? "1px solid rgba(255,255,255,0.04)" : "none", height: "100%" }} />
          ))}

          {/* Lifespan bar */}
          {startMonth !== -1 && (
            <div
              title={tooltipText}
              style={{
                position: "absolute",
                left: `${(startMonth / 12) * 100}%`,
                width: `${(duration / 12) * 100}%`,
                top: "3px",
                bottom: "3px",
                background: gradient,
                borderLeft: `4px solid ${statusColor}`,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                fontSize: "10px",
                fontWeight: "600",
                color: "#fff",
                textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                cursor: "help",
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis",
                transition: "all 0.2s ease-in-out",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scaleY(1.08)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scaleY(1)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {`[$${g.denomination}] ${g.name} (${g.deliveryStatus})`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    window.__next_refresh = () => {
      router.refresh();
    };
    return () => {
      delete window.__next_refresh;
    };
  }, [router]);

  useEffect(() => {
    setSellThroughOverride(parseFloat(plan.sellThroughPct) || 85.0);
    setRetailerCommOverride(parseFloat(plan.retailerCommPct) || 6.0);
    setPrintRunScale(1.0);
    setReturnRateOffset(0.0);
  }, [plan.sellThroughPct, plan.retailerCommPct]);

  useEffect(() => {
    const firstScheduled = (games || []).find(g => g.launchDate);
    if (firstScheduled) {
      const idx = getFiscalMonthIndex(firstScheduled.launchDate);
      if (idx !== -1) {
        setPlanogramMonth(idx);
      }
    }
  }, [games]);

  useEffect(() => {
    try {
      const savedTab = localStorage.getItem("stochos_default_tab");
      if (savedTab) setTab(savedTab);
      
      const savedGanttGroup = localStorage.getItem("stochos_default_gantt_group");
      if (savedGanttGroup) setGanttGroupBy(savedGanttGroup);
      
      const savedDispenser = localStorage.getItem("stochos_default_dispenser_profile");
      if (savedDispenser) setDispenserProfile(savedDispenser);

      const savedCarryover = localStorage.getItem(`stochos_carryover_games_${plan.id}`);
      if (savedCarryover) {
        setCarryoverGames(JSON.parse(savedCarryover));
      } else {
        setCarryoverGames(DEFAULT_CARRYOVER_GAMES);
        localStorage.setItem(`stochos_carryover_games_${plan.id}`, JSON.stringify(DEFAULT_CARRYOVER_GAMES));
      }
    } catch (e) {
      console.error("Failed to load preferences/carryover from localStorage:", e);
      setCarryoverGames(DEFAULT_CARRYOVER_GAMES);
    }
  }, [plan.id]);

  const saveCarryoverGames = (updatedList) => {
    setCarryoverGames(updatedList);
    try {
      localStorage.setItem(`stochos_carryover_games_${plan.id}`, JSON.stringify(updatedList));
    } catch (e) {
      console.error("Failed to save carryover games to localStorage:", e);
    }
  };

  const DISPENSER_PROFILES = {
    ny_standard_24: {
      name: "NY Standard 24-Bin Dispenser",
      totalBins: 24,
      targets: { 30: 2, 20: 3, 10: 4, 5: 5, 3: 2, 2: 4, 1: 4 }
    },
    ny_standard_30: {
      name: "NY Standard 30-Bin Dispenser",
      totalBins: 30,
      targets: { 30: 3, 20: 4, 10: 6, 5: 6, 3: 4, 2: 4, 1: 3 }
    },
    ny_vending_40: {
      name: "NY Vending 40-Bin Dispenser",
      totalBins: 40,
      targets: { 50: 2, 30: 4, 20: 6, 10: 8, 5: 8, 3: 4, 2: 5, 1: 3 }
    },
    ny_supermarket_48: {
      name: "NY Supermarket 48-Bin Dispenser",
      totalBins: 48,
      targets: { 50: 3, 30: 6, 20: 8, 10: 10, 5: 10, 3: 4, 2: 4, 1: 3 }
    }
  };

  const handlePinPreferences = () => {
    try {
      localStorage.setItem("stochos_default_tab", tab);
      localStorage.setItem("stochos_default_gantt_group", ganttGroupBy);
      localStorage.setItem("stochos_default_dispenser_profile", dispenserProfile);
      alert(`📌 Default View Pinned!\n\nTab: ${tab.toUpperCase()}\nTimeline: ${ganttGroupBy === 'month' ? 'Launch Month' : 'Price Tier'}\nDispenser: ${DISPENSER_PROFILES[dispenserProfile]?.name || dispenserProfile}`);
    } catch (e) {
      alert("Failed to pin preferences: " + e.message);
    }
  };

  const handleResetPreferences = () => {
    try {
      localStorage.removeItem("stochos_default_tab");
      localStorage.removeItem("stochos_default_gantt_group");
      localStorage.removeItem("stochos_default_dispenser_profile");
      
      setTab("summary");
      setGanttGroupBy("month");
      setDispenserProfile("ny_vending_40");
      
      alert("🔄 Preferences reset to system defaults.");
    } catch (e) {
      alert("Failed to reset preferences: " + e.message);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Change plan status to ${newStatus}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instant-tickets/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update plan status");
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSandbox = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/instant-tickets/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellThroughPct: sellThroughOverride,
          retailerCommPct: retailerCommOverride
        }),
      });
      if (!res.ok) throw new Error("Failed to save sandbox values to database");
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetSandbox = () => {
    setSellThroughOverride(parseFloat(plan.sellThroughPct) || 85.0);
    setRetailerCommOverride(parseFloat(plan.retailerCommPct) || 6.0);
    setPrintRunScale(1.0);
    setReturnRateOffset(0.0);
  };

  const STATUS_COLORS = {
    planned: "#6b7280", ordered: "#f59e0b", in_production: "#3b82f6",
    shipped: "#8b5cf6", received: "#10b981", on_sale: "#10b981",
    closed: "#f59e0b", ended: "#ef4444",
    delivered: "#10b981", cancelled: "#ef4444"
  };

  function fmt$(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return "—";
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(1) + "M";
    return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (isNaN(num)) return "—";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toString();
  }

  const hasAllocation = !!(stats.salesBasis && stats.volumeBasis);
  const activeBasis = hasAllocation ? (allocationBasis === "sales" ? stats.salesBasis : stats.volumeBasis) : null;

  // --- CLIENT-SIDE SANDBOX COSTING ENGINE ---
  const dynamicSellThrough = sellThroughOverride / 100.0;
  const dynamicRetailerCommPct = retailerCommOverride / 100.0;
  const dynamicPrintRunScale = printRunScale;
  const dynamicReturnRateOffsetPct = returnRateOffset / 100.0;

  const originalDrawSales = hasAllocation ? activeBasis.summary.totalDrawSales : 0;
  const originalContracts = hasAllocation ? activeBasis.contracts : [];
  const originalTotalCentralOverhead = hasAllocation ? activeBasis.summary.totalCentralOverhead : 0;

  let dynamicTotalInstantSales = 0;
  let dynamicTotalInstantUnits = 0;
  let dynamicTotalInstantPrizeExpense = 0;
  let dynamicTotalInstantRetailerComm = 0;
  let dynamicTotalInstantPrintingCost = 0;

  const gameEnrichmentMap = new Map();
  if (hasAllocation) {
    activeBasis.games.forEach(g => {
      gameEnrichmentMap.set(g.id, g);
    });
  }

  const dynamicGames = (games || []).map(g => {
    const originalEnrichment = gameEnrichmentMap.get(g.id);
    const originalUnits = Number(g.units);
    const scaledUnits = originalUnits * dynamicPrintRunScale;
    const denom = Number(g.denomination);
    const payout = parseFloat(g.payoutPercent) / 100.0;
    const originalReturnRate = parseFloat(g.projectedReturnRate || 0) / 100.0;
    const scaledReturnRate = Math.max(0, Math.min(1.0, originalReturnRate + dynamicReturnRateOffsetPct));

    const grossSales = scaledUnits * denom * dynamicSellThrough * (1 - scaledReturnRate);
    const prizeExpense = grossSales * payout;
    const retailerCommission = grossSales * dynamicRetailerCommPct;

    let printingCost = 0;
    if (g.budgetStatus !== 'already_booked') {
      if (originalEnrichment) {
        printingCost = originalEnrichment.printingCost * dynamicPrintRunScale;
      } else {
        printingCost = scaledUnits * 0.022;
      }
    }

    dynamicTotalInstantSales += grossSales;
    dynamicTotalInstantUnits += scaledUnits;
    dynamicTotalInstantPrizeExpense += prizeExpense;
    dynamicTotalInstantRetailerComm += retailerCommission;
    dynamicTotalInstantPrintingCost += printingCost;

    return {
      ...g,
      units: scaledUnits,
      grossSales,
      prizeExpense,
      retailerCommission,
      printingCost,
    };
  });

  const dynamicTotalLotterySales = dynamicTotalInstantSales + originalDrawSales;
  const dynamicInstantShareFraction = dynamicTotalLotterySales > 0 ? (dynamicTotalInstantSales / dynamicTotalLotterySales) : 0;
  const dynamicInstantTicketShareOfCentralOverhead = originalTotalCentralOverhead * dynamicInstantShareFraction;

  const dynamicAllocatedGames = dynamicGames.map(g => {
    let allocatedOverhead = 0;
    if (hasAllocation) {
      if (allocationBasis === "sales") {
        const salesFraction = dynamicTotalInstantSales > 0 ? (g.grossSales / dynamicTotalInstantSales) : 0;
        allocatedOverhead = dynamicInstantTicketShareOfCentralOverhead * salesFraction;
      } else {
        const unitsFraction = dynamicTotalInstantUnits > 0 ? (g.units / dynamicTotalInstantUnits) : 0;
        allocatedOverhead = dynamicInstantTicketShareOfCentralOverhead * unitsFraction;
      }
    }
    const fullyLoadedCost = g.prizeExpense + g.retailerCommission + g.printingCost + allocatedOverhead;
    const fullyLoadedProfit = g.grossSales - fullyLoadedCost;
    const fullyLoadedMargin = g.grossSales > 0 ? (fullyLoadedProfit / g.grossSales) * 100 : 0;

    return {
      ...g,
      allocatedOverhead,
      fullyLoadedCost,
      fullyLoadedProfit,
      fullyLoadedMargin,
    };
  });

  // --- SYSTEM DATE BASIS FOR LIFECYCLE ---
  const systemToday = new Date();
  systemToday.setHours(0, 0, 0, 0);

  // 1. Actively Available: launchDate <= today and (closeDate > today or !closeDate) and status != cancelled/ended
  const activelyAvailableCount = (dynamicAllocatedGames || []).filter(g => {
    if (!g.launchDate) return false;
    const launch = new Date(g.launchDate);
    const close = g.closeDate ? new Date(g.closeDate) : null;
    const status = (g.deliveryStatus || "").toLowerCase();
    return launch <= systemToday && 
           (!close || close > systemToday) && 
           status !== "cancelled" && 
           status !== "ended" && 
           status !== "closed";
  }).length;

  // 2. In Pipeline (Ordered/Delivered but not yet launched): status is ordered/delivered/received/in_production/shipped and (launchDate > today or !launchDate)
  const pipelineCount = (dynamicAllocatedGames || []).filter(g => {
    const status = (g.deliveryStatus || "").toLowerCase();
    const isPipelineStatus = ["ordered", "delivered", "received", "in_production", "shipped"].includes(status);
    if (!isPipelineStatus) return false;
    if (!g.launchDate) return true;
    const launch = new Date(g.launchDate);
    return launch > systemToday;
  }).length;

  // 3. Future Scheduled (Planned): launchDate > today, status is planned
  const futurePlannedCount = (dynamicAllocatedGames || []).filter(g => {
    const status = (g.deliveryStatus || "").toLowerCase();
    if (status !== "planned") return false;
    if (!g.launchDate) return false;
    const launch = new Date(g.launchDate);
    return launch > systemToday;
  }).length;

  // 4. Unscheduled Backlog: launchDate is null, status is planned/cancelled/etc. (not in pipeline status)
  const unscheduledCount = (dynamicAllocatedGames || []).filter(g => {
    if (g.launchDate) return false;
    const status = (g.deliveryStatus || "").toLowerCase();
    const isPipelineStatus = ["ordered", "delivered", "received", "in_production", "shipped"].includes(status);
    return !isPipelineStatus;
  }).length;

  // 5. Ended / Closed: closeDate <= today or status is ended/closed
  const endedCount = (dynamicAllocatedGames || []).filter(g => {
    const status = (g.deliveryStatus || "").toLowerCase();
    if (status === "ended" || status === "closed") return true;
    if (!g.launchDate || !g.closeDate) return false;
    const close = new Date(g.closeDate);
    return close <= systemToday;
  }).length;

  const dynamicContracts = originalContracts.map(c => {
    const allocatedToInstant = c.annualCost * dynamicInstantShareFraction;
    return {
      ...c,
      allocatedToInstant,
    };
  });

  const dynamicGamesByDenom = {};
  dynamicAllocatedGames.forEach(g => {
    if (!dynamicGamesByDenom[g.denomination]) {
      dynamicGamesByDenom[g.denomination] = [];
    }
    dynamicGamesByDenom[g.denomination].push(g);
  });

  const dynamicVendorAlloc = {};
  dynamicAllocatedGames.forEach(g => {
    const vName = g.vendor?.name || "Unassigned";
    if (!dynamicVendorAlloc[vName]) {
      dynamicVendorAlloc[vName] = { games: 0, units: 0, revenue: 0 };
    }
    dynamicVendorAlloc[vName].games++;
    dynamicVendorAlloc[vName].units += g.units;
    dynamicVendorAlloc[vName].revenue += g.grossSales;
  });

  const dynamicPipeline = { planned: 0, ordered: 0, in_production: 0, shipped: 0, received: 0 };
  dynamicAllocatedGames.forEach(g => {
    if (dynamicPipeline[g.deliveryStatus] !== undefined) {
      dynamicPipeline[g.deliveryStatus]++;
    }
  });

  const dynamicScheduledGames = (dynamicAllocatedGames || [])
    .filter(g => g.launchDate)
    .sort((a, b) => {
      const denomA = Number(a.denomination);
      const denomB = Number(b.denomination);
      if (denomB !== denomA) return denomB - denomA;
      return new Date(a.launchDate) - new Date(b.launchDate);
    });

  const isSandboxActive = 
    sellThroughOverride !== parseFloat(plan.sellThroughPct) ||
    retailerCommOverride !== parseFloat(plan.retailerCommPct) ||
    printRunScale !== 1.0 ||
    returnRateOffset !== 0.0;

  const dynamicWeightedPayout = dynamicTotalInstantSales > 0 ? (dynamicTotalInstantPrizeExpense / dynamicTotalInstantSales) * 100 : 0;


  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/instant-tickets" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>← Back to Plans</Link>
        </div>
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>{plan.name}</h2>
            <p>
              {plan.jurisdiction.name} · FY{plan.fiscalYear} · {games.length} games · {plan.scenarios.length} scenario{plan.scenarios.length !== 1 ? "s" : ""}
              {" · "}
              <span className={`badge ${plan.status === "approved" ? "badge-active" : "badge-submitted"}`}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </span>
              {" · "}
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                Active: <strong style={{ color: "var(--text)" }}>{activelyAvailableCount}</strong> · Pipeline: <strong style={{ color: "var(--text)" }}>{pipelineCount}</strong>
              </span>
            </p>
          </div>
          <div>
            {plan.status === "approved" ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => handleUpdateStatus("draft")}
                disabled={saving}
              >
                Revoke Approval / Mark as Draft
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={() => handleUpdateStatus("approved")}
                disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <CheckCircle2 size={14} /> Approve Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--border)", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "0" }}>
          {[
            { key: "editor", label: "Edit Plan", icon: <FileText size={14} /> },
            { key: "scheduler", label: "Waves & Quarterly Scheduler", icon: <Calendar size={14} /> },
            { key: "summary", label: "Summary", icon: <BarChart4 size={14} /> },
            { key: "planogram", label: "Retail Planogram", icon: <Layers size={14} /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: "10px 24px",
                background: tab === t.key ? "var(--card-bg)" : "transparent",
                color: tab === t.key ? "var(--blue)" : "var(--text-muted)",
                border: "none",
                borderBottom: tab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
                marginBottom: "-2px",
                cursor: "pointer",
                fontWeight: tab === t.key ? 600 : 400,
                fontSize: "14px",
                transition: "all 0.2s ease",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* User layout customization controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingRight: "8px" }} className="no-print">
          <button
            onClick={handlePinPreferences}
            title="Pin current tab, timeline grouping, and dispenser profile as your default view"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 600,
              background: "rgba(59, 130, 246, 0.08)",
              color: "var(--blue)",
              border: "1px solid rgba(59, 130, 246, 0.15)",
              borderRadius: "4px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)";
            }}
          >
            <Pin size={12} style={{ transform: "rotate(45deg)" }} />
            Pin View
          </button>
          <button
            onClick={handleResetPreferences}
            title="Reset your view preferences to system defaults"
            style={{
              padding: "4px 8px",
              fontSize: "11px",
              fontWeight: 600,
              background: "rgba(255, 255, 255, 0.03)",
              color: "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: "4px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
            }}
          >
            <RotateCcw size={12} />
            Reset View
          </button>
        </div>
      </div>

      {/* Editor Tab — Embedded Planner */}
      {tab === "editor" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <iframe
            src={`/planner.html?id=${plan.id}&v=1.0.2`}
            style={{
              width: "100%",
              height: "calc(100vh - 200px)",
              border: "none",
              borderRadius: "8px",
              background: "#fff",
            }}
            title="Instant Ticket Planner"
          />
        </div>
      )}

      {/* Scheduler Tab */}
      {tab === "scheduler" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {(() => {
            const quarters = {
              q1: { name: "Q1 (Jul - Sep)", games: [], units: 0, sales: 0, totalPayout: 0 },
              q2: { name: "Q2 (Oct - Dec)", games: [], units: 0, sales: 0, totalPayout: 0 },
              q3: { name: "Q3 (Jan - Mar)", games: [], units: 0, sales: 0, totalPayout: 0 },
              q4: { name: "Q4 (Apr - Jun)", games: [], units: 0, sales: 0, totalPayout: 0 },
              unscheduled: { name: "Strategic Backlog (Unscheduled)", games: [], units: 0, sales: 0, totalPayout: 0 }
            };

            games.forEach(g => {
              const rr = parseFloat(g.projectedReturnRate || 0) / 100.0;
              const sales = Number(g.units) * Number(g.denomination) * (parseFloat(plan.sellThroughPct) / 100.0) * (1 - rr);
              
              let qKey = "unscheduled";
              if (g.launchDate) {
                const date = new Date(g.launchDate);
                const month = date.getMonth();
                if (month >= 6 && month <= 8) qKey = "q1";
                else if (month >= 9 && month <= 11) qKey = "q2";
                else if (month === 0 || month === 1 || month === 2) qKey = "q3";
                else if (month >= 3 && month <= 5) qKey = "q4";
              }

              quarters[qKey].games.push({ ...g, calculatedSales: sales });
              quarters[qKey].units += Number(g.units);
              quarters[qKey].sales += sales;
              quarters[qKey].totalPayout += parseFloat(g.payoutPercent || 0);
            });

            const handleGameFieldChange = async (gameId, field, val) => {
              try {
                const res = await fetch(`/api/instant-tickets/games/${gameId}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ [field]: val })
                });
                if (!res.ok) {
                  const errorData = await res.json().catch(() => ({}));
                  const msg = errorData.details 
                    ? `${errorData.error}: ${errorData.details}` 
                    : (errorData.error || `Failed to update game (Status ${res.status})`);
                  throw new Error(msg);
                }
                router.refresh();
              } catch (err) {
                alert("❌ " + err.message);
              }
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
                {Object.entries(quarters).map(([qKey, q]) => {
                  const avgPayout = q.games.length > 0 ? (q.totalPayout / q.games.length).toFixed(1) : "0.0";
                  const isCollapsed = collapsedQuarters[qKey];
                  
                  return (
                    <div key={qKey} className="card" style={{ padding: "20px", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                      <div 
                        onClick={() => setCollapsedQuarters(prev => ({ ...prev, [qKey]: !prev[qKey] }))}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: isCollapsed ? "none" : "1px solid var(--border)", paddingBottom: isCollapsed ? "0" : "12px", marginBottom: isCollapsed ? "0" : "16px", flexWrap: "wrap", gap: "12px", cursor: "pointer", userSelect: "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {isCollapsed ? <ChevronRight size={16} style={{ color: "var(--blue)" }} /> : <ChevronDown size={16} style={{ color: "var(--blue)" }} />}
                          <h3 style={{ margin: 0, fontSize: "16px", color: "var(--blue)" }}>{q.name}</h3>
                        </div>
                        <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-muted)", fontWeight: 500 }} onClick={(e) => e.stopPropagation()}>
                          <span>Games: <strong style={{ color: "var(--text)" }}>{q.games.length}</strong></span>
                          <span>Units: <strong style={{ color: "var(--text)" }}>{fmtUnits(q.units)}</strong></span>
                          <span>Est. Sales: <strong style={{ color: "var(--text)" }}>{fmt$(q.sales)}</strong></span>
                          {q.games.length > 0 && <span>Avg Payout: <strong style={{ color: "var(--text)" }}>{avgPayout}%</strong></span>}
                        </div>
                      </div>

                      {!isCollapsed && (
                        q.games.length === 0 ? (
                          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                            No games scheduled for this period.
                          </div>
                        ) : (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "16px" }}>
                            {q.games.map(g => {
                              const isReorder = g.isReorder;
                              const statusColor = STATUS_COLORS[g.deliveryStatus.toLowerCase()] || "#6b7280";

                              return (
                                <div key={g.id} style={{ border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface-2)", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "340px" }}>
                                  
                                  {/* Ticket Visual Area */}
                                  <div style={{ height: "110px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderBottom: "1px solid var(--border)", ...getTicketBgStyle(g.imageUrl) }}>
                                    <div style={{ position: "absolute", top: "8px", left: "8px", background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(4px)", padding: "2px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 700, color: "#fff" }}>
                                      ${g.denomination}
                                    </div>
                                    <div style={{ position: "absolute", top: "8px", right: "8px", background: statusColor + "33", border: `1px solid ${statusColor}`, color: statusColor, padding: "1px 6px", borderRadius: "3px", fontSize: "10px", fontWeight: 700, textTransform: "uppercase" }}>
                                      {g.deliveryStatus}
                                    </div>
                                    {!g.imageUrl && (
                                      <div style={{ color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>No visual ticket plan</div>
                                    )}
                                    {g.imageUrl && PRELOADED_TICKETS.some(t => t.id === g.imageUrl) && (
                                      <div style={{ color: "#fff", fontWeight: 700, textShadow: "0 1px 3px rgba(0,0,0,0.6)", fontSize: "13px" }}>
                                        {PRELOADED_TICKETS.find(t => t.id === g.imageUrl).name.split(" ($")[0]}
                                      </div>
                                    )}
                                  </div>

                                  {/* Content Area */}
                                  <div style={{ padding: "12px", flexGrow: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                    <div>
                                      <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={g.name}>
                                        {g.name}
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                                        <span>Game #{g.gameNumber}</span>
                                        <span>Launch: {g.launchDate ? new Date(g.launchDate).toLocaleDateString() : "TBD"}</span>
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                        <span>Units: {fmtUnits(g.units)}</span>
                                        <span>Sales: {fmt$(g.calculatedSales)}</span>
                                      </div>
                                    </div>

                                    {/* Controls */}
                                    <div style={{ marginTop: "8px", borderTop: "1px solid var(--border)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                        <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>Release Month:</label>
                                        <select 
                                          value={g.launchDate ? g.launchDate.substring(5, 7) : ""} 
                                          onChange={(e) => {
                                            const monthVal = e.target.value;
                                            let newLaunchDate = null;
                                            if (monthVal) {
                                              const monthNum = parseInt(monthVal, 10);
                                              const year = monthNum >= 7 ? (plan.fiscalYear - 1) : plan.fiscalYear;
                                              newLaunchDate = `${year}-${monthVal}-01`;
                                            }
                                            handleGameFieldChange(g.id, "launchDate", newLaunchDate);
                                          }}
                                          style={{ fontSize: "11px", padding: "2px 6px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "100px" }}
                                        >
                                          <option value="">Unscheduled</option>
                                          <option value="07">July</option>
                                          <option value="08">August</option>
                                          <option value="09">September</option>
                                          <option value="10">October</option>
                                          <option value="11">November</option>
                                          <option value="12">December</option>
                                          <option value="01">January</option>
                                          <option value="02">February</option>
                                          <option value="03">March</option>
                                          <option value="04">April</option>
                                          <option value="05">May</option>
                                          <option value="06">June</option>
                                        </select>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                        <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>Procurement:</label>
                                        <select 
                                          value={g.deliveryStatus.toLowerCase()} 
                                          onChange={(e) => handleGameFieldChange(g.id, "deliveryStatus", e.target.value)}
                                          style={{ fontSize: "11px", padding: "2px 6px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "100px" }}
                                        >
                                          <option value="planned">Planned</option>
                                          <option value="ordered">Ordered</option>
                                          <option value="delivered">Delivered</option>
                                          <option value="cancelled">Cancelled</option>
                                        </select>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>Reorder Run:</span>
                                        <input 
                                          type="checkbox" 
                                          checked={!!isReorder} 
                                          onChange={(e) => handleGameFieldChange(g.id, "isReorder", e.target.checked)}
                                          style={{ cursor: "pointer" }}
                                        />
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                        <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>Est. Duration:</label>
                                        <select
                                          value={getSalesDuration(g)}
                                          onChange={async (e) => {
                                            const duration = parseInt(e.target.value, 10);
                                            const launch = g.launchDate ? new Date(g.launchDate) : new Date();
                                            const close = new Date(launch);
                                            close.setMonth(launch.getMonth() + duration);
                                            
                                            // Date validation: close date cannot be before today
                                            const today = new Date();
                                            today.setHours(0, 0, 0, 0);
                                            if (close < today) {
                                              const formattedToday = today.toLocaleDateString();
                                              alert(`⚠️ Warning: Pushing close date to today's date (${formattedToday}) to prevent setting a historical close date.`);
                                              close.setTime(today.getTime());
                                            }
                                            
                                            const closeStr = close.toISOString().split('T')[0];
                                            handleGameFieldChange(g.id, "closeDate", closeStr);
                                          }}
                                          style={{ fontSize: "11px", padding: "2px 6px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "100px" }}
                                        >
                                          <option value={3}>3 Months</option>
                                          <option value={4}>4 Months</option>
                                          <option value={6}>6 Months</option>
                                          <option value={9}>9 Months</option>
                                          <option value={12}>12 Months</option>
                                          <option value={18}>18 Months</option>
                                          <option value={24}>24 Months</option>
                                        </select>
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                                        <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 500 }}>Ticket Visual:</label>
                                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                          <select 
                                            value={PRELOADED_TICKETS.some(t => t.id === g.imageUrl) ? g.imageUrl : (g.imageUrl ? "custom" : "")} 
                                            onChange={async (e) => {
                                              const val = e.target.value;
                                              if (val === "custom") {
                                                document.getElementById(`file-upload-${g.id}`).click();
                                              } else {
                                                handleGameFieldChange(g.id, "imageUrl", val || null);
                                              }
                                            }}
                                            style={{ fontSize: "11px", padding: "2px 6px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "100px" }}
                                          >
                                            <option value="">No Theme</option>
                                            <optgroup label="Preloaded Themes">
                                              {PRELOADED_TICKETS.map(t => (
                                                <option key={t.id} value={t.id}>{t.name.split(" ($")[0]}</option>
                                              ))}
                                            </optgroup>
                                            <option value="custom">+ Upload Custom...</option>
                                          </select>
                                          <input 
                                            id={`file-upload-${g.id}`}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              const formData = new FormData();
                                              formData.append("file", file);
                                              try {
                                                const uploadRes = await fetch("/api/instant-tickets/upload-image", {
                                                  method: "POST",
                                                  body: formData
                                                });
                                                if (!uploadRes.ok) throw new Error("Upload failed");
                                                const data = await uploadRes.json();
                                                if (data.url) {
                                                  handleGameFieldChange(g.id, "imageUrl", data.url);
                                                }
                                              } catch (err) {
                                                alert("Image upload failed: " + err.message);
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}

              </div>
            );
          })()}
        </div>
      )}

      {/* Summary Tab — Read-Only Overview */}
      {tab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* "What-If" Sandbox Modeler Card */}
          <div 
            className="card" 
            style={{ 
              padding: "20px", 
              background: "rgba(13, 148, 136, 0.03)", 
              border: isSandboxActive ? "2px solid #0d9488" : "1px solid rgba(13, 148, 136, 0.3)",
              borderRadius: "8px",
              boxShadow: isSandboxActive ? "0 4px 20px rgba(13, 148, 136, 0.15)" : "none",
              transition: "all 0.3s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Settings2 size={20} style={{ color: "#0d9488" }} />
                  <h3 style={{ margin: 0, fontSize: "18px", color: "#0d9488", fontWeight: 700 }}>"What-If" Sandbox Modeler</h3>
                  {isSandboxActive && (
                    <span style={{ fontSize: "11px", fontWeight: "700", background: "#0d9488", color: "#fff", padding: "2px 8px", borderRadius: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Active Sandbox
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  Simulate adjustments to sell-through, commissions, print run scaling, and returns in real-time to analyze margin impact.
                </p>
              </div>

              {isSandboxActive && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleResetSandbox}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid rgba(13, 148, 136, 0.5)",
                      background: "transparent",
                      color: "#0d9488",
                      transition: "all 0.2s"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(13, 148, 136, 0.08)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                  >
                    Reset to Base Plan
                  </button>
                  <button
                    onClick={handleSaveSandbox}
                    disabled={saving}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      background: "#0d9488",
                      color: "#fff",
                      transition: "all 0.2s",
                      boxShadow: "0 2px 4px rgba(13, 148, 136, 0.3)"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#0f766e"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#0d9488"; }}
                  >
                    {saving ? "Saving..." : "Save to Database"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
              {/* Sell-Through Rate Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Sell-Through Rate</label>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
                    {sellThroughOverride.toFixed(0)}%
                    {sellThroughOverride !== parseFloat(plan.sellThroughPct) && (
                      <span style={{ fontSize: "10px", fontWeight: "normal", color: "var(--text-muted)", marginLeft: "4px" }}>
                        (Base: {parseFloat(plan.sellThroughPct).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="100" 
                  step="1"
                  value={sellThroughOverride} 
                  onChange={(e) => setSellThroughOverride(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0d9488", cursor: "pointer" }}
                />
              </div>

              {/* Retailer Commission Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Retailer Commission</label>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
                    {retailerCommOverride.toFixed(1)}%
                    {retailerCommOverride !== parseFloat(plan.retailerCommPct) && (
                      <span style={{ fontSize: "10px", fontWeight: "normal", color: "var(--text-muted)", marginLeft: "4px" }}>
                        (Base: {parseFloat(plan.retailerCommPct).toFixed(1)}%)
                      </span>
                    )}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="0.1"
                  value={retailerCommOverride} 
                  onChange={(e) => setRetailerCommOverride(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0d9488", cursor: "pointer" }}
                />
              </div>

              {/* Print Run Volume Scale Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Print Run Scaling</label>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
                    {printRunScale.toFixed(2)}x
                    {printRunScale !== 1.0 && (
                      <span style={{ fontSize: "10px", fontWeight: "normal", color: printRunScale > 1.0 ? "#15803d" : "#b91c1c", marginLeft: "4px" }}>
                        ({printRunScale > 1.0 ? "+" : ""}{((printRunScale - 1.0) * 100).toFixed(0)}%)
                      </span>
                    )}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="0.5" 
                  max="1.5" 
                  step="0.05"
                  value={printRunScale} 
                  onChange={(e) => setPrintRunScale(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0d9488", cursor: "pointer" }}
                />
              </div>

              {/* Return Rate Offset Slider */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)" }}>Return Rate Offset</label>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0d9488" }}>
                    {returnRateOffset > 0 ? "+" : ""}{returnRateOffset.toFixed(0)}%
                    {returnRateOffset !== 0 && (
                      <span style={{ fontSize: "10px", fontWeight: "normal", color: "var(--text-muted)", marginLeft: "4px" }}>
                        (Base: 0% shift)
                      </span>
                    )}
                  </span>
                </div>
                <input 
                  type="range" 
                  min="-15" 
                  max="15" 
                  step="1"
                  value={returnRateOffset} 
                  onChange={(e) => setReturnRateOffset(parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0d9488", cursor: "pointer" }}
                />
              </div>
            </div>
          </div>

          {/* Allocation Basis Controls */}
          {hasAllocation && (
            <div className="card" style={{ padding: "16px", background: "var(--card-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Settings2 size={18} style={{ color: "var(--blue)" }} />
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Shared Expense Allocation Rules</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setAllocationBasis("sales")}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: allocationBasis === "sales" ? "var(--blue)" : "var(--surface-3)",
                      color: allocationBasis === "sales" ? "#fff" : "var(--text-muted)",
                      transition: "all 0.2s"
                    }}
                  >
                    Allocate by Gross Sales
                  </button>
                  <button
                    onClick={() => setAllocationBasis("volume")}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: allocationBasis === "volume" ? "var(--blue)" : "var(--surface-3)",
                      color: allocationBasis === "volume" ? "#fff" : "var(--text-muted)",
                      transition: "all 0.2s"
                    }}
                  >
                    Allocate by Ticket Volume (Units)
                  </button>
                </div>
              </div>
              <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <Info size={16} style={{ color: "var(--blue)", flexShrink: 0, marginTop: "2px" }} />
                <span>
                  {allocationBasis === "sales" 
                    ? "Central overhead contracts are divided proportionally between Instant Tickets and Draw Games based on total projected gross sales, then allocated to individual scratcher games based on their share of gross sales." 
                    : "Central overhead contracts are divided proportionally between Instant Tickets and Draw Games based on total projected gross sales, then allocated to individual scratcher games based on their share of printed ticket units."
                  }
                </span>
              </div>
            </div>
          )}

          {/* KPI Row */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Projected Scratcher Sales</div>
              <div className="kpi-value">{fmt$(dynamicTotalInstantSales)}</div>
              <div className="kpi-subtitle">
                {fmtUnits(dynamicTotalInstantUnits)} printed units
              </div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Product Availability</div>
              <div className="kpi-value">{activelyAvailableCount} Active</div>
              <div className="kpi-subtitle">
                {pipelineCount} in pipeline (not selling yet)
              </div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Weighted Payout</div>
              <div className="kpi-value">{dynamicWeightedPayout.toFixed(1)}%</div>
              <div className="kpi-subtitle">Prize expense: {fmt$(dynamicTotalInstantPrizeExpense)}</div>
            </div>
            
            {/* Fully Loaded Profitability KPI */}
            {hasAllocation ? (
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Fully Loaded Net Margin</div>
                <div className="kpi-value">
                  {(() => {
                    const sales = dynamicTotalInstantSales;
                    const prizes = dynamicTotalInstantPrizeExpense;
                    const comm = dynamicTotalInstantRetailerComm;
                    const print = dynamicTotalInstantPrintingCost;
                    const overhead = dynamicInstantTicketShareOfCentralOverhead;
                    const loadedProfit = sales - prizes - comm - print - overhead;
                    const loadedMargin = sales > 0 ? (loadedProfit / sales) * 100 : 0;
                    return `${loadedMargin.toFixed(1)}%`;
                  })()}
                </div>
                <div className="kpi-subtitle">
                  Net Loaded Profit: {(() => {
                    const sales = dynamicTotalInstantSales;
                    const prizes = dynamicTotalInstantPrizeExpense;
                    const comm = dynamicTotalInstantRetailerComm;
                    const print = dynamicTotalInstantPrintingCost;
                    const overhead = dynamicInstantTicketShareOfCentralOverhead;
                    const loadedProfit = sales - prizes - comm - print - overhead;
                    return fmt$(loadedProfit);
                  })()}
                </div>
              </div>
            ) : (
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Net Contribution</div>
                <div className="kpi-value">{fmt$(dynamicTotalInstantSales - dynamicTotalInstantPrizeExpense)}</div>
                <div className="kpi-subtitle">Before commissions & admin</div>
              </div>
            )}

            <div className="kpi-card" style={{ borderLeft: "4px solid #ef4444" }}>
              <div className="kpi-label">Direct Marketing Spend</div>
              <div className="kpi-value">{fmt$(totalMarketingCost)}</div>
              <div className="kpi-subtitle">{marketingItems.length} line items</div>
            </div>
          </div>

          {/* Fiscal Release & Lifespan Timeline */}
          <div className="card" style={{ padding: "20px", background: "var(--card-bg)" }}>
            <div 
              onClick={() => setCollapseGantt(!collapseGantt)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: collapseGantt ? "none" : "1px solid var(--border)", paddingBottom: collapseGantt ? "0" : "12px", marginBottom: collapseGantt ? "0" : "16px", cursor: "pointer", userSelect: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {collapseGantt ? <ChevronRight size={16} style={{ color: "var(--blue)" }} /> : <ChevronDown size={16} style={{ color: "var(--blue)" }} />}
                <Calendar size={18} style={{ color: "var(--blue)" }} />
                <h3 style={{ margin: 0, fontSize: "16px" }}>Fiscal Release & Lifespan Timeline</h3>
              </div>
              
              {!collapseGantt && (
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }} onClick={e => e.stopPropagation()} className="no-print">
                  {/* Group By selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>Group By:</span>
                    <button
                      onClick={() => setGanttGroupBy("denomination")}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid var(--border)",
                        background: ganttGroupBy === "denomination" ? "var(--blue)" : "var(--surface-3)",
                        color: ganttGroupBy === "denomination" ? "#fff" : "var(--text-muted)",
                        transition: "all 0.1s"
                      }}
                    >
                      Price Tier
                    </button>
                    <button
                      onClick={() => setGanttGroupBy("month")}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        border: "1px solid var(--border)",
                        background: ganttGroupBy === "month" ? "var(--blue)" : "var(--surface-3)",
                        color: ganttGroupBy === "month" ? "#fff" : "var(--text-muted)",
                        transition: "all 0.1s"
                      }}
                    >
                      Launch Month
                    </button>
                  </div>

                  {/* Print Button */}
                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: "3px 10px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: "var(--surface-3)",
                      color: "var(--text)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    Print Report
                  </button>

                  <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", gap: "10px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981" }} /> Delivered</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6" }} /> Ordered</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b" }} /> Planned</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#ef4444" }} /> Cancelled</span>
                  </div>
                </div>
              )}
            </div>

            {!collapseGantt && (
              <>
                {dynamicScheduledGames.length === 0 ? (
                  <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic" }}>
                    No games have been scheduled yet with a launch date. Go to the "Waves & Quarterly Scheduler" to set launch dates.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowX: "auto" }}>
                    {/* Timeline Header */}
                    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: "16px", minWidth: "800px", borderBottom: "2px solid var(--border)", paddingBottom: "8px", fontWeight: "600", fontSize: "12px", color: "var(--text-muted)" }}>
                      <div>Game Details</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", textAlign: "center" }}>
                        {["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"].map(m => (
                          <div key={m}>{m}</div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline Rows */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "800px", maxHeight: "450px", overflowY: "auto", paddingRight: "4px" }}>
                      {ganttGroupBy === "denomination" ? (
                        dynamicScheduledGames.map(g => renderGanttRow(g))
                      ) : (
                        ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"].map((mName, mIdx) => {
                          const monthGames = dynamicScheduledGames.filter(g => getFiscalMonthIndex(g.launchDate) === mIdx);
                          if (monthGames.length === 0) return null;
                          const qProps = (() => {
                            if (mIdx >= 0 && mIdx <= 2) return { name: "Q1", border: "#3b82f6", bg: "rgba(59, 130, 246, 0.04)", text: "var(--blue)" };
                            if (mIdx >= 3 && mIdx <= 5) return { name: "Q2", border: "#f59e0b", bg: "rgba(245, 158, 11, 0.04)", text: "#f59e0b" };
                            if (mIdx >= 6 && mIdx <= 8) return { name: "Q3", border: "#10b981", bg: "rgba(16, 185, 129, 0.04)", text: "#10b981" };
                            return { name: "Q4", border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.04)", text: "#8b5cf6" };
                          })();

                          return (
                            <div key={mName} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr", background: qProps.bg, borderLeft: `4px solid ${qProps.border}`, padding: "6px 12px", marginTop: "8px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", color: qProps.text, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                {mName} Releases ({qProps.name})
                              </div>
                              {monthGames.map(g => renderGanttRow(g))}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {unscheduledCount > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "6px", padding: "10px 16px", marginTop: "16px", fontSize: "13px", color: "#f59e0b" }} className="no-print">
                    <Info size={16} style={{ flexShrink: 0 }} />
                    <span>
                      <strong>{unscheduledCount} backlog game{unscheduledCount !== 1 ? 's' : ''}</strong> {unscheduledCount === 1 ? 'is' : 'are'} unscheduled. Assign a release month in the <strong>Waves & Quarterly Scheduler</strong> tab to show {unscheduledCount === 1 ? 'it' : 'them'} on the timeline.
                    </span>
                  </div>
                )}
              </>
            )}
          </div>


          {/* Allocation Breakdown and Method Math */}

          {hasAllocation && (
            <div className="card no-print" style={{ background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
              <div 
                onClick={() => setCollapseOverhead(!collapseOverhead)}
                style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--card-bg)", padding: "16px 20px", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer", userSelect: "none", marginBottom: collapseOverhead ? "0" : "16px" }}
              >
                {collapseOverhead ? <ChevronRight size={16} style={{ color: "var(--blue)" }} /> : <ChevronDown size={16} style={{ color: "var(--blue)" }} />}
                <h3 style={{ margin: 0, fontSize: "16px" }}>Central Operations Overhead Contracts & Allocations</h3>
              </div>
              
              {!collapseOverhead && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
                  
                  {/* Central Overhead Contracts List */}
                  <div className="card" style={{ margin: 0 }}>
                    <div className="card-header">
                      <h3>Central Operations Overhead Contracts</h3>
                    </div>
                    <div className="card-body">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Contract Title</th>
                            <th>Type</th>
                            <th style={{ textAlign: "right" }}>Annual Value</th>
                            <th style={{ textAlign: "right" }}>Allocated to Scratchers</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dynamicContracts.map((c) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 500, fontSize: "13px" }}>{c.title}</td>
                              <td className="muted" style={{ textTransform: "capitalize", fontSize: "12px" }}>
                                {c.type.replace(/_/g, " ")}
                              </td>
                              <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt$(c.annualCost)}</td>
                              <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--blue)", fontWeight: 600 }}>
                                {fmt$(c.allocatedToInstant)}
                              </td>
                            </tr>
                          ))}
                          <tr style={{ borderTop: "2px solid var(--border)", fontWeight: "bold" }}>
                            <td>Total Central Overhead</td>
                            <td></td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                              {fmt$(originalTotalCentralOverhead)}
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--blue)" }}>
                              {fmt$(dynamicInstantTicketShareOfCentralOverhead)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Allocation Formula Explainer */}
                  <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", margin: 0 }}>
                    <div className="card-header">
                      <h3>Proportional Share Formula</h3>
                    </div>
                    <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                      <div style={{ padding: "12px", background: "var(--surface-3)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>Step 1: Game Type Split</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Projected Scratcher Sales:</span>
                          <span style={{ fontWeight: 600 }}>{fmt$(dynamicTotalInstantSales)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>Projected Draw Sales:</span>
                          <span style={{ fontWeight: 600 }}>{fmt$(originalDrawSales)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "4px", marginTop: "4px", fontWeight: "bold" }}>
                          <span>Total Lottery Sales:</span>
                          <span>{fmt$(dynamicTotalLotterySales)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--blue)", fontWeight: 600, marginTop: "6px" }}>
                          <span>Scratcher Ratio:</span>
                          <span>{(dynamicInstantShareFraction * 100).toFixed(1)}%</span>
                        </div>
                      </div>

                      <div style={{ padding: "12px", background: "var(--surface-3)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>Step 2: Scratcher Cost Allocation</div>
                        <div>
                          <span>Scratcher Share of Overhead:</span>
                          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--blue)", marginTop: "4px" }}>
                            {fmt$(dynamicInstantTicketShareOfCentralOverhead)}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                            ({(dynamicInstantShareFraction * 100).toFixed(1)}% of {fmt$(originalTotalCentralOverhead)} total central overhead)
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
          )}
                  {/* Three-column: Vendor Allocation + Pipeline + Product Availability & Lifecycles */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <div className="card">
              <div className="card-header"><h3>Vendor Allocation</h3></div>
              <div className="card-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Games</th>
                      <th>Units</th>
                      <th>Revenue</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dynamicVendorAlloc).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, data]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 500 }}>{name}</td>
                        <td>{data.games}</td>
                        <td>{fmtUnits(data.units)}</td>
                        <td>{fmt$(data.revenue)}</td>
                        <td>{((data.revenue / dynamicTotalInstantSales) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Delivery Pipeline</h3></div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {Object.entries(dynamicPipeline).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "120px", textTransform: "capitalize", fontSize: "13px", color: "var(--text-muted)" }}>{status.replace(/_/g, " ")}</div>
                      <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "4px", height: "24px", overflow: "hidden" }}>
                        <div style={{ width: `${dynamicGames.length > 0 ? (count / dynamicGames.length) * 100 : 0}%`, height: "100%", background: STATUS_COLORS[status], borderRadius: "4px", minWidth: count > 0 ? "24px" : "0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff" }}>
                           {count > 0 ? count : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Product Availability &amp; Lifecycles</h3></div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>Currently On Sale</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--green)" }}>{activelyAvailableCount} Games</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>Pipeline (Ordered &amp; Delivered)</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--blue)" }}>{pipelineCount} Games</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>Future Scheduled (Planned)</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--gold)" }}>{futurePlannedCount} Games</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>Unscheduled Backlog</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--text-secondary)" }}>{unscheduledCount} Games</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "500" }}>Ended / Closed</span>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--red)" }}>{endedCount} Games</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Game Roster */}
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Game Roster & Fully Loaded Profitability — {scenario?.name || "Base Plan"}</h3>
              <button
                onClick={downloadRosterCSV}
                suppressHydrationWarning
                style={{
                  padding: "6px 16px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "1px solid var(--border)",
                  background: "var(--surface-3)",
                  color: "var(--text)",
                  transition: "all 0.2s"
                }}
                className="no-print"
              >
                Export Roster (CSV)
              </button>
            </div>
            <div className="card-body">
              {Object.entries(dynamicGamesByDenom).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([denom, denomGames]) => {
                const enrichedDenomGames = denomGames;

                const isCollapsed = !!collapsedDenoms[denom];

                return (
                  <div key={denom} style={{ marginBottom: "24px" }}>
                    <h4 
                      onClick={() => setCollapsedDenoms(prev => ({ ...prev, [denom]: !prev[denom] }))}
                      style={{ color: "var(--blue)", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "6px", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      ${denom} Games ({denomGames.length})
                    </h4>
                    {!isCollapsed && (
                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table">
                          <thead>
                            {hasAllocation ? (
                              <tr>
                                <th>Game #</th>
                                <th>Name</th>
                                <th>Launch</th>
                                <th>Est. Duration</th>
                                <th>Units</th>
                                <th style={{ textAlign: "right" }}>Projected Sales</th>
                                <th style={{ textAlign: "right" }}>Prizes</th>
                                <th style={{ textAlign: "right" }}>Comms</th>
                                <th style={{ textAlign: "right" }}>Print Cost</th>
                                <th style={{ textAlign: "right" }}>Alloc Overhead</th>
                                <th style={{ textAlign: "right" }}>Loaded Profit</th>
                                <th style={{ textAlign: "right" }}>Loaded Margin</th>
                                <th>Status</th>
                              </tr>
                            ) : (
                              <tr>
                                <th>Game #</th>
                                <th>Name</th>
                                <th>Vendor</th>
                                <th>Units</th>
                                <th>Payout %</th>
                                <th>Top Prize</th>
                                <th>Launch</th>
                                <th>Est. Duration</th>
                                <th>Status</th>
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {enrichedDenomGames.map(g => (
                              <tr key={g.id} style={g.deliveryStatus === 'ended' ? { opacity: 0.5 } : {}}>
                                <td className="muted">{g.gameNumber}</td>
                                <td style={{ fontWeight: 600 }}>
                                  {g.name}
                                  {g.budgetStatus === 'already_booked' && (
                                    <span style={{ 
                                      fontSize: "10px", 
                                      color: "var(--text-muted)", 
                                      background: "rgba(255, 255, 255, 0.05)", 
                                      border: "1px solid var(--border)", 
                                      padding: "1px 5px", 
                                      borderRadius: "3px", 
                                      marginLeft: "8px", 
                                      fontWeight: "normal",
                                      display: "inline-block"
                                    }}>
                                      Overhead
                                    </span>
                                  )}
                                </td>
                                
                                {hasAllocation ? (
                                  <>
                                    <td className="muted" style={{ fontSize: "12px" }}>{g.launchDate ? new Date(g.launchDate).toLocaleDateString() : "—"}</td>
                                    <td className="muted" style={{ fontSize: "12px" }}>{getSalesDuration(g)} Month{getSalesDuration(g) !== 1 ? 's' : ''}</td>
                                    <td className="muted">{fmtUnits(g.units)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt$(g.grossSales)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.prizeExpense)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.retailerCommission)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.printingCost)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.allocatedOverhead)}</td>
                                    <td style={{ textAlign: "right", fontFamily: "monospace", color: g.fullyLoadedProfit >= 0 ? "#15803d" : "#b91c1c", fontWeight: "bold" }}>
                                      {fmt$(g.fullyLoadedProfit)}
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: 600, color: g.fullyLoadedMargin >= 15 ? "#15803d" : (g.fullyLoadedMargin >= 5 ? "#b45309" : "#b91c1c") }}>
                                      {g.fullyLoadedMargin.toFixed(1)}%
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="muted">{g.vendor?.name?.split(" ")[0] || "—"}</td>
                                    <td>{fmtUnits(g.units)}</td>
                                    <td>{parseFloat(g.payoutPercent).toFixed(1)}%</td>
                                    <td>{g.topPrize ? fmt$(g.topPrize) : "—"}</td>
                                    <td className="muted" style={{ fontSize: "12px" }}>{g.launchDate ? new Date(g.launchDate).toLocaleDateString() : "—"}</td>
                                    <td className="muted" style={{ fontSize: "12px" }}>{getSalesDuration(g)} Month{getSalesDuration(g) !== 1 ? 's' : ''}</td>
                                  </>
                                )}

                                <td>
                                  <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: (STATUS_COLORS[g.deliveryStatus] || "#6b7280") + "22", color: STATUS_COLORS[g.deliveryStatus] || "#6b7280", textTransform: "capitalize" }}>
                                    {g.deliveryStatus.replace(/_/g, " ")}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Planogram Tab */}
      {tab === "planogram" && (() => {
        const profile = DISPENSER_PROFILES[dispenserProfile] || DISPENSER_PROFILES.ny_standard_30;
        
        // Find which games are active in this month based on estimated duration
        const activeGamesInMonth = dynamicAllocatedGames.filter(g => {
          const gameMonth = getFiscalMonthIndex(g.launchDate);
          if (gameMonth === -1) return false;
          const duration = getSalesDuration(g);
          return planogramMonth >= gameMonth && planogramMonth < gameMonth + duration;
        });

        // Get carryover games active in this month
        const activeCarryovers = carryoverGames.filter(cg => cg.activeMonths?.includes(planogramMonth));
        const carryoverMapped = activeCarryovers.map(cg => ({
          ...cg,
          isCarryover: true,
          launchDate: null,
          closeDate: null,
          vendor: { name: "Carryover Inventory" }
        }));

        // Combine for active inventory pool
        const allActiveGames = [...activeGamesInMonth, ...carryoverMapped];

        // Group active games by denomination
        const activeGamesByDenom = {};
        allActiveGames.forEach(g => {
          const d = g.denomination.toString();
          if (!activeGamesByDenom[d]) activeGamesByDenom[d] = [];
          activeGamesByDenom[d].push(g);
        });

        const doubleFacedIds = doubleFacedGames[planogramMonth] || {};

        let totalTargetSlots = 0;
        let totalFilledSlots = 0;
        let totalDoubleFacedCount = 0;

        const targetDenoms = Object.keys(profile.targets).map(Number).sort((a, b) => b - a);

        const rowsData = targetDenoms.map(d => {
          const dStr = d.toString();
          const target = profile.targets[d];
          const list = activeGamesByDenom[dStr] || [];
          const dfIds = doubleFacedIds[dStr] || [];

          const slots = [];
          // 1. Add normal active games
          list.forEach(g => {
            slots.push({
              ...g,
              isDoubleFaced: false,
              isFresh: getFiscalMonthIndex(g.launchDate) === planogramMonth
            });
          });

          // 2. Add double-faced copies
          dfIds.forEach((id, dfIdx) => {
            const g = list.find(x => x.id === id);
            if (g) {
              slots.push({
                ...g,
                isDoubleFaced: true,
                doubleFaceIndex: dfIdx,
                isFresh: false
              });
              totalDoubleFacedCount++;
            }
          });

          const filled = Math.min(target, slots.length);
          totalTargetSlots += target;
          totalFilledSlots += filled;

          return {
            denom: d,
            target,
            slots,
            filled,
            activeCount: list.length,
            dfCount: dfIds.length
          };
        });

        const complianceScore = totalTargetSlots > 0 ? Math.round((totalFilledSlots / totalTargetSlots) * 100) : 0;

        const handleAddDoubleFace = (denom, gameId) => {
          setDoubleFacedGames(prev => {
            const monthData = prev[planogramMonth] || {};
            const denomStr = denom.toString();
            const currentList = monthData[denomStr] || [];
            return {
              ...prev,
              [planogramMonth]: {
                ...monthData,
                [denomStr]: [...currentList, gameId]
              }
            };
          });
        };

        const handleRemoveDoubleFace = (denom, idx) => {
          setDoubleFacedGames(prev => {
            const monthData = prev[planogramMonth] || {};
            const denomStr = denom.toString();
            const currentList = monthData[denomStr] || [];
            return {
              ...prev,
              [planogramMonth]: {
                ...monthData,
                [denomStr]: currentList.filter((_, i) => i !== idx)
              }
            };
          });
        };

        const monthNames = ["July", "August", "September", "October", "November", "December", "January", "February", "March", "April", "May", "June"];

        // Generate warnings
        const warnings = [];
        rowsData.forEach(row => {
          if (row.slots.length < row.target) {
            warnings.push({
              type: "warning",
              message: `$${row.denom} price point: ${row.target - row.slots.length} empty slot(s) detected. Current active inventory is insufficient.`
            });
          } else if (row.slots.length > row.target) {
            warnings.push({
              type: "info",
              message: `$${row.denom} price point: Over-scheduled (${row.slots.length} active games for ${row.target} bins). Consider retiring or spacing launches.`
            });
          }
        });

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Planogram Controls */}
            <div className="card" style={{ padding: "16px", background: "var(--card-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers size={18} style={{ color: "var(--blue)" }} />
                  <span style={{ fontWeight: 700, fontSize: "15px" }}>Retail Planogram & Mix Compliance Console</span>
                </div>
                <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                  {/* Target Month */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Target Month:</span>
                    <select 
                      value={planogramMonth} 
                      onChange={e => setPlanogramMonth(parseInt(e.target.value))}
                      style={{ fontSize: "12px", padding: "4px 8px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px" }}
                    >
                      {monthNames.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dispenser Profile */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>Dispenser Template:</span>
                    <select 
                      value={dispenserProfile} 
                      onChange={e => setDispenserProfile(e.target.value)}
                      style={{ fontSize: "12px", padding: "4px 8px", background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px" }}
                    >
                      {Object.entries(DISPENSER_PROFILES).map(([key, val]) => (
                        <option key={key} value={key}>{val.name} ({val.totalBins} Bins)</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Health Summary Card */}
            <div className="card" style={{ padding: "20px", display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: "24px", background: "var(--card-bg)" }}>
              {/* Score Indicator */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid var(--border)", paddingRight: "20px" }}>
                <span style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px" }}>Compliance Score</span>
                <span style={{ fontSize: "48px", fontWeight: "800", color: complianceScore === 100 ? "#10b981" : (complianceScore >= 80 ? "#f59e0b" : "#ef4444"), margin: "4px 0" }}>
                  {complianceScore}%
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Activity size={12} style={{ color: "var(--text-muted)" }} />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    {totalFilledSlots} of {totalTargetSlots} slots filled
                  </span>
                </div>
              </div>

              {/* Statistics details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", paddingRight: "20px", borderRight: "1px solid var(--border)" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", color: "var(--text)", fontWeight: "700", textTransform: "uppercase" }}>Monthly Dispenser Inventory</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total active games in {monthNames[planogramMonth]}:</span>
                    <span style={{ fontWeight: "700" }}>
                      {allActiveGames.length} <span style={{ fontSize: "11px", fontWeight: "normal", color: "var(--text-muted)" }}>({activeGamesInMonth.length} new + {activeCarryovers.length} carryover)</span>
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Target display bins:</span>
                    <span style={{ fontWeight: "700" }}>{profile.totalBins}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Filled slots (excl. overflow):</span>
                    <span style={{ fontWeight: "700", color: "var(--blue)" }}>{totalFilledSlots}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Double-faced slots:</span>
                    <span style={{ fontWeight: "700", color: "#3b82f6" }}>{totalDoubleFacedCount}</span>
                  </div>
                </div>
              </div>

              {/* Notifications and Recommendations */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "150px", overflowY: "auto" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "13px", color: "var(--text)", fontWeight: "700", textTransform: "uppercase" }}>Compliance Warnings & Tips</h4>
                {warnings.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "#10b981", fontWeight: "600", fontStyle: "italic" }}>
                    ✓ Planogram is 100% compliant. All price points have perfect dispenser coverage!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {warnings.map((w, idx) => (
                      <div key={idx} style={{ fontSize: "11px", display: "flex", alignItems: "flex-start", gap: "4px", color: w.type === 'warning' ? '#f59e0b' : 'var(--text-muted)' }}>
                        <span style={{ flexShrink: 0, marginTop: "2px" }}>•</span>
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Planogram Grid */}
            <div className="card" style={{ padding: "20px", background: "var(--card-bg)" }}>
              <div className="card-header" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", marginBottom: "16px" }}>
                <h3 style={{ margin: 0, fontSize: "15px" }}>Visual Dispenser Allocation Grid ({monthNames[planogramMonth]} 2026)</h3>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {rowsData.map(row => {
                  const activeGamesInRow = activeGamesByDenom[row.denom.toString()] || [];

                  return (
                    <div 
                      key={row.denom} 
                      style={{ 
                        display: "grid", 
                        gridTemplateColumns: "180px 1fr", 
                        gap: "16px", 
                        alignItems: "center", 
                        borderBottom: "1px solid rgba(255,255,255,0.03)", 
                        paddingBottom: "12px" 
                      }}
                    >
                      {/* Row Label & Actions */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "700", background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                            ${row.denom}
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
                            ({row.filled} of {row.target} bins filled)
                          </span>
                        </div>

                        {/* Double-Facing Add Dropdown */}
                        {row.slots.length < row.target && activeGamesInRow.length > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }} className="no-print">
                            <PlusCircle size={12} style={{ color: "#3b82f6" }} />
                            <select
                              defaultValue=""
                              onChange={e => {
                                const val = e.target.value;
                                if (val) {
                                  handleAddDoubleFace(row.denom, val);
                                  e.target.value = ""; // reset dropdown selection
                                }
                              }}
                              style={{ 
                                fontSize: "10px", 
                                padding: "2px 4px", 
                                background: "var(--surface-3)", 
                                color: "var(--text)", 
                                border: "1px solid var(--border)", 
                                borderRadius: "4px",
                                cursor: "pointer",
                                maxWidth: "120px"
                              }}
                            >
                              <option value="" disabled>+ Double-Face</option>
                              {activeGamesInRow.map(g => (
                                <option key={g.id} value={g.id}>#{g.gameNumber} {g.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Display Slots Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${row.target}, 1fr)`, gap: "12px" }}>
                        {Array.from({ length: row.target }).map((_, slotIdx) => {
                          const slot = row.slots[slotIdx];

                          // 1. Unassigned / Empty Slot
                          if (!slot) {
                            return (
                              <div 
                                key={slotIdx}
                                style={{ 
                                  height: "75px", 
                                  borderRadius: "6px", 
                                  border: "1px dashed #ef4444", 
                                  background: "rgba(239, 68, 68, 0.01)", 
                                  display: "flex", 
                                  flexDirection: "column", 
                                  alignItems: "center", 
                                  justifyContent: "center",
                                  fontSize: "11px",
                                  color: "#ef4444",
                                  fontWeight: "600",
                                  gap: "2px"
                                }}
                              >
                                <span>Empty Slot</span>
                                <span style={{ fontSize: "9px", fontWeight: "normal", opacity: 0.8 }}>Gap</span>
                              </div>
                            );
                          }

                          // 2. Assigned Game Card
                          let cardBg = "rgba(255,255,255,0.02)";
                          let cardBorder = "1px solid var(--border)";
                          let statusLabel = "Active";
                          let badgeBg = "rgba(255,255,255,0.08)";
                          let badgeText = "var(--text-secondary)";

                           if (slot.isCarryover) {
                            cardBg = "rgba(139, 92, 246, 0.03)";
                            cardBorder = "1px solid #8b5cf6";
                            statusLabel = "Carryover";
                            badgeBg = "#8b5cf6";
                            badgeText = "#ffffff";
                          } else if (slot.isFresh) {
                            cardBg = "rgba(16, 185, 129, 0.03)";
                            cardBorder = "1px solid #10b981";
                            statusLabel = "Fresh Launch";
                            badgeBg = "#10b981";
                            badgeText = "#ffffff";
                          } else if (slot.isDoubleFaced) {
                            cardBg = "repeating-linear-gradient(45deg, rgba(59, 130, 246, 0.03), rgba(59, 130, 246, 0.03) 10px, rgba(59, 130, 246, 0.06) 10px, rgba(59, 130, 246, 0.06) 20px)";
                            cardBorder = "1px dashed #3b82f6";
                            statusLabel = "Double-Faced";
                            badgeBg = "#3b82f6";
                            badgeText = "#ffffff";
                          } else {
                            // Active / Established
                            cardBg = "rgba(245, 158, 11, 0.03)";
                            cardBorder = "1px solid #f59e0b";
                            statusLabel = "Established";
                            badgeBg = "#f59e0b";
                            badgeText = "#000000";
                          }

                          return (
                            <div 
                              key={slotIdx}
                              style={{ 
                                height: "75px", 
                                borderRadius: "6px", 
                                border: cardBorder, 
                                background: cardBg, 
                                padding: "8px 10px", 
                                display: "flex", 
                                flexDirection: "column", 
                                justifyContent: "space-between",
                                position: "relative",
                                overflow: "hidden",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                              }}
                            >
                              {/* Game details with thumbnail */}
                              <div style={{ display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "flex-start", minWidth: 0 }}>
                                <div style={{ minWidth: 0, flexGrow: 1 }}>
                                  <div 
                                    style={{ 
                                      fontWeight: "700", 
                                      fontSize: "12px", 
                                      color: "var(--text)", 
                                      whiteSpace: "nowrap", 
                                      overflow: "hidden", 
                                      textOverflow: "ellipsis" 
                                    }} 
                                    title={slot.name}
                                  >
                                    {slot.name}
                                  </div>
                                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    Game #{slot.gameNumber} · {slot.vendor?.name?.split(" ")[0] || "Unknown"}
                                  </div>
                                </div>
                                {slot.imageUrl && (
                                  <div 
                                    style={{ 
                                      width: "24px", 
                                      height: "32px", 
                                      borderRadius: "3px", 
                                      flexShrink: 0, 
                                      border: "1px solid rgba(255,255,255,0.1)",
                                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                                      ...getTicketBgStyle(slot.imageUrl)
                                    }} 
                                  />
                                )}
                              </div>

                              {/* Footer Badges & Actions */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "9px", background: badgeBg, color: badgeText, padding: "1px 5px", borderRadius: "3px", fontWeight: "700", textTransform: "uppercase" }}>
                                  {statusLabel}
                                </span>
                                
                                {slot.isDoubleFaced && (
                                  <button 
                                    onClick={() => handleRemoveDoubleFace(row.denom, slot.doubleFaceIndex)}
                                    title="Remove double-facing"
                                    style={{ 
                                      padding: "2px", 
                                      background: "transparent", 
                                      border: "none", 
                                      color: "#ef4444", 
                                      cursor: "pointer",
                                      display: "inline-flex"
                                    }}
                                    className="no-print"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Carryover Inventory Manager */}
            <div className="card" style={{ marginTop: "24px", background: "var(--card-bg)", borderRadius: "8px", border: "1px solid var(--border)" }}>
              <div 
                onClick={() => setCollapseCarryover(!collapseCarryover)}
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  padding: "16px 20px", 
                  cursor: "pointer", 
                  userSelect: "none",
                  borderBottom: collapseCarryover ? "none" : "1px solid var(--border)"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Layers size={16} style={{ color: "#8b5cf6" }} />
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "var(--text)" }}>
                    Prior-Year Carryover Inventory & Active Products ({carryoverGames.length})
                  </h3>
                  <span style={{ fontSize: "11px", background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6", padding: "1px 6px", borderRadius: "10px", fontWeight: "600" }}>
                    {activeCarryovers.length} Active in {monthNames[planogramMonth]}
                  </span>
                </div>
                {collapseCarryover ? <ChevronRight size={16} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={16} style={{ color: "var(--text-muted)" }} />}
              </div>

              {!collapseCarryover && (
                <div style={{ padding: "20px" }}>
                  <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-secondary)" }}>
                    Manage legacy games from prior fiscal cycles. Toggled games are added to the active inventory pool for <strong>{monthNames[planogramMonth]}</strong> and can be double-faced or assigned to target dispenser bins.
                  </p>

                  {/* Add Carryover Game Form */}
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.target);
                      const name = formData.get("name")?.toString().trim();
                      const gameNumber = formData.get("gameNumber")?.toString().trim();
                      const denomination = parseInt(formData.get("denomination"), 10);
                      
                      if (!name || !gameNumber || isNaN(denomination)) {
                        alert("Please fill in all fields.");
                        return;
                      }

                      const newGame = {
                        id: "c_" + Date.now(),
                        gameNumber,
                        name,
                        denomination,
                        imageUrl: denomination >= 30 ? "theme-gold" : "theme-platinum",
                        activeMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] // active all year by default
                      };

                      const newList = [...carryoverGames, newGame];
                      saveCarryoverGames(newList);
                      e.target.reset();
                    }}
                    style={{ 
                      display: "flex", 
                      flexWrap: "wrap", 
                      gap: "12px", 
                      padding: "12px", 
                      background: "var(--surface-3)", 
                      borderRadius: "6px", 
                      border: "1px solid var(--border)",
                      marginBottom: "20px",
                      alignItems: "flex-end"
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Game Name</label>
                      <input 
                        name="name" 
                        type="text" 
                        placeholder="e.g. Set For Life" 
                        required
                        style={{ fontSize: "12px", padding: "4px 8px", background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "160px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Game Number</label>
                      <input 
                        name="gameNumber" 
                        type="text" 
                        placeholder="e.g. 990" 
                        required
                        style={{ fontSize: "12px", padding: "4px 8px", background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "80px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }}>Price Point</label>
                      <select 
                        name="denomination"
                        style={{ fontSize: "12px", padding: "4px 8px", background: "var(--surface-1)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px", width: "90px" }}
                      >
                        <option value={50}>$50</option>
                        <option value={30}>$30</option>
                        <option value={20}>$20</option>
                        <option value={10}>$10</option>
                        <option value={5}>$5</option>
                        <option value={3}>$3</option>
                        <option value={2}>$2</option>
                        <option value={1}>$1</option>
                      </select>
                    </div>
                    <button 
                      type="submit"
                      style={{ 
                        padding: "6px 12px", 
                        background: "#8b5cf6", 
                        color: "#fff", 
                        border: "none", 
                        borderRadius: "4px", 
                        fontSize: "12px", 
                        fontWeight: "600", 
                        cursor: "pointer" 
                      }}
                    >
                      + Add Carryover Product
                    </button>
                  </form>

                  {/* Carryover Games Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "8px" }}>
                    {carryoverGames.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                        No carryover products defined.
                      </div>
                    ) : (
                      carryoverGames.map(cg => {
                        const isActive = cg.activeMonths?.includes(planogramMonth);
                        return (
                          <div 
                            key={cg.id} 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between", 
                              padding: "10px 16px", 
                              background: isActive ? "rgba(139, 92, 246, 0.02)" : "var(--surface-2)", 
                              border: isActive ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid var(--border)", 
                              borderRadius: "6px" 
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                              <span style={{ fontSize: "11px", fontWeight: "700", background: "rgba(139, 92, 246, 0.1)", color: "#8b5cf6", padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(139, 92, 246, 0.2)" }}>
                                ${cg.denomination}
                              </span>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text)" }}>{cg.name}</span>
                                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Game #{cg.gameNumber}</span>
                              </div>
                            </div>

                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                              {/* Toggle active status for selected month */}
                              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text)", cursor: "pointer" }}>
                                <input 
                                  type="checkbox" 
                                  checked={isActive}
                                  onChange={(e) => {
                                    const nextActive = e.target.checked;
                                    const updatedList = carryoverGames.map(item => {
                                      if (item.id === cg.id) {
                                        const currentMonths = item.activeMonths || [];
                                        return {
                                          ...item,
                                          activeMonths: nextActive 
                                            ? [...currentMonths, planogramMonth]
                                            : currentMonths.filter(m => m !== planogramMonth)
                                        };
                                      }
                                      return item;
                                    });
                                    saveCarryoverGames(updatedList);
                                  }}
                                  style={{ cursor: "pointer" }}
                                />
                                Active in {monthNames[planogramMonth]}
                              </label>

                              {/* Delete button */}
                              <button 
                                onClick={() => {
                                  if (confirm(`Remove "${cg.name}" from carryover inventory?`)) {
                                    const updatedList = carryoverGames.filter(item => item.id !== cg.id);
                                    saveCarryoverGames(updatedList);
                                  }
                                }}
                                style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "inline-flex", padding: "4px" }}
                                onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                                onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        );
      })()}

      {/* Global CSS Print Stylesheet */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Hide non-print areas */
          .no-print,
          .page-header,
          .btn,
          button,
          iframe,
          select,
          input[type="checkbox"],
          [style*="borderBottom: 2px solid var(--border)"] {
            display: none !important;
          }
          
          body, html, #__next, main {
            background: #ffffff !important;
            color: #000000 !important;
          }

          .card {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin-bottom: 24px !important;
            width: 100% !important;
          }

          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          th, td {
            border-bottom: 1px solid #cbd5e1 !important;
            color: #000000 !important;
            padding: 6px 4px !important;
          }

          tr {
            page-break-inside: avoid !important;
          }

          h2, h3, h4 {
            color: #000000 !important;
          }
        }
      `}} />
    </>
  );
}

