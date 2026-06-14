import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const geoContributions = await prisma.martExecGeoContribution.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    });

    const channelMixes = await prisma.martExecGeoChannelMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    });

    // Split county vs city level contributions
    const counties = geoContributions.filter(item => item.geoLevel === 'county');
    const cities = geoContributions.filter(item => item.geoLevel === 'city');

    return NextResponse.json({
      success: true,
      counties,
      cities,
      channelMixes,
    });
  } catch (error) {
    console.error("Failed to fetch geography analytics data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
