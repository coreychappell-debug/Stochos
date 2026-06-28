import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";
import HelpTrigger from "@/app/components/HelpTrigger";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  planning: "Planning",
  briefed: "Briefed",
  in_production: "In Production",
  live: "Live",
  completed: "Completed",
  cancelled: "Cancelled",
};

import MarketingClient from "./MarketingClient";

export default async function MarketingPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    include: {
      vendor: { select: { name: true } },
      jurisdiction: { select: { name: true } },
      channels: true,
      _count: { select: { channels: true, assets: true, milestones: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

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
        <div className="page-header flex justify-between items-center">
          <div>
            <h2>Marketing MRM</h2>
            <p>Campaign planning, channels, and creative asset tracking.</p>
          </div>
          <div className="flex gap-2 items-center">
            <HelpTrigger topicId="marketing" />
            <Link href="/instant-tickets/working-papers" className="btn btn-secondary">Working Papers Registry</Link>
            <Link href="/marketing/new" className="btn btn-primary">+ New Campaign</Link>
          </div>
        </div>

        <div className="page-body">
          <MarketingClient campaigns={serialize(campaigns)} />
        </div>
      </main>
    </div>
  );
}
