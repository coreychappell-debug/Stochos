const { prisma } = require('../lib/db.js');

async function main() {
  const recs = await prisma.trialBalanceRecord.findMany({
    where: { jurisdictionId: 'NY-LOTTERY', fiscalYear: 2025, periodCode: 'P03' }
  });
  console.log(`Found ${recs.length} records:`);
  let sum = 0;
  for (const r of recs) {
    console.log(`  ${r.accountCode} | ${r.accountName} | ${r.balance}`);
    sum += parseFloat(r.balance);
  }
  console.log(`Sum of balances: ${sum}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
