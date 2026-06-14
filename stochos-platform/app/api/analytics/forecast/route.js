import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const timeseries = await prisma.martNyGameTimeseries.findMany({
      orderBy: {
        date: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      timeseries,
    });
  } catch (error) {
    console.error("Failed to fetch forecast timeseries data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
