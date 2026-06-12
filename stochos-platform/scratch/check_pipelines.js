const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../lib/db.js');

async function main() {
  const pipelines = await prisma.pipeline.findMany();
  console.log("=== Pipelines ===");
  console.log(JSON.stringify(pipelines, null, 2));

  const jurisdictions = await prisma.jurisdiction.findMany();
  console.log("\n=== Jurisdictions ===");
  console.log(JSON.stringify(jurisdictions, null, 2));

  const rules = await prisma.glCrosswalkRule.findMany();
  console.log("\n=== GL Crosswalk Rules (First 10) ===");
  console.log(JSON.stringify(rules.slice(0, 10), null, 2));
  
  const metricDefs = await prisma.metricDefinition.findMany();
  console.log("\n=== Metric Definitions ===");
  console.log(JSON.stringify(metricDefs, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
