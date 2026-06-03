"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";

const SERVICE_CENTERS = [
  { id: "schenectady", name: "Schenectady (HQ)", dbValue: "Schenectady", address: "1 Broadway Center, Schenectady, NY 12305", lat: 42.81432, lng: -73.94314 },
  { id: "buffalo", name: "Buffalo Service Center", dbValue: "Buffalo", address: "165 Genesee St, Buffalo, NY 14203", lat: 42.88850, lng: -78.87109 },
  { id: "rochester", name: "Rochester Service Center", dbValue: "Rochester", address: "1425 Mt Read Blvd, Rochester, NY 14606", lat: 43.18434, lng: -77.65991 },
  { id: "syracuse", name: "Syracuse Service Center", dbValue: "Syracuse", address: "620 Erie Blvd W, Syracuse, NY 13204", lat: 43.05058, lng: -76.16335 },
  { id: "fishkill", name: "Fishkill Service Center", dbValue: "Fishkill", address: "18 Westage Business Center Dr, Fishkill, NY 12524", lat: 41.52402, lng: -73.89785 },
  { id: "manhattan", name: "Manhattan Service Center (NYC)", dbValue: "Manhattan (NYC)", address: "15 Beaver St, New York, NY 10004", lat: 40.70494, lng: -74.01258 },
  { id: "gardencity", name: "Long Island Service Center (Garden City)", dbValue: "Long Island (Garden City)", address: "400 Oak St, Garden City, NY 11530", lat: 40.72591, lng: -73.59374 }
];

