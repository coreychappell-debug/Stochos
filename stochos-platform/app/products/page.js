export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import ProductsClient from "./ProductsClient";

export default async function ProductsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const products = await prisma.product.findMany({
    include: { jurisdiction: { select: { abbreviation: true } } },
    orderBy: [{ category: "asc" }, { status: "asc" }, { name: "asc" }],
  });

  const jurisdictions = await prisma.jurisdiction.findMany({ orderBy: { name: "asc" } });

  // Serialize for client component
  const serialized = products.map(p => ({
    ...p, price: p.price ? parseFloat(p.price) : null,
    createdAt: p.createdAt.toISOString(),
  }));
  const serializedJurisdictions = jurisdictions.map(j => ({
    id: j.id, name: j.name, abbreviation: j.abbreviation,
  }));

  return (
    <AppShell>
      <ProductsClient initialProducts={serialized} jurisdictions={serializedJurisdictions} />
    </AppShell>
  );
}
