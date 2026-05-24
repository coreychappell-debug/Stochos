import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify contract exists
  const contract = await prisma.contract.findUnique({ where: { id }, select: { id: true, title: true } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.auditLog.findMany({
    where: { entityType: "contract", entityId: id },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Log export action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "export_audit_csv",
      changes: {},
    },
  });

  // Build CSV content
  const rows = [];
  rows.push(["Timestamp", "User", "Email", "Action", "Changes"]);

  for (const log of logs) {
    const changesStr = log.changes ? JSON.stringify(log.changes).replace(/"/g, '""') : "";
    rows.push([
      new Date(log.createdAt).toISOString(),
      `"${log.user?.name || "System"}"`,
      `"${log.user?.email || ""}"`,
      log.action,
      `"${changesStr}"`
    ]);
  }

  const csvContent = rows.map(r => r.join(",")).join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contract-${id}-audit.csv"`,
    },
  });
}
