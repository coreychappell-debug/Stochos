// scratch/seed_commentary_rules.js
require('dotenv').config();
const { prisma } = require('../lib/db');

async function main() {
  const rules = [
    {
      ruleCode: 'VAR-COMMISSIONS',
      name: 'Retailer Commissions Variance',
      description: 'Triggered when Retailer Commissions actual variance against budget exceeds 10%.',
      metricId: 'sys-003', // Retailer Commissions
      operator: '>',
      threshold: 0.10, // 10%
      appliesToSectionType: 'Management Discussion & Analysis (MD&A)',
      requiredCommentaryType: 'variance_justification',
      severity: 5, // Maps to hard_fail
      isActive: true,
      createdBy: 'system'
    },
    {
      ruleCode: 'VAR-SALES',
      name: 'Gross Sales Deviation',
      description: 'Triggered when Gross Ticket Sales actual variance against budget exceeds 5%.',
      metricId: 'sys-001', // Gross Sales
      operator: '>',
      threshold: 0.05, // 5%
      appliesToSectionType: 'Management Discussion & Analysis (MD&A)',
      requiredCommentaryType: 'variance_justification',
      severity: 3, // Maps to soft_warning
      isActive: true,
      createdBy: 'system'
    },
    {
      ruleCode: 'VAR-PRIZE',
      name: 'Prize Expense Deviation',
      description: 'Triggered when Prize Expense actual variance against budget exceeds 8%.',
      metricId: 'sys-002', // Prize Expense
      operator: '>',
      threshold: 0.08, // 8%
      appliesToSectionType: 'Notes to Financial Statements',
      requiredCommentaryType: 'variance_justification',
      severity: 4, // Maps to hard_fail
      isActive: true,
      createdBy: 'system'
    }
  ];

  console.log('🌱 Seeding commentary rules...');
  for (const r of rules) {
    await prisma.commentaryRule.upsert({
      where: { ruleCode: r.ruleCode },
      create: r,
      update: {
        name: r.name,
        description: r.description,
        metricId: r.metricId,
        operator: r.operator,
        threshold: r.threshold,
        appliesToSectionType: r.appliesToSectionType,
        requiredCommentaryType: r.requiredCommentaryType,
        severity: r.severity,
        isActive: r.isActive,
        updatedBy: 'system'
      }
    });
    console.log(`✓ Seeded/Updated rule: ${r.ruleCode} (${r.name})`);
  }
}

main()
  .catch(err => {
    console.error('❌ Error seeding rules:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
