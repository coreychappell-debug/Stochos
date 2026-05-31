// lib/middleware/rowLevelSecurity.ts
/**
 * Express‑style middleware for multi‑tenancy row‑level security.
 * Assumes a Prisma client is used for DB access and that each request
 * includes the authenticated user (req.user) with a `organizationId` field.
 */

export async function rowLevelSecurity(
  req: any,
  res: any,
  next: any,
  record: { organizationId: string } | null,
) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthenticated' });
  }
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  if (record.organizationId !== user.organizationId) {
    return res.status(403).json({ error: 'Forbidden – cross‑org access' });
  }
  return next();
}
