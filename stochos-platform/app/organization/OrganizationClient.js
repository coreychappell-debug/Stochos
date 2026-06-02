"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

const COMMISSION_OVERSIGHT = {
  name: "Brian O'Dwyer",
  role: "Commission Chairman",
  office: "Executive Chamber",
  bio: "Appointed by the Governor to oversee all state gaming, wagering, lottery operations, and regulatory compliance. Approves major actions during public meetings, not from within the system.",
  email: "brian.odwyer@gaming.ny.gov",
  phone: "(518) 388-3300",
  avatar: "BO"
};

const REGIONAL_OFFICES = [
  {
    name: "Schenectady Headquarters",
    address: "354 Broadway, Schenectady, NY 12305",
    phone: "(518) 388-3300",
    hours: "Mon – Fri, 8:30 AM – 4:30 PM",
    type: "Main Headquarters & Claim Center"
  },
  {
    name: "New York City Regional Office",
    address: "15 Beaver Street, New York, NY 10004",
    phone: "(212) 383-1317",
    hours: "Mon – Fri, 8:30 AM – 4:30 PM",
    type: "NYC Regional Center & Claim Office"
  },
  {
    name: "Long Island Customer Service Center",
    address: "45 South Service Road, Plainview, NY 11803",
    phone: "(516) 222-8224",
    hours: "Mon – Fri, 8:30 AM – 4:30 PM",
    type: "Plainview Claim Office"
  },
  {
    name: "Rochester Customer Service Center",
    address: "First Federal Plaza, 28 East Main Street, Rochester, NY 14614",
    phone: "(585) 246-4200",
    hours: "Mon – Fri, 8:30 AM – 4:30 PM",
    type: "Rochester Claim Office"
  },
  {
    name: "Buffalo Customer Service Center",
    address: "165 Genesee Street, Buffalo, NY 14203",
    phone: "(716) 847-3480",
    hours: "Mon – Fri, 8:30 AM – 4:30 PM",
    type: "Buffalo Claim Office"
  }
];

const PRESET_ORDER = ["EXECUTIVE", "FINANCE", "MARKETING", "OPERATIONS", "IT", "PROCUREMENT"];
const COLORS = ["executive", "finance", "marketing", "operations", "it", "procurement"];

const PRESET_LABELS = {
  EXECUTIVE: "Executive & Admin",
  FINANCE: "Finance & Audit",
  MARKETING: "Marketing & Sales",
  OPERATIONS: "Operations & Print",
  IT: "Information Technology",
  PROCUREMENT: "Procurement & Bidding"
};

const PRESET_DESCS = {
  EXECUTIVE: "Strategic planning, agency oversight, governance, and general counsel.",
  FINANCE: "Budget authorization, accounting audits, claims verification, and retailer pricing.",
  MARKETING: "Creative campaigns, media placements, event promotions, and customer research.",
  OPERATIONS: "Instant ticket production logistics, VLT determinant networks, and sales support.",
  IT: "Enterprise mainframe systems, wide-area networking, hardware assets, and SLA tracking.",
  PROCUREMENT: "RFP specifications, vendor contract lifecycle management, and surety bonds review."
};

