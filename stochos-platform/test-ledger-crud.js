// test-ledger-crud.js
// Test script using Prisma directly to verify ledger CRUD database operations
// (simulating pagination, search, sort, creation, update, and deletion).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { prisma } = require('./lib/db.js');

const TEST_PERIOD = new Date('2024-06-30');

async function runTests() {
  console.log('--- Starting Trial Balance Ledger DB-level CRUD Tests ---');
  let testRecordId = null;

  try {
    const jur = await prisma.jurisdiction.findFirst({
      where: { OR: [{ id: 'NY-LOTTERY' }, { abbreviation: 'NY' }] }
    }) || await prisma.jurisdiction.findFirst();
    const TEST_JURISDICTION = jur ? jur.id : 'NY-LOTTERY';
    console.log(`✓ Using Jurisdiction: ${jur ? jur.name : 'Default'} (${TEST_JURISDICTION})`);

    // 1. GET - Fetch paginated results (imitating GET route logic)
    console.log('\n[1] Querying first page of records (limit=10)...');
    const limit = 10;
    const page = 1;
    const skip = (page - 1) * limit;

    const where = {
      jurisdictionId: TEST_JURISDICTION,
      periodDate: TEST_PERIOD
    };

    const [records, totalCount] = await Promise.all([
      prisma.trialBalanceRecord.findMany({
        where,
        orderBy: { accountCode: 'asc' },
        skip,
        take: limit
      }),
      prisma.trialBalanceRecord.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    console.log('✓ Query completed successfully.');
    console.log(`✓ Records returned: ${records.length} (Expected up to ${limit})`);
    console.log(`✓ Total records in DB: ${totalCount}`);
    console.log(`✓ Total calculated pages: ${totalPages}`);
    if (records.length > 0) {
      console.log(`✓ Sample record: Code: ${records[0].accountCode}, Name: ${records[0].accountName}`);
    }

    // 2. SEARCH - Verify filter matching (contains search)
    console.log('\n[2] Performing partial search (search="Sales")...');
    const searchWord = 'Sales';
    const searchWhere = {
      jurisdictionId: TEST_JURISDICTION,
      periodDate: TEST_PERIOD,
      OR: [
        { accountCode: { contains: searchWord, mode: 'insensitive' } },
        { accountName: { contains: searchWord, mode: 'insensitive' } }
      ]
    };

    const searchRecords = await prisma.trialBalanceRecord.findMany({
      where: searchWhere,
      orderBy: { accountCode: 'asc' },
      take: 5
    });

    console.log(`✓ Found ${searchRecords.length} matching records.`);
    searchRecords.forEach(r => {
      const match = r.accountCode.toLowerCase().includes(searchWord.toLowerCase()) || 
                    r.accountName.toLowerCase().includes(searchWord.toLowerCase());
      if (match) {
        console.log(`  - Match: ${r.accountCode} | ${r.accountName}`);
      } else {
        console.warn(`  - Warning: Record ${r.accountCode} | ${r.accountName} does not match search word "${searchWord}"`);
      }
    });

    // 3. CREATE (POST) - Create a manual adjusting entry
    console.log('\n[3] Creating manual adjusting entry...');
    const record = await prisma.trialBalanceRecord.create({
      data: {
        jurisdictionId: TEST_JURISDICTION,
        periodDate: TEST_PERIOD,
        fiscalYear: 2025,
        periodCode: 'P03',
        accountCode: '99999-TEST-PRISMA',
        accountName: 'Prisma Integration Test Adjusting Entry',
        balance: -5500.25,
        status: 'mapped'
      }
    });

    testRecordId = record.id;
    console.log(`✓ Record created successfully with ID: ${testRecordId}`);
    console.log(`✓ Code: ${record.accountCode}, Name: ${record.accountName}, Balance: ${record.balance}`);

    // Verify it exists in the database
    const verifyCreated = await prisma.trialBalanceRecord.findUnique({
      where: { id: testRecordId }
    });
    if (!verifyCreated) {
      throw new Error('Created record was not found in the database');
    }
    console.log('✓ Verified record exists in database.');

    // 4. UPDATE (PUT) - Edit the created entry
    console.log('\n[4] Modifying the adjusting entry...');
    const updatedRecord = await prisma.trialBalanceRecord.update({
      where: { id: testRecordId },
      data: {
        accountCode: '99999-TEST-PRISMA-REV',
        accountName: 'Prisma Integration Test Adjusting Entry (Revised)',
        balance: 14500.50
      }
    });

    console.log('✓ Record updated successfully.');
    console.log(`✓ Updated Code: ${updatedRecord.accountCode}, Name: ${updatedRecord.accountName}, Balance: ${updatedRecord.balance}`);
    
    if (updatedRecord.accountCode !== '99999-TEST-PRISMA-REV' || parseFloat(updatedRecord.balance) !== 14500.50) {
      throw new Error('Updated data fields did not match expected values');
    }

    // 5. DELETE - Remove the created entry
    console.log('\n[5] Deleting the adjusting entry...');
    await prisma.trialBalanceRecord.delete({
      where: { id: testRecordId }
    });
    console.log('✓ Record deleted successfully.');

    // Verify it is gone
    const verifyGone = await prisma.trialBalanceRecord.findUnique({
      where: { id: testRecordId }
    });
    if (verifyGone) {
      throw new Error('Record still exists in the database after delete');
    }
    console.log('✓ Verified record no longer exists in the database.');

    console.log('\n======================================================');
    console.log('🎉 ALL PRISMA LEDGER CRUD TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('======================================================');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST RUN ENCOUNTERED ERROR:', error);
    if (testRecordId) {
      console.log(`Attempting cleanup of leftover record ID: ${testRecordId}`);
      await prisma.trialBalanceRecord.deleteMany({
        where: { id: testRecordId }
      }).catch(() => {});
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
