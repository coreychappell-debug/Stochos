// prisma/seed-org-structure.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db');

async function main() {
  console.log('🧹 Wiping existing OrgUnit references...');
  await prisma.user.updateMany({ data: { orgUnitId: null } });
  await prisma.orgUnit.deleteMany({});

  console.log('🌱 Seeding New York State Gaming Commission structure...');

  // 1. Commission (Root)
  const commission = await prisma.orgUnit.create({
    data: {
      code: '1.0.0',
      name: 'New York State Gaming Commission',
      type: 'COMMISSION'
    }
  });

  // 2. Executive (Level 1)
  const executive = await prisma.orgUnit.create({
    data: {
      code: '1.1.0',
      name: 'Executive Chamber & Leadership',
      type: 'EXECUTIVE',
      parentId: commission.id
    }
  });

  // 3. Divisions (Level 2)
  const divisions = [
    { code: '1.1.1', name: 'Division of Lottery Operations (Operations)', type: 'DIVISION' },
    { code: '1.1.2', name: 'Division of Financial Management (Finance)', type: 'DIVISION' },
    { code: '1.1.3', name: 'Division of Marketing & Sales', type: 'DIVISION' },
    { code: '1.1.4', name: 'Division of Information Technology', type: 'DIVISION' },
    { code: '1.1.5', name: 'Division of Procurement & Bidding', type: 'DIVISION' },
    { code: '1.1.6', name: 'Division of Human Resources Management (HR)', type: 'DIVISION' },
    { code: '1.1.7', name: 'Division of Gaming Operations', type: 'DIVISION' },
    { code: '1.1.8', name: 'Division of Horse Racing & Pari-Mutuel Wagering', type: 'DIVISION' },
    { code: '1.1.9', name: 'Division of Charitable Gaming', type: 'DIVISION' }
  ];

  const divNodes = {};
  for (const div of divisions) {
    const node = await prisma.orgUnit.create({
      data: {
        code: div.code,
        name: div.name,
        type: div.type,
        parentId: executive.id
      }
    });
    divNodes[div.code] = node;
  }

  // 4. Bureaus (Level 3 - Claim Centers under Operations)
  const bureaus = [
    { code: '1.1.1.1', name: 'Schenectady Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.2', name: 'Buffalo Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.3', name: 'Rochester Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.4', name: 'Syracuse Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.5', name: 'Fishkill Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.6', name: 'Manhattan Operations Bureau', parentCode: '1.1.1' },
    { code: '1.1.1.7', name: 'Long Island Operations Bureau', parentCode: '1.1.1' }
  ];

  const burNodes = {};
  for (const bur of bureaus) {
    const parentNode = divNodes[bur.parentCode];
    const node = await prisma.orgUnit.create({
      data: {
        code: bur.code,
        name: bur.name,
        type: 'BUREAU',
        parentId: parentNode.id
      }
    });
    burNodes[bur.code] = node;
  }

  // 5. Subunits (Level 4 - Field Sales under Bureaus)
  const subunits = [
    { code: '1.1.1.1.1', name: 'Schenectady Field Sales Subunit', parentCode: '1.1.1.1' },
    { code: '1.1.1.2.1', name: 'Buffalo Field Sales Subunit', parentCode: '1.1.1.2' },
    { code: '1.1.1.3.1', name: 'Rochester Field Sales Subunit', parentCode: '1.1.1.3' },
    { code: '1.1.1.4.1', name: 'Syracuse Field Sales Subunit', parentCode: '1.1.1.4' },
    { code: '1.1.1.5.1', name: 'Fishkill Field Sales Subunit', parentCode: '1.1.1.5' },
    { code: '1.1.1.6.1', name: 'Manhattan Field Sales Subunit', parentCode: '1.1.1.6' },
    { code: '1.1.1.7.1', name: 'Garden City Field Sales Subunit', parentCode: '1.1.1.7' }
  ];

  const subNodes = {};
  for (const sub of subunits) {
    const parentNode = burNodes[sub.parentCode];
    const node = await prisma.orgUnit.create({
      data: {
        code: sub.code,
        name: sub.name,
        type: 'SUBUNIT',
        parentId: parentNode.id
      }
    });
    subNodes[sub.code] = node;
  }

  console.log('🔗 Mapping seeded users to organizational units...');

  // Map Executive directors
  const execDirector = await prisma.user.findFirst({ where: { email: 'robert.williams@gaming.ny.gov' } });
  if (execDirector) {
    await prisma.user.update({ where: { id: execDirector.id }, data: { orgUnitId: executive.id } });
  }
  const lowenstein = await prisma.user.findFirst({ where: { email: { contains: 'steven.lowenstein' } } });
  if (lowenstein) {
    await prisma.user.update({ where: { id: lowenstein.id }, data: { orgUnitId: executive.id } });
  }

  // Map other executive/general officers to Executive or their divisions
  const opsManager = await prisma.user.findFirst({ where: { email: { contains: 'ops.user' } } });
  if (opsManager) {
    await prisma.user.update({ where: { id: opsManager.id }, data: { orgUnitId: divNodes['1.1.1'].id } });
  }
  const financeManager = await prisma.user.findFirst({ where: { email: { contains: 'finance' } } });
  if (financeManager) {
    await prisma.user.update({ where: { id: financeManager.id }, data: { orgUnitId: divNodes['1.1.2'].id } });
  }
  const marketingManager = await prisma.user.findFirst({ where: { email: { contains: 'marketing' } } });
  if (marketingManager) {
    await prisma.user.update({ where: { id: marketingManager.id }, data: { orgUnitId: divNodes['1.1.3'].id } });
  }
  const itManager = await prisma.user.findFirst({ where: { email: { contains: 'it' } } });
  if (itManager) {
    await prisma.user.update({ where: { id: itManager.id }, data: { orgUnitId: divNodes['1.1.4'].id } });
  }
  const procurementManager = await prisma.user.findFirst({ where: { email: { contains: 'procurement' } } });
  if (procurementManager) {
    await prisma.user.update({ where: { id: procurementManager.id }, data: { orgUnitId: divNodes['1.1.5'].id } });
  }
  const hrManager = await prisma.user.findFirst({ where: { email: { contains: 'hr.user' } } });
  if (hrManager) {
    await prisma.user.update({ where: { id: hrManager.id }, data: { orgUnitId: divNodes['1.1.6'].id } });
  }

  // Map regional managers to their Operations Bureaus
  const centerMap = {
    Schenectady: '1.1.1.1',
    Buffalo: '1.1.1.2',
    Rochester: '1.1.1.3',
    Syracuse: '1.1.1.4',
    Fishkill: '1.1.1.5',
    Manhattan: '1.1.1.6',
    'Garden City': '1.1.1.7'
  };

  const managers = await prisma.user.findMany({
    where: { role: { name: 'manager' } }
  });

  for (const mgr of managers) {
    let matchedCode = null;
    Object.keys(centerMap).forEach(key => {
      if (mgr.subunit?.includes(key) || mgr.name.includes(key) || mgr.email.includes(key.toLowerCase().replace(' ', ''))) {
        matchedCode = centerMap[key];
      }
    });
    if (matchedCode) {
      const node = burNodes[matchedCode];
      await prisma.user.update({
        where: { id: mgr.id },
        data: { orgUnitId: node.id }
      });
      console.log(`  Mapped Regional Manager: ${mgr.name} -> ${node.name} (${node.code})`);
    } else {
      console.log(`  Skipped regional mapping for non-regional manager: ${mgr.name}`);
    }
  }

  // Map 80 sales representatives to their Subunits (Field Sales)
  const reps = await prisma.user.findMany({
    where: { role: { name: 'sales_rep' } }
  });

  const subMap = {
    Schenectady: '1.1.1.1.1',
    Buffalo: '1.1.1.2.1',
    Rochester: '1.1.1.3.1',
    Syracuse: '1.1.1.4.1',
    Fishkill: '1.1.1.5.1',
    Manhattan: '1.1.1.6.1',
    'Garden City': '1.1.1.7.1'
  };

  for (const rep of reps) {
    let code = '1.1.1.1.1'; // fallback
    Object.keys(subMap).forEach(key => {
      if (rep.subunit?.includes(key) || rep.name.includes(key) || rep.email.includes(key.toLowerCase().replace(' ', ''))) {
        code = subMap[key];
      }
    });
    const node = subNodes[code];
    if (node) {
      await prisma.user.update({
        where: { id: rep.id },
        data: { orgUnitId: node.id }
      });
    }
  }

  console.log(`✨ Org structure seeded successfully!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
