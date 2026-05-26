import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const escapeCsv = (val) => {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const vehicles = await prisma.vehicle.findMany({
      include: {
        jurisdiction: { select: { abbreviation: true } },
        assignedTo: { select: { email: true } },
      },
      orderBy: { licensePlate: "asc" },
    });

    const headers = [
      "License Plate",
      "Make",
      "Model",
      "Year",
      "VIN",
      "Mileage",
      "Status",
      "Last Service",
      "Assigned Driver Email",
      "Jurisdiction",
      "Notes",
      "Disposal Date",
      "Disposal Method",
      "Sale Price",
      "Useful Life Months",
      "Useful Life Miles",
      "Value",
    ];

    const rows = [headers.join(",")];

    for (const v of vehicles) {
      const row = [
        escapeCsv(v.licensePlate),
        escapeCsv(v.make),
        escapeCsv(v.model),
        escapeCsv(v.year),
        escapeCsv(v.vin),
        escapeCsv(v.mileage),
        escapeCsv(v.status),
        escapeCsv(v.lastService ? v.lastService.toISOString().split('T')[0] : ""),
        escapeCsv(v.assignedTo?.email || ""),
        escapeCsv(v.jurisdiction?.abbreviation || ""),
        escapeCsv(v.notes),
        escapeCsv(v.disposalDate ? v.disposalDate.toISOString().split('T')[0] : ""),
        escapeCsv(v.disposalMethod),
        escapeCsv(v.salePrice ? parseFloat(v.salePrice) : ""),
        escapeCsv(v.usefulLifeMonths),
        escapeCsv(v.usefulLifeMiles),
        escapeCsv(v.value ? parseFloat(v.value) : ""),
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vehicle",
        entityId: "all",
        action: "export_fleet_csv",
        changes: {},
      },
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="fleet-export.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
