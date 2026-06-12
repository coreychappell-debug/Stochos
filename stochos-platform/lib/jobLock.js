// lib/jobLock.js
const { prisma } = require('./db');
const crypto = require('crypto');

function mapLockRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    lockKey: row.lock_key,
    userId: row.user_id,
    userName: row.user_name,
    description: row.description,
    maxDurationSeconds: row.max_duration_seconds,
    createdAt: new Date(row.created_at)
  };
}

/**
 * Checks for any active locks that have exceeded their maxDurationSeconds,
 * deletes them, and writes a warning to the server console and AuditLog.
 */
async function pruneExpiredLocks() {
  try {
    const now = new Date();
    // Query system_job_locks using raw SQL
    const rows = await prisma.$queryRawUnsafe('SELECT * FROM system_job_locks');
    const locks = rows.map(mapLockRow);

    for (const lock of locks) {
      const createdAt = new Date(lock.createdAt);
      const expiresAt = new Date(createdAt.getTime() + lock.maxDurationSeconds * 1000);

      if (now > expiresAt) {
        console.warn(`[jobLock] Job lock "${lock.lockKey}" has expired (Timeout: ${lock.maxDurationSeconds}s). Pruning...`);

        // Validate that lock.userId exists in User table to satisfy the AuditLog foreign key constraint
        let auditUserId = lock.userId;
        const userExists = await prisma.user.findUnique({
          where: { id: auditUserId },
          select: { id: true }
        });

        if (!userExists) {
          const defaultUser = await prisma.user.findFirst({
            select: { id: true }
          });
          if (defaultUser) {
            auditUserId = defaultUser.id;
          } else {
            console.error(`[jobLock] No users exist in the database. Cannot create AuditLog entry for pruned lock "${lock.lockKey}".`);
            await prisma.$executeRaw`DELETE FROM system_job_locks WHERE id = ${lock.id}`;
            continue;
          }
        }

        // Transaction to delete lock and write a bug report to the AuditLog table
        await prisma.$transaction([
          prisma.$executeRaw`DELETE FROM system_job_locks WHERE id = ${lock.id}`,
          prisma.auditLog.create({
            data: {
              userId: auditUserId,
              entityType: 'SystemJobLock',
              entityId: lock.lockKey,
              action: 'job_timeout',
              changes: JSON.stringify({
                originalUserId: lock.userId,
                message: `Job ${lock.lockKey} exceeded its timeout limit of ${lock.maxDurationSeconds}s and was automatically terminated.`,
                startedAt: lock.createdAt.toISOString(),
                userName: lock.userName,
                description: lock.description,
                prunedAt: now.toISOString()
              })
            }
          })
        ]);
      }
    }
  } catch (err) {
    console.error('[jobLock] Failed to prune expired locks:', err);
  }
}

/**
 * Attempts to acquire a job lock by inserting a row in PostgreSQL.
 * If another request has already locked the key, returns failure.
 */
async function acquireLock(lockKey, userId, userName, description = '', maxDurationSeconds = 60) {
  // Prune any expired/hung locks first
  await pruneExpiredLocks();

  try {
    const id = crypto.randomUUID();
    await prisma.$executeRaw`
      INSERT INTO system_job_locks (id, lock_key, user_id, user_name, description, max_duration_seconds, created_at)
      VALUES (${id}, ${lockKey}, ${userId}, ${userName}, ${description}, ${maxDurationSeconds}, NOW())
    `;
    const lock = {
      id,
      lockKey,
      userId,
      userName,
      description,
      maxDurationSeconds,
      createdAt: new Date()
    };
    return { success: true, lock };
  } catch (err) {
    // Unique constraint violation code in PostgreSQL is 23505, or Prisma's P2002
    if (err.code === 'P2002' || err.message.includes('23505') || err.message.includes('unique constraint') || err.message.includes('Unique constraint')) {
      const rows = await prisma.$queryRaw`SELECT * FROM system_job_locks WHERE lock_key = ${lockKey}`;
      const activeLock = rows.length > 0 ? mapLockRow(rows[0]) : null;
      return { success: false, activeLock };
    }
    console.error(`[jobLock] Exception during acquireLock for key "${lockKey}":`, err);
    throw err;
  }
}

/**
 * Releases a job lock by key.
 */
async function releaseLock(lockKey) {
  try {
    await prisma.$executeRaw`DELETE FROM system_job_locks WHERE lock_key = ${lockKey}`;
    return true;
  } catch (err) {
    console.error(`[jobLock] Failed to release lock for key "${lockKey}":`, err);
    return false;
  }
}

/**
 * Returns a list of all active non-expired locks.
 */
async function getActiveLocks() {
  await pruneExpiredLocks();
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM system_job_locks ORDER BY created_at DESC');
  return rows.map(mapLockRow);
}

module.exports = {
  pruneExpiredLocks,
  acquireLock,
  releaseLock,
  getActiveLocks
};
