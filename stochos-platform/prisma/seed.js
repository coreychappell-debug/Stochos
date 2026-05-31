// prisma/seed.js
// Upsert immutable system‑level metric definitions (Appendix A)
const { prisma } = require('../lib/db');

async function main() {
  const systemMetrics = [
    { id: 'sys-001', name: 'Gross Sales', glAccount: '4-1000' },
    { id: 'sys-002', name: 'Prize Expense', glAccount: '5-2000' },
    { id: 'sys-003', name: 'Retailer Commissions', glAccount: '5-2100' },
    { id: 'sys-004', name: 'Vendor Gaming Fees', glAccount: '5-2200' },
    { id: 'sys-005', name: 'Benefactor Transfer', glAccount: '5-2300' },
    { id: 'sys-006', name: 'Investment Income', glAccount: '4-3000' },
    { id: 'sys-007', name: 'Advertising & Marketing', glAccount: '6-4000' },
    { id: 'sys-008', name: 'Salaries & Wages', glAccount: '6-4100' },
    { id: 'sys-009', name: 'G&A', glAccount: '6-4200' },
  ];

  for (const m of systemMetrics) {
    await prisma.metricDefinition.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        name: m.name,
        glAccount: m.glAccount,
        dimensions: null,
        ownerUserId: 'system',
        effectiveStartDate: new Date(),
        numberFormat: null,
      },
      update: {}, // keep existing immutable record unchanged
    });
    console.log(`Ensured system metric: ${m.name}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
