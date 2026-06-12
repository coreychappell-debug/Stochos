import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lockKey = "fleet-import";
  const lockResult = await acquireLock(
    lockKey,
    session.user.id || 'system',
    session.user.name || 'System',
    "Import Fleet CSV",
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
    const requiredHeaders = ["License Plate", "Make", "Model", "Year", "VIN"];
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

    // Cache users by email
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const userMap = {};
    users.forEach((u) => {
      userMap[u.email.toLowerCase()] = u.id;
    });

    const defaultJurId = jurisdictions[0]?.id;

    // Validation Loop
    const errors = [];
    const seenVins = new Set();
    const validStatuses = ["active", "maintenance", "retired"];

    records.forEach((record, index) => {
      const rowNum = index + 2; // 1-based, plus header row
      const vin = String(record.VIN || record.vin || "").trim();
      const licensePlate = String(record["License Plate"] || record.licensePlate || "").trim();
      const make = String(record.Make || record.make || "").trim();
      const model = String(record.Model || record.model || "").trim();
      const yearRaw = record.Year || record.year;
      const mileageRaw = record.Mileage || record.mileage;

      if (!vin) errors.push(`Row ${rowNum}: 'VIN' is required.`);
      if (!licensePlate) errors.push(`Row ${rowNum}: 'License Plate' is required.`);
      if (!make) errors.push(`Row ${rowNum}: 'Make' is required.`);
      if (!model) errors.push(`Row ${rowNum}: 'Model' is required.`);

      if (vin) {
        if (seenVins.has(vin.toUpperCase())) {
          errors.push(`Row ${rowNum}: Duplicate VIN '${vin}' found in this CSV file.`);
        }
        seenVins.add(vin.toUpperCase());
      }

      if (yearRaw !== undefined && isNaN(parseInt(yearRaw))) {
        errors.push(`Row ${rowNum}: 'Year' must be a valid number.`);
      }
      if (mileageRaw !== undefined && mileageRaw !== "" && isNaN(parseInt(mileageRaw))) {
        errors.push(`Row ${rowNum}: 'Mileage' must be a valid number.`);
      }

      // Check driver email
      const driverEmail = String(record["Assigned Driver Email"] || record.assignedDriverEmail || "").trim();
      if (driverEmail && !userMap[driverEmail.toLowerCase()]) {
        errors.push(`Row ${rowNum}: Assigned driver email '${driverEmail}' does not exist in the system.`);
      }

      // Check jurisdiction
      const jur = String(record.Jurisdiction || "").trim();
      if (jur && !jurMap[jur.toUpperCase()]) {
        errors.push(`Row ${rowNum}: Jurisdiction abbreviation '${jur}' does not exist in the system.`);
      }

      // Check status
      const status = String(record.Status || record.status || "active").toLowerCase().trim();
      if (!validStatuses.includes(status)) {
        errors.push(`Row ${rowNum}: Status '${record.Status}' is invalid. Must be one of: ${validStatuses.join(", ")}`);
      }

      // Check dates
      const lastService = record["Last Service"] || record.lastService;
      if (lastService && isNaN(Date.parse(lastService))) {
        errors.push(`Row ${rowNum}: 'Last Service' has an invalid date format.`);
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
      const usefulLifeMiles = record["Useful Life Miles"] || record.usefulLifeMiles;
      if (usefulLifeMiles !== undefined && usefulLifeMiles !== "" && isNaN(parseInt(usefulLifeMiles))) {
        errors.push(`Row ${rowNum}: 'Useful Life Miles' must be an integer.`);
      }
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation Failed", details: errors }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const record of records) {
      const vin = String(record.VIN || record.vin || "").trim();
      const licensePlate = String(record["License Plate"] || record.licensePlate || "").trim();
      const make = String(record.Make || record.make || "").trim();
      const model = String(record.Model || record.model || "").trim();
      const year = parseInt(record.Year || record.year) || new Date().getFullYear();
      const mileage = parseInt(record.Mileage || record.mileage) || 0;
      const status = (record.Status || record.status || "active").toLowerCase();
      const notes = record.Notes || record.notes || null;
      
      const lastServiceStr = record["Last Service"] || record.lastService;
      const lastService = lastServiceStr ? new Date(lastServiceStr) : null;

      const disposalDateStr = record["Disposal Date"] || record.disposalDate;
      const disposalDate = disposalDateStr ? new Date(disposalDateStr) : null;
      const disposalMethod = record["Disposal Method"] || record.disposalMethod || null;
      const salePrice = record["Sale Price"] || record.salePrice ? parseFloat(record["Sale Price"] || record.salePrice) : null;
      const usefulLifeMonths = record["Useful Life Months"] || record.usefulLifeMonths ? parseInt(record["Useful Life Months"] || record.usefulLifeMonths) : 120;
      const usefulLifeMiles = record["Useful Life Miles"] || record.usefulLifeMiles ? parseInt(record["Useful Life Miles"] || record.usefulLifeMiles) : 100000;

      const driverEmail = String(record["Assigned Driver Email"] || record.assignedDriverEmail || "").trim().toLowerCase();
      const assignedToId = userMap[driverEmail] || null;

      const jurAbbr = String(record.Jurisdiction || "").trim().toUpperCase();
      const jurisdictionId = jurMap[jurAbbr] || defaultJurId;

      const existing = await prisma.vehicle.findUnique({ where: { vin } });

      if (existing) {
        await prisma.vehicle.update({
          where: { id: existing.id },
          data: {
            licensePlate,
            make,
            model,
            year,
            mileage,
            status,
            notes,
            lastService,
            assignedToId,
            jurisdictionId,
            disposalDate,
            disposalMethod,
            salePrice,
            usefulLifeMonths,
            usefulLifeMiles,
          },
        });
        updatedCount++;
      } else {
        await prisma.vehicle.create({
          data: {
            vin,
            licensePlate,
            make,
            model,
            year,
            mileage,
            status,
            notes,
            lastService,
            assignedToId,
            jurisdictionId,
            disposalDate,
            disposalMethod,
            salePrice,
            usefulLifeMonths,
            usefulLifeMiles,
          },
        });
        createdCount++;
      }
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vehicle",
        entityId: "all",
        action: "import_fleet",
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