function formatDivisionLabel(div) {
  if (PRESET_LABELS[div]) return PRESET_LABELS[div];
  return div
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function getDivisionDescription(div) {
  if (PRESET_DESCS[div]) return PRESET_DESCS[div];
  return `Responsible for managing the operational administration and coordinating contracts for the ${formatDivisionLabel(div)} division.`;
}

function formatCurrency(val) {
  if (val === null || val === undefined) return "$0";
  const num = parseFloat(val);
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function OrganizationClient({ initialUsers }) {
  // Dynamically extract unique divisions present on user records in the database
  const divisionsList = useMemo(() => {
    const unique = Array.from(new Set(initialUsers.map((u) => u.division).filter(Boolean)));
    return unique.sort((a, b) => {
      const idxA = PRESET_ORDER.indexOf(a);
      const idxB = PRESET_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [initialUsers]);

  const [selectedDivision, setSelectedDivision] = useState(() => {
    const preset = "OPERATIONS";
    if (divisionsList.includes(preset)) return preset;
    return divisionsList[0] || "";
  });

  const [searchTerm, setSearchTerm] = useState("");

  const getDivisionColor = (div) => {
    const idx = divisionsList.indexOf(div);
    if (idx !== -1) {
      return COLORS[idx % COLORS.length];
    }
    return "surface-4";
  };

  // Map users to their respective divisions
  const divisionalUsers = useMemo(() => {
    const map = {};
    divisionsList.forEach((div) => {
      map[div] = [];
    });
    initialUsers.forEach((u) => {
      if (map[u.division]) {
        map[u.division].push(u);
      }
    });
    return map;
  }, [initialUsers, divisionsList]);

  // Compute portfolio metrics per division dynamically
  const divisionMetrics = useMemo(() => {
    const metrics = {};
    divisionsList.forEach((div) => {
      const users = divisionalUsers[div] || [];
      let totalContracts = 0;
      let cumulativeValue = 0;
      let cumulativeSpent = 0;
      let activeContracts = 0;

      users.forEach((u) => {
        u.contractsCreated?.forEach((c) => {
          totalContracts++;
          cumulativeValue += parseFloat(c.totalValue) || 0;
          if (c.status === "active") {
            activeContracts++;
          }
          c.lineItems?.forEach((li) => {
            cumulativeSpent += parseFloat(li.spentAmount) || 0;
          });
        });
      });

      metrics[div] = {
        totalContracts,
        activeContracts,
        cumulativeValue,
        cumulativeSpent,
        budgetPct: cumulativeValue > 0 ? (cumulativeSpent / cumulativeValue) * 100 : 0
      };
    });
    return metrics;
  }, [divisionalUsers, divisionsList]);

  // Extract the executive leadership dynamically from user database records
  const executiveLeadership = useMemo(() => {
    const targets = [
      "robert.williams@gaming.ny.gov",
      "steven.lowenstein@gaming.ny.gov",
      "edmund.burns@gaming.ny.gov",
      "brad.maione@gaming.ny.gov"
    ];
    return initialUsers.filter((u) => targets.includes(u.email));
  }, [initialUsers]);

  // Filtered users for search functionality
  const filteredUsers = useMemo(() => {
    if (!searchTerm) return initialUsers;
    const q = searchTerm.toLowerCase();
    return initialUsers.filter((u) => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.division.toLowerCase().includes(q) ||
      u.contractsCreated?.some(c => c.title.toLowerCase().includes(q))
    );
  }, [initialUsers, searchTerm]);

  const activeDivUsers = divisionalUsers[selectedDivision] || [];
  const activeDivMetrics = divisionMetrics[selectedDivision] || { totalContracts: 0, cumulativeValue: 0, cumulativeSpent: 0, budgetPct: 0 };
  const activeColor = getDivisionColor(selectedDivision);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      
      {/* Search and Navigation Directory Search */}
      <div className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>NYSGC Agency Directory Search</h3>
            <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 13 }}>Quickly locate personnel, division coordinates, or active contract owners.</p>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="Search staff, emails, divisions, or contracts..."
            style={{ maxWidth: 360, width: "100%", background: "var(--surface-3)" }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {searchTerm && (
          <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <h4 style={{ margin: "0 0 12px 0" }}>Search Results ({filteredUsers.length})</h4>
            {filteredUsers.length === 0 ? (
              <p className="muted">No matches found for "{searchTerm}"</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filteredUsers.map((u) => (
                  <div key={u.id} className="card" style={{ padding: 12, borderLeft: `4px solid var(--${getDivisionColor(u.division)})` }}>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{u.email}</div>
                    <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className={`badge badge-${getDivisionColor(u.division)}`}>{formatDivisionLabel(u.division)}</span>
                      <span className="muted" style={{ fontSize: 11 }}>{u.contractsCreated?.length || 0} Contracts</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* STATUTORY COMMISSION CARD & DYNAMIC EXECUTIVE LEADERSHIP BOARD */}
      <div>
        <h3 style={{ marginBottom: 16 }}>
          Commission Oversight &amp; Executive Directors
        </h3>
        
        {/* Brian O'Dwyer Statutory Oversight Card */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginBottom: 24 }}>
          <div className="card" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", background: "linear-gradient(135deg, var(--surface-2), var(--surface-1))", border: "1px solid var(--gold)" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "var(--gold)" }} />
            <div className="card-body" style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: "rgba(255, 159, 67, 0.15)",
                  color: "var(--gold)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 18
                }}>
                  {COMMISSION_OVERSIGHT.avatar}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{COMMISSION_OVERSIGHT.name}</h4>
                    <span className="badge badge-executive">{COMMISSION_OVERSIGHT.role}</span>
                    <span className="badge badge-expired" style={{ fontSize: 10, background: "rgba(230, 57, 70, 0.15)", color: "#e63946" }}>Statutory Board Oversight Only</span>
                  </div>
                  <p style={{ fontSize: 13, margin: "8px 0 0 0", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                    {COMMISSION_OVERSIGHT.bio}
                  </p>
                </div>
                <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 4, minWidth: 200, paddingLeft: 16, borderLeft: "1px solid var(--border)" }}>
                  <div><span className="muted">Office:</span> {COMMISSION_OVERSIGHT.office}</div>
                  <div><span className="muted">Email:</span> {COMMISSION_OVERSIGHT.email}</div>
                  <div><span className="muted">Phone:</span> {COMMISSION_OVERSIGHT.phone}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Executive Leadership cards loaded from database */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {executiveLeadership.map((officer) => (
            <div key={officer.id} className="card" style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: "linear-gradient(90deg, var(--blue), var(--purple))" }} />
              <div className="card-body" style={{ display: "flex", flexDirection: "column", flex: 1, padding: 20 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(0,180,216,0.15)",
                    color: "#48cae4",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 16
                  }}>
                    {officer.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{officer.name}</h4>
                    <span className="badge badge-executive" style={{ fontSize: 11 }}>
                      {officer.email.includes("williams") ? "Executive Director" : officer.email.includes("lowenstein") ? "Deputy Executive Director" : officer.email.includes("burns") ? "General Counsel" : "Director of Communications"}
                    </span>
                  </div>
                </div>
                
                <p style={{ fontSize: 13, lineHeight: 1.4, flex: 1, margin: "0 0 16px 0", color: "var(--text-secondary)" }}>
                  {officer.email.includes("williams") 
                    ? "Chief executive officer of the lottery, approving master technology system integrations and print runs." 
                    : officer.email.includes("lowenstein")
                    ? "Oversees agency logistics, network infrastructure contracts, and secondary scratch ticket planning."
                    : officer.email.includes("burns")
                    ? "Manages regulatory legal compliance, game validity, and player insight audit contracts."
                    : "Directs media buying services, advertising slot placements, and regional promotions."}
                </p>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, fontSize: 12, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Direct Reports:</span>
                    <span>{officer.staff?.length || 0} staff</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Email:</span>
                    <a href={`mailto:${officer.email}`} className="muted hover-underline" style={{ color: "var(--blue)" }}>{officer.email}</a>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="muted">Manager:</span>
                    <span>{officer.manager?.name || "Statutory Board"}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. HIERARCHY FLOW VISUALIZATION */}
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ marginTop: 0, marginBottom: 8 }}>
          NYSGC Operational Structure &amp; Contract Routing Flow
        </h3>
        <p className="muted" style={{ margin: "0 0 24px 0", fontSize: 13 }}>Click a division card below to load the staff and contract portfolio details.</p>

        {/* Dynamic visual org hierarchy nodes */}
        {divisionsList.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            
            {/* Executive Director Level */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div className="card" style={{ 
                padding: "10px 24px", 
                background: "linear-gradient(135deg, var(--surface-2), var(--surface-1))",
                border: "1px solid var(--gold)",
                borderRadius: 30,
                boxShadow: "0 0 15px rgba(255, 159, 67, 0.15)",
                textAlign: "center"
              }}>
                <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 700, letterSpacing: "1px" }}>EXECUTIVE LEADERSHIP</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Robert Williams (Director)</div>
              </div>
              <div style={{ width: 2, height: 24, background: "var(--border)" }} />
            </div>

            {/* Division horizontal row - dynamically builds based on divisionsList */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: `repeat(${divisionsList.length}, 1fr)`, 
              gap: 12, 
              width: "100%", 
              position: "relative" 
            }}>
              {/* Horizontal line bridge connecting all elements dynamically */}
              <div style={{ 
                position: "absolute", 
                top: 0, 
                left: `calc(100% / (${divisionsList.length} * 2))`, 
                right: `calc(100% / (${divisionsList.length} * 2))`, 
                height: 2, 
                background: "var(--border)" 
              }} />
              
              {divisionsList.map((key) => {
                const active = selectedDivision === key;
                const metrics = divisionMetrics[key] || { totalContracts: 0, cumulativeValue: 0 };
                const color = getDivisionColor(key);
                return (
                  <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <div style={{ width: 2, height: 16, background: "var(--border)", marginBottom: 8 }} />
                    <button 
                      onClick={() => setSelectedDivision(key)}
                      style={{
                        width: "100%",
                        padding: 12,
                        background: active ? `var(--surface-3)` : `var(--surface-1)`,
                        border: active ? `2px solid var(--${color})` : `1px solid var(--border)`,
                        borderRadius: "var(--radius-md)",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all var(--transition)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: active ? `0 0 15px rgba(var(--text), 0.05)` : "none"
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 600, color: active ? `var(--text)` : `var(--text-secondary)` }}>{formatDivisionLabel(key)}</span>
                      <div style={{ borderTop: "1px solid var(--border)", width: "100%", paddingTop: 4, marginTop: 4, fontSize: 10 }} className="muted">
                        {metrics.totalContracts} Contracts
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

      {/* 3. SELECTED DIVISION EXPLORER PANEL */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        
        {/* Left Side: Division Info & Staff Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="card" style={{ borderLeft: `5px solid var(--${activeColor})` }}>
            <div className="card-header" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0 }}>{formatDivisionLabel(selectedDivision)}</h3>
                <span className="muted" style={{ fontSize: 11, textTransform: "uppercase" }}>Division Profile</span>
              </div>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, lineHeight: 1.5, margin: "0 0 20px 0" }}>{getDivisionDescription(selectedDivision)}</p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Divisional Staff count:</span>
                  <span>{activeDivUsers.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Active Contracts:</span>
                  <span>{activeDivMetrics.activeContracts}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">Cumulative Portfolio:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(activeDivMetrics.cumulativeValue)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h4 style={{ margin: 0 }}>Divisional Staff Accounts</h4>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {activeDivUsers.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>No seeded staff registered in this division.</p>
              ) : (
                activeDivUsers.map((u) => (
                  <div key={u.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)", lastChild: { borderBottom: "none" } }}>
                    <div style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: `rgba(255,255,255,0.05)`,
                      color: `var(--text)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: 13
                    }}>
                      {u.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{u.email}</div>
                      
                      <div style={{ marginTop: 8, fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }} className="muted">
                        {u.manager && (
                          <div>
                            <span className="muted">Manager:</span> {u.manager.name}
                          </div>
                        )}
                        {u.staff?.length > 0 && (
                          <div>
                            <span className="muted">Direct Reports:</span> {u.staff.map(s => s.name).join(", ")}
                          </div>
                        )}
                      </div>
                      
                      <div style={{ marginTop: 8 }}>
                        <span className={`badge badge-${activeColor}`} style={{ fontSize: 10, padding: "1px 6px" }}>{u.email.includes("user") ? "Division Manager" : "Executive Leadership"}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Contract Portfolio Board */}
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <div>
              <h3 style={{ margin: 0 }}>Contract Portfolio Registry</h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12 }}>Detailed agreements, SLA lines, and budget parameters managed by this division.</p>
            </div>
            <span className={`badge badge-${activeColor}`}>{formatDivisionLabel(selectedDivision)}</span>
          </div>
          
          <div className="card-body">
            
            {/* Division KPI Overview */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
              <div className="kpi-card kpi-blue" style={{ padding: 12 }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Portfolio Value</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{formatCurrency(activeDivMetrics.cumulativeValue)}</div>
              </div>
              <div className="kpi-card kpi-green" style={{ padding: 12 }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Budget Spent</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{formatCurrency(activeDivMetrics.cumulativeSpent)}</div>
              </div>
              <div className="kpi-card kpi-purple" style={{ padding: 12 }}>
                <div className="kpi-label" style={{ fontSize: 10 }}>Utilization</div>
                <div className="kpi-value" style={{ fontSize: 18 }}>{activeDivMetrics.budgetPct.toFixed(1)}%</div>
              </div>
            </div>

            {/* Division Contracts Table */}
            {activeDivUsers.length === 0 || !activeDivUsers.some(u => u.contractsCreated?.length > 0) ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <h3>No divisional contracts</h3>
                <p>No procurement contracts are assigned or routed to this division.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract / Vendor</th>
                    <th>Value</th>
                    <th>Spent</th>
                    <th>Status</th>
                    <th>Owner</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activeDivUsers.flatMap((u) => 
                    (u.contractsCreated || []).map((c) => {
                      const spent = c.lineItems?.reduce((sum, li) => sum + (parseFloat(li.spentAmount) || 0), 0) || 0;
                      return (
                        <tr key={c.id}>
                          <td>
                            <Link href={`/contracts/${c.id}`} style={{ fontWeight: 600, fontSize: 13, textDecoration: "none", color: "var(--blue)" }}>
                              {c.title}
                            </Link>
                            <div className="muted" style={{ fontSize: 11 }}>Vendor: {c.vendor?.name || "—"}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{formatCurrency(c.totalValue)}</td>
                          <td style={{ fontSize: 13 }} className="muted">{formatCurrency(spent)}</td>
                          <td>
                            <span className={`badge badge-${c.status}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="muted" style={{ fontSize: 12 }}>{u.name}</td>
                          <td style={{ textAlign: "right" }}>
                            <Link href={`/contracts/${c.id}`} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", fontSize: 11, textDecoration: "none" }}>
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* 4. REGIONAL OFFICES & CUSTOMER SERVICE CENTERS DIRECTORY */}
      <div>
        <h3 style={{ marginBottom: 16 }}>
          NYSGC Customer Service Centers &amp; Offices
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {REGIONAL_OFFICES.map((office, i) => (
            <div key={i} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{office.name}</div>
              <div className="badge badge-executive" style={{ fontSize: 10, marginBottom: 12, display: "inline-block" }}>{office.type}</div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div>
                  <span className="muted" style={{ display: "block", marginBottom: 2 }}>Address:</span>
                  <span>{office.address}</span>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", marginBottom: 2 }}>Phone:</span>
                  <a href={`tel:${office.phone.replace(/[^0-9]/g, "")}`} className="hover-underline" style={{ color: "var(--blue)" }}>{office.phone}</a>
                </div>
                <div>
                  <span className="muted" style={{ display: "block", marginBottom: 2 }}>Hours:</span>
                  <span className="muted">{office.hours}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
