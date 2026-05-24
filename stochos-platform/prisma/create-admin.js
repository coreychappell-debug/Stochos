require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find or create admin role
  const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
  if (!adminRole) throw new Error('Admin role not found. Run base seed first.');

  const hash = await bcrypt.hash('Stochos2026!', 12);
  const user = await prisma.user.upsert({
    where: { email: 'cchappell404@gmail.com' },
    update: { name: 'Caitlin Chappell', passwordHash: hash },
    create: {
      email: 'cchappell404@gmail.com',
      name: 'Caitlin Chappell',
      passwordHash: hash,
      roleId: adminRole.id,
    },
  });
  console.log('✓ Created user:', user.id, user.email, '(admin)');
}

main().finally(() => prisma.$disconnect());
