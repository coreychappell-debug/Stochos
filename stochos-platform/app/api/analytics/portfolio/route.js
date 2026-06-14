import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [mix, lifecycle, timeseries] = await Promise.all([
      prisma.martExecProductMix.findMany({
        orderBy: {
          grossRevenue: "desc",
        },
      }),
      prisma.martExecProductLifecycle.findMany({
        orderBy: {
          grossRevenue: "desc",
        },
      }),
      prisma.martExecProductTimeseries.findMany({
        orderBy: {
          month: "asc",
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      mix,
      lifecycle,
      timeseries,
    });
  } catch (error) {
    console.error("Failed to fetch product portfolio analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
