const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../stochos-platform/.env') });
const { prisma } = require('../stochos-platform/lib/db.js');

async function main() {
  try {
    const retailerCount = await prisma.crmRetailer.count();
    const assetCount = await prisma.asset.count();
    console.log("=== DB SUMMARY ===");
    console.log("Retailer Count:", retailerCount);
    console.log("Asset Count:", assetCount);

    // Let's get 5 retailers to inspect their IDs
    const sampleRetailers = await prisma.crmRetailer.findMany({ take: 5 });
    console.log("Sample Retailers:", sampleRetailers.map(r => ({ id: r.id, name: r.name })));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
