"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from "recharts";
import { Sparkles, Sliders, Info, TrendingUp, Calendar, RefreshCw } from "lucide-react";

// Date helper to add months safely
const getNextMonthDate = (baseDateStr, monthsToAdd) => {
  const d = new Date(baseDateStr + "T00:00:00");
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsToAdd);
  return d.toISOString().split("T")[0];
};

// Date formatter
const formatMonthYear = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
};

// Dollar formatter
const formatDollar = (val) => {
  if (val === null || val === undefined) return "—";
  if (val >= 1000000000) return `$${(val / 1000000000).toFixed(2)}B`;
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  return `$${val.toLocaleString()}`;
};

export default function ForecastClient() {
  const [timeseriesData, setTimeseriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedCategory, setSelectedCategory] = useState("Total Portfolio");

  // Load selected category from localStorage on client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("stochos_selected_forecast_category");
      if (saved) setSelectedCategory(saved);
    }
  }, []);

  // Save selected category to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("stochos_selected_forecast_category", selectedCategory);
    }
  }, [selectedCategory]);

  const [selectedMetric, setSelectedMetric] = useState("grossRevenue");
  
  // Holt-Winters parameter states
  const [alpha, setAlpha] = useState(0.2); // Level smoothing
  const [beta, setBeta] = useState(0.1);  // Trend smoothing
  const [gamma, setGamma] = useState(0.3); // Seasonal smoothing
  const [horizon, setHorizon] = useState(12); // Forecast horizon (months)

  // Persistence and custom sync states
  const [customParams, setCustomParams] = useState({});
  const [paramsMounted, setParamsMounted] = useState(false);

  // Load custom params on client mount
  useEffect(() => {
    setParamsMounted(true);
    try {
      const stored = localStorage.getItem("stochos_forecast_parameters");
      if (stored) setCustomParams(JSON.parse(stored));
    } catch (e) {}
  }, []);

  // Update sliders when category changes
  useEffect(() => {
    if (!paramsMounted) return;
    const params = customParams[selectedCategory] || { alpha: 0.2, beta: 0.1, gamma: 0.3 };
    setAlpha(params.alpha);
    setBeta(params.beta);
    setGamma(params.gamma);
  }, [selectedCategory, customParams, paramsMounted]);

  const updateParam = (paramName, value) => {
    if (paramName === "alpha") setAlpha(value);
    if (paramName === "beta") setBeta(value);
    if (paramName === "gamma") setGamma(value);

    if (selectedCategory === "Total Portfolio" || selectedCategory === "Total Draw Games") return;

    const updated = {
      ...customParams,
      [selectedCategory]: {
        alpha: paramName === "alpha" ? value : alpha,
        beta: paramName === "beta" ? value : beta,
        gamma: paramName === "gamma" ? value : gamma
      }
    };
    setCustomParams(updated);
    try {
      localStorage.setItem("stochos_forecast_parameters", JSON.stringify(updated));
    } catch (e) {}
  };

  // Pre-calculate 12-month outlook for all games and save to localStorage
  useEffect(() => {
    if (timeseriesData.length === 0) return;
    if (!paramsMounted) return;
    if (typeof window === "undefined") return;

    try {
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
        const lastDate = dates[n - 1];

        let forecastsList = [];
        
        // Use custom parameters for this category if tuned, otherwise use defaults
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

      const stored = localStorage.getItem("stochos_custom_forecasts");
      const current = stored ? JSON.parse(stored) : {};
      const merged = { ...forecasts, ...current };
      localStorage.setItem("stochos_custom_forecasts", JSON.stringify(merged));
    } catch (e) {
      console.error("Failed to pre-calculate forecasts:", e);
    }
  }, [timeseriesData, customParams, paramsMounted]);

  // Save custom tuned forecast to localStorage when parameters change
  useEffect(() => {
    if (timeseriesData.length === 0) return;
    if (typeof window === "undefined") return;
    if (selectedCategory === "Total Portfolio" || selectedCategory === "Total Draw Games") return;

    try {
      const monthlyGroups = {};
      timeseriesData.forEach(item => {
        if (item.category === selectedCategory) {
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
      const lastDate = dates[n - 1];

      let forecastsList = [];

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
          a[t] = alpha * (values[t] - s[t - L]) + (1 - alpha) * (a[t - 1] + b[t - 1]);
          b[t] = beta * (a[t] - a[t - 1]) + (1 - beta) * b[t - 1];
          s[t] = gamma * (values[t] - a[t]) + (1 - gamma) * s[t - L];
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
          a[t] = alpha * values[t] + (1 - alpha) * (a[t - 1] + b[t - 1]);
          b[t] = beta * (a[t] - a[t - 1]) + (1 - beta) * b[t - 1];
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

      const stored = localStorage.getItem("stochos_custom_forecasts");
      const forecasts = stored ? JSON.parse(stored) : {};
      forecasts[selectedCategory] = sum12;
      localStorage.setItem("stochos_custom_forecasts", JSON.stringify(forecasts));
    } catch (e) {
      console.error("Failed to save custom forecast:", e);
    }
  }, [selectedCategory, alpha, beta, gamma, timeseriesData]);

  // Fetch timeseries
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/analytics/forecast");
        if (!res.ok) {
          throw new Error(`Failed to load forecast data: ${res.statusText}`);
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.timeseries)) {
          setTimeseriesData(data.timeseries);
        } else {
          throw new Error("Invalid timeseries format returned.");
        }
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to query database.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Unique categories list
  const categoriesList = useMemo(() => {
    const set = new Set(timeseriesData.map(t => t.category));
    return ["Total Portfolio", "Total Draw Games", ...Array.from(set).sort()];
  }, [timeseriesData]);

  // Aggregate monthly series based on category selection
  const aggregatedHistory = useMemo(() => {
    if (timeseriesData.length === 0) return [];

    // Group raw rows by month
    const monthlyGroups = {};
    timeseriesData.forEach(item => {
      const mStr = item.date.slice(0, 7); // Group by YYYY-MM
      if (!monthlyGroups[mStr]) {
        monthlyGroups[mStr] = [];
      }
      monthlyGroups[mStr].push(item);
    });

    const sortedMonths = Object.keys(monthlyGroups).sort();
    
    return sortedMonths.map(month => {
      const items = monthlyGroups[month];
      
      let gross = 0;
      let net = 0;
      
      if (selectedCategory === "Total Portfolio") {
        items.forEach(it => {
          gross += parseFloat(it.grossRevenue || 0);
          net += parseFloat(it.netContribution || 0);
        });
      } else if (selectedCategory === "Total Draw Games") {
        items.forEach(it => {
          if (it.category !== "Scratchers") {
            gross += parseFloat(it.grossRevenue || 0);
            net += parseFloat(it.netContribution || 0);
          }
        });
      } else {
        // Sum matching category records in the month
        items.forEach(it => {
          if (it.category.toLowerCase() === selectedCategory.toLowerCase()) {
            gross += parseFloat(it.grossRevenue || 0);
            net += parseFloat(it.netContribution || 0);
          }
        });
      }

      return {
        date: month + "-01", // standardized YYYY-MM-DD
        grossRevenue: gross,
        netContribution: net,
        value: selectedMetric === "grossRevenue" ? gross : net
      };
    }).filter(d => d.value > 0); // Strip unpopulated periods
  }, [timeseriesData, selectedCategory, selectedMetric]);

  // Dynamic Holt-Winters forecasting engine
  const forecastResults = useMemo(() => {
    const history = aggregatedHistory;
    const n = history.length;
    if (n === 0) return { model: "No Data", fitted: [], forecasts: [], stdDev: 0 };

    const values = history.map(d => d.value);
    const dates = history.map(d => d.date);
    const lastDate = dates[n - 1];

    let fitted = new Array(n).fill(null);
    let forecasts = [];
    let stdDev = 0;
    let modelName = "";

    // 1. Holt-Winters Additive Seasonality (L=12) - requires at least 2 full seasonal cycles
    if (n >= 24) {
      modelName = "Holt-Winters (Additive Seasonality)";
      const L = 12;
      let a = new Array(n).fill(0);
      let b = new Array(n).fill(0);
      let s = new Array(n + horizon).fill(0);

      // Initialise Level (average of first year)
      let sumYear1 = 0;
      for (let i = 0; i < L; i++) sumYear1 += values[i];
      const initialLevel = sumYear1 / L;
      a[L - 1] = initialLevel;

      // Initialise Trend (average gradient change year-over-year)
      let sumDiff = 0;
      for (let i = 0; i < L; i++) {
        sumDiff += (values[i + L] - values[i]) / L;
      }
      const initialTrend = sumDiff / L;
      b[L - 1] = initialTrend;

      // Initialise Seasonal Indices (first 12 months deviations)
      for (let i = 0; i < L; i++) {
        s[i] = values[i] - initialLevel;
      }

      // First year fitted is baseline
      for (let i = 0; i < L; i++) {
        fitted[i] = initialLevel + s[i];
      }

      // Recursion
      for (let t = L; t < n; t++) {
        a[t] = alpha * (values[t] - s[t - L]) + (1 - alpha) * (a[t - 1] + b[t - 1]);
        b[t] = beta * (a[t] - a[t - 1]) + (1 - beta) * b[t - 1];
        s[t] = gamma * (values[t] - a[t]) + (1 - gamma) * s[t - L];
        fitted[t] = a[t - 1] + b[t - 1] + s[t - L];
      }

      // Forecast horizon
      const lastLevel = a[n - 1];
      const lastTrend = b[n - 1];
      for (let h = 1; h <= horizon; h++) {
        const seasonalFactor = s[n - L + (h - 1) % L];
        const fVal = lastLevel + h * lastTrend + seasonalFactor;
        
        forecasts.push({
          date: getNextMonthDate(lastDate, h),
          value: fVal
        });
      }

      // Standard deviation of residuals
      let sumSqErr = 0;
      let errCount = 0;
      for (let t = L; t < n; t++) {
        const err = values[t] - fitted[t];
        sumSqErr += err * err;
        errCount++;
      }
      stdDev = Math.sqrt(sumSqErr / (errCount || 1));

    } 
    // 2. Holt's Linear Trend (Fallback for low history 6-23 data points)
    else if (n >= 6) {
      modelName = "Holt's Linear Trend (Fallback)";
      let a = new Array(n).fill(0);
      let b = new Array(n).fill(0);

      a[0] = values[0];
      b[0] = values[1] - values[0];
      fitted[0] = values[0];

      for (let t = 1; t < n; t++) {
        a[t] = alpha * values[t] + (1 - alpha) * (a[t - 1] + b[t - 1]);
        b[t] = beta * (a[t] - a[t - 1]) + (1 - beta) * b[t - 1];
        fitted[t] = a[t - 1] + b[t - 1];
      }

      const lastLevel = a[n - 1];
      const lastTrend = b[n - 1];
      for (let h = 1; h <= horizon; h++) {
        forecasts.push({
          date: getNextMonthDate(lastDate, h),
          value: lastLevel + h * lastTrend
        });
      }

      let sumSqErr = 0;
      for (let t = 1; t < n; t++) {
        const err = values[t] - fitted[t];
        sumSqErr += err * err;
      }
      stdDev = Math.sqrt(sumSqErr / (n - 1));
    } 
    // 3. Simple Average (Fallback for very low history < 6 points)
    else {
      modelName = "Simple Moving Average (Fallback)";
      const sum = values.reduce((acc, v) => acc + v, 0);
      const avg = sum / (n || 1);

      for (let h = 1; h <= horizon; h++) {
        forecasts.push({
          date: getNextMonthDate(lastDate, h),
          value: avg
        });
      }

      let sumSqErr = 0;
      for (let t = 0; t < n; t++) {
        const err = values[t] - avg;
        sumSqErr += err * err;
      }
      stdDev = Math.sqrt(sumSqErr / (n || 1));
    }

    // Add confidence intervals and boundary clips
    const forecastsWithBounds = forecasts.map((f, idx) => {
      const h = idx + 1;
      const stdErr = stdDev * Math.sqrt(1 + h * 0.08); // Scale error with horizon
      let lower = f.value - 1.96 * stdErr;
      if (lower < 0) lower = 0; // Prevent negative sales
      const upper = f.value + 1.96 * stdErr;

      return {
        ...f,
        lowerBound: lower,
        upperBound: upper
      };
    });

    return {
      model: modelName,
      fitted,
      forecasts: forecastsWithBounds,
      stdDev
    };
  }, [aggregatedHistory, alpha, beta, gamma, horizon]);

  // Combine history + forecast for single chart dataset
  const chartDataset = useMemo(() => {
    const history = aggregatedHistory;
    const { forecasts } = forecastResults;
    if (history.length === 0) return [];

    const historyData = history.map(h => ({
      date: h.date,
      formattedDate: formatMonthYear(h.date),
      actual: h.value,
      forecast: null,
      lowerBound: null,
      upperBound: null
    }));

    const forecastData = forecasts.map(f => ({
      date: f.date,
      formattedDate: formatMonthYear(f.date),
      actual: null,
      forecast: f.value,
      lowerBound: f.lowerBound,
      upperBound: f.upperBound
    }));

    // Inject last actual point into forecast dataset so the lines connect seamlessly
    if (historyData.length > 0 && forecastData.length > 0) {
      const lastActual = historyData[historyData.length - 1];
      forecastData.unshift({
        date: lastActual.date,
        formattedDate: lastActual.formattedDate,
        actual: null,
        forecast: lastActual.actual,
        lowerBound: lastActual.actual,
        upperBound: lastActual.actual
      });
    }

    return [...historyData, ...forecastData];
  }, [aggregatedHistory, forecastResults]);

  // Sum forecast totals for summary cards
  const outlookTotals = useMemo(() => {
    const { forecasts } = forecastResults;
    if (forecasts.length === 0) return { mo3: 0, mo12: 0, mo24: 0 };

    const sumHorizon = (months) => {
      const sub = forecasts.slice(0, months);
      return sub.reduce((acc, curr) => acc + (curr.value || 0), 0);
    };

    return {
      mo3: sumHorizon(3),
      mo12: sumHorizon(12),
      mo24: sumHorizon(24)
    };
  }, [forecastResults]);

  // Reset sliders to default values
  const handleResetParameters = () => {
    updateParam("alpha", 0.2);
    updateParam("beta", 0.1);
    updateParam("gamma", 0.3);
    setHorizon(24);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "300px" }}>
        <div style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Loading forecasting databases...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: "20px", border: "1px solid #ef4444" }}>
        <h3 style={{ color: "#ef4444", margin: "0 0 8px 0" }}>Database Error</h3>
        <p style={{ color: "var(--text)", margin: 0 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      
      {/* Top Filter Bar Card */}
      <div className="card">
        <div className="card-body" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {/* Category Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                Portfolio Item / Game
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-3)",
                  color: "var(--text)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "240px"
                }}
              >
                {categoriesList.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Metric Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                Forecast Target Metric
              </label>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setSelectedMetric("grossRevenue")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    border: selectedMetric === "grossRevenue" ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedMetric === "grossRevenue" ? "var(--blue-dim, rgba(0, 180, 216, 0.08))" : "var(--surface-3)",
                    color: selectedMetric === "grossRevenue" ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Gross Revenue
                </button>
                <button
                  onClick={() => setSelectedMetric("netContribution")}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "var(--radius-sm)",
                    border: selectedMetric === "netContribution" ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: selectedMetric === "netContribution" ? "var(--blue-dim, rgba(0, 180, 216, 0.08))" : "var(--surface-3)",
                    color: selectedMetric === "netContribution" ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Net Contribution
                </button>
              </div>
            </div>
          </div>

          {/* Model Status Badge */}
          <div style={{ padding: "8px 14px", backgroundColor: "var(--surface-2)", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>Active Model:</span>
            <strong style={{ fontSize: "12px", color: "var(--primary)" }}>{forecastResults.model}</strong>
          </div>
        </div>
      </div>

      {/* Value Box Summary Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">3-Month Outlook</div>
          <div className="kpi-value">{formatDollar(outlookTotals.mo3)}</div>
          <div className="kpi-subtitle">Cumulative sales forecast Q1</div>
        </div>

        <div className="kpi-card kpi-purple">
          <div className="kpi-label">12-Month Outlook</div>
          <div className="kpi-value">{formatDollar(outlookTotals.mo12)}</div>
          <div className="kpi-subtitle">Next 12 months cumulative</div>
        </div>

        <div className="kpi-card kpi-gold">
          <div className="kpi-label">24-Month Outlook</div>
          <div className="kpi-value">{formatDollar(outlookTotals.mo24)}</div>
          <div className="kpi-subtitle">Next 24 months cumulative</div>
        </div>
      </div>

      {/* Main Layout Row: Chart (Left) & Model Configuration (Right) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="flex flex-col lg:flex-row">
        
        {/* Forecast Chart Card */}
        <div className="card" style={{ flex: 8 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>Actuals vs Predictive Forecast</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Shaded band represents the 95% confidence interval of predictive variance
              </span>
            </div>
          </div>
          <div className="card-body" style={{ padding: "16px 8px 16px 0" }}>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
                data={chartDataset}
                margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis 
                  dataKey="formattedDate" 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={11}
                  tickFormatter={formatDollar}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card-bg)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    color: "var(--text)",
                    fontSize: "12px",
                    fontFamily: "Inter, sans-serif"
                  }}
                  formatter={(value, name) => [formatDollar(value), name]}
                />
                <Legend verticalAlign="top" height={36} iconSize={10} iconType="circle" />
                
                {/* Confidence Interval Band */}
                <Area
                  name="Confidence Interval"
                  dataKey="upperBound"
                  stroke="transparent"
                  fill="#10b981"
                  opacity={0.08}
                  baseValue={(entry) => entry.lowerBound}
                  legendType="none"
                />
                
                {/* Actual Sales Line */}
                <Line
                  name="Historical Actuals"
                  type="monotone"
                  dataKey="actual"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, strokeWidth: 0, fill: "var(--primary)" }}
                  activeDot={{ r: 5 }}
                />

                {/* Forecast Sales Line */}
                <Line
                  name="Model Forecast"
                  type="monotone"
                  dataKey="forecast"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  strokeDasharray="5 5"
                  dot={{ r: 2, fill: "#ef4444", strokeWidth: 0 }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Forecast Parameters Configuration Card */}
        <div className="card" style={{ flex: 4 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sliders size={16} style={{ color: "var(--primary)" }} />
              <h3>Model Parameters</h3>
            </div>
            <button
              onClick={handleResetParameters}
              title="Reset sliders to default"
              style={{
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px"
              }}
            >
              <RefreshCw size={12} /> Reset
            </button>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
              Adjust the exponential smoothing coefficients below. These constants dictate how the Holt-Winters mathematical algorithm reacts to data.
            </div>

            {/* Parameter Alpha Slider */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>Alpha (Level Smoothing)</span>
                <strong style={{ color: "var(--primary)" }}>{alpha.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0.01"
                max="1.0"
                step="0.05"
                value={alpha}
                onChange={(e) => updateParam("alpha", parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Higher values put more weight on very recent sales volume records.
              </span>
            </div>

            {/* Parameter Beta Slider */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>Beta (Trend Smoothing)</span>
                <strong style={{ color: "var(--primary)" }}>{beta.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={beta}
                disabled={aggregatedHistory.length < 6}
                onChange={(e) => updateParam("beta", parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Dictates how quickly the model adapts to recent upward or downward trends.
              </span>
            </div>

            {/* Parameter Gamma Slider */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ fontWeight: 600, color: "var(--text)" }}>Gamma (Seasonal Smoothing)</span>
                <strong style={{ color: "var(--primary)" }}>{gamma.toFixed(2)}</strong>
              </div>
              <input
                type="range"
                min="0.0"
                max="1.0"
                step="0.05"
                value={gamma}
                disabled={aggregatedHistory.length < 24}
                onChange={(e) => updateParam("gamma", parseFloat(e.target.value))}
                style={{ width: "100%", cursor: "pointer", accentColor: "var(--primary)" }}
              />
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Controls sensitivity to annual seasonal patterns (only active for over 2 years of data).
              </span>
            </div>

            {/* Parameter Horizon Selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>
                Forecast Horizon (Months)
              </label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(parseInt(e.target.value, 10))}
                style={{
                  padding: "8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-3)",
                  color: "var(--text)",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <option value={12}>12 Months Ahead</option>
                <option value={18}>18 Months Ahead</option>
                <option value={24}>24 Months Ahead (Default)</option>
                <option value={36}>36 Months Ahead</option>
              </select>
            </div>

            {/* Dynamic model notes warning */}
            <div style={{ display: "flex", gap: "8px", padding: "10px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: "6px", alignItems: "flex-start", marginTop: "8px" }}>
              <Info size={14} style={{ color: "var(--primary)", marginTop: "1px", flexShrink: 0 }} />
              <div style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                <strong>Note:</strong> Holt-Winters seasonal smoothing maps historical month-to-month patterns. Standard 95% confidence intervals scale outward with the forecast horizon.
              </div>
            </div>

            {/* Detailed Parameters Guide */}
            <details style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "10px",
              cursor: "pointer",
              marginTop: "8px"
            }}>
              <summary style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: "var(--text)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                outline: "none",
                listStyle: "none"
              }}>
                <Sliders size={13} style={{ color: "var(--primary)" }} />
                <span>Smoothing Parameters Guide</span>
              </summary>
              <div style={{
                fontSize: "11px",
                color: "var(--text-secondary)",
                lineHeight: "1.4",
                marginTop: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                cursor: "default"
              }} onClick={(e) => e.stopPropagation()}>
                <div>
                  <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Alpha (Level Smoothing):</strong>
                  Controls how much weight is given to the most recent month's actual sales vs. older historical averages.
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li><em>0.1 - 0.3 (Default):</em> Smooths out monthly noise. Best for mature/stable games.</li>
                    <li><em>0.7 - 1.0:</em> Reacts quickly. Best for newly launched games or after major jackpot/matrix changes.</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Beta (Trend Smoothing):</strong>
                  Controls how fast the model adapts to upward or downward trends.
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li><em>0.05 - 0.2 (Default):</em> Maintains a stable trajectory. Ignores short-term trend shifts.</li>
                    <li><em>0.5 - 0.8:</em> Bends the forecast line quickly when recent sales start growing or declining rapidly.</li>
                  </ul>
                </div>
                <div>
                  <strong style={{ color: "var(--text)", display: "block", marginBottom: "2px" }}>Gamma (Seasonal Smoothing):</strong>
                  Controls how strongly yearly cycles (e.g., summer/winter peaks) repeat.
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    <li><em>0.2 - 0.4 (Default):</em> Repeats seasonal peaks consistently year-over-year.</li>
                    <li><em>0.7 - 1.0:</em> Adapts seasonal patterns rapidly based on the sizes of the most recent peaks.</li>
                  </ul>
                </div>
              </div>
            </details>

          </div>
        </div>

      </div>

    </div>
  );
}
