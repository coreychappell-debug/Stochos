const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../lib/db.js');

async function main() {
  const counts = await prisma.trialBalanceRecord.groupBy({
    by: ['fiscalYear', 'periodCode'],
    _count: {
      _all: true
    },
    where: {
      jurisdictionId: 'NY-LOTTERY'
    },
    orderBy: [
      { fiscalYear: 'asc' },
      { periodCode: 'asc' }
    ]
  });

  console.log("=== Ingested Records by Fiscal Year and Period ===");
  counts.forEach(c => {
    console.log(`  FY ${c.fiscalYear} | Period ${c.periodCode} | Record Count: ${c._count._all}`);
  });

  const total = await prisma.trialBalanceRecord.count({
    where: { jurisdictionId: 'NY-LOTTERY' }
  });
  console.log(`\nTotal Trial Balance records for NY-LOTTERY: ${total}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
