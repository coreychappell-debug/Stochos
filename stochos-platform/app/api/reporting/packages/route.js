import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || '52066ac6-27d4-4495-953b-8f8def2a7851'; // NY seed default

    const packages = await prisma.reportPackage.findMany({
      where: { jurisdictionId },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' }
        },
        commentaryTasks: true
      },
      orderBy: { periodDate: 'desc' }
    });

    return NextResponse.json({ success: true, packages });
  } catch (error) {
    console.error('Error fetching report packages:', error);
    return NextResponse.json({ error: 'Failed to fetch packages', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, frequency, periodDateStr, createdById, jurisdictionId } = body;

    if (!name || !frequency || !periodDateStr || !createdById) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const jId = jurisdictionId || '52066ac6-27d4-4495-953b-8f8def2a7851'; // NY seed
    const periodDate = new Date(periodDateStr);

    // Default sections structure
    const defaultSections = [
      { name: 'Letter of Transmittal', sortOrder: 1, dueDateOffsetDays: 45 },
      { name: 'Management Discussion & Analysis (MD&A)', sortOrder: 2, dueDateOffsetDays: 50 },
      { name: 'Statement of Net Position', sortOrder: 3, dueDateOffsetDays: 55 },
      { name: 'Notes to Financial Statements', sortOrder: 4, dueDateOffsetDays: 60 }
    ];

    // Build due dates based on period close date
    const getDueDate = (offsetDays) => {
      const d = new Date(periodDate);
      d.setDate(d.getDate() + offsetDays);
      return d;
    };

    const newPackage = await prisma.$transaction(async (tx) => {
      // 1. Create the package
      const pkg = await tx.reportPackage.create({
        data: {
          name,
          frequency,
          periodDate,
          status: 'draft',
          createdById,
          jurisdictionId: jId
        }
      });

      // 2. Create the child sections
      const sectionsData = defaultSections.map((sec) => ({
        packageId: pkg.id,
        name: sec.name,
        content: `<h2>${sec.name}</h2><p>Provide narrative details here.</p>`,
        status: 'draft',
        sortOrder: sec.sortOrder,
        dueDate: getDueDate(sec.dueDateOffsetDays)
      }));

      await tx.reportSection.createMany({
        data: sectionsData
      });

      return tx.reportPackage.findUnique({
        where: { id: pkg.id },
        include: {
          sections: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });
    });

    return NextResponse.json({ success: true, package: newPackage });
  } catch (error) {
    console.error('Error creating report package:', error);
    return NextResponse.json({ error: 'Failed to create report package', details: error.message }, { status: 500 });
  }
}
