const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

async function main() {
  console.log("Querying retailers in the database...");
  const counts = await prisma.crmRetailer.groupBy({
    by: ['serviceCenter'],
    _count: {
      id: true
    },
    where: {
      latitude: { not: null },
      longitude: { not: null }
    }
  });
  console.log("Service Center Counts:");
  console.table(counts);
}

main().catch(console.error).finally(() => prisma.$disconnect());
