export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../../components/AppShell";
import NewVendorForm from "./NewVendorForm";

export default async function NewVendorPage() {
  const jurisdictions = await prisma.jurisdiction.findMany({
    select: { id: true, name: true, abbreviation: true },
    where: { status: "active" },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <div className="page-header">
        <h2>Register Vendor</h2>
        <p>Register a new vendor organization in the platform</p>
      </div>
      <div className="page-body">
        <NewVendorForm jurisdictions={JSON.parse(JSON.stringify(jurisdictions))} />
      </div>
    </AppShell>
  );
}
