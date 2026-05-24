// =============================================================================
// Contract Line Item Delete API
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// DELETE /api/contracts/[id]/line-items/[itemId]
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, itemId } = await params;

  const item = await prisma.contractLineItem.findUnique({ where: { id: itemId } });
  if (!item || item.contractId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.contractLineItem.delete({ where: { id: itemId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { deletedLineItem: { id: itemId, description: item.description } },
    },
  });

  return NextResponse.json({ success: true });
}
