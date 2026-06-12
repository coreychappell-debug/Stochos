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
  // Executive Leadership (Gaming Commission Level)
  { email: 'robert.williams@gaming.ny.gov', name: 'Robert Williams', roleName: 'admin', division: 'EXECUTIVE', bureau: 'Executive Office', subunit: 'Directorate' },
  { email: 'steven.lowenstein@gaming.ny.gov', name: 'Steven Lowenstein', roleName: 'manager', division: 'EXECUTIVE', bureau: 'Executive Office', subunit: 'Administration' },
  { email: 'edmund.burns@gaming.ny.gov', name: 'Edmund Burns', roleName: 'it_manager', division: 'EXECUTIVE', bureau: 'Bureau of Legal Services', subunit: 'General Counsel Office' },
  { email: 'brad.maione@gaming.ny.gov', name: 'Brad Maione', roleName: 'marketing_manager', division: 'MARKETING', bureau: 'Bureau of Sales & Marketing', subunit: 'Brand Strategy & Design' },

  // Divisional Managers (updated leads to represent overall division level)
  { email: 'admin.user@gaming.ny.gov', name: 'Executive Admin', roleName: 'admin', division: 'EXECUTIVE', bureau: 'Executive Office', subunit: 'Secretariat' },
  { email: 'finance.user@gaming.ny.gov', name: 'Finance Lead', roleName: 'analyst', division: 'FINANCE', bureau: 'Bureau of Finance & Financial Operations', subunit: 'GL & Accounting Unit' },
  { email: 'ops.user@gaming.ny.gov', name: 'Operations Manager', roleName: 'manager', division: 'OPERATIONS', bureau: 'Bureau of Lottery Operations', subunit: 'Draw Game Operations' },
  { email: 'marketing.user@gaming.ny.gov', name: 'Marketing Planner', roleName: 'marketing_manager', division: 'MARKETING', bureau: '', subunit: '' },
  { email: 'procurement.user@gaming.ny.gov', name: 'Procurement Director', roleName: 'procurement_officer', division: 'PROCUREMENT', bureau: 'Bureau of Finance & Financial Operations', subunit: 'Contracts & Procurement Unit' },
  { email: 'it.user@gaming.ny.gov', name: 'IT Systems Manager', roleName: 'it_manager', division: 'IT', bureau: '', subunit: '' },
  { email: 'hr.user@gaming.ny.gov', name: 'HR Lead', roleName: 'manager', division: 'HR', bureau: 'Bureau of Human Resources', subunit: 'Recruitment & Labor' },

  // Bureau Chiefs (bottom-up budgeting formulation roles)
  { email: 'it.telecom@gaming.ny.gov', name: 'Telecom Chief', roleName: 'manager', division: 'IT', bureau: 'Bureau of Secure Telecom & Networks', subunit: 'Terminal Network Unit' },
  { email: 'it.cyber@gaming.ny.gov', name: 'Cybersecurity Chief', roleName: 'manager', division: 'IT', bureau: 'Bureau of IT Security', subunit: 'Incident Response Unit' },
  { email: 'marketing.brand@gaming.ny.gov', name: 'Brand Strategy Chief', roleName: 'marketing_manager', division: 'MARKETING', bureau: 'Bureau of Sales & Marketing', subunit: 'Brand Strategy' },
  { email: 'marketing.relations@gaming.ny.gov', name: 'Retailer Relations Chief', roleName: 'marketing_manager', division: 'MARKETING', bureau: 'Bureau of Retailer Relations', subunit: 'Field Reps Support' },

  // Platform Admins
  { email: 'admin@stochos.io', name: 'Platform Admin', roleName: 'admin', division: 'EXECUTIVE', bureau: 'Executive Office', subunit: 'IT Systems' },
  { email: 'supervisor@stochos.io', name: 'District Supervisor', roleName: 'admin', division: 'EXECUTIVE', bureau: 'Bureau of Sales & Marketing', subunit: 'Regional Sales Office' },
  { email: 'cchappell404@gmail.com', name: 'Caitlin Chappell', roleName: 'admin', division: 'EXECUTIVE', bureau: 'Executive Office', subunit: 'Directorate' }
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
          bureau: u.bureau || null,
          subunit: u.subunit || null,
          status: 'active'
        },
        update: {
          division: u.division,
          bureau: u.bureau || null,
          subunit: u.subunit || null,
          roleId
        }
      });
      console.log(`✓ Ensured user: ${u.email} [Role: ${u.roleName}, Division: ${u.division}, Bureau: ${u.bureau}]`);
    }

    console.log("Linking Reporting Hierarchy (Managers & Staff)...");
    const userMap = {};
    const allDbUsers = await prisma.user.findMany();
    allDbUsers.forEach(u => {
      userMap[u.email] = u.id;
    });

    const setManager = async (staffEmail, managerEmail) => {
      const staffId = userMap[staffEmail];
      const managerId = userMap[managerEmail];
      if (staffId && managerId) {
        await prisma.user.update({
          where: { id: staffId },
          data: { managerId }
        });
      }
    };

    // Executive Level hierarchy: Lowenstein, Burns, Maione report to Williams (ED)
    await setManager('steven.lowenstein@gaming.ny.gov', 'robert.williams@gaming.ny.gov');
    await setManager('edmund.burns@gaming.ny.gov', 'robert.williams@gaming.ny.gov');
    await setManager('brad.maione@gaming.ny.gov', 'robert.williams@gaming.ny.gov');

    // Divisional Leads report to Steven Lowenstein (Deputy Director)
    await setManager('it.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');
    await setManager('ops.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');
    await setManager('marketing.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');
    await setManager('finance.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');
    await setManager('procurement.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');
    await setManager('hr.user@gaming.ny.gov', 'steven.lowenstein@gaming.ny.gov');

    // Bureau Chiefs report to their respective Division Lead
    await setManager('it.telecom@gaming.ny.gov', 'it.user@gaming.ny.gov');
    await setManager('it.cyber@gaming.ny.gov', 'it.user@gaming.ny.gov');
    await setManager('marketing.brand@gaming.ny.gov', 'marketing.user@gaming.ny.gov');
    await setManager('marketing.relations@gaming.ny.gov', 'marketing.user@gaming.ny.gov');
    
    // Executive admin reports directly to Williams
    await setManager('admin.user@gaming.ny.gov', 'robert.williams@gaming.ny.gov');

    console.log("✓ Reporting hierarchy linked successfully.");
    console.log("✓ Seeding division-level testing environment completed.");

  } catch (error) {
    console.error("Seeding division users failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
