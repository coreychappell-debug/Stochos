"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Users, MapPin, Map, RefreshCw, AlertTriangle, Zap, Split, Check, HelpCircle, FileText, ClipboardList, Lock } from "lucide-react";
import HelpTooltip from "../../components/HelpTooltip";
import CollapsibleCard from "../../components/CollapsibleCard";

// HSL curated harmonized color palette for rendering distinct territory boundaries
const CLUSTER_COLORS = [
  "#EF476F", // HSL Red
  "#118AB2", // HSL Blue
  "#06D6A0", // HSL Teal
  "#FFD166", // HSL Yellow
  "#8338EC", // HSL Purple
  "#3A86C8", // HSL Slate Blue
  "#FF006E", // HSL Hot Pink
  "#38B000", // HSL Green
  "#F77F00", // HSL Orange
  "#003049"  // HSL Deep Blue
];

// Helper: Haversine distance in miles
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
  const wowTrend = parseFloat(((hash % 60) - 30).toFixed(1)); 
  return { score, tier, wowTrend };
};

export default function TerritoriesClient({ retailers, routes, users, auditLogs = [], currentUser }) {
  const [activeTab, setActiveTab] = useState("balancer"); // "balancer" | "registry" | "sweeps"
  const [selectedCenter, setSelectedCenter] = useState("");
  const [targetRepCount, setTargetRepCount] = useState(5);
  const [repWorkdayStarts, setRepWorkdayStarts] = useState({}); // { [repId]: "home" | "office" }

  // PII Address Management States
  const [localUsers, setLocalUsers] = useState(users);
  const [editingRepId, setEditingRepId] = useState(null);
  const [editAddressVal, setEditAddressVal] = useState("");
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");

  useEffect(() => {
    setLocalUsers(users);
  }, [users]);

  // Proposed Cluster States
  const [proposedClusters, setProposedClusters] = useState([]);
  const [assignedReps, setAssignedReps] = useState({}); // { clusterIndex: repId }
  const [savingTerritories, setSavingTerritories] = useState(false);
  const [calculating, setCalculating] = useState(false);

  // Unassigned Registry States
  const [selectedUnassignedId, setSelectedUnassignedId] = useState(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [selectedAssigneeRoute, setSelectedAssigneeRoute] = useState("");
  const [assigningStore, setAssigningStore] = useState(false);
  const [registryFilter, setRegistryFilter] = useState("unassigned"); // "unassigned" | "assigned" | "all"
  const [registrySearch, setRegistrySearch] = useState("");

  // Mobile responsiveness & interaction controls
  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState("controls"); // "controls" | "map"
  const [mapInteractive, setMapInteractive] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Map references
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layersRef = useRef({
    markers: L.featureGroup(),
    proposed: L.featureGroup()
  });

  // Trigger leaflet map redraw on mobile active view transitions
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.invalidateSize();
    }
  }, [activeMobileView, isMobile, mapInteractive]);

  // Enrich retailers with CRM opportunity and sales performance data
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

  // 1. Dynamic State-Agnostic Setup
  // Scan retailers to get the list of available customer service centers
  const uniqueServiceCenters = useMemo(() => {
    const centers = new Set();
    retailers.forEach(r => {
      if (r.serviceCenter) centers.add(r.serviceCenter);
    });
    return Array.from(centers).sort();
  }, [retailers]);

  // Set default center on mount
  useEffect(() => {
    if (uniqueServiceCenters.length > 0 && !selectedCenter) {
      // Prioritize Schenectady if NY, or just take the first one
      const defaultOffice = uniqueServiceCenters.includes("Schenectady") 
        ? "Schenectady" 
        : uniqueServiceCenters[0];
      setSelectedCenter(defaultOffice);
    }
  }, [uniqueServiceCenters, selectedCenter]);

  // Calculate office centroids on the fly based on retailer averages
  const officeCentroids = useMemo(() => {
    const centroids = {};
    uniqueServiceCenters.forEach(centerName => {
      const centerStores = retailers.filter(r => r.serviceCenter === centerName && r.latitude && r.longitude);
      if (centerStores.length > 0) {
        const sumLat = centerStores.reduce((sum, r) => sum + r.latitude, 0);
        const sumLng = centerStores.reduce((sum, r) => sum + r.longitude, 0);
        centroids[centerName] = {
          lat: sumLat / centerStores.length,
          lng: sumLng / centerStores.length,
          name: `${centerName} Office Centroid`
        };
      } else {
        // Absolute fallback (Schenectady office coordinates)
        centroids[centerName] = { lat: 42.81432, lng: -73.94314, name: centerName };
      }
    });
    return centroids;
  }, [uniqueServiceCenters, retailers]);

  // Map routes to offices based on where their assigned retailers are located
  const routeToOfficeMap = useMemo(() => {
    const mapping = {};
    routes.forEach(route => {
      const routeRetailers = retailers.filter(r => r.routeId === route.id && r.serviceCenter);
      if (routeRetailers.length > 0) {
        const counts = {};
        routeRetailers.forEach(r => {
          counts[r.serviceCenter] = (counts[r.serviceCenter] || 0) + 1;
        });
        const mostCommon = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
        mapping[route.id] = mostCommon;
      } else {
        // Fallback: name matching
        const matchedCenter = uniqueServiceCenters.find(c => route.name.toLowerCase().includes(c.toLowerCase()));
        if (matchedCenter) mapping[route.id] = matchedCenter;
      }
    });
    return mapping;
  }, [routes, retailers, uniqueServiceCenters]);

  // Filter candidates (users/reps and routes) assigned to the selected office
  const officeReps = useMemo(() => {
    if (!selectedCenter) return [];
    return localUsers.filter(u => {
      // Find routes assigned to this user
      const userRoutes = routes.filter(r => r.repId === u.id);
      if (userRoutes.length === 0) {
        // Subunit check fallback
        return u.subunit?.toLowerCase().includes(selectedCenter.toLowerCase());
      }
      return userRoutes.some(r => routeToOfficeMap[r.id] === selectedCenter);
    });
  }, [selectedCenter, localUsers, routes, routeToOfficeMap]);

  const officeRoutes = useMemo(() => {
    if (!selectedCenter) return [];
    return routes.filter(r => routeToOfficeMap[r.id] === selectedCenter);
  }, [selectedCenter, routes, routeToOfficeMap]);

  // Filter retailers for the selected office
  const officeRetailers = useMemo(() => {
    if (!selectedCenter) return [];
    return enrichedRetailers.filter(r => r.serviceCenter === selectedCenter && r.latitude && r.longitude);
  }, [selectedCenter, enrichedRetailers]);

  const unassignedRetailers = useMemo(() => {
    return enrichedRetailers.filter(r => r.routeId === null && r.latitude && r.longitude);
  }, [enrichedRetailers]);

  const filteredRegistryRetailers = useMemo(() => {
    return officeRetailers.filter(r => {
      // 1. Assignment status filter
      if (registryFilter === "unassigned" && r.routeId !== null) return false;
      if (registryFilter === "assigned" && r.routeId === null) return false;
      
      // 2. Search query filter
      if (registrySearch.trim()) {
        const query = registrySearch.toLowerCase();
        const matchesName = r.name.toLowerCase().includes(query);
        const matchesAddress = r.address.toLowerCase().includes(query);
        const matchesCity = r.city.toLowerCase().includes(query);
        const matchesCode = r.externalId.toLowerCase().includes(query);
        const matchesRoute = r.route?.code?.toLowerCase().includes(query) || false;
        return matchesName || matchesAddress || matchesCity || matchesCode || matchesRoute;
      }
      
      return true;
    });
  }, [officeRetailers, registryFilter, registrySearch]);

  // Expose assignment function to window so Leaflet popups can invoke it directly
  useEffect(() => {
    window.handleAssignSingleStoreFromMap = async (storeId, routeId) => {
      try {
        const res = await fetch("/api/fomo/territories/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "single",
            retailerId: storeId,
            routeId: routeId || null
          })
        });

        if (res.ok) {
          alert("Retailer route reassigned successfully!");
          window.location.reload();
        } else {
          alert("Failed to reassign retailer route.");
        }
      } catch (err) {
        console.error("Error from map reassignment:", err);
        alert("Error processing reassignment.");
      }
    };

    return () => {
      delete window.handleAssignSingleStoreFromMap;
    };
  }, []);

  // Reset Rep Count and initialize individual workday start settings on office changes
  useEffect(() => {
    if (officeReps.length > 0) {
      setTargetRepCount(officeReps.length);

      const initialStarts = {};
      officeReps.forEach(rep => {
        initialStarts[rep.id] = (rep.homeLatitude && rep.homeLongitude) ? "home" : "office";
      });
      setRepWorkdayStarts(prev => {
        const next = { ...prev };
        Object.keys(initialStarts).forEach(id => {
          if (!next[id]) next[id] = initialStarts[id];
        });
        return next;
      });
    }
  }, [officeReps]);

  // Clear proposed partition state on tab/office changes
  useEffect(() => {
    setProposedClusters([]);
    setAssignedReps({});
  }, [selectedCenter, activeTab]);

  // 2. Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 5
    }).setView([42.8, -75.5], 7);
    mapRef.current = map;

    const isLight = document.body.classList.contains("light-theme");
    const tileUrl = isLight
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    layersRef.current.markers.addTo(map);
    layersRef.current.proposed.addTo(map);

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

  // Update map bounds when selectedCenter shifts
  useEffect(() => {
    if (!mapRef.current || !selectedCenter) return;
    const centroid = officeCentroids[selectedCenter];
    if (centroid) {
      mapRef.current.setView([centroid.lat, centroid.lng], 9);
    }
  }, [selectedCenter, officeCentroids]);

  // Render current territory markers when tab is not in proposed state
  useEffect(() => {
    if (!mapRef.current) return;

    layersRef.current.markers.clearLayers();
    if (proposedClusters.length > 0) return; // Skip if showing proposed changes

    const bounds = L.latLngBounds();

    // Draw Office Centroid (Office Depot)
    if (selectedCenter && officeCentroids[selectedCenter]) {
      const office = officeCentroids[selectedCenter];
      bounds.extend([office.lat, office.lng]);

      const officeIcon = L.divIcon({
        className: "office-marker-pin",
        html: `<div style="background-color:var(--green); color:white; border-radius:50%; width:30px; height:30px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:2.5px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.4);">🏢</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      L.marker([office.lat, office.lng], { icon: officeIcon })
        .bindPopup(`<strong>${selectedCenter} Service Center Depot</strong>`)
        .addTo(layersRef.current.markers);
    }

    // Draw Representative Home locations for reps starting from Home
    officeReps.forEach(rep => {
      const repStartMode = repWorkdayStarts[rep.id] || "office";
      if (repStartMode === "home" && rep.homeLatitude && rep.homeLongitude) {
        bounds.extend([rep.homeLatitude, rep.homeLongitude]);

        const homeIcon = L.divIcon({
          className: "home-marker-pin",
          html: `<div style="background-color:#E28743; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.35);">🏠</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([rep.homeLatitude, rep.homeLongitude], { icon: homeIcon })
          .bindPopup(`<strong>Rep Home: ${rep.name} (Starts from Home)</strong><br/>Address: ${rep.homeAddress || "Saved Coords"}`)
          .addTo(layersRef.current.markers);
      }
    });

    // Map routes to colors
    const routeColors = {};
    officeRoutes.forEach((route, idx) => {
      routeColors[route.id] = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
    });

    // Draw current active stores
    officeRetailers.forEach(r => {
      if (r.latitude && r.longitude) {
        bounds.extend([r.latitude, r.longitude]);

        const color = r.routeId ? routeColors[r.routeId] : "var(--text-muted)";
        const markerIcon = L.divIcon({
          className: "store-marker-pin",
          html: `<div style="background-color:${color}; border-radius:50%; width:10px; height:10px; border:1px solid white; box-shadow:0 1px 2px rgba(0,0,0,0.3);"></div>`,
          iconSize: [10, 10],
          iconAnchor: [5, 5]
        });

        // Generate route selection options for map popup
        const optionsHtml = officeRoutes.map(route => {
          const repName = users.find(u => u.id === route.repId)?.name || 'Unassigned';
          return `<option value="${route.id}" ${route.id === r.routeId ? 'selected' : ''}>${route.code} - ${repName}</option>`;
        }).join('');

        const popupContent = `
          <div style="font-family: inherit; font-size: 12px; min-width: 200px;">
            <strong style="font-size: 13px; color: var(--primary);">${r.name}</strong><br/>
            <span>${r.address}, ${r.city}</span><br/>
            <span style="font-size: 11px; color: var(--text-secondary); display: block; margin-top: 4px;">
              Route: <strong>${r.route?.code || "Unassigned"}</strong> &bull; Rep: <strong>${r.route?.repId ? (users.find(u => u.id === r.route.repId)?.name || "—") : "Unassigned"}</strong>
            </span>
            <div style="margin-top: 8px; border-top: 1px solid var(--border); padding-top: 6px; display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <select id="map-select-${r.id}" style="font-size: 11px; padding: 2px; border-radius: 4px; border: 1px solid #ddd; background-color: var(--surface-1); color: var(--text); flex: 1; height: 22px; max-width: 140px;">
                <option value="">-- Unassign Store --</option>
                ${optionsHtml}
              </select>
              <button onclick="if(window.handleAssignSingleStoreFromMap) { window.handleAssignSingleStoreFromMap('${r.id}', document.getElementById('map-select-${r.id}').value) } else { alert('Interface loading...') }" 
                      style="font-size: 10px; padding: 2px 8px; background-color: #3A86C8; color: white; border: none; border-radius: 4px; cursor: pointer; height: 22px; font-weight: bold;">
                Move
              </button>
            </div>
          </div>
        `;

        L.marker([r.latitude, r.longitude], { icon: markerIcon })
          .bindPopup(popupContent)
          .addTo(layersRef.current.markers);
      }
    });

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [selectedCenter, officeRetailers, officeRoutes, proposedClusters, officeCentroids, repWorkdayStarts, officeReps]);

  // Render proposed clusters on the map
  useEffect(() => {
    if (!mapRef.current) return;
    layersRef.current.proposed.clearLayers();

    if (proposedClusters.length === 0) return;

    const bounds = L.latLngBounds();

    // Draw Representative Home locations for reps starting from Home
    officeReps.forEach(rep => {
      const repStartMode = repWorkdayStarts[rep.id] || "office";
      if (repStartMode === "home" && rep.homeLatitude && rep.homeLongitude) {
        bounds.extend([rep.homeLatitude, rep.homeLongitude]);

        const homeIcon = L.divIcon({
          className: "home-marker-pin",
          html: `<div style="background-color:#E28743; color:white; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:2px solid white; box-shadow:0 2px 4px rgba(0,0,0,0.35);">🏠</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        L.marker([rep.homeLatitude, rep.homeLongitude], { icon: homeIcon })
          .bindPopup(`<strong>Rep Home: ${rep.name} (Starts from Home)</strong><br/>Address: ${rep.homeAddress || "Saved Coords"}`)
          .addTo(layersRef.current.proposed);
      }
    });

    proposedClusters.forEach((cluster, idx) => {
      const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];

      // Draw cluster centroid marker
      bounds.extend([cluster.centroid.lat, cluster.centroid.lng]);
      const centroidIcon = L.divIcon({
        className: "centroid-marker-pin",
        html: `<div style="background-color:${color}; color:white; border-radius:50%; width:26px; height:26px; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold; border:2px solid white; box-shadow:0 2px 5px rgba(0,0,0,0.4);">${idx + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      L.marker([cluster.centroid.lat, cluster.centroid.lng], { icon: centroidIcon })
        .bindPopup(`<strong>Proposed Route #${idx + 1} Centroid</strong><br/>Stores: ${cluster.stores.length}<br/>Opportunity: ${cluster.totalOpportunity} pts`)
        .addTo(layersRef.current.proposed);

      // Draw circle overlay based on radius
      if (cluster.radiusMiles > 0) {
        L.circle([cluster.centroid.lat, cluster.centroid.lng], {
          color: color,
          fillColor: color,
          fillOpacity: 0.08,
          radius: cluster.radiusMiles * 1609.34, // Convert miles to meters
          weight: 1,
          dashArray: "4, 4"
        }).addTo(layersRef.current.proposed);
      }

      // Draw store markers color-coded by proposed cluster
      cluster.stores.forEach(r => {
        bounds.extend([r.latitude, r.longitude]);

        const markerIcon = L.divIcon({
          className: "store-marker-pin",
          html: `<div style="background-color:${color}; border-radius:50%; width:11px; height:11px; border:1px.5 solid white; box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
          iconSize: [11, 11],
          iconAnchor: [6, 6]
        });

        L.marker([r.latitude, r.longitude], { icon: markerIcon })
          .bindPopup(`
            <strong>${r.name}</strong><br/>
            <span>${r.address}, ${r.city}</span><br/>
            <span style="font-size:11px; color:var(--text-secondary);">
              Proposed Territory: <strong>Route #${idx + 1}</strong><br/>
              Sales Potential: <strong>${r.salesTier} (${r.opportunityScore} pts)</strong>
            </span>
          `)
          .addTo(layersRef.current.proposed);
      });
    });

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [proposedClusters, repWorkdayStarts, officeReps]);

  // Focus and highlight specific unassigned retailer
  const handleHighlightRetailer = (store) => {
    if (!mapRef.current || !store.latitude || !store.longitude) return;
    
    // Zoom to retailer and flash a red highlight ring
    mapRef.current.setView([store.latitude, store.longitude], 14);

    const tempRing = L.circle([store.latitude, store.longitude], {
      color: "var(--red)",
      fillColor: "transparent",
      weight: 3.5,
      radius: 400
    }).addTo(mapRef.current);

    setTimeout(() => {
      if (mapRef.current) mapRef.current.removeLayer(tempRing);
    }, 2000);
  };

  // Address PII Management
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

      // If we cleared the address, make sure the workday start preference falls back to office
      if (!data.user.homeAddress) {
        setRepWorkdayStarts(prev => ({
          ...prev,
          [repId]: "office"
        }));
      }

      setEditingRepId(null);
    } catch (err) {
      setAddressError(err.message);
    } finally {
      setUpdatingAddress(false);
    }
  };

  // 3. Partition Algorithms Implementation
  const handleProposeTerritories = () => {
    if (officeRetailers.length === 0) {
      alert("No active stores in this office to analyze.");
      return;
    }
    setCalculating(true);

    setTimeout(() => {
      try {
        const K = Math.max(1, Math.min(targetRepCount, CLUSTER_COLORS.length));
        const centroid = officeCentroids[selectedCenter];

        let clusters = [];

        // Map officeRetailers to consistent points format
        const points = officeRetailers.map(r => ({
          id: r.id,
          lat: r.latitude,
          lng: r.longitude,
          sales: r.opportunityScore || 0
        }));

        // 1. Initial K-Means assignments
        let centroids = [];
        const step = Math.floor(points.length / K);
        for (let i = 0; i < K; i++) {
          const pt = points[Math.min(i * step, points.length - 1)];
          centroids.push({ lat: pt.lat, lng: pt.lng });
        }

        let storeAssignments = Array(points.length).fill(0);
        let converged = false;
        let iterations = 0;

        while (!converged && iterations < 15) {
          iterations++;
          converged = true;

          for (let i = 0; i < points.length; i++) {
            let closestIdx = 0;
            let minDist = haversineDistance(points[i], centroids[0]);

            for (let j = 1; j < K; j++) {
              const dist = haversineDistance(points[i], centroids[j]);
              if (dist < minDist) {
                minDist = dist;
                closestIdx = j;
              }
            }

            if (storeAssignments[i] !== closestIdx) {
              storeAssignments[i] = closestIdx;
              converged = false;
            }
          }

          // Re-calculate centroids
          for (let j = 0; j < K; j++) {
            const clusterPoints = points.filter((_, idx) => storeAssignments[idx] === j);
            if (clusterPoints.length > 0) {
              const avgLat = clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length;
              const avgLng = clusterPoints.reduce((sum, p) => sum + p.lng, 0) / clusterPoints.length;
              centroids[j] = { lat: avgLat, lng: avgLng };
            }
          }
        }

        // 2. Greedy optimization balancing loop to minimize equal-blend hybrid cost
        let currentAssignments = [...storeAssignments];

        const getStats = (assignments) => {
          const stats = Array.from({ length: K }, () => ({ count: 0, sales: 0, latSum: 0, lngSum: 0 }));
          for (let i = 0; i < points.length; i++) {
            const t = assignments[i];
            stats[t].count++;
            stats[t].sales += points[i].sales;
            stats[t].latSum += points[i].lat;
            stats[t].lngSum += points[i].lng;
          }
          return stats;
        };

        const getMetrics = (assignments) => {
          const stats = getStats(assignments);
          
          let totalDist = 0;
          for (let i = 0; i < points.length; i++) {
            const t = assignments[i];
            const centroid = {
              lat: stats[t].latSum / (stats[t].count || 1),
              lng: stats[t].lngSum / (stats[t].count || 1)
            };
            totalDist += haversineDistance(points[i], centroid);
          }
          
          const counts = stats.map(s => s.count);
          const avgCount = points.length / K;
          const countVariance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / K;
          
          const salesValues = stats.map(s => s.sales);
          const avgSales = salesValues.reduce((sum, s) => sum + s, 0) / K;
          const salesVariance = salesValues.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / K;
          
          return { totalDist, countVariance, salesVariance };
        };

        // Baselines for dynamic normalization
        const baselines = getMetrics(currentAssignments);
        const normDist = baselines.totalDist > 0 ? baselines.totalDist : 1.0;
        const normCountVar = baselines.countVariance > 0 ? baselines.countVariance : 1.0;
        const normSalesVar = baselines.salesVariance > 0 ? baselines.salesVariance : 1.0;

        // Weights: Equal-Blend Hybrid (Travel Distance, Workload Count, Sales Potential)
        const wDistance = 0.33;
        const wWorkload = 0.33;
        const wRevenue = 0.34;

        const evaluateCost = (assignments) => {
          const m = getMetrics(assignments);
          return (wDistance * (m.totalDist / normDist)) +
                 (wWorkload * (m.countVariance / normCountVar)) +
                 (wRevenue * (m.salesVariance / normSalesVar));
        };

        let currentCost = evaluateCost(currentAssignments);
        let improved = true;
        let optIter = 0;

        while (improved && optIter < 15) {
          improved = false;
          optIter++;

          for (let i = 0; i < points.length; i++) {
            const originalTerritory = currentAssignments[i];
            
            for (let targetTerritory = 0; targetTerritory < K; targetTerritory++) {
              if (originalTerritory === targetTerritory) continue;
              
              currentAssignments[i] = targetTerritory;
              const newCost = evaluateCost(currentAssignments);
              
              if (newCost < currentCost) {
                currentCost = newCost;
                improved = true;
                break; // accept change
              } else {
                currentAssignments[i] = originalTerritory;
              }
            }
          }
        }

        // Re-calculate final centroids and fill cluster objects
        const finalCentroids = Array.from({ length: K }, () => ({ latSum: 0, lngSum: 0, count: 0 }));
        for (let i = 0; i < points.length; i++) {
          const t = currentAssignments[i];
          finalCentroids[t].latSum += points[i].lat;
          finalCentroids[t].lngSum += points[i].lng;
          finalCentroids[t].count++;
        }

        for (let j = 0; j < K; j++) {
          const clusterStores = officeRetailers.filter((_, idx) => currentAssignments[idx] === j);
          if (clusterStores.length === 0) continue;

          const centroidObj = finalCentroids[j].count > 0 
            ? { lat: finalCentroids[j].latSum / finalCentroids[j].count, lng: finalCentroids[j].lngSum / finalCentroids[j].count }
            : centroids[j];

          let maxRadius = 0;
          let totalDistance = 0;
          clusterStores.forEach(r => {
            const dist = haversineDistance(centroidObj, { lat: r.latitude, lng: r.longitude });
            if (dist > maxRadius) maxRadius = dist;
            totalDistance += dist;
          });

          const totalOpp = clusterStores.reduce((sum, r) => sum + (r.opportunityScore || 0), 0);

          clusters.push({
            centroid: centroidObj,
            stores: clusterStores,
            totalOpportunity: totalOpp,
            averageOpportunity: Math.round(totalOpp / clusterStores.length),
            radiusMiles: parseFloat(maxRadius.toFixed(1)),
            totalDistance: totalDistance
          });
        }

        // Auto-map proposed clusters to current reps to prevent random swaps
        const autoAssignments = {};
        const unassignedReps = [...officeReps];

        clusters.forEach((cluster, cIdx) => {
          if (unassignedReps.length === 0) return;

          // Find the rep whose current assigned stores centroid is closest to this proposed cluster centroid
          let bestRepIdx = 0;
          let minDist = Infinity;

          for (let rIdx = 0; rIdx < unassignedReps.length; rIdx++) {
            const rep = unassignedReps[rIdx];
            const repStores = officeRetailers.filter(s => s.route?.repId === rep.id);

            let repCentroid = centroid; // fallback
            const repStartMode = repWorkdayStarts[rep.id] || "office";
            if (repStartMode === "home" && rep.homeLatitude && rep.homeLongitude) {
              repCentroid = { lat: rep.homeLatitude, lng: rep.homeLongitude };
            } else if (repStores.length > 0) {
              repCentroid = {
                lat: repStores.reduce((sum, s) => sum + s.latitude, 0) / repStores.length,
                lng: repStores.reduce((sum, s) => sum + s.longitude, 0) / repStores.length
              };
            } else if (rep.homeLatitude && rep.homeLongitude) {
              repCentroid = { lat: rep.homeLatitude, lng: rep.homeLongitude };
            }

            const dist = haversineDistance(cluster.centroid, repCentroid);
            if (dist < minDist) {
              minDist = dist;
              bestRepIdx = rIdx;
            }
          }

          const assignedRep = unassignedReps.splice(bestRepIdx, 1)[0];
          autoAssignments[cIdx] = assignedRep.id;
        });

        setProposedClusters(clusters);
        setAssignedReps(autoAssignments);
      } catch (err) {
        console.error("Propose error:", err);
      } finally {
        setCalculating(false);
      }
    }, 50);
  };

  // Automatically adjust/re-propose splits when reps' workday starts configuration changes
  useEffect(() => {
    if (proposedClusters.length > 0) {
      handleProposeTerritories();
    }
  }, [repWorkdayStarts]);

  // Exclude assigned representatives from other dropdown choices
  const getAvailableRepsForCluster = (clusterIdx) => {
    const selectedRepIds = Object.keys(assignedReps)
      .filter(idx => parseInt(idx) !== clusterIdx)
      .map(idx => assignedReps[idx]);

    return officeReps.filter(rep => !selectedRepIds.includes(rep.id));
  };

  // Save the rebalanced territories to the database
  const handleCommitTerritories = async () => {
    // Validate that all proposed clusters are assigned to a unique representative
    const assignedIndices = Object.keys(assignedReps);
    if (assignedIndices.length !== proposedClusters.length) {
      alert("Please assign all proposed territories to a representative first.");
      return;
    }

    setSavingTerritories(true);
    try {
      // Build mapping of retailerId -> routeId
      const finalAssignments = {};

      proposedClusters.forEach((cluster, cIdx) => {
        const repId = assignedReps[cIdx];
        // Find the route assigned to this representative in this office
        const repRoute = officeRoutes.find(r => r.repId === repId);
        
        if (repRoute) {
          cluster.stores.forEach(store => {
            finalAssignments[store.id] = repRoute.id;
          });
        }
      });

      const res = await fetch("/api/fomo/territories/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk",
          assignments: finalAssignments
        })
      });

      if (res.ok) {
        alert("Territories successfully rebalanced and saved!");
        setProposedClusters([]);
        setAssignedReps({});
        window.location.reload();
      } else {
        alert("Failed to save rebalanced territories.");
      }
    } catch (e) {
      console.error(e);
      alert("Error committing assignments.");
    } finally {
      setSavingTerritories(false);
    }
  };

  // 4. Unassigned Store Placement OSRM Deviation Recommendations
  const handleFetchRecommendations = async (storeId) => {
    setSelectedUnassignedId(storeId);
    setRecsLoading(true);
    setRecommendations([]);
    setSelectedAssigneeRoute("");

    try {
      const res = await fetch("/api/fomo/territories/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retailerId: storeId })
      });

      if (res.ok) {
        const data = await res.json();
        setRecommendations(data.recommendations);
        if (data.recommendations.length > 0) {
          // Default to the first (recommended) rep's route
          setSelectedAssigneeRoute(data.recommendations[0].routeId);
        }
      } else {
        alert("Failed to calculate routing recommendations.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error: recommendations could not be calculated.");
    } finally {
      setRecsLoading(false);
    }
  };

  const handleAssignSingleStore = async (storeId) => {
    setAssigningStore(true);
    try {
      const res = await fetch("/api/fomo/territories/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "single",
          retailerId: storeId,
          routeId: selectedAssigneeRoute || null
        })
      });

      if (res.ok) {
        alert("Retailer successfully assigned to route!");
        setSelectedUnassignedId(null);
        setRecommendations([]);
        window.location.reload();
      } else {
        alert("Failed to assign retailer.");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing assignment.");
    } finally {
      setAssigningStore(false);
    }
  };

  // Compute stats for current workload imbalance
  const workloadStats = useMemo(() => {
    if (officeReps.length === 0) return { mean: 0, stdDev: 0, cv: 0, list: [] };

    // Get count of retailers for each rep route
    const counts = officeReps.map(rep => {
      const count = officeRetailers.filter(r => r.route?.repId === rep.id).length;
      return { name: rep.name, count };
    });

    const totalStores = counts.reduce((sum, c) => sum + c.count, 0);
    const mean = totalStores / officeReps.length;

    // Variance
    const variance = counts.reduce((sum, c) => sum + Math.pow(c.count - mean, 2), 0) / officeReps.length;
    const stdDev = Math.sqrt(variance);
    // Coefficient of variation (%)
    const cv = mean > 0 ? parseFloat(((stdDev / mean) * 100).toFixed(1)) : 0;

    return {
      mean: parseFloat(mean.toFixed(1)),
      stdDev: parseFloat(stdDev.toFixed(1)),
      cv,
      list: counts
    };
  }, [officeReps, officeRetailers]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
      {isMobile && (
        <div style={{ display: "flex", width: "100%", borderBottom: "1px solid var(--border)", marginBottom: "8px", borderRadius: "var(--radius-sm)", overflow: "hidden", backgroundColor: "var(--surface-2)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setActiveMobileView("controls")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              backgroundColor: activeMobileView === "controls" ? "var(--primary)" : "transparent",
              color: activeMobileView === "controls" ? "#ffffff" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            ⚖️ Balancer & Registry
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileView("map")}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              backgroundColor: activeMobileView === "map" ? "var(--primary)" : "transparent",
              color: activeMobileView === "map" ? "#ffffff" : "var(--text-secondary)",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer"
            }}
          >
            🗺️ Interactive Map
          </button>
        </div>
      )}

      <div style={{ 
        display: isMobile ? "flex" : "grid", 
        flexDirection: isMobile ? "column" : undefined,
        gridTemplateColumns: isMobile ? undefined : "1.3fr 1.2fr", 
        gap: isMobile ? 12 : 20, 
        flex: 1, 
        minHeight: isMobile ? "auto" : "680px"
      }}>
        
        {/* LEFT COLUMN: Controls & Panels */}
        {(!isMobile || activeMobileView === "controls") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, height: isMobile ? "auto" : "82vh", overflow: isMobile ? "visible" : "hidden" }}>
        
        {/* State-Agnostic Office Settings Panel */}
        <div className="card" style={{ padding: 12, flexShrink: 0, backgroundColor: "var(--surface-2)" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 150 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Active District/Service Office:
              </label>
              <select
                className="form-select"
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                style={{ width: "100%", fontSize: 13, fontWeight: "bold" }}
              >
                {uniqueServiceCenters.map(center => (
                  <option key={center} value={center}>{center} ({retailers.filter(r => r.serviceCenter === center).length} stores)</option>
                ))}
              </select>
            </div>
            
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button 
                onClick={() => setActiveTab("balancer")} 
                className={`btn btn-sm ${activeTab === "balancer" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <Split size={14} /> Territory Balancer
              </button>
              <button 
                onClick={() => setActiveTab("registry")} 
                className={`btn btn-sm ${activeTab === "registry" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <MapPin size={14} /> Unassigned Registry
                {unassignedRetailers.length > 0 && (
                  <span className="badge badge-rejected" style={{ marginLeft: 4, padding: "1px 4px", fontSize: 9 }}>{unassignedRetailers.length}</span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab("sweeps")} 
                className={`btn btn-sm ${activeTab === "sweeps" ? "btn-primary" : "btn-secondary"}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <ClipboardList size={14} /> Churn & Sweeps
              </button>
            </div>
          </div>
        </div>

        {/* TAB 1: TERRITORY BALANCER */}
        {activeTab === "balancer" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
            <div className="card" style={{ padding: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>Route Sweep & Spatial Partitioning</h4>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-secondary)" }}>
                  <HelpCircle size={13} /> Respects road connectivity
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Reps Count:</label>
                  <input
                    type="number"
                    className="search-input"
                    min="1"
                    max="10"
                    value={targetRepCount}
                    onChange={(e) => setTargetRepCount(parseInt(e.target.value) || 1)}
                    style={{ fontSize: 12, height: 32 }}
                  />
                </div>

                <button
                  onClick={handleProposeTerritories}
                  disabled={calculating}
                  className="btn btn-primary"
                  style={{ alignSelf: "flex-end", height: 32, justifyContent: "center", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <RefreshCw size={13} className={calculating ? "animate-spin" : ""} /> {calculating ? "Calculating..." : "Propose Split"}
                </button>

              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", margin: 0 }}>
                    Workday Optimization Origins:
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, justifyContent: "center", padding: "6px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => {
                      const updated = {};
                      officeReps.forEach(rep => {
                        if (rep.homeLatitude && rep.homeLongitude) {
                          updated[rep.id] = "home";
                        } else {
                          updated[rep.id] = "office";
                        }
                      });
                      setRepWorkdayStarts(updated);
                    }}
                  >
                    🏠 Bulk Set All Home
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    style={{ flex: 1, justifyContent: "center", padding: "6px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => {
                      const updated = {};
                      officeReps.forEach(rep => {
                        updated[rep.id] = "office";
                      });
                      setRepWorkdayStarts(updated);
                    }}
                  >
                    🏢 Bulk Set All Office
                  </button>
                </div>
              </div>
            </div>

            {/* Representative Workday Preferences List Card */}
            <div className="card" style={{ padding: 14, flexShrink: 0, marginTop: 10 }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                👤 Representative Start Origins
              </h4>
              <p style={{ margin: "0 0 10px 0", fontSize: 11, color: "var(--text-secondary)" }}>
                Choose whether each field representative starts from home or the office depot.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                {officeReps.map(rep => {
                  const mode = repWorkdayStarts[rep.id] || "office";
                  const hasHome = !!(rep.homeLatitude && rep.homeLongitude);
                  const isEditing = editingRepId === rep.id;

                  if (isEditing) {
                    return (
                      <div key={rep.id} style={{ display: "flex", flexDirection: "column", padding: "8px", backgroundColor: "var(--surface-3)", borderRadius: 4, gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rep.name} (Address)</span>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: "1px 4px", fontSize: 9, height: 16 }}
                            onClick={() => {
                              setEditingRepId(null);
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
                            onClick={() => handleSaveAddress(rep.id, editAddressVal)}
                            disabled={updatingAddress}
                          >
                            {updatingAddress ? "..." : "Save"}
                          </button>
                          {rep.homeAddress && (
                            <button
                              type="button"
                              className="btn btn-danger"
                              style={{ padding: "2px 8px", fontSize: 10, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--red)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                              onClick={() => handleSaveAddress(rep.id, "")}
                              disabled={updatingAddress}
                              title="Delete/remove address (PII Compliance)"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        {addressError && (
                          <span style={{ fontSize: 9, color: "var(--red)", marginTop: 2 }}>
                            {addressError}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div key={rep.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", backgroundColor: "var(--surface-3)", borderRadius: 4, gap: 10 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: "bold", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{rep.name}</span>
                          <button
                            type="button"
                            style={{ padding: "0 4px", fontSize: 9, height: 16, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", borderRadius: 3, cursor: "pointer" }}
                            onClick={() => {
                              setEditingRepId(rep.id);
                              setEditAddressVal(rep.homeAddress || "");
                              setAddressError("");
                            }}
                            title="Edit or Remove Address (PII control)"
                          >
                            ✏️ Edit
                          </button>
                        </div>
                        <span style={{ fontSize: 9.5, color: hasHome ? "var(--green)" : "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={rep.homeAddress || ""}>
                          {hasHome ? `🏠 ${rep.homeAddress}` : "⚠️ No home address registered"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          type="button"
                          className={`btn ${mode === "home" ? "btn-primary" : "btn-secondary"}`}
                          disabled={!hasHome}
                          style={{ padding: "2px 6px", fontSize: 9.5, height: 22, fontWeight: mode === "home" ? "bold" : "normal" }}
                          onClick={() => setRepWorkdayStarts(prev => ({ ...prev, [rep.id]: "home" }))}
                          title={!hasHome ? "Configure home address in rep profile first" : "Start from home coordinates"}
                        >
                          Home
                        </button>
                        <button
                          type="button"
                          className={`btn ${mode === "office" ? "btn-primary" : "btn-secondary"}`}
                          style={{ padding: "2px 6px", fontSize: 9.5, height: 22, fontWeight: mode === "office" ? "bold" : "normal" }}
                          onClick={() => setRepWorkdayStarts(prev => ({ ...prev, [rep.id]: "office" }))}
                          title="Start from central claims center / office depot"
                        >
                          Office
                        </button>
                      </div>
                    </div>
                  );
                })}
                {officeReps.length === 0 && (
                  <div style={{ textAlign: "center", padding: 10, color: "var(--text-muted)", fontSize: 11.5 }}>
                    No representatives assigned to this service office.
                  </div>
                )}
              </div>
            </div>

            {/* Proposed Split Results */}
            <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexShrink: 0 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>Proposed Territories ({proposedClusters.length})</h4>
                {proposedClusters.length > 0 && (
                  <button
                    onClick={handleCommitTerritories}
                    disabled={savingTerritories}
                    className="btn btn-primary btn-sm"
                    style={{ backgroundColor: "var(--green)", borderColor: "var(--green)", color: "white", display: "inline-flex", alignItems: "center", gap: 4 }}
                  >
                    <Check size={13} /> {savingTerritories ? "Saving..." : "Commit & Apply"}
                  </button>
                )}
              </div>

              {proposedClusters.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  Click "Propose Split" to calculate optimized territory boundaries.
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                  {proposedClusters.map((cluster, idx) => {
                    const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
                    const selectedRepId = assignedReps[idx] || "";
                    const availableReps = getAvailableRepsForCluster(idx);

                    return (
                      <div key={idx} style={{ 
                        padding: 10, 
                        backgroundColor: "var(--surface-3)", 
                        borderRadius: 6, 
                        borderLeft: `4px solid ${color}`,
                        display: "grid",
                        gridTemplateColumns: "1.2fr 1.3fr",
                        gap: 12,
                        alignItems: "center"
                      }}>
                        <div>
                          <strong style={{ fontSize: 12.5, display: "block" }}>Territory #{idx + 1}</strong>
                          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                            <span><strong>{cluster.stores.length}</strong> stores</span>
                            <span>&bull;</span>
                            {cluster.totalDistance !== undefined && (
                              <>
                                <span>Est. Travel: <strong>{Math.round(cluster.totalDistance)} mi</strong></span>
                                <span>&bull;</span>
                              </>
                            )}
                            <span>Avg Sales: <strong>{cluster.averageOpportunity} pts</strong></span>
                            <span>&bull;</span>
                            <span>Radius: <strong>{cluster.radiusMiles} mi</strong></span>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <label style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)" }}>Assign Representative:</label>
                          <select
                            className="form-select"
                            value={selectedRepId}
                            onChange={(e) => setAssignedReps(prev => ({ ...prev, [idx]: e.target.value }))}
                            style={{ fontSize: 11.5, height: 28, padding: "2px 6px" }}
                          >
                            <option value="">-- Select Unassigned Rep --</option>
                            {/* Show currently selected rep if assigned */}
                            {selectedRepId && (
                              <option value={selectedRepId}>
                                {officeReps.find(r => r.id === selectedRepId)?.name}
                              </option>
                            )}
                            {availableReps.map(rep => (
                              <option key={rep.id} value={rep.id}>{rep.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RETAILER PLACEMENT REGISTRY */}
        {activeTab === "registry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
            <CollapsibleCard
              title="Retailer Placement & Route Registry"
              icon={MapPin}
              initialCollapsed={false}
              storageKey="territories-retailer-registry"
              style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
              bodyStyle={{ padding: 14, display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
            >
              {/* Search & Filter Controls */}
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <input
                  type="text"
                  placeholder="Search store by name, ID, city, or route..."
                  className="search-input"
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  style={{ flex: 1, fontSize: 12, height: 30, padding: "4px 8px" }}
                />
                <select
                  className="form-select"
                  value={registryFilter}
                  onChange={(e) => setRegistryFilter(e.target.value)}
                  style={{ width: 120, fontSize: 11.5, height: 30, padding: "2px 6px" }}
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                  <option value="all">All Stores</option>
                </select>
              </div>

              {filteredRegistryRetailers.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  No matching retailers found. Try adjusting your search query or filter settings.
                </div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 2 }}>
                  {filteredRegistryRetailers.map(store => (
                    <div key={store.id} style={{ 
                      padding: 12, 
                      backgroundColor: "var(--surface-3)", 
                      borderRadius: 6, 
                      border: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ minWidth: 0, cursor: "pointer", flex: 1 }} onClick={() => handleHighlightRetailer(store)}>
                          <strong style={{ fontSize: 12.5, color: "var(--primary)", display: "block", textDecoration: "underline", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {store.name}
                          </strong>
                          <span style={{ fontSize: 10, color: "var(--text-secondary)", display: "block", marginTop: 2 }}>
                            {store.address}, {store.city} &bull; ID: {store.externalId}
                          </span>
                          {store.routeId && (
                            <span className="badge badge-submitted" style={{ marginTop: 4, display: "inline-block", fontSize: 9, padding: "1px 6px", fontWeight: "bold" }}>
                              Current Route: {store.route?.code || "Assigned"}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleFetchRecommendations(store.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, height: 26, flexShrink: 0 }}
                        >
                          <Zap size={12} style={{ color: "var(--gold)" }} /> Recommend Rep
                        </button>
                      </div>

                      {/* Recommendation Details for selected retailer */}
                      {selectedUnassignedId === store.id && (
                        <div style={{ 
                          marginTop: 4, 
                          padding: 10, 
                          backgroundColor: "var(--surface-1)", 
                          borderRadius: 6, 
                          border: "1px solid var(--border)",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10
                        }}>
                          {recsLoading ? (
                            <div style={{ textAlign: "center", padding: "10px 0", fontSize: 12, color: "var(--text-muted)" }}>
                              <div style={{ width: 16, height: 16, border: "1.5px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 6px auto", animation: "spin 1s linear infinite" }}></div>
                              Querying OSRM road travel matrices...
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              {recommendations.length > 0 && (
                                <>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    Ranked Road Deviation Recommendations:
                                    <HelpTooltip text="OSRM driving deviation minutes showing the additional drive time required to append a new stop to a representative's active path." />
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    {recommendations.slice(0, 3).map((rec, idx) => (
                                      <div key={rec.repId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "4px 6px", backgroundColor: idx === 0 ? "var(--blue-dim)" : "var(--surface-2)", borderRadius: 4 }}>
                                        <span>
                                          <strong>{idx + 1}. {rec.repName}</strong> ({rec.routeCode}) &bull; Workload: {rec.currentStoreCount} stores
                                        </span>
                                        <span style={{ fontWeight: 800, color: idx === 0 ? "var(--blue)" : "var(--text)" }}>
                                          +{rec.deviationMinutes} mins drive
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}

                              <div style={{ display: "flex", gap: 6, alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
                                <select
                                  className="form-select"
                                  value={selectedAssigneeRoute}
                                  onChange={(e) => setSelectedAssigneeRoute(e.target.value)}
                                  style={{ fontSize: 11.5, flex: 1, height: 28 }}
                                >
                                  <option value="">-- Unassign Store --</option>
                                  {officeRoutes.map(route => (
                                    <option key={route.id} value={route.id}>
                                      {route.code} - {route.rep?.name || "Unassigned"}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleAssignSingleStore(store.id)}
                                  disabled={assigningStore}
                                  className="btn btn-primary btn-sm"
                                  style={{ padding: "4px 10px", fontSize: 11, height: 28, backgroundColor: "var(--green)", borderColor: "var(--green)" }}
                                >
                                  {assigningStore ? "Assigning..." : "Assign"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleCard>
          </div>
        )}

        {/* TAB 3: CHURN & SWEEPS */}
        {activeTab === "sweeps" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0, overflowY: "auto" }}>
            
            {/* Workload Stats Card */}
            <div className="card" style={{ padding: 14, flexShrink: 0 }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: 14, fontWeight: 700 }}>Workload Balance Metrics</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div style={{ padding: "8px 10px", backgroundColor: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--border)", textAlign: "center" }}>
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)", display: "block", textTransform: "uppercase" }}>Avg workload</span>
                  <strong style={{ fontSize: 16, color: "var(--blue)" }}>{workloadStats.mean} stores</strong>
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--border)", textAlign: "center" }}>
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)", display: "block", textTransform: "uppercase" }}>Workload Std Dev</span>
                  <strong style={{ fontSize: 16 }}>{workloadStats.stdDev}</strong>
                </div>
                <div style={{ 
                  padding: "8px 10px", 
                  backgroundColor: workloadStats.cv > 25 ? "rgba(239, 71, 111, 0.08)" : "rgba(6, 214, 160, 0.08)", 
                  borderRadius: 6, 
                  border: `1px solid ${workloadStats.cv > 25 ? "var(--status-rejected-border)" : "var(--status-active-border)"}`,
                  textAlign: "center" 
                }}>
                  <span style={{ fontSize: 9.5, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "4px", textTransform: "uppercase", justifyContent: "center", width: "100%" }}>
                    Imbalance index
                    <HelpTooltip text="Coefficient of Variation (CV) representing the workload disparity among sales representatives in the active territory." />
                  </span>
                  <strong style={{ fontSize: 16, color: workloadStats.cv > 25 ? "var(--red)" : "var(--green)" }}>{workloadStats.cv}%</strong>
                </div>
              </div>

              {workloadStats.cv > 25 ? (
                <div style={{ display: "flex", gap: 8, padding: 10, backgroundColor: "rgba(255, 193, 7, 0.08)", borderLeft: "3.5px solid var(--gold)", borderRadius: "0 6px 6px 0", fontSize: 11.5, lineHeight: 1.4 }}>
                  <AlertTriangle size={16} style={{ color: "var(--gold)", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>High Workload Imbalance Detected:</strong> The distribution of accounts across Schenectady representatives has a high variation index ({workloadStats.cv}%). We recommend running a <strong>Radial Sweep re-optimization</strong> to balance staff fatigue.
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, padding: 10, backgroundColor: "rgba(40, 167, 69, 0.08)", borderLeft: "3.5px solid var(--green)", borderRadius: "0 6px 6px 0", fontSize: 11.5, lineHeight: 1.4, color: "var(--green)" }}>
                  <Check size={16} style={{ color: "var(--green)", flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Workload Balanced:</strong> Schenectady routes are currently partitioned equitably.
                  </div>
                </div>
              )}
            </div>

            {/* Audit Log Card */}
            <CollapsibleCard
              title="Territory Adjustment Audit Log"
              icon={FileText}
              initialCollapsed={true}
              storageKey="territories-adjustment-audit"
              style={{ flex: 1, display: "flex", flexDirection: "column" }}
              bodyStyle={{ padding: 14, display: "flex", flexDirection: "column", flex: 1 }}
            >
              <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 6 }}>
                {auditLogs.length === 0 ? (
                  <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                    No territory adjustments recorded in the audit log.
                  </div>
                ) : (
                  <table className="data-table" style={{ fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ position: "sticky", top: 0, backgroundColor: "var(--surface-2)", zIndex: 1 }}>
                        <th style={{ padding: "6px 8px" }}>Timestamp</th>
                        <th style={{ padding: "6px 8px" }}>User</th>
                        <th style={{ padding: "6px 8px" }}>Action</th>
                        <th style={{ padding: "6px 8px" }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.map((log) => {
                        const changes = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
                        return (
                          <tr key={log.id}>
                            <td style={{ padding: 6, whiteSpace: "nowrap" }} className="muted">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                            <td style={{ padding: 6 }}>{log.user?.name || "System"}</td>
                            <td style={{ padding: 6 }}>
                              <span className={`badge ${log.entityType === "crm_territory_balancing" ? "badge-approved" : "badge-submitted"}`} style={{ fontSize: 8.5 }}>
                                {log.entityType === "crm_territory_balancing" ? "REBALANCE" : "PLACEMENT"}
                              </span>
                            </td>
                            <td style={{ padding: 6 }}>
                              {changes.bulkReassignment 
                                ? `Rebalanced ${changes.totalRetailersUpdated} retailers in batch.` 
                                : `Moved store to route ${changes.routeCode || "Unassigned"}.`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </CollapsibleCard>

          </div>
        )}

          </div>
        )}

        {/* RIGHT COLUMN: Interactive Leaflet Map */}
        {(!isMobile || activeMobileView === "map") && (
          <div 
            ref={containerRef} 
            className="card" 
            style={{ 
              height: isMobile ? "60vh" : "82vh", 
              position: isMobile ? "relative" : "sticky", 
              top: isMobile ? 0 : 16, 
              borderRadius: 8, 
              overflow: "hidden", 
              zIndex: 0 
            }} 
          >
            {/* Mobile Gestures Overlay */}
            {isMobile && !mapInteractive && (
              <div 
                onClick={() => setMapInteractive(true)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  backdropFilter: "blur(2px)",
                  zIndex: 1000,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  cursor: "pointer",
                  borderRadius: "8px"
                }}
              >
                <div style={{
                  backgroundColor: "var(--card-bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "30px",
                  padding: "10px 20px",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "4px",
                  textAlign: "center",
                  maxWidth: "80%"
                }}>
                  <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Map size={16} style={{ color: "var(--primary)" }} /> Tap to Interact with Map
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>
                    Swipe here to scroll page
                  </span>
                </div>
              </div>
            )}

            {/* Floating lock scroll button for mobile */}
            {isMobile && mapInteractive && (
              <button
                type="button"
                onClick={() => setMapInteractive(false)}
                style={{
                  position: "absolute",
                  top: "80px",
                  left: "10px",
                  zIndex: 1000,
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--card-bg)",
                  color: "var(--text)",
                  fontSize: "11px",
                  fontWeight: 600,
                  boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Lock size={12} /> Lock Scroll
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
