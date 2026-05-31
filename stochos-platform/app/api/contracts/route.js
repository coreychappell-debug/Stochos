// =============================================================================
// Contracts API — CRUD Operations
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET /api/contracts — List all contracts with filters
export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const vendorId = searchParams.get("vendorId");
  const search = searchParams.get("search");

  const where = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.type = type;
  if (vendorId) where.vendorId = vendorId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { vendor: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Retrieve user role from database
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });
  const isAdmin = user?.role?.name === "admin";

  if (!isAdmin) {
    where.AND = [
      {
        OR: [
          { createdById: session.user.id },
          { contractAccess: { some: { userId: session.user.id } } }
        ]
      }
    ];
  }

  const contracts = await prisma.contract.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true, type: true } },
      jurisdiction: { select: { abbreviation: true } },
      lineItems: { select: { id: true, budgetAmount: true, spentAmount: true } },
      _count: { select: { lineItems: true, invoices: true, amendments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(contracts);
}

// POST /api/contracts — Create a new contract
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const contract = await prisma.contract.create({
    data: {
      jurisdictionId: body.jurisdictionId,
      vendorId: body.vendorId,
      title: body.title,
      type: body.type,
      status: body.status || "draft",
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      noticeDate: body.noticeDate ? new Date(body.noticeDate) : null,
      totalValue: body.totalValue || null,
      budgetCap: body.budgetCap || null,
      terms: body.terms || {},
      createdById: session.user.id,
    },
    include: { vendor: true, jurisdiction: true },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: contract.id,
      action: "create",
      changes: { created: body },
    },
  });

  return NextResponse.json(contract, { status: 201 });
}
