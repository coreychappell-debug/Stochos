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
    const assets = await prisma.asset.findMany({
      include: {
        jurisdiction: { select: { abbreviation: true } },
        assignedTo: { select: { email: true } },
      },
      orderBy: { assetTag: "asc" },
    });

    const headers = [
      "Asset Tag",
      "Name",
      "Category",
      "Serial Number",
      "Value",
      "Status",
      "Purchase Date",
      "Assigned Employee Email",
      "Jurisdiction",
      "Notes",
      "Disposal Date",
      "Disposal Method",
      "Sale Price",
      "Useful Life Months",
    ];

    const rows = [headers.join(",")];

    for (const a of assets) {
      const row = [
        escapeCsv(a.assetTag),
        escapeCsv(a.name),
        escapeCsv(a.category),
        escapeCsv(a.serialNumber),
        escapeCsv(a.value ? parseFloat(a.value) : ""),
        escapeCsv(a.status),
        escapeCsv(a.purchaseDate ? a.purchaseDate.toISOString().split('T')[0] : ""),
        escapeCsv(a.assignedTo?.email || ""),
        escapeCsv(a.jurisdiction?.abbreviation || ""),
        escapeCsv(a.notes),
        escapeCsv(a.disposalDate ? a.disposalDate.toISOString().split('T')[0] : ""),
        escapeCsv(a.disposalMethod),
        escapeCsv(a.salePrice ? parseFloat(a.salePrice) : ""),
        escapeCsv(a.usefulLifeMonths),
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "asset",
        entityId: "all",
        action: "export_assets_csv",
        changes: {},
      },
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="assets-export.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
