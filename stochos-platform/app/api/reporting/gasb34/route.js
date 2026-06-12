import { NextResponse } from 'next/server';
import { calculateGasb34Data } from '@/lib/gasb34Calculator';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '2025', 10);
    const periodCode = searchParams.get('periodCode') || 'P03';

    const result = await calculateGasb34Data(jurisdictionId, fiscalYear, periodCode);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error compiling GASB 34 report:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
