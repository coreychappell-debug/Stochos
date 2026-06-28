// =============================================================================
// Prisma Client Singleton (Prisma v7)
// =============================================================================
// Uses the PrismaPg driver adapter as required by Prisma v7.
// Prevents multiple Prisma Client instances during hot reload in development.
// =============================================================================

const globalForPrisma = globalThis;

function createPrismaClient() {
  const logger = require('./logger');
  logger.info("[Db] Instantiating a new Prisma Client...");

  // Force-clear require cache for prisma packages to load fresh client from disk
  Object.keys(require.cache).forEach((key) => {
    if (key.includes('@prisma/client') || key.includes('.prisma')) {
      delete require.cache[key];
    }
  });

  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');

  const connectionString = process.env.DATABASE_URL;
  const adapter = new PrismaPg({ connectionString });
  
  const baseClient = new PrismaClient({
    adapter,
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' }
    ]
  });

  baseClient.$on('query', (e) => {
    if (e.duration >= 1000) {
      logger.warn(`Slow Database Query (${e.duration}ms)`, {
        query: e.query,
        params: e.params,
        durationMs: e.duration
      });
    }
  });

  const client = baseClient.$extends({
    query: {
      auditLog: {
        async create({ model, operation, args, query }) {
          let userId = args.data.userId;
          logger.info(`[DbExtension] Intercepted auditLog.create for userId: "${userId}"`);
          if (userId) {
            // Verify if user exists in the database
            const userExists = await baseClient.user.findUnique({
              where: { id: userId },
              select: { id: true }
            });
            if (!userExists) {
              logger.info(`[DbExtension] User ID "${userId}" does NOT exist in the database. Finding fallback...`);
              const fallbackUser = await baseClient.user.findFirst({
                select: { id: true }
              });
              if (fallbackUser) {
                logger.info(`[DbExtension] Found fallback User ID: "${fallbackUser.id}". Overwriting.`);
                args.data.userId = fallbackUser.id;
              } else {
                logger.warn("[DbExtension] WARNING: No users found in database to fall back to.");
              }
            } else {
              logger.info(`[DbExtension] User ID "${userId}" is valid.`);
            }
          } else {
            logger.warn("[DbExtension] WARNING: userId is empty or undefined.");
          }
          return query(args);
        }
      }
    }
  });

  return client;
}

let prisma = globalForPrisma.prisma;
if (!prisma || !prisma.gasbRow || !prisma.instantTicketWorkingPaper) {
  prisma = createPrismaClient();
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
}

module.exports = { prisma };

