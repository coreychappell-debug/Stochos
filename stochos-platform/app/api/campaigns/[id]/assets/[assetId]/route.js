import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, assetId } = await params;
  const body = await request.json();

  const before = await prisma.campaignAsset.findUnique({ where: { id: assetId } });
  
  const data = {
    name: body.name,
    assetType: body.assetType,
    formatSpecs: body.formatSpecs,
    language: body.language,
    status: body.status,
    approvalStatus: body.approvalStatus,
    reviewOwner: body.reviewOwner,
    dueDate: body.dueDate !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
    launchDate: body.launchDate !== undefined ? (body.launchDate ? new Date(body.launchDate) : null) : undefined,
    expirationDate: body.expirationDate !== undefined ? (body.expirationDate ? new Date(body.expirationDate) : null) : undefined,
    usageRightsExpiration: body.usageRightsExpiration !== undefined ? (body.usageRightsExpiration ? new Date(body.usageRightsExpiration) : null) : undefined,
    assetUrl: body.assetUrl,
    version: body.version,
    complianceNotes: body.complianceNotes,
    notes: body.notes,
  };

  if (body.channelId !== undefined) data.channelId = body.channelId || null;
  if (body.vendorId !== undefined) data.vendorId = body.vendorId || null;

  const asset = await prisma.campaignAsset.update({
    where: { id: assetId },
    data,
    include: { vendor: { select: { name: true } }, channel: { select: { channel: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "update_asset",
      changes: {
        assetName: asset.name,
        before: { status: before.status, approvalStatus: before.approvalStatus, version: before.version },
        after: { status: asset.status, approvalStatus: asset.approvalStatus, version: asset.version },
      },
    },
  });

  return NextResponse.json(asset);
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, assetId } = await params;

  const asset = await prisma.campaignAsset.findUnique({ where: { id: assetId } });

  await prisma.campaignAsset.delete({ where: { id: assetId } });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "delete_asset",
      changes: { assetName: asset?.name },
    },
  });

  return NextResponse.json({ success: true });
}
