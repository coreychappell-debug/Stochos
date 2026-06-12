const { prisma } = require('../lib/db.js');

async function main() {
  const jurs = await prisma.jurisdiction.findMany();
  console.log("Jurisdictions in database:");
  jurs.forEach(j => {
    console.log(`  ID: ${j.id} | Name: ${j.name} | Abbrev: ${j.abbreviation} | fiscalYearStartMonth: ${j.fiscalYearStartMonth}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
