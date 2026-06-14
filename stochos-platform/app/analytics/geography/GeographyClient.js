"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from "recharts";
import {
  Map,
  Search,
  Filter,
  Layers,
  TrendingUp,
  Trophy,
  City,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw
} from "lucide-react";

// Categorical DMA colors
const DMA_COLORS = {
  "New York City DMA": "#3b82f6",
  "Albany-Schenectady-Troy DMA": "#10b981",
  "Syracuse DMA": "#f59e0b",
  "Buffalo DMA": "#ef4444",
  "Rochester DMA": "#8b5cf6",
  "Utica DMA": "#ec4899",
  "Binghamton DMA": "#14b8a6",
  "Elmira DMA": "#6366f1",
  "default": "#94a3b8"
};

// Categorical Service Center colors
const CENTER_COLORS = {
  "Schenectady": "#10b981",
  "Syracuse": "#f59e0b",
  "Buffalo": "#ef4444",
  "Rochester": "#8b5cf6",
  "Manhattan (NYC)": "#3b82f6",
  "Long Island (Garden City)": "#ec4899",
  "Fishkill": "#14b8a6",
  "default": "#94a3b8"
};

// Hex interpolation helper
const interpolateColor = (color1, color2, factor) => {
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);
  
  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `rgb(${r}, ${g}, ${b})`;
};

