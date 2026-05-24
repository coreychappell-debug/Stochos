import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const doc = await prisma.contractCompliance.create({
    data: {
      contractId: id,
      documentType: body.documentType,
      description: body.description || null,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
      status: "pending",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { addedComplianceDoc: body },
    },
  });

  return NextResponse.json(doc, { status: 201 });
}
