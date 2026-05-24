"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const CONTRACT_TYPES = [
  { value: "lead_agency", label: "Lead Agency" },
  { value: "media_buying", label: "Media Buying" },
  { value: "instant_ticket", label: "Instant Ticket" },
  { value: "specialty", label: "Specialty Vendor" },
  { value: "zero_base", label: "Zero-Base / Per Campaign" },
];

export default function NewContractForm({ vendors, jurisdictions }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(e.target);
    const body = {
      title: form.get("title"),
      type: form.get("type"),
      vendorId: form.get("vendorId"),
      jurisdictionId: form.get("jurisdictionId"),
      status: "draft",
      startDate: form.get("startDate") || null,
      endDate: form.get("endDate") || null,
      noticeDate: form.get("noticeDate") || null,
      totalValue: form.get("totalValue") ? parseFloat(form.get("totalValue")) : null,
      budgetCap: form.get("budgetCap") ? parseFloat(form.get("budgetCap")) : null,
      terms: {},
    };

    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create contract");
      }
      const contract = await res.json();
      router.push(`/contracts/${contract.id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 720 }}>
      <div className="card-body">
        {error && <div className="login-error" style={{ marginBottom: 20 }}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="cf-title">Contract Title</label>
            <input id="cf-title" name="title" className="form-input" required autoFocus
              placeholder="e.g., FY2026 Lead Agency Services" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cf-type">Contract Type</label>
              <select id="cf-type" name="type" className="form-select" required>
                <option value="">Select type...</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cf-vendor">Vendor</label>
              <select id="cf-vendor" name="vendorId" className="form-select" required>
                <option value="">Select vendor...</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="cf-jurisdiction">Jurisdiction</label>
            <select id="cf-jurisdiction" name="jurisdictionId" className="form-select" required>
              {jurisdictions.map((j) => (
                <option key={j.id} value={j.id}>{j.name} ({j.abbreviation})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cf-start">Start Date</label>
              <input id="cf-start" name="startDate" className="form-input" type="date" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cf-end">End Date</label>
              <input id="cf-end" name="endDate" className="form-input" type="date" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cf-notice">Notice Date</label>
              <input id="cf-notice" name="noticeDate" className="form-input" type="date" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="cf-value">Total Value ($)</label>
              <input id="cf-value" name="totalValue" className="form-input" type="number"
                step="0.01" min="0" placeholder="0.00" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="cf-budget">Budget Cap ($)</label>
              <input id="cf-budget" name="budgetCap" className="form-input" type="number"
                step="0.01" min="0" placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-2" style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Creating..." : "Create Contract"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
