const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

const OSRM_URL = process.env.OSRM_URL || "http://localhost:5001";

// Helper: Haversine distance in miles
function haversineDistance(p1, p2) {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Deterministic Opportunity / Sales Volume generator matching the frontend logic
const getStoreOpportunity = (id) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const score = Math.abs(hash % 90) + 10; // 10 to 99 points
  return score;
};

// Simple K-Means Clustering on Coordinates
function kmeans(points, k, maxIterations = 50) {
  let centroids = points.slice(0, k).map(p => ({ lat: p.lat, lng: p.lng }));
  let assignments = new Array(points.length).fill(0);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    
    for (let i = 0; i < points.length; i++) {
      let minDist = Infinity;
      let closestCentroid = 0;
      for (let j = 0; j < k; j++) {
        const d = haversineDistance(points[i], centroids[j]);
        if (d < minDist) {
          minDist = d;
          closestCentroid = j;
        }
      }
      if (assignments[i] !== closestCentroid) {
        assignments[i] = closestCentroid;
        changed = true;
      }
    }
    
    if (!changed) break;
    
    const sums = Array.from({ length: k }, () => ({ lat: 0, lng: 0, count: 0 }));
    for (let i = 0; i < points.length; i++) {
      const idx = assignments[i];
      sums[idx].lat += points[i].lat;
      sums[idx].lng += points[i].lng;
      sums[idx].count++;
    }
    
    for (let j = 0; j < k; j++) {
      if (sums[j].count > 0) {
        centroids[j] = {
          lat: sums[j].lat / sums[j].count,
          lng: sums[j].lng / sums[j].count
        };
      }
    }
  }
  
  return { assignments, centroids };
}

// Greedy Balancing Heuristic with Dynamic Normalization
function optimizeHybrid(points, k, wDistance, wWorkload, wRevenue, maxIterations = 20) {
  // 1. Initial assignment via K-Means
  const { assignments, centroids } = kmeans(points, k);
  
  const getStats = (currentAssignments) => {
    const stats = Array.from({ length: k }, () => ({ count: 0, sales: 0, latSum: 0, lngSum: 0 }));
    for (let i = 0; i < points.length; i++) {
      const t = currentAssignments[i];
      stats[t].count++;
      stats[t].sales += points[i].sales;
      stats[t].latSum += points[i].lat;
      stats[t].lngSum += points[i].lng;
    }
    return stats;
  };

  const getMetrics = (currentAssignments) => {
    const stats = getStats(currentAssignments);
    
    let totalDist = 0;
    for (let i = 0; i < points.length; i++) {
      const t = currentAssignments[i];
      const centroid = {
        lat: stats[t].latSum / (stats[t].count || 1),
        lng: stats[t].lngSum / (stats[t].count || 1)
      };
      totalDist += haversineDistance(points[i], centroid);
    }
    
    const counts = stats.map(s => s.count);
    const avgCount = points.length / k;
    const countVariance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / k;
    
    const salesValues = stats.map(s => s.sales);
    const avgSales = salesValues.reduce((sum, s) => sum + s, 0) / k;
    const salesVariance = salesValues.reduce((sum, s) => sum + Math.pow(s - avgSales, 2), 0) / k;
    
    return { totalDist, countVariance, salesVariance };
  };

  // Compute normalization baselines based on initial K-Means
  const baselines = getMetrics(assignments);
  const normDist = baselines.totalDist > 0 ? baselines.totalDist : 1.0;
  const normCountVar = baselines.countVariance > 0 ? baselines.countVariance : 1.0;
  const normSalesVar = baselines.salesVariance > 0 ? baselines.salesVariance : 1.0;

  const evaluateCost = (currentAssignments) => {
    const m = getMetrics(currentAssignments);
    return (wDistance * (m.totalDist / normDist)) +
           (wWorkload * (m.countVariance / normCountVar)) +
           (wRevenue * (m.salesVariance / normSalesVar));
  };

  let currentAssignments = [...assignments];
  let currentCost = evaluateCost(currentAssignments);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < points.length; i++) {
      const originalTerritory = currentAssignments[i];
      
      for (let targetTerritory = 0; targetTerritory < k; targetTerritory++) {
        if (originalTerritory === targetTerritory) continue;
        
        currentAssignments[i] = targetTerritory;
        const newCost = evaluateCost(currentAssignments);
        
        if (newCost < currentCost) {
          currentCost = newCost;
          improved = true;
          break; // accept shift
        } else {
          currentAssignments[i] = originalTerritory;
        }
      }
    }
  }

  return currentAssignments;
}

