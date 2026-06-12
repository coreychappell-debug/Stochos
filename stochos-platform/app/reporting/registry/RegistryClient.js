'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, AlertTriangle, CheckCircle, Link2, Lock, Check } from 'lucide-react';
import HelpTrigger from '@/app/components/HelpTrigger';

const MOCK_USERS = [
  { id: 'b0627c6d-3a14-417b-b098-b38276797f9d', name: 'Platform Admin', email: 'admin@stochos.io', role: 'admin' },
  { id: '30b674bd-d83f-47d2-8e3e-07fab4bb7599', name: 'District Supervisor', email: 'supervisor@stochos.io', role: 'admin' },
  { id: '81513ac7-f81e-4cdb-a25e-37c3dd2d3707', name: 'Caitlin Chappell', email: 'cchappell404@gmail.com', role: 'admin' }
];

export default function RegistryClient() {
  const router = useRouter();

  // Active tab state
  const [activeTab, setActiveTab] = useState('metrics'); // 'metrics' or 'calculations'

  // Simulated active user
  const [currentUser, setCurrentUser] = useState(MOCK_USERS[0]);

  // Data states
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states - Metric Definition
  const [metricName, setMetricName] = useState('');
  const [glAccount, setGlAccount] = useState('');
  const [numberFormat, setNumberFormat] = useState('');
  const [metricOwner, setMetricOwner] = useState('system');

  // Form states - Metric Calculation
  const [selectedMetricId, setSelectedMetricId] = useState('');
  const [calcVersion, setCalcVersion] = useState('1');
  const [calcExpression, setCalcExpression] = useState('');
  const [selectedDependencies, setSelectedDependencies] = useState([]);
  const [aggregationBehavior, setAggregationBehavior] = useState('sum');

  // Load metrics registry
  const loadRegistry = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reporting/metrics');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMetrics(data.metrics);
          if (data.metrics.length > 0 && !selectedMetricId) {
            setSelectedMetricId(data.metrics[0].id);
          }
        }
      } else {
        const err = await res.json();
        setErrorMsg(`Failed to load registry: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(`Error connecting to server: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  // Handle creating a new metric definition
  const handleCreateMetric = async (e) => {
    e.preventDefault();
    if (!metricName) return;

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/reporting/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: metricName,
          glAccount: glAccount || null,
          ownerUserId: metricOwner,
          numberFormat: numberFormat || null,
          effectiveStartDate: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Metric Definition "${data.metric.name}" created successfully.`);
        setMetricName('');
        setGlAccount('');
        setNumberFormat('');
        loadRegistry();
      } else {
        setErrorMsg(`Error creating metric: ${data.error}`);
      }
    } catch (err) {
      setErrorMsg(`Error: ${err.message}`);
    }
  };

  // Handle creating a new calculation version (with circular check)
  const handleCreateCalculation = async (e) => {
    e.preventDefault();
    if (!selectedMetricId || !calcVersion || !calcExpression) {
      setErrorMsg('Please populate all calculation fields.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/reporting/metrics/calculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricDefinitionId: selectedMetricId,
          version: parseInt(calcVersion, 10),
          expression: calcExpression,
          aggregationBehavior,
          dependencyMetrics: selectedDependencies,
          createdById: currentUser.id,
          effectiveStartDate: new Date().toISOString()
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Formula version v${calcVersion} submitted successfully for approval.`);
        setCalcExpression('');
        setSelectedDependencies([]);
        loadRegistry();
      } else {
        setErrorMsg(`Validation Blocked: ${data.error}`);
      }
    } catch (err) {
      setErrorMsg(`Error saving formula: ${err.message}`);
    }
  };

  // Handle approving a calculation (creator checking active)
  const handleApproveCalculation = async (calcId) => {
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/reporting/metrics/calculations/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculationId: calcId,
          approvedById: currentUser.id
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Calculation version approved successfully. Formula is now active.');
        loadRegistry();
      } else {
        setErrorMsg(`Approval Rejected: ${data.error}`);
      }
    } catch (err) {
      setErrorMsg(`Error approving formula: ${err.message}`);
    }
  };

  // Handle multi-select dependencies toggles
  const handleDependencyToggle = (metricId) => {
    if (selectedDependencies.includes(metricId)) {
      setSelectedDependencies(selectedDependencies.filter(id => id !== metricId));
    } else {
      setSelectedDependencies([...selectedDependencies, metricId]);
    }
  };

  // Resolve metric name from ID
  const resolveMetricName = (id) => {
    const found = metrics.find(m => m.id === id);
    return found ? found.name : id;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text)', background: 'var(--surface-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'var(--font-sans)' }}>
      
      {/* simulated user switcher bar */}
      <div style={{ background: 'var(--status-passed-bg)', border: '1px solid var(--status-passed-border)', padding: '12px 24px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <KeyRound size={18} style={{ color: 'var(--status-passed-text)' }} />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600' }}>Governed Actor Session</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--status-passed-text)' }}>
              {currentUser.name} <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 'normal' }}>({currentUser.email})</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', color: 'var(--text)', fontWeight: '600' }}>Switch Active User:</label>
          <select 
            value={currentUser.id} 
            onChange={(e) => {
              const selected = MOCK_USERS.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
            style={{ padding: '6px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', outline: 'none' }}
          >
            {MOCK_USERS.map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>
            Metric Registry & Calculations
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Define metrics and formula dependency DAGs with compliance checking.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <HelpTrigger topicId="reporting_registry" />
          <button 
            onClick={() => router.push('/reporting')}
            style={{ padding: '8px 16px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Feedback messages */}
      {errorMsg && (
        <div style={{ padding: '16px', background: 'var(--status-failed-bg)', border: '1px solid var(--status-failed-border)', color: 'var(--status-failed-text)', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div style={{ padding: '16px', background: 'var(--status-passed-bg)', border: '1px solid var(--status-passed-border)', color: 'var(--status-passed-text)', borderRadius: '8px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Navigation tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <button 
          onClick={() => setActiveTab('metrics')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'metrics' ? '3px solid #107c41' : '3px solid transparent', 
            color: activeTab === 'metrics' ? 'var(--green)' : 'var(--text-muted)', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Metric Registry Definition
        </button>
        <button 
          onClick={() => setActiveTab('calculations')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'calculations' ? '3px solid #107c41' : '3px solid transparent', 
            color: activeTab === 'calculations' ? 'var(--green)' : 'var(--text-muted)', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Formulas & Version Control
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading registry configuration...</div>
      ) : (
        <div>
          {/* TAB 1: METRICS REGISTRY */}
          {activeTab === 'metrics' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: '24px', alignItems: 'start' }}>
              {/* Metrics Table */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '16px' }}>Registered Metrics</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px' }}>ID</th>
                      <th style={{ padding: '12px' }}>Metric Name</th>
                      <th style={{ padding: '12px' }}>GL Mapping</th>
                      <th style={{ padding: '12px' }}>Owner</th>
                      <th style={{ padding: '12px' }}>Number Format</th>
                      <th style={{ padding: '12px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map(metric => {
                      const isSystem = metric.id.startsWith('sys-');
                      return (
                        <tr key={metric.id} style={{ borderBottom: '1px solid var(--border-dim)' }}>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{metric.id.slice(0, 8)}</td>
                          <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--text)' }}>{metric.name}</td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{metric.glAccount || 'N/A (Derived)'}</td>
                          <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{metric.ownerUserId}</td>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{metric.numberFormat || 'Inherit'}</td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              borderRadius: '4px', 
                              fontSize: '11px', 
                              fontWeight: 'bold',
                              background: isSystem ? 'var(--status-draft-bg)' : 'var(--surface-1)',
                              color: isSystem ? 'var(--status-draft-text)' : 'var(--text-secondary)',
                              border: `1px solid ${isSystem ? 'var(--status-draft-border)' : 'var(--border)'}`
                            }}>
                              {isSystem ? 'system' : 'custom'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add Metric Form */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '16px' }}>Define Metric Slot</h2>
                <form onSubmit={handleCreateMetric} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Metric Name</label>
                    <input 
                      type="text" 
                      value={metricName}
                      onChange={(e) => setMetricName(e.target.value)}
                      placeholder="e.g. Total Travel Expenses"
                      style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>GL Account Code Mapping (Optional)</label>
                    <input 
                      type="text" 
                      value={glAccount}
                      onChange={(e) => setGlAccount(e.target.value)}
                      placeholder="e.g. 5-3000"
                      style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Number Format Pattern (Optional)</label>
                    <input 
                      type="text" 
                      value={numberFormat}
                      onChange={(e) => setNumberFormat(e.target.value)}
                      placeholder="e.g. $#,##0.00"
                      style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Owner Area</label>
                    <select 
                      value={metricOwner} 
                      onChange={(e) => setMetricOwner(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                    >
                      <option value="accounting">Accounting / Finance</option>
                      <option value="marketing">Marketing Operations</option>
                      <option value="audit">Internal Audit</option>
                      <option value="system">System / Global</option>
                    </select>
                  </div>
                  <button 
                    type="submit" 
                    style={{ padding: '12px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', fontSize: '13px', boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)' }}
                  >
                    Add Metric Slot
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: CALCULATIONS & FORMULAS */}
          {activeTab === 'calculations' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '24px', alignItems: 'start' }}>
              
              {/* Calculations List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {metrics.map(metric => {
                  const calcs = metric.calculations || [];
                  if (calcs.length === 0) return null;
 
                  return (
                    <div key={metric.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600' }}>Metric Formula Grid</span>
                          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>{metric.name}</h3>
                        </div>
                        <span style={{ fontFamily: 'monospace', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>{metric.id}</span>
                      </div>
 
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {calcs.map(calc => {
                          const isCreator = calc.createdById === currentUser.id;
                          const deps = calc.dependencyMetrics || [];
 
                          return (
                            <div 
                              key={calc.id} 
                              style={{ 
                                background: calc.isCurrent ? 'var(--status-passed-bg)' : 'var(--surface-1)', 
                                border: calc.isCurrent ? '1px solid var(--status-passed-border)' : '1px solid var(--border)', 
                                padding: '16px', 
                                borderRadius: '6px' 
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--text)' }}>Version {calc.version}</span>
                                  <span style={{ 
                                    padding: '2px 8px', 
                                    borderRadius: '12px', 
                                    fontSize: '11px', 
                                    fontWeight: 'bold',
                                    background: calc.isCurrent ? 'var(--status-passed-bg)' : calc.approvedById ? 'var(--surface-1)' : 'var(--status-warning-bg)',
                                    color: calc.isCurrent ? 'var(--status-passed-text)' : calc.approvedById ? 'var(--text-secondary)' : 'var(--status-warning-text)',
                                    border: `1px solid ${calc.isCurrent ? 'var(--status-passed-border)' : calc.approvedById ? 'var(--border)' : 'var(--status-warning-border)'}`
                                  }}>
                                    {calc.isCurrent ? 'Approved (Active)' : calc.approvedById ? 'Archived' : 'Pending Approval'}
                                  </span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                  Created by User ID: <span style={{ fontFamily: 'monospace' }}>{calc.createdById.slice(0, 8)}...</span>
                                </div>
                              </div>
 
                              <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text)', border: '1px solid #cbd5e1', borderLeft: '4px solid #107c41', marginBottom: '12px' }}>
                                {calc.expression}
                              </div>
 
                              {deps.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Dependencies:</span>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {deps.map(depId => (
                                      <span key={depId} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                                        <Link2 size={10} /> {resolveMetricName(depId)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
 
                              {/* Approval gating options */}
                              {!calc.isCurrent && !calc.approvedById && (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
                                  {isCreator ? (
                                    <div style={{ color: 'var(--status-warning-text)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                                      <Lock size={12} /> Self-Approval Blocked (Created by You)
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => handleApproveCalculation(calc.id)}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)' }}
                                    >
                                      Approve and Activate <Check size={14} />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
 
              {/* Add Formula Form */}
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '16px', boxShadow: 'var(--shadow-card)' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>Add Formula Version</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4', margin: 0 }}>
                  Define metric calculations using references. Note that adding circular references will be blocked by the DAG validator.
                </p>
 
                <form onSubmit={handleCreateCalculation} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Select Target Metric</label>
                    <select 
                      value={selectedMetricId} 
                      onChange={(e) => setSelectedMetricId(e.target.value)}
                      style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                    >
                      {metrics.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
 
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Version Number</label>
                      <input 
                        type="number" 
                        value={calcVersion}
                        onChange={(e) => setCalcVersion(e.target.value)}
                        min="1"
                        style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Agg. Behavior</label>
                      <select 
                        value={aggregationBehavior} 
                        onChange={(e) => setAggregationBehavior(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', outline: 'none' }}
                      >
                        <option value="sum">Sum</option>
                        <option value="avg">Average</option>
                        <option value="weighted">Weighted</option>
                        <option value="none">None (Derived)</option>
                      </select>
                    </div>
                  </div>
 
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Formula Expression</label>
                    <textarea 
                      value={calcExpression}
                      onChange={(e) => setCalcExpression(e.target.value)}
                      placeholder="e.g. [sys-001] + [sys-002]"
                      style={{ width: '100%', height: '80px', padding: '10px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '4px', fontFamily: 'monospace', resize: 'none', outline: 'none' }}
                      required
                    />
                  </div>
 
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Formula Dependencies (Select to link)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', background: 'var(--surface-1)', border: '1px solid var(--border)', padding: '12px', borderRadius: '4px' }}>
                      {metrics.map(m => (
                        <label key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', color: 'var(--text)' }}>
                          <input 
                            type="checkbox"
                            checked={selectedDependencies.includes(m.id)}
                            onChange={() => handleDependencyToggle(m.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <span>{m.name} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({m.id.slice(0, 8)})</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
 
                  <button 
                    type="submit" 
                    style={{ padding: '12px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px', fontSize: '13px', boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)' }}
                  >
                    Publish Formula Version
                  </button>
                </form>
              </div>
 
            </div>
          )}
        </div>
      )}

    </div>
  );
}
