export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import AppShell from "../../components/AppShell";
import EditVendorForm from "./EditVendorForm";

export default async function VendorDetailPage({ params }) {
  const { id } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      jurisdiction: true,
      contracts: { select: { id: true, title: true, status: true, totalValue: true } },
      campaigns: { select: { id: true, name: true, status: true } },
    },
  });

  if (!vendor) notFound();

  const jurisdictions = await prisma.jurisdiction.findMany({
    select: { id: true, name: true, abbreviation: true },
    where: { status: "active" },
    orderBy: { name: "asc" },
  });

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "vendor", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <AppShell>
      <div className="page-header">
        <h2>{vendor.name}</h2>
        <p>Edit vendor profile, classification status, and associated resources</p>
      </div>
      <div className="page-body">
        <EditVendorForm
          vendor={JSON.parse(JSON.stringify(vendor))}
          jurisdictions={JSON.parse(JSON.stringify(jurisdictions))}
          auditLog={JSON.parse(JSON.stringify(auditLog))}
        />
      </div>
    </AppShell>
  );
}
