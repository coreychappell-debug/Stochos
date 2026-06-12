// scratch/test_versions.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function runTest() {
  console.log("Starting Budget Version Snapshot & Restore Integration Test...");

  const jurisdictionId = 'NY-LOTTERY';
  const division = 'IT';
  const fiscalYear = 2027;

  // 1. Get default admin user
  const user = await prisma.user.findFirst({
    where: { role: { name: 'admin' } }
  });

  if (!user) {
    throw new Error("No admin user found to run test.");
  }
  console.log(`Using user: ${user.name} (${user.email})`);

  // 2. Fetch or create a test division-level proposal
  let proposal = await prisma.budgetProposal.findFirst({
    where: { jurisdictionId, division, bureau: "", subunit: "", fiscalYear }
  });

  if (!proposal) {
    proposal = await prisma.budgetProposal.create({
      data: {
        jurisdictionId,
        division,
        bureau: "",
        subunit: "",
        fiscalYear,
        status: "draft",
        proposalData: [],
        submittedById: user.id
      }
    });
  }

  console.log(`Working with budget proposal ID: ${proposal.id}`);

  // Clean any old versions for this proposal
  await prisma.budgetProposalVersion.deleteMany({
    where: { proposalId: proposal.id }
  });

  // 3. Update proposal with mock data (V1)
  const v1Data = [
    { category: 'Software', desc: 'Microsoft Licenses', amount: 50000.00 },
    { category: 'Hardware', desc: 'Laptops', amount: 30000.00 }
  ];

  await prisma.budgetProposal.update({
    where: { id: proposal.id },
    data: { proposalData: v1Data, notes: 'Version 1 Draft' }
  });

  // Save V1 Snapshot manually to simulate the first save
  await prisma.budgetProposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNumber: 1,
      proposalData: v1Data,
      notes: 'Manually saved Version 1 snapshot',
      createdById: user.id
    }
  });
  console.log("✓ Saved Version 1 Snapshot.");

  // 4. Update proposal with mock data (V2)
  const v2Data = [
    { category: 'Software', desc: 'Microsoft Licenses', amount: 55000.00 },
    { category: 'Hardware', desc: 'Laptops', amount: 32000.00 },
    { category: 'Consulting', desc: 'Security Audit', amount: 15000.00 }
  ];

  await prisma.budgetProposal.update({
    where: { id: proposal.id },
    data: { proposalData: v2Data, notes: 'Version 2 Draft' }
  });

  // Save V2 Snapshot manually
  await prisma.budgetProposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNumber: 2,
      proposalData: v2Data,
      notes: 'Manually saved Version 2 snapshot',
      createdById: user.id
    }
  });
  console.log("✓ Saved Version 2 Snapshot.");

  // Verify versions count
  const count = await prisma.budgetProposalVersion.count({
    where: { proposalId: proposal.id }
  });
  console.log(`Total versions in DB: ${count}`);
  if (count !== 2) {
    throw new Error(`Expected 2 versions, found ${count}`);
  }

  // 5. Test RESTORE logic (Restore V1)
  console.log("Restoring Version 1...");
  const versionToRestore = await prisma.budgetProposalVersion.findUnique({
    where: {
      proposalId_versionNumber: {
        proposalId: proposal.id,
        versionNumber: 1
      }
    }
  });

  // Backup current state (V2) as V3 before overwrite
  const currentCount = await prisma.budgetProposalVersion.count({
    where: { proposalId: proposal.id }
  });
  const backupVer = currentCount + 1;

  const currentProposal = await prisma.budgetProposal.findUnique({
    where: { id: proposal.id }
  });

  await prisma.budgetProposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNumber: backupVer,
      proposalData: currentProposal.proposalData,
      notes: `Backup snapshot prior to restoring version v1`,
      createdById: user.id
    }
  });
  console.log(`✓ Saved backup of current state as Version ${backupVer}`);

  // Overwrite
  const updatedProposal = await prisma.budgetProposal.update({
    where: { id: proposal.id },
    data: {
      proposalData: versionToRestore.proposalData,
      notes: `Restored version v1`
    }
  });

  console.log("Verifying restored data...");
  const restoredData = updatedProposal.proposalData;
  console.log("Restored proposalData:", JSON.stringify(restoredData));

  if (restoredData.length !== 2 || restoredData[0].amount !== 50000.00) {
    throw new Error("Restored data does not match V1 data!");
  }
  console.log("✓ Restore assertions passed! Version restored successfully.");

  // Clean up test versions
  await prisma.budgetProposalVersion.deleteMany({
    where: { proposalId: proposal.id }
  });

  console.log("All version snapshotting and restoration tests passed successfully!");
}

runTest()
  .catch(err => {
    console.error("Test failed:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
