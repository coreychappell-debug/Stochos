// lib/primitives.ts
/**
 * Shared primitives library used across the Stochos platform.
 * Provides low‑level utilities for hashing, retention enforcement,
 * audit‑log writes, and S3‑compatible storage abstraction.
 */

import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { AuditLog } from '@prisma/client';
import { prisma } from './db';

// ---------- Hashing ----------
export function sha256Hash(data: Buffer | string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ---------- Retention Enforcement ----------
/**
 * Ensures a given Date is not older than the platform‑wide 7‑year floor.
 * Throws if the date violates the policy.
 */
export function enforceRetentionFloor(date: Date): void {
  const now = new Date();
  const sevenYearsAgo = new Date(now.getFullYear() - 7, now.getMonth(), now.getDate());
  if (date < sevenYearsAgo) {
    throw new Error('Retention floor violation: date is older than 7 years.');
  }
}

// ---------- Audit Log ----------
export async function writeAuditLog(params: {
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, any>;
}): Promise<AuditLog> {
  const { userId, entityType, entityId, action, changes } = params;
  return prisma.auditLog.create({
    data: {
      userId,
      entityType,
      entityId,
      action,
      changes: changes ? JSON.stringify(changes) : undefined,
    },
  });
}

// ---------- S3‑compatible Storage Abstraction ----------
export class StorageClient {
  private client: S3Client;
  private bucket: string;

  constructor(bucketName: string, region = 'us-east-1') {
    this.bucket = bucketName;
    this.client = new S3Client({ region });
  }

  async upload(key: string, body: Buffer | string, contentType = 'application/octet-stream') {
    const cmd = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(cmd);
  }

  async download(key: string): Promise<Buffer> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const response = await this.client.send(cmd);
    // @ts-ignore – response.Body is a readable stream
    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
