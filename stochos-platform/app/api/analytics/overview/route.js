import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch daily overview data ordered by date ascending for charts
    const dailyData = await prisma.martExecOverviewDaily.findMany({
      orderBy: {
        date: "asc",
      },
    });

    // Fetch product mix summary
    const mixSummary = await prisma.martExecMixSummary.findMany();

    // Fetch alerts ordered by date descending
    const alerts = await prisma.martExecAlert.findMany({
      orderBy: {
        alertDate: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      daily: dailyData,
      mix: mixSummary,
      alerts: alerts,
    });
  } catch (error) {
    console.error("Failed to fetch executive overview analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
