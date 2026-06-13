import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getFeatureFlag } from "@/lib/settings";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check feature flag
  const isEnabled = await getFeatureFlag("feature_fleet");
  if (!isEnabled) return NextResponse.json({ error: "Module not enabled" }, { status: 403 });

  try {
    // 1. Get all active vehicles assigned to a user
    const vehicles = await prisma.vehicle.findMany({
      where: {
        status: "active",
        assignedToId: { not: null }
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            division: true,
            manager: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        logs: {
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const now = new Date();
    const thresholdHours = 48;
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    
    const dormantVehicles = [];

    for (const vehicle of vehicles) {
      const lastLog = vehicle.logs[0];
      let lastCheckinDate = vehicle.createdAt; // fallback if no logs exist
      if (lastLog) {
        lastCheckinDate = lastLog.createdAt;
      }

      const lapseMs = now.getTime() - lastCheckinDate.getTime();
      if (lapseMs > thresholdMs) {
        const lapseHours = Math.round(lapseMs / (1000 * 60 * 60));
        dormantVehicles.push({
          id: vehicle.id,
          licensePlate: vehicle.licensePlate,
          make: vehicle.make,
          model: vehicle.model,
          mileage: vehicle.mileage,
          lastService: vehicle.lastService,
          assignedTo: vehicle.assignedTo,
          lastCheckin: lastLog ? lastLog.createdAt : null,
          lapseHours
        });
      }
    }

    // Sort by longest lapse first
    dormantVehicles.sort((a, b) => b.lapseHours - a.lapseHours);

    return NextResponse.json(dormantVehicles);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
