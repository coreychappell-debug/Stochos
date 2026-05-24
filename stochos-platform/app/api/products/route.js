import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/products — list all
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const products = await prisma.product.findMany({
    include: { jurisdiction: { select: { abbreviation: true } } },
    orderBy: [{ category: "asc" }, { status: "asc" }, { name: "asc" }],
  });

  const serialized = products.map(p => ({
    ...p, price: p.price ? parseFloat(p.price) : null,
    createdAt: p.createdAt.toISOString(),
  }));

  return NextResponse.json(serialized);
}

// POST /api/products — create new product
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { jurisdictionId, name, category, type, price, externalCode, status } = body;

  if (!jurisdictionId || !name || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const product = await prisma.product.create({
    data: {
      jurisdictionId,
      name,
      category,
      type: type || null,
      price: price ? parseFloat(price) : null,
      externalCode: externalCode || null,
      status: status || "active",
    },
    include: { jurisdiction: { select: { abbreviation: true } } },
  });

  return NextResponse.json({ ...product, price: product.price ? parseFloat(product.price) : null, createdAt: product.createdAt.toISOString() }, { status: 201 });
}

// PATCH /api/products — update status
export async function PATCH(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, status } = body;

  if (!id || !status) return NextResponse.json({ error: "Missing id or status" }, { status: 400 });

  const updated = await prisma.product.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ...updated, price: updated.price ? parseFloat(updated.price) : null });
}
