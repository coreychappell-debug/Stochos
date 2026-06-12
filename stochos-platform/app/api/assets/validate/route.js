import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Job concurrency control lock
  const lockKey = "assets-validation";
  const lockResult = await acquireLock(
    lockKey,
    session.user.id || 'system',
    session.user.name || 'System',
    "Validate Assets CSV",
    30
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A validation or import job is currently running on the server: ${lockResult.activeLock.description}.` },
      { status: 429 }
    );
  }

  try {
    const records = await request.json();
    
    // Resource & Size Limiting (Max ~20,000 records)
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid payload format. Expected a non-empty array." }, { status: 400 });
    }
    if (records.length > 20000) {
      return NextResponse.json({ error: "File size limit exceeded. Maximum 20,000 records allowed." }, { status: 400 });
    }

    // Cache active jurisdictions
    const jurisdictions = await prisma.jurisdiction.findMany({ select: { id: true, abbreviation: true } });
    const jurMap = {};
    jurisdictions.forEach((j) => {
      jurMap[j.abbreviation.toUpperCase()] = j.id;
    });

    // Cache active users
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const userMap = {};
    users.forEach((u) => {
      userMap[u.email.toLowerCase()] = u.id;
    });

    // Cache active Org Units for office allocation
    const orgUnits = await prisma.orgUnit.findMany({ select: { id: true, code: true } });
    const orgUnitMap = {};
    orgUnits.forEach((ou) => {
      orgUnitMap[ou.code.toUpperCase()] = ou.id;
    });

    const validCategories = ["computer", "mobile", "scanner", "peripheral", "furniture", "other"];
    const validStatuses = ["available", "assigned", "repair", "retired"];
    const validDeploymentTypes = ["retail", "office"];

    const seenTags = new Set();
    const evaluatedRows = [];
    let overallValid = true;

    records.forEach((record, index) => {
      const rowNum = index + 2; // 1-based index plus header row
      const errors = {};

      const assetTag = String(record["Asset Tag"] || record.assetTag || "").trim();
      const name = String(record.Name || record.name || "").trim();
      const category = String(record.Category || record.category || "").trim().toLowerCase();
      const valueRaw = record.Value || record.value;
      const employeeEmail = String(record["Assigned Employee Email"] || record.assignedEmployeeEmail || "").trim();
      const jurAbbr = String(record.Jurisdiction || "").trim();
      const status = String(record.Status || record.status || "available").toLowerCase().trim();
      const purchaseDate = record["Purchase Date"] || record.purchaseDate;
      const disposalDate = record["Disposal Date"] || record.disposalDate;
      const salePrice = record["Sale Price"] || record.salePrice;
      const usefulLifeMonths = record["Useful Life Months"] || record.usefulLifeMonths;
      const deploymentType = String(record["Deployment Type"] || record.deploymentType || "retail").toLowerCase().trim();
      const retailerId = String(record["Retailer ID"] || record.retailerId || "").trim();
      const orgUnitCode = String(record["Org Unit"] || record.orgUnit || "").trim();

      // Required fields checks
      if (!assetTag) {
        errors.assetTag = "Asset Tag is required.";
      } else {
        if (seenTags.has(assetTag.toUpperCase())) {
          errors.assetTag = `Duplicate Asset Tag '${assetTag}' inside this CSV.`;
        }
        seenTags.add(assetTag.toUpperCase());
      }

      if (!name) {
        errors.name = "Name is required.";
      }

      if (!category) {
        errors.category = "Category is required.";
      } else if (!validCategories.includes(category)) {
        errors.category = `Must be one of: ${validCategories.join(", ")}`;
      }

      if (valueRaw !== undefined && valueRaw !== "" && isNaN(parseFloat(valueRaw))) {
        errors.value = "Must be a valid number.";
      }

      if (employeeEmail && !userMap[employeeEmail.toLowerCase()]) {
        errors.assignedEmployeeEmail = "Employee email not found in Stochos system.";
      }

      if (jurAbbr && !jurMap[jurAbbr.toUpperCase()]) {
        errors.jurisdiction = "Jurisdiction abbreviation not found.";
      }

      if (!validStatuses.includes(status)) {
        errors.status = `Must be: ${validStatuses.join(", ")}`;
      }

      if (purchaseDate && isNaN(Date.parse(purchaseDate))) {
        errors.purchaseDate = "Invalid date format.";
      }

      if (disposalDate && isNaN(Date.parse(disposalDate))) {
        errors.disposalDate = "Invalid date format.";
      }

      if (salePrice !== undefined && salePrice !== "" && isNaN(parseFloat(salePrice))) {
        errors.salePrice = "Must be a valid price.";
      }

      if (usefulLifeMonths !== undefined && usefulLifeMonths !== "" && isNaN(parseInt(usefulLifeMonths))) {
        errors.usefulLifeMonths = "Must be an integer.";
      }

      // Deployment Type & relational exclusive locks
      if (!validDeploymentTypes.includes(deploymentType)) {
        errors.deploymentType = "Must be: retail or office.";
      }

      if (deploymentType === "office" && retailerId) {
        errors.retailerId = "Office assets cannot be linked to a store Retailer ID.";
      }

      if (deploymentType === "retail" && orgUnitCode) {
        errors.orgUnit = "Retail assets cannot be linked to a corporate Org Unit.";
      }

      if (orgUnitCode && !orgUnitMap[orgUnitCode.toUpperCase()]) {
        errors.orgUnit = `Org Unit code '${orgUnitCode}' does not exist.`;
      }

      const hasErrors = Object.keys(errors).length > 0;
      if (hasErrors) {
        overallValid = false;
      }

      evaluatedRows.push({
        index: index,
        rowNumber: rowNum,
        data: {
          assetTag,
          name,
          category,
          value: valueRaw || "",
          assignedEmployeeEmail: employeeEmail,
          jurisdiction: jurAbbr,
          status,
          purchaseDate: purchaseDate || "",
          disposalDate: disposalDate || "",
          salePrice: salePrice || "",
          usefulLifeMonths: usefulLifeMonths || "",
          deploymentType,
          retailerId,
          orgUnit: orgUnitCode,
          serialNumber: record["Serial Number"] || record.serialNumber || "",
          notes: record.Notes || record.notes || "",
          disposalMethod: record["Disposal Method"] || record.disposalMethod || ""
        },
        errors,
        isValid: !hasErrors
      });
    });

    return NextResponse.json({
      success: true,
      valid: overallValid,
      rows: evaluatedRows
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
