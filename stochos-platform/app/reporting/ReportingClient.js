'use client';

import { useRouter } from 'next/navigation';

export default function ReportingClient() {
  const router = useRouter();

  return (
    <div style={{ backgroundColor: '#f1f3f4', minHeight: '100vh', width: '100%', padding: '2rem', color: '#1e293b', fontFamily: '"Inter", sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* HEADER SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
              Connected Reporting Platform
            </h1>
            <p style={{ color: '#475569', fontSize: '14px', marginTop: '4px', margin: 0 }}>
              Institutional financial summaries, audit trails, and multi-scenario templates.
            </p>
          </div>
          <button 
            onClick={() => router.push('/')}
            style={{ 
              padding: '8px 16px', 
              background: '#ffffff', 
              color: '#1e293b', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              transition: 'all 0.2s', 
              fontWeight: '600',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            Back to Platform Hub
          </button>
        </div>

        {/* CARDS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* DATA INGESTION CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📊</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Data Ingestion</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Bypass IT integration queues. Export your standard Trial Balance from your ERP and drop the CSV file here to instantly populate your financial data for the period.
            </p>
            <button 
              onClick={() => router.push('/reporting/upload')}
              style={{ 
                padding: '12px 24px', 
                background: '#1a73e8', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1557b0'}
              onMouseOut={(e) => e.currentTarget.style.background = '#1a73e8'}
            >
              Upload Trial Balance
            </button>
          </div>

          {/* GOVERNED GRID CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🟢</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Governed Analytical Grid</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Design financial statements and dashboards in a familiar, governed spreadsheet interface linked directly to the Metric Registry.
            </p>
            <button 
              onClick={() => router.push('/reporting/grid')}
              style={{ 
                padding: '12px 24px', 
                background: '#107c41', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#0e6c38'}
              onMouseOut={(e) => e.currentTarget.style.background = '#107c41'}
            >
              Open Governed Grid
            </button>
          </div>

          {/* NARRATIVE DOCUMENT CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📝</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Narrative Document Editor</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Write MD&A and Footnotes using an enterprise WYSIWYG editor. Insert dynamic Metric Pills to guarantee numbers match the Grid.
            </p>
            <button 
              onClick={() => router.push('/reporting/template')}
              style={{ 
                padding: '12px 24px', 
                background: '#1a73e8', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#1557b0'}
              onMouseOut={(e) => e.currentTarget.style.background = '#1a73e8'}
            >
              Open Document Editor
            </button>
          </div>

          {/* METRIC REGISTRY & CALCULATIONS CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>⚙️</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Metric Registry</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Configure institutional metric slots and dynamic calculation formula dependency DAGs. Enforces validation gates and audits.
            </p>
            <button 
              onClick={() => router.push('/reporting/registry')}
              style={{ 
                padding: '12px 24px', 
                background: '#475569', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#334155'}
              onMouseOut={(e) => e.currentTarget.style.background = '#475569'}
            >
              Manage Metric Formulas
            </button>
          </div>

          {/* COMPLIANCE & COMMENTARY RULES CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>🛡️</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Compliance Rules</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Enforce institutional compliance validation checks on data actuals and configure commentary trigger gates for period close reporting.
            </p>
            <button 
              onClick={() => router.push('/reporting/rules')}
              style={{ 
                padding: '12px 24px', 
                background: '#d97706', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#b45309'}
              onMouseOut={(e) => e.currentTarget.style.background = '#d97706'}
            >
              Review Compliance Gates
            </button>
          </div>

          {/* GOVERNED WORKFLOW & BINDERS CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📑</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Governed Workflow</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Assign document sections, configure author and reviewer roles, and execute state transitions for modular document compilation.
            </p>
            <button 
              onClick={() => router.push('/reporting/workflow')}
              style={{ 
                padding: '12px 24px', 
                background: '#7c3aed', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#6d28d9'}
              onMouseOut={(e) => e.currentTarget.style.background = '#7c3aed'}
            >
              Manage Workflow
            </button>
          </div>

          {/* STATUTORY CALENDAR CARD */}
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px', marginRight: '12px' }}>📅</span>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a', margin: 0 }}>Statutory Close Calendar</h2>
            </div>
            <p style={{ color: '#475569', marginBottom: '24px', lineHeight: '1.5', fontSize: '13.5px' }}>
              Track statutory filing deadlines, close period compliance thresholds, and statutory warnings for State Lottery commissions.
            </p>
            <button 
              onClick={() => router.push('/reporting/calendar')}
              style={{ 
                padding: '12px 24px', 
                background: '#4f46e5', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                fontWeight: 'bold', 
                cursor: 'pointer', 
                width: '100%', 
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#3730a3'}
              onMouseOut={(e) => e.currentTarget.style.background = '#4f46e5'}
            >
              Open Statutory Calendar
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
