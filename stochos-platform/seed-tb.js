// seed-tb.js
// Seeds a few sample TrialBalanceRecord entries so the Grid can fetch live data from the database.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { prisma } = require('./lib/db.js');

async function seedTB() {
  try {
    const periodDate = new Date('2024-06-30');
    const jurisdictionId = 'NY-LOTTERY';

    // Ensure jurisdiction exists dynamically
    let jId = jurisdictionId;
    const existingJ = await prisma.jurisdiction.findFirst({
      where: { OR: [{ id: jurisdictionId }, { abbreviation: 'NY' }] }
    });
    if (existingJ) {
      jId = existingJ.id;
      console.log(`Using existing jurisdiction: ${existingJ.name} (ID: ${jId})`);
    } else {
      const createdJ = await prisma.jurisdiction.create({
        data: { id: jurisdictionId, name: 'New York Lottery', abbreviation: 'NY' }
      });
      console.log(`Created new jurisdiction: ${createdJ.name} (ID: ${jId})`);
    }

    const records = [
      {
        jurisdictionId: jId,
        periodDate,
        accountCode: '4-1000',
        accountName: 'Gross Ticket Sales',
        balance: 850000000.00,
        status: 'imported'
      },
      {
        jurisdictionId: jId,
        periodDate,
        accountCode: '5-2000',
        accountName: 'Prize Expense',
        balance: -520000000.00,
        status: 'imported'
      },
      {
        jurisdictionId: jId,
        periodDate,
        accountCode: '5-2100',
        accountName: 'Retailer Commissions',
        balance: -48000000.00,
        status: 'imported'
      }
    ];

    console.log("Seeding Trial Balance records...");
    for (const r of records) {
      await prisma.trialBalanceRecord.deleteMany({
        where: {
          jurisdictionId: r.jurisdictionId,
          periodDate: r.periodDate,
          accountCode: r.accountCode
        }
      });
      await prisma.trialBalanceRecord.create({ data: r });
    }
    console.log("✓ Seeding Trial Balance records completed.");

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTB();
