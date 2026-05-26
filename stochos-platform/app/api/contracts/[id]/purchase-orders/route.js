import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: contractId } = await params;

  try {
    const body = await request.json();
    if (!body.poNumber || !body.amount) {
      return NextResponse.json({ error: "PO Number and Amount are required" }, { status: 400 });
    }

    // Check if PO Number is unique
    const existing = await prisma.purchaseOrder.findUnique({
      where: { poNumber: body.poNumber },
    });
    if (existing) {
      return NextResponse.json({ error: "A Purchase Order with this PO Number already exists" }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        contractId,
        poNumber: body.poNumber,
        description: body.description || null,
        amount: parseFloat(body.amount),
        status: body.status || "issued",
        issuedDate: body.issuedDate ? new Date(body.issuedDate) : null,
        deliveryDate: body.deliveryDate ? new Date(body.deliveryDate) : null,
        notes: body.notes || null,
      },
    });

    // Create Audit Log for the Contract
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "contract",
        entityId: contractId,
        action: "create_po",
        changes: { poId: po.id, poNumber: po.poNumber, amount: po.amount },
      },
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
