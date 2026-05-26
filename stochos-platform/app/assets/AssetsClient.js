"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = {
  computer: "Computer",
  mobile: "Mobile Device",
  scanner: "Barcode Scanner",
  peripheral: "Peripheral",
  furniture: "Office Furniture",
  other: "Other Asset",
};

const ASSET_STATUSES = {
  available: "Available",
  assigned: "Assigned / Checkout",
  repair: "In Repair",
  retired: "Retired",
};

function parseCsvText(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  if (lines.length === 0) return [];
  const headers = lines[0].map(h => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = values[index];
    });
    data.push(obj);
  }
  return data;
}

function getAssetStatusDetails(a) {
  const startDate = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt ? new Date(a.createdAt) : new Date());
  const diffTime = Math.max(0, new Date() - startDate);
  const monthsAge = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.4375));
  const usefulMonths = a.usefulLifeMonths || 36;
  
  const isEol = monthsAge >= usefulMonths;
  const isNearingEol = !isEol && (monthsAge >= usefulMonths - 6);

  const purchaseValue = a.value ? parseFloat(a.value) : 0;
  const salvageValue = a.salePrice ? parseFloat(a.salePrice) : 0;
  const depreciableAmount = Math.max(0, purchaseValue - salvageValue);
  
  const monthlyDepreciation = usefulMonths > 0 ? (depreciableAmount / usefulMonths) : 0;
  const accumulatedDepreciation = Math.min(purchaseValue, monthlyDepreciation * monthsAge);
  const bookValue = Math.max(salvageValue, purchaseValue - accumulatedDepreciation);

  return {
    isEol,
    isNearingEol,
    monthsAge,
    bookValue,
    accumulatedDepreciation,
    monthlyDepreciation
  };
}

