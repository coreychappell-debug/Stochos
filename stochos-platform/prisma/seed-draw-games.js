// prisma/seed-draw-games.js
// Seeds draw game products, draw scenarios, and sample budget proposals for QA testing.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🎰 Seeding Draw Game Planner and Budget Proposal data...\n');

  // Find Jurisdiction
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) throw new Error('NY jurisdiction not found. Run base seed first.');
  console.log(`  ✓ Found jurisdiction: ${ny.name}`);

  // Find Users
  const itUser = await prisma.user.findUnique({ where: { email: 'it.user@gaming.ny.gov' } });
  const marketingUser = await prisma.user.findUnique({ where: { email: 'marketing.user@gaming.ny.gov' } });
  const procurementUser = await prisma.user.findUnique({ where: { email: 'procurement.user@gaming.ny.gov' } });
  
  if (!itUser || !marketingUser || !procurementUser) {
    throw new Error('Missing seed users. Run seed-divisions-users.js first.');
  }
  console.log('  ✓ Found divisional seed users');

  // Clean previous data
  await prisma.drawGameProjectedItem.deleteMany({});
  await prisma.drawGameScenario.deleteMany({ where: { jurisdictionId: ny.id } });
  await prisma.budgetProposal.deleteMany({ where: { jurisdictionId: ny.id } });
  await prisma.product.deleteMany({ where: { jurisdictionId: ny.id, category: 'draw_game', externalSource: 'draw_game_planner' } });
  console.log('  ✓ Cleaned previous draw and budget data');

  // Seed Draw Products
  const drawProducts = [
    { name: 'Mega Millions', type: 'lotto_jackpot', price: 2.00, status: 'active' },
    { name: 'Powerball', type: 'lotto_jackpot', price: 2.00, status: 'active' },
    { name: 'Cash4Life', type: 'lotto_jackpot', price: 2.00, status: 'inactive' }, // Discontinued Feb 21, 2026
    { name: 'NY Lotto', type: 'lotto_jackpot', price: 1.00, status: 'active' },
    { name: 'Numbers', type: 'pick_3', price: 1.00, status: 'active' },
    { name: 'Win 4', type: 'pick_4', price: 1.00, status: 'active' },
    { name: 'Take 5', type: 'draw_game', price: 1.00, status: 'active' },
    { name: 'Pick 10', type: 'draw_game', price: 1.00, status: 'active' },
    { name: 'Quick Draw', type: 'keno', price: 1.00, status: 'active' }
  ];

  const productMap = {};
  for (const dp of drawProducts) {
    const prod = await prisma.product.create({
      data: {
        jurisdictionId: ny.id,
        name: dp.name,
        category: 'draw_game',
        type: dp.type,
        price: dp.price,
        status: dp.status,
        externalCode: dp.name.toLowerCase().replace(/\s+/g, '_'),
        externalSource: 'draw_game_planner'
      }
    });
    productMap[dp.name] = prod.id;
  }
  console.log('  ✓ Seeded draw game products');

  // Mark all Cash4Life products inactive across all sources to reflect discontinuation
  await prisma.product.updateMany({
    where: { name: 'Cash4Life' },
    data: { status: 'inactive' }
  });
  console.log('  ✓ Marked all Cash4Life products inactive');

  // Create Draw Scenario
  const drawScenario = await prisma.drawGameScenario.create({
    data: {
      jurisdictionId: ny.id,
      fiscalYear: 2027,
      name: 'FY2027 Base Draw Plan',
      status: 'approved'
    }
  });

  const projections = [
    { name: 'Mega Millions', sales: 350000000.00, payout: 50.0, comm: 6.0 },
    { name: 'Powerball', sales: 320000000.00, payout: 50.0, comm: 6.0 },
    { name: 'NY Lotto', sales: 60000000.00, payout: 40.0, comm: 6.0 },
    { name: 'Numbers', sales: 280000000.00, payout: 50.0, comm: 6.0 },
    { name: 'Win 4', sales: 310000000.00, payout: 50.0, comm: 6.0 },
    { name: 'Take 5', sales: 120000000.00, payout: 50.0, comm: 6.0 },
    { name: 'Pick 10', sales: 45000000.00, payout: 50.0, comm: 6.0 },
    { name: 'Quick Draw', sales: 650000000.00, payout: 60.0, comm: 6.0 }
  ];

  for (const p of projections) {
    await prisma.drawGameProjectedItem.create({
      data: {
        scenarioId: drawScenario.id,
        productId: productMap[p.name],
        name: p.name,
        projectedSales: p.sales,
        prizePayoutPercent: p.payout,
        retailerCommPercent: p.comm
      }
    });
  }
  console.log('  ✓ Seeded draw game projections in base plan');

  // Seed Budget Proposals
  const proposals = [
    {
      division: 'IT',
      fiscalYear: 2027,
      status: 'submitted',
      submittedById: itUser.id,
      proposalData: [
        { category: 'Software', desc: 'Prisma v8 Enterprise Support & Database Tooling', amount: 18000.00 },
        { category: 'Hardware', desc: 'Developer Workstation & WSL2 Laptop Upgrades', amount: 24000.00 },
        { category: 'Infrastructure', desc: 'Caddy & Docker staging cluster hosting', amount: 12000.00 }
      ],
      notes: 'Standard IT operational budget for supporting WSL2/PostgreSQL containers and web platform security.'
    },
    {
      division: 'MARKETING',
      fiscalYear: 2027,
      status: 'draft',
      submittedById: marketingUser.id,
      proposalData: [
        { category: 'Advertising', desc: 'Multi-channel POS & outdoor placements', amount: 120000.00 },
        { category: 'Events', desc: 'Scratcher launch events & media buying', amount: 45000.00 }
      ],
      notes: 'Initial draft for Q1 media placements and event tracking.'
    },
    {
      division: 'PROCUREMENT',
      fiscalYear: 2027,
      status: 'approved',
      submittedById: procurementUser.id,
      proposalData: [
        { category: 'Operations', desc: 'Third-party contract compliance background checks', amount: 8000.00 }
      ],
      notes: 'Approved background check compliance budget.'
    }
  ];

  for (const prop of proposals) {
    await prisma.budgetProposal.create({
      data: {
        jurisdictionId: ny.id,
        division: prop.division,
        fiscalYear: prop.fiscalYear,
        status: prop.status,
        proposalData: prop.proposalData,
        submittedById: prop.submittedById,
        notes: prop.notes
      }
    });
  }
  console.log('  ✓ Seeded divisional budget proposals');
  console.log('\n✅ Draw Game Planner & Budget seed complete.\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
