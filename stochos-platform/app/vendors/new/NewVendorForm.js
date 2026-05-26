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

export default function NewVendorForm({ jurisdictions }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

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
      status: "active",
    };

    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to register vendor");
      }
      router.push("/vendors");
      router.refresh();
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
            <label className="form-label" htmlFor="vf-name">Vendor Name</label>
            <input id="vf-name" name="name" className="form-input" required autoFocus
              placeholder="e.g., McCann Worldgroup" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vf-type">Vendor Type</label>
              <select id="vf-type" name="type" className="form-select" required>
                <option value="">Select type...</option>
                {VENDOR_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vf-jurisdiction">Jurisdiction</label>
              <select id="vf-jurisdiction" name="jurisdictionId" className="form-select">
                <option value="">Global / Unrestricted</option>
                {jurisdictions.map((j) => (
                  <option key={j.id} value={j.id}>{j.name} ({j.abbreviation})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vf-tax">Tax ID / EIN</label>
              <input id="vf-tax" name="taxId" className="form-input" placeholder="e.g., 12-3456789" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vf-classification">Business Classification</label>
              <select id="vf-classification" name="classification" className="form-select">
                <option value="">None (Standard)</option>
                <option value="mwbe">MWBE (Minority/Women-Owned)</option>
                <option value="small_business">Small Business</option>
                <option value="sdvob">SDVOB (Service-Disabled Veteran-Owned)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="vf-website">Website URL</label>
              <input id="vf-website" name="website" type="url" className="form-input" placeholder="https://example.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vf-terms">Payment Terms</label>
              <select id="vf-terms" name="paymentTerms" className="form-select">
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
              <label className="form-label" htmlFor="vf-cname">Contact Person</label>
              <input id="vf-cname" name="contactName" className="form-input" placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vf-cemail">Contact Email</label>
              <input id="vf-cemail" name="contactEmail" type="email" className="form-input" placeholder="john@example.com" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="vf-cphone">Contact Phone</label>
              <input id="vf-cphone" name="contactPhone" type="tel" className="form-input" placeholder="(555) 555-5555" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vf-addr">Address</label>
            <input id="vf-addr" name="address" className="form-input" placeholder="123 Main St, New York, NY 10001" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="vf-notes">Operational Notes</label>
            <textarea id="vf-notes" name="notes" className="form-input" rows="3" placeholder="Compliance notes, capabilities..." style={{ width: "100%", background: "var(--surface-overlay)", color: "var(--text)" }} />
          </div>

          <div className="flex gap-2" style={{ marginTop: 24 }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Registering..." : "Register Vendor"}
            </button>
            <Link href="/vendors" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
