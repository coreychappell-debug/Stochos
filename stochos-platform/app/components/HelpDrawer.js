'use client';

import { useState, useEffect } from 'react';
import { guides } from '../lib/guidesData';
import { X, ExternalLink, BookOpen, CheckSquare, Lightbulb, FileText, AlertTriangle, FileSpreadsheet, Briefcase, Handshake, Globe, Car, Megaphone, Ticket, Layers, Pin, UploadCloud, Grid, Settings, Shield, GitBranch, Calendar, Sliders, FileCheck } from 'lucide-react';

const getGuideIcon = (id, size = 16) => {
  switch (id) {
    case 'welcome':
      return <BookOpen size={size} style={{ color: 'var(--blue)' }} />;
    case 'gfpa':
      return <FileSpreadsheet size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_upload':
      return <UploadCloud size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_grid':
      return <Grid size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_prep':
      return <Settings size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_rules':
      return <Shield size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_template':
      return <FileText size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_workflow':
      return <GitBranch size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_calendar':
      return <Calendar size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_registry':
      return <Sliders size={size} style={{ color: 'var(--blue)' }} />;
    case 'reporting_gasb34':
      return <FileCheck size={size} style={{ color: 'var(--blue)' }} />;
    case 'budget':
      return <Briefcase size={size} style={{ color: 'var(--blue)' }} />;
    case 'fomo':
      return <Handshake size={size} style={{ color: 'var(--blue)' }} />;
    case 'solr':
      return <Globe size={size} style={{ color: 'var(--blue)' }} />;
    case 'contracts':
      return <FileText size={size} style={{ color: 'var(--blue)' }} />;
    case 'fleet':
      return <Car size={size} style={{ color: 'var(--blue)' }} />;
    case 'marketing':
      return <Megaphone size={size} style={{ color: 'var(--blue)' }} />;
    case 'tickets':
      return <Ticket size={size} style={{ color: 'var(--blue)' }} />;
    case 'products':
      return <Layers size={size} style={{ color: 'var(--blue)' }} />;
    case 'auditor_playbook':
      return <FileSpreadsheet size={size} style={{ color: 'var(--blue)' }} />;
    case 'bureau_chief_playbook':
      return <Briefcase size={size} style={{ color: 'var(--blue)' }} />;
    case 'division_lead_playbook':
      return <Layers size={size} style={{ color: 'var(--blue)' }} />;
    case 'sales_rep_playbook':
      return <Car size={size} style={{ color: 'var(--blue)' }} />;
    default:
      return <BookOpen size={size} style={{ color: 'var(--blue)' }} />;
  }
};

