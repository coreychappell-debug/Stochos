import { NextResponse } from 'next/server';
import { evaluateValidationRules } from '@/lib/rulesEngine';

export async function GET(request) {
  const rules = [
    { id: 'val-rule-sales', name: 'Positive Gross Ticket Sales', type: 'balance_bounds', targetAccount: '4-1000' },
    { id: 'val-rule-prizes', name: 'Prize Expense Debit Signage', type: 'balance_signage', targetAccount: '5-2000' },
    { id: 'val-rule-commissions', name: 'Retailer Commissions Reconciliation', type: 'ratio_bounds', targetAccount: '5-2100', expectedRatio: 0.05 }
  ];
  return NextResponse.json({ success: true, rules });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, periodDate } = body;

    if (!jurisdictionId || !periodDate) {
      return NextResponse.json(
        { error: 'Missing required fields (jurisdictionId, periodDate)' },
        { status: 400 }
      );
    }

    const results = await evaluateValidationRules(
      jurisdictionId,
      new Date(periodDate)
    );

    // Summarize global validation status
    let validationStatus = 'passed';
    if (results.some(r => r.status === 'failed')) {
      validationStatus = 'failed';
    } else if (results.some(r => r.status === 'warning')) {
      validationStatus = 'passed_with_warnings';
    }

    return NextResponse.json({
      success: true,
      validationStatus,
      results
    });

  } catch (error) {
    console.error('Error evaluating rules:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate compliance rules', details: error.message },
      { status: 500 }
    );
  }
}
