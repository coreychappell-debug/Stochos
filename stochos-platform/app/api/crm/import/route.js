import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

function safeParseDate(dateStr) {
  if (!dateStr) return null;
  const cleanStr = dateStr.toString().trim();
  if (!cleanStr) return null;
  
  // Check if matches YYYY-MM-DD
  const ymdMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (ymdMatch) {
    const [_, y, m, d] = ymdMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), 12, 0, 0);
  }
  
  // Check if matches MM/DD/YYYY or M/D/YY
  const mdyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (mdyMatch) {
    const [_, m, d, y] = mdyMatch;
    let fullYear = parseInt(y);
    if (y.length === 2) {
      fullYear = fullYear < 70 ? 2000 + fullYear : 1900 + fullYear;
    }
    return new Date(fullYear, parseInt(m) - 1, parseInt(d), 12, 0, 0);
  }
  
  // Fallback to native parser
  const parsed = new Date(cleanStr);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get("dryRun") === "true";
  const domain = searchParams.get("domain"); // 'retailer_master', 'user_territory', 'equipment_catalog', 'equipment_assignment'

  if (!domain) {
    return NextResponse.json({ error: "Domain parameter is required" }, { status: 400 });
  }

  try {
    const { rows, fileName } = await request.json();
    if (!rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid rows format" }, { status: 400 });
    }

    const errors = [];
    let createdCount = 0;
    let updatedCount = 0;

    // We will validate and compile changes
    const importResults = [];

    // Retrieve active jurisdiction (NY) to bind to items
    const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: "NY" } });
    if (!ny) {
      return NextResponse.json({ error: "Seed data missing: Jurisdiction NY not found." }, { status: 500 });
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const lineNum = i + 2; // header line plus 0-index offset

      try {
        if (domain === "retailer_master") {
          // Required fields
          if (!row.retailer_id || !row.retailer_name || !row.address_1 || !row.city || !row.postal_code) {
            errors.push(`Row ${lineNum}: Missing required fields (retailer_id, retailer_name, address_1, city, postal_code).`);
            continue;
          }

          // Validate status
          const status = row.status || "active";
          if (!["active", "inactive", "suspended"].includes(status)) {
            errors.push(`Row ${lineNum}: Invalid status value "${status}".`);
            continue;
          }

          // Validation of lat/lng format
          let lat = null;
          let lng = null;
          if (row.latitude) {
            lat = parseFloat(row.latitude);
            if (isNaN(lat)) {
              errors.push(`Row ${lineNum}: Invalid latitude value "${row.latitude}".`);
              continue;
            }
          }
          if (row.longitude) {
            lng = parseFloat(row.longitude);
            if (isNaN(lng)) {
              errors.push(`Row ${lineNum}: Invalid longitude value "${row.longitude}".`);
              continue;
            }
          }

          // Ingest
          importResults.push({
            type: "retailer",
            externalId: row.retailer_id.toString().trim(),
            data: {
              name: row.retailer_name.trim(),
              address: row.address_1.trim(),
              city: row.city.trim(),
              zipCode: row.postal_code.toString().trim(),
              phone: row.phone || null,
              status,
              applicationStatus: row.application_status || "approved",
              trainingStatus: row.training_status || "not_trained",
              visitCadence: row.visit_cadence || "weekly",
              latitude: lat,
              longitude: lng,
            }
          });
        } 
        
        else if (domain === "equipment_catalog") {
          if (!row.equipment_category || !row.equipment_subtype || !row.vendor || !row.model || !row.equipment_type_code) {
            errors.push(`Row ${lineNum}: Missing required fields (equipment_type_code, equipment_category, equipment_subtype, vendor, model).`);
            continue;
          }

          importResults.push({
            type: "catalog",
            code: row.equipment_type_code.toString().toUpperCase().trim(),
            data: {
              name: `${row.manufacturer || row.vendor} ${row.model}`,
              category: row.equipment_category.trim(),
              manufacturer: row.manufacturer || row.vendor,
              model: row.model.trim(),
              isRegulated: row.is_regulated === "true" || row.is_regulated === "1" || row.is_regulated === true,
            }
          });
        }

        else if (domain === "equipment_assignment") {
          if (!row.retailer_id || !row.equipment_category || !row.equipment_subtype || !row.model || !row.owner_type) {
            errors.push(`Row ${lineNum}: Missing required fields (retailer_id, equipment_category, equipment_subtype, model, owner_type).`);
            continue;
          }

          // If serialized, we require a serial number
          const category = row.equipment_category.trim();
          if (["terminal", "self_service_terminal", "vending_machine", "peripheral"].includes(category) && !row.serial_number) {
            errors.push(`Row ${lineNum}: Category "${category}" requires a unique serial_number.`);
            continue;
          }

          importResults.push({
            type: "assignment",
            retailerExternalId: row.retailer_id.toString().trim(),
            serialNumber: row.serial_number ? row.serial_number.toString().trim() : null,
            assetTag: row.asset_tag ? row.asset_tag.toString().trim() : null,
            equipmentCategory: category,
            equipmentSubtype: row.equipment_subtype.trim(),
            manufacturer: row.manufacturer || row.vendor || "Unknown",
            model: row.model.trim(),
            ownerType: row.owner_type.trim(),
            placementZone: row.placement_zone || "service_counter",
            sourceSystem: row.source_system || "manual_upload",
            sourceAssetKey: row.source_asset_key || null,
            integrationMode: row.integration_mode || "manual_upload",
            networkRequired: row.network_required === "true" || row.network_required === "1" || row.network_required === true,
            powerRequired: row.power_required === "true" || row.power_required === "1" || row.power_required === true,
            supportsCashless: row.supports_cashless === "true" || row.supports_cashless === "1" || row.supports_cashless === true,
            supportsTicketCheck: row.supports_ticket_check === "true" || row.supports_ticket_check === "1" || row.supports_ticket_check === true,
            supportsDrawGames: row.supports_draw_games === "true" || row.supports_draw_games === "1" || row.supports_draw_games === true,
            supportsInstantGames: row.supports_instant_games === "true" || row.supports_instant_games === "1" || row.supports_instant_games === true,
            installDate: safeParseDate(row.install_date),
          });
        }

        else if (domain === "action_item") {
          if (!row.retailer_id || !row.title || !row.description) {
            errors.push(`Row ${lineNum}: Missing required fields (retailer_id, title, description).`);
            continue;
          }

          let parsedDate = null;
          if (row.due_date) {
            parsedDate = safeParseDate(row.due_date);
            if (!parsedDate) {
              errors.push(`Row ${lineNum}: Invalid due_date format "${row.due_date}".`);
              continue;
            }
          }

          importResults.push({
            type: "action_item",
            retailerExternalId: row.retailer_id.toString().trim(),
            data: {
              title: row.title.trim(),
              description: row.description.trim(),
              dueDate: parsedDate,
              status: row.status || "open"
            }
          });
        }
      } catch (err) {
        errors.push(`Row ${lineNum}: Exception encountered - ${err.message}`);
      }
    }

    // Stop if there are validation errors before running push
    if (errors.length > 0) {
      return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
    }

    // If dry run, return success details without writing
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        validCount: importResults.length,
        message: `Validation successful. ${importResults.length} records ready for ingestion.`
      });
    }

    // Write transactionally to DB
    const batch = await prisma.$transaction(async (tx) => {
      const createdBatch = await tx.crmImportBatch.create({
        data: {
          domain,
          fileName: fileName || "manual_upload.csv",
          status: "success",
          importedById: session.user.id,
          rowCount: importResults.length,
          errorCount: 0,
        }
      });

      for (const res of importResults) {
        if (res.type === "retailer") {
          const existing = await tx.crmRetailer.findUnique({
            where: { externalId: res.externalId }
          });

          if (existing) {
            await tx.crmRetailer.update({
              where: { externalId: res.externalId },
              data: res.data
            });
            updatedCount++;
          } else {
            await tx.crmRetailer.create({
              data: {
                externalId: res.externalId,
                ...res.data
              }
            });
            createdCount++;
          }
        } 
        
        else if (res.type === "catalog") {
          const existing = await tx.crmEquipmentType.findUnique({
            where: { code: res.code }
          });

          if (existing) {
            await tx.crmEquipmentType.update({
              where: { code: res.code },
              data: res.data
            });
            updatedCount++;
          } else {
            await tx.crmEquipmentType.create({
              data: {
                code: res.code,
                ...res.data
              }
            });
            createdCount++;
          }
        }

        else if (res.type === "assignment") {
          // Find retailer by externalId
          const store = await tx.crmRetailer.findUnique({
            where: { externalId: res.retailerExternalId }
          });

          if (!store) {
            throw new Error(`Inconsistent data: Retailer with external ID "${res.retailerExternalId}" does not exist in master registry.`);
          }

          // Upsert Equipment Type Catalog entry
          const typeCode = `${res.manufacturer.toUpperCase().replace(/\s+/g, "-")}-${res.model.toUpperCase().replace(/\s+/g, "-")}`;
          let catalogType = await tx.crmEquipmentType.findUnique({
            where: { code: typeCode }
          });

          if (!catalogType) {
            catalogType = await tx.crmEquipmentType.create({
              data: {
                code: typeCode,
                name: `${res.manufacturer} ${res.model}`,
                category: res.equipmentCategory,
                manufacturer: res.manufacturer,
                model: res.model,
                isRegulated: res.equipmentCategory === "terminal" || res.equipmentCategory === "vending_machine",
              }
            });
          }

          // Upsert Physical Asset
          let asset = null;
          if (res.serialNumber) {
            asset = await tx.crmAsset.findUnique({
              where: { serialNumber: res.serialNumber }
            });
          }

          if (asset) {
            asset = await tx.crmAsset.update({
              where: { id: asset.id },
              data: {
                assetTag: res.assetTag || asset.assetTag,
                typeId: catalogType.id,
                ownerType: res.ownerType,
                networkRequired: res.networkRequired,
                powerRequired: res.powerRequired,
                supportsCashless: res.supportsCashless,
                supportsTicketCheck: res.supportsTicketCheck,
                supportsDrawGames: res.supportsDrawGames,
                supportsInstantGames: res.supportsInstantGames,
              }
            });
            updatedCount++;
          } else {
            asset = await tx.crmAsset.create({
              data: {
                serialNumber: res.serialNumber,
                assetTag: res.assetTag,
                typeId: catalogType.id,
                status: "active",
                ownerType: res.ownerType,
                networkRequired: res.networkRequired,
                powerRequired: res.powerRequired,
                supportsCashless: res.supportsCashless,
                supportsTicketCheck: res.supportsTicketCheck,
                supportsDrawGames: res.supportsDrawGames,
                supportsInstantGames: res.supportsInstantGames,
              }
            });
            createdCount++;
          }

          // Check if assignment exists
          const existingAsg = await tx.crmAssetAssignment.findFirst({
            where: {
              retailerId: store.id,
              assetId: asset.id
            }
          });

          if (existingAsg) {
            await tx.crmAssetAssignment.update({
              where: { id: existingAsg.id },
              data: {
                placementZone: res.placementZone,
                sourceSystem: res.sourceSystem,
                sourceAssetKey: res.sourceAssetKey || `UP-${asset.serialNumber || asset.id.slice(0,8)}`,
                integrationMode: res.integrationMode,
                batchId: createdBatch.id,
                installDate: res.installDate,
              }
            });
          } else {
            await tx.crmAssetAssignment.create({
              data: {
                retailerId: store.id,
                assetId: asset.id,
                placementZone: res.placementZone,
                sourceSystem: res.sourceSystem,
                sourceAssetKey: res.sourceAssetKey || `UP-${asset.serialNumber || asset.id.slice(0,8)}`,
                integrationMode: res.integrationMode,
                batchId: createdBatch.id,
                installDate: res.installDate,
              }
            });
          }
        }

        else if (res.type === "action_item") {
          const store = await tx.crmRetailer.findUnique({
            where: { externalId: res.retailerExternalId }
          });

          if (!store) {
            throw new Error(`Inconsistent data: Retailer with external ID "${res.retailerExternalId}" does not exist in master registry.`);
          }

          await tx.crmActionItem.create({
            data: {
              retailerId: store.id,
              title: res.data.title,
              description: res.data.description,
              dueDate: res.data.dueDate,
              status: res.data.status
            }
          });
          createdCount++;
        }
      }

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_import",
          entityId: createdBatch.id,
          action: "create",
          changes: { domain, createdCount, updatedCount, fileName }
        }
      });

      return createdBatch;
    });

    return NextResponse.json({
      success: true,
      batchId: batch.id,
      createdCount,
      updatedCount
    }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
