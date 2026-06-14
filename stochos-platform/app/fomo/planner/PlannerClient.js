"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import { Building2, MapPin, Home, Plus, Search, AlertTriangle, Zap, Compass, RotateCw, Split, Maximize2, X, Store, Calendar, List } from "lucide-react";
import HelpTooltip from "../../components/HelpTooltip";

const SERVICE_CENTERS = [
  { id: "schenectady", name: "Schenectady (HQ)", dbValue: "Schenectady", address: "1 Broadway Center, Schenectady, NY 12305", lat: 42.81432, lng: -73.94314 },
  { id: "buffalo", name: "Buffalo Service Center", dbValue: "Buffalo", address: "165 Genesee St, Buffalo, NY 14203", lat: 42.88850, lng: -78.87109 },
  { id: "rochester", name: "Rochester Service Center", dbValue: "Rochester", address: "1425 Mt Read Blvd, Rochester, NY 14606", lat: 43.18434, lng: -77.65991 },
  { id: "syracuse", name: "Syracuse Service Center", dbValue: "Syracuse", address: "620 Erie Blvd W, Syracuse, NY 13204", lat: 43.05058, lng: -76.16335 },
  { id: "fishkill", name: "Fishkill Service Center", dbValue: "Fishkill", address: "18 Westage Business Center Dr, Fishkill, NY 12524", lat: 41.52402, lng: -73.89785 },
  { id: "manhattan", name: "Manhattan Service Center (NYC)", dbValue: "Manhattan (NYC)", address: "15 Beaver St, New York, NY 10004", lat: 40.70494, lng: -74.01258 },
  { id: "gardencity", name: "Long Island Service Center (Garden City)", dbValue: "Long Island (Garden City)", address: "400 Oak St, Garden City, NY 11530", lat: 40.72591, lng: -73.59374 }
];

// Geodesic distance calculation helper
function haversineDistance(p1, p2) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Deterministic Opportunity, Sales Tier and WoW Sales Trend generator
const getStoreOpportunity = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = Math.abs(hash % 90) + 10; // 10 to 99
  const tier = score >= 75 ? "Gold" : score >= 40 ? "Silver" : "Bronze";
  
  // Deterministic week-over-week trend between -30.0% and +30.0%
  const wowTrend = parseFloat(((hash % 60) - 30).toFixed(1)); 
  
  return { score, tier, wowTrend };
};

