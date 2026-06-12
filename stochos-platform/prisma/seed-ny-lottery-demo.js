// prisma/seed-ny-lottery-demo.js
// Seeds scaled, realistic IT & physical assets (~1,000 items) and fleet vehicles (~40 items) for NY Lottery demo.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Client } = require('pg');

let prisma;
if (process.env.DATABASE_URL) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

// Helper to generate unique serial numbers, VINs, and plates
function genSerial(prefix, index) {
  return `${prefix}${String(index).padStart(6, '0')}`;
}

function genVin(make, index) {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let rand = '';
  for (let i = 0; i < 10; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `1NY${make.slice(0, 2).toUpperCase()}${rand}${String(index).padStart(2, '0')}`;
}

function genPlate(index) {
  return `NY${String(index).padStart(5, '0')}`;
}

async function main() {
  console.log('🧹 Wiping existing IT assets and fleet vehicles...');
  await prisma.asset.deleteMany({});
  await prisma.vehicle.deleteMany({});

  console.log('🔍 Fetching NY Jurisdiction and division users...');
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) {
    throw new Error('NY jurisdiction not found. Run base seed first.');
  }

  const users = await prisma.user.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, email: true, division: true }
  });

  if (users.length === 0) {
    throw new Error('No active users found to assign assets. Run seed-divisions-users.js first.');
  }

  // Map users by division for intelligent assignments
  const userMap = {
    EXECUTIVE: [],
    FINANCE: [],
    MARKETING: [],
    OPERATIONS: [],
    IT: [],
    PROCUREMENT: []
  };
  users.forEach(u => {
    if (userMap[u.division]) {
      userMap[u.division].push(u);
    }
  });

  // Fallback lists if some divisions are empty
  const allUsers = users;
  const getRandomUser = (div) => {
    const list = userMap[div] && userMap[div].length > 0 ? userMap[div] : allUsers;
    return list[Math.floor(Math.random() * list.length)];
  };

  console.log('📦 Seeding scaled IT and physical assets (~1,000 items)...');

  const assets = [];
  let assetCounter = 1;

  // Define EOL and life groups:
  // 1. Overdue/Expired (Purchased Q1 2023, useful life 36 mos - expired Jan 2026)
  // 2. Critical/Nearing EOL (Purchased Q3 2024, useful life 24 mos - expires July 2026)
  // 3. Mid-lifecycle (Purchased Q2 2025, useful life 36 mos)
  // 4. New Equipment (Purchased late 2025 / early 2026, useful life 36 mos)

  const batches = [
    { name: '2023 Q1 Core Laptop Refresh', category: 'computer', count: 320, model: 'Dell Latitude 5440', value: 1250, life: 36, date: '2023-01-15' },
    { name: '2024 Q3 Field Ops Phone Buy', category: 'mobile', count: 180, model: 'Apple iPhone 14', value: 750, life: 24, date: '2024-07-20' },
    { name: '2025 Q2 Design Studio Upgrade', category: 'computer', count: 50, model: 'MacBook Pro 16-inch M3 Max', value: 3499, life: 36, date: '2025-04-10' },
    { name: '2025 Q3 General IT Monitors Buy', category: 'peripheral', count: 250, model: 'Dell 27-inch Professional Monitor', value: 249, life: 60, date: '2025-08-05' },
    { name: '2024 Q2 Regional Center Scanners', category: 'scanner', count: 120, model: 'Zebra TC21 Barcode Scanner', value: 480, life: 36, date: '2024-05-18' },
    { name: '2026 Q1 Claim Center Desktops', category: 'computer', count: 80, model: 'Lenovo ThinkCentre Neo 50t', value: 899, life: 48, date: '2026-02-12' },
  ];

  for (const b of batches) {
    const purchaseDate = new Date(b.date);
    for (let i = 1; i <= b.count; i++) {
      const tagIndex = assetCounter++;
      // Assign to user based on batch purpose
      let assignee = null;
      let status = 'available';

      if (Math.random() < 0.85) {
        // 85% of assets are assigned
        status = 'assigned';
        if (b.category === 'mobile' || b.category === 'computer') {
          // Phones and laptops assigned to relevant divisions
          if (b.name.includes('Field Ops')) {
            assignee = getRandomUser('OPERATIONS');
          } else if (b.name.includes('Design')) {
            assignee = getRandomUser('MARKETING');
          } else {
            // General distribution
            const divs = ['FINANCE', 'OPERATIONS', 'IT', 'PROCUREMENT', 'EXECUTIVE', 'MARKETING'];
            assignee = getRandomUser(divs[Math.floor(Math.random() * divs.length)]);
          }
        } else {
          // Peripherals and scanners
          assignee = getRandomUser('OPERATIONS');
        }
      } else if (Math.random() < 0.3) {
        status = 'repair';
      }

      assets.push({
        jurisdictionId: ny.id,
        assetTag: `AST-NY-26-${String(tagIndex).padStart(4, '0')}`,
        name: b.model,
        category: b.category,
        serialNumber: genSerial(b.category.slice(0, 3).toUpperCase(), tagIndex),
        status,
        value: b.value,
        assignedToId: assignee ? assignee.id : null,
        purchaseDate,
        usefulLifeMonths: b.life,
        notes: `Seeded via New York Lottery Demo Scaler - Batch: ${b.name}`,
      });
    }
  }

  // Batch create to speed up insertion
  console.log(`  💾 Saving ${assets.length} assets to PostgreSQL...`);
  const chunkSize = 200;
  for (let i = 0; i < assets.length; i += chunkSize) {
    const chunk = assets.slice(i, i + chunkSize);
    await prisma.asset.createMany({ data: chunk });
  }

  console.log('🚚 Seeding NY Lottery Fleet Vehicles (~40 items)...');
  const vehicles = [];
  let vehicleCounter = 1;

  const vehicleSpecs = [
    { type: 'Van', count: 25, make: 'Ford', model: 'Transit 250 Cargo Van', year: 2022, value: 43500, lifeMiles: 150000, lifeMonths: 96, baseMiles: 38000 },
    { type: 'Van', count: 5, make: 'Chevrolet', model: 'Express 2500 Van', year: 2021, value: 41000, lifeMiles: 160000, lifeMonths: 96, baseMiles: 54000 },
    { type: 'Truck', count: 4, make: 'Freightliner', model: 'M2 106 Box Truck', year: 2020, value: 125000, lifeMiles: 250000, lifeMonths: 120, baseMiles: 112000 },
    { type: 'Car', count: 4, make: 'Chevrolet', model: 'Bolt EV', year: 2023, value: 31500, lifeMiles: 120000, lifeMonths: 84, baseMiles: 12000 },
    { type: 'Car', count: 2, make: 'Ford', model: 'Explorer AWD Utility', year: 2023, value: 44000, lifeMiles: 130000, lifeMonths: 96, baseMiles: 22000 },
  ];

  for (const s of vehicleSpecs) {
    for (let i = 1; i <= s.count; i++) {
      const idx = vehicleCounter++;
      let assignee = null;
      let status = 'active';

      if (s.type === 'Van') {
        // Assigned to operations/field reps
        assignee = getRandomUser('OPERATIONS');
      } else if (s.type === 'Car' && s.model === 'Explorer') {
        assignee = getRandomUser('EXECUTIVE');
      }

      if (Math.random() < 0.08) {
        status = 'maintenance';
      }

      const purchaseYear = s.year;
      // Estimate purchase date based on model year
      const purchaseDate = new Date(`${purchaseYear}-06-15`);
      const ageMonths = Math.max(1, Math.floor((new Date() - purchaseDate) / (1000 * 60 * 60 * 24 * 30.4375)));
      // Estimate mileage based on age
      const mileage = Math.floor(s.baseMiles + (ageMonths * (800 + Math.random() * 400)));

      vehicles.push({
        jurisdictionId: ny.id,
        make: s.make,
        model: s.model,
        year: s.year,
        vin: genVin(s.make, idx),
        licensePlate: genPlate(idx),
        status,
        mileage,
        lastService: new Date(new Date() - (Math.random() * 60 * 24 * 60 * 60 * 1000)), // serviced in last 60 days
        assignedToId: assignee ? assignee.id : null,
        value: s.value,
        usefulLifeMiles: s.lifeMiles,
        usefulLifeMonths: s.lifeMonths,
        notes: `Operational vehicle seeded for NYSGC Lottery Logistics - Category: ${s.type}`,
      });
    }
  }

  console.log(`  💾 Saving ${vehicles.length} vehicles to PostgreSQL...`);
  await prisma.vehicle.createMany({ data: vehicles });

  console.log('✨ Seed and scale operations successfully completed!');
}

main()
  .catch(e => {
    console.error('Scaled seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
