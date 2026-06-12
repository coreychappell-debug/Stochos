require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { prisma } = require("../lib/db");

async function main() {
  const schenectadyReps = await prisma.user.findMany({
    where: {
      division: "OPERATIONS",
      OR: [
        { subunit: { contains: "Schenectady", mode: "insensitive" } },
        { bureau: { contains: "Schenectady", mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      subunit: true,
      bureau: true,
      homeAddress: true,
      homeLatitude: true,
      homeLongitude: true
    }
  });

  console.log(`Found ${schenectadyReps.length} Schenectady reps:`);
  schenectadyReps.forEach(u => {
    console.log(`- ${u.name} (${u.email}): Subunit=${u.subunit}, Home=${u.homeAddress}, Coords=(${u.homeLatitude}, ${u.homeLongitude})`);
  });

  // Also query routes and see if there are other reps with Schenectady routes
  const routes = await prisma.crmRoute.findMany({
    where: { name: { contains: "Schenectady", mode: "insensitive" } },
    include: {
      rep: {
        select: {
          id: true,
          name: true,
          email: true,
          subunit: true
        }
      }
    }
  });

  console.log(`\nFound ${routes.length} Schenectady routes:`);
  routes.forEach(r => {
    console.log(`- Route: ${r.code} (${r.name}), Rep: ${r.rep ? `${r.rep.name} (${r.rep.subunit})` : "Unassigned"}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
