import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/db';

// Immutable system‑level metric names
const IMMUTABLE_METRICS = [
  'Gross Sales',
  'Prize Expense',
  'Retailer Commissions',
  'Vendor Gaming Fees',
  'Benefactor Transfer',
  'Investment Income',
  'Advertising & Marketing',
  'Salaries & Wages',
  'G&A',
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  if (typeof id !== 'string') {
    res.status(400).json({ error: 'Invalid metric ID' });
    return;
  }

  // Retrieve metric to enforce immutability rules when needed
  const metric = await prisma.metricDefinition.findUnique({ where: { id } });
  if (!metric) {
    res.status(404).json({ error: 'Metric not found' });
    return;
  }
  const isImmutable = IMMUTABLE_METRICS.includes(metric.name);

  if (req.method === 'GET') {
    res.status(200).json(metric);
    return;
  }

  if (req.method === 'PATCH') {
    if (isImmutable) {
      res.status(403).json({ error: 'Immutable system metric cannot be modified' });
      return;
    }
    try {
      const updated = await prisma.metricDefinition.update({
        where: { id },
        data: req.body,
      });
      res.status(200).json(updated);
    } catch (e:any) {
      res.status(400).json({ error: e.message });
    }
    return;
  }

  if (req.method === 'DELETE') {
    if (isImmutable) {
      res.status(403).json({ error: 'Immutable system metric cannot be deleted' });
      return;
    }
    try {
      await prisma.metricDefinition.delete({ where: { id } });
      res.status(204).end();
    } catch (e:any) {
      res.status(400).json({ error: e.message });
    }
    return;
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
