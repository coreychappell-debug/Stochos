// scratch/test_allocation.js
// Standalone script to test the shared expense allocation engine logic directly.

require('dotenv').config();
const { prisma } = require('../lib/db');
const { calculateAllocation } = require('../lib/allocationEngine');

async function testAllocationMath() {
  console.log("🔍 Testing Cost Allocation Engine programmatically...\n");
  
  try {
    // Find first instant ticket plan
    const plan = await prisma.instantTicketPlan.findFirst({
      where: { status: { not: 'archived' } }
    });

    if (!plan) {
      console.error("❌ No active instant ticket plan found in the database. Run seed scripts first.");
      return;
    }

    console.log(`Plan found: "${plan.name}" (ID: ${plan.id}) for FY${plan.fiscalYear}`);

    // Run Sales Basis allocation
    console.log("\n--- RUNNING ALLOCATION BY GROSS SALES ---");
    const salesRes = await calculateAllocation(plan.id, "sales");
    console.log(`Total central overhead contracts annual sum: $${(salesRes.summary.totalCentralOverhead).toLocaleString()}`);
    console.log(`Scratcher projected sales: $${(salesRes.summary.totalInstantSales).toLocaleString()}`);
    console.log(`Draw games projected sales: $${(salesRes.summary.totalDrawSales).toLocaleString()}`);
    console.log(`Scratcher share fraction: ${(salesRes.summary.instantShareFraction * 100).toFixed(2)}%`);
    console.log(`Overhead allocated to Scratchers: $${(salesRes.summary.instantTicketShareOfCentralOverhead).toLocaleString()}`);
    console.log(`Enriched games count: ${salesRes.games.length}`);

    // Print first 3 games details
    console.log("\nSample Games (Sales Basis):");
    salesRes.games.slice(0, 3).forEach(g => {
      console.log(`  - Game #${g.gameNumber} [${g.name}] ($${g.denomination}):`);
      console.log(`    * Units: ${Number(g.units).toLocaleString()}`);
      console.log(`    * Gross Sales: $${g.grossSales.toLocaleString()}`);
      console.log(`    * Prizes: $${g.prizeExpense.toLocaleString()}`);
      console.log(`    * Comm: $${g.retailerCommission.toLocaleString()}`);
      console.log(`    * Print Cost: $${g.printingCost.toLocaleString()}`);
      console.log(`    * Allocated Overhead: $${g.allocatedOverhead.toLocaleString()}`);
      console.log(`    * Fully Loaded Profit: $${g.fullyLoadedProfit.toLocaleString()} (Margin: ${g.fullyLoadedMargin.toFixed(2)}%)`);
    });

    // Run Volume Basis allocation
    console.log("\n--- RUNNING ALLOCATION BY TICKET VOLUME ---");
    const volRes = await calculateAllocation(plan.id, "volume");
    console.log(`Total central overhead contracts annual sum: $${(volRes.summary.totalCentralOverhead).toLocaleString()}`);
    console.log(`Total Scratcher printed units: ${volRes.summary.totalInstantUnits.toLocaleString()}`);
    console.log(`Overhead allocated to Scratchers: $${(volRes.summary.instantTicketShareOfCentralOverhead).toLocaleString()}`);

    console.log("\nSample Games (Volume Basis):");
    volRes.games.slice(0, 3).forEach(g => {
      console.log(`  - Game #${g.gameNumber} [${g.name}] ($${g.denomination}):`);
      console.log(`    * Units: ${Number(g.units).toLocaleString()}`);
      console.log(`    * Allocated Overhead: $${g.allocatedOverhead.toLocaleString()}`);
      console.log(`    * Fully Loaded Profit: $${g.fullyLoadedProfit.toLocaleString()} (Margin: ${g.fullyLoadedMargin.toFixed(2)}%)`);
    });

    console.log("\n✅ Programmatic Cost Allocation Engine verification completed successfully!");
    
  } catch (err) {
    console.error("❌ Allocation math test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testAllocationMath();
