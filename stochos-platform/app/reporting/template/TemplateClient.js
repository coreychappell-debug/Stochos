'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DocumentEditor from '../../components/tiptap/DocumentEditor';
import { FileText, Eye, EyeOff, BookOpen } from 'lucide-react';
import HelpTrigger from '../../components/HelpTrigger';

// Simple Markdown to HTML parser for the live preview
const parseMarkdown = (text) => {
  if (!text) return '';
  let html = text
    .replace(/^### (.*$)/gim, '<h3 style="font-size: 1.25rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem; color: #1e293b;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size: 1.5rem; font-weight: 700; margin-top: 2rem; margin-bottom: 1rem; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="font-size: 2.25rem; font-weight: 800; margin-top: 1rem; margin-bottom: 1.5rem; color: #0f172a;">$1</h1>')
    .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*)\*/gim, '<em>$1</em>')
    .replace(/\{\{(.*?)\}\}/g, '<span style="background: #e0f2fe; color: #0284c7; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em; font-weight: bold;">{{$1}}</span>')
    .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #cbd5e1; padding-left: 1rem; color: #475569; font-style: italic; margin: 1rem 0;">$1</blockquote>')
    .replace(/\n$/gim, '<br />');

  // Wrap paragraphs (lines not starting with <)
  html = html.split('\n').map(line => {
    if (line.trim().length > 0 && !line.trim().startsWith('<')) {
      return `<p style="margin-bottom: 1rem; line-height: 1.6; color: #334155;">${line}</p>`;
    }
    return line;
  }).join('\n');

  return html;
};