export default function PlannerClient({ retailers, routes, chains }) {
  // Selection and filter state
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Starting point state
  const [startType, setStartType] = useState("center"); // "center" | "custom"
  const [selectedCenterId, setSelectedCenterId] = useState("schenectady");
  const [customAddress, setCustomAddress] = useState("");
  const [customCoords, setCustomCoords] = useState(null); // { lat, lng, resolvedAddress }
  const [geocoding, setGeocoding] = useState(false);
  const [roundTrip, setRoundTrip] = useState(true);
  const [filterByTerritory, setFilterByTerritory] = useState(true);
  
  // Accordion toggle states for collapsible sections (only one open at a time to maximize working space)
  const [expandedPanels, setExpandedPanels] = useState({
    start: true,
    stops: false,
    picker: false
  });

  const togglePanel = (panelName) => {
    setExpandedPanels((prev) => {
      const isCurrentlyExpanded = prev[panelName];
      return {
        start: panelName === "start" ? !isCurrentlyExpanded : false,
        stops: panelName === "stops" ? !isCurrentlyExpanded : false,
        picker: panelName === "picker" ? !isCurrentlyExpanded : false
      };
    });
  };

  const [mapExpanded, setMapExpanded] = useState(false);

  // Trigger leaflet map redraw on container resize transition
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize({ animate: true });
      }, 300);
    }
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

  // Reset page of selections on filter changes
  const filteredRetailers = useMemo(() => {
    const activeCenter = startType === "center" ? SERVICE_CENTERS.find(c => c.id === selectedCenterId) : null;

    return retailers.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (routeFilter !== "all" && r.routeId !== routeFilter) return false;
      if (chainFilter !== "all" && r.chainId !== chainFilter) return false;

      // Filter by Service Center territory bounds if enabled
      if (activeCenter && filterByTerritory) {
        if (r.serviceCenter !== activeCenter.dbValue) return false;
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
  }, [retailers, search, routeFilter, chainFilter, statusFilter, startType, selectedCenterId, filterByTerritory]);

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

  // Get selected stores objects
  const selectedStores = useMemo(() => {
    return retailers.filter((r) => selectedIds.has(r.id));
  }, [retailers, selectedIds]);

  // Predefined service center coordinates or geocoded custom address
  const startPoint = useMemo(() => {
    if (startType === "center") {
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
  }, [startType, selectedCenterId, customCoords]);

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
            html: `<div style="background-color:var(--text-muted); color:white; border-radius:50%; width:22px; height:22px; display:flex; align-items:center; justify-content:center; font-size:10px; border:1.5px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.2);">✓</div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          });

          L.marker(storePos, { icon: selectIcon })
            .bindPopup(`<strong>${store.name}</strong><br/><span>${store.address}</span>`)
            .addTo(layersRef.current.markers);
        }
      });
    }

    // Adjust zoom bounds
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

  }, [startPoint, selectedStores, optimizedRoute]);

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
            <span>🏢 1. Starting Location ({startType === "center" ? "Service Center" : "Home Address"})</span>
            <span>{expandedPanels.start ? "▲" : "▼"}</span>
          </div>
          
          {expandedPanels.start && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${startType === "center" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, justifyContent: "center", padding: "6px" }}
                  onClick={() => setStartType("center")}
                >
                  🏢 Service Center
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${startType === "custom" ? "btn-primary" : "btn-secondary"}`}
                  style={{ flex: 1, justifyContent: "center", padding: "6px" }}
                  onClick={() => setStartType("custom")}
                >
                  🏠 Start from Home
                </button>
              </div>

              {startType === "center" ? (
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
              ) : (
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
                    <div style={{ fontSize: 11, color: "var(--green)", padding: "6px 10px", backgroundColor: "rgba(40, 167, 69, 0.08)", borderRadius: 4, borderLeft: "2.5px solid var(--green)" }}>
                      📍 Resolved: <strong>{customCoords.resolvedAddress.split(",").slice(0, 2).join(",")}</strong>
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
              <span>📍 2. Selected Route Stops</span>
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
                      <span>🟢</span>
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
                          style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 12, padding: "0 4px" }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {roundTrip && (
                      <div style={{ fontSize: 11, color: "var(--green)", display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        <span>🔴</span>
                        <span><strong>End:</strong> {startPoint ? startPoint.name : "Start point"}</span>
                      </div>
                    )}
                  </div>

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
            <span>🏪 3. Store Selection Registry</span>
            <span>{expandedPanels.picker ? "▲" : "▼"}</span>
          </div>

          {expandedPanels.picker && (
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
              
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
                  {routes.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
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
                            </td>
                            <td style={{ padding: 6 }}>
                              {r.address}, {r.city}
                              {!hasCoords && (
                                <div style={{ fontSize: 9, color: "var(--red)", fontWeight: 600 }}>⚠️ No Coordinates</div>
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
            <span>⚡ Step 4: Route Optimization & Action</span>
            {selectedIds.size > 0 && (
              <span className="badge badge-submitted" style={{ padding: "2px 6px", fontSize: 10 }}>
                {selectedIds.size} Stop{selectedIds.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {selectedIds.size === 0 ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={true}
              style={{ width: "100%", justifyContent: "center", fontSize: 12, opacity: 0.5, cursor: "not-allowed", padding: "8px" }}
            >
              Select stores in Registry (3) to optimize
            </button>
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
                    <div style={{ fontSize: 9, color: "var(--gold)", backgroundColor: "rgba(255, 193, 7, 0.08)", padding: "4px 6px", borderRadius: 4, borderLeft: "2.5px solid var(--gold)" }}>
                      ⚠️ Using straight-line approximations.
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
                      style={{ flex: 2, justifyContent: "center", fontSize: 11, padding: "6px 8px", backgroundColor: "var(--green)", borderColor: "var(--green)" }}
                    >
                      🗺️ Open Navigation Map
                    </a>
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
                  {optimizing ? "🔄 Running TSP Optimization..." : `⚡ Calculate Optimized Visit Sequence (${selectedIds.size} Stops)`}
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
            {mapExpanded ? "📊 Split View" : "🖥️ Expand Map"}
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {geocoding ? "🔍 Locating starting address..." : "⚡ Computing optimal driving route..."}
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

