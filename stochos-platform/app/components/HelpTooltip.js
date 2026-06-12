'use client';

import { useState } from 'react';

export default function HelpTooltip({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span 
      style={{ 
        position: 'relative', 
        display: 'inline-flex', 
        alignItems: 'center', 
        marginLeft: '6px', 
        verticalAlign: 'middle' 
      }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      <button
        type="button"
        aria-label={`Help: ${text}`}
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--surface-3)',
          color: 'var(--text-secondary)',
          fontSize: '10px',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'help',
          padding: 0,
          outline: 'none',
          transition: 'all 0.15s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = 'var(--text)';
          e.currentTarget.style.borderColor = 'var(--blue)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
      >
        ?
      </button>

      {visible && (
        <span 
          style={{
            position: 'absolute',
            bottom: '22px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            color: '#ffffff',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            lineHeight: '1.4',
            whiteSpace: 'normal',
            width: '200px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            zIndex: 99999,
            pointerEvents: 'none',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
