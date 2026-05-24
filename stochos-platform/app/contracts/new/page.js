export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../../components/AppShell";
import NewContractForm from "./NewContractForm";

export default async function NewContractPage() {
  const [vendors, jurisdictions] = await Promise.all([
    prisma.vendor.findMany({
      select: { id: true, name: true, type: true },
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
    prisma.jurisdiction.findMany({
      select: { id: true, name: true, abbreviation: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <h2>New Contract</h2>
        <p>Create a new contract agreement</p>
      </div>
      <div className="page-body">
        <NewContractForm
          vendors={JSON.parse(JSON.stringify(vendors))}
          jurisdictions={JSON.parse(JSON.stringify(jurisdictions))}
        />
      </div>
    </AppShell>
  );
}
