// =============================================================================
// Prisma Client Singleton (Prisma v7)
// =============================================================================
// Uses the PrismaPg driver adapter as required by Prisma v7.
// Prevents multiple Prisma Client instances during hot reload in development.
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const globalForPrisma = globalThis;

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = { prisma };
