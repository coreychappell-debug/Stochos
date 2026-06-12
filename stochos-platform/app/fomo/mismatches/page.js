export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Map } from "lucide-react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import FomoMismatchClient from "./FomoMismatchClient";
import FomoSubNav from "../FomoSubNav";

export default async function FomoMismatchesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Enforce access control: sales representatives should not access this audit tool
  if (session.user.role === "sales_rep") {
    redirect("/unauthorized");
  }

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
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Map size={24} /> Geodata Mismatch Audit Center
            </h2>
            <p style={{ margin: "4px 0 0 0" }}>Run batch audits against USPS/Census Bureau databases to verify store coordinates and flag corrections.</p>
          </div>
          <Link href="/fomo" className="btn btn-secondary">
            Back to Dashboard
          </Link>
        </div>
      </div>
      <FomoSubNav />
      <div className="page-body" style={{ paddingTop: 0 }}>
        <FomoMismatchClient 
          initialRetailers={JSON.parse(JSON.stringify(retailers))}
        />
      </div>
    </AppShell>
  );
}
