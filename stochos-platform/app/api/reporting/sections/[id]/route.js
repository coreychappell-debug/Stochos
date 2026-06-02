import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, content, status, assigneeId, reviewerId, dueDate } = body;

    // 1. Fetch section and parent package details
    const existingSection = await prisma.reportSection.findUnique({
      where: { id },
      include: { package: true }
    });

    if (!existingSection) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const parentPkg = existingSection.package;

    // 2. Commentary Gate checks if updating status to 'approved'
    if (status === 'approved') {
      const textToValidate = content !== undefined ? content : existingSection.content;

      // Fetch Trial Balance actuals for this period
      const records = await prisma.trialBalanceRecord.findMany({
        where: {
          jurisdictionId: parentPkg.jurisdictionId,
          periodDate: parentPkg.periodDate
        }
      });

      let grossSales = 0;
      let commissions = 0;

      for (const r of records) {
        const code = r.accountCode || '';
        const bal = Math.abs(parseFloat(r.balance.toString()));
        if (code === '4-1000' || code.startsWith('40000') || code.startsWith('40100')) {
          grossSales += bal;
        }
        if (code === '5-2100' || code.startsWith('6420')) {
          commissions += bal;
        }
      }

      // Hardcoded budget assumptions for validation variance checks
      const budgetSales = 850000000;
      const budgetCommissions = 42500000;

      const commVar = budgetCommissions > 0 ? (commissions - budgetCommissions) / budgetCommissions : 0;

      // Check if commission variance exceeds 10%
      if (Math.abs(commVar) > 0.10) {
        const cleanText = (textToValidate || '')
          .replace(/<[^>]*>/g, '') // remove HTML tags
          .replace(/\(NARRATIVE REQUIRED\)/g, '')
          .trim();

        // Must write at least 35 characters
        if (cleanText.length < 35) {
          return NextResponse.json({
            error: `Commentary Gate Block: Section contains anomalous commissions variance (${(commVar * 100).toFixed(2)}%). A narrative explanation of at least 35 characters is required. Current length: ${cleanText.length} characters.`
          }, { status: 400 });
        }
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (content !== undefined) updateData.content = content;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'submitted') {
        updateData.submittedAt = new Date();
      } else if (status === 'approved') {
        updateData.approvedAt = new Date();
      }
    }
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (reviewerId !== undefined) updateData.reviewerId = reviewerId;
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate);

    const updatedSection = await prisma.reportSection.update({
      where: { id },
      data: updateData,
      include: {
        assignee: true,
        reviewer: true
      }
    });

    return NextResponse.json({ success: true, section: updatedSection });

  } catch (error) {
    console.error('Error updating report section:', error);
    return NextResponse.json({ error: 'Failed to update report section', details: error.message }, { status: 500 });
  }
}
