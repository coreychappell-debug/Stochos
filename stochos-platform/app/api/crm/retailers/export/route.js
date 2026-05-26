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

  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("routeId");
  const chainId = searchParams.get("chainId");
  const status = searchParams.get("status");
  const templateType = searchParams.get("templateType") || "action_item"; // 'action_item', 'equipment_assignment', 'retailer_master'

  const where = {};
  if (status && status !== "all") where.status = status;
  if (routeId && routeId !== "all") where.routeId = routeId;
  if (chainId && chainId !== "all") where.chainId = chainId;

  try {
    const retailers = await prisma.crmRetailer.findMany({
      where,
      orderBy: [
        { routeId: "asc" },
        { routeOrder: "asc" }
      ]
    });

    let csvContent = "";
    let headers = [];
    let rows = [];

    if (templateType === "action_item") {
      headers = ["retailer_id", "retailer_name", "city", "title", "description", "due_date", "status"];
      rows = retailers.map((r) => [
        r.externalId,
        r.name,
        r.city,
        "", // empty title placeholder
        "", // empty description placeholder
        "", // empty due_date placeholder
        "open" // default status
      ]);
    } else if (templateType === "equipment_assignment") {
      headers = [
        "retailer_id", "retailer_name", "city", "serial_number", "asset_tag", 
        "equipment_category", "equipment_subtype", "vendor", "manufacturer", "model", 
        "owner_type", "placement_zone", "install_date"
      ];
      rows = retailers.map((r) => [
        r.externalId,
        r.name,
        r.city,
        "", // serial_number
        "", // asset_tag
        "", // equipment_category
        "", // equipment_subtype
        "", // vendor
        "", // manufacturer
        "", // model
        "lottery_owned", // owner_type
        "service_counter", // placement_zone
        "" // install_date
      ]);
    } else {
      // retailer_master
      headers = [
        "retailer_id", "retailer_name", "address_1", "city", "state", "postal_code", 
        "phone", "status", "application_status", "training_status", "visit_cadence", 
        "latitude", "longitude"
      ];
      rows = retailers.map((r) => [
        r.externalId,
        r.name,
        r.address,
        r.city,
        "NY",
        r.zipCode,
        r.phone || "",
        r.status,
        r.applicationStatus,
        r.trainingStatus,
        r.visitCadence,
        r.latitude || "",
        r.longitude || ""
      ]);
    }

    // Compile CSV string
    const csvHeaderLine = headers.join(",");
    const csvBodyLines = rows.map((row) => row.map(escapeCsv).join(","));
    csvContent = [csvHeaderLine, ...csvBodyLines].join("\n");

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="prepopulated-${templateType}-template.csv"`
      }
    });

  } catch (error) {
    return new Response(`Export failed: ${error.message}`, { status: 500 });
  }
}
