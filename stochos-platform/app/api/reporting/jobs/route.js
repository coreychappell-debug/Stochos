// app/api/reporting/jobs/route.js
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getActiveLocks, releaseLock } from '@/lib/jobLock';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/primitives';

export const dynamic = 'force-dynamic';

// GET /api/reporting/jobs - List all active non-expired locks
export async function GET(request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeJobs = await getActiveLocks();
    
    // Sanitize output (don't leak too much database internal details, but return useful data)
    const sanitizedJobs = activeJobs.map(job => ({
      id: job.id,
      lockKey: job.lockKey,
      userName: job.userName,
      description: job.description,
      maxDurationSeconds: job.maxDurationSeconds,
      createdAt: job.createdAt
    }));

    return NextResponse.json({ success: true, activeJobs: sanitizedJobs });
  } catch (error) {
    console.error('Error fetching active job locks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch active jobs list', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/reporting/jobs - Force release (override) an active lock (Admin only)
export async function DELETE(request) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only admin role can override locks
    const roleName = session.user?.role || '';
    if (roleName !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only administrators can force release locks.' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let lockKey = searchParams.get('lockKey');

    if (!lockKey) {
      // Try parsing request body if searchParam is missing
      try {
        const body = await request.json();
        lockKey = body.lockKey;
      } catch (err) {
        // ignore JSON parse errors
      }
    }

    if (!lockKey) {
      return NextResponse.json({ error: 'Missing lockKey parameter' }, { status: 400 });
    }

    // Get active lock details to log who owned it before force releasing
    const rows = await prisma.$queryRaw`SELECT * FROM system_job_locks WHERE lock_key = ${lockKey}`;
    const lockDetails = rows.length > 0 ? {
      userId: rows[0].user_id,
      userName: rows[0].user_name,
      description: rows[0].description
    } : null;

    if (!lockDetails) {
      return NextResponse.json({ error: 'Lock not found or already released' }, { status: 404 });
    }

    // Release the lock
    await releaseLock(lockKey);

    // Write audit log entry
    await writeAuditLog({
      userId: session.user.id,
      entityType: 'SystemJobLock',
      entityId: lockKey,
      action: 'override_release',
      changes: {
        lockKey,
        previousOwnerId: lockDetails.userId,
        previousOwnerName: lockDetails.userName,
        description: lockDetails.description,
        forceReleasedBy: session.user.name
      }
    });

    return NextResponse.json({
      success: true,
      message: `Lock for "${lockKey}" was successfully overridden and released.`
    });

  } catch (error) {
    console.error('Error overriding job lock:', error);
    return NextResponse.json(
      { error: 'Failed to release job lock', details: error.message },
      { status: 500 }
    );
  }
}
