import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/products — list all
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [products, lifecycles] = await Promise.all([
    prisma.product.findMany({
      include: { jurisdiction: { select: { abbreviation: true } } },
      orderBy: [{ category: "asc" }, { status: "asc" }, { name: "asc" }],
    }),
    prisma.martExecProductLifecycle.findMany(),
  ]);

  const mapping = {
    mega_millions: ["mega", "megaplier"],
    powerball: ["powerball", "powerplay"],
    ny_lotto: ["lotto"],
    numbers: ["numbers_eve", "numbers_day"],
    win_4: ["win4_eve", "win4_day"],
    take_5: ["t5_eve", "t5_day"],
    pick_10: ["pick10"],
    quick_draw: ["quick_draw", "qd_extra", "money_dots"],
    cash4life: ["c4l"]
  };

  const serialized = products.map(p => {
    let historicalAnnualSales = null;
    let trendDirection = null;

    if (p.category === "draw_game" && p.externalCode) {
      const codes = mapping[p.externalCode];
      if (codes) {
        const matched = lifecycles.filter(l => codes.includes(l.gameCode));
        if (matched.length > 0) {
          let totalSales = 0;
          matched.forEach(m => {
            const rev = parseFloat(m.grossRevenue || 0);
            const days = m.activeDays || 365;
            totalSales += (rev / days) * 365;
          });
          historicalAnnualSales = totalSales;
          trendDirection = matched[0].trendDirection || "Stable";
        }
      }
    }

    return {
      ...p,
      price: p.price ? parseFloat(p.price) : null,
      createdAt: p.createdAt.toISOString(),
      historicalAnnualSales,
      trendDirection,
    };
  });

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
