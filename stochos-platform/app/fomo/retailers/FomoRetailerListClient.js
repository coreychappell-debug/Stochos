"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

export default function FomoRetailerListClient({ initialRetailers, routes, chains }) {
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [trainingFilter, setTrainingFilter] = useState("all");
  const [routeFilter, setRouteFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Debounce search input to prevent UI lag on keypresses
  useEffect(() => {
    const handler = setTimeout(() => {
      search !== inputValue && setSearch(inputValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [inputValue, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, trainingFilter, routeFilter, chainFilter]);

  const filteredRetailers = useMemo(() => {
    return initialRetailers.filter(r => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (trainingFilter !== "all" && r.trainingStatus !== trainingFilter) return false;
      if (routeFilter !== "all" && r.routeId !== routeFilter) return false;
      if (chainFilter !== "all" && r.chainId !== chainFilter) return false;

      if (search) {
        const query = search.toLowerCase();
        return (
          r.name.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query) ||
          r.city.toLowerCase().includes(query) ||
          r.externalId.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [initialRetailers, search, statusFilter, trainingFilter, routeFilter, chainFilter]);

  const totalPages = Math.ceil(filteredRetailers.length / pageSize);

  const paginatedRetailers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRetailers.slice(startIndex, startIndex + pageSize);
  }, [filteredRetailers, currentPage]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      
      {/* Search and Filters Bar */}
      <div className="search-bar" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <input
          type="text"
          className="search-input"
          style={{ flex: 1, minWidth: 200 }}
          placeholder="Search by name, address, external ID..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <select
          className="form-select"
          style={{ width: 150 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="warning">Warning</option>
          <option value="suspended">Suspended</option>
        </select>
        <select
          className="form-select"
          style={{ width: 160 }}
          value={trainingFilter}
          onChange={(e) => setTrainingFilter(e.target.value)}
        >
          <option value="all">All Training</option>
          <option value="trained">Trained</option>
          <option value="not_trained">Not Trained</option>
        </select>
        <select
          className="form-select"
          style={{ width: 180 }}
          value={routeFilter}
          onChange={(e) => setRouteFilter(e.target.value)}
        >
          <option value="all">All Routes</option>
          {routes.map(rt => (
            <option key={rt.id} value={rt.id}>{rt.code} - {rt.name}</option>
          ))}
        </select>
        <select
          className="form-select"
          style={{ width: 150 }}
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value)}
        >
          <option value="all">All Chains</option>
          {chains.map(ch => (
            <option key={ch.id} value={ch.id}>{ch.name}</option>
          ))}
        </select>
      </div>

      {/* Retailers Table */}
      {filteredRetailers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏪</div>
          <h3>No retailers found</h3>
          <p>Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Retailer Name</th>
                <th>Chain Account</th>
                <th>Assigned Route</th>
                <th>Status</th>
                <th>Training</th>
                <th>Last Visit</th>
                <th>Exceptions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRetailers.map((r) => (
                <tr key={r.id}>
                  <td className="muted" style={{ fontFamily: "monospace" }}>{r.externalId}</td>
                  <td>
                    <Link href={`/fomo/retailers/${r.id}`} style={{ fontWeight: 600 }}>
                      {r.name}
                    </Link>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {r.address}, {r.city}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      📍 {r.county ? `${r.county} Co` : 'No County'} | 📺 {r.dma || 'No DMA'} | 🏢 {r.serviceCenter || 'No Service Center'} | 🌐 {r.latitude && r.longitude ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</span> : 'No Coordinates'}
                    </div>
                  </td>
                  <td>{r.chain?.name || "Independent"}</td>
                  <td>
                    {r.route ? (
                      <div>
                        <span style={{ fontWeight: 600, color: "var(--blue)" }}>{r.route.code}</span>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.route.name}</div>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <span className={`badge badge-${r.status}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${r.trainingStatus === "trained" ? "approved" : "draft"}`}>
                      {r.trainingStatus === "trained" ? "Trained" : "Not Trained"}
                    </span>
                  </td>
                  <td className="muted">
                    {r.lastVisitDate ? new Date(r.lastVisitDate).toLocaleDateString() : "Never visited"}
                  </td>
                  <td>
                    {r._count?.discrepancies > 0 ? (
                      <span className="badge badge-rejected" style={{ fontWeight: 700 }}>
                        {r._count.discrepancies} Alert
                      </span>
                    ) : (
                      <span className="badge badge-approved" style={{ opacity: 0.6 }}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center", 
              padding: "16px 24px", 
              backgroundColor: "var(--surface-2)", 
              borderTop: "1px solid var(--border)"
            }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Showing <strong>{Math.min(filteredRetailers.length, (currentPage - 1) * pageSize + 1)}</strong> to <strong>{Math.min(filteredRetailers.length, currentPage * pageSize)}</strong> of <strong>{filteredRetailers.length}</strong> stores
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{ padding: "6px 12px" }}
                >
                  ◀ Previous
                </button>
                <span style={{ display: "flex", alignItems: "center", padding: "0 8px", fontSize: 13, color: "var(--text)" }}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{ padding: "6px 12px" }}
                >
                  Next ▶
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
