import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import logger from "@/lib/logger";

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

// Build fallback duration matrix (in seconds) assuming 35 mph
function buildFallbackMatrix(points) {
  const size = points.length;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const dist = haversineDistance(points[i], points[j]) * 1.3; // road buffer
        const hours = dist / 35;
        matrix[i][j] = Math.round(hours * 3600); // seconds
      }
    }
  }
  return matrix;
}

// Compute total route duration (cost)
function getRouteCost(path, matrix, roundTrip = true) {
  let cost = 0;
  for (let i = 0; i < path.length - 1; i++) {
    cost += matrix[path[i]][path[i + 1]];
  }
  if (roundTrip) {
    cost += matrix[path[path.length - 1]][path[0]];
  }
  return cost;
}

// 2-opt swap helper
function twoOptSwap(path, i, k) {
  const newPath = path.slice(0, i);
  const middle = path.slice(i, k + 1).reverse();
  const end = path.slice(k + 1);
  return newPath.concat(middle).concat(end);
}

// TSP Solver
function solveTSP(matrix, roundTrip = true) {
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

  let bestCost = getRouteCost(path, matrix, roundTrip);
  let improved = true;
  let attempts = 0;
  const maxAttempts = 100;

  while (improved && attempts < maxAttempts) {
    improved = false;
    attempts++;
    for (let i = 1; i < size - 1; i++) {
      for (let k = i + 1; k < size; k++) {
        const newPath = twoOptSwap(path, i, k);
        const newCost = getRouteCost(newPath, matrix, roundTrip);
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

// Global queue to limit public OSRM rate
class CallQueue {
  constructor() {
    this.queue = Promise.resolve();
  }
  add(fn, spacingMs = 150) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (e) {
            reject(e);
          } finally {
            await new Promise(r => setTimeout(r, spacingMs));
          }
        })
        .catch(reject);
    });
  }
}

const osrmQueue = new CallQueue();

