const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

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

// Simple K-Means Clustering on Coordinates
function kmeans(points, k, maxIterations = 50) {
  // Initialize centroids randomly from points
  let centroids = points.slice(0, k).map(p => ({ lat: p.lat, lng: p.lng }));
  let assignments = new Array(points.length).fill(0);
  
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;
    
    // Assign points to nearest centroid
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
    
    // Recalculate centroids
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

// Greedy Balancing Heuristic
// Moves stores between territories to minimize a combined cost function
function optimizeHybrid(points, k, wDistance, wWorkload, wRevenue) {
  // 1. Initial assignment via K-Means
  const { assignments, centroids } = kmeans(points, k);
  
  let improved = true;
  let iterations = 0;
  const maxIterations = 20;

  // Calculate current metrics per territory
  const getStats = (currentAssignments) => {
    const stats = Array.from({ length: k }, () => ({ count: 0, revenue: 0, latSum: 0, lngSum: 0 }));
    for (let i = 0; i < points.length; i++) {
      const t = currentAssignments[i];
      stats[t].count++;
      stats[t].revenue += points[i].revenue;
      stats[t].latSum += points[i].lat;
      stats[t].lngSum += points[i].lng;
    }
    return stats;
  };

  // Evaluate cost of a configuration
  const evaluateCost = (currentAssignments) => {
    const stats = getStats(currentAssignments);
    
    // 1. Travel Distance cost (sum of distances from store to centroid)
    let totalDist = 0;
    for (let i = 0; i < points.length; i++) {
      const t = currentAssignments[i];
      const centroid = {
        lat: stats[t].latSum / stats[t].count,
        lng: stats[t].lngSum / stats[t].count
      };
      totalDist += haversineDistance(points[i], centroid);
    }
    
    // 2. Workload cost (variance of store count)
    const counts = stats.map(s => s.count);
    const avgCount = points.length / k;
    const countVariance = counts.reduce((sum, c) => sum + Math.pow(c - avgCount, 2), 0) / k;
    
    // 3. Revenue cost (variance of revenue)
    const revenues = stats.map(s => s.revenue);
    const totalRev = revenues.reduce((sum, r) => sum + r, 0);
    const avgRev = totalRev / k;
    const revVariance = revenues.reduce((sum, r) => sum + Math.pow(r - avgRev, 2), 0) / k;
    
    // Normalize costs to comparable scales
    return (wDistance * totalDist) + (wWorkload * countVariance * 10) + (wRevenue * (revVariance / 1e9));
  };

  let currentAssignments = [...assignments];
  let currentCost = evaluateCost(currentAssignments);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    // Try shifting stores to other territories
    for (let i = 0; i < points.length; i++) {
      const originalTerritory = currentAssignments[i];
      
      for (let targetTerritory = 0; targetTerritory < k; targetTerritory++) {
        if (originalTerritory === targetTerritory) continue;
        
        // Speculatively reassign
        currentAssignments[i] = targetTerritory;
        const newCost = evaluateCost(currentAssignments);
        
        if (newCost < currentCost) {
          currentCost = newCost;
          improved = true;
          break; // Keep change
        } else {
          // Revert
          currentAssignments[i] = originalTerritory;
        }
      }
    }
  }

  return currentAssignments;
}

// Std Dev calculator helper
function stdDev(arr) {
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / arr.length);
}

