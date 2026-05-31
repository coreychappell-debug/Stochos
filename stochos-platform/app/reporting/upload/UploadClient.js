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
                    <td style={{ padding: '12px', textAlign: 'right' }}>
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

    </div>
  );
}
