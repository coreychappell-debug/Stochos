'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Lock, Unlock, AlertTriangle, CheckCircle2, ArrowUpFromLine, BarChart3, ClipboardList, TrendingUp, ShieldCheck, X, BookOpen, Home, RefreshCw } from 'lucide-react';
import HelpDrawer from '../../components/HelpDrawer';
import HelpTooltip from '../../components/HelpTooltip';

export default function UploadClient() {
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const isAdmin = user?.role === 'admin';

  const [activeLocks, setActiveLocks] = useState([]);
  const [isForceReleasing, setIsForceReleasing] = useState(false);
  const isUploadingRef = useRef(false);

  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Sticky top filter states
  const [jurisdictionId, setJurisdictionId] = useState('52066ac6-27d4-4495-953b-8f8def2a7851'); // NY Lottery default seed
  const [fiscalYear, setFiscalYear] = useState(2025);
  const [periodCode, setPeriodCode] = useState('P03'); // June (Month 3) of FY25
  const [startMonth, setStartMonth] = useState(7); // Default to July (7)

  // Tab state: 'ingest' | 'ledger' | 'rules' | 'yoy'
  const [activeTab, setActiveTab] = useState('ingest');

  // Period Lock and double-entry states
  const [isLocked, setIsLocked] = useState(false);
  const [isLockLoading, setIsLockLoading] = useState(false);
  const [outOfBalanceAmount, setOutOfBalanceAmount] = useState(0);

  // Upload States
  const [file, setFile] = useState(null);
  const [pipelineId, setPipelineId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [pipelines, setPipelines] = useState([]);
  const [batches, setBatches] = useState([]);

  // Audit Inspect states
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [traces, setTraces] = useState([]);
  const [isLoadingTraces, setIsLoadingTraces] = useState(false);

  // Ledger States
  const [ledgerRecords, setLedgerRecords] = useState([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(0);
  const [ledgerCurrentPage, setLedgerCurrentPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(25);
  const [searchText, setSearchText] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSortBy, setLedgerSortBy] = useState('accountCode');
  const [ledgerSortOrder, setLedgerSortOrder] = useState('asc');
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  // Ledger Edit States
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingCode, setEditingCode] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingBalance, setEditingBalance] = useState('');

  // Ledger Add New Entry States
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  // Crosswalk Rules States
  const [rules, setRules] = useState([]);
  const [isRulesLoading, setIsRulesLoading] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleMetricId, setNewRuleMetricId] = useState('sys-001');
  const [newRuleMultiplier, setNewRuleMultiplier] = useState(1.0);
  const [newRuleDesc, setNewRuleDesc] = useState('');
  const [newRuleStart, setNewRuleStart] = useState('2020-01-01');
  const [newRuleEnd, setNewRuleEnd] = useState('');
  const [ruleMessage, setRuleMessage] = useState('');

  // YoY States
  const [yoyData, setYoyData] = useState([]);
  const [isYoYLoading, setIsYoYLoading] = useState(false);
  const [yoyError, setYoYError] = useState('');

  const getMonthName = (monthIndex) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex % 12];
  };

  // Standard periods listing (computed dynamically based on startMonth)
  const periods = useMemo(() => {
    const baseIndex = startMonth - 1;
    const periodsList = [];
    for (let i = 0; i < 12; i++) {
      const pNum = i + 1;
      const pCode = `P${String(pNum).padStart(2, '0')}`;
      const mName = getMonthName(baseIndex + i);
      periodsList.push({
        code: pCode,
        label: `Period ${pNum} (${mName})`
      });
    }
    periodsList.push({
      code: 'P13',
      label: `Period 13 (EOY Adjustments)`
    });

    const qMap = [
      { code: 'Q1', pNum: 3, label: 'Quarter 1 Close (Q1)' },
      { code: 'Q2', pNum: 6, label: 'Quarter 2 Close (Q2)' },
      { code: 'Q3', pNum: 9, label: 'Quarter 3 Close (Q3)' },
      { code: 'Q4', pNum: 12, label: 'Quarter 4 Close (Q4)' }
    ];

    qMap.forEach(q => {
      const insertIdx = periodsList.findIndex(p => p.code === `P${String(q.pNum).padStart(2, '0')}`);
      if (insertIdx !== -1) {
        periodsList.splice(insertIdx + 1, 0, {
          code: q.code,
          label: q.label
        });
      }
    });

    return periodsList;
  }, [startMonth]);

  // Helper date resolver
  const resolvePeriodDate = useCallback((year, code) => {
    const baseIndex = startMonth - 1;
    let monthOffset = 0;
    if (code.startsWith('P')) {
      const pNum = parseInt(code.substring(1), 10);
      if (pNum === 13) {
        monthOffset = 11;
      } else {
        monthOffset = pNum - 1;
      }
    } else if (code.startsWith('Q')) {
      const qNum = parseInt(code.substring(1), 10);
      monthOffset = qNum * 3 - 1;
    }

    const targetMonthIndex = (baseIndex + monthOffset) % 12;
    const dateYear = (baseIndex + monthOffset) >= 12 ? year : year - 1;

    const getDaysInMonth = (y, m) => {
      return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    };

    const days = getDaysInMonth(dateYear, targetMonthIndex);
    const date = new Date(Date.UTC(dateYear, targetMonthIndex, days));
    return date.toISOString().split('T')[0];
  }, [startMonth]);

  const periodDate = resolvePeriodDate(fiscalYear, periodCode);

  // Fetch active server-side job locks
  const fetchActiveLocks = useCallback(async () => {
    try {
      const res = await fetch('/api/reporting/jobs');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveLocks(data.activeJobs || []);
        }
      }
    } catch (err) {
      console.error('Error fetching active locks:', err);
    }
  }, []);

  // Force release a server-side lock (Admin only)
  const handleForceReleaseLock = async (lockKey) => {
    if (!window.confirm(`Are you sure you want to force-release lock "${lockKey}"? This can cause database state inconsistencies if the process is still running.`)) {
      return;
    }
    setIsForceReleasing(true);
    try {
      const res = await fetch(`/api/reporting/jobs?lockKey=${encodeURIComponent(lockKey)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message);
        fetchActiveLocks();
      } else {
        alert(data.error || 'Failed to override lock');
      }
    } catch (err) {
      console.error(err);
      alert('Error releasing lock');
    } finally {
      setIsForceReleasing(false);
    }
  };

  // Fetch lock status and out-of-balance calculations
  const fetchLockStatus = useCallback(async () => {
    try {
      const lockRes = await fetch(`/api/reporting/trial-balance/lock?jurisdictionId=${jurisdictionId}&fiscalYear=${fiscalYear}&periodCode=${periodCode}`);
      if (lockRes.ok) {
        const lockData = await lockRes.json();
        setIsLocked(lockData.isLocked);
      }

      // Check balance sum for out-of-balance warning
      const ledgerRes = await fetch(`/api/reporting/ledger?jurisdictionId=${jurisdictionId}&periodDate=${periodDate}&limit=9999`);
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        const records = ledgerData.records || [];
        const sum = records.reduce((acc, curr) => acc + parseFloat(curr.balance), 0);
        setOutOfBalanceAmount(Math.round(sum * 100) / 100);
      }
    } catch (err) {
      console.error('Error fetching lock status:', err);
    }
  }, [jurisdictionId, fiscalYear, periodCode, periodDate]);

  // Fetch ledger list
  const fetchLedger = useCallback(async (
    page = ledgerCurrentPage,
    search = ledgerSearch,
    sortBy = ledgerSortBy,
    sortOrder = ledgerSortOrder,
    limit = ledgerLimit
  ) => {
    setIsLedgerLoading(true);
    setLedgerError('');
    try {
      const queryParams = new URLSearchParams({
        jurisdictionId,
        periodDate,
        page: page.toString(),
        limit: limit.toString(),
        search,
        sortBy,
        sortOrder
      });
      const res = await fetch(`/api/reporting/ledger?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setLedgerRecords(data.records || []);
          setLedgerTotalCount(data.totalCount || 0);
          setLedgerTotalPages(data.totalPages || 0);
          setLedgerCurrentPage(data.currentPage || 1);
        } else {
          setLedgerError(data.error || 'Failed to fetch ledger records');
        }
      } else {
        setLedgerError('Failed to load ledger from server.');
      }
    } catch (err) {
      console.error(err);
      setLedgerError(err.message || 'An error occurred fetching ledger');
    } finally {
      setIsLedgerLoading(false);
    }
  }, [jurisdictionId, periodDate, ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit]);

  // Fetch crosswalk rules
  const fetchRules = useCallback(async () => {
    setIsRulesLoading(true);
    try {
      const res = await fetch(`/api/reporting/trial-balance/crosswalk?jurisdictionId=${jurisdictionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRules(data.rules || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRulesLoading(false);
    }
  }, [jurisdictionId]);

  // Fetch YoY Variance Report
  const fetchYoYComparison = useCallback(async () => {
    setIsYoYLoading(true);
    setYoYError('');
    try {
      const res = await fetch(`/api/reporting/trial-balance/yoy?jurisdictionId=${jurisdictionId}&fiscalYear=${fiscalYear}&periodCode=${periodCode}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setYoyData(data.comparison || []);
        } else {
          setYoYError(data.error || 'Failed to calculate Year-over-Year data');
        }
      } else {
        setYoYError('Failed to retrieve YoY data from server.');
      }
    } catch (err) {
      console.error(err);
      setYoYError(err.message || 'Error fetching YoY analysis');
    } finally {
      setIsYoYLoading(false);
    }
  }, [jurisdictionId, fiscalYear, periodCode]);

  // Handle period locking
  const handleToggleLock = async () => {
    if (isLockLoading) return;
    setIsLockLoading(true);
    const targetAction = isLocked ? 'unlock' : 'lock';

    if (targetAction === 'lock' && Math.abs(outOfBalanceAmount) > 0.01) {
      alert(`Reconciliation Block: Cannot close the books. The General Ledger is out of balance by $${outOfBalanceAmount.toFixed(2)}. Adjust discrepancies before locking.`);
      setIsLockLoading(false);
      return;
    }

    if (!window.confirm(`Are you sure you want to ${targetAction} this reporting period? This will restrict data access and audits.`)) {
      setIsLockLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/reporting/trial-balance/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId,
          fiscalYear,
          periodCode,
          action: targetAction
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsLocked(data.isLocked);
        alert(data.message);
      } else {
        alert(data.error || 'Failed to modify period lock.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating lock status.');
    } finally {
      setIsLockLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 
      "account_code,account_name,balance\n" +
      "1-1000,Cash and Cash Equivalents,231000000.00\n" +
      "1-1200,Accounts Receivable,45000000.00\n" +
      "1-1201,Allowance for Doubtful Accounts,-5000000.00\n" +
      "1-1300,Prepaid Expenses,8000000.00\n" +
      "1-2000,Capital Assets,110000000.00\n" +
      "1-2100,Accumulated Depreciation,-35000000.00\n" +
      "2-1000,Accounts Payable,-28000000.00\n" +
      "2-1100,Prizes Payable,-112000000.00\n" +
      "2-1200,Due to Education Fund,-45000000.00\n" +
      "2-1300,Unearned Revenue,-12000000.00\n" +
      "3-1000,Net Investment in Capital Assets,-75000000.00\n" +
      "3-1100,Restricted for Prizes,-50000000.00\n" +
      "3-1200,Unrestricted Net Position,-30000000.00\n" +
      "4-1000,Gross Ticket Sales,-850000000.00\n" +
      "5-2000,Prize Expense,520000000.00\n" +
      "5-2100,Retailer Commissions,48000000.00\n" +
      "5-2200,Vendor Gaming Fees,22000000.00\n" +
      "6-4000,Advertising & Marketing,12000000.00\n" +
      "6-4100,Salaries & Wages,15000000.00\n" +
      "6-4200,G&A,8000000.00\n" +
      "4-3000,Investment Income,-4000000.00\n" +
      "5-2300,Benefactor Transfer,227000000.00\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "starter_balanced_trial_balance.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  // Upload handler
  const handleUpload = async (e) => {
    e.preventDefault();
    if (isUploadingRef.current) return;
    if (!file || !jurisdictionId) {
      setUploadMessage('Error: Select a trial balance CSV file.');
      return;
    }

    isUploadingRef.current = true;
    setIsUploading(true);
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('jurisdictionId', jurisdictionId);
    formData.append('periodDate', periodDate);
    formData.append('fiscalYear', fiscalYear.toString());
    formData.append('periodCode', periodCode);
    if (pipelineId) {
      formData.append('pipelineId', pipelineId);
    }

    try {
      const response = await fetch('/api/reporting/upload', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok) {
        setUploadMessage(`Success! Ingested ${data.count} records cleanly.`);
        setFile(null);
        e.target.reset();
        
        // Refresh lock, logs, ledger, YoY, and active locks
        fetchLockStatus();
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        fetchYoYComparison();
        fetchActiveLocks();
        
        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const d = await resBatches.json();
          if (d.success) setBatches(d.batches);
        }
      } else {
        setUploadMessage(`Error: ${data.error || 'Failed to upload'}`);
      }
    } catch (error) {
      setUploadMessage(`Error: ${error.message}`);
    } finally {
      isUploadingRef.current = false;
      setIsUploading(false);
    }
  };

  // Rollback handler
  const handleRollback = async (batchId) => {
    if (isLocked) {
      alert('Period is locked. Reversing records is blocked.');
      return;
    }
    if (!window.confirm('Are you sure you want to rollback this upload batch? All associated ledger items will be deleted atomically.')) {
      return;
    }

    try {
      const res = await fetch('/api/reporting/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rollback', batchId })
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Batch rolled back successfully.');
        fetchLockStatus();
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        fetchYoYComparison();

        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const d = await resBatches.json();
          if (d.success) setBatches(d.batches);
        }
      } else {
        alert(data.error || 'Failed to rollback batch.');
      }
    } catch (err) {
      console.error(err);
      alert('Error during rollback.');
    }
  };

  // Manual Adjustments Handlers
  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (isLocked) {
      alert('This period is locked. Edits are blocked.');
      return;
    }
    if (!newCode || !newName || newBalance === '') {
      alert('Please fill out all fields.');
      return;
    }
    setIsAddingEntry(true);
    try {
      const res = await fetch('/api/reporting/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId,
          periodDateStr: periodDate,
          accountCode: newCode,
          accountName: newName,
          balance: parseFloat(newBalance) || 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNewCode('');
        setNewName('');
        setNewBalance('');
        setUploadMessage('Manual entry added. Ledger checks updated.');
        fetchLockStatus();
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        fetchYoYComparison();
      } else {
        alert(data.error || 'Failed to add entry.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingEntry(false);
    }
  };

  const handleSaveEdit = async (id) => {
    if (isLocked) {
      alert('This period is locked. Edits are blocked.');
      return;
    }
    try {
      const res = await fetch('/api/reporting/ledger', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          accountCode: editingCode,
          accountName: editingName,
          balance: parseFloat(editingBalance) || 0
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setEditingRecordId(null);
        setUploadMessage('Ledger record updated.');
        fetchLockStatus();
        fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        fetchYoYComparison();
      } else {
        alert(data.error || 'Failed to edit record.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (isLocked) {
      alert('Period is locked. Deletes are blocked.');
      return;
    }
    if (!window.confirm('Delete this ledger record? This will instantly adjust reporting actuals.')) {
      return;
    }
    try {
      const res = await fetch(`/api/reporting/ledger?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setUploadMessage('Ledger record deleted.');
        fetchLockStatus();
        fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        fetchYoYComparison();
      } else {
        alert(data.error || 'Failed to delete record.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Crosswalk Rules Handlers
  const handleCreateRule = async (e) => {
    e.preventDefault();
    if (!newRulePattern) {
      alert('Pattern is required.');
      return;
    }
    setRuleMessage('');
    try {
      const res = await fetch('/api/reporting/trial-balance/crosswalk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId,
          accountPattern: newRulePattern,
          metricId: newRuleMetricId,
          signageMultiplier: parseFloat(newRuleMultiplier),
          description: newRuleDesc,
          effectiveStartDate: newRuleStart,
          effectiveEndDate: newRuleEnd || null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRuleMessage('Crosswalk mapping rule created successfully.');
        setNewRulePattern('');
        setNewRuleDesc('');
        fetchRules();
        fetchYoYComparison(); // recalculate mapped metrics
      } else {
        setRuleMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRule = async (id) => {
    if (!window.confirm('Delete this mapping rule? This will affect metric groupings.')) {
      return;
    }
    try {
      const res = await fetch(`/api/reporting/trial-balance/crosswalk?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRules();
        fetchYoYComparison();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInspectBatch = async (batchId) => {
    setIsLoadingTraces(true);
    try {
      const res = await fetch(`/api/reporting/upload?batchId=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedBatch(data.batch);
          setTraces(data.traces);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingTraces(false);
    }
  };

  const startEditing = (record) => {
    if (isLocked) return;
    setEditingRecordId(record.id);
    setEditingCode(record.accountCode);
    setEditingName(record.accountName);
    setEditingBalance(String(record.balance));
  };

  // Fetch active jurisdiction details on change
  useEffect(() => {
    async function fetchJurisdiction() {
      try {
        const res = await fetch(`/api/reporting/jurisdiction?id=${jurisdictionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.jurisdiction) {
            setStartMonth(data.jurisdiction.fiscalYearStartMonth || 7);
          }
        }
      } catch (err) {
        console.error('Failed to load jurisdiction details:', err);
      }
    }
    fetchJurisdiction();
  }, [jurisdictionId]);

  // Poll active locks on load and periodically
  useEffect(() => {
    fetchActiveLocks();
    const interval = setInterval(fetchActiveLocks, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveLocks]);

  // Initial loads
  useEffect(() => {
    async function loadInitial() {
      try {
        const resPipelines = await fetch('/api/reporting/pipelines');
        if (resPipelines.ok) {
          const data = await resPipelines.json();
          if (data.success) {
            setPipelines(data.pipelines || []);
            if (data.pipelines.length > 0) setPipelineId(data.pipelines[0].id);
          }
        }

        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const data = await resBatches.json();
          if (data.success) setBatches(data.batches || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadInitial();
  }, []);

  // Update tabs/view when period filters or tab selection changes
  useEffect(() => {
    fetchLockStatus();
    if (activeTab === 'ledger') {
      fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
    } else if (activeTab === 'rules') {
      fetchRules();
    } else if (activeTab === 'yoy') {
      fetchYoYComparison();
    }
  }, [jurisdictionId, fiscalYear, periodCode, activeTab, ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit, fetchLockStatus, fetchLedger, fetchRules, fetchYoYComparison]);

  const handleSort = (field) => {
    if (ledgerSortBy === field) {
      setLedgerSortOrder(ledgerSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setLedgerSortBy(field);
      setLedgerSortOrder('asc');
    }
    setLedgerCurrentPage(1);
  };

  const renderSortIcon = (field) => {
    if (ledgerSortBy !== field) return ' ↕';
    return ledgerSortOrder === 'asc' ? ' ▲' : ' ▼';
  };

  const expectedLockKey = `trial-balance-ingest-${jurisdictionId}-${fiscalYear}-${periodCode}`;
  const isUploadLocked = activeLocks.some(lock => lock.lockKey === expectedLockKey);

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: '#1e293b', backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '2rem', fontFamily: '"Inter", sans-serif' }}>
      
      {/* 1. Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '1.5rem 2rem', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, letterSpacing: '-0.5px' }}>Financial Data Prep & Ledger Ingest</h1>
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0 0' }}>Governed General Ledger trial balances and Year-over-Year variance reporting</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Lock State Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: isLocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)', padding: '8px 16px', borderRadius: '8px', border: `1px solid ${isLocked ? '#f87171' : '#4ade80'}` }}>
            {isLocked ? <Lock size={16} color="#f87171" /> : <Unlock size={16} color="#4ade80" />}
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: isLocked ? '#f87171' : '#4ade80' }}>
              {isLocked ? 'Books Closed (Locked)' : 'Books Open (Drafting)'}
            </span>
          </div>

          <button 
            onClick={handleToggleLock}
            disabled={isLockLoading}
            style={{ padding: '8px 16px', background: isLocked ? '#22c55e' : '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', transition: 'background 0.2s' }}
          >
            {isLocked ? 'Unlock Period' : 'Close & Lock Books'}
          </button>

          <button 
            onClick={() => setIsHelpOpen(true)}
            style={{ padding: '8px 16px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <BookOpen size={16} /> Help & Guide
          </button>

          <button 
            onClick={() => router.push('/')}
            style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Home size={16} /> Back to Hub
          </button>

          <button 
            onClick={() => router.push('/reporting')}
            style={{ padding: '8px 16px', background: 'rgba(255, 255, 255, 0.15)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
          >
            Back to Studio
          </button>
        </div>
      </div>

      {/* 2. Sticky Period Controls */}
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', gap: '24px', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Jurisdiction</label>
          <select 
            value={jurisdictionId}
            onChange={(e) => setJurisdictionId(e.target.value)}
            style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', fontWeight: '600' }}
          >
            <option value="52066ac6-27d4-4495-953b-8f8def2a7851">New York Lottery (NY)</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Fiscal Year</label>
          <select 
            value={fiscalYear}
            onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
            style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', fontWeight: '600' }}
          >
            <option value={2026}>FY 2026</option>
            <option value={2025}>FY 2025</option>
            <option value={2024}>FY 2024</option>
            <option value={2023}>FY 2023</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Reporting Period</label>
          <select 
            value={periodCode}
            onChange={(e) => setPeriodCode(e.target.value)}
            style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', fontWeight: '600' }}
          >
            {periods.map(p => (
              <option key={p.code} value={p.code}>{p.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right', paddingRight: '12px' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Calculated Lock Date</span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', fontFamily: 'monospace' }}>{periodDate}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'right' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>
            Ledger Balance Audit
            <HelpTooltip text="Ensures double-entry balancing where the sum of all debits and credits equals exactly $0.00. Locking is blocked if out of balance." />
          </span>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: Math.abs(outOfBalanceAmount) > 0.01 ? '#ef4444' : '#22c55e', display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
            {Math.abs(outOfBalanceAmount) > 0.01 ? (
              <>
                <AlertTriangle size={16} /> Out of Balance (${outOfBalanceAmount.toLocaleString(undefined, {minimumFractionDigits: 2})})
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Balanced ($0.00)
              </>
            )}
          </span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', gap: '8px' }}>
        {[
          { id: 'ingest', label: 'Ingest & Audit Trail', icon: <ArrowUpFromLine size={16} />, tooltip: null },
          { id: 'ledger', label: 'Active Ledger Grid', icon: <BarChart3 size={16} />, tooltip: null },
          { id: 'rules', label: 'Crosswalk Mappings', icon: <ClipboardList size={16} />, tooltip: null },
          { id: 'yoy', label: 'YoY Variance Report', icon: <TrendingUp size={16} />, tooltip: 'Year-over-Year variance displays the percentage and value changes of financial actuals compared to the same period in the prior fiscal year.' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              background: activeTab === tab.id ? '#ffffff' : 'transparent',
              border: '1px solid transparent',
              borderBottom: activeTab === tab.id ? '2px solid #1a73e8' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
              color: activeTab === tab.id ? '#1a73e8' : '#64748b',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.tooltip && <HelpTooltip text={tab.tooltip} />}
          </button>
        ))}
      </div>

      {/* 4. Tab Panels */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* PANEL A: INGEST & AUDIT TRAIL */}
        {activeTab === 'ingest' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Left: Upload Form */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Import General Ledger Trial Balance</h2>
                  <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', margin: 0 }}>Select a CSV formatted ledger file mapping to period <strong>{periodCode}</strong>.</p>
                </div>

                <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {isLocked && (
                    <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#b91c1c', fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Lock size={16} /> This period is locked. New uploads are disabled. Unlock the books above to overwrite.
                    </div>
                  )}

                  {isUploadLocked && (
                    <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#b45309', fontSize: '13px', fontWeight: '500', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={16} color="#b45309" />
                        <span>A background ingest job is currently running on the server for this period. Ingestion is temporarily locked.</span>
                      </div>
                      {activeLocks.filter(l => l.lockKey === expectedLockKey).map(l => (
                        <div key={l.id} style={{ fontSize: '12px', color: '#78350f', background: 'rgba(217, 119, 6, 0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                          Process: {l.description} | Started by: {l.userName} at {new Date(l.createdAt).toLocaleTimeString()}
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Transformation Pipeline</label>
                    <select 
                      value={pipelineId}
                      onChange={(e) => setPipelineId(e.target.value)}
                      disabled={isLocked || isUploadLocked}
                      style={{ width: '100%', padding: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
                    >
                      <option value="">-- Direct Ingestion (Headers Match DB Fields) --</option>
                      {pipelines.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Trial Balance File (CSV)</label>
                    <div style={{ border: '2px dashed #cbd5e1', padding: '30px 20px', textAlign: 'center', borderRadius: '6px', background: '#f8fafc' }}>
                      <input 
                        type="file" 
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={isLocked || isUploadLocked}
                        style={{ display: 'block', margin: '0 auto', color: '#475569', fontSize: '13px' }}
                        required
                      />
                      <div style={{ marginTop: '12px' }}>
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--blue)',
                            textDecoration: 'underline',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            outline: 'none'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.color = '#0096b4'}
                          onMouseOut={(e) => e.currentTarget.style.color = 'var(--blue)'}
                        >
                          Download Starter CSV Template
                        </button>
                      </div>
                    </div>
                  </div>

                  {uploadMessage && (
                    <div style={{ padding: '12px', background: uploadMessage.includes('Error') ? '#fef2f2' : '#f0fdf4', color: uploadMessage.includes('Error') ? '#b91c1c' : '#15803d', borderRadius: '6px', border: uploadMessage.includes('Error') ? '1px solid #fee2e2' : '1px solid #bbf7d0', fontSize: '13px', fontWeight: '500' }}>
                      {uploadMessage}
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isUploading || isLocked || isUploadLocked}
                    style={{ 
                      padding: '12px', 
                      background: isUploading || isLocked || isUploadLocked ? '#cbd5e1' : '#1a73e8', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: isUploading || isLocked || isUploadLocked ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      width: '100%',
                      fontSize: '14px',
                      boxShadow: '0 2px 4px rgba(26, 115, 232, 0.15)',
                      transition: 'background 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => !isUploading && !isLocked && !isUploadLocked && (e.currentTarget.style.background = '#1557b0')}
                    onMouseOut={(e) => !isUploading && !isLocked && !isUploadLocked && (e.currentTarget.style.background = '#1a73e8')}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Ingesting records...
                      </>
                    ) : 'Ingest Trial Balance'}
                  </button>


                  {activeLocks.length > 0 && (
                    <div style={{ marginTop: '16px', padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: 'bold', color: '#ef4444', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ShieldCheck size={16} /> Admin Concurrency Lock Controls
                      </h4>
                      <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 12px 0' }}>
                        Active server-side job locks prevent conflicting writes. As an administrator, you can force-release stuck locks.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {activeLocks.map(lock => (
                          <div key={lock.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                            <div style={{ flex: 1, marginRight: '8px' }}>
                              <strong style={{ fontFamily: 'monospace', display: 'block', wordBreak: 'break-all' }}>{lock.lockKey}</strong>
                              <span style={{ fontSize: '11px', color: '#64748b' }}>Owner: {lock.userName} | Duration: {lock.maxDurationSeconds}s</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleForceReleaseLock(lock.lockKey)}
                              disabled={isForceReleasing}
                              style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                            >
                              Force Release
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/* Right: Inline User Documentation */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={20} color="var(--blue)" /> Governed Ingestion Guide
                </h2>
                <p style={{ color: '#475569', fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
                  This cockpit manages general ledger data preparation, period locks, crosswalk mapping rules, and YoY comparisons for the New York Lottery.
                </p>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', borderLeft: '4px solid var(--blue)' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={14} color="var(--blue)" /> Period Locking Rules
                  </h3>
                  <p style={{ color: '#475569', fontSize: '12.5px', lineHeight: '1.5', margin: '4px 0 0 0' }}>
                    Locking is blocked unless the ledger is balanced to exactly $0.00. Once closed, the books become read-only and require administrator override to unlock.
                  </p>
                </div>
                <div style={{ background: '#f8fafc', padding: '14px 16px', borderRadius: '8px', borderLeft: '4px solid var(--green)' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} color="var(--green)" /> Audit Trail Verification
                  </h3>
                  <p style={{ color: '#475569', fontSize: '12.5px', lineHeight: '1.5', margin: '4px 0 0 0' }}>
                    Every ingest generates a unique SHA-256 signature and stores the raw source CSV for legislative compliance checks.
                  </p>
                </div>
                <button
                  onClick={() => setIsHelpOpen(true)}
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: 'var(--blue-dim)',
                    color: 'var(--blue)',
                    border: '1px solid var(--blue)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--blue)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--blue-dim)';
                    e.currentTarget.style.color = 'var(--blue)';
                  }}
                >
                  <BookOpen size={16} /> Open Interactive User Manual
                </button>
              </div>
            </div>

            {/* Bottom: Upload History Log */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px', marginTop: 0 }}>Upload History & Audit Log</h2>
              
              {batches.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                  No historical ingest logs found. Ingest a trial balance file to generate logs.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 'bold' }}>
                        <th style={{ padding: '12px' }}>File Name</th>
                        <th style={{ padding: '12px' }}>SHA-256 Signature</th>
                        <th style={{ padding: '12px' }}>Period Details</th>
                        <th style={{ padding: '12px' }}>Row Counts</th>
                        <th style={{ padding: '12px' }}>Uploaded By</th>
                        <th style={{ padding: '12px' }}>Upload Time</th>
                        <th style={{ padding: '12px' }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map(batch => (
                        <tr key={batch.id} style={{ borderBottom: '1px solid #f1f5f9', background: batch.status === 'rolled_back' ? '#fef2f2' : 'transparent' }}>
                          <td style={{ padding: '12px', fontWeight: '600', color: '#0f172a' }}>{batch.sourceFilename}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>
                            {batch.sourceFileHash.slice(0, 16)}...
                          </td>
                          <td style={{ padding: '12px', color: '#0f172a' }}>
                            {batch.fiscalYear ? `FY${batch.fiscalYear} ${batch.periodCode}` : 'N/A'}
                          </td>
                          <td style={{ padding: '12px', color: '#0f172a' }}>
                            {batch.rowCountSource} / {batch.rowCountImported}
                          </td>
                          <td style={{ padding: '12px', color: '#0f172a' }}>{batch.uploadedBy}</td>
                          <td style={{ padding: '12px', color: '#64748b' }}>
                            {new Date(batch.uploadedAt).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: 'bold',
                              background: batch.status === 'rolled_back' ? '#fee2e2' : '#dcfce7',
                              color: batch.status === 'rolled_back' ? '#991b1b' : '#166534',
                              border: batch.status === 'rolled_back' ? '1px solid #fca5a5' : '1px solid #bbf7d0'
                            }}>
                              {batch.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button 
                              onClick={() => handleInspectBatch(batch.id)}
                              style={{ padding: '4px 10px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                              Inspect Traces
                            </button>
                            {batch.status === 'complete' && (
                              <button 
                                onClick={() => handleRollback(batch.id)}
                                disabled={isLocked}
                                style={{ padding: '4px 10px', background: isLocked ? '#e2e8f0' : '#fde8e8', color: isLocked ? '#94a3b8' : '#9b1c1c', border: `1px solid ${isLocked ? '#cbd5e1' : '#f8b4b4'}`, borderRadius: '4px', cursor: isLocked ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                              >
                                Rollback
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Trace Inspection Drawer */}
            {selectedBatch && (
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Cell Import Traces: {selectedBatch.sourceFilename}</h3>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '4px 0 0 0' }}>SHA-256: <code>{selectedBatch.sourceFileHash}</code></p>
                  </div>
                  <button onClick={() => setSelectedBatch(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={18} />
                  </button>
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', color: '#475569', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1' }}>
                        <th style={{ padding: '8px' }}>Line</th>
                        <th style={{ padding: '8px' }}>Raw Value</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>Transformed Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {traces.map((trace, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px', color: '#64748b' }}>{trace.sourceRowNumber}</td>
                          <td style={{ padding: '8px', fontFamily: 'monospace', color: '#0f172a' }}>{trace.sourceRawValue}</td>
                          <td style={{ padding: '8px', textAlign: 'right', fontWeight: 'bold', color: '#1a73e8' }}>
                            ${parseFloat(trace.transformedValue).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PANEL B: ACTIVE LEDGER GRID */}
        {activeTab === 'ledger' && (
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Active Trial Balance Ledger</h2>
                <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                  Inline adjustments for period <strong>{periodCode}</strong>. Double-click any row to edit fields.
                </p>
              </div>
              
              <button 
                onClick={() => fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit)}
                style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
              >
                Refresh Ledger
              </button>
            </div>

            {/* Toolbar search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
              <form onSubmit={(e) => { e.preventDefault(); setLedgerSearch(searchText); setLedgerCurrentPage(1); }} style={{ display: 'flex', gap: '8px', flex: 1 }}>
                <input 
                  type="text" 
                  placeholder="Search accounts..." 
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', background: '#ffffff', color: '#0f172a' }}
                />
                <button type="submit" style={{ padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Search</button>
                {ledgerSearch && (
                  <button type="button" onClick={() => { setSearchText(''); setLedgerSearch(''); setLedgerCurrentPage(1); }} style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                )}
              </form>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#475569' }}>Show:</span>
                <select
                  value={ledgerLimit}
                  onChange={(e) => { setLedgerLimit(parseInt(e.target.value, 10)); setLedgerCurrentPage(1); }}
                  style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
                >
                  <option value={10}>10 records</option>
                  <option value={25}>25 records</option>
                  <option value={50}>50 records</option>
                  <option value={100}>100 records</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
              {isLedgerLoading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}>
                  <div style={{ fontWeight: 'bold', color: '#1a73e8', fontSize: '14px' }}>Loading Ledger Grid...</div>
                </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 'bold' }}>
                    <th onClick={() => handleSort('accountCode')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '180px' }}>Account Code {renderSortIcon('accountCode')}</th>
                    <th onClick={() => handleSort('accountName')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}>Account Name {renderSortIcon('accountName')}</th>
                    <th onClick={() => handleSort('balance')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '180px', textAlign: 'right' }}>Balance {renderSortIcon('balance')}</th>
                    <th onClick={() => handleSort('status')} style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '120px' }}>Status {renderSortIcon('status')}</th>
                    <th style={{ padding: '12px', textAlign: 'right', width: '150px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Add Entry Row */}
                  {!isLocked && (
                    <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="GL Account..." value={newCode} onChange={(e) => setNewCode(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="text" placeholder="Account Name..." value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input type="number" step="0.01" placeholder="0.00" value={newBalance} onChange={(e) => setNewBalance(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '13px', textAlign: 'right', fontFamily: 'monospace' }} />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>manual</span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right' }}>
                        <button onClick={handleAddRecord} disabled={isAddingEntry} style={{ padding: '6px 12px', background: '#107c41', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', width: '100%' }}>
                          {isAddingEntry ? 'Adding...' : '+ Add Entry'}
                        </button>
                      </td>
                    </tr>
                  )}

                  {ledgerRecords.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No trial balance records found for this period.</td>
                    </tr>
                  ) : (
                    ledgerRecords.map(record => {
                      const isEditing = editingRecordId === record.id;
                      return (
                        <tr key={record.id} style={{ borderBottom: '1px solid #e2e8f0', background: isEditing ? '#f8fafc' : 'transparent' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace' }}>
                            {isEditing ? (
                              <input type="text" value={editingCode} onChange={(e) => setEditingCode(e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                            ) : record.accountCode}
                          </td>
                          <td style={{ padding: '12px' }}>
                            {isEditing ? (
                              <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px' }} />
                            ) : record.accountName}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                            {isEditing ? (
                              <input type="number" step="0.01" value={editingBalance} onChange={(e) => setEditingBalance(e.target.value)} style={{ width: '100%', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', textAlign: 'right' }} />
                            ) : (
                              <span style={{ color: parseFloat(record.balance) < 0 ? '#b91c1c' : '#166534' }}>
                                ${parseFloat(record.balance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ padding: '2px 6px', background: record.status === 'imported' ? '#f1f5f9' : '#e0f2fe', color: record.status === 'imported' ? '#475569' : '#0369a1', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                              {record.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {isLocked ? (
                              <span style={{ color: '#94a3b8', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={12} /> Locked
                              </span>
                            ) : isEditing ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button onClick={() => handleSaveEdit(record.id)} style={{ padding: '4px 8px', background: '#107c41', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Save</button>
                                <button onClick={cancelEditing} style={{ padding: '4px 8px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Cancel</button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button onClick={() => startEditing(record)} style={{ padding: '4px 8px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Edit</button>
                                <button onClick={() => handleDeleteRecord(record.id)} style={{ padding: '4px 8px', background: '#fde8e8', border: '1px solid #f8b4b4', color: '#9b1c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Delete</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {ledgerTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748b' }}>Showing {ledgerRecords.length} of {ledgerTotalCount} records</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setLedgerCurrentPage(p => Math.max(p - 1, 1))} disabled={ledgerCurrentPage === 1} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', cursor: 'pointer' }}>Previous</button>
                  <span style={{ padding: '6px 12px', fontWeight: 'bold' }}>Page {ledgerCurrentPage} of {ledgerTotalPages}</span>
                  <button onClick={() => setLedgerCurrentPage(p => Math.min(p + 1, ledgerTotalPages))} disabled={ledgerCurrentPage === ledgerTotalPages} style={{ padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', cursor: 'pointer' }}>Next</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PANEL C: CROSSWALK MAPPINGS */}
        {activeTab === 'rules' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
              
              {/* Left: Create Rule Form */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', height: 'fit-content' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Create Mapping Rule</h3>
                
                <form onSubmit={handleCreateRule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#475569' }}>Account Pattern (Wildcards OK)</label>
                    <input type="text" placeholder="e.g. 40100-*-*-*" value={newRulePattern} onChange={(e) => setNewRulePattern(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} required />
                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', display: 'block' }}>Use `*` for segments that change per game.</span>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#475569' }}>Maps to Metric</label>
                    <select value={newRuleMetricId} onChange={(e) => setNewRuleMetricId(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}>
                      <option value="sys-001">Gross Sales (4-1000)</option>
                      <option value="sys-002">Prize Expense (5-2000)</option>
                      <option value="sys-003">Retailer Commissions (5-2100)</option>
                      <option value="sys-004">Vendor Gaming Fees (5-2200)</option>
                      <option value="sys-005">Benefactor Transfer (5-2300)</option>
                      <option value="sys-008">Salaries & Wages (6-4100)</option>
                      <option value="sys-009">G&A (6-4200)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#475569' }}>Signage Multiplier</label>
                    <select value={newRuleMultiplier} onChange={(e) => setNewRuleMultiplier(parseFloat(e.target.value))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }}>
                      <option value={1.0}>+1.0 (Keep signage - Revenue)</option>
                      <option value={-1.0}>-1.0 (Invert signage - Debits to positive Expenses)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#475569' }}>Validity Dates</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <input type="date" value={newRuleStart} onChange={(e) => setNewRuleStart(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} required />
                      <input type="date" placeholder="End (Optional)" value={newRuleEnd} onChange={(e) => setNewRuleEnd(e.target.value)} style={{ width: '100%', padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', fontSize: '12px', color: '#475569' }}>Description</label>
                    <textarea rows={2} value={newRuleDesc} onChange={(e) => setNewRuleDesc(e.target.value)} style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none' }} />
                  </div>

                  {ruleMessage && (
                    <div style={{ padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '12px' }}>
                      {ruleMessage}
                    </div>
                  )}

                  <button type="submit" style={{ padding: '10px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', width: '100%' }}>Create Mapping Rule</button>
                </form>
              </div>

              {/* Right: Rules Grid + Manual Inline Help */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 16px 0', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>Active Crosswalk Rules</h3>
                  
                  {isRulesLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>Loading rules...</div>
                  ) : rules.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No rules found.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 'bold' }}>
                            <th style={{ padding: '8px' }}>Pattern</th>
                            <th style={{ padding: '8px' }}>Metric</th>
                            <th style={{ padding: '8px' }}>Signage</th>
                            <th style={{ padding: '8px' }}>Effective Period</th>
                            <th style={{ padding: '8px' }}>Description</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rules.map(rule => (
                            <tr key={rule.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1a73e8' }}>{rule.accountPattern}</td>
                              <td style={{ padding: '8px' }}>{rule.metricId}</td>
                              <td style={{ padding: '8px', fontWeight: 'bold', color: parseFloat(rule.signageMultiplier) < 0 ? '#b91c1c' : '#166534' }}>
                                {parseFloat(rule.signageMultiplier) > 0 ? '+1.0' : '-1.0'}
                              </td>
                              <td style={{ padding: '8px', color: '#64748b' }}>
                                {new Date(rule.effectiveStartDate).toISOString().split('T')[0]} to {rule.effectiveEndDate ? new Date(rule.effectiveEndDate).toISOString().split('T')[0] : 'Open'}
                              </td>
                              <td style={{ padding: '8px', color: '#475569' }}>{rule.description || '-'}</td>
                              <td style={{ padding: '8px', textAlign: 'right' }}>
                                <button onClick={() => handleDeleteRule(rule.id)} style={{ padding: '3px 6px', background: '#fde8e8', border: '1px solid #f8b4b4', color: '#9b1c1c', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Mappings Documentation */}
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 10px 0' }}>COA Crosswalk Help & Documentation</h4>
                  <ul style={{ paddingLeft: '20px', color: '#475569', fontSize: '12px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li><strong>Wildcard Logic</strong>: Account patterns map CSV account codes. For example, `40100-*-*-*` automatically maps new instant-ticket scratcher games to sales.</li>
                    <li><strong>Temporal Routing</strong>: Mappings use validity dates. This ensures historical reports map accounts based on rules active *at that time*, even if departments reorganised later.</li>
                    <li><strong>Signage Normalizer</strong>: Debits in trial balances are positive, credits are negative. Normalizing by `-1.0` converts credits in expenses or commissions to positive values for dashboard reports.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PANEL D: YOY VARIANCE REPORT */}
        {activeTab === 'yoy' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* YoY comparison matrix */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <div style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Year-over-Year (YoY) Variance Matrix</h2>
                  <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                    Comparing period <strong>{periodCode}</strong> in <strong>FY {fiscalYear}</strong> against the prior year <strong>FY {fiscalYear - 1}</strong>.
                  </p>
                </div>
                <button 
                  onClick={fetchYoYComparison}
                  style={{ padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  Refresh YoY Metrics
                </button>
              </div>

              {isYoYLoading ? (
                <div style={{ padding: '48px', textAlign: 'center', color: '#64748b' }}>Loading YoY Comparison...</div>
              ) : yoyError ? (
                <div style={{ padding: '12px', background: '#fef2f2', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: '8px', fontSize: '13px' }}>{yoyError}</div>
              ) : yoyData.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No trial balance data found for the current or prior fiscal year period.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 'bold', background: '#f8fafc' }}>
                        <th style={{ padding: '12px' }}>System Metric Line</th>
                        <th style={{ padding: '12px' }}>GL Code Reference</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Current (FY {fiscalYear})</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Prior (FY {fiscalYear - 1})</th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>Variance</th>
                        <th style={{ padding: '12px', textAlign: 'right', width: '130px' }}>% Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoyData.map(row => {
                        const isNeg = row.variance < 0;
                        const isExpense = row.metricId.includes('sys-002') || row.metricId.includes('sys-003') || row.metricId.includes('sys-004') || row.metricId.includes('sys-007') || row.metricId.includes('sys-008') || row.metricId.includes('sys-009');
                        // Determine if variance is favorable/unfavorable based on revenue vs expense
                        const isFavorable = isExpense ? isNeg : !isNeg;
                        
                        return (
                          <tr key={row.metricId} style={{ borderBottom: '1px solid #f1f5f9', hover: { background: '#f8fafc' } }}>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a' }}>{row.metricName}</td>
                            <td style={{ padding: '12px', fontFamily: 'monospace', color: '#475569' }}>{row.glAccount || 'pattern matched'}</td>
                            <td style={{ padding: '12px', textAlign: 'right', fontWeight: '600' }}>${row.currentValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: '#475569' }}>${row.priorValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                            <td style={{ padding: '12px', textAlign: 'right', color: isNeg ? '#b91c1c' : '#166534', fontWeight: '600' }}>
                              {isNeg ? '-' : '+'}${Math.abs(row.variance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'right' }}>
                              {row.percentChange !== null ? (
                                <span style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  background: isFavorable ? '#dcfce7' : '#fee2e2',
                                  color: isFavorable ? '#166534' : '#991b1b',
                                  border: `1px solid ${isFavorable ? '#bbf7d0' : '#fca5a5'}`
                                }}>
                                  {isFavorable ? '▲' : '▼'} {Math.abs(row.percentChange).toFixed(2)}%
                                </span>
                              ) : (
                                <span style={{ color: '#64748b' }}>N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* YoY Help Guide */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 10px 0' }}>YoY Reporting Guide</h4>
              <p style={{ color: '#475569', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                Year-over-Year calculations analyze corresponding periods (e.g. June FY25 vs June FY24). 
                The indicator colors highlight **favorable variances**: positive variance is green for revenue lines (e.g., Gross Sales) and red for expense lines (e.g., Salaries & Wages, Prizes), helping managers instantly spot anomalous spend behaviors.
              </p>
            </div>
          </div>
        )}

        <HelpDrawer topicId="reporting_upload" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      </div>
    </div>
  );
}
