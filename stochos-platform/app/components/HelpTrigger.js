'use client';

import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';
import HelpDrawer from './HelpDrawer';

export default function HelpTrigger({ topicId }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const pinned = localStorage.getItem('stochos-help-pinned') === 'true';
    if (pinned) {
      setIsOpen(true);
    }
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: "8px 16px",
          background: "var(--surface-3)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          color: "var(--text)",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "13px",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          transition: "all 0.15s"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "var(--border)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "var(--surface-3)";
        }}
      >
        <BookOpen size={16} /> Help & Guide
      </button>

      <HelpDrawer
        topicId={topicId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
