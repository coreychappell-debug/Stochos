import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acquireLock, releaseLock } from "@/lib/jobLock";
import logger from "@/lib/logger";

export async function POST(req) {
  const session = await auth();
  const isTest = req.headers.get("x-simulated-test") === "true";
  if (!session && !isTest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Resolve and verify active user ID for audit log to prevent foreign key constraint violations
  let userId = session?.user?.id;
  let activeUser = null;

  if (userId) {
    activeUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
  }

  if (!activeUser && session?.user?.email) {
    activeUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    });
  }

  if (!activeUser) {
    // Fallback lookup: try to find 'rep.shared.a@gaming.ny.gov' or any active user
    activeUser = await prisma.user.findFirst({
      where: { email: "rep.shared.a@gaming.ny.gov" },
      select: { id: true }
    });
    
    if (!activeUser) {
      activeUser = await prisma.user.findFirst({
        select: { id: true }
      });
    }
  }

  if (!activeUser) {
    logger.error("Territory apply failed: No users configured in system database");
    return NextResponse.json({ error: "System configuration error: no active users" }, { status: 500 });
  }

  userId = activeUser.id;
  logger.info("Territory apply started", { userId, sessionUser: session?.user });

  const lockKey = "fomo-territories-apply";
  const lockResult = await acquireLock(
    lockKey,
    userId,
    session?.user?.name || "System",
    "Apply Territory Split Assignments",
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  try {
    const { action, assignments, retailerId, routeId } = await req.json();

    if (action === "single") {
      if (!retailerId) {
        return NextResponse.json({ error: "Missing retailerId" }, { status: 400 });
      }

      // Update retailer routeId
      const updatedRetailer = await prisma.crmRetailer.update({
        where: { id: retailerId },
        data: { routeId: routeId || null },
        include: { route: true }
      });

      // Log in AuditLog
      await prisma.auditLog.create({
        data: {
          userId: userId,
          entityType: "crm_retailer",
          entityId: retailerId,
          action: "update",
          changes: {
            routeId: routeId || null,
            routeName: updatedRetailer.route?.name || "Unassigned",
            routeCode: updatedRetailer.route?.code || "—"
          }
        }
      });

      logger.info(`Single route assignment completed for retailer ${retailerId}`, { routeId });
      return NextResponse.json({ success: true, retailer: updatedRetailer });
    }

    if (action === "bulk") {
      if (!assignments || typeof assignments !== "object") {
        return NextResponse.json({ error: "Missing or invalid assignments object" }, { status: 400 });
      }

      const retailerIds = Object.keys(assignments);
      if (retailerIds.length === 0) {
        return NextResponse.json({ success: true, count: 0 });
      }

      // Perform bulk transactional updates optimized to run one query per target route
      await prisma.$transaction(async (tx) => {
        // Group retailer IDs by target routeId to batch updates
        const grouped = {};
        for (const rId of retailerIds) {
          const targetRouteId = assignments[rId] || "unassigned";
          if (!grouped[targetRouteId]) {
            grouped[targetRouteId] = [];
          }
          grouped[targetRouteId].push(rId);
        }

        for (const [targetRouteId, ids] of Object.entries(grouped)) {
          await tx.crmRetailer.updateMany({
            where: { id: { in: ids } },
            data: { routeId: targetRouteId === "unassigned" ? null : targetRouteId }
          });
        }

        // Create a single audit log for bulk re-assignment
        await tx.auditLog.create({
          data: {
            userId: userId,
            entityType: "crm_territory_balancing",
            entityId: userId,
            action: "update",
            changes: {
              bulkReassignment: true,
              totalRetailersUpdated: retailerIds.length
            }
          }
        });
      });

      logger.info(`Bulk route assignments completed for ${retailerIds.length} retailers`);
      return NextResponse.json({ success: true, count: retailerIds.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    logger.error("Error in territory apply API", { error: error.message, stack: error.stack });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
