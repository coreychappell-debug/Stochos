import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  planning: "Planning",
  briefed: "Briefed",
  in_production: "In Production",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function MarketingPage({ searchParams }) {
  const session = await auth();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const statusFilter = resolvedParams?.status || "all";

  const where = {};
  if (statusFilter !== "all") where.status = statusFilter;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      vendor: { select: { name: true } },
      jurisdiction: { select: { name: true } },
      _count: { select: { channels: true, assets: true, milestones: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const activeCount = await prisma.campaign.count({ where: { status: { in: ["live", "in_production"] } } });
  const planningCount = await prisma.campaign.count({ where: { status: { in: ["planning", "briefed"] } } });

  function fmt$(val) {
    if (val === null || val === undefined) return "—";
    const num = parseFloat(val);
    return isNaN(num) ? "—" : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header flex justify-between items-center">
          <div>
            <h2>Marketing MRM</h2>
            <p>Campaign planning, channels, and creative asset tracking.</p>
          </div>
          <Link href="/marketing/new" className="btn btn-primary">+ New Campaign</Link>
        </div>

        <div className="page-body">
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Active Campaigns</div>
              <div className="kpi-value">{activeCount}</div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">In Planning</div>
              <div className="kpi-value">{planningCount}</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Total Tracked</div>
              <div className="kpi-value">{campaigns.length}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3>Campaign Portfolio</h3>
              <div className="flex gap-2">
                <Link href="/marketing?status=all" className={`btn btn-sm ${statusFilter === "all" ? "btn-primary" : "btn-secondary"}`}>All</Link>
                <Link href="/marketing?status=live" className={`btn btn-sm ${statusFilter === "live" ? "btn-primary" : "btn-secondary"}`}>Live</Link>
                <Link href="/marketing?status=planning" className={`btn btn-sm ${statusFilter === "planning" ? "btn-primary" : "btn-secondary"}`}>Planning</Link>
              </div>
            </div>
            <div className="card-body">
              {campaigns.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📢</div>
                  <h3>No campaigns found</h3>
                  <p>Get started by planning a new marketing campaign.</p>
                  <Link href="/marketing/new" className="btn btn-primary mt-4">Create Campaign</Link>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Agency (Vendor)</th>
                      <th>Type</th>
                      <th>Budget</th>
                      <th>Dates</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>
                          <Link href={`/marketing/${c.id}`} style={{ color: "var(--primary)", textDecoration: "none" }}>{c.name}</Link>
                          <div className="kpi-subtitle" style={{ marginTop: 2 }}>{c._count.channels} channels · {c._count.assets} assets</div>
                        </td>
                        <td className="muted">{c.vendor?.name || "—"}</td>
                        <td className="muted" style={{ textTransform: "capitalize" }}>{c.campaignType?.replace(/_/g, " ") || "—"}</td>
                        <td>{fmt$(c.totalBudget)}</td>
                        <td className="muted" style={{ fontSize: 13 }}>{fmtDate(c.startDate)}<br/>{fmtDate(c.endDate)}</td>
                        <td>
                          <span className={`badge badge-${c.status === "live" ? "active" : c.status === "completed" ? "completed" : "submitted"}`}>
                            {STATUS_LABELS[c.status] || c.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
