import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const vendorId = searchParams.get("vendorId");

  const where = {};
  if (status && status !== "all") where.status = status;
  if (vendorId) where.vendorId = vendorId;

  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      vendor: { select: { id: true, name: true } },
      jurisdiction: { select: { abbreviation: true } },
      _count: { select: { channels: true, assets: true, milestones: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(campaigns);
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const campaign = await prisma.campaign.create({
    data: {
      jurisdictionId: body.jurisdictionId,
      vendorId: body.vendorId,
      contractId: body.contractId || null,
      name: body.name,
      objective: body.objective || null,
      status: body.status || "planning",
      campaignType: body.campaignType || null,
      totalBudget: body.totalBudget || null,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes || null,
      createdById: session.user.id,
      products: {
        connect: (body.productIds || []).map(id => ({ id }))
      }
    },
    include: { vendor: true, jurisdiction: true, products: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: campaign.id,
      action: "create",
      changes: { created: { name: body.name, vendorId: body.vendorId } },
    },
  });

  return NextResponse.json(campaign, { status: 201 });
}
