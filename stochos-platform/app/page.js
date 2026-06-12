export const dynamic = 'force-dynamic';

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "./components/Sidebar";
import { Zap, CheckCircle2, AlertTriangle, TrendingUp, Megaphone, Ticket, MapPin, FileText, Building2, Package, Car, Globe, Laptop } from "lucide-react";
import fs from "fs/promises";
import path from "path";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userName = session?.user?.name || "User";

  // Load system settings
  let features = {};
  try {
    const settingsPath = path.join(process.cwd(), "data", "system_settings.json");
    const settingsContent = await fs.readFile(settingsPath, "utf-8");
    features = JSON.parse(settingsContent);
  } catch (err) {
    // defaults to empty (all features enabled)
  }

  const isEnabled = (href) => {
    if (href === "/organization") return features.feature_organization !== false;
    if (href === "/analytics") return features.feature_analytics_overview !== false || features.feature_analytics_retailers !== false || features.feature_analytics_portfolio !== false;
    if (href === "/marketing") return features.feature_marketing !== false;
    if (href === "/instant-tickets") return features.feature_instant_tickets !== false;
    if (href === "/fomo") return features.feature_fomo !== false;
    if (href === "/contracts") return features.feature_contracts !== false;
    if (href === "/vendors") return features.feature_vendors !== false;
    if (href === "/products") return features.feature_products !== false;
    if (href === "/fleet") return features.feature_fleet !== false;
    if (href === "/spatial-ops") return features.feature_spatial_ops !== false;
    if (href === "/assets") return features.feature_assets !== false;
    return true;
  };

  const activeModulesCount = Object.keys(features).length > 0 
    ? Object.values(features).filter(val => val !== false).length 
    : 21;

  // Fetch logged in user details including division and role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  // Fetch summary counts
  const [contractCount, vendorCount, productCount] = await Promise.all([
    prisma.contract.count().catch(() => 0),
    prisma.vendor.count().catch(() => 0),
    prisma.product.count().catch(() => 0),
  ]);

  const activeContracts = await prisma.contract.count({
    where: { status: "active" },
  }).catch(() => 0);

  const now = new Date();
  const sixtyDays = new Date(now); sixtyDays.setDate(now.getDate() + 60);
  const thirtyDays = new Date(now); thirtyDays.setDate(now.getDate() + 30);

  // Operational Alerts
  const expiringContracts = await prisma.contract.findMany({
    where: { endDate: { gte: now, lte: sixtyDays }, status: { notIn: ["completed", "terminated"] } },
    select: { id: true, title: true, endDate: true, vendor: { select: { name: true } } }
  }).catch(() => []);

  const expiringDocs = await prisma.contractCompliance.findMany({
    where: { expirationDate: { gte: now, lte: thirtyDays } },
    select: { id: true, documentType: true, expirationDate: true, contract: { select: { id: true, title: true } } }
  }).catch(() => []);

  const allActiveLineItems = await prisma.contractLineItem.findMany({
    where: { status: { notIn: ["delivered", "closed"] } },
    select: { id: true, description: true, budgetAmount: true, spentAmount: true, contract: { select: { id: true, title: true } } }
  }).catch(() => []);
  
  const overBudgetItems = allActiveLineItems.filter(li => 
    li.budgetAmount && li.spentAmount && Number(li.spentAmount) > Number(li.budgetAmount)
  );

  // Assemble Action Center items
  const actionItems = [];
  const isFinanceOrExec = user?.division === "FINANCE" || user?.division === "EXECUTIVE" || user?.role?.name === "admin";

  if (user) {
    if (isFinanceOrExec) {
      // Fetch submitted proposals awaiting approval
      const submittedProposals = await prisma.budgetProposal.findMany({
        where: { status: "submitted", fiscalYear: 2027 }
      });
      submittedProposals.forEach(p => {
        actionItems.push({
          id: p.id,
          type: "budget_approval",
          title: `Pending Review: ${p.division} Budget Proposal`,
          description: `Division submitted their FY2027 proposal. Verify line items and approve or reject.`,
          link: "/budgeting"
        });
      });
    } else {
      // Fetch division manager's own proposal status
      const myProposal = await prisma.budgetProposal.findFirst({
        where: { division: user.division, fiscalYear: 2027 }
      });

      if (!myProposal || myProposal.status === "draft" || myProposal.status === "rejected") {
        actionItems.push({
          id: myProposal?.id || "new-proposal",
          type: "budget_draft",
          title: `Action Required: Submit ${user.division} Budget Proposal`,
          description: myProposal?.status === "rejected"
            ? `Your proposal was rejected: "${myProposal.notes || 'No comments provided'}" - Please revise and resubmit.`
            : `Create and submit your division's operational budget proposal for FY2027.`,
          link: "/budgeting"
        });
      }
    }

    // Fetch assigned pending approvals (contracts/invoices)
    const pendingApprovals = await prisma.approval.findMany({
      where: { approverId: user.id, status: "pending" }
    });
    pendingApprovals.forEach(a => {
      actionItems.push({
        id: a.id,
        type: "general_approval",
        title: `Approval Required: Pending ${a.entityType.replace(/_/g, " ")}`,
        description: `Approval request assigned to you on ${new Date(a.createdAt).toLocaleDateString()}.`,
        link: a.entityType === "contract" ? `/contracts/${a.entityId}` : "/contracts"
      });
    });

    // Fetch pending commentary tasks for the user's division
    if (user.division) {
      const pendingTasks = await prisma.commentaryTask.findMany({
        where: {
          assignedTo: {
            equals: user.division,
            mode: 'insensitive'
          },
          status: "pending"
        },
        include: {
          rule: true,
          section: true
        }
      }).catch(() => []);

      pendingTasks.forEach(task => {
        let varianceStr = "";
        if (task.metricSnapshot && typeof task.metricSnapshot === 'object') {
          const snap = task.metricSnapshot;
          if (snap.variancePct !== undefined) {
            varianceStr = ` (Variance: ${(snap.variancePct * 100).toFixed(1)}%)`;
          }
        }
        actionItems.push({
          id: task.id,
          type: "commentary_task",
          title: `Commentary Required: ${task.rule?.name || task.ruleCode}${varianceStr}`,
          description: `Variance breach detected for ${task.rule?.name || task.ruleCode}. Narrative justification required in workflow section '${task.section?.name || 'MD&A'}'.`,
          link: "/reporting/workflow"
        });
      });
    }
  }

  const marketingModules = [
    {
      href: "/marketing",
      icon: <Megaphone size={24} style={{ color: "var(--blue)" }} />,
      title: "Marketing MRM",
      description: "Multi-channel campaign planning, media placement tracking, and marketing spend attribution.",
      active: true,
    },
    {
      href: "/instant-tickets",
      icon: <Ticket size={24} style={{ color: "var(--blue)" }} />,
      title: "Instant Ticket Planning",
      description: "Fiscal year game planning, vendor pricing matrices, and production order management.",
      active: true,
    },
  ];

  const operationsModules = [
    {
      href: "/fomo",
      icon: <MapPin size={24} style={{ color: "var(--blue)" }} />,
      title: "Field Operations, Merchandising & Oversight (FOMO)",
      description: "Manage lottery retailer accounts, schedule routes, log store visits, and audit expected versus observed equipment.",
      active: true,
    },
    {
      href: "/contracts",
      icon: <FileText size={24} style={{ color: "var(--blue)" }} />,
      title: "Contract Management",
      description: "Track contracts, deliverables, budgets, compliance documents, and approval workflows across all vendors.",
      active: true,
    },
    {
      href: "/vendors",
      icon: <Building2 size={24} style={{ color: "var(--blue)" }} />,
      title: "Vendor Registry",
      description: "Manage vendor profiles, certifications, contact information, and contract associations.",
      active: true,
    },
    {
      href: "/products",
      icon: <Package size={24} style={{ color: "var(--blue)" }} />,
      title: "Product Catalog",
      description: "Browse lottery products and games. Products link to contracts and analytics for cross-module reporting.",
      active: true,
    },
    {
      href: "/fleet",
      icon: <Car size={24} style={{ color: "var(--blue)" }} />,
      title: "Fleet Management",
      description: "Manage vehicle fleet tracking, lifecycle milestones, maintenance logs, and straight-line depreciation.",
      active: true,
    },
    {
      href: "/spatial-ops",
      icon: <Globe size={24} style={{ color: "var(--blue)" }} />,
      title: "Spatial Operations, Logistics & Risk (SOLR)",
      description: "Monitor active weather/earthquake alerts, analyze retailer risk proximity, and coordinate logistics planning.",
      active: true,
    },
    {
      href: "/assets",
      icon: <Laptop size={24} style={{ color: "var(--blue)" }} />,
      title: "Asset Management",
      description: "Inventory corporate hardware, EOL tracking, lifecycle boundaries, and label printing.",
      active: true,
    },
  ];

  const filteredMarketingModules = marketingModules.filter(m => isEnabled(m.href));
  const filteredOperationsModules = operationsModules.filter(m => isEnabled(m.href));

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h2>Welcome back, {userName}</h2>
          <p>Stochos Lottery Business Platform — Module Dashboard</p>
        </div>

        <div className="page-body">
          {/* Action Center - Gilded task list */}
          <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--gold)" }}>
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "var(--gold)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <Zap size={18} /> My Action Center
              </h3>
              <span className="badge" style={{ backgroundColor: actionItems.length > 0 ? "var(--gold)" : "var(--green)", color: "#fff" }}>
                {actionItems.length} active tasks
              </span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {actionItems.length === 0 ? (
                <div style={{ padding: "12px 0", color: "var(--text-secondary)", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle2 size={16} style={{ color: "var(--green)" }} /> You are all caught up! No pending workflow tasks or approvals.
                </div>
              ) : (
                actionItems.map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", borderRadius: "6px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)" }}>
                    <div>
                      <strong style={{ display: "block", color: "var(--text)", fontSize: 14 }}>{item.title}</strong>
                      <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{item.description}</span>
                    </div>
                    <Link href={item.link} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: 12 }}>
                      View Task
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {(expiringContracts.length > 0 || expiringDocs.length > 0 || overBudgetItems.length > 0) && (
            <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid #ef4444" }}>
              <div className="card-header">
                <h3 style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: 8 }}>
                  <AlertTriangle size={18} /> Operational Alerts
                </h3>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {expiringContracts.map(c => (
                  <div key={`c-${c.id}`} style={{ fontSize: 14 }}>
                    <strong>Contract Expiring Soon:</strong> <Link href={`/contracts/${c.id}`} style={{ color: "var(--primary)" }}>{c.title}</Link> ({c.vendor?.name}) ends on {new Date(c.endDate).toLocaleDateString()}
                  </div>
                ))}
                {expiringDocs.map(d => (
                  <div key={`d-${d.id}`} style={{ fontSize: 14 }}>
                    <strong>Document Expiring Soon:</strong> {d.documentType.replace(/_/g, " ")} for <Link href={`/contracts/${d.contract?.id}`} style={{ color: "var(--primary)" }}>{d.contract?.title}</Link> expires on {new Date(d.expirationDate).toLocaleDateString()}
                  </div>
                ))}
                {overBudgetItems.map(li => (
                  <div key={`li-${li.id}`} style={{ fontSize: 14 }}>
                    <strong>Budget Warning:</strong> Line item &quot;{li.description}&quot; on <Link href={`/contracts/${li.contract?.id}`} style={{ color: "var(--primary)" }}>{li.contract?.title}</Link> is over budget.
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Analytics Highlight Card - Prominently at the top */}
          {isEnabled("/analytics") && (
            <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-3) 100%)", borderLeft: "4px solid var(--blue)" }}>
              <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                    <TrendingUp size={18} style={{ color: "var(--blue)" }} /> Analytics & Performance Portal
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Executive reporting, retailer performance, SOLR weather and hazard planning, and sales forecasting.</p>
                </div>
                <Link href="/analytics" className="btn btn-primary">
                  Open Analytics
                </Link>
              </div>
            </div>
          )}

          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Total Contracts</div>
              <div className="kpi-value">{contractCount}</div>
              <div className="kpi-subtitle">{activeContracts} active</div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Vendors</div>
              <div className="kpi-value">{vendorCount}</div>
              <div className="kpi-subtitle">Registered in platform</div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Products</div>
              <div className="kpi-value">{productCount}</div>
              <div className="kpi-subtitle">Draw + Instant games</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Active Modules</div>
              <div className="kpi-value">{activeModulesCount}</div>
              <div className="kpi-subtitle">Fully integrated systems</div>
            </div>
          </div>

          {/* Grouped Modules */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {filteredMarketingModules.length > 0 && (
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Megaphone size={14} /> Marketing Modules
                </h3>
                <div className="module-grid">
                  {filteredMarketingModules.map((mod) => (
                    <Link
                      key={mod.title}
                      href={mod.active ? mod.href : "#"}
                      className={`module-card ${!mod.active ? "disabled" : ""}`}
                    >
                      <div className="module-card-icon">{mod.icon}</div>
                      <h3>{mod.title}</h3>
                      <p>{mod.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {filteredOperationsModules.length > 0 && (
              <div>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={14} /> Operations Modules
                </h3>
                <div className="module-grid">
                  {filteredOperationsModules.map((mod) => (
                    <Link
                      key={mod.title}
                      href={mod.active ? mod.href : "#"}
                      className={`module-card ${!mod.active ? "disabled" : ""}`}
                    >
                      <div className="module-card-icon">{mod.icon}</div>
                      <h3>{mod.title}</h3>
                      <p>{mod.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}


          </div>
        </div>
      </main>
    </div>
  );
}
