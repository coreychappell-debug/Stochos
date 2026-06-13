export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getFeatureFlag } from "@/lib/settings";
import FeatureBlocker from "../../../components/FeatureBlocker";
import CheckinClient from "./CheckinClient";

export default async function FleetCheckinPage({ params }) {
  const session = await auth();
  if (!session) {
    const { id } = await params;
    redirect(`/login?callbackUrl=/fleet/${id}/checkin`);
  }

  const isEnabled = await getFeatureFlag("feature_fleet");
  if (!isEnabled) {
    return <FeatureBlocker moduleName="Fleet Management" />;
  }

  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!vehicle) {
    return (
      <div style={{ padding: "40px", textAlign: "center", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--surface-1)" }}>
        <h2 style={{ color: "var(--text)", marginBottom: "8px" }}>Vehicle Not Found</h2>
        <p style={{ color: "var(--text-secondary)", maxWidth: "400px" }}>
          The vehicle ID provided in the QR code scan does not match any active records in the Stochos database.
        </p>
      </div>
    );
  }

  return (
    <CheckinClient 
      vehicle={JSON.parse(JSON.stringify(vehicle))} 
      currentUser={session.user}
    />
  );
}
