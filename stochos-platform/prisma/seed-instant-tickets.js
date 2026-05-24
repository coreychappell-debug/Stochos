require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🎰 Seeding Instant Ticket Planner data...\n');

  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) throw new Error('NY jurisdiction not found. Run base seed first.');

  const vendors = await prisma.vendor.findMany({ where: { type: 'printer', jurisdictionId: ny.id } });
  const vendorMap = {};
  for (const v of vendors) {
    if (v.name.includes('Scientific')) vendorMap.sg = v;
    else if (v.name.includes('Pollard')) vendorMap.pb = v;
    else if (v.name.includes('Game Tech') || v.name.includes('IGT')) vendorMap.igt = v;
  }
  if (!vendorMap.sg || !vendorMap.pb || !vendorMap.igt) throw new Error('Missing printer vendors');
  console.log('  ✓ Found vendors');

  // Clean previous data
  await prisma.instantTicketVendorPricing.deleteMany({});
  await prisma.instantTicketPlan.deleteMany({ where: { jurisdictionId: ny.id } });
  // Clean old instant product entries
  await prisma.product.deleteMany({ where: { jurisdictionId: ny.id, category: 'instant', externalSource: 'instant_ticket_planner' } });
  console.log('  ✓ Cleaned previous data');

  // Vendor pricing
  const sizes = ['2.4x4', '4x4', '6x4', '8x4', '12x8', '12x12'];
  const sgR = { '2.4x4': 1.35, '4x4': 1.45, '6x4': 1.55, '8x4': 1.65, '12x8': 1.85, '12x12': 2.10 };
  const pbR = { '2.4x4': 17.50, '4x4': 19.25, '6x4': 22.80, '8x4': 26.50, '12x8': 34.75, '12x12': 42.00 };
  const igR = { '2.4x4': 18.90, '4x4': 20.75, '6x4': 24.50, '8x4': 28.25, '12x8': 37.00, '12x12': 45.50 };
  for (const s of sizes) {
    await prisma.instantTicketVendorPricing.create({ data: { vendorId: vendorMap.sg.id, costModel: 'percent_of_sales', ticketSize: s, baseCost: sgR[s], minQuantity: 0 } });
    await prisma.instantTicketVendorPricing.create({ data: { vendorId: vendorMap.pb.id, costModel: 'per_thousand', ticketSize: s, baseCost: pbR[s], minQuantity: 0 } });
    await prisma.instantTicketVendorPricing.create({ data: { vendorId: vendorMap.igt.id, costModel: 'per_thousand', ticketSize: s, baseCost: igR[s], minQuantity: 0 } });
  }
  console.log('  ✓ Vendor pricing created');

  // Plan
  const plan = await prisma.instantTicketPlan.create({
    data: {
      jurisdictionId: ny.id, name: 'FY2027 Instant Game Plan', fiscalYear: 2027,
      totalSalesTarget: 5200000000.00, retailerCommPct: 6.0, adminExpensePct: 1.5, sellThroughPct: 96.5,
      status: 'approved',
      notes: 'Annual instant ticket portfolio plan for New York Lottery FY2027 (Apr 2026 - Mar 2027).',
    }
  });

  const baseScenario = await prisma.instantTicketScenario.create({
    data: {
      planId: plan.id, name: 'Base Plan', sortOrder: 0,
      denominations: [
        { price: 1, mixPercent: 6, isActive: true }, { price: 2, mixPercent: 10, isActive: true },
        { price: 3, mixPercent: 8, isActive: true }, { price: 5, mixPercent: 22, isActive: true },
        { price: 10, mixPercent: 24, isActive: true }, { price: 20, mixPercent: 18, isActive: true },
        { price: 25, mixPercent: 0, isActive: false }, { price: 30, mixPercent: 10, isActive: true },
        { price: 50, mixPercent: 2, isActive: true },
      ]
    }
  });
  console.log('  ✓ Plan + scenario created');

  // Game lifecycle statuses:
  // received + launchDate in past = on_sale or closed or ended
  // received + no launchDate = waiting to launch
  // Games use: planned → ordered → in_production → shipped → received → on_sale → closed → ended
  const games = [
    // $1 games — mix of active, ended from prior FY
    { num: '1401', name: 'Lucky 7s', denom: 1, size: '2.4x4', vendor: 'sg', units: 24000000, payout: 61.0, topPrize: 5000, features: [], delivery: 'received', po: 'PO-2026-0101', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1402', name: 'Triple Cash', denom: 1, size: '2.4x4', vendor: 'pb', units: 18000000, payout: 62.0, topPrize: 5000, features: [], delivery: 'in_production', po: 'PO-2026-0102', launch: null, close: null, end: null, prodStatus: 'in_production' },
    { num: '1403', name: 'Bingo Blast', denom: 1, size: '2.4x4', vendor: 'sg', units: 18000000, payout: 60.5, topPrize: 7500, features: ['Extended Play (Crossword/Bingo)'], delivery: 'planned', po: null, launch: null, close: null, end: null, prodStatus: 'planned' },
    { num: '1380', name: 'Cash Craze', denom: 1, size: '2.4x4', vendor: 'pb', units: 18000000, payout: 61.5, topPrize: 5000, features: [], delivery: 'received', po: 'PO-2025-0103', launch: '2025-06-01', close: '2026-01-15', end: '2026-04-15', prodStatus: 'ended' },
    // $2 games
    { num: '1410', name: 'Double Gold', denom: 2, size: '4x4', vendor: 'pb', units: 24000000, payout: 64.0, topPrize: 25000, features: ['Metallic Ink'], delivery: 'received', po: 'PO-2026-0201', launch: '2026-05-01', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1411', name: 'Crossword Frenzy', denom: 2, size: '4x4', vendor: 'sg', units: 18000000, payout: 63.5, topPrize: 25000, features: ['Extended Play (Crossword/Bingo)'], delivery: 'received', po: 'PO-2026-0202', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1412', name: 'Wild Cherry', denom: 2, size: '4x4', vendor: 'igt', units: 18000000, payout: 64.5, topPrize: 20000, features: ['Sparkle/Glitter Coating'], delivery: 'in_production', po: 'PO-2026-0203', launch: null, close: null, end: null, prodStatus: 'in_production' },
    { num: '1390', name: 'Sapphire Blue', denom: 2, size: '4x4', vendor: 'sg', units: 18000000, payout: 63.0, topPrize: 20000, features: [], delivery: 'received', po: 'PO-2025-0204', launch: '2025-07-01', close: '2026-03-01', end: null, prodStatus: 'closed' },
    // $5 games
    { num: '1430', name: 'Empire State Gold', denom: 5, size: '6x4', vendor: 'sg', units: 24000000, payout: 67.0, topPrize: 200000, features: ['Holographic Foil'], delivery: 'received', po: 'PO-2026-0401', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1431', name: 'Cash Explosion', denom: 5, size: '6x4', vendor: 'pb', units: 18000000, payout: 67.5, topPrize: 200000, features: ['Metallic Ink'], delivery: 'received', po: 'PO-2026-0402', launch: '2026-05-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1432', name: '$500 Frenzy', denom: 5, size: '6x4', vendor: 'sg', units: 24000000, payout: 68.0, topPrize: 150000, features: [], delivery: 'in_production', po: 'PO-2026-0403', launch: null, close: null, end: null, prodStatus: 'in_production' },
    { num: '1433', name: 'Monopoly Jackpot', denom: 5, size: '6x4', vendor: 'pb', units: 18000000, payout: 67.0, topPrize: 250000, features: ['Licensed Property Usage', 'Holographic Foil'], delivery: 'shipped', po: 'PO-2026-0404', launch: null, close: null, end: null, prodStatus: 'shipped' },
    { num: '1370', name: 'Triple 777', denom: 5, size: '6x4', vendor: 'igt', units: 12000000, payout: 66.5, topPrize: 100000, features: [], delivery: 'received', po: 'PO-2025-0405', launch: '2025-04-01', close: '2025-12-15', end: '2026-03-15', prodStatus: 'ended' },
    // $10 games
    { num: '1440', name: '$1,000,000 Mania', denom: 10, size: '8x4', vendor: 'sg', units: 18000000, payout: 69.0, topPrize: 1000000, features: ['Holographic Foil', 'Metallic Ink'], delivery: 'received', po: 'PO-2026-0501', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1441', name: 'Platinum Payout', denom: 10, size: '8x4', vendor: 'pb', units: 18000000, payout: 69.5, topPrize: 1000000, features: ['Holographic Foil'], delivery: 'received', po: 'PO-2026-0502', launch: '2026-05-01', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1442', name: 'Wild 10X', denom: 10, size: '8x4', vendor: 'igt', units: 12000000, payout: 68.5, topPrize: 500000, features: ['Sparkle/Glitter Coating'], delivery: 'in_production', po: 'PO-2026-0503', launch: null, close: null, end: null, prodStatus: 'in_production' },
    { num: '1443', name: '100X The Cash', denom: 10, size: '8x4', vendor: 'sg', units: 18000000, payout: 70.0, topPrize: 2000000, features: ['Holographic Foil', 'Oversized Format'], delivery: 'shipped', po: 'PO-2026-0504', launch: null, close: null, end: null, prodStatus: 'shipped' },
    // $20 games
    { num: '1450', name: '$5,000,000 Jackpot', denom: 20, size: '8x4', vendor: 'sg', units: 12000000, payout: 71.0, topPrize: 5000000, features: ['Holographic Foil', 'Metallic Ink'], delivery: 'received', po: 'PO-2026-0601', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1451', name: 'Ultimate Millions', denom: 20, size: '8x4', vendor: 'pb', units: 12000000, payout: 71.5, topPrize: 5000000, features: ['Holographic Foil', 'Sparkle/Glitter Coating'], delivery: 'received', po: 'PO-2026-0602', launch: '2026-05-01', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1452', name: 'Gold Rush Supreme', denom: 20, size: '8x4', vendor: 'igt', units: 12000000, payout: 70.5, topPrize: 2000000, features: ['Holographic Foil'], delivery: 'in_production', po: 'PO-2026-0603', launch: null, close: null, end: null, prodStatus: 'in_production' },
    { num: '1360', name: 'Cash Bonanza', denom: 20, size: '8x4', vendor: 'sg', units: 12000000, payout: 71.0, topPrize: 3000000, features: ['Holographic Foil'], delivery: 'received', po: 'PO-2025-0604', launch: '2025-04-15', close: '2026-02-01', end: '2026-05-01', prodStatus: 'ended' },
    // $30 games
    { num: '1460', name: '$10,000,000 Colossal Cash', denom: 30, size: '8x4', vendor: 'sg', units: 12000000, payout: 73.0, topPrize: 10000000, features: ['Holographic Foil', 'Metallic Ink', 'Oversized Format'], delivery: 'received', po: 'PO-2026-0701', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
    { num: '1461', name: 'Mega Multiplier', denom: 30, size: '8x4', vendor: 'pb', units: 12000000, payout: 73.5, topPrize: 10000000, features: ['Holographic Foil', 'Sparkle/Glitter Coating'], delivery: 'in_production', po: 'PO-2026-0702', launch: null, close: null, end: null, prodStatus: 'in_production' },
    // $50 games
    { num: '1470', name: '$25,000,000 Empire', denom: 50, size: '12x8', vendor: 'sg', units: 12000000, payout: 75.0, topPrize: 25000000, features: ['Holographic Foil', 'Metallic Ink', 'Oversized Format', 'Die-Cut Ticket'], delivery: 'received', po: 'PO-2026-0801', launch: '2026-04-15', close: null, end: null, prodStatus: 'on_sale' },
  ];

  let gameCount = 0;
  for (const g of games) {
    // Create a Product record for each game
    const product = await prisma.product.create({
      data: {
        jurisdictionId: ny.id,
        name: g.name,
        category: 'instant',
        type: 'scratch_off',
        price: g.denom,
        status: g.prodStatus,
        externalCode: g.num,
        externalSource: 'instant_ticket_planner',
      }
    });

    const game = await prisma.instantTicketGame.create({
      data: {
        scenarioId: baseScenario.id,
        vendorId: vendorMap[g.vendor].id,
        productId: product.id,
        gameNumber: g.num,
        name: g.name,
        denomination: g.denom,
        ticketSize: g.size,
        units: BigInt(g.units),
        payoutPercent: g.payout,
        topPrize: g.topPrize,
        launchDate: g.launch ? new Date(g.launch) : null,
        closeDate: g.close ? new Date(g.close) : null,
        endDate: g.end ? new Date(g.end) : null,
        poNumber: g.po,
        poDate: g.po ? new Date('2026-01-15') : null,
        receiptDate: g.delivery === 'received' ? new Date('2026-03-01') : null,
        deliveryStatus: g.delivery,
        sortOrder: gameCount,
      }
    });
    for (const f of g.features) {
      await prisma.instantTicketGameFeature.create({ data: { gameId: game.id, featureName: f } });
    }
    gameCount++;
  }
  console.log(`  ✓ ${gameCount} games + product records created`);

  // Marketing items
  const mktg = [
    { name: 'POS Counter Display Refresh', cost: 285000, cat: 'pos_display', vendor: 'sg' },
    { name: 'Holiday Scratcher Campaign (Digital)', cost: 425000, cat: 'digital_campaign', vendor: null },
    { name: 'Retailer Starter Kit Inserts', cost: 62000, cat: 'insert', vendor: 'pb' },
    { name: '$50 Game Premium Signage', cost: 175000, cat: 'signage', vendor: 'sg' },
    { name: 'Licensed Property Royalties (NFL)', cost: 350000, cat: 'licensing', vendor: null },
    { name: 'Second Chance Drawing Platform', cost: 180000, cat: 'digital_campaign', vendor: 'igt' },
  ];
  for (let i = 0; i < mktg.length; i++) {
    const m = mktg[i];
    await prisma.instantTicketMarketingItem.create({
      data: { scenarioId: baseScenario.id, vendorId: m.vendor ? vendorMap[m.vendor].id : null, name: m.name, cost: m.cost, category: m.cat, sortOrder: i }
    });
  }
  console.log(`  ✓ ${mktg.length} marketing items created`);
  console.log('\n✅ Instant Ticket Planner seed complete.\n');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
