import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { folderName, audits } = body;

    if (!Array.isArray(audits) || audits.length === 0) {
      return NextResponse.json({ error: "No audits provided" }, { status: 400 });
    }

    // Process inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the AssetAuditBatch parent record
      const batch = await tx.assetAuditBatch.create({
        data: {
          folderName: folderName || null,
          fileCount: 0,
          userId: session.user.id,
          status: "completed",
        },
      });

      let registeredCount = 0;
      let skippedCount = 0;

      for (const item of audits) {
        const {
          assetId,
          latitude,
          longitude,
          auditedAt,
          fileSignature,
          isManual,
          retailerId,
          originalFilename,
          fileSize,
          verificationStatus,
        } = item;

        if (!assetId || !auditedAt || !fileSignature) {
          skippedCount++;
          continue;
        }

        const auditDate = new Date(auditedAt);
        if (isNaN(auditDate.getTime())) {
          skippedCount++;
          continue;
        }

        // Check duplicate signature
        const duplicateSignature = await tx.assetAuditLog.findFirst({
          where: {
            assetId,
            fileSignature,
          },
        });
        if (duplicateSignature) {
          skippedCount++;
          continue;
        }

        // Check wave conflict (same month)
        const startOfMonth = new Date(auditDate.getFullYear(), auditDate.getMonth(), 1);
        const endOfMonth = new Date(auditDate.getFullYear(), auditDate.getMonth() + 1, 0, 23, 59, 59, 999);

        const duplicatePeriod = await tx.assetAuditLog.findFirst({
          where: {
            assetId,
            auditedAt: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
          },
        });
        if (duplicatePeriod) {
          skippedCount++;
          continue;
        }

        // Create log
        await tx.assetAuditLog.create({
          data: {
            assetId,
            batchId: batch.id,
            retailerId: retailerId || null,
            auditedAt: auditDate,
            latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
            longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
            isManual: !!isManual,
            fileSignature,
            originalFilename: originalFilename || null,
            fileSize: fileSize !== undefined && fileSize !== null ? parseInt(fileSize) : null,
            userId: session.user.id,
            verificationStatus: verificationStatus || "fully_verified",
          },
        });

        // Update parent Asset
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
          where: { id: assetId },
          data: updateData,
        });

        // Create System Audit Log
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            entityType: "asset",
            entityId: assetId,
            action: "asset_audit_registered",
            changes: {
              auditedAt: auditDate.toISOString(),
              latitude: latitude !== undefined && latitude !== null ? parseFloat(latitude) : null,
              longitude: longitude !== undefined && longitude !== null ? parseFloat(longitude) : null,
              retailerId: retailerId || null,
              isManual: !!isManual,
              fileSignature,
              originalFilename,
              batchId: batch.id,
            },
          },
        });

        registeredCount++;
      }

      // Update the batch's final file count
      await tx.assetAuditBatch.update({
        where: { id: batch.id },
        data: {
          fileCount: registeredCount,
        },
      });

      return {
        batchId: batch.id,
        registeredCount,
        skippedCount,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
