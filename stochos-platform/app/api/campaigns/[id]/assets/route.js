import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const asset = await prisma.campaignAsset.create({
    data: {
      campaignId: id,
      channelId: body.channelId || null,
      vendorId: body.vendorId || null,
      name: body.name,
      assetType: body.assetType,
      formatSpecs: body.formatSpecs || null,
      language: body.language || "English",
      status: body.status || "draft",
      approvalStatus: body.approvalStatus || null,
      reviewOwner: body.reviewOwner || null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      launchDate: body.launchDate ? new Date(body.launchDate) : null,
      expirationDate: body.expirationDate ? new Date(body.expirationDate) : null,
      usageRightsExpiration: body.usageRightsExpiration ? new Date(body.usageRightsExpiration) : null,
      assetUrl: body.assetUrl || null,
      version: body.version || "v1",
      complianceNotes: body.complianceNotes || null,
      notes: body.notes || null,
    },
    include: { vendor: { select: { name: true } }, channel: { select: { channel: true } } },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "campaign",
      entityId: id,
      action: "create_asset",
      changes: {
        assetName: asset.name,
        type: asset.assetType,
        status: asset.status,
      },
    },
  });

  return NextResponse.json(asset, { status: 201 });
}
