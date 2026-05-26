import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      jurisdiction: true,
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

  // Fetch audit log for this asset
  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "asset", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ ...asset, auditLog });
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const before = await prisma.asset.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

    const asset = await prisma.asset.update({
      where: { id },
      data: {
        assetTag: body.assetTag !== undefined ? body.assetTag : undefined,
        name: body.name !== undefined ? body.name : undefined,
        category: body.category !== undefined ? body.category : undefined,
        serialNumber: body.serialNumber !== undefined ? body.serialNumber : undefined,
        status: body.status !== undefined ? body.status : undefined,
        value: body.value !== undefined ? (body.value ? parseFloat(body.value) : null) : undefined,
        assignedToId: body.assignedToId !== undefined ? body.assignedToId : undefined,
        purchaseDate: body.purchaseDate !== undefined ? (body.purchaseDate ? new Date(body.purchaseDate) : null) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        disposalDate: body.disposalDate !== undefined ? (body.disposalDate ? new Date(body.disposalDate) : null) : undefined,
        disposalMethod: body.disposalMethod !== undefined ? body.disposalMethod : undefined,
        salePrice: body.salePrice !== undefined ? (body.salePrice !== null ? parseFloat(body.salePrice) : null) : undefined,
        usefulLifeMonths: body.usefulLifeMonths !== undefined ? parseInt(body.usefulLifeMonths) : undefined,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
        entityId: id,
        action: "update",
        changes: { before, after: body },
      },
    });

    return NextResponse.json(asset);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    await prisma.asset.delete({ where: { id } });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
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
