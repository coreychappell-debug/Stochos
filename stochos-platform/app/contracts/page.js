export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import Link from "next/link";
import AppShell from "../components/AppShell";
import ContractListClient from "./ContractListClient";

export default async function ContractsPage() {
  const [contracts, vendors] = await Promise.all([
    prisma.contract.findMany({
      include: {
        vendor: { select: { id: true, name: true, type: true } },
        jurisdiction: { select: { abbreviation: true } },
        lineItems: { select: { budgetAmount: true, spentAmount: true } },
        _count: { select: { lineItems: true, invoices: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Contracts</h2>
            <p>Manage contracts, deliverables, and vendor agreements</p>
          </div>
          <Link href="/contracts/new" className="btn btn-primary">
            + New Contract
          </Link>
        </div>
      </div>
      <div className="page-body">
        <ContractListClient
          initialContracts={JSON.parse(JSON.stringify(contracts))}
          vendors={JSON.parse(JSON.stringify(vendors))}
        />
      </div>
    </AppShell>
  );
}
