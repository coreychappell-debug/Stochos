import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      vendor: true,
      jurisdiction: true,
      contract: true,
      products: true,
      createdBy: { select: { name: true } },
      channels: { orderBy: { createdAt: "desc" } },
      assets: { orderBy: { createdAt: "desc" } },
      milestones: { orderBy: { dueDate: "asc" } }
    },
  });

  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const auditLog = await prisma.auditLog.findMany({
    where: { entityType: "campaign", entityId: id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ ...campaign, auditLog });
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const before = await prisma.campaign.findUnique({ where: { id }, include: { products: true } });
  
  const data = {
    name: body.name,
    objective: body.objective || null,
    status: body.status,
    campaignType: body.campaignType || null,
    totalBudget: body.totalBudget !== undefined ? body.totalBudget : undefined,
    startDate: body.startDate ? new Date(body.startDate) : null,
    endDate: body.endDate ? new Date(body.endDate) : null,
    notes: body.notes || null,
  };

  if (body.productIds) {
    data.products = { set: body.productIds.map(pid => ({ id: pid })) };
  }

  const campaign = await prisma.campaign.update({
    where: { id },
    data,
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "update",
      changes: { before: { status: before.status, name: before.name }, after: { status: body.status, name: body.name } },
    },
  });

  return NextResponse.json(campaign);
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.campaign.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "delete",
      changes: {},
    },
  });

  return NextResponse.json({ success: true });
}
