"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function VcrmMapClient() {
  const [routes, setRoutes] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [filterFreshness, setFilterFreshness] = useState({
    fresh: true,
    warning: true,
    overdue: true,
  });

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layersRef = useRef({
    polylines: L.featureGroup(),
    retailers: L.featureGroup(),
    warnings: L.featureGroup(),
  });

  // Fetch routes data
  useEffect(() => {
    fetch("/api/fomo/map")
      .then((res) => res.json())
      .then((data) => {
        setRoutes(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error loading map data:", err);
        setLoading(false);
      });
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    // Build map
    const map = L.map(containerRef.current, {
      zoomControl: true,
      minZoom: 6,
    }).setView([42.8, -75.5], 7);
    mapRef.current = map;

    // Detect theme and apply corresponding map tiles
    const isLight = document.body.classList.contains("light-theme");
    const tileUrl = isLight
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    // Add feature groups to map
    layersRef.current.polylines.addTo(map);
    layersRef.current.retailers.addTo(map);
    layersRef.current.warnings.addTo(map);

    // Handle theme sync changes dynamically
    const observer = new MutationObserver(() => {
      const isLightNow = document.body.classList.contains("light-theme");
      const nextTileUrl = isLightNow
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
      
      // Update tiles by removing existing and re-adding
      map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          map.removeLayer(layer);
        }
      });
      L.tileLayer(nextTileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    return () => {
      observer.disconnect();
      map.remove();
    };
  }, []);

  // Update Layers based on selected route and freshness filters
  useEffect(() => {
    const map = mapRef.current;
    if (!map || loading) return;

    // Clear existing shapes/markers
    layersRef.current.polylines.clearLayers();
    layersRef.current.retailers.clearLayers();
    layersRef.current.warnings.clearLayers();

    const activeRoutes = selectedRouteId === "all" 
      ? routes 
      : routes.filter((r) => r.id === selectedRouteId);

    const latLngBounds = [];

    // Distinct colors for different routes
    const routeColors = ["#4361ee", "#7209b7", "#f72585", "#4cc9f0", "#4895ef", "#560bad"];

    activeRoutes.forEach((route, index) => {
      const color = routeColors[index % routeColors.length];
      const validRetailers = route.retailers.filter(
        (r) => r.latitude !== null && r.longitude !== null
      );

      // Fit bounds collection
      const routePoints = [];

      validRetailers.forEach((ret) => {
        // Apply freshness filter
        if (!filterFreshness[ret.freshness]) return;

        const position = [ret.latitude, ret.longitude];
        routePoints.push(position);
        latLngBounds.push(position);

        // Marker color based on visit freshness
        const markerColors = {
          fresh: "#06d6a0", // Green
          warning: "#ffd166", // Yellow
          overdue: "#ef476f", // Red
        };

        const statusLabels = {
          fresh: "Visited Recently",
          warning: "Visit Approaching",
          overdue: "Coaching Overdue",
        };

        // Draw retailer circle marker
        const marker = L.circleMarker(position, {
          radius: 8,
          fillColor: markerColors[ret.freshness],
          color: "#ffffff",
          weight: 1.5,
          fillOpacity: 0.85,
        });

        // Popup details
        const discrepanciesList = ret.discrepancies.length > 0
          ? `<div style="margin-top:8px; border-top:1px solid #ccc; padding-top:6px;">
               <strong style="color:#ef476f;">🚨 Open Discrepancies (${ret.discrepancies.length}):</strong>
               <ul style="margin:4px 0 0 16px; padding:0; font-size:11px; color:#ef476f;">
                 ${ret.discrepancies.map(d => `<li>${d.type}: ${d.notes || 'No details'}</li>`).join('')}
               </ul>
             </div>`
          : "";

        const popupContent = `
          <div style="font-family:Inter, sans-serif; font-size:12px; color:var(--text); line-height:1.4;">
            <strong style="font-size:13px; color:var(--primary);">${ret.name}</strong><br/>
            <span>${ret.address}, ${ret.city}</span><br/>
            <strong>County:</strong> ${ret.county || 'Unknown'}<br/>
            <strong>DMA:</strong> ${ret.dma || 'Unknown'}<br/>
            <strong>Service Center:</strong> ${ret.serviceCenter || 'Unknown'}<br/>
            <strong>Route Order:</strong> Sequence #${ret.routeOrder}<br/>
            <strong>Visit Cadence:</strong> ${ret.visitCadence}<br/>
            <strong>Coaching Status:</strong> <span style="font-weight:bold; color:${markerColors[ret.freshness]}">${statusLabels[ret.freshness]}</span><br/>
            <strong>Last Visited:</strong> ${ret.lastVisitDate ? new Date(ret.lastVisitDate).toLocaleDateString() : 'Never'}<br/>
            <strong>Training:</strong> ${ret.trainingStatus === 'trained' ? '🟢 Ask-for-Sale Trained' : '⚪ Untrained'}<br/>
            ${discrepanciesList}
          </div>
        `;

        marker.bindPopup(popupContent);
        layersRef.current.retailers.addLayer(marker);

        // Draw Exception Pins for open support opportunities
        if (ret.discrepancies.length > 0) {
          const warningIcon = L.divIcon({
            className: "custom-warning-pin",
            html: '<div style="background-color:#ef476f; color:white; border-radius:50%; width:18px; height:18px; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:bold; border:1.5px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.4); animation: pulse 2s infinite;">!</div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          });

          const wMarker = L.marker(position, { icon: warningIcon });
          wMarker.bindPopup(`
            <div style="font-size:12px; font-family:Inter, sans-serif;">
              <strong style="color:#ef476f;">Support Exception at ${ret.name}</strong><br/>
              <span>Please resolve equipment or merchandising discrepancies on next visit.</span>
              ${discrepanciesList}
            </div>
          `);
          layersRef.current.warnings.addLayer(wMarker);
        }
      });

      // Draw polyline connecting stores on the route in sequence order
      if (routePoints.length > 1) {
        const polyline = L.polyline(routePoints, {
          color: color,
          weight: 3,
          opacity: 0.6,
          dashArray: "6, 6",
        });

        polyline.bindTooltip(`Route: ${route.name} (${route.code})<br>Rep: ${route.repName}`, {
          sticky: true,
        });

        layersRef.current.polylines.addLayer(polyline);
      }
    });

    // Auto fit map bounds if valid coordinates exist
    if (latLngBounds.length > 0) {
      map.fitBounds(L.latLngBounds(latLngBounds), { padding: [40, 40] });
    }
  }, [routes, selectedRouteId, filterFreshness, loading]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "500px" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading VCRM Partners data...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
      {/* Map Control Filters */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 16,
        padding: "16px 20px",
        backgroundColor: "var(--surface-3)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        color: "var(--text)"
      }}>
        {/* Route Dropdown Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontWeight: 600, fontSize: "14px" }}>Select Visitation Route:</label>
          <select 
            value={selectedRouteId}
            onChange={(e) => setSelectedRouteId(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              backgroundColor: "var(--surface-1)",
              color: "var(--text)",
              outline: "none",
              fontSize: "14px",
              cursor: "pointer"
            }}
          >
            <option value="all">All Routes (Overview)</option>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code}) - {r.repName}
              </option>
            ))}
          </select>
        </div>

        {/* Freshness Checkboxes */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "14px" }}>Coaching Status:</span>
          
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", cursor: "pointer" }}>
            <input 
              type="checkbox"
              checked={filterFreshness.fresh}
              onChange={(e) => setFilterFreshness({ ...filterFreshness, fresh: e.target.checked })}
              style={{ accentColor: "#06d6a0" }}
            />
            <span style={{ color: "#06d6a0", fontWeight: 600 }}>🟢 Visited Recently</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", cursor: "pointer" }}>
            <input 
              type="checkbox"
              checked={filterFreshness.warning}
              onChange={(e) => setFilterFreshness({ ...filterFreshness, warning: e.target.checked })}
              style={{ accentColor: "#ffd166" }}
            />
            <span style={{ color: "#ffd166", fontWeight: 600 }}>🟡 Warning</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "13px", cursor: "pointer" }}>
            <input 
              type="checkbox"
              checked={filterFreshness.overdue}
              onChange={(e) => setFilterFreshness({ ...filterFreshness, overdue: e.target.checked })}
              style={{ accentColor: "#ef476f" }}
            />
            <span style={{ color: "#ef476f", fontWeight: 600 }}>🔴 Overdue / Needs Coaching</span>
          </label>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: "650px",
          borderRadius: "8px",
          border: "1px solid var(--border)",
          backgroundColor: "var(--card-bg)",
          overflow: "hidden",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.15)"
        }}
      />
      
      {/* CSS Keyframe Animation for Exception pulse effect */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 71, 111, 0.7);
          }
          70% {
            transform: scale(1.15);
            box-shadow: 0 0 0 6px rgba(239, 71, 111, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 71, 111, 0);
          }
        }
        .custom-warning-pin div {
          animation: pulse 2s infinite;
        }
      `}</style>
    </div>
  );
}
