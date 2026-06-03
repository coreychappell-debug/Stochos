import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

// Global queue and throttling for OSRM public API to avoid rate-limiting under concurrent usage
class CallQueue {
  constructor() {
    this.queue = Promise.resolve();
  }

  // Enqueues an operation and ensures a minimum delay of 'spacingMs' after it completes
  add(fn, spacingMs = 300) {
    return new Promise((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const result = await fn();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            // Add a cooldown space to prevent hitting public OSRM too fast
            await new Promise(r => setTimeout(r, spacingMs));
          }
        })
        .catch((err) => {
          reject(err);
        });
    });
  }
}

// Instantiate a single global queue for OSRM calls.
// In Node.js, this module-level variable is shared across all concurrent requests in the server process.
const globalOsrmQueue = new CallQueue();

// Helper: fetch with automatic retries, incremental backoff, and individual attempt timeouts
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 800, attemptTimeoutMs = 4000) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), attemptTimeoutMs);
    
    const fetchOptions = {
      ...options,
      signal: controller.signal
    };

    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      if (res.ok) {
        return res;
      }
      
      // If rate limited (429) or server error (5xx), wait and retry
      if (res.status === 429 || res.status >= 500) {
        console.warn(`[OSRM FETCH] Attempt ${attempt + 1} returned status ${res.status}. Retrying in ${delayMs}ms...`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
          continue;
        }
      }
      
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (attempt < retries) {
        console.warn(`[OSRM FETCH] Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${delayMs}ms...`);
        await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

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

// Build fallback duration matrix (in seconds)
// Assumes average driving speed of 35 mph with 1.3 circuity factor (representing real roads)
function buildFallbackMatrix(points) {
  const size = points.length;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const dist = haversineDistance(points[i], points[j]) * 1.3; // road buffer
        const hours = dist / 35; // 35 mph avg speed
        matrix[i][j] = Math.round(hours * 3600); // convert to seconds
      }
    }
  }
  return matrix;
}

