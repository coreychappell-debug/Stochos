'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RulesClient() {
  const router = useRouter();

  // Active tab state
  const [activeTab, setActiveTab] = useState('validation'); // 'validation' or 'commentary'

  // Period filters
  const [jurisdictionId, setJurisdictionId] = useState('52066ac6-27d4-4495-953b-8f8def2a7851'); // NY Lottery ID
  const [periodDate, setPeriodDate] = useState('2024-06-30'); // Seed period

  // API data
  const [ruleResults, setRuleResults] = useState([]);
  const [globalStatus, setGlobalStatus] = useState('');
  const [loading, setLoading] = useState(true);

  // Commentary workflow states
  const [commentaryContent, setCommentaryContent] = useState('<h1>Management Discussion & Analysis (MD&A)</h1><p>Sales were $850.0M. Commissions variance: (NARRATIVE REQUIRED)</p>');
  const [gateResults, setGateResults] = useState(null);
  const [isGating, setIsGating] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // Run validation audits
  const runAudits = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reporting/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jurisdictionId, periodDate })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setRuleResults(data.results);
          setGlobalStatus(data.validationStatus);
        }
      }
    } catch (err) {
      console.error('Error fetching compliance rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runAudits();
  }, [periodDate]);

  // Simulate commentary gate submission
  const handleSubmitSection = async (e) => {
    e.preventDefault();
    setIsGating(true);
    setGateResults(null);
    setSubmissionSuccess(false);

    try {
      const res = await fetch('/api/reporting/rules/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: 'sec-md-and-a', // simulated ID
          jurisdictionId,
          periodDateStr: periodDate,
          content: commentaryContent
        })
      });

      if (res.ok) {
        const data = await res.json();
        setGateResults(data);
        if (!data.blocked) {
          setSubmissionSuccess(true);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGating(false);
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'passed': return { bg: 'var(--status-passed-bg)', text: 'var(--status-passed-text)', border: 'var(--status-passed-border)', label: 'PASSED' };
      case 'warning': return { bg: 'var(--status-warning-bg)', text: 'var(--status-warning-text)', border: 'var(--status-warning-border)', label: 'WARNING' };
      case 'failed': return { bg: 'var(--status-failed-bg)', text: 'var(--status-failed-text)', border: 'var(--status-failed-border)', label: 'FAILED' };
      default: return { bg: 'var(--surface-3)', text: 'var(--text-secondary)', border: 'var(--border)', label: 'UNKNOWN' };
    }
  };

  // Preset explanations for the user to try
  const fillExplanationsPreset = () => {
    setCommentaryContent(
      '<h1>Management Discussion & Analysis (MD&A)</h1>' +
      '<p>Gross ticket sales for the period reached $850.0M.</p>' +
      '<h3>Retailer Commissions Variance Analysis</h3>' +
      '<p>Retailer commissions finished at 5.64% of sales ($48.0M actual). This variance vs our 5.0% target is due to a promotional incentive program launched alongside our new $30 scratcher ticket games.</p>'
    );
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: 'var(--text)', background: 'var(--surface-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'var(--font-sans)' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text)', margin: 0, letterSpacing: '-0.5px' }}>
            Compliance & Commentary Rules
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', margin: 0 }}>
            Audit financial data structures and enforce policy commentaries before final package closes.
          </p>
        </div>
        <button 
          onClick={() => router.push('/reporting')}
          style={{ padding: '8px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', boxShadow: 'var(--shadow-card)' }}
        >
          Back to Dashboard
        </button>
      </div>

      {/* Navigation tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <button 
          onClick={() => setActiveTab('validation')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'validation' ? '3px solid var(--green)' : '3px solid transparent', 
            color: activeTab === 'validation' ? 'var(--green)' : 'var(--text-secondary)', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Validation Rules Bench
        </button>
        <button 
          onClick={() => setActiveTab('commentary')}
          style={{ 
            padding: '12px 24px', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'commentary' ? '3px solid var(--green)' : '3px solid transparent', 
            color: activeTab === 'commentary' ? 'var(--green)' : 'var(--text-secondary)', 
            fontWeight: 'bold', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Commentary Gates Panel
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'validation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Summary Scorecard */}
          <div style={{ 
            background: 'var(--card-bg)', 
            border: '1px solid var(--border)', 
            borderRadius: '12px', 
            padding: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div>
              <h2 style={{ fontSize: '20px', color: 'var(--text)', margin: '0 0 8px 0', fontWeight: 'bold' }}>Period Close Audit Status</h2>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '600' }}>Period Ending Date:</span>
                <input 
                  type="date" 
                  value={periodDate}
                  onChange={(e) => setPeriodDate(e.target.value)}
                  style={{ padding: '6px 12px', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: 'bold' }}>Global Compliance Status</div>
              {loading ? (
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Auditing...</span>
              ) : (
                <span style={{ 
                  padding: '8px 18px', 
                  borderRadius: '20px', 
                  fontWeight: 'bold', 
                  fontSize: '14px',
                  background: getStatusStyle(globalStatus).bg,
                  color: getStatusStyle(globalStatus).text,
                  border: `1px solid ${globalStatus === 'passed' ? 'var(--status-passed-border)' : globalStatus === 'failed' ? 'var(--status-failed-border)' : 'var(--status-warning-border)'}`
                }}>
                  {getStatusStyle(globalStatus).label}
                </span>
              )}
            </div>
          </div>

          {/* Validation Rules Table */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', boxShadow: 'var(--shadow-card)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', marginBottom: '16px' }}>Compliance Integrity Checks</h2>
            
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Running data integrity checks...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {ruleResults.map(rule => {
                  const style = getStatusStyle(rule.status);
                  return (
                    <div 
                      key={rule.id} 
                      style={{ 
                        border: '1px solid var(--border)', 
                        background: 'var(--surface-3)', 
                        borderRadius: '8px', 
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        transition: 'background var(--transition)'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--blue-dim)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'var(--surface-3)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>{rule.name}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '4px 0 0 0' }}>{rule.description}</p>
                        </div>
                        <span style={{ 
                          padding: '4px 10px', 
                          borderRadius: '4px', 
                          fontSize: '11px', 
                          fontWeight: 'bold',
                          background: style.bg,
                          color: style.text,
                          border: `1px solid ${rule.status === 'passed' ? 'var(--status-passed-border)' : rule.status === 'failed' ? 'var(--status-failed-border)' : 'var(--status-warning-border)'}`
                        }}>
                          {style.label}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--card-bg)', border: '1px solid var(--border)', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Actual Value:</span> <strong style={{ color: 'var(--text)' }}>{rule.actualValue}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Expected Threshold:</span> <strong style={{ color: 'var(--blue)' }}>{rule.expectedValue}</strong>
                        </div>
                      </div>

                      {rule.details && (
                        <div style={{ fontSize: '13px', color: 'var(--text)', borderLeft: '3px solid var(--green)', paddingLeft: '8px' }}>
                          {rule.details}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'commentary' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', gap: '32px', alignItems: 'start' }}>
          
          {/* Commentary Workspace */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', boxShadow: 'var(--shadow-card)' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>MD&A Section Workspace</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', margin: 0 }}>Draft report section explanations for period close review.</p>
            </div>

            <form onSubmit={handleSubmitSection} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Section HTML Editor</span>
                <button 
                  type="button" 
                  onClick={fillExplanationsPreset}
                  style={{ background: 'var(--status-passed-bg)', color: 'var(--green)', border: '1px solid var(--status-passed-border)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Load Valid Commentary Preset ✨
                </button>
              </div>
              
              <textarea 
                value={commentaryContent}
                onChange={(e) => setCommentaryContent(e.target.value)}
                style={{ width: '100%', height: '240px', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '12px', borderRadius: '8px', fontFamily: 'monospace', resize: 'none', fontSize: '13px', outline: 'none' }}
                required
              />

              <button 
                type="submit" 
                disabled={isGating}
                style={{ padding: '12px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.1s', boxShadow: '0 2px 4px rgba(16, 124, 65, 0.15)' }}
                onMouseOver={(e) => e.currentTarget.style.background = 'var(--green-dim)'}
                onMouseOut={(e) => e.currentTarget.style.background = 'var(--green)'}
              >
                {isGating ? 'Evaluating Gate Constraints...' : 'Submit Section for Approval 📄'}
              </button>
            </form>
          </div>

          {/* Commentary Gate Checks Dashboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Policy Threshold card */}
            <div style={{ background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning-border)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ color: 'var(--status-warning-text)', fontSize: '15px', fontWeight: 'bold', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> Variance Policy Requirement
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--status-warning-text)', lineHeight: '1.5', margin: 0 }}>
                Under finance guidelines, any actual expenditure category (e.g. Commissions) deviating from planned budgets by <strong>&gt; 10%</strong> triggers a mandatory audit commentary check. Report sections cannot transition status to <em>Submitted</em> without narrative clearance.
              </p>
            </div>

            {/* Ingestion results */}
            {gateResults && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: 'var(--shadow-card)' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text)', margin: 0 }}>Gate Evaluation Results</h3>

                {/* Blocked / Success banner */}
                {gateResults.blocked ? (
                  <div style={{ padding: '12px', background: 'var(--status-failed-bg)', border: '1px solid var(--status-failed-border)', color: 'var(--status-failed-text)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>❌</span> Submission Blocked: Policy triggers unfulfilled.
                  </div>
                ) : (
                  <div style={{ padding: '12px', background: 'var(--status-passed-bg)', border: '1px solid var(--status-passed-border)', color: 'var(--status-passed-text)', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                    <span>✅</span> Submission Successful! Gate clearance resolved.
                  </div>
                )}

                {/* Checked triggers list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {gateResults.triggers.map((trigger, idx) => (
                    <div key={idx} style={{ background: 'var(--surface-3)', border: '1px solid var(--border)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text)' }}>{trigger.metric}</strong>
                        <span style={{ 
                          color: trigger.status === 'passed' ? 'var(--status-passed-text)' : 'var(--status-failed-text)',
                          fontWeight: 'bold',
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: trigger.status === 'passed' ? 'var(--status-passed-bg)' : 'var(--status-failed-bg)',
                          border: `1px solid ${trigger.status === 'passed' ? 'var(--status-passed-border)' : 'var(--status-failed-border)'}`
                        }}>
                          {trigger.status === 'passed' ? 'RESOLVED' : 'BLOCKED'}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '12px' }}>
                        <div>Variance: <span style={{ color: 'var(--status-failed-text)', fontWeight: 'bold' }}>{trigger.variance}</span></div>
                        <div>Policy Limit: <span>{trigger.threshold}</span></div>
                      </div>
                      <div style={{ color: 'var(--text)', borderTop: '1px solid var(--border)', paddingTop: '6px', fontSize: '12px' }}>
                        {trigger.message}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
