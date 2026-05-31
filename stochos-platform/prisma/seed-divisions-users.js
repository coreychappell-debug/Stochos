// prisma/seed-divisions-users.js
// Seeds role definitions and division-restricted test user accounts for QA testing.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const { prisma } = require('../lib/db');

const rolesToSeed = [
  { name: 'admin', permissions: { admin: 'write', analytics: 'write', contracts: 'write', marketing: 'write', scratchers: 'write' } },
  { name: 'analyst', permissions: { analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } },
  { name: 'manager', permissions: { analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } },
  { name: 'sales_rep', permissions: { analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } },
  { name: 'procurement_officer', permissions: { analytics: 'read', contracts: 'write', marketing: 'read', scratchers: 'write' } },
  { name: 'marketing_manager', permissions: { analytics: 'read', contracts: 'write', marketing: 'write', scratchers: 'read' } },
  { name: 'it_manager', permissions: { admin: 'write', analytics: 'read', contracts: 'read', marketing: 'read', scratchers: 'read' } }
];

const usersToSeed = [
  { email: 'admin.user@stochos.io', name: 'Executive Admin', roleName: 'admin', division: 'EXECUTIVE' },
  { email: 'finance.user@stochos.io', name: 'Finance Lead', roleName: 'analyst', division: 'FINANCE' },
  { email: 'ops.user@stochos.io', name: 'Operations Manager', roleName: 'manager', division: 'OPERATIONS' },
  { email: 'marketing.user@stochos.io', name: 'Marketing Planner', roleName: 'marketing_manager', division: 'MARKETING' },
  { email: 'procurement.user@stochos.io', name: 'Procurement Director', roleName: 'procurement_officer', division: 'PROCUREMENT' },
  { email: 'it.user@stochos.io', name: 'IT Systems Manager', roleName: 'it_manager', division: 'IT' },
  // Ensure existing seed users have executive division assigned
  { email: 'admin@stochos.io', name: 'Platform Admin', roleName: 'admin', division: 'EXECUTIVE' },
  { email: 'supervisor@stochos.io', name: 'District Supervisor', roleName: 'admin', division: 'EXECUTIVE' },
  { email: 'cchappell404@gmail.com', name: 'Caitlin Chappell', roleName: 'admin', division: 'EXECUTIVE' }
];

async function seed() {
  try {
    console.log("Seeding Role Definitions...");
    const roleMap = {};
    for (const r of rolesToSeed) {
      const dbRole = await prisma.role.upsert({
        where: { name: r.name },
        create: { name: r.name, permissions: r.permissions },
        update: { permissions: r.permissions }
      });
      roleMap[r.name] = dbRole.id;
      console.log(`✓ Ensured role: ${r.name}`);
    }

    console.log("Seeding Division User Accounts...");
    const passwordHash = await bcrypt.hash('stochos2026', 12);

    for (const u of usersToSeed) {
      const roleId = roleMap[u.roleName];
      if (!roleId) {
        console.warn(`Role ${u.roleName} not found, skipping user ${u.email}`);
        continue;
      }

      await prisma.user.upsert({
        where: { email: u.email },
        create: {
          email: u.email,
          name: u.name,
          passwordHash,
          roleId,
          division: u.division,
          status: 'active'
        },
        update: {
          division: u.division,
          roleId
        }
      });
      console.log(`✓ Ensured user: ${u.email} [Role: ${u.roleName}, Division: ${u.division}]`);
    }

    console.log("✓ Seeding division-level testing environment completed.");

  } catch (error) {
    console.error("Seeding division users failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
