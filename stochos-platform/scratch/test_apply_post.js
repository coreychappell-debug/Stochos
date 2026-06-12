const path = require('path');
require('dotenv').config();
const { prisma } = require('../lib/db');
const { acquireLock, releaseLock } = require('../lib/jobLock');

async function simulate() {
  console.log("Simulating territory apply POST logic...");
  const retailer = await prisma.crmRetailer.findFirst();
  const route = await prisma.crmRoute.findFirst();
  
  if (!retailer || !route) {
    console.error("Missing DB seed data.");
    return;
  }
  
  const userId = (await prisma.user.findFirst()).id;
  const lockKey = "fomo-territories-apply";
  
  console.log("Acquiring lock...");
  const lockResult = await acquireLock(lockKey, userId, "System", "Apply Territory Split", 60);
  console.log("Lock Result:", lockResult);
  
  if (!lockResult.success) {
    console.error("Lock collision!");
    return;
  }
  
  try {
    const action = "bulk";
    const assignments = { [retailer.id]: route.id };
    
    if (action === "bulk") {
      const retailerIds = Object.keys(assignments);
      
      console.log("Running transaction...");
      await prisma.$transaction(async (tx) => {
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

        console.log("Creating AuditLog...");
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
      console.log("Transaction succeeded!");
    }
  } catch (err) {
    console.error("Transaction failed with error:", err);
  } finally {
    console.log("Releasing lock...");
    await releaseLock(lockKey);
  }
}

simulate().finally(() => prisma.$disconnect());
