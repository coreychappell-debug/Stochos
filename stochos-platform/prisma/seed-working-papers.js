require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

let prisma;
// Support pg adapter if required (as in other seed files)
try {
  const { PrismaPg } = require('@prisma/adapter-pg');
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });
} catch (e) {
  prisma = new PrismaClient();
}

const TEMPLATE_TIERS = {
  5: [
    { prizeValue: 5, description: "1 x $5 (Single)", winnerCount: 600000 },
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 300000 },
    { prizeValue: 20, description: "2X Multiplier w/ $10", winnerCount: 40000 },
    { prizeValue: 50, description: "10 x $5 (Win All)", winnerCount: 20000 },
    { prizeValue: 100, description: "5X Multiplier w/ $20", winnerCount: 8000 },
    { prizeValue: 500, description: "1 x $500 (Single)", winnerCount: 400 },
    { prizeValue: 1000, description: "10 x $100 (Win All)", winnerCount: 80 },
    { prizeValue: 500000, description: "Top Prize", winnerCount: 2 }
  ],
  10: [
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 500000 },
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 250000 },
    { prizeValue: 50, description: "10 x $5 (Win All)", winnerCount: 70000 },
    { prizeValue: 100, description: "5X Multiplier w/ $20", winnerCount: 20000 },
    { prizeValue: 200, description: "20 x $10 (Win All)", winnerCount: 4000 },
    { prizeValue: 500, description: "1 x $500 (Single)", winnerCount: 1200 },
    { prizeValue: 1000, description: "10 x $100", winnerCount: 250 },
    { prizeValue: 1000000, description: "Top Prize", winnerCount: 2 }
  ],
  20: [
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 400000 },
    { prizeValue: 30, description: "1 x $30 (Single)", winnerCount: 200000 },
    { prizeValue: 50, description: "1 x $50 (Single)", winnerCount: 80000 },
    { prizeValue: 100, description: "5X Multiplier w/ $20", winnerCount: 40000 },
    { prizeValue: 200, description: "10X Multiplier w/ $20", winnerCount: 10000 },
    { prizeValue: 500, description: "20X Multiplier w/ $25", winnerCount: 3000 },
    { prizeValue: 1000, description: "1 x $1,000 (Single)", winnerCount: 800 },
    { prizeValue: 5000000, description: "Top Prize", winnerCount: 2 }
  ]
};

async function main() {
  console.log('📝 Seeding Working Papers & Prize Structures...\n');

  try {
    // 1. Wipe previous data
    await prisma.instantTicketWorkingPaperPrizeTier.deleteMany({});
    await prisma.instantTicketWorkingPaper.deleteMany({});
    console.log('  ✓ Cleaned existing Working Papers & Prize Tiers');

    // 2. Fetch some planned games from active scenarios
    const games = await prisma.instantTicketGame.findMany({
      orderBy: { name: 'asc' },
      take: 6
    });

    if (games.length === 0) {
      console.log('  ⚠ No planned games found in the database. Please run seed-instant-tickets first.');
      return;
    }

    // 3. Create working papers for the first few games
    let seedCount = 0;
    for (let i = 0; i < Math.min(games.length, 3); i++) {
      const game = games[i];
      const denom = game.denomination;
      const printRun = game.units;

      // Select default template
      const tiers = TEMPLATE_TIERS[denom] || TEMPLATE_TIERS[10]; // Fallback to $10 template

      let totalPayout = 0;
      let totalWinners = BigInt(0);

      // Pre-calculate totals
      const scale = Number(printRun) / (denom === 5 ? 6000000 : denom === 20 ? 4000000 : 5000000);
      
      const paperTiersData = [];
      for (const t of tiers) {
        const count = BigInt(Math.max(1, Math.round(t.winnerCount * scale)));
        const payout = t.prizeValue * Number(count);
        totalPayout += payout;
        totalWinners += count;

        const odds = count > BigInt(0) ? Number(printRun) / Number(count) : null;

        paperTiersData.push({
          prizeValue: t.prizeValue,
          description: t.description,
          winnerCount: count,
          payoutAmount: payout,
          odds: odds
        });
      }

      const overallOdds = totalWinners > BigInt(0) ? Number(printRun) / Number(totalWinners) : 3.5;
      const status = i === 0 ? 'executed' : i === 1 ? 'pending_approval' : 'draft';
      const coSignedDate = status === 'executed' ? new Date('2026-04-12') : null;

      const boilerplate = `
        <h2 style="text-align: center; color: #0c2a1b;">NEW YORK STATE GAMING COMMISSION</h2>
        <h3 style="text-align: center; color: #475569;">OFFICIAL INSTANT GAME WORKING PAPERS</h3>
        <hr style="border: 1px solid #16422b; margin: 20px 0;"/>
        <p><strong>Game Overview:</strong> This document outlines the official specifications, validations, and rules for <strong>${game.name}</strong> (Game Number <strong>${game.gameNumber}</strong>) at the <strong>$${denom}.00</strong> price point.</p>
        
        <h4>1. Play Style & Rules</h4>
        <p>Match any of YOUR NUMBERS to any of the WINNING NUMBERS, win prize shown for that number. [Custom play style multipliers and themed symbols to be detailed by McCann Worldgroup].</p>
        
        <h4>2. Ticket Layout & Graphics</h4>
        <p>The ticket size is standard. Front and back art files must be submitted and approved by the Commission prior to plate rendering.</p>
        
        <h4>3. Security & Validation Controls</h4>
        <p>Each ticket contains a 14-digit validation number hidden beneath the latex coating. Verification must be executed against the central gaming system prior to any prize disbursement.</p>
        
        <h4>4. Claiming Procedures</h4>
        <p>Prizes up to $599.00 may be claimed at any authorized New York State Lottery retail location. Prizes of $600.00 or more require W-2G tax offset reporting and must be claimed at a Customer Service Center or Commission Headquarters.</p>
      `;

      const paper = await prisma.instantTicketWorkingPaper.create({
        data: {
          gameId: game.id,
          gameNumber: game.gameNumber,
          name: game.name,
          denomination: denom,
          printRun: printRun,
          plannedPrizeExpense: totalPayout,
          overallOdds: overallOdds,
          status: status,
          coSignedDate: coSignedDate,
          documentContent: boilerplate,
          prizeTiers: {
            create: paperTiersData
          }
        }
      });

      // Update payoutPercent on the game to reflect the calculated payout rate
      const actualPayoutRate = (totalPayout / (Number(printRun) * denom)) * 100;
      await prisma.instantTicketGame.update({
        where: { id: game.id },
        data: { payoutPercent: parseFloat(actualPayoutRate.toFixed(2)) }
      });

      seedCount++;
    }

    console.log(`  ✓ Successfully seeded ${seedCount} working papers and associated prize tiers`);
  } catch (error) {
    console.error('Error seeding working papers:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
