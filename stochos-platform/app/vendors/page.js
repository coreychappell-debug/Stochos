export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../components/AppShell";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: {
      jurisdiction: { select: { abbreviation: true } },
      _count: { select: { contracts: true } },
    },
    orderBy: { name: "asc" },
  });

  const typeLabels = {
    lead_agency: "Lead Agency", media_buyer: "Media Buyer",
    printer: "Printer", specialty: "Specialty", research: "Research",
  };

  return (
    <AppShell>
      <div className="page-header">
        <h2>Vendors</h2>
        <p>Registered vendor organizations and their contract associations</p>
      </div>
      <div className="page-body">
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Type</th>
                <th>Jurisdiction</th>
                <th>Status</th>
                <th>Contracts</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td className="muted">{typeLabels[v.type] || v.type}</td>
                  <td className="muted">{v.jurisdiction?.abbreviation || "Global"}</td>
                  <td><span className={`badge badge-${v.status}`}>{v.status}</span></td>
                  <td>{v._count?.contracts || 0}</td>
                  <td className="muted">{v.contactName || v.contactEmail || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
