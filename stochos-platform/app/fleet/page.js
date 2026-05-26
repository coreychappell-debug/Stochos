export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/db";
import AppShell from "../components/AppShell";
import FleetClient from "./FleetClient";

export default async function FleetPage() {
  const [vehicles, jurisdictions, users] = await Promise.all([
    prisma.vehicle.findMany({
      include: {
        jurisdiction: { select: { name: true, abbreviation: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { licensePlate: "asc" },
    }),
    prisma.jurisdiction.findMany({
      select: { id: true, name: true, abbreviation: true },
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      where: { status: "active" },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2>Fleet Management</h2>
            <p>Track agency vehicles, registration plates, mileage, service records, and driver assignments</p>
          </div>
        </div>
      </div>
      <div className="page-body">
        <FleetClient
          initialVehicles={JSON.parse(JSON.stringify(vehicles))}
          jurisdictions={JSON.parse(JSON.stringify(jurisdictions))}
          users={JSON.parse(JSON.stringify(users))}
        />
      </div>
    </AppShell>
  );
}
