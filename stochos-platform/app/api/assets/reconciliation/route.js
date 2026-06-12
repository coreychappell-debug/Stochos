import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const wave = searchParams.get("wave"); // YYYY-MM

  if (!wave || !/^\d{4}-\d{2}$/.test(wave)) {
    return NextResponse.json({ error: "Valid wave parameter YYYY-MM is required" }, { status: 400 });
  }

  try {
    const [year, month] = wave.split("-").map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const logs = await prisma.assetAuditLog.findMany({
      where: {
        auditedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: { select: { name: true } },
        retailer: { select: { name: true } },
      },
      orderBy: {
        auditedAt: "desc", // Get the most recent audit for the asset in this wave
      },
    });

    const mapping = {};
    for (const log of logs) {
      if (!mapping[log.assetId]) {
        mapping[log.assetId] = {
          id: log.id,
          auditedAt: log.auditedAt.toISOString(),
          latitude: log.latitude,
          longitude: log.longitude,
          retailerName: log.retailer?.name || null,
          retailerId: log.retailerId || null,
          userName: log.user?.name || "System",
          isManual: log.isManual,
          verificationStatus: log.verificationStatus,
        };
      }
    }

    return NextResponse.json(mapping);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
