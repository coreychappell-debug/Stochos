// test-db.js
// A quick script to query database using prisma and verify the current schema contents

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { prisma } = require('./lib/db.js');

async function testConnection() {
  try {
    console.log("Checking DB Connection using process.env.DATABASE_URL:", process.env.DATABASE_URL);
    
    // Check if we can run a simple query
    const roles = await prisma.role.findMany();
    console.log(`Roles in DB (${roles.length}):`, roles);

    const users = await prisma.user.findMany();
    console.log(`Users in DB (${users.length}):`, users);

    const templates = await prisma.reportTemplate.findMany();
    console.log(`Report Templates in DB (${templates.length}):`, templates);

    const packages = await prisma.reportPackage.findMany();
    console.log(`Report Packages in DB (${packages.length}):`, packages);

    const metrics = await prisma.metricDefinition.findMany();
    console.log(`Metric Definitions in DB (${metrics.length}):`, metrics);

    const tbRecords = await prisma.trialBalanceRecord.findMany();
    console.log(`Trial Balance Records in DB (${tbRecords.length}):`, tbRecords);

  } catch (error) {
    console.error("Database connection or query failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
