export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import CrmImportClient from "./CrmImportClient";

export default async function CrmImportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch routes and chains to allow filtering in template prepopulator
  const [routes, chains] = await Promise.all([
    prisma.crmRoute.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" }
    }).catch(() => []),
    prisma.crmChainAccount.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" }
    }).catch(() => [])
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>CRM CSV Data Importer & Template Generator</h2>
            <p>Upload retailer master tables, assets, and mass task assignments</p>
          </div>
          <Link href="/crm" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
      <div className="page-body">
        <CrmImportClient 
          routes={JSON.parse(JSON.stringify(routes))} 
          chains={JSON.parse(JSON.stringify(chains))} 
        />
      </div>
    </AppShell>
  );
}
