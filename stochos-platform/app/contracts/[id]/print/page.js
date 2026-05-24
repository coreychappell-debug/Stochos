import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

function fmt$(val) {
  if (val === null || val === undefined) return "—";
  return "$" + parseFloat(val).toLocaleString("en-US", { minimumFractionDigits: 2 });
}
function fmtDate(d) { 
  if (!d) return "—"; 
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }); 
}

export default async function ContractPrintPage({ params }) {
  const { id } = await params;
  
  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      lineItems: { include: { product: true } },
      amendments: true,
    }
  });
  
  if (!contract) return notFound();

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif", color: "#333" }}>
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #ccc", paddingBottom: "20px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 10px 0", fontSize: "24px" }}>Contract Summary: {contract.title}</h1>
          <div style={{ color: "#555" }}>Vendor: <strong style={{ color: "#000" }}>{contract.vendor?.name}</strong></div>
        </div>
        <div style={{ textAlign: "right", color: "#555", fontSize: "14px" }}>
          <div>Generated: {new Date().toLocaleDateString("en-US")}</div>
          <div style={{ marginTop: "10px" }}>Status: <strong style={{ textTransform: "uppercase", color: "#000" }}>{contract.status.replace("_", " ")}</strong></div>
        </div>
      </div>

      {/* Contract Metadata */}
      <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "5px", marginTop: "30px", color: "#000" }}>Overview</h3>
      <table style={{ width: "100%", marginBottom: "30px", borderCollapse: "collapse", fontSize: "15px" }}>
        <tbody>
          <tr>
            <td style={{ padding: "10px 0", width: "20%", color: "#666" }}>Type</td>
            <td style={{ padding: "10px 0", width: "30%" }}>{contract.type.replace("_", " ")}</td>
            <td style={{ padding: "10px 0", width: "20%", color: "#666" }}>Jurisdiction</td>
            <td style={{ padding: "10px 0", width: "30%" }}>{contract.jurisdiction?.name}</td>
          </tr>
          <tr>
            <td style={{ padding: "10px 0", color: "#666" }}>Start Date</td>
            <td style={{ padding: "10px 0" }}>{fmtDate(contract.startDate)}</td>
            <td style={{ padding: "10px 0", color: "#666" }}>End Date</td>
            <td style={{ padding: "10px 0" }}>{fmtDate(contract.endDate)}</td>
          </tr>
          <tr>
            <td style={{ padding: "10px 0", color: "#666" }}>Total Value</td>
            <td style={{ padding: "10px 0", fontWeight: "bold" }}>{fmt$(contract.totalValue)}</td>
            <td style={{ padding: "10px 0", color: "#666" }}>Budget Cap</td>
            <td style={{ padding: "10px 0" }}>{fmt$(contract.budgetCap)}</td>
          </tr>
        </tbody>
      </table>

      {/* Amendments */}
      {contract.amendments.length > 0 && (
        <div style={{ marginBottom: "30px" }}>
          <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "5px", color: "#000" }}>Amendments</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left", color: "#666" }}>
                <th style={{ padding: "8px 0" }}>#</th>
                <th style={{ padding: "8px 0" }}>Description</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Value Change</th>
                <th style={{ padding: "8px 0", textAlign: "right" }}>Effective</th>
              </tr>
            </thead>
            <tbody>
              {contract.amendments.map(a => (
                <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "8px 0" }}>{a.amendmentNumber}</td>
                  <td style={{ padding: "8px 0" }}>{a.description || "—"}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmt$(a.valueChange)}</td>
                  <td style={{ padding: "8px 0", textAlign: "right" }}>{fmtDate(a.effectiveDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Deliverables */}
      <h3 style={{ borderBottom: "1px solid #eee", paddingBottom: "5px", color: "#000" }}>Line Items / Deliverables</h3>
      {contract.lineItems.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #ccc", textAlign: "left", color: "#666" }}>
              <th style={{ padding: "8px 0" }}>Description</th>
              <th style={{ padding: "8px 0" }}>Product</th>
              <th style={{ padding: "8px 0", textAlign: "right" }}>Budget</th>
              <th style={{ padding: "8px 0", textAlign: "right" }}>Spent</th>
              <th style={{ padding: "8px 0", paddingLeft: "16px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {contract.lineItems.map(li => (
              <tr key={li.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "10px 0" }}>{li.description}</td>
                <td style={{ padding: "10px 0", color: "#666" }}>{li.product?.name || "—"}</td>
                <td style={{ padding: "10px 0", textAlign: "right" }}>{fmt$(li.budgetAmount)}</td>
                <td style={{ padding: "10px 0", textAlign: "right" }}>{fmt$(li.spentAmount)}</td>
                <td style={{ padding: "10px 0", paddingLeft: "16px", textTransform: "capitalize" }}>{li.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#666" }}>No deliverables tracked.</p>
      )}

      {/* Print Trigger */}
      <script dangerouslySetInnerHTML={{ __html: `window.print();` }} />
    </div>
  );
}
