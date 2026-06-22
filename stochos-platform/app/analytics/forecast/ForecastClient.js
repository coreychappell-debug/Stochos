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

  // New states for straightline comparisons & click-to-draw target line
  const [comparisonMode, setComparisonMode] = useState("none"); // "none", "constant", "ols", "growth"
  const [growthRate, setGrowthRate] = useState(3.0); // annual % growth rate
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [customTargets, setCustomTargets] = useState({}); // { [category_metric]: { [date]: value } }
  const [savedScenarios, setSavedScenarios] = useState({}); // { [category_metric]: { [scenarioName]: { [date]: value } } }
  const [scenarioName, setScenarioName] = useState("");
  const [activeTab, setActiveTab] = useState("model"); // "model", "target"

  // Persistence and custom sync states
  const [customParams, setCustomParams] = useState({});
  const [paramsMounted, setParamsMounted] = useState(false);

  // Load custom params, targets, and scenarios on client mount
  useEffect(() => {
    setParamsMounted(true);
    try {
      const stored = localStorage.getItem("stochos_forecast_parameters");
      if (stored) setCustomParams(JSON.parse(stored));
    } catch (e) {}
    try {
      const storedTargets = localStorage.getItem("stochos_custom_forecast_targets");
      if (storedTargets) setCustomTargets(JSON.parse(storedTargets));
    } catch (e) {}
    try {
      const storedScenarios = localStorage.getItem("stochos_saved_forecast_scenarios");
      if (storedScenarios) setSavedScenarios(JSON.parse(storedScenarios));
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
        const now = new Date();
        const currentYearMonth = now.toISOString().slice(0, 7); // "2026-06"

        const aggregated = sortedMonths
          .filter(month => month < currentYearMonth) // Filter out incomplete current month
          .map(month => {
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
      const now = new Date();
      const currentYearMonth = now.toISOString().slice(0, 7); // "2026-06"

      const aggregated = sortedMonths
        .filter(month => month < currentYearMonth) // Filter out incomplete current month
        .map(month => {
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
    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7); // e.g., "2026-06"
    
    return sortedMonths
      .filter(month => month < currentYearMonth) // Filter out current incomplete month & future months
      .map(month => {
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

  // Compute OLS Linear Regression for historical data
  const olsParams = useMemo(() => {
    const history = aggregatedHistory;
    const n = history.length;
    if (n < 2) return { m: 0, c: 0, active: false };

    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = history[i].value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    }

    const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const c = (sumY - m * sumX) / n;
    return { m, c, active: true };
  }, [aggregatedHistory]);

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

    const combinedData = [...historyData, ...forecastData];
    const n = history.length;
    const lastActualVal = history[n - 1].value;

    // Get custom targets key
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const targets = customTargets[currentKey] || {};

    // Gather future dates and values (start with last historical date)
    const futureDates = [history[n - 1].date, ...forecasts.map(f => f.date)];
    const futureValues = new Array(futureDates.length).fill(null);
    futureValues[0] = lastActualVal;

    for (let i = 1; i < futureDates.length; i++) {
      const d = futureDates[i];
      if (targets[d] !== undefined) {
        futureValues[i] = targets[d];
      }
    }

    // Linear interpolation
    let lastNonNullIdx = 0;
    for (let i = 1; i < futureValues.length; i++) {
      if (futureValues[i] !== null) {
        const valStart = futureValues[lastNonNullIdx];
        const valEnd = futureValues[i];
        const steps = i - lastNonNullIdx;
        for (let k = lastNonNullIdx + 1; k < i; k++) {
          futureValues[k] = valStart + ((valEnd - valStart) / steps) * (k - lastNonNullIdx);
        }
        lastNonNullIdx = i;
      }
    }
    for (let i = lastNonNullIdx + 1; i < futureValues.length; i++) {
      futureValues[i] = futureValues[lastNonNullIdx];
    }

    return combinedData.map((item, idx) => {
      let step = idx;
      let isForecast = idx >= n;
      if (isForecast) {
        step = n - 1 + (idx - n);
      }

      // OLS
      const olsLine = olsParams.active ? olsParams.m * step + olsParams.c : null;

      // Constant
      let constantLine = null;
      if (idx >= n - 1) {
        constantLine = lastActualVal;
      }

      // Growth
      let growthLine = null;
      if (idx >= n - 1) {
        const forecastStep = idx - (n - 1);
        const monthlyRate = Math.pow(1 + growthRate / 100, 1 / 12) - 1;
        growthLine = lastActualVal * Math.pow(1 + monthlyRate, forecastStep);
      }

      // Custom Target
      let customTarget = null;
      if (idx >= n - 1) {
        const forecastStep = idx - (n - 1);
        customTarget = futureValues[forecastStep];
      }

      return {
        ...item,
        olsLine,
        constantLine,
        growthLine,
        customTarget
      };
    });
  }, [aggregatedHistory, forecastResults, olsParams, customTargets, selectedCategory, selectedMetric, growthRate]);

  // Determine chart maximum domain bounds dynamically
  const yBounds = useMemo(() => {
    if (chartDataset.length === 0) return { min: 0, max: 100 };
    let maxVal = 0;

    chartDataset.forEach(d => {
      if (d.actual && d.actual > maxVal) maxVal = d.actual;
      if (d.forecast && d.forecast > maxVal) maxVal = d.forecast;
      if (d.upperBound && d.upperBound > maxVal) maxVal = d.upperBound;
      if (d.olsLine && d.olsLine > maxVal) maxVal = d.olsLine;
      if (d.constantLine && d.constantLine > maxVal) maxVal = d.constantLine;
      if (d.growthLine && d.growthLine > maxVal) maxVal = d.growthLine;
      if (d.customTarget && d.customTarget > maxVal) maxVal = d.customTarget;
    });

    return {
      min: 0,
      max: maxVal > 0 ? maxVal * 1.15 : 100
    };
  }, [chartDataset]);

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

  // Anchor interaction functions
  const handleRemoveAnchor = (date) => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const currentPoints = { ...(customTargets[currentKey] || {}) };
    delete currentPoints[date];

    const updatedTargets = { ...customTargets, [currentKey]: currentPoints };
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  const handleClearTarget = () => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const updatedTargets = { ...customTargets };
    delete updatedTargets[currentKey];
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  const handleCopyForecastToTarget = () => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const { forecasts } = forecastResults;
    if (forecasts.length === 0) return;

    const newPoints = {};
    forecasts.forEach(f => {
      newPoints[f.date] = f.value;
    });

    const updatedTargets = { ...customTargets, [currentKey]: newPoints };
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  const handleCopyOlsToTarget = () => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const { forecasts } = forecastResults;
    if (forecasts.length === 0 || !olsParams.active) return;

    const historyLength = aggregatedHistory.length;
    const newPoints = {};
    forecasts.forEach((f, idx) => {
      const step = historyLength + idx;
      newPoints[f.date] = olsParams.m * step + olsParams.c;
    });

    const updatedTargets = { ...customTargets, [currentKey]: newPoints };
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return;
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const currentPoints = customTargets[currentKey] || {};

    const categoryScenarios = savedScenarios[currentKey] || {};
    const updatedCategoryScenarios = {
      ...categoryScenarios,
      [scenarioName.trim()]: currentPoints
    };

    const updatedScenarios = {
      ...savedScenarios,
      [currentKey]: updatedCategoryScenarios
    };

    setSavedScenarios(updatedScenarios);
    try {
      localStorage.setItem("stochos_saved_forecast_scenarios", JSON.stringify(updatedScenarios));
    } catch (e) {}
    setScenarioName("");
  };

  const handleLoadScenario = (name) => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const categoryScenarios = savedScenarios[currentKey] || {};
    const targetPoints = categoryScenarios[name];
    if (!targetPoints) return;

    const updatedTargets = {
      ...customTargets,
      [currentKey]: targetPoints
    };
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  const handleDeleteScenario = (name) => {
    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const categoryScenarios = { ...(savedScenarios[currentKey] || {}) };
    delete categoryScenarios[name];

    const updatedScenarios = {
      ...savedScenarios,
      [currentKey]: categoryScenarios
    };
    setSavedScenarios(updatedScenarios);
    try {
      localStorage.setItem("stochos_saved_forecast_scenarios", JSON.stringify(updatedScenarios));
    } catch (e) {}
  };

  const handleChartClick = (e) => {
    if (!isDrawingMode || !e) return;

    let index = e.activeTooltipIndex;
    if (index === undefined && e.activeLabel) {
      // Robust fallback lookup by label
      index = chartDataset.findIndex(
        d => d.formattedDate === e.activeLabel || d.date === e.activeLabel
      );
    }

    if (index === undefined || index < 0) return;

    const historyLength = aggregatedHistory.length;
    if (index < historyLength) return; // Ignore clicks in historical actuals

    const item = chartDataset[index];
    if (!item) return;

    // Invert pixel Y relative to plot area (height 400px, top margin 10px, bottom margin 5px)
    const plotTop = 10;
    const plotBottom = 395;
    const plotHeight = plotBottom - plotTop;
    const fraction = (e.chartY - plotTop) / plotHeight;

    let clickedValue = yBounds.max - fraction * yBounds.max;
    if (clickedValue < 0) clickedValue = 0;

    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const currentPoints = { ...(customTargets[currentKey] || {}) };
    currentPoints[item.date] = clickedValue;

    const updatedTargets = { ...customTargets, [currentKey]: currentPoints };
    setCustomTargets(updatedTargets);
    try {
      localStorage.setItem("stochos_custom_forecast_targets", JSON.stringify(updatedTargets));
    } catch (e) {}
  };

  // Cumulative scenario comparisons
  const cumulativeComparison = useMemo(() => {
    const { forecasts } = forecastResults;
    if (forecasts.length === 0) return { hw: 0, ols: 0, growth: 0, target: 0, variance: 0, variancePct: 0, hasTarget: false };

    const historyLength = aggregatedHistory.length;
    const lastActualVal = historyLength > 0 ? aggregatedHistory[historyLength - 1].value : 0;

    const hw = forecasts.reduce((acc, f) => acc + Math.max(0, f.value), 0);

    let ols = 0;
    if (olsParams.active) {
      for (let h = 1; h <= horizon; h++) {
        const step = historyLength - 1 + h;
        ols += Math.max(0, olsParams.m * step + olsParams.c);
      }
    }

    let growth = 0;
    const monthlyRate = Math.pow(1 + growthRate / 100, 1 / 12) - 1;
    for (let h = 1; h <= horizon; h++) {
      growth += Math.max(0, lastActualVal * Math.pow(1 + monthlyRate, h));
    }

    let target = 0;
    let targetPointsFound = false;

    const currentKey = `${selectedCategory}_${selectedMetric}`;
    const targets = customTargets[currentKey] || {};
    if (Object.keys(targets).length > 0) {
      targetPointsFound = true;
    }

    const forecastPart = chartDataset.slice(historyLength);
    for (let i = 1; i < forecastPart.length; i++) {
      target += Math.max(0, forecastPart[i].customTarget || 0);
    }

    const variance = target - hw;
    const variancePct = hw > 0 ? (variance / hw) * 100 : 0;

    return {
      hw,
      ols,
      growth,
      target,
      variance,
      variancePct,
      hasTarget: targetPointsFound
    };
  }, [forecastResults, olsParams, horizon, growthRate, chartDataset, customTargets, selectedCategory, selectedMetric, aggregatedHistory]);

  const currentKey = `${selectedCategory}_${selectedMetric}`;
  const currentCategoryTargets = customTargets[currentKey] || {};
  const hasCustomTarget = Object.keys(currentCategoryTargets).length > 0;

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

      {/* Main Layout Row: Chart (Left) & Configuration Tabs (Right) */}
      <div style={{ display: "flex", gap: "24px" }} className="flex flex-col lg:flex-row">
        
        {/* Forecast Chart Card */}
        <div className="card" style={{ flex: 8, display: "flex", flexDirection: "column" }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3>Actuals vs Predictive Forecast</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Shaded band represents the 95% confidence interval of predictive variance
              </span>
            </div>

            {/* Chart Toolbars */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              
              {/* Straightline Comparison Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase" }}>Compare:</span>
                <select
                  value={comparisonMode}
                  onChange={(e) => setComparisonMode(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    backgroundColor: "var(--surface-3)",
                    color: "var(--text)",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  <option value="none">None (HW Only)</option>
                  <option value="constant">Constant Projection</option>
                  <option value="ols">OLS Trendline</option>
                  <option value="growth">Target Growth Rate</option>
                </select>
              </div>

              {/* Toggle Drawing Mode */}
              <button
                onClick={() => setIsDrawingMode(!isDrawingMode)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: isDrawingMode ? "1px solid var(--purple)" : "1px solid var(--border)",
                  backgroundColor: isDrawingMode ? "var(--purple-dim, rgba(140, 123, 250, 0.08))" : "var(--surface-3)",
                  color: isDrawingMode ? "var(--purple)" : "var(--text-secondary)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                title="Toggle Click-to-Draw Targets on Chart"
              >
                <Sparkles size={13} style={{ color: isDrawingMode ? "var(--purple)" : "inherit" }} />
                {isDrawingMode ? "Drawing Mode On" : "Draw Target Line"}
              </button>
            </div>
          </div>

          <div className="card-body" style={{ padding: "16px 8px 16px 0", flex: 1 }}>
            
            {/* Draw Mode Info Alert Banner */}
            {isDrawingMode && (
              <div style={{
                margin: "0 16px 12px 16px",
                padding: "8px 12px",
                backgroundColor: "var(--purple-dim, rgba(140, 123, 250, 0.08))",
                border: "1px dashed var(--purple)",
                borderRadius: "6px",
                fontSize: "11.5px",
                color: "var(--text)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span>
                  <strong>✏️ Target Drawing Active:</strong> Click on vertical grid lines in the future timeline (future months) to place target anchors. Click an existing anchor dot to remove it.
                </span>
                <button
                  onClick={handleClearTarget}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--red)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: "bold",
                    padding: 0
                  }}
                >
                  Clear Canvas
                </button>
              </div>
            )}

            {/* Set pointer cursor when drawing mode is on */}
            <div style={{ cursor: isDrawingMode ? "crosshair" : "default", width: "100%", height: 400 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartDataset}
                  margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
                  onClick={handleChartClick}
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
                    domain={[0, yBounds.max]}
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

                  {/* Constant Baseline Comparison Line */}
                  {comparisonMode === "constant" && (
                    <Line
                      name="Constant Baseline"
                      type="monotone"
                      dataKey="constantLine"
                      stroke="var(--gold)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                  )}

                  {/* OLS Trendline Comparison Line */}
                  {comparisonMode === "ols" && (
                    <Line
                      name="OLS Trendline"
                      type="monotone"
                      dataKey="olsLine"
                      stroke="var(--gold)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                  )}

                  {/* Growth Target Comparison Line */}
                  {comparisonMode === "growth" && (
                    <Line
                      name={`Growth Target (${growthRate}%)`}
                      type="monotone"
                      dataKey="growthLine"
                      stroke="var(--gold)"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={false}
                    />
                  )}

                  {/* User Custom Target Line (Drawn) */}
                  {(isDrawingMode || hasCustomTarget) && (
                    <Line
                      name="Custom User Target"
                      type="monotone"
                      dataKey="customTarget"
                      stroke="var(--purple)"
                      strokeWidth={3}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (!cx || !cy || !payload) return null;
                        
                        // Draw anchor dot only if explicitly placed by user
                        const val = currentCategoryTargets[payload.date];
                        if (val !== undefined) {
                          return (
                            <circle
                              key={`anchor-${payload.date}`}
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill="var(--purple)"
                              stroke="var(--card-bg)"
                              strokeWidth={2}
                              style={{ cursor: "pointer" }}
                              onClick={(e) => {
                                // Prevent double trigger on chart click
                                e.stopPropagation();
                                if (isDrawingMode) {
                                  handleRemoveAnchor(payload.date);
                                }
                              }}
                            />
                          );
                        }
                        return null;
                      }}
                      activeDot={{ r: 8, fill: "var(--purple)" }}
                    />
                  )}

                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Configuration Drawer: Tabs for parameters & target planning */}
        <div className="card" style={{ flex: 4 }}>
          {/* Tab Headers */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
            <button
              onClick={() => setActiveTab("model")}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: activeTab === "model" ? "transparent" : "var(--surface-1)",
                border: "none",
                borderBottom: activeTab === "model" ? "2px solid var(--primary)" : "none",
                color: activeTab === "model" ? "var(--text)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s"
              }}
            >
              Predictive Model
            </button>
            <button
              onClick={() => setActiveTab("target")}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: activeTab === "target" ? "transparent" : "var(--surface-1)",
                border: "none",
                borderBottom: activeTab === "target" ? "2px solid var(--primary)" : "none",
                color: activeTab === "target" ? "var(--text)" : "var(--text-secondary)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s"
              }}
            >
              Targets & Scenarios
            </button>
          </div>

          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "20px" }}>
            
            {activeTab === "model" ? (
              <>
                {/* --- Tab 1: Holt-Winters Smoothing Parameters --- */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Sliders size={16} style={{ color: "var(--primary)" }} />
                    <h3 style={{ fontSize: "14px", margin: 0 }}>Model Parameters</h3>
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

                {/* Info Note Banner */}
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
                        <li><em>0.7 - 1.0:</em> Reacts quickly. Best for newly launched games.</li>
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
                        <li><em>0.7 - 1.0:</em> Adapts seasonal patterns rapidly.</li>
                      </ul>
                    </div>
                  </div>
                </details>
              </>
            ) : (
              <>
                {/* --- Tab 2: Custom Target Drawing & Scenario Manager --- */}
                {/* Growth Rate Comparison Slider */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>Seed Growth Rate (Annual)</span>
                    <strong style={{ color: "var(--gold)" }}>{growthRate > 0 ? `+${growthRate.toFixed(1)}%` : `${growthRate.toFixed(1)}%`}</strong>
                  </div>
                  <input
                    type="range"
                    min="-10.0"
                    max="20.0"
                    step="0.5"
                    value={growthRate}
                    onChange={(e) => setGrowthRate(parseFloat(e.target.value))}
                    style={{ width: "100%", cursor: "pointer", accentColor: "var(--gold)" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                    Sets the comparison growth line and seeds flat targets starting from the last actual.
                  </span>
                </div>

                {/* Drawing / Target Canvas Controls */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>Canvas Actions</h4>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button
                      onClick={handleCopyForecastToTarget}
                      style={{
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text)",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                      title="Seed canvas with Holt-Winters forecast values"
                    >
                      Copy Forecast
                    </button>
                    <button
                      onClick={handleCopyOlsToTarget}
                      disabled={!olsParams.active}
                      style={{
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                        backgroundColor: "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: "var(--text)",
                        cursor: "pointer",
                        opacity: olsParams.active ? 1 : 0.5,
                        transition: "all 0.15s"
                      }}
                      title="Seed canvas with OLS trendline"
                    >
                      Copy OLS Trend
                    </button>
                  </div>
                  <button
                    onClick={handleClearTarget}
                    disabled={!cumulativeComparison.hasTarget}
                    style={{
                      padding: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      backgroundColor: "rgba(255, 107, 139, 0.08)",
                      border: "1px solid rgba(255, 107, 139, 0.2)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--red)",
                      cursor: "pointer",
                      opacity: cumulativeComparison.hasTarget ? 1 : 0.5,
                      transition: "all 0.15s"
                    }}
                  >
                    Clear Target Canvas
                  </button>
                </div>

                {/* Active Target Anchors List */}
                {Object.keys(currentCategoryTargets).length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                    <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>Active Target Anchors</h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "150px", overflowY: "auto", paddingRight: "4px" }}>
                      {Object.keys(currentCategoryTargets).sort().map(date => (
                        <div key={date} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "var(--surface-3)", borderRadius: "4px", border: "1px solid var(--border)" }}>
                          <span style={{ fontSize: "12px", color: "var(--text)" }}>
                            <strong>{formatMonthYear(date)}:</strong> {formatDollar(currentCategoryTargets[date])}
                          </span>
                          <button
                            onClick={() => handleRemoveAnchor(date)}
                            style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "11px", fontWeight: "bold", padding: "0 2px" }}
                            title="Remove anchor point"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scenario Saving Manager */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>Save Scenario</h4>
                  
                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      placeholder="e.g. FY27 Expansion Target"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)",
                        backgroundColor: "var(--surface-3)",
                        color: "var(--text)",
                        fontSize: "12px"
                      }}
                    />
                    <button
                      onClick={handleSaveScenario}
                      disabled={!scenarioName.trim() || !cumulativeComparison.hasTarget}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        backgroundColor: (scenarioName.trim() && cumulativeComparison.hasTarget) ? "var(--primary)" : "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: (scenarioName.trim() && cumulativeComparison.hasTarget) ? "#000" : "var(--text-secondary)",
                        cursor: "pointer",
                        transition: "all 0.15s"
                      }}
                    >
                      Save
                    </button>
                  </div>

                  {/* Saved Scenarios List */}
                  {Object.keys(savedScenarios[currentKey] || {}).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "6px", maxHeight: "120px", overflowY: "auto" }}>
                      {Object.keys(savedScenarios[currentKey] || {}).map(name => (
                        <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "var(--surface-3)", borderRadius: "4px", border: "1px solid var(--border)" }}>
                          <span
                            onClick={() => handleLoadScenario(name)}
                            style={{ fontSize: "12px", color: "var(--text)", cursor: "pointer", textDecoration: "underline" }}
                            title={`Click to load scenario: ${name}`}
                          >
                            {name}
                          </span>
                          <button
                            onClick={() => handleDeleteScenario(name)}
                            style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Scenario Variance KPI Calculations */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
                  <h4 style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)", textTransform: "uppercase", marginBottom: "4px" }}>Scenario Variance ({horizon}mo)</h4>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>Holt-Winters Total:</span>
                      <strong style={{ color: "var(--text)" }}>{formatDollar(cumulativeComparison.hw)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>OLS Trend Total:</span>
                      <strong style={{ color: "var(--text)" }}>{formatDollar(cumulativeComparison.ols)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-secondary)" }}>User Target Total:</span>
                      <strong style={{ color: "var(--purple)" }}>{cumulativeComparison.hasTarget ? formatDollar(cumulativeComparison.target) : "— (Draw target first)"}</strong>
                    </div>

                    {cumulativeComparison.hasTarget && (
                      <div style={{
                        marginTop: "6px",
                        padding: "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        backgroundColor: cumulativeComparison.variance >= 0 ? "var(--green-dim)" : "var(--red-dim)",
                        border: `1px solid ${cumulativeComparison.variance >= 0 ? "rgba(6, 214, 160, 0.2)" : "rgba(255, 107, 139, 0.2)"}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}>
                        <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--text-secondary)" }}>Variance to HW:</span>
                        <strong style={{
                          color: cumulativeComparison.variance >= 0 ? "var(--green)" : "var(--red)",
                          fontSize: "12.5px"
                        }}>
                          {cumulativeComparison.variance >= 0 ? "+" : ""}{formatDollar(cumulativeComparison.variance)} ({cumulativeComparison.variance >= 0 ? "+" : ""}{cumulativeComparison.variancePct.toFixed(1)}%)
                        </strong>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

      </div>

    </div>
  );
}
