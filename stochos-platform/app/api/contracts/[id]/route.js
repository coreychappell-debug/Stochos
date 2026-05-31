// =============================================================================
// Contract Detail API — Single contract CRUD + line items
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/contracts/[id] — Get full contract detail
export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      createdBy: { select: { name: true, email: true } },
      lineItems: {
        include: { product: { select: { id: true, name: true, category: true } } },
        orderBy: { sortOrder: "asc" },
      },
      amendments: { orderBy: { amendmentNumber: "asc" } },
      compliance: { orderBy: { createdAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Enforce read access permissions
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });
  const isAdmin = user?.role?.name === "admin";

  if (!isAdmin) {
    const hasAccess = contract.createdById === session.user.id || await prisma.contractAccess.findUnique({
      where: {
        contractId_userId: {
          contractId: id,
          userId: session.user.id
        }
      }
    });
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // Fetch audit log for this contract
  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "contract", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ ...contract, auditLog });
}

// PUT /api/contracts/[id] — Update contract
export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  // Get current state for audit diff
  const before = await prisma.contract.findUnique({ where: { id } });
  if (!before) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Enforce write access permissions
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });
  const isAdmin = user?.role?.name === "admin";

  if (!isAdmin) {
    const access = await prisma.contractAccess.findUnique({
      where: {
        contractId_userId: {
          contractId: id,
          userId: session.user.id
        }
      }
    });
    const canWrite = before.createdById === session.user.id || (access && access.permission === "write");
    if (!canWrite) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  const contract = await prisma.contract.update({
    where: { id },
    data: {
      title: body.title,
      type: body.type,
      vendorId: body.vendorId,
      status: body.status,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      noticeDate: body.noticeDate ? new Date(body.noticeDate) : null,
      totalValue: body.totalValue || null,
      budgetCap: body.budgetCap || null,
      terms: body.terms || {},
    },
    include: { vendor: true, jurisdiction: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { before, after: body },
    },
  });

  return NextResponse.json(contract);
}

// DELETE /api/contracts/[id] — Delete contract
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Enforce delete access permissions
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });
  const isAdmin = user?.role?.name === "admin";

  if (!isAdmin) {
    const access = await prisma.contractAccess.findUnique({
      where: {
        contractId_userId: {
          contractId: id,
          userId: session.user.id
        }
      }
    });
    const canDelete = contract.createdById === session.user.id || (access && access.permission === "write");
    if (!canDelete) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  await prisma.contract.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "delete",
      changes: {},
    },
  });

  return NextResponse.json({ success: true });
}
