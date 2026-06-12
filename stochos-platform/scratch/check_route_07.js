const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

async function main() {
  const route = await prisma.crmRoute.findFirst({
    where: { code: "SCH-R007" },
    include: {
      retailers: {
        orderBy: { routeOrder: "asc" }
      },
      rep: true
    }
  });

  if (!route) {
    console.log("Route SCH-R007 not found.");
    return;
  }

  console.log("Route code:", route.code);
  console.log("Route name:", route.name);
  console.log("Rep name:", route.rep?.name);
  console.log("Retailers count:", route.retailers.length);

  route.retailers.forEach((ret, index) => {
    console.log(`[${index}] ${ret.name} - Lat: ${ret.latitude}, Lng: ${ret.longitude}, RouteOrder: ${ret.routeOrder}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
