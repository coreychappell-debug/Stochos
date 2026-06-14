require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

const mapping = {
  mega_millions: ["mega", "megaplier"],
  powerball: ["powerball", "powerplay"],
  ny_lotto: ["lotto"],
  numbers: ["numbers_eve", "numbers_day"],
  win_4: ["win4_eve", "win4_day"],
  take_5: ["t5_eve", "t5_day"],
  pick_10: ["pick10"],
  quick_draw: ["quick_draw", "qd_extra", "money_dots"],
  cash4life: ["c4l"]
};

const payoutMapping = {
  mega_millions: 50.0,
  powerball: 50.0,
  ny_lotto: 40.0,
  numbers: 50.0,
  win_4: 50.0,
  take_5: 50.0,
  pick_10: 50.0,
  quick_draw: 60.0,
  cash4life: 50.0
};

async function main() {
  console.log("Starting migration to add missing draw games to scenarios...");
  try {
    const [scenarios, products, lifecycles] = await Promise.all([
      prisma.drawGameScenario.findMany({
        include: { games: true }
      }),
      prisma.product.findMany({
        where: { category: "draw_game", status: "active" }
      }),
      prisma.martExecProductLifecycle.findMany()
    ]);

    console.log(`Found ${scenarios.length} draw scenarios and ${products.length} active draw products.`);

    for (const scenario of scenarios) {
      const existingProductIds = scenario.games.map(g => g.productId).filter(Boolean);
      const missingProducts = products.filter(p => !existingProductIds.includes(p.id));

      if (missingProducts.length > 0) {
        console.log(`Scenario "${scenario.name}" (ID: ${scenario.id}) is missing ${missingProducts.length} games.`);
        
        for (const p of missingProducts) {
          let baselineSales = 0;
          if (p.externalCode) {
            const codes = mapping[p.externalCode];
            if (codes) {
              const matched = lifecycles.filter(l => codes.includes(l.gameCode));
              if (matched.length > 0) {
                let totalSales = 0;
                matched.forEach(m => {
                  const rev = parseFloat(m.grossRevenue || 0);
                  const days = m.activeDays || 365;
                  totalSales += (rev / days) * 365;
                });
                baselineSales = parseFloat(totalSales.toFixed(2));
              }
            }
          }

          const prizePayout = p.externalCode ? (payoutMapping[p.externalCode] || 50.0) : 50.0;

          console.log(`-> Adding ${p.name} (Code: ${p.externalCode}) with baseline sales $${baselineSales.toLocaleString()}`);

          await prisma.drawGameProjectedItem.create({
            data: {
              scenarioId: scenario.id,
              productId: p.id,
              name: p.name,
              projectedSales: baselineSales || 1000000.00,
              prizePayoutPercent: prizePayout,
              retailerCommPercent: 6.0
            }
          });
        }
      } else {
        console.log(`Scenario "${scenario.name}" (ID: ${scenario.id}) has all active draw games.`);
      }
    }

    console.log("Migration completed successfully!");

  } catch (err) {
    console.error("Migration failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