export default function HelpDrawer({ topicId, isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [mounted, setMounted] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  // Sync isPinned with localStorage
  useEffect(() => {
    const pinned = localStorage.getItem('stochos-help-pinned') === 'true';
    setIsPinned(pinned);
  }, []);

  // Auto-collapse pinned mode on small viewports
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsPinned(false);
        localStorage.setItem('stochos-help-pinned', 'false');
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update layout offsets and trigger redrawing of maps/elements on pin changes
  useEffect(() => {
    if (isPinned && isOpen) {
      document.body.style.setProperty('--help-dock-offset', '450px');
    } else {
      document.body.style.setProperty('--help-dock-offset', '0px');
    }
    window.dispatchEvent(new Event('layout-resize'));

    return () => {
      document.body.style.setProperty('--help-dock-offset', '0px');
      window.dispatchEvent(new Event('layout-resize'));
    };
  }, [isPinned, isOpen]);

  // Handle mounting and scrolling limits
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      if (!isPinned) {
        document.body.style.overflow = 'hidden'; // Lock background scrolling
      } else {
        document.body.style.overflow = '';
      }
    } else {
      const timer = setTimeout(() => setMounted(false), 200);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen, isPinned]);

  if (!isOpen && !mounted) return null;

  const guide = guides.find(g => g.id === topicId);
  if (!guide) return null;

  const handlePinToggle = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    localStorage.setItem('stochos-help-pinned', nextPinned ? 'true' : 'false');
  };

  const handleClose = () => {
    setIsPinned(false);
    localStorage.setItem('stochos-help-pinned', 'false');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: isOpen ? (isPinned ? 'none' : 'auto') : 'none',
      }}
    >
      {/* Semi-transparent Backdrop with Blur */}
      {!isPinned && (
        <div
          onClick={handleClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(4px)',
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        />
      )}

      {/* Sliding Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isPinned ? '450px' : '520px',
          height: '100%',
          backgroundColor: 'var(--card-bg)',
          borderLeft: '1px solid var(--border)',
          boxShadow: 'var(--shadow-elevated)',
          display: 'flex',
          flexDirection: 'column',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), max-width 0.2s ease',
          color: 'var(--text)',
          pointerEvents: 'auto',
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: 'var(--surface-3)',
                  color: 'var(--blue)',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  fontWeight: '700',
                  letterSpacing: '0.5px',
                }}
              >
                {guide.category} Manual
              </span>
              <h3 style={{ margin: '6px 0 0 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getGuideIcon(guide.id, 18)} {guide.title}
              </h3>
            </div>
            
            {/* Header Control Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handlePinToggle}
                title={isPinned ? "Unpin from side" : "Pin to side"}
                style={{
                  background: isPinned ? 'var(--blue-dim)' : 'var(--surface-3)',
                  border: isPinned ? '1px solid var(--blue)' : '1px solid var(--border)',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isPinned ? 'var(--blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.color = 'var(--text)';
                    e.currentTarget.style.background = 'var(--border)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isPinned) {
                    e.currentTarget.style.color = 'var(--text-secondary)';
                    e.currentTarget.style.background = 'var(--surface-3)';
                  }
                }}
              >
                <Pin size={14} style={{ transform: isPinned ? 'rotate(45deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              <button
                onClick={handleClose}
                style={{
                  background: 'var(--surface-3)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = 'var(--text)';
                  e.currentTarget.style.background = 'var(--border)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--surface-3)';
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
            {guide.summary}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '0 24px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--navy)',
            gap: '4px',
          }}
        >
          {[
            { id: 'overview', label: 'Overview', icon: <FileText size={14} /> },
            { id: 'steps', label: 'Checklist', icon: <CheckSquare size={14} /> },
            { id: 'examples', label: 'Examples & Tips', icon: <Lightbulb size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '600',
                border: 'none',
                background: 'transparent',
                color: activeTab === tab.id ? 'var(--blue)' : 'var(--text-secondary)',
                borderBottom: activeTab === tab.id ? '2px solid var(--blue)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Scroll Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeTab === 'overview' && (
            <div style={{ fontSize: '14px', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0 }}>{guide.content.overview}</p>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--blue-dim)',
                  borderLeft: '4px solid var(--blue)',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '13px',
                }}
              >
                <div style={{ fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <BookOpen size={14} /> Standard Operating Procedures (SOP)
                </div>
                This guide documents verified administrative rules and calculations mapping to New York Lottery legislative guidelines.
              </div>
            </div>
          )}

          {activeTab === 'steps' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                System Checklist:
              </h4>
              <ol style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13.5px', lineHeight: '1.5' }}>
                {guide.content.steps.map((step, idx) => {
                  const parts = step.split(':');
                  const title = parts[0];
                  const desc = parts.slice(1).join(':');
                  return (
                    <li key={idx} style={{ paddingLeft: '4px' }}>
                      <strong style={{ color: 'var(--text)' }}>{title}</strong>
                      {desc}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {activeTab === 'examples' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--green-dim)',
                  border: '1px solid var(--status-passed-border)',
                  borderRadius: '8px',
                }}
              >
                <h4 style={{ margin: '0 0 6px 0', color: 'var(--green)', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lightbulb size={16} /> Practical Example
                </h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{guide.content.examples}</p>
              </div>

              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--gold-dim)',
                  border: '1px solid var(--status-warning-border)',
                  borderRadius: '8px',
                }}
              >
                <h4 style={{ margin: '0 0 6px 0', color: 'var(--gold)', fontSize: '13px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Operational Tip
                </h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>{guide.content.tips}</p>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            backgroundColor: 'var(--navy)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <a
            href={`/help?topic=${guide.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'var(--blue)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'background 0.15s',
              boxShadow: 'var(--blue-glow)',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = '#0096b4')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'var(--blue)')}
          >
            Open Full Help Center <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
