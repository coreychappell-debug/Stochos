"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store, Download, Search, Settings, Zap, Octagon, CheckCircle2, AlertTriangle, ArrowLeft, Clock } from "lucide-react";

function renderAddressDiff(registered, standardized) {
  if (!standardized || standardized === "—") return <span style={{ color: "var(--text-muted)" }}>—</span>;
  
  const cleanReg = registered.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
  const regWords = cleanReg.split(/\s+/).filter(Boolean);
  
  const stdWords = standardized.split(/\s+/);
  
  return (
    <div style={{ fontSize: 12, lineHeight: "1.4" }}>
      {stdWords.map((word, idx) => {
        const cleanWord = word.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
        const isMatch = regWords.includes(cleanWord);
        return (
          <span 
            key={idx} 
            style={{ 
              color: isMatch ? "var(--text)" : "var(--purple)", 
              fontWeight: isMatch ? "normal" : 600,
              backgroundColor: isMatch ? "transparent" : "rgba(123, 104, 238, 0.08)",
              borderBottom: isMatch ? "none" : "1px dashed var(--purple)",
              padding: isMatch ? "0" : "1px 2px",
              borderRadius: isMatch ? "0" : "2px",
              marginRight: "4px",
              display: "inline-block"
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export default function FomoMismatchClient({ initialRetailers }) {
  const router = useRouter();
  const [retailers, setRetailers] = useState(initialRetailers);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all, mismatch, unmatched, pending_host, bypassed
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search]);

  // Scan states
  const [scanning, setScanning] = useState(false);
  const [scanningTotalCount, setScanningTotalCount] = useState(0);
  const [currentScanningIndex, setCurrentScanningIndex] = useState(0);
  const [scanningRetailerName, setScanningRetailerName] = useState("");
  const [abortController, setAbortController] = useState(null);

  // Sync state changes with database
  const runSingleAudit = async (retailerId, signal) => {
    try {
      // 1. Query verification API
      const verifyRes = await fetch(`/api/fomo/retailers/${retailerId}/verify-address`, { signal });
      if (!verifyRes.ok) {
        const errText = await verifyRes.text();
        let errMsg = "Failed to verify address";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) errMsg += `: ${parsed.error}`;
        } catch (_) {
          errMsg += `: ${errText}`;
        }
        throw new Error(errMsg);
      }
      const verifyData = await verifyRes.json();

      let computedStatus = "unknown";
      let distanceMeters = null;
      let standardAddress = null;
      let standardLat = null;
      let standardLng = null;

      if (verifyData.verified) {
        distanceMeters = verifyData.distanceMeters;
        computedStatus = verifyData.coordsMatch ? "verified" : "mismatch";
        standardAddress = verifyData.verifiedAddress;
        standardLat = verifyData.verifiedCoords.lat;
        standardLng = verifyData.verifiedCoords.lng;
      } else {
        computedStatus = "unmatched";
      }

      // 2. Save result to DB
      const saveRes = await fetch(`/api/fomo/retailers/${retailerId}/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save-audit-result",
          status: computedStatus,
          distance: distanceMeters
        }),
        signal
      });

      if (!saveRes.ok) {
        const errText = await saveRes.text();
        let errMsg = "Failed to save audit result";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) errMsg += `: ${parsed.error}`;
        } catch (_) {
          errMsg += `: ${errText}`;
        }
        throw new Error(errMsg);
      }

      // 3. Update local state
      setRetailers((prev) =>
        prev.map((r) =>
          r.id === retailerId
            ? {
                ...r,
                geodataStatus: computedStatus,
                geodataDistance: distanceMeters,
                geodataStandardAddress: standardAddress,
                geodataStandardLatitude: standardLat,
                geodataStandardLongitude: standardLng,
                geodataLastChecked: new Date().toISOString()
              }
            : r
        )
      );

      return { success: true, status: computedStatus };
    } catch (e) {
      if (e.name === "AbortError") {
        console.log("Audit aborted");
      } else {
        console.error(`Audit failed for retailer ID ${retailerId}:`, e);
      }
      return { success: false, error: e.message };
    }
  };

  const handleStartAudit = async () => {
    if (scanning) return;

    // Filter to only items that have NOT been checked or have failed/mismatch status,
    // and are in the user's currently filtered view
    const listToScan = filteredRetailers.filter(
      r => !r.geodataBypassed && !r.geodataHostCorrectionRequested && (r.geodataStatus === null || r.geodataStatus === "unknown" || r.geodataStatus === "")
    );

    if (listToScan.length === 0) {
      alert("All stores in the current view have already been audited. Nightly server jobs check for updates automatically.");
      return;
    }

    const maxBrowserScan = 50;
    let targetList = listToScan;
    
    if (listToScan.length > maxBrowserScan) {
      const proceed = confirm(
        `You have ${listToScan.length} stores awaiting audit in this view.\n\n` +
        `Note: System-wide geodata audits run automatically on the server nightly (at 3:00 AM) to handle the 13k+ registry.\n\n` +
        `To protect browser performance and avoid API throttling, would you like to run on-demand geocode audits on the first ${maxBrowserScan} unchecked stores now?`
      );
      if (!proceed) return;
      targetList = listToScan.slice(0, maxBrowserScan);
    } else {
      const proceed = confirm(`Start on-demand geodata auditing for ${listToScan.length} stores in this view?`);
      if (!proceed) return;
    }

    setScanning(true);
    setScanningTotalCount(targetList.length);
    setCurrentScanningIndex(0);

    const controller = new AbortController();
    setAbortController(controller);

    const batchSize = 3;
    const totalToScan = targetList.length;

    try {
      for (let i = 0; i < totalToScan; i += batchSize) {
        if (controller.signal.aborted) break;

        const batch = targetList.slice(i, i + batchSize);
        setCurrentScanningIndex(i);
        setScanningRetailerName(batch.map((b) => b.name).join(", "));

        await Promise.all(
          batch.map((retailer) => runSingleAudit(retailer.id, controller.signal))
        );
      }
    } catch (err) {
      console.error("Batch scan error:", err);
    } finally {
      setScanning(false);
      setScanningTotalCount(0);
      setCurrentScanningIndex(0);
      setScanningRetailerName("");
      setAbortController(null);
      alert(`On-demand geodata audit of ${totalToScan} stores completed!`);
      router.refresh();
    }
  };

  const handleCancelAudit = () => {
    if (abortController) {
      abortController.abort();
      setScanning(false);
    }
  };

  const handleBypass = async (retailerId) => {
    try {
      const res = await fetch(`/api/fomo/retailers/${retailerId}/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bypass" })
      });

      if (!res.ok) throw new Error("Bypass request failed");
      
      setRetailers((prev) =>
        prev.map((r) =>
          r.id === retailerId
            ? { ...r, geodataBypassed: true, geodataHostCorrectionRequested: false }
            : r
        )
      );
    } catch (err) {
      alert(`Error bypassing: ${err.message}`);
    }
  };

  const handleFlagCorrection = async (retailer) => {
    if (!retailer.geodataStandardAddress) {
      // If we don't have cached standard geodata, fetch it on the fly first
      try {
        const res = await fetch(`/api/fomo/retailers/${retailer.id}/verify-address`);
        const data = await res.json();
        if (!data.verified) {
          alert("Cannot flag correction. Address is not verifiable by USPS/Census database.");
          return;
        }
        retailer.geodataStandardAddress = data.verifiedAddress;
        retailer.geodataStandardLatitude = data.verifiedCoords.lat;
        retailer.geodataStandardLongitude = data.verifiedCoords.lng;
      } catch (e) {
        alert("Failed to verify address from Census server before flagging.");
        return;
      }
    }

    try {
      const res = await fetch(`/api/fomo/retailers/${retailer.id}/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag-correction",
          address: retailer.geodataStandardAddress,
          latitude: retailer.geodataStandardLatitude,
          longitude: retailer.geodataStandardLongitude
        })
      });

      if (!res.ok) throw new Error("Correction flagging request failed");

      setRetailers((prev) =>
        prev.map((r) =>
          r.id === retailer.id
            ? { 
                ...r, 
                geodataHostCorrectionRequested: true, 
                geodataBypassed: false,
                geodataStandardAddress: retailer.geodataStandardAddress,
                geodataStandardLatitude: retailer.geodataStandardLatitude,
                geodataStandardLongitude: retailer.geodataStandardLongitude
              }
            : r
        )
      );
    } catch (err) {
      alert(`Error flagging: ${err.message}`);
    }
  };

  // Metrics
  const stats = useMemo(() => {
    let verifiedCount = 0;
    let mismatchCount = 0;
    let unmatchedCount = 0;
    let bypassedCount = 0;
    let pendingHostCount = 0;
    let unknownCount = 0;

    retailers.forEach((r) => {
      if (r.geodataBypassed) bypassedCount++;
      else if (r.geodataHostCorrectionRequested) pendingHostCount++;
      else {
        if (r.geodataStatus === "verified") verifiedCount++;
        else if (r.geodataStatus === "mismatch") mismatchCount++;
        else if (r.geodataStatus === "unmatched") unmatchedCount++;
        else unknownCount++;
      }
    });

    return {
      total: retailers.length,
      verified: verifiedCount,
      mismatch: mismatchCount,
      unmatched: unmatchedCount,
      bypassed: bypassedCount,
      pendingHost: pendingHostCount,
      unknown: unknownCount
    };
  }, [retailers]);

  // Filtering & Search
  const filteredRetailers = useMemo(() => {
    return retailers.filter((r) => {
      // Tab filter
      if (activeTab === "mismatch") {
        if (r.geodataBypassed || r.geodataHostCorrectionRequested || r.geodataStatus !== "mismatch") return false;
      } else if (activeTab === "unmatched") {
        if (r.geodataBypassed || r.geodataHostCorrectionRequested || r.geodataStatus !== "unmatched") return false;
      } else if (activeTab === "pending_host") {
        if (!r.geodataHostCorrectionRequested) return false;
      } else if (activeTab === "bypassed") {
        if (!r.geodataBypassed) return false;
      }

      // Search filter
      if (search) {
        const query = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(query) ||
          r.externalId.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query) ||
          r.city.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [retailers, activeTab, search]);

  const totalPages = Math.ceil(filteredRetailers.length / pageSize);

  const paginatedRetailers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRetailers.slice(startIndex, startIndex + pageSize);
  }, [filteredRetailers, currentPage]);

  const progressPercent = scanning && scanningTotalCount > 0 ? Math.round((currentScanningIndex / scanningTotalCount) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Header and Exporter Action Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/fomo" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ArrowLeft size={14} /> FOMO Dashboard
          </Link>
          <Link href="/fomo/retailers" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Store size={14} /> Retailer Registry
          </Link>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {stats.pendingHost > 0 && (
            <a 
              href="/api/fomo/retailers/export-corrections" 
              className="btn btn-primary"
              style={{ backgroundColor: "var(--purple)", borderColor: "var(--purple)", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Download size={14} /> Download Host Update CSV ({stats.pendingHost} Pending)
            </a>
          )}
          <button 
            onClick={handleStartAudit} 
            disabled={scanning}
            className="btn btn-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            {scanning ? (
              <>
                <Zap size={14} /> Scanning...
              </>
            ) : (
              <>
                <Search size={14} /> Audit Unchecked Stores in View
              </>
            )}
          </button>
        </div>
      </div>

      {/* Nightly Audit Banner */}
      <div className="card" style={{ 
        borderLeft: "4px solid var(--purple)", 
        padding: "16px", 
        backgroundColor: "var(--surface-2)", 
        display: "flex", 
        alignItems: "center", 
        gap: 16,
        borderRadius: "var(--radius-md)"
      }}>
        <div style={{ color: "var(--purple)", display: "flex", alignItems: "center" }}><Settings size={28} /></div>
        <div>
          <strong style={{ color: "var(--purple)", fontSize: 15 }}>Automated Nightly Geodata Audits Active</strong>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, lineHeight: "1.4" }}>
            The operational FOMO system is configured to automatically run a geodata audit cron job at <strong>3:00 AM nightly</strong>. 
            This job queries the standard Census Bureau API, processes up to 1,000 stores per run, and updates coordinate/address validation cache metrics in the background. 
            Manual batch audits triggered from the browser are capped at 50 stores to prevent rate limits and performance lag.
          </div>
        </div>
      </div>

      {/* Audit Progress Bar */}
      {scanning && (
        <div className="card" style={{ borderLeft: "4px solid var(--blue)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 600, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Zap size={14} /> On-Demand Geodata Audit In Progress...
            </span>
            <button onClick={handleCancelAudit} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Octagon size={12} /> Cancel Scan
            </button>
          </div>
          <div style={{ height: 8, width: "100%", backgroundColor: "var(--surface-3)", borderRadius: 4, overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${progressPercent}%`, backgroundColor: "var(--blue)", transition: "width 0.2s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-secondary)" }}>
            <span>Audited {currentScanningIndex} of {scanningTotalCount} stores ({progressPercent}%)</span>
            <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: 300 }}>
              Scanning: <strong>{scanningRetailerName}</strong>
            </span>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-blue" style={{ cursor: "pointer" }} onClick={() => setActiveTab("all")}>
          <div className="kpi-label">Total Retailers</div>
          <div className="kpi-value">{stats.total}</div>
          <div className="kpi-subtitle">{stats.unknown} Not Audited Yet</div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-label">Verified Matches</div>
          <div className="kpi-value">{stats.verified}</div>
          <div className="kpi-subtitle">Matched within 150m</div>
        </div>
        <div className="kpi-card kpi-gold" style={{ cursor: "pointer" }} onClick={() => setActiveTab("mismatch")}>
          <div className="kpi-label">Coordinates Mismatches</div>
          <div className="kpi-value">{stats.mismatch}</div>
          <div className="kpi-subtitle">Off by &gt;150m (needs attention)</div>
        </div>
        <div className="kpi-card kpi-red" style={{ cursor: "pointer" }} onClick={() => setActiveTab("unmatched")}>
          <div className="kpi-label">Unmatched Addresses</div>
          <div className="kpi-value">{stats.unmatched}</div>
          <div className="kpi-subtitle">Address not in USPS database</div>
        </div>
        <div className="kpi-card kpi-purple" style={{ cursor: "pointer", borderLeft: "4px solid var(--purple)" }} onClick={() => setActiveTab("pending_host")}>
          <div className="kpi-label" style={{ color: "var(--purple)" }}>Pending Host Updates</div>
          <div className="kpi-value" style={{ color: "var(--purple)" }}>{stats.pendingHost}</div>
          <div className="kpi-subtitle">Flagged for gaming system correction</div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          
          {/* Custom Tabs */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button 
              className={`btn btn-sm ${activeTab === "all" ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setActiveTab("all")}
            >
              All Registry ({stats.total})
            </button>
            <button 
              className={`btn btn-sm ${activeTab === "mismatch" ? "btn-primary" : "btn-secondary"}`}
              style={activeTab === "mismatch" ? { backgroundColor: "var(--gold)", color: "var(--navy)", borderColor: "var(--gold)" } : {}}
              onClick={() => setActiveTab("mismatch")}
            >
              Active Mismatches ({stats.mismatch})
            </button>
            <button 
              className={`btn btn-sm ${activeTab === "unmatched" ? "btn-primary" : "btn-secondary"}`}
              style={activeTab === "unmatched" ? { backgroundColor: "var(--red)", color: "white", borderColor: "var(--red)" } : {}}
              onClick={() => setActiveTab("unmatched")}
            >
              Unmatched Addresses ({stats.unmatched})
            </button>
            <button 
              className={`btn btn-sm ${activeTab === "pending_host" ? "btn-primary" : "btn-secondary"}`}
              style={activeTab === "pending_host" ? { backgroundColor: "var(--purple)", color: "white", borderColor: "var(--purple)" } : {}}
              onClick={() => setActiveTab("pending_host")}
            >
              Pending Host Update ({stats.pendingHost})
            </button>
            <button 
              className={`btn btn-sm ${activeTab === "bypassed" ? "btn-primary" : "btn-secondary"}`}
              style={activeTab === "bypassed" ? { backgroundColor: "var(--blue)", color: "white", borderColor: "var(--blue)" } : {}}
              onClick={() => setActiveTab("bypassed")}
            >
              Approved Overrides ({stats.bypassed})
            </button>
          </div>

          {/* Search Input */}
          <input
            type="text"
            className="search-input"
            style={{ width: 250, margin: 0, height: 32 }}
            placeholder="Search by store name, ID, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 140 }}>External ID</th>
              <th>Retailer Name & Route</th>
              <th>Gaming System Registered Location</th>
              <th>Standardized Location (USPS)</th>
              <th style={{ width: 120 }}>Distance Diff</th>
              <th style={{ width: 140 }}>Audit Status</th>
              <th style={{ width: 220 }}>Supervisor Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRetailers.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: 32, color: "var(--text-secondary)" }}>
                  No stores match the active filter criteria. Run an audit scan above or adjust filter tabs.
                </td>
              </tr>
            ) : (
              paginatedRetailers.map((r) => {
                let statusBadge = <span className="badge badge-draft">Not Audited</span>;
                let distanceText = "—";
                let verifiedAddressText = r.geodataStandardAddress || "—";
                
                if (r.geodataBypassed) {
                  statusBadge = <span className="badge" style={{ backgroundColor: "var(--blue-dim)", color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> Override Approved</span>;
                } else if (r.geodataHostCorrectionRequested) {
                  statusBadge = <span className="badge" style={{ backgroundColor: "var(--purple-dim)", color: "var(--purple)", display: "inline-flex", alignItems: "center", gap: "4px" }}><Clock size={12} /> Host Update Flagged</span>;
                } else if (r.geodataStatus === "verified") {
                  statusBadge = <span className="badge badge-approved" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> Verified Match</span>;
                } else if (r.geodataStatus === "mismatch") {
                  statusBadge = <span className="badge" style={{ backgroundColor: "var(--gold-dim)", color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> Mismatch</span>;
                } else if (r.geodataStatus === "unmatched") {
                  statusBadge = <span className="badge badge-rejected" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> Unmatched Address</span>;
                }

                if (r.geodataDistance !== null && r.geodataDistance !== undefined) {
                  distanceText = `${r.geodataDistance} meters`;
                }

                const hasStandardLocation = !!r.geodataStandardAddress;

                return (
                  <tr key={r.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{r.externalId}</td>
                    <td>
                      <Link href={`/fomo/retailers/${r.id}`} style={{ fontWeight: 600 }}>
                        {r.name}
                      </Link>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                        Route: {r.route ? `${r.route.code} - ${r.route.name}` : "None"} | {r.chain ? r.chain.name : "Independent"}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{r.address}, {r.city}, NY {r.zipCode}</div>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                        {r.latitude && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                            ({r.latitude.toFixed(5)}, {r.longitude.toFixed(5)})
                          </div>
                        )}
                        {r.latitude && (
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 10, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "2px", textDecoration: "none" }}
                            title="View registered coordinates on Google Maps"
                          >
                            📍 Pin
                          </a>
                        )}
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${r.address}, ${r.city}, NY`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 10, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "2px", textDecoration: "none" }}
                          title="Search registered address on Google Maps"
                        >
                          🔍 Search
                        </a>
                      </div>
                    </td>
                    <td>
                      {r.geodataStatus === "unmatched" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 500 }}>Address not found in USPS</span>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name}, ${r.address}, ${r.city}, NY`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              fontSize: 10, 
                              color: "var(--red)", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "2px", 
                              textDecoration: "underline",
                              marginTop: 2
                            }}
                          >
                            🔍 Search Google Maps to find correct address
                          </a>
                        </div>
                      ) : (
                        <>
                          {renderAddressDiff(r.address + ", " + r.city + ", NY " + r.zipCode, verifiedAddressText)}
                          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                            {r.geodataStandardLatitude && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
                                ({r.geodataStandardLatitude.toFixed(5)}, {r.geodataStandardLongitude.toFixed(5)})
                              </div>
                            )}
                            {r.geodataStandardLatitude && (
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${r.geodataStandardLatitude},${r.geodataStandardLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 10, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "2px", textDecoration: "none" }}
                                title="View standardized coordinates on Google Maps"
                              >
                                📍 Pin
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(r.geodataStandardAddress);
                                alert("Standardized address copied to clipboard!");
                              }}
                              style={{ 
                                background: "none", 
                                border: "none", 
                                padding: 0, 
                                fontSize: 10, 
                                color: "var(--blue)", 
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px"
                              }}
                              title="Copy standardized address"
                            >
                              📋 Copy
                            </button>
                            {r.latitude && r.longitude && r.geodataStandardLatitude && r.geodataStandardLongitude && (
                              <a 
                                href={`https://www.google.com/maps/dir/?api=1&origin=${r.latitude},${r.longitude}&destination=${r.geodataStandardLatitude},${r.geodataStandardLongitude}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 10, color: "var(--purple)", display: "inline-flex", alignItems: "center", gap: "2px", textDecoration: "none" }}
                                title="Compare registered vs standardized coordinates"
                              >
                                🗺️ Compare
                              </a>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>
                      <span style={{
                        color: r.geodataDistance > 150 ? "var(--gold)" : r.geodataDistance <= 150 && r.geodataDistance !== null ? "var(--green)" : "inherit"
                      }}>
                        {distanceText}
                      </span>
                    </td>
                    <td>{statusBadge}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 11, padding: "4px 8px", minWidth: 100, justifyContent: "center" }}
                          onClick={() => handleBypass(r.id)}
                          disabled={r.geodataBypassed || scanning}
                        >
                          Approve Stored
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{
                            fontSize: 11,
                            padding: "4px 8px",
                            minWidth: 100,
                            justifyContent: "center",
                            backgroundColor: r.geodataHostCorrectionRequested ? "var(--surface-3)" : "var(--purple)",
                            borderColor: r.geodataHostCorrectionRequested ? "var(--border)" : "var(--purple)",
                            color: r.geodataHostCorrectionRequested ? "var(--text-muted)" : "white"
                          }}
                          onClick={() => handleFlagCorrection(r)}
                          disabled={r.geodataHostCorrectionRequested || scanning || r.geodataStatus === "verified" || r.geodataStatus === "unmatched"}
                        >
                          Flag Host Correction
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          marginTop: 8, 
          padding: "12px 24px", 
          backgroundColor: "var(--surface-2)", 
          border: "1px solid var(--border)", 
          borderRadius: "var(--radius-md)" 
        }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Showing <strong>{Math.min(filteredRetailers.length, (currentPage - 1) * pageSize + 1)}</strong> to <strong>{Math.min(filteredRetailers.length, currentPage * pageSize)}</strong> of <strong>{filteredRetailers.length}</strong> stores
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{ padding: "6px 12px" }}
            >
              ◀ Previous
            </button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontSize: 13, color: "var(--text)" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{ padding: "6px 12px" }}
            >
              Next ▶
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
