"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Calendar, FileText, Download, Upload, AlertTriangle, Wrench, X, BookOpen, Trash2, RefreshCw, Gauge } from "lucide-react";
import HelpDrawer from "../components/HelpDrawer";
import QRCode from "qrcode";

const VEHICLE_STATUSES = {
  active: "Active",
  maintenance: "In Maintenance",
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

function getVehicleStatusDetails(v) {
  const currentYear = new Date().getFullYear();
  const yearsAge = Math.max(0, currentYear - v.year);
  const usefulMonths = v.usefulLifeMonths || 120;
  const usefulMiles = v.usefulLifeMiles || 100000;
  
  const isAgeEol = yearsAge >= (usefulMonths / 12);
  const isMilesEol = v.mileage >= usefulMiles;
  const isEol = isAgeEol || isMilesEol;
  const isNearingEol = !isEol && (v.mileage >= usefulMiles * 0.9 || yearsAge >= (usefulMonths / 12) - 1);

  const purchaseValue = v.value ? parseFloat(v.value) : 0;
  const salvageValue = v.salePrice ? parseFloat(v.salePrice) : purchaseValue * 0.1;
  const depreciableAmount = Math.max(0, purchaseValue - salvageValue);
  
  const monthsAge = Math.max(0, yearsAge * 12);
  const monthlyDepreciation = usefulMonths > 0 ? (depreciableAmount / usefulMonths) : 0;
  const accumulatedDepreciation = Math.min(purchaseValue, monthlyDepreciation * monthsAge);
  const bookValue = Math.max(salvageValue, purchaseValue - accumulatedDepreciation);

  return {
    isEol,
    isNearingEol,
    isAgeEol,
    isMilesEol,
    yearsAge,
    bookValue,
    accumulatedDepreciation,
    monthlyDepreciation
  };
}

export default function FleetClient({ initialVehicles, jurisdictions, users }) {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  
  // Modals & drawers
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Compliance Alerts & Logs States
  const [complianceAlerts, setComplianceAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [copiedAlertId, setCopiedAlertId] = useState(null);
  const [vehicleLogs, setVehicleLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [drawerTab, setDrawerTab] = useState("details"); // 'details' or 'inspections'

  // Fetch Compliance Alerts
  const fetchComplianceAlerts = async () => {
    setLoadingAlerts(true);
    try {
      const res = await fetch("/api/fleet/compliance");
      if (res.ok) {
        const data = await res.json();
        setComplianceAlerts(data);
      }
    } catch (err) {
      console.error("Failed to fetch compliance alerts", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    fetchComplianceAlerts();
  }, [vehicles]);

  // Fetch log history and generate QR Code on vehicle select
  useEffect(() => {
    if (selectedVehicle) {
      setDrawerTab("details");
      setLoadingLogs(true);
      fetch(`/api/fleet/${selectedVehicle.id}/logs`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error();
        })
        .then(data => setVehicleLogs(data))
        .catch(() => setVehicleLogs([]))
        .finally(() => setLoadingLogs(false));

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const checkinUrl = `${origin}/fleet/${selectedVehicle.id}/checkin`;
      QRCode.toDataURL(checkinUrl, { width: 200, margin: 2 })
        .then(url => setQrCodeUrl(url))
        .catch(err => console.error(err));
    } else {
      setVehicleLogs([]);
      setQrCodeUrl("");
    }
  }, [selectedVehicle]);

  // Tab & Replacement Planner States
  const [activeView, setActiveView] = useState("inventory");
  const [lifeLeftFilter, setLifeLeftFilter] = useState("all");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDayKey, setSelectedDayKey] = useState(null);

  // EOL & Useful Life Helpers
  const cleanYmd = (dateStrOrDate) => {
    if (!dateStrOrDate) return null;
    if (dateStrOrDate instanceof Date) {
      const year = dateStrOrDate.getFullYear();
      const month = String(dateStrOrDate.getMonth() + 1).padStart(2, '0');
      const day = String(dateStrOrDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return dateStrOrDate.split("T")[0];
  };

  const getVehicleUsefulLifeEndDate = (v) => {
    const baselineDate = new Date(v.year, 0, 1);
    const date = new Date(baselineDate);
    const usefulMonths = v.usefulLifeMonths || 120;
    date.setMonth(date.getMonth() + usefulMonths);
    return date;
  };

  const getVehicleRemainingMonths = (v) => {
    const endDate = getVehicleUsefulLifeEndDate(v);
    const diffTime = endDate - new Date();
    const remainingMonths = diffTime / (1000 * 60 * 60 * 24 * 30.4375);
    return remainingMonths;
  };

  const getVehicleNextServiceDate = (v) => {
    if (!v.lastService) return null;
    const date = new Date(v.lastService);
    date.setMonth(date.getMonth() + 6); // standard 6-month preventative service
    return date;
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

  const filtered = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !v.make.toLowerCase().includes(q) &&
          !v.model.toLowerCase().includes(q) &&
          !v.licensePlate.toLowerCase().includes(q) &&
          !v.vin.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [vehicles, search, statusFilter]);

  const plannerVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const remainingMonths = getVehicleRemainingMonths(v);
      if (lifeLeftFilter === "expired") {
        return remainingMonths <= 0 || v.mileage >= (v.usefulLifeMiles || 100000);
      }
      if (lifeLeftFilter === "6_months") {
        return (remainingMonths > 0 && remainingMonths <= 6) || (v.mileage >= (v.usefulLifeMiles || 100000) * 0.9 && v.mileage < (v.usefulLifeMiles || 100000));
      }
      if (lifeLeftFilter === "12_months") {
        return remainingMonths > 0 && remainingMonths <= 12;
      }
      if (lifeLeftFilter === "24_months") {
        return remainingMonths > 0 && remainingMonths <= 24;
      }
      return true;
    });
  }, [vehicles, lifeLeftFilter]);

  const vehiclesByDate = useMemo(() => {
    const map = {};
    plannerVehicles.forEach((v) => {
      const eolDate = getVehicleUsefulLifeEndDate(v);
      if (eolDate) {
        const eolKey = cleanYmd(eolDate);
        if (!map[eolKey]) map[eolKey] = { eol: [], disposal: [], service: [] };
        map[eolKey].eol.push(v);
      }
      if (v.disposalDate) {
        const dispKey = cleanYmd(v.disposalDate);
        if (!map[dispKey]) map[dispKey] = { eol: [], disposal: [], service: [] };
        map[dispKey].disposal.push(v);
      }
      const serviceDate = getVehicleNextServiceDate(v);
      if (serviceDate) {
        const srvKey = cleanYmd(serviceDate);
        if (!map[srvKey]) map[srvKey] = { eol: [], disposal: [], service: [] };
        map[srvKey].service.push(v);
      }
    });
    return map;
  }, [plannerVehicles]);

  const selectedMonthVehicles = useMemo(() => {
    return plannerVehicles.filter((v) => {
      const eolDate = getVehicleUsefulLifeEndDate(v);
      const isEolInMonth = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
      
      const isDispInMonth = v.disposalDate && 
        new Date(v.disposalDate).getMonth() === currentMonth && 
        new Date(v.disposalDate).getFullYear() === currentYear;
        
      const serviceDate = getVehicleNextServiceDate(v);
      const isSrvInMonth = serviceDate && 
        serviceDate.getMonth() === currentMonth && 
        serviceDate.getFullYear() === currentYear;

      return isEolInMonth || isDispInMonth || isSrvInMonth;
    });
  }, [plannerVehicles, currentMonth, currentYear]);

  const plannerKpis = useMemo(() => {
    let eolCount = 0;
    let criticalCount = 0;
    let replacementCost = 0;

    vehicles.forEach((v) => {
      const rem = getVehicleRemainingMonths(v);
      const isMilesEol = v.mileage >= (v.usefulLifeMiles || 100000);
      const isMilesCritical = v.mileage >= (v.usefulLifeMiles || 100000) * 0.9 && v.mileage < (v.usefulLifeMiles || 100000);
      
      if (rem <= 0 || isMilesEol) {
        eolCount++;
        replacementCost += v.value ? parseFloat(v.value) : 0;
      } else if (rem <= 6 || isMilesCritical) {
        criticalCount++;
        replacementCost += v.value ? parseFloat(v.value) : 0;
      }
    });

    return { eolCount, criticalCount, replacementCost };
  }, [vehicles]);

  const handleRegisterVehicle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      make: form.get("make"),
      model: form.get("model"),
      year: parseInt(form.get("year")),
      vin: form.get("vin"),
      licensePlate: form.get("licensePlate"),
      mileage: parseInt(form.get("mileage")) || 0,
      status: form.get("status") || "active",
      jurisdictionId: form.get("jurisdictionId"),
      assignedToId: form.get("assignedToId") || null,
      notes: form.get("notes") || null,
      lastService: form.get("lastService") || null,
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 120,
      usefulLifeMiles: form.get("usefulLifeMiles") ? parseInt(form.get("usefulLifeMiles")) : 100000,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register vehicle");
      }

      const newVehicle = await res.json();
      setVehicles([newVehicle, ...vehicles]);
      setShowAddModal(false);
      e.target.reset();
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVehicle = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      make: form.get("make"),
      model: form.get("model"),
      year: parseInt(form.get("year")),
      vin: form.get("vin"),
      licensePlate: form.get("licensePlate"),
      mileage: parseInt(form.get("mileage")),
      status: form.get("status"),
      assignedToId: form.get("assignedToId") || null,
      notes: form.get("notes") || null,
      lastService: form.get("lastService") || null,
      value: form.get("value") ? parseFloat(form.get("value")) : null,
      usefulLifeMonths: form.get("usefulLifeMonths") ? parseInt(form.get("usefulLifeMonths")) : 120,
      usefulLifeMiles: form.get("usefulLifeMiles") ? parseInt(form.get("usefulLifeMiles")) : 100000,
      disposalDate: form.get("disposalDate") || null,
      disposalMethod: form.get("disposalMethod") || null,
      salePrice: form.get("salePrice") ? parseFloat(form.get("salePrice")) : null,
    };

    try {
      const res = await fetch(`/api/fleet/${selectedVehicle.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update vehicle");
      }

      const updated = await res.json();
      setVehicles(vehicles.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
      setSelectedVehicle(null);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!confirm("Are you sure you want to remove this vehicle from the database?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fleet/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete vehicle");
      }
      setVehicles(vehicles.filter((v) => v.id !== id));
      setSelectedVehicle(null);
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = () => {
    window.open("/api/fleet/export", "_blank");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "License Plate",
      "Make",
      "Model",
      "Year",
      "VIN",
      "Mileage",
      "Status",
      "Last Service",
      "Assigned Driver Email",
      "Jurisdiction",
      "Notes",
      "Disposal Date",
      "Disposal Method",
      "Sale Price",
      "Useful Life Months",
      "Useful Life Miles",
      "Value",
    ];
    const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "fleet-import-template.csv");
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

        const res = await fetch("/api/fleet/import", {
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
          throw new Error(data.error || "Failed to import fleet");
        }

        const result = await res.json();
        alert(`Import completed! Created: ${result.createdCount}, Updated: ${result.updatedCount}`);
        
        // Fetch new vehicles list
        const refreshRes = await fetch("/api/fleet");
        if (refreshRes.ok) {
          const updatedList = await refreshRes.json();
          setVehicles(updatedList);
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

  return (
    <>
      {/* View Switcher Tabs */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <div className="tab-nav" style={{ marginBottom: 0, borderBottom: "none" }}>
          <button 
            type="button"
            className={`tab-btn ${activeView === "inventory" ? "active" : ""}`}
            onClick={() => { setActiveView("inventory"); setSelectedDayKey(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <ClipboardList size={16} /> Active Fleet
          </button>
          <button 
            type="button"
            className={`tab-btn ${activeView === "planner" ? "active" : ""}`}
            onClick={() => { setActiveView("planner"); setSelectedDayKey(null); }}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Calendar size={16} /> Replacement &amp; Service Planner
          </button>
        </div>

        <button
          onClick={() => setIsHelpOpen(true)}
          className="btn btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)" }}
        >
          <BookOpen size={16} /> Help & Guide
        </button>
      </div>

      {activeView === "inventory" && (
        <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10, flex: 1 }}>
            <input
              className="search-input"
              type="text"
              placeholder="Search by Plate, Make, Model, VIN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: 180 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              {Object.entries(VEHICLE_STATUSES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginLeft: 16, alignItems: "center" }}>
            <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV Import Template" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <FileText size={14} /> Template
            </button>
            <button className="btn btn-secondary" onClick={handleExportCsv} title="Export Fleet to CSV" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <Download size={14} /> Export CSV
            </button>
            <label className="btn btn-secondary" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }} title="Import Fleet from CSV">
              {uploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Import CSV
                </>
              )}
              <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: "none" }} disabled={uploading} />
            </label>

            <button className="btn className=btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Register Vehicle
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        {activeView === "inventory" ? (
          <>
            <div style={{ flex: 1 }} className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>License Plate</th>
                    <th>Vehicle Details</th>
                    <th>Jurisdiction</th>
                    <th>Mileage</th>
                    <th>Assigned Driver</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((v) => {
                    const lifecycle = getVehicleStatusDetails(v);
                    return (
                      <tr 
                        key={v.id} 
                        className="cursor-pointer" 
                        onClick={() => setSelectedVehicle(v)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedVehicle(v); } }}
                      >
                        <td style={{ fontWeight: 600 }}>{v.licensePlate}</td>
                        <td>
                          <div>{v.year} {v.make} {v.model}</div>
                          {lifecycle.isEol && (
                            <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "3px", background: "rgba(220, 53, 69, 0.15)", color: "#e63946", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                              <AlertTriangle size={10} /> EOL
                            </span>
                          )}
                          {lifecycle.isNearingEol && (
                            <span style={{ fontSize: "10px", padding: "1px 5px", borderRadius: "3px", background: "rgba(247, 127, 0, 0.15)", color: "#f77f00", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                              <AlertTriangle size={10} /> Nearing EOL
                            </span>
                          )}
                        </td>
                        <td className="muted">{v.jurisdiction?.abbreviation || "Global"}</td>
                        <td>{v.mileage.toLocaleString()} mi</td>
                        <td className="muted">{v.assignedTo?.name || "Unassigned"}</td>
                        <td>
                          <span className={`badge badge-${v.status === "active" ? "active" : v.status === "maintenance" ? "submitted" : "expired"}`}>
                            {VEHICLE_STATUSES[v.status] || v.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: 24 }} className="muted">
                        No vehicles found matching search parameters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Compliance Alerts Panel (appears on right when no vehicle is selected) */}
            {!selectedVehicle && (
              <div className="card" style={{ width: 300, flexShrink: 0, alignSelf: "stretch", display: "flex", flexDirection: "column" }}>
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px", margin: 0, color: "var(--gold)" }}>
                    <AlertTriangle size={16} /> Compliance Alerts
                  </h3>
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    onClick={fetchComplianceAlerts} 
                    disabled={loadingAlerts}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                  >
                    <RefreshCw size={12} className={loadingAlerts ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="card-body" style={{ padding: "16px", overflowY: "auto", maxHeight: "70vh", display: "flex", flexDirection: "column", gap: "12px", flex: 1 }}>
                  {complianceAlerts.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)", fontSize: "13px" }}>
                      ✅ All active vehicles compliant.
                    </div>
                  ) : (
                    complianceAlerts.map((alert) => (
                      <div 
                        key={alert.id} 
                        style={{ 
                          border: "1px solid var(--border)", 
                          borderRadius: "8px", 
                          padding: "12px", 
                          background: "var(--surface-2)", 
                          display: "flex", 
                          flexDirection: "column", 
                          gap: "6px",
                          boxShadow: "var(--shadow-sm)"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "600", alignItems: "center" }}>
                          <span style={{ color: "var(--text)" }}>{alert.licensePlate}</span>
                          <span style={{ 
                            fontSize: "11px", 
                            fontWeight: "700", 
                            color: "var(--red)", 
                            background: "rgba(220, 53, 69, 0.1)", 
                            padding: "2px 6px", 
                            borderRadius: "4px" 
                          }}>
                            {alert.lapseHours}h dormant
                          </span>
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                          {alert.make} {alert.model}
                        </div>
                        <div style={{ fontSize: "11px", marginTop: "4px", color: "var(--text)" }}>
                          <strong>Driver:</strong> {alert.assignedTo?.name || "Unassigned"}
                        </div>
                        {alert.assignedTo?.manager && (
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                            <strong>Manager:</strong> {alert.assignedTo.manager.name}
                          </div>
                        )}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ marginTop: "8px", fontSize: "11px", width: "100%", padding: "6px" }}
                          onClick={() => {
                            const managerName = alert.assignedTo?.manager?.name || "N/A";
                            const txt = `🚨 STOCHOS COMPLIANCE ALERT 🚨\nVehicle ${alert.licensePlate} (${alert.make} ${alert.model}) assigned to ${alert.assignedTo?.name || "Unassigned"} has not completed a compliance check-in log for ${alert.lapseHours} hours.\nManager/Supervisor (${managerName}) has been notified for escalation.`;
                            navigator.clipboard.writeText(txt);
                            setCopiedAlertId(alert.id);
                            setTimeout(() => setCopiedAlertId(null), 2000);
                          }}
                        >
                          {copiedAlertId === alert.id ? "Copied!" : "Copy Escalation Text"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* KPI Cards Row */}
            <div className="kpi-grid" style={{ marginBottom: 0 }}>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Expired / EOL Vehicles</div>
                <div className="kpi-value">{plannerKpis.eolCount}</div>
                <div className="kpi-subtitle">Requires immediate replacement</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Nearing EOL / Critical</div>
                <div className="kpi-value">{plannerKpis.criticalCount}</div>
                <div className="kpi-subtitle">Mileage or age limit &lt; 10% / 6 mos</div>
              </div>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">Total Replacement Value</div>
                <div className="kpi-value">${plannerKpis.replacementCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                <div className="kpi-subtitle">Estimated fleet renewal budget</div>
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
                  <option value="6_months">Critical (&lt; 6 Mos / 90% Mi)</option>
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
                      const dateData = vehiclesByDate[dateKey] || { eol: [], disposal: [], service: [] };
                      const isSelected = selectedDayKey === dateKey;
                      const isToday = new Date().getDate() === cell.day && new Date().getMonth() === cell.month && new Date().getFullYear() === cell.year;

                      return (
                        <div
                          key={idx}
                          onClick={() => setSelectedDayKey(isSelected ? null : dateKey)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedDayKey(isSelected ? null : dateKey); } }}
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
                            {dateData.eol.map(v => (
                              <div key={v.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--red-dim)", 
                                color: "var(--red)", 
                                border: "1px solid rgba(239, 71, 111, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px"
                              }} title={`${v.licensePlate}: EOL Expiry`}>
                                <AlertTriangle size={10} /> {v.licensePlate}
                              </div>
                            ))}
                            {dateData.disposal.map(v => (
                              <div key={v.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--purple-dim)", 
                                color: "var(--purple)", 
                                border: "1px solid rgba(123, 104, 238, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px"
                              }} title={`${v.licensePlate}: Scheduled Disposal`}>
                                <Upload size={10} /> {v.licensePlate}
                              </div>
                            ))}
                            {dateData.service.map(v => (
                              <div key={v.id} style={{ 
                                fontSize: 9, 
                                padding: "1px 3px", 
                                borderRadius: 3, 
                                background: "var(--blue-dim)", 
                                color: "var(--blue)", 
                                border: "1px solid rgba(0, 119, 182, 0.2)",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                display: "flex",
                                alignItems: "center",
                                gap: "3px"
                              }} title={`${v.licensePlate}: Service Due`}>
                                <Wrench size={10} /> {v.licensePlate}
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
                          ...(vehiclesByDate[selectedDayKey]?.eol.map(v => ({ vehicle: v, type: "eol" })) || []),
                          ...(vehiclesByDate[selectedDayKey]?.disposal.map(v => ({ vehicle: v, type: "disposal" })) || []),
                          ...(vehiclesByDate[selectedDayKey]?.service.map(v => ({ vehicle: v, type: "service" })) || [])
                        ]
                      : selectedMonthVehicles.map(v => {
                          const eolDate = getVehicleUsefulLifeEndDate(v);
                          const isEol = eolDate && eolDate.getMonth() === currentMonth && eolDate.getFullYear() === currentYear;
                          
                          const dispDate = v.disposalDate ? new Date(v.disposalDate) : null;
                          const isDisp = dispDate && dispDate.getMonth() === currentMonth && dispDate.getFullYear() === currentYear;
                          
                          const serviceDate = getVehicleNextServiceDate(v);
                          const isSrv = serviceDate && serviceDate.getMonth() === currentMonth && serviceDate.getFullYear() === currentYear;
                          
                          const items = [];
                          if (isEol) items.push({ vehicle: v, type: "eol" });
                          if (isDisp) items.push({ vehicle: v, type: "disposal" });
                          if (isSrv) items.push({ vehicle: v, type: "service" });
                          return items;
                        }).flat();

                    if (list.length === 0) {
                      return (
                        <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)" }}>
                          No replacements or service milestones mapped for this period.
                        </div>
                      );
                    }

                    return list.map(({ vehicle, type }, idx) => {
                      const lifecycle = getVehicleStatusDetails(vehicle);
                      return (
                        <div 
                          key={`${vehicle.id}-${type}-${idx}`} 
                          className="cursor-pointer"
                          onClick={() => setSelectedVehicle(vehicle)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedVehicle(vehicle); } }}
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
                              <span style={{ fontWeight: 600 }}>{vehicle.licensePlate}</span>
                              <span style={{ 
                                fontSize: 10, 
                                padding: "1px 5px", 
                                borderRadius: 3, 
                                fontWeight: 600,
                                background: type === "eol" ? "var(--red-dim)" : type === "disposal" ? "var(--purple-dim)" : "var(--blue-dim)",
                                color: type === "eol" ? "var(--red)" : type === "disposal" ? "var(--purple)" : "var(--blue)"
                              }}>
                                {type === "eol" ? "EOL Expiry" : type === "disposal" ? "Disposal" : "Service Due"}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, marginTop: 2 }}>{vehicle.year} {vehicle.make} {vehicle.model}</div>
                            <div style={{ fontSize: 11, marginTop: 2 }} className="muted">
                              {type === "eol" && `EOL Age Limit: ${vehicle.usefulLifeMonths || 120} mos (${lifecycle.yearsAge} yrs old)`}
                              {type === "disposal" && `Scheduled Disposal: ${vehicle.disposalDate ? vehicle.disposalDate.split('T')[0] : '—'}`}
                              {type === "service" && `Next Service: ${getVehicleNextServiceDate(vehicle) ? getVehicleNextServiceDate(vehicle).toISOString().split('T')[0] : '—'}`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>
                              {vehicle.value ? `$${parseFloat(vehicle.value).toLocaleString()}` : "—"}
                            </div>
                            <span style={{ fontSize: 11 }} className="muted">
                              {vehicle.mileage.toLocaleString()} mi
                            </span>
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

        {/* Selected Vehicle Drawer */}
        {selectedVehicle && (() => {
          const lifecycle = getVehicleStatusDetails(selectedVehicle);
          return (
            <div className="card" style={{ width: 340, flexShrink: 0 }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Vehicle Profile</h3>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {qrCodeUrl && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        const printWin = window.open("", "_blank");
                        printWin.document.write(`
                          <!DOCTYPE html>
                          <html>
                          <head>
                            <title>Print Vehicle QR Code - ${selectedVehicle.licensePlate}</title>
                            <style>
                              body {
                                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 95vh;
                                margin: 0;
                                background: white;
                              }
                              .card {
                                border: 2px dashed #999;
                                border-radius: 8px;
                                padding: 24px;
                                width: 3.5in;
                                height: 3.5in;
                                box-sizing: border-box;
                                display: flex;
                                flex-direction: column;
                                align-items: center;
                                justify-content: space-between;
                                text-align: center;
                              }
                              h1 { font-size: 15px; margin: 0 0 8px 0; color: #333; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; }
                              img { width: 150px; height: 150px; }
                              .plate { font-size: 18px; font-weight: 800; margin: 8px 0 2px 0; }
                              .meta { font-size: 12px; color: #666; }
                              @media print {
                                body { padding: 0; }
                                .card { border: none; }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="card">
                              <h1>Stochos Fleet Portal</h1>
                              <img src="${qrCodeUrl}" />
                              <div>
                                <div class="plate">PLATE: ${selectedVehicle.licensePlate}</div>
                                <div class="meta">${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}</div>
                              </div>
                            </div>
                            <script>
                              window.onload = function() {
                                setTimeout(function() {
                                  window.print();
                                  window.close();
                                }, 500);
                              };
                            </script>
                          </body>
                          </html>
                        `);
                        printWin.document.close();
                      }}
                      title="Print Dashboard QR Sticker"
                      style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", fontSize: "11px" }}
                    >
                      Print QR
                    </button>
                  )}
                  <button 
                    className="btn btn-secondary btn-sm" 
                    aria-label="Close" 
                    onClick={() => setSelectedVehicle(null)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                {/* Tab Pill Headers */}
                <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "16px" }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "none",
                      border: "none",
                      borderBottom: drawerTab === "details" ? "2px solid var(--gold)" : "none",
                      color: drawerTab === "details" ? "var(--text)" : "var(--text-secondary)",
                      fontWeight: drawerTab === "details" ? "600" : "400",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                    onClick={() => setDrawerTab("details")}
                  >
                    Edit Profile
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: "8px",
                      background: "none",
                      border: "none",
                      borderBottom: drawerTab === "inspections" ? "2px solid var(--gold)" : "none",
                      color: drawerTab === "inspections" ? "var(--text)" : "var(--text-secondary)",
                      fontWeight: drawerTab === "inspections" ? "600" : "400",
                      cursor: "pointer",
                      fontSize: "13px"
                    }}
                    onClick={() => setDrawerTab("inspections")}
                  >
                    Inspections ({vehicleLogs.length})
                  </button>
                </div>

                {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

                {drawerTab === "details" ? (
                  <form onSubmit={handleUpdateVehicle}>
                    <div className="form-group">
                      <label className="form-label">License Plate</label>
                      <input name="licensePlate" className="form-input" required defaultValue={selectedVehicle.licensePlate} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Make</label>
                        <input name="make" className="form-input" required defaultValue={selectedVehicle.make} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Model</label>
                        <input name="model" className="form-input" required defaultValue={selectedVehicle.model} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Year</label>
                        <input name="year" type="number" className="form-input" required defaultValue={selectedVehicle.year} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Mileage</label>
                        <input name="mileage" type="number" className="form-input" required defaultValue={selectedVehicle.mileage} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">VIN</label>
                      <input name="vin" className="form-input" required defaultValue={selectedVehicle.vin} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Driver Assignment</label>
                        <select name="assignedToId" className="form-select" defaultValue={selectedVehicle.assignedToId || ""}>
                          <option value="">Unassigned</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select name="status" className="form-select" defaultValue={selectedVehicle.status}>
                          <option value="active">Active</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="retired">Retired</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Last Service Date</label>
                      <input name="lastService" type="date" className="form-input" defaultValue={selectedVehicle.lastService ? selectedVehicle.lastService.split('T')[0] : ""} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <textarea name="notes" className="form-input" rows="2" defaultValue={selectedVehicle.notes || ""} style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                    </div>

                    {/* Lifecycle & Valuation Fields */}
                    <div style={{ margin: "16px 0 8px 0", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                      <h4 style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary)", marginBottom: 8 }}>Lifecycle & Valuation</h4>
                    </div>
                    
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Purchase Price ($)</label>
                        <input name="value" type="number" step="0.01" className="form-input" placeholder="0.00" defaultValue={selectedVehicle.value || ""} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Useful Life (Mos)</label>
                        <input name="usefulLifeMonths" type="number" className="form-input" defaultValue={selectedVehicle.usefulLifeMonths ?? 120} />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Useful Life (Mi)</label>
                        <input name="usefulLifeMiles" type="number" className="form-input" defaultValue={selectedVehicle.usefulLifeMiles ?? 100000} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Disposal Method</label>
                        <select name="disposalMethod" className="form-select" defaultValue={selectedVehicle.disposalMethod || ""}>
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
                        <input name="disposalDate" type="date" className="form-input" defaultValue={selectedVehicle.disposalDate ? selectedVehicle.disposalDate.split('T')[0] : ""} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Sale / Salvage ($)</label>
                        <input name="salePrice" type="number" step="0.01" className="form-input" placeholder="0.00" defaultValue={selectedVehicle.salePrice || ""} />
                      </div>
                    </div>

                    {selectedVehicle.value && (
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
                        {lifecycle.isEol && (
                          <div style={{ color: "#e63946", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={14} /> Exceeded Useful Lifecycle Boundaries.
                          </div>
                        )}
                        {lifecycle.isNearingEol && (
                          <div style={{ color: "#f77f00", fontWeight: 600, marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <AlertTriangle size={14} /> Nearing useful lifecycle boundaries.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2" style={{ marginTop: 20 }}>
                      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save Changes</button>
                      <button type="button" className="btn btn-danger btn-sm" style={{ background: "var(--red)", borderColor: "var(--red)", color: "white" }} onClick={() => handleDeleteVehicle(selectedVehicle.id)} disabled={saving}>Delete</button>
                    </div>
                  </form>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {loadingLogs ? (
                      <div style={{ textAlign: "center", padding: "20px", color: "var(--text-secondary)", fontSize: "13px" }}>
                        Loading inspection records...
                      </div>
                    ) : vehicleLogs.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-secondary)", fontSize: "13px" }}>
                        No inspection logs submitted yet. Scan QR code on dashboard to check in.
                      </div>
                    ) : (
                      vehicleLogs.map((log) => (
                        <div key={log.id} style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", background: "var(--surface-2)", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "600" }}>
                            <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                            <span style={{ color: "var(--gold)" }}>{log.odometer.toLocaleString()} mi</span>
                          </div>
                          <div style={{ color: "var(--text-secondary)" }}>
                            <strong>Driver:</strong> {log.driver?.name || "System"}
                          </div>
                          <div>
                            <strong>Type:</strong> {log.type === "start" ? "Start of Shift" : log.type === "end" ? "End of Shift" : "Reconciliation"}
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", fontSize: "11px", marginTop: "4px", borderTop: "1px solid var(--border)", paddingTop: "6px" }}>
                            <div>Walkaround: {log.checkWalkaround ? "✅" : "❌"}</div>
                            <div>Brakes: {log.checkBrakes ? "✅" : "❌"}</div>
                            <div>Tires: {log.checkTires ? "✅" : "❌"}</div>
                            <div>Lights: {log.checkLights ? "✅" : "❌"}</div>
                            <div>Fluids: {log.checkFluids ? "✅" : "❌"}</div>
                            <div style={{ gridColumn: "span 2", color: log.checkEngineLight ? "var(--red)" : "inherit", fontWeight: log.checkEngineLight ? "600" : "normal" }}>
                              Engine Light: {log.checkEngineLight ? "⚠️ ON / Active" : "✅ Clear"}
                            </div>
                          </div>
                          {log.notes && (
                            <div style={{ fontStyle: "italic", color: "var(--text-secondary)", borderTop: "1px dashed var(--border)", paddingTop: "4px", marginTop: "4px" }}>
                              "{log.notes}"
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
          <div className="card" style={{ width: 500, maxHeight: "90vh", overflowY: "auto" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>Register Fleet Vehicle</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                aria-label="Close" 
                onClick={() => setShowAddModal(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="card-body">
              {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
              <form onSubmit={handleRegisterVehicle}>
                <div className="form-group">
                  <label className="form-label">Jurisdiction</label>
                  <select name="jurisdictionId" className="form-select" required>
                    <option value="">Select jurisdiction...</option>
                    {jurisdictions.map((j) => (
                      <option key={j.id} value={j.id}>{j.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">License Plate</label>
                  <input name="licensePlate" className="form-input" required placeholder="e.g. GV-4482-NY" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Make</label>
                    <input name="make" className="form-input" required placeholder="e.g. Chevrolet" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Model</label>
                    <input name="model" className="form-input" required placeholder="e.g. Bolt EV" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Year</label>
                    <input name="year" type="number" className="form-input" required defaultValue={new Date().getFullYear()} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Starting Mileage</label>
                    <input name="mileage" type="number" className="form-input" defaultValue="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">VIN</label>
                  <input name="vin" className="form-input" required placeholder="17-character VIN identifier" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Driver Assignment</label>
                    <select name="assignedToId" className="form-select">
                      <option value="">Unassigned</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select name="status" className="form-select" defaultValue="active">
                      <option value="active">Active</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Last Service Date</label>
                  <input name="lastService" type="date" className="form-input" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Purchase Price ($)</label>
                    <input name="value" type="number" step="0.01" className="form-input" placeholder="0.00" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Life (Mos)</label>
                    <input name="usefulLifeMonths" type="number" className="form-input" defaultValue="120" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Useful Life (Mi)</label>
                    <input name="usefulLifeMiles" type="number" className="form-input" defaultValue="100000" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea name="notes" className="form-input" rows="2" style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
                </div>

                <div className="flex gap-2" style={{ marginTop: 24 }}>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Registering..." : "Register Vehicle"}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <HelpDrawer topicId="fleet" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
