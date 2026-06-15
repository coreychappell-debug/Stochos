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
  const opsUser = await prisma.user.findUnique({ where: { email: 'ops.user@gaming.ny.gov' } });
  const financeUser = await prisma.user.findUnique({ where: { email: 'finance.user@gaming.ny.gov' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin.user@gaming.ny.gov' } });
  
  if (!itUser || !marketingUser || !procurementUser || !opsUser || !financeUser || !adminUser) {
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

  // Query Contracts to associate them with the budget line items
  const igt = await prisma.contract.findFirst({ where: { title: { OR: [ { contains: 'IGT' }, { contains: 'BrightStar' }, { contains: 'C150005' } ] } } });
  const mc = await prisma.contract.findFirst({ where: { title: { contains: 'McCann' } } });
  const verizon = await prisma.contract.findFirst({ where: { title: { contains: 'Verizon' } } });
  const havas = await prisma.contract.findFirst({ where: { title: { contains: 'Havas' } } });
  const shi = await prisma.contract.findFirst({ where: { title: { contains: 'SHI' } } });
  const nrc = await prisma.contract.findFirst({ where: { title: { contains: 'NRC' } } });

  // Seed Budget Proposals
  const proposals = [
    {
      division: 'IT',
      fiscalYear: 2027,
      status: 'draft', // Seeded as draft so the user can test the EOL hardware sync and then submit/approve
      submittedById: itUser.id,
      proposalData: [
        { category: 'Software & Licensing', desc: 'SHI Enterprise Software & Oracle Databases', amount: 1600000.00, contractId: shi?.id || "" },
        { category: 'Telecommunications', desc: 'Verizon Secure MPLS Networking for Retail Terminals', amount: 1200000.00, contractId: verizon?.id || "" },
        { category: 'Infrastructure', desc: 'Cloud Infrastructure Staging & Hosting', amount: 800000.00, contractId: "" }
      ],
      notes: 'Initial IT operational budget for support, security, network routing, and software license maintenance.'
    },
    {
      division: 'MARKETING',
      fiscalYear: 2027,
      status: 'approved', // Seeded as approved so it rolls up to the adopted budget immediately
      submittedById: marketingUser.id,
      proposalData: [
        { category: 'Advertising', desc: 'McCann Worldgroup Creative POS & Campaigns', amount: 22000000.00, contractId: mc?.id || "" },
        { category: 'Media Buying', desc: 'Havas Media Broadcast & Print Buying Services', amount: 15000000.00, contractId: havas?.id || "" },
        { category: 'Regional Events', desc: 'Scratcher Launch Events & Regional Promotions', amount: 4000000.00, contractId: "" },
        { category: 'POS Materials', desc: 'POS Counter Display & Printed Inserts Refresh', amount: 1500000.00, contractId: "" }
      ],
      notes: 'Creative campaigns, broadcast placements, POS materials, and regional event ads for FY2027.'
    },
    {
      division: 'OPERATIONS',
      fiscalYear: 2027,
      status: 'approved', // Seeded as approved so it rolls up
      submittedById: opsUser.id,
      proposalData: [
        { category: 'Gaming System Support', desc: 'IGT Central Gaming System Operational Support', amount: 18000000.00, contractId: igt?.id || "" },
        { category: 'Fleet Operations', desc: 'Fleet Cargo Vans Fuel, Leasing & Maintenance', amount: 3500000.00, contractId: "" },
        { category: 'Logistics', desc: 'Scratch-off Ticket Delivery & Warehouse Logistics', amount: 5400000.00, contractId: "" },
        { category: 'Training & Safety', desc: 'Operational Staff Safety Training & Gear', amount: 1500000.00, contractId: "" }
      ],
      notes: 'Core operations budget including main IGT contract fees, fleet logistics, and warehouse operations.'
    },
    {
      division: 'FINANCE',
      fiscalYear: 2027,
      status: 'approved', // Seeded as approved
      submittedById: financeUser.id,
      proposalData: [
        { category: 'Audit Services', desc: 'Independent Audits & Statutory Compliance Reviews', amount: 1200000.00, contractId: "" },
        { category: 'Personnel', desc: 'Finance & Accounting Department Salaries', amount: 1100000.00, contractId: "" },
        { category: 'G&A', desc: 'Office Administrative Expenses & G&A', amount: 500000.00, contractId: "" }
      ],
      notes: 'Finance division operating costs, internal audits, and accounting salaries.'
    },
    {
      division: 'PROCUREMENT',
      fiscalYear: 2027,
      status: 'approved', // Seeded as approved
      submittedById: procurementUser.id,
      proposalData: [
        { category: 'Compliance Reviews', desc: 'NRC Group Consumer Insights & Vendor Audits', amount: 650000.00, contractId: nrc?.id || "" },
        { category: 'Personnel', desc: 'Procurement Department Salaries', amount: 600000.00, contractId: "" },
        { category: 'Travel & G&A', desc: 'Compliance Travel & Procurement Operations G&A', amount: 200000.00, contractId: "" }
      ],
      notes: 'Approved procurement compliance, vendor audits, and procurement team salaries.'
    },
    {
      division: 'EXECUTIVE',
      fiscalYear: 2027,
      status: 'approved', // Seeded as approved
      submittedById: adminUser.id,
      proposalData: [
        { category: 'Personnel', desc: 'Commission Leadership & Board Salaries', amount: 1200000.00, contractId: "" },
        { category: 'Legal Services', desc: 'Statutory Hearings & General Counsel Services', amount: 500000.00, contractId: "" },
        { category: 'Travel & G&A', desc: 'Executive Travel & Administrative G&A', amount: 200000.00, contractId: "" }
      ],
      notes: 'Executive leadership, board oversight, legal hearings, and G&A.'
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
