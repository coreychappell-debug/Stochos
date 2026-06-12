import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only administrator or IT manager can inspect full security logs
    const userRole = session.user?.role || '';
    if (userRole !== 'admin' && userRole !== 'it_manager') {
      return NextResponse.json({ error: 'Forbidden: Only administrators or IT managers can view security audit logs' }, { status: 403 });
    }

    const logs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            division: true
          }
        }
      }
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs', details: error.message }, { status: 500 });
  }
}
