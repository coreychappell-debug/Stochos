// prisma/seed-territory-test.js
// Seeds two test sales representatives with identical home coordinates,
// assigns them to different test routes, and leaves some retailers unassigned for testing.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/db');

async function main() {
  console.log('🧹 Preparing database for territory balancing and commute exclusion test...');

  // 1. Find NY jurisdiction and roles
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) throw new Error('NY jurisdiction not found.');

  const salesRepRole = await prisma.role.findUnique({ where: { name: 'sales_rep' } });
  if (!salesRepRole) throw new Error('sales_rep role not found. Run main seeder first.');

  // Find Schenectady manager to set as manager
  const manager = await prisma.user.findUnique({
    where: { email: 'manager.schenectady@gaming.ny.gov' }
  });
  const managerId = manager ? manager.id : null;

  // Find a Schenectady district
  const district = await prisma.crmDistrict.findUnique({
    where: { code: 'DIS-SCH' }
  });
  if (!district) throw new Error('Schenectady district (DIS-SCH) not found.');

  const passwordHash = await bcrypt.hash('stochos2026', 12);

  // 2. Create Rep Shared A and Rep Shared B with identical home coords
  const homeAddress = '100 State St, Schenectady, NY 12305';
  const homeLatitude = 42.8123;
  const homeLongitude = -73.9421;

  console.log('👤 Creating/updating test representatives with shared home address...');
  
  const repA = await prisma.user.upsert({
    where: { email: 'rep.shared.a@gaming.ny.gov' },
    update: {
      homeAddress,
      homeLatitude,
      homeLongitude,
      managerId,
      subunit: 'Schenectady Field Sales'
    },
    create: {
      email: 'rep.shared.a@gaming.ny.gov',
      name: 'Rep Shared A',
      passwordHash,
      roleId: salesRepRole.id,
      jurisdictionId: ny.id,
      division: 'OPERATIONS',
      bureau: 'Bureau of Lottery Operations',
      subunit: 'Schenectady Field Sales',
      status: 'active',
      managerId,
      homeAddress,
      homeLatitude,
      homeLongitude
    }
  });

  const repB = await prisma.user.upsert({
    where: { email: 'rep.shared.b@gaming.ny.gov' },
    update: {
      homeAddress,
      homeLatitude,
      homeLongitude,
      managerId,
      subunit: 'Schenectady Field Sales'
    },
    create: {
      email: 'rep.shared.b@gaming.ny.gov',
      name: 'Rep Shared B',
      passwordHash,
      roleId: salesRepRole.id,
      jurisdictionId: ny.id,
      division: 'OPERATIONS',
      bureau: 'Bureau of Lottery Operations',
      subunit: 'Schenectady Field Sales',
      status: 'active',
      managerId,
      homeAddress,
      homeLatitude,
      homeLongitude
    }
  });

  console.log(`  - Rep Shared A: ${repA.id} (${homeAddress})`);
  console.log(`  - Rep Shared B: ${repB.id} (${homeAddress})`);

  // 3. Create or clean up test routes for these reps
  console.log('🛣️ Creating test routes...');
  
  // Clean up if they exist
  await prisma.crmRetailer.updateMany({
    where: { route: { code: { in: ['SCH-TEST-A', 'SCH-TEST-B'] } } },
    data: { routeId: null }
  });
  await prisma.crmRoute.deleteMany({
    where: { code: { in: ['SCH-TEST-A', 'SCH-TEST-B'] } }
  });

  const routeA = await prisma.crmRoute.create({
    data: {
      districtId: district.id,
      name: 'Schenectady Test Route A',
      code: 'SCH-TEST-A',
      repId: repA.id
    }
  });

  const routeB = await prisma.crmRoute.create({
    data: {
      districtId: district.id,
      name: 'Schenectady Test Route B',
      code: 'SCH-TEST-B',
      repId: repB.id
    }
  });

  console.log(`  - Route A: ${routeA.name} (${routeA.code})`);
  console.log(`  - Route B: ${routeB.name} (${routeB.code})`);

  // 4. Assign retailers to these test routes
  console.log('🏪 Assigning retailers to test routes...');
  const schenectadyRetailers = await prisma.crmRetailer.findMany({
    where: { serviceCenter: 'Schenectady', latitude: { not: null }, longitude: { not: null } },
    take: 30
  });

  if (schenectadyRetailers.length < 25) {
    throw new Error('Not enough Schenectady retailers found. Run main seeder first.');
  }

  // Assign first 10 to Route A, second 10 to Route B
  const retailersA = schenectadyRetailers.slice(0, 12);
  const retailersB = schenectadyRetailers.slice(12, 24);

  await prisma.crmRetailer.updateMany({
    where: { id: { in: retailersA.map(r => r.id) } },
    data: { routeId: routeA.id }
  });

  await prisma.crmRetailer.updateMany({
    where: { id: { in: retailersB.map(r => r.id) } },
    data: { routeId: routeB.id }
  });

  console.log(`  - Assigned ${retailersA.length} retailers to Schenectady Route A`);
  console.log(`  - Assigned ${retailersB.length} retailers to Schenectady Route B`);

  // 5. Leave 3 retailers unassigned for Registry testing
  console.log('⚠️ Setting 3 retailers as unassigned (routeId = null)...');
  const unassignedRetailers = schenectadyRetailers.slice(24, 27);
  
  await prisma.crmRetailer.updateMany({
    where: { id: { in: unassignedRetailers.map(r => r.id) } },
    data: { routeId: null }
  });

  console.log('Unassigned stores for testing:');
  unassignedRetailers.forEach(r => {
    console.log(`  - [${r.externalId}] ${r.name} (${r.latitude}, ${r.longitude})`);
  });

  console.log('\n🎉 Test territory seeding completed successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
