export const dynamic = 'force-dynamic';

import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "./components/Sidebar";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userName = session?.user?.name || "User";

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

  const marketingModules = [
    {
      href: "/marketing",
      icon: "📢",
      title: "Marketing MRM",
      description: "Multi-channel campaign planning, media placement tracking, and marketing spend attribution.",
      active: true,
    },
    {
      href: "/instant-tickets",
      icon: "🎫",
      title: "Instant Ticket Planning",
      description: "Fiscal year game planning, vendor pricing matrices, and production order management.",
      active: true,
    },
  ];

  const operationsModules = [
    {
      href: "/fomo",
      icon: "🤝",
      title: "Field Operations, Merchandising & Oversight (FOMO)",
      description: "Manage lottery retailer accounts, schedule routes, log store visits, and audit expected versus observed equipment.",
      active: true,
    },
    {
      href: "/contracts",
      icon: "📋",
      title: "Contract Management",
      description: "Track contracts, deliverables, budgets, compliance documents, and approval workflows across all vendors.",
      active: true,
    },
    {
      href: "/vendors",
      icon: "🏢",
      title: "Vendor Registry",
      description: "Manage vendor profiles, certifications, contact information, and contract associations.",
      active: true,
    },
    {
      href: "/products",
      icon: "🎰",
      title: "Product Catalog",
      description: "Browse lottery products and games. Products link to contracts and analytics for cross-module reporting.",
      active: true,
    },
    {
      href: "/fleet",
      icon: "🚗",
      title: "Fleet Management",
      description: "Manage vehicle fleet tracking, lifecycle milestones, maintenance logs, and straight-line depreciation.",
      active: true,
    },
    {
      href: "/spatial-ops",
      icon: "🌐",
      title: "Spatial Operations, Logistics & Risk (SOLR)",
      description: "Monitor active weather/earthquake alerts, analyze retailer risk proximity, and coordinate logistics planning.",
      active: true,
    },
  ];

  const itModules = [
    {
      href: "/assets",
      icon: "💻",
      title: "IT Asset Registry",
      description: "Inventory IT hardware, software licenses, lifecycle boundaries, and straight-line depreciation.",
      active: true,
    },
  ];

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header">
          <h2>Welcome back, {userName}</h2>
          <p>Stochos Lottery Business Platform — Module Dashboard</p>
        </div>

        <div className="page-body">
          {(expiringContracts.length > 0 || expiringDocs.length > 0 || overBudgetItems.length > 0) && (
            <div className="card" style={{ marginBottom: 24, borderLeft: "4px solid var(--gold)" }}>
              <div className="card-header">
                <h3 style={{ color: "var(--gold)" }}>⚠️ Operational Alerts</h3>
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
          <div className="card" style={{ marginBottom: 24, background: "linear-gradient(135deg, var(--card-bg) 0%, var(--surface-3) 100%)", borderLeft: "4px solid var(--blue)" }}>
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>📈 Analytics & Performance Portal</h3>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Executive reporting, retailer performance, SOLR weather and hazard planning, and sales forecasting.</p>
              </div>
              <Link href="/analytics" className="btn btn-primary">
                Open Analytics
              </Link>
            </div>
          </div>

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
              <div className="kpi-value">8</div>
              <div className="kpi-subtitle">Fully integrated systems</div>
            </div>
          </div>

          {/* Grouped Modules */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>📢 Marketing Modules</h3>
              <div className="module-grid">
                {marketingModules.map((mod) => (
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

            <div>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>📋 Operations Modules</h3>
              <div className="module-grid">
                {operationsModules.map((mod) => (
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

            <div>
              <h3 style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 12 }}>💻 Information Technology</h3>
              <div className="module-grid">
                {itModules.map((mod) => (
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
          </div>
        </div>
      </main>
    </div>
  );
}
