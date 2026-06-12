import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAuditLog } from '@/lib/primitives';

export async function GET(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, roles });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles', details: error.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role gate: only administrators can manage permissions
    if (session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Only administrators can modify role permissions' }, { status: 403 });
    }

    const { roleId, permissions } = await req.json();
    if (!roleId || !permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 });
    }

    const role = await prisma.role.findUnique({
      where: { id: roleId }
    });

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 });
    }

    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: { permissions }
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
      entityType: 'Role',
      entityId: roleId,
      action: 'update',
      changes: {
        roleName: role.name,
        before: role.permissions,
        after: permissions
      }
    });

    return NextResponse.json({ success: true, role: updatedRole });
  } catch (error) {
    console.error('Error updating role permissions:', error);
    return NextResponse.json({ error: 'Failed to update role permissions', details: error.message }, { status: 500 });
  }
}
