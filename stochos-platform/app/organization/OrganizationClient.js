"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { FolderTree, Users, FileSpreadsheet, Upload, Download, CheckCircle2, AlertTriangle, Building2, HelpCircle, Shield, Network, Briefcase, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

const PRESET_ORDER = ["EXECUTIVE", "FINANCE", "HR", "MARKETING", "OPERATIONS", "IT", "PROCUREMENT"];
const COLORS = {
  COMMISSION: "executive",
  EXECUTIVE: "executive",
  DIVISION: "finance",
  BUREAU: "operations",
  SUBUNIT: "marketing"
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
    address: "400 Oak St, Garden City, NY 11530",
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

function formatCurrency(val) {
  if (val === null || val === undefined) return "$0";
  const num = parseFloat(val);
  if (isNaN(num)) return "$0";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function OrganizationClient({ initialUsers = [], initialOrgUnits = [], initialRoles = [] }) {
  const [users, setUsers] = useState(initialUsers);
  const [orgUnits, setOrgUnits] = useState(initialOrgUnits);
  const [roles, setRoles] = useState(initialRoles);
  const { data: session } = useSession();
  const currentUser = session?.user;

  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingUserRole, setSavingUserRole] = useState("");
  const [modifiedRoles, setModifiedRoles] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  // Selected Org Node ID state (defaults to the root commission node)
  const [selectedUnitId, setSelectedUnitId] = useState(() => {
    const root = initialOrgUnits.find(u => !u.parentId);
    return root ? root.id : "";
  });

  // Collapsible tree nodes state
  const [expandedNodes, setExpandedNodes] = useState(() => {
    const initial = {};
    initialOrgUnits.forEach(u => {
      // Expand top levels by default
      if (u.type === "COMMISSION" || u.type === "EXECUTIVE" || u.type === "DIVISION") {
        initial[u.id] = true;
      }
    });
    return initial;
  });

  const [activeTab, setActiveTab] = useState("directory"); // "directory" | "ingestion" | "permissions"
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);
  const [isRosterCollapsed, setIsRosterCollapsed] = useState(false);

  // Ingestion upload states
  const [uploadingUnits, setUploadingUnits] = useState(false);
  const [unitsFile, setUnitsFile] = useState(null);
  const [unitsStatus, setUnitsStatus] = useState(null);

  const [uploadingStaff, setUploadingStaff] = useState(false);
  const [staffFile, setStaffFile] = useState(null);
  const [staffStatus, setStaffStatus] = useState(null);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");

  // Build Hierarchical Org Tree
  const orgTree = useMemo(() => {
    const roots = orgUnits.filter(u => !u.parentId);
    const childrenMap = new Map();
    orgUnits.forEach(u => {
      if (u.parentId) {
        if (!childrenMap.has(u.parentId)) {
          childrenMap.set(u.parentId, []);
        }
        childrenMap.get(u.parentId).push(u);
      }
    });

    const buildSubTree = (node) => {
      const children = childrenMap.get(node.id) || [];
      return {
        ...node,
        children: children.map(c => buildSubTree(c))
      };
    };

    return roots.map(r => buildSubTree(r));
  }, [orgUnits]);

  const toggleNodeExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Get selected unit details
  const selectedUnit = useMemo(() => {
    return orgUnits.find(u => u.id === selectedUnitId) || null;
  }, [orgUnits, selectedUnitId]);

  // Recursively gather all unit IDs inside a subtree
  const getSubtreeUnitIds = (unitId) => {
    const ids = [unitId];
    const children = orgUnits.filter(u => u.parentId === unitId);
    children.forEach(c => {
      ids.push(...getSubtreeUnitIds(c.id));
    });
    return ids;
  };

  // Find all users belonging to selected unit or any of its sub-branches
  const filteredTreeUsers = useMemo(() => {
    if (!selectedUnitId) return [];
    const subtreeIds = getSubtreeUnitIds(selectedUnitId);
    return users.filter(u => u.orgUnitId && subtreeIds.includes(u.orgUnitId));
  }, [users, selectedUnitId, orgUnits]);

  // Roster Local Search and Page Limit State
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterLimit, setRosterLimit] = useState(10);

  // Reset local search and limit on unit change
  useEffect(() => {
    setRosterSearch("");
    setRosterLimit(10);
  }, [selectedUnitId]);

  const fetchAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const res = await fetch("/api/organization/audit");
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === "permissions") {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handlePermissionChange = (roleId, resource, level) => {
    setModifiedRoles(prev => {
      const currentRole = roles.find(r => r.id === roleId);
      const currentPerms = prev[roleId] || { ...currentRole.permissions };
      
      const newPerms = { ...currentPerms, [resource]: level };
      
      const isOriginal = JSON.stringify(newPerms) === JSON.stringify(currentRole.permissions);
      if (isOriginal) {
        const next = { ...prev };
        delete next[roleId];
        return next;
      }
      
      return { ...prev, [roleId]: newPerms };
    });
  };

  const handleSaveRolePermissions = async (roleId) => {
    const newPermissions = modifiedRoles[roleId];
    if (!newPermissions) return;
    
    setSavingPermissions(true);
    try {
      const res = await fetch("/api/organization/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId, permissions: newPermissions })
      });
      
      if (res.ok) {
        setRoles(prev => prev.map(r => r.id === roleId ? { ...r, permissions: newPermissions } : r));
        setModifiedRoles(prev => {
          const next = { ...prev };
          delete next[roleId];
          return next;
        });
        alert("Role permissions successfully updated!");
        fetchAuditLogs();
      } else {
        const data = await res.json();
        alert(`Failed to save role permissions: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error saving permissions.");
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleUpdateUserAccess = async (targetUserId, updates) => {
    setSavingUserRole(targetUserId);
    try {
      const res = await fetch("/api/organization/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, ...updates })
      });
      
      if (res.ok) {
        const data = await res.json();
        setUsers(prev => prev.map(u => u.id === targetUserId ? { ...u, ...data.user } : u));
        fetchAuditLogs();
      } else {
        const data = await res.json();
        alert(`Failed to update user access: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error updating user access.");
    } finally {
      setSavingUserRole("");
    }
  };

  const renderAuditChanges = (log) => {
    try {
      const changes = typeof log.changes === 'string' ? JSON.parse(log.changes) : log.changes;
      if (!changes) return <span className="muted">—</span>;

      if (log.action === 'override_release') {
        return (
          <div style={{ fontSize: 11, lineHeight: 1.3 }}>
            <div>🔓 <strong>Override Action:</strong> {changes.message || `Lock ${changes.lockKey} forced release`}</div>
            <div className="muted" style={{ fontSize: 10 }}>Previous Owner: {changes.previousOwnerName} ({changes.previousOwnerId})</div>
          </div>
        );
      }

      if (log.action === 'job_timeout') {
        return (
          <div style={{ fontSize: 11, lineHeight: 1.3, color: "var(--red)" }}>
            ⚠️ <strong>Timeout Alert:</strong> {changes.message}
          </div>
        );
      }

      if (log.entityType === 'Role') {
        return (
          <div style={{ fontSize: 11, lineHeight: 1.3 }}>
            <div>🔧 Updated role: <strong>{changes.roleName}</strong></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {Object.entries(changes.after || {}).map(([res, val]) => {
                const prev = changes.before?.[res] || 'none';
                if (prev === val) return null;
                return (
                  <span key={res} className="badge badge-info" style={{ fontSize: 9 }}>
                    {res}: {prev} ➔ {val}
                  </span>
                );
              })}
            </div>
          </div>
        );
      }

      if (log.entityType === 'User') {
        return (
          <div style={{ fontSize: 11, lineHeight: 1.3 }}>
            <div>👤 Target: <strong>{changes.targetUserName}</strong> ({changes.targetUserEmail})</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {Object.entries(changes.after || {}).map(([field, val]) => {
                const prev = changes.before?.[field] || '—';
                if (prev === val) return null;
                return (
                  <span key={field} className="badge badge-info" style={{ fontSize: 9 }}>
                    {field.replace("Id", "Name")}: {prev} ➔ {val}
                  </span>
                );
              })}
            </div>
          </div>
        );
      }

      return <pre style={{ margin: 0, fontSize: 10, maxWidth: 300, overflowX: "auto" }}>{JSON.stringify(changes)}</pre>;
    } catch (e) {
      return <pre style={{ margin: 0, fontSize: 10 }}>{String(log.changes)}</pre>;
    }
  };

  // Filter roster by local search
  const searchedRosterUsers = useMemo(() => {
    if (!rosterSearch) return filteredTreeUsers;
    const q = rosterSearch.toLowerCase();
    return filteredTreeUsers.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.subunit && u.subunit.toLowerCase().includes(q)) ||
      (u.bureau && u.bureau.toLowerCase().includes(q)) ||
      (u.division && u.division.toLowerCase().includes(q))
    );
  }, [filteredTreeUsers, rosterSearch]);

  // Paginated roster users
  const displayedRosterUsers = useMemo(() => {
    if (rosterLimit === 'all') return searchedRosterUsers;
    return searchedRosterUsers.slice(0, rosterLimit);
  }, [searchedRosterUsers, rosterLimit]);

  // Global directory search results
  const globalSearchResults = useMemo(() => {
    if (!searchTerm) return [];
    const q = searchTerm.toLowerCase();
    return users.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.division && u.division.toLowerCase().includes(q)) ||
      (u.orgUnit?.name && u.orgUnit.name.toLowerCase().includes(q))
    );
  }, [users, searchTerm]);

  // Compute metrics for the selected unit (including sub-branches)
  const selectedUnitMetrics = useMemo(() => {
    let totalContracts = 0;
    let cumulativeValue = 0;
    let cumulativeSpent = 0;
    let activeContracts = 0;

    filteredTreeUsers.forEach((u) => {
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

    return {
      totalContracts,
      activeContracts,
      cumulativeValue,
      cumulativeSpent,
      budgetPct: cumulativeValue > 0 ? (cumulativeSpent / cumulativeValue) * 100 : 0
    };
  }, [filteredTreeUsers]);

  // Helper to resolve icon for each node type
  const getNodeIcon = (type) => {
    switch (type) {
      case "COMMISSION":
        return <Building2 size={13} style={{ color: "var(--executive)" }} />;
      case "EXECUTIVE":
        return <Shield size={13} style={{ color: "var(--executive)" }} />;
      case "DIVISION":
        return <Network size={13} style={{ color: "var(--finance)" }} />;
      case "BUREAU":
        return <Briefcase size={13} style={{ color: "var(--operations)" }} />;
      case "SUBUNIT":
        return <Users size={13} style={{ color: "var(--marketing)" }} />;
      default:
        return <FolderTree size={13} />;
    }
  };

  // Recursively render org tree nodes with guidelines and type-specific icons
  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const isSelected = selectedUnitId === node.id;
    const colorClass = COLORS[node.type] || "surface-4";

    return (
      <div key={node.id} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div 
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 6,
            cursor: "pointer",
            backgroundColor: isSelected ? "var(--surface-3)" : "transparent",
            borderLeft: isSelected ? `3px solid var(--${colorClass})` : "3px solid transparent",
            fontSize: 12.5,
            fontWeight: isSelected ? 600 : 500,
            color: isSelected ? "var(--text)" : "var(--text-secondary)",
            transition: "all 0.15s ease",
            boxShadow: isSelected ? "inset 0 0 10px rgba(255,255,255,0.05)" : "none"
          }}
          className="tree-node-row"
          onClick={() => setSelectedUnitId(node.id)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpand(node.id);
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 10,
                width: 14,
                cursor: "pointer",
                padding: 0,
                textAlign: "center",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.15s ease",
                transform: isExpanded ? "rotate(0deg)" : "rotate(-90deg)"
              }}
            >
              ▼
            </button>
          ) : (
            <span style={{ width: 14 }} />
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {getNodeIcon(node.type)}
          </div>

          <span 
            className={`badge badge-${colorClass}`} 
            style={{ 
              fontSize: 8, 
              padding: "1.5px 5px", 
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              lineHeight: "1.1",
              fontWeight: 700,
              borderRadius: "4px",
              flexShrink: 0
            }}
          >
            {node.type.toLowerCase()}
          </span>
          <span style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", flexShrink: 0 }}>[{node.code}]</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{node.name}</span>
        </div>
        {hasChildren && isExpanded && (
          <div 
            style={{ 
              display: "flex", 
              flexDirection: "column", 
              gap: 2,
              borderLeft: "1px dashed var(--border)",
              marginLeft: 18, 
              paddingLeft: 10
            }}
          >
            {node.children.map(c => renderTreeNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Download CSV templates client-side
  const downloadTemplate = (type) => {
    let csvContent = "";
    let filename = "";
    
    if (type === "units") {
      csvContent = "Code,Name,Type,ParentCode\n1.0.0,New York State Gaming Commission,COMMISSION,\n1.1.0,Executive Chamber & Leadership,EXECUTIVE,1.0.0\n1.1.1,Division of Lottery Operations (Operations),DIVISION,1.1.0\n1.1.2,Division of Financial Management (Finance),DIVISION,1.1.0\n1.1.6,Division of Human Resources Management (HR),DIVISION,1.1.0\n1.1.1.1,Schenectady Operations Bureau,BUREAU,1.1.1\n1.1.1.1.1,Schenectady Field Sales Subunit,SUBUNIT,1.1.1.1\n1.1.1.2,Buffalo Operations Bureau,BUREAU,1.1.1\n1.1.1.2.1,Buffalo Field Sales Subunit,SUBUNIT,1.1.1.2\n";
      filename = "stochos_org_units_template.csv";
    } else {
      csvContent = "Name,Email,OrgUnitCode,ManagerEmail,Status\nRobert Williams,robert.williams@gaming.ny.gov,1.1.0,,active\nSchenectady Manager,manager.schenectady@gaming.ny.gov,1.1.1.1,robert.williams@gaming.ny.gov,active\nSarah Jenkins,rep.sarah.jenkins@gaming.ny.gov,1.1.1.1.1,manager.schenectady@gaming.ny.gov,active\n";
      filename = "stochos_staff_template.csv";
    }
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upload handlers
  const handleUploadUnits = async (e) => {
    e.preventDefault();
    if (!unitsFile) return;

    setUploadingUnits(true);
    setUnitsStatus(null);

    const formData = new FormData();
    formData.append("file", unitsFile);

    try {
      const res = await fetch("/api/organization/units/import", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUnitsStatus({ success: true, message: data.message });
        // Refresh local units data
        const getUnitsRes = await fetch("/api/organization/units");
        const getUnitsData = await getUnitsRes.json();
        if (getUnitsData.success) {
          setOrgUnits(getUnitsData.units);
        }
      } else {
        setUnitsStatus({ success: false, message: data.error || "Failed to upload organizational units." });
      }
    } catch (err) {
      console.error(err);
      setUnitsStatus({ success: false, message: "Network error occurred." });
    } finally {
      setUploadingUnits(false);
    }
  };

  const handleUploadStaff = async (e) => {
    e.preventDefault();
    if (!staffFile) return;

    setUploadingStaff(true);
    setStaffStatus(null);

    const formData = new FormData();
    formData.append("file", staffFile);

    try {
      const res = await fetch("/api/organization/users/import", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setStaffStatus({ success: true, message: data.message });
        // Refresh page data or fetch updated users
        window.location.reload();
      } else {
        setStaffStatus({ success: false, message: data.error || "Failed to upload staff." });
      }
    } catch (err) {
      console.error(err);
      setStaffStatus({ success: false, message: "Network error occurred." });
    } finally {
      setUploadingStaff(false);
    }
  };

  const userHasAccess = useMemo(() => {
    if (!currentUser?.email) return false;
    const dbUser = users.find(u => u.email.toLowerCase() === currentUser.email.toLowerCase());
    const roleName = dbUser?.role?.name || currentUser.role || "";
    return roleName === "admin" || roleName === "it_manager";
  }, [users, currentUser]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      
      {/* Sub tabs navigation */}
      <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 1 }}>
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`btn ${activeTab === "directory" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "6px 6px 0 0", padding: "8px 16px", borderBottom: "none", fontSize: 13 }}
        >
          <FolderTree size={14} style={{ marginRight: 6 }} /> Directory &amp; Tree Explorer
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ingestion")}
          className={`btn ${activeTab === "ingestion" ? "btn-primary" : "btn-secondary"}`}
          style={{ borderRadius: "6px 6px 0 0", padding: "8px 16px", borderBottom: "none", fontSize: 13 }}
        >
          <Upload size={14} style={{ marginRight: 6 }} /> Org Data Ingestion Tool
        </button>
        {userHasAccess && (
          <button
            type="button"
            onClick={() => setActiveTab("permissions")}
            className={`btn ${activeTab === "permissions" ? "btn-primary" : "btn-secondary"}`}
            style={{ borderRadius: "6px 6px 0 0", padding: "8px 16px", borderBottom: "none", fontSize: 13 }}
          >
            <Shield size={14} style={{ marginRight: 6 }} /> Permissions &amp; Security Audits
          </button>
        )}
      </div>

      {activeTab === "directory" && (
        <>
          {/* SEARCH BAR CARD */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>NYSGC Agency Directory Search</h3>
                <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 11.5 }}>Search personnel, emails, or contract coordinators across New York.</p>
              </div>
              <input
                type="text"
                className="search-input"
                placeholder="Type name, email, or division to search..."
                style={{ maxWidth: 360, width: "100%", height: 34, fontSize: 12 }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {searchTerm && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <h4 style={{ margin: "0 0 10px 0", fontSize: 12 }}>Search Results ({globalSearchResults.length})</h4>
                {globalSearchResults.length === 0 ? (
                  <p className="muted" style={{ fontSize: 12 }}>No matches found for "{searchTerm}"</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
                    {globalSearchResults.map((u) => (
                      <div key={u.id} className="card" style={{ padding: 10, borderLeft: `3px solid var(--${COLORS[u.orgUnit?.type] || "finance"})` }}>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{u.name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{u.email}</div>
                        <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className={`badge badge-${COLORS[u.orgUnit?.type] || "finance"}`} style={{ fontSize: 8.5 }}>
                            {u.orgUnit?.name || u.division}
                          </span>
                          <span className="muted" style={{ fontSize: 10.5 }}>{u.contractsCreated?.length || 0} Contracts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MAIN DOCK SYSTEM: LEFT TREE EXPLORER, RIGHT CARD EXPLORER */}
          <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr", gap: 20, alignItems: "start" }}>
            
            {/* LEFT TREE NAV CONTAINER */}
            <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: isTreeCollapsed ? "auto" : "560px", transition: "all 0.2s ease" }}>
              <div 
                style={{ 
                  padding: "10px 14px", 
                  backgroundColor: "var(--surface-2)", 
                  borderBottom: isTreeCollapsed ? "none" : "1px solid var(--border)", 
                  fontWeight: 600, 
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  userSelect: "none",
                  gap: 6
                }}
                onClick={() => setIsTreeCollapsed(!isTreeCollapsed)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FolderTree size={14} style={{ color: "var(--blue)" }} />
                  <span>NYSGC Hierarchy Tree</span>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                  {isTreeCollapsed ? "Expand" : "Collapse"}
                </span>
              </div>
              {!isTreeCollapsed && (
                <div style={{ padding: 10, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                  {orgTree.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-muted)", fontSize: 12.5 }}>
                      No organizational units loaded. Use the Ingestion Tool to load CSV data.
                    </div>
                  ) : (
                    orgTree.map(r => renderTreeNode(r))
                  )}
                </div>
              )}
            </div>

            {/* RIGHT DETAILS PANEL */}
            {selectedUnit ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* UNIT DESCRIPTIVE KPI CARD */}
                <div className="card" style={{ borderLeft: `5px solid var(--${COLORS[selectedUnit.type] || "finance"})`, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div className="muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Node Code: <strong>{selectedUnit.code}</strong> &bull; {selectedUnit.type} Level
                      </div>
                      <h3 style={{ margin: "4px 0 0 0", fontSize: 18, fontWeight: 700 }}>{selectedUnit.name}</h3>
                    </div>
                    <span className={`badge badge-${COLORS[selectedUnit.type] || "finance"}`} style={{ padding: "3px 8px", fontSize: 10.5 }}>
                      {selectedUnit.type}
                    </span>
                  </div>

                  <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 18 }}>
                    <div className="kpi-card kpi-blue" style={{ padding: 10 }}>
                      <div className="kpi-label" style={{ fontSize: 10 }}>Portfolio Value</div>
                      <div className="kpi-value" style={{ fontSize: 16 }}>{formatCurrency(selectedUnitMetrics.cumulativeValue)}</div>
                    </div>
                    <div className="kpi-card kpi-green" style={{ padding: 10 }}>
                      <div className="kpi-label" style={{ fontSize: 10 }}>Total Spent</div>
                      <div className="kpi-value" style={{ fontSize: 16 }}>{formatCurrency(selectedUnitMetrics.cumulativeSpent)}</div>
                    </div>
                    <div className="kpi-card kpi-purple" style={{ padding: 10 }}>
                      <div className="kpi-label" style={{ fontSize: 10 }}>Active Contracts</div>
                      <div className="kpi-value" style={{ fontSize: 16 }}>{selectedUnitMetrics.activeContracts} / {selectedUnitMetrics.totalContracts}</div>
                    </div>
                  </div>
                </div>
                  {/* STAFF ROSTER CARD */}
                <div className="card" style={{ overflow: "hidden" }}>
                  <div 
                    style={{ 
                      padding: "10px 14px", 
                      backgroundColor: "var(--surface-2)", 
                      borderBottom: isRosterCollapsed ? "none" : "1px solid var(--border)", 
                      fontWeight: 600, 
                      fontSize: 12.5,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      cursor: "pointer",
                      userSelect: "none",
                      gap: 6
                    }}
                    onClick={() => setIsRosterCollapsed(!isRosterCollapsed)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Users size={14} style={{ color: "var(--blue)" }} />
                      <span>Registered Personnel ({filteredTreeUsers.length})</span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}>
                      {isRosterCollapsed ? "Expand" : "Collapse"}
                    </span>
                  </div>

                  {!isRosterCollapsed && (
                    <>
                      {filteredTreeUsers.length > 0 && (
                        <div style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          gap: 12, 
                          padding: '8px 14px', 
                          borderBottom: '1px solid var(--border)', 
                          backgroundColor: 'var(--surface-3)', 
                          flexWrap: 'wrap' 
                        }}>
                          <input 
                            type="text" 
                            placeholder="Search roster..."
                            value={rosterSearch}
                            onChange={e => setRosterSearch(e.target.value)}
                            style={{
                              padding: '5px 10px',
                              fontSize: '12px',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              backgroundColor: 'var(--surface-2)',
                              color: 'var(--text)',
                              width: '100%',
                              maxWidth: '220px',
                              outline: 'none'
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', color: 'var(--text-secondary)' }}>
                            <span>Show:</span>
                            <select
                              value={rosterLimit}
                              onChange={e => setRosterLimit(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                              style={{
                                padding: '4px 8px',
                                border: '1px solid var(--border)',
                                borderRadius: '4px',
                                backgroundColor: 'var(--surface-2)',
                                color: 'var(--text)',
                                fontSize: '12px',
                                cursor: 'pointer',
                                outline: 'none',
                                fontWeight: '600'
                              }}
                            >
                              <option value={10}>10</option>
                              <option value={25}>25</option>
                              <option value={50}>50</option>
                              <option value="all">All</option>
                            </select>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
                              (Showing {displayedRosterUsers.length} of {searchedRosterUsers.length})
                            </span>
                          </div>
                        </div>
                      )}

                      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredTreeUsers.length === 0 ? (
                          <p className="muted" style={{ margin: 0, padding: 10, textAlign: "center", fontSize: 12.5 }}>
                            No personnel registered in this unit or its nested sub-branches.
                          </p>
                        ) : searchedRosterUsers.length === 0 ? (
                          <p className="muted" style={{ margin: 0, padding: 10, textAlign: "center", fontSize: 12.5 }}>
                            No personnel matches found in this unit for "{rosterSearch}".
                          </p>
                        ) : (
                          <div style={{ overflowX: "auto" }}>
                            <table className="data-table" style={{ fontSize: 12 }}>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th>Org Branch Name</th>
                                  <th>Role</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {displayedRosterUsers.map((u) => (
                                  <tr key={u.id}>
                                    <td><strong>{u.name}</strong></td>
                                    <td className="muted">{u.email}</td>
                                    <td>{u.subunit || u.bureau || u.division}</td>
                                    <td>
                                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                        {u.email.includes("rep") ? "Sales Rep (LMR)" : u.email.includes("manager") ? "Regional Manager" : "Leadership"}
                                      </span>
                                    </td>
                                    <td>
                                      <span className={`badge ${u.status === "active" ? "badge-active" : "badge-expired"}`} style={{ fontSize: 9 }}>
                                        {u.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* ACTIVE CONTRACTS IN THIS BRANCH */}
                <div className="card">
                  <div 
                    style={{ 
                      padding: "10px 14px", 
                      backgroundColor: "var(--surface-2)", 
                      borderBottom: "1px solid var(--border)", 
                      fontWeight: 600, 
                      fontSize: 12.5,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <Building2 size={14} style={{ color: "var(--blue)" }} />
                    <span>Managed Vendor Contracts</span>
                  </div>
                  <div style={{ padding: 12 }}>
                    {!filteredTreeUsers.some(u => u.contractsCreated?.length > 0) ? (
                      <p className="muted" style={{ margin: 0, padding: 10, textAlign: "center", fontSize: 12.5 }}>
                        No procurement contracts are managed by staff in this branch.
                      </p>
                    ) : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="data-table" style={{ fontSize: 12 }}>
                          <thead>
                            <tr>
                              <th>Contract / Vendor</th>
                              <th>Total Value</th>
                              <th>Status</th>
                              <th>Manager</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTreeUsers.flatMap((u) => 
                              (u.contractsCreated || []).map((c) => (
                                <tr key={c.id}>
                                  <td>
                                    <Link href={`/contracts/${c.id}`} style={{ fontWeight: 600, color: "var(--blue)", textDecoration: "none" }}>
                                      {c.title}
                                    </Link>
                                    <div className="muted" style={{ fontSize: 10 }}>Vendor: {c.vendor?.name}</div>
                                  </td>
                                  <td><strong>{formatCurrency(c.totalValue)}</strong></td>
                                  <td>
                                    <span className={`badge badge-${c.status}`} style={{ fontSize: 9 }}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="muted">{u.name}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="card" style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                Select an organizational unit from the left hierarchy tree explorer to view detail panels, kpis, and staff logs.
              </div>
            )}

          </div>

          {/* COMMISSION OVERSIGHT & REGIONAL OFFICES CARDS */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 10 }}>
            <h3 style={{ marginBottom: 14, fontSize: 14, fontWeight: 700 }}>Commission Oversight &amp; Regional Offices</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {REGIONAL_OFFICES.map((office, idx) => (
                <div key={idx} className="card" style={{ padding: 12, fontSize: 12 }}>
                  <strong style={{ fontSize: 13, color: "var(--text)" }}>{office.name}</strong>
                  <div className="muted" style={{ margin: "2px 0 8px 0", fontSize: 10, textTransform: "uppercase" }}>{office.type}</div>
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                    <div><span className="muted">Address:</span> {office.address}</div>
                    <div><span className="muted">Phone:</span> {office.phone}</div>
                    <div><span className="muted">Hours:</span> {office.hours}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {activeTab === "ingestion" && (
        /* ORG DATA INGESTION TAB */
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          
          {/* UPLOAD HIERARCHY STRUCTURE CARD */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <FolderTree size={16} style={{ color: "var(--blue)" }} />
                <span>1. Upload Organizational Hierarchy (Branches)</span>
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12, lineHeight: 1.4 }}>
                Upload the tree nodes defining your agency units (Commission, Executive Leads, Divisions, Bureaus, and Subunits).
              </p>
            </div>

            <div style={{
              padding: "10px 14px",
              backgroundColor: "var(--surface-2)",
              borderLeft: "2.5px solid var(--blue)",
              borderRadius: "0 6px 6px 0",
              fontSize: 11.5,
              lineHeight: "1.45"
            }}>
              📋 <strong>Required Format:</strong> CSV file with headers: `Code, Name, Type, ParentCode`. <br/>
              <em>Example Types: COMMISSION, EXECUTIVE, DIVISION, BUREAU, SUBUNIT.</em>
            </div>

            <form onSubmit={handleUploadUnits} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setUnitsFile(e.target.files?.[0] || null)}
                  className="form-input" 
                  style={{ flex: 1, padding: "6px" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadTemplate("units")}
                  style={{ padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 4, height: 38 }}
                >
                  <Download size={13} /> Template
                </button>
              </div>

              {unitsStatus && (
                <div style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: unitsStatus.success ? "rgba(40, 167, 69, 0.08)" : "rgba(220, 53, 69, 0.08)",
                  borderLeft: `2.5px solid ${unitsStatus.success ? "var(--green)" : "var(--red)"}`,
                  color: unitsStatus.success ? "var(--green)" : "var(--red)"
                }}>
                  {unitsStatus.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{unitsStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploadingUnits || !unitsFile}
                style={{ justifyContent: "center", padding: "10px", marginTop: 8, display: "flex", alignItems: "center", gap: "8px" }}
              >
                {uploadingUnits ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Uploading &amp; Processing...
                  </>
                ) : (
                  "Upload & Apply Hierarchy"
                )}
              </button>
            </form>
          </div>

          {/* UPLOAD STAFF & REPORTING LINES CARD */}
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14, padding: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={16} style={{ color: "var(--blue)" }} />
                <span>2. Upload Staff &amp; Reporting Lines</span>
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12, lineHeight: 1.4 }}>
                Map your personnel and sales reps directly to the organizational node codes and link their supervisor emails.
              </p>
            </div>

            <div style={{
              padding: "10px 14px",
              backgroundColor: "var(--surface-2)",
              borderLeft: "2.5px solid var(--blue)",
              borderRadius: "0 6px 6px 0",
              fontSize: 11.5,
              lineHeight: "1.45"
            }}>
              📋 <strong>Required Format:</strong> CSV file with headers: `Name, Email, OrgUnitCode, ManagerEmail, Status`. <br/>
              <em>ManagerEmail will establish the internal manager reporting hierarchy.</em>
            </div>

            <form onSubmit={handleUploadStaff} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={(e) => setStaffFile(e.target.files?.[0] || null)}
                  className="form-input" 
                  style={{ flex: 1, padding: "6px" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadTemplate("staff")}
                  style={{ padding: "8px 10px", display: "inline-flex", alignItems: "center", gap: 4, height: 38 }}
                >
                  <Download size={13} /> Template
                </button>
              </div>

              {staffStatus && (
                <div style={{
                  padding: "8px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  backgroundColor: staffStatus.success ? "rgba(40, 167, 69, 0.08)" : "rgba(220, 53, 69, 0.08)",
                  borderLeft: `2.5px solid ${staffStatus.success ? "var(--green)" : "var(--red)"}`,
                  color: staffStatus.success ? "var(--green)" : "var(--red)"
                }}>
                  {staffStatus.success ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  <span>{staffStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={uploadingStaff || !staffFile}
                style={{ justifyContent: "center", padding: "10px", marginTop: 8, display: "flex", alignItems: "center", gap: "8px" }}
              >
                {uploadingStaff ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Uploading &amp; Mapping...
                  </>
                ) : (
                  "Upload & Map Staff"
                )}
              </button>
            </form>
          </div>

        </div>
      )}

      {activeTab === "permissions" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* 1. ROLE PERMISSIONS MATRIX */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={16} style={{ color: "var(--blue)" }} />
                <span>Enterprise Role Permissions Configuration</span>
              </h3>
              <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12 }}>
                Configure fine-grained read/write security credentials for each structural role.
              </p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {roles.map((role) => {
                const currentPerms = modifiedRoles[role.id] || role.permissions || {};
                const isModified = !!modifiedRoles[role.id];
                
                return (
                  <div key={role.id} className="card" style={{ padding: 16, backgroundColor: "var(--surface-2)", display: "flex", flexDirection: "column", gap: 12, borderTop: isModified ? "3px solid var(--amber)" : "1px solid var(--border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {role.name.replace("_", " ")}
                      </div>
                      {isModified && (
                        <span className="badge badge-warning" style={{ fontSize: 9 }}>Unsaved Changes</span>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12 }}>
                      {["contracts", "analytics", "marketing", "scratchers", "admin"].map((resource) => {
                        const val = currentPerms[resource] || "none";
                        return (
                          <div key={resource} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.03)", paddingBottom: 4 }}>
                            <span style={{ textTransform: "capitalize", fontWeight: 500 }}>{resource}</span>
                            <div style={{ display: "flex", gap: 8 }}>
                              {["none", "read", "write"].map((level) => (
                                <label key={level} style={{ display: "inline-flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 11 }}>
                                  <input 
                                    type="radio" 
                                    name={`perm-${role.id}-${resource}`} 
                                    checked={val === level}
                                    onChange={() => handlePermissionChange(role.id, resource, level)}
                                    style={{ cursor: "pointer" }}
                                  />
                                  <span style={{ color: val === level ? "var(--text)" : "var(--text-muted)" }}>{level}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {isModified && (
                      <button
                        type="button"
                        onClick={() => handleSaveRolePermissions(role.id)}
                        disabled={savingPermissions}
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 8, justifyContent: "center", display: "flex", alignItems: "center", gap: 4 }}
                      >
                        {savingPermissions ? <RefreshCw size={12} className="animate-spin" /> : null}
                        Save Permissions
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. USER ACCESS MATRIX */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={16} style={{ color: "var(--blue)" }} />
                  <span>Personnel Role &amp; Access Assignment</span>
                </h3>
                <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12 }}>
                  Assign organizational roles and toggle account statuses.
                </p>
              </div>
              <input 
                type="text"
                className="search-input"
                placeholder="Search users to modify..."
                style={{ maxWidth: 300, width: "100%", height: 32, fontSize: 11.5 }}
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid var(--border)", textAlign: "left" }}>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Name &amp; Email</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Division / Bureau</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>System Role</th>
                    <th style={{ padding: "8px 10px", fontWeight: 600 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users
                    .filter(u => {
                      if (!userSearchTerm) return true;
                      const q = userSearchTerm.toLowerCase();
                      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.division.toLowerCase().includes(q);
                    })
                    .slice(0, 15)
                    .map((user) => {
                      const isSaving = savingUserRole === user.id;
                      return (
                        <tr key={user.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px 10px" }}>
                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                            <div className="muted" style={{ fontSize: 11 }}>{user.email}</div>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <div>{user.division}</div>
                            {user.bureau && <div className="muted" style={{ fontSize: 11 }}>{user.bureau}</div>}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <select
                              value={user.roleId}
                              disabled={isSaving}
                              onChange={(e) => handleUpdateUserAccess(user.id, { roleId: e.target.value })}
                              style={{
                                padding: "4px 8px",
                                borderRadius: 4,
                                backgroundColor: "var(--surface-3)",
                                border: "1px solid var(--border)",
                                color: "var(--text)",
                                fontSize: 11.5,
                                cursor: "pointer",
                                opacity: isSaving ? 0.6 : 1
                              }}
                            >
                              {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name.replace("_", " ").toUpperCase()}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleUpdateUserAccess(user.id, { status: user.status === "active" ? "suspended" : "active" })}
                              className="btn btn-sm"
                              style={{
                                padding: "4px 8px",
                                fontSize: 10.5,
                                minWidth: 100,
                                backgroundColor: user.status === "active" ? "rgba(40, 167, 69, 0.08)" : "rgba(220, 53, 69, 0.08)",
                                border: `1px solid ${user.status === "active" ? "var(--green)" : "var(--red)"}`,
                                color: user.status === "active" ? "var(--green)" : "var(--red)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                cursor: "pointer"
                              }}
                            >
                              {isSaving ? <RefreshCw size={10} className="animate-spin" /> : null}
                              {user.status === "active" ? "ACTIVE" : "SUSPENDED"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. ADMINISTRATION SECURITY AUDIT LOG */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Network size={16} style={{ color: "var(--blue)" }} />
                  <span>Administrative Security Audit Log</span>
                </h3>
                <p className="muted" style={{ margin: "4px 0 0 0", fontSize: 12 }}>
                  Live system log tracking administrative settings, permissions configurations, and job overrides.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={fetchAuditLogs}
                disabled={loadingAuditLogs}
                style={{ padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <RefreshCw size={12} className={loadingAuditLogs ? "animate-spin" : ""} /> Refresh Logs
              </button>
            </div>

            {loadingAuditLogs && auditLogs.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                <RefreshCw size={24} className="animate-spin text-muted" />
              </div>
            ) : auditLogs.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, textAlign: "center", padding: 20 }}>No security audit logs recorded in system.</p>
            ) : (
              <div style={{ maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ borderBottom: "1.5px solid var(--border)", textAlign: "left", position: "sticky", top: 0, backgroundColor: "var(--surface-1)", zIndex: 1 }}>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Timestamp</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Administrator</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Action</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Resource / ID</th>
                      <th style={{ padding: "8px 10px", fontWeight: 600 }}>Log Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                        <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 600 }}>{log.user?.name || "System"}</div>
                          <div className="muted" style={{ fontSize: 10.5 }}>{log.user?.email || "system@stochos.io"}</div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <span className={`badge badge-${
                            log.action === "override_release" ? "warning" : 
                            log.action === "job_timeout" ? "danger" : 
                            "info"
                          }`} style={{ fontSize: 8.5 }}>
                            {log.action.replace("_", " ").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          <div style={{ fontWeight: 500 }}>{log.entityType}</div>
                          <div className="muted" style={{ fontSize: 10, maxWidth: 140, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }} title={log.entityId}>
                            {log.entityId}
                          </div>
                        </td>
                        <td style={{ padding: "8px 10px" }}>
                          {renderAuditChanges(log)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
