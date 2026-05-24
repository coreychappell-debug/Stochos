// =============================================================================
// Contract Invoices API
// =============================================================================

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

// POST /api/contracts/[id]/invoices — Add an invoice
export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const invoice = await prisma.invoice.create({
    data: {
      contractId: id,
      lineItemId: body.lineItemId || null,
      invoiceNumber: body.invoiceNumber || null,
      amount: parseFloat(body.amount),
      description: body.description || null,
      submittedAt: body.submittedAt ? new Date(body.submittedAt) : new Date(),
      status: "submitted",
      notes: body.notes || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "update",
      changes: { addedInvoice: body },
    },
  });

  return NextResponse.json(invoice, { status: 201 });
}
