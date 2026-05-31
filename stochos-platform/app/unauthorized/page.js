"use client";

import Link from "next/link";
import Sidebar from "../components/Sidebar";

export default function UnauthorizedPage() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="page-header">
          <h2>Security &amp; Access Control</h2>
          <p>Restricted Section</p>
        </div>

        <div className="page-body" style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <div className="card" style={{ maxWidth: "500px", width: "100%", borderLeft: "4px solid var(--red)", background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-1) 100%)", boxShadow: "var(--shadow-elevated)" }}>
            <div className="card-body" style={{ padding: "40px 32px", textAlign: "center" }}>
              <div style={{ fontSize: "64px", marginBottom: "20px", display: "inline-block", filter: "drop-shadow(0 0 10px rgba(239, 71, 111, 0.3))" }}>
                🔒
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text)", marginBottom: "12px" }}>
                Access Denied
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
                You do not have the required role or permissions to access this section of the platform. If you believe this is an error, please contact your administrator to update your account privileges.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px" }}>
                <Link href="/" className="btn btn-primary" style={{ padding: "10px 24px" }}>
                  Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
