'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  CheckCircle2, 
  XCircle, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Users, 
  FileText, 
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import HelpTrigger from '@/app/components/HelpTrigger';

export default function CalendarClient() {
  const router = useRouter();
  
  // Data loading states
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [startMonth, setStartMonth] = useState(7); // Default to July (7)

  // Tab State: 'deadlines' vs 'checklist'
  const [activeTab, setActiveTab] = useState('checklist');

  // Checklist Selection State
  const [selectedYear, setSelectedYear] = useState(2025);
  const [selectedPeriod, setSelectedPeriod] = useState('P03'); // Period 3 (June)
  const [checklistTasks, setChecklistTasks] = useState([]);
  const [periodLocked, setPeriodLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState(null);
  const [lockedAt, setLockedAt] = useState(null);

  // Role Simulation Context
  const [simulationUsers, setSimulationUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);

  // Modal State for adding Statutory deadline (Tab 1)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeadlineName, setNewDeadlineName] = useState('Q4 Close statutory statement');
  const [newDeadlineDate, setNewDeadlineDate] = useState('2025-08-15');
  const [newDeadlineFreq, setNewDeadlineFreq] = useState('quarterly');

  const getMonthName = (monthIndex) => {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[monthIndex % 12];
  };

  const periodOptions = useMemo(() => {
    const baseIndex = startMonth - 1;
    const list = Array.from({ length: 12 }, (_, i) => {
      const pNum = i + 1;
      const pCode = `P${String(pNum).padStart(2, '0')}`;
      const mName = getMonthName(baseIndex + i);
      return { code: pCode, label: `Period ${pNum} (${mName})` };
    });
    list.push({ code: 'P13', label: 'Period 13 (EOY Adjustments)' });
    return list;
  }, [startMonth]);

  useEffect(() => {
    fetchCalendarData();
  }, []);

  useEffect(() => {
    if (activeTab === 'checklist') {
      fetchChecklistData();
    }
  }, [selectedYear, selectedPeriod, activeTab]);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reporting/calendar');
      const data = await res.json();
      if (data.success) {
        setCalendars(data.calendars);
        if (data.calendars.length > 0 && data.calendars[0].fiscalYearStartMonth) {
          setStartMonth(data.calendars[0].fiscalYearStartMonth);
        }
      } else {
        setErrorMessage(data.error || 'Failed to load statutory calendar deadlines.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to connect to statutory calendar services.');
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklistData = async () => {
    try {
      setChecklistLoading(true);
      setErrorMessage('');
      const res = await fetch(`/api/reporting/calendar/checklist?fiscalYear=${selectedYear}&periodCode=${selectedPeriod}`);
      const data = await res.json();
      if (data.success) {
        setChecklistTasks(data.tasks);
        setPeriodLocked(data.isLocked);
        setLockedBy(data.lockedBy);
        setLockedAt(data.lockedAt);
        
        if (data.simulationUsers && data.simulationUsers.length > 0) {
          setSimulationUsers(data.simulationUsers);
          // Default active user if not set
          if (!activeUser) {
            // Find Finance user first
            const financeUser = data.simulationUsers.find(u => u.division === 'FINANCE');
            setActiveUser(financeUser || data.simulationUsers[0]);
          }
        }
      } else {
        setErrorMessage(data.error || 'Failed to load checklist data.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to connect to checklist services.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleToggleChecklistTask = async (taskKey, currentStatus) => {
    if (periodLocked) return;
    if (!activeUser) {
      setErrorMessage('Please select a simulated user to perform checklist actions.');
      return;
    }

    // Role Enforcement Checks
    if (taskKey === 'TERMINAL_SALES' && activeUser.division !== 'OPERATIONS' && activeUser.division !== 'EXECUTIVE') {
      setErrorMessage('Step 1 (Verify Terminal Sales) can only be performed by Operations or Executive roles.');
      return;
    }
    if (taskKey === 'PRIZE_RECONCILIATION' && activeUser.division !== 'FINANCE' && activeUser.division !== 'EXECUTIVE') {
      setErrorMessage('Step 3 (Reconcile Prize Liabilities) can only be performed by Finance or Executive roles.');
      return;
    }

    try {
      setChecklistLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const res = await fetch('/api/reporting/calendar/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId: 'NY-LOTTERY',
          fiscalYear: selectedYear,
          periodCode: selectedPeriod,
          taskKey,
          isCompleted: !currentStatus,
          userId: activeUser.id
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Checklist task updated successfully.`);
        fetchChecklistData();
      } else {
        setErrorMessage(data.error || 'Failed to update task.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error during task update.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handlePeriodLockToggle = async (action) => {
    if (!activeUser) {
      setErrorMessage('Please select a simulated user to perform lock actions.');
      return;
    }

    // Gating for lock
    if (action === 'lock') {
      // 1. Verify role is Finance or Executive
      if (activeUser.division !== 'FINANCE' && activeUser.division !== 'EXECUTIVE') {
        setErrorMessage('Only Finance or Executive roles can lock a period.');
        return;
      }
      // 2. Verify all preceding tasks are completed
      const incomplete = checklistTasks.filter(t => t.taskKey !== 'LOCK_PERIOD' && !t.isCompleted);
      if (incomplete.length > 0) {
        setErrorMessage('Cannot lock period. All preceding checklist tasks must be completed.');
        return;
      }
      // 3. Verify GL balances to $0.00
      const glTask = checklistTasks.find(t => t.taskKey === 'GL_INGESTION');
      if (glTask && !glTask.isBalanced) {
        setErrorMessage(`Cannot lock period. General Ledger is out of balance by $${glTask.balanceOverage?.toFixed(2)}.`);
        return;
      }
    } else {
      // Unlock: Verify role is Finance or Executive
      if (activeUser.division !== 'FINANCE' && activeUser.division !== 'EXECUTIVE') {
        setErrorMessage('Only Finance or Executive roles can unlock a period.');
        return;
      }
    }

    try {
      setChecklistLoading(true);
      setErrorMessage('');
      setSuccessMessage('');

      const res = await fetch('/api/reporting/trial-balance/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jurisdictionId: 'NY-LOTTERY',
          fiscalYear: selectedYear,
          periodCode: selectedPeriod,
          action,
          userId: activeUser.id
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(data.message || `Period close status updated.`);
        fetchChecklistData();
      } else {
        setErrorMessage(data.error || 'Failed to change period lock status.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Network error during lock state update.');
    } finally {
      setChecklistLoading(false);
    }
  };

  const handleCreateDeadline = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (calendars.length === 0) return;

    try {
      const res = await fetch('/api/reporting/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendars[0].id,
          name: newDeadlineName,
          deadlineDateStr: newDeadlineDate,
          frequency: newDeadlineFreq
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage('Statutory deadline added successfully.');
        setIsModalOpen(false);
        fetchCalendarData();
      } else {
        setErrorMessage(data.error || 'Failed to add deadline.');
      }
    } catch (err) {
      setErrorMessage('Network error during deadline creation.');
    }
  };

  const getDeadlineStatusColor = (deadline) => {
    const today = new Date();
    const deadlineDate = new Date(deadline.deadlineDate);

    if (deadline.status === 'completed') {
      return { bg: '#eaf5ea', text: '#0e6c38', label: 'Completed', isCompleted: true };
    }

    if (deadlineDate < today) {
      return { bg: '#fde8e8', text: '#9b1c1c', label: 'Overdue', isOverdue: true };
    }

    return { bg: '#fef3c7', text: '#b45309', label: 'Pending' };
  };

  const getCompletedCount = () => {
    return checklistTasks.filter(t => t.isCompleted).length;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', color: '#1e293b', backgroundColor: '#f1f3f4', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Statutory Reporting & Close Calendar</h1>
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '4px', margin: 0 }}>Track filing windows, statutory reporting compliance, and close month checklists.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          
          {/* Active Simulation User Context */}
          {activeTab === 'checklist' && simulationUsers.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ffffff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
              <Users size={16} style={{ color: '#4b5563' }} />
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#4b5563' }}>Role Simulator:</label>
              <select
                value={activeUser ? activeUser.id : ''}
                onChange={e => {
                  const selected = simulationUsers.find(u => u.id === e.target.value);
                  setActiveUser(selected);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                style={{
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  color: '#0f172a',
                  outline: 'none',
                  cursor: 'pointer',
                  backgroundColor: 'transparent'
                }}
              >
                {simulationUsers.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.division})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'deadlines' && (
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ 
                padding: '8px 16px', 
                background: '#1a73e8', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(26, 115, 232, 0.15)',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1557b0'}
              onMouseOut={(e) => e.currentTarget.style.background = '#1a73e8'}
            >
              + Add Deadline
            </button>
          )}

          <HelpTrigger topicId="reporting_calendar" />
          <button 
            onClick={() => router.push('/reporting')} 
            style={{ 
              padding: '8px 16px', 
              background: '#ffffff', 
              color: '#1e293b', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* MESSAGES */}
      {errorMessage && (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <AlertTriangle size={18} /> {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '16px', background: '#eaf5ea', border: '1px solid #d1e7dd', borderRadius: '8px', color: '#107c41', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <CheckCircle2 size={18} /> {successMessage}
        </div>
      )}

      {/* SUB-NAVIGATION TABS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', gap: '24px' }}>
        <button
          onClick={() => {
            setActiveTab('checklist');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          style={{
            padding: '12px 8px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            color: activeTab === 'checklist' ? '#1a73e8' : '#64748b',
            borderBottom: activeTab === 'checklist' ? '3px solid #1a73e8' : '3px solid transparent',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          Month-End Close Checklist
        </button>
        <button
          onClick={() => {
            setActiveTab('deadlines');
            setErrorMessage('');
            setSuccessMessage('');
          }}
          style={{
            padding: '12px 8px',
            border: 'none',
            background: 'none',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            color: activeTab === 'deadlines' ? '#1a73e8' : '#64748b',
            borderBottom: activeTab === 'deadlines' ? '3px solid #1a73e8' : '3px solid transparent',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          Statutory Filing Deadlines
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '6rem', color: '#64748b' }}>
          <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
          Loading statutory calendar services...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* TAB 1: FILING DEADLINES */}
          {activeTab === 'deadlines' && calendars.map(cal => (
            <div key={cal.id} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', color: '#0f172a', margin: 0, fontWeight: '700' }}>{cal.name}</h2>
                  <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '12.5px' }}>Fiscal Year Start Month: {getMonthName(startMonth - 1)} (Active Cycle)</p>
                </div>
                <span style={{ fontSize: '11px', background: '#eaf5ea', color: '#0e6c38', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #c3e6cb' }}>
                  ACTIVE MONITORING
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #cbd5e1' }}>
                    <th style={{ padding: '12px', color: '#475569', fontWeight: '600', width: '40%' }}>Compliance Close / Filing Name</th>
                    <th style={{ padding: '12px', color: '#475569', fontWeight: '600' }}>Frequency</th>
                    <th style={{ padding: '12px', color: '#475569', fontWeight: '600' }}>Filing Close Date</th>
                    <th style={{ padding: '12px', color: '#475569', fontWeight: '600' }}>Filing Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cal.deadlines.map(d => {
                    const statusUI = getDeadlineStatusColor(d);
                    return (
                      <tr key={d.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px 12px', fontWeight: '500', color: '#0f172a' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={16} style={{ color: '#1a73e8' }} /> {d.name}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', color: '#475569', textTransform: 'uppercase', fontSize: '11px' }}>{d.frequency}</td>
                        <td style={{ padding: '16px 12px', color: '#475569' }}>{new Date(d.deadlineDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: statusUI.bg, color: statusUI.text, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                            {statusUI.isOverdue && <AlertTriangle size={12} />}
                            {statusUI.isCompleted && <CheckCircle size={12} />}
                            {statusUI.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* TAB 2: MONTH-END CLOSE CHECKLIST */}
          {activeTab === 'checklist' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Filter / Status Header Card */}
              <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Fiscal Year</label>
                    <select
                      value={selectedYear}
                      onChange={e => setSelectedYear(parseInt(e.target.value, 10))}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', fontSize: '13.5px', color: '#0f172a', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <option value={2023}>FY2023</option>
                      <option value={2024}>FY2024</option>
                      <option value={2025}>FY2025 (Current)</option>
                      <option value={2026}>FY2026</option>
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Reporting Period</label>
                    <select
                      value={selectedPeriod}
                      onChange={e => setSelectedPeriod(e.target.value)}
                      style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px 12px', borderRadius: '6px', fontSize: '13.5px', color: '#0f172a', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {periodOptions.map(p => (
                        <option key={p.code} value={p.code}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Progress bar */}
                <div style={{ flex: '1', maxWidth: '350px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: '700', color: '#475569' }}>
                    <span>Checklist Progress</span>
                    <span>{getCompletedCount()} of 4 Completed</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${(getCompletedCount() / 4) * 100}%`, height: '100%', background: getCompletedCount() === 4 ? '#107c41' : '#1a73e8', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Locking Status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: periodLocked ? '#fde8e8' : '#eaf5ea', padding: '10px 18px', borderRadius: '8px', border: periodLocked ? '1px solid #fbd5d5' : '1px solid #c3e6cb' }}>
                  {periodLocked ? <Lock size={20} style={{ color: '#9b1c1c' }} /> : <Unlock size={20} style={{ color: '#0e6c38' }} />}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: periodLocked ? '#9b1c1c' : '#0e6c38' }}>
                      {periodLocked ? 'PERIOD LOCKED' : 'PERIOD OPEN'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#4b5563', marginTop: '2px' }}>
                      {periodLocked ? `Locked by ${lockedBy} on ${new Date(lockedAt).toLocaleDateString()}` : 'Reconciliations and edits are enabled.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Checklist Cards Container */}
              {checklistLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  Refreshing checklist statuses...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  
                  {/* Step 1: Verify Terminal Sales */}
                  {(() => {
                    const task = checklistTasks.find(t => t.taskKey === 'TERMINAL_SALES') || { isCompleted: false };
                    const hasAuth = activeUser?.division === 'OPERATIONS' || activeUser?.division === 'EXECUTIVE';
                    
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', opacity: periodLocked ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '24px', fontWeight: '900', color: '#cbd5e1', lineHeight: '1' }}>01</span>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Verify Terminal Sales Records
                              {task.isCompleted ? <CheckCircle2 size={16} style={{ color: '#107c41' }} /> : <AlertTriangle size={16} style={{ color: '#b45309' }} />}
                            </h3>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.4' }}>
                              The Retailer Systems Bureau must confirm that total regional terminal sales figures match machine records in the Central Gaming System.
                            </p>
                            {task.isCompleted && (
                              <div style={{ fontSize: '11.5px', color: '#107c41', marginTop: '6px', fontWeight: '600' }}>
                                Verified by {task.completedBy} on {new Date(task.completedAt).toLocaleTimeString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            disabled={periodLocked}
                            onClick={() => handleToggleChecklistTask('TERMINAL_SALES', task.isCompleted)}
                            style={{
                              padding: '8px 16px',
                              background: task.isCompleted ? '#f3f4f6' : hasAuth ? '#1a73e8' : '#e2e8f0',
                              color: task.isCompleted ? '#4b5563' : hasAuth ? '#ffffff' : '#9ca3af',
                              border: task.isCompleted ? '1px solid #d1d5db' : 'none',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '13px',
                              cursor: periodLocked ? 'not-allowed' : hasAuth ? 'pointer' : 'not-allowed',
                              minWidth: '120px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {task.isCompleted ? 'Unverify' : 'Verify Sales'}
                          </button>
                          {!hasAuth && !periodLocked && (
                            <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px', textAlign: 'center', width: '120px' }}>
                              Operations/Exec only
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 2: GL Ingestion */}
                  {(() => {
                    const task = checklistTasks.find(t => t.taskKey === 'GL_INGESTION') || { isCompleted: false, recordCount: 0, isBalanced: false, balanceOverage: 0 };
                    
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '24px', fontWeight: '900', color: '#cbd5e1', lineHeight: '1' }}>02</span>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Ingest General Ledger / Trial Balance
                              {task.isCompleted ? (
                                task.isBalanced ? <CheckCircle2 size={16} style={{ color: '#107c41' }} /> : <AlertTriangle size={16} style={{ color: '#dc2626' }} />
                              ) : (
                                <AlertTriangle size={16} style={{ color: '#b45309' }} />
                              )}
                            </h3>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.4' }}>
                              The Accounting Unit must import the General Ledger Trial Balance CSV file in the Data Prep Studio for this period.
                            </p>
                            {task.isCompleted && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '6px' }}>
                                <div style={{ fontSize: '11.5px', color: '#107c41', fontWeight: '600' }}>
                                  Auto-Verified: Ingested {task.recordCount} accounts from ERP source batch.
                                </div>
                                <div style={{ fontSize: '11px', color: task.isBalanced ? '#107c41' : '#dc2626', fontWeight: '600' }}>
                                  Double-Entry Balance: {task.isBalanced ? 'Balanced ($0.00)' : `Out of balance by $${task.balanceOverage?.toFixed(2)}`}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            onClick={() => router.push('/reporting/upload')}
                            style={{
                              padding: '8px 16px',
                              background: '#ffffff',
                              color: '#1a73e8',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              minWidth: '120px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                          >
                            Upload GL <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 3: Reconcile Prize Liabilities */}
                  {(() => {
                    const task = checklistTasks.find(t => t.taskKey === 'PRIZE_RECONCILIATION') || { isCompleted: false };
                    const hasAuth = activeUser?.division === 'FINANCE' || activeUser?.division === 'EXECUTIVE';
                    
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', opacity: periodLocked ? 0.8 : 1 }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '24px', fontWeight: '900', color: '#cbd5e1', lineHeight: '1' }}>03</span>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Reconcile Prize Claim Liabilities
                              {task.isCompleted ? <CheckCircle2 size={16} style={{ color: '#107c41' }} /> : <AlertTriangle size={16} style={{ color: '#b45309' }} />}
                            </h3>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.4' }}>
                              The Treasury &amp; Accounts Payable unit must reconcile outstanding prize claims, annuity payouts, and banking cash flows.
                            </p>
                            {task.isCompleted && (
                              <div style={{ fontSize: '11.5px', color: '#107c41', marginTop: '6px', fontWeight: '600' }}>
                                Reconciled by {task.completedBy} on {new Date(task.completedAt).toLocaleTimeString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            disabled={periodLocked}
                            onClick={() => handleToggleChecklistTask('PRIZE_RECONCILIATION', task.isCompleted)}
                            style={{
                              padding: '8px 16px',
                              background: task.isCompleted ? '#f3f4f6' : hasAuth ? '#1a73e8' : '#e2e8f0',
                              color: task.isCompleted ? '#4b5563' : hasAuth ? '#ffffff' : '#9ca3af',
                              border: task.isCompleted ? '1px solid #d1d5db' : 'none',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '13px',
                              cursor: periodLocked ? 'not-allowed' : hasAuth ? 'pointer' : 'not-allowed',
                              minWidth: '120px',
                              transition: 'all 0.2s'
                            }}
                          >
                            {task.isCompleted ? 'Unreconcile' : 'Reconcile AP'}
                          </button>
                          {!hasAuth && !periodLocked && (
                            <div style={{ fontSize: '10px', color: '#dc2626', marginTop: '4px', textAlign: 'center', width: '120px' }}>
                              Finance/Exec only
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 4: Resolve Variance Commentary */}
                  {(() => {
                    const task = checklistTasks.find(t => t.taskKey === 'VARIANCE_COMMENTARY') || { isCompleted: false, pendingCount: 0, totalCount: 0 };
                    
                    return (
                      <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '24px', fontWeight: '900', color: '#cbd5e1', lineHeight: '1' }}>04</span>
                          <div>
                            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Resolve Variance Commentary Tasks
                              {task.isCompleted ? <CheckCircle2 size={16} style={{ color: '#107c41' }} /> : <AlertTriangle size={16} style={{ color: '#b45309' }} />}
                            </h3>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.4' }}>
                              All triggered budget and sales variance exception commentary tasks must be resolved by their respective division leads.
                            </p>
                            {task.totalCount > 0 ? (
                              <div style={{ fontSize: '11.5px', color: task.isCompleted ? '#107c41' : '#b45309', marginTop: '6px', fontWeight: '600' }}>
                                {task.isCompleted 
                                  ? `All commentary tasks resolved: completed ${task.totalCount - task.pendingCount} of ${task.totalCount} tasks.`
                                  : `Pending items: ${task.pendingCount} of ${task.totalCount} commentary tasks require justification.`
                                }
                              </div>
                            ) : (
                              <div style={{ fontSize: '11.5px', color: '#107c41', marginTop: '6px', fontWeight: '600' }}>
                                Auto-Verified: No variance exceptions triggered for this period.
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            onClick={() => router.push('/reporting/workflow')}
                            style={{
                              padding: '8px 16px',
                              background: '#ffffff',
                              color: '#1a73e8',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontWeight: '700',
                              fontSize: '13px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              minWidth: '120px',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
                            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
                          >
                            Resolve Tasks <ArrowRight size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Period Locking Control Card */}
                  {(() => {
                    const isChecklistReady = checklistTasks.filter(t => t.taskKey !== 'LOCK_PERIOD').every(t => t.isCompleted);
                    const glTask = checklistTasks.find(t => t.taskKey === 'GL_INGESTION');
                    const isBalanced = glTask ? glTask.isBalanced : true;
                    
                    const canLock = isChecklistReady && isBalanced;
                    const hasLockAuth = activeUser?.division === 'FINANCE' || activeUser?.division === 'EXECUTIVE';

                    return (
                      <div style={{ 
                        marginTop: '12px',
                        background: periodLocked ? 'rgba(239, 68, 68, 0.05)' : 'rgba(26, 115, 232, 0.05)', 
                        border: periodLocked ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(26, 115, 232, 0.2)', 
                        borderRadius: '12px', 
                        padding: '24px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '24px'
                      }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          {periodLocked ? (
                            <Lock size={32} style={{ color: '#9b1c1c', marginTop: '4px' }} />
                          ) : (
                            <Unlock size={32} style={{ color: '#1a73e8', marginTop: '4px' }} />
                          )}
                          <div>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: periodLocked ? '#9b1c1c' : '#0f172a', margin: '0 0 6px 0' }}>
                              {periodLocked ? 'This Period is Locked & Governed' : 'Period Lock Certification'}
                            </h3>
                            <p style={{ margin: 0, color: '#475569', fontSize: '13px', lineHeight: '1.5', maxWidth: '800px' }}>
                              Locking the period archives the General Ledger records, disables further trial balance uploads, and locks the compiled financial statements to prevent retroactive modifications.
                            </p>
                            {!periodLocked && !canLock && (
                              <div style={{ fontSize: '12px', color: '#9b1c1c', marginTop: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertTriangle size={14} /> Locked Status Gated: Complete steps 1 to 4 and ensure General Ledger is balanced to enable period locking.
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          {periodLocked ? (
                            <button
                              onClick={() => handlePeriodLockToggle('unlock')}
                              disabled={!hasLockAuth}
                              style={{
                                padding: '10px 20px',
                                background: hasLockAuth ? '#9b1c1c' : '#e2e8f0',
                                color: hasLockAuth ? '#ffffff' : '#9ca3af',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: hasLockAuth ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '140px',
                                transition: 'all 0.2s',
                                boxShadow: hasLockAuth ? '0 2px 4px rgba(155, 28, 28, 0.15)' : 'none'
                              }}
                            >
                              <Unlock size={16} /> Unlock Period
                            </button>
                          ) : (
                            <button
                              onClick={() => handlePeriodLockToggle('lock')}
                              disabled={!canLock || !hasLockAuth}
                              style={{
                                padding: '10px 20px',
                                background: (canLock && hasLockAuth) ? '#107c41' : '#e2e8f0',
                                color: (canLock && hasLockAuth) ? '#ffffff' : '#9ca3af',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '700',
                                fontSize: '14px',
                                cursor: (canLock && hasLockAuth) ? 'pointer' : 'not-allowed',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                minWidth: '140px',
                                transition: 'all 0.2s',
                                boxShadow: (canLock && hasLockAuth) ? '0 2px 4px rgba(16, 124, 65, 0.15)' : 'none'
                              }}
                            >
                              <Lock size={16} /> Lock Period
                            </button>
                          )}
                          {!hasLockAuth && (
                            <div style={{ fontSize: '10.5px', color: '#dc2626', marginTop: '6px', textAlign: 'center' }}>
                              Requires Finance/Exec
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* CREATE DEADLINE MODAL (TAB 1) */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', width: '450px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Add Statutory Deadline</h2>
            <form onSubmit={handleCreateDeadline} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Deadline Name</label>
                <input 
                  type="text" 
                  value={newDeadlineName} 
                  onChange={e => setNewDeadlineName(e.target.value)} 
                  required
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', color: '#0f172a', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Frequency</label>
                  <select 
                    value={newDeadlineFreq} 
                    onChange={e => setNewDeadlineFreq(e.target.value)}
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', color: '#0f172a', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="annual">Annual</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Filing Close Date</label>
                  <input 
                    type="date" 
                    value={newDeadlineDate} 
                    onChange={e => setNewDeadlineDate(e.target.value)}
                    required
                    style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', color: '#0f172a', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                <button type="submit" style={{ background: '#107c41', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Add Date</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
