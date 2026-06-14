import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Fetch channel mix summary
    const channels = await prisma.martExecChannelMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    });

    // 2. Fetch retailer mix (used for the detailed search table and aggregates)
    const retailers = await prisma.martExecRetailerMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    });

    // 3. Fetch retailer quadrants (used for the scatter plot)
    const quadrants = await prisma.martExecRetailerQuadrant.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      channels,
      retailers,
      quadrants,
    });
  } catch (error) {
    console.error("Failed to fetch retailer profitability analytics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
