import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// GET: Retrieve batch history
export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const batches = await prisma.assetAuditBatch.findMany({
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { uploadedAt: "desc" },
    });

    return NextResponse.json(batches);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Rollback a batch
export async function DELETE(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId");

  if (!batchId) {
    return NextResponse.json({ error: "batchId parameter is required" }, { status: 400 });
  }

  try {
    // Check role permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const canRollback = user && (
      user.role.name.toLowerCase() === "admin" ||
      user.role.name.toLowerCase() === "manager" ||
      user.division === "OPERATIONS"
    );

    if (!canRollback) {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators or Operations Managers can roll back batches" },
        { status: 403 }
      );
    }

    const batch = await prisma.assetAuditBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    // Run rollback inside a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find all audit logs in this batch
      const logs = await tx.assetAuditLog.findMany({
        where: { batchId: batch.id },
      });

      // 2. Rollback each asset to its state before this batch
      for (const log of logs) {
        const remainingLogs = await tx.assetAuditLog.findMany({
          where: {
            assetId: log.assetId,
            OR: [
              { batchId: null },
              { batchId: { not: batch.id } }
            ]
          },
          orderBy: { auditedAt: "desc" },
          take: 1,
        });

        const previousLog = remainingLogs[0];

        if (previousLog) {
          await tx.asset.update({
            where: { id: log.assetId },
            data: {
              lastAuditedAt: previousLog.auditedAt,
              lastAuditLat: previousLog.latitude,
              lastAuditLon: previousLog.longitude,
              retailerId: previousLog.retailerId,
            },
          });
        } else {
          await tx.asset.update({
            where: { id: log.assetId },
            data: {
              lastAuditedAt: null,
              lastAuditLat: null,
              lastAuditLon: null,
              retailerId: null,
            },
          });
        }
      }

      // 3. Delete the AssetAuditBatch (cascades to delete all child AssetAuditLog entries)
      await tx.assetAuditBatch.delete({
        where: { id: batch.id },
      });

      // 4. Create system audit log entry
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "asset_batch",
          entityId: batch.id,
          action: "batch_rollback",
          changes: {
            batchId: batch.id,
            folderName: batch.folderName,
            fileCount: batch.fileCount,
          },
        },
      });

      return { success: true, fileCount: batch.fileCount };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
