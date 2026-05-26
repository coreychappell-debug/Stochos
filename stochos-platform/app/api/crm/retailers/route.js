import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const routeId = searchParams.get("routeId");
  const status = searchParams.get("status");
  const trainingStatus = searchParams.get("trainingStatus");
  const chainId = searchParams.get("chainId");

  const where = {};
  if (status && status !== "all") where.status = status;
  if (trainingStatus && trainingStatus !== "all") where.trainingStatus = trainingStatus;
  if (routeId && routeId !== "all") where.routeId = routeId;
  if (chainId && chainId !== "all") where.chainId = chainId;

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { city: { contains: search, mode: "insensitive" } },
      { externalId: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const retailers = await prisma.crmRetailer.findMany({
      where,
      include: {
        route: {
          select: {
            name: true,
            code: true,
            rep: { select: { name: true } }
          }
        },
        chain: {
          select: { name: true, code: true }
        },
        _count: {
          select: { visits: true, discrepancies: { where: { status: "open" } } }
        }
      },
      orderBy: [
        { routeId: "asc" },
        { routeOrder: "asc" }
      ]
    });

    return NextResponse.json(retailers);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
