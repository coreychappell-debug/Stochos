import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const papers = await prisma.instantTicketWorkingPaper.findMany({
      include: {
        game: {
          select: {
            id: true,
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
        _count: { select: { prizeTiers: true } }
      },
      orderBy: { updatedAt: "desc" }
    });

    // Custom serialization to convert BigInts to strings
    const serialized = JSON.parse(
      JSON.stringify(papers, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to fetch working papers:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();

    const name = body.name || "New Instant Game";
    const gameNumber = body.gameNumber || "0000";
    const denomination = parseInt(body.denomination || "5", 10);
    const printRun = body.printRun ? BigInt(body.printRun) : BigInt(10000000);
    const plannedPrizeExpense = body.plannedPrizeExpense !== undefined ? body.plannedPrizeExpense : 0;
    const overallOdds = body.overallOdds !== undefined ? body.overallOdds : 3.5;
    const gameId = body.gameId || null;

    // Generate standard legal template text
    const defaultContent = `
      <h2 style="text-align: center; color: #0c2a1b;">NEW YORK STATE GAMING COMMISSION</h2>
      <h3 style="text-align: center; color: #475569;">OFFICIAL INSTANT GAME WORKING PAPERS</h3>
      <hr style="border: 1px solid #16422b; margin: 20px 0;"/>
      <p><strong>Game Overview:</strong> This document outlines the official specifications, validations, and rules for <strong>${name}</strong> (Game Number <strong>${gameNumber}</strong>) at the <strong>$${denomination}.00</strong> price point.</p>
      
      <h4>1. Play Style & Rules</h4>
      <p>Match any of YOUR NUMBERS to any of the WINNING NUMBERS, win prize shown for that number. [Custom play style multipliers and themed symbols to be detailed by McCann Worldgroup].</p>
      
      <h4>2. Ticket Layout & Graphics</h4>
      <p>The ticket size is standard for the $${denomination}.00 price category. Front and back art files must be submitted and approved by the Commission prior to plate rendering.</p>
      
      <h4>3. Security & Validation Controls</h4>
      <p>Each ticket contains a 14-digit validation number hidden beneath the latex coating. Verification must be executed against the central gaming system prior to any prize disbursement.</p>
      
      <h4>4. Claiming Procedures</h4>
      <p>Prizes up to $599.00 may be claimed at any authorized New York State Lottery retail location. Prizes of $600.00 or more require W-2G tax offset reporting and must be claimed at a Customer Service Center or Commission Headquarters.</p>
    `;

    const paper = await prisma.instantTicketWorkingPaper.create({
      data: {
        gameId,
        gameNumber,
        name,
        denomination,
        printRun,
        plannedPrizeExpense,
        overallOdds,
        status: body.status || "draft",
        coSignedDate: body.coSignedDate ? new Date(body.coSignedDate) : null,
        documentContent: defaultContent
      }
    });

    // If gameId is provided, let's link it back (Prisma handles this relation, but we can verify it updates the 1-to-1 link if needed, though Prisma's create handles it since gameId is a foreign key on working paper)
    
    // Log in AuditLog
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "instant_ticket_working_paper",
        entityId: paper.id,
        action: "create",
        changes: { after: { name, gameNumber, denomination } }
      }
    });

    const serialized = JSON.parse(
      JSON.stringify(paper, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to create working paper:", error);
    return NextResponse.json({ error: "Server error", details: error.message }, { status: 500 });
  }
}
