const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function main() {
  const updated = await prisma.jurisdiction.update({
    where: { id: 'NY-LOTTERY' },
    data: { fiscalYearStartMonth: 7 }
  });
  console.log(`Successfully updated jurisdiction: ${updated.name} (Abbrev: ${updated.abbreviation}) to fiscalYearStartMonth: ${updated.fiscalYearStartMonth}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
