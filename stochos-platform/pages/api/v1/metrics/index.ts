import type { NextApiRequest, NextApiResponse } from 'next';
import { createMetric } from '../../../../lib/metricRegistry';
import { prisma } from '../../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const metrics = await prisma.metricDefinition.findMany();
    res.status(200).json(metrics);
    return;
  }
  if (req.method === 'POST') {
    const { name, glAccount, dimensions, ownerUserId, effectiveStartDate, effectiveEndDate, numberFormat } = req.body;
    try {
      const metric = await createMetric({
        name,
        glAccount,
        dimensions,
        ownerUserId,
        effectiveStartDate: new Date(effectiveStartDate),
        effectiveEndDate: effectiveEndDate ? new Date(effectiveEndDate) : undefined,
        numberFormat,
      });
      res.status(201).json(metric);
    } catch (e:any) {
      res.status(400).json({ error: e.message });
    }
    return;
  }
  res.setHeader('Allow', ['GET', 'POST']);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
