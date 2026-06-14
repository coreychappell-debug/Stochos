require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("=== Testing Product and Lifecycle Mapping ===");

  const products = await prisma.product.findMany({
    where: { category: "draw_game" }
  });

  const lifecycles = await prisma.martExecProductLifecycle.findMany();

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

  const results = products.map(p => {
    const codes = mapping[p.externalCode];
    let totalAnnualSales = 0;
    let trend = "Stable";

    if (codes) {
      const matched = lifecycles.filter(l => codes.includes(l.gameCode));
      if (matched.length > 0) {
        matched.forEach(m => {
          const rev = parseFloat(m.grossRevenue || 0);
          const days = m.activeDays || 365;
          const annualized = (rev / days) * 365;
          totalAnnualSales += annualized;
        });
        trend = matched[0].trendDirection || "Stable";
      }
    }

    return {
      name: p.name,
      externalCode: p.externalCode,
      historicalAnnualSales: totalAnnualSales,
      trendDirection: trend
    };
  });

  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
