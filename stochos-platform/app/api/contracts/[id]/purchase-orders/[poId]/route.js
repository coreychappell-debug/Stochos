import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, poId } = await params;

  try {
    const body = await request.json();
    const before = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!before) {
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    const po = await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        poNumber: body.poNumber !== undefined ? body.poNumber : undefined,
        description: body.description !== undefined ? body.description : undefined,
        amount: body.amount !== undefined ? parseFloat(body.amount) : undefined,
        status: body.status !== undefined ? body.status : undefined,
        issuedDate: body.issuedDate !== undefined ? (body.issuedDate ? new Date(body.issuedDate) : null) : undefined,
        deliveryDate: body.deliveryDate !== undefined ? (body.deliveryDate ? new Date(body.deliveryDate) : null) : undefined,
        notes: body.notes !== undefined ? body.notes : undefined,
      },
    });

    // Create Audit Log for the Contract
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "contract",
        entityId: contractId,
        action: "update_po",
        changes: { poId, before, after: body },
      },
    });

    return NextResponse.json(po);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId, poId } = await params;

  try {
    const before = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
    });

    if (!before) {
      return NextResponse.json({ error: "Purchase Order not found" }, { status: 404 });
    }

    await prisma.purchaseOrder.delete({
      where: { id: poId },
    });

    // Create Audit Log for the Contract
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "contract",
        entityId: contractId,
        action: "delete_po",
        changes: { poId, poNumber: before.poNumber },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
