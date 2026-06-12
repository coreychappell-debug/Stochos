const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function check() {
  const locks = await prisma.systemJobLock.findMany();
  console.log("ACTIVE JOB LOCKS IN DATABASE:", locks);
  
  if (locks.length > 0) {
    console.log("Clearing all job locks to resolve any stuck processes...");
    await prisma.systemJobLock.deleteMany({});
    console.log("All locks cleared successfully.");
  }
}

check().catch(console.error).finally(() => prisma.$disconnect());
