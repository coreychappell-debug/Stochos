// =============================================================================
// Stochos Platform — Database Seed Script
// =============================================================================
// Creates initial jurisdiction, products, vendors, roles, and admin user.
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
  console.log(`  ✓ ${roles.length} roles created`);

  const adminRole = roles[0];

  // --- Admin User ---
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
  console.log(`  ✓ Admin user created (admin@stochos.io)`);

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

  // --- Products (mapped from ny_game_dim categories) ---
  const productData = [
    // Draw games
    { name: 'Mega Millions',    category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'mega' },
    { name: 'Powerball',        category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'powerball' },
    { name: 'Cash4Life',        category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'c4l' },
    { name: 'Lotto',            category: 'draw_game', type: 'lotto_jackpot', price: 2.00, externalCode: 'lotto' },
    { name: 'Numbers',          category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 'numbers_day' },
    { name: 'Win 4',            category: 'draw_game', type: 'pick_4',       price: 1.00, externalCode: 'win4_day' },
    { name: 'Take 5',           category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 't5_day' },
    { name: 'Pick 10',          category: 'draw_game', type: 'pick_3',       price: 1.00, externalCode: 'pick10' },
    { name: 'Quick Draw',       category: 'draw_game', type: 'monitor',      price: 1.00, externalCode: 'quick_draw' },
    // Instant games (sample)
    { name: 'Holiday Scratchers',    category: 'instant', type: 'scratch_off', price: 5.00, externalCode: null },
    { name: 'Win For Life',          category: 'instant', type: 'scratch_off', price: 2.00, externalCode: null },
    { name: 'Set For Life',          category: 'instant', type: 'scratch_off', price: 10.00, externalCode: null },
  ];

  for (const p of productData) {
    await prisma.product.upsert({
      where: { id: `seed-${p.externalCode || p.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
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
  console.log(`  ✓ ${productData.length} products created`);

  // --- Vendors ---
  const vendorData = [
    { name: 'McCann Worldgroup',      type: 'lead_agency',  contactName: null, contactEmail: null },
    { name: 'Havas Media',            type: 'media_buyer',  contactName: null, contactEmail: null },
    { name: 'Scientific Games',       type: 'printer',      contactName: null, contactEmail: null },
    { name: 'Pollard Banknote',       type: 'printer',      contactName: null, contactEmail: null },
    { name: 'International Game Tech', type: 'printer',     contactName: null, contactEmail: null },
    { name: 'Hiebing',                type: 'specialty',    contactName: null, contactEmail: null },
    { name: 'NRC Group',              type: 'research',     contactName: null, contactEmail: null },
  ];

  for (const v of vendorData) {
    await prisma.vendor.create({
      data: {
        jurisdictionId: ny.id,
        name: v.name,
        type: v.type,
        contactName: v.contactName,
        contactEmail: v.contactEmail,
        status: 'active',
      }
    });
  }
  console.log(`  ✓ ${vendorData.length} vendors created`);

  console.log('\n✅ Seed complete.\n');
  console.log('Login credentials:');
  console.log('  Email:    admin@stochos.io');
  console.log('  Password: stochos2026\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
