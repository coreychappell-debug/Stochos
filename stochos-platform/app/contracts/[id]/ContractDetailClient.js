"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const STATUS_LABELS = { 
  draft: "Draft", 
  in_review: "In Review", 
  approved_planning: "Approved for Planning", 
  active: "Active", 
  completed: "Completed",
  expired: "Expired",
  terminated: "Terminated" 
};

const TYPE_LABELS = { 
  lead_agency: "Lead Agency", 
  media_buying: "Media Buying", 
  instant_ticket: "Instant Ticket", 
  specialty: "Specialty", 
  zero_base: "Zero-Base" 
};

const ITEM_STATUS = { 
  pending: "Pending", 
  in_progress: "In Progress", 
  delivered: "Delivered", 
  invoiced: "Invoiced", 
  closed: "Closed" 
};

const NEXT_STATUS = {
  draft: "in_review",
  in_review: "approved_planning",
  approved_planning: "active",
  active: "completed"
};

function fmt$(val) {
  if (val === null || val === undefined) return "—";
  const num = parseFloat(val);
  return isNaN(num) ? "—" : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function fmtDate(d) { if (!d) return "—"; return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); }
function fmtDateTime(d) { if (!d) return "—"; return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }); }

// Helper to convert date to YYYY-MM-DD for inputs
function toInputDate(d) {
  if (!d) return "";
  return new Date(d).toISOString().split('T')[0];
}

