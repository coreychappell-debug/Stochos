'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EvidencePanel from '@/app/components/evidence/EvidencePanel';

export default function WorkflowClient() {
  const router = useRouter();

  // State lists
  const [packages, setPackages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals visibility
  const [isPkgModalOpen, setIsPkgModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  
  // Create Package Form
  const [newPkgName, setNewPkgName] = useState('FY24 Annual Comprehensive Financial Report (ACFR)');
  const [newPkgFreq, setNewPkgFreq] = useState('annual');
  const [newPkgDate, setNewPkgDate] = useState('2024-06-30');

  // Edit Role Modal Form
  const [selectedSection, setSelectedSection] = useState(null);
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editReviewerId, setEditReviewerId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Fetch initial packages & users
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const pkgsRes = await fetch('/api/reporting/packages');
        const pkgsData = await pkgsRes.json();
        
        const usersRes = await fetch('/api/reporting/users');
        const usersData = await usersRes.json();

        if (pkgsData.success) {
          setPackages(pkgsData.packages);
          if (pkgsData.packages.length > 0) {
            setSelectedPkg(pkgsData.packages[0]);
          }
        }
        if (usersData.success) {
          setUsers(usersData.users);
        }
      } catch (err) {
        console.error('Failed to load workflow data:', err);
        setErrorMessage('Failed to connect to workflow services.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const getStatusLabel = (status) => {
    switch (status) {
      case 'approved': return { bg: 'var(--status-passed-bg)', text: 'var(--status-passed-text)', border: 'var(--status-passed-border)', label: 'Approved' };
      case 'in_review': return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)', label: 'In Review' };
      case 'draft': return { bg: 'var(--status-draft-bg)', text: 'var(--status-draft-text)', border: 'var(--status-draft-border)', label: 'Drafting' };
      case 'not_started': return { bg: 'var(--surface-1)', text: 'var(--text-secondary)', border: 'var(--border)', label: 'Not Started' };
      case 'published': return { bg: 'var(--status-purple-bg)', text: 'var(--status-purple-text)', border: 'var(--status-purple-border)', label: 'Published & Locked' };
      default: return { bg: 'var(--surface-1)', text: 'var(--text-secondary)', border: 'var(--border)', label: status || 'Unknown' };
    }
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    
    // Choose one of the seeded admin users to create the package
    const creator = users.find(u => u.email === 'admin@stochos.io') || users[0];
    if (!creator) {
      setErrorMessage('No admin user found to initialize package.');
      return;
    }

    try {
      const res = await fetch('/api/reporting/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPkgName,
          frequency: newPkgFreq,
          periodDateStr: newPkgDate,
          createdById: creator.id
        })
      });

      const data = await res.json();
      if (data.success) {
        setPackages([data.package, ...packages]);
        setSelectedPkg(data.package);
        setIsPkgModalOpen(false);
        setSuccessMessage('Report package created successfully with default sections.');
      } else {
        setErrorMessage(data.error || 'Failed to create report package.');
      }
    } catch (err) {
      setErrorMessage('Network error during package creation.');
    }
  };

  const handleUpdateSectionStatus = async (sectionId, newStatus) => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/reporting/sections/${sectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (data.success) {
        // Refresh local package state
        const updatedSections = selectedPkg.sections.map(s => s.id === sectionId ? { ...s, status: newStatus } : s);
        const updatedPkg = { ...selectedPkg, sections: updatedSections };
        
        setSelectedPkg(updatedPkg);
        setPackages(packages.map(p => p.id === updatedPkg.id ? updatedPkg : p));
        setSuccessMessage('Section status updated successfully.');
      } else {
        setErrorMessage(data.error || 'Failed to update section status.');
      }
    } catch (err) {
      setErrorMessage('Network error during section update.');
    }
  };

  const openRoleModal = (section) => {
    setSelectedSection(section);
    setEditAssigneeId(section.assigneeId || '');
    setEditReviewerId(section.reviewerId || '');
    setEditDueDate(section.dueDate ? new Date(section.dueDate).toISOString().split('T')[0] : '');
    setIsRoleModalOpen(true);
  };

  const handleSaveRoles = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/reporting/sections/${selectedSection.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assigneeId: editAssigneeId || null,
          reviewerId: editReviewerId || null,
          dueDate: editDueDate || null
        })
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        const updatedSections = selectedPkg.sections.map(s => {
          if (s.id === selectedSection.id) {
            return {
              ...s,
              assigneeId: editAssigneeId || null,
              reviewerId: editReviewerId || null,
              assignee: users.find(u => u.id === editAssigneeId) || null,
              reviewer: users.find(u => u.id === editReviewerId) || null,
              dueDate: editDueDate || null
            };
          }
          return s;
        });

        const updatedPkg = { ...selectedPkg, sections: updatedSections };
        setSelectedPkg(updatedPkg);
        setPackages(packages.map(p => p.id === updatedPkg.id ? updatedPkg : p));
        setIsRoleModalOpen(false);
        setSuccessMessage('Section permissions and deadlines updated.');
      } else {
        setErrorMessage(data.error || 'Failed to save section parameters.');
      }
    } catch (err) {
      setErrorMessage('Network error during section save.');
    }
  };

  const handleCompilePackage = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await fetch(`/api/reporting/packages/${selectedPkg.id}/compile`, {
        method: 'POST'
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Package compilation succeeded! Canonical HTML artifact generated, SHA-256 verified, and litigation hold activated.');
        // Refresh package details
        const updatedPkg = { ...selectedPkg, status: 'published' };
        setSelectedPkg(updatedPkg);
        setPackages(packages.map(p => p.id === updatedPkg.id ? updatedPkg : p));
      } else {
        setErrorMessage(data.error || 'Compilation failed due to compliance block.');
      }
    } catch (err) {
      setErrorMessage('Compilation engine connection error.');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', color: 'var(--text)', background: 'var(--surface-1)', display: 'flex', flexDirection: 'column', gap: '2.5rem', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>Governed Workflow & Binders</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>Orchestrate role-based publishing cycles for financial statements.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => router.push('/reporting')} 
            style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: 'var(--shadow-card)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div style={{ padding: '16px', background: 'var(--status-failed-bg)', border: '1px solid var(--status-failed-border)', borderRadius: '8px', color: 'var(--status-failed-text)', fontWeight: '600', fontSize: '14px' }}>
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '16px', background: 'var(--status-passed-bg)', border: '1px solid var(--status-passed-border)', borderRadius: '8px', color: 'var(--status-passed-text)', fontWeight: '600', fontSize: '14px' }}>
          ✅ {successMessage}
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>Loading workflow binders...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '24px', flex: 1 }}>
          
          {/* LEFT COLUMN: PACKAGE LIST */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Packages</h2>
              <button 
                onClick={() => setIsPkgModalOpen(true)}
                style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
              >
                + New
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {packages.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No packages defined. Click "+ New" to seed one.</div>
              ) : (
                packages.map(pkg => (
                  <div 
                    key={pkg.id} 
                    onClick={() => setSelectedPkg(pkg)}
                    style={{ 
                      background: selectedPkg?.id === pkg.id ? 'var(--status-passed-bg)' : 'var(--card-bg)', 
                      border: selectedPkg?.id === pkg.id ? '1px solid var(--status-passed-text)' : '1px solid var(--border)', 
                      padding: '16px', borderRadius: '8px', cursor: 'pointer', transition: 'all var(--transition)' 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', background: 'var(--surface-1)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>{pkg.frequency}</span>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: getStatusLabel(pkg.status).text }}>
                        {getStatusLabel(pkg.status).label}
                      </span>
                    </div>
                    <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', marginBottom: '4px' }}>{pkg.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Period End: {new Date(pkg.periodDate).toLocaleDateString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PACKAGE DETAILS & SECTIONS */}
          {selectedPkg ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Package Summary */}
              <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: 'var(--shadow-card)' }}>
                <div>
                  <h2 style={{ fontSize: '20px', color: 'var(--text)', margin: '0 0 8px 0', fontWeight: '700' }}>{selectedPkg.name}</h2>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Assembling {selectedPkg.sections?.length || 0} modular sections for close date {new Date(selectedPkg.periodDate).toLocaleDateString()}.
                  </div>
                </div>
                {selectedPkg.status !== 'published' ? (
                  <button 
                    onClick={handleCompilePackage}
                    style={{ 
                      padding: '12px 20px', 
                      background: 'var(--green)', 
                      color: '#ffffff', 
                      border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '14px', 
                      cursor: 'pointer', transition: 'all var(--transition)',
                      boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--green-dim)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'var(--green)'}
                  >
                    Compile Final Document 📄
                  </button>
                ) : (
                  <div style={{ padding: '8px 16px', background: 'var(--status-purple-bg)', border: '1px solid var(--status-purple-border)', color: 'var(--status-purple-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>
                    🔒 Document Compiled & Locked
                  </div>
                )}
              </div>

              {/* Sections Grid */}
              <div style={{ background: 'var(--card-bg)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                <h3 style={{ fontSize: '16px', color: 'var(--text)', fontWeight: 'bold', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📑</span> Section Assignments & Status
                </h3>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Section Name</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Assignee (Author)</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Reviewer (Controller)</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Due Date</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Workflow Status</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPkg.sections?.map(sec => {
                      const statusUI = getStatusLabel(sec.status);
                      const assigneeName = users.find(u => u.id === sec.assigneeId)?.name || 'Unassigned';
                      const reviewerName = users.find(u => u.id === sec.reviewerId)?.name || 'Unassigned';
                      return (
                        <tr key={sec.id} style={{ borderBottom: '1px solid var(--border-dim)', verticalAlign: 'middle' }}>
                          <td style={{ padding: '16px 12px', fontWeight: '600', color: 'var(--text)' }}>{sec.name}</td>
                          <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>👤 {assigneeName}</td>
                          <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>👤 {reviewerName}</td>
                          <td style={{ padding: '16px 12px', color: 'var(--text-secondary)' }}>{sec.dueDate ? new Date(sec.dueDate).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '16px 12px' }}>
                            <span style={{ background: statusUI.bg, color: statusUI.text, border: `1px solid ${statusUI.border || 'transparent'}`, padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                              {statusUI.label}
                            </span>
                          </td>
                          <td style={{ padding: '16px 12px', textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center', minHeight: '52px' }}>
                            <button 
                              onClick={() => openRoleModal(sec)}
                              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                            >
                              Manage
                            </button>
                            {selectedPkg.status !== 'published' && (
                              <>
                                {sec.status === 'draft' && (
                                  <button onClick={() => handleUpdateSectionStatus(sec.id, 'in_review')} style={{ background: 'var(--blue)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                    Submit
                                  </button>
                                )}
                                {sec.status === 'in_review' && (
                                  <button onClick={() => handleUpdateSectionStatus(sec.id, 'approved')} style={{ background: 'var(--green)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                    Approve
                                  </button>
                                )}
                                {sec.status === 'approved' && (
                                  <button disabled style={{ background: 'var(--surface-1)', border: 'none', color: 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px', cursor: 'not-allowed', fontSize: '11px' }}>
                                    Locked 🔒
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Supporting Evidence Panel */}
              <EvidencePanel packageId={selectedPkg.id} currentUser={users[0]} />

            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '4rem', border: '1px dashed var(--border)', borderRadius: '12px', background: 'var(--card-bg)' }}>
              Select a report package from the list or create a new one.
            </div>
          )}

        </div>
      )}

      {/* CREATE PACKAGE MODAL */}
      {isPkgModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '500px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-elevated)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>Create Report Package</h2>
            <form onSubmit={handleCreatePackage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Package Name</label>
                <input 
                  type="text" 
                  value={newPkgName} 
                  onChange={e => setNewPkgName(e.target.value)} 
                  required
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Frequency</label>
                  <select 
                    value={newPkgFreq} 
                    onChange={e => setNewPkgFreq(e.target.value)}
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                  >
                    <option value="annual">Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Period Close Date</label>
                  <input 
                    type="date" 
                    value={newPkgDate} 
                    onChange={e => setNewPkgDate(e.target.value)}
                    required
                    style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsPkgModalOpen(false)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--green)', border: 'none', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Create Package</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE SECTION ROLES MODAL */}
      {isRoleModalOpen && selectedSection && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', width: '450px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-elevated)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>Manage Section Parameters</h2>
            <div style={{ color: 'var(--green)', fontSize: '13px', fontWeight: '600' }}>{selectedSection.name}</div>
            
            <form onSubmit={handleSaveRoles} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Assignee (Author)</label>
                <select 
                  value={editAssigneeId} 
                  onChange={e => setEditAssigneeId(e.target.value)}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Reviewer (Controller/Supervisor)</label>
                <select 
                  value={editReviewerId} 
                  onChange={e => setEditReviewerId(e.target.value)}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role?.name})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Due Date</label>
                <input 
                  type="date" 
                  value={editDueDate} 
                  onChange={e => setEditDueDate(e.target.value)}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', color: 'var(--text)', fontSize: '14px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsRoleModalOpen(false)} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Cancel</button>
                <button type="submit" style={{ background: 'var(--green)', border: 'none', color: '#ffffff', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
