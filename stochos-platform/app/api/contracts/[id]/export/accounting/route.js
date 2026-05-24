import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: {
      vendor: true,
      lineItems: { include: { product: true } },
      invoices: { include: { lineItem: true } },
    },
  });

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Log export action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      entityType: "contract",
      entityId: id,
      action: "export_accounting_csv",
      changes: {},
    },
  });

  // Build CSV content
  const rows = [];
  
  // Section 1: Contract Meta
  rows.push(["CONTRACT FINANCIAL SUMMARY"]);
  rows.push(["Title", contract.title]);
  rows.push(["Vendor", contract.vendor?.name || ""]);
  rows.push(["Status", contract.status]);
  rows.push(["Start Date", contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : ""]);
  rows.push(["End Date", contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : ""]);
  rows.push(["Total Value", contract.totalValue || 0]);
  rows.push(["Budget Cap", contract.budgetCap || 0]);
  rows.push([]);

  // Section 2: Line Items
  rows.push(["LINE ITEMS"]);
  rows.push(["Description", "Type", "Product", "Budget", "Spent", "Status", "Due Date"]);
  for (const li of contract.lineItems) {
    rows.push([
      `"${li.description.replace(/"/g, '""')}"`,
      li.deliverableType || "",
      li.product?.name || "",
      li.budgetAmount || 0,
      li.spentAmount || 0,
      li.status,
      li.dueDate ? new Date(li.dueDate).toISOString().split('T')[0] : ""
    ]);
  }
  rows.push([]);

  // Section 3: Invoices
  rows.push(["INVOICES"]);
  rows.push(["Invoice Number", "Linked Line Item", "Amount", "Status", "Submitted Date", "Description"]);
  for (const inv of contract.invoices) {
    rows.push([
      inv.invoiceNumber || "",
      inv.lineItem ? `"${inv.lineItem.description.replace(/"/g, '""')}"` : "General",
      inv.amount || 0,
      inv.status,
      inv.submittedAt ? new Date(inv.submittedAt).toISOString().split('T')[0] : "",
      inv.description ? `"${inv.description.replace(/"/g, '""')}"` : ""
    ]);
  }

  const csvContent = rows.map(r => r.join(",")).join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="contract-${id}-accounting.csv"`,
    },
  });
}
