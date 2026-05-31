'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CalendarClient() {
  const router = useRouter();
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Create form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeadlineName, setNewDeadlineName] = useState('Q4 Close statutory statement');
  const [newDeadlineDate, setNewDeadlineDate] = useState('2025-08-15');
  const [newDeadlineFreq, setNewDeadlineFreq] = useState('quarterly');

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reporting/calendar');
      const data = await res.json();
      if (data.success) {
        setCalendars(data.calendars);
      } else {
        setErrorMessage(data.error || 'Failed to load calendar data');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to connect to statutory calendar services.');
    } finally {
      setLoading(false);
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
      return { bg: '#eaf5ea', text: '#0e6c38', label: 'Completed' };
    }

    if (deadlineDate < today) {
      return { bg: '#fde8e8', text: '#9b1c1c', label: 'Overdue ⚠️' };
    }

    return { bg: '#fef3c7', text: '#b45309', label: 'Pending' };
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto', color: '#1e293b', backgroundColor: '#f1f3f4', display: 'flex', flexDirection: 'column', gap: '2rem', minHeight: '100vh', fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Statutory Reporting Calendar</h1>
          <p style={{ color: '#475569', fontSize: '14px', marginTop: '4px', margin: 0 }}>Track close timelines, statutory reporting compliance, and filing windows.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
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

      {/* Messages */}
      {errorMessage && (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '8px', color: '#dc2626', fontWeight: '600' }}>
          ⚠️ {errorMessage}
        </div>
      )}
      {successMessage && (
        <div style={{ padding: '16px', background: '#eaf5ea', border: '1px solid #d1e7dd', borderRadius: '8px', color: '#107c41', fontWeight: '600' }}>
          ✅ {successMessage}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>Loading statutory calendar...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {calendars.map(cal => (
            <div key={cal.id} style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '18px', color: '#0f172a', margin: 0, fontWeight: '700' }}>{cal.name}</h2>
                  <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '12px' }}>Fiscal Year Start Month: July (State Government Cycle)</p>
                </div>
                <span style={{ fontSize: '11px', background: '#eaf5ea', color: '#0e6c38', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', border: '1px solid #c3e6cb' }}>
                  ACTIVE MONITORING
                </span>
              </div>

              {/* Deadlines Table */}
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
                        <td style={{ padding: '16px 12px', fontWeight: '500', color: '#0f172a' }}>📅 {d.name}</td>
                        <td style={{ padding: '16px 12px', color: '#475569', textTransform: 'uppercase', fontSize: '11px' }}>{d.frequency}</td>
                        <td style={{ padding: '16px 12px', color: '#475569' }}>{new Date(d.deadlineDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</td>
                        <td style={{ padding: '16px 12px' }}>
                          <span style={{ background: statusUI.bg, color: statusUI.text, padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
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
        </div>
      )}

      {/* CREATE DEADLINE MODAL */}
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
