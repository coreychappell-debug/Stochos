import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch a sample user and org unit to make the template helper realistic
    const [sampleUser, sampleOrgUnit] = await Promise.all([
      prisma.user.findFirst({ where: { status: "active" }, select: { email: true } }),
      prisma.orgUnit.findFirst({ where: { code: { startsWith: "1.1." } }, select: { code: true } }),
    ]);

    const userEmail = sampleUser?.email || "employee@gaming.ny.gov";
    const orgUnitCode = sampleOrgUnit?.code || "1.1.4";

    const headers = [
      "Asset Tag",
      "Name",
      "Category",
      "Serial Number",
      "Value",
      "Status",
      "Assigned Employee Email",
      "Jurisdiction",
      "Purchase Date",
      "Useful Life Months",
      "Deployment Type",
      "Retailer ID",
      "Org Unit",
      "Notes"
    ];

    // Create realistic mock examples based on db data
    const rows = [
      headers.join(","),
      // Sample 1: Retail Field Asset
      `AST-NY-ALT-09999,IGT Altura GT1200,computer,IGT-ALT-09999,4500,assigned,${userEmail},NY,2021-09-15,120,retail,1.1.1.1.1,,Simulated convenience store lottery terminal.`,
      // Sample 2: Office Corporate Asset
      `AST-NY-OFF-MAC-08888,MacBook Pro 16\\",computer,OFF-MAC-08888,2500,assigned,${userEmail},NY,2025-06-01,36,office,,${orgUnitCode},Corporate office laptop for IT developers.`
    ];

    const csvContent = rows.join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Disposition": "attachment; filename=assets-import-template.csv",
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
