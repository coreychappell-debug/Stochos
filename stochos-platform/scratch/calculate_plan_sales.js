require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("Calculating instant ticket plan calculated sales...");
  try {
    const activePlan = await prisma.instantTicketPlan.findFirst({
      where: { fiscalYear: 2027 },
      include: {
        scenarios: {
          where: { name: "Base Plan" },
          include: {
            games: true
          }
        }
      }
    });

    if (activePlan) {
      console.log(`Plan: ${activePlan.name}, Sell Through Pct: ${activePlan.sellThroughPct}`);
      if (activePlan.scenarios.length > 0) {
        const scenario = activePlan.scenarios[0];
        console.log(`Scenario: ${scenario.name} has ${scenario.games.length} games.`);
        
        let totalSales = 0;
        let totalPayout = 0;
        scenario.games.forEach(g => {
          const units = Number(g.units);
          const denom = parseFloat(g.denomination);
          const payout = parseFloat(g.payoutPercent) / 100.0;
          const sellThrough = parseFloat(activePlan.sellThroughPct) / 100.0;
          
          const sales = units * denom * sellThrough;
          const priz = sales * payout;
          totalSales += sales;
          totalPayout += priz;
        });

        console.log("Calculated Total Sales of Games: $", totalSales.toLocaleString());
        console.log("Calculated Total Prize Payout of Games: $", totalPayout.toLocaleString());
        console.log("Target Sales: $", parseFloat(activePlan.totalSalesTarget).toLocaleString());
      } else {
        console.log("No scenarios in plan.");
      }
    } else {
      console.log("No plan found.");
    }
  } catch (err) {
    console.error("Failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
