import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, channelId } = await params;
  const body = await request.json();

  const before = await prisma.campaignChannel.findUnique({ where: { id: channelId } });
  
  const channel = await prisma.campaignChannel.update({
    where: { id: channelId },
    data: {
      vendorId: body.vendorId !== undefined ? body.vendorId : undefined,
      channel: body.channel,
      description: body.description,
      status: body.status,
      targetMarket: body.targetMarket,
      plannedSpend: body.plannedSpend !== undefined ? (body.plannedSpend ? parseFloat(body.plannedSpend) : null) : undefined,
      actualSpend: body.actualSpend !== undefined ? parseFloat(body.actualSpend) : undefined,
      startDate: body.startDate !== undefined ? (body.startDate ? new Date(body.startDate) : null) : undefined,
      endDate: body.endDate !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      kpiGoal: body.kpiGoal,
      impressions: body.impressions !== undefined ? (body.impressions ? BigInt(body.impressions) : null) : undefined,
      notes: body.notes,
    },
    include: { vendor: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "update_channel",
      changes: {
        channel: channel.channel,
        before: { status: before.status, actualSpend: before.actualSpend },
        after: { status: channel.status, actualSpend: channel.actualSpend },
      },
    },
  });

  const result = { ...channel, impressions: channel.impressions ? channel.impressions.toString() : null };
  return NextResponse.json(result);
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, channelId } = await params;

  const channel = await prisma.campaignChannel.findUnique({ where: { id: channelId } });

  await prisma.campaignChannel.delete({ where: { id: channelId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "delete_channel",
      changes: { channel: channel?.channel },
    },
  });

  return NextResponse.json({ success: true });
}
