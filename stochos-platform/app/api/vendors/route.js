import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const search = searchParams.get("search");

  const where = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { contactName: { contains: search, mode: "insensitive" } },
      { contactEmail: { contains: search, mode: "insensitive" } },
    ];
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      jurisdiction: { select: { abbreviation: true, name: true } },
      _count: { select: { contracts: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(vendors);
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body.name || !body.type) {
      return NextResponse.json({ error: "Name and Type are required" }, { status: 400 });
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: body.name,
        type: body.type,
        jurisdictionId: body.jurisdictionId || null,
        status: body.status || "active",
        contactName: body.contactName || null,
        contactEmail: body.contactEmail || null,
        contactPhone: body.contactPhone || null,
        address: body.address || null,
        notes: body.notes || null,
        taxId: body.taxId || null,
        website: body.website || null,
        paymentTerms: body.paymentTerms || null,
        classification: body.classification || null,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vendor",
        entityId: vendor.id,
        action: "create",
        changes: { created: body },
      },
    });

    return NextResponse.json(vendor, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
