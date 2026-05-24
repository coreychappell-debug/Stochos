import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, milestoneId } = await params;
  const body = await request.json();

  const before = await prisma.campaignMilestone.findUnique({ where: { id: milestoneId } });
  
  const data = {
    name: body.name,
    milestoneType: body.milestoneType,
    owner: body.owner,
    priority: body.priority,
    status: body.status,
    dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
    completedDate: body.completedDate !== undefined ? (body.completedDate ? new Date(body.completedDate) : null) : undefined,
    dependencyNotes: body.dependencyNotes,
    blockerReason: body.blockerReason,
    notes: body.notes,
  };

  if (body.channelId !== undefined) data.channelId = body.channelId || null;
  if (body.assetId !== undefined) data.assetId = body.assetId || null;
  if (body.vendorId !== undefined) data.vendorId = body.vendorId || null;

  const milestone = await prisma.campaignMilestone.update({
    where: { id: milestoneId },
    data,
    include: { vendor: { select: { name: true } }, channel: { select: { channel: true } }, asset: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "update_milestone",
      changes: {
        milestoneName: milestone.name,
        before: { status: before.status, priority: before.priority },
        after: { status: milestone.status, priority: milestone.priority },
      },
    },
  });

  return NextResponse.json(milestone);
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, milestoneId } = await params;

  const milestone = await prisma.campaignMilestone.findUnique({ where: { id: milestoneId } });

  await prisma.campaignMilestone.delete({ where: { id: milestoneId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "delete_milestone",
      changes: { milestoneName: milestone?.name },
    },
  });

  return NextResponse.json({ success: true });
}
