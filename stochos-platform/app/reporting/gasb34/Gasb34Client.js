'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileText, TrendingUp, Coins, Download, RefreshCw, AlertTriangle, CheckCircle2, Home, Settings, Plus, Trash2, ArrowUp, ArrowDown, BookOpen, X } from 'lucide-react';
import HelpTooltip from '../../components/HelpTooltip';
import HelpTrigger from '../../components/HelpTrigger';

export default function Gasb34Client() {
  const router = useRouter();
  const [fiscalYear, setFiscalYear] = useState('2025');
  const [periodCode, setPeriodCode] = useState('P03');
  const [rounding, setRounding] = useState('exact'); // exact, thousands, millions
  const [activeTab, setActiveTab] = useState('netPosition'); // netPosition, revenuesExpenses, cashFlows
  const [startMonth, setStartMonth] = useState(7); // Default to July (7)
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Layout Manager Drawer states
  const [isLayoutOpen, setIsLayoutOpen] = useState(false);
  const [layoutStatement, setLayoutStatement] = useState('netPosition');
  const [layoutRows, setLayoutRows] = useState([]);
  const [savingLayout, setSavingLayout] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reporting/gasb34?fiscalYear=${fiscalYear}&periodCode=${periodCode}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        if (json.fiscalYearStartMonth) {
          setStartMonth(json.fiscalYearStartMonth);
        }
      } else {
        setError(json.error || 'Failed to fetch statement data.');
      }
    } catch (err) {
      console.error(err);
      setError('A connection error occurred while generating reports.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLayoutRows = async () => {
    try {
      const res = await fetch('/api/reporting/gasb34/rows?jurisdictionId=NY-LOTTERY');
      const json = await res.json();
      if (json.success) {
        setLayoutRows(json.rows);
      }
    } catch (err) {
      console.error("Failed to fetch layout rows", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fiscalYear, periodCode]);

  useEffect(() => {
    if (isLayoutOpen) {
      fetchLayoutRows();
    }
  }, [isLayoutOpen]);

  // Rounding factor helper
  const getRoundingFactor = () => {
    if (rounding === 'thousands') return 1000;
    if (rounding === 'millions') return 1000000;
    return 1;
  };

  const factor = getRoundingFactor();

  const getMonthName = (monthIndex) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex % 12];
  };

  const dynamicPeriodOptions = useMemo(() => {
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

  // Professional accounting currency formatting helper
  const formatVal = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '-';
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

  // Helper for formatting variance percent
  const formatPct = (pct) => {
    if (pct === undefined || pct === null || isNaN(pct)) return '-';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}%`;
  };

  // Layout Manager Handlers
  const handleAddLayoutRow = () => {
    const filtered = layoutRows.filter(r => r.statement === layoutStatement);
    const maxSort = filtered.reduce((max, r) => r.sortOrder > max ? r.sortOrder : max, 0);
    const newRow = {
      id: `temp-${Date.now()}`,
      jurisdictionId: 'NY-LOTTERY',
      statement: layoutStatement,
      section: layoutStatement === 'netPosition' ? 'currentAssets' : (layoutStatement === 'revenuesExpenses' ? 'operatingRevenues' : 'cashOperating'),
      label: 'New Line Item',
      accountPattern: '',
      rowType: 'data',
      signageMultiplier: 1.0,
      sortOrder: maxSort + 10
    };
    setLayoutRows([...layoutRows, newRow]);
  };

  const handleEditLayoutRow = (id, field, value) => {
    setLayoutRows(layoutRows.map(r => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    }));
  };

  const handleDeleteLayoutRow = (id) => {
    setLayoutRows(layoutRows.filter(r => r.id !== id));
  };

  const handleMoveLayoutRow = (id, direction) => {
    const filtered = layoutRows.filter(r => r.statement === layoutStatement);
    const index = filtered.findIndex(r => r.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === filtered.length - 1) return;
    
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const item1 = { ...filtered[index] };
    const item2 = { ...filtered[targetIndex] };
    
    // Swap sortOrder
    const tempSort = item1.sortOrder;
    item1.sortOrder = item2.sortOrder;
    item2.sortOrder = tempSort;
    
    setLayoutRows(layoutRows.map(r => {
      if (r.id === item1.id) return item1;
      if (r.id === item2.id) return item2;
      return r;
    }));
  };

  const handleSaveLayout = async () => {
    setSavingLayout(true);
    try {
      const res = await fetch('/api/reporting/gasb34/rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId: 'NY-LOTTERY',
          rows: layoutRows
        })
      });
      const json = await res.json();
      if (json.success) {
        setIsLayoutOpen(false);
        fetchData();
        alert('Report layout updated successfully!');
      } else {
        alert('Failed to save layout: ' + json.error);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the layout.');
    } finally {
      setSavingLayout(false);
    }
  };

  // Render comparative data row
  const renderRow = (label, currentVal, priorVal, isSubtotal = false, isTotal = false) => {
    const diff = (currentVal || 0) - (priorVal || 0);
    const pct = priorVal && priorVal !== 0 ? (diff / Math.abs(priorVal)) * 100 : null;

    const rowStyle = {
      borderBottom: isTotal ? '2px double #475569' : '1px solid #e2e8f0',
      fontWeight: (isSubtotal || isTotal) ? 'bold' : 'normal',
      backgroundColor: isSubtotal ? '#f8fafc' : isTotal ? '#f1f5f9' : 'transparent',
    };

    const cellStyle = {
      padding: '10px 16px',
      fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px',
      color: '#1e293b',
    };

    return (
      <tr style={rowStyle}>
        <td style={{ ...cellStyle, textAlign: 'left', paddingLeft: isSubtotal || isTotal ? '16px' : '32px' }}>
          {label}
        </td>
        <td style={{ ...cellStyle, textAlign: 'right', fontWeight: isTotal ? 'bold' : 'normal' }}>
          {formatVal(currentVal)}
        </td>
        <td style={{ ...cellStyle, textAlign: 'right' }}>
          {formatVal(priorVal)}
        </td>
        <td style={{ ...cellStyle, textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48' }}>
          {formatVal(diff)}
        </td>
        <td style={{ ...cellStyle, textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48', fontWeight: '500' }}>
          {formatPct(pct)}
        </td>
      </tr>
    );
  };

  // Render Statement of Net Position rows dynamically
  const renderNetPositionRows = (rows) => {
    let currentGroup = '';
    const elements = [];
    
    rows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'currentAssets') {
          elements.push(<tr key="h-assets" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>ASSETS</td></tr>);
          elements.push(<tr key="h-current-assets" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '6px 16px 6px 24px', fontWeight: 'bold', fontSize: '12px', color: '#64748b', textAlign: 'left' }}>Current Assets</td></tr>);
        } else if (currentGroup === 'nonCurrentAssets') {
          elements.push(<tr key="h-non-current" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px 6px 24px', fontWeight: 'bold', fontSize: '12px', color: '#64748b', textAlign: 'left' }}>Non-Current Assets</td></tr>);
        } else if (currentGroup === 'liabilities') {
          elements.push(<tr key="h-liabilities" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>LIABILITIES</td></tr>);
          elements.push(<tr key="h-current-liab" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '6px 16px 6px 24px', fontWeight: 'bold', fontSize: '12px', color: '#64748b', textAlign: 'left' }}>Current Liabilities</td></tr>);
        } else if (currentGroup === 'netPosition') {
          elements.push(<tr key="h-net-pos" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>NET POSITION</td></tr>);
        }
      }
      
      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      
      elements.push(
        <tr key={row.id} style={{
          borderBottom: isTotal ? '2px double #475569' : '1px solid #e2e8f0',
          fontWeight: (isSubtotal || isTotal) ? 'bold' : 'normal',
          backgroundColor: isSubtotal ? '#f8fafc' : isTotal ? '#f1f5f9' : 'transparent',
        }}>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'left', paddingLeft: isSubtotal || isTotal ? '16px' : '32px' }}>
            {row.label}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right', fontWeight: isTotal ? 'bold' : 'normal' }}>
            {formatVal(row.current)}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right' }}>
            {formatVal(row.prior)}
          </td>
          {(() => {
            const diff = (row.current || 0) - (row.prior || 0);
            const pct = row.prior && row.prior !== 0 ? (diff / Math.abs(row.prior)) * 100 : null;
            return (
              <>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48' }}>
                  {formatVal(diff)}
                </td>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48', fontWeight: '500' }}>
                  {formatPct(pct)}
                </td>
              </>
            );
          })()}
        </tr>
      );
    });
    return elements;
  };

  // Render Statement of Revenues, Expenses, & Changes rows dynamically
  const renderRevenuesExpensesRows = (rows) => {
    let currentGroup = '';
    const elements = [];
    
    rows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'operatingRevenues') {
          elements.push(<tr key="h-op-rev" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>OPERATING REVENUES</td></tr>);
        } else if (currentGroup === 'operatingExpenses') {
          elements.push(<tr key="h-op-exp" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>OPERATING EXPENSES</td></tr>);
        } else if (currentGroup === 'nonOperating') {
          elements.push(<tr key="h-non-op" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>NON-OPERATING ITEMS & TRANSFERS</td></tr>);
        }
      }
      
      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      
      elements.push(
        <tr key={row.id} style={{
          borderBottom: isTotal ? '2px double #475569' : '1px solid #e2e8f0',
          fontWeight: (isSubtotal || isTotal) ? 'bold' : 'normal',
          backgroundColor: isSubtotal ? '#f8fafc' : isTotal ? '#f1f5f9' : 'transparent',
        }}>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'left', paddingLeft: isSubtotal || isTotal ? '16px' : '32px' }}>
            {row.label}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right', fontWeight: isTotal ? 'bold' : 'normal' }}>
            {formatVal(row.current)}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right' }}>
            {formatVal(row.prior)}
          </td>
          {(() => {
            const diff = (row.current || 0) - (row.prior || 0);
            const pct = row.prior && row.prior !== 0 ? (diff / Math.abs(row.prior)) * 100 : null;
            return (
              <>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48' }}>
                  {formatVal(diff)}
                </td>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48', fontWeight: '500' }}>
                  {formatPct(pct)}
                </td>
              </>
            );
          })()}
        </tr>
      );
    });
    return elements;
  };

  // Render Statement of Cash Flows rows dynamically
  const renderCashFlowRows = (rows) => {
    let currentGroup = '';
    const elements = [];
    
    rows.forEach((row) => {
      if (row.section !== currentGroup) {
        currentGroup = row.section;
        if (currentGroup === 'cashOperating') {
          elements.push(<tr key="h-cf-op" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>CASH FLOWS FROM OPERATING ACTIVITIES</td></tr>);
        } else if (currentGroup === 'cashFinancing') {
          elements.push(<tr key="h-cf-fin" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>CASH FLOWS FROM NONCAPITAL FINANCING ACTIVITIES</td></tr>);
        } else if (currentGroup === 'cashCapital') {
          elements.push(<tr key="h-cf-cap" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>CASH FLOWS FROM CAPITAL AND RELATED FINANCING ACTIVITIES</td></tr>);
        } else if (currentGroup === 'cashInvesting') {
          elements.push(<tr key="h-cf-inv" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>CASH FLOWS FROM INVESTING ACTIVITIES</td></tr>);
        } else if (currentGroup === 'cashRollForward') {
          elements.push(<tr key="h-cf-roll" style={{ background: '#f8fafc' }}><td colSpan="5" style={{ padding: '10px 16px', fontWeight: 'bold', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', textAlign: 'left' }}>CASH ROLL FORWARD</td></tr>);
        }
      }
      
      const isSubtotal = row.rowType === 'subtotal';
      const isTotal = row.rowType === 'total';
      
      elements.push(
        <tr key={row.id} style={{
          borderBottom: isTotal ? '2px double #475569' : '1px solid #e2e8f0',
          fontWeight: (isSubtotal || isTotal) ? 'bold' : 'normal',
          backgroundColor: isSubtotal ? '#f8fafc' : isTotal ? '#f1f5f9' : 'transparent',
        }}>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'left', paddingLeft: isSubtotal || isTotal ? '16px' : '32px' }}>
            {row.label}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right', fontWeight: isTotal ? 'bold' : 'normal' }}>
            {formatVal(row.current)}
          </td>
          <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', color: '#1e293b', textAlign: 'right' }}>
            {formatVal(row.prior)}
          </td>
          {(() => {
            const diff = (row.current || 0) - (row.prior || 0);
            const pct = row.prior && row.prior !== 0 ? (diff / Math.abs(row.prior)) * 100 : null;
            return (
              <>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48' }}>
                  {formatVal(diff)}
                </td>
                <td style={{ padding: '10px 16px', fontSize: (isSubtotal || isTotal) ? '14px' : '13.5px', textAlign: 'right', color: diff >= 0 ? '#0d9488' : '#e11d48', fontWeight: '500' }}>
                  {formatPct(pct)}
                </td>
              </>
            );
          })()}
        </tr>
      );
    });
    return elements;
  };

  // Trigger Real PDF Compilation & Download
  const handleExport = () => {
    const url = `/api/reporting/gasb34/export-pdf?jurisdictionId=NY-LOTTERY&fiscalYear=${fiscalYear}&periodCode=${periodCode}&rounding=${rounding}`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ backgroundColor: '#f1f3f4', minHeight: '100vh', width: '100%', padding: '2rem', color: '#1e293b', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => router.push('/reporting')}
              style={{ 
                marginRight: '16px',
                padding: '8px', 
                background: '#ffffff', 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
                GASB 34 Statement Compiler
              </h1>
              <p style={{ color: '#475569', fontSize: '13px', marginTop: '2px', margin: 0 }}>
                Proprietary Enterprise Fund (Lottery) Governmental Financial Statements.
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <HelpTrigger topicId="reporting_gasb34" />
            <button 
              onClick={() => router.push('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px', 
                background: '#ffffff', 
                color: '#1e293b', 
                border: '1px solid #cbd5e1', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '600',
                fontSize: '13.5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Home size={14} />
              Back to Dashboard
            </button>

            <button
              onClick={fetchData}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13.5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Re-Calculate
            </button>

            <button
              onClick={() => setIsLayoutOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                background: '#ffffff',
                color: '#7e22ce',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '13.5px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Settings size={14} />
              Edit Report Layout
            </button>

            <button 
              onClick={handleExport}
              disabled={loading || error}
              style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px', 
                background: '#1a73e8', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: (loading || error) ? 'not-allowed' : 'pointer', 
                fontWeight: '600',
                fontSize: '13.5px',
                opacity: (loading || error) ? 0.6 : 1,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <Download size={14} />
              Export Package
            </button>
          </div>
        </div>

        {/* CONTROLS PANELS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '1.5rem' }}>
          {/* FISCAL YEAR SELECTION */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              Fiscal Year
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            >
              <option value="2026">2026 (Future)</option>
              <option value="2025">2025 (Current)</option>
              <option value="2024">2024 (Prior)</option>
              <option value="2023">2023 (Historic)</option>
              <option value="2020">2020 (Historic)</option>
              <option value="2019">2019 (Historic)</option>
            </select>
          </div>

          {/* PERIOD SELECTION */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              Filing Period
            </label>
            <select
              value={periodCode}
              onChange={(e) => setPeriodCode(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
            >
              {dynamicPeriodOptions.map(p => (
                <option key={p.code} value={p.code}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* ROUNDING UNITS */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
              Rounding & Units
            </label>
            <div style={{ display: 'flex', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden' }}>
              {['exact', 'thousands', 'millions'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setRounding(mode)}
                  style={{
                    flex: 1,
                    padding: '8px 4px',
                    border: 'none',
                    background: rounding === mode ? '#f1f5f9' : '#ffffff',
                    color: rounding === mode ? '#1e293b' : '#64748b',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    borderRight: mode !== 'millions' ? '1px solid #cbd5e1' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  {mode === 'exact' ? '$1.00' : mode === 'thousands' ? '$K' : '$M'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* DOUBLE-ENTRY STATUS BANNER */}
        {data && (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '12px 16px', 
            borderRadius: '8px', 
            marginBottom: '1.5rem', 
            border: '1px solid',
            backgroundColor: data.isBalanced ? '#f0fdf4' : '#fef2f2',
            borderColor: data.isBalanced ? '#bbf7d0' : '#fecaca',
            color: data.isBalanced ? '#166534' : '#991b1b',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}>
            {data.isBalanced ? (
              <>
                <CheckCircle2 size={18} style={{ color: '#15803d' }} />
                <span>
                  <strong>Double-Entry Verified:</strong> General Ledger is balanced to the penny (Discrepancy: ${data.discrepancy.toFixed(2)}). GASB 34 financial statements compiled successfully.
                </span>
              </>
            ) : (
              <>
                <AlertTriangle size={18} style={{ color: '#b91c1c' }} />
                <span>
                  <strong>Double-Entry Warning:</strong> General Ledger is out of balance by ${data.discrepancy.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Statement compilation locked until imbalance is resolved in Data Prep Studio or Ledger adjusting entries.
                </span>
              </>
            )}
          </div>
        )}

        {/* MAIN COMPILER CONTENT */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <RefreshCw size={36} className="animate-spin" style={{ color: '#1a73e8', marginBottom: '12px' }} />
            <span style={{ color: '#475569', fontWeight: '500' }}>Compiling financial statements...</span>
          </div>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', background: '#fff', borderRadius: '8px', border: '1px solid #cbd5e1', padding: '24px', textAlign: 'center' }}>
            <AlertTriangle size={48} style={{ color: '#e11d48', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px 0' }}>Report Compilation Failed</h3>
            <p style={{ color: '#475569', margin: '0 0 16px 0', maxWidth: '400px' }}>{error}</p>
            <button
              onClick={fetchData}
              style={{ padding: '8px 16px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        ) : (
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            
            {/* TABS SELECTOR */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <button
                onClick={() => setActiveTab('netPosition')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'netPosition' ? '3px solid #00b4d8' : '3px solid transparent',
                  background: 'none',
                  color: activeTab === 'netPosition' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '14.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <FileText size={16} />
                Statement of Net Position
              </button>
              <button
                onClick={() => setActiveTab('revenuesExpenses')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'revenuesExpenses' ? '3px solid #00b4d8' : '3px solid transparent',
                  background: 'none',
                  color: activeTab === 'revenuesExpenses' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '14.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <TrendingUp size={16} />
                Revenues, Expenses & Changes
              </button>
              <button
                onClick={() => setActiveTab('cashFlows')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  border: 'none',
                  borderBottom: activeTab === 'cashFlows' ? '3px solid #00b4d8' : '3px solid transparent',
                  background: 'none',
                  color: activeTab === 'cashFlows' ? '#0f172a' : '#64748b',
                  fontWeight: '700',
                  fontSize: '14.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <Coins size={16} />
                Statement of Cash Flows
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div style={{ padding: '24px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #cbd5e1', background: '#f8fafc' }}>
                    <th style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'left' }}>
                      Line Item / Classification
                    </th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', width: '150px' }}>
                      FY {data.fiscalYear} ({periodCode})
                    </th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', width: '150px' }}>
                      FY {data.fiscalYear - 1} ({periodCode})
                    </th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', width: '150px' }}>
                      Variance ($)
                    </th>
                    <th style={{ padding: '12px 16px', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', textAlign: 'right', width: '120px' }}>
                      Change (%)
                    </th>
                  </tr>
                </thead>
                <tbody>

                  {/* TAB 1: STATEMENT OF NET POSITION */}
                  {activeTab === 'netPosition' && renderNetPositionRows(data.netPositionRows || [])}

                  {/* TAB 2: STATEMENT OF REVENUES, EXPENSES, & CHANGES */}
                  {activeTab === 'revenuesExpenses' && renderRevenuesExpensesRows(data.revenuesExpensesRows || [])}

                  {/* TAB 3: STATEMENT OF CASH FLOWS */}
                  {activeTab === 'cashFlows' && (() => {
                    const cf = data.cashFlows;
                    return (
                      <>
                        {renderCashFlowRows(data.cashFlowRows || [])}

                        {/* INDIRECT RECONCILIATION */}
                        <tr style={{ background: '#f1f5f9' }}>
                          <td colSpan="5" style={{ padding: '14px 16px', fontWeight: 'bold', fontSize: '13.5px', color: '#334155', textTransform: 'uppercase', textAlign: 'left' }}>
                            RECONCILIATION OF OPERATING INCOME TO NET CASH PROVIDED BY OPERATING ACTIVITIES
                            <HelpTooltip text="GASB Statement 34 requires reconciling operating income to the net cash flows produced by operations, highlighting non-cash expenses and timing differences." />
                          </td>
                        </tr>
                        {renderRow('Operating Income (Loss)', cf.reconciliation.operatingIncome.current, cf.reconciliation.operatingIncome.prior, true)}
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan="5" style={{ padding: '6px 16px 6px 24px', fontWeight: 'bold', fontSize: '12px', color: '#64748b', textAlign: 'left' }}>
                            Adjustments to Reconcile Operating Income to Net Cash:
                          </td>
                        </tr>
                        
                        {/* Depreciation Expense line with manual Tooltip placement */}
                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '10px 16px 10px 32px', fontSize: '13.5px', color: '#1e293b', textAlign: 'left' }}>
                            Depreciation expense
                            <HelpTooltip text="Depreciation is a non-cash expense representing capital asset wear-and-tear, added back to operating income to reconcile cash flows." />
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '13.5px', color: '#1e293b', textAlign: 'right' }}>
                            {formatVal(cf.reconciliation.depreciation.current)}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '13.5px', color: '#1e293b', textAlign: 'right' }}>
                            {formatVal(cf.reconciliation.depreciation.prior)}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '13.5px', textAlign: 'right', color: (cf.reconciliation.depreciation.current - cf.reconciliation.depreciation.prior) >= 0 ? '#0d9488' : '#e11d48' }}>
                            {formatVal(cf.reconciliation.depreciation.current - cf.reconciliation.depreciation.prior)}
                          </td>
                          <td style={{ padding: '10px 16px', fontSize: '13.5px', textAlign: 'right', color: (cf.reconciliation.depreciation.current - cf.reconciliation.depreciation.prior) >= 0 ? '#0d9488' : '#e11d48', fontWeight: '500' }}>
                            {formatPct(cf.reconciliation.depreciation.prior ? ((cf.reconciliation.depreciation.current - cf.reconciliation.depreciation.prior) / cf.reconciliation.depreciation.prior * 100) : null)}
                          </td>
                        </tr>

                        {renderRow('Decrease (increase) in Accounts Receivable, net', cf.reconciliation.arChange.current, cf.reconciliation.arChange.prior)}
                        {renderRow('Decrease (increase) in Prepaid Expenses', cf.reconciliation.prepaidsChange.current, cf.reconciliation.prepaidsChange.prior)}
                        {renderRow('Increase (decrease) in Accounts Payable', cf.reconciliation.apChange.current, cf.reconciliation.apChange.prior)}
                        {renderRow('Increase (decrease) in Prizes Payable', cf.reconciliation.prizesChange.current, cf.reconciliation.prizesChange.prior)}
                        {renderRow('Increase (decrease) in Unearned Revenue', cf.reconciliation.unearnedChange.current, cf.reconciliation.unearnedChange.prior)}
                        {renderRow('Net Cash Provided by Operating Activities', cf.reconciliation.netCashOperating.current, cf.reconciliation.netCashOperating.prior, false, true)}
                      </>
                    );
                  })()}

                </tbody>
              </table>

              {/* Dynamic Rounding Footnote */}
              <div style={{ 
                marginTop: '16px', 
                fontSize: '12.5px', 
                color: '#64748b', 
                fontStyle: 'italic', 
                borderTop: '1px solid #cbd5e1', 
                paddingTop: '12px',
                textAlign: 'left'
              }}>
                * Note: Amounts are presented in {rounding === 'exact' ? 'exact dollars' : rounding === 'thousands' ? 'thousands of dollars' : 'millions of dollars'}.
              </div>
            </div>

          </div>
        )}

      </div>

      {/* LAYOUT MANAGER DRAWER */}
      {isLayoutOpen && (
        <>
          {/* Backdrop */}
          <div 
            onClick={() => setIsLayoutOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(4px)',
              zIndex: 9998,
            }}
          />
          
          {/* Drawer */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              width: '580px',
              height: '100vh',
              backgroundColor: '#ffffff',
              boxShadow: '-4px 0 24px rgba(15, 23, 42, 0.15)',
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: '"Inter", sans-serif',
              color: '#1e293b'
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Report Layout Manager
                  <HelpTooltip text="Customize statement rows, rename labels, update GL account mappings, change signage, and reorder items dynamically." />
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Configure row items dynamically in the database.</p>
              </div>
              <button 
                onClick={() => setIsLayoutOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Statement Switcher Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>
              {[
                { id: 'netPosition', label: 'Net Position' },
                { id: 'revenuesExpenses', label: 'Revenues & Exp' },
                { id: 'cashFlows', label: 'Cash Flows' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setLayoutStatement(tab.id)}
                  style={{
                    flex: 1,
                    padding: '12px 8px',
                    border: 'none',
                    background: layoutStatement === tab.id ? '#ffffff' : 'transparent',
                    color: layoutStatement === tab.id ? '#1a73e8' : '#64748b',
                    fontWeight: '700',
                    fontSize: '13px',
                    borderBottom: layoutStatement === tab.id ? '3px solid #1a73e8' : '3px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* List of Rows */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#f8fafc' }}>
              {layoutRows.filter(r => r.statement === layoutStatement).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No rows defined for this statement. Click 'Add Row' below.</div>
              ) : (
                layoutRows
                  .filter(r => r.statement === layoutStatement)
                  .map((row, idx, arr) => (
                    <div 
                      key={row.id} 
                      style={{ 
                        background: '#ffffff', 
                        border: '1px solid #cbd5e1', 
                        borderRadius: '8px', 
                        padding: '16px', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}
                    >
                      {/* Row Label & Drag/Order buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={row.label}
                          onChange={(e) => handleEditLayoutRow(row.id, 'label', e.target.value)}
                          style={{
                            flex: 1,
                            fontWeight: 'bold',
                            fontSize: '14px',
                            border: '1px solid transparent',
                            borderBottom: '1px solid #cbd5e1',
                            padding: '4px 0',
                            outline: 'none',
                            color: '#0f172a'
                          }}
                          onFocus={(e) => e.target.style.borderBottomColor = '#1a73e8'}
                          onBlur={(e) => e.target.style.borderBottomColor = '#cbd5e1'}
                        />
                        <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
                          <button 
                            onClick={() => handleMoveLayoutRow(row.id, 'up')}
                            disabled={idx === 0}
                            style={{ padding: '4px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button 
                            onClick={() => handleMoveLayoutRow(row.id, 'down')}
                            disabled={idx === arr.length - 1}
                            style={{ padding: '4px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === arr.length - 1 ? 0.4 : 1 }}
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteLayoutRow(row.id)}
                            style={{ padding: '4px', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', color: '#b91c1c' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* GL Mapping and Group section */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            GL Account Mapping
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 1-1000, 1-12*"
                            value={row.accountPattern}
                            onChange={(e) => handleEditLayoutRow(row.id, 'accountPattern', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', outline: 'none' }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            Section Group
                          </label>
                          <select
                            value={row.section}
                            onChange={(e) => handleEditLayoutRow(row.id, 'section', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', outline: 'none', background: '#fff' }}
                          >
                            {layoutStatement === 'netPosition' && (
                              <>
                                <option value="currentAssets">Current Assets</option>
                                <option value="nonCurrentAssets">Non-Current Assets</option>
                                <option value="liabilities">Liabilities</option>
                                <option value="netPosition">Net Position</option>
                              </>
                            )}
                            {layoutStatement === 'revenuesExpenses' && (
                              <>
                                <option value="operatingRevenues">Operating Revenues</option>
                                <option value="operatingExpenses">Operating Expenses</option>
                                <option value="nonOperating">Non-Operating Items</option>
                              </>
                            )}
                            {layoutStatement === 'cashFlows' && (
                              <>
                                <option value="cashOperating">Operating Cash Flows</option>
                                <option value="cashFinancing">Noncapital Financing</option>
                                <option value="cashCapital">Capital Related</option>
                                <option value="cashInvesting">Investing Cash Flows</option>
                                <option value="cashRollForward">Cash Roll Forward</option>
                              </>
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Row Type & Multiplier */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'block', marginBottom: '4px' }}>
                            Row Type
                          </label>
                          <select
                            value={row.rowType}
                            onChange={(e) => handleEditLayoutRow(row.id, 'rowType', e.target.value)}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', outline: 'none', background: '#fff' }}
                          >
                            <option value="data">Standard Data Line</option>
                            <option value="subtotal">Subtotal Section Line</option>
                            <option value="total">Double Underline Total Line</option>
                          </select>
                        </div>
                        
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                            Signage Multiplier
                            <HelpTooltip text="Trial balance credits are negative. Set to -1.0 to invert credit liabilities/revenues to positive numbers for presentation." />
                          </label>
                          <select
                            value={String(row.signageMultiplier)}
                            onChange={(e) => handleEditLayoutRow(row.id, 'signageMultiplier', parseFloat(e.target.value))}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12.5px', outline: 'none', background: '#fff' }}
                          >
                            <option value="1">1.0 (Direct / Debit)</option>
                            <option value="-1">-1.0 (Invert Credit)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
            
            {/* Footer controls */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid #cbd5e1', display: 'flex', gap: '12px', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
              <button
                onClick={handleAddLayoutRow}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: '#f1f5f9',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13px'
                }}
              >
                <Plus size={14} />
                Add Row
              </button>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setIsLayoutOpen(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#ffffff',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '13px'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveLayout}
                  disabled={savingLayout}
                  style={{
                    padding: '8px 16px',
                    background: '#1a73e8',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '13px',
                    opacity: savingLayout ? 0.7 : 1
                  }}
                >
                  {savingLayout ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
