require('dotenv').config({ path: '.env.local' });
const { prisma } = require('../lib/db');

async function check() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, jurisdictionId: true }
    });
    console.log("Users in database:");
    console.log(users);

    const jurisdictions = await prisma.jurisdiction.findMany();
    console.log("Jurisdictions in database:");
    console.log(jurisdictions);

    // check if there are trial balance records and gasb rows
    const gasbRows = await prisma.gasbRow.groupBy({
      by: ['jurisdictionId'],
      _count: true
    });
    console.log("Gasb rows by jurisdictionId:");
    console.log(gasbRows);

    const tbRecords = await prisma.trialBalanceRecord.groupBy({
      by: ['jurisdictionId'],
      _count: true
    });
    console.log("Trial balance records by jurisdictionId:");
    console.log(tbRecords);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
