require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("Querying mart_exec_overview_daily table...");
  try {
    const dailyCount = await prisma.martExecOverviewDaily.count();
    console.log("Total daily rows:", dailyCount);

    const aggregate = await prisma.martExecOverviewDaily.aggregate({
      _sum: {
        grossRevenue: true,
        netContribution: true,
        estimatedPayout: true,
        retailerCommission: true
      },
      _max: {
        activeRetailers: true,
        activeGames: true,
        date: true
      },
      _min: {
        date: true
      }
    });
    console.log("Aggregate Overview Metrics:", JSON.stringify(aggregate, null, 2));

    const latest = await prisma.martExecOverviewDaily.findMany({
      orderBy: { date: 'desc' },
      take: 1
    });
    console.log("Latest row:", JSON.stringify(latest, null, 2));

  } catch (err) {
    console.error("Query failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
