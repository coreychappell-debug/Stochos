import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { sha256Hash, writeAuditLog } from '@/lib/primitives';
import fs from 'fs';
import path from 'path';
import { evaluateValidationRules } from '@/lib/rulesEngine';
import { evaluateCommentaryRules } from '@/lib/commentaryEngine';
import { acquireLock, releaseLock } from '@/lib/jobLock';
import { auth } from '@/lib/auth';

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

// Ensure uploads folder exists
function saveFileLocally(filename, content, hash) {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const safeName = `${path.basename(filename, path.extname(filename))}_${hash}${path.extname(filename)}`;
    const filePath = path.join(UPLOADS_DIR, safeName);
    fs.writeFileSync(filePath, content);
    return filePath;
  } catch (error) {
    console.error("Failed to save raw file locally:", error);
    return "";
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (batchId) {
      const batch = await prisma.importBatch.findUnique({
        where: { id: batchId }
      });
      if (!batch) {
        return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
      }
      const traces = await prisma.cellImportTrace.findMany({
        where: { batchId },
        orderBy: { sourceRowNumber: 'asc' }
      });
      return NextResponse.json({ success: true, batch, traces });
    }

    const batches = await prisma.importBatch.findMany({
      orderBy: { uploadedAt: 'desc' }
    });
    return NextResponse.json({ success: true, batches });
  } catch (error) {
    console.error('Error fetching import batches:', error);
    return NextResponse.json({ error: 'Failed to fetch import batches', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    
    // Check if JSON request (Rollback Mode)
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { action, batchId, userId } = body;

      if (action === 'rollback') {
        if (!batchId) {
          return NextResponse.json({ error: 'Missing batchId for rollback' }, { status: 400 });
        }

        // Fetch batch details
        const batch = await prisma.importBatch.findUnique({
          where: { id: batchId }
        });

        if (!batch) {
          return NextResponse.json({ error: 'Import batch not found' }, { status: 404 });
        }

        if (batch.isRolledBack) {
          return NextResponse.json({ error: 'Import batch has already been rolled back' }, { status: 400 });
        }

        const snapshot = batch.mappingSnapshot;
        if (!snapshot || !snapshot.jurisdictionId || !snapshot.periodDate) {
          return NextResponse.json({ error: 'Invalid batch mapping snapshot, cannot rollback' }, { status: 400 });
        }

        // Check if the period is locked
        if (batch.fiscalYear && batch.periodCode) {
          const lock = await prisma.periodLock.findUnique({
            where: {
              jurisdictionId_fiscalYear_periodCode: {
                jurisdictionId: snapshot.jurisdictionId,
                fiscalYear: batch.fiscalYear,
                periodCode: batch.periodCode
              }
            }
          });
          if (lock && lock.isLocked) {
            return NextResponse.json({ error: 'This period is locked. No rollbacks can be performed.' }, { status: 400 });
          }
        }

        // Get user for audit logs
        let user = await prisma.user.findFirst({
          where: userId ? { id: userId } : undefined
        });
        if (!user) {
          const session = await auth();
          user = session?.user || await prisma.user.findFirst();
        }

        const lockKey = `trial-balance-ingest-${snapshot.jurisdictionId}-${batch.fiscalYear || 2024}-${batch.periodCode || 'P12'}`;
        const lockResult = await acquireLock(lockKey, user.id || 'system', user.name || 'System', 'Rollback Trial Balance Ingest', 60);
        if (!lockResult.success) {
          return NextResponse.json({ error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` }, { status: 429 });
        }

        try {
          // Execute rollback transaction
          await prisma.$transaction(async (tx) => {
            // 1. Delete associated TrialBalanceRecords
            await tx.trialBalanceRecord.deleteMany({
              where: {
                OR: [
                  { uploadId: batchId },
                  {
                    jurisdictionId: snapshot.jurisdictionId,
                    periodDate: new Date(snapshot.periodDate),
                    accountCode: { in: snapshot.accountCodes }
                  }
                ]
              }
            });

            // 2. Delete cell import traces
            await tx.cellImportTrace.deleteMany({
              where: { batchId }
            });

            // 3. Mark batch as rolled back
            await tx.importBatch.update({
              where: { id: batchId },
              data: {
                status: 'rolled_back',
                isRolledBack: true,
                rolledBackBy: user ? user.name : 'system',
                rolledBackAt: new Date(),
                rollbackReason: 'User initiated rollback via Data Prep Studio'
              }
            });
          });

          // Write to audit log
          if (user) {
            await writeAuditLog({
              userId: user.id,
              entityType: 'ImportBatch',
              entityId: batchId,
              action: 'rollback',
              changes: { before: 'complete', after: 'rolled_back' }
            });
          }

          return NextResponse.json({
            success: true,
            message: 'Import batch rolled back successfully. Trial balance records reverted.'
          });
        } finally {
          await releaseLock(lockKey);
        }
      }

      return NextResponse.json({ error: 'Invalid JSON request action' }, { status: 400 });
    }

    // Otherwise, multipart/form-data (Upload Mode)
    const formData = await request.formData();
    const file = formData.get('file');
    const jurisdictionId = formData.get('jurisdictionId');
    const periodDateStr = formData.get('periodDate');
    const pipelineId = formData.get('pipelineId');
    const userId = formData.get('userId');
    const fiscalYearStr = formData.get('fiscalYear');
    const periodCode = formData.get('periodCode');

    if (!file || !jurisdictionId || !periodDateStr) {
      return NextResponse.json(
        { error: 'Missing required fields (file, jurisdictionId, periodDate)' },
        { status: 400 }
      );
    }

    const fiscalYear = fiscalYearStr ? parseInt(fiscalYearStr, 10) : 2024;
    const pCode = periodCode || 'P12';

    // Get user first
    const session = await auth();
    let user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    });
    if (!user) {
      user = session?.user || await prisma.user.findFirst();
    }
    if (!user) {
      return NextResponse.json({ error: 'No platform user available' }, { status: 400 });
    }

    // Check if period is locked
    const lock = await prisma.periodLock.findUnique({
      where: {
        jurisdictionId_fiscalYear_periodCode: {
          jurisdictionId,
          fiscalYear,
          periodCode: pCode
        }
      }
    });
    if (lock && lock.isLocked) {
      return NextResponse.json(
        { error: 'This period is locked. No further uploads can be performed.' },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const hash = sha256Hash(fileContent);

    // Check for duplicate uploads (Idempotency check)
    const duplicateBatch = await prisma.importBatch.findFirst({
      where: { sourceFileHash: hash, status: 'complete' }
    });
    if (duplicateBatch) {
      return NextResponse.json({ error: `File duplicate: This exact trial balance has already been ingested in batch ${duplicateBatch.id}.` }, { status: 400 });
    }

    // Acquire lock
    const lockKey = `trial-balance-ingest-${jurisdictionId}-${fiscalYear}-${pCode}`;
    const lockResult = await acquireLock(lockKey, user.id, user.name, 'Ingest Trial Balance', 60);
    if (!lockResult.success) {
      return NextResponse.json({ error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` }, { status: 429 });
    }

    let batchRecord = null;
    try {
      const periodDate = new Date(periodDateStr);

      // Save CSV locally
      const storagePath = saveFileLocally(file.name, fileContent, hash);

      // Create initial ImportBatch record immediately in status: 'uploading'
      batchRecord = await prisma.importBatch.create({
        data: {
          organizationId: 'default-org',
          gridId: 'default-grid',
          pipelineId: pipelineId || 'no-pipeline',
          sourceFilename: file.name,
          sourceFileHash: hash,
          sourceFileSizeBytes: file.size,
          storagePath: storagePath,
          uploadedBy: user.name,
          status: 'uploading',
          fiscalYear,
          periodCode: pCode,
          mappingSnapshot: {
            jurisdictionId,
            periodDate: periodDateStr,
            accountCodes: []
          }
        }
      });

      // Fire-and-forget background execution
      Promise.resolve().then(async () => {
        try {
          // 1. Parsing
          await prisma.importBatch.update({
            where: { id: batchRecord.id },
            data: { status: 'parsing' }
          });

          const records = parse(fileContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            cast: (value, context) => {
              if (context.column && typeof context.column === 'string' && context.column.toLowerCase().includes('balance')) {
                return parseFloat(value.replace(/[^0-9.-]+/g, '')) || 0;
              }
              return value;
            }
          });

          if (records.length === 0) {
            throw new Error('No valid records found in CSV');
          }

          // 2. Mapping
          await prisma.importBatch.update({
            where: { id: batchRecord.id },
            data: { status: 'mapping' }
          });

          let processed = records.map(row => ({ ...row }));
          let pipeline = null;

          if (pipelineId) {
            pipeline = await prisma.pipeline.findUnique({
              where: { id: pipelineId }
            });

            if (pipeline && pipeline.pipelineJson && pipeline.pipelineJson.nodes) {
              const nodes = pipeline.pipelineJson.nodes;
              nodes.forEach(step => {
                try {
                  if (step.type === 'split') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const parts = val.split(step.delimiter || '-');
                      const newRow = { ...row };
                      (step.names || []).forEach((name, idx) => {
                        newRow[name] = parts[idx] || '';
                      });
                      return newRow;
                    });
                  } else if (step.type === 'regex_extract') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const regex = new RegExp(step.pattern || '(.*)');
                      const match = val.match(regex);
                      const newRow = { ...row };
                      newRow[step.targetField || 'extracted'] = match ? match[1] || '' : '';
                      return newRow;
                    });
                  } else if (step.type === 'map_account') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const mapping = step.mapping || {};
                      const mapped = mapping[val] || val;
                      return { ...row, accountCode: mapped };
                    });
                  } else if (step.type === 'map_dimension') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const newRow = { ...row };
                      newRow[step.dimensionName || 'Game_ID'] = val !== '0000' ? val : 'N/A';
                      return newRow;
                    });
                  } else if (step.type === 'conditional_map') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const matched = val === step.conditionValue;
                      const newRow = { ...row };
                      newRow[step.targetField || 'cond_mapped'] = matched ? step.targetValue : (step.defaultValue || val);
                      return newRow;
                    });
                  } else if (step.type === 'exclude_row') {
                    processed = processed.filter(row => {
                      const val = String(row[step.field] || '');
                      return val !== step.value;
                    });
                  } else if (step.type === 'aggregate') {
                    const groups = {};
                    processed.forEach(row => {
                      const key = (step.keys || []).map(k => row[k] || '').join('|');
                      if (!groups[key]) {
                        groups[key] = { ...row, [step.sumField || 'balance']: 0 };
                      }
                      groups[key][step.sumField || 'balance'] += parseFloat(String(row[step.sumField || 'balance'] || 0));
                    });
                    processed = Object.values(groups);
                  } else if (step.type === 'normalize_sign') {
                     processed = processed.map(row => {
                       const code = String(row[step.field] || '');
                       const val = parseFloat(String(row.balance || 0));
                       const isNegative = code.startsWith('5') || code.startsWith('6'); 
                       return {
                         ...row,
                         balance: isNegative ? -Math.abs(val) : Math.abs(val)
                       };
                     });
                  } else if (step.type === 'replace_text') {
                    processed = processed.map(row => {
                      const val = String(row[step.field] || '');
                      const pattern = step.pattern || '';
                      const replacement = step.replacement || '';
                      const newRow = { ...row };
                      newRow[step.field] = val.replaceAll(pattern, replacement);
                      return newRow;
                    });
                  }
                } catch (e) {
                  console.error('Error applying step in upload:', step.type, e);
                }
              });
            }
          }

          // 3. Validating
          await prisma.importBatch.update({
            where: { id: batchRecord.id },
            data: { status: 'validating' }
          });

          const trialBalanceRecords = processed.map(record => {
            const code = record.accountCode || record.account_code || record.Account || record['Account Code'] || '';
            const name = record.accountName || record.account_name || record.Name || record['Account Name'] || '';
            const balStr = record.balance || record.Balance || '0';
            const bal = parseFloat(String(balStr).replace(/[^0-9.-]+/g, '')) || 0;

            return {
              jurisdictionId,
              periodDate,
              fiscalYear,
              periodCode: pCode,
              accountCode: code,
              accountName: name,
              balance: bal,
              status: 'imported'
            };
          });

          const validRecords = trialBalanceRecords.filter(r => r.accountCode);
          const accountCodes = validRecords.map(r => r.accountCode);

          // 4. Importing
          await prisma.importBatch.update({
            where: { id: batchRecord.id },
            data: { status: 'importing' }
          });

          await prisma.$transaction(async (tx) => {
            // Clear existing values for same jurisdiction & period (overwrite logic)
            const oldBatches = await tx.importBatch.findMany({
              where: {
                organizationId: 'default-org',
                gridId: 'default-grid',
                fiscalYear,
                periodCode: pCode,
                status: 'complete',
                id: { not: batchRecord.id }
              }
            });

            for (const oldBatch of oldBatches) {
              await tx.importBatch.update({
                where: { id: oldBatch.id },
                data: { 
                  status: 'rolled_back', 
                  isRolledBack: true,
                  supersededByBatchId: batchRecord.id
                }
              });
              await tx.trialBalanceRecord.deleteMany({
                where: { uploadId: oldBatch.id }
              });
            }

            // Create CellImportTraces
            const traces = validRecords.map((r, idx) => ({
              cellId: `${batchRecord.id}_C${idx}`,
              batchId: batchRecord.id,
              sourceRowNumber: idx + 1,
              sourceRawValue: JSON.stringify(records[idx] || {}),
              transformedValue: r.balance
            }));

            await tx.cellImportTrace.createMany({
              data: traces
            });

            // Perform bulk insert of new records, linking to batch
            const recordsToInsert = validRecords.map(r => ({
              ...r,
              uploadId: batchRecord.id
            }));

            await tx.trialBalanceRecord.createMany({
              data: recordsToInsert
            });

            // Update main record stats
            await tx.importBatch.update({
              where: { id: batchRecord.id },
              data: {
                status: 'complete',
                rowCountSource: records.length,
                rowCountImported: validRecords.length,
                rowCountExcluded: records.length - validRecords.length,
                mappingSnapshot: {
                  jurisdictionId,
                  periodDate: periodDateStr,
                  accountCodes
                }
              }
            });
          });

          // Run validation rules
          let validationStatus = 'passed';
          try {
            const ruleResults = await evaluateValidationRules(jurisdictionId, periodDate);
            if (ruleResults.some(r => r.status === 'failed')) {
              validationStatus = 'failed';
            } else if (ruleResults.some(r => r.status === 'warning')) {
              validationStatus = 'passed_with_warnings';
            }

            await prisma.importBatch.update({
              where: { id: batchRecord.id },
              data: { validationStatus }
            });
          } catch (e) {
            console.error('Failed to run validation rules during upload:', e);
          }

          // Run commentary rule evaluation
          try {
            await evaluateCommentaryRules(batchRecord.id);
          } catch (err) {
            console.error('Failed to run commentary rules evaluation:', err);
          }

          // Write audit log entry
          await writeAuditLog({
            userId: user.id,
            entityType: 'ImportBatch',
            entityId: batchRecord.id,
            action: 'upload',
            changes: { recordCount: validRecords.length, validationStatus }
          });

        } catch (backgroundError) {
          console.error('Background trial balance ingest failed:', backgroundError);
          try {
            await prisma.importBatch.update({
              where: { id: batchRecord.id },
              data: { status: 'failed' }
            });
          } catch (updateErr) {
            console.error('Failed to mark batch as failed:', updateErr);
          }
        } finally {
          await releaseLock(lockKey);
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Trial balance file accepted. Ingestion started in the background.',
        batchId: batchRecord.id,
        status: 'uploading'
      }, { status: 202 });

    } catch (err) {
      console.error('Failed to initialize upload:', err);
      await releaseLock(lockKey);
      return NextResponse.json({ error: 'Failed to process file upload', details: err.message }, { status: 500 });
    }
  } catch (error) {
    console.error('Error uploading trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to process trial balance upload', details: error.message },
      { status: 500 }
    );
  }
}

