import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const routes = await prisma.crmRoute.findMany({
      include: {
        retailers: {
          orderBy: { routeOrder: "asc" },
          include: {
            discrepancies: {
              where: { status: "open" }
            }
          }
        },
        rep: { select: { name: true } }
      }
    });

    // Format data with freshness calculations
    const formattedRoutes = routes.map(route => {
      const formattedRetailers = route.retailers.map(ret => {
        // Calculate freshness status
        let freshness = "overdue";
        if (ret.lastVisitDate) {
          const daysSince = (new Date() - new Date(ret.lastVisitDate)) / (1000 * 60 * 60 * 24);
          let limit = 7;
          if (ret.visitCadence === "biweekly") limit = 14;
          else if (ret.visitCadence === "monthly") limit = 30;
          
          if (daysSince <= limit) freshness = "fresh";
          else if (daysSince <= limit * 2) freshness = "warning";
        }

        return {
          id: ret.id,
          externalId: ret.externalId,
          name: ret.name,
          address: ret.address,
          city: ret.city,
          zipCode: ret.zipCode,
          latitude: ret.latitude,
          longitude: ret.longitude,
          lastVisitDate: ret.lastVisitDate,
          visitCadence: ret.visitCadence,
          routeOrder: ret.routeOrder,
          trainingStatus: ret.trainingStatus,
          freshness,
          county: ret.county,
          dma: ret.dma,
          serviceCenter: ret.serviceCenter,
          discrepancies: ret.discrepancies.map(d => ({
            id: d.id,
            status: d.status,
            type: d.type,
            notes: d.notes,
            createdAt: d.createdAt
          }))
        };
      });

      return {
        id: route.id,
        name: route.name,
        code: route.code,
        repName: route.rep?.name || "Unassigned Rep",
        retailers: formattedRetailers
      };
    });

    return NextResponse.json(formattedRoutes);
  } catch (error) {
    console.error("VCRM map API error:", error);
    return NextResponse.json({ error: "Failed to fetch map data" }, { status: 500 });
  }
}
