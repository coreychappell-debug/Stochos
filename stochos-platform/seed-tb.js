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
        fiscalYear: 2025,
        periodCode: 'P03',
        accountCode: '4-1000',
        accountName: 'Gross Ticket Sales',
        balance: 850000000.00,
        status: 'imported'
      },
      {
        jurisdictionId: jId,
        periodDate,
        fiscalYear: 2025,
        periodCode: 'P03',
        accountCode: '5-2000',
        accountName: 'Prize Expense',
        balance: -520000000.00,
        status: 'imported'
      },
      {
        jurisdictionId: jId,
        periodDate,
        fiscalYear: 2025,
        periodCode: 'P03',
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

    const defaultRules = [
      { jurisdictionId: jId, accountPattern: '4-1000', metricId: 'sys-001', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '5-2000', metricId: 'sys-002', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '5-2100', metricId: 'sys-003', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '5-2200', metricId: 'sys-004', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '5-2300', metricId: 'sys-005', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '4-3000', metricId: 'sys-006', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '6-4000', metricId: 'sys-007', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '6-4100', metricId: 'sys-008', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '6-4200', metricId: 'sys-009', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '40100-*-*-*', metricId: 'sys-001', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '64100-*-*-*', metricId: 'sys-002', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '64200-*-*-*', metricId: 'sys-003', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') }
    ];

    console.log("Seeding GLCrosswalk rules...");
    await prisma.glCrosswalkRule.deleteMany({ where: { jurisdictionId: jId } });
    for (const rule of defaultRules) {
      await prisma.glCrosswalkRule.create({ data: rule });
    }
    console.log("✓ Seeding GLCrosswalk rules completed.");

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedTB();
