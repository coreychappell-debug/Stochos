import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

const TEMPLATE_SPECS = {
  new_game_launch: [
    { name: "Agency Briefing", type: "creative", offset: -90, priority: "normal" },
    { name: "Concepts & Script Approval", type: "creative", offset: -75, priority: "high" },
    { name: "Media Plan Approved", type: "media_buy", offset: -60, priority: "high" },
    { name: "Legal & Compliance Review", type: "legal_review", offset: -45, priority: "critical" },
    { name: "Production & Shoots Completed", type: "creative", offset: -30, priority: "high" },
    { name: "Ticket Delivery to Retailers", type: "retail_delivery", offset: -15, priority: "critical" },
    { name: "Launch Date & Ads Live", type: "launch", offset: 0, priority: "critical" },
    { name: "Post-Launch Sales Audit", type: "reporting", offset: 30, priority: "normal" },
  ],
  jackpot_awareness: [
    { name: "Asset Template Approval", type: "creative", offset: -14, priority: "high" },
    { name: "Bidding & Placement Scheduled", type: "media_buy", offset: -10, priority: "high" },
    { name: "Digital Ads Live (Triggered)", type: "launch", offset: 0, priority: "critical" },
    { name: "Daily Cost Reconciliation", type: "reporting", offset: 7, priority: "normal" },
  ],
  seasonal_brand: [
    { name: "Concept Selection", type: "creative", offset: -120, priority: "normal" },
    { name: "Co-op Retail Promotion Setup", type: "retail_delivery", offset: -90, priority: "normal" },
    { name: "Print POS Production", type: "creative", offset: -45, priority: "high" },
    { name: "Broadcast Traffic Delivered", type: "launch", offset: -14, priority: "high" },
  ],
};

export async function POST(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { templateType } = body;

  if (!templateType || !TEMPLATE_SPECS[templateType]) {
    return NextResponse.json({ error: "Invalid template type" }, { status: 400 });
  }

  // Fetch campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const baseDate = campaign.startDate ? new Date(campaign.startDate) : new Date();

  // Generate milestones within a transaction
  const createdMilestones = await prisma.$transaction(async (tx) => {
    const specs = TEMPLATE_SPECS[templateType];
    const results = [];

    for (const spec of specs) {
      // Calculate due date based on offset days
      const dueDate = new Date(baseDate.getTime() + spec.offset * 24 * 60 * 60 * 1000);

      const milestone = await tx.campaignMilestone.create({
        data: {
          campaignId: id,
          name: spec.name,
          milestoneType: spec.type,
          priority: spec.priority,
          status: "not_started",
          dueDate,
          notes: `Auto-generated from ${templateType.replace(/_/g, " ")} template.`,
        },
      });
      results.push(milestone);
    }

    // Write audit log
    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        entityType: "campaign",
        entityId: id,
        action: "load_milestone_template",
        changes: {
          templateType,
          milestoneCount: results.length,
        },
      },
    });

    return results;
  });

  return NextResponse.json(createdMilestones, { status: 201 });
}
