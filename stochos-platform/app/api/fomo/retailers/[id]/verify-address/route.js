import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// Haversine formula to calculate distance in meters between coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000; // Radius of the Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const retailer = await prisma.crmRetailer.findUnique({
      where: { id }
    });

    if (!retailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    // Call US Census Bureau Geocoder API
    const street = retailer.address;
    const city = retailer.city;
    const state = "NY";
    const zip = retailer.zipCode;

    const geocodeUrl = `https://geocoding.geo.census.gov/geocoder/locations/address?street=${encodeURIComponent(street)}&city=${encodeURIComponent(city)}&state=${encodeURIComponent(state)}&zip=${encodeURIComponent(zip)}&benchmark=Public_AR_Current&format=json`;

    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error(`Census API returned status ${response.status}`);
    }

    const result = await response.json();
    const matches = result.result?.addressMatches || [];

    if (matches.length === 0) {
      return NextResponse.json({
        verified: false,
        bypassed: retailer.geodataBypassed,
        hostCorrectionRequested: retailer.geodataHostCorrectionRequested,
        message: "No address match found in geocoding database.",
        storedAddress: `${retailer.address}, ${retailer.city}, NY ${retailer.zipCode}`,
        storedCoords: { lat: retailer.latitude, lng: retailer.longitude }
      });
    }

    const bestMatch = matches[0];
    const matchCoords = {
      lat: bestMatch.coordinates.y,
      lng: bestMatch.coordinates.x
    };

    const storedCoords = {
      lat: retailer.latitude || 0,
      lng: retailer.longitude || 0
    };

    const distance = calculateDistance(storedCoords.lat, storedCoords.lng, matchCoords.lat, matchCoords.lng);
    const coordsMatch = distance < 150; // Match if within 150 meters

    return NextResponse.json({
      verified: true,
      coordsMatch,
      bypassed: retailer.geodataBypassed,
      hostCorrectionRequested: retailer.geodataHostCorrectionRequested,
      distanceMeters: distance,
      storedAddress: `${retailer.address}, ${retailer.city}, NY ${retailer.zipCode}`,
      storedCoords,
      verifiedAddress: bestMatch.matchedAddress,
      verifiedCoords: matchCoords,
      details: bestMatch.addressComponents
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const body = await request.json();
    const { action, address, latitude, longitude, status, distance } = body;

    const oldRetailer = await prisma.crmRetailer.findUnique({
      where: { id }
    });

    if (!oldRetailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    let updated;
    if (action === "bypass") {
      updated = await prisma.crmRetailer.update({
        where: { id },
        data: { 
          geodataBypassed: true,
          geodataHostCorrectionRequested: false
        }
      });

      // Log the bypass action
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_retailer",
          entityId: id,
          action: "update",
          changes: {
            reason: "Geodata verification bypassed/marked acceptable by supervisor",
            oldBypassed: oldRetailer.geodataBypassed,
            newBypassed: true,
            oldHostCorrectionRequested: oldRetailer.geodataHostCorrectionRequested,
            newHostCorrectionRequested: false
          }
        }
      });
    } else if (action === "flag-correction") {
      updated = await prisma.crmRetailer.update({
        where: { id },
        data: {
          geodataHostCorrectionRequested: true,
          geodataBypassed: false,
          geodataStandardAddress: address,
          geodataStandardLatitude: parseFloat(latitude),
          geodataStandardLongitude: parseFloat(longitude)
        }
      });

      // Log the change
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_retailer",
          entityId: id,
          action: "update",
          changes: {
            reason: "Flagged geodata mismatch for gaming host system update",
            standardAddress: address,
            standardCoords: { lat: latitude, lng: longitude },
            geodataBypassed: false,
            geodataHostCorrectionRequested: true
          }
        }
      });
    } else if (action === "save-audit-result") {
      updated = await prisma.crmRetailer.update({
        where: { id },
        data: {
          geodataStatus: status,
          geodataDistance: distance !== undefined && distance !== null ? parseFloat(distance) : null,
          geodataLastChecked: new Date()
        }
      });
    } else {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, updated });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
