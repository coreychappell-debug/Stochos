export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Map, Car } from "lucide-react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import FomoRetailerListClient from "./FomoRetailerListClient";
import HelpTrigger from "@/app/components/HelpTrigger";
import FomoSubNav from "../FomoSubNav";

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
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ margin: 0 }}>FOMO Retailer Registry</h2>
              <p style={{ margin: "4px 0 0 0" }}>Active store accounts, configurations, and territory assignments</p>
            </div>
             <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
               <HelpTrigger topicId="fomo" />
               <Link href="/fomo/mismatches" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                 <Map size={14} /> Geodata Audit
               </Link>
               <Link href="/fomo/planner" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                 <Car size={14} /> Trip Planner
               </Link>
               <Link href="/fomo" className="btn btn-secondary">
                 Back to Dashboard
               </Link>
             </div>
          </div>
       </div>
      <FomoSubNav />
      <div className="page-body" style={{ paddingTop: 0 }}>
        <FomoRetailerListClient 
          initialRetailers={JSON.parse(JSON.stringify(retailers))}
          routes={JSON.parse(JSON.stringify(routes))}
          chains={JSON.parse(JSON.stringify(chains))}
        />
      </div>
    </AppShell>
  );
}
