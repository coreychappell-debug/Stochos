// prisma/seed-contracts.js
// Seeds realistic, operational contracts, deliverables, compliance, and amendments for NY Lottery.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('📝 Seeding NY Lottery Vendor Contracts (Printers, Agencies, Software & Telecom)...\n');

  // 1. Find Jurisdiction
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) {
    throw new Error('NY jurisdiction not found. Run base seed first.');
  }
  console.log(`  ✓ Found jurisdiction: ${ny.name}`);

  // 2. Find divisional staff and executive users
  const itUser = await prisma.user.findUnique({ where: { email: 'it.user@gaming.ny.gov' } });
  const opsUser = await prisma.user.findUnique({ where: { email: 'ops.user@gaming.ny.gov' } });
  const marketingUser = await prisma.user.findUnique({ where: { email: 'marketing.user@gaming.ny.gov' } });
  const financeUser = await prisma.user.findUnique({ where: { email: 'finance.user@gaming.ny.gov' } });
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin.user@gaming.ny.gov' } });
  
  // Executive Leadership
  const executiveDirector = await prisma.user.findUnique({ where: { email: 'robert.williams@gaming.ny.gov' } });
  const deputyDirector = await prisma.user.findUnique({ where: { email: 'steven.lowenstein@gaming.ny.gov' } });
  const generalCounsel = await prisma.user.findUnique({ where: { email: 'edmund.burns@gaming.ny.gov' } });
  const communicationsDirector = await prisma.user.findUnique({ where: { email: 'brad.maione@gaming.ny.gov' } });

  if (!itUser || !opsUser || !marketingUser || !financeUser || !adminUser || !executiveDirector || !deputyDirector || !generalCounsel || !communicationsDirector) {
    throw new Error('Missing divisional users in DB. Run seed-divisions-users.js first.');
  }
  console.log('  ✓ Found divisional staff and executive leadership users');

  // 3. Clear existing contracts, approvals and associated items
  console.log('  ✗ Cleaning existing contracts, line items, and approvals...');
  await prisma.approval.deleteMany({ where: { entityType: 'contract' } });
  await prisma.contractLineItem.deleteMany({});
  await prisma.contractCompliance.deleteMany({});
  await prisma.contractAmendment.deleteMany({});
  await prisma.contract.deleteMany({});

  // 4. Find or Upsert the Vendors with real names and data (including mock company)
  console.log('  ✓ Ensuring operational vendors exist...');
  
  const vendorData = [
    { name: 'International Game Tech', type: 'printer', notes: 'Ecosystem technology, claims support, and retail terminal networks.' },
    { name: 'Scientific Games', type: 'printer', notes: 'Primary print partner for scratch-offs and analytical portfolio planning.' },
    { name: 'Pollard Banknote', type: 'printer', notes: 'Secondary printing agreement for specialty tickets and licensed pull-tabs.' },
    { name: 'McCann Worldgroup', type: 'lead_agency', notes: 'Creative agency of record for multi-channel marketing campaigns.' },
    { name: 'SHI International Corp', type: 'specialty', notes: 'Enterprise software licensing aggregator (Microsoft, Oracle, Salesforce).' },
    { name: 'Verizon Business', type: 'specialty', notes: 'Secure telecom networking, MPLS data lines, and retail terminal connectivity.' },
    { name: 'Everi Games', type: 'specialty', notes: 'Central determinant systems and support for Video Lottery Terminals (VLTs).' },
    { name: 'Havas Media', type: 'media_buyer', notes: 'Media buying services for public broadcast networks and print channels.' },
    { name: 'Hiebing', type: 'specialty', notes: 'Specialty advertising agency for regional events and sponsorship activities.' },
    { name: 'NRC Group', type: 'research', notes: 'National research provider for lottery consumer insights and game testing.' },
    { name: 'Empire State Media Solutions', type: 'media_buyer', notes: 'Mock agency for regional public promotions and campaign validity tests.' },
    { name: 'Adirondack Tech Solutions', type: 'specialty', notes: 'Mock enterprise networking and software support provider for regional claim center routing validation.' }
  ];

  const vendorMap = {};
  for (const v of vendorData) {
    const searchWord = v.name.split(' ')[0];
    const existing = await prisma.vendor.findFirst({
      where: { name: { contains: searchWord } }
    });

    if (existing) {
      const updated = await prisma.vendor.update({
        where: { id: existing.id },
        data: { name: v.name, type: v.type, notes: v.notes, status: 'active' }
      });
      vendorMap[searchWord.toLowerCase()] = updated;
      console.log(`    - Found & updated vendor: ${updated.name}`);
    } else {
      const created = await prisma.vendor.create({
        data: {
          jurisdictionId: ny.id,
          name: v.name,
          type: v.type,
          status: 'active',
          notes: v.notes
        }
      });
      vendorMap[searchWord.toLowerCase()] = created;
      console.log(`    - Created new vendor: ${created.name}`);
    }
  }

  // 5. Seed Contracts
  console.log('  ✓ Creating contracts...');

  // A. IGT Central System Contract (IT Division) - Managed by Executive Director
  const igtContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.international.id,
      title: 'Lottery Central System Technology & Support Services (C150005)',
      type: 'specialty',
      status: 'active',
      startDate: new Date('2022-08-01'),
      endDate: new Date('2026-08-31'),
      totalValue: 250000000.00,
      budgetCap: 300000000.00,
      division: 'IT',
      terms: {
        sla_payout: '99.9% uptime on retail sales terminal services',
        support_hours: '24/7/365 active monitoring and phone support',
        scope: 'Mainframe transaction systems, retail software licensing, field technicians support, claim handling system upgrades'
      },
      createdById: executiveDirector.id
    }
  });

  // B. Scientific Games Primary Print Contract (Operations Division) - Managed by Executive Director
  const sgContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.scientific.id,
      title: 'Primary Instant Ticket Printing and Planning Agreement (C202401)',
      type: 'instant_ticket',
      status: 'active',
      startDate: new Date('2024-05-01'),
      endDate: new Date('2029-04-30'),
      totalValue: 180000000.00,
      budgetCap: 200000000.00,
      division: 'OPERATIONS',
      terms: {
        sla_payout: 'Ticket delivery within 14 days of plate approvals',
        licensing: 'Authorized branded print options (e.g. Hasbro/Monopoly, NFL properties)',
        scope: 'Primary scratch-off printing, research, portfolio mix analysis, security features'
      },
      createdById: executiveDirector.id
    }
  });

  // C. Pollard Banknote Secondary Print Contract (Operations Division) - Managed by Deputy Director
  const pbContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.pollard.id,
      title: 'Secondary Instant Ticket Printing Services Contract (C202302)',
      type: 'instant_ticket',
      status: 'active',
      startDate: new Date('2023-05-01'),
      endDate: new Date('2027-05-31'),
      totalValue: 45000000.00,
      budgetCap: 50000000.00,
      division: 'OPERATIONS',
      terms: {
        sla_payout: 'Specialty scratch print deliveries',
        scope: 'Secondary ticket printing, pull tabs, licensed property ticket prints, scratcher finishes'
      },
      createdById: deputyDirector.id
    }
  });

  // D. McCann Marketing Contract (Marketing Division) - Managed by Marketing lead (reports up)
  const mcContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.mccann.id,
      title: 'Lottery Strategic Marketing & Creative Agency Services Partner (C202110)',
      type: 'lead_agency',
      status: 'active',
      startDate: new Date('2021-10-01'),
      endDate: new Date('2026-10-31'),
      totalValue: 240000000.00,
      budgetCap: 280000000.00,
      division: 'MARKETING',
      terms: {
        sla_payout: 'Asset approvals within 5 business days of submission',
        scope: 'Multi-channel POS marketing designs, creative advertising campaigns, media buy planning, digital second chance campaigns'
      },
      createdById: marketingUser.id
    }
  });

  // E. SHI International (IT Division) - Managed by IT Lead
  const shiContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.shi.id,
      title: 'Microsoft Enterprise Software Licensing & Azure Cloud Services (PM67304)',
      type: 'specialty',
      status: 'active',
      startDate: new Date('2023-11-01'),
      endDate: new Date('2028-10-31'),
      totalValue: 12500000.00,
      budgetCap: 15000000.00,
      division: 'IT',
      terms: {
        license_model: 'Microsoft Enterprise Agreement (EA)',
        scope: 'Microsoft 365 licensing, active directory, Azure SQL instances, cloud hosting data gateways, premier support'
      },
      createdById: itUser.id
    }
  });

  // F. Verizon Business (IT Division) - Managed by Deputy Director
  const verizonContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.verizon.id,
      title: 'Lottery Secure Retail WAN & Branch Telecommunications Network (PS68706)',
      type: 'specialty',
      status: 'active',
      startDate: new Date('2022-06-01'),
      endDate: new Date('2027-05-31'),
      totalValue: 42000000.00,
      budgetCap: 50000000.00,
      division: 'IT',
      terms: {
        network_sla: '99.99% circuit uptime for terminal communication',
        scope: 'MPLS retail connection lines, dual cellular wireless failover (4G/5G), office branch fiber networks, VoIP lines support'
      },
      createdById: deputyDirector.id
    }
  });

  // G. Everi Games (Operations Division) - Managed by Ops Lead
  const everiContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.everi.id,
      title: 'VLT Central Determinant System Licensing & Maintenance Agreement (C100000)',
      type: 'specialty',
      status: 'active',
      startDate: new Date('2019-10-01'),
      endDate: new Date('2029-09-30'),
      totalValue: 85000000.00,
      budgetCap: 95000000.00,
      division: 'OPERATIONS',
      terms: {
        vlt_sla: '99.95% operations uptime for central determinant logic',
        scope: 'Software operations support, video lottery determinants logic engine, audit logging, regulatory compliance reporting'
      },
      createdById: opsUser.id
    }
  });

  // H. Havas Media (Marketing Division) - Managed by Communications Director
  const havasContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.havas.id,
      title: 'Lottery Broadcast Media Buying & Ad Placements Contract (C202208)',
      type: 'media_buying',
      status: 'active',
      startDate: new Date('2022-01-01'),
      endDate: new Date('2026-12-31'),
      totalValue: 150000000.00,
      budgetCap: 175000000.00,
      division: 'MARKETING',
      terms: {
        placements: 'TV broadcast channels, radio stations, and print advertising slots',
        scope: 'Ad space bookings, media campaign performance monitoring, media buying compliance reporting'
      },
      createdById: communicationsDirector.id
    }
  });

  // I. Hiebing (Marketing Division) - Managed by Communications Director
  const hiebingContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.hiebing.id,
      title: 'Specialty Marketing Promotions & Sponsorship Sponsorships Contract (C202412)',
      type: 'specialty',
      status: 'active',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2027-12-31'),
      totalValue: 18000000.00,
      budgetCap: 20000000.00,
      division: 'MARKETING',
      terms: {
        promotions: 'Retailer activation events, local fairs, regional sponsorships',
        scope: 'Promotional execution, vendor event support staff management, merchandising distribution'
      },
      createdById: communicationsDirector.id
    }
  });

  // J. NRC Group (Finance Division) - Managed by General Counsel
  const nrcContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.nrc.id,
      title: 'Market Research & Consumer Behavior Insights Agreement (C202304)',
      type: 'research',
      status: 'expired',
      startDate: new Date('2023-04-01'),
      endDate: new Date('2026-03-31'),
      totalValue: 8500000.00,
      budgetCap: 9000000.00,
      division: 'FINANCE',
      terms: {
        research: 'Consumer survey data, scratch-off focus group testing, market trend models',
        scope: 'Brand tracking quarterly reports, digital demographic focus group reviews, games design validation'
      },
      createdById: generalCounsel.id
    }
  });

  // K. Mock Contract for Approval Routing Validation (Empire State Media Solutions)
  console.log('  ✓ Seeding mock contract for approval routing testing...');
  const mockContract = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.empire.id,
      title: 'Strategic Advertising & Regional Event Merchandising Contract (C2026-X)',
      type: 'media_buying',
      status: 'in_review',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2027-05-31'),
      totalValue: 1200000.00,
      budgetCap: 1500000.00,
      division: 'MARKETING',
      terms: {
        sla_payout: 'Execution of local fairs merchandising logistics',
        scope: 'Mock regional promotion event setups and advertising space bookings for testing approval routing'
      },
      createdById: marketingUser.id
    }
  });

  // Seed approvals for this mock contract
  console.log('  ✓ Seeding approvals chain (Finance -> Legal -> Executive)...');
  await prisma.approval.createMany({
    data: [
      {
        entityType: 'contract',
        entityId: mockContract.id,
        approverId: financeUser.id,
        status: 'approved',
        comment: 'Budget allocation verified within FY2027 lottery operations cap.',
        decidedAt: new Date()
      },
      {
        entityType: 'contract',
        entityId: mockContract.id,
        approverId: generalCounsel.id,
        status: 'pending',
        comment: null,
        decidedAt: null
      },
      {
        entityType: 'contract',
        entityId: mockContract.id,
        approverId: executiveDirector.id,
        status: 'pending',
        comment: null,
        decidedAt: null
      }
    ]
  });

  // L. Second Mock Contract for Approval Routing Validation (Adirondack Tech Solutions)
  console.log('  ✓ Seeding second mock contract for IT division approval routing testing...');
  const mockContract2 = await prisma.contract.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: vendorMap.adirondack.id,
      title: 'Enterprise WAN Hardware Refresh & Support Agreement (C2026-Y)',
      type: 'specialty',
      status: 'in_review',
      startDate: new Date('2026-07-01'),
      endDate: new Date('2028-06-30'),
      totalValue: 850000.00,
      budgetCap: 1000000.00,
      division: 'IT',
      terms: {
        sla_payout: 'Replacement WAN firewall router hardware delivery within 24 hours',
        scope: 'Mock enterprise networking infrastructure upgrades and hardware SLA maintenance for routing validation'
      },
      createdById: itUser.id
    }
  });

  // Seed approvals for this second mock contract (Finance & Legal approved, Executive pending)
  console.log('  ✓ Seeding approvals chain for second mock contract (Finance Approved -> Legal Approved -> Executive Pending)...');
  await prisma.approval.createMany({
    data: [
      {
        entityType: 'contract',
        entityId: mockContract2.id,
        approverId: financeUser.id,
        status: 'approved',
        comment: 'Funds reserved from IT infrastructure capital reserve.',
        decidedAt: new Date()
      },
      {
        entityType: 'contract',
        entityId: mockContract2.id,
        approverId: generalCounsel.id,
        status: 'approved',
        comment: 'Legal review complete; standard state vendor terms applied.',
        decidedAt: new Date()
      },
      {
        entityType: 'contract',
        entityId: mockContract2.id,
        approverId: executiveDirector.id,
        status: 'pending',
        comment: null,
        decidedAt: null
      }
    ]
  });

  console.log('  ✓ Seeded contracts with leadership and dynamic approval routing');

  // 6. Seed Line Items for each contract
  console.log('  ✓ Creating contract line items...');

  const seedItems = async (contractId, items) => {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      await prisma.contractLineItem.create({
        data: {
          contractId,
          description: it.desc,
          deliverableType: it.type,
          budgetAmount: it.budget,
          spentAmount: it.spent,
          status: it.status,
          sortOrder: i
        }
      });
    }
  };

  // IGT Line Items
  await seedItems(igtContract.id, [
    { desc: 'Central System Transaction Hosting & Mainframe Maintenance', type: 'specialty', budget: 140000000.00, spent: 112000000.00, status: 'in_progress' },
    { desc: 'Retail Terminal Support & Technician Field Services', type: 'specialty', budget: 80000000.00, spent: 64000000.00, status: 'in_progress' },
    { desc: 'New Claims and Secure Payout Integration System', type: 'specialty', budget: 30000000.00, spent: 30000000.00, status: 'closed' }
  ]);

  // SG Line Items
  await seedItems(sgContract.id, [
    { desc: 'Core Scratcher Print Runs ($5, $10, $20, $30, $50 games)', type: 'print_signage', budget: 120000000.00, spent: 35000000.00, status: 'in_progress' },
    { desc: 'Lottery Consumer Behavior Research & Focus Groups', type: 'creative', budget: 15000000.00, spent: 4500000.00, status: 'in_progress' },
    { desc: 'Scratcher Portfolio Mix Planning & Optimization Studies', type: 'creative', budget: 45000000.00, spent: 12000000.00, status: 'in_progress' }
  ]);

  // Pollard Line Items
  await seedItems(pbContract.id, [
    { desc: 'Specialty Scratcher Printing & Translucent Ticket Stock', type: 'print_signage', budget: 30000000.00, spent: 18000000.00, status: 'in_progress' },
    { desc: 'Licensed Specialty Games (Hasbro Co-Branding Print Runs)', type: 'print_signage', budget: 15000000.00, spent: 9000000.00, status: 'in_progress' }
  ]);

  // McCann Line Items
  await seedItems(mcContract.id, [
    { desc: 'Multi-Channel Advertising Production & Creative Assets', type: 'creative', budget: 100000000.00, spent: 85000000.00, status: 'in_progress' },
    { desc: 'Outdoor Billboards & Retail POS Signage Refresh', type: 'print_signage', budget: 60000000.00, spent: 50000000.00, status: 'in_progress' },
    { desc: 'Second Chance Digital Portal & Mobile App Promo Campaigns', type: 'creative', budget: 80000000.00, spent: 65000000.00, status: 'in_progress' }
  ]);

  // SHI (Microsoft EA) Line Items
  await seedItems(shiContract.id, [
    { desc: 'Microsoft 365 Enterprise User Licensing (M365 E5 Suite)', type: 'specialty', budget: 4500000.00, spent: 2200000.00, status: 'in_progress' },
    { desc: 'Azure Cloud Data Storage, VMs, & Analytical Databases', type: 'specialty', budget: 6000000.00, spent: 3100000.00, status: 'in_progress' },
    { desc: 'Microsoft Premier Technical Escalations Support', type: 'specialty', budget: 2000000.00, spent: 900000.00, status: 'in_progress' }
  ]);

  // Verizon Line Items
  await seedItems(verizonContract.id, [
    { desc: 'MPLS Network Connections for Retailer Lottery Terminals', type: 'specialty', budget: 25000000.00, spent: 18500000.00, status: 'in_progress' },
    { desc: 'Wireless 4G/5G Backup Cell Connections for Agents', type: 'specialty', budget: 12000000.00, spent: 8800000.00, status: 'in_progress' },
    { desc: 'State Office Branch Fiber Internet & Unified VoIP Services', type: 'specialty', budget: 5000000.00, spent: 3200000.00, status: 'in_progress' }
  ]);

  // Everi Line Items
  await seedItems(everiContract.id, [
    { desc: 'CDS VLT Core Engine Software Operations & License Fee', type: 'specialty', budget: 55000000.00, spent: 36000000.00, status: 'in_progress' },
    { desc: 'Central Determinant Mainframe Hardware Service & Audit Support', type: 'specialty', budget: 20000000.00, spent: 13500000.00, status: 'in_progress' },
    { desc: 'Regulatory Compliance VLT Audits Reporting Software Module', type: 'specialty', budget: 10000000.00, spent: 6500000.00, status: 'in_progress' }
  ]);

  // Havas Media Line Items
  await seedItems(havasContract.id, [
    { desc: 'Television Ad Slot Buying (NY Metropolitian Area Focus)', type: 'media_placement', budget: 90000000.00, spent: 75000000.00, status: 'in_progress' },
    { desc: 'Radio Ad Placements & Broadcast Audio Relays', type: 'media_placement', budget: 35000000.00, spent: 28000000.00, status: 'in_progress' },
    { desc: 'Digital Advertising Buying & Search Engine Marketing (SEM)', type: 'media_placement', budget: 25000000.00, spent: 21000000.00, status: 'in_progress' }
  ]);

  // Hiebing Line Items
  await seedItems(hiebingContract.id, [
    { desc: 'New York State Fair Operational Presence & Ad Booths', type: 'creative', budget: 8000000.00, spent: 8000000.00, status: 'closed' },
    { desc: 'Regional Events Support staff & Retailer Promotion Kits', type: 'print_signage', budget: 10000000.00, spent: 4500000.00, status: 'in_progress' }
  ]);

  // NRC Group Line Items
  await seedItems(nrcContract.id, [
    { desc: 'Quarterly Consumer Brand Recall Tracking & Reporting', type: 'creative', budget: 3500000.00, spent: 3500000.00, status: 'closed' },
    { desc: 'New Scratcher Concept Focus Group Studies', type: 'creative', budget: 5000000.00, spent: 5000000.00, status: 'closed' }
  ]);

  // Mock Contract Line Items
  await seedItems(mockContract.id, [
    { desc: 'Regional Merchandising & POS Ad Placement Execution', type: 'media_placement', budget: 800000.00, spent: 0.00, status: 'pending' },
    { desc: 'State Fair Promotional Merchandising Design & Stock', type: 'creative', budget: 400000.00, spent: 0.00, status: 'pending' }
  ]);

  // Second Mock Contract Line Items
  await seedItems(mockContract2.id, [
    { desc: 'WAN Firewall Routers and Hardware Provisioning', type: 'specialty', budget: 500000.00, spent: 0.00, status: 'pending' },
    { desc: 'Enterprise Systems Support & Dynamic Routing Tests', type: 'specialty', budget: 350000.00, spent: 0.00, status: 'pending' }
  ]);

  console.log('  ✓ Seeded line items for all contracts');

  // 7. Seed Compliance documents
  console.log('  ✓ Creating compliance documents...');
  const complianceData = [
    // IGT Compliance
    { contractId: igtContract.id, type: 'bond', desc: 'Performance Bond - Technology System Operations', status: 'received', exp: '2026-08-31' },
    { contractId: igtContract.id, type: 'insurance', desc: 'General Commercial Liability & Cyber Risk Insurance', status: 'received', exp: '2026-08-31' },
    { contractId: igtContract.id, type: 'background_check', desc: 'Sovereign Security Clearance - Mainframe Core Tech Staff', status: 'received', exp: '2027-01-15' },
    
    // SG Compliance
    { contractId: sgContract.id, type: 'bond', desc: 'Secured Printing Performance Bond', status: 'received', exp: '2029-04-30' },
    { contractId: sgContract.id, type: 'insurance', desc: 'Environmental Printing Plant Compliance Certification', status: 'received', exp: '2027-05-15' },
    { contractId: sgContract.id, type: 'nda', desc: 'Confidentiality & Non-Disclosure of Ticket Payout Algorithms', status: 'received', exp: '2030-01-01' },
    
    // Pollard Compliance
    { contractId: pbContract.id, type: 'bond', desc: 'Secondary Printing Performance Bond', status: 'received', exp: '2027-05-31' },
    { contractId: pbContract.id, type: 'insurance', desc: 'Commercial Liability & Supply Chain Interruption Policy', status: 'received', exp: '2026-12-31' },
    
    // McCann Compliance
    { contractId: mcContract.id, type: 'insurance', desc: 'Creative Errors & Omissions Insurance Policy', status: 'received', exp: '2026-10-31' },
    { contractId: mcContract.id, type: 'nda', desc: 'Marketing Campaigns Confidentiality Agreement', status: 'received', exp: '2026-10-31' },

    // SHI Compliance
    { contractId: shiContract.id, type: 'nda', desc: 'Microsoft Master Software Privacy & Confidentiality NDA', status: 'received', exp: '2028-10-31' },
    { contractId: shiContract.id, type: 'insurance', desc: 'Professional Services IT Indemnity Policy', status: 'received', exp: '2028-10-31' },

    // Verizon Compliance
    { contractId: verizonContract.id, type: 'bond', desc: 'Telecommunications Services Supply Reliability Bond', status: 'received', exp: '2027-05-31' },
    { contractId: verizonContract.id, type: 'background_check', desc: 'Secure Tech Clearance - Verizon WAN NOC Admins', status: 'received', exp: '2027-05-31' },

    // Everi Compliance
    { contractId: everiContract.id, type: 'license', desc: 'New York State Class-III Gaming License Authorization', status: 'received', exp: '2029-09-30' },
    { contractId: everiContract.id, type: 'bond', desc: 'CDS VLT Core Mainframe Support Surety Bond', status: 'received', exp: '2029-09-30' },

    // Havas Compliance
    { contractId: havasContract.id, type: 'insurance', desc: 'Professional Liability & Broadcast Liability Policy', status: 'received', exp: '2026-12-31' },
    
    // Hiebing Compliance
    { contractId: hiebingContract.id, type: 'insurance', desc: 'Event Execution Public Safety Insurance', status: 'received', exp: '2027-12-31' },

    // NRC Compliance
    { contractId: nrcContract.id, type: 'nda', desc: 'Lottery Player Focus Groups Data Anonymity Agreement', status: 'received', exp: '2026-03-31' }
  ];

  for (const c of complianceData) {
    await prisma.contractCompliance.create({
      data: {
        contractId: c.contractId,
        documentType: c.type,
        description: c.desc,
        status: c.status,
        expirationDate: new Date(c.exp)
      }
    });
  }
  console.log('  ✓ Seeded compliance records');

  // 8. Seed Amendments
  console.log('  ✓ Creating contract amendments...');
  
  // IGT Amendment
  await prisma.contractAmendment.create({
    data: {
      contractId: igtContract.id,
      amendmentNumber: 1,
      description: 'Two-year technology extension to August 2026 to facilitate claims modernization.',
      valueChange: 65000000.00,
      newEndDate: new Date('2026-08-31'),
      effectiveDate: new Date('2024-08-01')
    }
  });

  // McCann Amendment
  await prisma.contractAmendment.create({
    data: {
      contractId: mcContract.id,
      amendmentNumber: 1,
      description: 'Expansion of budget allocation for Digital Second-Chance mobile campaign promotion.',
      valueChange: 20000000.00,
      newEndDate: null,
      effectiveDate: new Date('2023-06-01')
    }
  });

  // Verizon Amendment
  await prisma.contractAmendment.create({
    data: {
      contractId: verizonContract.id,
      amendmentNumber: 1,
      description: 'MPLS & 5G failover expansion to support 500 new retail agent coordinates in outer districts.',
      valueChange: 3500000.00,
      newEndDate: null,
      effectiveDate: new Date('2024-10-15')
    }
  });

  console.log('  ✓ Seeded amendments');
  console.log('\n✅ Seeding NY Lottery Contracts completed.\n');
}

main()
  .catch((e) => {
    console.error('Contracts seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
