const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { prisma } = require("../lib/db");

async function main() {
  console.time("DB Query");
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
  console.timeEnd("DB Query");
  console.log("Total routes fetched:", routes.length);

  console.time("Formatting");
  const formattedRoutes = routes.map(route => {
    const formattedRetailers = route.retailers.map(ret => {
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
  console.timeEnd("Formatting");

  console.time("JSON Stringify");
  const jsonStr = JSON.stringify(formattedRoutes);
  console.timeEnd("JSON Stringify");
  console.log("Response size:", (jsonStr.length / (1024 * 1024)).toFixed(2), "MB");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
