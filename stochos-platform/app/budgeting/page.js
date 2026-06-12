'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { useSession } from "next-auth/react";
import Skeleton from "../components/Skeleton";
import { FileText, Zap, AlertTriangle, CheckCircle2, Trash2, Save, Send, BookOpen, XCircle, Check, X, ClipboardList, ShieldAlert, Award, Home } from "lucide-react";
import Link from "next/link";
import HelpDrawer from "../components/HelpDrawer";
import HelpTooltip from "../components/HelpTooltip";
import CollapsibleCard from "../components/CollapsibleCard";
import FeatureBlocker from "../components/FeatureBlocker";

export default function BudgetingPage() {
  const { data: session } = useSession();
  const [isEnabled, setIsEnabled] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then((data) => {
        if (data.features && data.features.feature_budgeting === false) {
          setIsEnabled(false);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingSettings(false);
      });
  }, []);

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [proposals, setProposals] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [activeLocks, setActiveLocks] = useState([]);
  
  const isCompilingRef = useRef(false);
  const isSyncingRef = useRef(false);

  const fetchActiveLocks = useCallback(async () => {
    try {
      const res = await fetch("/api/reporting/jobs");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveLocks(data.activeJobs || []);
        }
      }
    } catch (err) {
      console.error("Error fetching active locks:", err);
    }
  }, []);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2027);
  const [rounding, setRounding] = useState("exact"); // exact, thousands, millions

  // Modal / Detail state for reviews
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [versions, setVersions] = useState([]);
  const [showVersionsPanel, setShowVersionsPanel] = useState(false);

  const loadVersions = async (proposalId) => {
    try {
      const res = await fetch(`/api/budget-proposals/versions?proposalId=${proposalId}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (err) {
      console.error("Error loading versions:", err);
    }
  };

  const handleRestoreVersion = async (versionNumber) => {
    if (!editableProposal) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const res = await fetch("/api/budget-proposals/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: editableProposal.id,
          versionNumber
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuccess(`Version v${versionNumber} restored successfully! Created new undo backup.`);
        setProposals(proposals.map(p => p.id === data.id ? data : p));
        loadVersions(editableProposal.id);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to restore version.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to restore version.");
    } finally {
      setSaving(false);
    }
  };

  const getVersionTotal = (version) => {
    const items = Array.isArray(version.proposalData) ? version.proposalData : [];
    return items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  };


  // Get user details
  const user = session?.user;
  const isFinanceOrExec = user?.division === "FINANCE" || user?.division === "EXECUTIVE" || user?.role === "admin";
  const isDivisionLead = !isFinanceOrExec && user?.division && (!user?.bureau || user?.bureau === "");
  const isBureauChief = !isFinanceOrExec && user?.division && user?.bureau;

  const DIVISION_BUDGET_CAPS = {
    IT: 5000000.00,
    MARKETING: 45000000.00,
    OPERATIONS: 30000000.00,
    FINANCE: 3000000.00,
    EXECUTIVE: 2000000.00,
    PROCUREMENT: 1500000.00
  };

  // Resolve proposals based on user role
  const getEditableProposal = () => {
    if (isBureauChief) {
      // Bureau Chief edits their own specific proposal
      return proposals[0];
    }
    if (isDivisionLead) {
      // Division Lead edits the division-level proposal (where bureau is empty)
      return proposals.find(p => p.bureau === "" && p.subunit === "");
    }
    return null;
  };
  const editableProposal = getEditableProposal();
  const bureauProposals = isDivisionLead ? proposals.filter(p => p.bureau !== "" || p.subunit !== "") : [];

  // Calculate divisional encumbrances and actuals
  const activeUserDivision = user?.division || (proposals[0]?.division || "EXECUTIVE");
  const userDivContracts = contracts.filter(c => c.division === activeUserDivision);
  let userDivEncumbered = 0;
  let userDivActual = 0;
  userDivContracts.forEach(c => {
    (c.purchaseOrders || []).forEach(po => {
      if (po.status === 'issued' || po.status === 'received') {
        userDivEncumbered += parseFloat(po.amount || 0);
      }
    });
    (c.invoices || []).forEach(inv => {
      if (inv.status === 'paid' || inv.status === 'approved') {
        userDivActual += parseFloat(inv.amount || 0);
      }
    });
  });
  const userDivCap = DIVISION_BUDGET_CAPS[activeUserDivision] || 0;
  const userDivFree = userDivCap - userDivEncumbered - userDivActual;

  useEffect(() => {
    fetchActiveLocks();
    const interval = setInterval(fetchActiveLocks, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveLocks]);

  useEffect(() => {
    async function loadContracts() {
      try {
        const res = await fetch("/api/contracts?status=active");
        if (res.ok) {
          const data = await res.json();
          setContracts(data);
        }
      } catch (err) {
        console.error("Error loading contracts:", err);
      }
    }
    if (session) {
      loadContracts();
    }
  }, [session]);

  const getContractRemainingCap = (contractId) => {
    const contract = contracts.find(c => c.id === contractId);
    if (!contract) return 0;
    const spentSum = Array.isArray(contract.lineItems)
      ? contract.lineItems.reduce((acc, item) => acc + parseFloat(item.spentAmount || 0), 0)
      : 0;
    return parseFloat(contract.totalValue || 0) - spentSum;
  };

  const loadProposals = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/budget-proposals?fiscalYear=${fiscalYear}`);
      if (res.ok) {
        const data = await res.json();
        setProposals(data);
      } else {
        setError("Failed to load budget proposals.");
      }
    } catch (err) {
      console.error(err);
      setError("Error loading proposals from server.");
    } finally {
      setLoading(false);
    }
  }, [fiscalYear]);

  useEffect(() => {
    if (session) {
      loadProposals();
    }
  }, [session, loadProposals]);

  const prevSyncLockedRef = useRef(false);
  const prevCompileLockedRef = useRef(false);

  const isSyncBudgetLocked = activeLocks.some(lock => lock.lockKey.startsWith('sync-budget-') && lock.lockKey.endsWith(`-${fiscalYear}`));
  const isCompileDivisionLocked = activeLocks.some(lock => lock.lockKey.startsWith('compile-division-') && lock.lockKey.endsWith(`-${user?.division}-${fiscalYear}`));
  const isSyncingActive = syncing || isSyncBudgetLocked;
  const isCompilingActive = compiling || isCompileDivisionLocked;

  useEffect(() => {
    if (prevSyncLockedRef.current && !isSyncBudgetLocked) {
      // Transitioned from locked to unlocked (completed)
      loadProposals();
      setSuccess("Unified Master Budget Compiled scenario completed in background!");
    }
    prevSyncLockedRef.current = isSyncBudgetLocked;
  }, [isSyncBudgetLocked, loadProposals]);

  useEffect(() => {
    if (prevCompileLockedRef.current && !isCompileDivisionLocked) {
      // Transitioned from locked to unlocked (completed)
      loadProposals();
      setSuccess("Consolidated Division Proposal Compiled in background!");
    }
    prevCompileLockedRef.current = isCompileDivisionLocked;
  }, [isCompileDivisionLocked, loadProposals]);

  useEffect(() => {
    if (editableProposal?.id) {
      loadVersions(editableProposal.id);
    } else {
      setVersions([]);
    }
  }, [editableProposal?.id]);


  // Handle line item change for editor
  const handleItemChange = (index, field, value) => {
    if (!editableProposal) return;
    const updated = proposals.map(p => {
      if (p.id === editableProposal.id) {
        const items = [...p.proposalData];
        items[index] = { 
          ...items[index], 
          [field]: field === "amount" ? parseFloat(value || 0) : value 
        };
        return { ...p, proposalData: items };
      }
      return p;
    });
    setProposals(updated);
  };

  // Add Item to proposalData
  const handleAddItem = () => {
    if (!editableProposal) return;
    const updated = proposals.map(p => {
      if (p.id === editableProposal.id) {
        const items = [...p.proposalData, { category: "Operations", desc: "New line item", amount: 1000.00, contractId: "" }];
        return { ...p, proposalData: items };
      }
      return p;
    });
    setProposals(updated);
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    if (!editableProposal) return;
    const updated = proposals.map(p => {
      if (p.id === editableProposal.id) {
        const items = p.proposalData.filter((_, i) => i !== index);
        return { ...p, proposalData: items };
      }
      return p;
    });
    setProposals(updated);
  };

  // Save Draft (POST)
  const handleSaveDraft = async () => {
    if (!editableProposal) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/budget-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: editableProposal.division,
          bureau: editableProposal.bureau,
          subunit: editableProposal.subunit,
          fiscalYear: editableProposal.fiscalYear,
          proposalData: editableProposal.proposalData,
          notes: editableProposal.notes || ""
        })
      });

      if (res.ok) {
        setSuccess("Budget proposal saved as draft successfully.");
        const data = await res.json();
        setProposals(proposals.map(p => p.id === data.id ? data : p));
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to save proposal.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Submit Proposal (PUT)
  const handleSubmitProposal = async () => {
    if (!editableProposal) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // First save the current data
      await fetch("/api/budget-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: editableProposal.division,
          bureau: editableProposal.bureau,
          subunit: editableProposal.subunit,
          fiscalYear: editableProposal.fiscalYear,
          proposalData: editableProposal.proposalData,
          notes: editableProposal.notes || ""
        })
      });

      // Then trigger submit transition
      const res = await fetch("/api/budget-proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editableProposal.id,
          action: "submit"
        })
      });

      if (res.ok) {
        setSuccess(isBureauChief ? "Bureau proposal submitted to Division Lead for review." : "Division budget proposal submitted to Finance for review.");
        const data = await res.json();
        setProposals(proposals.map(p => p.id === data.id ? data : p));
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to submit proposal.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to submit.");
    } finally {
      setSaving(false);
    }
  };

  // Division Lead Reviews Bureau Proposal (PUT)
  const handleReviewAction = async (action) => {
    if (!selectedProposal) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/budget-proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProposal.id,
          action,
          reviewNotes
        })
      });

      if (res.ok) {
        setSuccess(`Bureau proposal for ${selectedProposal.bureau} ${action === "approve" ? "Approved" : "Rejected"} successfully.`);
        const data = await res.json();
        setProposals(proposals.map(p => p.id === data.id ? data : p));
        setSelectedProposal(null);
        setReviewNotes("");
      } else {
        const errData = await res.json();
        setError(errData.error || `Failed to ${action} proposal.`);
      }
    } catch (err) {
      console.error(err);
      setError("Network error: review action failed.");
    } finally {
      setSaving(false);
    }
  };

  // Compile Division Consolidated Proposal (POST /api/budget-proposals/compile-division)
  const handleCompileDivisionBudget = async () => {
    if (isCompilingRef.current) return;
    isCompilingRef.current = true;
    try {
      setCompiling(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/budget-proposals/compile-division", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: user.division,
          fiscalYear
        })
      });

      if (res.ok) {
        setSuccess("Consolidated Division Proposal compilation started in background! Rollup in progress.");
        fetchActiveLocks();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to compile division proposal.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to compile division proposal.");
    } finally {
      isCompilingRef.current = false;
      setCompiling(false);
      fetchActiveLocks();
    }
  };

  // Compile Master Budget Rollup (POST /api/reporting/sync-budget)
  const handleCompileBudget = async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      setSyncing(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/reporting/sync-budget?fiscalYear=${fiscalYear}`, {
        method: "POST"
      });

      if (res.ok) {
        setSuccess("Unified Master Budget compilation started in background! Rollup in progress.");
        fetchActiveLocks();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to compile master budget.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to compile.");
    } finally {
      isSyncingRef.current = false;
      setSyncing(false);
      fetchActiveLocks();
    }
  };

  // Summary figures helpers
  const getProposalTotal = (prop) => {
    const items = Array.isArray(prop?.proposalData) ? prop.proposalData : [];
    return items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  };

  const getRoundingFactor = () => {
    if (rounding === 'thousands') return 1000;
    if (rounding === 'millions') return 1000000;
    return 1;
  };

  const formatBudgetVal = (val, forceExact = false) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
    if (forceExact) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const factor = getRoundingFactor();
    const adjustedVal = val / factor;
    
    // Check if zero
    if (Math.abs(adjustedVal) < 0.001) {
      return factor === 1 ? '0.00' : '0.0';
    }
    
    const formatted = Math.abs(adjustedVal).toLocaleString(undefined, {
      minimumFractionDigits: factor === 1 ? 2 : 1,
      maximumFractionDigits: factor === 1 ? 2 : 1
    });
    
    if (adjustedVal < 0) {
      return `(${formatted})`;
    }
    return formatted;
  };

  const getDivisionContracts = (divName) => {
    return contracts.filter(c => c.division === divName);
  };

  const getEncumberedSum = (contractsList) => {
    let sum = 0;
    contractsList.forEach(c => {
      const activePOs = c.purchaseOrders || [];
      activePOs.forEach(po => {
        if (po.status === 'issued' || po.status === 'received') {
          sum += parseFloat(po.amount || 0);
        }
      });
    });
    return sum;
  };

  const getActualExpensesSum = (contractsList) => {
    let sum = 0;
    contractsList.forEach(c => {
      const activeInvoices = c.invoices || [];
      activeInvoices.forEach(inv => {
        if (inv.status === 'paid' || inv.status === 'approved') {
          sum += parseFloat(inv.amount || 0);
        }
      });
    });
    return sum;
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved": return "var(--green)";
      case "submitted": return "var(--blue)";
      case "rejected": return "#ef4444";
      default: return "#6b7280"; // draft
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "approved": return "Approved";
      case "submitted": return "Awaiting Review";
      case "rejected": return "Revisions Requested";
      default: return "Draft";
    }
  };

  // Finance Lead view only shows division-level proposals
  const divisionProposalsForFinance = isFinanceOrExec
    ? proposals.filter(p => p.bureau === "" && p.subunit === "")
    : [];

  // Division Lead helper numbers
  const totalBureausCount = user?.division === "IT" ? 2 : (user?.division === "MARKETING" ? 2 : bureauProposals.length);
  const approvedBureausCount = bureauProposals.filter(p => p.status === "approved").length;
  const approvedBureausSum = bureauProposals.filter(p => p.status === "approved").reduce((sum, p) => sum + getProposalTotal(p), 0);
  const divisionLeadCapOver = approvedBureausSum > DIVISION_BUDGET_CAPS[user?.division];
  const divisionLeadCapApproaching = !divisionLeadCapOver && approvedBureausSum >= DIVISION_BUDGET_CAPS[user?.division] * 0.9;


  if (loadingSettings) {
    return (
      <div className="app-layout">
        <Sidebar />
        <main className="main-content">
          <div className="page-header">
            <h2>Divisional Budgeting Cockpit</h2>
            <p>Verifying access parameters...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isEnabled) {
    return <FeatureBlocker moduleName="Divisional Budgeting Cockpit" />;
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
              Divisional Budgeting Cockpit
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", margin: 0 }}>
              {isFinanceOrExec 
                ? "Review and approve consolidated division proposals, then compile the master budget package." 
                : isDivisionLead
                ? `Review sub-unit bureau requests for the ${user?.division} division, then compile the unified division proposal.`
                : `Submit the ${user?.bureau || user?.division} operational and G&A budget proposal.`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Fiscal Year:</label>
            <select 
              id="fiscal-year-selector"
              value={fiscalYear} 
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            >
              <option value={2026}>FY2026</option>
              <option value={2027}>FY2027 (Current)</option>
              <option value={2028}>FY2028</option>
            </select>

            {/* ROUNDING UNITS */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', height: '32px' }}>
              {['exact', 'thousands', 'millions'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRounding(mode)}
                  style={{
                    padding: '0 12px',
                    border: 'none',
                    background: rounding === mode ? 'var(--surface-2)' : 'var(--surface-3)',
                    color: rounding === mode ? 'var(--text)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRight: mode !== 'millions' ? '1px solid var(--border)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {mode === 'exact' ? '$1.00' : mode === 'thousands' ? '$K' : '$M'}
                </button>
              ))}
            </div>

            <Link
              href="/"
              style={{
                padding: "6px 12px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                backgroundColor: "var(--surface-3)",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
                transition: "all 0.15s"
              }}
            >
              <Home size={16} /> Back to Platform Hub
            </Link>

            <button
              id="btn-help-guide"
              onClick={() => setIsHelpOpen(true)}
              style={{
                padding: "6px 12px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                backgroundColor: "var(--surface-3)",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: "600",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              <BookOpen size={16} /> Help & Guide
            </button>

            {isFinanceOrExec && (
              <button 
                id="btn-compile-master-budget"
                onClick={handleCompileBudget} 
                disabled={isSyncingActive || loading}
                className="btn btn-primary"
                style={{ backgroundColor: isSyncingActive ? "var(--surface-3)" : "var(--gold)", border: "none", display: "inline-flex", alignItems: "center", cursor: isSyncingActive ? "not-allowed" : "pointer" }}
              >
                {isSyncingActive ? (
                  <>
                    <svg className="animate-spin" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', marginRight: '8px', fill: 'none', stroke: 'currentColor', strokeWidth: '3px' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                    </svg>
                    Compiling...
                  </>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    Compile & Roll Up Budget <Zap size={14} />
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", border: "1px solid #fee2e2", marginBottom: "1.5rem", fontSize: 14, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", border: "1px solid #dcfce7", marginBottom: "1.5rem", fontSize: 14, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {(isSyncBudgetLocked || isCompileDivisionLocked) && (
          <div style={{ padding: "16px", backgroundColor: "#fffbeb", color: "#b45309", borderRadius: "6px", border: "1px solid #fef3c7", marginBottom: "1.5rem", fontSize: 14, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
              <AlertTriangle size={18} color="#b45309" />
              <span>Background Compilation Job Currently Running</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#78350f' }}>
              Please wait. The Stochos platform is compiling the budget schemas in the background. The relevant action buttons have been locked until the compilation is complete.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {activeLocks.filter(l => l.lockKey.startsWith('sync-budget-') || l.lockKey.startsWith('compile-division-')).map(l => (
                <div key={l.id} style={{ fontSize: '12px', color: '#78350f', background: 'rgba(217, 119, 6, 0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                  <strong>{l.description}</strong> (Started by: {l.userName} | Duration: {l.maxDurationSeconds}s)
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cap Exception warnings for Leads / Chiefs */}
        {!isFinanceOrExec && editableProposal && (() => {
          const division = editableProposal.division;
          const cap = DIVISION_BUDGET_CAPS[division] || 5000000;
          const total = getProposalTotal(editableProposal);
          if (total > cap) {
            return (
              <div style={{ padding: "14px 18px", backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#dc2626", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.2)", marginBottom: "1.5rem", fontSize: 13, lineHeight: "1.5", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>Annual Budget Authority Alert</strong>: The total requested budget for the <strong>{division}</strong> proposal is <strong>${formatBudgetVal(total)}</strong>, which exceeds the DOB target allocation limit of <strong>${formatBudgetVal(cap)}</strong> by <strong>${formatBudgetVal(total - cap)}</strong>. Please adjust your line items or consult the Finance division.
                </div>
              </div>
            );
          } else if (total >= cap * 0.9) {
            return (
              <div style={{ padding: "14px 18px", backgroundColor: "rgba(245, 158, 11, 0.08)", color: "#d97706", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.2)", marginBottom: "1.5rem", fontSize: 13, lineHeight: "1.5", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
                <div>
                  <strong>Approaching Budget Limit Warning</strong>: The total requested budget for the <strong>{division}</strong> proposal is <strong>${formatBudgetVal(total)}</strong>, which is approaching the DOB target allocation limit of <strong>${formatBudgetVal(cap)}</strong> (currently at <strong>{((total / cap) * 100).toFixed(1)}%</strong> of cap).
                </div>
              </div>
            );
          }
          return null;
        })()}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Shimmering KPI grid */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              {[1, 2, 3].map((i) => (
                <div className="kpi-card" style={{ padding: "20px" }} key={i}>
                  <Skeleton width="50%" height="12px" style={{ marginBottom: "12px" }} />
                  <Skeleton width="80%" height="28px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="40%" height="10px" />
                </div>
              ))}
            </div>

            {/* Shimmering Table */}
            <div className="card">
              <div className="card-header">
                <Skeleton width="180px" height="16px" />
              </div>
              <div className="card-body" style={{ padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <Skeleton width="15%" height="14px" />
                    <Skeleton width="25%" height="14px" />
                    <Skeleton width="15%" height="14px" />
                    <Skeleton width="25%" height="14px" />
                    <Skeleton width="10%" height="14px" />
                  </div>
                  {[1, 2, 3, 4, 5].map((row) => (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} key={row}>
                      <Skeleton width="15%" height="16px" />
                      <Skeleton width="22%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="28%" height="16px" />
                      <Skeleton width="8%" height="16px" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* ================================================================= */}
            {/* VIEW A: FINANCE/EXECUTIVE COCKPIT                                 */}
            {/* ================================================================= */}
            {isFinanceOrExec && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
                {/* Consolidated Encumbrance Rollup */}
                <CollapsibleCard
                  title="Consolidated Encumbrance & Fund Control Audit"
                  icon={ClipboardList}
                  badge={<span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>NYSGC Agency-wide Rollup</span>}
                  initialCollapsed={true}
                  storageKey="budget-consolidated-audit"
                  style={{ margin: 0 }}
                  bodyStyle={{ padding: 0, overflowX: "auto" }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Division</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Adopted Cap ($)</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Encumbered POs ($)</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Actual Expenses ($)</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Free Budget ($)</th>
                        <th style={{ textAlign: "center", padding: "12px 16px" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(DIVISION_BUDGET_CAPS).map(div => {
                        const divContracts = getDivisionContracts(div);
                        const cap = DIVISION_BUDGET_CAPS[div];
                        const enc = getEncumberedSum(divContracts);
                        const act = getActualExpensesSum(divContracts);
                        const free = cap - enc - act;
                        const isOver = free < 0;

                        return (
                          <tr key={div} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{div}</td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                              ${formatBudgetVal(cap)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
                              ${formatBudgetVal(enc)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--blue)" }}>
                              ${formatBudgetVal(act)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: isOver ? "#ef4444" : "var(--green)", fontWeight: 600 }}>
                              ${formatBudgetVal(free)}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <span style={{ 
                                padding: "3px 8px", 
                                borderRadius: "12px", 
                                color: "#fff", 
                                fontSize: 11, 
                                backgroundColor: isOver ? "#ef4444" : "var(--green)",
                                fontWeight: "bold"
                              }}>
                                {isOver ? "OVER LIMIT" : "BALANCED"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  
                  {/* Footnote */}
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    fontStyle: 'italic', 
                    borderTop: '1px solid var(--border)', 
                    padding: '10px 16px',
                    textAlign: 'left'
                  }}>
                    * Note: Budget amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
                  </div>
                </CollapsibleCard>

                {/* Division Submissions */}
                <CollapsibleCard
                  title="Division Submissions (Consolidated Rollups)"
                  icon={FileText}
                  initialCollapsed={true}
                  storageKey="budget-division-submissions"
                  style={{ margin: 0 }}
                  bodyStyle={{ padding: 0, overflowX: "auto" }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Division</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Prepared By</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Status</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Consolidated Total ($)</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Notes / Variance Justification</th>
                        <th style={{ textAlign: "center", padding: "12px 16px", width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divisionProposalsForFinance.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                            No division-level proposals submitted for FY{fiscalYear}.
                          </td>
                        </tr>
                      ) : (
                        divisionProposalsForFinance.map(p => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{p.division}</td>
                            <td style={{ padding: "12px 16px" }}>{p.submittedBy?.name || "System"} ({p.submittedBy?.email || "-"})</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "3px 8px", borderRadius: "12px", color: "#fff", fontSize: 11, backgroundColor: getStatusBadgeColor(p.status) }}>
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                              ${formatBudgetVal(getProposalTotal(p))}
                            </td>
                            <td style={{ padding: "12px 16px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.notes || <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No justification provided</span>}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <button 
                                onClick={() => setSelectedProposal(p)}
                                className="btn"
                                style={{ padding: "6px 12px", fontSize: 12, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                              >
                                Review Ledger
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Footnote */}
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    fontStyle: 'italic', 
                    borderTop: '1px solid var(--border)', 
                    padding: '10px 16px',
                    textAlign: 'left'
                  }}>
                    * Note: Budget amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
                  </div>
                </CollapsibleCard>
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW B: DIVISION LEAD REVIEW & CONSOLIDATION COCKPIT              */}
            {/* ================================================================= */}
            {isDivisionLead && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%" }}>
                {/* Bureau Submissions Review Panel */}
                <CollapsibleCard
                  title="Bureau Sub-unit Submissions"
                  icon={ClipboardList}
                  badge={<span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Bottom-up request tracking</span>}
                  initialCollapsed={false}
                  storageKey="budget-bureau-submissions"
                  style={{ margin: 0 }}
                  bodyStyle={{ padding: 0, overflowX: "auto" }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Bureau / Unit</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Subunit</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Prepared By</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Status</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Requested Total ($)</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Notes / Review Status</th>
                        <th style={{ textAlign: "center", padding: "12px 16px", width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bureauProposals.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                            No sub-unit bureau proposals initialized. Please wait for Bureau Chiefs to log in and formulate their ledgers.
                          </td>
                        </tr>
                      ) : (
                        bureauProposals.map(p => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{p.bureau}</td>
                            <td style={{ padding: "12px 16px" }}>{p.subunit}</td>
                            <td style={{ padding: "12px 16px" }}>{p.submittedBy?.name || "System"} ({p.submittedBy?.email || "-"})</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "3px 8px", borderRadius: "12px", color: "#fff", fontSize: 11, backgroundColor: getStatusBadgeColor(p.status) }}>
                                {getStatusLabel(p.status)}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                              ${formatBudgetVal(getProposalTotal(p))}
                            </td>
                            <td style={{ padding: "12px 16px", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.notes || <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No notes provided</span>}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <button 
                                onClick={() => setSelectedProposal(p)}
                                className="btn"
                                style={{ padding: "6px 12px", fontSize: 12, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                              >
                                Review Ledger
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Footnote */}
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    fontStyle: 'italic', 
                    borderTop: '1px solid var(--border)', 
                    padding: '10px 16px',
                    textAlign: 'left'
                  }}>
                    * Note: Budget amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
                  </div>
                </CollapsibleCard>

                {/* Division Consolidation Status Controls */}
                <div className="card" style={{ background: "var(--card-bg)", margin: 0 }}>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Division Consolidation Control Board</h3>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Rollup validation rules</span>
                  </div>
                  <div className="card-body" style={{ padding: "20px" }}>
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", gap: "32px" }}>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Bureau Approvals</div>
                          <div style={{ fontSize: "24px", fontWeight: "800", color: approvedBureausCount === totalBureausCount ? "var(--green)" : "var(--gold)" }}>
                            {approvedBureausCount} / {totalBureausCount}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Approved bureau drafts</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Division Target Cap</div>
                          <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--text)" }}>
                            ${formatBudgetVal(DIVISION_BUDGET_CAPS[user?.division])}
                          </div>
                          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Allocated by DOB</div>
                        </div>
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>Approved Bureau Requests</div>
                          <div style={{ fontSize: "24px", fontWeight: "800", color: divisionLeadCapOver ? "#ef4444" : (divisionLeadCapApproaching ? "var(--gold)" : "var(--green)") }}>
                            ${formatBudgetVal(approvedBureausSum)}
                          </div>
                          <div style={{ fontSize: "11px", color: divisionLeadCapOver ? "#ef4444" : (divisionLeadCapApproaching ? "var(--gold)" : "var(--green)") }}>
                            {divisionLeadCapOver ? "Exceeds division target cap!" : (divisionLeadCapApproaching ? "Approaching division cap target!" : "Within allocated target")}
                          </div>
                        </div>
                      </div>

                      <button
                        id="btn-compile-division-proposal"
                        onClick={handleCompileDivisionBudget}
                        disabled={isCompilingActive || approvedBureausCount === 0 || approvedBureausCount < totalBureausCount}
                        className="btn btn-primary"
                        style={{
                          backgroundColor: (isCompilingActive || approvedBureausCount < totalBureausCount) ? "var(--surface-3)" : "var(--green)",
                          color: (isCompilingActive || approvedBureausCount < totalBureausCount) ? "var(--text-muted)" : "#fff",
                          border: (isCompilingActive || approvedBureausCount < totalBureausCount) ? "1px solid var(--border)" : "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          fontWeight: "bold",
                          fontSize: "14px",
                          padding: "10px 20px",
                          cursor: (isCompilingActive || approvedBureausCount < totalBureausCount) ? "not-allowed" : "pointer"
                        }}
                      >
                        {isCompilingActive ? (
                          <>
                            <svg className="animate-spin" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', fill: 'none', stroke: 'currentColor', strokeWidth: '3px' }}>
                              <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.25" />
                              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                            </svg>
                            Consolidating...
                          </>
                        ) : (
                          <>
                            Compile &amp; Consolidate Division Proposal <Zap size={16} />
                          </>
                        )}
                      </button>
                    </div>

                    {approvedBureausCount < totalBureausCount && (
                      <div style={{ marginTop: "16px", padding: "10px 14px", borderRadius: "6px", border: "1px solid rgba(245, 158, 11, 0.2)", backgroundColor: "rgba(245, 158, 11, 0.05)", color: "var(--gold)", fontSize: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <ShieldAlert size={14} />
                        Compilation locks until all {totalBureausCount} sub-unit bureau proposals are review-approved. Please complete all pending bureau reviews.
                      </div>
                    )}
                  </div>
                </div>

                {/* Division Editor (displays editableProposal lines compiled from bureaus) */}
                {editableProposal && (
                  <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", width: "100%" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
                      
                      {/* G&A and Commitments panel */}
                      <div className="card" style={{ background: "var(--card-bg)", margin: 0 }}>
                        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>Division-Level Encumbrance &amp; Commitments Audit</h3>
                          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Governmental Fund Control</span>
                        </div>
                        <div className="card-body" style={{ padding: "20px" }}>
                          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", width: "100%", margin: 0 }}>
                            <div className="kpi-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "16px" }}>
                              <div className="kpi-label" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Adopted Budget Limit</div>
                              <div className="kpi-value" style={{ fontSize: "18px", color: "var(--text)", fontWeight: "700" }}>
                                ${formatBudgetVal(userDivCap)}
                              </div>
                              <div className="kpi-subtitle" style={{ fontSize: "10px" }}>DOB Allocation Target</div>
                            </div>
                            <div className="kpi-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "16px" }}>
                              <div className="kpi-label" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                Encumbered (POs)
                                <HelpTooltip text="Active contract commitments representing funds earmarked for issued or received purchase orders, pending invoice billing." />
                              </div>
                              <div className="kpi-value" style={{ fontSize: "18px", color: "var(--gold)", fontWeight: "700" }}>
                                ${formatBudgetVal(userDivEncumbered)}
                              </div>
                              <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Active Contract Commitments</div>
                            </div>
                            <div className="kpi-card" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "16px" }}>
                              <div className="kpi-label" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Actual Expenses</div>
                              <div className="kpi-value" style={{ fontSize: "18px", color: "var(--blue)", fontWeight: "700" }}>
                                ${formatBudgetVal(userDivActual)}
                              </div>
                              <div className="kpi-subtitle" style={{ fontSize: "10px" }}>Paid/Approved Invoices</div>
                            </div>
                            <div className="kpi-card" style={{ 
                              background: userDivFree >= 0 ? "rgba(34, 197, 94, 0.05)" : "rgba(239, 68, 68, 0.05)", 
                              border: `1px solid ${userDivFree >= 0 ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"}`, 
                              padding: "16px" 
                            }}>
                              <div className="kpi-label" style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Free Budget Availability</div>
                              <div className="kpi-value" style={{ 
                                fontSize: "18px", 
                                color: userDivFree >= 0 ? "var(--green)" : "#ef4444", 
                                fontWeight: "800" 
                              }}>
                                ${formatBudgetVal(userDivFree)}
                              </div>
                              <div className="kpi-subtitle" style={{ fontSize: "10px", color: userDivFree >= 0 ? "var(--green)" : "#ef4444" }}>
                                {userDivFree >= 0 ? "Available G&A Margin" : "Budget Overcommitted"}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Line items table */}
                      <div className="card" style={{ background: "var(--card-bg)", margin: 0 }}>
                        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <h3 style={{ margin: 0 }}>Consolidated Division Proposal Ledger</h3>
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button 
                              onClick={() => {
                                setShowVersionsPanel(!showVersionsPanel);
                                if (editableProposal) {
                                  loadVersions(editableProposal.id);
                                }
                              }}
                              className="btn"
                              style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                            >
                              <ClipboardList size={14} /> History &amp; Snapshots {versions.length > 0 && `(${versions.length})`}
                            </button>
                            {editableProposal.status === "draft" && (
                              <button 
                                onClick={handleAddItem}
                                className="btn"
                                style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                              >
                                <span>+</span> Add Line Item
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                          {showVersionsPanel && (
                            <div style={{ padding: "16px", backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <ClipboardList size={16} /> Budget Version History (Track Changes)
                                </h4>
                                <button onClick={() => setShowVersionsPanel(false)} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "16px", fontWeight: "bold" }}>×</button>
                              </div>
                              {versions.length === 0 ? (
                                <div style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "8px 0" }}>
                                  No previous snapshots or compiled versions found for this proposal. A snapshot will be saved automatically when you re-compile.
                                </div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "200px", overflowY: "auto" }}>
                                  {versions.map(v => {
                                    const total = getVersionTotal(v);
                                    return (
                                      <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "var(--surface-3)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                                        <div>
                                          <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--text)" }}>
                                            Version v{v.versionNumber} — {new Date(v.createdAt).toLocaleString()}
                                          </div>
                                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                            {v.notes} • By {v.createdBy?.name || "System"}
                                          </div>
                                          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                            {v.proposalData.length} items • Total: ${formatBudgetVal(total)}
                                          </div>
                                        </div>
                                        <button
                                          onClick={() => handleRestoreVersion(v.versionNumber)}
                                          className="btn"
                                          style={{ padding: "6px 12px", fontSize: "12px", backgroundColor: "var(--gold)", color: "#000", border: "none", fontWeight: "bold" }}
                                        >
                                          Restore Snapshot
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                          <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                            <thead>
                              <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                                <th style={{ textAlign: "left", padding: "12px 16px", width: 140 }}>
                                  Category
                                  <HelpTooltip text="For personnel categories, apply a 2.0x labor burden multiplier to base salaries to account for pension, insurance, and benefit overheads." />
                                </th>
                                <th style={{ textAlign: "left", padding: "12px 16px" }}>Detailed Description</th>
                                <th style={{ textAlign: "left", padding: "12px 16px", width: 180 }}>Associated Contract</th>
                                <th style={{ textAlign: "right", padding: "12px 16px", width: 130 }}>Request Amount ($)</th>
                                <th style={{ textAlign: "left", padding: "12px 16px", width: 160 }}>Authority Audit</th>
                                {editableProposal.status === "draft" && <th style={{ textAlign: "center", padding: "12px 16px", width: 60 }}>Actions</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {editableProposal.proposalData.length === 0 ? (
                                <tr>
                                  <td colSpan={editableProposal.status === "draft" ? 6 : 5} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                                    No items drafted. Compile approved sub-unit proposals or click &quot;Add Line Item&quot; to begin.
                                  </td>
                                </tr>
                              ) : (
                                editableProposal.proposalData.map((item, index) => (
                                  <tr key={index} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                                    <td style={{ padding: "10px 16px" }}>
                                      <input 
                                        type="text"
                                        value={item.category}
                                        onChange={(e) => handleItemChange(index, "category", e.target.value)}
                                        disabled={editableProposal.status !== "draft"}
                                        style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: editableProposal.status === "draft" ? "var(--surface-3)" : "transparent", border: editableProposal.status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                      />
                                    </td>
                                    <td style={{ padding: "10px 16px" }}>
                                      <input 
                                        type="text"
                                        value={item.desc}
                                        onChange={(e) => handleItemChange(index, "desc", e.target.value)}
                                        disabled={editableProposal.status !== "draft"}
                                        style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: editableProposal.status === "draft" ? "var(--surface-3)" : "transparent", border: editableProposal.status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                      />
                                    </td>
                                    <td style={{ padding: "10px 16px" }}>
                                      <select
                                        value={item.contractId || ""}
                                        onChange={(e) => handleItemChange(index, "contractId", e.target.value)}
                                        disabled={editableProposal.status !== "draft"}
                                        style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: editableProposal.status === "draft" ? "var(--surface-3)" : "transparent", border: editableProposal.status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                      >
                                        <option value="">-- No Contract (G&A/Operating) --</option>
                                        {contracts.map(c => (
                                          <option key={c.id} value={c.id}>
                                            {c.title.length > 28 ? `${c.title.slice(0, 25)}...` : c.title} ({c.vendor?.name})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                                      {editableProposal.status === "draft" ? (
                                        <input 
                                          type="number"
                                          value={item.amount}
                                          onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                                          style={{ width: 110, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)" }}
                                        />
                                      ) : (
                                        `$${formatBudgetVal(item.amount)}`
                                      )}
                                    </td>
                                    <td style={{ padding: "10px 16px" }}>
                                      {(() => {
                                        if (!item.contractId) {
                                          return <span style={{ color: "var(--text-secondary)", fontSize: 11, fontStyle: "italic" }}>G&A / Operating Funds</span>;
                                        }
                                        const remCap = getContractRemainingCap(item.contractId);
                                        const requested = parseFloat(item.amount || 0);
                                        if (requested > remCap) {
                                          return (
                                            <span style={{ color: "#ef4444", fontSize: 11, fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }} title={`Remaining Contract Cap: $${formatBudgetVal(remCap, true)}`}>
                                              <AlertTriangle size={12} /> Cap Exceeded by ${formatBudgetVal(requested - remCap, true)}
                                            </span>
                                          );
                                        } else if (requested >= remCap * 0.9) {
                                          return (
                                            <span style={{ color: "var(--gold)", fontSize: 11, fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }} title={`Remaining Contract Cap: $${formatBudgetVal(remCap, true)}`}>
                                              <AlertTriangle size={12} /> Approaching Cap (Left: ${formatBudgetVal(remCap - requested, true)})
                                            </span>
                                          );
                                        }
                                        return (
                                          <span style={{ color: "var(--green)", fontSize: 11, fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }} title={`Remaining Contract Cap: $${formatBudgetVal(remCap, true)}`}>
                                            <Check size={12} /> Verified (Cap left: ${formatBudgetVal(remCap, true)})
                                          </span>
                                        );
                                      })()}
                                    </td>
                                    {editableProposal.status === "draft" && (
                                      <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                        <button 
                                          onClick={() => handleRemoveItem(index)}
                                          style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>

                          {/* Footnote */}
                          <div style={{ 
                            marginTop: '12px', 
                            fontSize: '12px', 
                            color: 'var(--text-secondary)', 
                            fontStyle: 'italic', 
                            borderTop: '1px solid var(--border)', 
                            padding: '10px 16px',
                            textAlign: 'left'
                          }}>
                            * Note: Budget amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
                          </div>
                        </div>
                      </div>

                      {/* Comments & Submit Card */}
                      <div className="card" style={{ background: "var(--card-bg)", padding: "20px" }}>
                        <h4 style={{ margin: "0 0 12px 0" }}>Justification & Consolidated Narrative</h4>
                        <textarea 
                          rows={4}
                          value={editableProposal.notes || ""}
                          onChange={(e) => {
                            const updated = proposals.map(p => p.id === editableProposal.id ? { ...p, notes: e.target.value } : p);
                            setProposals(updated);
                          }}
                          disabled={editableProposal.status !== "draft"}
                          placeholder="Enter justification for the consolidated division ledger to be reviewed by the budget director..."
                          style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: editableProposal.status === "draft" ? "var(--surface-3)" : "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, resize: "none" }}
                        />
                      
                        {editableProposal.status === "draft" && (
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: "16px" }}>
                            <button 
                              onClick={handleSaveDraft}
                              disabled={saving}
                              className="btn"
                              style={{ backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {saving ? "Saving..." : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Save Draft <Save size={12} /></span>}
                            </button>
                            <button 
                              onClick={handleSubmitProposal}
                              disabled={saving}
                              className="btn btn-primary"
                              style={{ minWidth: 160, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                            >
                              {saving ? "Submitting..." : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Submit to Finance <Send size={12} /></span>}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SOP Sidebar */}
                    <div style={{ width: "320px", flexShrink: 0, padding: "20px", backgroundColor: "var(--surface-3)", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text)", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: 8, color: "var(--gold)", display: "flex", alignItems: "center", gap: "6px" }}>
                        <BookOpen size={16} /> Consolidation Guide
                      </h4>
                      <div>
                        <h5 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 600 }}>1. Review Bureaus</h5>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                          Inspect telecom, cyber, or brand strategy requests. Approve correct proposals or reject back to draft with comments.
                        </p>
                      </div>
                      <div>
                        <h5 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 600 }}>2. Consolidate</h5>
                        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                          Once all units are approved, consolidate. This merges their lines into a unified proposal, ready for final check-off.
                        </p>
                      </div>
                      <div style={{ padding: 12, borderRadius: 6, backgroundColor: "var(--surface-2)", borderLeft: "4px solid var(--gold)" }}>
                        <h5 style={{ margin: "0 0 4px 0", fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>Oversight Cap:</h5>
                        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                          If the consolidated requests exceed your division target allocation, you can trim lines or request a justification waiver in the narrative comments.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* VIEW C: BUREAU CHIEF SIMPLIFIED EDITOR VIEW                       */}
            {/* ================================================================= */}
            {isBureauChief && proposals[0] && (
              <div style={{ display: "flex", gap: "24px", alignItems: "flex-start", width: "100%" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
                  
                  {/* KPI status board */}
                  <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", width: "100%", margin: 0 }}>
                    <div className="kpi-card kpi-blue">
                      <div className="kpi-label">Your Bureau &amp; Subunit</div>
                      <div className="kpi-value" style={{ fontSize: "16px", marginTop: "4px" }}>
                        {proposals[0].bureau}
                      </div>
                      <div className="kpi-subtitle">{proposals[0].subunit}</div>
                    </div>
                    <div className="kpi-card kpi-gold">
                      <div className="kpi-label">Requested Total</div>
                      <div className="kpi-value">${formatBudgetVal(getProposalTotal(proposals[0]))}</div>
                      <div className="kpi-subtitle">Sum of unit lines</div>
                    </div>
                    <div className="kpi-card kpi-purple">
                      <div className="kpi-label">Workflow Status</div>
                      <div className="kpi-value" style={{ textTransform: "capitalize", fontSize: "20px" }}>
                        {getStatusLabel(proposals[0].status)}
                      </div>
                      <div className="kpi-subtitle">Reviewed by Division Lead</div>
                    </div>
                  </div>

                  {/* Workflow state notices */}
                  {proposals[0].status === "submitted" && (
                    <div style={{ padding: "14px 18px", backgroundColor: "rgba(59, 130, 246, 0.08)", color: "var(--blue)", borderRadius: "6px", border: "1px solid rgba(59, 130, 246, 0.2)", fontSize: 13, display: "flex", alignItems: "center", gap: "10px" }}>
                      <ClipboardList size={18} />
                      <div>
                        <strong>Submitted to Division Lead</strong>: Your ledger is currently locked and awaiting review by the Division Lead.
                      </div>
                    </div>
                  )}

                  {proposals[0].status === "approved" && (
                    <div style={{ padding: "14px 18px", backgroundColor: "rgba(34, 197, 94, 0.08)", color: "var(--green)", borderRadius: "6px", border: "1px solid rgba(34, 197, 94, 0.2)", fontSize: 13, display: "flex", alignItems: "center", gap: "10px" }}>
                      <Award size={18} />
                      <div>
                        <strong>Draft Approved!</strong> Your budget proposal has been approved and consolidated into the division-level budget.
                      </div>
                    </div>
                  )}

                  {proposals[0].status === "rejected" && (
                    <div style={{ padding: "14px 18px", backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#dc2626", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.2)", fontSize: 13, display: "flex", flexDirection: "column", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", fontWeight: "bold" }}>
                        <AlertTriangle size={18} />
                        Revisions Requested by Division Lead
                      </div>
                      {proposals[0].notes && (
                        <div style={{ marginTop: "4px", fontStyle: "italic", fontSize: "12px", backgroundColor: "rgba(239, 68, 68, 0.04)", padding: "8px", borderRadius: "4px" }}>
                          Notes: &quot;{proposals[0].notes}&quot;
                        </div>
                      )}
                    </div>
                  )}

                  {/* Lines Editor */}
                  <div className="card" style={{ background: "var(--card-bg)", margin: 0 }}>
                    <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0 }}>Proposed Bureau Ledger Items</h3>
                      {proposals[0].status === "draft" && (
                        <button 
                          onClick={handleAddItem}
                          className="btn"
                          style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                        >
                          <span>+</span> Add Line Item
                        </button>
                      )}
                    </div>
                    <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                        <thead>
                          <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                            <th style={{ textAlign: "left", padding: "12px 16px", width: 140 }}>Category</th>
                            <th style={{ textAlign: "left", padding: "12px 16px" }}>Detailed Description</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", width: 180 }}>Associated Contract</th>
                            <th style={{ textAlign: "right", padding: "12px 16px", width: 130 }}>Request Amount ($)</th>
                            <th style={{ textAlign: "left", padding: "12px 16px", width: 160 }}>Authority Audit</th>
                            {proposals[0].status === "draft" && <th style={{ textAlign: "center", padding: "12px 16px", width: 60 }}>Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {proposals[0].proposalData.length === 0 ? (
                            <tr>
                              <td colSpan={proposals[0].status === "draft" ? 6 : 5} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                                No items drafted. Click &quot;Add Line Item&quot; to begin formulating your ledger.
                              </td>
                            </tr>
                          ) : (
                            proposals[0].proposalData.map((item, index) => (
                              <tr key={index} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                                <td style={{ padding: "10px 16px" }}>
                                  <input 
                                    type="text"
                                    value={item.category}
                                    onChange={(e) => handleItemChange(index, "category", e.target.value)}
                                    disabled={proposals[0].status !== "draft"}
                                    style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <input 
                                    type="text"
                                    value={item.desc}
                                    onChange={(e) => handleItemChange(index, "desc", e.target.value)}
                                    disabled={proposals[0].status !== "draft"}
                                    style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                  />
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  <select
                                    value={item.contractId || ""}
                                    onChange={(e) => handleItemChange(index, "contractId", e.target.value)}
                                    disabled={proposals[0].status !== "draft"}
                                    style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                  >
                                    <option value="">-- No Contract (G&A/Operating) --</option>
                                    {contracts.map(c => (
                                      <option key={c.id} value={c.id}>
                                        {c.title.length > 28 ? `${c.title.slice(0, 25)}...` : c.title} ({c.vendor?.name})
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                                  {proposals[0].status === "draft" ? (
                                    <input 
                                      type="number"
                                      value={item.amount}
                                      onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                                      style={{ width: 110, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)" }}
                                    />
                                  ) : (
                                    `$${formatBudgetVal(item.amount)}`
                                  )}
                                </td>
                                <td style={{ padding: "10px 16px" }}>
                                  {(() => {
                                    if (!item.contractId) {
                                      return <span style={{ color: "var(--text-secondary)", fontSize: 11, fontStyle: "italic" }}>G&A / Operating Funds</span>;
                                    }
                                    const remCap = getContractRemainingCap(item.contractId);
                                    const requested = parseFloat(item.amount || 0);
                                    if (requested > remCap) {
                                      return (
                                        <span style={{ color: "#ef4444", fontSize: 11, fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }} title={`Remaining Contract Cap: $${remCap.toLocaleString()}`}>
                                          <AlertTriangle size={12} /> Cap Exceeded by ${(requested - remCap).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                      );
                                    }
                                    return (
                                      <span style={{ color: "var(--green)", fontSize: 11, fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }} title={`Remaining Contract Cap: $${remCap.toLocaleString()}`}>
                                        <Check size={12} /> Verified (Cap left: ${remCap.toLocaleString(undefined, { maximumFractionDigits: 0 })})
                                      </span>
                                    );
                                  })()}
                                </td>
                                {proposals[0].status === "draft" && (
                                  <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                    <button 
                                      onClick={() => handleRemoveItem(index)}
                                      style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Narrative Justification */}
                  <div className="card" style={{ background: "var(--card-bg)", padding: "20px" }}>
                    <h4 style={{ margin: "0 0 12px 0" }}>Justification & Narrative Comments</h4>
                    <textarea 
                      rows={4}
                      value={proposals[0].notes || ""}
                      onChange={(e) => {
                        const updated = proposals.map(p => p.id === proposals[0].id ? { ...p, notes: e.target.value } : p);
                        setProposals(updated);
                      }}
                      disabled={proposals[0].status !== "draft"}
                      placeholder="Enter operational explanations or business justifications for this bureau's request ledger..."
                      style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, resize: "none" }}
                    />
                  
                    {proposals[0].status === "draft" && (
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: "16px" }}>
                        <button 
                          onClick={handleSaveDraft}
                          disabled={saving}
                          className="btn"
                          style={{ backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {saving ? "Saving..." : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Save Draft <Save size={12} /></span>}
                        </button>
                        <button 
                          onClick={handleSubmitProposal}
                          disabled={saving}
                          className="btn btn-primary"
                          style={{ minWidth: 160, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        >
                          {saving ? "Submitting..." : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>Submit to Division Lead <Send size={12} /></span>}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* SOP Sidebar */}
                <div style={{ width: "320px", flexShrink: 0, padding: "20px", backgroundColor: "var(--surface-3)", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--text)", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: 8, color: "var(--gold)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <BookOpen size={16} /> Bureau Manual
                  </h4>
                  <div>
                    <h5 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 600 }}>Formulation Phase</h5>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                      Input the operational line items (Hardware, software licenses, travel expenses) for your specific subunit.
                    </p>
                  </div>
                  <div>
                    <h5 style={{ margin: "0 0 4px 0", fontSize: 13, fontWeight: 600 }}>Submission Flow</h5>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                      Submitting locks the proposal and sends it to the Division Lead for review. If corrections are needed, they will reject it back to draft.
                    </p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 6, backgroundColor: "var(--surface-2)", borderLeft: "4px solid var(--gold)" }}>
                    <h5 style={{ margin: "0 0 4px 0", fontSize: 12, fontWeight: 600, color: "var(--gold)" }}>Note:</h5>
                    <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: "var(--text-secondary)" }}>
                      Make sure each contract-linked line is verified to avoid delay in the Division review stage.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* DETAIL REVIEW MODAL (Used by Finance & Division Leads)            */}
            {/* ================================================================= */}
            <HelpDrawer topicId="budget" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

            {selectedProposal && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ width: "80%", maxWidth: "800px", maxHeight: "90%", backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <h3 style={{ margin: 0 }}>
                      Reviewing Proposal: {selectedProposal.bureau || selectedProposal.division} 
                      {selectedProposal.subunit ? ` - ${selectedProposal.subunit}` : " (Consolidated Division)"}
                    </h3>
                    <button 
                      onClick={() => setSelectedProposal(null)}
                      style={{ border: "none", background: "none", color: "var(--text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Ledger display */}
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "10px" }}>Category</th>
                        <th style={{ textAlign: "left", padding: "10px" }}>Description</th>
                        <th style={{ textAlign: "left", padding: "10px", width: 180 }}>Associated Contract</th>
                        <th style={{ textAlign: "right", padding: "10px", width: 130 }}>Amount ($)</th>
                        <th style={{ textAlign: "left", padding: "10px", width: 160 }}>Authority Audit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProposal.proposalData.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px", fontWeight: "bold" }}>{item.category}</td>
                          <td style={{ padding: "10px" }}>{item.desc}</td>
                          <td style={{ padding: "10px", color: "var(--text-secondary)" }}>
                            {(() => {
                              const contract = contracts.find(c => c.id === item.contractId);
                              return contract ? `${contract.title.slice(0, 20)}...` : "— (Operating)";
                            })()}
                          </td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            ${formatBudgetVal(parseFloat(item.amount))}
                          </td>
                          <td style={{ padding: "10px" }}>
                            {(() => {
                              if (!item.contractId) {
                                return <span style={{ color: "var(--text-secondary)", fontSize: 11, fontStyle: "italic" }}>G&A / Operating Funds</span>;
                              }
                              const remCap = getContractRemainingCap(item.contractId);
                              const requested = parseFloat(item.amount || 0);
                              if (requested > remCap) {
                                return (
                                  <span style={{ color: "#ef4444", fontSize: 11, fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                    <AlertTriangle size={12} /> Cap Exceeded by ${formatBudgetVal(requested - remCap, true)}
                                  </span>
                                );
                              }
                              return (
                                <span style={{ color: "var(--green)", fontSize: 11, fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                  <Check size={12} /> Verified (Cap left: ${formatBudgetVal(remCap, true)})
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: "var(--surface-3)", fontWeight: "bold" }}>
                        <td colSpan={3} style={{ padding: "10px", textAlign: "right" }}>Proposal Total:</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ${formatBudgetVal(getProposalTotal(selectedProposal))}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Footnote */}
                  <div style={{ 
                    marginTop: '12px', 
                    fontSize: '12px', 
                    color: 'var(--text-secondary)', 
                    fontStyle: 'italic', 
                    borderTop: '1px solid var(--border)', 
                    padding: '10px 16px',
                    textAlign: 'left'
                  }}>
                    * Note: Budget amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
                  </div>

                  {selectedProposal.notes && (
                    <div style={{ backgroundColor: "var(--surface-3)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                      <strong style={{ display: "block", fontSize: 12, marginBottom: "4px", color: "var(--text-secondary)" }}>Justification Narrative:</strong>
                      <span style={{ fontSize: 13 }}>{selectedProposal.notes}</span>
                    </div>
                  )}

                  {/* Actions (Approve / Reject buttons shown if submitted and user is reviewer) */}
                  {selectedProposal.status === "submitted" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <strong style={{ fontSize: 13 }}>Review Decisions &amp; Action Comments:</strong>
                      <textarea 
                        rows={3}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Enter justification for approval, or detail required corrections if rejecting..."
                        style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, resize: "none" }}
                      />

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                        <button 
                          onClick={() => handleReviewAction("reject")}
                          disabled={saving}
                          className="btn"
                          style={{ backgroundColor: "#ef4444", color: "#fff", border: "none", minWidth: 100, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          Reject / Revise <XCircle size={14} />
                        </button>
                        <button 
                          onClick={() => handleReviewAction("approve")}
                          disabled={saving}
                          className="btn"
                          style={{ backgroundColor: "var(--green)", color: "#fff", border: "none", minWidth: 100, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                        >
                          Approve Draft <Check size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
