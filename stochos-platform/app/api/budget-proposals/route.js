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
      // Non-privileged users: can be Division Lead or Bureau Chief
      const userBureau = user.bureau || "";
      const userSubunit = user.subunit || "";

      if (!userBureau) {
        // Division Lead: fetch all proposals for their division
        let proposals = await prisma.budgetProposal.findMany({
          where: { jurisdictionId, fiscalYear: fy, division: user.division },
          include: { submittedBy: { select: { name: true, email: true } } }
        });

        // Ensure the division-level proposal itself exists
        let divProposal = proposals.find(p => p.bureau === "" && p.subunit === "");
        if (!divProposal) {
          divProposal = await prisma.budgetProposal.create({
            data: {
              jurisdictionId,
              fiscalYear: fy,
              division: user.division,
              bureau: "",
              subunit: "",
              status: "draft",
              proposalData: [],
              submittedById: user.id
            },
            include: { submittedBy: { select: { name: true, email: true } } }
          });
          proposals.push(divProposal);
        }
        return NextResponse.json(proposals);
      } else {
        // Bureau Chief: fetch only their specific bureau proposal
        let proposal = await prisma.budgetProposal.findFirst({
          where: {
            jurisdictionId,
            fiscalYear: fy,
            division: user.division,
            bureau: userBureau,
            subunit: userSubunit
          },
          include: { submittedBy: { select: { name: true, email: true } } }
        });

        if (!proposal) {
          proposal = await prisma.budgetProposal.create({
            data: {
              jurisdictionId,
              fiscalYear: fy,
              division: user.division,
              bureau: userBureau,
              subunit: userSubunit,
              status: "draft",
              proposalData: [],
              submittedById: user.id
            },
            include: { submittedBy: { select: { name: true, email: true } } }
          });
        }
        return NextResponse.json([proposal]);
      }
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
    const bureau = body.bureau !== undefined ? body.bureau : (user.bureau || "");
    const subunit = body.subunit !== undefined ? body.subunit : (user.subunit || "");

    // Bureau Chief Gating: if user is not privileged and not a division lead,
    // they can only edit their own specific bureau and subunit proposal.
    if (!isPrivileged(user)) {
      const isDivLead = !user.bureau;
      if (!isDivLead) {
        if (bureau !== user.bureau || subunit !== user.subunit) {
          return NextResponse.json({ error: "Forbidden: Bureau Chiefs can only edit their own bureau's proposal" }, { status: 403 });
        }
      }
    }

    // Upsert the proposal (only if status is draft or rejected - locked if submitted/approved)
    const existing = await prisma.budgetProposal.findFirst({
      where: { jurisdictionId, division, bureau, subunit, fiscalYear }
    });

    if (existing && (existing.status === "submitted" || existing.status === "approved") && !isPrivileged(user)) {
      return NextResponse.json({ error: "Forbidden: Proposal is locked and cannot be edited" }, { status: 403 });
    }

    const proposal = await prisma.budgetProposal.upsert({
      where: {
        jurisdictionId_division_bureau_subunit_fiscalYear: {
          jurisdictionId,
          division,
          bureau,
          subunit,
          fiscalYear
        }
      },
      create: {
        jurisdictionId,
        division,
        bureau,
        subunit,
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
      // Division leads can submit their own division proposal, Bureau chiefs can submit theirs
      if (!isPrivileged(user) && user.division !== existing.division) {
        return NextResponse.json({ error: "Forbidden: Cannot submit another division's proposal" }, { status: 403 });
      }

      // If Bureau Chief, they can only submit their own specific bureau proposal
      if (!isPrivileged(user) && user.bureau && (existing.bureau !== user.bureau || existing.subunit !== user.subunit)) {
        return NextResponse.json({ error: "Forbidden: Cannot submit another bureau's proposal" }, { status: 403 });
      }

      const updated = await prisma.budgetProposal.update({
        where: { id },
        data: { status: "submitted" }
      });
      return NextResponse.json(updated);
    } 
    
    if (action === "approve" || action === "reject") {
      const isFinExec = isPrivileged(user);
      const isDivLeadOfThisProp = !isFinExec && user.division === existing.division && (!user.bureau || user.bureau === "");
      const isBureauProp = existing.bureau !== "" || existing.subunit !== "";

      // Allow if:
      // 1. Finance/Exec approving/rejecting any proposal (usually division level)
      // 2. Division Lead approving/rejecting a bureau proposal within their division
      if (!isFinExec && !(isDivLeadOfThisProp && isBureauProp)) {
        return NextResponse.json({ error: "Forbidden: Only Finance, Executives, or Division Leads can approve/reject proposals" }, { status: 403 });
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
