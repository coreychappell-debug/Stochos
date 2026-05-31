"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const VENDOR_TYPES = {
  lead_agency: "Lead Agency",
  media_buyer: "Media Buyer",
  printer: "Printer",
  specialty: "Specialty",
  research: "Research",
};

const STATUS_LABELS = {
  active: "Active",
  inactive: "Inactive",
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

export default function VendorListClient({ initialVendors }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [uploading, setUploading] = useState(false);

  const filtered = useMemo(() => {
    return initialVendors.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (typeFilter !== "all" && v.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !v.name.toLowerCase().includes(q) &&
          !(v.contactName || "").toLowerCase().includes(q) &&
          !(v.contactEmail || "").toLowerCase().includes(q) &&
          !(v.classification || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [initialVendors, search, statusFilter, typeFilter]);

  const handleExportCsv = () => {
    window.open("/api/vendors/export", "_blank");
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Name",
      "Type",
      "Jurisdiction",
      "Status",
      "Tax ID",
      "Website",
      "Payment Terms",
      "Classification",
      "Contact Name",
      "Contact Email",
      "Contact Phone",
      "Address",
      "Notes"
    ];
    const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "vendors-import-template.csv");
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

        const res = await fetch("/api/vendors/import", {
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
          throw new Error(data.error || "Failed to import vendors");
        }

        const result = await res.json();
        alert(`Import completed! Created: ${result.createdCount}, Updated: ${result.updatedCount}`);
        router.refresh();
      } catch (err) {
        alert(err.message);
      } finally {
        setUploading(false);
        e.target.value = ""; // Reset file picker
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <div className="search-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <input
            className="search-input"
            type="text"
            placeholder="Search vendors by name, contact, classification..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            className="form-select"
            style={{ width: 160 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            {Object.entries(VENDOR_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        
        <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
          <button className="btn btn-secondary" onClick={handleDownloadTemplate} title="Download CSV Import Template">
            📄 Template
          </button>
          <button className="btn btn-secondary" onClick={handleExportCsv} title="Export Vendors to CSV">
            📤 Export CSV
          </button>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }} title="Import Vendors from CSV">
            {uploading ? "📥 Importing..." : "📥 Import CSV"}
            <input type="file" accept=".csv" onChange={handleImportCsv} style={{ display: "none" }} disabled={uploading} />
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏢</div>
          <h3>No vendors found</h3>
          <p>
            {initialVendors.length === 0
              ? "Register your first vendor to get started."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Type</th>
                <th>Classification</th>
                <th>Jurisdiction</th>
                <th>Status</th>
                <th>Contracts</th>
                <th>Terms</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr 
                  key={v.id} 
                  className="cursor-pointer"
                  onClick={() => router.push(`/vendors/${v.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); router.push(`/vendors/${v.id}`); } }}
                >
                  <td>
                    <span style={{ fontWeight: 600 }}>
                      {v.name}
                    </span>
                  </td>
                  <td className="muted">{VENDOR_TYPES[v.type] || v.type}</td>
                  <td>
                    {v.classification ? (
                      <span className="badge badge-submitted" style={{ textTransform: "uppercase" }}>
                        {v.classification}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="muted">{v.jurisdiction?.abbreviation || "Global"}</td>
                  <td>
                    <span className={`badge badge-${v.status}`}>
                      {STATUS_LABELS[v.status] || v.status}
                    </span>
                  </td>
                  <td className="muted">{v._count?.contracts || 0}</td>
                  <td className="muted">{v.paymentTerms || "—"}</td>
                  <td className="muted">
                    {v.contactName ? (
                      <div>
                        <div>{v.contactName}</div>
                        <div style={{ fontSize: 11, opacity: 0.7 }}>{v.contactEmail}</div>
                      </div>
                    ) : (
                      v.contactEmail || "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
