import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where = {};
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { make: { contains: search, mode: "insensitive" } },
      { model: { contains: search, mode: "insensitive" } },
      { licensePlate: { contains: search, mode: "insensitive" } },
      { vin: { contains: search, mode: "insensitive" } },
    ];
  }

  const vehicles = await prisma.vehicle.findMany({
    where,
    include: {
      jurisdiction: { select: { abbreviation: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { licensePlate: "asc" },
  });

  return NextResponse.json(vehicles);
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.make || !body.model || !body.vin || !body.licensePlate || !body.jurisdictionId) {
      return NextResponse.json(
        { error: "Make, Model, Year, VIN, License Plate, and Jurisdiction are required" },
        { status: 400 }
      );
    }

    // Check VIN uniqueness
    const existing = await prisma.vehicle.findUnique({
      where: { vin: body.vin },
    });
    if (existing) {
      return NextResponse.json({ error: "A vehicle with this VIN already exists" }, { status: 400 });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        make: body.make,
        model: body.model,
        year: parseInt(body.year) || new Date().getFullYear(),
        vin: body.vin,
        licensePlate: body.licensePlate,
        status: body.status || "active",
        mileage: parseInt(body.mileage) || 0,
        lastService: body.lastService ? new Date(body.lastService) : null,
        assignedToId: body.assignedToId || null,
        jurisdictionId: body.jurisdictionId,
        notes: body.notes || null,
        disposalDate: body.disposalDate ? new Date(body.disposalDate) : null,
        disposalMethod: body.disposalMethod || null,
        salePrice: body.salePrice !== undefined && body.salePrice !== null ? parseFloat(body.salePrice) : null,
        usefulLifeMonths: body.usefulLifeMonths !== undefined ? parseInt(body.usefulLifeMonths) : 120,
        usefulLifeMiles: body.usefulLifeMiles !== undefined ? parseInt(body.usefulLifeMiles) : 100000,
        value: body.value !== undefined && body.value !== null ? parseFloat(body.value) : null,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vehicle",
        entityId: vehicle.id,
        action: "create",
        changes: { created: body },
      },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
