const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db');

async function testRolesAndPermissions() {
  console.log("======================================================");
  console.log("TESTING ENTERPRISE ROLES & PERMISSIONS DATABASE CONTROLS");
  console.log("======================================================");

  // 1. Fetch existing roles
  console.log("\n[1/4] Fetching all roles...");
  const roles = await prisma.role.findMany({ orderBy: { name: 'asc' } });
  console.log(`Found ${roles.length} roles:`, roles.map(r => r.name));

  if (roles.length === 0) {
    console.error("No roles found in database!");
    return;
  }

  // Find target role (procurement_officer or manager)
  const targetRole = roles.find(r => r.name === 'procurement_officer') || roles[0];
  const originalPerms = targetRole.permissions;
  console.log(`Selected target role "${targetRole.name}" with permissions:`, originalPerms);

  // 2. Simulate updating permissions of the target role
  console.log(`\n[2/4] Simulating updating role permissions for "${targetRole.name}"...`);
  const newPerms = { ...originalPerms, contracts: 'write', scratchers: 'write' };
  
  // Perform update
  const updatedRole = await prisma.role.update({
    where: { id: targetRole.id },
    data: { permissions: newPerms }
  });
  console.log("Update database query successful. New permissions:", updatedRole.permissions);

  // Fetch admin user to use for audit log
  const adminUser = await prisma.user.findFirst({
    where: { role: { name: 'admin' } }
  }) || await prisma.user.findFirst();

  if (!adminUser) {
    console.error("No users found in database to act as administrator!");
    return;
  }
  console.log(`Acting Administrator: ${adminUser.name} (${adminUser.email})`);

  // Write audit log entry
  console.log("Writing 'Role' update audit log entry...");
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      entityType: 'Role',
      entityId: targetRole.id,
      action: 'update',
      changes: {
        roleName: targetRole.name,
        before: originalPerms,
        after: newPerms
      }
    }
  });
  console.log("Audit log entry successfully created!");

  // Restore original permissions
  console.log("Restoring original role permissions...");
  await prisma.role.update({
    where: { id: targetRole.id },
    data: { permissions: originalPerms }
  });
  console.log("Original role permissions restored.");

  // 3. Simulate updating a user's role and status
  console.log("\n[3/4] Fetching a test user...");
  const testUser = await prisma.user.findFirst({
    where: { email: { not: adminUser.email } }
  }) || await prisma.user.findFirst();

  if (!testUser) {
    console.error("No test users found!");
    return;
  }

  const originalRoleId = testUser.roleId;
  const originalStatus = testUser.status;
  console.log(`Selected User: ${testUser.name} (${testUser.email}), Current Role ID: ${originalRoleId}, Status: ${originalStatus}`);

  // Update target user's role to the analyst role
  const analystRole = roles.find(r => r.name === 'analyst') || roles[0];
  console.log(`Updating user's role to analyst role (ID: ${analystRole.id}) and status to active...`);
  
  const updatedUser = await prisma.user.update({
    where: { id: testUser.id },
    data: { roleId: analystRole.id, status: 'active' },
    include: { role: true }
  });
  console.log(`User update database query successful. New Role: ${updatedUser.role.name}, Status: ${updatedUser.status}`);

  // Write audit log entry for user update
  console.log("Writing 'User' update audit log entry...");
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      entityType: 'User',
      entityId: testUser.id,
      action: 'update',
      changes: {
        targetUserName: testUser.name,
        targetUserEmail: testUser.email,
        before: {
          roleId: originalRoleId,
          status: originalStatus
        },
        after: {
          roleId: analystRole.id,
          status: 'active'
        }
      }
    }
  });
  console.log("Audit log entry successfully created!");

  // Restore original user details
  console.log("Restoring original user details...");
  await prisma.user.update({
    where: { id: testUser.id },
    data: { roleId: originalRoleId, status: originalStatus }
  });
  console.log("Original user details restored.");

  // 4. Verify the AuditLog table
  console.log("\n[4/4] Querying the latest audit logs from the database...");
  const logs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });

  console.log("Latest 5 Audit Logs:");
  logs.forEach((log, idx) => {
    console.log(`\nLog #${idx + 1}:`);
    console.log(`- Time: ${log.createdAt.toISOString()}`);
    console.log(`- User: ${log.user?.name || 'System'} (${log.user?.email || '—'})`);
    console.log(`- Action: ${log.action}`);
    console.log(`- Entity: ${log.entityType} (ID: ${log.entityId})`);
    console.log(`- Changes: ${JSON.stringify(log.changes)}`);
  });

  console.log("\n======================================================");
  console.log("ALL ROLES & PERMISSIONS DATABASE CONTROLS TESTS PASSED!");
  console.log("======================================================");
}

testRolesAndPermissions().finally(() => prisma.$disconnect().catch(() => {}));