export default function TemplateClient() {
  const router = useRouter();
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('<h1>Executive Summary</h1><p>Sales were extremely strong this month driven by the new Mega Millions run.</p>');
  const [createdById, setCreatedById] = useState('00000000-0000-0000-0000-000000000000'); 
  const [showPreviewPanel, setShowPreviewPanel] = useState(true);

  // Pre-defined template library (Now using HTML for the WYSIWYG editor)
  const templateLibrary = {
    'acfr': {
      name: 'ACFR Management Discussion & Analysis',
      desc: 'Standard MD&A financial summary for the annual comprehensive financial report.',
      content: '<h1>Management Discussion & Analysis (MD&A)</h1><h2>Financial Highlights</h2><p>For the fiscal period, the Lottery achieved remarkable operational success. Total Gross Sales across all product lines reached <span data-type="metric" metricid="m1" label="Gross Sales YTD" value="$850.0M"></span>, representing a significant milestone in our funding mission.</p><h3>Direct Gaming Costs</h3><p>Our commitment to players remains strong, returning <span data-type="metric" metricid="m2" label="Prize Expense YTD" value="$520.0M"></span> in Prize Expense.</p><h3>Operational Efficiency</h3><p>Despite inflationary pressures, the agency maintained strict fiscal discipline. Total Operating Expenses (including Salaries and Advertising) were closely managed to ensure maximum returns.</p><h2>Net Contribution to Benefactors</h2><p>Ultimately, the primary mission of the Lottery is to fund public interests. We are proud to report that the total Transfer Out to the Education Fund for this period was <strong><span data-type="metric" metricid="m3" label="Net Transfer" value="$330.0M"></span></strong>.</p><blockquote><p><strong>Auditor Note:</strong> The figures presented in this MD&A are drawn directly from the audited Trial Balance and are certified accurate.</p></blockquote>'
    },
    'consolidated_financials': {
      name: 'Consolidated Balance Sheet & Revenues Statement',
      desc: '100% pre-built consolidated balance sheet and income statement with dynamic active metrics.',
      content: '<h1>Consolidated Financial Statements</h1><p>Prepared for the period ending June 30, 2024. All amounts are presented in USD.</p><h2>Statement of Revenues, Expenses, and Changes in Net Assets</h2><table style="width: 100%; border-collapse: collapse; margin-top: 1rem; margin-bottom: 2rem; font-size: 13px;"><thead><tr style="background: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left;"><th style="padding: 10px; font-weight: bold; color: #0f172a;">Account Classification</th><th style="padding: 10px; font-weight: bold; color: #0f172a; text-align: right;">Current Period Actuals</th></tr></thead><tbody><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; font-weight: 600; color: #0f172a;">Operating Revenues</td><td style="padding: 10px; text-align: right;"></td></tr><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; padding-left: 20px; color: #475569;">Gross Ticket Sales (HQ)</td><td style="padding: 10px; text-align: right; font-family: monospace;"><span data-type="metric" metricid="m1" label="Gross Sales YTD" value="$850.0M"></span></td></tr><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; padding-left: 20px; color: #475569;">Other Miscellaneous Revenue</td><td style="padding: 10px; text-align: right; font-family: monospace;">$2,450,000</td></tr><tr style="border-bottom: 1px solid #cbd5e1; background: #f8fafc;"><td style="padding: 10px; font-weight: bold; color: #0f172a;">Total Operating Revenues</td><td style="padding: 10px; text-align: right; font-weight: bold; color: #107c41; font-family: monospace;">$852,450,000</td></tr><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; font-weight: 600; color: #0f172a;">Operating Expenses</td><td style="padding: 10px; text-align: right;"></td></tr><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; padding-left: 20px; color: #475569;">Direct Prize Expense</td><td style="padding: 10px; text-align: right; font-family: monospace;"><span data-type="metric" metricid="m2" label="Prize Expense YTD" value="$520.0M"></span></td></tr><tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 10px; padding-left: 20px; color: #475569;">Retailer Commissions</td><td style="padding: 10px; text-align: right; font-family: monospace;">$48,000,000</td></tr><tr style="border-bottom: 1px solid #cbd5e1; background: #f8fafc;"><td style="padding: 10px; font-weight: bold; color: #0f172a;">Total Operating Expenses</td><td style="padding: 10px; text-align: right; font-weight: bold; font-family: monospace;">$568,000,000</td></tr><tr style="border-bottom: 2px solid #cbd5e1; background: #eaf5ea;"><td style="padding: 10px; font-weight: bold; color: #107c41;">Operating Income (Loss)</td><td style="padding: 10px; text-align: right; font-weight: bold; color: #107c41; font-family: monospace;"><span data-type="metric" metricid="m3" label="Net Transfer" value="$284,450,000"></span></td></tr></tbody></table><h2>Management Discussion Annex Commentary</h2><p>Operating income finished the period at <strong>$284,450,000</strong>. Prize payout velocity matched statistical models within standard deviations, yielding stable net operating allocations.</p>'
    },
    'variance': {
      name: 'Monthly Budget Variance Report',
      desc: 'Tracks actuals against planned expenditures with commentary thresholds.',
      content: '<h1>Monthly Budget Variance Report</h1><h2>Revenue Performance</h2><ul><li><strong>Actual Gross Sales:</strong> <span data-type="metric" metricid="m1" label="Gross Sales YTD" value="$850.0M"></span></li><li><em>Budgeted Gross Sales: $850,000,000</em></li><li><strong>Variance:</strong> <span style="color: #ef476f; font-weight: bold;">(NARRATIVE REQUIRED)</span></li></ul><h2>Major Expenditure Categories</h2><h3>1. Prize Expense</h3><ul><li><strong>Actual:</strong> <span data-type="metric" metricid="m2" label="Prize Expense YTD" value="$520.0M"></span></li><li><em>Budget: $550,000,000</em></li></ul><blockquote><p><strong>Policy Trigger:</strong> Any variance exceeding 10% requires the Division Director to complete the narrative explanation blocks above before final approval.</p></blockquote>'
    },
    'operational': {
      name: 'Operational Game Performance',
      desc: 'Game-level tracking for Sales and Marketing teams.',
      content: '<h1>Operational Performance: Game-Level Breakdown</h1><p>This dashboard provides daily operational visibility into specific product performance, bridging the gap between daily sales activities and the monthly financial close.</p><h2>Instant Games Portfolio (Scratchers)</h2><h3>Core Scratchers</h3><ul><li><strong>Gross Sales:</strong> <span data-type="metric" metricid="m4" label="Scratcher Sales" value="$410.5M"></span></li></ul><p><em>Marketing Note: The scratcher portfolio continues to outperform projections due to the recent promotional push.</em></p>'
    }
  };

  const loadTemplate = (key) => {
    if (!key) return;
    const t = templateLibrary[key];
    setName(t.name);
    setDescription(t.desc);
    setContent(t.content);
  };
  
  const [periodDate, setPeriodDate] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [testResultHtml, setTestResultHtml] = useState('');

  // Live preview updates as they type
  const [livePreview, setLivePreview] = useState('');
  useEffect(() => {
    // We no longer use parseMarkdown because content is already HTML from Tiptap
    setLivePreview(content);
    // Clear simulation if user starts typing so they can see live changes
    setTestResultHtml('');
  }, [content]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/reporting/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jurisdictionId, name, description, content, createdById }),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Template saved successfully!');
        window.localStorage.setItem('lastTemplateId', data.template.id);
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error saving template');
    }
  };

  const handleTestGenerate = async () => {
    const templateId = window.localStorage.getItem('lastTemplateId');
    if (!templateId) {
      alert('Please save the template first.');
      return;
    }
    if (!periodDate) {
      alert('Please enter a period date to pull data from.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/reporting/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, periodDateStr: periodDate, createdById }),
      });
      const data = await response.json();
      if (response.ok) {
        // Parse the returned markdown into HTML for the preview
        setTestResultHtml(parseMarkdown(data.snapshot.contentHtml));
      } else {
        alert('Error: ' + data.error);
      }
    } catch (error) {
      alert('Error generating report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--surface-1)', minHeight: '100vh', width: '100%', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      
      {/* GOOGLE DOCS STYLE HEADER */}
      <div style={{
        background: 'var(--card-bg)', borderBottom: '1px solid var(--border)',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text)', margin: 0, letterSpacing: '-0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} style={{ color: '#1a73e8' }} /> Stochos Template Studio
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px', margin: 0 }}>
            Design report structures, map governing metrics, and preview populated data templates.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            type="button"
            onClick={() => setShowPreviewPanel(!showPreviewPanel)} 
            style={{ 
              padding: '8px 16px', 
              background: '#ffffff', 
              color: 'var(--text)', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            {showPreviewPanel ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <EyeOff size={14} /> Collapse Preview
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={14} /> Show Preview
              </span>
            )}
          </button>
          <HelpTrigger topicId="reporting_template" />
          <button 
            type="button"
            onClick={() => router.push('/reporting')} 
            style={{ 
              padding: '8px 16px', 
              background: '#ffffff', 
              color: 'var(--text)', 
              border: '1px solid #cbd5e1', 
              borderRadius: '6px', 
              cursor: 'pointer', 
              fontWeight: '600', 
              fontSize: '13px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseOut={(e) => e.currentTarget.style.background = '#ffffff'}
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      <div style={{ padding: '2rem 3rem', maxWidth: '1800px', margin: '0 auto', display: 'grid', gridTemplateColumns: showPreviewPanel ? '1.1fr 0.9fr' : '1fr', gap: '2.5rem' }}>
        
        {/* LEFT COLUMN: THE WORKSPACE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Template Library Dropdown */}
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <BookOpen size={16} style={{ color: '#475569' }} /> Template Library:
            </span>
            <select 
              onChange={(e) => loadTemplate(e.target.value)}
              style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '6px', outline: 'none', cursor: 'pointer', flex: 1, fontSize: '14px' }}
            >
              <option value="">-- Load an off-the-shelf template --</option>
              <option value="acfr">ACFR Management Discussion & Analysis</option>
              <option value="consolidated_financials">Consolidated Balance Sheet & Revenues Statement</option>
              <option value="variance">Monthly Budget Variance Report</option>
              <option value="operational">Operational Game Performance</option>
            </select>
          </div>

          <form onSubmit={handleSave} style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Jurisdiction ID</label>
                <input type="text" value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)} required placeholder="NY-LOTTERY"
                  style={{ width: '100%', padding: '10px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '8px', outline: 'none', transition: 'border 0.2s', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Template Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Monthly Board Packet"
                  style={{ width: '100%', padding: '10px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '8px', outline: 'none', fontSize: '14px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Report Content</span>
                <span style={{ color: 'var(--text-muted)', textTransform: 'none' }}>Governed Document Editor</span>
              </label>
              <DocumentEditor 
                initialContent={content} 
                onChange={setContent} 
              />
            </div>

            <button type="submit" style={{ padding: '14px', background: 'linear-gradient(135deg, #1a73e8 0%, #1557b0 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(26, 115, 232, 0.15)', transition: 'transform 0.1s' }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Save Template
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: THE HTML DOCUMENT PREVIEW */}
        {showPreviewPanel && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Document Header Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--card-bg)', padding: '16px 24px', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.5px' }}>Simulation Engine</div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input 
                    type="date" 
                    value={periodDate}
                    onChange={(e) => setPeriodDate(e.target.value)}
                    style={{ padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text)', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
                  />
                  <button 
                    type="button"
                    onClick={handleTestGenerate}
                    disabled={isGenerating}
                    style={{ padding: '8px 20px', background: 'var(--green)', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isGenerating ? 'not-allowed' : 'pointer', opacity: isGenerating ? 0.7 : 1, fontSize: '13px' }}
                  >
                    {isGenerating ? 'Connecting...' : 'Populate Live Data'}
                  </button>
                </div>
              </div>
              <div>
                {testResultHtml ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--status-passed-bg)', color: 'var(--status-passed-text)', border: '1px solid var(--status-passed-border)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)' }}></span>
                    Live Data Mode
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--status-warning-bg)', color: 'var(--status-warning-text)', border: '1px solid var(--status-warning-border)', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f97316' }}></span>
                    Template Preview
                  </span>
                )}
              </div>
            </div>

            {/* The Physical Paper Document */}
            <div className="document-page" style={{ 
                background: '#ffffff', 
                borderRadius: '8px', 
                flex: 1,
                padding: '40px 50px', 
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)', 
                border: '1px solid #cbd5e1',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 220px)',
                minHeight: '500px',
                color: 'var(--text)',
                fontFamily: '"Inter", "-apple-system", sans-serif'
              }}>
              
              <div dangerouslySetInnerHTML={{ __html: testResultHtml || livePreview }} />
              
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
