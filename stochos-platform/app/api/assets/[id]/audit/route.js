import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: Fetch the audit history for a specific asset
export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const logs = await prisma.assetAuditLog.findMany({
      where: { assetId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        retailer: { select: { id: true, name: true, externalId: true } },
      },
      orderBy: { auditedAt: "desc" },
    });

    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Register a new photo-audit or manual audit
export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      latitude,
      longitude,
      auditedAt,
      fileSignature,
      isManual,
      retailerId,
      originalFilename,
      fileSize,
    } = body;

    if (!auditedAt || !fileSignature) {
      return NextResponse.json(
        { error: "Audit timestamp and file signature are required" },
        { status: 400 }
      );
    }

    const auditDate = new Date(auditedAt);
    if (isNaN(auditDate.getTime())) {
      return NextResponse.json({ error: "Invalid audit timestamp" }, { status: 400 });
    }

    // 1. Verify the asset exists
    const asset = await prisma.asset.findUnique({
      where: { id },
    });
    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // 2. Double-Count Check: File Signature uniqueness
    const duplicateSignature = await prisma.assetAuditLog.findFirst({
      where: {
        assetId: id,
        fileSignature,
      },
    });
    if (duplicateSignature) {
      return NextResponse.json(
        { error: "Duplicate Blocked: This photo file has already been uploaded for this asset." },
        { status: 409 }
      );
    }

    // 3. Recount Check: Verification Wave period uniqueness
    // Check if an audit exists within the same calendar month/period (verification wave)
    const startOfMonth = new Date(auditDate.getFullYear(), auditDate.getMonth(), 1);
    const endOfMonth = new Date(auditDate.getFullYear(), auditDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const duplicatePeriod = await prisma.assetAuditLog.findFirst({
      where: {
        assetId: id,
        auditedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    if (duplicatePeriod) {
      const monthName = auditDate.toLocaleString("en-US", { month: "long", year: "numeric" });
      return NextResponse.json(
        { error: `Double-Count Blocked: This asset already has an audit recorded for the ${monthName} verification wave.` },
        { status: 409 }
      );
    }

    // 4. Perform the registration in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the AssetAuditLog record
      const log = await tx.assetAuditLog.create({
        data: {
          assetId: id,
          retailerId: retailerId || null,
          auditedAt: auditDate,
          latitude: latitude !== undefined ? parseFloat(latitude) : null,
          longitude: longitude !== undefined ? parseFloat(longitude) : null,
          isManual: !!isManual,
          fileSignature,
          originalFilename: originalFilename || null,
          fileSize: fileSize !== undefined ? parseInt(fileSize) : null,
          userId: session.user.id,
        },
        include: {
          user: { select: { name: true } },
          retailer: { select: { name: true } },
        },
      });

      // Update the parent Asset model
      const updateData = {
        lastAuditedAt: auditDate,
      };
      if (latitude !== undefined && latitude !== null) {
        updateData.lastAuditLat = parseFloat(latitude);
      }
      if (longitude !== undefined && longitude !== null) {
        updateData.lastAuditLon = parseFloat(longitude);
      }
      if (retailerId) {
        updateData.retailerId = retailerId;
      }

      await tx.asset.update({
        where: { id },
        data: updateData,
      });

      // Write to systemic AuditLog
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "asset",
          entityId: id,
          action: "asset_audit_registered",
          changes: {
            auditedAt: auditDate.toISOString(),
            latitude: latitude !== undefined ? parseFloat(latitude) : null,
            longitude: longitude !== undefined ? parseFloat(longitude) : null,
            retailerId: retailerId || null,
            isManual: !!isManual,
            fileSignature,
            originalFilename,
          },
        },
      });

      return log;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
