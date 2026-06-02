import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Helper to check if user has finance/admin privileges
function isPrivileged(user) {
  const role = user?.role?.name || "";
  return role === "admin" || role === "analyst" || user?.division === "FINANCE" || user?.division === "EXECUTIVE";
}

// GET /api/budget-proposals — Fetch proposals for a fiscal year
export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fy = parseInt(searchParams.get("fiscalYear") || "2027", 10);

  let jurisdictionId = session.user?.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  // Get user details including role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const privileged = isPrivileged(user);

  try {
    if (privileged) {
      // Finance & Admin can see all proposals
      const proposals = await prisma.budgetProposal.findMany({
        where: { jurisdictionId, fiscalYear: fy },
        include: { submittedBy: { select: { name: true, email: true } } }
      });
      return NextResponse.json(proposals);
    } else {
      // Regular division managers can only see their own division's proposal
      let proposal = await prisma.budgetProposal.findFirst({
        where: { jurisdictionId, fiscalYear: fy, division: user.division },
        include: { submittedBy: { select: { name: true, email: true } } }
      });

      if (!proposal) {
        // Automatically create a draft proposal for their division
        proposal = await prisma.budgetProposal.create({
          data: {
            jurisdictionId,
            fiscalYear: fy,
            division: user.division,
            status: "draft",
            proposalData: [],
            submittedById: user.id
          },
          include: { submittedBy: { select: { name: true, email: true } } }
        });
      }
      return NextResponse.json([proposal]);
    }
  } catch (err) {
    console.error("Failed to fetch budget proposals:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/budget-proposals — Save/Update a proposal draft
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { division, fiscalYear, proposalData, notes } = body;

  if (!division || !fiscalYear || !Array.isArray(proposalData)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Division-level Gating: Division managers can only write to their own division
  if (!isPrivileged(user) && user.division !== division) {
    return NextResponse.json({ error: "Forbidden: Cannot edit another division's proposal" }, { status: 403 });
  }

  let jurisdictionId = user.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  try {
    // Upsert the proposal (only if status is draft or rejected - locked if submitted/approved)
    const existing = await prisma.budgetProposal.findFirst({
      where: { jurisdictionId, division, fiscalYear }
    });

    if (existing && (existing.status === "submitted" || existing.status === "approved") && !isPrivileged(user)) {
      return NextResponse.json({ error: "Forbidden: Proposal is locked and cannot be edited" }, { status: 403 });
    }

    const proposal = await prisma.budgetProposal.upsert({
      where: {
        jurisdictionId_division_fiscalYear: {
          jurisdictionId,
          division,
          fiscalYear
        }
      },
      create: {
        jurisdictionId,
        division,
        fiscalYear,
        status: "draft",
        proposalData,
        submittedById: user.id,
        notes: notes || ""
      },
      update: {
        proposalData,
        notes: notes || "",
        status: existing?.status === "rejected" ? "draft" : undefined // Reset status to draft if it was rejected
      }
    });

    return NextResponse.json(proposal);
  } catch (err) {
    console.error("Failed to save budget proposal:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/budget-proposals — Manage workflow transition (Submit, Approve, Reject)
export async function PUT(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, action, reviewNotes } = body; // action = 'submit' | 'approve' | 'reject'

  if (!id || !action) {
    return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const existing = await prisma.budgetProposal.findUnique({
    where: { id }
  });

  if (!existing) {
    return NextResponse.json({ error: "Budget proposal not found" }, { status: 404 });
  }

  try {
    if (action === "submit") {
      // Division leads can submit their own proposal
      if (!isPrivileged(user) && user.division !== existing.division) {
        return NextResponse.json({ error: "Forbidden: Cannot submit another division's proposal" }, { status: 403 });
      }

      const updated = await prisma.budgetProposal.update({
        where: { id },
        data: { status: "submitted" }
      });
      return NextResponse.json(updated);
    } 
    
    if (action === "approve" || action === "reject") {
      // Only Finance or Admins can approve or reject proposals
      if (!isPrivileged(user)) {
        return NextResponse.json({ error: "Forbidden: Only Finance or Executives can approve/reject proposals" }, { status: 403 });
      }

      const newStatus = action === "approve" ? "approved" : "rejected";
      const updated = await prisma.budgetProposal.update({
        where: { id },
        data: { 
          status: newStatus,
          reviewedById: user.id,
          notes: reviewNotes || existing.notes
        }
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("Failed to update proposal workflow:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
