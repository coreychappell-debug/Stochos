export const dynamic = "force-dynamic";

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import FomoImportClient from "./FomoImportClient";
import FomoSubNav from "../FomoSubNav";

export default async function FomoImportPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Enforce access control: sales representatives should not access this admin importer
  if (session.user.role === "sales_rep") {
    redirect("/unauthorized");
  }

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
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0 }}>FOMO CSV Data Importer & Template Generator</h2>
            <p style={{ margin: "4px 0 0 0" }}>Upload retailer master tables, assets, and mass task assignments</p>
          </div>
          <Link href="/fomo" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
      <FomoSubNav />
      <div className="page-body" style={{ paddingTop: 0 }}>
        <FomoImportClient 
          routes={JSON.parse(JSON.stringify(routes))} 
          chains={JSON.parse(JSON.stringify(chains))} 
        />
      </div>
    </AppShell>
  );
}
