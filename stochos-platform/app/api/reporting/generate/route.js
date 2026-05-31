import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// A simple engine to find {{ AccountCode }} tags and replace them with values
export async function POST(request) {
  try {
    const body = await request.json();
    const { templateId, periodDateStr, createdById } = body;

    if (!templateId || !periodDateStr || !createdById) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const periodDate = new Date(periodDateStr);

    // 1. Fetch Template
    const template = await prisma.reportTemplate.findUnique({
      where: { id: templateId }
    });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 2. Fetch Trial Balance Data for the period
    const tbRecords = await prisma.trialBalanceRecord.findMany({
      where: {
        jurisdictionId: template.jurisdictionId,
        periodDate: periodDate
      }
    });

    // 3. Create a lookup map for AccountCode -> Sum of Balance
    const balanceMap = new Map();
    for (const record of tbRecords) {
      const current = balanceMap.get(record.accountCode) || 0;
      balanceMap.set(record.accountCode, current + parseFloat(record.balance.toString()));
    }

    // 4. Parse the content and replace {{ AccountCode }}
    const tagRegex = /{{\s*([^{}]+)\s*}}/g;
    
    const renderedMarkdown = template.content.replace(tagRegex, (match, tagContent) => {
      const code = tagContent.trim();
      
      if (balanceMap.has(code)) {
        // Format as currency or standard number
        const val = balanceMap.get(code);
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
      }
      
      // If no data found, return an indicator
      return `[No Data: ${code}]`;
    });

    // For the MVP, we just store the rendered Markdown (or HTML if we compile it here).
    // Let's store the markdown in contentHtml for now, the frontend will render it.
    const snapshot = await prisma.reportSnapshot.create({
      data: {
        templateId,
        periodDate,
        contentHtml: renderedMarkdown, 
        createdById,
        status: 'draft'
      }
    });

    return NextResponse.json({ success: true, snapshot });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
