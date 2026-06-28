import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import WorkingPapersClient from "./WorkingPapersClient";

export const dynamic = "force-dynamic";

export default async function WorkingPapersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch all working papers with links to active plans
  const workingPapers = await prisma.instantTicketWorkingPaper.findMany({
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
      _count: { select: { prizeTiers: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  // Fetch planned games that are NOT yet linked to any working paper
  const plannedGames = await prisma.instantTicketGame.findMany({
    where: {
      workingPaper: null
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
        <WorkingPapersClient 
          workingPapers={serialize(workingPapers)} 
          plannedGames={serialize(plannedGames)} 
        />
      </main>
    </div>
  );
}
