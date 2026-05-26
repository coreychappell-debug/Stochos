require("dotenv").config();
const { prisma } = require("./lib/db");

async function main() {
  // Restore Astoria QuickMart
  await prisma.crmRetailer.update({
    where: { id: "d22455c9-08bb-49ae-b6ca-fd9a536cd9a0" },
    data: {
      address: "30-18 Astoria Blvd",
      city: "Queens",
      zipCode: "11102",
      latitude: 40.7711,
      longitude: -73.9212,
      geodataStatus: null,
      geodataDistance: null,
      geodataHostCorrectionRequested: false,
      geodataBypassed: false
    }
  });

  // Restore Broadway Convenience & Lotto
  await prisma.crmRetailer.update({
    where: { id: "2864e336-2ce1-4c62-a067-75463881262e" },
    data: {
      address: "1540 Broadway",
      city: "New York",
      zipCode: "10036",
      latitude: 40.7578,
      longitude: -73.985,
      geodataStatus: null,
      geodataDistance: null,
      geodataHostCorrectionRequested: false,
      geodataBypassed: false
    }
  });

  console.log("Successfully restored Astoria QuickMart and Broadway Convenience & Lotto to original values!");
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
