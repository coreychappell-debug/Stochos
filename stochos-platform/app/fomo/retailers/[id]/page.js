export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AppShell from "../../../components/AppShell";
import FomoRetailerDetailClient from "./FomoRetailerDetailClient";

export default async function CrmRetailerDetailPage({ params }) {
  const session = await auth();
  if (!session) redirect("/login");

  // Await the routing params
  const { id } = await params;

  const retailer = await prisma.crmRetailer.findUnique({
    where: { id },
    include: {
      route: {
        include: { rep: { select: { name: true, email: true } } }
      },
      chain: true,
      assignments: {
        include: {
          asset: {
            include: { type: true }
          }
        },
        orderBy: { installDate: "desc" }
      },
      visits: {
        include: {
          user: { select: { name: true } },
          coaching: true,
          merchandising: true,
          process: true
        },
        orderBy: { visitDate: "desc" }
      },
      discrepancies: {
        orderBy: { createdAt: "desc" }
      },
      actionItems: {
        orderBy: { dueDate: "asc" }
      }
    }
  });

  if (!retailer) notFound();

  return (
    <AppShell>
      <FomoRetailerDetailClient retailer={JSON.parse(JSON.stringify(retailer))} />
    </AppShell>
  );
}
