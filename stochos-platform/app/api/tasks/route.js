import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Helper to recursively serialize Decimal and BigInt types
function serializePrisma(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj === 'object') {
    if (obj.constructor && obj.constructor.name === 'Decimal') {
      return parseFloat(obj.toString());
    }
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map(serializePrisma);
    }
    const newObj = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = serializePrisma(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get('packageId');
    const status = searchParams.get('status');
    const division = searchParams.get('division');

    const where = {};
    if (packageId) {
      where.packageId = packageId;
    }
    if (status) {
      where.status = status;
    }
    if (division) {
      where.assignedTo = {
        equals: division,
        mode: 'insensitive'
      };
    }

    const tasks = await prisma.commentaryTask.findMany({
      where,
      include: {
        rule: {
          include: {
            metric: true
          }
        },
        package: true,
        section: true
      },
      orderBy: [
        { severity: 'asc' }, // hard_fail sorts before soft_warning
        { triggeredAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      tasks: serializePrisma(tasks)
    });
  } catch (error) {
    console.error('Error fetching commentary tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commentary tasks', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, taskId, resolutionNote, resolvedBy } = body;

    const targetId = id || taskId;

    if (!targetId) {
      return NextResponse.json(
        { error: 'Missing required field: id or taskId' },
        { status: 400 }
      );
    }

    if (!resolutionNote || resolutionNote.trim().length < 5) {
      return NextResponse.json(
        { error: 'A detailed resolution note (at least 5 characters) is required to resolve this task.' },
        { status: 400 }
      );
    }

    // Check if task exists
    const task = await prisma.commentaryTask.findUnique({
      where: { id: targetId }
    });

    if (!task) {
      return NextResponse.json(
        { error: 'Commentary task not found' },
        { status: 404 }
      );
    }

    // Update the task status and record justification details
    const updatedTask = await prisma.commentaryTask.update({
      where: { id: targetId },
      data: {
        status: 'completed',
        resolutionNote,
        resolvedBy: resolvedBy || 'System User',
        resolvedAt: new Date()
      },
      include: {
        rule: true,
        package: true,
        section: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Commentary task resolved successfully.',
      task: serializePrisma(updatedTask)
    });
  } catch (error) {
    console.error('Error updating commentary task:', error);
    return NextResponse.json(
      { error: 'Failed to resolve commentary task', details: error.message },
      { status: 500 }
    );
  }
}

// Support PUT as an alias to PATCH
export async function PUT(request) {
  return PATCH(request);
}
