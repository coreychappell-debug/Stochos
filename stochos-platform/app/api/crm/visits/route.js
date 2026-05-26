import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "10");
  const retailerId = searchParams.get("retailerId");

  const where = {};
  if (retailerId) where.retailerId = retailerId;

  try {
    const visits = await prisma.crmVisit.findMany({
      where,
      include: {
        retailer: { select: { name: true, city: true, externalId: true } },
        user: { select: { name: true } },
        _count: { select: { verifications: true } }
      },
      orderBy: { visitDate: "desc" },
      take: limit
    });

    return NextResponse.json(visits);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const {
      retailerId,
      visitDate,
      checkInTime,
      checkOutTime,
      notes,
      coaching,
      merchandising,
      process: processLog,
      verifications,
      completedActionItemIds
    } = body;

    if (!retailerId) {
      return NextResponse.json({ error: "Retailer ID is required" }, { status: 400 });
    }

    // Wrap everything in a transaction to guarantee atomic execution
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the visit header
      const visit = await tx.crmVisit.create({
        data: {
          retailerId,
          userId: session.user.id,
          visitDate: new Date(visitDate),
          checkInTime: checkInTime ? new Date(checkInTime) : null,
          checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
          status: "completed",
          notes,
          syncStatus: "synced"
        }
      });

      // 2. Create Coaching details if provided
      if (coaching) {
        await tx.crmCoaching.create({
          data: {
            visitId: visit.id,
            askForTheSaleTrained: !!coaching.askForTheSaleTrained,
            personnelTrainedCount: parseInt(coaching.personnelTrainedCount || "0"),
            coachingFeedback: coaching.coachingFeedback || null,
            actionPlan: coaching.actionPlan || null
          }
        });

        // If trained, update retailer training status
        if (coaching.askForTheSaleTrained) {
          await tx.crmRetailer.update({
            where: { id: retailerId },
            data: { 
              trainingStatus: "trained",
              lastVisitDate: new Date(visitDate)
            }
          });
        }
      }

      // 3. Create Merchandising details if provided
      if (merchandising) {
        await tx.crmMerchandising.create({
          data: {
            visitId: visit.id,
            dispensersCleanAndFilled: !!merchandising.dispensersCleanAndFilled,
            posSignageVisible: !!merchandising.posSignageVisible,
            ticketInventoryAdequate: !!merchandising.ticketInventoryAdequate,
            merchandisingFeedback: merchandising.merchandisingFeedback || null
          }
        });
      }

      // 4. Create Process details if provided
      if (processLog) {
        await tx.crmProcessImprovement.create({
          data: {
            visitId: visit.id,
            salesTrendReviewed: !!processLog.salesTrendReviewed,
            outOfStockPrevented: !!processLog.outOfStockPrevented,
            optimalLayoutApplied: !!processLog.optimalLayoutApplied,
            targetSalesGrowth: processLog.targetSalesGrowth ? parseFloat(processLog.targetSalesGrowth) : null,
            improvementFeedback: processLog.improvementFeedback || null
          }
        });
      }

      // 5. Create Asset Verifications & Discrepancies
      if (verifications && Array.isArray(verifications)) {
        for (const ver of verifications) {
          await tx.crmAssetVerification.create({
            data: {
              visitId: visit.id,
              assetAssignmentId: ver.assetAssignmentId,
              observedStatus: ver.observedStatus, // 'present', 'missing', 'incorrect_placement'
              isDisputed: !!ver.isDisputed,
              notes: ver.notes || null
            }
          });

          // Update assignment last verified date
          await tx.crmAssetAssignment.update({
            where: { id: ver.assetAssignmentId },
            data: { lastVerifiedAt: new Date(visitDate) }
          });

          // Auto-generate Discrepancy Exception if missing
          if (ver.observedStatus === "missing") {
            const assignment = await tx.crmAssetAssignment.findUnique({
              where: { id: ver.assetAssignmentId },
              include: { asset: { include: { type: true } } }
            });

            const assetName = assignment?.asset?.type?.name || "Equipment";
            const serial = assignment?.asset?.serialNumber || "N/A";

            await tx.crmDiscrepancyException.create({
              data: {
                retailerId,
                visitId: visit.id,
                assetAssignmentId: ver.assetAssignmentId,
                title: `Missing Asset: ${assetName} (S/N: ${serial})`,
                description: ver.notes || `Asset ${assetName} marked missing during audit on ${new Date(visitDate).toLocaleDateString()}.`,
                status: "open"
              }
            });

            // Set retailer status to warning if it is not already suspended
            const store = await tx.crmRetailer.findUnique({ where: { id: retailerId } });
            if (store && store.status === "active") {
              await tx.crmRetailer.update({
                where: { id: retailerId },
                data: { status: "warning" }
              });
            }
          }
        }
      }

      // Also update the retailer's lastVisitDate on general visit logging
      await tx.crmRetailer.update({
        where: { id: retailerId },
        data: { lastVisitDate: new Date(visitDate) }
      });

      // 5.5 Update completed action items if checked off
      if (completedActionItemIds && Array.isArray(completedActionItemIds)) {
        for (const itemId of completedActionItemIds) {
          await tx.crmActionItem.update({
            where: { id: itemId },
            data: {
              status: "completed",
              visitId: visit.id
            }
          });
        }
      }

      // 6. Write Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_visit",
          entityId: visit.id,
          action: "create",
          changes: { createdVisitId: visit.id }
        }
      });

      return visit;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
