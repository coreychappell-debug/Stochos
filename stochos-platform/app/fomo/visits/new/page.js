export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../../components/AppShell";
import FomoNewVisitClient from "./FomoNewVisitClient";

export default async function CrmNewVisitPage({ searchParams }) {
  const session = await auth();
  if (!session) redirect("/login");

  const resolvedParams = await searchParams;
  const retailerId = resolvedParams.retailerId;

  // Fetch list of all active retailers to allow selection if needed
  const retailers = await prisma.crmRetailer.findMany({
    where: { status: { not: "inactive" } },
    select: { id: true, name: true, externalId: true, city: true },
    orderBy: { name: "asc" }
  });

  let selectedRetailer = null;
  if (retailerId) {
    selectedRetailer = await prisma.crmRetailer.findUnique({
      where: { id: retailerId },
      include: {
        assignments: {
          include: {
            asset: {
              include: { type: true }
            }
          },
          orderBy: { installDate: "desc" }
        },
        route: true,
        chain: true
      }
    });
  }

  return (
    <AppShell>
      <FomoNewVisitClient 
        retailers={JSON.parse(JSON.stringify(retailers))} 
        initialRetailer={selectedRetailer ? JSON.parse(JSON.stringify(selectedRetailer)) : null}
      />
    </AppShell>
  );
}
