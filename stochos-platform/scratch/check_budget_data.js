require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("Checking database entities for budget rollup (summary mode)...");
  try {
    const plans = await prisma.instantTicketPlan.findMany({
      include: {
        scenarios: {
          select: {
            id: true,
            name: true,
            _count: { select: { games: true } }
          }
        }
      }
    });
    console.log("Instant Ticket Plans & Scenarios:", JSON.stringify(plans, null, 2));

    const drawScenarios = await prisma.drawGameScenario.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        fiscalYear: true,
        jurisdictionId: true,
        _count: { select: { games: true } }
      }
    });
    console.log("Draw Game Scenarios Summary:", JSON.stringify(drawScenarios, null, 2));

  } catch (err) {
    console.error("Failed to query budget data:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
