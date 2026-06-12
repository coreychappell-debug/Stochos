import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";
import HelpTrigger from "@/app/components/HelpTrigger";
import { Ticket } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function InstantTicketsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const plans = await prisma.instantTicketPlan.findMany({
    where: { status: { not: "archived" } },
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      scenarios: {
        include: {
          _count: { select: { games: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Compute aggregates
  const enrichedPlans = [];
  for (const plan of plans) {
    const scenarioIds = plan.scenarios.map((s) => s.id);
    let totalGames = 0;
    let totalUnits = BigInt(0);

    if (scenarioIds.length > 0) {
      const agg = await prisma.instantTicketGame.aggregate({
        where: { scenarioId: scenarioIds[0] }, // Base scenario only for summary
        _count: true,
        _sum: { units: true },
      });
      totalGames = agg._count;
      totalUnits = agg._sum.units || BigInt(0);
    }

    enrichedPlans.push({ ...plan, totalGames, totalUnits });
  }

  const activePlans = enrichedPlans.filter((p) => p.status === "approved" || p.status === "submitted");
  const draftPlans = enrichedPlans.filter((p) => p.status === "draft");

  function fmt$(val) {
    if (!val) return "—";
    const num = parseFloat(val);
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(1) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(0) + "M";
    return "$" + num.toLocaleString("en-US");
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(0) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toLocaleString("en-US");
  }

  const STATUS_STYLES = {
    draft: "badge-submitted",
    submitted: "badge-submitted",
    approved: "badge-active",
    archived: "badge-completed",
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="page-header flex justify-between items-center">
          <div>
            <h2>Instant Ticket Planner</h2>
            <p>Fiscal year game portfolio planning, vendor allocation, and procurement tracking.</p>
          </div>
          <div>
            <HelpTrigger topicId="tickets" />
          </div>
        </div>

        <div className="page-body">
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Active Plans</div>
              <div className="kpi-value">{activePlans.length}</div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Drafts</div>
              <div className="kpi-value">{draftPlans.length}</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Total Plans</div>
              <div className="kpi-value">{enrichedPlans.length}</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex justify-between items-center">
              <h3>Game Plans</h3>
            </div>
            <div className="card-body">
              {enrichedPlans.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
                    <Ticket size={48} style={{ strokeWidth: 1.5, color: "var(--text-muted)" }} />
                  </div>
                  <h3>No plans found</h3>
                  <p>Create your first instant ticket fiscal year plan.</p>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Plan Name</th>
                      <th>Jurisdiction</th>
                      <th>FY</th>
                      <th>Sales Target</th>
                      <th>Games</th>
                      <th>Total Units</th>
                      <th>Scenarios</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrichedPlans.map((plan) => (
                      <tr key={plan.id}>
                        <td style={{ fontWeight: 500 }}>
                          <Link
                            href={`/instant-tickets/${plan.id}`}
                            style={{ color: "var(--primary)", textDecoration: "none" }}
                          >
                            {plan.name}
                          </Link>
                        </td>
                        <td className="muted">{plan.jurisdiction.abbreviation}</td>
                        <td>{plan.fiscalYear}</td>
                        <td>{fmt$(plan.totalSalesTarget)}</td>
                        <td>{plan.totalGames}</td>
                        <td>{fmtUnits(plan.totalUnits)}</td>
                        <td className="muted">{plan.scenarios.length}</td>
                        <td>
                          <span className={`badge ${STATUS_STYLES[plan.status] || "badge-submitted"}`}>
                            {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
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
