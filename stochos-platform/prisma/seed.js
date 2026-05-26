// =============================================================================
// Stochos Platform — Database Seed Script
// =============================================================================
// Seeds core dimensions, products, vendors, roles, admin user, and the 
// synthetic New York CRM sandbox.
// Run with: npx prisma db seed
// =============================================================================

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding Stochos Platform database...\n');

  // --- Clean existing CRM data to prevent seed conflicts ---
  console.log('🧹 Cleaning existing tables...');
  await prisma.crmActionItem.deleteMany().catch(() => {});
  await prisma.crmDiscrepancyException.deleteMany().catch(() => {});
  await prisma.crmAssetVerification.deleteMany().catch(() => {});
  await prisma.crmProcessImprovement.deleteMany().catch(() => {});
  await prisma.crmMerchandising.deleteMany().catch(() => {});
  await prisma.crmCoaching.deleteMany().catch(() => {});
  await prisma.crmVisit.deleteMany().catch(() => {});
  await prisma.crmAssetAssignment.deleteMany().catch(() => {});
  await prisma.crmAsset.deleteMany().catch(() => {});
  await prisma.crmEquipmentType.deleteMany().catch(() => {});
  await prisma.crmRetailer.deleteMany().catch(() => {});
  await prisma.crmChainAccount.deleteMany().catch(() => {});
  await prisma.crmRoute.deleteMany().catch(() => {});
  await prisma.crmDistrict.deleteMany().catch(() => {});
  await prisma.crmRegion.deleteMany().catch(() => {});
  await prisma.crmImportBatch.deleteMany().catch(() => {});

  // --- Roles ---
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'admin' },
      update: {},
      create: {
        name: 'admin',
        permissions: { contracts: 'write', analytics: 'write', marketing: 'write', scratchers: 'write', admin: 'write' }
      }
    }),
    prisma.role.upsert({
      where: { name: 'marketing_manager' },
      update: {},
      create: {
        name: 'marketing_manager',
        permissions: { contracts: 'write', analytics: 'read', marketing: 'write', scratchers: 'read' }
      }
    }),
    prisma.role.upsert({
      where: { name: 'procurement_officer' },
      update: {},
      create: {
        name: 'procurement_officer',
        permissions: { contracts: 'write', analytics: 'read', marketing: 'read', scratchers: 'write' }
      }
    }),
    prisma.role.upsert({
      where: { name: 'analyst' },
      update: {},
      create: {
        name: 'analyst',
        permissions: { contracts: 'read', analytics: 'read', marketing: 'read', scratchers: 'read' }
      }
    }),
  ]);
  console.log(`  ✓ ${roles.length} roles verified`);

  const adminRole = roles[0];

  // --- Users (Admin & Mock Manager/Staff) ---
  const hashedPassword = await bcrypt.hash('stochos2026', 12);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@stochos.io' },
    update: {},
    create: {
      email: 'admin@stochos.io',
      name: 'Platform Admin',
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      status: 'active',
    }
  });

  const supervisorUser = await prisma.user.upsert({
    where: { email: 'supervisor@stochos.io' },
    update: {},
    create: {
      email: 'supervisor@stochos.io',
      name: 'District Supervisor',
      passwordHash: hashedPassword,
      roleId: adminRole.id,
      status: 'active',
    }
  });

  // Self relation assignment: admin is supervised by supervisor
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { managerId: supervisorUser.id }
  });

  console.log(`  ✓ Users verified: admin@stochos.io (under supervisor@stochos.io)`);

  // --- Jurisdiction ---
  const ny = await prisma.jurisdiction.upsert({
    where: { abbreviation: 'NY' },
    update: {},
    create: {
      name: 'New York Lottery',
      abbreviation: 'NY',
      currency: 'USD',
      fiscalYearStartMonth: 4,
      timezone: 'America/New_York',
      status: 'active',
    }
  });
  console.log(`  ✓ Jurisdiction: ${ny.name} (${ny.abbreviation})`);

  // --- Products ---
  const productData = [
    { name: 'Mega Millions',    category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'mega' },
    { name: 'Powerball',        category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'powerball' },
    { name: 'Cash4Life',        category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'c4l' },
    { name: 'Lotto',            category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'lotto' },
    { name: 'Numbers',          category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 'numbers_day' },
    { name: 'Win 4',            category: 'draw_game', type: 'pick_4',       price: 1.00, externalCode: 'win4_day' },
    { name: 'Take 5',           category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 't5_day' },
    { name: 'Pick 10',          category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 'pick10' },
    { name: 'Quick Draw',       category: 'draw_game', type: 'monitor',      price: 1.00, externalCode: 'quick_draw' },
    { name: 'Holiday Scratchers',    category: 'instant', type: 'scratch_off', price: 5.00, externalCode: null },
    { name: 'Win For Life',          category: 'instant', type: 'scratch_off', price: 2.00, externalCode: null },
    { name: 'Set For Life',          category: 'instant', type: 'scratch_off', price: 10.00, externalCode: null },
  ];

  for (const p of productData) {
    const idKey = `seed-${p.externalCode || p.name.toLowerCase().replace(/\s+/g, '-')}`;
    await prisma.product.upsert({
      where: { id: idKey },
      update: {},
      create: {
        id: idKey,
        jurisdictionId: ny.id,
        name: p.name,
        category: p.category,
        type: p.type,
        price: p.price,
        externalCode: p.externalCode,
        externalSource: p.externalCode ? 'ny_game_dim' : null,
      }
    });
  }
  console.log(`  ✓ ${productData.length} products verified`);

  // --- Vendors ---
  const vendorsCount = await prisma.vendor.count();
  if (vendorsCount === 0) {
    const vendorData = [
      { name: 'McCann Worldgroup',      type: 'lead_agency' },
      { name: 'Havas Media',            type: 'media_buyer' },
      { name: 'Scientific Games',       type: 'printer' },
      { name: 'Pollard Banknote',       type: 'printer' },
      { name: 'International Game Tech', type: 'printer' },
      { name: 'Hiebing',                type: 'specialty' },
      { name: 'NRC Group',              type: 'research' },
    ];

    for (const v of vendorData) {
      await prisma.vendor.create({
        data: {
          jurisdictionId: ny.id,
          name: v.name,
          type: v.type,
          status: 'active',
        }
      });
    }
    console.log(`  ✓ ${vendorData.length} vendors seeded`);
  }

  // =============================================================================
  // CRM / SALES OVERLAY SANDBOX SEEDING
  // =============================================================================
  console.log('📈 Seeding CRM Overlay synthetic Sandbox (New York operations model)...');

  // 1. Regions
  const regions = await Promise.all([
    prisma.crmRegion.create({ data: { jurisdictionId: ny.id, name: 'Region 1 - Metro NY', code: 'REG-1' } }),
    prisma.crmRegion.create({ data: { jurisdictionId: ny.id, name: 'Region 2 - Albany & East', code: 'REG-2' } }),
    prisma.crmRegion.create({ data: { jurisdictionId: ny.id, name: 'Region 3 - Western NY', code: 'REG-3' } }),
  ]);
  console.log(`  ✓ ${regions.length} CRM Regions seeded`);

  // 2. Districts
  const districts = await Promise.all([
    prisma.crmDistrict.create({ data: { regionId: regions[0].id, name: 'District 11 - NYC Core', code: 'DIST-11' } }),
    prisma.crmDistrict.create({ data: { regionId: regions[0].id, name: 'District 12 - Long Island', code: 'DIST-12' } }),
    prisma.crmDistrict.create({ data: { regionId: regions[1].id, name: 'District 21 - Albany Capital', code: 'DIST-21' } }),
    prisma.crmDistrict.create({ data: { regionId: regions[1].id, name: 'District 22 - Hudson Valley', code: 'DIST-22' } }),
    prisma.crmDistrict.create({ data: { regionId: regions[2].id, name: 'District 31 - Buffalo Frontier', code: 'DIST-31' } }),
  ]);
  console.log(`  ✓ ${districts.length} CRM Districts seeded`);

  // 3. Routes (Assigned to adminUser as rep)
  const routes = await Promise.all([
    prisma.crmRoute.create({ data: { districtId: districts[0].id, name: 'Route 101 - Manhattan Counter', code: 'ROUTE-101', repId: adminUser.id } }),
    prisma.crmRoute.create({ data: { districtId: districts[0].id, name: 'Route 102 - Queens Bodegas', code: 'ROUTE-102', repId: adminUser.id } }),
    prisma.crmRoute.create({ data: { districtId: districts[1].id, name: 'Route 103 - LI South Shore', code: 'ROUTE-103', repId: adminUser.id } }),
    prisma.crmRoute.create({ data: { districtId: districts[2].id, name: 'Route 201 - Albany Downtown', code: 'ROUTE-201', repId: adminUser.id } }),
    prisma.crmRoute.create({ data: { districtId: districts[4].id, name: 'Route 301 - Buffalo Plaza Vending', code: 'ROUTE-301', repId: adminUser.id } }),
  ]);
  console.log(`  ✓ ${routes.length} CRM Routes seeded (assigned to Platform Admin)`);

  // 4. Chains
  const chains = await Promise.all([
    prisma.crmChainAccount.create({ data: { name: '7-Eleven', code: 'CHAIN-711', contactName: 'John Miller', contactPhone: '555-711-2026', contactEmail: 'lotto@7-eleven-ny.com' } }),
    prisma.crmChainAccount.create({ data: { name: 'Speedway', code: 'CHAIN-SPD', contactName: 'Sarah Speedway', contactPhone: '555-432-8812', contactEmail: 'retail@speedwaylotto.com' } }),
    prisma.crmChainAccount.create({ data: { name: 'QuickChek', code: 'CHAIN-QKC', contactName: 'Mike Quick', contactPhone: '555-987-1122', contactEmail: 'quickchek-lotto@quickchek.com' } }),
  ]);
  console.log(`  ✓ ${chains.length} Corporate Chains seeded`);

  // 5. Equipment Types (Taxonomy)
  const eqTypes = await Promise.all([
    // Terminals
    prisma.crmEquipmentType.create({ data: { code: 'FLEX-TERMINAL', name: 'Retailer Pro S2 (FLEX counter terminal)', category: 'terminal', manufacturer: 'Brightstar', model: 'Retailer Pro S2', isRegulated: true } }),
    prisma.crmEquipmentType.create({ data: { code: 'WAVE-TERMINAL', name: 'WAVE Clerk counter terminal', category: 'terminal', manufacturer: 'Scientific Games', model: 'WAVE X', isRegulated: true } }),
    prisma.crmEquipmentType.create({ data: { code: 'MOBILE-TO-GO', name: 'Retailer To Go S2 mobile terminal', category: 'terminal', manufacturer: 'Brightstar', model: 'To Go S2', isRegulated: true } }),
    // Vending
    prisma.crmEquipmentType.create({ data: { code: 'GEMINI-VENDING', name: 'Gemini Touch hybrid vending machine', category: 'vending_machine', manufacturer: 'IGT', model: 'Gemini Touch 28', isRegulated: true } }),
    prisma.crmEquipmentType.create({ data: { code: 'PLAYCENTRAL-VENDING', name: 'PlayCentral Express player self-service unit', category: 'vending_machine', manufacturer: 'Scientific Games', model: 'PlayCentral Express', isRegulated: true } }),
    // Peripherals
    prisma.crmEquipmentType.create({ data: { code: 'TICKET-CHECKER', name: 'Wireless player ticket checker', category: 'peripheral', manufacturer: 'Scientific Games', model: 'WTC-400', isRegulated: false } }),
    prisma.crmEquipmentType.create({ data: { code: 'PIN-PAD', name: 'Customer PIN Pad for Cashless', category: 'peripheral', manufacturer: 'Verifone', model: 'P400', isRegulated: false } }),
    prisma.crmEquipmentType.create({ data: { code: 'BILL-ACCEPTOR', name: 'Vending Bill Acceptor & Cashbox', category: 'peripheral', manufacturer: 'MEI', model: 'SC Advance', isRegulated: true } }),
    // Signage & Fixtures
    prisma.crmEquipmentType.create({ data: { code: 'JACKPOT-SIGN', name: 'Dynamic jackpot values sign', category: 'signage', manufacturer: 'Brightstar', model: 'SignaLink JP', isRegulated: false } }),
    prisma.crmEquipmentType.create({ data: { code: 'PLAY-CENTER', name: 'On-counter play center & slip stand', category: 'fixture', manufacturer: 'Pollard', model: 'Counter-Play-X', isRegulated: false } }),
    // Infrastructure
    prisma.crmEquipmentType.create({ data: { code: 'UPS-BATTERY', name: 'Uninterruptible Power Supply backup battery', category: 'infrastructure', manufacturer: 'APC', model: 'Smart-UPS 1500', isRegulated: false } }),
  ]);
  console.log(`  ✓ ${eqTypes.length} Equipment Catalog Types seeded`);

  // 6. Retailers
  const retailerSpecs = [
    { name: 'Broadway Convenience & Lotto', address: '1540 Broadway', city: 'New York', zipCode: '10036', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'weekly', routeCode: 'ROUTE-101', routeOrder: 1, chainCode: 'CHAIN-711', lat: 40.7578, lng: -73.9850 },
    { name: 'Empire State Newsstand', address: '350 5th Ave', city: 'New York', zipCode: '10118', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'weekly', routeCode: 'ROUTE-101', routeOrder: 2, chainCode: null, lat: 40.7484, lng: -73.9857 },
    { name: 'Penn Station Lottery Hub', address: 'Penn Station Concourse', city: 'New York', zipCode: '10001', status: 'active', appStatus: 'approved', trainStatus: 'not_trained', cadence: 'weekly', routeCode: 'ROUTE-101', routeOrder: 3, chainCode: null, lat: 40.7505, lng: -73.9934 },
    { name: 'Grand Central Multi-News', address: '89 E 42nd St', city: 'New York', zipCode: '10017', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'biweekly', routeCode: 'ROUTE-102', routeOrder: 1, chainCode: null, lat: 40.7527, lng: -73.9772 },
    { name: 'Queens Boulevard Deli', address: '74-09 Queens Blvd', city: 'Elmhurst', zipCode: '11373', status: 'active', appStatus: 'approved', trainStatus: 'not_trained', cadence: 'weekly', routeCode: 'ROUTE-102', routeOrder: 2, chainCode: 'CHAIN-SPD', lat: 40.7389, lng: -73.8821 },
    { name: 'Astoria QuickMart', address: '30-18 Astoria Blvd', city: 'Queens', zipCode: '11102', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'weekly', routeCode: 'ROUTE-102', routeOrder: 3, chainCode: 'CHAIN-711', lat: 40.7711, lng: -73.9212 },
    { name: 'Garden City Shell Stations', address: '825 Stewart Ave', city: 'Garden City', zipCode: '11530', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'biweekly', routeCode: 'ROUTE-103', routeOrder: 1, chainCode: 'CHAIN-SPD', lat: 40.7262, lng: -73.6120 },
    { name: 'Valley Stream Food Mart', address: '220 W Merrick Rd', city: 'Valley Stream', zipCode: '11580', status: 'active', appStatus: 'approved', trainStatus: 'not_trained', cadence: 'monthly', routeCode: 'ROUTE-103', routeOrder: 2, chainCode: 'CHAIN-QKC', lat: 40.6650, lng: -73.7112 },
    { name: 'Capitol Hill Stationery', address: '120 State St', city: 'Albany', zipCode: '12207', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'weekly', routeCode: 'ROUTE-201', routeOrder: 1, chainCode: null, lat: 42.6517, lng: -73.7547 },
    { name: 'Empire Plaza Lottery Express', address: 'Concourse Level 4', city: 'Albany', zipCode: '12242', status: 'warning', appStatus: 'approved', trainStatus: 'not_trained', cadence: 'weekly', routeCode: 'ROUTE-201', routeOrder: 2, chainCode: null, lat: 42.6502, lng: -73.7601 },
    { name: 'Buffalo Central News & Lotto', address: '180 Main St', city: 'Buffalo', zipCode: '14202', status: 'active', appStatus: 'approved', trainStatus: 'trained', cadence: 'weekly', routeCode: 'ROUTE-301', routeOrder: 1, chainCode: 'CHAIN-711', lat: 42.8804, lng: -78.8752 },
    { name: 'Frontier Gas & Go', address: '2200 Delaware Ave', city: 'Buffalo', zipCode: '14216', status: 'active', appStatus: 'approved', trainStatus: 'not_trained', cadence: 'biweekly', routeCode: 'ROUTE-301', routeOrder: 2, chainCode: 'CHAIN-SPD', lat: 42.9412, lng: -78.8711 },
  ];

  const seededRetailers = [];
  for (const r of retailerSpecs) {
    const routeObj = routes.find(rt => rt.code === r.routeCode);
    const chainObj = r.chainCode ? chains.find(ch => ch.code === r.chainCode) : null;
    const store = await prisma.crmRetailer.create({
      data: {
        externalId: `RET-${r.zipCode}-${r.routeOrder}`,
        name: r.name,
        address: r.address,
        city: r.city,
        zipCode: r.zipCode,
        phone: '555-019-2026',
        status: r.status,
        applicationStatus: r.appStatus,
        trainingStatus: r.trainStatus,
        visitCadence: r.cadence,
        routeId: routeObj ? routeObj.id : null,
        routeOrder: r.routeOrder,
        chainId: chainObj ? chainObj.id : null,
        latitude: r.lat,
        longitude: r.lng,
      }
    });
    seededRetailers.push(store);
  }
  console.log(`  ✓ ${seededRetailers.length} CRM Retailers seeded`);

  // 7. Assets (Hardware inventory)
  const assetsData = [
    { serial: 'SN-FLEX-1001', tag: 'TAG-NY-00101', typeCode: 'FLEX-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-FLEX-1002', tag: 'TAG-NY-00102', typeCode: 'FLEX-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-FLEX-1003', tag: 'TAG-NY-00103', typeCode: 'FLEX-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-FLEX-1004', tag: 'TAG-NY-00104', typeCode: 'FLEX-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-WAVE-2001', tag: 'TAG-NY-00201', typeCode: 'WAVE-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-WAVE-2002', tag: 'TAG-NY-00202', typeCode: 'WAVE-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-WAVE-2003', tag: 'TAG-NY-00203', typeCode: 'WAVE-TERMINAL', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-MBL-3001',  tag: 'TAG-NY-00301', typeCode: 'MOBILE-TO-GO', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-GEM-4001',  tag: 'TAG-NY-00401', typeCode: 'GEMINI-VENDING', status: 'active', owner: 'leased' },
    { serial: 'SN-GEM-4002',  tag: 'TAG-NY-00402', typeCode: 'GEMINI-VENDING', status: 'active', owner: 'leased' },
    { serial: 'SN-PEX-5001',  tag: 'TAG-NY-00501', typeCode: 'PLAYCENTRAL-VENDING', status: 'active', owner: 'vendor_owned' },
    { serial: 'SN-PEX-5002',  tag: 'TAG-NY-00502', typeCode: 'PLAYCENTRAL-VENDING', status: 'active', owner: 'vendor_owned' },
    { serial: 'SN-TCK-6001',  tag: 'TAG-NY-00601', typeCode: 'TICKET-CHECKER', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-TCK-6002',  tag: 'TAG-NY-00602', typeCode: 'TICKET-CHECKER', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-TCK-6003',  tag: 'TAG-NY-00603', typeCode: 'TICKET-CHECKER', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-PIN-7001',  tag: 'TAG-NY-00701', typeCode: 'PIN-PAD', status: 'active', owner: 'retailer_owned' },
    { serial: 'SN-PIN-7002',  tag: 'TAG-NY-00702', typeCode: 'PIN-PAD', status: 'active', owner: 'retailer_owned' },
    { serial: 'SN-BLL-8001',  tag: 'TAG-NY-00801', typeCode: 'BILL-ACCEPTOR', status: 'active', owner: 'vendor_owned' },
    { serial: 'SN-BLL-8002',  tag: 'TAG-NY-00802', typeCode: 'BILL-ACCEPTOR', status: 'active', owner: 'vendor_owned' },
    { serial: 'SN-UPS-9001',  tag: 'TAG-NY-00901', typeCode: 'UPS-BATTERY', status: 'active', owner: 'lottery_owned' },
    { serial: 'SN-UPS-9002',  tag: 'TAG-NY-00902', typeCode: 'UPS-BATTERY', status: 'active', owner: 'lottery_owned' },
    // Static / Collateral Mock assets (no serial)
    { serial: null,            tag: 'TAG-NY-POS-01', typeCode: 'JACKPOT-SIGN', status: 'active', owner: 'lottery_owned' },
    { serial: null,            tag: 'TAG-NY-POS-02', typeCode: 'JACKPOT-SIGN', status: 'active', owner: 'lottery_owned' },
    { serial: null,            tag: 'TAG-NY-POS-03', typeCode: 'JACKPOT-SIGN', status: 'active', owner: 'lottery_owned' },
    { serial: null,            tag: 'TAG-NY-POS-04', typeCode: 'PLAY-CENTER', status: 'active', owner: 'lottery_owned' },
    { serial: null,            tag: 'TAG-NY-POS-05', typeCode: 'PLAY-CENTER', status: 'active', owner: 'lottery_owned' },
  ];

  const seededAssets = [];
  for (const a of assetsData) {
    const typeObj = eqTypes.find(t => t.code === a.typeCode);
    const asset = await prisma.crmAsset.create({
      data: {
        serialNumber: a.serial,
        assetTag: a.tag,
        typeId: typeObj.id,
        status: a.status,
        ownerType: a.owner,
        networkRequired: a.typeCode === 'FLEX-TERMINAL' || a.typeCode === 'WAVE-TERMINAL' || a.typeCode === 'GEMINI-VENDING' || a.typeCode === 'PLAYCENTRAL-VENDING',
        powerRequired: a.typeCode !== 'PLAY-CENTER',
        supportsCashless: a.typeCode === 'PIN-PAD' || a.typeCode === 'FLEX-TERMINAL' || a.typeCode === 'WAVE-TERMINAL',
        supportsTicketCheck: a.typeCode === 'TICKET-CHECKER' || a.typeCode === 'GEMINI-VENDING' || a.typeCode === 'PLAYCENTRAL-VENDING',
        supportsDrawGames: a.typeCode === 'FLEX-TERMINAL' || a.typeCode === 'WAVE-TERMINAL' || a.typeCode === 'GEMINI-VENDING' || a.typeCode === 'PLAYCENTRAL-VENDING',
        supportsInstantGames: a.typeCode === 'GEMINI-VENDING' || a.typeCode === 'PLAYCENTRAL-VENDING' || a.typeCode === 'PLAY-CENTER',
      }
    });
    seededAssets.push(asset);
  }
  console.log(`  ✓ ${seededAssets.length} physical CRM Assets seeded`);

  // 8. Assignments (Allocate expected equipment to retail locations)
  const assignmentsData = [
    // Broadway News gets Flex Terminal, Pin Pad, Ticket Checker, Play Center, Jackpot Sign
    { retailerIndex: 0, assetIndex: 0, zone: 'service_counter', system: 'brightstar' },
    { retailerIndex: 0, assetIndex: 15, zone: 'service_counter', system: 'brightstar' },
    { retailerIndex: 0, assetIndex: 12, zone: 'queue_line', system: 'brightstar' },
    { retailerIndex: 0, assetIndex: 21, zone: 'front_end', system: 'brightstar' },
    { retailerIndex: 0, assetIndex: 24, zone: 'customer_service', system: 'brightstar' },
    
    // Empire State Newsstand gets Wave Terminal, Pin Pad, Play Center
    { retailerIndex: 1, assetIndex: 4, zone: 'service_counter', system: 'scientific_games' },
    { retailerIndex: 1, assetIndex: 16, zone: 'service_counter', system: 'scientific_games' },
    { retailerIndex: 1, assetIndex: 25, zone: 'front_end', system: 'scientific_games' },

    // Penn Station Lottery Hub gets Gemini Vending machine, Bill Acceptor, UPS Battery
    { retailerIndex: 2, assetIndex: 8, zone: 'entry_lobby', system: 'brightstar' },
    { retailerIndex: 2, assetIndex: 17, zone: 'entry_lobby', system: 'brightstar' },
    { retailerIndex: 2, assetIndex: 19, zone: 'back_office', system: 'brightstar' },

    // Grand Central Multi-News gets PlayCentral, Bill Acceptor, UPS Battery, Ticket Checker
    { retailerIndex: 3, assetIndex: 10, zone: 'travel_plaza_concourse', system: 'scientific_games' },
    { retailerIndex: 3, assetIndex: 18, zone: 'travel_plaza_concourse', system: 'scientific_games' },
    { retailerIndex: 3, assetIndex: 20, zone: 'back_office', system: 'scientific_games' },
    { retailerIndex: 3, assetIndex: 13, zone: 'queue_line', system: 'scientific_games' },

    // Capitol Hill Stationery gets Flex Terminal, Jackpot Sign
    { retailerIndex: 8, assetIndex: 1, zone: 'service_counter', system: 'manual_upload' },
    { retailerIndex: 8, assetIndex: 22, zone: 'front_end', system: 'manual_upload' },

    // Empire Plaza gets Gemini Vending
    { retailerIndex: 9, assetIndex: 9, zone: 'entry_lobby', system: 'manual_upload' },
  ];

  const seededAssignments = [];
  for (const asg of assignmentsData) {
    const store = seededRetailers[asg.retailerIndex];
    const asset = seededAssets[asg.assetIndex];
    const assignment = await prisma.crmAssetAssignment.create({
      data: {
        retailerId: store.id,
        assetId: asset.id,
        placementZone: asg.zone,
        installDate: new Date('2025-05-15'),
        sourceSystem: asg.system,
        sourceAssetKey: `${asg.system.toUpperCase()}-ASG-${asset.serialNumber || asset.id.slice(0,8)}`,
        integrationMode: asg.system === 'manual_upload' ? 'manual_upload' : 'api_read_only',
        lastVerifiedAt: new Date('2026-04-20'),
      }
    });
    seededAssignments.push(assignment);
  }
  console.log(`  ✓ ${seededAssignments.length} CRM Asset Assignments established`);

  // 9. Visits (Mock completed rep activities)
  const visitSpecs = [
    // Completed Visit to Broadway news: coaching positive, merchandising ok, equipment verify all ok
    {
      retailerIndex: 0,
      daysAgo: 5,
      coaching: { ask: true, trainedCount: 3, feedback: 'Trained 3 evening clerks on "Ask for the Sale". Very responsive.', action: 'Continue tracking weekend sales bump.' },
      merch: { clean: true, signage: true, stock: true, feedback: 'Dispensers filled. Play Center clean and stocked with play slips.' },
      process: { trend: true, oos: true, layout: true, growth: 5.5, feedback: 'Sales reviewed. Planogram layout matches standard. Out of stock avoided.' },
      verifications: [
        { asgIndex: 0, status: 'present', disputed: false },
        { asgIndex: 1, status: 'present', disputed: false },
        { asgIndex: 2, status: 'present', disputed: false },
        { asgIndex: 3, status: 'present', disputed: false },
        { asgIndex: 4, status: 'present', disputed: false },
      ]
    },
    // Completed Visit to Penn Station Lottery Hub: coaching positive, merchandising partial, bill acceptor missing verification!
    {
      retailerIndex: 2,
      daysAgo: 10,
      coaching: { ask: false, trainedCount: 0, feedback: 'Clerks busy. Did not train.', action: 'Perform Ask for Sale training next week.' },
      merch: { clean: true, signage: false, stock: true, feedback: 'Jackpot display monitor unplugged. Re-plugged it.' },
      process: { trend: true, oos: false, layout: true, growth: 2.0, feedback: 'Reviewed sales. Standard layouts okay.' },
      verifications: [
        { asgIndex: 8, status: 'present', disputed: false }, // Gemini vending
        { asgIndex: 9, status: 'missing', disputed: true, notes: 'Vending Bill Acceptor is missing from Gemini unit. Retailer says technician removed it.' },
        { asgIndex: 10, status: 'present', disputed: false }
      ]
    },
    // Completed Visit to Grand Central: Merch compliance issues
    {
      retailerIndex: 3,
      daysAgo: 15,
      coaching: { ask: true, trainedCount: 2, feedback: 'Completed quick review.' },
      merch: { clean: false, signage: true, stock: false, feedback: 'Play center dusty. Scratch inventory low.' },
      process: { trend: false, oos: false, layout: false, growth: 0.0, feedback: 'Needs planogram audit.' },
      verifications: [
        { asgIndex: 11, status: 'present', disputed: false },
        { asgIndex: 12, status: 'present', disputed: false },
        { asgIndex: 13, status: 'present', disputed: false },
        { asgIndex: 14, status: 'present', disputed: false },
      ]
    }
  ];

  for (const v of visitSpecs) {
    const store = seededRetailers[v.retailerIndex];
    const visitDate = new Date();
    visitDate.setDate(visitDate.getDate() - v.daysAgo);

    const visit = await prisma.crmVisit.create({
      data: {
        retailerId: store.id,
        userId: adminUser.id,
        visitDate: visitDate,
        status: 'completed',
        checkInTime: new Date(visitDate.getTime()),
        checkOutTime: new Date(visitDate.getTime() + 20 * 60000), // 20 min visit
        syncStatus: 'synced',
        notes: `Standard field audit completed at ${store.name}.`,
      }
    });

    if (v.coaching) {
      await prisma.crmCoaching.create({
        data: {
          visitId: visit.id,
          askForTheSaleTrained: v.coaching.ask,
          personnelTrainedCount: v.coaching.trainedCount,
          coachingFeedback: v.coaching.feedback,
          actionPlan: v.coaching.action,
        }
      });
      if (v.coaching.ask) {
        await prisma.crmRetailer.update({
          where: { id: store.id },
          data: { trainingStatus: 'trained', lastVisitDate: visitDate }
        });
      }
    }

    if (v.merch) {
      await prisma.crmMerchandising.create({
        data: {
          visitId: visit.id,
          dispensersCleanAndFilled: v.merch.clean,
          posSignageVisible: v.merch.signage,
          ticketInventoryAdequate: v.merch.stock,
          merchandisingFeedback: v.merch.feedback,
        }
      });
    }

    if (v.process) {
      await prisma.crmProcessImprovement.create({
        data: {
          visitId: visit.id,
          salesTrendReviewed: v.process.trend,
          outOfStockPrevented: v.process.oos,
          optimalLayoutApplied: v.process.layout,
          targetSalesGrowth: v.process.growth,
          improvementFeedback: v.process.feedback,
        }
      });
    }

    for (const ver of v.verifications) {
      const assignment = seededAssignments[ver.asgIndex];
      await prisma.crmAssetVerification.create({
        data: {
          visitId: visit.id,
          assetAssignmentId: assignment.id,
          observedStatus: ver.status,
          isDisputed: ver.disputed,
          notes: ver.notes,
        }
      });

      // Update the assignment verification timestamp
      await prisma.crmAssetAssignment.update({
        where: { id: assignment.id },
        data: { lastVerifiedAt: visitDate }
      });

      // Generate Discrepancy Exception if missing
      if (ver.status === 'missing') {
        const assetObj = seededAssets[assignmentsData[ver.asgIndex].assetIndex];
        const exception = await prisma.crmDiscrepancyException.create({
          data: {
            retailerId: store.id,
            visitId: visit.id,
            assetAssignmentId: assignment.id,
            title: `Missing Peripheral: Bill Acceptor (S/N: ${assetObj.serialNumber || 'N/A'})`,
            description: ver.notes || 'Asset marked missing during routine store audit.',
            status: 'open',
          }
        });

        // Trigger warning status on retailer
        await prisma.crmRetailer.update({
          where: { id: store.id },
          data: { status: 'warning' }
        });
      }
    }
  }

  // 10. General seed tasks / Action Items
  await prisma.crmActionItem.create({
    data: {
      retailerId: seededRetailers[0].id,
      title: 'Replenish Holiday Scratchers Brochures',
      description: 'Leave 2 packs of Holiday Scratchers brochures and update responsible gaming sticker on play center.',
      dueDate: new Date(Date.now() + 5 * 86400000), // 5 days from now
      status: 'open',
    }
  });

  await prisma.crmActionItem.create({
    data: {
      retailerId: seededRetailers[2].id,
      title: 'Escalate missing bill acceptor to Brightstar technician',
      description: 'Technician ticket required to confirm returned/swapped SC Advance bill acceptor at Penn Station.',
      dueDate: new Date(Date.now() + 3 * 86400000), // 3 days from now
      status: 'open',
    }
  });

  console.log('  ✓ CRM visits, verifications, action items, and audit alerts seeded');

  // 11. Import all active retailers from DuckDB
  console.log('📥 Importing all active retailers from New York DuckDB...');
  try {
    const child_process = require('child_process');
    const path = require('path');
    const localScriptPath = path.join(__dirname, 'import_active_retailers.py');
    const wslScriptPath = localScriptPath
      .replace(/\\/g, '/')
      .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`);
      
    console.log(`Executing: wsl -d Ubuntu-22.04 python3 "${wslScriptPath}"`);
    const result = child_process.spawnSync('wsl', ['-d', 'Ubuntu-22.04', 'python3', wslScriptPath], { encoding: 'utf8' });
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    if (result.status !== 0) {
      throw new Error(`Import script exited with code ${result.status}`);
    }
  } catch (error) {
    console.error('⚠️ Warning: Failed to run active retailer DuckDB import script:', error.message);
  }

  console.log('\n✅ Database seed completed successfully!\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
