"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCampaignForm({ jurisdictions, vendors, contracts, products }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState("");

  const filteredContracts = contracts.filter(c => !selectedVendor || c.vendorId === selectedVendor);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.target);
    const productIds = Array.from(form.getAll("productIds"));

    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        jurisdictionId: form.get("jurisdictionId"),
        vendorId: form.get("vendorId"),
        contractId: form.get("contractId") || null,
        campaignType: form.get("campaignType") || null,
        objective: form.get("objective"),
        totalBudget: form.get("totalBudget") ? parseFloat(form.get("totalBudget")) : null,
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
        productIds,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      router.push(`/marketing/${data.id}`);
    } else {
      setLoading(false);
      alert("Error creating campaign");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 800 }}>
      <div className="card-body">
        <h3 style={{ marginBottom: 20 }}>Campaign Overview</h3>
        
        <div className="form-group">
          <label className="form-label">Campaign Name</label>
          <input name="name" className="form-input" required placeholder="e.g., Summer Mega Millions Awareness" />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Jurisdiction</label>
            <select name="jurisdictionId" className="form-select" required>
              <option value="">Select...</option>
              {jurisdictions.map(j => <option key={j.id} value={j.id}>{j.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select name="campaignType" className="form-select">
              <option value="">Select...</option>
              <option value="jackpot_awareness">Jackpot Awareness</option>
              <option value="new_game_launch">New Game Launch</option>
              <option value="seasonal">Seasonal</option>
              <option value="brand">Brand</option>
              <option value="retail_activation">Retail Activation</option>
              <option value="digital">Digital / Social</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Objective</label>
          <textarea name="objective" className="form-input" rows="2" placeholder="Primary goal of the campaign..."></textarea>
        </div>

        <h3 style={{ marginTop: 30, marginBottom: 20 }}>Agency & Contract Links</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Agency (Vendor)</label>
            <select name="vendorId" className="form-select" required value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}>
              <option value="">Select...</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Linked Contract (Optional)</label>
            <select name="contractId" className="form-select">
              <option value="">None / Open</option>
              {filteredContracts.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
        </div>

        <h3 style={{ marginTop: 30, marginBottom: 20 }}>Budget & Timing</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Total Campaign Budget ($)</label>
            <input name="totalBudget" type="number" step="0.01" min="0" className="form-input" placeholder="0.00" />
          </div>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input name="startDate" type="date" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input name="endDate" type="date" className="form-input" />
          </div>
        </div>

        <h3 style={{ marginTop: 30, marginBottom: 20 }}>Products</h3>
        <div className="form-group">
          <label className="form-label">Linked Games/Products (Select multiple)</label>
          <select name="productIds" className="form-select" multiple size="4">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="kpi-subtitle mt-1">Hold Ctrl (Windows) or Cmd (Mac) to select multiple</div>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create Campaign"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => router.push("/marketing")}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
