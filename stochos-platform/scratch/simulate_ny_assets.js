// simulate_ny_assets.js
// Generates a vendor-accurate, wave-rollout, and lifecycle-compliant lottery asset database for New York.

require('dotenv').config();
const { prisma } = require('../lib/db.js');
const crypto = require('crypto');

// Haversine random jitter helper for GPS coordinates (to simulate office audit offsets)
function addGpsJitter(lat, lon, maxMeters = 15) {
  if (lat === null || lon === null) return { lat: null, lon: null };
  const r = maxMeters / 111300; // convert meters to degrees approx
  const y0 = lat;
  const x0 = lon;
  const u = Math.random();
  const v = Math.random();
  const w = r * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  return {
    lat: parseFloat((y0 + y).toFixed(6)),
    lon: parseFloat((x0 + x).toFixed(6))
  };
}

// Box-Muller transform for normal distribution
function randomNormal(mean, stdDev) {
  let u = 0, v = 0;
  while(u === 0) u = Math.random();
  while(v === 0) v = Math.random();
  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return num * stdDev + mean;
}

const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;
const WAVE_MEANS = {
  1: new Date("2016-04-15").getTime(),
  2: new Date("2021-09-15").getTime(),
  3: new Date("2024-11-15").getTime(),
};
const WAVE_STDDEVS = {
  1: 3 * ONE_MONTH,
  2: 4 * ONE_MONTH,
  3: 2 * ONE_MONTH,
};

function getWaveDate(wave) {
  const mean = WAVE_MEANS[wave];
  const stdDev = WAVE_STDDEVS[wave];
  return new Date(randomNormal(mean, stdDev));
}

// Replacement chain logic
function getPurchaseDate(type, storeWave) {
  if (storeWave === 3) {
    return getWaveDate(3);
  }
  if (storeWave === 2) {
    if (type === "terminal" || type === "sign") {
      return getWaveDate(2);
    } else { // monitor (3-year life) replaced in wave 3
      return getWaveDate(3);
    }
  }
  if (storeWave === 1) {
    if (type === "terminal") {
      return getWaveDate(1);
    } else { // sign (7-year) and monitor (3-year) replaced in wave 3
      return getWaveDate(3);
    }
  }
  return getWaveDate(3);
}

const CATALOG = {
  clerk_old: { name: "IGT Altura GT1200", category: "computer", value: 4500, usefulLife: 120, type: "terminal", code: "ALT" },
  clerk_new: { name: "IGT Retailer Pro S2", category: "computer", value: 5200, usefulLife: 120, type: "terminal", code: "PRO" },
  vending_old: { name: "IGT GameTouch 20", category: "computer", value: 12500, usefulLife: 120, type: "terminal", code: "GT20" },
  vending_new: { name: "IGT GameTouch 28", category: "computer", value: 14500, usefulLife: 120, type: "terminal", code: "GT28" },
  
  clerk_monitor: { name: 'IGT Clerk Touchscreen 15"', category: "peripheral", value: 450, usefulLife: 36, type: "monitor", code: "MON" },
  customer_display: { name: 'IGT Customer Display 19"', category: "peripheral", value: 650, usefulLife: 36, type: "monitor", code: "DISP" },
  
  jackpot_sign: { name: "Carmanah LED Jackpot Sign", category: "other", value: 1200, usefulLife: 84, type: "sign", code: "MKT" },
  play_slip_reader: { name: "Stochos Digital Play Slip Reader", category: "scanner", value: 800, usefulLife: 84, type: "sign", code: "MKT" }
};

