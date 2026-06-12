import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Helper: Calculate distance in meters between two coordinates
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // in meters
}

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get("latitude");
  const lonStr = searchParams.get("longitude");

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: "latitude and longitude are required parameters" }, { status: 400 });
  }

  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  try {
    // 1. Fetch active retailers within a bounding box (approx 1km / ~0.01 deg lat/lon) to avoid scanning the entire database
    const latOffset = 0.01;
    const lonOffset = 0.015;

    const candidateRetailers = await prisma.crmRetailer.findMany({
      where: {
        status: "active",
        latitude: {
          gte: lat - latOffset,
          lte: lat + latOffset,
        },
        longitude: {
          gte: lon - lonOffset,
          lte: lon + lonOffset,
        },
      },
      select: {
        id: true,
        externalId: true,
        name: true,
        address: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });

    // 2. Calculate exact distances and filter to 500 meters
    const nearby = candidateRetailers
      .map((r) => {
        const distance = getDistanceMeters(lat, lon, r.latitude, r.longitude);
        return { ...r, distance: Math.round(distance) };
      })
      .filter((r) => r.distance <= 500)
      .sort((a, b) => a.distance - b.distance);

    return NextResponse.json(nearby);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
