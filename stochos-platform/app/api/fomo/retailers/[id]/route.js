import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const retailer = await prisma.crmRetailer.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            asset: {
              include: { type: true }
            }
          },
          orderBy: { installDate: "desc" }
        },
        route: {
          select: {
            name: true,
            code: true,
            rep: { select: { name: true } }
          }
        },
        chain: {
          select: { name: true }
        },
        actionItems: {
          where: { status: "open" },
          orderBy: { dueDate: "asc" }
        }
      }
    });

    if (!retailer) {
      return NextResponse.json({ error: "Retailer not found" }, { status: 404 });
    }

    return NextResponse.json(retailer);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
