import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import WorkingPaperDetailClient from "./WorkingPaperDetailClient";

export const dynamic = "force-dynamic";

export default async function WorkingPaperDetailPage({ params }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const workingPaper = await prisma.instantTicketWorkingPaper.findUnique({
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

  if (!workingPaper) return notFound();

  const plannedGames = await prisma.instantTicketGame.findMany({
    where: {
      OR: [
        { workingPaper: null },
        { gameNumber: workingPaper.gameNumber } // Include currently linked one if match, or query relation
      ]
    },
    include: {
      scenario: {
        include: {
          plan: {
            select: { name: true, fiscalYear: true }
          }
        }
      }
    },
    orderBy: { name: "asc" }
  });

  // Since gameId might be different from gameNumber matching, let's ensure we fetch the game currently linked if it exists
  const isLinkedAlready = plannedGames.some(g => g.id === workingPaper.gameId);
  if (workingPaper.gameId && !isLinkedAlready) {
    const linkedGame = await prisma.instantTicketGame.findUnique({
      where: { id: workingPaper.gameId },
      include: {
        scenario: {
          include: {
            plan: {
              select: { name: true, fiscalYear: true }
            }
          }
        }
      }
    });
    if (linkedGame) {
      plannedGames.push(linkedGame);
    }
  }

  const serialize = (obj) =>
    JSON.parse(
      JSON.stringify(obj, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <WorkingPaperDetailClient 
          workingPaper={serialize(workingPaper)} 
          plannedGames={serialize(plannedGames)} 
        />
      </main>
    </div>
  );
}
