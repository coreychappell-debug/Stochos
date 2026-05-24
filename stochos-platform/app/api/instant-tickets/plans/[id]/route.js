import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/instant-tickets/plans/[id] — load a full plan with all nested data
export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const plan = await prisma.instantTicketPlan.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      scenarios: {
        orderBy: { sortOrder: "asc" },
        include: {
          games: {
            orderBy: { sortOrder: "asc" },
            include: {
              vendor: { select: { id: true, name: true, type: true } },
              features: { select: { featureName: true } },
            },
          },
          marketingItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              vendor: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Also load vendor pricing for all printer vendors
  const vendorPricing = await prisma.instantTicketVendorPricing.findMany({
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: [{ vendorId: "asc" }, { ticketSize: "asc" }],
  });

  // Serialize BigInt values
  const serialized = JSON.parse(
    JSON.stringify(plan, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  const serializedPricing = JSON.parse(
    JSON.stringify(vendorPricing, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json({ plan: serialized, vendorPricing: serializedPricing });
}

// PUT /api/instant-tickets/plans/[id] — update plan metadata
export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updated = await prisma.instantTicketPlan.update({
    where: { id },
    data: {
      name: body.name,
      fiscalYear: body.fiscalYear ? parseInt(body.fiscalYear) : undefined,
      totalSalesTarget: body.totalSalesTarget ? parseFloat(body.totalSalesTarget) : undefined,
      retailerCommPct: body.retailerCommPct ? parseFloat(body.retailerCommPct) : undefined,
      adminExpensePct: body.adminExpensePct ? parseFloat(body.adminExpensePct) : undefined,
      sellThroughPct: body.sellThroughPct ? parseFloat(body.sellThroughPct) : undefined,
      status: body.status,
      notes: body.notes,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/instant-tickets/plans/[id] — archive a plan
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.instantTicketPlan.update({
    where: { id },
    data: { status: "archived" },
  });

  return NextResponse.json({ success: true });
}
