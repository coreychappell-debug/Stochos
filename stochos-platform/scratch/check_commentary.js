// scratch/check_commentary.js
require('dotenv').config();
const { prisma } = require('../lib/db');

async function check() {
  try {
    const rulesCount = await prisma.commentaryRule.count();
    const tasksCount = await prisma.commentaryTask.count();
    const pkgsCount = await prisma.reportPackage.count();
    console.log(`Report Packages: ${pkgsCount}`);
    console.log(`Commentary Rules: ${rulesCount}`);
    console.log(`Commentary Tasks: ${tasksCount}`);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
check();
