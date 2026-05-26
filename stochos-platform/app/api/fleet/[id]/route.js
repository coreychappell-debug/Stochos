import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      jurisdiction: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!vehicle) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

  // Fetch audit log for this vehicle
  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "vehicle", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ ...vehicle, auditLog });
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const before = await prisma.vehicle.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        make: body.make !== undefined ? body.make : undefined,
        model: body.model !== undefined ? body.model : undefined,
        year: body.year !== undefined ? parseInt(body.year) : undefined,
        vin: body.vin !== undefined ? body.vin : undefined,
        licensePlate: body.licensePlate !== undefined ? body.licensePlate : undefined,
        status: body.status !== undefined ? body.status : undefined,
        mileage: body.mileage !== undefined ? parseInt(body.mileage) : undefined,
        lastService: body.lastService !== undefined ? (body.lastService ? new Date(body.lastService) : null) : undefined,
        assignedToId: body.assignedToId !== undefined ? body.assignedToId : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        disposalDate: body.disposalDate !== undefined ? (body.disposalDate ? new Date(body.disposalDate) : null) : undefined,
        disposalMethod: body.disposalMethod !== undefined ? body.disposalMethod : undefined,
        salePrice: body.salePrice !== undefined ? (body.salePrice !== null ? parseFloat(body.salePrice) : null) : undefined,
        usefulLifeMonths: body.usefulLifeMonths !== undefined ? parseInt(body.usefulLifeMonths) : undefined,
        usefulLifeMiles: body.usefulLifeMiles !== undefined ? parseInt(body.usefulLifeMiles) : undefined,
        value: body.value !== undefined ? (body.value !== null ? parseFloat(body.value) : null) : undefined,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vehicle",
        entityId: id,
        action: "update",
        changes: { before, after: body },
      },
    });

    return NextResponse.json(vehicle);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.vehicle.delete({ where: { id } });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vehicle",
        entityId: id,
        action: "delete",
        changes: {},
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
