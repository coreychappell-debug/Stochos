const fs = require("fs");
const path = require("path");

// Manually parse .env and .env.local files to set environment variables
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  envFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      content.split("\n").forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const firstEq = trimmed.indexOf("=");
          const key = trimmed.substring(0, firstEq).trim();
          const val = trimmed.substring(firstEq + 1).replace(/^["']|["']$/g, "").trim();
          process.env[key] = val;
        }
      });
    }
  });
}

loadEnv();

const { prisma } = require("./lib/db");

async function main() {
  const userCount = await prisma.user.count();
  const managerCount = await prisma.user.count({
    where: {
      role: "regional_manager"
    }
  });
  const repCount = await prisma.user.count({
    where: {
      role: "rep"
    }
  });

  console.log(`Total Users in Local Database: ${userCount}`);
  console.log(`  - Regional Managers: ${managerCount}`);
  console.log(`  - Sales Representatives: ${repCount}`);
  console.log(`  - Other Roles: ${userCount - managerCount - repCount}`);
  
  // Group by division
  const divisions = await prisma.user.groupBy({
    by: ['division'],
    _count: {
      id: true
    }
  });
  console.log("\nUsers by Division:");
  divisions.forEach(d => {
    console.log(`  - ${d.division || "No Division"}: ${d._count.id}`);
  });
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
