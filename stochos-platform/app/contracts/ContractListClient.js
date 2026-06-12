"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import { ClipboardList, AlertTriangle, BookOpen } from "lucide-react";
import HelpDrawer from "../components/HelpDrawer";

const CONTRACT_TYPES = {
  lead_agency: "Lead Agency",
  media_buying: "Media Buying",
  instant_ticket: "Instant Ticket",
  specialty: "Specialty",
  zero_base: "Zero-Base",
};

const STATUS_LABELS = {
  draft: "Draft",
  pending_approval: "Pending",
  active: "Active",
  expired: "Expired",
  terminated: "Terminated",
};

function formatCurrency(val) {
  if (val === null || val === undefined) return "—";
  const num = parseFloat(val);
  if (isNaN(num)) return "—";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getBudgetPct(lineItems) {
  const budget = lineItems.reduce((sum, li) => sum + (parseFloat(li.budgetAmount) || 0), 0);
  const spent = lineItems.reduce((sum, li) => sum + (parseFloat(li.spentAmount) || 0), 0);
  if (budget === 0) return { pct: 0, spent, budget, cls: "under" };
  const pct = (spent / budget) * 100;
  const cls = pct > 100 ? "over" : pct > 80 ? "warning" : "under";
  return { pct: Math.min(pct, 100), spent, budget, cls };
}

export default function ContractListClient({ initialContracts }) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");

  const filtered = useMemo(() => {
    return initialContracts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (typeFilter !== "all" && c.type !== typeFilter) return false;
      if (divisionFilter !== "all" && c.division !== divisionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !c.title.toLowerCase().includes(q) &&
          !c.vendor?.name?.toLowerCase().includes(q)
        )
          return false;
      }
      if (expiryFilter !== "all") {
        if (!c.endDate) return false;
        const now = new Date();
        const diffTime = new Date(c.endDate) - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (expiryFilter === "expired") {
          if (diffDays > 0) return false;
        } else if (expiryFilter === "3_months") {
          if (diffDays <= 0 || diffDays > 90) return false;
        } else if (expiryFilter === "6_months") {
          if (diffDays <= 0 || diffDays > 180) return false;
        } else if (expiryFilter === "12_months") {
          if (diffDays <= 0 || diffDays > 365) return false;
        }
      }
      return true;
    });
  }, [initialContracts, search, statusFilter, typeFilter, expiryFilter, divisionFilter]);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
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
      </div>

      <div className="search-bar">
        <input
          className="search-input"
          type="text"
          placeholder="Search contracts or vendors..."
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
          style={{ width: 165 }}
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
        >
          <option value="all">All Expiry Dates</option>
          <option value="3_months">Expiring &lt; 3 Mos</option>
          <option value="6_months">Expiring &lt; 6 Mos (Bid)</option>
          <option value="12_months">Expiring &lt; 12 Mos</option>
          <option value="expired">Expired</option>
        </select>
        <select
          className="form-select"
          style={{ width: 160 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ width: 160 }}
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
        >
          <option value="all">All Divisions</option>
          <option value="IT">IT Division</option>
          <option value="OPERATIONS">Operations</option>
          <option value="MARKETING">Marketing</option>
          <option value="FINANCE">Finance</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <ClipboardList size={48} color="var(--text-secondary)" />
          </div>
          <h3>No contracts found</h3>
          <p>
            {initialContracts.length === 0
               ? "Create your first contract to get started."
               : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Vendor</th>
                <th>Type</th>
                <th>Division</th>
                <th>Status</th>
                <th>Value</th>
                <th>Budget Usage</th>
                <th>End Date</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const budget = getBudgetPct(c.lineItems || []);
                return (
                  <tr key={c.id} className="cursor-pointer">
                    <td>
                      <Link href={`/contracts/${c.id}`} style={{ fontWeight: 600 }}>
                        {c.title}
                      </Link>
                    </td>
                    <td className="muted">{c.vendor?.name || "—"}</td>
                    <td className="muted">{CONTRACT_TYPES[c.type] || c.type}</td>
                    <td>
                      {c.division ? (
                        <span className={`badge badge-${c.division.toLowerCase()}`}>
                          {c.division}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <span className={`badge badge-${c.status}`}>
                        {STATUS_LABELS[c.status] || c.status}
                      </span>
                    </td>
                    <td>{formatCurrency(c.totalValue)}</td>
                    <td style={{ minWidth: 120 }}>
                      {budget.budget > 0 ? (
                        <div className="budget-meter">
                          <div className="budget-meter-bar">
                            <div
                              className={`budget-meter-fill ${budget.cls}`}
                              style={{ width: `${budget.pct}%` }}
                            />
                          </div>
                          <div className="budget-meter-labels">
                            <span>{formatCurrency(budget.spent)}</span>
                            <span>{formatCurrency(budget.budget)}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted text-small">No budget set</span>
                      )}
                    </td>
                    <td>
                      <span className="muted">{formatDate(c.endDate)}</span>
                      {(() => {
                        if (!c.endDate || c.status === "completed" || c.status === "terminated") return null;
                        const now = new Date();
                        const diffTime = new Date(c.endDate) - now;
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays <= 0) {
                          return <span className="badge badge-expired" style={{ marginLeft: 8, fontSize: 10 }}>Expired</span>;
                        } else if (diffDays <= 180) {
                          return (
                            <span 
                              className="badge badge-warning" 
                              style={{ 
                                marginLeft: 8, 
                                fontSize: 10,
                                background: "rgba(255, 209, 102, 0.15)",
                                color: "var(--gold)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              title="Less than 6 months remaining. Recommended time to initiate competitive bidding."
                            >
                              <AlertTriangle size={10} /> Bid Cycle Required
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </td>
                    <td className="muted">{c._count?.lineItems || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <HelpDrawer topicId="contracts" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
}
