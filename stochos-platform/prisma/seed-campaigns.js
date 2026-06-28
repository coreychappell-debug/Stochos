// prisma/seed-campaigns.js
// Seeds realistic marketing campaigns, channels, assets, and milestones for the New York Lottery.

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Client } = require('pg');

let prisma;
if (process.env.DATABASE_URL) {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  prisma = new PrismaClient({ adapter });
} else {
  prisma = new PrismaClient();
}

async function main() {
  console.log('🧹 Wiping existing campaigns, channels, assets, and milestones...');
  await prisma.campaignMilestone.deleteMany({});
  await prisma.campaignAsset.deleteMany({});
  await prisma.campaignChannel.deleteMany({});
  await prisma.campaign.deleteMany({});

  console.log('🔍 Fetching NY Jurisdiction, vendors, contracts, and products...');
  const ny = await prisma.jurisdiction.findUnique({ where: { abbreviation: 'NY' } });
  if (!ny) {
    throw new Error('NY jurisdiction not found. Run base seed first.');
  }

  // Find McCann and Havas vendors
  const mccann = await prisma.vendor.findFirst({ where: { name: { contains: 'McCann' } } });
  const havas = await prisma.vendor.findFirst({ where: { name: { contains: 'Havas' } } });
  if (!mccann || !havas) {
    throw new Error('McCann or Havas vendor not found. Run seed-contracts.js first.');
  }

  // Find corresponding contracts
  const mccannContract = await prisma.contract.findFirst({ where: { title: { contains: 'Creative Agency' } } });
  const havasContract = await prisma.contract.findFirst({ where: { title: { contains: 'Media Buying' } } });

  // Find products
  const megaMillions = await prisma.product.findFirst({ where: { name: 'Mega Millions' } });
  const powerball = await prisma.product.findFirst({ where: { name: 'Powerball' } });
  const nyLotto = await prisma.product.findFirst({ where: { name: 'NY Lotto' } });
  const take5 = await prisma.product.findFirst({ where: { name: 'Take 5' } });

  // Find any active marketing user or fallback to first active user
  let user = await prisma.user.findFirst({ where: { division: 'MARKETING', status: 'active' } });
  if (!user) {
    user = await prisma.user.findFirst({ where: { status: 'active' } });
  }
  if (!user) {
    throw new Error('No active user found to assign as creator.');
  }

  console.log(`👤 Using user "${user.name}" (${user.email}) as creator.`);

  // Define campaigns to seed
  console.log('🌱 Seeding campaigns...');

  // 1. Summer Scratchers Campaign
  const campaign1 = await prisma.campaign.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: mccann.id,
      contractId: mccannContract ? mccannContract.id : null,
      name: 'Summer Scratchers Triple-Play Blast',
      objective: 'Promote the trio of New York summer instant games (Summer Cash, Gold Rush, and Double Match) at retail outlets and major regional fair events throughout New York State.',
      status: 'live',
      campaignType: 'seasonal',
      totalBudget: 950000.00,
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-09-07'),
      notes: 'Focus on outdoor summer recreational areas and regional county fairs. Standard state event guidelines apply.',
      createdById: user.id,
      products: {
        connect: take5 ? [{ id: take5.id }] : []
      }
    }
  });

  // Channels for Campaign 1
  const ch1_1 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign1.id,
      vendorId: havas.id,
      channel: 'pos_retail',
      description: 'Spruce Green point-of-sale displays and ticket dispensers across 15,000 retail locations.',
      status: 'active',
      plannedSpend: 350000.00,
      actualSpend: 365000.00, // Overspend
      startDate: new Date('2026-05-10'),
      endDate: new Date('2026-09-07'),
      targetMarket: 'Statewide NY Retailers',
      kpiGoal: '95% planogram compliance across all bin configurations'
    }
  });

  const ch1_2 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign1.id,
      vendorId: havas.id,
      channel: 'social_media',
      description: 'Facebook and Instagram paid video carousel highlighting the instant ticket multipliers.',
      status: 'active',
      plannedSpend: 200000.00,
      actualSpend: 195000.00,
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-09-07'),
      targetMarket: 'Demographic 25-54 NY Residents',
      kpiGoal: '12M Impressions, 1.8% CTR'
    }
  });

  const ch1_3 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign1.id,
      vendorId: mccann.id,
      channel: 'experiential',
      description: 'Mobile promotional trucks and pop-up ticket purchasing booths at NY State Fair and County Fairs.',
      status: 'active',
      plannedSpend: 250000.00,
      actualSpend: 120000.00, // In progress
      startDate: new Date('2026-05-20'),
      endDate: new Date('2026-09-05'),
      targetMarket: 'Upstate Fairs & Events',
      kpiGoal: '$180,000 in onsite ticket sales'
    }
  });

  const ch1_4 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign1.id,
      vendorId: havas.id,
      channel: 'radio',
      description: 'Regional radio broadcast commercials on driving and sports channels.',
      status: 'active',
      plannedSpend: 150000.00,
      actualSpend: 145000.00,
      startDate: new Date('2026-05-15'),
      endDate: new Date('2026-09-01'),
      targetMarket: 'NYC, Buffalo, Rochester & Albany DMAs',
      kpiGoal: 'Reach 3.5M unique listeners'
    }
  });

  // Assets for Campaign 1
  const asset1_1 = await prisma.campaignAsset.create({
    data: {
      campaignId: campaign1.id,
      channelId: ch1_1.id,
      vendorId: mccann.id,
      name: 'Summer Scratchers Retail Poster - Spruce Green Version',
      assetType: 'static_image',
      formatSpecs: '24x36 Coated Paper',
      language: 'English',
      status: 'live',
      approvalStatus: 'approved',
      reviewOwner: 'Marketing Director',
      dueDate: new Date('2026-05-01'),
      launchDate: new Date('2026-05-10'),
      assetUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?auto=format&fit=crop&w=400&q=80',
      complianceNotes: 'Responsible gaming logo printed at 10pt minimum font at bottom.'
    }
  });

  await prisma.campaignAsset.create({
    data: {
      campaignId: campaign1.id,
      channelId: ch1_4.id,
      vendorId: mccann.id,
      name: 'Summer Scratchers 30s Radio Jingle',
      assetType: 'audio',
      formatSpecs: '30s MP3',
      language: 'English',
      status: 'live',
      approvalStatus: 'approved',
      reviewOwner: 'Legal Team',
      dueDate: new Date('2026-05-05'),
      launchDate: new Date('2026-05-15'),
      complianceNotes: 'Standard NY Lottery legal disclaimer included in final 3 seconds.'
    }
  });

  // Milestones for Campaign 1
  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign1.id,
      channelId: ch1_1.id,
      assetId: asset1_1.id,
      name: 'Production Approval for POS kits',
      milestoneType: 'creative',
      owner: 'Marketing Lead',
      priority: 'high',
      status: 'completed',
      dueDate: new Date('2026-04-20'),
      completedDate: new Date('2026-04-18')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign1.id,
      channelId: ch1_1.id,
      name: 'Statewide Distribution to Retailers',
      milestoneType: 'retail_delivery',
      owner: 'Operations Coordinator',
      priority: 'normal',
      status: 'completed',
      dueDate: new Date('2026-05-10'),
      completedDate: new Date('2026-05-09')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign1.id,
      name: 'Fair Event Activation Launch',
      milestoneType: 'launch',
      owner: 'Event Supervisor',
      priority: 'critical',
      status: 'completed',
      dueDate: new Date('2026-05-15'),
      completedDate: new Date('2026-05-15')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign1.id,
      name: 'Final Campaign Closeout Accounting',
      milestoneType: 'closeout',
      owner: 'Finance Director',
      priority: 'low',
      status: 'not_started',
      dueDate: new Date('2026-09-30')
    }
  });


  // 2. Powerball Jackpot Campaign
  const campaign2 = await prisma.campaign.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: havas.id,
      contractId: havasContract ? havasContract.id : null,
      name: 'Powerball Jackpot Awareness - Spring Momentum',
      objective: 'Deploy rapid-response jackpot awareness marketing when the Powerball jackpot crosses the critical $500 million threshold to capture casual players.',
      status: 'planning',
      campaignType: 'jackpot_awareness',
      totalBudget: 1200000.00,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-10-31'),
      notes: 'Campaign runs on standby. Dynamic billboard APIs must be validated and active before start date.',
      createdById: user.id,
      products: {
        connect: powerball ? [{ id: powerball.id }] : []
      }
    }
  });

  // Channels for Campaign 2
  const ch2_1 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign2.id,
      vendorId: havas.id,
      channel: 'digital_display',
      description: 'Programmatic digital billboards snapped to major NY thruways (I-87, I-90) showing live jackpot figures.',
      status: 'planned',
      plannedSpend: 500000.00,
      actualSpend: 0.00,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-10-31'),
      targetMarket: 'NY Highway Thruways',
      kpiGoal: 'Jackpot dynamic synchronization within 10 minutes of drawing'
    }
  });

  const ch2_2 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign2.id,
      vendorId: havas.id,
      channel: 'social_media',
      description: 'Meta and Twitter video ads triggered dynamically upon jackpot milestones ($500M, $750M, $1B).',
      status: 'planned',
      plannedSpend: 300000.00,
      actualSpend: 0.00,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2026-10-31'),
      targetMarket: 'Statewide Mobile Users',
      kpiGoal: '8% engagement lift during drawing days'
    }
  });

  const ch2_3 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign2.id,
      vendorId: havas.id,
      channel: 'tv',
      description: 'Prime time television spot insertions during major live sporting events.',
      status: 'planned',
      plannedSpend: 400000.00,
      actualSpend: 0.00,
      startDate: new Date('2026-07-15'),
      endDate: new Date('2026-10-15'),
      targetMarket: 'NY DMA Broadcast Networks',
      kpiGoal: 'Deliver 15.0 GRPs per flight'
    }
  });

  // Assets for Campaign 2
  const asset2_1 = await prisma.campaignAsset.create({
    data: {
      campaignId: campaign2.id,
      channelId: ch2_1.id,
      vendorId: mccann.id,
      name: 'Jackpot High Alert Digital Billboard Template',
      assetType: 'static_image',
      formatSpecs: '1400x400 Dynamic WebP',
      language: 'English',
      status: 'draft',
      approvalStatus: 'pending',
      reviewOwner: 'Marketing Director',
      dueDate: new Date('2026-06-25'),
      complianceNotes: 'Requires API bridge certification for live data source.'
    }
  });

  await prisma.campaignAsset.create({
    data: {
      campaignId: campaign2.id,
      channelId: ch2_3.id,
      vendorId: mccann.id,
      name: 'Powerball Jackpot Alert 15s TV Spot',
      assetType: 'video',
      formatSpecs: '15s MP4 Broadcast Spec',
      language: 'English',
      status: 'in_review',
      approvalStatus: 'pending',
      reviewOwner: 'Legal Team',
      dueDate: new Date('2026-06-28'),
      complianceNotes: 'Verify disclaimer states exact ticket cost ($2) and overall odds (1 in 292.2M).'
    }
  });

  // Milestones for Campaign 2
  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign2.id,
      channelId: ch2_1.id,
      assetId: asset2_1.id,
      name: 'Jackpot Alert Creative Template Sign-off',
      milestoneType: 'creative',
      owner: 'Marketing Director',
      priority: 'high',
      status: 'in_progress',
      dueDate: new Date('2026-06-28')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign2.id,
      channelId: ch2_1.id,
      name: 'Digital Billboard API Integration Complete',
      milestoneType: 'media_buy',
      owner: 'Havas Media Tech Lead',
      priority: 'normal',
      status: 'not_started',
      dueDate: new Date('2026-06-30'),
      dependencyNotes: 'Requires sign-off from IT Security on outbound API bridge'
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign2.id,
      name: 'Jackpot Campaign Trigger Standby',
      milestoneType: 'launch',
      owner: 'Media Buyer',
      priority: 'critical',
      status: 'not_started',
      dueDate: new Date('2026-07-01')
    }
  });


  // 3. Mega Millions Jackpot Awareness
  const campaign3 = await prisma.campaign.create({
    data: {
      jurisdictionId: ny.id,
      vendorId: mccann.id,
      contractId: mccannContract ? mccannContract.id : null,
      name: 'Mega Millions Jackpot Awareness - Summer Wave',
      objective: 'Build aggressive sales momentum for Mega Millions jackpot runs above $400M, leveraging local television, digital, and transit-shelter media networks.',
      status: 'live',
      campaignType: 'jackpot_awareness',
      totalBudget: 1400000.00,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      notes: 'McCann will deliver creative and print assets; Havas is designated for television buy execution.',
      createdById: user.id,
      products: {
        connect: megaMillions ? [{ id: megaMillions.id }] : []
      }
    }
  });

  // Channels for Campaign 3
  const ch3_1 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign3.id,
      vendorId: havas.id,
      channel: 'tv',
      description: 'Local television broadcasts during NY regional news and evening programming.',
      status: 'active',
      plannedSpend: 600000.00,
      actualSpend: 580000.00,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      targetMarket: 'NYC, Albany & Syracuse local channels',
      kpiGoal: 'Achieve 70% reach with 4.5 average frequency'
    }
  });

  const ch3_2 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign3.id,
      vendorId: havas.id,
      channel: 'digital_display',
      description: 'Ad networks on local news sites (NY Post, Buffalo News, Albany Times Union) triggering during draw weeks.',
      status: 'active',
      plannedSpend: 300000.00,
      actualSpend: 290000.00,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      targetMarket: 'Statewide NY IP addresses',
      kpiGoal: '18M impressions, 1.2% CTR'
    }
  });

  const ch3_3 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign3.id,
      vendorId: havas.id,
      channel: 'social_media',
      description: 'Targeted Instagram and Facebook Stories highlighting lottery contribution to NY State education funds.',
      status: 'active',
      plannedSpend: 200000.00,
      actualSpend: 210000.00, // Overspend
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      targetMarket: 'NY Residents 18-34',
      kpiGoal: 'Generate 120,000 click-throughs to where-to-play locator'
    }
  });

  const ch3_4 = await prisma.campaignChannel.create({
    data: {
      campaignId: campaign3.id,
      vendorId: havas.id,
      channel: 'outdoor',
      description: 'Subway shelter wraps and digital taxi-top ads across Manhattan and Brooklyn.',
      status: 'active',
      plannedSpend: 300000.00,
      actualSpend: 300000.00,
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-08-31'),
      targetMarket: 'NYC Transit Commuters',
      kpiGoal: 'Cover 80 high-traffic Manhattan transit hubs'
    }
  });

  // Assets for Campaign 3
  const asset3_1 = await prisma.campaignAsset.create({
    data: {
      campaignId: campaign3.id,
      channelId: ch3_1.id,
      vendorId: mccann.id,
      name: 'Mega Millions 30s TV Spot - A Million Reasons',
      assetType: 'video',
      formatSpecs: '30s MP4 Broadcast Spec',
      language: 'English',
      status: 'live',
      approvalStatus: 'approved',
      reviewOwner: 'Marketing Director',
      dueDate: new Date('2026-04-15'),
      launchDate: new Date('2026-05-01'),
      assetUrl: 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=400&q=80',
      complianceNotes: 'Standard NY Lottery education funding contribution note included.'
    }
  });

  await prisma.campaignAsset.create({
    data: {
      campaignId: campaign3.id,
      channelId: ch3_4.id,
      vendorId: mccann.id,
      name: 'Mega Millions Subway Shelter Poster Wrap',
      assetType: 'static_image',
      formatSpecs: 'Transit Sheet Size',
      language: 'English',
      status: 'live',
      approvalStatus: 'approved',
      reviewOwner: 'Legal Team',
      dueDate: new Date('2026-04-20'),
      launchDate: new Date('2026-05-01'),
      complianceNotes: 'Verify 1-877-8-HOPENY problem gambling help text is visible at bottom.'
    }
  });

  // Milestones for Campaign 3
  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign3.id,
      channelId: ch3_1.id,
      assetId: asset3_1.id,
      name: 'Campaign Brief and Creative Concept Approval',
      milestoneType: 'creative',
      owner: 'Marketing Director',
      priority: 'high',
      status: 'completed',
      dueDate: new Date('2026-02-15'),
      completedDate: new Date('2026-02-14')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign3.id,
      channelId: ch3_1.id,
      name: 'Media Flight Launch',
      milestoneType: 'launch',
      owner: 'Havas Representative',
      priority: 'critical',
      status: 'completed',
      dueDate: new Date('2026-05-01'),
      completedDate: new Date('2026-05-01')
    }
  });

  await prisma.campaignMilestone.create({
    data: {
      campaignId: campaign3.id,
      name: 'Mid-Flight Campaign Performance Review',
      milestoneType: 'reporting',
      owner: 'Research Lead',
      priority: 'normal',
      status: 'completed',
      dueDate: new Date('2026-06-15'),
      completedDate: new Date('2026-06-12')
    }
  });


  console.log('✨ Realistic NY Campaigns Seeding successfully completed!');
}

main()
  .catch(e => {
    console.error('Seeding campaigns failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
