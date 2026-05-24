import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify contract exists
  const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Log PDF export action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "export_pdf",
      changes: {},
    },
  });

  return NextResponse.json({ success: true });
}
