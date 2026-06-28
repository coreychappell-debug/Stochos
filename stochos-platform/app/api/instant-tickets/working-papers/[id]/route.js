import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const paper = await prisma.instantTicketWorkingPaper.findUnique({
      where: { id },
      include: {
        game: {
          select: {
            id: true,
            payoutPercent: true,
            scenario: {
              select: {
                id: true,
                name: true,
                plan: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        },
        prizeTiers: {
          orderBy: [
            { prizeValue: "desc" },
            { winnerCount: "desc" }
          ]
        }
      }
    });

    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const serialized = JSON.parse(
      JSON.stringify(paper, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to fetch working paper:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();

    const before = await prisma.instantTicketWorkingPaper.findUnique({
      where: { id }
    });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const printRun = body.printRun ? BigInt(body.printRun) : before.printRun;
    const denomination = body.denomination !== undefined ? parseInt(body.denomination, 10) : before.denomination;

    // Run metadata updates, prize tiers wipe-and-replace, and potential planned game sync in a single transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Wipe existing prize tiers
      if (body.prizeTiers) {
        await tx.instantTicketWorkingPaperPrizeTier.deleteMany({
          where: { workingPaperId: id }
        });
      }

      // 2. Re-create new prize tiers
      let totalCost = 0;
      let totalWinners = BigInt(0);

      if (body.prizeTiers && body.prizeTiers.length > 0) {
        const tiersData = body.prizeTiers.map(t => {
          const val = parseFloat(t.prizeValue) || 0;
          const count = BigInt(t.winnerCount || 0);
          const payout = val * Number(count);
          
          totalCost += payout;
          totalWinners += count;

          // Calculate odds: printRun / winnerCount
          const odds = count > BigInt(0) ? Number(printRun) / Number(count) : null;

          return {
            workingPaperId: id,
            prizeValue: val,
            description: t.description || "—",
            winnerCount: count,
            payoutAmount: payout,
            odds: odds
          };
        });

        await tx.instantTicketWorkingPaperPrizeTier.createMany({
          data: tiersData
        });
      }

      // Calculate overall odds: printRun / totalWinners
      const overallOdds = totalWinners > BigInt(0) ? Number(printRun) / Number(totalWinners) : null;

      // 3. Update the working paper
      const updatedPaper = await tx.instantTicketWorkingPaper.update({
        where: { id },
        data: {
          gameNumber: body.gameNumber !== undefined ? body.gameNumber : before.gameNumber,
          name: body.name !== undefined ? body.name : before.name,
          denomination: denomination,
          printRun: printRun,
          plannedPrizeExpense: totalCost,
          overallOdds: overallOdds,
          status: body.status !== undefined ? body.status : before.status,
          coSignedDate: body.coSignedDate !== undefined ? (body.coSignedDate ? new Date(body.coSignedDate) : null) : before.coSignedDate,
          documentContent: body.documentContent !== undefined ? body.documentContent : before.documentContent,
          gameId: body.gameId !== undefined ? body.gameId : before.gameId
        }
      });

      // 4. Sync payout % back to Scenario planned game if requested
      const gameId = body.gameId !== undefined ? body.gameId : before.gameId;
      if (body.syncToGame && gameId) {
        const grossSales = Number(printRun) * denomination;
        const actualPayoutPercent = grossSales > 0 ? (totalCost / grossSales) * 100 : 0;

        await tx.instantTicketGame.update({
          where: { id: gameId },
          data: {
            payoutPercent: parseFloat(actualPayoutPercent.toFixed(2))
          }
        });
      }

      return updatedPaper;
    });

    // Log update in AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "instant_ticket_working_paper",
        entityId: id,
        action: "update",
        changes: { before: { status: before.status }, after: { status: body.status } }
      }
    });

    const serialized = JSON.parse(
      JSON.stringify(result, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to update working paper:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const paper = await prisma.instantTicketWorkingPaper.findUnique({
      where: { id }
    });
    if (!paper) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.instantTicketWorkingPaper.delete({
      where: { id }
    });

    // Log deletion
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "instant_ticket_working_paper",
        entityId: id,
        action: "delete",
        changes: {}
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete working paper:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}
