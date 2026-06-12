// scratch/fix_calendar.js
// Updates calendar seeding name in the database to align with the NY Lottery theme.

require('dotenv').config();
const { prisma } = require('../lib/db');

async function fixCalendar() {
  try {
    const updated = await prisma.fiscalCalendar.updateMany({
      where: { name: 'California Lottery Statutory Calendar' },
      data: { name: 'New York Lottery Statutory Calendar' }
    });
    console.log(`Updated ${updated.count} calendar records.`);
  } catch (err) {
    console.error("Failed to update calendar name in DB:", err);
  } finally {
    await prisma.$disconnect();
  }
}

fixCalendar();
