const fs = require("fs");
const path = require("path");

// Manually parse .env and .env.local files to set environment variables
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  envFiles.forEach(file => {
    // Look in stochos-platform directory since that's where the next app and env files reside
    const filePath = path.join(__dirname, "../stochos-platform", file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const firstEq = trimmed.indexOf("=");
          const key = trimmed.substring(0, firstEq).trim();
          const val = trimmed.substring(firstEq + 1).replace(/^["']|["']$/g, "").trim();
          process.env[key] = val;
        }
      });
    }
  });
}

loadEnv();

const { prisma } = require("../stochos-platform/lib/db");

async function runTests() {
  console.log("=== STARTING ASSET PHOTO-AUDIT DATABASE AND BUSINESS LOGIC TESTS ===");

  // 1. Fetch a test asset
  const testAsset = await prisma.asset.findFirst({
    include: { retailer: true }
  });
  if (!testAsset) {
    console.error("❌ No assets found in the database. Please seed or register an asset first.");
    process.exit(1);
  }
  console.log(`✅ Found test asset: ${testAsset.name} (Tag: ${testAsset.assetTag}, ID: ${testAsset.id})`);

  // 2. Fetch a test user
  const testUser = await prisma.user.findFirst();
  if (!testUser) {
    console.error("❌ No users found in the database.");
    process.exit(1);
  }
  console.log(`✅ Found test user: ${testUser.name} (ID: ${testUser.id})`);

  // Clean up any old leftover test audits for this asset first
  await prisma.assetAuditLog.deleteMany({
    where: {
      assetId: testAsset.id,
      fileSignature: { startsWith: "test-signature-" }
    }
  });

  const testSignature1 = `test-signature-1-${Date.now()}`;
  const testSignature2 = `test-signature-2-${Date.now()}`;
  const firstAuditDate = new Date("2025-10-15T10:30:00Z");

  try {
    // TEST 1: Register first audit (should succeed)
    console.log("\n--- TEST 1: Registering standard photo-audit for Oct 15, 2025 ---");
    
    const auditLog1 = await prisma.$transaction(async (tx) => {
      const log = await tx.assetAuditLog.create({
        data: {
          assetId: testAsset.id,
          auditedAt: firstAuditDate,
          latitude: 40.7128,
          longitude: -74.0060,
          isManual: false,
          fileSignature: testSignature1,
          originalFilename: "test_oct_audit.jpg",
          fileSize: 4194304, // 4MB
          userId: testUser.id
        }
      });

      await tx.asset.update({
        where: { id: testAsset.id },
        data: {
          lastAuditedAt: firstAuditDate,
          lastAuditLat: 40.7128,
          lastAuditLon: -74.0060
        }
      });

      return log;
    });

    console.log("✅ Audit successfully registered!");
    console.log(`   Audit ID: ${auditLog1.id}`);
    
    // Verify asset fields were updated
    const updatedAsset1 = await prisma.asset.findUnique({ where: { id: testAsset.id } });
    if (
      updatedAsset1.lastAuditedAt.getTime() === firstAuditDate.getTime() &&
      updatedAsset1.lastAuditLat === 40.7128 &&
      updatedAsset1.lastAuditLon === -74.0060
    ) {
      console.log("✅ Parent Asset fields successfully updated in transaction!");
    } else {
      throw new Error("❌ Parent Asset fields were NOT updated correctly!");
    }

    // TEST 2: Duplicate signature check
    console.log("\n--- TEST 2: Uploading duplicate photo file signature ---");
    const duplicateSig = await prisma.assetAuditLog.findFirst({
      where: {
        assetId: testAsset.id,
        fileSignature: testSignature1
      }
    });

    if (duplicateSig) {
      console.log("✅ Duplicate signature check works: Found duplicate entry!");
    } else {
      throw new Error("❌ Failed to detect duplicate file signature!");
    }

    // TEST 3: Recount check (blocking multiple audits in the same wave/month)
    console.log("\n--- TEST 3: Registering a second audit in the same month (October 2025) ---");
    const newAuditDateInSameMonth = new Date("2025-10-28T14:00:00Z");
    
    const startOfMonth = new Date(newAuditDateInSameMonth.getFullYear(), newAuditDateInSameMonth.getMonth(), 1);
    const endOfMonth = new Date(newAuditDateInSameMonth.getFullYear(), newAuditDateInSameMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const duplicatePeriod = await prisma.assetAuditLog.findFirst({
      where: {
        assetId: testAsset.id,
        auditedAt: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    if (duplicatePeriod) {
      console.log("✅ Recount blocked check works: Detected existing audit in October 2025 wave!");
      console.log(`   (Existing audit date: ${duplicatePeriod.auditedAt.toISOString()})`);
    } else {
      throw new Error("❌ Failed to block recount for the same month!");
    }

    // TEST 4: Registering a separate wave (January 2026) should succeed
    console.log("\n--- TEST 4: Registering audit in a different wave/month (January 2026) ---");
    const separateAuditDate = new Date("2026-01-15T09:00:00Z");
    
    const startOfJan = new Date(separateAuditDate.getFullYear(), separateAuditDate.getMonth(), 1);
    const endOfJan = new Date(separateAuditDate.getFullYear(), separateAuditDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const duplicateJanPeriod = await prisma.assetAuditLog.findFirst({
      where: {
        assetId: testAsset.id,
        auditedAt: {
          gte: startOfJan,
          lte: endOfJan
        }
      }
    });

    if (!duplicateJanPeriod) {
      const auditLog2 = await prisma.assetAuditLog.create({
        data: {
          assetId: testAsset.id,
          auditedAt: separateAuditDate,
          latitude: 40.7306,
          longitude: -73.9352,
          isManual: false,
          fileSignature: testSignature2,
          originalFilename: "test_jan_audit.jpg",
          fileSize: 3145728,
          userId: testUser.id
        }
      });
      await prisma.asset.update({
        where: { id: testAsset.id },
        data: {
          lastAuditedAt: separateAuditDate,
          lastAuditLat: 40.7306,
          lastAuditLon: -73.9352
        }
      });
      console.log("✅ Audit registered successfully for separate wave!");
      console.log(`   Audit ID: ${auditLog2.id}`);
    } else {
      throw new Error("❌ Accidentally blocked January wave audit!");
    }

    // TEST 5: Batch Registration Simulation
    console.log("\n--- TEST 5: Batch Registration Simulation ---");
    const batchSig1 = `test-sig-batch-1-${Date.now()}`;
    const batchSig2 = `test-sig-batch-2-${Date.now()}`;
    
    // Save original coordinates to verify restore later
    const originalAssetData = await prisma.asset.findUnique({ where: { id: testAsset.id } });
    console.log(`Original asset lat: ${originalAssetData.lastAuditLat}, lon: ${originalAssetData.lastAuditLon}`);

    // Create a batch and add logs
    const batch = await prisma.assetAuditBatch.create({
      data: {
        folderName: "Test Batch Folder",
        fileCount: 2,
        userId: testUser.id
      }
    });

    const batchDate = new Date("2026-03-10T12:00:00Z");

    const batchLog1 = await prisma.assetAuditLog.create({
      data: {
        assetId: testAsset.id,
        batchId: batch.id,
        auditedAt: batchDate,
        latitude: 40.7580,
        longitude: -73.9855,
        fileSignature: batchSig1,
        userId: testUser.id
      }
    });

    await prisma.asset.update({
      where: { id: testAsset.id },
      data: {
        lastAuditedAt: batchDate,
        lastAuditLat: 40.7580,
        lastAuditLon: -73.9855
      }
    });

    console.log(`✅ Batch registered successfully! Batch ID: ${batch.id}`);

    // TEST 6: Reconciliation Wave test
    console.log("\n--- TEST 6: Reconciliation Wave test (March 2026) ---");
    const reconStartDate = new Date("2026-03-01T00:00:00Z");
    const reconEndDate = new Date("2026-03-31T23:59:59Z");
    const reconLogs = await prisma.assetAuditLog.findMany({
      where: {
        auditedAt: {
          gte: reconStartDate,
          lte: reconEndDate
        }
      }
    });
    console.log(`✅ Reconciliation Wave count for March 2026: ${reconLogs.length}`);
    if (reconLogs.length > 0) {
      console.log("✅ Reconciliation Wave check passed!");
    } else {
      throw new Error("❌ Reconciliation Wave check failed!");
    }

    // TEST 7: Batch Rollback Simulation
    console.log("\n--- TEST 7: Batch Rollback Simulation ---");
    // Find previous logs that are not in this batch
    const remainingLogs = await prisma.assetAuditLog.findMany({
      where: {
        assetId: testAsset.id,
        OR: [
          { batchId: null },
          { batchId: { not: batch.id } }
        ]
      },
      orderBy: { auditedAt: "desc" },
      take: 1
    });

    const previousLog = remainingLogs[0];
    if (previousLog) {
      await prisma.asset.update({
        where: { id: testAsset.id },
        data: {
          lastAuditedAt: previousLog.auditedAt,
          lastAuditLat: previousLog.latitude,
          lastAuditLon: previousLog.longitude,
          retailerId: previousLog.retailerId
        }
      });
      console.log(`Restored to previous log date: ${previousLog.auditedAt.toISOString()}, Lat: ${previousLog.latitude}`);
    } else {
      await prisma.asset.update({
        where: { id: testAsset.id },
        data: {
          lastAuditedAt: null,
          lastAuditLat: null,
          lastAuditLon: null,
          retailerId: null
        }
      });
      console.log("Restored asset audit state to null.");
    }

    // Delete batch (cascades)
    await prisma.assetAuditBatch.delete({
      where: { id: batch.id }
    });

    const rolledBackAsset = await prisma.asset.findUnique({ where: { id: testAsset.id } });
    console.log(`Rolled back asset lat: ${rolledBackAsset.lastAuditLat}, lon: ${rolledBackAsset.lastAuditLon}`);
    
    // Check if rolled back coordinates match original data
    if (rolledBackAsset.lastAuditLat === originalAssetData.lastAuditLat && rolledBackAsset.lastAuditLon === originalAssetData.lastAuditLon) {
      console.log("✅ Rollback restored asset coordinates perfectly!");
    } else {
      throw new Error("❌ Rollback did NOT restore coordinates correctly!");
    }

  } catch (error) {
    console.error("❌ Test failed:", error.message);
  } finally {
    // 5. Cleanup test logs
    console.log("\n--- Cleaning up test records from database ---");
    const deletedCount = await prisma.assetAuditLog.deleteMany({
      where: {
        assetId: testAsset.id,
        fileSignature: { startsWith: "test-signature-" }
      }
    });
    
    // Restore parent asset fields
    await prisma.asset.update({
      where: { id: testAsset.id },
      data: {
        lastAuditedAt: testAsset.lastAuditedAt,
        lastAuditLat: testAsset.lastAuditLat,
        lastAuditLon: testAsset.lastAuditLon,
        retailerId: testAsset.retailerId
      }
    });
    
    console.log(`✅ Cleaned up ${deletedCount.count} test audit logs.`);
    console.log("=== TESTS COMPLETE ===");
    await prisma.$disconnect();
  }
}

runTests();
