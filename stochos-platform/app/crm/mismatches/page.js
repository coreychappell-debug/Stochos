export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import CrmMismatchClient from "./CrmMismatchClient";

export default async function CrmMismatchesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch all retailers with relevant geodata fields
  const retailers = await prisma.crmRetailer.findMany({
    include: {
      route: { select: { name: true, code: true } },
      chain: { select: { name: true } }
    },
    orderBy: { name: "asc" }
  });

  return (
    <AppShell>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>🗺️ Geodata Mismatch Audit Center</h2>
            <p>Run batch audits against USPS/Census Bureau databases to verify store coordinates and flag corrections.</p>
          </div>
        </div>
      </div>
      <div className="page-body">
        <CrmMismatchClient 
          initialRetailers={JSON.parse(JSON.stringify(retailers))}
        />
      </div>
    </AppShell>
  );
}
