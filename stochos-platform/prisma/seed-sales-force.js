// prisma/seed-sales-force.js
// Seeds 7 Regional Managers, 80 LMR Sales Reps, Districts, Routes, and assigns Retailers proportionally with backfilled visit dates.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/db');

const FIRST_NAMES = ['David', 'Sarah', 'Michael', 'Emily', 'James', 'Jessica', 'Robert', 'Ashley', 'William', 'Amanda', 'Brian', 'Megan', 'Kevin', 'Rachel', 'Daniel', 'Nicole', 'Christopher', 'Elizabeth', 'Matthew', 'Stephanie'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White'];

const CENTERS = [
  { name: 'Schenectady', short: 'SCH', managerEmail: 'manager.schenectady@gaming.ny.gov', managerName: 'Schenectady Regional Manager', repsCount: 9, dbValue: 'Schenectady' },
  { name: 'Buffalo', short: 'BUF', managerEmail: 'manager.buffalo@gaming.ny.gov', managerName: 'Buffalo Regional Manager', repsCount: 7, dbValue: 'Buffalo' },
  { name: 'Rochester', short: 'ROC', managerEmail: 'manager.rochester@gaming.ny.gov', managerName: 'Rochester Regional Manager', repsCount: 5, dbValue: 'Rochester' },
  { name: 'Syracuse', short: 'SYR', managerEmail: 'manager.syracuse@gaming.ny.gov', managerName: 'Syracuse Regional Manager', repsCount: 8, dbValue: 'Syracuse' },
  { name: 'Fishkill', short: 'FIS', managerEmail: 'manager.fishkill@gaming.ny.gov', managerName: 'Fishkill Regional Manager', repsCount: 10, dbValue: 'Fishkill' },
  { name: 'Manhattan', short: 'MAN', managerEmail: 'manager.manhattan@gaming.ny.gov', managerName: 'Manhattan Regional Manager', repsCount: 27, dbValue: 'Manhattan (NYC)' },
  { name: 'Garden City', short: 'GAR', managerEmail: 'manager.gardencity@gaming.ny.gov', managerName: 'Garden City Regional Manager', repsCount: 14, dbValue: 'Long Island (Garden City)' }
];

async function main() {
  console.log('🧹 Wiping existing routes and districts...');
  // Retailers refer to routes, so clear retailer route connections first
  await prisma.crmRetailer.updateMany({ data: { routeId: null } });
  await prisma.crmRoute.deleteMany({});
  await prisma.crmDistrict.deleteMany({});
  await prisma.crmRegion.deleteMany({});

  console.log('🔍 Locating NY jurisdiction and role configurations...');
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) throw new Error('NY jurisdiction not found.');

  // Ensure roles exist
  const salesRepRole = await prisma.role.upsert({
    where: { name: 'sales_rep' },
    update: {},
    create: { name: 'sales_rep', permissions: { analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } }
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'manager' },
    update: {},
    create: { name: 'manager', permissions: { analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } }
  });

  const passwordHash = await bcrypt.hash('stochos2026', 12);

  // 1. Create Regional Sales Region
  const region = await prisma.crmRegion.create({
    data: {
      jurisdictionId: ny.id,
      name: 'New York Lottery Sales Region',
      code: 'NY-REGION'
    }
  });

  let totalRepsCreated = 0;
  let totalRoutesCreated = 0;

  for (const center of CENTERS) {
    console.log(`\n🏢 Processing Customer Service Center: ${center.name}...`);

    // 2. Create District for this Service Center
    const district = await prisma.crmDistrict.create({
      data: {
        regionId: region.id,
        name: `${center.name} Sales District`,
        code: `DIS-${center.short}`
      }
    });

    // 3. Create/Ensure Regional Sales Manager (SLMR)
    const manager = await prisma.user.upsert({
      where: { email: center.managerEmail },
      update: { roleId: managerRole.id, division: 'OPERATIONS', bureau: 'Bureau of Lottery Operations', subunit: `${center.name} Claim Center` },
      create: {
        email: center.managerEmail,
        name: center.managerName,
        passwordHash,
        roleId: managerRole.id,
        jurisdictionId: ny.id,
        division: 'OPERATIONS',
        bureau: 'Bureau of Lottery Operations',
        subunit: `${center.name} Claim Center`,
        status: 'active'
      }
    });

    console.log(`  👤 Manager: ${manager.name} (${manager.email})`);

    // 4. Generate Sales Representatives (LMRs) reporting to this Manager
    const reps = [];
    const usedNames = new Set();
    
    for (let r = 1; r <= center.repsCount; r++) {
      let firstName, lastName, fullName;
      do {
        firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        fullName = `${firstName} ${lastName}`;
      } while (usedNames.has(fullName));
      usedNames.add(fullName);

      const email = `rep.${firstName.toLowerCase()}.${lastName.toLowerCase()}@gaming.ny.gov`;

      const rep = await prisma.user.upsert({
        where: { email },
        update: { managerId: manager.id, roleId: salesRepRole.id, division: 'OPERATIONS', bureau: 'Bureau of Lottery Operations', subunit: `${center.name} Field Sales` },
        create: {
          email,
          name: fullName,
          passwordHash,
          roleId: salesRepRole.id,
          jurisdictionId: ny.id,
          division: 'OPERATIONS',
          bureau: 'Bureau of Lottery Operations',
          subunit: `${center.name} Field Sales`,
          status: 'active',
          managerId: manager.id
        }
      });

      reps.push(rep);
      totalRepsCreated++;
    }

    console.log(`  👥 Seeded ${reps.length} Sales Representatives (LMRs).`);

    // 5. Create CrmRoutes for each Sales Rep
    const routes = [];
    for (let idx = 0; idx < reps.length; idx++) {
      const rep = reps[idx];
      const routeCode = `${center.short}-R${String(idx + 1).padStart(3, '0')}`;
      const routeName = `${center.name} Route ${String(idx + 1).padStart(2, '0')}`;

      const route = await prisma.crmRoute.create({
        data: {
          districtId: district.id,
          name: routeName,
          code: routeCode,
          repId: rep.id
        }
      });
      routes.push(route);
      totalRoutesCreated++;
    }

    console.log(`  🛣️  Created ${routes.length} CrmRoutes linked to representatives.`);

    // 6. Fetch all retailers mapped to this Service Center
    const retailers = await prisma.crmRetailer.findMany({
      where: { serviceCenter: center.dbValue }
    });

    console.log(`  🏪 Found ${retailers.length} retailers in this territory.`);

    if (retailers.length > 0 && routes.length > 0) {
      // Distribute retailers evenly among routes
      const retailersPerRoute = Math.ceil(retailers.length / routes.length);
      
      for (let rIdx = 0; rIdx < routes.length; rIdx++) {
        const route = routes[rIdx];
        const routeRetailers = retailers.slice(rIdx * retailersPerRoute, (rIdx + 1) * retailersPerRoute);
        const retailerIds = routeRetailers.map(ret => ret.id);

        if (retailerIds.length > 0) {
          // Assign routeId to these retailers
          await prisma.crmRetailer.updateMany({
            where: { id: { in: retailerIds } },
            data: { routeId: route.id }
          });

          // Backfill realistic random lastVisitDate (varying from 5 to 65 days ago, or null for 10% to simulate never visited)
          for (const ret of routeRetailers) {
            let lastVisitDate = null;
            if (Math.random() > 0.1) {
              const daysAgo = Math.floor(Math.random() * 60) + 5;
              const date = new Date();
              date.setDate(date.getDate() - daysAgo);
              lastVisitDate = date;
            }
            await prisma.crmRetailer.update({
              where: { id: ret.id },
              data: { lastVisitDate }
            });
          }
        }
      }
      console.log(`  ✅ Assigned all regional retailers to their optimized routes.`);
    }
  }

  console.log(`\n✨ Seeding Completed!`);
  console.log(`  - Total Sales Reps Created: ${totalRepsCreated}`);
  console.log(`  - Total Routes Generated: ${totalRoutesCreated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
