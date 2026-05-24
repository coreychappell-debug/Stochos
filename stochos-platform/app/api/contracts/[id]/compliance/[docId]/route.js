// =============================================================================
// Contract Compliance Document Delete API
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// DELETE /api/contracts/[id]/compliance/[docId]
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;

  const doc = await prisma.contractCompliance.findUnique({ where: { id: docId } });
  if (!doc || doc.contractId !== id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.contractCompliance.delete({ where: { id: docId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { deletedComplianceDoc: { id: docId, type: doc.documentType } },
    },
  });

  return NextResponse.json({ success: true });
}
