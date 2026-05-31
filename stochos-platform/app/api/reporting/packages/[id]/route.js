import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluateValidationRules } from '@/lib/rulesEngine';

export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const pkg = await prisma.reportPackage.findUnique({
      where: { id },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' }
        },
        commentaryTasks: true
      }
    });

    if (!pkg) {
      return NextResponse.json({ error: 'Report package not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, package: pkg });
  } catch (error) {
    console.error('Error fetching report package details:', error);
    return NextResponse.json({ error: 'Failed to fetch report package details', details: error.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, name } = body;

    // Retrieve existing package
    const existingPkg = await prisma.reportPackage.findUnique({
      where: { id },
      include: {
        sections: true,
        commentaryTasks: true
      }
    });

    if (!existingPkg) {
      return NextResponse.json({ error: 'Report package not found' }, { status: 404 });
    }

    // Advanced transition gates when advancing status to approved or published
    if (status === 'approved' || status === 'published') {
      // 1. Enforce that all child sections are approved
      const unapprovedSections = existingPkg.sections.filter(s => s.status !== 'approved');
      if (unapprovedSections.length > 0) {
        return NextResponse.json({
          error: `Workflow block: All sections must be 'Approved' before the package can be approved. Incomplete sections: ${unapprovedSections.map(s => s.name).join(', ')}`
        }, { status: 400 });
      }

      // 2. Enforce validation rules check (evaluate live database validation results)
      const valResults = await evaluateValidationRules(existingPkg.jurisdictionId, existingPkg.periodDate);
      const hardFails = valResults.filter(r => r.status === 'failed');
      if (hardFails.length > 0) {
        return NextResponse.json({
          error: `Validation block: Package fails hard-fail data validation rules. Errors: ${hardFails.map(r => r.name).join(', ')}`
        }, { status: 400 });
      }

      // 3. Enforce commentary tasks check (all pending hard_fail tasks must be resolved)
      const openHardCommentary = existingPkg.commentaryTasks.filter(t => t.status === 'pending' && t.severity === 'hard_fail');
      if (openHardCommentary.length > 0) {
        return NextResponse.json({
          error: `Commentary block: Resolving required commentary tasks is mandatory before package approval. Pending: ${openHardCommentary.length} task(s)`
        }, { status: 400 });
      }
    }

    const updatedData = {};
    if (status) updatedData.status = status;
    if (name) updatedData.name = name;

    const updatedPkg = await prisma.reportPackage.update({
      where: { id },
      data: updatedData,
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' }
        },
        commentaryTasks: true
      }
    });

    return NextResponse.json({ success: true, package: updatedPkg });
  } catch (error) {
    console.error('Error updating report package:', error);
    return NextResponse.json({ error: 'Failed to update report package', details: error.message }, { status: 500 });
  }
}
