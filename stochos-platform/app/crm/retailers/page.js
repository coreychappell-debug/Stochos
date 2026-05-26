export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import CrmRetailerListClient from "./CrmRetailerListClient";

export default async function CrmRetailersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [retailers, routes, chains] = await Promise.all([
    prisma.crmRetailer.findMany({
      include: {
        route: { select: { name: true, code: true } },
        chain: { select: { name: true } },
        _count: { select: { visits: true, discrepancies: { where: { status: "open" } } } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.crmRoute.findMany({ select: { id: true, name: true, code: true } }),
    prisma.crmChainAccount.findMany({ select: { id: true, name: true } })
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>CRM Retailer Registry</h2>
            <p>Active store accounts, configurations, and territory assignments</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/crm/mismatches" className="btn btn-secondary">
              🗺️ Geodata Audit
            </Link>
            <Link href="/crm" className="btn btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
      <div className="page-body">
        <CrmRetailerListClient 
          initialRetailers={JSON.parse(JSON.stringify(retailers))}
          routes={JSON.parse(JSON.stringify(routes))}
          chains={JSON.parse(JSON.stringify(chains))}
        />
      </div>
    </AppShell>
  );
}

// Link helper required in server component
import Link from "next/link";