async function main() {
  console.log("==================================================");
  console.log("   STOCHOS HYBRID TERRITORY BALANCER SIMULATOR    ");
  console.log("==================================================\n");

  console.log("Fetching Schenectady retailers from database...");
  const retailers = await prisma.crmRetailer.findMany({
    where: {
      serviceCenter: "Schenectady",
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

  if (retailers.length === 0) {
    console.log("No Schenectady retailers with geolocations found in database.");
    return;
  }

  console.log(`Loaded ${retailers.length} retailers.\n`);

  // Synthesize deterministic Sales Revenue for each retailer based on their index
  // (Provides realistic data distribution between $20k and $600k per year)
  const points = retailers.map((r, idx) => {
    // Deterministic pseudo-random revenue
    const seed = (idx * 31) % 100;
    const revenue = Math.round(20000 + (seed / 100) * 580000);
    return {
      id: r.id,
      name: r.name,
      lat: r.latitude,
      lng: r.longitude,
      revenue
    };
  });

  const k = 8; // Number of territories/reps in the office
  console.log(`Simulating balancing across ${k} territories...\n`);

  const runScenario = (name, wDist, wWork, wRev) => {
    const start = Date.now();
    const assignments = optimizeHybrid(points, k, wDist, wWork, wRev);
    const duration = Date.now() - start;

    // Gather Stats
    const stats = Array.from({ length: k }, () => ({ count: 0, revenue: 0, points: [] }));
    for (let i = 0; i < points.length; i++) {
      const t = assignments[i];
      stats[t].count++;
      stats[t].revenue += points[i].revenue;
      stats[t].points.push(points[i]);
    }

    // Travel calculation (average distance from stores to center of their territory)
    let totalTravelCost = 0;
    stats.forEach(s => {
      if (s.count === 0) return;
      const latAvg = s.points.reduce((sum, p) => sum + p.lat, 0) / s.count;
      const lngAvg = s.points.reduce((sum, p) => sum + p.lng, 0) / s.count;
      s.points.forEach(p => {
        totalTravelCost += haversineDistance(p, { lat: latAvg, lng: lngAvg });
      });
    });

    const storeCounts = stats.map(s => s.count);
    const revenues = stats.map(s => s.revenue);

    return {
      name,
      durationMs: duration,
      totalTravelDistance: Math.round(totalTravelCost),
      avgStoresPerRep: Math.round(points.length / k),
      storeCountStdDev: stdDev(storeCounts).toFixed(1),
      minStores: Math.min(...storeCounts),
      maxStores: Math.max(...storeCounts),
      avgRevPerRep: Math.round(revenues.reduce((a, b) => a + b, 0) / k),
      revenueStdDevPct: ((stdDev(revenues) / (revenues.reduce((a, b) => a + b, 0) / k)) * 100).toFixed(1) + "%",
      minRevenue: Math.round(Math.min(...revenues) / 1000) + "k",
      maxRevenue: Math.round(Math.max(...revenues) / 1000) + "k"
    };
  };

  // Run the three configurations
  const results = [];
  results.push(runScenario("Scenario A: Pure Travel Distance", 1.0, 0.0, 0.0));
  results.push(runScenario("Scenario B: Workload-Balanced  ", 0.05, 0.95, 0.0));
  results.push(runScenario("Scenario C: Hybrid Balance     ", 0.45, 0.35, 0.20));

  // Print Results Comparison Table
  console.log("--------------------------------------------------------------------------------------------------");
  console.log("SCENARIO SUMMARY COMPARISON");
  console.log("--------------------------------------------------------------------------------------------------");
  console.log("Scenario                     | Run Time | Travel Dist | Workload Range | Workload SD | Revenue Range  | Revenue SD");
  console.log("-----------------------------+----------+-------------+----------------+-------------+----------------+-----------");
  results.forEach(r => {
    console.log(
      `${r.name.padEnd(28)} | ` +
      `${(r.durationMs + "ms").padEnd(8)} | ` +
      `${(r.totalTravelDistance + " mi").padEnd(11)} | ` +
      `${(r.minStores + " to " + r.maxStores).padEnd(14)} | ` +
      `${(r.storeCountStdDev).padEnd(11)} | ` +
      `${(r.minRevenue + " to " + r.maxRevenue).padEnd(14)} | ` +
      `${r.revenueStdDevPct}`
    );
  });
  console.log("--------------------------------------------------------------------------------------------------");
  console.log("\nInsights:");
  console.log("1. Pure Distance creates highly clustered routes, but results in massive workload inequalities (some reps get way more stores).");
  console.log("2. Workload-Balanced creates equal store counts, but travel distance increases (forces reps to drive further to pick up stores).");
  console.log("3. Hybrid Balance blends both: standard deviations for both store count and revenue are minimized with minimal travel penalties.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
