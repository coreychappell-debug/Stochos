import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Verify Prisma can query user count (db connectivity)
    const userCount = await prisma.user.count();
    
    // 2. Verify the new budgetProposal table is active (schema sync check)
    const proposalCount = await prisma.budgetProposal.count();

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      schema: "synced",
      metrics: {
        users: userCount,
        budgetProposals: proposalCount
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error("Health check endpoint failed:", error);
    return NextResponse.json({
      status: "unhealthy",
      error: error.message || String(error)
    }, { status: 500 });
  }
}
