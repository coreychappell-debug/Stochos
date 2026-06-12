import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow administrators or managers to edit representative addresses
  if (session.user.role === "sales_rep") {
    return NextResponse.json({ error: "Forbidden: sales representatives cannot edit PII addresses." }, { status: 403 });
  }

  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const body = await request.json();
    const { homeAddress } = body;

    // 1. If empty, clear the address (PII removal constraint)
    if (!homeAddress || homeAddress.trim() === "") {
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          homeAddress: null,
          homeLatitude: null,
          homeLongitude: null
        }
      });

      // Log the PII deletion
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          entityType: "crm_territory_balancing",
          entityId: id,
          action: "update",
          changes: {
            reason: "Representative home address/PII removed by manager",
            homeAddress: null,
            coords: null
          }
        }
      });

      return NextResponse.json({ success: true, user: updatedUser, message: "Representative home address cleared successfully." });
    }

    // 2. Perform geocoding using the US Census Bureau Geocoder API
    const geocodeUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(homeAddress.trim())}&benchmark=Public_AR_Current&format=json`;

    let lat = null;
    let lng = null;
    let matchedAddress = homeAddress;

    try {
      const res = await fetch(geocodeUrl);
      if (res.ok) {
        const result = await res.json();
        const matches = result.result?.addressMatches || [];
        if (matches.length > 0) {
          const bestMatch = matches[0];
          lat = parseFloat(bestMatch.coordinates.y);
          lng = parseFloat(bestMatch.coordinates.x);
          matchedAddress = bestMatch.matchedAddress;
        }
      }
    } catch (err) {
      console.error("Geocoding API error:", err);
      // Fail gracefully and use default if necessary, but we want to report geocode status
    }

    if (lat === null || lng === null) {
      return NextResponse.json({
        success: false,
        error: "Geocoding failed. Please check the spelling or format of the address (e.g. '50 State St, Albany, NY 12207') and try again."
      }, { status: 400 });
    }

    // 3. Update the database
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        homeAddress: matchedAddress,
        homeLatitude: lat,
        homeLongitude: lng
      }
    });

    // Log the change
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "crm_territory_balancing",
        entityId: id,
        action: "update",
        changes: {
          reason: "Representative home address updated/geocoded by manager",
          homeAddress: matchedAddress,
          coords: { lat, lng }
        }
      }
    });

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `Address successfully verified and geocoded to (${lat}, ${lng}).`
    });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
