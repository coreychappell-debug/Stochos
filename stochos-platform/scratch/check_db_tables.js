// scratch/check_db_tables.js
require('dotenv').config();
const { prisma } = require('../lib/db');

async function main() {
  const pipelines = await prisma.pipeline.findMany();
  const batches = await prisma.importBatch.findMany();
  const jurisdictions = await prisma.jurisdiction.findMany();
  console.log('Pipelines:', pipelines);
  console.log('Batches:', batches);
  console.log('Jurisdictions:', jurisdictions);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
