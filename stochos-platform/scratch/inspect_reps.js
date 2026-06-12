// Load environment variables manually in development
require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.local" });

const { prisma } = require("../lib/db");

async function main() {
  const users = await prisma.user.findMany({
    where: { division: "OPERATIONS" },
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

  console.log(`Found ${users.length} operations users:`);
  users.forEach(u => {
    console.log(`- ${u.name} (${u.email}): Bureau=${u.bureau}, Subunit=${u.subunit}, Home=${u.homeAddress}, Coords=(${u.homeLatitude}, ${u.homeLongitude})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
