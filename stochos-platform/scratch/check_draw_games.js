require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("Checking MartExecProductLifecycle draw games...");
  try {
    const drawGames = await prisma.martExecProductLifecycle.findMany({
      where: { productGroup: { contains: "Draw" } }
    });
    console.log(`Found ${drawGames.length} draw games:`);
    drawGames.forEach(g => {
      console.log(`- ${g.gameName} (${g.gameCode}): Gross Revenue = $${g.grossRevenue}, Family = ${g.gameFamily}, Active Days = ${g.activeDays}`);
    });
  } catch (err) {
    console.error("Failed to query:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
