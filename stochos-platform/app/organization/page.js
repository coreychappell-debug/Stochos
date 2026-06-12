export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../components/AppShell";
import OrganizationClient from "./OrganizationClient";

export default async function OrganizationPage() {
  const [users, orgUnits, roles] = await Promise.all([
    prisma.user.findMany({
      include: {
        manager: { select: { id: true, name: true, email: true, division: true } },
        staff: { select: { id: true, name: true, email: true, division: true } },
        orgUnit: { select: { id: true, name: true, code: true, type: true, parentId: true } },
        contractsCreated: {
          include: {
            vendor: { select: { id: true, name: true } },
            lineItems: { select: { budgetAmount: true, spentAmount: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.orgUnit.findMany({
      orderBy: { code: "asc" }
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h2>Organization &amp; Leadership</h2>
          <p>Explore the New York State Gaming Commission structure, divisional leads, and contract execution owners.</p>
        </div>
      </div>
      <div className="page-body">
        <OrganizationClient 
          initialUsers={JSON.parse(JSON.stringify(users))} 
          initialOrgUnits={JSON.parse(JSON.stringify(orgUnits))} 
          initialRoles={JSON.parse(JSON.stringify(roles))}
        />
      </div>
    </AppShell>
  );
}
