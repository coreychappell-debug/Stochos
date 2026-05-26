export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../components/AppShell";
import AssetsClient from "./AssetsClient";

export default async function AssetsPage() {
  const [assets, jurisdictions, users] = await Promise.all([
    prisma.asset.findMany({
      include: {
        jurisdiction: { select: { name: true, abbreviation: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { assetTag: "asc" },
    }),
    prisma.jurisdiction.findMany({
      select: { id: true, name: true, abbreviation: true },
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>IT &amp; Physical Assets</h2>
            <p>Track hardware equipment, barcode serial tags, values, and employee checkout statuses</p>
          </div>
        </div>
      </div>
      <div className="page-body">
        <AssetsClient
          initialAssets={JSON.parse(JSON.stringify(assets))}
          jurisdictions={JSON.parse(JSON.stringify(jurisdictions))}
          users={JSON.parse(JSON.stringify(users))}
        />
      </div>
    </AppShell>
  );
}
