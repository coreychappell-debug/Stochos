"use client";
import { useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import HelpDrawer from "../components/HelpDrawer";

const statusStyles = {
  active: { bg: "rgba(16,185,129,0.15)", color: "#10b981", label: "Active" },
  on_sale: { bg: "rgba(16,185,129,0.15)", color: "#10b981", label: "On Sale" },
  planned: { bg: "rgba(107,114,128,0.15)", color: "#9ca3af", label: "Planned" },
  in_production: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6", label: "In Production" },
  shipped: { bg: "rgba(139,92,246,0.15)", color: "#8b5cf6", label: "Shipped" },
  closed: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", label: "Closed" },
  ended: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", label: "Ended" },
};

const nextStatus = {
  active: "closed", on_sale: "closed", closed: "ended",
  planned: "active", in_production: "active", shipped: "active", received: "on_sale",
};
const nextLabel = {
  active: "Close Game", on_sale: "Close Game", closed: "End Game",
  planned: "Activate", in_production: "Activate", shipped: "Activate", received: "Set On Sale",
};

function StatusBadge({ status }) {
  const st = statusStyles[status] || statusStyles.active;
  return <span style={{ padding: "2px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>;
}

export default function ProductsClient({ initialProducts, jurisdictions }) {
  const [products, setProducts] = useState(initialProducts);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", category: "draw_game", type: "", price: "", externalCode: "", jurisdictionId: jurisdictions[0]?.id || "" });
  const [updating, setUpdating] = useState(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const drawGames = products.filter(p => p.category !== "instant");
  const instantGames = products.filter(p => p.category === "instant");
  const onSale = products.filter(p => ["on_sale", "active"].includes(p.status)).length;
  const inPipeline = products.filter(p => ["planned", "in_production", "shipped"].includes(p.status)).length;
  const closedEnded = products.filter(p => ["closed", "ended"].includes(p.status)).length;

  async function handleStatusChange(id, newStatus) {
    setUpdating(id);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      }
    } finally { setUpdating(null); }
  }

  async function handleCreate(e) {
    e.preventDefault();
    const res = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      const newProduct = await res.json();
      setProducts(prev => [...prev, newProduct]);
      setShowForm(false);
      setForm({ name: "", category: "draw_game", type: "", price: "", externalCode: "", jurisdictionId: jurisdictions[0]?.id || "" });
    }
  }

  return (
    <>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2>Products</h2>
          <p>All lottery products — draw games and instant tickets with full lifecycle tracking.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setIsHelpOpen(true)}
            style={{
              padding: "8px 16px",
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              color: "var(--text)",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.15s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "var(--border)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "var(--surface-3)";
            }}
          >
            <BookOpen size={16} /> Help & Guide
          </button>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: "8px 20px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600, fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Plus size={16} /> {showForm ? "Cancel" : "Add Product"}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Add Product Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: "16px", borderLeft: "4px solid var(--primary)" }}>
            <div className="card-header"><h3>Add New Product</h3></div>
            <div className="card-body">
              <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", alignItems: "end" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Product Name *</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "14px" }} placeholder="e.g. Super Lotto Plus" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Category *</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "14px" }}>
                    <option value="draw_game">Draw Game</option>
                    <option value="instant">Instant/Scratch</option>
                    <option value="monitor">Monitor Game</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Price ($)</label>
                  <input value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} type="number" step="0.01" style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "14px" }} placeholder="2.00" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>External Code</label>
                  <input value={form.externalCode} onChange={e => setForm({ ...form, externalCode: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "14px" }} placeholder="e.g. slp_day" />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Jurisdiction</label>
                  <select value={form.jurisdictionId} onChange={e => setForm({ ...form, jurisdictionId: e.target.value })} style={{ width: "100%", padding: "8px 12px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "4px", color: "var(--text-primary)", fontSize: "14px" }}>
                    {jurisdictions.map(j => <option key={j.id} value={j.id}>{j.name} ({j.abbreviation})</option>)}
                  </select>
                </div>
                <div>
                  <button type="submit" style={{ padding: "8px 24px", background: "var(--primary)", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: 600, fontSize: "14px", width: "100%" }}>Create Product</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-blue"><div className="kpi-label">On Sale / Active</div><div className="kpi-value">{onSale}</div></div>
          <div className="kpi-card kpi-gold"><div className="kpi-label">In Pipeline</div><div className="kpi-value">{inPipeline}</div></div>
          <div className="kpi-card kpi-purple"><div className="kpi-label">Closed / Ended</div><div className="kpi-value">{closedEnded}</div></div>
          <div className="kpi-card" style={{ borderLeft: "4px solid var(--text-muted)" }}><div className="kpi-label">Total Products</div><div className="kpi-value">{products.length}</div></div>
        </div>

        {/* Draw Games */}
        <div className="card">
          <div className="card-header"><h3>Draw Games & Monitor Games</h3></div>
          <div className="card-body">
            <table className="data-table">
              <thead><tr><th>Product Name</th><th>Type</th><th>Price</th><th>Jurisdiction</th><th>Code</th><th>Status</th><th style={{ width: "120px" }}>Action</th></tr></thead>
              <tbody>
                {drawGames.map(p => {
                  const next = nextStatus[p.status];
                  const label = nextLabel[p.status];
                  return (
                    <tr key={p.id} style={p.status === "ended" ? { opacity: 0.5 } : {}}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="muted">{p.category === "draw_game" ? "Draw Game" : p.category === "monitor" ? "Monitor" : p.category}</td>
                      <td>{p.price ? `$${parseFloat(p.price).toFixed(2)}` : "—"}</td>
                      <td className="muted">{p.jurisdiction?.abbreviation || "—"}</td>
                      <td className="muted" style={{ fontFamily: "monospace", fontSize: 12 }}>{p.externalCode || "—"}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {next && p.status !== "ended" && (
                          <button
                            disabled={updating === p.id}
                            onClick={() => handleStatusChange(p.id, next)}
                            style={{
                              padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "4px", cursor: "pointer", border: "1px solid var(--border)",
                              background: next === "ended" ? "rgba(239,68,68,0.15)" : next === "closed" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                              color: next === "ended" ? "#ef4444" : next === "closed" ? "#f59e0b" : "#10b981",
                            }}
                          >
                            {updating === p.id ? "..." : label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Instant Ticket Games */}
        <div className="card">
          <div className="card-header"><h3>Instant Ticket Games</h3></div>
          <div className="card-body">
            <table className="data-table">
              <thead><tr><th>Game #</th><th>Name</th><th>Price</th><th>Jurisdiction</th><th>Source</th><th>Status</th><th style={{ width: "120px" }}>Action</th></tr></thead>
              <tbody>
                {instantGames.map(p => {
                  const next = nextStatus[p.status];
                  const label = nextLabel[p.status];
                  return (
                    <tr key={p.id} style={p.status === "ended" ? { opacity: 0.5 } : {}}>
                      <td className="muted" style={{ fontFamily: "monospace" }}>{p.externalCode || "—"}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>${parseFloat(p.price).toFixed(0)}</td>
                      <td className="muted">{p.jurisdiction?.abbreviation || "—"}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{p.externalSource === "instant_ticket_planner" ? "Planner" : "—"}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        {next && p.status !== "ended" && (
                          <button
                            disabled={updating === p.id}
                            onClick={() => handleStatusChange(p.id, next)}
                            style={{
                              padding: "3px 10px", fontSize: "11px", fontWeight: 600, borderRadius: "4px", cursor: "pointer", border: "1px solid var(--border)",
                              background: next === "ended" ? "rgba(239,68,68,0.15)" : next === "closed" ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                              color: next === "ended" ? "#ef4444" : next === "closed" ? "#f59e0b" : "#10b981",
                            }}
                          >
                            {updating === p.id ? "..." : label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <HelpDrawer topicId="products" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
