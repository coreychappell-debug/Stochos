import { prisma } from '../lib/db';

async function main() {
  // Example taxonomy records – replace with actual Appendix A data as needed.
  const taxonomy = [
    { id: 'tax-001', name: 'Revenue', description: 'Top‑level revenue category' },
    { id: 'tax-002', name: 'Expense', description: 'Top‑level expense category' },
    { id: 'tax-003', name: 'Asset', description: 'Asset accounts' },
    { id: 'tax-004', name: 'Liability', description: 'Liability accounts' },
  ];

  for (const t of taxonomy) {
    await prisma.metricDefinition.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        name: t.name,
        glAccount: null,
        dimensions: null,
        ownerUserId: 'system',
        effectiveStartDate: new Date(),
        numberFormat: null,
      },
      update: {},
    });
  }

  console.log('Taxonomy seed completed');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
