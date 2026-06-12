const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

async function main() {
  const count = await prisma.crmRetailer.count();
  console.log("Total retailers:", count);

  const serviceCenters = await prisma.crmRetailer.groupBy({
    by: ['serviceCenter'],
    _count: true
  });
  console.log("Retailers by Service Center:", serviceCenters);

  const nullCoords = await prisma.crmRetailer.count({
    where: {
      OR: [
        { latitude: null },
        { longitude: null }
      ]
    }
  });
  console.log("Retailers with null coordinates:", nullCoords);

  const nonNullCoords = await prisma.crmRetailer.count({
    where: {
      NOT: {
        latitude: null,
        longitude: null
      }
    }
  });
  console.log("Retailers with valid coordinates:", nonNullCoords);

  const sample = await prisma.crmRetailer.findFirst({
    where: {
      NOT: {
        latitude: null,
        longitude: null
      }
    }
  });
  console.log("Sample valid retailer:", sample);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
