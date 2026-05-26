export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import AppShell from "../../components/AppShell";
import ContractDetailClient from "./ContractDetailClient";

export default async function ContractDetailPage({ params }) {
  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      createdBy: { select: { name: true, email: true } },
      lineItems: {
        include: { product: { select: { id: true, name: true, category: true } } },
        orderBy: { sortOrder: "asc" },
      },
      amendments: { orderBy: { amendmentNumber: "asc" } },
      compliance: { orderBy: { createdAt: "desc" } },
      invoices: {
        include: { lineItem: { select: { description: true } } },
        orderBy: { createdAt: "desc" },
      },
      purchaseOrders: { orderBy: { createdAt: "desc" } },
      accessList: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  });

  if (!contract) notFound();

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "contract", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const products = await prisma.product.findMany({
    select: { id: true, name: true, category: true },
    where: { jurisdictionId: contract.jurisdictionId },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <ContractDetailClient
        contract={JSON.parse(JSON.stringify(contract))}
        auditLog={JSON.parse(JSON.stringify(auditLog))}
        products={JSON.parse(JSON.stringify(products))}
      />
    </AppShell>
  );
}
