import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function POST(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { retailerIds, visitDate, notes } = await req.json();

    if (!retailerIds || !Array.isArray(retailerIds) || retailerIds.length === 0) {
      return NextResponse.json({ error: "Missing or invalid retailer IDs" }, { status: 400 });
    }

    const date = visitDate ? new Date(visitDate) : new Date();

    // Run within a database transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Create CrmVisit logs for each retailer in the batch
      const visitData = retailerIds.map((retailerId) => ({
        retailerId,
        userId: session.user.id,
        visitDate: date,
        status: "completed",
        notes: notes || "Automated batch logging from weekly routing planner."
      }));

      await tx.crmVisit.createMany({
        data: visitData
      });

      // 2. Update lastVisitDate on each CrmRetailer record
      await tx.crmRetailer.updateMany({
        where: {
          id: { in: retailerIds }
        },
        data: {
          lastVisitDate: date
        }
      });
    });

    return NextResponse.json({ success: true, count: retailerIds.length });
  } catch (error) {
    console.error("Batch visit logging failed:", error);
    return NextResponse.json({ error: "Internal server error during batch completion logging" }, { status: 500 });
  }
}
