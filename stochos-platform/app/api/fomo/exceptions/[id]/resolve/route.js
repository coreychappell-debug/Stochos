import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Await the routing parameters
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the exception
      const exception = await tx.crmDiscrepancyException.findUnique({
        where: { id }
      });

      if (!exception) {
        throw new Error("Discrepancy exception not found.");
      }

      if (exception.status === "resolved") {
        return exception;
      }

      // 2. Mark exception resolved
      const updatedException = await tx.crmDiscrepancyException.update({
        where: { id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          resolvedById: session.user.id
        }
      });

      // 3. Check if retailer has other open exceptions
      const remainingOpenCount = await tx.crmDiscrepancyException.count({
        where: {
          retailerId: exception.retailerId,
          status: "open"
        }
      });

      // If no other open exceptions, restore retailer status to active
      if (remainingOpenCount === 0) {
        const store = await tx.crmRetailer.findUnique({
          where: { id: exception.retailerId }
        });

        if (store && store.status === "warning") {
          await tx.crmRetailer.update({
            where: { id: exception.retailerId },
            data: { status: "active" }
          });
        }
      }

      // 4. Create Audit Log entry
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_exception",
          entityId: exception.id,
          action: "approve", // mapping resolve to approve
          changes: { resolved: true }
        }
      });

      return updatedException;
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
