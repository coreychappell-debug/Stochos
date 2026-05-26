"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const VENDOR_TYPES = [
  { value: "lead_agency", label: "Lead Agency" },
  { value: "media_buyer", label: "Media Buyer" },
  { value: "printer", label: "Printer" },
  { value: "specialty", label: "Specialty" },
  { value: "research", label: "Research" },
];

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function EditVendorForm({ vendor, jurisdictions, auditLog }) {
  const router = useRouter();
  const [tab, setTab] = useState("details");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = new FormData(e.target);
    const body = {
      name: form.get("name"),
      type: form.get("type"),
      jurisdictionId: form.get("jurisdictionId") || null,
      taxId: form.get("taxId") || null,
      classification: form.get("classification") || null,
      website: form.get("website") || null,
      paymentTerms: form.get("paymentTerms") || null,
      contactName: form.get("contactName") || null,
      contactEmail: form.get("contactEmail") || null,
      contactPhone: form.get("contactPhone") || null,
      address: form.get("address") || null,
      notes: form.get("notes") || null,
      status: form.get("status") || "active",
    };

    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update vendor");
      }
      setMessage("Vendor profile updated successfully.");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const hasDependencies = (vendor.contracts?.length || 0) + (vendor.campaigns?.length || 0) > 0;
    
    if (hasDependencies) {
      alert("This vendor cannot be deleted because it is associated with contracts or campaigns. Please set status to 'Inactive' instead.");
      return;
    }

    if (!confirm("Are you sure you want to delete this vendor? This action is permanent.")) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete vendor");
      }
      router.push("/vendors");
      router.refresh();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const tabs = [
    { key: "details", label: "Vendor Details" },
    { key: "relations", label: `Contracts & Campaigns (${(vendor.contracts?.length || 0) + (vendor.campaigns?.length || 0)})` },
    { key: "audit", label: "Audit History" },
  ];

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Link href="/vendors" style={{ color: "var(--text-muted)", fontSize: 13 }}>← Vendors</Link>
      </div>

      <div className="tab-nav">
        {tabs.map((t) => (
          <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-body">
            {error && <div className="login-error" style={{ marginBottom: 20 }}>{error}</div>}
            {message && <div style={{ color: "var(--green)", marginBottom: 20, fontSize: 14 }}>{message}</div>}
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label className="form-label" htmlFor="evf-name">Vendor Name</label>
                  <input id="evf-name" name="name" className="form-input" required defaultValue={vendor.name} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label" htmlFor="evf-status">Status</label>
                  <select id="evf-status" name="status" className="form-select" defaultValue={vendor.status}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-type">Vendor Type</label>
                  <select id="evf-type" name="type" className="form-select" required defaultValue={vendor.type}>
                    {VENDOR_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-jurisdiction">Jurisdiction</label>
                  <select id="evf-jurisdiction" name="jurisdictionId" className="form-select" defaultValue={vendor.jurisdictionId || ""}>
                    <option value="">Global / Unrestricted</option>
                    {jurisdictions.map((j) => (
                      <option key={j.id} value={j.id}>{j.name} ({j.abbreviation})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-tax">Tax ID / EIN</label>
                  <input id="evf-tax" name="taxId" className="form-input" defaultValue={vendor.taxId || ""} placeholder="e.g., 12-3456789" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-classification">Business Classification</label>
                  <select id="evf-classification" name="classification" className="form-select" defaultValue={vendor.classification || ""}>
                    <option value="">None (Standard)</option>
                    <option value="mwbe">MWBE (Minority/Women-Owned)</option>
                    <option value="small_business">Small Business</option>
                    <option value="sdvob">SDVOB (Service-Disabled Veteran-Owned)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-website">Website URL</label>
                  <input id="evf-website" name="website" type="url" className="form-input" defaultValue={vendor.website || ""} placeholder="https://example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-terms">Payment Terms</label>
                  <select id="evf-terms" name="paymentTerms" className="form-select" defaultValue={vendor.paymentTerms || "Net 30"}>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 15">Net 15</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                    <option value="Due on Receipt">Due on Receipt</option>
                  </select>
                </div>
              </div>

              <h3 style={{ marginTop: 24, marginBottom: 16, fontSize: 16, borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>Contact Information</h3>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-cname">Contact Person</label>
                  <input id="evf-cname" name="contactName" className="form-input" defaultValue={vendor.contactName || ""} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-cemail">Contact Email</label>
                  <input id="evf-cemail" name="contactEmail" type="email" className="form-input" defaultValue={vendor.contactEmail || ""} placeholder="john@example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="evf-cphone">Contact Phone</label>
                  <input id="evf-cphone" name="contactPhone" type="tel" className="form-input" defaultValue={vendor.contactPhone || ""} placeholder="(555) 555-5555" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evf-addr">Address</label>
                <input id="evf-addr" name="address" className="form-input" defaultValue={vendor.address || ""} placeholder="123 Main St, New York, NY 10001" />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="evf-notes">Operational Notes</label>
                <textarea id="evf-notes" name="notes" className="form-input" rows="3" defaultValue={vendor.notes || ""} placeholder="Notes..." style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
              </div>

              <div className="flex justify-between items-center" style={{ marginTop: 32 }}>
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <Link href="/vendors" className="btn btn-secondary">Cancel</Link>
                </div>
                <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={saving} style={{ background: "var(--red)", borderColor: "var(--red)", color: "white" }}>
                  Delete Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tab === "relations" && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 16 }}>Associated Contracts</h3>
            {vendor.contracts?.length === 0 ? (
              <p className="text-muted" style={{ marginBottom: 32 }}>No contracts associated with this vendor.</p>
            ) : (
              <table className="data-table" style={{ marginBottom: 32 }}>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.contracts.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/contracts/${c.id}`} style={{ fontWeight: 600 }}>{c.title}</Link>
                      </td>
                      <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                      <td>{c.totalValue ? `$${parseFloat(c.totalValue).toLocaleString()}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 style={{ marginBottom: 16 }}>Associated Campaigns</h3>
            {vendor.campaigns?.length === 0 ? (
              <p className="text-muted">No marketing campaigns associated with this vendor.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendor.campaigns.map((camp) => (
                    <tr key={camp.id}>
                      <td style={{ fontWeight: 600 }}>{camp.name}</td>
                      <td><span className={`badge badge-${camp.status}`}>{camp.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "audit" && (
        <div className="card">
          <div className="card-body">
            <h3 style={{ marginBottom: 16 }}>Change History</h3>
            {auditLog.length === 0 ? (
              <p className="text-muted">No changes recorded for this vendor.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>User</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((log) => (
                    <tr key={log.id}>
                      <td className="muted">{fmtDateTime(log.createdAt)}</td>
                      <td>{log.user?.name || "System"}</td>
                      <td>
                        <span className={`badge badge-${log.action === "create" ? "active" : log.action === "delete" ? "expired" : "submitted"}`}>
                          {log.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
