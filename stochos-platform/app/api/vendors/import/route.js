import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const records = await request.json();
    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json({ error: "Invalid payload format. Expected a non-empty array." }, { status: 400 });
    }

    // Verify required header columns
    const first = records[0];
    if (first.Name === undefined) {
      return NextResponse.json({ error: "Missing required column 'Name'. Please use the template." }, { status: 400 });
    }

    // Cache jurisdictions for quick lookup by abbreviation
    const jurisdictions = await prisma.jurisdiction.findMany({ select: { id: true, abbreviation: true } });
    const jurMap = {};
    jurisdictions.forEach((j) => {
      jurMap[j.abbreviation.toUpperCase()] = j.id;
    });

    // Validation Loop
    const errors = [];
    const seenNames = new Set();
    const validTypes = ["lead_agency", "media_buyer", "printer", "specialty", "research"];

    records.forEach((record, index) => {
      const rowNum = index + 2; // 1-based, plus header row
      if (!record.Name || !String(record.Name).trim()) {
        errors.push(`Row ${rowNum}: 'Name' is required.`);
        return;
      }
      const name = String(record.Name).trim();
      const normName = name.toLowerCase();

      // Check for duplicates within the CSV file
      if (seenNames.has(normName)) {
        errors.push(`Row ${rowNum}: Duplicate vendor name '${name}' found in this file.`);
      }
      seenNames.add(normName);

      // Validate Type if provided
      if (record.Type) {
        const type = String(record.Type).trim().toLowerCase().replace(/ /g, "_");
        if (!validTypes.includes(type)) {
          errors.push(`Row ${rowNum}: Invalid Type '${record.Type}'. Must be one of: ${validTypes.join(", ")}`);
        }
      }

      // Validate Jurisdiction
      if (record.Jurisdiction) {
        const jurAbbr = String(record.Jurisdiction).trim().toUpperCase();
        if (!jurMap[jurAbbr]) {
          errors.push(`Row ${rowNum}: Jurisdiction abbreviation '${record.Jurisdiction}' not found in system.`);
        }
      }
    });

    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation Failed", details: errors }, { status: 400 });
    }

    let createdCount = 0;
    let updatedCount = 0;

    for (const record of records) {
      if (!record.Name) continue;

      const name = String(record.Name).trim();
      const type = (record.Type || "specialty").toLowerCase().replace(/ /g, "_");
      const jurAbbr = String(record.Jurisdiction || "").trim().toUpperCase();
      const jurisdictionId = jurMap[jurAbbr] || null;
      const status = (record.Status || "active").toLowerCase();
      const taxId = record["Tax ID"] || record.taxId || null;
      const website = record.Website || record.website || null;
      const paymentTerms = record["Payment Terms"] || record.paymentTerms || null;
      const classification = (record.Classification || record.classification || "").toLowerCase() || null;
      const contactName = record["Contact Name"] || record.contactName || null;
      const contactEmail = record["Contact Email"] || record.contactEmail || null;
      const contactPhone = record["Contact Phone"] || record.contactPhone || null;
      const address = record.Address || record.address || null;
      const notes = record.Notes || record.notes || null;

      // Find if exists by name
      const existing = await prisma.vendor.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (existing) {
        await prisma.vendor.update({
          where: { id: existing.id },
          data: {
            type,
            jurisdictionId,
            status,
            taxId,
            website,
            paymentTerms,
            classification,
            contactName,
            contactEmail,
            contactPhone,
            address,
            notes,
          },
        });
        updatedCount++;
      } else {
        await prisma.vendor.create({
          data: {
            name,
            type,
            jurisdictionId,
            status,
            taxId,
            website,
            paymentTerms,
            classification,
            contactName,
            contactEmail,
            contactPhone,
            address,
            notes,
          },
        });
        createdCount++;
      }
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vendor",
        entityId: "all",
        action: "import_vendors",
        changes: { createdCount, updatedCount },
      },
    });

    return NextResponse.json({ success: true, createdCount, updatedCount });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
