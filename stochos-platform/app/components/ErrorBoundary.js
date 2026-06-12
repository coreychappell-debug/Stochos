"use client";

import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);

    // Report client error to our log handler endpoint
    fetch("/api/logs/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || String(error),
        stack: error.stack || "",
        componentStack: errorInfo.componentStack || "",
        url: window.location.href,
        userAgent: navigator.userAgent
      })
    }).catch(err => console.error("Failed to report client error to server:", err));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "24px",
          margin: "16px",
          border: "1px dashed var(--red, #ef476f)",
          borderRadius: "8px",
          backgroundColor: "rgba(239, 71, 111, 0.04)",
          color: "var(--text, #e0e6ed)",
          fontFamily: "Inter, sans-serif"
        }}>
          <h4 style={{ color: "var(--red, #ef476f)", marginTop: 0, fontWeight: 700, fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={16} /> Visual Component Error
          </h4>
          <p style={{ fontSize: "12.5px", color: "var(--text-secondary, #8899aa)", margin: "8px 0 16px 0", lineHeight: "1.5" }}>
            An unexpected error occurred rendering this section of the platform. The system has automatically recorded the crash details and sent them to the technical administration team.
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ 
              padding: "6px 12px", 
              fontSize: "11px", 
              fontWeight: 600,
              backgroundColor: "var(--surface-3, #1b2838)",
              color: "var(--text, #e0e6ed)",
              border: "1px solid var(--border, #2d3a4a)",
              borderRadius: "4px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <RotateCw size={12} /> Reload Page & Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
