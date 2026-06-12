const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

async function main() {
  const routesCount = await prisma.crmRoute.count();
  console.log("Total CRM routes:", routesCount);

  const assignedRetailers = await prisma.crmRetailer.count({
    where: {
      routeId: { not: null }
    }
  });
  console.log("Assigned retailers count:", assignedRetailers);

  if (routesCount > 0) {
    const sampleRoute = await prisma.crmRoute.findFirst({
      include: {
        retailers: true,
        rep: true
      }
    });
    console.log("Sample route name:", sampleRoute.name);
    console.log("Sample route code:", sampleRoute.code);
    console.log("Sample route rep name:", sampleRoute.rep?.name);
    console.log("Sample route retailers count:", sampleRoute.retailers.length);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
