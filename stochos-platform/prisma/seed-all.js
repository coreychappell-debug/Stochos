// prisma/seed-all.js
// Runs all database seed scripts in the correct dependency order to fully reset and populate the demo environment.

const { execSync } = require('child_process');
const path = require('path');

// Load environment variables from the parent directory's .env file
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const scripts = [
  'seed.js',
  'seed-divisions-users.js',
  'seed-contracts.js',
  'seed-instant-tickets.js',
  'seed-draw-games.js',
  'seed-ny-lottery-demo.js',
  'seed-gasb34.js',
  'seed-sales-force.js',
  'seed-org-structure.js',
  'seed-working-papers.js'
];

console.log('🏁 Starting complete database rebuild and seeding sequence...\n');

try {
  for (const script of scripts) {
    const scriptPath = path.join(__dirname, script);
    console.log(`==========================================================`);
    console.log(`🚀 Running: node prisma/${script}`);
    console.log(`==========================================================`);
    // Run the script and inherit the process environment
    execSync(`node "${scriptPath}"`, { 
      stdio: 'inherit', 
      cwd: __dirname,
      env: process.env 
    });
    console.log(`✓ Completed: prisma/${script}\n`);
  }
  console.log('✨ All seeding scripts completed successfully! The database is now fully populated.');
} catch (error) {
  console.error('❌ Seeding sequence failed:', error.message);
  process.exit(1);
}
