import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { acquireLock, releaseLock } from '@/lib/jobLock';

export async function POST(request) {
  const session = await auth();
  const userId = session?.user?.id || 'system';
  const userName = session?.user?.name || 'System';

  const lockKey = 'org-users-import';
  const lockResult = await acquireLock(
    lockKey,
    userId,
    userName,
    'Upload & Map Staff',
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Missing CSV file.' }, { status: 400 });
    }

    const fileContent = await file.text();
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid records found in CSV.' }, { status: 400 });
    }

    // Validate headers
    const requiredHeaders = ['Name', 'Email', 'OrgUnitCode', 'ManagerEmail', 'Status'];
    const headers = Object.keys(records[0]);
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Invalid CSV template. Missing headers: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

    // Load all org units to build parent mapping in-memory
    const orgUnits = await prisma.orgUnit.findMany();
    const unitsMap = new Map(); // code -> unit object
    const idMap = new Map(); // id -> unit object
    orgUnits.forEach(u => {
      unitsMap.set(u.code, u);
      idMap.set(u.id, u);
    });

    // Helper to resolve hierarchy details from an OrgUnit
    const getOrgPathDetails = (unit) => {
      let division = 'EXECUTIVE';
      let bureau = null;
      let subunit = null;

      let current = unit;
      while (current) {
        const type = current.type.toUpperCase();
        if (type === 'SUBUNIT') {
          subunit = current.name;
        } else if (type === 'BUREAU') {
          bureau = current.name;
        } else if (type === 'DIVISION') {
          // Check if matches preset divisions: EXECUTIVE, FINANCE, MARKETING, OPERATIONS, IT, PROCUREMENT
          const uName = current.name.toUpperCase();
          if (uName.includes('IT') || uName.includes('INFORMATION TECHNOLOGY')) {
            division = 'IT';
          } else if (uName.includes('FINANCE') || uName.includes('AUDIT')) {
            division = 'FINANCE';
          } else if (uName.includes('MARKETING') || uName.includes('SALES')) {
            division = 'MARKETING';
          } else if (uName.includes('OPERATIONS') || uName.includes('PRINT')) {
            division = 'OPERATIONS';
          } else if (uName.includes('PROCUREMENT') || uName.includes('BIDDING')) {
            division = 'PROCUREMENT';
          } else if (uName.includes('EXECUTIVE') || uName.includes('ADMIN')) {
            division = 'EXECUTIVE';
          } else {
            division = current.name;
          }
        } else if (type === 'EXECUTIVE' || type === 'COMMISSION') {
          division = 'EXECUTIVE';
        }
        
        current = current.parentId ? idMap.get(current.parentId) : null;
      }

      return { division, bureau, subunit };
    };

    // Ensure we have default roles in DB
    const defaultRepRole = await prisma.role.findFirst({ where: { name: 'sales_rep' } });
    const defaultManagerRole = await prisma.role.findFirst({ where: { name: 'manager' } });
    const defaultAdminRole = await prisma.role.findFirst({ where: { name: 'admin' } });
    const fallbackRole = await prisma.role.findFirst();

    const passwordHash = await bcrypt.hash('stochos2026', 12);
    const nyJurisdiction = await prisma.jurisdiction.findFirst({ where: { abbreviation: 'NY' } });

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;

      // First pass: upsert users with basic details (excluding managerId to avoid link issues if manager isn't created yet)
      for (const row of records) {
        const email = row.Email.toLowerCase();
        const name = row.Name;
        const status = row.Status.toLowerCase() || 'active';
        const unit = unitsMap.get(row.OrgUnitCode);

        let orgUnitId = null;
        let division = 'EXECUTIVE';
        let bureau = null;
        let subunit = null;

        if (unit) {
          orgUnitId = unit.id;
          const path = getOrgPathDetails(unit);
          division = path.division;
          bureau = path.bureau;
          subunit = path.subunit;
        }

        // Determine role
        let targetRoleId = fallbackRole?.id || '';
        if (email.includes('manager')) {
          targetRoleId = defaultManagerRole?.id || targetRoleId;
        } else if (email.includes('rep')) {
          targetRoleId = defaultRepRole?.id || targetRoleId;
        } else if (email.includes('admin')) {
          targetRoleId = defaultAdminRole?.id || targetRoleId;
        }

        const existing = await tx.user.findUnique({ where: { email } });

        if (existing) {
          await tx.user.update({
            where: { email },
            data: {
              name,
              status,
              orgUnitId,
              division,
              bureau,
              subunit
            }
          });
          updated++;
        } else {
          await tx.user.create({
            data: {
              email,
              name,
              passwordHash,
              roleId: targetRoleId,
              jurisdictionId: nyJurisdiction?.id || null,
              status,
              orgUnitId,
              division,
              bureau,
              subunit
            }
          });
          created++;
        }
      }

      // Second pass: resolve managerIds
      let managersLinked = 0;
      for (const row of records) {
        const email = row.Email.toLowerCase();
        const managerEmail = row.ManagerEmail?.toLowerCase();

        if (managerEmail) {
          const managerUser = await tx.user.findUnique({ where: { email: managerEmail } });
          if (managerUser) {
            await tx.user.update({
              where: { email },
              data: { managerId: managerUser.id }
            });
            managersLinked++;
          }
        } else {
          // Remove managerId if empty in CSV
          await tx.user.update({
            where: { email },
            data: { managerId: null }
          });
        }
      }

      return { created, updated, managersLinked };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed CSV: Created ${result.created} new staff, updated ${result.updated} records, and established ${result.managersLinked} reporting relations.`,
      details: result
    });

  } catch (error) {
    console.error('Error importing user mappings:', error);
    return NextResponse.json({
      error: 'Failed to process staff CSV upload.',
      details: error.message
    }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