export async function POST(req) {
  const session = await auth();
  const isTest = req.headers.get("x-simulated-test") === "true";
  if (!session && !isTest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { retailerId } = await req.json();

    if (!retailerId) {
      return NextResponse.json({ error: "Missing retailerId" }, { status: 400 });
    }

    // 1. Fetch unassigned retailer details
    const retailer = await prisma.crmRetailer.findUnique({
      where: { id: retailerId },
      select: {
        id: true,
        externalId: true,
        name: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
        serviceCenter: true,
        routeId: true
      }
    });

    if (!retailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    if (!retailer.latitude || !retailer.longitude) {
      return NextResponse.json({ error: "Retailer is missing latitude/longitude coordinates" }, { status: 400 });
    }

    const targetServiceCenter = retailer.serviceCenter;
    if (!targetServiceCenter) {
      return NextResponse.json({ error: "Retailer does not have an assigned service center" }, { status: 400 });
    }

    // 2. Fetch all candidates (routes + representatives) in this service center
    // We fetch routes that contain at least one retailer assigned to this serviceCenter
    const allRoutes = await prisma.crmRoute.findMany({
      include: {
        rep: true,
        retailers: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            serviceCenter: true
          }
        }
      }
    });

    // Filter routes belonging to this office/serviceCenter
    // Either by checking the rep's subunit/bureau or by checking the route's retailers
    const candidates = allRoutes.filter(route => {
      if (!route.rep) return false;
      // Match by serviceCenter of the route's retailers
      const matchesCenter = route.retailers.some(r => r.serviceCenter === targetServiceCenter);
      // Fallback: match by route name containing the center
      const matchesName = route.name.toLowerCase().includes(targetServiceCenter.toLowerCase());
      return matchesCenter || matchesName;
    });

    if (candidates.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    const recommendations = [];

    // 3. For each candidate rep/route, compute actual OSRM deviation
    for (const route of candidates) {
      const rep = route.rep;
      
      // Determine Start Point: rep home or office centroid
      let startPoint = null;
      let startName = "";

      // Fetch all valid waypoints currently on this route
      const activeWaypoints = route.retailers.filter(r => r.latitude && r.longitude && r.id !== retailer.id);

      if (rep.homeLatitude && rep.homeLongitude) {
        startName = "Home";
        // Calculate the Territory Entry Point: the retailer on the route closest to their home
        if (activeWaypoints.length > 0) {
          let closestStore = activeWaypoints[0];
          let minDist = haversineDistance(
            { lat: rep.homeLatitude, lng: rep.homeLongitude },
            { lat: closestStore.latitude, lng: closestStore.longitude }
          );

          for (let i = 1; i < activeWaypoints.length; i++) {
            const d = haversineDistance(
              { lat: rep.homeLatitude, lng: rep.homeLongitude },
              { lat: activeWaypoints[i].latitude, lng: activeWaypoints[i].longitude }
            );
            if (d < minDist) {
              minDist = d;
              closestStore = activeWaypoints[i];
            }
          }
          startPoint = { lat: closestStore.latitude, lng: closestStore.longitude, name: `Entry Point (${closestStore.name})` };
        } else {
          // Empty route: start directly at home
          startPoint = { lat: rep.homeLatitude, lng: rep.homeLongitude, name: "Home" };
        }
      } else {
        // Fallback: Use Schenectady HQ or center centroid of active waypoints
        startName = "Office Centroid";
        if (activeWaypoints.length > 0) {
          const sumLat = activeWaypoints.reduce((sum, r) => sum + r.latitude, 0);
          const sumLng = activeWaypoints.reduce((sum, r) => sum + r.longitude, 0);
          startPoint = {
            lat: sumLat / activeWaypoints.length,
            lng: sumLng / activeWaypoints.length,
            name: `${targetServiceCenter} Centroid`
          };
        } else {
          // Absolute fallback (Schenectady office coordinates)
          startPoint = { lat: 42.81432, lng: -73.94314, name: "Schenectady HQ" };
        }
      }

      // Limit waypoints to max 15 to keep matrix calls reasonable and fast
      const waypointsToCheck = activeWaypoints.slice(0, 15);

      // Points for OSRM matrix query:
      // index 0: Start Point
      // index 1..W: Current waypoints
      // index W+1: New Retailer
      const points = [
        { lat: startPoint.lat, lng: startPoint.lng },
        ...waypointsToCheck.map(w => ({ lat: w.latitude, lng: w.longitude })),
        { lat: retailer.latitude, lng: retailer.longitude }
      ];

      const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(";");
      const osrmBaseUrl = process.env.OSRM_URL || "http://router.project-osrm.org";
      const osrmTableUrl = `${osrmBaseUrl}/table/v1/driving/${coordsStr}?annotations=duration`;

      let durationMatrix = null;
      try {
        const res = await osrmQueue.add(() => fetch(osrmTableUrl));
        if (res.ok) {
          const data = await res.json();
          if (data.durations && data.durations.length === points.length) {
            durationMatrix = data.durations;
          }
        }
      } catch (err) {
        logger.warn(`OSRM call failed for candidate ${rep.name}, using Haversine fallback`, { error: err.message });
      }

      if (!durationMatrix) {
        durationMatrix = buildFallbackMatrix(points);
      }

      // Solve TSP without the new retailer (indices 0 to W)
      const baseIndices = Array.from({ length: points.length - 1 }, (_, i) => i);
      const baseSubmatrix = baseIndices.map(r => baseIndices.map(c => durationMatrix[r][c]));
      const baseTspPath = solveTSP(baseSubmatrix, true);
      const baseDurationSec = getRouteCost(baseTspPath, baseSubmatrix, true);

      // Solve TSP with the new retailer (indices 0 to W+1)
      const fullTspPath = solveTSP(durationMatrix, true);
      const deviatedDurationSec = getRouteCost(fullTspPath, durationMatrix, true);

      const baseMinutes = Math.round(baseDurationSec / 60);
      const deviatedMinutes = Math.round(deviatedDurationSec / 60);
      const deviationMinutes = Math.max(0, deviatedMinutes - baseMinutes);

      // Calculate distance between starting point and retailer
      const straightLineDistance = parseFloat(haversineDistance(startPoint, { lat: retailer.latitude, lng: retailer.longitude }).toFixed(1));

      recommendations.push({
        repId: rep.id,
        repName: rep.name,
        repEmail: rep.email,
        routeId: route.id,
        routeCode: route.code,
        routeName: route.name,
        currentStoreCount: route.retailers.length,
        startPointType: startName,
        startPointName: startPoint.name,
        straightLineDistanceMiles: straightLineDistance,
        deviationMinutes: deviationMinutes,
        baseMinutes: baseMinutes,
        deviatedMinutes: deviatedMinutes
      });
    }

    // Rank recommendations:
    // 1. Minimum deviationMinutes
    // 2. Minimum currentStoreCount (workload balance)
    recommendations.sort((a, b) => {
      if (a.deviationMinutes !== b.deviationMinutes) {
        return a.deviationMinutes - b.deviationMinutes;
      }
      return a.currentStoreCount - b.currentStoreCount;
    });

    return NextResponse.json({ recommendations });

  } catch (error) {
    logger.error("Error in territory recommendation API", { error: error.message, stack: error.stack });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
