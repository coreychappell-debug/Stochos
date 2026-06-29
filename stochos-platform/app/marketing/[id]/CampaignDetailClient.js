"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radio, AlertTriangle, Trash2, Image, Check, Link2, CheckSquare, FileText, ArrowLeft, Printer } from "lucide-react";

const STATUS_LABELS = {
  planning: "Planning",
  briefed: "Briefed",
  in_production: "In Production",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

const NEXT_STATUS = {
  planning: "briefed",
  briefed: "in_production",
  in_production: "live",
  live: "completed",
};

function fmt$(val) {
  if (val === null || val === undefined) return "—";
  const num = parseFloat(val);
  return isNaN(num) ? "—" : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split("T")[0];
}

export default function CampaignDetailClient({ campaign, auditLog, products, vendors }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [editingChannelId, setEditingChannelId] = useState(null);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState(null);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState(null);

  const totalBudget = parseFloat(campaign.totalBudget) || 0;
  const plannedSpend = campaign.channels.reduce((sum, ch) => sum + (parseFloat(ch.plannedSpend) || 0), 0);
  const actualSpend = campaign.channels.reduce((sum, ch) => sum + (parseFloat(ch.actualSpend) || 0), 0);
  
  const handlePrint = async () => {
    setSaving(true);
    try {
      await fetch(`/api/campaigns/${campaign.id}/export/pdf`, { method: "POST" });
    } catch (err) {
      console.error("Failed to log export audit:", err);
    }
    setSaving(false);
    window.open(`/marketing/${campaign.id}/print`, "_blank");
  };

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Move campaign to ${STATUS_LABELS[newStatus]}?`)) return;
    setSaving(true);
    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, name: campaign.name }),
    });
    setSaving(false);
    router.refresh();
  };

  const handleEditCampaign = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    const productIds = Array.from(form.getAll("productIds"));

    await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        objective: form.get("objective"),
        status: form.get("status"),
        campaignType: form.get("campaignType") || null,
        totalBudget: form.get("totalBudget") ? parseFloat(form.get("totalBudget")) : null,
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
        notes: form.get("notes") || null,
        productIds,
      }),
    });
    setSaving(false);
    setIsEditing(false);
    router.refresh();
  };

  const handleAddChannel = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/channels`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: form.get("channel"), targetMarket: form.get("targetMarket") || null, vendorId: form.get("vendorId") || null,
        plannedSpend: form.get("plannedSpend") || null, actualSpend: form.get("actualSpend") || 0,
        startDate: form.get("startDate") || null, endDate: form.get("endDate") || null, kpiGoal: form.get("kpiGoal") || null,
        status: form.get("status") || "planned"
      }),
    });
    setSaving(false); setShowAddChannel(false); router.refresh();
  };

  const handleEditChannel = async (e, channelId) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/channels/${channelId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.get("status"), actualSpend: form.get("actualSpend") || 0,
        startDate: form.get("startDate") || null, endDate: form.get("endDate") || null
      }),
    });
    setSaving(false); setEditingChannelId(null); router.refresh();
  };

  const handleDeleteChannel = async (channelId) => {
    if (!confirm("Delete this channel?")) return;
    setSaving(true);
    await fetch(`/api/campaigns/${campaign.id}/channels/${channelId}`, { method: "DELETE" });
    setSaving(false); router.refresh();
  };

  const handleAddAsset = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/assets`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), assetType: form.get("assetType"), vendorId: form.get("vendorId") || null, channelId: form.get("channelId") || null,
        formatSpecs: form.get("formatSpecs") || null, language: form.get("language") || "English", assetUrl: form.get("assetUrl") || null,
        status: form.get("status") || "draft", approvalStatus: form.get("approvalStatus") || null, reviewOwner: form.get("reviewOwner") || null,
        dueDate: form.get("dueDate") || null, launchDate: form.get("launchDate") || null, expirationDate: form.get("expirationDate") || null, usageRightsExpiration: form.get("usageRightsExpiration") || null,
        complianceNotes: form.get("complianceNotes") || null, version: form.get("version") || "v1"
      }),
    });
    setSaving(false); setShowAddAsset(false); router.refresh();
  };

  const handleEditAsset = async (e, assetId) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/assets/${assetId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), status: form.get("status"), approvalStatus: form.get("approvalStatus") || null,
        dueDate: form.get("dueDate") || null, launchDate: form.get("launchDate") || null, expirationDate: form.get("expirationDate") || null, usageRightsExpiration: form.get("usageRightsExpiration") || null,
        assetUrl: form.get("assetUrl") || null, version: form.get("version") || "v1"
      }),
    });
    setSaving(false); setEditingAssetId(null); router.refresh();
  };

  const handleDeleteAsset = async (assetId) => {
    if (!confirm("Delete this asset?")) return;
    setSaving(true);
    await fetch(`/api/campaigns/${campaign.id}/assets/${assetId}`, { method: "DELETE" });
    setSaving(false); router.refresh();
  };

  const handleAddMilestone = async (e) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/milestones`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), milestoneType: form.get("milestoneType"), owner: form.get("owner") || null,
        priority: form.get("priority") || "normal", status: form.get("status") || "not_started",
        dueDate: form.get("dueDate") || null,
        dependencyNotes: form.get("dependencyNotes") || null, blockerReason: form.get("blockerReason") || null, notes: form.get("notes") || null,
        vendorId: form.get("vendorId") || null, channelId: form.get("channelId") || null, assetId: form.get("assetId") || null,
      }),
    });
    setSaving(false); setShowAddMilestone(false); router.refresh();
  };

  const handleEditMilestone = async (e, milestoneId) => {
    e.preventDefault();
    setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/campaigns/${campaign.id}/milestones/${milestoneId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: form.get("status"), priority: form.get("priority"),
        dueDate: form.get("dueDate") || null, completedDate: form.get("completedDate") || null,
        blockerReason: form.get("blockerReason") || null,
      }),
    });
    setSaving(false); setEditingMilestoneId(null); router.refresh();
  };

  const handleDeleteMilestone = async (milestoneId) => {
    if (!confirm("Delete this milestone?")) return;
    setSaving(true);
    await fetch(`/api/campaigns/${campaign.id}/milestones/${milestoneId}`, { method: "DELETE" });
    setSaving(false); router.refresh();
  };

  const handleLoadTemplate = async (templateType) => {
    if (!templateType) return;
    if (!confirm(`Are you sure you want to load the ${templateType.replace(/_/g, " ")} milestones template? This will add standard timeline milestones.`)) return;
    
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/milestones/template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateType }),
      });
      if (!res.ok) throw new Error("Failed to load template");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert("Error loading template: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "channels", label: `Channels (${campaign.channels?.length || 0})` },
    { key: "assets", label: `Assets (${campaign.assets?.length || 0})` },
    { key: "milestones", label: `Milestones (${campaign.milestones?.length || 0})` },
    { key: "audit", label: "Audit Log" },
  ];

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ marginBottom: 4 }}>
              <Link href="/marketing" style={{ color: "var(--text-muted)", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <ArrowLeft size={12} /> Marketing Portfolio
              </Link>
            </div>
            <h2>{campaign.name}</h2>
            <p>
              {campaign.vendor?.name} · <span style={{ textTransform: "capitalize" }}>{campaign.campaignType?.replace(/_/g, " ") || "Campaign"}</span> ·{" "}
              <span className={`badge badge-${campaign.status === "live" ? "active" : campaign.status === "completed" ? "completed" : "submitted"}`}>
                {STATUS_LABELS[campaign.status] || campaign.status}
              </span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-secondary"
              onClick={handlePrint}
              disabled={saving}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <Printer size={16} /> Print Packet
            </button>
            {NEXT_STATUS[campaign.status] && (
              <button
                className="btn btn-primary"
                onClick={() => handleUpdateStatus(NEXT_STATUS[campaign.status])}
                disabled={saving}
              >
                Move to {STATUS_LABELS[NEXT_STATUS[campaign.status]]} →
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="kpi-grid">
          <div className="kpi-card kpi-blue">
            <div className="kpi-label">Total Budget</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(totalBudget)}</div>
            <div className="kpi-subtitle">Allocated to Campaign</div>
          </div>
          <div className="kpi-card kpi-green">
            <div className="kpi-label">Allocated Channels</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(plannedSpend)}</div>
            <div className="budget-meter">
              <div className="budget-meter-bar">
                <div className={`budget-meter-fill ${plannedSpend > totalBudget ? "over" : "under"}`} style={{ width: `${Math.min((plannedSpend / (totalBudget || 1)) * 100, 100)}%` }} />
              </div>
              <div className="budget-meter-labels">
                <span>{totalBudget ? Math.round((plannedSpend / totalBudget) * 100) : 0}% Allocated</span>
              </div>
            </div>
          </div>
          <div className="kpi-card kpi-gold">
            <div className="kpi-label">Flight Dates</div>
            <div className="kpi-value" style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(campaign.startDate)} → {fmtDate(campaign.endDate)}</div>
            <div className="kpi-subtitle">
              {campaign.startDate && new Date(campaign.startDate) > new Date() ? "Upcoming" : 
               campaign.endDate && new Date(campaign.endDate) < new Date() ? "Ended" : "In Flight"}
            </div>
          </div>
          <div className="kpi-card kpi-purple">
            <div className="kpi-label">Assets & Milestones</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{campaign.assets.length} <span style={{fontSize: 14}} className="muted">assets</span></div>
            <div className="kpi-subtitle">{campaign.milestones.length} milestones</div>
          </div>
        </div>

        <div className="tab-nav">
          {tabs.map((t) => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="card">
            <div className="card-header flex justify-between">
              <h3>Campaign Details</h3>
              {!isEditing && <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>Edit Details</button>}
            </div>
            <div className="card-body">
              {isEditing ? (
                <form onSubmit={handleEditCampaign} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Campaign Name</label><input name="name" className="form-input" defaultValue={campaign.name} required /></div>
                    <div className="form-group"><label className="form-label">Status</label>
                      <select name="status" className="form-select" defaultValue={campaign.status}>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Objective</label><textarea name="objective" className="form-input" defaultValue={campaign.objective} rows="2" /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Type</label>
                      <select name="campaignType" className="form-select" defaultValue={campaign.campaignType || ""}>
                        <option value="">Select...</option>
                        <option value="jackpot_awareness">Jackpot Awareness</option>
                        <option value="new_game_launch">New Game Launch</option>
                        <option value="seasonal">Seasonal</option>
                        <option value="brand">Brand</option>
                        <option value="retail_activation">Retail Activation</option>
                        <option value="digital">Digital / Social</option>
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Total Budget</label><input name="totalBudget" className="form-input" type="number" step="0.01" defaultValue={campaign.totalBudget} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Start Date</label><input name="startDate" className="form-input" type="date" defaultValue={toInputDate(campaign.startDate)} /></div>
                    <div className="form-group"><label className="form-label">End Date</label><input name="endDate" className="form-input" type="date" defaultValue={toInputDate(campaign.endDate)} /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Linked Products</label>
                    <select name="productIds" className="form-select" multiple size="4" defaultValue={campaign.products.map(p => p.id)}>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="kpi-subtitle mt-1">Hold Ctrl (Windows) or Cmd (Mac) to select multiple</div>
                  </div>
                  <div className="form-group"><label className="form-label">Internal Notes</label><textarea name="notes" className="form-input" defaultValue={campaign.notes} rows="3" /></div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="form-row">
                    <div><div className="form-label">Agency (Vendor)</div><div>{campaign.vendor?.name || "—"}</div></div>
                    <div><div className="form-label">Jurisdiction</div><div>{campaign.jurisdiction?.name || "—"}</div></div>
                    <div><div className="form-label">Linked Contract</div><div>{campaign.contract ? <Link href={`/contracts/${campaign.contract.id}`} style={{color: "var(--primary)"}}>{campaign.contract.title}</Link> : "—"}</div></div>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div className="form-label">Objective</div>
                    <p style={{ margin: 0, color: "var(--text)" }}>{campaign.objective || "—"}</p>
                  </div>
                  <div style={{ marginTop: 20 }}>
                    <div className="form-label">Linked Products</div>
                    {campaign.products.length > 0 ? (
                      <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                        {campaign.products.map(p => <span key={p.id} className="badge badge-submitted">{p.name}</span>)}
                      </div>
                    ) : <p style={{ margin: 0, color: "var(--text-muted)" }}>None linked</p>}
                  </div>
                  {campaign.notes && (
                    <div style={{ marginTop: 20, padding: 12, background: "var(--surface-1)", borderRadius: "var(--radius-md)" }}>
                      <div className="form-label">Internal Notes</div>
                      <p style={{ margin: 0, fontSize: 14 }}>{campaign.notes}</p>
                    </div>
                  )}
                  <div className="form-row" style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                    <div><div className="form-label">Created By</div><div>{campaign.createdBy?.name || "—"}</div></div>
                    <div><div className="form-label">Created At</div><div>{fmtDateTime(campaign.createdAt)}</div></div>
                    <div><div className="form-label">Last Updated</div><div>{fmtDateTime(campaign.updatedAt)}</div></div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {tab === "channels" && (
          <div className="card">
            <div className="card-header">
              <h3>Channel Allocations</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddChannel(!showAddChannel)}>{showAddChannel ? "Cancel" : "+ Add Channel"}</button>
            </div>
            <div className="card-body">
              {showAddChannel && (
                <form onSubmit={handleAddChannel} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Channel Type</label>
                      <select name="channel" className="form-select" required>
                        <option value="">Select...</option>
                        <option value="digital_display">Digital Display</option>
                        <option value="social_media">Social Media</option>
                        <option value="search">Search Engine</option>
                        <option value="tv">Television</option>
                        <option value="radio">Radio</option>
                        <option value="outdoor">Outdoor / Billboard</option>
                        <option value="pos_retail">Retail POS</option>
                        <option value="print">Print / Signage</option>
                        <option value="experiential">Experiential / Events</option>
                        <option value="influencer">Influencer</option>
                        <option value="email">Email / CRM</option>
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Vendor / Agency (Owner)</label>
                      <select name="vendorId" className="form-select">
                        <option value="">None (Internal)</option>
                        {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Planned Budget ($)</label><input name="plannedSpend" className="form-input" type="number" step="0.01" /></div>
                    <div className="form-group"><label className="form-label">Start Date</label><input name="startDate" className="form-input" type="date" /></div>
                    <div className="form-group"><label className="form-label">End Date</label><input name="endDate" className="form-input" type="date" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Target Market / DMA</label><input name="targetMarket" className="form-input" placeholder="e.g. Statewide, NYC DMA" /></div>
                    <div className="form-group"><label className="form-label">KPI Goal</label><input name="kpiGoal" className="form-input" placeholder="e.g. 5M Impressions" /></div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Add Channel"}</button>
                </form>
              )}

              {campaign.channels.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon"><Radio size={40} style={{ color: "var(--text-muted)" }} /></div><h3>No channels allocated</h3></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {campaign.channels.map(ch => {
                    const isOverspend = parseFloat(ch.actualSpend || 0) > parseFloat(ch.plannedSpend || 0);
                    const isOutsideDates = (ch.startDate && campaign.startDate && new Date(ch.startDate) < new Date(campaign.startDate)) ||
                                           (ch.endDate && campaign.endDate && new Date(ch.endDate) > new Date(campaign.endDate));
                    
                    if (editingChannelId === ch.id) {
                      return (
                        <form key={ch.id} onSubmit={(e) => handleEditChannel(e, ch.id)} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, border: "1px solid var(--border)" }}>
                          <div className="form-row">
                            <div className="form-group"><label className="form-label">Status</label>
                              <select name="status" className="form-select" defaultValue={ch.status}>
                                <option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                            <div className="form-group"><label className="form-label">Marketing Actual Spend ($)</label><input name="actualSpend" className="form-input" type="number" step="0.01" defaultValue={ch.actualSpend} /></div>
                            <div className="form-group"><label className="form-label">Start Date</label><input name="startDate" className="form-input" type="date" defaultValue={toInputDate(ch.startDate)} /></div>
                            <div className="form-group"><label className="form-label">End Date</label><input name="endDate" className="form-input" type="date" defaultValue={toInputDate(ch.endDate)} /></div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingChannelId(null)}>Cancel</button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={ch.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16 }}>
                        <div className="flex justify-between items-center mb-2">
                          <h4 style={{ margin: 0, textTransform: "capitalize", fontSize: 16 }}>
                            {ch.channel.replace(/_/g, " ")} 
                            <span className={`badge badge-${ch.status === "active" ? "active" : ch.status === "completed" ? "completed" : "submitted"}`} style={{ marginLeft: 8 }}>{ch.status}</span>
                            {isOverspend && <span className="badge badge-expired" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Overspend</span>}
                            {isOutsideDates && <span className="badge badge-warning" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Outside Flight Dates</span>}
                          </h4>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingChannelId(ch.id)} style={{ padding: "2px 8px" }}>Edit</button>
                            <button className="btn btn-secondary btn-sm" aria-label="Delete Channel" onClick={() => handleDeleteChannel(ch.id)} style={{ padding: "2px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="form-row" style={{ fontSize: 14 }}>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Vendor / Owner</div><div>{ch.vendor?.name || "Internal"}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Target Market</div><div>{ch.targetMarket || "—"}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Flighting</div><div>{fmtDate(ch.startDate)} → {fmtDate(ch.endDate)}</div></div>
                        </div>
                        <div className="form-row" style={{ fontSize: 14, marginTop: 12 }}>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Planned Budget</div><div style={{ fontWeight: 500 }}>{fmt$(ch.plannedSpend)}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Marketing Actual Spend</div><div style={{ fontWeight: 500, color: isOverspend ? "var(--red)" : "inherit" }}>{fmt$(ch.actualSpend)}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Remaining</div><div style={{ fontWeight: 500 }}>{fmt$((parseFloat(ch.plannedSpend) || 0) - (parseFloat(ch.actualSpend) || 0))}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>KPI Goal</div><div>{ch.kpiGoal || "—"}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "assets" && (
          <div className="card">
            <div className="card-header flex justify-between">
              <h3>Creative Assets</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddAsset(!showAddAsset)}>{showAddAsset ? "Cancel" : "+ Add Asset"}</button>
            </div>
            <div className="card-body">
              {showAddAsset && (
                <form onSubmit={handleAddAsset} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Asset Name</label><input name="name" className="form-input" required placeholder="e.g. Summer 30s TV Spot" /></div>
                    <div className="form-group"><label className="form-label">Asset Type</label>
                      <select name="assetType" className="form-select" required>
                        <option value="">Select...</option><option value="video">Video / TV</option><option value="audio">Audio / Radio</option><option value="static_image">Static Image</option><option value="html5">HTML5 / Digital</option><option value="copy">Legal / Ad Copy</option><option value="print">Print Ready</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Format / Dimensions</label><input name="formatSpecs" className="form-input" placeholder="e.g. 1920x1080, MP4" /></div>
                    <div className="form-group"><label className="form-label">Language</label><input name="language" className="form-input" defaultValue="English" /></div>
                    <div className="form-group"><label className="form-label">Status</label>
                      <select name="status" className="form-select">
                        <option value="draft">Draft</option><option value="in_review">In Review</option><option value="approved">Approved</option><option value="in_production">In Production</option><option value="live">Live</option><option value="retired">Retired</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Vendor / Creator</label>
                      <select name="vendorId" className="form-select">
                        <option value="">Internal Team</option>
                        {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Review Owner</label><input name="reviewOwner" className="form-input" placeholder="e.g. John Doe" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Approval Status</label>
                      <select name="approvalStatus" className="form-select">
                        <option value="">Not Submitted</option><option value="pending">Pending Approval</option><option value="approved_with_changes">Approved with Changes</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">External Asset URL</label><input name="assetUrl" type="url" className="form-input" placeholder="https://..." /></div>
                    <div className="form-group"><label className="form-label">Version</label><input name="version" className="form-input" defaultValue="v1" /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Launch Date</label><input name="launchDate" className="form-input" type="date" /></div>
                    <div className="form-group"><label className="form-label">Expiration Date</label><input name="expirationDate" className="form-input" type="date" /></div>
                    <div className="form-group"><label className="form-label">Usage Rights Expire</label><input name="usageRightsExpiration" className="form-input" type="date" /></div>
                  </div>
                  <div className="form-group"><label className="form-label">Compliance Notes</label><textarea name="complianceNotes" className="form-input" rows="2"></textarea></div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Add Asset"}</button>
                </form>
              )}

              {campaign.assets.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon"><Image size={40} style={{ color: "var(--text-muted)" }} /></div><h3>No assets tracking</h3></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {campaign.assets.map(asset => {
                    const now = new Date();
                    const isExpired = asset.expirationDate && new Date(asset.expirationDate) < now && asset.status !== "retired";
                    const isLaunchWarning = asset.launchDate && new Date(asset.launchDate) <= now && asset.approvalStatus !== "approved" && asset.status !== "retired";
                    const usageRightsExpiringSoon = asset.usageRightsExpiration && (new Date(asset.usageRightsExpiration) - now) < (30 * 24 * 60 * 60 * 1000) && new Date(asset.usageRightsExpiration) > now;
                    const usageRightsExpired = asset.usageRightsExpiration && new Date(asset.usageRightsExpiration) <= now;
                    
                    if (editingAssetId === asset.id) {
                      return (
                        <form key={asset.id} onSubmit={(e) => handleEditAsset(e, asset.id)} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, border: "1px solid var(--border)" }}>
                          <div className="form-row">
                            <div className="form-group"><label className="form-label">Asset Name</label><input name="name" className="form-input" defaultValue={asset.name} required /></div>
                            <div className="form-group"><label className="form-label">Status</label>
                              <select name="status" className="form-select" defaultValue={asset.status}>
                                <option value="draft">Draft</option><option value="in_review">In Review</option><option value="approved">Approved</option><option value="in_production">In Production</option><option value="live">Live</option><option value="retired">Retired</option>
                              </select>
                            </div>
                            <div className="form-group"><label className="form-label">Approval Status</label>
                              <select name="approvalStatus" className="form-select" defaultValue={asset.approvalStatus || ""}>
                                <option value="">Not Submitted</option><option value="pending">Pending Approval</option><option value="approved_with_changes">Approved with Changes</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
                              </select>
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-group"><label className="form-label">Launch Date</label><input name="launchDate" className="form-input" type="date" defaultValue={toInputDate(asset.launchDate)} /></div>
                            <div className="form-group"><label className="form-label">Expiration Date</label><input name="expirationDate" className="form-input" type="date" defaultValue={toInputDate(asset.expirationDate)} /></div>
                            <div className="form-group"><label className="form-label">Usage Rights Expire</label><input name="usageRightsExpiration" className="form-input" type="date" defaultValue={toInputDate(asset.usageRightsExpiration)} /></div>
                          </div>
                          <div className="form-row">
                            <div className="form-group"><label className="form-label">External Asset URL</label><input name="assetUrl" type="url" className="form-input" defaultValue={asset.assetUrl || ""} /></div>
                            <div className="form-group"><label className="form-label">Version</label><input name="version" className="form-input" defaultValue={asset.version || "v1"} /></div>
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingAssetId(null)}>Cancel</button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={asset.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16 }}>
                        <div className="flex justify-between items-center mb-2">
                          <h4 style={{ margin: 0, textTransform: "capitalize", fontSize: 16 }}>
                            {asset.name} <span className="text-muted" style={{ fontSize: 13, fontWeight: "normal" }}>({asset.version})</span>
                            <span className={`badge badge-${asset.status === "live" ? "active" : asset.status === "retired" ? "expired" : "submitted"}`} style={{ marginLeft: 8 }}>{asset.status.replace("_", " ")}</span>
                            {asset.approvalStatus === "approved" && <span className="badge badge-completed" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} /> Approved</span>}
                            {isExpired && <span className="badge badge-expired" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Past Expiration</span>}
                            {isLaunchWarning && <span className="badge badge-expired" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Launched without Approval</span>}
                            {usageRightsExpired && <span className="badge badge-expired" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Usage Rights Expired</span>}
                            {usageRightsExpiringSoon && <span className="badge badge-warning" style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Usage Rights Expiring</span>}
                          </h4>
                          <div className="flex gap-2">
                            {asset.assetUrl && <a href={asset.assetUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}><Link2 size={12} /> View</a>}
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingAssetId(asset.id)} style={{ padding: "2px 8px" }}>Edit</button>
                            <button className="btn btn-secondary btn-sm" aria-label="Delete Asset" onClick={() => handleDeleteAsset(asset.id)} style={{ padding: "2px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div className="form-row" style={{ fontSize: 14 }}>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Type</div><div style={{ textTransform: "capitalize" }}>{asset.assetType.replace("_", " ")}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Format / Lang</div><div>{asset.formatSpecs || "—"} · {asset.language || "—"}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Vendor / Owner</div><div>{asset.vendor?.name || "Internal"}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Review Owner</div><div>{asset.reviewOwner || "—"}</div></div>
                        </div>
                        <div className="form-row" style={{ fontSize: 14, marginTop: 12 }}>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Launch Date</div><div>{fmtDate(asset.launchDate)}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Expiration</div><div style={{ color: isExpired ? "var(--red)" : "inherit" }}>{fmtDate(asset.expirationDate)}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Usage Rights</div><div style={{ color: usageRightsExpired ? "var(--red)" : usageRightsExpiringSoon ? "orange" : "inherit" }}>{fmtDate(asset.usageRightsExpiration)}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "milestones" && (
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3>Milestones</h3>
              <div className="flex gap-2">
                <select 
                  className="form-select form-select-sm" 
                  value=""
                  onChange={(e) => {
                    handleLoadTemplate(e.target.value);
                    e.target.value = "";
                  }}
                  disabled={saving}
                  style={{ fontSize: 12, height: 28, width: 180 }}
                >
                  <option value="" disabled>Load Template Timeline...</option>
                  <option value="new_game_launch">New Game Launch Wave</option>
                  <option value="jackpot_awareness">Jackpot Awareness Wave</option>
                  <option value="seasonal_brand">Seasonal / Brand Campaign</option>
                </select>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddMilestone(!showAddMilestone)}>{showAddMilestone ? "Cancel" : "+ Add Milestone"}</button>
              </div>
            </div>
            <div className="card-body">
              {showAddMilestone && (
                <form onSubmit={handleAddMilestone} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Milestone Name</label><input name="name" className="form-input" required placeholder="e.g. Final Asset Approval" /></div>
                    <div className="form-group"><label className="form-label">Type</label>
                      <select name="milestoneType" className="form-select" required>
                        <option value="">Select...</option>
                        <option value="creative">Creative</option><option value="media_buy">Media Buy</option><option value="legal_review">Legal Review</option><option value="executive_review">Executive Review</option><option value="launch">Launch</option><option value="retail_delivery">Retail Delivery</option><option value="reporting">Reporting</option><option value="closeout">Closeout</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Owner</label><input name="owner" className="form-input" placeholder="e.g. John Doe" /></div>
                    <div className="form-group"><label className="form-label">Due Date</label><input name="dueDate" className="form-input" type="date" /></div>
                    <div className="form-group"><label className="form-label">Priority</label>
                      <select name="priority" className="form-select">
                        <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Link to Channel</label>
                      <select name="channelId" className="form-select">
                        <option value="">None</option>
                        {campaign.channels?.map(c => <option key={c.id} value={c.id}>{c.channel.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Link to Asset</label>
                      <select name="assetId" className="form-select">
                        <option value="">None</option>
                        {campaign.assets?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">Link to Vendor</label>
                      <select name="vendorId" className="form-select">
                        <option value="">None</option>
                        {vendors?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group"><label className="form-label">Dependency Notes</label><input name="dependencyNotes" className="form-input" placeholder="e.g. Blocks launch" /></div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Add Milestone"}</button>
                </form>
              )}

              {campaign.milestones.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon"><CheckSquare size={40} style={{ color: "var(--text-muted)" }} /></div><h3>No milestones tracking</h3></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {campaign.milestones.map(m => {
                    const now = new Date();
                    now.setHours(0,0,0,0);
                    const due = m.dueDate ? new Date(m.dueDate) : null;
                    if (due) due.setHours(0,0,0,0);
                    
                    const isOverdue = due && due < now && m.status !== "completed" && m.status !== "cancelled";
                    const isDueSoon = due && due >= now && (due - now) <= (7 * 24 * 60 * 60 * 1000) && m.status !== "completed" && m.status !== "cancelled";
                    const isBlocked = m.status === "blocked";
                    
                    // Logic: launch milestone where required assets are not approved (ignore retired/cancelled)
                    const activeAssets = campaign.assets.filter(a => a.status !== "retired" && a.status !== "cancelled");
                    const hasUnapprovedAssets = activeAssets.some(a => a.approvalStatus !== "approved");
                    const isLaunchBlocked = m.milestoneType === "launch" && hasUnapprovedAssets;
                    
                    // Logic: closeout milestone where campaign is completed but assets/channels remain active
                    const hasActiveEntities = campaign.channels.some(c => c.status === "active") || campaign.assets.some(a => a.status === "live");
                    const isCloseoutBlocked = m.milestoneType === "closeout" && hasActiveEntities;
                    
                    if (editingMilestoneId === m.id) {
                      return (
                        <form key={m.id} onSubmit={(e) => handleEditMilestone(e, m.id)} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, border: "1px solid var(--border)" }}>
                          <div className="form-row">
                            <div className="form-group"><label className="form-label">Status</label>
                              <select name="status" className="form-select" defaultValue={m.status}>
                                <option value="not_started">Not Started</option><option value="in_progress">In Progress</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                              </select>
                            </div>
                            <div className="form-group"><label className="form-label">Priority</label>
                              <select name="priority" className="form-select" defaultValue={m.priority}>
                                <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
                              </select>
                            </div>
                            <div className="form-group"><label className="form-label">Due Date</label><input name="dueDate" className="form-input" type="date" defaultValue={toInputDate(m.dueDate)} /></div>
                            <div className="form-group"><label className="form-label">Completed Date</label><input name="completedDate" className="form-input" type="date" defaultValue={toInputDate(m.completedDate)} /></div>
                          </div>
                          <div className="form-group"><label className="form-label">Blocker Reason</label><input name="blockerReason" className="form-input" defaultValue={m.blockerReason || ""} /></div>
                          <div className="flex gap-2">
                            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save</button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingMilestoneId(null)}>Cancel</button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={m.id} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 16 }}>
                        <div className="flex justify-between items-center mb-2">
                          <h4 style={{ margin: 0, fontSize: 16 }}>
                            {m.name}
                            <span className={`badge badge-${m.status === "completed" ? "completed" : m.status === "blocked" ? "expired" : "submitted"}`} style={{ marginLeft: 8 }}>{m.status.replace("_", " ")}</span>
                            {m.priority === "critical" && <span className="badge badge-expired" style={{ marginLeft: 8 }}>Critical</span>}
                            {m.priority === "high" && <span className="badge badge-warning" style={{ marginLeft: 8 }}>High Priority</span>}
                          </h4>
                          <div className="flex gap-2">
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingMilestoneId(m.id)} style={{ padding: "2px 8px" }}>Edit</button>
                            <button className="btn btn-secondary btn-sm" aria-label="Delete Milestone" onClick={() => handleDeleteMilestone(m.id)} style={{ padding: "2px 8px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            {isBlocked && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <b>Blocked:</b> {m.blockerReason || "No reason provided"}</div>}
                            {isOverdue && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <b>Overdue</b></div>}
                            {isDueSoon && !isOverdue && <div style={{ color: "var(--yellow)", fontSize: 13, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <b>Due within 7 days</b></div>}
                            {isLaunchBlocked && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <b>Launch Blocked:</b> Campaign has unapproved active assets</div>}
                            {isCloseoutBlocked && <div style={{ color: "var(--red)", fontSize: 13, marginBottom: 4, display: "inline-flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> <b>Closeout Blocked:</b> Campaign has active channels or live assets</div>}
                        </div>
                        <div className="form-row" style={{ fontSize: 14 }}>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Type</div><div style={{ textTransform: "capitalize" }}>{m.milestoneType.replace("_", " ")}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Owner</div><div>{m.owner || "—"}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Due Date</div><div style={{ color: isOverdue ? "var(--red)" : "inherit" }}>{fmtDate(m.dueDate)}</div></div>
                          <div><div className="form-label" style={{ fontSize: 12 }}>Completed</div><div>{fmtDate(m.completedDate)}</div></div>
                        </div>
                        {(m.channelId || m.assetId || m.vendorId) && (
                           <div className="form-row" style={{ fontSize: 14, marginTop: 12, padding: 8, background: "var(--surface-1)", borderRadius: "var(--radius-sm)" }}>
                             {m.channelId && <div><div className="form-label" style={{ fontSize: 12 }}>Linked Channel</div><div>{m.channel?.channel?.replace(/_/g, " ")}</div></div>}
                             {m.assetId && <div><div className="form-label" style={{ fontSize: 12 }}>Linked Asset</div><div>{m.asset?.name}</div></div>}
                             {m.vendorId && <div><div className="form-label" style={{ fontSize: 12 }}>Vendor</div><div>{m.vendor?.name}</div></div>}
                           </div>
                        )}
                        {m.dependencyNotes && (
                          <div style={{ fontSize: 13, marginTop: 12 }}>
                            <div className="form-label" style={{ fontSize: 12 }}>Dependencies</div>
                            {m.dependencyNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="card">
            <div className="card-header"><h3>Audit Log</h3></div>
            <div className="card-body">
              {auditLog.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon"><FileText size={40} style={{ color: "var(--text-muted)" }} /></div><h3>No audit entries</h3></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Time</th><th>User</th><th>Action</th></tr></thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id}>
                        <td className="muted">{fmtDateTime(entry.createdAt)}</td>
                        <td>{entry.user?.name || "System"}</td>
                        <td><span className={`badge badge-${entry.action === "create" ? "active" : entry.action === "delete" ? "expired" : "submitted"}`}>{entry.action}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
