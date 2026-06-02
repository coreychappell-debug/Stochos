'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadClient() {
  const router = useRouter();
  
  // Fields for upload form
  const [file, setFile] = useState(null);
  const [jurisdictionId, setJurisdictionId] = useState('52066ac6-27d4-4495-953b-8f8def2a7851'); // Default to NY Lottery seed ID
  const [periodDate, setPeriodDate] = useState('2024-06-30'); // Default to seed date
  const [pipelineId, setPipelineId] = useState('');
  
  // UI states
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Database data logs
  const [pipelines, setPipelines] = useState([]);
  const [batches, setBatches] = useState([]);

  // Audit inspection states
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [traces, setTraces] = useState([]);
  const [isLoadingTraces, setIsLoadingTraces] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Ledger states
  const [ledgerRecords, setLedgerRecords] = useState([]);
  const [ledgerTotalCount, setLedgerTotalCount] = useState(0);
  const [ledgerTotalPages, setLedgerTotalPages] = useState(0);
  const [ledgerCurrentPage, setLedgerCurrentPage] = useState(1);
  const [ledgerLimit, setLedgerLimit] = useState(50);
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSortBy, setLedgerSortBy] = useState('accountCode');
  const [ledgerSortOrder, setLedgerSortOrder] = useState('asc');
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');

  // Search input state
  const [searchText, setSearchText] = useState('');

  // Editing state
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingCode, setEditingCode] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingBalance, setEditingBalance] = useState('');

  // Adding new entry state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newBalance, setNewBalance] = useState('');
  const [isAddingEntry, setIsAddingEntry] = useState(false);

  const fetchLedger = async (page = ledgerCurrentPage, search = ledgerSearch, sortBy = ledgerSortBy, sortOrder = ledgerSortOrder, limit = ledgerLimit) => {
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
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ledger record? This will instantly modify actual reporting calculations.')) {
      return;
    }
    try {
      const res = await fetch(`/api/reporting/ledger?id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
        setMessage('Record deleted successfully. Reporting validation rules updated.');
      } else {
        alert(`Error: ${data.error || 'Failed to delete record'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!newCode || !newName || newBalance === '') {
      alert('Please fill out all fields for the new adjusting entry.');
      return;
    }
    setIsAddingEntry(true);
    try {
      const res = await fetch('/api/reporting/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
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
        setMessage('Manual adjusting entry created successfully. Reporting validation rules updated.');
        setLedgerCurrentPage(1);
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
      } else {
        alert(`Error: ${data.error || 'Failed to create adjusting entry'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsAddingEntry(false);
    }
  };

  const startEditing = (record) => {
    setEditingRecordId(record.id);
    setEditingCode(record.accountCode);
    setEditingName(record.accountName);
    setEditingBalance(String(record.balance));
  };

  const cancelEditing = () => {
    setEditingRecordId(null);
    setEditingCode('');
    setEditingName('');
    setEditingBalance('');
  };

  const handleSaveEdit = async (id) => {
    if (!editingCode || !editingName || editingBalance === '') {
      alert('Fields cannot be empty.');
      return;
    }
    try {
      const res = await fetch('/api/reporting/ledger', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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
        setMessage('Record updated successfully. Reporting validation rules updated.');
        fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
      } else {
        alert(`Error: ${data.error || 'Failed to update record'}`);
      }
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    }
  };

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

  const handleInspectBatch = async (batchId) => {
    setIsLoadingTraces(true);
    try {
      const res = await fetch(`/api/reporting/upload?batchId=${batchId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSelectedBatch(data.batch);
          setTraces(data.traces);
        } else {
          alert(`Error: ${data.error || 'Failed to fetch batch traces'}`);
        }
      } else {
        alert('Failed to fetch batch traces from server');
      }
    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
    } finally {
      setIsLoadingTraces(false);
    }
  };

  // Fetch pipelines and previous batches on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch pipelines
        const resPipelines = await fetch('/api/reporting/pipelines');
        if (resPipelines.ok) {
          const data = await resPipelines.json();
          if (data.success) {
            setPipelines(data.pipelines);
            if (data.pipelines.length > 0) {
              setPipelineId(data.pipelines[0].id); // default to first pipeline
            }
          }
        }

        // Fetch batches
        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const data = await resBatches.json();
          if (data.success) {
            setBatches(data.batches);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    }
    loadData();
  }, []);

  // Fetch ledger when parameters change
  useEffect(() => {
    fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
  }, [jurisdictionId, periodDate, ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !jurisdictionId || !periodDate) {
      setMessage('Please fill in all fields and select a file.');
      return;
    }

    setIsUploading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('jurisdictionId', jurisdictionId);
    formData.append('periodDate', periodDate);
    if (pipelineId) {
      formData.append('pipelineId', pipelineId);
    }

    try {
      const response = await fetch('/api/reporting/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`Success! Imported ${data.count} records.`);
        
        // Refresh batches
        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const d = await resBatches.json();
          if (d.success) setBatches(d.batches);
        }

        setFile(null);
        // Clear input file element manually
        e.target.reset();

        // Refresh ledger
        setLedgerCurrentPage(1);
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);

      } else {
        setMessage(`Error: ${data.error || 'Failed to upload'}`);
      }
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRollback = async (batchId) => {
    if (!window.confirm('Are you sure you want to rollback this import batch? All imported trial balance records and traces will be deleted.')) {
      return;
    }

    try {
      const res = await fetch('/api/reporting/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'rollback',
          batchId
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Batch rolled back successfully.');
        
        // Refresh batches
        const resBatches = await fetch('/api/reporting/upload');
        if (resBatches.ok) {
          const d = await resBatches.json();
          if (d.success) setBatches(d.batches);
        }

        // Refresh ledger
        setLedgerCurrentPage(1);
        fetchLedger(1, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit);
      } else {
        alert(`Error: ${data.error || 'Failed to rollback'}`);
      }
    } catch (err) {
      console.error('Error rolling back batch:', err);
      alert(`Error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto', color: '#1e293b', backgroundColor: '#f1f3f4', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '2rem', fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
          Upload Trial Balance
        </h1>
        <button 
          onClick={() => router.push('/reporting')}
          style={{ 
            padding: '8px 16px', 
            background: '#ffffff', 
            border: '1px solid #cbd5e1', 
            color: '#1e293b', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontWeight: '600',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
          onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
        >
          Back to Studio
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* LEFT: Upload Form */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Import Spreadsheet</h2>
          <p style={{ color: '#475569', marginBottom: '20px', fontSize: '13px', lineHeight: '1.5' }}>
            Upload your CSV Trial Balance. The file should contain columns matching your visual transformation pipeline fields.
          </p>

          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Jurisdiction ID</label>
              <input 
                type="text" 
                value={jurisdictionId}
                onChange={(e) => setJurisdictionId(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Period Date (Month Ending)</label>
              <input 
                type="date" 
                value={periodDate}
                onChange={(e) => setPeriodDate(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Transformation Pipeline</label>
              <select 
                value={pipelineId}
                onChange={(e) => setPipelineId(e.target.value)}
                style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}
              >
                <option value="">-- Apply No Pipeline (Direct Ingest) --</option>
                {pipelines.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '13px', color: '#475569' }}>Trial Balance File (CSV)</label>
              <div style={{ border: '2px dashed #cbd5e1', padding: '20px', textAlign: 'center', borderRadius: '6px', background: '#f8fafc' }}>
                <input 
                  type="file" 
                  accept=".csv"
                  onChange={handleFileChange}
                  style={{ display: 'block', margin: '0 auto', color: '#475569', fontSize: '13px' }}
                  required
                />
              </div>
            </div>

            {message && (
              <div style={{ padding: '12px', background: message.includes('Error') ? '#fef2f2' : '#eaf5ea', color: message.includes('Error') ? '#dc2626' : '#107c41', borderRadius: '6px', border: message.includes('Error') ? '1px solid #fee2e2' : '1px solid #c3e6cb', fontSize: '13px', fontWeight: '500' }}>
                {message}
              </div>
            )}

            <div style={{ marginTop: '8px' }}>
              <button 
                type="submit" 
                disabled={isUploading}
                style={{ 
                  padding: '12px', 
                  background: isUploading ? '#cbd5e1' : '#1a73e8', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '6px', 
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  width: '100%',
                  fontSize: '14px',
                  boxShadow: '0 2px 4px rgba(26, 115, 232, 0.15)',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => !isUploading && (e.currentTarget.style.background = '#1557b0')}
                onMouseOut={(e) => !isUploading && (e.currentTarget.style.background = '#1a73e8')}
              >
                {isUploading ? 'Importing Data...' : 'Upload Trial Balance'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT: Quick Reference */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Governed Ingestion Architecture</h2>
          <p style={{ color: '#475569', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
            Every raw financial upload passes through an automated transformation pipeline before updating the reporting mart.
          </p>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#1a73e8', borderLeft: '3px solid #1a73e8', borderTop: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
            [Raw CSV File] ➔ [SHA-256 Hashing] ➔ [Transformation Pipeline] ➔ [Audited Database Insertion]
          </div>
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <h3 style={{ fontSize: '14px', color: '#0f172a', marginBottom: '8px', fontWeight: 'bold' }}>Why Governance?</h3>
            <ul style={{ color: '#475569', fontSize: '13px', margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Immutable Traces:</strong> Tracks cell origin row-by-row.</li>
              <li><strong>Rollback Action:</strong> Reverses transactional updates cleanly.</li>
              <li><strong>Signage Normalization:</strong> Enforces standard accounting presentations.</li>
            </ul>
          </div>
        </div>

      </div>

      {/* BOTTOM: Import History (Audit Logs) */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', marginBottom: '16px' }}>Upload History & Audit Log</h2>
        
        {batches.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
            No uploads found. Upload a trial balance to create an audit history.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold' }}>
                  <th style={{ padding: '12px' }}>File Name</th>
                  <th style={{ padding: '12px' }}>SHA-256 Signature</th>
                  <th style={{ padding: '12px' }}>Row Counts (Src/Imp)</th>
                  <th style={{ padding: '12px' }}>Uploaded By</th>
                  <th style={{ padding: '12px' }}>Upload Time</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id} style={{ borderBottom: '1px solid #e2e8f0', background: batch.isRolledBack ? '#fef2f2' : 'transparent' }}>
                    <td style={{ padding: '12px', fontWeight: '500', color: '#0f172a' }}>{batch.sourceFilename}</td>
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>
                      {batch.sourceFileHash.slice(0, 16)}...
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
                        background: batch.status === 'rolled_back' ? '#fde8e8' : '#eaf5ea',
                        color: batch.status === 'rolled_back' ? '#9b1c1c' : '#0e6c38',
                        border: batch.status === 'rolled_back' ? '1px solid #f8b4b4' : '1px solid #c3e6cb'
                      }}>
                        {batch.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleInspectBatch(batch.id)}
                        disabled={isLoadingTraces}
                        style={{ 
                          padding: '4px 10px', 
                          background: '#e0f2fe', 
                          color: '#0369a1', 
                          border: '1px solid #bae6fd', 
                          borderRadius: '4px', 
                          cursor: isLoadingTraces ? 'not-allowed' : 'pointer', 
                          fontSize: '12px', 
                          fontWeight: 'bold',
                          transition: 'background 0.2s'
                        }}
                        onMouseOver={(e) => !isLoadingTraces && (e.currentTarget.style.background = '#bae6fd')}
                        onMouseOut={(e) => !isLoadingTraces && (e.currentTarget.style.background = '#e0f2fe')}
                      >
                        Inspect Traces
                      </button>
                      {batch.status === 'complete' && (
                        <button 
                          onClick={() => handleRollback(batch.id)}
                          style={{ 
                            padding: '4px 10px', 
                            background: '#fde8e8', 
                            color: '#9b1c1c', 
                            border: '1px solid #f8b4b4', 
                            borderRadius: '4px', 
                            cursor: 'pointer', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            transition: 'background 0.2s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#fbd5d5'}
                          onMouseOut={(e) => e.currentTarget.style.background = '#fde8e8'}
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

      {/* ACTIVE LEDGER VIEWER & MANUAL ADJUSTMENTS GRID */}
      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
              Active Ledger Viewer & Manual Adjustments Grid
            </h2>
            <p style={{ color: '#475569', fontSize: '12px', marginTop: '4px', margin: 0 }}>
              Direct access to current trial balance ledger actuals and manual adjustments for jurisdiction <code>{jurisdictionId}</code>, period <code>{periodDate}</code>. Double-click any row to edit it.
            </p>
          </div>
          <button 
            onClick={() => fetchLedger(ledgerCurrentPage, ledgerSearch, ledgerSortBy, ledgerSortOrder, ledgerLimit)}
            style={{ 
              padding: '6px 12px', 
              background: '#f1f5f9', 
              border: '1px solid #cbd5e1', 
              color: '#475569', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: '600',
              fontSize: '12px',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
          >
            Refresh Ledger
          </button>
        </div>

        {/* TOOLBAR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Search form */}
          <form onSubmit={(e) => { e.preventDefault(); setLedgerSearch(searchText); setLedgerCurrentPage(1); }} style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '280px' }}>
            <input 
              type="text" 
              placeholder="Search by account code or account name..." 
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', background: '#ffffff', color: '#0f172a' }}
            />
            <button 
              type="submit"
              style={{ 
                padding: '8px 16px', 
                background: '#1a73e8', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 'bold',
                fontSize: '13px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1557b0'}
              onMouseOut={(e) => e.currentTarget.style.background = '#1a73e8'}
            >
              Search
            </button>
            {ledgerSearch && (
              <button 
                type="button"
                onClick={() => { setSearchText(''); setLedgerSearch(''); setLedgerCurrentPage(1); }}
                style={{ 
                  padding: '8px 12px', 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1', 
                  color: '#475569', 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  fontSize: '13px'
                }}
              >
                Clear
              </button>
            )}
          </form>

          {/* Page Limit Selector */}
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
              <option value={200}>200 records</option>
            </select>
          </div>
        </div>

        {/* LEDGER DATA TABLE */}
        {ledgerError && (
          <div style={{ padding: '12px', background: '#fef2f2', color: '#dc2626', borderRadius: '6px', border: '1px solid #fee2e2', fontSize: '13px', fontWeight: '500' }}>
            {ledgerError}
          </div>
        )}

        <div style={{ maxHeight: '600px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px', position: 'relative' }}>
          {isLedgerLoading && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
              <div style={{ fontWeight: 'bold', color: '#1a73e8', fontSize: '14px' }}>Loading Ledger...</div>
            </div>
          )}
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', color: '#475569', fontWeight: 'bold', position: 'sticky', top: 0, zIndex: 10 }}>
                <th 
                  onClick={() => handleSort('accountCode')} 
                  style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '180px' }}
                >
                  Account Code {renderSortIcon('accountCode')}
                </th>
                <th 
                  onClick={() => handleSort('accountName')} 
                  style={{ padding: '12px', cursor: 'pointer', userSelect: 'none' }}
                >
                  Account Name {renderSortIcon('accountName')}
                </th>
                <th 
                  onClick={() => handleSort('balance')} 
                  style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '180px', textAlign: 'right' }}
                >
                  Balance {renderSortIcon('balance')}
                </th>
                <th 
                  onClick={() => handleSort('status')} 
                  style={{ padding: '12px', cursor: 'pointer', userSelect: 'none', width: '120px' }}
                >
                  Status {renderSortIcon('status')}
                </th>
                <th style={{ padding: '12px', textAlign: 'right', width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Manual Insertion Row */}
              <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="New Account Code..."
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      background: '#ffffff',
                      color: '#0f172a'
                    }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="text"
                    placeholder="New Account Name..."
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '13px',
                      background: '#ffffff',
                      color: '#0f172a'
                    }}
                  />
                </td>
                <td style={{ padding: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '13px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      background: '#ffffff',
                      color: '#0f172a'
                    }}
                  />
                </td>
                <td style={{ padding: '8px', color: '#64748b', fontSize: '11px', fontWeight: 'bold' }}>
                  <span style={{ padding: '2px 6px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', border: '1px solid #bae6fd' }}>manual</span>
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  <button
                    onClick={handleAddRecord}
                    disabled={isAddingEntry}
                    style={{
                      padding: '6px 12px',
                      background: '#107c41',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isAddingEntry ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      width: '100%',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => !isAddingEntry && (e.currentTarget.style.background = '#0e6c38')}
                    onMouseOut={(e) => !isAddingEntry && (e.currentTarget.style.background = '#107c41')}
                  >
                    {isAddingEntry ? 'Adding...' : '+ Add Entry'}
                  </button>
                </td>
              </tr>

              {ledgerRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                    No ledger entries found for this period. Upload a trial balance to import data or add a manual adjusting entry above.
                  </td>
                </tr>
              ) : (
                ledgerRecords.map(record => {
                  const isEditing = editingRecordId === record.id;
                  return (
                    <tr 
                      key={record.id} 
                      onDoubleClick={() => !isEditing && startEditing(record)}
                      style={{ 
                        borderBottom: '1px solid #e2e8f0', 
                        background: isEditing ? '#f8fafc' : 'transparent',
                        cursor: isEditing ? 'default' : 'pointer',
                        transition: 'background 0.15s'
                      }}
                      onMouseOver={(e) => { if (!isEditing) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseOut={(e) => { if (!isEditing) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {/* ACCOUNT CODE */}
                      <td style={{ padding: '12px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingCode}
                            onChange={(e) => setEditingCode(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #1a73e8',
                              borderRadius: '4px',
                              fontSize: '13px',
                              fontFamily: 'monospace',
                              background: '#ffffff',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        ) : (
                          <span style={{ fontFamily: 'monospace', color: '#1e293b', fontWeight: '500' }}>
                            {record.accountCode}
                          </span>
                        )}
                      </td>

                      {/* ACCOUNT NAME */}
                      <td style={{ padding: '12px' }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #1a73e8',
                              borderRadius: '4px',
                              fontSize: '13px',
                              background: '#ffffff',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        ) : (
                          <span style={{ color: '#0f172a' }}>{record.accountName}</span>
                        )}
                      </td>

                      {/* BALANCE */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingBalance}
                            onChange={(e) => setEditingBalance(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              border: '1px solid #1a73e8',
                              borderRadius: '4px',
                              fontSize: '13px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              background: '#ffffff',
                              color: '#0f172a',
                              outline: 'none'
                            }}
                          />
                        ) : (
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontWeight: '600', 
                            color: parseFloat(record.balance) < 0 ? '#b91c1c' : '#15803d' 
                          }}>
                            {parseFloat(record.balance) < 0 
                              ? `(${Math.abs(parseFloat(record.balance)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` 
                              : parseFloat(record.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>

                      {/* STATUS */}
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '3px 6px', 
                          borderRadius: '4px', 
                          fontSize: '10px', 
                          fontWeight: 'bold',
                          background: record.status === 'mapped' ? '#f0fdf4' : '#f1f5f9',
                          color: record.status === 'mapped' ? '#166534' : '#475569',
                          border: record.status === 'mapped' ? '1px solid #bbf7d0' : '1px solid #cbd5e1'
                        }}>
                          {record.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleSaveEdit(record.id)}
                              style={{
                                padding: '4px 8px',
                                background: '#107c41',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEditing}
                              style={{
                                padding: '4px 8px',
                                background: '#64748b',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => startEditing(record)}
                              style={{
                                padding: '3px 6px',
                                background: '#e0f2fe',
                                color: '#0369a1',
                                border: '1px solid #bae6fd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                transition: 'background 0.15s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(record.id)}
                              style={{
                                padding: '3px 6px',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                transition: 'background 0.15s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#fecaca'}
                              onMouseOut={(e) => e.currentTarget.style.background = '#fee2e2'}
                            >
                              Delete
                            </button>
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

        {/* PAGINATION CONTROLS */}
        {ledgerTotalPages > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              Showing <strong>{((ledgerCurrentPage - 1) * ledgerLimit) + 1}</strong> to <strong>{Math.min(ledgerCurrentPage * ledgerLimit, ledgerTotalCount)}</strong> of <strong>{ledgerTotalCount}</strong> entries
            </span>

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <button 
                onClick={() => setLedgerCurrentPage(1)}
                disabled={ledgerCurrentPage === 1 || isLedgerLoading}
                style={{
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: ledgerCurrentPage === 1 ? '#cbd5e1' : '#475569',
                  borderRadius: '4px',
                  cursor: ledgerCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                &lt;&lt;
              </button>
              <button 
                onClick={() => setLedgerCurrentPage(p => Math.max(p - 1, 1))}
                disabled={ledgerCurrentPage === 1 || isLedgerLoading}
                style={{
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: ledgerCurrentPage === 1 ? '#cbd5e1' : '#475569',
                  borderRadius: '4px',
                  cursor: ledgerCurrentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                &lt; Prev
              </button>

              <span style={{ fontSize: '13px', color: '#475569', margin: '0 8px' }}>
                Page <strong>{ledgerCurrentPage}</strong> of <strong>{ledgerTotalPages}</strong>
              </span>

              <button 
                onClick={() => setLedgerCurrentPage(p => Math.min(p + 1, ledgerTotalPages))}
                disabled={ledgerCurrentPage === ledgerTotalPages || isLedgerLoading}
                style={{
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: ledgerCurrentPage === ledgerTotalPages ? '#cbd5e1' : '#475569',
                  borderRadius: '4px',
                  cursor: ledgerCurrentPage === ledgerTotalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                Next &gt;
              </button>
              <button 
                onClick={() => setLedgerCurrentPage(ledgerTotalPages)}
                disabled={ledgerCurrentPage === ledgerTotalPages || isLedgerLoading}
                style={{
                  padding: '6px 10px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: ledgerCurrentPage === ledgerTotalPages ? '#cbd5e1' : '#475569',
                  borderRadius: '4px',
                  cursor: ledgerCurrentPage === ledgerTotalPages ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TRACE INSPECTOR PANEL */}
      {selectedBatch && (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                Audit Inspector: {selectedBatch.sourceFilename}
              </h2>
              <p style={{ color: '#475569', fontSize: '12px', marginTop: '4px', margin: 0 }}>
                Showing row-by-row mapping traces for import batch <code>{selectedBatch.id.slice(0, 8)}</code>.
              </p>
            </div>
            <button 
              onClick={() => { setSelectedBatch(null); setTraces([]); }}
              style={{ 
                padding: '6px 12px', 
                background: '#f1f5f9', 
                border: '1px solid #cbd5e1', 
                color: '#475569', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '600',
                fontSize: '12px'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#e2e8f0'}
              onMouseOut={(e) => e.currentTarget.style.background = '#f1f5f9'}
            >
              Close Inspector
            </button>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <input 
              type="text" 
              placeholder="Search by account code, name or value..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', background: '#ffffff', color: '#0f172a' }}
            />
          </div>

          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: 'bold', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px' }}>Row #</th>
                  <th style={{ padding: '10px' }}>Account Code</th>
                  <th style={{ padding: '10px' }}>Account Name</th>
                  <th style={{ padding: '10px' }}>Audit Source Data</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Transformed Balance</th>
                </tr>
              </thead>
              <tbody>
                {traces
                  .filter(trace => {
                    let parsedRaw = {};
                    try { parsedRaw = JSON.parse(trace.sourceRawValue); } catch(e) {}
                    
                    const acctCode = String(parsedRaw['Account Code'] || parsedRaw.accountCode || parsedRaw.account_code || parsedRaw.Account || parsedRaw.account || '').toLowerCase();
                    const acctName = String(parsedRaw['Account Name'] || parsedRaw.accountName || parsedRaw.account_name || parsedRaw.Name || parsedRaw.name || '').toLowerCase();
                    const query = searchQuery.toLowerCase();
                    
                    return acctCode.includes(query) || acctName.includes(query) || String(trace.transformedValue).includes(query);
                  })
                  .map(trace => {
                    let parsedRaw = {};
                    try { parsedRaw = JSON.parse(trace.sourceRawValue); } catch(e) {}
                    
                    const acctCode = String(parsedRaw['Account Code'] || parsedRaw.accountCode || parsedRaw.account_code || parsedRaw.Account || parsedRaw.account || '');
                    const acctName = String(parsedRaw['Account Name'] || parsedRaw.accountName || parsedRaw.account_name || parsedRaw.Name || parsedRaw.name || 'Unlabeled Account');
                    
                    // Filter out keys already shown in columns to prevent duplication
                    const metaEntries = Object.entries(parsedRaw).filter(([key]) => {
                      const kLower = key.toLowerCase();
                      return !kLower.includes('code') && !kLower.includes('name') && kLower !== 'account';
                    });
                    
                    return (
                      <tr key={trace.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px', color: '#64748b', fontWeight: 'bold' }}>{trace.sourceRowNumber}</td>
                        <td style={{ padding: '10px', fontFamily: 'monospace', color: '#1a73e8', fontWeight: 'bold' }}>
                          {acctCode}
                        </td>
                        <td style={{ padding: '10px', color: '#334155' }}>
                          {acctName}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {metaEntries.map(([key, val]) => (
                              <span key={key} style={{ background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid #e2e8f0' }}>
                                <strong>{key}:</strong> {String(val)}
                              </span>
                            ))}
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid #bae6fd', fontFamily: 'monospace' }}>
                              Trace ID: {trace.cellId.slice(-8)}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold', color: parseFloat(trace.transformedValue) < 0 ? '#9b1c1c' : '#0e6c38' }}>
                          {parseFloat(trace.transformedValue) < 0 ? `(${Math.abs(parseFloat(trace.transformedValue)).toLocaleString()})` : parseFloat(trace.transformedValue).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
