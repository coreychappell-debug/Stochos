import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import CampaignDetailClient from "./CampaignDetailClient";

export default async function CampaignDetailPage({ params }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      contract: true,
      products: true,
      createdBy: { select: { name: true } },
      channels: { orderBy: { createdAt: "desc" } },
      assets: { orderBy: { createdAt: "desc" } },
      milestones: { orderBy: { dueDate: "asc" } },
    },
  });

  if (!campaign) return notFound();

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "campaign", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  const vendors = await prisma.vendor.findMany({ where: { status: "active" }, orderBy: { name: "asc" } });

  const serialize = (obj) =>
    JSON.parse(
      JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <CampaignDetailClient 
          campaign={serialize(campaign)} 
          auditLog={serialize(auditLog)} 
          products={serialize(products)} 
          vendors={serialize(vendors)} 
        />
      </main>
    </div>
  );
}
