"use client";

import Link from "next/link";
import Sidebar from "./Sidebar";
import { Lock } from "lucide-react";
import { useSession } from "next-auth/react";

export default function FeatureBlocker({ moduleName }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <div className="page-header">
          <h2>Module Unavailable</h2>
          <p>Licensing &amp; Access Control</p>
        </div>

        <div className="page-body" style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "40px" }}>
          <div className="card" style={{ maxWidth: "500px", width: "100%", borderLeft: "4px solid var(--gold)", background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-1) 100%)", boxShadow: "var(--shadow-elevated)", borderRadius: "12px", overflow: "hidden" }}>
            <div className="card-body" style={{ padding: "40px 32px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", justifyContent: "center", marginBottom: "20px", filter: "drop-shadow(0 0 12px rgba(217, 119, 6, 0.25))" }}>
                <Lock size={64} style={{ color: "var(--gold)" }} />
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text)", marginBottom: "12px" }}>
                Module Not Enabled
              </h3>
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", marginBottom: "28px" }}>
                The <strong>{moduleName}</strong> module is currently not enabled under your Stochos platform license configuration. If this tool is required for your operations, please contact your systems administrator or account representative.
              </p>
              <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
                <Link href="/" className="btn btn-primary" style={{ padding: "10px 24px" }}>
                  Return to Dashboard
                </Link>
                {isAdmin && (
                  <Link href="/admin/settings" className="btn btn-secondary" style={{ padding: "10px 24px" }}>
                    Manage Features
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
