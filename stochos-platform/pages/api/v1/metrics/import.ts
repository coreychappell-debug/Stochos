import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/db';
import csv from 'csv-parser';
import { createReadStream, createWriteStream, readFileSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pipe = promisify(pipeline);

export const config = {
  api: {
    bodyParser: false, // we'll parse multipart/form-data manually
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  // @ts-ignore
  const Busboy = (await import('busboy')).default;
  const busboy = new Busboy({ headers: req.headers as any });
  let filePath: string | null = null;

  await new Promise<void>((resolve, reject) => {
    busboy.on('file', (fieldname: any, file: any, filename: any, encoding: any, mimetype: any) => {
      const path = `${process.cwd()}/tmp/${filename}`;
      filePath = path;
      const writeStream = createWriteStream(path);
      file.pipe(writeStream);
      file.on('end', () => resolve());
    });
    busboy.on('error', (err: any) => reject(err));
    req.pipe(busboy);
  });

  if (!filePath) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const pathStr = filePath as string;

  // Determine file type by extension
  if (pathStr.endsWith('.csv')) {
    const results: any[] = [];
    await pipe(
      createReadStream(pathStr).pipe(csv()),
      async function* (source) {
        for await (const record of source) {
          results.push(record);
          yield record;
        }
      }
    );
    // Assuming CSV columns match metric fields
    for (const row of results) {
      await prisma.metricDefinition.create({
        data: {
          name: row.name,
          glAccount: row.glAccount ?? undefined,
          dimensions: row.dimensions ?? undefined,
          ownerUserId: row.ownerUserId ?? 'import',
          effectiveStartDate: new Date(row.effectiveStartDate),
          effectiveEndDate: row.effectiveEndDate ? new Date(row.effectiveEndDate) : undefined,
          numberFormat: row.numberFormat ?? undefined,
        },
      });
    }
    res.status(200).json({ imported: results.length });
    return;
  }

  if (pathStr.endsWith('.json')) {
    const fileContent = readFileSync(pathStr, 'utf8');
    const parsedData = JSON.parse(fileContent);
    const records = Array.isArray(parsedData) ? parsedData : [parsedData];
    for (const row of records) {
      await prisma.metricDefinition.create({
        data: {
          name: row.name,
          glAccount: row.glAccount ?? undefined,
          dimensions: row.dimensions ? JSON.stringify(row.dimensions) : undefined,
          ownerUserId: row.ownerUserId ?? 'import',
          effectiveStartDate: new Date(row.effectiveStartDate),
          effectiveEndDate: row.effectiveEndDate ? new Date(row.effectiveEndDate) : undefined,
          numberFormat: row.numberFormat ?? undefined,
        },
      });
    }
    res.status(200).json({ imported: records.length });
    return;
  }

  res.status(415).json({ error: 'Unsupported file type' });
}
