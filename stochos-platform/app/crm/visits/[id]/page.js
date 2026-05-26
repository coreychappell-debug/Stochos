export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import AppShell from "../../../components/AppShell";
import CrmVisitDetailClient from "./CrmVisitDetailClient";

export default async function CrmVisitDetailPage({ params }) {
  const session = await auth();
  if (!session) redirect("/login");

  const resolvedParams = await params;
  const { id } = resolvedParams;

  const visit = await prisma.crmVisit.findUnique({
    where: { id },
    include: {
      retailer: {
        include: {
          route: {
            include: { rep: { select: { name: true } } }
          },
          chain: true
        }
      },
      user: { select: { name: true, email: true } },
      coaching: true,
      merchandising: true,
      process: true,
      verifications: {
        include: {
          expectedAssignment: {
            include: {
              asset: {
                include: { type: true }
              }
            }
          }
        }
      }
    }
  });

  if (!visit) notFound();

  return (
    <AppShell>
      <CrmVisitDetailClient visit={JSON.parse(JSON.stringify(visit))} />
    </AppShell>
  );
}
