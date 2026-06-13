import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getFeatureFlag } from "@/lib/settings";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check feature flag
  const isEnabled = await getFeatureFlag("feature_fleet");
  if (!isEnabled) return NextResponse.json({ error: "Module not enabled" }, { status: 403 });

  const { id } = await params;

  try {
    const logs = await prisma.vehicleLog.findMany({
      where: { vehicleId: id },
      include: {
        driver: { select: { id: true, name: true, email: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check feature flag
  const isEnabled = await getFeatureFlag("feature_fleet");
  if (!isEnabled) return NextResponse.json({ error: "Module not enabled" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();
    const odometer = parseInt(body.odometer);
    if (isNaN(odometer) || odometer < 0) {
      return NextResponse.json({ error: "Odometer reading must be a positive integer" }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
    }

    // Odometer sanity check: cannot regress mileage
    if (odometer < vehicle.mileage) {
      return NextResponse.json({
        error: `Odometer regression check failed: Input (${odometer}) is less than current mileage (${vehicle.mileage}).`
      }, { status: 400 });
    }

    // Perform database writes in an atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the VehicleLog
      const log = await tx.vehicleLog.create({
        data: {
          vehicleId: id,
          driverId: session.user.id,
          type: body.type || "start",
          odometer: odometer,
          checkWalkaround: body.checkWalkaround !== false,
          checkBrakes: body.checkBrakes !== false,
          checkTires: body.checkTires !== false,
          checkLights: body.checkLights !== false,
          checkFluids: body.checkFluids !== false,
          checkEngineLight: body.checkEngineLight === true,
          notes: body.notes || null,
        },
        include: {
          driver: { select: { id: true, name: true, email: true } }
        }
      });

      // 2. Update Vehicle fields (mileage, and lastService if reconciliation type or flagged)
      const updateData = { mileage: odometer };
      if (body.type === "reconciliation" || body.isService === true) {
        updateData.lastService = new Date();
      }

      await tx.vehicle.update({
        where: { id },
        data: updateData
      });

      // 3. Log to system AuditLog for compliance auditing
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entityType: "vehicle_log",
          entityId: log.id,
          changes: { description: `Pre-trip check-in logged for vehicle ID ${id} (${vehicle.licensePlate}). Odometer: ${odometer} miles.` }
        }
      });

      return log;
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
