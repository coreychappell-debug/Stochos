// =============================================================================
// Contract Line Items API
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/contracts/[id]/line-items — Add a line item
export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const lineItem = await prisma.contractLineItem.create({
    data: {
      contractId: id,
      productId: body.productId || null,
      description: body.description,
      deliverableType: body.deliverableType || null,
      budgetAmount: body.budgetAmount || null,
      quantity: body.quantity || null,
      unitCost: body.unitCost || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: body.status || "pending",
    },
    include: { product: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { addedLineItem: body },
    },
  });

  return NextResponse.json(lineItem, { status: 201 });
}
