'use client';

import { useState, useEffect } from 'react';

export default function EvidencePanel({ packageId, sectionId, importBatchId, currentUser }) {
  const [evidenceList, setEvidenceList] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [file, setFile] = useState(null);
  
  // Simulated Role Gating Session
  const [simulatedRole, setSimulatedRole] = useState(currentUser?.role || 'analyst'); // default to analyst (read-only)

  useEffect(() => {
    fetchEvidence();
  }, [packageId, sectionId, importBatchId]);

  const fetchEvidence = async () => {
    try {
      let query = '';
      if (packageId) query += `packageId=${packageId}`;
      if (sectionId) query += `&sectionId=${sectionId}`;
      if (importBatchId) query += `&importBatchId=${importBatchId}`;
      
      const res = await fetch(`/api/reporting/evidence?${query}`);
      const data = await res.json();
      if (data.success) {
        setEvidenceList(data.evidence);
      }
    } catch (err) {
      console.error('Error loading evidence:', err);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (packageId) formData.append('packageId', packageId);
    if (sectionId) formData.append('sectionId', sectionId);
    if (importBatchId) formData.append('importBatchId', importBatchId);
    formData.append('isConfidential', isConfidential ? 'true' : 'false');
    formData.append('uploadedBy', currentUser?.id || 'simulated-user');

    try {
      const res = await fetch('/api/reporting/evidence', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setFile(null);
        setIsConfidential(false);
        // Clear input element
        document.getElementById('evidence-file-input').value = '';
        fetchEvidence();
      } else {
        alert(data.error || 'Failed to upload evidence');
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (ev) => {
    if (ev.isConfidential) {
      // Role enforcement check: Only District Supervisor or Admin allowed
      if (simulatedRole !== 'admin' && simulatedRole !== 'supervisor') {
        alert('Access Blocked: You do not possess the required security clearances to view confidential audits.');
        return;
      }
    }
    // Allow download
    window.open(ev.storagePath, '_blank');
  };

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', color: 'var(--text)', fontFamily: 'var(--font-sans)', boxShadow: 'var(--shadow-card)' }}>
      
      {/* Session/Role Switcher for testing */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, fontSize: '14px', color: 'var(--text)', fontWeight: 'bold' }}>📎 Supporting Evidence</h4>
        
        {/* Test Simulator Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Test Role:</span>
          <select 
            value={simulatedRole} 
            onChange={e => setSimulatedRole(e.target.value)}
            style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '4px', padding: '3px 8px', fontSize: '12px', outline: 'none' }}
          >
            <option value="analyst">Analyst (Auditor)</option>
            <option value="supervisor">District Supervisor</option>
            <option value="admin">Platform Admin</option>
          </select>
        </div>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px', background: 'var(--surface-1)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <input 
            id="evidence-file-input"
            type="file" 
            onChange={e => setFile(e.target.files[0])} 
            required
            style={{ fontSize: '13px', color: 'var(--text-secondary)' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-secondary)', fontWeight: '600' }}>
            <input 
              type="checkbox" 
              checked={isConfidential} 
              onChange={e => setIsConfidential(e.target.checked)} 
            />
            Confidential (Gated)
          </label>
        </div>
        <button 
          type="submit" 
          disabled={isUploading || !file}
          style={{ 
            padding: '8px 16px', 
            background: isUploading || !file ? 'var(--surface-1)' : 'var(--green)', 
            color: isUploading || !file ? 'var(--text-muted)' : '#ffffff',
            border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: isUploading || !file ? 'not-allowed' : 'pointer',
            transition: 'all var(--transition)'
          }}
        >
          {isUploading ? 'Uploading file...' : 'Attach Supporting Document'}
        </button>
      </form>

      {/* Evidence list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {evidenceList.length === 0 ? (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px' }}>No documents attached.</div>
        ) : (
          evidenceList.map(ev => (
            <div 
              key={ev.id} 
              style={{ 
                background: 'var(--surface-1)', 
                border: '1px solid var(--border)', 
                padding: '12px', borderRadius: '6px', 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                  <span>📄 {ev.fileName}</span>
                  {ev.isConfidential && (
                    <span style={{ fontSize: '11px', color: 'var(--status-warning-text)', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)', padding: '1px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                      🔒 Confidential
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Hash: {ev.fileHash.slice(0, 16)}... | Size: {(ev.fileSizeBytes / 1024).toFixed(1)} KB
                </div>
              </div>
              <button 
                onClick={() => handleDownload(ev)}
                style={{ 
                  padding: '6px 12px', 
                  background: 'var(--surface-2)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '4px', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', transition: 'all var(--transition)', fontWeight: '600'
                }}
              >
                {ev.isConfidential ? 'Decrypt & View' : 'Download'}
              </button>
            </div>
          ))
        )}
      </div>

    </div>
  );
}