export default function ContractDetailClient({ contract, auditLog, products }) {
  const router = useRouter();
  const [tab, setTab] = useState("overview");
  
  // UI states
  const [isEditing, setIsEditing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [showAddAmendment, setShowAddAmendment] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePrint = async () => {
    setShowExport(false);
    await fetch(`/api/contracts/${contract.id}/export/pdf`, { method: "POST" });
    window.open(`/contracts/${contract.id}/print`, "_blank");
  };

  const totalBudget = (contract.lineItems || []).reduce((s, li) => s + (parseFloat(li.budgetAmount) || 0), 0);
  const totalSpent = (contract.lineItems || []).reduce((s, li) => s + (parseFloat(li.spentAmount) || 0), 0);
  const budgetPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const budgetCls = budgetPct > 100 ? "over" : budgetPct > 80 ? "warning" : "under";
  const amendmentValue = (contract.amendments || []).reduce((s, a) => s + (parseFloat(a.valueChange) || 0), 0);
  const adjustedValue = (parseFloat(contract.totalValue) || 0) + amendmentValue;

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Are you sure you want to change the status to ${STATUS_LABELS[newStatus]}?`)) return;
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false); router.refresh();
  };

  const handleEditContract = async (e) => {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/contracts/${contract.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        type: form.get("type"),
        startDate: form.get("startDate") || null,
        endDate: form.get("endDate") || null,
        noticeDate: form.get("noticeDate") || null,
        totalValue: form.get("totalValue") ? parseFloat(form.get("totalValue")) : null,
        budgetCap: form.get("budgetCap") ? parseFloat(form.get("budgetCap")) : null,
      }),
    });
    setSaving(false); setIsEditing(false); router.refresh();
  };

  const handleAddAmendment = async (e) => {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/contracts/${contract.id}/amendments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.get("description"),
        valueChange: form.get("valueChange") ? parseFloat(form.get("valueChange")) : 0,
        effectiveDate: form.get("effectiveDate") || null,
        newEndDate: form.get("newEndDate") || null,
      }),
    });
    setSaving(false); setShowAddAmendment(false); router.refresh();
  };

  const handleAddLineItem = async (e) => {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/contracts/${contract.id}/line-items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: form.get("description"), deliverableType: form.get("deliverableType") || null,
        productId: form.get("productId") || null, budgetAmount: form.get("budgetAmount") ? parseFloat(form.get("budgetAmount")) : null,
        quantity: form.get("quantity") ? parseInt(form.get("quantity")) : null, unitCost: form.get("unitCost") ? parseFloat(form.get("unitCost")) : null,
        dueDate: form.get("dueDate") || null,
      }),
    });
    setSaving(false); setShowAddItem(false); router.refresh();
  };

  const handleDeleteLineItem = async (itemId) => {
    if (!confirm("Are you sure you want to delete this line item?")) return;
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}/line-items/${itemId}`, { method: "DELETE" });
    setSaving(false); router.refresh();
  };

  const handleAddDoc = async (e) => {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/contracts/${contract.id}/compliance`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: form.get("documentType"), description: form.get("description"), expirationDate: form.get("expirationDate") || null }),
    });
    setSaving(false); setShowAddDoc(false); router.refresh();
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    setSaving(true);
    await fetch(`/api/contracts/${contract.id}/compliance/${docId}`, { method: "DELETE" });
    setSaving(false); router.refresh();
  };

  const handleAddInvoice = async (e) => {
    e.preventDefault(); setSaving(true);
    const form = new FormData(e.target);
    await fetch(`/api/contracts/${contract.id}/invoices`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceNumber: form.get("invoiceNumber"),
        lineItemId: form.get("lineItemId") || null,
        amount: form.get("amount") ? parseFloat(form.get("amount")) : 0,
        description: form.get("description"),
        submittedAt: form.get("submittedAt") || null,
      }),
    });
    setSaving(false); setShowAddInvoice(false); router.refresh();
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "deliverables", label: `Deliverables (${contract.lineItems?.length || 0})` },
    { key: "invoices", label: `Invoices (${contract.invoices?.length || 0})` },
    { key: "documents", label: `Documents (${contract.compliance?.length || 0})` },
    { key: "audit", label: "Audit History" },
  ];

  return (
    <>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <div style={{ marginBottom: 4 }}>
              <Link href="/contracts" style={{ color: "var(--text-muted)", fontSize: 12 }}>← Contracts</Link>
            </div>
            <h2>{contract.title}</h2>
            <p>{contract.vendor?.name} · {TYPE_LABELS[contract.type] || contract.type} · <span className={`badge badge-${contract.status}`}>{STATUS_LABELS[contract.status] || contract.status}</span></p>
          </div>
          <div className="flex gap-2 items-center">
            <div style={{ position: "relative" }}>
              <button className="btn btn-secondary" onClick={() => setShowExport(!showExport)}>Export ▼</button>
              {showExport && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 10, minWidth: 220, padding: "4px 0" }}>
                  <button onClick={handlePrint} style={{ width: "100%", textAlign: "left", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text)" }}>📄 Print Summary (PDF)</button>
                  <a href={`/api/contracts/${contract.id}/export/accounting`} onClick={() => setShowExport(false)} style={{ display: "block", padding: "8px 16px", textDecoration: "none", color: "var(--text)", fontSize: 14 }}>📊 Accounting Data (CSV)</a>
                  <a href={`/api/contracts/${contract.id}/export/audit`} onClick={() => setShowExport(false)} style={{ display: "block", padding: "8px 16px", textDecoration: "none", color: "var(--text)", fontSize: 14 }}>📝 Audit History (CSV)</a>
                </div>
              )}
            </div>
            
            {NEXT_STATUS[contract.status] && (
              <button 
                className="btn btn-primary" 
                onClick={() => handleUpdateStatus(NEXT_STATUS[contract.status])}
                disabled={saving}
              >
                Move to {STATUS_LABELS[NEXT_STATUS[contract.status]]} →
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="kpi-grid">
          <div className="kpi-card kpi-blue">
            <div className="kpi-label">Contract Value</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(contract.totalValue)}</div>
            {amendmentValue !== 0 && <div className="kpi-subtitle">Adjusted: {fmt$(adjustedValue)} ({amendmentValue > 0 ? "+" : ""}{fmt$(amendmentValue)})</div>}
          </div>
          <div className="kpi-card kpi-green">
            <div className="kpi-label">Budget Used</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{fmt$(totalSpent)}</div>
            <div className="budget-meter">
              <div className="budget-meter-bar"><div className={`budget-meter-fill ${budgetCls}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} /></div>
              <div className="budget-meter-labels"><span>{budgetPct.toFixed(0)}% of {fmt$(totalBudget)}</span></div>
            </div>
          </div>
          <div className="kpi-card kpi-gold">
            <div className="kpi-label">Period</div>
            <div className="kpi-value" style={{ fontSize: 14, fontWeight: 600 }}>{fmtDate(contract.startDate)} → {fmtDate(contract.endDate)}</div>
            {contract.noticeDate && <div className="kpi-subtitle">Notice by: {fmtDate(contract.noticeDate)}</div>}
          </div>
          <div className="kpi-card kpi-purple">
            <div className="kpi-label">Line Items</div>
            <div className="kpi-value" style={{ fontSize: 22 }}>{contract.lineItems?.length || 0}</div>
            <div className="kpi-subtitle">{contract.invoices?.length || 0} invoices</div>
          </div>
        </div>

        <div className="tab-nav">
          {tabs.map((t) => <button key={t.key} className={`tab-btn ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.label}</button>)}
        </div>

        {tab === "overview" && (
          <div className="card">
            <div className="card-header flex justify-between">
              <h3>Contract Details</h3>
              {!isEditing && <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>Edit Details</button>}
            </div>
            <div className="card-body">
              {isEditing ? (
                <form onSubmit={handleEditContract} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, border: "1px solid var(--border)" }}>
                  <div className="form-group"><label className="form-label">Title</label><input name="title" className="form-input" defaultValue={contract.title} required /></div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Type</label>
                      <select name="type" className="form-select" defaultValue={contract.type} required>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Start Date</label><input name="startDate" className="form-input" type="date" defaultValue={toInputDate(contract.startDate)} /></div>
                    <div className="form-group"><label className="form-label">End Date</label><input name="endDate" className="form-input" type="date" defaultValue={toInputDate(contract.endDate)} /></div>
                    <div className="form-group"><label className="form-label">Notice Date</label><input name="noticeDate" className="form-input" type="date" defaultValue={toInputDate(contract.noticeDate)} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Total Value ($)</label><input name="totalValue" className="form-input" type="number" step="0.01" min="0" defaultValue={contract.totalValue} /></div>
                    <div className="form-group"><label className="form-label">Budget Cap ($)</label><input name="budgetCap" className="form-input" type="number" step="0.01" min="0" defaultValue={contract.budgetCap} /></div>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="form-row">
                    <div><div className="form-label">Vendor</div><div>{contract.vendor?.name || "—"}</div></div>
                    <div><div className="form-label">Jurisdiction</div><div>{contract.jurisdiction?.name || "—"}</div></div>
                    <div><div className="form-label">Type</div><div>{TYPE_LABELS[contract.type] || contract.type}</div></div>
                  </div>
                  <div className="form-row" style={{ marginTop: 20 }}>
                    <div><div className="form-label">Created By</div><div>{contract.createdBy?.name || "—"}</div></div>
                    <div><div className="form-label">Created At</div><div>{fmtDateTime(contract.createdAt)}</div></div>
                    <div><div className="form-label">Last Updated</div><div>{fmtDateTime(contract.updatedAt)}</div></div>
                  </div>
                </>
              )}
              
              <div style={{ marginTop: 32, borderTop: "1px solid var(--border)", paddingTop: 24 }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="form-label m-0">Amendments</div>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowAddAmendment(!showAddAmendment)}>{showAddAmendment ? "Cancel" : "+ Add Amendment"}</button>
                </div>
                
                {showAddAmendment && (
                  <form onSubmit={handleAddAmendment} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                    <div className="form-group"><label className="form-label">Description</label><input name="description" className="form-input" required placeholder="Scope expansion" /></div>
                    <div className="form-row">
                      <div className="form-group"><label className="form-label">Value Change ($)</label><input name="valueChange" className="form-input" type="number" step="0.01" placeholder="e.g. 50000 or -10000" /></div>
                      <div className="form-group"><label className="form-label">Effective Date</label><input name="effectiveDate" className="form-input" type="date" /></div>
                      <div className="form-group"><label className="form-label">New End Date (Optional)</label><input name="newEndDate" className="form-input" type="date" /></div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Adding..." : "Save Amendment"}</button>
                  </form>
                )}

                {contract.amendments?.length > 0 ? (
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Description</th><th>Value Change</th><th>Effective</th></tr></thead>
                    <tbody>
                      {contract.amendments.map((a) => (
                        <tr key={a.id}><td>{a.amendmentNumber}</td><td>{a.description || "—"}</td>
                          <td style={{ color: parseFloat(a.valueChange) >= 0 ? "var(--green)" : "var(--red)" }}>{parseFloat(a.valueChange) >= 0 ? "+" : ""}{fmt$(a.valueChange)}</td>
                          <td className="muted">{fmtDate(a.effectiveDate)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-muted" style={{ fontSize: 13 }}>No amendments recorded.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "deliverables" && (
          <div className="card">
            <div className="card-header">
              <h3>Deliverables &amp; Line Items</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddItem(!showAddItem)}>{showAddItem ? "Cancel" : "+ Add Item"}</button>
            </div>
            <div className="card-body">
              {showAddItem && (
                <form onSubmit={handleAddLineItem} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Description</label><input name="description" className="form-input" required placeholder="TV media buy — Q1" /></div>
                    <div className="form-group"><label className="form-label">Type</label><select name="deliverableType" className="form-select"><option value="">Select...</option><option value="media_placement">Media Placement</option><option value="print_signage">Print/Signage</option><option value="creative">Creative</option><option value="research">Research</option><option value="ticket_printing">Ticket Printing</option><option value="other">Other</option></select></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Product</label><select name="productId" className="form-select"><option value="">None (general)</option>{products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                    <div className="form-group"><label className="form-label">Budget Amount ($)</label><input name="budgetAmount" className="form-input" type="number" step="0.01" min="0" /></div>
                    <div className="form-group"><label className="form-label">Due Date</label><input name="dueDate" className="form-input" type="date" /></div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Adding..." : "Add Line Item"}</button>
                </form>
              )}
              {(contract.lineItems || []).length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📦</div><h3>No deliverables yet</h3><p>Add line items to track deliverables and budget allocation.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Description</th><th>Type</th><th>Product</th><th>Budget</th><th>Spent</th><th>Due</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {contract.lineItems.map((li) => (
                      <tr key={li.id}><td style={{ fontWeight: 500 }}>{li.description}</td><td className="muted">{li.deliverableType || "—"}</td><td className="muted">{li.product?.name || "—"}</td><td>{fmt$(li.budgetAmount)}</td><td>{fmt$(li.spentAmount)}</td><td className="muted">{fmtDate(li.dueDate)}</td>
                        <td><span className={`badge badge-${li.status === "delivered" ? "active" : li.status}`}>{ITEM_STATUS[li.status] || li.status}</span></td>
                        <td style={{ textAlign: "right" }}><button className="btn btn-secondary btn-sm" onClick={() => handleDeleteLineItem(li.id)} style={{ padding: "2px 6px" }}>🗑️</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "invoices" && (
          <div className="card">
            <div className="card-header">
              <h3>Invoices</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowAddInvoice(!showAddInvoice)}>{showAddInvoice ? "Cancel" : "+ Add Invoice"}</button>
            </div>
            <div className="card-body">
              {showAddInvoice && (
                <form onSubmit={handleAddInvoice} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Invoice Number</label><input name="invoiceNumber" className="form-input" placeholder="INV-2026-001" /></div>
                    <div className="form-group"><label className="form-label">Amount ($)</label><input name="amount" className="form-input" type="number" step="0.01" min="0" required /></div>
                    <div className="form-group"><label className="form-label">Submitted Date</label><input name="submittedAt" className="form-input" type="date" defaultValue={new Date().toISOString().split('T')[0]} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Description</label><input name="description" className="form-input" placeholder="Media buy for Q1" /></div>
                    <div className="form-group"><label className="form-label">Link to Line Item</label>
                      <select name="lineItemId" className="form-select">
                        <option value="">None (General Contract Expense)</option>
                        {contract.lineItems?.map(li => <option key={li.id} value={li.id}>{li.description} ({fmt$(li.budgetAmount)})</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Adding..." : "Save Invoice"}</button>
                </form>
              )}
              {(contract.invoices || []).length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">💰</div><h3>No invoices yet</h3><p>Track vendor invoices against this contract.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Date</th><th>Invoice #</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {contract.invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="muted">{fmtDate(inv.submittedAt)}</td>
                        <td style={{ fontWeight: 500 }}>{inv.invoiceNumber || "—"}</td>
                        <td>{inv.description || "—"}</td>
                        <td>{fmt$(inv.amount)}</td>
                        <td><span className="badge badge-submitted">{inv.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "documents" && (
          <div className="card">
            <div className="card-header"><h3>Compliance Documents</h3><button className="btn btn-primary btn-sm" onClick={() => setShowAddDoc(!showAddDoc)}>{showAddDoc ? "Cancel" : "+ Add Document"}</button></div>
            <div className="card-body">
              {showAddDoc && (
                <form onSubmit={handleAddDoc} style={{ background: "var(--surface-1)", borderRadius: "var(--radius-md)", padding: 16, marginBottom: 20, border: "1px solid var(--border)" }}>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Document Type</label><select name="documentType" className="form-select" required><option value="">Select...</option><option value="bond">Bond</option><option value="insurance">Insurance Certificate</option><option value="nda">NDA</option><option value="background_check">Background Check</option><option value="license">License</option></select></div>
                    <div className="form-group"><label className="form-label">Description</label><input name="description" className="form-input" placeholder="General liability — $1M" /></div>
                    <div className="form-group"><label className="form-label">Expiration Date</label><input name="expirationDate" className="form-input" type="date" /></div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Adding..." : "Add Document"}</button>
                </form>
              )}
              {(contract.compliance || []).length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📄</div><h3>No compliance documents</h3><p>Track bonds, insurance, NDAs, and licenses with expiration alerts.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Description</th><th>Expires</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {contract.compliance.map((doc) => {
                      const isExpired = doc.expirationDate && new Date(doc.expirationDate) < new Date();
                      return (<tr key={doc.id}><td style={{ fontWeight: 500, textTransform: "capitalize" }}>{doc.documentType?.replace(/_/g, " ")}</td><td className="muted">{doc.description || "—"}</td><td style={{ color: isExpired ? "var(--red)" : "inherit" }}>{fmtDate(doc.expirationDate)}{isExpired && " ⚠️"}</td><td><span className={`badge badge-${doc.status === "received" ? "active" : doc.status}`}>{doc.status}</span></td>
                        <td style={{ textAlign: "right" }}><button className="btn btn-secondary btn-sm" onClick={() => handleDeleteDoc(doc.id)} style={{ padding: "2px 6px" }}>🗑️</button></td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "audit" && (
          <div className="card">
            <div className="card-header"><h3>Audit History</h3></div>
            <div className="card-body">
              {auditLog.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📝</div><h3>No audit entries</h3><p>Changes to this contract will be logged here.</p></div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>Time</th><th>User</th><th>Action</th></tr></thead>
                  <tbody>
                    {auditLog.map((entry) => (
                      <tr key={entry.id}><td className="muted">{fmtDateTime(entry.createdAt)}</td><td>{entry.user?.name || "System"}</td>
                        <td><span className={`badge badge-${entry.action === "create" ? "active" : entry.action === "delete" ? "expired" : "submitted"}`}>{entry.action}</span></td></tr>
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
