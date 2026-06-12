// scratch/inspect_tb_records.js
const path = require('path');
require('../stochos-platform/node_modules/dotenv').config({ path: path.join(__dirname, '../stochos-platform/.env') });

const { prisma } = require('../stochos-platform/lib/db.js');

async function main() {
  try {
    const records = await prisma.trialBalanceRecord.findMany({
      orderBy: { accountCode: 'asc' }
    });
    console.log(`Found ${records.length} trial balance records.`);
    
    // Group by account
    const accounts = {};
    records.forEach(r => {
      if (!accounts[r.accountCode]) {
        accounts[r.accountCode] = {
          code: r.accountCode,
          name: r.accountName,
          periods: []
        };
      }
      accounts[r.accountCode].periods.push({
        fy: r.fiscalYear,
        period: r.periodCode,
        balance: parseFloat(r.balance.toString())
      });
    });

    console.log("Account Summary:");
    Object.values(accounts).forEach(acc => {
      console.log(`- ${acc.code} (${acc.name}):`);
      acc.periods.forEach(p => {
        console.log(`  * FY${p.fy} ${p.period}: ${p.balance.toLocaleString()}`);
      });
    });
  } catch (error) {
    console.error("Error inspecting TB records:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
