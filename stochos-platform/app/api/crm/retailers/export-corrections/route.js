import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const escapeCsv = (str) => {
  if (str === null || str === undefined) return "";
  const stringified = str.toString();
  if (stringified.includes(",") || stringified.includes('"') || stringified.includes("\n") || stringified.includes("\r")) {
    return `"${stringified.replace(/"/g, '""')}"`;
  }
  return stringified;
};

export async function GET(request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  try {
    const retailers = await prisma.crmRetailer.findMany({
      where: {
        geodataHostCorrectionRequested: true
      },
      orderBy: { name: "asc" }
    });

    const headers = [
      "retailer_id", 
      "retailer_name", 
      "gaming_system_address", 
      "standardized_address_usps", 
      "gaming_system_latitude", 
      "gaming_system_longitude", 
      "standardized_latitude_usps", 
      "standardized_longitude_usps",
      "distance_difference_meters"
    ];

    const rows = retailers.map((r) => [
      r.externalId,
      r.name,
      `${r.address}, ${r.city}, NY ${r.zipCode}`,
      r.geodataStandardAddress || "",
      r.latitude || "",
      r.longitude || "",
      r.geodataStandardLatitude || "",
      r.geodataStandardLongitude || "",
      r.geodataDistance !== null ? r.geodataDistance : ""
    ]);

    const csvHeaderLine = headers.join(",");
    const csvBodyLines = rows.map((row) => row.map(escapeCsv).join(","));
    const csvContent = [csvHeaderLine, ...csvBodyLines].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="geodata-host-corrections.csv"`
      }
    });

  } catch (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}
