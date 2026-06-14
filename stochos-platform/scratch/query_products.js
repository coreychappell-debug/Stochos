require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/node_modules/dotenv").config({ path: "c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/.env" });
const { prisma } = require("c:/Users/corey/Downloads/Corey - Code Stuff/R Server Project folder/New York Scripts and Process/stochos-platform/lib/db.js");

async function main() {
  console.log("=== Querying products ===");
  const prods = await prisma.product.findMany({
    where: { category: "draw_game" }
  });
  prods.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, ExternalCode: ${p.externalCode}, ExternalSource: ${p.externalSource}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
