import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const channel = await prisma.campaignChannel.create({
    data: {
      campaignId: id,
      vendorId: body.vendorId || null,
      channel: body.channel,
      description: body.description || null,
      status: body.status || "planned",
      targetMarket: body.targetMarket || null,
      plannedSpend: body.plannedSpend ? parseFloat(body.plannedSpend) : null,
      actualSpend: body.actualSpend ? parseFloat(body.actualSpend) : 0,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      kpiGoal: body.kpiGoal || null,
      impressions: body.impressions ? BigInt(body.impressions) : null,
      notes: body.notes || null,
    },
    include: { vendor: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "create_channel",
      changes: {
        channel: channel.channel,
        type: channel.channel,
        plannedSpend: channel.plannedSpend,
      },
    },
  });

  // Convert BigInt to string for JSON serialization
  const result = {
    ...channel,
    impressions: channel.impressions ? channel.impressions.toString() : null,
  };

  return NextResponse.json(result, { status: 201 });
}
