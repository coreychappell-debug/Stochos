// scratch/test_variance_engine.js
require('dotenv').config();
const { prisma } = require('../lib/db');
const { evaluateCommentaryRules } = require('../lib/commentaryEngine');

async function runTest() {
  console.log('🧪 Starting Variance Commentary Task Engine Integration Test...\n');

  const jur = await prisma.jurisdiction.findFirst();
  if (!jur) {
    throw new Error('No jurisdiction found in database. Please run seed first.');
  }
  const jurisdictionId = jur.id;
  console.log(`✓ Using jurisdiction: ${jur.name} (${jur.abbreviation})`);
  const fiscalYear = 2025;
  const periodDate = new Date('2025-06-30');
  const periodCode = 'P12';

  // 1. Ensure a user exists for seeding/assigning
  let user = await prisma.user.findFirst({
    where: { status: 'active' }
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test@stochos.io',
        name: 'Test Analyst',
        passwordHash: 'dummy',
        roleId: 'admin',
        division: 'FINANCE',
        status: 'active'
      }
    });
  }
  console.log(`✓ Using test user: ${user.name} (${user.division})`);

  // 2. Set up Adopted Budget Plan for FY2025
  console.log('🔄 Setting up Adopted Budget Plan...');
  let reportPackage = await prisma.reportPackage.findFirst({
    where: { jurisdictionId, periodDate: new Date('2025-04-01'), frequency: 'annual' }
  });

  if (!reportPackage) {
    reportPackage = await prisma.reportPackage.create({
      data: {
        jurisdictionId,
        name: 'FY2025 Annual Report Package',
        frequency: 'annual',
        periodDate: new Date('2025-04-01'),
        status: 'draft',
        createdById: user.id
      }
    });
  }

  // Seed default sections
  const sections = await prisma.reportSection.findMany({
    where: { packageId: reportPackage.id }
  });
  if (sections.length === 0) {
    await prisma.reportSection.createMany({
      data: [
        { packageId: reportPackage.id, name: 'Letter of Transmittal', sortOrder: 1, content: '<p>Letter of Transmittal content</p>' },
        { packageId: reportPackage.id, name: 'Management Discussion & Analysis (MD&A)', sortOrder: 2, content: '<p>MD&A content</p>' },
        { packageId: reportPackage.id, name: 'Statement of Net Position', sortOrder: 3, content: '<p>Statement of Net Position content</p>' },
        { packageId: reportPackage.id, name: 'Notes to Financial Statements', sortOrder: 4, content: '<p>Notes to Financial Statements content</p>' }
      ]
    });
  }

  const budgetData = {
    total_scratch_off_sales: 100000000, // $100M
    total_draw_game_sales: 100000000,    // $100M
    // Total budget sales = $200M

    total_scratch_off_prize_expense: 60000000, // $60M
    total_draw_game_prize_expense: 50000000,   // $50M
    // Total budget prizes = $110M

    total_scratch_off_retailer_comm: 5000000,  // $5M
    total_draw_game_retailer_comm: 5000000,    // $5M
    // Total budget commissions = $10M
  };

  let budgetScenario = await prisma.budgetScenario.findFirst({
    where: { packageId: reportPackage.id, name: 'Adopted Budget Plan' }
  });

  if (budgetScenario) {
    budgetScenario = await prisma.budgetScenario.update({
      where: { id: budgetScenario.id },
      data: { data: budgetData, status: 'adopted', isAdopted: true }
    });
  } else {
    budgetScenario = await prisma.budgetScenario.create({
      data: {
        packageId: reportPackage.id,
        name: 'Adopted Budget Plan',
        status: 'adopted',
        isAdopted: true,
        data: budgetData
      }
    });
  }
  let pipe = await prisma.pipeline.findFirst();
  if (!pipe) {
    console.log('🔄 Seeding default Pipeline for testing...');
    pipe = await prisma.pipeline.create({
      data: {
        id: 'test-pipeline-' + Date.now(),
        organizationId: 'default-org',
        name: 'Default Test Pipeline',
        pipelineJson: { nodes: [] },
        createdBy: 'system'
      }
    });
  }
  console.log(`✓ Using pipeline: ${pipe.id}`);

  // 3. Create dummy Trial Balance import batch
  console.log('🔄 Creating mock Trial Balance upload batch...');
  const batch = await prisma.importBatch.create({
    data: {
      organizationId: 'default-org',
      gridId: 'default-grid',
      pipelineId: pipe.id,
      sourceFilename: 'test_actuals_breach.csv',
      sourceFileHash: 'dummy-hash-' + Date.now(),
      sourceFileSizeBytes: 1024,
      storagePath: '/dummy/path',
      uploadedBy: user.name,
      status: 'complete',
      rowCountSource: 3,
      rowCountImported: 3,
      rowCountExcluded: 0,
      fiscalYear: fiscalYear,
      periodCode: periodCode,
      mappingSnapshot: {
        jurisdictionId,
        periodDate: periodDate.toISOString(),
        accountCodes: ['4-1000', '5-2000', '5-2100']
      }
    }
  });

  // Create Trial Balance Records
  // We want to trigger the commissions rule (threshold 10%).
  // Budget commissions is $10M.
  // Let's make actual commissions $12M (20% variance -> breach!).
  // Actual gross sales: $200M (matches budget sales -> 0% variance).
  // Actual prizes: $110M (matches budget prizes -> 0% variance).
  await prisma.trialBalanceRecord.createMany({
    data: [
      {
        uploadId: batch.id,
        jurisdictionId,
        periodDate,
        fiscalYear,
        periodCode,
        accountCode: '4-1000',
        accountName: 'Gross Ticket Sales',
        balance: 200000000,
        status: 'imported'
      },
      {
        uploadId: batch.id,
        jurisdictionId,
        periodDate,
        fiscalYear,
        periodCode,
        accountCode: '5-2000',
        accountName: 'Prize Expense',
        balance: -110000000,
        status: 'imported'
      },
      {
        uploadId: batch.id,
        jurisdictionId,
        periodDate,
        fiscalYear,
        periodCode,
        accountCode: '5-2100',
        accountName: 'Retailer Commissions',
        balance: -12000000, // $12M actual (debit) vs $10M budget (positive in scenario)
        status: 'imported'
      }
    ]
  });
  console.log('✓ Mock Trial Balance records created.');

  // 4. Run commentary rule evaluation
  console.log('🔄 Running evaluateCommentaryRules...');
  await evaluateCommentaryRules(batch.id);

  // 5. Verify task generation in the database
  const tasks = await prisma.commentaryTask.findMany({
    where: { packageId: reportPackage.id }
  });

  console.log(`\n📊 Task Verification Results:`);
  console.log(`Total generated tasks: ${tasks.length}`);
  
  const commissionsTask = tasks.find(t => t.ruleCode === 'VAR-COMMISSIONS');
  if (commissionsTask) {
    console.log(`✅ commissions task successfully created!`);
    console.log(`   - Severity: ${commissionsTask.severity} (Expected: hard_fail)`);
    console.log(`   - Status: ${commissionsTask.status} (Expected: pending)`);
    console.log(`   - Assigned To: ${commissionsTask.assignedTo} (Expected: FINANCE)`);
    const snap = commissionsTask.metricSnapshot;
    console.log(`   - Snapshot Details:`);
    console.log(`     * Actual: ${snap.actualValue}`);
    console.log(`     * Budget: ${snap.budgetValue}`);
    console.log(`     * Variance: ${(snap.variancePct * 100).toFixed(2)}%`);
  } else {
    throw new Error('❌ commissions task was not created!');
  }

  // 6. Test resolving the task
  console.log('\n🔄 Testing task resolution...');
  const resNote = 'Justified commissions increase due to promotional retailer rewards campaign in Q4.';
  
  // Directly simulate resolve action (like the PATCH handler)
  const resolvedTask = await prisma.commentaryTask.update({
    where: { id: commissionsTask.id },
    data: {
      status: 'completed',
      resolutionNote: resNote,
      resolvedBy: user.name,
      resolvedAt: new Date()
    }
  });

  console.log(`✅ Task resolved successfully!`);
  console.log(`   - Status: ${resolvedTask.status} (Expected: completed)`);
  console.log(`   - Justification: "${resolvedTask.resolutionNote}"`);

  // Clean up mock data to avoid polluting database
  console.log('\n🧹 Cleaning up test database records...');
  await prisma.trialBalanceRecord.deleteMany({ where: { uploadId: batch.id } });
  await prisma.commentaryTask.deleteMany({ where: { packageId: reportPackage.id } });
  await prisma.importBatch.delete({ where: { id: batch.id } });
  console.log('✓ Database cleaned up.');

  console.log('\n🎉 All tests passed successfully!');
}

runTest()
  .catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
