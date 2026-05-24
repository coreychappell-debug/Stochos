// =============================================================================
// Contract Amendments API
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/contracts/[id]/amendments — Add an amendment
export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Auto-increment amendment number
  const lastAmendment = await prisma.contractAmendment.findFirst({
    where: { contractId: id },
    orderBy: { amendmentNumber: "desc" },
  });
  const nextNumber = (lastAmendment?.amendmentNumber || 0) + 1;

  const amendment = await prisma.contractAmendment.create({
    data: {
      contractId: id,
      amendmentNumber: nextNumber,
      description: body.description || null,
      valueChange: body.valueChange ? parseFloat(body.valueChange) : 0,
      newEndDate: body.newEndDate ? new Date(body.newEndDate) : null,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { addedAmendment: { number: nextNumber, ...body } },
    },
  });

  return NextResponse.json(amendment, { status: 201 });
}
