const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function main() {
  try {
    const counts = await prisma.trialBalanceRecord.groupBy({
      by: ['fiscalYear', 'periodCode', 'jurisdictionId'],
      _count: true
    });
    console.log('Trial Balance Record counts by Year and Period:', counts);
    
    const jurisdictions = await prisma.jurisdiction.findMany();
    console.log('Jurisdictions in database:', jurisdictions.map(j => ({ id: j.id, name: j.name, abbreviation: j.abbreviation })));
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
