import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { assetIds, updateData } = body;

    if (!Array.isArray(assetIds) || assetIds.length === 0) {
      return NextResponse.json({ error: "Invalid payload. Expected non-empty assetIds array." }, { status: 400 });
    }

    if (!updateData || typeof updateData !== "object") {
      return NextResponse.json({ error: "Invalid payload. Expected updateData object." }, { status: 400 });
    }

    // Clean and validate update fields
    const allowedFields = ["status", "assignedToId", "retailerId", "orgUnitId", "notes"];
    const prismaUpdate = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        prismaUpdate[field] = updateData[field] === "" ? null : updateData[field];
      }
    });

    if (Object.keys(prismaUpdate).length === 0) {
      return NextResponse.json({ error: "No valid update fields provided." }, { status: 400 });
    }

    // Wrap the bulk updates inside a single database transaction block
    await prisma.$transaction(async (tx) => {
      for (const id of assetIds) {
        await tx.asset.update({
          where: { id },
          data: prismaUpdate,
        });
      }
    });

    // Log the bulk update action in the Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
        entityId: "bulk",
        action: "bulk_update",
        changes: { count: assetIds.length, fields: Object.keys(prismaUpdate) },
      },
    });

    return NextResponse.json({ success: true, count: assetIds.length });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
