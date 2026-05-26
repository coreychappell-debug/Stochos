import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      jurisdiction: true,
      contracts: { select: { id: true, title: true, status: true, totalValue: true } },
      campaigns: { select: { id: true, name: true, status: true } },
    },
  });

  if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

  // Fetch audit log for this vendor
  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "vendor", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ ...vendor, auditLog });
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const before = await prisma.vendor.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        type: body.type !== undefined ? body.type : undefined,
        jurisdictionId: body.jurisdictionId !== undefined ? body.jurisdictionId : undefined,
        status: body.status !== undefined ? body.status : undefined,
        contactName: body.contactName !== undefined ? body.contactName : undefined,
        contactEmail: body.contactEmail !== undefined ? body.contactEmail : undefined,
        contactPhone: body.contactPhone !== undefined ? body.contactPhone : undefined,
        address: body.address !== undefined ? body.address : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
        taxId: body.taxId !== undefined ? body.taxId : undefined,
        website: body.website !== undefined ? body.website : undefined,
        paymentTerms: body.paymentTerms !== undefined ? body.paymentTerms : undefined,
        classification: body.classification !== undefined ? body.classification : undefined,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vendor",
        entityId: id,
        action: "update",
        changes: { before, after: body },
      },
    });

    return NextResponse.json(vendor);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contracts: true,
            campaigns: true,
            instantTicketGames: true,
          },
        },
      },
    });

    if (!vendor) return NextResponse.json({ error: "Vendor not found" }, { status: 404 });

    const dependencyCount =
      vendor._count.contracts +
      vendor._count.campaigns +
      vendor._count.instantTicketGames;

    if (dependencyCount > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot delete vendor. It has associated contracts, campaigns, or games. Please mark the vendor status as 'inactive' instead.",
        },
        { status: 400 }
      );
    }

    await prisma.vendor.delete({ where: { id } });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vendor",
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
