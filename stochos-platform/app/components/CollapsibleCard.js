'use client';

import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export default function CollapsibleCard({
  title,
  icon: Icon,
  badge,
  rightElement,
  initialCollapsed = false,
  storageKey,
  children,
  style = {},
  headerStyle = {},
  bodyStyle = {}
}) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [isMounted, setIsMounted] = useState(false);

  // Load persistent state from localStorage if storageKey is provided
  useEffect(() => {
    if (storageKey) {
      const saved = localStorage.getItem(`stochos-card-collapsed-${storageKey}`);
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    }
    setIsMounted(true);
  }, [storageKey]);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    if (storageKey) {
      localStorage.setItem(`stochos-card-collapsed-${storageKey}`, String(nextState));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleCollapse();
    }
  };

  // Prevent flicker during initial render if loading from localStorage
  const displayCollapsed = isMounted ? isCollapsed : initialCollapsed;

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        ...style
      }}
    >
      {/* Clickable Header Bar */}
      <div
        className="card-header"
        role="button"
        tabIndex={0}
        aria-expanded={!displayCollapsed}
        onClick={toggleCollapse}
        onKeyDown={handleKeyDown}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',
          padding: '12px 16px',
          backgroundColor: 'var(--surface-2)',
          borderBottom: displayCollapsed ? 'none' : '1px solid var(--border)',
          outline: 'none',
          transition: 'background-color 0.15s, border-bottom 0.15s',
          ...headerStyle
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--surface-2)';
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = 'inset 0 0 0 2px var(--blue)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
          {/* Chevron rotate indicator */}
          <ChevronDown
            size={16}
            style={{
              transform: displayCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              color: 'var(--text-secondary)',
              flexShrink: 0
            }}
          />
          {Icon && <Icon size={16} style={{ color: 'var(--blue)', flexShrink: 0 }} />}
          {typeof title === 'string' ? (
            <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {title}
            </h3>
          ) : (
            title
          )}
          {badge && <div style={{ flexShrink: 0 }}>{badge}</div>}
        </div>

        {/* Right side content (search, buttons, etc.) */}
        {rightElement && (
          <div
            onClick={(e) => e.stopPropagation()} // Prevent collapse toggling when interacting with actions
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {rightElement}
          </div>
        )}
      </div>

      {/* Card Content Area */}
      <div
        style={{
          display: displayCollapsed ? 'none' : 'block'
        }}
      >
        <div className="card-body" style={{ padding: '20px', ...bodyStyle }}>
          {children}
        </div>
      </div>
    </div>
  );
}
