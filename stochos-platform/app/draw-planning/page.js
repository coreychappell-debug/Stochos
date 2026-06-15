'use client';

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Link from "next/link";
import Skeleton from "../components/Skeleton";
import { Save, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

const EXTERNAL_CODE_TO_FORECAST_CATEGORY = {
  "mega_millions": "Mega Millions",
  "powerball": "Powerball",
  "ny_lotto": "Lotto",
  "numbers": "Numbers",
  "win_4": "Win 4",
  "take_5": "Take 5",
  "pick_10": "Pick 10",
  "quick_draw": "Quick Draw",
  "cash4life": "Cash 4 Life"
};

export default function DrawPlanningPage() {
  const [scenario, setScenario] = useState(null);
  const [games, setGames] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2027);
  const [activeForecastRowIndex, setActiveForecastRowIndex] = useState(null);
  const [customForecasts, setCustomForecasts] = useState({});
  const [showOpExpenses, setShowOpExpenses] = useState(false);

  // On mount, load cached forecasts, fetch raw timeseries, and calculate fresh forecasts
  useEffect(() => {
    // 1. Quick load from localStorage cache first
    try {
      const stored = localStorage.getItem("stochos_custom_forecasts");
      if (stored) {
        setCustomForecasts(JSON.parse(stored));
      }
    } catch (e) {}

    // 2. Perform background calculation to ensure fresh values grouped by month
    async function calculateFreshForecasts() {
      try {
        let customParams = {};
        try {
          const storedParams = localStorage.getItem("stochos_forecast_parameters");
          if (storedParams) customParams = JSON.parse(storedParams);
        } catch (e) {}

        const res = await fetch("/api/analytics/forecast");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.timeseries)) return;

        const timeseriesData = data.timeseries;
        const uniqueCats = Array.from(new Set(timeseriesData.map(t => t.category)));
        const forecasts = {};

        uniqueCats.forEach(cat => {
          const monthlyGroups = {};
          timeseriesData.forEach(item => {
            if (item.category === cat) {
              const mStr = item.date.slice(0, 7); // Group by YYYY-MM
              if (!monthlyGroups[mStr]) {
                monthlyGroups[mStr] = [];
              }
              monthlyGroups[mStr].push(item);
            }
          });

          const sortedMonths = Object.keys(monthlyGroups).sort();
          const aggregated = sortedMonths.map(month => {
            const items = monthlyGroups[month];
            let gross = 0;
            items.forEach(it => {
              gross += parseFloat(it.grossRevenue || 0);
            });
            return { date: month + "-01", value: gross };
          }).filter(d => d.value > 0);

          const n = aggregated.length;
          if (n === 0) return;

          const values = aggregated.map(d => d.value);
          const dates = aggregated.map(d => d.date);

          let forecastsList = [];
          const params = customParams[cat] || { alpha: 0.2, beta: 0.1, gamma: 0.3 };
          const cAlpha = params.alpha;
          const cBeta = params.beta;
          const cGamma = params.gamma;

          if (n >= 24) {
            const L = 12;
            let a = new Array(n).fill(0);
            let b = new Array(n).fill(0);
            let s = new Array(n + 12).fill(0);

            let sumYear1 = 0;
            for (let i = 0; i < L; i++) sumYear1 += values[i];
            const initialLevel = sumYear1 / L;
            a[L - 1] = initialLevel;

            let sumDiff = 0;
            for (let i = 0; i < L; i++) {
              sumDiff += (values[i + L] - values[i]) / L;
            }
            const initialTrend = sumDiff / L;
            b[L - 1] = initialTrend;

            for (let i = 0; i < L; i++) {
              s[i] = values[i] - initialLevel;
            }

            for (let t = L; t < n; t++) {
              a[t] = cAlpha * (values[t] - s[t - L]) + (1 - cAlpha) * (a[t - 1] + b[t - 1]);
              b[t] = cBeta * (a[t] - a[t - 1]) + (1 - cBeta) * b[t - 1];
              s[t] = cGamma * (values[t] - a[t]) + (1 - cGamma) * s[t - L];
            }

            const lastLevel = a[n - 1];
            const lastTrend = b[n - 1];
            for (let h = 1; h <= 12; h++) {
              const seasonalFactor = s[n - L + (h - 1) % L];
              forecastsList.push(lastLevel + h * lastTrend + seasonalFactor);
            }
          } else if (n >= 6) {
            let a = new Array(n).fill(0);
            let b = new Array(n).fill(0);
            a[0] = values[0];
            b[0] = values[1] - values[0];
            for (let t = 1; t < n; t++) {
              a[t] = cAlpha * values[t] + (1 - cAlpha) * (a[t - 1] + b[t - 1]);
              b[t] = cBeta * (a[t] - a[t - 1]) + (1 - cBeta) * b[t - 1];
            }
            const lastLevel = a[n - 1];
            const lastTrend = b[n - 1];
            for (let h = 1; h <= 12; h++) {
              forecastsList.push(lastLevel + h * lastTrend);
            }
          } else {
            const sum = values.reduce((acc, v) => acc + v, 0);
            const avg = sum / n;
            for (let h = 1; h <= 12; h++) {
              forecastsList.push(avg);
            }
          }

          const sum12 = forecastsList.reduce((acc, v) => acc + Math.max(0, v), 0);
          forecasts[cat] = sum12;
        });

        localStorage.setItem("stochos_custom_forecasts", JSON.stringify(forecasts));
        setCustomForecasts(forecasts);
      } catch (err) {
        console.error("Failed to run fresh forecast calculations:", err);
      }
    }

    calculateFreshForecasts();
  }, []);

  // Fetch products and active scenario
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        // Get Product Catalog (to link Products)
        const prodRes = await fetch("/api/products");
        if (prodRes.ok) {
          const prods = await prodRes.json();
          // Filter to draw_game category
          setProductsList(prods.filter(p => p.category === "draw_game"));
        }

        // Get Draw Scenario
        const scenarioRes = await fetch(`/api/draw-games?fiscalYear=${fiscalYear}`);
        if (scenarioRes.ok) {
          const data = await scenarioRes.json();
          setScenario(data);
          const gamesWithOriginal = (data.games || []).map(g => ({
            ...g,
            originalProjectedSales: g.projectedSales
          }));
          setGames(gamesWithOriginal);
        } else {
          setError("Failed to load draw planning scenario.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading data from server.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [fiscalYear]);

  // Handle cell edit
  const handleCellChange = (index, field, value) => {
    const updated = [...games];
    if (field === "projectedSales") {
      updated[index][field] = parseFloat(value || 0);
    } else if (field === "prizePayoutPercent" || field === "retailerCommPercent" || field === "gamingSystemPercent" || field === "retailerBonusPercent" || field === "retailerCashingPercent" || field === "cashablePrizePercent" || field === "jackpotBonusPercent" || field === "jackpotEligiblePercent" || field === "jackpotBonusCap") {
      updated[index][field] = parseFloat(value || 0);
    } else if (field === "fixedOperatingCost") {
      updated[index][field] = parseFloat(value || 0);
    } else {
      updated[index][field] = value;
    }
    setGames(updated);
  };
  // Add Custom Game
  const handleAddGame = () => {
    const newGame = {
      id: `temp-${Date.now()}`,
      productId: "",
      name: "New Custom Game",
      projectedSales: 10000000.00,
      prizePayoutPercent: 50.0,
      retailerCommPercent: 6.0,
      gamingSystemPercent: 2.50,
      retailerBonusPercent: 0.50,
      fixedOperatingCost: 0.00,
      retailerCashingPercent: 1.00,
      cashablePrizePercent: 50.00,
      jackpotBonusPercent: 0.50,
      jackpotEligiblePercent: 25.00,
      jackpotBonusCap: 1000000.00,
      budgetStatus: "new_request"
    };
    setGames([...games, newGame]);
  };
  // Link to Product catalog selection
  const handleProductSelect = (index, prodId) => {
    const selected = productsList.find(p => p.id === prodId);
    if (!selected) return;

    const updated = [...games];
    updated[index].productId = prodId;
    updated[index].name = selected.name;
    setGames(updated);
  };

  // Remove Game
  const handleRemoveGame = (index) => {
    const updated = games.filter((_, i) => i !== index);
    setGames(updated);
  };

  // Save Scenario
  const handleSave = async () => {
    if (!scenario) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/draw-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          games: games.map(g => ({
            productId: g.productId || null,
            name: g.name,
            projectedSales: g.projectedSales,
            prizePayoutPercent: g.prizePayoutPercent,
            retailerCommPercent: g.retailerCommPercent,
            gamingSystemPercent: g.gamingSystemPercent !== undefined && g.gamingSystemPercent !== null ? parseFloat(g.gamingSystemPercent) : 2.50,
            retailerBonusPercent: g.retailerBonusPercent !== undefined && g.retailerBonusPercent !== null ? parseFloat(g.retailerBonusPercent) : 0.50,
            fixedOperatingCost: g.fixedOperatingCost !== undefined && g.fixedOperatingCost !== null ? parseFloat(g.fixedOperatingCost) : 0.00,
            retailerCashingPercent: g.retailerCashingPercent !== undefined && g.retailerCashingPercent !== null ? parseFloat(g.retailerCashingPercent) : 1.00,
            cashablePrizePercent: g.cashablePrizePercent !== undefined && g.cashablePrizePercent !== null ? parseFloat(g.cashablePrizePercent) : 50.00,
            jackpotBonusPercent: g.jackpotBonusPercent !== undefined && g.jackpotBonusPercent !== null ? parseFloat(g.jackpotBonusPercent) : 0.50,
            jackpotEligiblePercent: g.jackpotEligiblePercent !== undefined && g.jackpotEligiblePercent !== null ? parseFloat(g.jackpotEligiblePercent) : 25.00,
            jackpotBonusCap: g.jackpotBonusCap !== undefined && g.jackpotBonusCap !== null ? parseFloat(g.jackpotBonusCap) : 1000000.00,
            budgetStatus: g.budgetStatus || "new_request"
          }))
        })
      });

      if (res.ok) {
        setSuccess("Draw planning scenario saved successfully!");
        const data = await res.json();
        // Refresh games with DB ids and backup original sales
        if (data.games) {
          const gamesWithOriginal = data.games.map(g => ({
            ...g,
            originalProjectedSales: g.projectedSales
          }));
          setGames(gamesWithOriginal);
        }
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to save draw scenario.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Forecasting helpers
  const getProductObj = (prodId) => {
    return productsList.find(p => p.id === prodId) || null;
  };

  const getProductHistoricalAnnualSales = (prodId) => {
    const p = getProductObj(prodId);
    return p ? p.historicalAnnualSales || 0 : 0;
  };

  const getProductTrend = (prodId) => {
    const p = getProductObj(prodId);
    return p ? p.trendDirection || "Stable" : "Stable";
  };

  const applyForecastModel = (index, modelType, customPct = 0) => {
    const updated = [...games];
    const game = updated[index];
    if (!game.productId) return;

    const baseSales = getProductHistoricalAnnualSales(game.productId);
    const trend = getProductTrend(game.productId);

    let finalSales = baseSales;
    if (modelType === "baseline") {
      finalSales = baseSales;
    } else if (modelType === "trend") {
      let multiplier = 1.00;
      if (trend === "Declining") multiplier = 0.95;
      else if (trend === "Growing") multiplier = 1.05;
      finalSales = baseSales * multiplier;
    } else if (modelType === "custom") {
      finalSales = baseSales * (1 + customPct / 100);
    } else if (modelType === "predictive") {
      const p = getProductObj(game.productId);
      const extCode = p ? p.externalCode : null;
      const forecastCat = extCode ? EXTERNAL_CODE_TO_FORECAST_CATEGORY[extCode] : null;
      const customVal = forecastCat ? customForecasts[forecastCat] : null;
      if (customVal) {
        finalSales = customVal;
        if (typeof window !== "undefined" && forecastCat) {
          localStorage.setItem("stochos_selected_forecast_category", forecastCat);
        }
      } else {
        finalSales = baseSales;
      }
    }

    game.projectedSales = parseFloat(finalSales.toFixed(2));
    setGames(updated);
    setSuccess(`Applied forecast to ${game.name}. Remember to save your plan!`);
  };

  const applyGlobalForecast = (modelType) => {
    const updated = games.map((game) => {
      // Revert saved does not require game.productId (handles custom games)
      if (modelType === "revert_saved") {
        const originalVal = game.originalProjectedSales !== undefined ? game.originalProjectedSales : game.projectedSales;
        return {
          ...game,
          projectedSales: parseFloat(originalVal.toFixed(2))
        };
      }

      if (!game.productId) return game;

      const baseSales = getProductHistoricalAnnualSales(game.productId);
      const trend = getProductTrend(game.productId);

      let finalSales = baseSales;
      if (modelType === "baseline") {
        finalSales = baseSales;
      } else if (modelType === "trend") {
        let multiplier = 1.00;
        if (trend === "Declining") multiplier = 0.95;
        else if (trend === "Growing") multiplier = 1.05;
        finalSales = baseSales * multiplier;
      } else if (modelType === "growth_3") {
        finalSales = baseSales * 1.03;
      } else if (modelType === "growth_5") {
        finalSales = baseSales * 1.05;
      } else if (modelType === "growth_neg_2") {
        finalSales = baseSales * 0.98;
      } else if (modelType === "predictive") {
        const p = getProductObj(game.productId);
        const extCode = p ? p.externalCode : null;
        const forecastCat = extCode ? EXTERNAL_CODE_TO_FORECAST_CATEGORY[extCode] : null;
        const customVal = forecastCat ? customForecasts[forecastCat] : null;
        if (customVal) {
          finalSales = customVal;
        } else {
          finalSales = baseSales;
        }
      }

      return {
        ...game,
        projectedSales: parseFloat(finalSales.toFixed(2))
      };
    });

    setGames(updated);
    if (modelType === "revert_saved") {
      setSuccess("Reverted all games back to their saved scenario values.");
    } else {
      setSuccess("Forecast model applied to all linked games! Don't forget to save your plan.");
    }
  };

  // Calculate Metrics
  const totalSales = games.reduce((acc, g) => acc + (g.projectedSales || 0), 0);
  const totalPrizeExpense = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.prizePayoutPercent || 0) / 100), 0);
  const totalRetailerComm = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.retailerCommPercent || 0) / 100), 0);
  const totalSystemFee = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.gamingSystemPercent !== undefined && g.gamingSystemPercent !== null ? g.gamingSystemPercent : 2.50) / 100), 0);
  const totalRetailerBonus = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.retailerBonusPercent !== undefined && g.retailerBonusPercent !== null ? g.retailerBonusPercent : 0.50) / 100), 0);
  const totalFixedCosts = games.reduce((acc, g) => acc + parseFloat(g.fixedOperatingCost || 0), 0);

  const totalCashingBonus = games.reduce((acc, g) => {
    const prizePayoutVal = (g.projectedSales || 0) * (g.prizePayoutPercent || 0) / 100;
    const cashingPercent = g.retailerCashingPercent !== undefined && g.retailerCashingPercent !== null ? g.retailerCashingPercent : 1.00;
    const cashableShare = g.cashablePrizePercent !== undefined && g.cashablePrizePercent !== null ? g.cashablePrizePercent : 50.00;
    return acc + (prizePayoutVal * (cashableShare / 100) * (cashingPercent / 100));
  }, 0);

  const totalJackpotBonus = games.reduce((acc, g) => {
    const prizePayoutVal = (g.projectedSales || 0) * (g.prizePayoutPercent || 0) / 100;
    const jackpotPercent = g.jackpotBonusPercent !== undefined && g.jackpotBonusPercent !== null ? g.jackpotBonusPercent : 0.50;
    const jackpotEligible = g.jackpotEligiblePercent !== undefined && g.jackpotEligiblePercent !== null ? g.jackpotEligiblePercent : 25.00;
    const jackpotCap = g.jackpotBonusCap !== undefined && g.jackpotBonusCap !== null ? g.jackpotBonusCap : 1000000.00;
    return acc + Math.min(jackpotCap, prizePayoutVal * (jackpotEligible / 100) * (jackpotPercent / 100));
  }, 0);

  const blendedPayout = totalSales > 0 ? (totalPrizeExpense / totalSales) * 100 : 0;
  const netContribution = totalSales - (totalPrizeExpense + totalRetailerComm + totalSystemFee + totalRetailerBonus + totalCashingBonus + totalJackpotBonus + totalFixedCosts);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
              Draw Game Revenue Planner
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", margin: 0 }}>
              Model projected sales and prize payouts for core and custom draw games.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Fiscal Year:</label>
            <select 
              value={fiscalYear} 
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            >
              <option value={2026}>FY2026</option>
              <option value={2027}>FY2027 (Current)</option>
              <option value={2028}>FY2028</option>
            </select>
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="btn btn-primary"
              style={{ minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {saving ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '6px', fill: 'none', stroke: 'currentColor', strokeWidth: '3px' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                  </svg>
                  Saving...
                </>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Save size={14} /> Save Plan
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", border: "1px solid #fee2e2", marginBottom: "1.5rem", fontSize: 14, display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", border: "1px solid #dcfce7", marginBottom: "1.5rem", fontSize: 14, display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} style={{ color: "#166534" }} /> {success}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Shimmering KPI grid */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {[1, 2, 3, 4].map((i) => (
                <div className="kpi-card" style={{ padding: "20px" }} key={i}>
                  <Skeleton width="60%" height="12px" style={{ marginBottom: "12px" }} />
                  <Skeleton width="85%" height="28px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="50%" height="10px" />
                </div>
              ))}
            </div>

            {/* Shimmering Table */}
            <div className="card">
              <div className="card-header">
                <Skeleton width="160px" height="16px" />
              </div>
              <div className="card-body" style={{ padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Table headers */}
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="18%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="10%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="10%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="6%" height="14px" />
                  </div>
                  {/* Table rows */}
                  {[1, 2, 3, 4].map((row) => (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} key={row}>
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="18%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="10%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="10%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="6%" height="16px" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* KPI Dashboard cards */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">Projected Draw Sales</div>
                <div className="kpi-value">${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Total gross revenue</div>
              </div>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Projected Prize Expense</div>
                <div className="kpi-value">${totalPrizeExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Blended Payout: {blendedPayout.toFixed(2)}%</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Retailer Commissions</div>
                <div className="kpi-value">${totalRetailerComm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Average: 6.00%</div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-label">Net Contribution</div>
                <div className="kpi-value">${netContribution.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Revenue net of prizes/commission</div>
              </div>
            </div>

            {/* Main Interactive Table Grid */}
            <div className="card" style={{ background: "var(--card-bg)" }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <h3 style={{ margin: 0 }}>Projected Roster</h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {games.some(g => g.productId) && (
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          applyGlobalForecast(e.target.value);
                          e.target.value = "";
                        }
                      }}
                      style={{
                        fontSize: 13,
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                        cursor: "pointer"
                      }}
                    >
                      <option value="">⚡ Bulk Forecast Options</option>
                      <option value="predictive">Apply Custom Predictive Forecasts</option>
                      <option value="baseline">Apply Historical Baselines</option>
                      <option value="trend">Apply Trend-Adjusted Models</option>
                      <option value="growth_3">Apply flat +3% Growth</option>
                      <option value="growth_5">Apply flat +5% Growth</option>
                      <option value="growth_neg_2">Apply flat -2% Adjustment</option>
                      <option value="revert_saved">↩️ Revert All to Saved Scenario</option>
                    </select>
                  )}
                  <button
                    onClick={() => setShowOpExpenses(!showOpExpenses)}
                    className="btn"
                    style={{
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      backgroundColor: showOpExpenses ? "var(--blue)" : "var(--surface-3)",
                      color: showOpExpenses ? "white" : "var(--text)",
                      border: "1px solid var(--border)"
                    }}
                  >
                    {showOpExpenses ? "Hide Operational Expenses" : "Show Operational Expenses"}
                  </button>
                  <button 
                    onClick={handleAddGame}
                    className="btn"
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                  >
                    <span>+</span> Add Custom Draw Game
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Linked Product</th>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Game Name</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Projected Annual Sales ($)</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Prize Payout %</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Projected Prize Expense ($)</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Retailer Comm %</th>
                      {showOpExpenses && (
                        <>
                          <th style={{ textAlign: "right", padding: "12px 16px", whiteSpace: "nowrap" }}>
                            System Fee %
                            <button 
                              onClick={() => setShowOpExpenses(false)} 
                              title="Hide Operational Expenses" 
                              style={{ 
                                background: "rgba(239, 68, 68, 0.15)", 
                                border: "1px solid rgba(239, 68, 68, 0.3)", 
                                color: "#ef4444", 
                                borderRadius: "4px", 
                                padding: "2px 6px", 
                                fontSize: "10px", 
                                marginLeft: "8px", 
                                cursor: "pointer",
                                fontWeight: "normal"
                              }}
                            >
                              Hide ✕
                            </button>
                          </th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Retailer Bonus %</th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Cashing Bonus %</th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Cashable Share %</th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Jackpot Bonus %</th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Jackpot-Eligible Share %</th>
                          <th style={{ textAlign: "right", padding: "12px 16px" }}>Jackpot Cap ($)</th>
                          <th style={{ textAlign: "right", padding: "12px 16px", whiteSpace: "nowrap" }}>
                            Fixed Costs ($)
                            <button 
                              onClick={() => setShowOpExpenses(false)} 
                              title="Hide Operational Expenses" 
                              style={{ 
                                background: "rgba(239, 68, 68, 0.15)", 
                                border: "1px solid rgba(239, 68, 68, 0.3)", 
                                color: "#ef4444", 
                                borderRadius: "4px", 
                                padding: "2px 6px", 
                                fontSize: "10px", 
                                marginLeft: "8px", 
                                cursor: "pointer",
                                fontWeight: "normal"
                              }}
                            >
                              Hide ✕
                            </button>
                          </th>
                        </>
                      )}
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Net Revenue Contribution ($)</th>
                      <th style={{ textAlign: "center", padding: "12px 16px", width: 60 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length === 0 ? (
                      <tr>
                        <td colSpan={showOpExpenses ? 16 : 8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                          No draw games added yet. Click &quot;Add Custom Draw Game&quot; to begin.
                        </td>
                      </tr>
                    ) : (
                      games.map((game, index) => {
                        const payoutAmt = (game.projectedSales * game.prizePayoutPercent) / 100;
                        const commAmt = (game.projectedSales * game.retailerCommPercent) / 100;
                        const systemPercent = game.gamingSystemPercent !== undefined && game.gamingSystemPercent !== null ? game.gamingSystemPercent : 2.50;
                        const retailerBonusPercent = game.retailerBonusPercent !== undefined && game.retailerBonusPercent !== null ? game.retailerBonusPercent : 0.50;
                        const cashingPercent = game.retailerCashingPercent !== undefined && game.retailerCashingPercent !== null ? game.retailerCashingPercent : 1.00;
                        const cashableShare = game.cashablePrizePercent !== undefined && game.cashablePrizePercent !== null ? game.cashablePrizePercent : 50.00;
                        const jackpotPercent = game.jackpotBonusPercent !== undefined && game.jackpotBonusPercent !== null ? game.jackpotBonusPercent : 0.50;
                        const jackpotEligible = game.jackpotEligiblePercent !== undefined && game.jackpotEligiblePercent !== null ? game.jackpotEligiblePercent : 25.00;
                        const jackpotCap = game.jackpotBonusCap !== undefined && game.jackpotBonusCap !== null ? game.jackpotBonusCap : 1000000.00;
                        const fixedCost = game.fixedOperatingCost !== undefined && game.fixedOperatingCost !== null ? game.fixedOperatingCost : 0.00;

                        const systemFeeAmt = (game.projectedSales * systemPercent) / 100;
                        const retailerBonusAmt = (game.projectedSales * retailerBonusPercent) / 100;
                        const cashingBonusAmt = payoutAmt * (cashableShare / 100) * (cashingPercent / 100);
                        const jackpotBonusAmt = Math.min(jackpotCap, payoutAmt * (jackpotEligible / 100) * (jackpotPercent / 100));

                        const netAmt = game.projectedSales - (payoutAmt + commAmt + systemFeeAmt + retailerBonusAmt + cashingBonusAmt + jackpotBonusAmt + parseFloat(fixedCost));

                        return (
                          <tr key={game.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            <td style={{ padding: "10px 16px", minWidth: 160 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                <select
                                  value={game.productId || ""}
                                  onChange={(e) => handleProductSelect(index, e.target.value)}
                                  style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                >
                                  <option value="">-- Custom (Unlinked) --</option>
                                  {productsList.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                                <select
                                  value={game.budgetStatus || "new_request"}
                                  onChange={(e) => handleCellChange(index, "budgetStatus", e.target.value)}
                                  style={{ width: "100%", padding: "4px 6px", borderRadius: "4px", backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 11 }}
                                >
                                  <option value="new_request">New Revenue Estimate</option>
                                  <option value="already_booked">Baseline Revenue / Already Booked</option>
                                </select>
                              </div>
                            </td>
                            {/* Name Input */}
                            <td style={{ padding: "10px 16px" }}>
                              <input 
                                type="text"
                                value={game.name}
                                onChange={(e) => handleCellChange(index, "name", e.target.value)}
                                disabled={!!game.productId}
                                style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: game.productId ? "transparent" : "var(--surface-3)", border: game.productId ? "none" : "1px solid var(--border)", color: "var(--text)", fontSize: 13, fontWeight: game.productId ? "bold" : "normal" }}
                              />
                            </td>
                            {/* Projected Sales */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", position: "relative" }}>
                                <input 
                                  type="number"
                                  value={game.projectedSales}
                                  onChange={(e) => handleCellChange(index, "projectedSales", e.target.value)}
                                  style={{ width: 110, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                />
                                {game.productId && (
                                  <div style={{ position: "relative" }}>
                                    <button
                                      onClick={() => setActiveForecastRowIndex(activeForecastRowIndex === index ? null : index)}
                                      title="Forecasting Models"
                                      style={{
                                        padding: "4px 6px",
                                        borderRadius: "4px",
                                        backgroundColor: "var(--surface-2, #3b82f61a)",
                                        border: "1px solid var(--border)",
                                        color: "var(--blue)",
                                        cursor: "pointer",
                                        fontSize: "11px",
                                        fontWeight: "bold",
                                        display: "flex",
                                        alignItems: "center"
                                      }}
                                    >
                                      ⚡
                                    </button>
                                    {activeForecastRowIndex === index && (
                                      <div style={{
                                        position: "absolute",
                                        top: "28px",
                                        right: 0,
                                        backgroundColor: "var(--card-bg, #1e293b)",
                                        border: "1px solid var(--border)",
                                        borderRadius: "6px",
                                        padding: "12px",
                                        zIndex: 2000,
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                                        width: "220px",
                                        textAlign: "left"
                                      }}>
                                        <h4 style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                                          Forecasting Options
                                        </h4>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "4px", lineHeight: "1.4" }}>
                                            Historical Baseline: <strong style={{ color: "var(--text)" }}>${(getProductHistoricalAnnualSales(game.productId) / 1000000).toFixed(1)}M</strong>
                                            <br/>
                                            Trend: <span style={{ 
                                              color: getProductTrend(game.productId) === "Declining" ? "#ef4444" : getProductTrend(game.productId) === "Growing" ? "#22c55e" : "#3b82f6",
                                              fontWeight: "bold"
                                            }}>{getProductTrend(game.productId)}</span>
                                          </div>
                                          {(() => {
                                            const p = getProductObj(game.productId);
                                            const extCode = p ? p.externalCode : null;
                                            const forecastCat = extCode ? EXTERNAL_CODE_TO_FORECAST_CATEGORY[extCode] : null;
                                            const customVal = forecastCat ? customForecasts[forecastCat] : null;
                                            if (customVal) {
                                              return (
                                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                                  <button
                                                    onClick={() => {
                                                      applyForecastModel(index, "predictive");
                                                      setActiveForecastRowIndex(null);
                                                    }}
                                                    style={{ padding: "6px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--blue)", backgroundColor: "var(--blue-dim, rgba(0, 180, 216, 0.08))", color: "var(--blue)", cursor: "pointer", textAlign: "left", fontWeight: "600" }}
                                                  >
                                                    🔮 Apply Predictive Forecast (${(customVal / 1000000).toFixed(1)}M)
                                                  </button>
                                                  <Link
                                                    href="/analytics/forecast"
                                                    onClick={() => {
                                                      if (typeof window !== "undefined" && forecastCat) {
                                                        localStorage.setItem("stochos_selected_forecast_category", forecastCat);
                                                      }
                                                    }}
                                                    style={{ 
                                                      fontSize: "10px", 
                                                      color: "var(--text-secondary)", 
                                                      textDecoration: "underline", 
                                                      textAlign: "center", 
                                                      marginTop: "2px",
                                                      cursor: "pointer",
                                                      fontWeight: "500"
                                                    }}
                                                  >
                                                    📊 Tune in Forecasting Tool
                                                  </Link>
                                                </div>
                                              );
                                            }
                                            return null;
                                          })()}
                                          <button
                                            onClick={() => {
                                              applyForecastModel(index, "baseline");
                                              setActiveForecastRowIndex(null);
                                            }}
                                            style={{ padding: "6px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)", cursor: "pointer", textAlign: "left" }}
                                          >
                                            📋 Apply Baseline Sales
                                          </button>
                                          <button
                                            onClick={() => {
                                              applyForecastModel(index, "trend");
                                              setActiveForecastRowIndex(null);
                                            }}
                                            style={{ padding: "6px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)", cursor: "pointer", textAlign: "left" }}
                                          >
                                            📈 Trend-Adjusted (-5% if Dec)
                                          </button>
                                          <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                                            <input 
                                              type="number"
                                              placeholder="+3"
                                              id={`growth-input-${index}`}
                                              style={{ width: "55px", padding: "4px", fontSize: "11px", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                                            />
                                            <button
                                              onClick={() => {
                                                const val = parseFloat(document.getElementById(`growth-input-${index}`).value || 0);
                                                applyForecastModel(index, "custom", val);
                                                setActiveForecastRowIndex(null);
                                              }}
                                              style={{ flex: 1, padding: "4px", fontSize: "11px", borderRadius: "4px", border: "none", backgroundColor: "var(--blue)", color: "white", cursor: "pointer" }}
                                            >
                                              Apply % Growth
                                            </button>
                                          </div>
                                          {game.originalProjectedSales !== undefined && game.projectedSales !== game.originalProjectedSales && (
                                            <button
                                              onClick={() => {
                                                const updated = [...games];
                                                updated[index].projectedSales = game.originalProjectedSales;
                                                setGames(updated);
                                                setActiveForecastRowIndex(null);
                                                setSuccess(`Reverted ${game.name} back to saved scenario value.`);
                                              }}
                                              style={{ 
                                                padding: "6px 8px", 
                                                fontSize: "11px", 
                                                borderRadius: "4px", 
                                                border: "1px solid #eab308", 
                                                backgroundColor: "rgba(234, 179, 8, 0.08)", 
                                                color: "#eab308", 
                                                cursor: "pointer", 
                                                textAlign: "left",
                                                fontWeight: "600",
                                                marginTop: "6px",
                                                width: "100%"
                                              }}
                                            >
                                              ↩️ Revert to Saved (${(game.originalProjectedSales / 1000000).toFixed(1)}M)
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                            {/* Prize Payout % */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <input 
                                type="number"
                                step="0.1"
                                value={game.prizePayoutPercent}
                                onChange={(e) => handleCellChange(index, "prizePayoutPercent", e.target.value)}
                                style={{ width: 80, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              />
                            </td>
                            {/* Prize Expense Calc */}
                            <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                              ${payoutAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Retailer Comm % */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <input 
                                type="number"
                                step="0.1"
                                value={game.retailerCommPercent}
                                onChange={(e) => handleCellChange(index, "retailerCommPercent", e.target.value)}
                                style={{ width: 70, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              />
                            </td>
                            {showOpExpenses && (
                              <>
                                {/* System Fee % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={game.gamingSystemPercent ?? 2.50}
                                    onChange={(e) => handleCellChange(index, "gamingSystemPercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Retailer Bonus % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={game.retailerBonusPercent ?? 0.50}
                                    onChange={(e) => handleCellChange(index, "retailerBonusPercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Cashing Bonus % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={game.retailerCashingPercent ?? 1.00}
                                    onChange={(e) => handleCellChange(index, "retailerCashingPercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Cashable Share % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="1"
                                    value={game.cashablePrizePercent ?? 50.00}
                                    onChange={(e) => handleCellChange(index, "cashablePrizePercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Jackpot Bonus % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="0.05"
                                    value={game.jackpotBonusPercent ?? 0.50}
                                    onChange={(e) => handleCellChange(index, "jackpotBonusPercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Jackpot-Eligible Share % */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="1"
                                    value={game.jackpotEligiblePercent ?? 25.00}
                                    onChange={(e) => handleCellChange(index, "jackpotEligiblePercent", e.target.value)}
                                    style={{ width: 65, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Jackpot Cap ($) */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="1000"
                                    value={game.jackpotBonusCap ?? 1000000.00}
                                    onChange={(e) => handleCellChange(index, "jackpotBonusCap", e.target.value)}
                                    style={{ width: 95, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                {/* Fixed Cost */}
                                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                  <input 
                                    type="number"
                                    step="1000"
                                    value={game.fixedOperatingCost ?? 0.00}
                                    onChange={(e) => handleCellChange(index, "fixedOperatingCost", e.target.value)}
                                    style={{ width: 90, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                              </>
                            )}
                            {/* Net revenue contribution */}
                            <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 700 }}>
                              ${netAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Actions */}
                            <td style={{ padding: "10px 16px", textAlign: "center" }}>
                              <button 
                                onClick={() => handleRemoveGame(index)}
                                style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "4px" }}
                                title="Remove game"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
