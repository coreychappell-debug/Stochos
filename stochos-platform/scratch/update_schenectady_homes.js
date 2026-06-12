require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { prisma } = require("../lib/db");

const repAssignments = [
  // 3 Outside the Territory (approx 35%)
  {
    email: "rep.robert.miller@gaming.ny.gov",
    homeAddress: "15 Broadway, Saratoga Springs, NY 12866",
    homeLatitude: 43.0831,
    homeLongitude: -73.7846
  },
  {
    email: "rep.james.brown@gaming.ny.gov",
    homeAddress: "50 State St, Albany, NY 12207",
    homeLatitude: 42.6526,
    homeLongitude: -73.7562
  },
  {
    email: "rep.amanda.white@gaming.ny.gov",
    homeAddress: "12 Guy Park Ave, Amsterdam, NY 12010",
    homeLatitude: 42.9387,
    homeLongitude: -74.1887
  },

  // 6 Inside the Territory
  {
    email: "rep.robert.brown@gaming.ny.gov",
    homeAddress: "2200 Nott St, Niskayuna, NY 12309",
    homeLatitude: 42.8250,
    homeLongitude: -73.8820
  },
  {
    email: "rep.william.martin@gaming.ny.gov",
    homeAddress: "1400 Altamont Ave, Rotterdam, NY 12303",
    homeLatitude: 42.7780,
    homeLongitude: -74.0150
  },
  {
    email: "rep.megan.rodriguez@gaming.ny.gov",
    homeAddress: "100 Saratoga Rd, Glenville, NY 12302",
    homeLatitude: 42.8650,
    homeLongitude: -73.9650
  },
  {
    email: "rep.emily.brown@gaming.ny.gov",
    homeAddress: "1500 Balltown Rd, Niskayuna, NY 12309",
    homeLatitude: 42.8050,
    homeLongitude: -73.8750
  },
  {
    email: "rep.kevin.brown@gaming.ny.gov",
    homeAddress: "10 Main St, Rotterdam Junction, NY 12150",
    homeLatitude: 42.8450,
    homeLongitude: -74.0550
  },
  {
    email: "rep.sarah.martinez@gaming.ny.gov",
    homeAddress: "500 State St, Schenectady, NY 12305",
    homeLatitude: 42.7950,
    homeLongitude: -73.9550
  }
];

async function main() {
  console.log("Updating home addresses for Schenectady representatives...");

  for (const rep of repAssignments) {
    const user = await prisma.user.findUnique({
      where: { email: rep.email }
    });

    if (user) {
      await prisma.user.update({
        where: { email: rep.email },
        data: {
          homeAddress: rep.homeAddress,
          homeLatitude: rep.homeLatitude,
          homeLongitude: rep.homeLongitude
        }
      });
      console.log(`Updated ${user.name} (${rep.email}) to ${rep.homeAddress} (${rep.homeLatitude}, ${rep.homeLongitude})`);
    } else {
      console.warn(`Representative with email ${rep.email} not found!`);
    }
  }

  console.log("All updates complete!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
