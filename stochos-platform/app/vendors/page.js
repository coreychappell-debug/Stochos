export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import Link from "next/link";
import AppShell from "../components/AppShell";
import VendorListClient from "./VendorListClient";

export default async function VendorsPage() {
  const vendors = await prisma.vendor.findMany({
    include: {
      jurisdiction: { select: { abbreviation: true, name: true } },
      _count: { select: { contracts: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Vendors</h2>
            <p>Registered vendor organizations and compliance classifications</p>
          </div>
          <Link href="/vendors/new" className="btn btn-primary">
            + Register Vendor
          </Link>
        </div>
      </div>
      <div className="page-body">
        <VendorListClient initialVendors={JSON.parse(JSON.stringify(vendors))} />
      </div>
    </AppShell>
  );
}
