require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("Checking mart_exec_mix_summary...");
  try {
    const mix = await prisma.martExecMixSummary.findMany();
    console.log("Product Groups in Mix Summary:", JSON.stringify(mix, null, 2));

    const allProducts = await prisma.product.findMany();
    console.log("All Product Categories in Catalog:", Array.from(new Set(allProducts.map(p => p.category))));
    
  } catch (err) {
    console.error("Failed:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
