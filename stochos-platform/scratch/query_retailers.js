require('dotenv').config();
const { prisma } = require('../lib/db.js');

async function main() {
  try {
    const retailerCount = await prisma.crmRetailer.count();
    const assetCount = await prisma.asset.count();
    const jurisdictions = await prisma.jurisdiction.findMany();
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, roleId: true } });
    console.log("=== DB SUMMARY ===");
    console.log("Retailer Count:", retailerCount);
    console.log("Asset Count:", assetCount);
    console.log("Jurisdictions:", jurisdictions.map(j => ({ id: j.id, name: j.name, abbreviation: j.abbreviation })));
    console.log("Users in DB:", users);

    const sampleRetailers = await prisma.crmRetailer.findMany({ take: 5 });
    console.log("Sample Retailers:", sampleRetailers.map(r => ({ id: r.id, name: r.name })));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