const formatCount = (val) => {
  if (val === null || val === undefined) return "0";
  return Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatPercent = (val) => {
  if (val === null || val === undefined) return "0.0%";
  return (Number(val) * 100).toFixed(1) + "%";
};

const formatDollar = (val) => {
  if (val === null || val === undefined) return "$0";
  return "$" + Number(val).toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const METRICS = [
  { key: "netContribution", label: "Net Contribution" },
  { key: "grossRevenue", label: "Gross Revenue" },
  { key: "salesPerCapita", label: "Sales Per Capita" },
  { key: "retailerCount", label: "Retailer Count" }
];

export default function GeographyClient() {
  const [mounted, setMounted] = useState(false);
  const [selectedCounties, setSelectedCounties] = useState([]);
  const [selectedChannels, setSelectedChannels] = useState([]);
  const [mapCriteria, setMapCriteria] = useState("sales_per_capita");
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [mapError, setMapError] = useState(null);

  // API loaded states
  const [rawContributions, setRawContributions] = useState([]);
  const [rawChannelMixes, setRawChannelMixes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Interactive capabilities states
  const [activeMetric, setActiveMetric] = useState("netContribution");
  const [channelViewMode, setChannelViewMode] = useState("table");

  // Theme tracking
  const [themeName, setThemeName] = useState("classic");
  const [isLight, setIsLight] = useState(false);

  // Table states - County
  const [countySearch, setCountySearch] = useState("");
  const [countySortField, setCountySortField] = useState("netContribution");
  const [countySortAsc, setCountySortAsc] = useState(false);
  const [countyCurrentPage, setCountyCurrentPage] = useState(1);

  // Auto-sort county leaderboard when active metric changes
  useEffect(() => {
    setCountySortField(activeMetric);
    setCountySortAsc(false);
    setCountyCurrentPage(1);
  }, [activeMetric]);

  // Table states - City
  const [citySearch, setCitySearch] = useState("");
  const [citySortField, setCitySortField] = useState("netContribution");
  const [citySortAsc, setCitySortAsc] = useState(false);
  const [cityCurrentPage, setCityCurrentPage] = useState(1);

  // Table states - Channel
  const [channelSearch, setChannelSearch] = useState("");
  const [channelSortField, setChannelSortField] = useState("grossRevenue");
  const [channelSortAsc, setChannelSortAsc] = useState(false);
  const [channelCurrentPage, setChannelCurrentPage] = useState(1);

  const itemsPerPage = 15;

  const [map, setMap] = useState(null);
  const containerRef = useRef(null);
  const geojsonLayerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    // Fetch geojson statically
    fetch("/new-york-counties.geojson?v=1.0.1")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("json")) {
          throw new TypeError("MIME type error: Expected JSON but received " + contentType);
        }
        return res.json();
      })
      .then((data) => setGeoJsonData(data))
      .catch((err) => {
        console.error("Failed to fetch counties geojson:", err);
        setMapError("Failed to fetch counties boundary map data: " + err.message);
      });
 
    // Fetch metrics from API
    fetch("/api/analytics/geography")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          const combined = [...data.counties, ...data.cities];
          setRawContributions(combined);
          setRawChannelMixes(data.channelMixes);
        } else {
          setMapError("API Error: " + (data.error || "Unknown error"));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load geography analytics data:", err);
        setMapError("Failed to load dashboard statistics: " + err.message);
        setLoading(false);
      });
  }, []);

  // Sync theme changes
  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkTheme = () => {
      const classList = document.body.classList;
      setIsLight(classList.contains("light-theme"));
      if (classList.contains("theme-newyork")) setThemeName("newyork");
      else if (classList.contains("theme-california")) setThemeName("california");
      else if (classList.contains("theme-texas")) setThemeName("texas");
      else if (classList.contains("theme-florida")) setThemeName("florida");
      else if (classList.contains("theme-georgia")) setThemeName("georgia");
      else if (classList.contains("theme-michigan")) setThemeName("michigan");
      else if (classList.contains("theme-ohio")) setThemeName("ohio");
      else if (classList.contains("theme-massachusetts")) setThemeName("massachusetts");
      else if (classList.contains("theme-kentucky")) setThemeName("kentucky");
      else if (classList.contains("theme-oregon")) setThemeName("oregon");
      else if (classList.contains("theme-colorado")) setThemeName("colorado");
      else setThemeName("classic");
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const themeColors = useMemo(() => {
    if (themeName === "newyork") {
      return isLight
        ? { primary: "#107c41", secondary: "#c69214" }
        : { primary: "#00a651", secondary: "#fed103" };
    }
    if (themeName === "california") {
      return isLight
        ? { primary: "#0284c7", secondary: "#d97706" }
        : { primary: "#38bdf8", secondary: "#fbbf24" };
    }
    if (themeName === "texas") {
      return isLight
        ? { primary: "#0ea5e9", secondary: "#dc2626" }
        : { primary: "#00a8cc", secondary: "#ff5252" };
    }
    if (themeName === "florida") {
      return isLight
        ? { primary: "#ea580c", secondary: "#0d9488" }
        : { primary: "#ff8f00", secondary: "#06d6a0" };
    }
    if (themeName === "georgia") {
      return isLight
        ? { primary: "#e05330", secondary: "#364fc7" }
        : { primary: "#ff7a59", secondary: "#4c6ef5" };
    }
    if (themeName === "michigan") {
      return isLight
        ? { primary: "#006666", secondary: "#206040" }
        : { primary: "#008b8b", secondary: "#40a070" };
    }
    if (themeName === "ohio") {
      return isLight
        ? { primary: "#ba001d", secondary: "#5c6b73" }
        : { primary: "#d90429", secondary: "#8d99ae" };
    }
    if (themeName === "massachusetts") {
      return isLight
        ? { primary: "#003366", secondary: "#b47a00" }
        : { primary: "#1d4ed8", secondary: "#cc9900" };
    }
    if (themeName === "kentucky") {
      return isLight
        ? { primary: "#004085", secondary: "#0b7285" }
        : { primary: "#0056b3", secondary: "#3bc9db" };
    }
    if (themeName === "oregon") {
      return isLight
        ? { primary: "#14532d", secondary: "#0284c7" }
        : { primary: "#208858", secondary: "#38bdf8" };
    }
    if (themeName === "colorado") {
      return isLight
        ? { primary: "#c27a00", secondary: "#0d7474" }
        : { primary: "#f9a602", secondary: "#4ca3a3" };
    }
    return isLight
      ? { primary: "#0070f3", secondary: "#10b981" }
      : { primary: "#3b82f6", secondary: "#10b981" };
  }, [themeName, isLight]);

  // Cast dataset values
  const contributions = useMemo(() => {
    return rawContributions.map((item) => ({
      ...item,
      grossRevenue: Number(item.grossRevenue || 0),
      netContribution: Number(item.netContribution || 0),
      avgSalesPerRetailer: Number(item.avgSalesPerRetailer || 0),
      contributionRate: Number(item.contributionRate || 0),
      drawShare: Number(item.drawShare || 0),
      scratchShare: Number(item.scratchShare || 0),
      population: item.population ? Number(item.population) : null,
      landArea: item.landArea ? Number(item.landArea) : null,
      medianIncome: item.medianIncome ? Number(item.medianIncome) : null,
      salesPerCapita: item.salesPerCapita ? Number(item.salesPerCapita) : null,
      netContributionPerCapita: item.netContributionPerCapita ? Number(item.netContributionPerCapita) : null,
      retailersPerSqMile: item.retailersPerSqMile ? Number(item.retailersPerSqMile) : null,
      residentsPerRetailer: item.residentsPerRetailer ? Number(item.residentsPerRetailer) : null,
    }));
  }, [rawContributions]);

  const channelMixes = useMemo(() => {
    return rawChannelMixes.map((item) => ({
      ...item,
      retailerCount: Number(item.retailerCount || 0),
      grossRevenue: Number(item.grossRevenue || 0),
      netContribution: Number(item.netContribution || 0),
      drawShare: Number(item.drawShare || 0),
      scratchShare: Number(item.scratchShare || 0),
    }));
  }, [rawChannelMixes]);

  // Filters setup
  const uniqueCounties = useMemo(() => {
    const set = new Set(
      contributions
        .filter((item) => item.geoLevel === "county" && item.county !== "Unknown")
        .map((item) => item.county)
    );
    return Array.from(set).sort();
  }, [contributions]);

  const uniqueChannels = useMemo(() => {
    const set = new Set(channelMixes.map((item) => item.businessType).filter(Boolean));
    return Array.from(set).sort();
  }, [channelMixes]);

  // Filter handlers
  const handleCountyToggle = (county) => {
    setSelectedCounties((prev) =>
      prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]
    );
    setCountyCurrentPage(1);
    setCityCurrentPage(1);
    setChannelCurrentPage(1);
  };

  const handleChannelToggle = (channel) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((ch) => ch !== channel) : [...prev, channel]
    );
    setChannelCurrentPage(1);
  };

  const resetFilters = () => {
    setSelectedCounties([]);
    setSelectedChannels([]);
    setCountyCurrentPage(1);
    setCityCurrentPage(1);
    setChannelCurrentPage(1);
  };

  // Map database data by county name
  const countyDataMap = useMemo(() => {
    const map = {};
    contributions.forEach((item) => {
      if (item.geoLevel === "county") {
        map[item.county.toLowerCase()] = item;
      }
    });
    return map;
  }, [contributions]);

  const getCountyDbData = (feature) => {
    const name = feature.properties.name;
    const cleanName = name.replace(" County", "").toLowerCase();
    return countyDataMap[cleanName] || null;
  };

  // Compute stats for choropleth scale
  const numericStats = useMemo(() => {
    const stats = {
      salesPerCapita: { min: Infinity, max: -Infinity },
      retailerDensity: { min: Infinity, max: -Infinity },
      medianIncome: { min: Infinity, max: -Infinity },
      netContribution: { min: Infinity, max: -Infinity }
    };

    contributions.forEach((item) => {
      if (item.geoLevel === "county" && item.county !== "Unknown") {
        const spc = item.salesPerCapita;
        const dens = item.retailersPerSqMile;
        const inc = item.medianIncome;
        const net = item.netContribution;

        if (spc !== null && spc > 0) {
          stats.salesPerCapita.min = Math.min(stats.salesPerCapita.min, spc);
          stats.salesPerCapita.max = Math.max(stats.salesPerCapita.max, spc);
        }
        if (dens !== null && dens > 0) {
          stats.retailerDensity.min = Math.min(stats.retailerDensity.min, dens);
          stats.retailerDensity.max = Math.max(stats.retailerDensity.max, dens);
        }
        if (inc !== null && inc > 0) {
          stats.medianIncome.min = Math.min(stats.medianIncome.min, inc);
          stats.medianIncome.max = Math.max(stats.medianIncome.max, inc);
        }
        if (net !== null && net > 0) {
          stats.netContribution.min = Math.min(stats.netContribution.min, net);
          stats.netContribution.max = Math.max(stats.netContribution.max, net);
        }
      }
    });

    if (stats.salesPerCapita.min === Infinity) stats.salesPerCapita = { min: 10, max: 1000 };
    if (stats.retailerDensity.min === Infinity) stats.retailerDensity = { min: 0.001, max: 5 };
    if (stats.medianIncome.min === Infinity) stats.medianIncome = { min: 30000, max: 150000 };
    if (stats.netContribution.min === Infinity) stats.netContribution = { min: 100000, max: 500000000 };

    return stats;
  }, [contributions]);

  // Sort county values for rank-based styling (prevents scale compression from outliers)
  const countyValuesSorted = useMemo(() => {
    const sorted = {
      salesPerCapita: [],
      retailerDensity: [],
      medianIncome: [],
      netContribution: []
    };

    contributions.forEach((item) => {
      if (item.geoLevel === "county" && item.county !== "Unknown") {
        if (item.salesPerCapita !== null && item.salesPerCapita > 0) {
          sorted.salesPerCapita.push(item.salesPerCapita);
        }
        if (item.retailersPerSqMile !== null && item.retailersPerSqMile > 0) {
          sorted.retailerDensity.push(item.retailersPerSqMile);
        }
        if (item.medianIncome !== null && item.medianIncome > 0) {
          sorted.medianIncome.push(item.medianIncome);
        }
        if (item.netContribution !== null && item.netContribution > 0) {
          sorted.netContribution.push(item.netContribution);
        }
      }
    });

    // Sort ascending
    sorted.salesPerCapita.sort((a, b) => a - b);
    sorted.retailerDensity.sort((a, b) => a - b);
    sorted.medianIncome.sort((a, b) => a - b);
    sorted.netContribution.sort((a, b) => a - b);

    return sorted;
  }, [contributions]);

  const getPercentileFactor = (val, sortedArray) => {
    if (!sortedArray || sortedArray.length === 0 || val === null || val === undefined) return 0.5;
    const idx = sortedArray.indexOf(val);
    if (idx === -1) return 0.5;
    return sortedArray.length > 1 ? idx / (sortedArray.length - 1) : 0.5;
  };

  const getFeatureStyle = (feature, criteria, colors) => {
    const dbData = getCountyDbData(feature);
    if (!dbData) {
      return {
        fillColor: "#94a3b8",
        weight: 1,
        opacity: 0.8,
        color: isLight ? "#ffffff" : "#111827",
        fillOpacity: 0.15
      };
    }

    const isSelected = selectedCounties.length === 0 || selectedCounties.includes(dbData.county);
    const opacity = isSelected ? 0.75 : 0.15;

    let color = "#cbd5e1";
    const baseColor = isLight ? "#cbd5e1" : "#334155";

    if (criteria === "sales_per_capita") {
      const val = dbData.salesPerCapita || 0;
      const factor = getPercentileFactor(val, countyValuesSorted.salesPerCapita);
      color = interpolateColor(baseColor, colors.primary, Math.max(0, Math.min(1, factor)));
    } else if (criteria === "retailer_density") {
      const val = dbData.retailersPerSqMile || 0;
      const factor = getPercentileFactor(val, countyValuesSorted.retailerDensity);
      color = interpolateColor(baseColor, colors.primary, Math.max(0, Math.min(1, factor)));
    } else if (criteria === "median_income") {
      const val = dbData.medianIncome || 0;
      const factor = getPercentileFactor(val, countyValuesSorted.medianIncome);
      color = interpolateColor(baseColor, colors.primary, Math.max(0, Math.min(1, factor)));
    } else if (criteria === "net_contribution") {
      const val = dbData.netContribution || 0;
      const factor = getPercentileFactor(val, countyValuesSorted.netContribution);
      color = interpolateColor(baseColor, colors.primary, Math.max(0, Math.min(1, factor)));
    } else if (criteria === "dma") {
      const dmaVal = dbData.dma || "";
      color = DMA_COLORS[dmaVal] || DMA_COLORS["default"];
    } else if (criteria === "service_center") {
      const scVal = dbData.serviceCenter || "";
      color = CENTER_COLORS[scVal] || CENTER_COLORS["default"];
    }

    return {
      fillColor: color,
      weight: isSelected ? 2 : 1,
      opacity: 1,
      color: isLight ? "#ffffff" : "#111827",
      fillOpacity: opacity
    };
  };

  // Init Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;

    try {
      const mapInstance = L.map(containerRef.current, {
        zoomControl: true,
        minZoom: 6,
      }).setView([42.8, -75.5], 7);
      setMap(mapInstance);

      const activeTileUrl = isLight
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

      L.tileLayer(activeTileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(mapInstance);

      // Register map background click to clear county filters
      mapInstance.on("click", () => {
        setSelectedCounties([]);
      });

      return () => {
        mapInstance.remove();
        setMap(null);
      };
    } catch (e) {
      console.error("Leaflet map initialization error:", e);
      setMapError("Failed to initialize Leaflet Map: " + e.message);
    }
  }, [mounted, loading]);

  // Update tile layers dynamically on theme toggle
  useEffect(() => {
    if (!map) return;

    try {
      const tileUrl = isLight
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          layer.setUrl(tileUrl);
        }
      });
    } catch (e) {
      console.error("Leaflet tile layer update error:", e);
      setMapError("Failed to update Map tiles: " + e.message);
    }
  }, [map, isLight]);

  // Update GeoJSON Layer dynamically
  useEffect(() => {
    if (!map || !geoJsonData) return;

    try {
      if (geojsonLayerRef.current) {
        map.removeLayer(geojsonLayerRef.current);
      }

      const geojsonLayer = L.geoJSON(geoJsonData, {
        style: (feature) => getFeatureStyle(feature, mapCriteria, themeColors),
        onEachFeature: (feature, layer) => {
          const dbData = getCountyDbData(feature);
          if (dbData) {
            const popupContent = `
              <div style="font-family:Inter, sans-serif; font-size:12px; color:var(--text); line-height:1.4; padding: 4px;">
                <strong style="font-size:14px; color:var(--primary); margin-bottom:6px; display:block;">${dbData.county} County</strong>
                <div style="display:grid; grid-template-columns: 140px 1fr; gap:4px;">
                  <span>Net Earmarks (Aid):</span><strong style="color:var(--green); text-align:right;">${formatDollar(dbData.netContribution)}</strong>
                  <span>Gross Sales:</span><strong style="text-align:right;">${formatDollar(dbData.grossRevenue)}</strong>
                  <span>Sales Per Capita:</span><strong style="text-align:right;">$${Number(dbData.salesPerCapita || 0).toFixed(2)}</strong>
                  <span>Retailers:</span><strong style="text-align:right;">${formatCount(dbData.retailerCount)}</strong>
                  <span>Density (per sq mi):</span><strong style="text-align:right;">${Number(dbData.retailersPerSqMile || 0).toFixed(4)}</strong>
                  <span>Median Income:</span><strong style="text-align:right;">${formatDollar(dbData.medianIncome)}</strong>
                  <span>Population:</span><strong style="text-align:right;">${formatCount(dbData.population)}</strong>
                  <span>DMA Region:</span><strong style="text-align:right; font-size:10px;">${dbData.dma || 'N/A'}</strong>
                  <span>Service Center:</span><strong style="text-align:right;">${dbData.serviceCenter || 'N/A'}</strong>
                </div>
                <div style="margin-top:8px; border-top:1px solid var(--border); padding-top:6px; text-align:center; font-size:10px; color:var(--text-secondary); line-height:1.2;">
                  <em>Click county again to toggle selection.<br/>Click map background to show all.</em>
                </div>
              </div>
            `;
            layer.bindPopup(popupContent);
          }

          layer.on({
            mouseover: (e) => {
              const l = e.target;
              l.setStyle({
                weight: 3,
                color: "#fbbf24",
                fillOpacity: 0.95
              });
              if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                l.bringToFront();
              }
            },
            mouseout: (e) => {
              geojsonLayer.resetStyle(e.target);
            },
            click: (e) => {
              if (dbData) {
                L.DomEvent.stopPropagation(e);
                handleCountyToggle(dbData.county);
              }
            }
          });
        }
      }).addTo(map);

      geojsonLayerRef.current = geojsonLayer;
    } catch (e) {
      console.error("Leaflet GeoJSON layer update error:", e);
      setMapError("Failed to render Map boundaries: " + e.message);
    }
  }, [map, geoJsonData, mapCriteria, selectedCounties, themeName, isLight]);

  // Compute filtered datasets
  const filteredCountyData = useMemo(() => {
    return contributions.filter((c) => {
      if (c.geoLevel !== "county") return false;
      if (selectedCounties.length > 0 && !selectedCounties.includes(c.county)) return false;
      return true;
    });
  }, [contributions, selectedCounties]);

  const filteredCityData = useMemo(() => {
    return contributions.filter((c) => {
      if (c.geoLevel !== "city") return false;
      if (selectedCounties.length > 0 && !selectedCounties.includes(c.county)) return false;
      return true;
    });
  }, [contributions, selectedCounties]);

  const filteredChannelData = useMemo(() => {
    return channelMixes.filter((c) => {
      if (selectedCounties.length > 0 && !selectedCounties.includes(c.county)) return false;
      if (selectedChannels.length > 0 && !selectedChannels.includes(c.businessType)) return false;
      return true;
    });
  }, [channelMixes, selectedCounties, selectedChannels]);

  // KPI Calculations
  const kpiCountiesCount = useMemo(() => {
    return filteredCountyData.filter((c) => c.county !== "Unknown").length;
  }, [filteredCountyData]);

  const kpiTopCounty = useMemo(() => {
    const list = [...filteredCountyData]
      .filter((c) => c.county !== "Unknown")
      .sort((a, b) => b.netContribution - a.netContribution);
    return list[0] || null;
  }, [filteredCountyData]);

  const kpiTopCity = useMemo(() => {
    const list = [...filteredCityData]
      .filter((c) => c.city !== "Unknown")
      .sort((a, b) => b.netContribution - a.netContribution);
    return list[0] || null;
  }, [filteredCityData]);

  // County Leaderboard Sorting & Pagination
  const sortedCountyData = useMemo(() => {
    let list = [...filteredCountyData].filter((c) => c.county !== "Unknown");
    
    if (countySearch) {
      list = list.filter((c) => c.county.toLowerCase().includes(countySearch.toLowerCase()));
    }

    list.sort((a, b) => {
      let valA = a[countySortField];
      let valB = b[countySortField];

      if (valA === null || valA === undefined) return countySortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return countySortAsc ? 1 : -1;

      if (typeof valA === "string") {
        return countySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return countySortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [filteredCountyData, countySearch, countySortField, countySortAsc]);

  const paginatedCountyData = useMemo(() => {
    const start = (countyCurrentPage - 1) * itemsPerPage;
    return sortedCountyData.slice(start, start + itemsPerPage);
  }, [sortedCountyData, countyCurrentPage]);

  const countyTotalPages = Math.ceil(sortedCountyData.length / itemsPerPage) || 1;

  // City Leaderboard Sorting & Pagination
  const sortedCityData = useMemo(() => {
    let list = [...filteredCityData].filter((c) => c.city !== "Unknown");

    if (citySearch) {
      const q = citySearch.toLowerCase();
      list = list.filter(
        (c) => c.city.toLowerCase().includes(q) || c.county.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA = a[citySortField];
      let valB = b[citySortField];

      if (valA === null || valA === undefined) return citySortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return citySortAsc ? 1 : -1;

      if (typeof valA === "string") {
        return citySortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return citySortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [filteredCityData, citySearch, citySortField, citySortAsc]);

  const paginatedCityData = useMemo(() => {
    const start = (cityCurrentPage - 1) * itemsPerPage;
    return sortedCityData.slice(start, start + itemsPerPage);
  }, [sortedCityData, cityCurrentPage]);

  const cityTotalPages = Math.ceil(sortedCityData.length / itemsPerPage) || 1;

  // Channel Mix Sorting & Pagination
  const sortedChannelData = useMemo(() => {
    let list = [...filteredChannelData].filter((c) => c.county !== "Unknown");

    if (channelSearch) {
      const q = channelSearch.toLowerCase();
      list = list.filter(
        (c) => c.county.toLowerCase().includes(q) || c.businessType.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let valA = a[channelSortField];
      let valB = b[channelSortField];

      if (valA === null || valA === undefined) return channelSortAsc ? -1 : 1;
      if (valB === null || valB === undefined) return channelSortAsc ? 1 : -1;

      if (typeof valA === "string") {
        return channelSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return channelSortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [filteredChannelData, channelSearch, channelSortField, channelSortAsc]);

  const paginatedChannelData = useMemo(() => {
    const start = (channelCurrentPage - 1) * itemsPerPage;
    return sortedChannelData.slice(start, start + itemsPerPage);
  }, [sortedChannelData, channelCurrentPage]);

  const channelTotalPages = Math.ceil(sortedChannelData.length / itemsPerPage) || 1;

  // Recharts Top 20 bar chart data / Selected Counties data
  const top20CountyChartData = useMemo(() => {
    const isFiltered = selectedCounties.length > 0;
    const baseList = [...contributions]
      .filter((c) => c.geoLevel === "county" && c.county !== "Unknown");
    
    const filteredList = isFiltered
      ? baseList.filter((c) => selectedCounties.includes(c.county))
      : baseList;

    return filteredList
      .sort((a, b) => {
        const valA = a[activeMetric] || 0;
        const valB = b[activeMetric] || 0;
        return valB - valA;
      })
      .slice(0, isFiltered ? undefined : 20);
  }, [contributions, activeMetric, selectedCounties]);

  const chartHeight = useMemo(() => {
    const count = top20CountyChartData.length;
    if (count <= 1) return 140;
    if (count <= 3) return 220;
    if (count <= 5) return 300;
    if (count <= 10) return 380;
    return 450;
  }, [top20CountyChartData]);

  const chartMaxVal = useMemo(() => {
    const list = top20CountyChartData.map((d) => Number(d[activeMetric] || 0));
    return list.length > 0 ? Math.max(...list) : 1;
  }, [top20CountyChartData, activeMetric]);

  const chartMinVal = useMemo(() => {
    const list = top20CountyChartData.map((d) => Number(d[activeMetric] || 0));
    return list.length > 0 ? Math.min(...list) : 0;
  }, [top20CountyChartData, activeMetric]);

  // Channel Mix Stacked Bar Chart data
  const chartColors = useMemo(() => [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--purple)",
    "var(--gold)",
    "var(--red)",
    "var(--blue)",
    "var(--green)"
  ], []);

  const channelChartData = useMemo(() => {
    const groups = {};
    filteredChannelData.forEach((item) => {
      const county = item.county;
      if (!groups[county]) {
        groups[county] = { county, totalRevenue: 0 };
      }
      const val = item.grossRevenue || 0;
      groups[county][item.businessType] = val;
      groups[county].totalRevenue += val;
    });

    const list = Object.values(groups).sort((a, b) => b.totalRevenue - a.totalRevenue);
    if (selectedCounties.length === 0) {
      return list.slice(0, 15);
    }
    return list;
  }, [filteredChannelData, selectedCounties]);

  const handleCountySort = (field) => {
    if (countySortField === field) {
      setCountySortAsc((prev) => !prev);
    } else {
      setCountySortField(field);
      setCountySortAsc(false);
    }
    setCountyCurrentPage(1);
  };

  const handleCitySort = (field) => {
    if (citySortField === field) {
      setCitySortAsc((prev) => !prev);
    } else {
      setCitySortField(field);
      setCitySortAsc(false);
    }
    setCityCurrentPage(1);
  };

  const handleChannelSort = (field) => {
    if (channelSortField === field) {
      setChannelSortAsc((prev) => !prev);
    } else {
      setChannelSortField(field);
      setChannelSortAsc(false);
    }
    setChannelCurrentPage(1);
  };

  // Map Legend items
  const renderLegendItems = () => {
    if (mapCriteria === "dma") {
      return Object.entries(DMA_COLORS)
        .filter(([key]) => key !== "default")
        .map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <div style={{ width: "12px", height: "12px", backgroundColor: val, borderRadius: "2px", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {key.replace(" DMA", "")}
            </span>
          </div>
        ));
    }
    if (mapCriteria === "service_center") {
      return Object.entries(CENTER_COLORS)
        .filter(([key]) => key !== "default")
        .map(([key, val]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <div style={{ width: "12px", height: "12px", backgroundColor: val, borderRadius: "2px", flexShrink: 0 }} />
            <span style={{ fontSize: "11px" }}>{key}</span>
          </div>
        ));
    }

    let minLabel = "Low";
    let maxLabel = "High";
    const stats = numericStats;

    if (mapCriteria === "sales_per_capita") {
      minLabel = `$${stats.salesPerCapita.min.toFixed(0)}`;
      maxLabel = `$${stats.salesPerCapita.max.toFixed(0)}`;
    } else if (mapCriteria === "retailer_density") {
      minLabel = `${stats.retailerDensity.min.toFixed(4)}`;
      maxLabel = `${stats.retailerDensity.max.toFixed(4)}`;
    } else if (mapCriteria === "median_income") {
      minLabel = `$${(stats.medianIncome.min / 1000).toFixed(0)}k`;
      maxLabel = `$${(stats.medianIncome.max / 1000).toFixed(0)}k`;
    } else if (mapCriteria === "net_contribution") {
      minLabel = `$${(stats.netContribution.min / 1000000).toFixed(1)}M`;
      maxLabel = `$${(stats.netContribution.max / 1000000).toFixed(1)}M`;
    }

    const lowColor = isLight ? "#cbd5e1" : "#334155";
    const highColor = themeColors.primary;

    return (
      <div>
        <div
          style={{
            height: "12px",
            width: "100%",
            background: `linear-gradient(to right, ${lowColor}, ${highColor})`,
            borderRadius: "2px",
            marginBottom: "4px"
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-secondary)" }}>
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "600px", color: "var(--text-muted)" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }}></div>
          Loading Geography Analytics Data...
        </div>
      </div>
    );
  }

  const getColHighlightStyle = (field, align = "left", extra = {}) => {
    const isSorted = countySortField === field;
    return {
      textAlign: align,
      backgroundColor: isSorted ? "var(--blue-dim, rgba(0, 180, 216, 0.06))" : "transparent",
      fontWeight: isSorted ? "600" : undefined,
      ...extra
    };
  };

  if (!mounted) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Filters Card */}
      <div className="card">
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
            {/* County Select */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                Filter by County
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleCountyToggle(e.target.value);
                  } else {
                    setSelectedCounties([]);
                  }
                  e.target.value = "";
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "13px",
                  cursor: "pointer",
                  width: "220px"
                }}
              >
                <option value="">-- All Counties --</option>
                {uniqueCounties
                  .filter((c) => !selectedCounties.includes(c))
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>

            {/* Channel Select */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-secondary)" }}>
                Filter by Channel
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    handleChannelToggle(e.target.value);
                    e.target.value = "";
                  }
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "13px",
                  cursor: "pointer",
                  width: "220px"
                }}
              >
                <option value="">-- All Channels --</option>
                {uniqueChannels
                  .filter((ch) => !selectedChannels.includes(ch))
                  .map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
              </select>
            </div>

            {/* Reset Button */}
            {(selectedCounties.length > 0 || selectedChannels.length > 0) && (
              <button
                onClick={resetFilters}
                style={{
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-3)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <RotateCcw size={14} /> Reset Filters
              </button>
            )}
          </div>

          {/* Selected County Tags */}
          {selectedCounties.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                Selected Counties:
              </span>
              {selectedCounties.map((c) => (
                <span
                  key={c}
                  onClick={() => handleCountyToggle(c)}
                  style={{
                    padding: "2px 8px",
                    backgroundColor: "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    color: "var(--blue)",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {c} <X size={10} />
                </span>
              ))}
            </div>
          )}

          {/* Selected Channel Tags */}
          {selectedChannels.length > 0 && (
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 500 }}>
                Selected Channels:
              </span>
              {selectedChannels.map((ch) => (
                <span
                  key={ch}
                  onClick={() => handleChannelToggle(ch)}
                  style={{
                    padding: "2px 8px",
                    backgroundColor: "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    color: "var(--green)",
                    cursor: "pointer",
                    fontWeight: 500,
                    fontSize: "11px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  {ch} <X size={10} />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="kpi-grid">
        {/* Counties Box */}
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">
            <span>Counties</span>
          </div>
          <div className="kpi-value">{kpiCountiesCount}</div>
          <div className="kpi-subtitle">
            {selectedCounties.length > 0
              ? `${selectedCounties.length} selected of ${uniqueCounties.length} active`
              : `Statewide active network`}
          </div>
        </div>

        {/* Top County Box */}
        <div className="kpi-card kpi-green">
          <div className="kpi-label">
            <span>Top County</span>
          </div>
          <div className="kpi-value" style={{ fontSize: kpiTopCounty && kpiTopCounty.county.length > 12 ? "20px" : "24px" }}>
            {kpiTopCounty ? kpiTopCounty.county : "N/A"}
          </div>
          <div className="kpi-subtitle">
            {kpiTopCounty ? `Earmarks: ${formatDollar(kpiTopCounty.netContribution)}` : "No data"}
          </div>
        </div>

        {/* Top City Box */}
        <div className="kpi-card kpi-gold">
          <div className="kpi-label">
            <span>Top City</span>
          </div>
          <div className="kpi-value" style={{ fontSize: kpiTopCity && kpiTopCity.city.length > 12 ? "20px" : "24px" }}>
            {kpiTopCity ? kpiTopCity.city : "N/A"}
          </div>
          <div className="kpi-subtitle">
            {kpiTopCity ? `Earmarks: ${formatDollar(kpiTopCity.netContribution)}` : "No data"}
          </div>
        </div>
      </div>

      {/* Map Card */}
      <div className="card">
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3>Socio-Demographic Indicator Map</h3>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              Interactive county boundaries colored by socio-demographic indicators
            </span>
          </div>
          {/* Map Layer Switcher & Reset Button */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {selectedCounties.length > 0 && (
              <button
                onClick={() => setSelectedCounties([])}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-3)",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s"
                }}
              >
                <RotateCcw size={14} /> Reset to Statewide
              </button>
            )}
            <select
              value={mapCriteria}
              onChange={(e) => setMapCriteria(e.target.value)}
              style={{
                padding: "6px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--surface-3)",
                color: "var(--text)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <option value="sales_per_capita">Sales Per Capita</option>
              <option value="retailer_density">Retailer Density</option>
              <option value="median_income">Median Household Income</option>
              <option value="net_contribution">Education Aid (Net Earmark)</option>
              <option value="dma">DMA Region Boundaries</option>
              <option value="service_center">Service Center Districts</option>
            </select>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0, position: "relative", minHeight: "500px" }}>
          {mapError && (
            <div style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              right: "16px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgb(239, 68, 68)",
              color: "rgb(239, 68, 68)",
              padding: "12px 16px",
              borderRadius: "var(--radius-sm)",
              zIndex: 2000,
              fontSize: "13px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span><strong>Map Diagnostics Alert:</strong> {mapError}</span>
              <button 
                onClick={() => setMapError(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "14px"
                }}
              >
                ✕
              </button>
            </div>
          )}
          <div ref={containerRef} style={{ height: "500px", width: "100%" }} />
          {/* Floating Clear Selection Button directly on map */}
          {selectedCounties.length > 0 && (
            <button
              onClick={() => setSelectedCounties([])}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                zIndex: 1000,
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                backgroundColor: "var(--card-bg)",
                color: "var(--primary)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.2s"
              }}
            >
              <RotateCcw size={13} /> Reset to Statewide
            </button>
          )}
          {/* Legend Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              right: "16px",
              backgroundColor: "var(--card-bg)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "12px",
              zIndex: 1000,
              color: "var(--text)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              width: "180px",
              pointerEvents: "none"
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", color: "var(--text-secondary)" }}>
              {mapCriteria.replace(/_/g, " ")}
            </h4>
            {renderLegendItems()}
            <div style={{
              marginTop: "8px",
              paddingTop: "6px",
              borderTop: "1px solid var(--border)",
              fontSize: "9px",
              color: "var(--text-muted)",
              lineHeight: "1.2"
            }}>
              <strong>Tip:</strong> Click multiple counties to select and compare them.
            </div>
          </div>
        </div>
      </div>

      {/* Row 1: Top 20 Counties Chart & County Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", lgDirection: "row", gap: "24px" }} className="flex flex-col lg:flex-row">
        {/* Top 20 Counties Chart */}
        <div className="card" style={{ flex: 7 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3>
                {selectedCounties.length > 0
                  ? `Selected Counties — ${METRICS.find((m) => m.key === activeMetric)?.label}`
                  : `Top 20 Counties — ${METRICS.find((m) => m.key === activeMetric)?.label}`}
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                {selectedCounties.length > 0 ? (
                  <>
                    <span style={{ color: "var(--primary)", fontWeight: 600 }}>● Map Focused View:</span>
                    Showing only the {selectedCounties.length} selected county/counties. Clear map filter to restore statewide Top 20.
                  </>
                ) : (
                  `Ordered by ${METRICS.find((m) => m.key === activeMetric)?.label}. Color gradient reflects higher values.`
                )}
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {METRICS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setActiveMetric(m.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: activeMetric === m.key ? "1px solid var(--primary)" : "1px solid var(--border)",
                    backgroundColor: activeMetric === m.key ? "var(--blue-dim, rgba(0, 180, 216, 0.08))" : "var(--surface-3)",
                    color: activeMetric === m.key ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: "16px 8px 16px 0" }}>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart
                data={top20CountyChartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 30, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  stroke="var(--text-muted)"
                  tickFormatter={(v) => {
                    if (activeMetric === "netContribution" || activeMetric === "grossRevenue") {
                      return `$${(v / 1000000).toFixed(0)}M`;
                    }
                    if (activeMetric === "salesPerCapita") {
                      return `$${Number(v).toFixed(0)}`;
                    }
                    if (activeMetric === "retailerCount") {
                      return Number(v).toLocaleString();
                    }
                    return v;
                  }}
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="county"
                  stroke="var(--text-muted)"
                  fontSize={11}
                  width={90}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div
                          style={{
                            backgroundColor: "var(--card-bg)",
                            border: "1px solid var(--border)",
                            padding: "12px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            color: "var(--text)",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                          }}
                        >
                          <strong style={{ color: "var(--primary)", display: "block", marginBottom: "8px", fontSize: "13px" }}>
                            {data.county} County
                          </strong>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ fontWeight: activeMetric === "netContribution" ? "bold" : "normal", color: activeMetric === "netContribution" ? "var(--primary)" : "inherit" }}>
                              Net Contribution: {formatDollar(data.netContribution)}
                            </div>
                            <div style={{ fontWeight: activeMetric === "grossRevenue" ? "bold" : "normal", color: activeMetric === "grossRevenue" ? "var(--primary)" : "inherit" }}>
                              Gross Revenue: {formatDollar(data.grossRevenue)}
                            </div>
                            <div style={{ fontWeight: activeMetric === "salesPerCapita" ? "bold" : "normal", color: activeMetric === "salesPerCapita" ? "var(--primary)" : "inherit" }}>
                              Sales Per Capita: {data.salesPerCapita !== null ? `$${data.salesPerCapita.toFixed(2)}` : "N/A"}
                            </div>
                            <div style={{ fontWeight: activeMetric === "retailerCount" ? "bold" : "normal", color: activeMetric === "retailerCount" ? "var(--primary)" : "inherit" }}>
                              Retailers: {formatCount(data.retailerCount)}
                            </div>
                            <div style={{ borderTop: "1px solid var(--border)", marginTop: "4px", paddingTop: "4px" }}>
                              Contrib Rate: {formatPercent(data.contributionRate)}
                            </div>
                            <div>Draw Share: {formatPercent(data.drawShare)}</div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey={activeMetric} radius={[0, 4, 4, 0]}>
                  {top20CountyChartData.map((entry, index) => {
                    const val = Number(entry[activeMetric] || 0);
                    const factor = chartMaxVal > chartMinVal ? (val - chartMinVal) / (chartMaxVal - chartMinVal) : 0.5;
                    const color = interpolateColor(themeColors.secondary, themeColors.primary, Math.max(0, Math.min(1, factor)));
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* County Leaderboard */}
        <div className="card" style={{ flex: 5 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>County Leaderboard</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Statewide county performance list
              </span>
            </div>
            {/* Table Search */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search..."
                value={countySearch}
                onChange={(e) => {
                  setCountySearch(e.target.value);
                  setCountyCurrentPage(1);
                }}
                style={{
                  padding: "5px 10px 5px 26px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "12px",
                  width: "140px"
                }}
              />
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("county", "left") }} onClick={() => handleCountySort("county")}>
                      County {countySortField === "county" && (countySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("grossRevenue", "right") }} onClick={() => handleCountySort("grossRevenue")}>
                      Gross Rev {countySortField === "grossRevenue" && (countySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("netContribution", "right") }} onClick={() => handleCountySort("netContribution")}>
                      Net Cont. {countySortField === "netContribution" && (countySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("salesPerCapita", "right") }} onClick={() => handleCountySort("salesPerCapita")}>
                      Sales/Cap {countySortField === "salesPerCapita" && (countySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("retailerCount", "right") }} onClick={() => handleCountySort("retailerCount")}>
                      Retailers {countySortField === "retailerCount" && (countySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px", ...getColHighlightStyle("contributionRate", "right") }} onClick={() => handleCountySort("contributionRate")}>
                      Rate {countySortField === "contributionRate" && (countySortAsc ? "▲" : "▼")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCountyData.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("county", "left", { fontWeight: 500 }) }}>
                        {c.county}
                      </td>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("grossRevenue", "right") }}>
                        {formatDollar(c.grossRevenue)}
                      </td>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("netContribution", "right", { color: "var(--green)" }) }}>
                        {formatDollar(c.netContribution)}
                      </td>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("salesPerCapita", "right") }}>
                        {c.salesPerCapita !== null ? `$${c.salesPerCapita.toFixed(2)}` : "N/A"}
                      </td>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("retailerCount", "right") }}>
                        {formatCount(c.retailerCount)}
                      </td>
                      <td style={{ fontSize: "12px", ...getColHighlightStyle("contributionRate", "right", { color: "var(--gold)" }) }}>
                        {formatPercent(c.contributionRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderTop: "1px solid var(--border)",
                fontSize: "11px",
                color: "var(--text-secondary)"
              }}
            >
              <div>
                Page {countyCurrentPage} of {countyTotalPages}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setCountyCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={countyCurrentPage === 1}
                  style={{
                    padding: "3px 6px",
                    background: countyCurrentPage === 1 ? "transparent" : "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: countyCurrentPage === 1 ? "var(--text-muted)" : "var(--text)",
                    cursor: countyCurrentPage === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setCountyCurrentPage((p) => Math.min(countyTotalPages, p + 1))}
                  disabled={countyCurrentPage === countyTotalPages}
                  style={{
                    padding: "3px 6px",
                    background: countyCurrentPage === countyTotalPages ? "transparent" : "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: countyCurrentPage === countyTotalPages ? "var(--text-muted)" : "var(--text)",
                    cursor: countyCurrentPage === countyTotalPages ? "not-allowed" : "pointer"
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Channel Mix by Top Counties & City Leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", lgDirection: "row", gap: "24px" }} className="flex flex-col lg:flex-row">
        {/* Channel Mix Table */}
        <div className="card" style={{ flex: 6 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3>Channel Mix by County</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {channelViewMode === "table"
                  ? "Segment breakdowns (Convenience, Grocery, etc.) per county"
                  : "Stacked channel revenue shares per county (Top 15 by default)"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Switcher Buttons */}
              <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <button
                  onClick={() => setChannelViewMode("table")}
                  style={{
                    padding: "5px 10px",
                    border: "none",
                    backgroundColor: channelViewMode === "table" ? "var(--primary)" : "var(--surface-3)",
                    color: channelViewMode === "table" ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Table
                </button>
                <button
                  onClick={() => setChannelViewMode("chart")}
                  style={{
                    padding: "5px 10px",
                    border: "none",
                    backgroundColor: channelViewMode === "chart" ? "var(--primary)" : "var(--surface-3)",
                    color: channelViewMode === "chart" ? "#ffffff" : "var(--text-secondary)",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  Chart
                </button>
              </div>

              {/* Search */}
              {channelViewMode === "table" && (
                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={channelSearch}
                    onChange={(e) => {
                      setChannelSearch(e.target.value);
                      setChannelCurrentPage(1);
                    }}
                    style={{
                      padding: "5px 10px 5px 26px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--surface-1)",
                      color: "var(--text)",
                      fontSize: "12px",
                      width: "140px"
                    }}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {channelViewMode === "table" ? (
              <>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ cursor: "pointer", fontSize: "11px" }} onClick={() => handleChannelSort("county")}>
                          County {channelSortField === "county" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", fontSize: "11px" }} onClick={() => handleChannelSort("businessType")}>
                          Channel {channelSortField === "businessType" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleChannelSort("grossRevenue")}>
                          Gross Rev {channelSortField === "grossRevenue" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleChannelSort("netContribution")}>
                          Net Cont. {channelSortField === "netContribution" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleChannelSort("retailerCount")}>
                          Retailers {channelSortField === "retailerCount" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleChannelSort("drawShare")}>
                          Draw Sh. {channelSortField === "drawShare" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                        <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleChannelSort("scratchShare")}>
                          Scratch Sh. {channelSortField === "scratchShare" && (channelSortAsc ? "▲" : "▼")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedChannelData.map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 500, fontSize: "12px" }}>{c.county}</td>
                          <td>
                            <span className="badge" style={{ backgroundColor: "var(--surface-3)", color: "var(--text-secondary)", fontSize: "10px" }}>
                              {c.businessType}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontSize: "12px" }}>{formatDollar(c.grossRevenue)}</td>
                          <td style={{ textAlign: "right", fontSize: "12px", color: "var(--green)" }}>{formatDollar(c.netContribution)}</td>
                          <td style={{ textAlign: "right", fontSize: "12px" }}>{formatCount(c.retailerCount)}</td>
                          <td style={{ textAlign: "right", fontSize: "12px" }}>{formatPercent(c.drawShare)}</td>
                          <td style={{ textAlign: "right", fontSize: "12px" }}>{formatPercent(c.scratchShare)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderTop: "1px solid var(--border)",
                    fontSize: "11px",
                    color: "var(--text-secondary)"
                  }}
                >
                  <div>
                    Page {channelCurrentPage} of {channelTotalPages}
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <button
                      onClick={() => setChannelCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={channelCurrentPage === 1}
                      style={{
                        padding: "3px 6px",
                        background: channelCurrentPage === 1 ? "transparent" : "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: channelCurrentPage === 1 ? "var(--text-muted)" : "var(--text)",
                        cursor: channelCurrentPage === 1 ? "not-allowed" : "pointer"
                      }}
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setChannelCurrentPage((p) => Math.min(channelTotalPages, p + 1))}
                      disabled={channelCurrentPage === channelTotalPages}
                      style={{
                        padding: "3px 6px",
                        background: channelCurrentPage === channelTotalPages ? "transparent" : "var(--surface-3)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        color: channelCurrentPage === channelTotalPages ? "var(--text-muted)" : "var(--text)",
                        cursor: channelCurrentPage === channelTotalPages ? "not-allowed" : "pointer"
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "24px 16px 16px 16px" }}>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={channelChartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="county" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
                          return (
                            <div
                              style={{
                                backgroundColor: "var(--card-bg)",
                                border: "1px solid var(--border)",
                                padding: "12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                color: "var(--text)",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                              }}
                            >
                              <strong style={{ color: "var(--primary)", display: "block", marginBottom: "8px", fontSize: "13px" }}>
                                {label} County
                              </strong>
                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {payload.map((entry, idx) => {
                                  const pct = total > 0 ? (entry.value / total) * 100 : 0;
                                  return (
                                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
                                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ width: "8px", height: "8px", backgroundColor: entry.fill, borderRadius: "50%", display: "inline-block" }} />
                                        {entry.name}:
                                      </span>
                                      <span style={{ fontWeight: 600 }}>{formatDollar(entry.value)} ({pct.toFixed(1)}%)</span>
                                    </div>
                                  );
                                })}
                                <div style={{ borderTop: "1px solid var(--border)", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontWeight: "bold" }}>
                                  <span>Total mix:</span>
                                  <span>{formatDollar(total)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                    {uniqueChannels.map((channel, idx) => {
                      const color = chartColors[idx % chartColors.length];
                      return (
                        <Bar
                          key={channel}
                          dataKey={channel}
                          name={channel}
                          stackId="a"
                          fill={color}
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* City Leaderboard */}
        <div className="card" style={{ flex: 6 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3>City Leaderboard</h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                Statewide city performance ranks
              </span>
            </div>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input
                type="text"
                placeholder="Search..."
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setCityCurrentPage(1);
                }}
                style={{
                  padding: "5px 10px 5px 26px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-1)",
                  color: "var(--text)",
                  fontSize: "12px",
                  width: "140px"
                }}
              />
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: "pointer", fontSize: "11px" }} onClick={() => handleCitySort("city")}>
                      City {citySortField === "city" && (citySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", fontSize: "11px" }} onClick={() => handleCitySort("county")}>
                      County {citySortField === "county" && (citySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleCitySort("grossRevenue")}>
                      Gross Rev {citySortField === "grossRevenue" && (citySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleCitySort("netContribution")}>
                      Net Cont. {citySortField === "netContribution" && (citySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleCitySort("retailerCount")}>
                      Retailers {citySortField === "retailerCount" && (citySortAsc ? "▲" : "▼")}
                    </th>
                    <th style={{ cursor: "pointer", textAlign: "right", fontSize: "11px" }} onClick={() => handleCitySort("contributionRate")}>
                      Rate {citySortField === "contributionRate" && (citySortAsc ? "▲" : "▼")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCityData.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500, fontSize: "12px" }}>{c.city}</td>
                      <td style={{ fontSize: "12px", color: "var(--text-secondary)" }}>{c.county}</td>
                      <td style={{ textAlign: "right", fontSize: "12px" }}>{formatDollar(c.grossRevenue)}</td>
                      <td style={{ textAlign: "right", fontSize: "12px", color: "var(--green)", fontWeight: 500 }}>
                        {formatDollar(c.netContribution)}
                      </td>
                      <td style={{ textAlign: "right", fontSize: "12px" }}>{formatCount(c.retailerCount)}</td>
                      <td style={{ textAlign: "right", fontSize: "12px", color: "var(--gold)", fontWeight: 600 }}>
                        {formatPercent(c.contributionRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                borderTop: "1px solid var(--border)",
                fontSize: "11px",
                color: "var(--text-secondary)"
              }}
            >
              <div>
                Page {cityCurrentPage} of {cityTotalPages}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={() => setCityCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={cityCurrentPage === 1}
                  style={{
                    padding: "3px 6px",
                    background: cityCurrentPage === 1 ? "transparent" : "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: cityCurrentPage === 1 ? "var(--text-muted)" : "var(--text)",
                    cursor: cityCurrentPage === 1 ? "not-allowed" : "pointer"
                  }}
                >
                  Prev
                </button>
                <button
                  onClick={() => setCityCurrentPage((p) => Math.min(cityTotalPages, p + 1))}
                  disabled={cityCurrentPage === cityTotalPages}
                  style={{
                    padding: "3px 6px",
                    background: cityCurrentPage === cityTotalPages ? "transparent" : "var(--surface-3)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    color: cityCurrentPage === cityTotalPages ? "var(--text-muted)" : "var(--text)",
                    cursor: cityCurrentPage === cityTotalPages ? "not-allowed" : "pointer"
                  }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Source Note */}
      <div style={{ color: "var(--text-muted)", fontSize: "11px", textAlign: "center", marginTop: "12px" }}>
        Data as of: June 13, 2026 | Source: mart_exec_geo_contribution, mart_exec_geo_channel_mix | Stochos Analytics Platform
      </div>
    </div>
  );
}
