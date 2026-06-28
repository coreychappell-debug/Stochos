import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

function fmt$(val) {
  if (val === null || val === undefined) return "—";
  const num = parseFloat(val);
  return isNaN(num) ? "—" : "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) { 
  if (!d) return "—"; 
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); 
}

export default async function CampaignPrintPage({ params }) {
  const { id } = await params;
  
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      contract: true,
      products: true,
      createdBy: { select: { name: true } },
      channels: { orderBy: { createdAt: "desc" } },
      assets: { orderBy: { createdAt: "desc" } },
      milestones: { orderBy: { dueDate: "asc" } }
    }
  });
  
  if (!campaign) return notFound();

  // Status mapping
  const STATUS_LABELS = {
    planning: "Planning",
    briefed: "Briefed",
    in_production: "In Production",
    live: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const totalBudget = parseFloat(campaign.totalBudget) || 0;
  const plannedSpend = campaign.channels.reduce((sum, ch) => sum + (parseFloat(ch.plannedSpend) || 0), 0);
  const actualSpend = campaign.channels.reduce((sum, ch) => sum + (parseFloat(ch.actualSpend) || 0), 0);

  return (
    <div style={{ padding: "40px", maxWidth: "850px", margin: "0 auto", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1e293b", backgroundColor: "#fff" }}>
      {/* Print Specific CSS */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: #fff;
            color: #1e293b;
          }
          .no-print {
            display: none !important;
          }
          tr {
            page-break-inside: avoid;
          }
          h3 {
            page-break-after: avoid;
          }
        }
      `}} />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "3px solid #16422b", paddingBottom: "20px", marginBottom: "25px" }}>
        <div>
          <span style={{ fontSize: "11px", fontWeight: "800", color: "#fed103", textTransform: "uppercase", letterSpacing: "1px", backgroundColor: "#0c2a1b", padding: "3px 8px", borderRadius: "3px", marginRight: "8px" }}>Stochos Platform</span>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Campaign Summary Packet</span>
          <h1 style={{ margin: "10px 0 5px 0", fontSize: "26px", color: "#0c2a1b", fontWeight: "800" }}>{campaign.name}</h1>
          <div style={{ fontSize: "14px", color: "#475569" }}>
            Jurisdiction: <strong style={{ color: "#0f172a" }}>{campaign.jurisdiction?.name || "—"}</strong>
          </div>
        </div>
        <div style={{ textAlign: "right", color: "#64748b", fontSize: "13px" }}>
          <div>Generated: {new Date().toLocaleDateString("en-US")}</div>
          <div style={{ marginTop: "12px" }}>
            Status: <span style={{ textTransform: "uppercase", color: "#fff", backgroundColor: campaign.status === "live" ? "#00a651" : "#475569", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: "700", letterSpacing: "0.5px" }}>{STATUS_LABELS[campaign.status] || campaign.status}</span>
          </div>
        </div>
      </div>

      {/* Campaign Metadata */}
      <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginTop: "20px", color: "#0c2a1b", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Overview</h3>
      <table style={{ width: "100%", marginBottom: "25px", borderCollapse: "collapse", fontSize: "14px" }}>
        <tbody>
          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "8px 0", width: "20%", color: "#64748b", fontWeight: "500" }}>Campaign Type</td>
            <td style={{ padding: "8px 0", width: "30%", color: "#0f172a", textTransform: "capitalize" }}>{campaign.campaignType?.replace(/_/g, " ") || "—"}</td>
            <td style={{ padding: "8px 0", width: "20%", color: "#64748b", fontWeight: "500" }}>Primary Vendor</td>
            <td style={{ padding: "8px 0", width: "30%", color: "#0f172a" }}>{campaign.vendor?.name || "—"}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "8px 0", color: "#64748b", fontWeight: "500" }}>Start Date</td>
            <td style={{ padding: "8px 0", color: "#0f172a" }}>{fmtDate(campaign.startDate)}</td>
            <td style={{ padding: "8px 0", color: "#64748b", fontWeight: "500" }}>End Date</td>
            <td style={{ padding: "8px 0", color: "#0f172a" }}>{fmtDate(campaign.endDate)}</td>
          </tr>
          <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
            <td style={{ padding: "8px 0", color: "#64748b", fontWeight: "500" }}>Total Budget</td>
            <td style={{ padding: "8px 0", color: "#0c2a1b", fontWeight: "700" }}>{fmt$(totalBudget)}</td>
            <td style={{ padding: "8px 0", color: "#64748b", fontWeight: "500" }}>Linked Contract</td>
            <td style={{ padding: "8px 0", color: "#0f172a" }}>{campaign.contract?.title || "None"}</td>
          </tr>
        </tbody>
      </table>

      {/* Objective */}
      <div style={{ marginBottom: "25px", padding: "12px 15px", backgroundColor: "#f8fafc", borderRadius: "6px", borderLeft: "4px solid #16422b" }}>
        <h4 style={{ margin: "0 0 5px 0", fontSize: "13px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Campaign Objective</h4>
        <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.5" }}>{campaign.objective || "No objective documented."}</p>
      </div>

      {/* Financial Summary */}
      <table style={{ width: "100%", marginBottom: "30px", borderCollapse: "collapse", fontSize: "13px", textAlign: "center" }}>
        <thead>
          <tr style={{ backgroundColor: "#f8fafc" }}>
            <th style={{ padding: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>Campaign Budget</th>
            <th style={{ padding: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>Planned Spend</th>
            <th style={{ padding: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>Actual Spend</th>
            <th style={{ padding: "10px", border: "1px solid #e2e8f0", color: "#64748b" }}>Remaining Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: "12px 10px", border: "1px solid #e2e8f0", fontSize: "15px", fontWeight: "600" }}>{fmt$(totalBudget)}</td>
            <td style={{ padding: "12px 10px", border: "1px solid #e2e8f0", fontSize: "15px", fontWeight: "600" }}>{fmt$(plannedSpend)}</td>
            <td style={{ padding: "12px 10px", border: "1px solid #e2e8f0", fontSize: "15px", fontWeight: "600", color: actualSpend > plannedSpend ? "#b91c1c" : "#0f172a" }}>{fmt$(actualSpend)}</td>
            <td style={{ padding: "12px 10px", border: "1px solid #e2e8f0", fontSize: "15px", fontWeight: "700", color: (totalBudget - actualSpend) < 0 ? "#b91c1c" : "#0f766e" }}>{fmt$(totalBudget - actualSpend)}</td>
          </tr>
        </tbody>
      </table>

      {/* Linked Products */}
      <div style={{ marginBottom: "25px" }}>
        <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Linked Products</h4>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {campaign.products.length > 0 ? (
            campaign.products.map(p => (
              <span key={p.id} style={{ padding: "3px 8px", backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "12px", color: "#334155" }}>
                {p.name}
              </span>
            ))
          ) : (
            <span style={{ fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>No products linked.</span>
          )}
        </div>
      </div>

      {/* Channel Allocations */}
      <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginTop: "30px", color: "#0c2a1b", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Channel Allocations</h3>
      {campaign.channels.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "30px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", color: "#64748b", backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "8px 10px" }}>Channel Type</th>
              <th style={{ padding: "8px 10px" }}>Flighting</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Planned Spend</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Actual Spend</th>
              <th style={{ padding: "8px 10px", textAlign: "right" }}>Variance</th>
              <th style={{ padding: "8px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaign.channels.map(ch => {
              const variance = (parseFloat(ch.plannedSpend) || 0) - (parseFloat(ch.actualSpend) || 0);
              return (
                <tr key={ch.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "10px", fontWeight: "600", textTransform: "capitalize" }}>{ch.channel.replace(/_/g, " ")}</td>
                  <td style={{ padding: "10px", color: "#475569" }}>{fmtDate(ch.startDate)} - {fmtDate(ch.endDate)}</td>
                  <td style={{ padding: "10px", textAlign: "right" }}>{fmt$(ch.plannedSpend)}</td>
                  <td style={{ padding: "10px", textAlign: "right", color: parseFloat(ch.actualSpend) > parseFloat(ch.plannedSpend) ? "#b91c1c" : "inherit" }}>{fmt$(ch.actualSpend)}</td>
                  <td style={{ padding: "10px", textAlign: "right", fontWeight: "500", color: variance < 0 ? "#b91c1c" : "#0f766e" }}>{fmt$(variance)}</td>
                  <td style={{ padding: "10px", textTransform: "capitalize", fontSize: "12px", fontWeight: "500" }}>{ch.status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "14px", marginBottom: "30px" }}>No channels allocated.</p>
      )}

      {/* Creative Assets */}
      <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginTop: "30px", color: "#0c2a1b", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Creative Assets</h3>
      {campaign.assets.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "30px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", color: "#64748b", backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "8px 10px" }}>Asset Name</th>
              <th style={{ padding: "8px 10px" }}>Type</th>
              <th style={{ padding: "8px 10px" }}>Specs / Lang</th>
              <th style={{ padding: "8px 10px" }}>Review Owner</th>
              <th style={{ padding: "8px 10px" }}>Approval Status</th>
              <th style={{ padding: "8px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaign.assets.map(asset => (
              <tr key={asset.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px", fontWeight: "600" }}>{asset.name} <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "normal" }}>({asset.version})</span></td>
                <td style={{ padding: "10px", textTransform: "capitalize" }}>{asset.assetType.replace(/_/g, " ")}</td>
                <td style={{ padding: "10px", color: "#475569" }}>{asset.formatSpecs || "—"} · {asset.language || "—"}</td>
                <td style={{ padding: "10px" }}>{asset.reviewOwner || "—"}</td>
                <td style={{ padding: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: asset.approvalStatus === "approved" ? "#0f766e" : asset.approvalStatus === "rejected" ? "#b91c1c" : "#b45309" }}>
                    {asset.approvalStatus ? asset.approvalStatus.replace(/_/g, " ").toUpperCase() : "NOT SUBMITTED"}
                  </span>
                </td>
                <td style={{ padding: "10px", textTransform: "capitalize", fontSize: "12px", fontWeight: "500" }}>{asset.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "14px", marginBottom: "30px" }}>No creative assets tracking.</p>
      )}

      {/* Milestones */}
      <h3 style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "6px", marginTop: "30px", color: "#0c2a1b", fontSize: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Milestones & Timeline</h3>
      {campaign.milestones.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "30px" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #cbd5e1", textAlign: "left", color: "#64748b", backgroundColor: "#f8fafc" }}>
              <th style={{ padding: "8px 10px" }}>Milestone</th>
              <th style={{ padding: "8px 10px" }}>Type</th>
              <th style={{ padding: "8px 10px" }}>Owner</th>
              <th style={{ padding: "8px 10px" }}>Due Date</th>
              <th style={{ padding: "8px 10px" }}>Completed</th>
              <th style={{ padding: "8px 10px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {campaign.milestones.map(m => {
              const isOverdue = m.dueDate && new Date(m.dueDate) < new Date() && m.status !== "completed" && m.status !== "cancelled";
              return (
                <tr key={m.id} style={{ borderBottom: "1px solid #e2e8f0", backgroundColor: isOverdue ? "#fff5f5" : "transparent" }}>
                  <td style={{ padding: "10px", fontWeight: "600" }}>
                    {m.name}
                    {m.priority === "critical" && <span style={{ marginLeft: "6px", fontSize: "10px", color: "#b91c1c", backgroundColor: "#fee2e2", padding: "2px 5px", borderRadius: "3px", fontWeight: "700" }}>CRITICAL</span>}
                  </td>
                  <td style={{ padding: "10px", textTransform: "capitalize" }}>{m.milestoneType.replace(/_/g, " ")}</td>
                  <td style={{ padding: "10px" }}>{m.owner || "—"}</td>
                  <td style={{ padding: "10px", color: isOverdue ? "#b91c1c" : "#0f766e", fontWeight: isOverdue ? "600" : "normal" }}>
                    {fmtDate(m.dueDate)}
                    {isOverdue && <span style={{ display: "block", fontSize: "10px", fontWeight: "bold" }}>OVERDUE</span>}
                  </td>
                  <td style={{ padding: "10px" }}>{fmtDate(m.completedDate)}</td>
                  <td style={{ padding: "10px", textTransform: "capitalize", fontSize: "12px", fontWeight: "600", color: m.status === "completed" ? "#0f766e" : m.status === "blocked" ? "#b91c1c" : "inherit" }}>
                    {m.status.replace(/_/g, " ")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "14px", marginBottom: "30px" }}>No milestones tracked.</p>
      )}

      {/* Internal Notes */}
      {campaign.notes && (
        <div style={{ marginTop: "30px", padding: "15px", border: "1px solid #cbd5e1", borderRadius: "6px", fontSize: "13px" }}>
          <h4 style={{ margin: "0 0 8px 0", color: "#0c2a1b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Additional Internal Notes</h4>
          <p style={{ margin: 0, color: "#334155", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>{campaign.notes}</p>
        </div>
      )}

      {/* Footer / Sign-off block */}
      <div style={{ marginTop: "50px", borderTop: "1.5px solid #cbd5e1", paddingTop: "20px", display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}>
        <div>
          <div>Prepared By: {campaign.createdBy?.name || "System User"}</div>
          <div>Authorized By: ___________________________</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div>Date Authorized: ____ / ____ / ________</div>
          <div style={{ marginTop: "4px", fontSize: "10px" }}>STOCHOS PLATFORM · SYSTEM OF RECORD</div>
        </div>
      </div>

      {/* Print Trigger */}
      <script dangerouslySetInnerHTML={{ __html: `
        setTimeout(() => {
          window.print();
        }, 800);
      ` }} />
    </div>
  );
}
