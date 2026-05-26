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
    const vendors = await prisma.vendor.findMany({
      include: { jurisdiction: { select: { abbreviation: true } } },
      orderBy: { name: "asc" },
    });

    const headers = [
      "Name",
      "Type",
      "Jurisdiction",
      "Status",
      "Tax ID",
      "Website",
      "Payment Terms",
      "Classification",
      "Contact Name",
      "Contact Email",
      "Contact Phone",
      "Address",
      "Notes",
    ];

    const rows = [headers.join(",")];

    for (const v of vendors) {
      const row = [
        escapeCsv(v.name),
        escapeCsv(v.type),
        escapeCsv(v.jurisdiction?.abbreviation || ""),
        escapeCsv(v.status),
        escapeCsv(v.taxId),
        escapeCsv(v.website),
        escapeCsv(v.paymentTerms),
        escapeCsv(v.classification),
        escapeCsv(v.contactName),
        escapeCsv(v.contactEmail),
        escapeCsv(v.contactPhone),
        escapeCsv(v.address),
        escapeCsv(v.notes),
      ];
      rows.push(row.join(","));
    }

    const csvContent = rows.join("\n");

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "vendor",
        entityId: "all",
        action: "export_vendors_csv",
        changes: {},
      },
    });

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="vendors-export.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
