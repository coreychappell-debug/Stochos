import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  const where = {};
  if (category && category !== "all") where.category = category;
  if (status && status !== "all") where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { assetTag: { contains: search, mode: "insensitive" } },
      { serialNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  const assets = await prisma.asset.findMany({
    where,
    include: {
      jurisdiction: { select: { abbreviation: true, name: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { assetTag: "asc" },
  });

  return NextResponse.json(assets);
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.assetTag || !body.name || !body.category || !body.jurisdictionId) {
      return NextResponse.json(
        { error: "Asset Tag, Name, Category, and Jurisdiction are required" },
        { status: 400 }
      );
    }

    // Check uniqueness of asset tag
    const existing = await prisma.asset.findUnique({
      where: { assetTag: body.assetTag },
    });
    if (existing) {
      return NextResponse.json({ error: "An asset with this Asset Tag already exists" }, { status: 400 });
    }

    const asset = await prisma.asset.create({
      data: {
        assetTag: body.assetTag,
        name: body.name,
        category: body.category,
        serialNumber: body.serialNumber || null,
        status: body.status || "available",
        value: body.value ? parseFloat(body.value) : null,
        assignedToId: body.assignedToId || null,
        jurisdictionId: body.jurisdictionId,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        notes: body.notes || null,
        disposalDate: body.disposalDate ? new Date(body.disposalDate) : null,
        disposalMethod: body.disposalMethod || null,
        salePrice: body.salePrice !== undefined && body.salePrice !== null ? parseFloat(body.salePrice) : null,
        usefulLifeMonths: body.usefulLifeMonths !== undefined ? parseInt(body.usefulLifeMonths) : 36,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
        entityId: asset.id,
        action: "create",
        changes: { created: body },
      },
    });

    return NextResponse.json(asset, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