export default function AssetsClient({ initialAssets, jurisdictions, users }) {
  const router = useRouter();
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Tab & Replacement Planner States
  const [activeView, setActiveView] = useState("inventory");
  const [lifeLeftFilter, setLifeLeftFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // EOL & Useful Life Helpers
  const getAssetUsefulLifeEndDate = (a) => {
    const startDate = a.purchaseDate ? new Date(a.purchaseDate) : (a.createdAt ? new Date(a.createdAt) : new Date());
    const date = new Date(startDate);
    const usefulMonths = a.usefulLifeMonths || 36;
    date.setMonth(date.getMonth() + usefulMonths);
    return date;
  };

  const getAssetRemainingMonths = (a) => {
    const endDate = getAssetUsefulLifeEndDate(a);
    const diffTime = endDate - new Date();
    const remainingMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
    return remainingMonths;
  };

  const filtered = useMemo(() => {
    return assets.filter((a) => {
      if (categoryFilter !== "all" && a.category !== categoryFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !a.name.toLowerCase().includes(q) &&
          !a.assetTag.toLowerCase().includes(q) &&
          !(a.serialNumber || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [assets, search, categoryFilter, statusFilter]);

  const plannerAssets = useMemo(() => {
    return assets.filter((a) => {
      const remainingMonths = getAssetRemainingMonths(a);
      if (lifeLeftFilter === "expired") {
        return remainingMonths <= 0;
      }
      if (lifeLeftFilter === "6_months") {
        return remainingMonths > 0 && remainingMonths <= 6;
      }
      if (lifeLeftFilter === "12_months") {
        return remainingMonths > 0 && remainingMonths <= 12;
      }
      if (lifeLeftFilter === "24_months") {
        return remainingMonths > 0 && remainingMonths <= 24;
      }
      return true;
    });
  }, [assets, lifeLeftFilter]);

  const assetsByDate = useMemo(() => {
    const map = {};
    plannerAssets.forEach((a) => {
      const eolDate = getAssetUsefulLifeEndDate(a);
      if (eolDate) {
        const eolKey = eolDate.toISOString().split("T")[0];
        if (!map[eolKey]) map[eolKey] = { eol: [], disposal: [] };
        map[eolKey].eol.push(a);
      }
      if (a.disposalDate) {
        const dispKey = a.disposalDate.split("T")[0];
        if (!map[dispKey]) map[dispKey] = { eol: [], disposal: [] };
        map[dispKey].disposal.push(a);
      }
    });
    return map;
  }, [plannerAssets]);

  const selectedMonthAssets = useMemo(() => {
    return plannerAssets.filter((a) => {
      const eolDate = getAssetUsefulLifeEndDate(a);
      const isEolInMonth = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
      const isDispInMonth = a.disposalDate && 
        new Date(a.disposalDate).getMonth() === currentMonth && 
        new Date(a.disposalDate).getFullYear() === currentYear;
      return isEolInMonth || isDispInMonth;
    });
  }, [plannerAssets, currentMonth, currentYear]);

  const plannerKpis = useMemo(() => {
    let eolCount = 0;
    let criticalCount = 0;
    let replacementCost = 0;

    assets.forEach((a) => {
      const rem = getAssetRemainingMonths(a);
      if (rem <= 0) {
        eolCount++;
        replacementCost += a.value ? parseFloat(a.value) : 0;
      } else if (rem <= 6) {
        criticalCount++;
        replacementCost += a.value ? parseFloat(a.value) : 0;
      }
    });

    return { eolCount, criticalCount, replacementCost };
  }, [assets]);

  const handleRegisterAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      assetTag: form.get("assetTag"),
      name: form.get("name"),
      category: form.get("category"),
      serialNumber: form.get("serialNumber") || null,
      status: form.get("status") || "available",
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      jurisdictionId: form.get("jurisdictionId"),
      assignedToId: form.get("assignedToId") || null,
      purchaseDate: form.get("purchaseDate") || null,
      notes: form.get("notes") || null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 36,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register asset");
      }

      const newAsset = await res.json();
      setAssets([newAsset, ...assets]);
      setShowAddModal(false);
      e.target.reset();
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      assetTag: form.get("assetTag"),
      name: form.get("name"),
      category: form.get("category"),
      serialNumber: form.get("serialNumber") || null,
      status: form.get("status"),
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      assignedToId: form.get("assignedToId") || null,
      purchaseDate: form.get("purchaseDate") || null,
      notes: form.get("notes") || null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 36,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch(`/api/assets/${selectedAsset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update asset");
      }

      const updated = await res.json();
      setAssets(assets.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setSelectedAsset(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAsset = async (id) => {
    if (!confirm("Are you sure you want to remove this asset from inventory?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete asset");
      }
      setAssets(assets.filter((a) => a.id !== id));
      setSelectedAsset(null);
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    window.open("/api/assets/export", "_blank");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Asset Tag",
      "Name",
      "Category",
      "Serial Number",
      "Value",
      "Status",
      "Purchase Date",
      "Assigned Employee Email",
      "Jurisdiction",
      "Notes",
      "Disposal Date",
      "Disposal Method",
      "Sale Price",
      "Useful Life Months",
    ];
    const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "assets-import-template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseCsvText(text);
        if (parsed.length === 0) {
          alert("No records found in CSV file.");
          setUploading(false);
          return;
        }

        const res = await fetch("/api/assets/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        });

        if (!res.ok) {
          const data = await res.json();
          if (data.details && Array.isArray(data.details)) {
            alert(`Import failed with validation errors:\n\n` + data.details.slice(0, 15).join("\n") + (data.details.length > 15 ? `\n...and ${data.details.length - 15} more errors.` : ""));
            return;
          }
          throw new Error(data.error || "Failed to import assets");
        }

        const result = await res.json();
        alert(`Import completed! Created: ${result.createdCount}, Updated: ${result.updatedCount}`);
        
        // Fetch new assets list
        const refreshRes = await fetch("/api/assets");
        if (refreshRes.ok) {
          const updatedList = await refreshRes.json();
          setAssets(updatedList);
        }
        router.refresh();
      } catch (err) {
        alert(err.message);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Calendar Grid helper functions
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
  const formatDateKey = (year, month, day) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const calendarGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: "1px",
    backgroundColor: "var(--border)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    overflow: "hidden"
  };

  const headerCellStyle = {
    backgroundColor: "var(--surface-3)",
    padding: "8px 4px",
    textAlign: "center",
    fontWeight: "600",
    fontSize: "12px",
    color: "var(--text-secondary)"
  };

  const getDayCellStyle = (isCurrentMonth, isSelected, isToday) => ({
    backgroundColor: isSelected 
      ? "var(--blue-dim)" 
      : isCurrentMonth ? "var(--card-bg)" : "var(--navy)",
    minHeight: "90px",
    padding: "6px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    cursor: "pointer",
    border: isSelected ? "2px solid var(--blue)" : "1px solid var(--border-dim)",
    opacity: isCurrentMonth ? 1 : 0.4,
    transition: "all 0.15s ease",
    position: "relative"
  });

  return (
    <>
      {/* View Switcher Tabs */}
      <div className="tab-nav" style={{ marginBottom: "20px" }}>
        <button 
          type="button"
          className={`tab-btn ${activeView === "inventory" ? "active" : ""}`}
          onClick={() => { setActiveView("inventory"); setSelectedDayKey(null); }}
        >
          📋 Active Inventory
        </button>
        <button 
          type="button"
          className={`tab-btn ${activeView === "planner" ? "active" : ""}`}
          onClick={() => { setActiveView("planner"); setSelectedDayKey(null); }}
        >
          📅 Replacement Planner &amp; Calendar
        </button>
      </div>

      {activeView === "inventory" && (
        <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flex: 1 }}>
            <input
              className="search-input"
              type="text"
              placeholder="Search assets by tag, name, serial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: 160 }}
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              className="form-select"
              style={{ width: 160 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.entries(ASSET_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV Import Template">
              📄 Template
            </button>
            <button className="btn btn-secondary" onClick={handleExportCsv} title="Export Assets to CSV">
              📤 Export CSV
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer" }} title="Import Assets from CSV">
              {uploading ? "📥 Importing..." : "📥 Import CSV"}
              <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: "none" }} disabled={uploading} />
            </label>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Register Asset
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {activeView === "inventory" ? (
          <div style={{ flex: 1 }} className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Asset Tag</th>
                <th>Name</th>
                <th>Category</th>
                <th>Serial Number</th>
                <th>Value</th>
                <th>Checkout Assignment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const lifecycle = getAssetStatusDetails(a);
                return (
                  <tr key={a.id} className="cursor-pointer" onClick={() => setSelectedAsset(a)}>
                    <td style={{ fontWeight: 600 }}>{a.assetTag}</td>
                    <td>
                      <div>{a.name}</div>
                      {lifecycle.isEol && (
                        <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "3px", background: "rgba(220, 53, 69, 0.15)", color: "#e63946", fontWeight: 600, display: "inline-block", marginTop: "2px" }}>
                          ⚠️ EOL
                        </span>
                      )}
                      {lifecycle.isNearingEol && (
                        <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "3px", background: "rgba(247, 127, 0, 0.15)", color: "#f77f00", fontWeight: 600, display: "inline-block", marginTop: "2px" }}>
                          ⚠️ Nearing EOL
                        </span>
                      )}
                    </td>
                    <td className="muted">{CATEGORIES[a.category] || a.category}</td>
                    <td className="muted">{a.serialNumber || "—"}</td>
                    <td>{a.value ? `$${parseFloat(a.value).toLocaleString()}` : "—"}</td>
                    <td className="muted">{a.assignedTo?.name || "Available in Stock"}</td>
                    <td>
                      <span className={`badge badge-${a.status === "available" ? "active" : a.status === "assigned" ? "submitted" : a.status === "repair" ? "draft" : "expired"}`}>
                        {ASSET_STATUSES[a.status] || a.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="7" style={{ textAlign: "center", padding: 24 }} className="muted">
                    No physical/IT assets found in inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Cards Row */}
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Expired / EOL Assets</div>
                <div className="kpi-value">{plannerKpis.eolCount}</div>
                <div className="kpi-subtitle">Requires immediate replacement</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Nearing EOL (&lt; 6 Mos)</div>
                <div className="kpi-value">{plannerKpis.criticalCount}</div>
                <div className="kpi-subtitle">Needs replacement cycles soon</div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">Total Replacement Value</div>
                <div className="kpi-value">${plannerKpis.replacementCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="kpi-subtitle">Estimated cycle budget</div>
              </div>
            </div>

            {/* Planner Sub-Bar */}
            <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>Lifecycle Filter:</span>
                <select
                  className="form-select"
                  value={lifeLeftFilter}
                  onChange={(e) => { setLifeLeftFilter(e.target.value); setSelectedDayKey(null); }}
                  style={{ width: 220 }}
                >
                  <option value="all">All Remaining Lifespans</option>
                  <option value="expired">Expired / EOL (Overdue)</option>
                  <option value="6_months">Critical (&lt; 6 Mos remaining)</option>
                  <option value="12_months">Plan Needed (&lt; 1 Year remaining)</option>
                  <option value="24_months">Nearing Cycle (&lt; 2 Years remaining)</option>
                </select>
              </div>
            </div>

            {/* Split Calendar & Replacement List */}
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Calendar Grid */}
              <div className="card" style={{ flex: "1 1 55%", padding: 16 }}>
                {/* Calendar Header with Navigation */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                    {new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h3>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      if (currentMonth === 0) {
                        setCurrentMonth(11);
                        setCurrentYear(currentYear - 1);
                      } else {
                        setCurrentMonth(currentMonth - 1);
                      }
                    }}>◀</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      setCurrentMonth(new Date().getMonth());
                      setCurrentYear(new Date().getFullYear());
                    }}>Today</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                      setSelectedDayKey(null);
                      if (currentMonth === 11) {
                        setCurrentMonth(0);
                        setCurrentYear(currentYear + 1);
                      } else {
                        setCurrentMonth(currentMonth + 1);
                      }
                    }}>▶</button>
                  </div>
                </div>

                {/* Calendar Grid cells */}
                <div style={calendarGridStyle}>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                    <div key={day} style={headerCellStyle}>{day}</div>
                  ))}
                  {(() => {
                    const daysInMonth = getDaysInMonth(currentMonth, currentYear);
                    const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
                    const prevMonthDays = currentMonth === 0 ? getDaysInMonth(11, currentYear - 1) : getDaysInMonth(currentMonth - 1, currentYear);
                    const calendarCells = [];

                    for (let i = firstDay - 1; i >= 0; i--) {
                      const y = currentMonth === 0 ? currentYear - 1 : currentYear;
                      const m = currentMonth === 0 ? 11 : currentMonth - 1;
                      const d = prevMonthDays - i;
                      calendarCells.push({ day: d, month: m, year: y, isCurrentMonth: false });
                    }
                    for (let i = 1; i <= daysInMonth; i++) {
                      calendarCells.push({ day: i, month: currentMonth, year: currentYear, isCurrentMonth: true });
                    }
                    const remainingCells = 42 - calendarCells.length;
                    for (let i = 1; i <= remainingCells; i++) {
                      const y = currentMonth === 11 ? currentYear + 1 : currentYear;
                      const m = currentMonth === 11 ? 0 : currentMonth + 1;
                      calendarCells.push({ day: i, month: m, year: y, isCurrentMonth: false });
                    }

                    return calendarCells.map((cell, idx) => {
                      const dateKey = formatDateKey(cell.year, cell.month, cell.day);
                      const dateData = assetsByDate[dateKey] || { eol: [], disposal: [] };
                      const isSelected = selectedDayKey === dateKey;
                      const isToday = new Date().getDate() === cell.day && new Date().getMonth() === cell.month && new Date().getFullYear() === cell.year;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDayKey(isSelected ? null : dateKey)}
                          style={getDayCellStyle(cell.isCurrentMonth, isSelected, isToday)}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ 
                              fontWeight: isToday ? 700 : 500, 
                              fontSize: 11, 
                              color: isToday ? "var(--blue)" : "var(--text-secondary)" 
                            }}>{cell.day}</span>
                            {isToday && <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--blue)" }} />}
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 4, overflow: "hidden" }}>
                            {dateData.eol.map(a => (
                              <div key={a.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--red-dim)", 
                                color: "var(--red)", 
                                border: "1px solid rgba(239, 71, 111, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden" 
                              }} title={`${a.assetTag}: ${a.name} EOL`}>
                                ⚠️ {a.assetTag}
                              </div>
                            ))}
                            {dateData.disposal.map(a => (
                              <div key={a.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--purple-dim)", 
                                color: "var(--purple)", 
                                border: "1px solid rgba(123, 104, 238, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden" 
                              }} title={`${a.assetTag}: Scheduled Disposal`}>
                                📤 {a.assetTag}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Replacements Detail Pane */}
              <div className="card" style={{ flex: "1 1 45%", padding: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 12 }}>
                  {selectedDayKey ? `Timeline for ${new Date(selectedDayKey + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : `Monthly Summary: ${new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
                </h3>

                <div style={{ maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {(() => {
                    const list = selectedDayKey 
                      ? [
                          ...(assetsByDate[selectedDayKey]?.eol.map(a => ({ asset: a, type: "eol" })) || []),
                          ...(assetsByDate[selectedDayKey]?.disposal.map(a => ({ asset: a, type: "disposal" })) || [])
                        ]
                      : selectedMonthAssets.map(a => {
                          const eolDate = getAssetUsefulLifeEndDate(a);
                          const isEol = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
                          return { asset: a, type: isEol ? "eol" : "disposal" };
                        });

                    if (list.length === 0) {
                      return (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                          No replacements or disposals mapped for this period.
                        </div>
                      );
                    }

                    return list.map(({ asset, type }) => {
                      const end = getAssetUsefulLifeEndDate(asset);
                      const rem = getAssetRemainingMonths(asset);
                      return (
                        <div 
                          key={asset.id} 
                          className="cursor-pointer"
                          onClick={() => setSelectedAsset(asset)}
                          style={{ 
                            padding: 12, 
                            borderRadius: 6, 
                            border: "1px solid var(--border)", 
                            background: "var(--surface-3)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center"
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontWeight: 600 }}>{asset.assetTag}</span>
                              <span style={{ 
                                fontSize: 10, 
                                padding: "1px 5px", 
                                borderRadius: 3, 
                                fontWeight: 600,
                                background: type === "eol" ? "var(--red-dim)" : "var(--purple-dim)",
                                color: type === "eol" ? "var(--red)" : "var(--purple)"
                              }}>
                                {type === "eol" ? "EOL Expiry" : "Disposal"}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>{asset.name}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                              {type === "eol" 
                                ? `Useful Life End: ${end?.toLocaleDateString()}` 
                                : `Disposal Date: ${asset.disposalDate ? new Date(asset.disposalDate).toLocaleDateString() : "—"}`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 600 }}>{asset.value ? `$${parseFloat(asset.value).toLocaleString()}` : "—"}</div>
                            <div style={{ fontSize: 11, color: rem <= 0 ? "var(--red)" : "var(--text-secondary)" }}>
                              {rem <= 0 ? "Expired" : `${Math.ceil(rem)} mos left`}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Selected Asset Profile Drawer */}
        {selectedAsset && (() => {
          const lifecycle = getAssetStatusDetails(selectedAsset);
          return (
            <div className="card" style={{ width: 340, flexShrink: 0 }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Asset Profile</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setSelectedAsset(null)}>✕</button>
              </div>
              <div className="card-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
                <form onSubmit={handleUpdateAsset}>
                  <div className="form-group">
                    <label className="form-label">Asset Tag / ID</label>
                    <input name="assetTag" className="form-input" required defaultValue={selectedAsset.assetTag} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Asset Name</label>
                    <input name="name" className="form-input" required defaultValue={selectedAsset.name} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <select name="category" className="form-select" defaultValue={selectedAsset.category}>
                        {Object.entries(CATEGORIES).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valuation ($)</label>
                      <input name="value" type="number" step="0.01" className="form-input" defaultValue={selectedAsset.value || ""} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Serial Number</label>
                    <input name="serialNumber" className="form-input" defaultValue={selectedAsset.serialNumber || ""} />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Employee Checkout</label>
                      <select name="assignedToId" className="form-select" defaultValue={selectedAsset.assignedToId || ""}>
                        <option value="">Available (In Stock)</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select name="status" className="form-select" defaultValue={selectedAsset.status}>
                        <option value="available">Available</option>
                        <option value="assigned">Assigned</option>
                        <option value="repair">In Repair</option>
                        <option value="retired">Retired</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input name="purchaseDate" type="date" className="form-input" defaultValue={selectedAsset.purchaseDate ? selectedAsset.purchaseDate.split('T')[0] : ""} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea name="notes" className="form-input" rows="2" defaultValue={selectedAsset.notes || ""} style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                  </div>

                  {/* Lifecycle & Valuation Fields */}
                  <div style={{ margin: "16px 0 8px 0", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                    <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>Lifecycle & Valuation</h4>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Useful Life (Mos)</label>
                      <input name="usefulLifeMonths" type="number" className="form-input" defaultValue={selectedAsset.usefulLifeMonths ?? 36} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Disposal Method</label>
                      <select name="disposalMethod" className="form-select" defaultValue={selectedAsset.disposalMethod || ""}>
                        <option value="">None</option>
                        <option value="sold">Sold</option>
                        <option value="scrapped">Scrapped</option>
                        <option value="donated">Donated</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Disposal Date</label>
                      <input name="disposalDate" type="date" className="form-input" defaultValue={selectedAsset.disposalDate ? selectedAsset.disposalDate.split('T')[0] : ""} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sale / Salvage ($)</label>
                      <input name="salePrice" type="number" step="0.01" className="form-input" placeholder="0.00" defaultValue={selectedAsset.salePrice || ""} />
                    </div>
                  </div>

                  {selectedAsset.value && (
                    <div style={{ background: "var(--surface-overlay)", padding: "10px", borderRadius: "6px", border: "1px solid var(--border)", marginTop: 12, fontSize: "11px", lineHeight: "1.4" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Book Value:</span>
                        <span style={{ fontWeight: 600 }}>${parseFloat(lifecycle.bookValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Accum. Depr.:</span>
                        <span>${parseFloat(lifecycle.accumulatedDepreciation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Monthly Depr.:</span>
                        <span>${parseFloat(lifecycle.monthlyDepreciation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                        <span className="muted">Age:</span>
                        <span>{lifecycle.monthsAge} months</span>
                      </div>
                      {lifecycle.isEol && (
                        <div style={{ color: "#e63946", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          ⚠️ Exceeded Useful Lifecycle Boundaries.
                        </div>
                      )}
                      {lifecycle.isNearingEol && (
                        <div style={{ color: "#f77f00", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
                          ⚠️ Nearing useful lifecycle boundaries.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2" style={{ marginTop: 20 }}>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save Changes</button>
                    <button type="button" className="btn btn-danger btn-sm" style={{ background: "var(--red)", borderColor: "var(--red)", color: "white" }} onClick={() => handleDeleteAsset(selectedAsset.id)} disabled={saving}>Delete</button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Add Asset Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Register IT &amp; Physical Asset</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="card-body">
              {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={handleRegisterAsset}>
                <div className="form-group">
                  <label className="form-label">Jurisdiction Owner</label>
                  <select name="jurisdictionId" className="form-select" required>
                    <option value="">Select jurisdiction...</option>
                    {jurisdictions.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Tag (Barcode)</label>
                  <input name="assetTag" className="form-input" required placeholder="e.g. AST-NY-2026-904" />
                </div>
                <div className="form-group">
                  <label className="form-label">Asset Name</label>
                  <input name="name" className="form-input" required placeholder="e.g. MacBook Pro 16-inch M3 Max" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select name="category" className="form-select" required>
                      <option value="">Select category...</option>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Purchase Value ($)</label>
                    <input name="value" type="number" step="0.01" className="form-input" placeholder="e.g. 3499.00" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Serial Number</label>
                  <input name="serialNumber" className="form-input" placeholder="e.g. C02F52XSMD6M" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Initial Checkout Assignment</label>
                    <select name="assignedToId" className="form-select">
                      <option value="">Available (In Stock)</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-select" defaultValue="available">
                      <option value="available">Available</option>
                      <option value="assigned">Assigned</option>
                      <option value="repair">In Repair</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Date</label>
                    <input name="purchaseDate" type="date" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Life (Mos)</label>
                    <input name="usefulLifeMonths" type="number" className="form-input" defaultValue="36" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea name="notes" className="form-input" rows="2" style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                </div>

                <div className="flex gap-2" style={{ marginTop: 24 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Registering..." : "Register Asset"}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
