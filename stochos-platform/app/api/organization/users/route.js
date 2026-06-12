import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditLog } from '@/lib/primitives';

export async function PUT(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role check: Only administrator or IT manager can modify user roles/status
    const userRole = session.user?.role || '';
    if (userRole !== 'admin' && userRole !== 'it_manager') {
      return NextResponse.json({ error: 'Forbidden: Only administrators or IT managers can update user access configurations' }, { status: 403 });
    }

    const { targetUserId, roleId, status, division, bureau, subunit } = await req.json();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing targetUserId parameter' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true }
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData = {};
    if (roleId !== undefined) updateData.roleId = roleId;
    if (status !== undefined) updateData.status = status;
    if (division !== undefined) updateData.division = division;
    if (bureau !== undefined) updateData.bureau = bureau;
    if (subunit !== undefined) updateData.subunit = subunit;

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData,
      include: { role: true }
    });

    // Resolve and verify active user ID for audit log to prevent foreign key constraint violations
    let userId = session.user.id;
    let activeUser = null;
    if (userId) {
      activeUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true }
      });
    }
    if (!activeUser && session.user.email) {
      activeUser = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true }
      });
    }
    if (!activeUser) {
      activeUser = await prisma.user.findFirst({
        select: { id: true }
      });
    }
    const auditUserId = activeUser?.id || userId;

    // Log update in AuditLog
    await writeAuditLog({
      userId: auditUserId,
      entityType: 'User',
      entityId: targetUserId,
      action: 'update',
      changes: {
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        before: {
          roleId: targetUser.roleId,
          roleName: targetUser.role?.name,
          status: targetUser.status,
          division: targetUser.division,
          bureau: targetUser.bureau,
          subunit: targetUser.subunit
        },
        after: {
          roleId: updatedUser.roleId,
          roleName: updatedUser.role?.name,
          status: updatedUser.status,
          division: updatedUser.division,
          bureau: updatedUser.bureau,
          subunit: updatedUser.subunit
        }
      }
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Error updating user access:', error);
    return NextResponse.json({ error: 'Failed to update user access', details: error.message }, { status: 500 });
  }
}