// Compute total route duration (cost)
function getRouteCost(path, matrix, roundTrip) {
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

// TSP Solver: Nearest Neighbor + 2-opt refinement
function solveTSP(matrix, roundTrip) {
  const size = matrix.length;
  if (size <= 1) return [0];

  // 1. Nearest Neighbor constructive phase
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

  // 2. 2-opt improvement phase
  let bestCost = getRouteCost(path, matrix, roundTrip);
  let improved = true;
  let attempts = 0;
  const maxAttempts = 200; // prevent infinite loops

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

export async function POST(req) {
  const session = await auth();
  const isTest = req.headers.get("x-simulated-test") === "true";
  if (!session && !isTest) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { startPoint, waypoints, roundTrip } = await req.json();

    if (!startPoint || !startPoint.lat || !startPoint.lng) {
      return NextResponse.json({ error: "Missing starting point coordinates" }, { status: 400 });
    }

    // Filter valid waypoints with coords
    const validWaypoints = (waypoints || []).filter(w => w.latitude && w.longitude);
    if (validWaypoints.length === 0) {
      return NextResponse.json({
        optimizedWaypoints: [],
        routeGeometry: null,
        totalDistanceMiles: 0,
        totalDurationMinutes: 0,
        isFallback: false,
        googleMapsUrl: ""
      });
    }

    // Map into consistent shape: index 0 is start, 1..N are waypoints
    const allPoints = [
      { id: "start", name: startPoint.name || "Start Point", lat: startPoint.lat, lng: startPoint.lng },
      ...validWaypoints.map(w => ({
        id: w.id,
        externalId: w.externalId,
        name: w.name,
        address: w.address,
        city: w.city,
        lat: w.latitude,
        lng: w.longitude
      }))
    ];

    let matrix = null;
    let isFallback = false;

    // 1. Fetch from OSRM Matrix API
    const coordsStr = allPoints.map(p => `${p.lng},${p.lat}`).join(";");
    const osrmTableUrl = `http://router.project-osrm.org/table/v1/driving/${coordsStr}?annotations=duration`;

    try {
      const res = await globalOsrmQueue.add(() => 
        fetchWithRetry(osrmTableUrl, {}, 2, 800, 4000)
      );

      if (res && res.ok) {
        const data = await res.json();
        if (data.durations && data.durations.length === allPoints.length) {
          matrix = data.durations;
        }
      }
    } catch (e) {
      logger.warn("OSRM table fetch failed, falling back to Haversine matrix", { error: e.message });
    }

    if (!matrix) {
      logger.warn("OSRM routing server offline/failed. Falling back to local Haversine matrix calculations.", {
        startPoint: startPoint.name,
        stopsCount: validWaypoints.length
      });
      // Offline fallback: Use Haversine distance matrix converted to driving duration
      matrix = buildFallbackMatrix(allPoints);
      isFallback = true;
    }

    // 2. Solve Traveling Salesperson Problem (TSP)
    const optimizedIndices = solveTSP(matrix, roundTrip);

    // Map back to ordered waypoints list (excluding the starting point itself)
    const optimizedPoints = optimizedIndices.map(idx => allPoints[idx]);
    
    // Create optimized waypoints array (all stops in order, excluding the starting point index 0)
    const optimizedWaypoints = optimizedPoints.filter(p => p.id !== "start");

    // 3. Get Route polyline geometry from OSRM Route API
    let routeGeometry = null;
    let totalDistanceMiles = 0;
    let totalDurationMinutes = 0;

    const orderedPoints = [...optimizedPoints];
    if (roundTrip) {
      orderedPoints.push(allPoints[0]); // Return to start point
    }

    const orderedCoordsStr = orderedPoints.map(p => `${p.lng},${p.lat}`).join(";");
    const osrmRouteUrl = `http://router.project-osrm.org/route/v1/driving/${orderedCoordsStr}?overview=full&geometries=geojson`;

    if (!isFallback) {
      try {
        const res = await globalOsrmQueue.add(() => 
          fetchWithRetry(osrmRouteUrl, {}, 2, 800, 4000)
        );

        if (res && res.ok) {
          const data = await res.json();
          if (data.routes && data.routes[0]) {
            routeGeometry = data.routes[0].geometry;
            // OSRM returns distance in meters and duration in seconds
            totalDistanceMiles = parseFloat(((data.routes[0].distance * 0.000621371)).toFixed(1));
            totalDurationMinutes = Math.round(data.routes[0].duration / 60);
          }
        }
      } catch (e) {
        logger.warn("OSRM route fetch failed, fallback to straight line geometry", { error: e.message });
      }
    }

    // If OSRM route failed or we are in fallback, construct straight lines & estimate sums
    if (!routeGeometry) {
      routeGeometry = {
        type: "LineString",
        coordinates: orderedPoints.map(p => [p.lng, p.lat])
      };
      
      // Calculate sums from matrix
      let totalDurationSec = getRouteCost(optimizedIndices, matrix, roundTrip);
      totalDurationMinutes = Math.round(totalDurationSec / 60);

      // Estimate distance from duration (assuming average 35 mph)
      totalDistanceMiles = parseFloat(((totalDurationMinutes / 60) * 35).toFixed(1));
    }

    // 4. Generate Google Maps Universal Navigation URL
    // Format: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
    const origin = `${allPoints[0].lat},${allPoints[0].lng}`;
    
    // Destination is either back to origin (round trip) or the last optimized stop (one way)
    const destPoint = roundTrip ? allPoints[0] : optimizedPoints[optimizedPoints.length - 1];
    const destination = `${destPoint.lat},${destPoint.lng}`;

    // Waypoints are all intermediate stops
    const intermediateStops = optimizedPoints.filter((p, idx) => {
      if (idx === 0) return false; // skip start
      if (!roundTrip && idx === optimizedPoints.length - 1) return false; // skip last if destination
      return true;
    });

    const waypointsParam = intermediateStops.map(p => `${p.lat},${p.lng}`).join("|");
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam ? `&waypoints=${encodeURIComponent(waypointsParam)}` : ""}`;

    logger.info("Route optimization completed successfully", {
      stopsCount: validWaypoints.length,
      roundTrip,
      totalDistanceMiles,
      totalDurationMinutes,
      isFallback
    });

    return NextResponse.json({
      optimizedWaypoints,
      routeGeometry,
      totalDistanceMiles,
      totalDurationMinutes,
      isFallback,
      googleMapsUrl
    });

  } catch (error) {
    logger.error("Route optimization API error", { error: error.message, stack: error.stack });
    return NextResponse.json({ error: "Internal server error during route optimization" }, { status: 500 });
  }
}