async function runSimulation() {
  try {
    console.log("Starting NY Lottery asset simulation database sync...");

    // 1. Fetch active NY retailers, users, and org units
    const [retailers, users, orgUnits] = await Promise.all([
      prisma.crmRetailer.findMany({
        where: { status: "active" },
        select: { id: true, latitude: true, longitude: true }
      }),
      prisma.user.findMany({
        where: { status: "active" },
        select: { id: true, name: true, email: true, division: true }
      }),
      prisma.orgUnit.findMany()
    ]);

    if (retailers.length === 0) {
      console.error("Error: No active retailers found in the database. Run crm import/seeding first.");
      return;
    }

    console.log(`Found ${retailers.length} active retailers, ${users.length} active users, and ${orgUnits.length} org units in DB.`);

    // 2. Truncate previous assets & logs
    console.log("Truncating existing assets, logs, and upload batches...");
    await prisma.assetAuditLog.deleteMany();
    await prisma.assetAuditBatch.deleteMany();
    await prisma.asset.deleteMany();
    console.log("Truncation complete.");

    const assetsToCreate = [];
    let assetCounter = 1;

    // Helper to generate unique serial numbers
    const genSerial = (prefix, num) => {
      const padded = String(num).padStart(8, '0');
      return `IGT-${prefix}-${padded}`;
    };

    // Helper to generate unique tags
    const genTag = (code, num) => {
      const padded = String(num).padStart(5, '0');
      return `AST-NY-${code}-${padded}`;
    };

    console.log("Generating hardware rollout mappings...");

    retailers.forEach((r, rIdx) => {
      // Deterministic tier based on index mapping
      let tier = 2; // Default 60%
      const tierPct = rIdx % 100;
      if (tierPct < 15) {
        tier = 1; // 15% High-Volume
      } else if (tierPct >= 75) {
        tier = 3; // 25% Small/Draw-Only
      }

      // Deterministic store wave
      // Wave 1: 35%, Wave 2: 35%, Wave 3: 30%
      const wavePct = (rIdx * 7) % 100;
      let storeWave = 3;
      if (wavePct < 35) {
        storeWave = 1;
      } else if (wavePct < 70) {
        storeWave = 2;
      }

      const storeAssets = [];

      if (tier === 1) {
        // TIER 1: High-Volume (6 items)
        // Clerk Terminal (Altura GT1200 or Retailer Pro S2)
        const isOldTerminal = storeWave < 3;
        const termDef = isOldTerminal ? CATALOG.clerk_old : CATALOG.clerk_new;
        storeAssets.push({ spec: termDef, wave: storeWave });

        // Vending Machine (GameTouch 28 if wave 2, GameTouch 20 if wave 3, none if wave 1 store initially but got a 20 in Wave 2)
        const vendingDef = (storeWave === 2) ? CATALOG.vending_new : CATALOG.vending_old;
        // If Wave 1, they got a vending machine in Wave 2 refresh
        const vendingWave = (storeWave === 1) ? 2 : storeWave;
        storeAssets.push({ spec: vendingDef, wave: vendingWave });

        // 15" Clerk Touchscreen (Always Wave 3 replaced)
        storeAssets.push({ spec: CATALOG.clerk_monitor, wave: 3 });

        // 19" Customer Display (Wave 2 or 3)
        const displayWave = (storeWave === 1) ? 2 : storeWave;
        storeAssets.push({ spec: CATALOG.customer_display, wave: displayWave === 2 ? 3 : 3 }); // replaced in wave 3 either way

        // Jackpot Sign (Wave 2 or 3)
        const signWave = (storeWave === 1) ? 3 : storeWave;
        storeAssets.push({ spec: CATALOG.jackpot_sign, wave: signWave });

        // Play slip reader
        const psWave = (storeWave === 1) ? 3 : storeWave;
        storeAssets.push({ spec: CATALOG.play_slip_reader, wave: psWave });

      } else if (tier === 2) {
        // TIER 2: Standard Convenience (3 items)
        const isOldTerminal = storeWave < 3;
        const termDef = isOldTerminal ? CATALOG.clerk_old : CATALOG.clerk_new;
        storeAssets.push({ spec: termDef, wave: storeWave });
        storeAssets.push({ spec: CATALOG.clerk_monitor, wave: 3 }); // monitor replaced
        
        const signWave = (storeWave === 1) ? 3 : storeWave;
        storeAssets.push({ spec: CATALOG.jackpot_sign, wave: signWave });

      } else {
        // TIER 3: Small Bars (2 items)
        // Typically older Altura GT1200 clerk terminals
        const termDef = (storeWave === 3) ? CATALOG.clerk_new : CATALOG.clerk_old;
        storeAssets.push({ spec: termDef, wave: storeWave });
        storeAssets.push({ spec: CATALOG.clerk_monitor, wave: 3 });
      }

      // Map physical assets to catalog definitions and generate timestamps
      storeAssets.forEach(item => {
        const { spec, wave } = item;
        const purchaseDate = getPurchaseDate(spec.type, wave);
        
        // Mock audit status (audit completed in April-May 2026)
        // 85% chance this retailer has been audited recently, placing coordinates close to store lat/lon
        const hasBeenAudited = (rIdx % 10) < 8.5;
        let lastAuditedAt = null;
        let lastAuditLat = null;
        let lastAuditLon = null;

        if (hasBeenAudited) {
          // Audit date: between 30 and 60 days ago
          const daysAgo = Math.floor(Math.random() * 30) + 15;
          lastAuditedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
          
          const jitter = addGpsJitter(r.latitude, r.longitude, 12);
          lastAuditLat = jitter.lat;
          lastAuditLon = jitter.lon;
        }

        const assetId = crypto.randomUUID();
        const serial = genSerial(spec.code, assetCounter);
        const tag = genTag(spec.code, assetCounter);

        assetsToCreate.push({
          id: assetId,
          jurisdictionId: "NY-LOTTERY",
          assetTag: tag,
          name: spec.name,
          category: spec.category,
          serialNumber: serial,
          status: "assigned",
          value: spec.value,
          purchaseDate: purchaseDate,
          notes: `Simulated NY Lottery equipment rollout. Retailer Tier: ${tier}. Rollout Wave: ${wave}.`,
          usefulLifeMonths: spec.usefulLife,
          lastAuditedAt: lastAuditedAt,
          lastAuditLat: lastAuditLat,
          lastAuditLon: lastAuditLon,
          retailerId: r.id
        });

        assetCounter++;
      });
    });

    // Generate Office & Corporate Assets (~10% of total, approx 3,900 items)
    console.log("Generating Office & Corporate assets...");
    const OFFICE_CATALOG = [
      { name: "Dell Latitude 5440 Laptop", category: "computer", value: 1400, usefulLife: 36, code: "LAP" },
      { name: "MacBook Pro 16\"", category: "computer", value: 2500, usefulLife: 36, code: "MAC" },
      { name: "Dell 27\" Hub Display", category: "peripheral", value: 350, usefulLife: 36, code: "MON" },
      { name: "HP LaserJet Enterprise Printer", category: "peripheral", value: 950, usefulLife: 60, code: "PRN" },
      { name: "Herman Miller Aeron Chair", category: "furniture", value: 1200, usefulLife: 120, code: "CHR" },
      { name: "iPhone 15 Pro", category: "mobile", value: 1000, usefulLife: 24, code: "MOB" }
    ];

    const targetOfficeCount = Math.floor(retailers.length * 0.3); // around 3,900 office assets
    
    // Helper to pick main divisions (excluding root and field subunits if possible)
    const divisionOrgUnits = orgUnits.length > 0 
      ? orgUnits.filter(ou => ou.code.startsWith("1.1.") && ou.code.split('.').length <= 4)
      : [];
    
    const defaultOrgUnit = orgUnits[0] || null;

    for (let oIdx = 0; oIdx < targetOfficeCount; oIdx++) {
      // Pick random catalog item
      const spec = OFFICE_CATALOG[oIdx % OFFICE_CATALOG.length];
      
      // Pick random org unit
      const orgUnit = divisionOrgUnits.length > 0
        ? divisionOrgUnits[oIdx % divisionOrgUnits.length]
        : defaultOrgUnit;

      // Pick random user from users list
      const user = users.length > 0 ? users[oIdx % users.length] : null;

      // Random purchase date within the last 4 years
      const monthsAgo = Math.floor(Math.random() * 48) + 1;
      const purchaseDate = new Date();
      purchaseDate.setMonth(purchaseDate.getMonth() - monthsAgo);

      const assetId = crypto.randomUUID();
      const serial = `OFF-${spec.code}-${String(assetCounter).padStart(6, '0')}`;
      const tag = `AST-NY-OFF-${spec.code}-${String(assetCounter).padStart(5, '0')}`;
      
      // Mock audit: 90% chance it was audited recently (office audits do not require GPS tags)
      const hasBeenAudited = Math.random() < 0.9;
      let lastAuditedAt = null;
      if (hasBeenAudited) {
        lastAuditedAt = new Date(Date.now() - (Math.floor(Math.random() * 60) + 15) * 24 * 60 * 60 * 1000);
      }

      assetsToCreate.push({
        id: assetId,
        jurisdictionId: "NY-LOTTERY",
        assetTag: tag,
        name: spec.name,
        category: spec.category,
        serialNumber: serial,
        status: oIdx % 10 === 0 ? "repair" : (oIdx % 15 === 0 ? "retired" : "assigned"),
        value: spec.value,
        purchaseDate: purchaseDate,
        notes: `Simulated Corporate Office Equipment. Assigned to department: ${orgUnit?.name || 'NYSGC'}.`,
        usefulLifeMonths: spec.usefulLife,
        lastAuditedAt: lastAuditedAt,
        lastAuditLat: null,
        lastAuditLon: null,
        retailerId: null,
        deploymentType: "office",
        orgUnitId: orgUnit ? orgUnit.id : null,
        assignedToId: user ? user.id : null
      });

      assetCounter++;
    }

    console.log(`Generated ${assetsToCreate.length} assets total (${retailers.length * 3} retail, ${targetOfficeCount} office). Performing chunked batch database insertion...`);

    // Chunk size 5000 to prevent connection timeouts in local Postgres containers
    const CHUNK_SIZE = 5000;
    let insertedCount = 0;

    for (let i = 0; i < assetsToCreate.length; i += CHUNK_SIZE) {
      const chunk = assetsToCreate.slice(i, i + CHUNK_SIZE);
      await prisma.asset.createMany({
        data: chunk
      });
      insertedCount += chunk.length;
      console.log(`  - Inserted ${insertedCount} / ${assetsToCreate.length} assets.`);
    }

    console.log("=== SIMULATION COMPLETED ===");
    console.log(`Total Assets Created: ${insertedCount}`);

    // Quick queries to output stats for EOL / warnings
    const totalValue = assetsToCreate.reduce((sum, a) => sum + a.value, 0);
    console.log(`Total Asset Ledger Value: $${totalValue.toLocaleString()}`);

  } catch (err) {
    console.error("Simulation run failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runSimulation();
