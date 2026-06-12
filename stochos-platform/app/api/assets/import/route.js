import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lockKey = "assets-import";
  const lockResult = await acquireLock(
    lockKey,
    session.user.id || 'system',
    session.user.name || 'System',
    "Import Assets CSV",
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid payload format. Expected a non-empty array." }, { status: 400 });
    }

    // Verify required header columns
    const first = records[0];
    const requiredHeaders = ["Asset Tag", "Name", "Category"];
    const missingHeaders = requiredHeaders.filter(h => first[h] === undefined && first[h.toLowerCase()] === undefined);
    if (missingHeaders.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missingHeaders.join(", ")}. Please use the template.` }, { status: 400 });
    }

    // Cache jurisdictions
    const jurisdictions = await prisma.jurisdiction.findMany({ select: { id: true, abbreviation: true } });
    const jurMap = {};
    jurisdictions.forEach((j) => {
      jurMap[j.abbreviation.toUpperCase()] = j.id;
    });

    // Cache users
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const userMap = {};
    users.forEach((u) => {
      userMap[u.email.toLowerCase()] = u.id;
    });

    // Cache org units
    const orgUnits = await prisma.orgUnit.findMany({ select: { id: true, code: true } });
    const orgUnitMap = {};
    orgUnits.forEach((ou) => {
      orgUnitMap[ou.code.toUpperCase()] = ou.id;
    });

    const defaultJurId = jurisdictions[0]?.id;

    // Validation Loop
    const errors = [];
    const seenTags = new Set();
    const validCategories = ["computer", "mobile", "scanner", "peripheral", "furniture", "other"];
    const validStatuses = ["available", "assigned", "repair", "retired"];

    records.forEach((record, index) => {
      const rowNum = index + 2; // 1-based, plus header row
      const assetTag = String(record["Asset Tag"] || record.assetTag || "").trim();
      const name = String(record.Name || record.name || "").trim();
      const category = String(record.Category || record.category || "").trim().toLowerCase();
      const valueRaw = record.Value || record.value;

      if (!assetTag) errors.push(`Row ${rowNum}: 'Asset Tag' is required.`);
      if (!name) errors.push(`Row ${rowNum}: 'Name' is required.`);
      if (!category) errors.push(`Row ${rowNum}: 'Category' is required.`);

      if (assetTag) {
        if (seenTags.has(assetTag.toUpperCase())) {
          errors.push(`Row ${rowNum}: Duplicate Asset Tag '${assetTag}' found in this CSV file.`);
        }
        seenTags.add(assetTag.toUpperCase());
      }

      if (category && !validCategories.includes(category)) {
        errors.push(`Row ${rowNum}: Invalid Category '${record.Category}'. Must be one of: ${validCategories.join(", ")}`);
      }

      if (valueRaw !== undefined && valueRaw !== "" && isNaN(parseFloat(valueRaw))) {
        errors.push(`Row ${rowNum}: 'Value' must be a valid number.`);
      }

      // Check employee email
      const employeeEmail = String(record["Assigned Employee Email"] || record.assignedEmployeeEmail || "").trim();
      if (employeeEmail && !userMap[employeeEmail.toLowerCase()]) {
        errors.push(`Row ${rowNum}: Assigned employee email '${employeeEmail}' does not exist in the system.`);
      }

      // Check jurisdiction
      const jur = String(record.Jurisdiction || "").trim();
      if (jur && !jurMap[jur.toUpperCase()]) {
        errors.push(`Row ${rowNum}: Jurisdiction abbreviation '${jur}' does not exist in the system.`);
      }

      // Check status
      const status = String(record.Status || record.status || "available").toLowerCase().trim();
      if (!validStatuses.includes(status)) {
        errors.push(`Row ${rowNum}: Status '${record.Status}' is invalid. Must be one of: ${validStatuses.join(", ")}`);
      }

      // Check dates
      const purchaseDate = record["Purchase Date"] || record.purchaseDate;
      if (purchaseDate && isNaN(Date.parse(purchaseDate))) {
        errors.push(`Row ${rowNum}: 'Purchase Date' has an invalid date format.`);
      }
      const disposalDate = record["Disposal Date"] || record.disposalDate;
      if (disposalDate && isNaN(Date.parse(disposalDate))) {
        errors.push(`Row ${rowNum}: 'Disposal Date' has an invalid date format.`);
      }

      // Check values
      const salePrice = record["Sale Price"] || record.salePrice;
      if (salePrice !== undefined && salePrice !== "" && isNaN(parseFloat(salePrice))) {
        errors.push(`Row ${rowNum}: 'Sale Price' must be a valid numeric amount.`);
      }
      const usefulLifeMonths = record["Useful Life Months"] || record.usefulLifeMonths;
      if (usefulLifeMonths !== undefined && usefulLifeMonths !== "" && isNaN(parseInt(usefulLifeMonths))) {
        errors.push(`Row ${rowNum}: 'Useful Life Months' must be an integer.`);
      }

      // Check deployment type and relational exclusivity
      const deploymentType = String(record["Deployment Type"] || record.deploymentType || "retail").toLowerCase().trim();
      const retailerId = record["Retailer ID"] || record.retailerId || null;
      const orgUnitCode = String(record["Org Unit"] || record.orgUnit || "").trim();

      if (deploymentType && !["retail", "office"].includes(deploymentType)) {
        errors.push(`Row ${rowNum}: Deployment Type '${record["Deployment Type"]}' is invalid. Must be retail or office.`);
      }
      if (deploymentType === "office" && retailerId) {
        errors.push(`Row ${rowNum}: Office assets cannot be assigned to a store Retailer ID.`);
      }
      if (deploymentType === "retail" && orgUnitCode) {
        errors.push(`Row ${rowNum}: Retail field assets cannot be assigned to a corporate Org Unit.`);
      }
      if (orgUnitCode && !orgUnitMap[orgUnitCode.toUpperCase()]) {
        errors.push(`Row ${rowNum}: Org Unit code '${orgUnitCode}' does not exist.`);
      }
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation Failed", details: errors }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        const assetTag = String(record["Asset Tag"] || record.assetTag || "").trim();
        const name = String(record.Name || record.name || "").trim();
        const category = (record.Category || record.category || "other").toLowerCase();
        const serialNumber = record["Serial Number"] || record.serialNumber || null;
        const value = record.Value || record.value ? parseFloat(record.Value || record.value) : null;
        const status = (record.Status || record.status || "available").toLowerCase();
        const notes = record.Notes || record.notes || null;

        const purchaseDateStr = record["Purchase Date"] || record.purchaseDate;
        const purchaseDate = purchaseDateStr ? new Date(purchaseDateStr) : null;

        const disposalDateStr = record["Disposal Date"] || record.disposalDate;
        const disposalDate = disposalDateStr ? new Date(disposalDateStr) : null;
        const disposalMethod = record["Disposal Method"] || record.disposalMethod || null;
        const salePrice = record["Sale Price"] || record.salePrice ? parseFloat(record["Sale Price"] || record.salePrice) : null;
        const usefulLifeMonths = record["Useful Life Months"] || record.usefulLifeMonths ? parseInt(record["Useful Life Months"] || record.usefulLifeMonths) : 36;

        const employeeEmail = String(record["Assigned Employee Email"] || record.assignedEmployeeEmail || "").trim().toLowerCase();
        const assignedToId = userMap[employeeEmail] || null;

        const jurAbbr = String(record.Jurisdiction || "").trim().toUpperCase();
        const jurisdictionId = jurMap[jurAbbr] || defaultJurId;

        // Resolve new columns
        const deploymentType = String(record["Deployment Type"] || record.deploymentType || "retail").toLowerCase().trim();
        const retailerId = record["Retailer ID"] || record.retailerId || null;
        const orgUnitCode = String(record["Org Unit"] || record.orgUnit || "").trim().toUpperCase();
        const orgUnitId = orgUnitMap[orgUnitCode] || null;

        const actualRetailerId = deploymentType === "office" ? null : (retailerId || null);
        const actualOrgUnitId = deploymentType === "office" ? orgUnitId : null;

        const existing = await tx.asset.findUnique({ where: { assetTag } });

        if (existing) {
          await tx.asset.update({
            where: { id: existing.id },
            data: {
              name,
              category,
              serialNumber,
              value,
              status,
              purchaseDate,
              assignedToId,
              jurisdictionId,
              notes,
              disposalDate,
              disposalMethod,
              salePrice,
              usefulLifeMonths,
              deploymentType,
              retailerId: actualRetailerId,
              orgUnitId: actualOrgUnitId
            },
          });
          updatedCount++;
        } else {
          await tx.asset.create({
            data: {
              assetTag,
              name,
              category,
              serialNumber,
              value,
              status,
              purchaseDate,
              assignedToId,
              jurisdictionId,
              notes,
              disposalDate,
              disposalMethod,
              salePrice,
              usefulLifeMonths,
              deploymentType,
              retailerId: actualRetailerId,
              orgUnitId: actualOrgUnitId
            },
          });
          createdCount++;
        }
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
        entityId: "all",
        action: "import_assets",
        changes: { createdCount, updatedCount },
      },
    });

    return NextResponse.json({ success: true, createdCount, updatedCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
