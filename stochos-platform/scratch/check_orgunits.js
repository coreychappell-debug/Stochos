const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function main() {
  try {
    const orgUnits = await prisma.orgUnit.findMany({
      select: { id: true, name: true, code: true }
    });
    console.log('Org Units in database:', orgUnits);
    
    const users = await prisma.user.findMany({
      take: 10,
      select: { id: true, name: true, email: true, division: true }
    });
    console.log('Users (sample) in database:', users);
  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
