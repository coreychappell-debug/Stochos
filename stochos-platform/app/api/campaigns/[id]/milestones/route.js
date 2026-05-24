import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const milestone = await prisma.campaignMilestone.create({
    data: {
      campaignId: id,
      channelId: body.channelId || null,
      assetId: body.assetId || null,
      vendorId: body.vendorId || null,
      name: body.name,
      milestoneType: body.milestoneType,
      owner: body.owner || null,
      priority: body.priority || "normal",
      status: body.status || "not_started",
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      completedDate: body.completedDate ? new Date(body.completedDate) : null,
      dependencyNotes: body.dependencyNotes || null,
      blockerReason: body.blockerReason || null,
      notes: body.notes || null,
    },
    include: { vendor: { select: { name: true } }, channel: { select: { channel: true } }, asset: { select: { name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "create_milestone",
      changes: {
        milestoneName: milestone.name,
        type: milestone.milestoneType,
        status: milestone.status,
      },
    },
  });

  return NextResponse.json(milestone, { status: 201 });
}
