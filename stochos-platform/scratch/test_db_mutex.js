// scratch/test_db_mutex.js
// Standalone script to verify Stochos Platform's postgres-backed job locks

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../lib/db.js');
const { acquireLock, releaseLock, pruneExpiredLocks, getActiveLocks } = require('../lib/jobLock.js');

async function runTests() {
  console.log("==============================================================");
  console.log("STOCHOS PLATFORM: DATABASE MUTEX CONCURRENCY VERIFICATION TEST");
  console.log("==============================================================");

  const testKey = "test-concurrency-lock-key";

  // Resolve a valid user from the database to satisfy the AuditLog foreign key constraint
  const dbUser = await prisma.user.findFirst();
  if (!dbUser) {
    console.error("FAIL: No users found in the database. Cannot run tests because of foreign key constraints on AuditLog.");
    process.exit(1);
  }
  const userId = dbUser.id;
  const userName = dbUser.name;
  console.log(`Using database user for tests: ${userName} (ID: ${userId})`);

  try {
    // 1. Clean up any leftover test data
    console.log("\n[1/5] Cleaning up existing test locks...");
    await prisma.systemJobLock.deleteMany({
      where: { lockKey: testKey }
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: testKey }
    });
    console.log("Cleaned.");

    // 2. Test Lock Acquisition
    console.log("\n[2/5] Attempting to acquire lock for key:", testKey);
    const lockResult = await acquireLock(testKey, userId, userName, "Initial lock acquisition test", 120);
    
    if (lockResult.success) {
      console.log("Acquired successfully! ID:", lockResult.lock.id);
    } else {
      console.error("FAIL: Could not acquire lock:", lockResult);
      process.exit(1);
    }

    // 3. Test Concurrency Conflict (Atomic Mutex Safety Check)
    console.log("\n[3/5] Attempting to acquire duplicate lock (concurrency collision)...");
    const collisionResult = await acquireLock(testKey, "another-user-id", "Colliding User", "This should fail", 60);
    
    if (!collisionResult.success) {
      console.log("SUCCESS: Duplicate lock blocked by PostgreSQL unique constraint.");
      console.log("Active lock details returned:", collisionResult.activeLock.description);
    } else {
      console.error("FAIL: Duplicate lock was acquired! Concurrency check failed.");
      process.exit(1);
    }

    // 4. Test Timeout & Lazy Pruning Logic
    console.log("\n[4/5] Testing lazy pruning of expired locks...");
    // Let's modify the created lock to look like it was created in the past (e.g. 5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.systemJobLock.update({
      where: { lockKey: testKey },
      data: { createdAt: fiveMinutesAgo }
    });
    console.log("Mocked lock createdAt to 5 minutes ago.");

    // Run the actual prune logic from the library
    await pruneExpiredLocks();

    // Verify lock is deleted
    const activeLocks = await getActiveLocks();
    const activeLock = activeLocks.find(lock => lock.lockKey === testKey);
    if (!activeLock) {
      console.log("SUCCESS: Expired lock deleted from system_job_locks table.");
    } else {
      console.error("FAIL: Expired lock still exists!");
      process.exit(1);
    }

    // Verify AuditLog record was created
    const logCount = await prisma.auditLog.count({
      where: { entityId: testKey, action: 'job_timeout' }
    });
    if (logCount > 0) {
      console.log("SUCCESS: 'job_timeout' bug report written to AuditLog table.");
      const auditEntry = await prisma.auditLog.findFirst({
        where: { entityId: testKey, action: 'job_timeout' }
      });
      console.log("Audit log details:", auditEntry.changes);
    } else {
      console.error("FAIL: Audit log entry not written!");
      process.exit(1);
    }

    // 5. Test Lock Release
    console.log("\n[5/5] Re-acquiring and testing clean release...");
    const reAcquireResult = await acquireLock(testKey, userId, userName, "Re-acquisition test", 60);
    if (!reAcquireResult.success) {
      console.error("FAIL: Could not re-acquire lock for release test:", reAcquireResult);
      process.exit(1);
    }

    const released = await releaseLock(testKey);
    if (released) {
      console.log("SUCCESS: Lock released cleanly returned true.");
    } else {
      console.error("FAIL: releaseLock returned false.");
      process.exit(1);
    }

    const finalLockCheck = await prisma.systemJobLock.findUnique({
      where: { lockKey: testKey }
    });
    if (!finalLockCheck) {
      console.log("SUCCESS: Lock row deleted from database.");
    } else {
      console.error("FAIL: Lock row still exists in database after release.");
      process.exit(1);
    }

    console.log("\n==============================================================");
    console.log("ALL TEST CASES PASSED SUCCESSFULLY!");
    console.log("==============================================================");

  } catch (error) {
    console.error("Test execution failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