export default function PlannerClient({ retailers, routes, chains, users = [], currentUser }) {
  const [localUsers, setLocalUsers] = useState(users);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [editAddressVal, setEditAddressVal] = useState("");
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  // Selection and filter state
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Advanced CRM Sales Intelligence Filters
  const [opportunityFilter, setOpportunityFilter] = useState("all");
  const [anomalyFilter, setAnomalyFilter] = useState("all");
  const [lastVisitDaysFilter, setLastVisitDaysFilter] = useState(0);

  // Starting point state
  const [startType, setStartType] = useState("center"); // "center" | "custom"
  const [selectedCenterId, setSelectedCenterId] = useState("schenectady");
  const [customAddress, setCustomAddress] = useState("");
  const [customCoords, setCustomCoords] = useState(null); // { lat, lng, resolvedAddress }
  const [geocoding, setGeocoding] = useState(false);
  const [roundTrip, setRoundTrip] = useState(true);
  const [filterByTerritory, setFilterByTerritory] = useState(true);
  
  // Representative Selection State
  const [selectedRepId, setSelectedRepId] = useState(currentUser?.id || "");
  const [showAllReps, setShowAllReps] = useState(false);
  const [repRoutesOnly, setRepRoutesOnly] = useState(true);

  // Weekly Scheduler States
  const [targetStopsPerDay, setTargetStopsPerDay] = useState(8);
  const [weeklySchedule, setWeeklySchedule] = useState({
    Monday: null,
    Tuesday: null,
    Wednesday: null,
    Thursday: null,
    Friday: null
  });
  const [autoGeneratingSchedule, setAutoGeneratingSchedule] = useState(false);
  const [recViewMode, setRecViewMode] = useState("week"); // "week" | "list"

  // Parse URL search parameters on load (e.g. quick navigation from manager reports)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const repParam = params.get("repId");
      const centerParam = params.get("centerId");
      if (repParam) {
        setSelectedRepId(repParam);
        setShowAllReps(true);
      }
      if (centerParam) {
        setSelectedCenterId(centerParam);
      }
    }
  }, []);

  // Sync schedule from localStorage on selectedRepId changes
  useEffect(() => {
    setRepRoutesOnly(true); // Reset rep routes filter on representative switch
    if (typeof window !== "undefined") {
      const key = `stochos-weekly-schedule-${selectedRepId || "default"}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setWeeklySchedule(JSON.parse(saved));
          return;
        } catch (e) {
          console.error("Failed to parse weekly schedule:", e);
        }
      }
      setWeeklySchedule({
        Monday: null,
        Tuesday: null,
        Wednesday: null,
        Thursday: null,
        Friday: null
      });
    }
  }, [selectedRepId]);

  // Persist weekly schedule on updates
  useEffect(() => {
    if (typeof window !== "undefined" && selectedRepId) {
      const key = `stochos-weekly-schedule-${selectedRepId}`;
      localStorage.setItem(key, JSON.stringify(weeklySchedule));
    }
  }, [weeklySchedule, selectedRepId]);

  // Accordion toggle states (start, stops, recommend, picker, schedule)
  const [expandedPanels, setExpandedPanels] = useState({
    start: true,
    stops: false,
    recommend: false,
    picker: false,
    schedule: false
  });

  const togglePanel = (panelName) => {
    setExpandedPanels((prev) => {
      const isCurrentlyExpanded = prev[panelName];
      return {
        start: panelName === "start" ? !isCurrentlyExpanded : false,
        stops: panelName === "stops" ? !isCurrentlyExpanded : false,
        recommend: panelName === "recommend" ? !isCurrentlyExpanded : false,
        picker: panelName === "picker" ? !isCurrentlyExpanded : false,
        schedule: panelName === "schedule" ? !isCurrentlyExpanded : false
      };
    });
  };

  const [mapExpanded, setMapExpanded] = useState(false);

  // Trigger leaflet map redraw on container resize transitions (including pinned guide offset)
  useEffect(() => {
    let timeoutId;
    const handleMapResize = () => {
      if (mapRef.current) {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (mapRef.current) {
            try {
              const container = mapRef.current.getContainer();
              if (container && document.body.contains(container)) {
                mapRef.current.invalidateSize({ animate: true });
              }
            } catch (e) {
              // Safe catch if leaflet map was already unmounted/destroyed
            }
          }
        }, 300);
      }
    };
    window.addEventListener("layout-resize", handleMapResize);
    window.addEventListener("resize", handleMapResize);
    handleMapResize();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("layout-resize", handleMapResize);
      window.removeEventListener("resize", handleMapResize);
    };
  }, [mapExpanded]);

  // Route optimization result state
  const [optimizing, setOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState(null);

  // Map references
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layersRef = useRef({
    markers: L.featureGroup(),
    route: L.featureGroup()
  });

  // 1. Enrich retailers with CRM opportunity and sales performance data
  const enrichedRetailers = useMemo(() => {
    return retailers.map(r => {
      const opp = getStoreOpportunity(r.id);
      return {
        ...r,
        opportunityScore: opp.score,
        salesTier: opp.tier,
        wowSalesTrend: opp.wowTrend
      };
    });
  }, [retailers]);

  // 2. Compute the peer average sales trend grouped by county to normalize seasonal variances
  const countyAverages = useMemo(() => {
    const counts = {};
    const sums = {};
    
    enrichedRetailers.forEach(r => {
      const county = r.county || "Unknown";
      counts[county] = (counts[county] || 0) + 1;
      sums[county] = (sums[county] || 0) + r.wowSalesTrend;
    });
    
    const avgs = {};
    Object.keys(counts).forEach(c => {
      avgs[c] = parseFloat((sums[c] / counts[c]).toFixed(2));
    });
    return avgs;
  }, [enrichedRetailers]);

  // Helper to evaluate anomalies based on Peer Group Normalization
  const getAnomalyType = (retailer) => {
    const county = retailer.county || "Unknown";
    const countyAvg = countyAverages[county] || 0;
    const variance = retailer.wowSalesTrend - countyAvg;
    
    if (variance <= -15) {
      return "underperforming"; // Negative anomaly
    } else if (variance >= 15) {
      return "outperforming"; // Positive anomaly
    }
    return "normal";
  };

  // Group the representatives for the dropdown select (local Rochester/etc. first, others in a temp pool)
  const groupedReps = useMemo(() => {
    // Only include users from the Operations division (planners/reps/managers)
    let pool = localUsers.filter((u) => u.division === "OPERATIONS");

    if (!showAllReps) {
      const reports = pool.filter((u) => u.managerId === currentUser?.id);
      // Fallback: if no direct reports exist, show all operations users
      if (reports.length > 0) {
        pool = reports;
      }
    }

    const centerObj = SERVICE_CENTERS.find(c => c.id === selectedCenterId);
    if (!centerObj) {
      return { local: pool, temp: [] };
    }

    const centerDbName = centerObj.dbValue.toLowerCase();
    
    // Resolve robust search tokens for substring comparisons (handles Manhattan (NYC) -> manhattan, etc.)
    const searchTokens = [];
    if (centerDbName.includes("manhattan")) {
      searchTokens.push("manhattan");
    } else if (centerDbName.includes("garden city") || centerDbName.includes("long island")) {
      searchTokens.push("garden city", "gardencity", "long island");
    } else {
      searchTokens.push(centerDbName);
    }

    const isLocalUser = (u) => {
      const email = (u.email || "").toLowerCase();
      const subunit = (u.subunit || "").toLowerCase();
      const bureau = (u.bureau || "").toLowerCase();

      // 1. Check if email, subunit, or bureau contains any token
      if (searchTokens.some(tok => email.includes(tok) || subunit.includes(tok) || bureau.includes(tok))) {
        return true;
      }

      // 2. Check if any assigned routes match this center
      const userRoutes = routes.filter(r => r.repId === u.id);
      if (userRoutes.length > 0) {
        if (userRoutes.some(r => searchTokens.some(tok => r.name.toLowerCase().includes(tok)))) {
          return true;
        }
      }

      // 3. Check if their manager matches this center
      if (u.managerId) {
        const manager = localUsers.find(m => m.id === u.managerId);
        if (manager) {
          const mgrEmail = (manager.email || "").toLowerCase();
          const mgrSubunit = (manager.subunit || "").toLowerCase();
          const mgrBureau = (manager.bureau || "").toLowerCase();
          if (searchTokens.some(tok => mgrEmail.includes(tok) || mgrSubunit.includes(tok) || mgrBureau.includes(tok))) {
            return true;
          }
        }
      }
      return false;
    };

    const local = pool.filter(isLocalUser);
    const temp = pool.filter(u => !isLocalUser(u));

    return { local, temp };
  }, [localUsers, showAllReps, currentUser, selectedCenterId, routes]);

  // Identify all routes assigned to the selected representative
  const repRouteIds = useMemo(() => {
    return routes.filter((r) => r.repId === selectedRepId).map((r) => r.id);
  }, [routes, selectedRepId]);

  // Get all retailers associated with the representative's routes (bounded by active territory if filterByTerritory is on)
  const repRetailers = useMemo(() => {
    if (repRouteIds.length === 0) return [];
    const activeCenter = (startType === "center" || startType === "repHome") ? SERVICE_CENTERS.find(c => c.id === selectedCenterId) : null;
    return enrichedRetailers.filter((r) => {
      if (!r.routeId || !repRouteIds.includes(r.routeId)) return false;
      if (activeCenter && filterByTerritory) {
        if (r.serviceCenter !== activeCenter.dbValue) return false;
      }
      return true;
    });
  }, [enrichedRetailers, repRouteIds, selectedCenterId, startType, filterByTerritory]);

  // Score and select all recommended stops for the representative's territory
  const allScoredRepRetailers = useMemo(() => {
    if (repRetailers.length === 0) return [];

    const scored = repRetailers.map((r) => {
      // Sales Tier: Gold = 30, Silver = 15, Bronze = 5
      const tierScore = r.salesTier === "Gold" ? 30 : r.salesTier === "Silver" ? 15 : 5;

      // Visit Gap Score (up to 50 pts, based on days since last visit)
      const days = r.lastVisitDate
        ? Math.floor((new Date() - new Date(r.lastVisitDate)) / (1000 * 60 * 60 * 24))
        : 90; // default to 90 days if never visited (standard rotation priority)
      const visitGapScore = Math.min(50, days);

      // Anomaly Score (Underperforming = +40, Outperforming = +10, Normal = 0)
      const anomaly = getAnomalyType(r);
      const anomalyScore = anomaly === "underperforming" ? 40 : anomaly === "outperforming" ? 10 : 0;

      const recommendationScore = tierScore + visitGapScore + anomalyScore;

      return {
        ...r,
        recommendationScore,
        visitGapDays: days,
        anomaly
      };
    });

    // Sort descending by recommendationScore
    return scored.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }, [repRetailers, countyAverages]);

  // Sliced recommended stops for the checklist panel
  const recommendedStops = useMemo(() => {
    return allScoredRepRetailers.slice(0, 8);
  }, [allScoredRepRetailers]);

  // 3. Filter retailers incorporating sales opportunities, last visits, and anomalies
  const filteredRetailers = useMemo(() => {
    const activeCenter = (startType === "center" || startType === "repHome") ? SERVICE_CENTERS.find(c => c.id === selectedCenterId) : null;

    return enrichedRetailers.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (routeFilter !== "all" && r.routeId !== routeFilter) return false;
      if (chainFilter !== "all" && r.chainId !== chainFilter) return false;

      // Filter by selected representative's assigned routes if enabled and routes exist
      if (selectedRepId && repRoutesOnly && repRouteIds.length > 0) {
        if (!r.routeId || !repRouteIds.includes(r.routeId)) return false;
      }

      // Filter by Service Center territory bounds if enabled
      if (activeCenter && filterByTerritory) {
        if (r.serviceCenter !== activeCenter.dbValue) return false;
      }

      // Sales Opportunity Filter
      if (opportunityFilter === "gold" && r.salesTier !== "Gold") return false;
      if (opportunityFilter === "gold_silver" && r.salesTier !== "Gold" && r.salesTier !== "Silver") return false;

      // Days Since Last Visit Filter
      if (lastVisitDaysFilter > 0) {
        if (!r.lastVisitDate) {
          // Never visited matches >= filter
        } else {
          const days = Math.floor((new Date() - new Date(r.lastVisitDate)) / (1000 * 60 * 60 * 24));
          if (days < lastVisitDaysFilter) return false;
        }
      }

      // Anomaly Filter
      if (anomalyFilter !== "all") {
        const anomaly = getAnomalyType(r);
        if (anomalyFilter !== anomaly) return false;
      }

      if (search) {
        const query = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query) ||
          r.city.toLowerCase().includes(query) ||
          r.externalId.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [enrichedRetailers, search, routeFilter, chainFilter, statusFilter, startType, selectedCenterId, filterByTerritory, opportunityFilter, lastVisitDaysFilter, anomalyFilter, countyAverages, selectedRepId, repRouteIds, repRoutesOnly]);

  // Toggle selection helper
  const handleToggleStore = (storeId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        if (next.size >= 30) {
          alert("Maximum waypoint limit reached (30 stores per route).");
          return prev;
        }
        next.add(storeId);
      }
      return next;
    });
    // Clear old route if stops change
    setOptimizedRoute(null);
  };

  // Global hook for Leaflet popups to trigger selection changes
  useEffect(() => {
    window.addSuggestedStore = (storeId) => {
      handleToggleStore(storeId);
    };
    return () => {
      delete window.addSuggestedStore;
    };
  }, [selectedIds, enrichedRetailers]);

  const handleSelectAllFiltered = () => {
    const storesWithCoords = filteredRetailers.filter(r => r.latitude && r.longitude);
    const neededToAdd = storesWithCoords.filter(r => !selectedIds.has(r.id));
    
    if (selectedIds.size + neededToAdd.length > 30) {
      alert("Selecting all filtered stores exceeds the maximum limit of 30 waypoints. Please filter more narrowly.");
      return;
    }

    setSelectedIds((prev) => {
      const next = new Set(prev);
      storesWithCoords.forEach(r => next.add(r.id));
      return next;
    });
    setOptimizedRoute(null);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setOptimizedRoute(null);
  };

  const handleSaveAddress = async (repId, address) => {
    setUpdatingAddress(true);
    setAddressError("");
    try {
      const res = await fetch(`/api/fomo/users/${repId}/home-address`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeAddress: address })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update address");
      }
      
      // Update localUsers state with the response
      setLocalUsers(prev => prev.map(u => {
        if (u.id === repId) {
          return {
            ...u,
            homeAddress: data.user.homeAddress,
            homeLatitude: data.user.homeLatitude,
            homeLongitude: data.user.homeLongitude
          };
        }
        return u;
      }));

      setIsEditingAddress(false);
    } catch (err) {
      setAddressError(err.message);
    } finally {
      setUpdatingAddress(false);
    }
  };

  // Get selected stores objects
  const selectedStores = useMemo(() => {
    return enrichedRetailers.filter((r) => selectedIds.has(r.id));
  }, [enrichedRetailers, selectedIds]);

  // Predefined service center coordinates, rep home address, or geocoded custom address
  const startPoint = useMemo(() => {
    if (startType === "center") {
      return SERVICE_CENTERS.find(c => c.id === selectedCenterId) || SERVICE_CENTERS[0];
    }
    if (startType === "repHome") {
      const activeRep = localUsers.find(u => u.id === selectedRepId);
      if (activeRep && activeRep.homeLatitude && activeRep.homeLongitude) {
        return {
          lat: activeRep.homeLatitude,
          lng: activeRep.homeLongitude,
          name: "Home (" + activeRep.name + ")"
        };
      }
      return SERVICE_CENTERS.find(c => c.id === selectedCenterId) || SERVICE_CENTERS[0];
    }
    if (customCoords) {
      return {
        lat: customCoords.lat,
        lng: customCoords.lng,
        name: "Home (" + (customCoords.resolvedAddress ? customCoords.resolvedAddress.split(",")[0] : "Custom Address") + ")"
      };
    }
    return null;
  }, [startType, selectedCenterId, customCoords, selectedRepId, localUsers]);

  // Auto-align Service Center when selectedRepId changes
  useEffect(() => {
    if (selectedRepId) {
      const repRoutes = routes.filter((r) => r.repId === selectedRepId);
      if (repRoutes.length > 0) {
        // Find which service center matches the routes
        let matched = null;
        for (const r of repRoutes) {
          matched = SERVICE_CENTERS.find(
            (c) => r.name.toLowerCase().includes(c.dbValue.toLowerCase())
          );
          if (matched) break;
        }
        if (matched) {
          setSelectedCenterId(matched.id);
          setStartType("center");
          setFilterByTerritory(true);
        }
      }
    }
  }, [selectedRepId, routes]);

  // Auto-cluster recommendations silently in the background if the weekly schedule is empty
  useEffect(() => {
    // Check if the schedule is empty (all days are null)
    const isScheduleEmpty = !weeklySchedule.Monday && 
                            !weeklySchedule.Tuesday && 
                            !weeklySchedule.Wednesday && 
                            !weeklySchedule.Thursday && 
                            !weeklySchedule.Friday;

    if (selectedRepId && isScheduleEmpty && startPoint && allScoredRepRetailers.length > 0 && !autoGeneratingSchedule) {
      const generateSchedule = async () => {
        setAutoGeneratingSchedule(true);
        try {
          const weeklyPool = allScoredRepRetailers.slice(0, 5 * targetStopsPerDay);
          const pool = weeklyPool.map((r) => ({
            ...r,
            angle: Math.atan2(r.longitude - startPoint.lng, r.latitude - startPoint.lat)
          }));
          pool.sort((a, b) => a.angle - b.angle);

          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          const newSchedule = { ...weeklySchedule };

          const totalStops = pool.length;
          const baseCount = Math.floor(totalStops / 5);
          const extraCount = totalStops % 5;
          const distribution = Array(5).fill(baseCount);
          for (let i = 0; i < extraCount; i++) {
            distribution[i]++;
          }

          let poolIdx = 0;

          for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
            const dayName = days[dayIdx];
            const count = distribution[dayIdx];
            if (count === 0) continue;
            
            const dayStops = pool.slice(poolIdx, poolIdx + count);
            poolIdx += count;

            const res = await fetch("/api/fomo/route/optimize", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                startPoint,
                waypoints: dayStops,
                roundTrip
              })
            });

            if (res.ok) {
              const result = await res.json();
              newSchedule[dayName] = {
                name: `${startPoint.name.split(" ")[0]} -> ${dayStops.length} CRM Recs`,
                startPoint,
                startType,
                selectedCenterId,
                customAddress,
                customCoords,
                roundTrip,
                filterByTerritory,
                selectedIds: dayStops.map((s) => s.id),
                completed: false,
                optimizedRoute: result
              };
            }
          }
          setWeeklySchedule(newSchedule);
        } catch (error) {
          console.error("Auto-generating schedule failed:", error);
        } finally {
          setAutoGeneratingSchedule(false);
        }
      };

      generateSchedule();
    }
  }, [selectedRepId, startPoint, allScoredRepRetailers, weeklySchedule, autoGeneratingSchedule, targetStopsPerDay, roundTrip, startType, selectedCenterId, customAddress, customCoords, filterByTerritory]);

  // Auto-align selected representative when selectedCenterId changes
  useEffect(() => {
    // Check if the current selected rep matches the center
    const currentRepRoutes = routes.filter((r) => r.repId === selectedRepId);
    let currentRepMatches = false;
    const centerObj = SERVICE_CENTERS.find(c => c.id === selectedCenterId);
    
    // Resolve robust search tokens for substring comparisons
    const searchTokens = [];
    if (centerObj) {
      const centerDbName = centerObj.dbValue.toLowerCase();
      if (centerDbName.includes("manhattan")) {
        searchTokens.push("manhattan");
      } else if (centerDbName.includes("garden city") || centerDbName.includes("long island")) {
        searchTokens.push("garden city", "gardencity", "long island");
      } else {
        searchTokens.push(centerDbName);
      }
    }

    if (centerObj && currentRepRoutes.length > 0) {
      currentRepMatches = currentRepRoutes.some((r) => 
        searchTokens.some((tok) => r.name.toLowerCase().includes(tok))
      );
    }

    // If the current rep doesn't belong to the selected center, switch to the first rep who does
    if (centerObj && !currentRepMatches) {
      // Find all reps who have routes in this center
      const centerReps = localUsers.filter((u) => {
        // Only consider Operations division users
        if (u.division !== "OPERATIONS") return false;

        const email = (u.email || "").toLowerCase();
        const subunit = (u.subunit || "").toLowerCase();
        const bureau = (u.bureau || "").toLowerCase();

        if (searchTokens.some(tok => email.includes(tok) || subunit.includes(tok) || bureau.includes(tok))) {
          return true;
        }

        const userRoutes = routes.filter(r => r.repId === u.id);
        if (userRoutes.some(r => searchTokens.some(tok => r.name.toLowerCase().includes(tok)))) {
          return true;
        }

        return false;
      });

      // Filter by manager relationship if "showAllReps" is off
      let availableReps = centerReps;
      if (!showAllReps) {
        const reports = centerReps.filter((u) => u.managerId === currentUser?.id);
        if (reports.length > 0) {
          availableReps = reports;
        }
      }

      if (availableReps.length > 0) {
        setSelectedRepId(availableReps[0].id);
        setOptimizedRoute(null);
        setSelectedIds(new Set());
      }
    }
  }, [selectedCenterId, routes, localUsers, showAllReps, currentUser]);

  // Get the most recently added store from selectedIds
  const lastSelectedStore = useMemo(() => {
    if (selectedIds.size === 0) return null;
    const idsArray = Array.from(selectedIds);
    const lastId = idsArray[idsArray.length - 1];
    return enrichedRetailers.find(r => r.id === lastId) || null;
  }, [selectedIds, enrichedRetailers]);

  // Compute the closest retailers to the last selected store
  const suggestedNearbyStops = useMemo(() => {
    if (!lastSelectedStore || !lastSelectedStore.latitude || !lastSelectedStore.longitude) return [];
    
    return enrichedRetailers
      .filter(r => r.id !== lastSelectedStore.id && !selectedIds.has(r.id) && r.latitude && r.longitude)
      .map(r => {
        const dist = haversineDistance(
          { lat: lastSelectedStore.latitude, lng: lastSelectedStore.longitude },
          { lat: r.latitude, lng: r.longitude }
        );
        return { ...r, distanceToLast: parseFloat(dist.toFixed(2)) };
      })
      .sort((a, b) => a.distanceToLast - b.distanceToLast)
      .slice(0, 5);
  }, [lastSelectedStore, enrichedRetailers, selectedIds]);

  const handleAddAllRecommendations = () => {
    const neededToAdd = recommendedStops.filter((r) => !selectedIds.has(r.id));
    if (selectedIds.size + neededToAdd.length > 30) {
      alert("Adding all recommended stores exceeds the maximum limit of 30 waypoints. Please remove some stops first.");
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      recommendedStops.forEach((r) => next.add(r.id));
      return next;
    });
    setOptimizedRoute(null);
  };

  const handleAutoClusterRecommendations = async () => {
    if (allScoredRepRetailers.length === 0) {
      alert("No recommendations available for this representative.");
      return;
    }
    if (!startPoint) {
      alert("Please define and verify your starting location first.");
      return;
    }

    setGeocoding(true);
    try {
      const weeklyPool = allScoredRepRetailers.slice(0, 5 * targetStopsPerDay);
      const pool = weeklyPool.map((r) => ({
        ...r,
        angle: Math.atan2(r.longitude - startPoint.lng, r.latitude - startPoint.lat)
      }));
      pool.sort((a, b) => a.angle - b.angle);

      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      const newSchedule = { ...weeklySchedule };

      const totalStops = pool.length;
      const baseCount = Math.floor(totalStops / 5);
      const extraCount = totalStops % 5;
      const distribution = Array(5).fill(baseCount);
      for (let i = 0; i < extraCount; i++) {
        distribution[i]++;
      }

      let poolIdx = 0;

      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const dayName = days[dayIdx];
        const count = distribution[dayIdx];
        if (count === 0) continue;
        
        const dayStops = pool.slice(poolIdx, poolIdx + count);
        poolIdx += count;

        const res = await fetch("/api/fomo/route/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startPoint,
            waypoints: dayStops,
            roundTrip
          })
        });

        if (res.ok) {
          const result = await res.json();
          newSchedule[dayName] = {
            name: `${startPoint.name.split(" ")[0]} -> ${dayStops.length} CRM Recs`,
            startPoint,
            startType,
            selectedCenterId,
            customAddress,
            customCoords,
            roundTrip,
            filterByTerritory,
            selectedIds: dayStops.map((s) => s.id),
            completed: false,
            optimizedRoute: result
          };
        }
      }

      setWeeklySchedule(newSchedule);
      setExpandedPanels({
        start: false,
        stops: false,
        recommend: false,
        picker: false,
        schedule: true
      });
      alert("Successfully clustered CRM recommendations into weekly routes!");
    } catch (e) {
      console.error(e);
      alert("Failed to cluster recommendations.");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSaveToSchedule = (day) => {
    if (!optimizedRoute) return;
    
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: {
        name: `${startPoint.name.split(" ")[0]} -> ${selectedStores.length} Stores`,
        startPoint,
        startType,
        selectedCenterId,
        customAddress,
        customCoords,
        roundTrip,
        filterByTerritory,
        selectedIds: Array.from(selectedIds),
        completed: false,
        optimizedRoute
      }
    }));
    
    setExpandedPanels({
      start: false,
      stops: false,
      picker: false,
      schedule: true
    });
  };

  const handleLoadFromSchedule = (day) => {
    const saved = weeklySchedule[day];
    if (!saved) return;
    
    setStartType(saved.startType);
    if (saved.selectedCenterId) setSelectedCenterId(saved.selectedCenterId);
    if (saved.customAddress) setCustomAddress(saved.customAddress);
    if (saved.customCoords) setCustomCoords(saved.customCoords);
    setRoundTrip(saved.roundTrip);
    if (saved.filterByTerritory !== undefined) setFilterByTerritory(saved.filterByTerritory);
    
    setSelectedIds(new Set(saved.selectedIds));
    setOptimizedRoute(saved.optimizedRoute);
    
    setExpandedPanels({
      start: false,
      stops: true,
      picker: false,
      schedule: false
    });
  };

  const handleClearFromSchedule = (day) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [day]: null
    }));
  };

  const handleAutoClusterWeek = async () => {
    if (filteredRetailers.length === 0) {
      alert("No stores in the filtered list. Please adjust your filters first.");
      return;
    }
    if (!startPoint) {
      alert("Please define and verify your starting location first.");
      return;
    }

    setGeocoding(true);
    try {
      const pool = filteredRetailers.map(r => ({
        ...r,
        angle: Math.atan2(r.longitude - startPoint.lng, r.latitude - startPoint.lat)
      }));

      // Sort by angle (geographical sweep)
      pool.sort((a, b) => a.angle - b.angle);

      const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
      const newSchedule = {
        Monday: null,
        Tuesday: null,
        Wednesday: null,
        Thursday: null,
        Friday: null
      };

      const storesPerDay = Math.ceil(pool.length / 5);
      
      for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
        const dayName = days[dayIdx];
        const daySectorStores = pool.slice(dayIdx * storesPerDay, (dayIdx + 1) * storesPerDay);
        
        if (daySectorStores.length === 0) continue;

        // Prioritize: anomalies first, then highest opportunity score
        const prioritizedStores = [...daySectorStores].sort((a, b) => {
          const aAnomaly = getAnomalyType(a) !== "normal" ? 1 : 0;
          const bAnomaly = getAnomalyType(b) !== "normal" ? 1 : 0;
          if (aAnomaly !== bAnomaly) return bAnomaly - aAnomaly;
          return b.opportunityScore - a.opportunityScore;
        });

        // Trim to target stops
        const finalDayStops = prioritizedStores.slice(0, targetStopsPerDay);

        const res = await fetch("/api/fomo/route/optimize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startPoint,
            waypoints: finalDayStops,
            roundTrip
          })
        });

        if (res.ok) {
          const result = await res.json();
          newSchedule[dayName] = {
            name: `${startPoint.name.split(" ")[0]} -> ${finalDayStops.length} Stores`,
            startPoint,
            startType,
            selectedCenterId,
            customAddress,
            customCoords,
            roundTrip,
            filterByTerritory,
            selectedIds: finalDayStops.map(s => s.id),
            completed: false,
            optimizedRoute: result
          };
        }
      }

      setWeeklySchedule(newSchedule);
      setExpandedPanels({
        start: false,
        stops: false,
        picker: false,
        schedule: true
      });
      alert("Successfully auto-generated and optimized weekly routes!");
    } catch (e) {
      console.error(e);
      alert("Failed to auto-cluster weekly routes.");
    } finally {
      setGeocoding(false);
    }
  };

  // Address lookup geocoding using Nominatim
  const handleGeocode = async () => {
    let rawInput = customAddress.trim();
    if (!rawInput) {
      alert("Please enter a starting address (e.g. home, town, or ZIP code) to locate.");
      return;
    }
    setGeocoding(true);
    setCustomCoords(null);
    setOptimizedRoute(null);
    
    try {
      // 1. Smart sanitation & formatting:
      // If the user did not specify a state code (e.g. CA, NJ, NY) or state name, 
      // append ", NY, USA" to focus the search on New York.
      let query = rawInput;
      const hasStatePattern = /,?\s*\b[A-Za-z]{2}\b(?:\s*,\s*USA)?$/i.test(rawInput) || 
                              /\b(New York|California|Jersey|Texas|Florida|Connecticut|Pennsylvania|Massachusetts)\b/i.test(rawInput);
      if (!hasStatePattern) {
        query = `${rawInput}, NY, USA`;
      }

      // Query Nominatim with New York State bounding box viewbox to prioritize local matches
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=-79.762,40.477,-71.777,45.015&limit=1`
      );
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const match = data[0];
          setCustomCoords({
            lat: parseFloat(match.lat),
            lng: parseFloat(match.lon),
            resolvedAddress: match.display_name
          });
        } else {
          // If query failed with state suffix, try a loose fallback search without suffix
          if (!hasStatePattern) {
            const fallbackRes = await fetch(
              `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawInput)}&limit=1`
            );
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData && fallbackData.length > 0) {
                const match = fallbackData[0];
                setCustomCoords({
                  lat: parseFloat(match.lat),
                  lng: parseFloat(match.lon),
                  resolvedAddress: match.display_name
                });
                setGeocoding(false);
                return;
              }
            }
          }
          alert(`Address not found: "${rawInput}"\n\nTips:\n- Include a city or ZIP code (e.g., "416 Pelham Rd, New Rochelle")\n- Double check the spelling\n- Enter a nearby street intersection or town center`);
        }
      } else {
        alert("Geocoding service returned an error. Please try again in a few seconds.");
      }
    } catch (error) {
      console.error("Geocoding failed:", error);
      alert("Network error: Could not reach geocoding service. Verify your connection.");
    } finally {
      setGeocoding(false);
    }
  };

  // Optimize route api request (with automatic geocoding if starting from home and not geocoded yet)
  const handleOptimizeRoute = async () => {
    if (selectedStores.length === 0) {
      alert("Please select at least 1 retailer to build a route.");
      return;
    }

    let activeStart = startPoint;

    // Auto-geocode custom address if starting from home and not geocoded yet
    if (startType === "custom" && !customCoords) {
      const rawInput = customAddress.trim();
      if (!rawInput) {
        alert("Please enter a starting home address.");
        return;
      }
      setGeocoding(true);
      try {
        let query = rawInput;
        const hasStatePattern = /,?\s*\b[A-Za-z]{2}\b(?:\s*,\s*USA)?$/i.test(rawInput) || 
                                /\b(New York|California|Jersey|Texas|Florida|Connecticut|Pennsylvania|Massachusetts)\b/i.test(rawInput);
        if (!hasStatePattern) {
          query = `${rawInput}, NY, USA`;
        }

        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&viewbox=-79.762,40.477,-71.777,45.015&limit=1`
        );
        if (geoRes.ok) {
          const data = await geoRes.json();
          if (data && data.length > 0) {
            const match = data[0];
            const coords = {
              lat: parseFloat(match.lat),
              lng: parseFloat(match.lon),
              resolvedAddress: match.display_name
            };
            setCustomCoords(coords);
            activeStart = {
              lat: coords.lat,
              lng: coords.lng,
              name: "Home (" + coords.resolvedAddress.split(",")[0] + ")"
            };
          } else {
            // Try loose fallback search
            if (!hasStatePattern) {
              const fallbackRes = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(rawInput)}&limit=1`
              );
              if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                if (fallbackData && fallbackData.length > 0) {
                  const match = fallbackData[0];
                  const coords = {
                    lat: parseFloat(match.lat),
                    lng: parseFloat(match.lon),
                    resolvedAddress: match.display_name
                  };
                  setCustomCoords(coords);
                  activeStart = {
                    lat: coords.lat,
                    lng: coords.lng,
                    name: "Home (" + coords.resolvedAddress.split(",")[0] + ")"
                  };
                  // Skip error since resolved
                  setGeocoding(false);
                } else {
                  alert(`Address not found: "${rawInput}"\n\nPlease check spelling or add city/ZIP code details.`);
                  setGeocoding(false);
                  return;
                }
              } else {
                alert("Geocoding service unavailable.");
                setGeocoding(false);
                return;
              }
            } else {
              alert(`Address not found: "${rawInput}"\n\nPlease check spelling or add city/ZIP code details.`);
              setGeocoding(false);
              return;
            }
          }
        } else {
          alert("Geocoding service returned an error.");
          setGeocoding(false);
          return;
        }
      } catch (e) {
        console.error("Geocoding failed inside optimizer:", e);
        alert("Address lookup failed.");
        setGeocoding(false);
        return;
      } finally {
        setGeocoding(false);
      }
    }

    if (!activeStart) {
      alert("Please verify your starting point coordinates.");
      return;
    }

    setOptimizing(true);
    try {
      const res = await fetch("/api/fomo/route/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startPoint: activeStart,
          waypoints: selectedStores,
          roundTrip
        })
      });

      if (!res.ok) throw new Error("Optimization query failed");
      const result = await res.json();
      setOptimizedRoute(result);
    } catch (e) {
      console.error(e);
      alert("Failed to compute optimized route. Please try again.");
    } finally {
      setOptimizing(false);
    }
  };

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 6,
    }).setView([42.8, -75.5], 7);
    mapRef.current = map;

    const isLight = document.body.classList.contains("light-theme");
    const tileUrl = isLight
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    layersRef.current.markers.addTo(map);
    layersRef.current.route.addTo(map);

    // Sync theme map tiles
    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      const nextTileUrl = isLightNow
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          layer.setUrl(nextTileUrl);
        }
      });
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, []);

  // Update map contents when selection or route results change
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old layers
    layersRef.current.markers.clearLayers();
    layersRef.current.route.clearLayers();

    const bounds = L.latLngBounds();

    // 1. Draw Start Point marker
    if (startPoint) {
      const startPos = [startPoint.lat, startPoint.lng];
      bounds.extend(startPos);

      const startIcon = L.divIcon({
        className: "custom-route-pin",
        html: `<div style="background-color:var(--green); color:white; border-radius:50%; width:28px; height:28px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:2.5px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.4);">S</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      L.marker(startPos, { icon: startIcon })
        .bindPopup(`<strong>Starting Point:</strong><br/>${startPoint.name}`)
        .addTo(layersRef.current.markers);
    }

    // 2. Draw stops markers
    if (optimizedRoute && optimizedRoute.optimizedWaypoints && optimizedRoute.optimizedWaypoints.length > 0) {
      // Draw optimized markers
      optimizedRoute.optimizedWaypoints.forEach((wp, index) => {
        const wpPos = [wp.lat, wp.lng];
        bounds.extend(wpPos);

        const stopIcon = L.divIcon({
          className: "custom-route-pin",
          html: `<div style="background-color:var(--purple); color:white; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.3);">${index + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        L.marker(wpPos, { icon: stopIcon })
          .bindPopup(`
            <strong>Stop #${index + 1}: ${wp.name}</strong><br/>
            <span>${wp.address}, ${wp.city}</span><br/>
            <span style="font-size:11px; color:var(--text-muted);">ID: ${wp.externalId}</span>
          `)
          .addTo(layersRef.current.markers);
      });

      // Draw polyline
      if (optimizedRoute.routeGeometry) {
        L.geoJSON(optimizedRoute.routeGeometry, {
          style: {
            color: "var(--blue)",
            weight: 5,
            opacity: 0.75,
            dashArray: optimizedRoute.isFallback ? "8, 8" : undefined
          }
        }).addTo(layersRef.current.route);
      }
    } else {
      // Draw selected stores as standard warning/inactive pins
      selectedStores.forEach((store) => {
        if (store.latitude && store.longitude) {
          const storePos = [store.latitude, store.longitude];
          bounds.extend(storePos);

          const selectIcon = L.divIcon({
            className: "custom-route-pin",
            html: `<div style="background-color:var(--text-muted); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:1.5px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);"><svg viewBox="0 0 24 24" width="10" height="10" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          L.marker(storePos, { icon: selectIcon })
            .bindPopup(`<strong>${store.name}</strong><br/><span>${store.address}</span>`)
            .addTo(layersRef.current.markers);
        }
      });
    }

    // 3. Draw suggested nearby stops markers as distinct visual options
    if (suggestedNearbyStops && suggestedNearbyStops.length > 0) {
      suggestedNearbyStops.forEach((s) => {
        if (s.latitude && s.longitude) {
          const sPos = [s.latitude, s.longitude];
          bounds.extend(sPos);

          const suggestIcon = L.divIcon({
            className: "custom-route-pin",
            html: `<div style="background-color:rgba(0, 180, 216, 0.85); color:white; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; border:1.5px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3); font-size:11px; font-weight:bold;">+</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });

          L.marker(sPos, { icon: suggestIcon })
            .bindPopup(`
              <div style="font-family:Inter, sans-serif; font-size:12px; color:var(--text); width:180px; line-height:1.4;">
                <strong style="display:block; margin-bottom:2px; color:var(--blue); font-weight:800;">Suggested Stop</strong>
                <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px;">${s.name}</strong>
                <div style="font-size:10.5px; color:var(--text-secondary); margin-bottom:4px;">${s.address}, ${s.city}</div>
                <div style="font-size:10px; color:var(--text-muted); margin-bottom:6px;">Distance: <strong>${s.distanceToLast} miles</strong></div>
                <button 
                  type="button" 
                  style="width:100%; text-align:center; padding:5px; font-size:11px; font-weight:bold; background-color:var(--blue); border:1px solid var(--blue); border-radius:4px; color:white; cursor:pointer;"
                  onclick="window.addSuggestedStore('${s.id}')"
                >
                  + Add to Route
                </button>
              </div>
            `)
            .addTo(layersRef.current.markers);
        }
      });
    }

    // 4. Draw CRM recommendations markers as distinct gold/orange visual options
    if (recommendedStops && recommendedStops.length > 0) {
      recommendedStops.forEach((s) => {
        // Only draw if it's not already selected as a stop
        if (!selectedIds.has(s.id) && s.latitude && s.longitude) {
          const sPos = [s.latitude, s.longitude];
          bounds.extend(sPos);

          const crmIcon = L.divIcon({
            className: "custom-route-pin",
            html: `<div style="background-color:var(--gold); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.4); font-size:11px; font-weight:bold;"><svg viewBox="0 0 24 24" width="10" height="10" stroke="white" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          L.marker(sPos, { icon: crmIcon })
            .bindPopup(`
              <div style="font-family:Inter, sans-serif; font-size:12px; color:var(--text); width:200px; line-height:1.4;">
                <strong style="display:block; margin-bottom:2px; color:var(--gold); font-weight:800;">CRM Recommendation (Score: ${s.recommendationScore})</strong>
                <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-bottom:4px;">${s.name}</strong>
                <div style="font-size:10.5px; color:var(--text-secondary); margin-bottom:4px;">${s.address}, ${s.city}</div>
                <div style="font-size:10px; color:var(--text-secondary); margin-bottom:6px;">
                  Tier: <strong>${s.salesTier}</strong> | Gap: <strong>${s.lastVisitDate ? `${s.visitGapDays} days` : "Never"}</strong>
                </div>
                <button 
                  type="button" 
                  style="width:100%; text-align:center; padding:5px; font-size:11px; font-weight:bold; background-color:var(--gold); border:1px solid var(--gold); border-radius:4px; color:white; cursor:pointer;"
                  onclick="window.addSuggestedStore('${s.id}')"
                >
                  + Add to Route
                </button>
              </div>
            `)
            .addTo(layersRef.current.markers);
        }
      });
    }

    // Adjust zoom bounds
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [startPoint, selectedStores, optimizedRoute, suggestedNearbyStops, recommendedStops]);

  return (
    <div style={{ 
      display: "grid", 
      gridTemplateColumns: mapExpanded ? "0.5fr 2fr" : "1.35fr 1.15fr", 
      gap: 20, 
      flex: 1, 
      minHeight: "680px",
      transition: "grid-template-columns 0.3s ease"
    }}>
      
      {/* LEFT COLUMN: Controls & Selections (Fluid Flexbox Accordion) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, height: "82vh", overflow: "hidden", paddingRight: 4 }}>
        
        {/* Settings Panel: Starting Location */}
        <div className="card" style={{ display: "flex", flexDirection: "column", padding: 0, overflow: "hidden", flexShrink: 0 }}>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              cursor: "pointer", 
              padding: "10px 14px", 
              backgroundColor: "var(--surface-2)", 
              borderBottom: "1px solid var(--border)",
              userSelect: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text)"
            }}
            onClick={() => togglePanel("start")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Building2 size={15} /> 1. Starting Location ({startType === "center" ? "Service Center" : "Home Address"})</span>
            <span>{expandedPanels.start ? "▲" : "▼"}</span>
          </div>
          
          {expandedPanels.start && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Employee Route Assignment Selector */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBottom: 6, borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
                    Assign Route To Representative:
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: 10, cursor: "pointer", color: "var(--text-secondary)", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={showAllReps}
                      onChange={(e) => setShowAllReps(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Manager Override (Show All Reps)
                  </label>
                </div>
                 <select
                  className="form-select"
                  value={selectedRepId}
                  onChange={(e) => {
                    setSelectedRepId(e.target.value);
                    setOptimizedRoute(null);
                    setSelectedIds(new Set());
                  }}
                  style={{ width: "100%", fontSize: 12 }}
                >
                  {groupedReps.local.length > 0 && (
                    <optgroup label={`${SERVICE_CENTERS.find(c => c.id === selectedCenterId)?.name || "Local"} Staff`}>
                      {groupedReps.local.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email.split("@")[0]} - {u.division})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedReps.temp.length > 0 && (
                    <optgroup label="Temp / Other Locations">
                      {groupedReps.temp.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.email.split("@")[0]} - {u.division})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {groupedReps.local.length === 0 && groupedReps.temp.length === 0 && (
                    <option value={currentUser?.id || ""}>{currentUser?.name || "Self"}</option>
                  )}
                </select>
                <div style={{
                  marginTop: 6,
                  padding: "6px 10px",
                  backgroundColor: "var(--blue-dim)",
                  borderLeft: "2.5px solid var(--blue)",
                  borderRadius: "0 4px 4px 0",
                  fontSize: "10.5px",
                  lineHeight: "1.4",
                  color: "var(--text-secondary)"
                }}>
                  💡 <strong>Manager Guide:</strong> Select a representative to design their weekly schedule. Auto-clusters and manual saves will be saved to their profile and alert them on their login dashboard.
                </div>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${startType === "center" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, justifyContent: "center", padding: "6px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                  onClick={() => setStartType("center")}
                >
                  <Building2 size={12} /> Service Center
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${startType === "repHome" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, justifyContent: "center", padding: "6px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                  onClick={() => setStartType("repHome")}
                >
                  <Home size={12} /> Rep Home
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${startType === "custom" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, justifyContent: "center", padding: "6px", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                  onClick={() => setStartType("custom")}
                >
                  <MapPin size={12} /> Custom
                </button>
              </div>

              {startType === "center" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <select
                    className="form-select"
                    value={selectedCenterId}
                    onChange={(e) => {
                      setSelectedCenterId(e.target.value);
                      setOptimizedRoute(null);
                    }}
                    style={{ width: "100%" }}
                  >
                    {SERVICE_CENTERS.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.address.split(",")[0]})</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <input
                      type="checkbox"
                      id="filterByTerritory"
                      checked={filterByTerritory}
                      onChange={(e) => {
                        setFilterByTerritory(e.target.checked);
                        setOptimizedRoute(null);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <label htmlFor="filterByTerritory" style={{ fontSize: 11, cursor: "pointer", color: "var(--text-secondary)", userSelect: "none" }}>
                      Filter stores to this Service Center's territory bounds
                    </label>
                  </div>
                </div>
              )}

              {startType === "repHome" && (() => {
                const activeRep = localUsers.find(u => u.id === selectedRepId);
                if (activeRep) {
                  const hasHome = !!(activeRep.homeLatitude && activeRep.homeLongitude);
                  
                  if (isEditingAddress) {
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, backgroundColor: "var(--surface-3)", borderRadius: 6, border: "1px solid var(--border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: "bold" }}>Edit Home Address for {activeRep.name}</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "1px 4px", fontSize: 9, height: 16 }}
                            onClick={() => {
                              setIsEditingAddress(false);
                              setAddressError("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                          <input
                            type="text"
                            className="search-input"
                            value={editAddressVal}
                            onChange={(e) => setEditAddressVal(e.target.value)}
                            placeholder="e.g. 50 State St, Albany, NY"
                            style={{ flex: 1, fontSize: 11, height: 24, padding: "2px 6px" }}
                            disabled={updatingAddress}
                          />
                          <button
                            type="button"
                            className="btn btn-success"
                            style={{ padding: "2px 8px", fontSize: 10, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--green)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                            onClick={() => handleSaveAddress(activeRep.id, editAddressVal)}
                            disabled={updatingAddress}
                          >
                            {updatingAddress ? "..." : "Save"}
                          </button>
                        </div>
                        {addressError && (
                          <span style={{ fontSize: 9, color: "var(--red)", marginTop: 2 }}>
                            {addressError}
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (hasHome) {
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                              Rep Home Address Loaded
                            </div>
                            <div style={{ display: "flex", gap: 4 }}>
                              <button
                                type="button"
                                style={{ padding: "1px 6px", fontSize: 9, height: 18, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", borderRadius: 3, cursor: "pointer" }}
                                onClick={() => {
                                  setIsEditingAddress(true);
                                  setEditAddressVal(activeRep.homeAddress || "");
                                  setAddressError("");
                                }}
                              >
                                ✏️ Edit
                              </button>
                              <button
                                type="button"
                                style={{ padding: "1px 6px", fontSize: 9, height: 18, border: "1px solid var(--red-border)", background: "transparent", color: "var(--red)", borderRadius: 3, cursor: "pointer" }}
                                onClick={() => handleSaveAddress(activeRep.id, "")}
                                disabled={updatingAddress}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: "12px", padding: "8px 12px", backgroundColor: "rgba(40, 167, 69, 0.08)", border: "1px solid var(--status-active-border)", borderLeft: "4px solid var(--green)", borderRadius: 6, color: "var(--text-secondary)" }}>
                            {activeRep.homeAddress}
                          </div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                            Territory to Load
                          </div>
                          <select
                            className="form-select"
                            value={selectedCenterId}
                            onChange={(e) => {
                              setSelectedCenterId(e.target.value);
                              setOptimizedRoute(null);
                            }}
                            style={{ width: "100%" }}
                          >
                            {SERVICE_CENTERS.map(c => (
                              <option key={c.id} value={c.id}>{c.name} Territory</option>
                            ))}
                          </select>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                            <input
                              type="checkbox"
                              id="filterByTerritoryRepHome"
                              checked={filterByTerritory}
                              onChange={(e) => {
                                setFilterByTerritory(e.target.checked);
                                setOptimizedRoute(null);
                              }}
                              style={{ cursor: "pointer" }}
                            />
                            <label htmlFor="filterByTerritoryRepHome" style={{ fontSize: 11, cursor: "pointer", color: "var(--text-secondary)", userSelect: "none" }}>
                              Filter stores to this office's territory bounds
                            </label>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div style={{ fontSize: 12, padding: "10px 12px", backgroundColor: "rgba(220, 53, 69, 0.08)", border: "1px solid var(--status-rejected-border)", borderLeft: "4px solid var(--red)", borderRadius: 6, display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: "bold", color: "var(--red)", fontSize: "11px" }}>No Address Registered</div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ padding: "2px 8px", fontSize: 9.5, height: 20, backgroundColor: "var(--red)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                          onClick={() => {
                            setIsEditingAddress(true);
                            setEditAddressVal("");
                            setAddressError("");
                          }}
                        >
                          + Add Address
                        </button>
                      </div>
                      <div style={{ color: "var(--text-secondary)", fontSize: "11.5px" }}>
                        This rep does not have home coordinates saved. Add their home address to allow home-origin routes.
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {startType === "custom" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      className="search-input"
                      placeholder="Enter home/starting address..."
                      value={customAddress}
                      onChange={(e) => setCustomAddress(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleGeocode}
                      disabled={geocoding}
                      style={{ padding: "8px 12px", minWidth: 90, justifyContent: "center" }}
                    >
                      {geocoding ? "Locating..." : "Geocode"}
                    </button>
                  </div>
                  {customCoords && (
                    <div style={{ fontSize: 11, color: "var(--green)", padding: "6px 10px", backgroundColor: "rgba(40, 167, 69, 0.08)", borderRadius: 4, borderLeft: "2.5px solid var(--green)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <MapPin size={12} /> Resolved: <strong>{customCoords.resolvedAddress.split(",").slice(0, 2).join(",")}</strong>
                    </div>
                  )}
                  
                  {/* Custom starting office bounds selection */}
                  <div style={{ marginTop: 4, borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                      Assigned Office / Territory to Visit
                    </div>
                    <select
                      className="form-select"
                      value={selectedCenterId}
                      onChange={(e) => {
                        setSelectedCenterId(e.target.value);
                        setOptimizedRoute(null);
                      }}
                      style={{ width: "100%" }}
                    >
                      {SERVICE_CENTERS.map(c => (
                        <option key={c.id} value={c.id}>{c.name} Territory</option>
                      ))}
                    </select>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                      <input
                        type="checkbox"
                        id="filterByTerritoryCustom"
                        checked={filterByTerritory}
                        onChange={(e) => {
                          setFilterByTerritory(e.target.checked);
                          setOptimizedRoute(null);
                        }}
                        style={{ cursor: "pointer" }}
                      />
                      <label htmlFor="filterByTerritoryCustom" style={{ fontSize: 11, cursor: "pointer", color: "var(--text-secondary)", userSelect: "none" }}>
                        Filter stores to this office's territory bounds
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Round-trip (return to start)</span>
                <label className="switch" style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={roundTrip}
                    onChange={(e) => {
                      setRoundTrip(e.target.checked);
                      setOptimizedRoute(null);
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{roundTrip ? "ON" : "OFF"}</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Selected Itinerary Statistics and Actions */}
        <div className="card" style={{ 
          display: "flex", 
          flexDirection: "column", 
          padding: 0, 
          overflow: "hidden", 
          flex: expandedPanels.stops ? 1 : "0 0 auto",
          minHeight: expandedPanels.stops ? "220px" : "auto",
          transition: "flex 0.2s ease"
        }}>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              cursor: "pointer", 
              padding: "10px 14px", 
              backgroundColor: "var(--surface-2)", 
              borderBottom: "1px solid var(--border)",
              userSelect: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text)"
            }}
            onClick={() => togglePanel("stops")}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <MapPin size={15} />
              <span>2. Selected Route Stops</span>
              <span className="badge badge-submitted" style={{ padding: "2px 6px", fontSize: 10 }}>{selectedIds.size}</span>
            </div>
            <span>{expandedPanels.stops ? "▲" : "▼"}</span>
          </div>
          
          {expandedPanels.stops && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Itinerary List (Max 30 stops)</span>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearSelection}
                    style={{ padding: "3px 6px", fontSize: 10 }}
                  >
                    Clear All
                  </button>
                )}
              </div>

              {selectedStores.length === 0 ? (
                <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  Select retailers from the picker list below to create your itinerary.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
                  
                  {/* Ordered Itinerary List */}
                  <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2, minHeight: "120px" }}>
                    <div style={{ fontSize: 11, color: "var(--green)", display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--green)" }}></span>
                      <span><strong>Start:</strong> {startPoint ? startPoint.name : "Starting point not verified"}</span>
                    </div>
                    
                    {(optimizedRoute && optimizedRoute.optimizedWaypoints ? optimizedRoute.optimizedWaypoints : selectedStores).map((wp, idx) => (
                      <div key={wp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "var(--surface-3)", borderRadius: 4, fontSize: 12 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                          <span style={{ fontWeight: 700, color: "var(--purple)", minWidth: 16 }}>{idx + 1}.</span>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            <strong>{wp.name}</strong>
                            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{wp.address}, {wp.city}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleStore(wp.id)}
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "0 4px" }}
                          aria-label="Remove stop"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    {roundTrip && (
                      <div style={{ fontSize: 11, color: "var(--green)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--red)" }}></span>
                        <span><strong>End:</strong> {startPoint ? startPoint.name : "Start point"}</span>
                      </div>
                    )}
                  </div>

                  {/* Suggested Nearby Stops Widget */}
                  {suggestedNearbyStops.length > 0 && (
                    <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8, flexShrink: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", display: "flex", alignItems: "center", gap: "4px" }}>
                          <Store size={12} /> Suggested Nearby Stops (from last stop)
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              let addedCount = 0;
                              for (const s of suggestedNearbyStops) {
                                if (!next.has(s.id)) {
                                  if (next.size >= 30) {
                                    alert("Maximum waypoint limit reached (30 stores per route).");
                                    break;
                                  }
                                  next.add(s.id);
                                  addedCount++;
                                }
                              }
                              if (addedCount > 0) setOptimizedRoute(null);
                              return next;
                            });
                          }}
                          style={{ padding: "2px 6px", fontSize: 9, height: 18, color: "var(--blue)", borderColor: "var(--blue)", backgroundColor: "var(--blue-dim)" }}
                        >
                          + Add All 5
                        </button>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {suggestedNearbyStops.map(s => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", backgroundColor: "var(--surface-1)", borderRadius: 4, fontSize: 11 }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: 8 }}>
                              <strong>{s.name}</strong> <span style={{ fontSize: 9, color: "var(--text-muted)" }}>({s.distanceToLast} mi)</span>
                              <div style={{ fontSize: 9, color: "var(--text-secondary)", display: "flex", gap: 6, marginTop: 1 }}>
                                <span>{s.salesTier} Tier</span>
                                <span>|</span>
                                <span>{s.county}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleToggleStore(s.id)}
                              style={{ padding: "2px 6px", fontSize: 10, height: 18, backgroundColor: "var(--blue-dim)", borderColor: "var(--blue)", color: "var(--blue)" }}
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>

        {/* CRM Intelligent Recommendations Panel */}
        <div className="card" style={{ 
          display: "flex", 
          flexDirection: "column", 
          padding: 0, 
          overflow: "hidden", 
          flex: expandedPanels.recommend ? 1 : "0 0 auto",
          minHeight: expandedPanels.recommend ? "220px" : "auto",
          transition: "flex 0.2s ease"
        }}>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              cursor: "pointer", 
              padding: "10px 14px", 
              backgroundColor: "var(--surface-2)", 
              borderBottom: "1px solid var(--border)",
              userSelect: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text)"
            }}
            onClick={() => togglePanel("recommend")}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Zap size={15} style={{ color: "var(--gold)" }} />
              <span>CRM Intelligent Recommendations</span>
              {recommendedStops.length > 0 && (
                <span className="badge badge-active" style={{ padding: "2px 6px", fontSize: 10 }}>{recommendedStops.length}</span>
              )}
            </div>
            <span>{expandedPanels.recommend ? "▲" : "▼"}</span>
          </div>

          {expandedPanels.recommend && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              {recommendedStops.length === 0 ? (
                <div style={{ padding: "16px 8px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  Select a representative with route assignments to see intelligent recommendations.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
                  
                  {/* Tab Navigation */}
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 4, gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setRecViewMode("week")}
                      style={{
                        padding: "6px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: "transparent",
                        border: "none",
                        borderBottom: recViewMode === "week" ? "2.5px solid var(--purple)" : "2.5px solid transparent",
                        color: recViewMode === "week" ? "var(--purple)" : "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <Calendar size={13} /> Weekly Plan (Mon-Fri)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecViewMode("list")}
                      style={{
                        padding: "6px 8px",
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: "transparent",
                        border: "none",
                        borderBottom: recViewMode === "list" ? "2.5px solid var(--purple)" : "2.5px solid transparent",
                        color: recViewMode === "list" ? "var(--purple)" : "var(--text-secondary)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4
                      }}
                    >
                      <List size={13} /> Priority Backlog ({recommendedStops.length})
                    </button>
                  </div>

                  {recViewMode === "week" ? (
                    // Weekly Recommendation Schedule View
                    (() => {
                      const isScheduleEmpty = !weeklySchedule.Monday && 
                                              !weeklySchedule.Tuesday && 
                                              !weeklySchedule.Wednesday && 
                                              !weeklySchedule.Thursday && 
                                              !weeklySchedule.Friday;
                      
                      if (isScheduleEmpty) {
                        return (
                          <div style={{ padding: "24px 12px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                            <Zap size={28} style={{ color: "var(--purple)", opacity: 0.6 }} />
                            <div style={{ fontSize: 13, fontWeight: 600 }}>No Weekly Schedule Planned</div>
                            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0, maxWidth: 220 }}>
                              Automatically distribute this representative's top CRM recommended stores into optimized routes for Monday through Friday.
                            </p>
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={handleAutoClusterRecommendations}
                              style={{ padding: "6px 12px", fontSize: 11, backgroundColor: "var(--purple)", borderColor: "var(--purple)", color: "white", marginTop: 4 }}
                            >
                              ⚡ Generate Weekly Routes
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                            const saved = weeklySchedule[day];
                            return (
                              <div key={day} style={{ 
                                padding: "8px 10px", 
                                backgroundColor: "var(--surface-3)", 
                                borderRadius: 6, 
                                border: "1px solid var(--border)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 6
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <span style={{ fontWeight: 800, color: "var(--purple)", fontSize: 11.5 }}>
                                      {day}
                                    </span>
                                    {saved ? (
                                      <span className="badge badge-active" style={{ fontSize: 9, padding: "1px 4px" }}>
                                        {saved.optimizedRoute?.waypoints?.length || saved.selectedIds?.length || 0} Stores
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 10, color: "var(--text-muted)", fontStyle: "italic" }}>
                                        No route planned
                                      </span>
                                    )}
                                  </div>
                                  
                                  {saved && (
                                    <div style={{ display: "flex", gap: 4 }}>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleLoadFromSchedule(day)}
                                        style={{ padding: "1px 5px", fontSize: 9.5, height: 18, color: "var(--purple)", borderColor: "var(--purple)", backgroundColor: "var(--purple-dim)" }}
                                      >
                                        Edit
                                      </button>
                                      {saved.optimizedRoute?.googleMapsUrl && (
                                        <a
                                          href={saved.optimizedRoute.googleMapsUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="btn btn-primary btn-sm"
                                          style={{ 
                                            padding: "1px 5px", 
                                            fontSize: 9.5, 
                                            height: 18, 
                                            backgroundColor: "var(--green)", 
                                            borderColor: "var(--green)", 
                                            color: "white", 
                                            textDecoration: "none",
                                            display: "inline-flex",
                                            alignItems: "center"
                                          }}
                                        >
                                          Map
                                        </a>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {saved && saved.optimizedRoute?.waypoints && (
                                  <div style={{ 
                                    display: "flex", 
                                    flexDirection: "column", 
                                    gap: 4, 
                                    paddingLeft: 6, 
                                    borderLeft: "2px solid var(--border)",
                                    marginTop: 2
                                  }}>
                                    {saved.optimizedRoute.waypoints.map((wp, idx) => {
                                      const opportunity = getStoreOpportunity(wp.id);
                                      return (
                                        <div key={wp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10.5 }}>
                                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                                            <span style={{ color: "var(--text-muted)", marginRight: 4 }}>{idx + 1}.</span>
                                            <strong>{wp.name}</strong>
                                          </span>
                                          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                                            <span className={`badge ${opportunity.tier === "Gold" ? "badge-approved" : opportunity.tier === "Silver" ? "badge-submitted" : "badge-draft"}`} style={{ fontSize: 7.5, padding: "0px 3px" }}>
                                              {opportunity.tier}
                                            </span>
                                            {opportunity.wowTrend < -10 && (
                                              <span style={{ color: "var(--red)", fontSize: 8 }} title="Sales Underperforming Trend">⚠️</span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    // Priority Backlog View (Flat List)
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Top Territory Opportunities</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleAddAllRecommendations}
                            style={{ padding: "3px 6px", fontSize: 10, color: "var(--blue)", borderColor: "var(--blue)", backgroundColor: "var(--blue-dim)" }}
                          >
                            + Add All
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleAutoClusterRecommendations}
                            style={{ padding: "3px 8px", fontSize: 10, backgroundColor: "var(--purple)", borderColor: "var(--purple)", color: "white" }}
                          >
                            ⚡ Auto-Cluster
                          </button>
                        </div>
                      </div>

                      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                        {recommendedStops.map((s) => {
                          const isSelected = selectedIds.has(s.id);
                          return (
                            <div key={s.id} style={{ 
                              padding: "8px 10px", 
                              backgroundColor: "var(--surface-3)", 
                              borderRadius: 6, 
                              border: "1px solid var(--border)",
                              display: "flex",
                              flexDirection: "column",
                              gap: 6
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <strong style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</strong>
                                  <span style={{ fontSize: 9.5, color: "var(--text-secondary)" }}>ID: {s.externalId} &bull; Route: {s.route?.code || "—"}</span>
                                </div>
                                <button
                                  type="button"
                                  className={`btn btn-sm ${isSelected ? "btn-secondary" : "btn-primary"}`}
                                  onClick={() => handleToggleStore(s.id)}
                                  style={{ 
                                    padding: "2px 6px", 
                                    fontSize: 10, 
                                    height: 20, 
                                    flexShrink: 0,
                                    backgroundColor: isSelected ? "var(--surface-2)" : undefined,
                                    borderColor: isSelected ? "var(--border)" : undefined,
                                    color: isSelected ? "var(--text-secondary)" : undefined
                                  }}
                                >
                                  {isSelected ? "✓ Added" : "+ Add"}
                                </button>
                              </div>

                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
                                <span className={`badge ${s.salesTier === "Gold" ? "badge-approved" : s.salesTier === "Silver" ? "badge-submitted" : "badge-draft"}`} style={{ fontSize: 8, padding: "1px 4px" }}>
                                  {s.salesTier} Tier
                                </span>
                                
                                {s.anomaly === "underperforming" && (
                                  <span className="badge badge-rejected" style={{ fontSize: 8, padding: "1px 4px" }}>
                                    ⚠️ Underperforming
                                  </span>
                                )}
                                {s.anomaly === "outperforming" && (
                                  <span className="badge badge-active" style={{ fontSize: 8, padding: "1px 4px" }}>
                                    📈 Outperforming
                                  </span>
                                )}

                                <span className="badge badge-draft" style={{ fontSize: 8, padding: "1px 4px" }}>
                                  Gap: {s.lastVisitDate ? `${s.visitGapDays}d` : "Never"}
                                </span>

                                <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                  Score: {s.recommendationScore}
                                  <HelpTooltip text="CRM recommendation priority score calculated using sales tier, elapsed days since last visit, and peer-normalized WoW performance deviations." />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Filtered Store Picker */}
        <div className="card" style={{ 
          display: "flex", 
          flexDirection: "column", 
          padding: 0, 
          overflow: "hidden", 
          flex: expandedPanels.picker ? 1 : "0 0 auto",
          minHeight: expandedPanels.picker ? "220px" : "auto" 
        }}>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              cursor: "pointer", 
              padding: "10px 14px", 
              backgroundColor: "var(--surface-2)", 
              borderBottom: "1px solid var(--border)",
              userSelect: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text)"
            }}
            onClick={() => togglePanel("picker")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Building2 size={15} /> 3. Store Selection Registry</span>
            <span>{expandedPanels.picker ? "▲" : "▼"}</span>
          </div>

          {expandedPanels.picker && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              
              {selectedRepId && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 2 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: 11, color: "var(--text-secondary)", cursor: "pointer", userSelect: "none" }}>
                    <input
                      type="checkbox"
                      checked={repRoutesOnly}
                      onChange={(e) => setRepRoutesOnly(e.target.checked)}
                      style={{ cursor: "pointer" }}
                    />
                    Filter Registry to Rep's Assigned Routes ({repRouteIds.length})
                  </label>
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input
                  type="text"
                  className="search-input"
                  style={{ flex: 1, minWidth: 150 }}
                  placeholder="Search store name/address/ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="form-select"
                  value={routeFilter}
                  onChange={(e) => setRouteFilter(e.target.value)}
                  style={{ width: 110 }}
                >
                  <option value="all">All Routes</option>
                  {(selectedRepId && repRouteIds.length > 0
                    ? routes.filter(r => r.repId === selectedRepId)
                    : routes
                  ).map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
                </select>
                <select
                  className="form-select"
                  value={chainFilter}
                  onChange={(e) => setChainFilter(e.target.value)}
                  style={{ width: 110 }}
                >
                  <option value="all">All Chains</option>
                  {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Advanced CRM Sales Intelligence Filters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                <select
                  className="form-select"
                  value={opportunityFilter}
                  onChange={(e) => setOpportunityFilter(e.target.value)}
                  style={{ flex: 1, minWidth: 130 }}
                >
                  <option value="all">All Sales Tiers</option>
                  <option value="gold">Gold (High Growth Only)</option>
                  <option value="gold_silver">Gold & Silver Tiers</option>
                </select>

                <select
                  className="form-select"
                  value={anomalyFilter}
                  onChange={(e) => setAnomalyFilter(e.target.value)}
                  style={{ flex: 1, minWidth: 130 }}
                >
                  <option value="all">All Performances</option>
                  <option value="underperforming">⚠️ Underperforming Peers</option>
                  <option value="outperforming">📈 Outperforming Peers</option>
                </select>
              </div>

              {/* Days Since Last Visit Slider Filter */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", backgroundColor: "var(--surface-1)", borderRadius: 6, border: "1px solid var(--border)", marginTop: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    Last Visited Gap:
                    <HelpTooltip text="Filter retailers based on the number of elapsed days since their last recorded field representative visit." />
                  </span>
                  <strong>{lastVisitDaysFilter === 0 ? "Show All" : `>= ${lastVisitDaysFilter} Days`}</strong>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={lastVisitDaysFilter}
                  onChange={(e) => setLastVisitDaysFilter(parseInt(e.target.value))}
                  style={{ width: "100%", accentColor: "var(--blue)", cursor: "pointer" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  Filtered: <strong>{filteredRetailers.length}</strong> stores
                </span>
                {filteredRetailers.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSelectAllFiltered}
                    style={{ padding: "4px 8px", fontSize: 10 }}
                  >
                    Add All Filtered (Max 30)
                  </button>
                )}
              </div>

              {/* Table Container - Flex-grows to take remaining space */}
              <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6, minHeight: "120px" }}>
                {filteredRetailers.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No matching retailers found.
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, backgroundColor: "var(--surface-2)", zIndex: 1 }}>
                        <th style={{ width: 35, padding: "6px 8px" }}></th>
                        <th style={{ padding: "6px 8px" }}>Retailer</th>
                        <th style={{ padding: "6px 8px" }}>Location</th>
                        <th style={{ padding: "6px 8px" }}>County</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRetailers.map((r) => {
                        const hasCoords = r.latitude && r.longitude;
                        const isSelected = selectedIds.has(r.id);
                        return (
                          <tr
                            key={r.id}
                            onClick={() => hasCoords && handleToggleStore(r.id)}
                            style={{
                              cursor: hasCoords ? "pointer" : "not-allowed",
                              opacity: hasCoords ? 1 : 0.45,
                              backgroundColor: isSelected ? "var(--surface-3)" : undefined
                            }}
                          >
                            <td style={{ padding: "6px 4px", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!hasCoords}
                                onChange={() => handleToggleStore(r.id)}
                                style={{ cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ padding: 6 }}>
                              <strong>{r.name}</strong>
                              <div style={{ fontSize: 9.5, color: "var(--text-secondary)" }}>ID: {r.externalId}</div>
                              {/* Opportunity Sales Tier & Geographic Normalization anomaly badges */}
                              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                                <span className={`badge ${r.salesTier === "Gold" ? "badge-approved" : r.salesTier === "Silver" ? "badge-submitted" : "badge-draft"}`} style={{ fontSize: 8, padding: "1px 4px" }}>
                                  {r.salesTier} Tier ({r.opportunityScore} pts)
                                </span>
                                {getAnomalyType(r) === "underperforming" && (
                                  <span className="badge badge-rejected" style={{ fontSize: 8, padding: "1px 4px" }}>
                                    ⚠️ Underperforming
                                  </span>
                                )}
                                {getAnomalyType(r) === "outperforming" && (
                                  <span className="badge badge-active" style={{ fontSize: 8, padding: "1px 4px" }}>
                                    📈 Outperforming
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: 6 }}>
                              {r.address}, {r.city}
                              <div style={{ fontSize: 9, color: "var(--text-secondary)", marginTop: 2 }}>
                                Last Visit: {r.lastVisitDate ? new Date(r.lastVisitDate).toLocaleDateString() : "Never"}
                              </div>
                              {!hasCoords && (
                                <div style={{ fontSize: 9, color: "var(--red)", fontWeight: 600, display: "flex", alignItems: "center", gap: "3px" }}><AlertTriangle size={10} /> No Coordinates</div>
                              )}
                            </td>
                            <td style={{ padding: 6 }} className="muted">{r.county || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Weekly Planning Board */}
        <div className="card" style={{ 
          display: "flex", 
          flexDirection: "column", 
          padding: 0, 
          overflow: "hidden", 
          flex: expandedPanels.schedule ? 1 : "0 0 auto",
          minHeight: expandedPanels.schedule ? "220px" : "auto" 
        }}>
          <div 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              cursor: "pointer", 
              padding: "10px 14px", 
              backgroundColor: "var(--surface-2)", 
              borderBottom: "1px solid var(--border)",
              userSelect: "none",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--text)"
            }}
            onClick={() => togglePanel("schedule")}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Compass size={15} /> 4. Weekly Planning Board</span>
            <span>{expandedPanels.schedule ? "▲" : "▼"}</span>
          </div>

          {expandedPanels.schedule && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  Mon-Fri Calendar & Route Summaries
                </div>
                {autoGeneratingSchedule && (
                  <div style={{ fontSize: 10, color: "var(--primary)", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}>
                    <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></span>
                    Auto-generating recommendations...
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => {
                  const saved = weeklySchedule[day];
                  return (
                    <div key={day} style={{ 
                      padding: "8px 12px", 
                      backgroundColor: saved ? "var(--surface-3)" : "var(--surface-1)", 
                      borderRadius: 6, 
                      border: "1px solid var(--border)",
                      fontSize: 12
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: saved ? 6 : 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 800, color: saved ? "var(--blue)" : "var(--text-muted)", minWidth: 65 }}>
                            {day}:
                          </span>
                          <span style={{ color: saved ? "var(--text)" : "var(--text-muted)", fontStyle: saved ? "normal" : "italic" }}>
                            {saved ? saved.name : "No route planned"}
                          </span>
                        </div>
                        {saved && saved.completed && (
                          <span className="badge badge-active" style={{ fontSize: 9, padding: "1px 4px" }}>Completed</span>
                        )}
                      </div>

                      {saved && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, backgroundColor: "var(--surface-1)", padding: "4px 8px", borderRadius: 4, fontSize: 11 }}>
                            <div>
                              <span style={{ color: "var(--text-muted)" }}>Distance:</span>{" "}
                              <strong style={{ color: "var(--text)" }}>{saved.optimizedRoute?.totalDistanceMiles || 0} mi</strong>
                            </div>
                            <div>
                              <span style={{ color: "var(--text-muted)" }}>Travel:</span>{" "}
                              <strong style={{ color: "var(--text)" }}>
                                {saved.optimizedRoute?.totalDurationMinutes 
                                  ? `${Math.floor(saved.optimizedRoute.totalDurationMinutes / 60)}h ${saved.optimizedRoute.totalDurationMinutes % 60}m` 
                                  : "0m"}
                              </strong>
                            </div>
                          </div>

                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleClearFromSchedule(day)}
                              style={{ padding: "3px 6px", fontSize: 10, height: 22 }}
                            >
                              Clear
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleLoadFromSchedule(day)}
                              style={{ padding: "3px 6px", fontSize: 10, height: 22, color: "var(--purple)", borderColor: "var(--purple)", backgroundColor: "var(--purple-dim)" }}
                            >
                              Edit Selection
                            </button>
                            {saved.optimizedRoute?.googleMapsUrl && (
                              <a
                                href={saved.optimizedRoute.googleMapsUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="btn btn-primary btn-sm"
                                style={{ 
                                  padding: "3px 8px", 
                                  fontSize: 10, 
                                  height: 22, 
                                  backgroundColor: "var(--green)", 
                                  borderColor: "var(--green)", 
                                  color: "white", 
                                  textDecoration: "none",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4
                                }}
                              >
                                <Compass size={11} /> Launch Map
                              </a>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Step 4: Route Optimization & Actions (Persistent Footer) */}
        <div className="card" style={{ 
          display: "flex", 
          flexDirection: "column", 
          padding: "10px 14px", 
          gap: 8, 
          flexShrink: 0,
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)",
          borderRadius: 8
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><Zap size={13} style={{ color: "var(--gold)" }} /> Step 4: Route Optimization & Action</span>
            {selectedIds.size > 0 && (
              <span className="badge badge-submitted" style={{ padding: "2px 6px", fontSize: 10 }}>
                {selectedIds.size} Stop{selectedIds.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {selectedIds.size === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredRetailers.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, backgroundColor: "var(--surface-1)", borderRadius: 6, border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Compass size={13} style={{ color: "var(--blue)" }} /> Weekly Auto-Route Planner
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    Partition all <strong>{filteredRetailers.length}</strong> filtered stores into optimized daily runs for the week.
                  </p>
                  
                  {/* Stops Target Slider */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-secondary)" }}>
                      <span>Target Stops per Day:</span>
                      <strong>{targetStopsPerDay} Stops</strong>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="12"
                      step="1"
                      value={targetStopsPerDay}
                      onChange={(e) => setTargetStopsPerDay(parseInt(e.target.value))}
                      style={{ width: "100%", accentColor: "var(--blue)", cursor: "pointer" }}
                    />
                  </div>
                  
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAutoClusterWeek}
                    style={{ width: "100%", justifyContent: "center", fontSize: 11, padding: "8px", marginTop: 4 }}
                  >
                    Auto-Cluster & Solve Week
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={true}
                  style={{ width: "100%", justifyContent: "center", fontSize: 12, opacity: 0.5, cursor: "not-allowed", padding: "8px" }}
                >
                  Select stores in Registry (3) to optimize
                </button>
              )}
            </div>
          ) : (
            <>
              {optimizedRoute ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, backgroundColor: "var(--surface-1)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Total Distance</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)" }}>{optimizedRoute.totalDistanceMiles} mi</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>Est. Travel Time</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--blue)" }}>
                        {Math.floor(optimizedRoute.totalDurationMinutes / 60)}h {optimizedRoute.totalDurationMinutes % 60}m
                      </div>
                    </div>
                  </div>
                  
                  {optimizedRoute.isFallback && (
                    <div style={{ fontSize: 9, color: "var(--gold)", backgroundColor: "rgba(255, 193, 7, 0.08)", padding: "4px 6px", borderRadius: 4, borderLeft: "2.5px solid var(--gold)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <AlertTriangle size={11} /> Using straight-line approximations.
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setOptimizedRoute(null)}
                      style={{ flex: 1, justifyContent: "center", fontSize: 11, padding: "6px 8px" }}
                    >
                      Reset
                    </button>
                    <a
                      href={optimizedRoute.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-primary btn-sm"
                      style={{ flex: 2, justifyContent: "center", fontSize: 11, padding: "6px 8px", backgroundColor: "var(--green)", borderColor: "var(--green)", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    >
                      <Compass size={13} /> Open Navigation Map
                    </a>
                  </div>

                  {/* Save to Week Panel */}
                  <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4, fontWeight: 600 }}>Save to Weekly Schedule:</div>
                    <div style={{ display: "flex", gap: 4 }}>
                      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                        <button
                          key={day}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSaveToSchedule(day)}
                          style={{
                            flex: 1,
                            padding: "4px 2px",
                            fontSize: 10,
                            justifyContent: "center",
                            backgroundColor: weeklySchedule[day] ? "var(--purple-dim)" : "transparent",
                            borderColor: weeklySchedule[day] ? "var(--purple)" : "var(--border)",
                            color: weeklySchedule[day] ? "var(--purple)" : "var(--text-secondary)"
                          }}
                        >
                          {day.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleOptimizeRoute}
                  disabled={optimizing}
                  style={{ width: "100%", justifyContent: "center", fontSize: 12, padding: "8px" }}
                >
                  {optimizing ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><RotateCw size={13} className="animate-spin" /> Running TSP Optimization...</span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Zap size={13} /> Calculate Optimized Visit Sequence ({selectedIds.size} Stops)</span>
                  )}
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Map Container */}
      <div 
        ref={containerRef} 
        className="card" 
        style={{ 
          height: "82vh", 
          position: "sticky", 
          top: 16, 
          borderRadius: 8, 
          overflow: "hidden", 
          zIndex: 0 
        }} 
      >
        {/* Float Map Expansion Control */}
        <div style={{ position: "absolute", top: 10, right: 10, zIndex: 1000 }}>
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            style={{ 
              boxShadow: "0 2px 5px rgba(0,0,0,0.15)", 
              backgroundColor: "var(--surface-1)", 
              fontWeight: 600,
              fontSize: 11,
              padding: "6px 10px"
            }}
            onClick={() => setMapExpanded(!mapExpanded)}
          >
            {mapExpanded ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Split size={12} /> Split View</span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Maximize2 size={12} /> Expand Map</span>
            )}
          </button>
        </div>
      </div>

      {/* Overlay spinner */}
      {(optimizing || geocoding) && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          color: "white",
          fontFamily: "Inter, sans-serif"
        }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{
              width: "48px",
              height: "48px",
              border: "4px solid rgba(255, 255, 255, 0.2)",
              borderTopColor: "var(--blue)",
              borderRadius: "50%",
              margin: "0 auto",
              animation: "spin 1s linear infinite"
            }}></div>
            <div style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              {geocoding ? (
                <>
                  <Search size={20} /> Locating starting address...
                </>
              ) : (
                <>
                  <Zap size={20} /> Computing optimal driving route...
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: "#ccc" }}>
              {geocoding 
                ? "Querying geocoder service..." 
                : "Solving Traveling Salesperson matrix & fetching road maps..."}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

