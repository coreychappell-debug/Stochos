const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function testApply() {
  console.log("Fetching a retailer and a route from database...");
  const retailer = await prisma.crmRetailer.findFirst();
  const route = await prisma.crmRoute.findFirst();

  if (!retailer) {
    console.error("No CRM retailers found in database.");
    return;
  }
  if (!route) {
    console.error("No CRM routes found in database.");
    return;
  }

  console.log(`Found Retailer ID: ${retailer.id}, Route ID: ${route.id}`);

  const payload = {
    action: "bulk",
    assignments: {
      [retailer.id]: route.id
    }
  };

  console.log("Sending POST request to http://localhost:3000/api/fomo/territories/apply...");
  
  try {
    const res = await fetch("http://localhost:3000/api/fomo/territories/apply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-simulated-test": "true"
      },
      body: JSON.stringify(payload)
    });

    console.log(`Response Status: ${res.status} ${res.statusText}`);
    const text = await res.text();
    console.log("Response Body:", text);
  } catch (err) {
    console.error("Request failed:", err);
  }
}

testApply().finally(() => prisma.$disconnect());