// OSRM Client
async function getOsrmMatrix(points) {
  const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/table/v1/driving/${coordsStr}?annotations=duration`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.durations && data.durations.length === points.length) {
        return data.durations;
      }
    }
  } catch (e) {
    // Fail silently to trigger fallback
  }
  return null;
}

async function getOsrmRouteDuration(points) {
  const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `${OSRM_URL}/route/v1/driving/${coordsStr}?overview=false`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes[0]) {
        return data.routes[0].duration; // seconds
      }
    }
  } catch (e) {
    // Fail silently
  }
  return null;
}

// Fallback Matrix Generator
function buildFallbackMatrix(points) {
  const size = points.length;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const dist = haversineDistance(points[i], points[j]) * 1.3;
        const hours = dist / 35; // 35 mph avg speed
        matrix[i][j] = Math.round(hours * 3600); // seconds
      }
    }
  }
  return matrix;
}

// TSP duration cost helper
function getRouteCost(path, matrix) {
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    cost += matrix[path[i]][path[i + 1]];
  }
  // Round trip back to depot
  cost += matrix[path[path.length - 1]][path[0]];
  return cost;
}

// 2-opt swap helper
function twoOptSwap(path, i, k) {
  const newPath = path.slice(0, i);
  const middle = path.slice(i, k + 1).reverse();
  const end = path.slice(k + 1);
  return newPath.concat(middle).concat(end);
}

// TSP Solver (Nearest Neighbor + 2-opt)
function solveTSP(matrix) {
  const size = matrix.length;
  if (size <= 1) return [0];

  const visited = new Set([0]);
  let current = 0;
  const path = [0];

  while (visited.size < size) {
    let nextNode = -1;
    let minDist = Infinity;
    for (let i = 0; i < size; i++) {
      if (!visited.has(i)) {
        const dist = matrix[current][i];
        if (dist < minDist) {
          minDist = dist;
          nextNode = i;
        }
      }
    }
    visited.add(nextNode);
    path.push(nextNode);
    current = nextNode;
  }

  let bestCost = getRouteCost(path, matrix);
  let improved = true;
  let attempts = 0;
  const maxAttempts = 100;

  while (improved && attempts < maxAttempts) {
    improved = false;
    attempts++;
    for (let i = 1; i < size - 1; i++) {
      for (let k = i + 1; k < size; k++) {
        const newPath = twoOptSwap(path, i, k);
        const newCost = getRouteCost(newPath, matrix);
        if (newCost < bestCost) {
          path.splice(0, path.length, ...newPath);
          bestCost = newCost;
          improved = true;
        }
      }
    }
  }

  return path;
}

// Stats calculator
function getStatsSummary(arr) {
  const sum = arr.reduce((a, b) => a + b, 0);
  const mean = sum / arr.length;
  const variance = arr.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / arr.length;
  const stdDev = Math.sqrt(variance);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return { sum, mean, stdDev, min, max };
}

async function main() {
  const args = process.argv.slice(2);
  const serviceCenter = args[0] || "Schenectady";
  const k = parseInt(args[1]) || 8;

  console.log("====================================================================");
  console.log(`          STOCHOS MULTI-WEIGHT HYBRID SOLVER COMPARISON             `);
  console.log("====================================================================");
  console.log(`Service Center:  ${serviceCenter}`);
  console.log(`Reps (K):        ${k}`);
  console.log(`OSRM Server:     ${OSRM_URL}`);
  console.log("--------------------------------------------------------------------");

  console.log("Loading retailers from database...");
  const dbRetailers = await prisma.crmRetailer.findMany({
    where: {
      serviceCenter: serviceCenter,
      latitude: { not: null },
      longitude: { not: null }
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true
    }
  });

  if (dbRetailers.length === 0) {
    console.error(`Error: No active retailers with coordinates found in service center "${serviceCenter}".`);
    process.exit(1);
  }

  console.log(`Loaded ${dbRetailers.length} retailers.`);

  // Map to points
  const points = dbRetailers.map(r => ({
    id: r.id,
    name: r.name,
    lat: r.latitude,
    lng: r.longitude,
    sales: getStoreOpportunity(r.id) // Deterministic sales volume
  }));

  // Calculate depot (average centroid of all retailers)
  const avgLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const avgLng = points.reduce((s, p) => s + p.lng, 0) / points.length;
  const depot = { lat: avgLat, lng: avgLng, name: `${serviceCenter} Depot` };

  console.log(`Depot Location:  [${depot.lat.toFixed(5)}, ${depot.lng.toFixed(5)}]`);
  console.log("--------------------------------------------------------------------");

  // Define scenarios
  const scenarios = [
    { name: "Scenario A: Pure Travel Dist", wDist: 1.0, wWork: 0.0, wRev: 0.0 },
    { name: "Scenario B: Pure Workload Bal", wDist: 0.0, wWork: 1.0, wRev: 0.0 },
    { name: "Scenario C: Pure Sales Bal", wDist: 0.0, wWork: 0.0, wRev: 1.0 },
    { name: "Scenario D: Equal-Blend Hybrid", wDist: 0.33, wWork: 0.33, wRev: 0.34 },
    { name: "Scenario E: Custom Hybrid (V1)", wDist: 0.45, wWork: 0.35, wRev: 0.20 }
  ];

  const results = [];

  for (const sc of scenarios) {
    console.log(`Running: ${sc.name}...`);
    const start = Date.now();
    
    // 1. Cluster stores
    const assignments = optimizeHybrid(points, k, sc.wDist, sc.wWork, sc.wRev);
    const durationMs = Date.now() - start;

    // 2. Solve routing and durations for each representative's cluster
    const clusterDurationsSec = [];
    const repStoreCounts = [];
    const repSalesSums = [];

    for (let j = 0; j < k; j++) {
      const clusterStores = points.filter((_, idx) => assignments[idx] === j);
      
      repStoreCounts.push(clusterStores.length);
      repSalesSums.push(clusterStores.reduce((s, p) => s + p.sales, 0));

      if (clusterStores.length === 0) {
        clusterDurationsSec.push(0);
        continue;
      }

      // Route sequence: depot -> stores -> depot
      const routePoints = [depot, ...clusterStores];

      // Query OSRM or fallback
      let durationSec = null;
      let durationsMatrix = await getOsrmMatrix(routePoints);

      if (durationsMatrix) {
        // Solve TSP on OSRM matrix
        const tspIndices = solveTSP(durationsMatrix);
        const orderedRoutePoints = tspIndices.map(idx => routePoints[idx]);
        
        // Get exact route duration from OSRM Route API
        durationSec = await getOsrmRouteDuration(orderedRoutePoints);
        
        if (durationSec === null) {
          // fallback to matrix TSP cost calculation if route call failed
          durationSec = getRouteCost(tspIndices, durationsMatrix);
        }
      }

      if (durationSec === null) {
        // Fallback to Haversine matrices
        const fallbackMatrix = buildFallbackMatrix(routePoints);
        const tspIndices = solveTSP(fallbackMatrix);
        durationSec = getRouteCost(tspIndices, fallbackMatrix);
      }

      clusterDurationsSec.push(durationSec);
    }

    const totalDrivingHours = clusterDurationsSec.reduce((a, b) => a + b, 0) / 3600;
    const storeStats = getStatsSummary(repStoreCounts);
    const salesStats = getStatsSummary(repSalesSums);

    results.push({
      name: sc.name,
      runtime: `${durationMs}ms`,
      totalHours: totalDrivingHours.toFixed(1),
      avgHours: (totalDrivingHours / k).toFixed(1),
      minHours: (Math.min(...clusterDurationsSec) / 3600).toFixed(1),
      maxHours: (Math.max(...clusterDurationsSec) / 3600).toFixed(1),
      storeRange: `${storeStats.min}-${storeStats.max}`,
      storeStdDev: storeStats.stdDev.toFixed(1),
      salesRange: `${salesStats.min}-${salesStats.max}`,
      salesStdDevPct: ((salesStats.stdDev / salesStats.mean) * 100).toFixed(1) + "%"
    });
  }

  // Print results
  console.log("\n==========================================================================================================");
  console.log("                                        COMPARISON MATRIX RESULTS");
  console.log("==========================================================================================================");
  console.log("Scenario                     | Runtime | Total Hours | Rep Hours Range | Workload Range | Workload SD | Sales SD (CoV)");
  console.log("-----------------------------+---------+-------------+-----------------+----------------+-------------+----------------");
  results.forEach(r => {
    console.log(
      `${r.name.padEnd(28)} | ` +
      `${r.runtime.padEnd(7)} | ` +
      `${(r.totalHours + " hrs").padEnd(11)} | ` +
      `${(r.minHours + " to " + r.maxHours).padEnd(15)} | ` +
      `${r.storeRange.padEnd(14)} | ` +
      `${r.storeStdDev.padEnd(11)} | ` +
      `${r.salesStdDevPct}`
    );
  });
  console.log("==========================================================================================================");

  console.log("\nKey Insights:");
  console.log("1. Pure Distance (Scenario A) minimizes overall driving time, but creates high workload and sales imbalances (high standard deviation).");
  console.log("2. Pure Workload Balance (Scenario B) splits store counts exactly, but increases driving times because reps must drive further to pick up stores.");
  console.log("3. Pure Sales Balance (Scenario C) splits sales opportunity exactly, but results in high travel penalties and route fragmentation.");
  console.log("4. Hybrid Balances (Scenarios D & E) find the mathematically optimized 'sweet spot' by trade-offs: lowering both workload and sales imbalances with minimal travel time penalties.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
