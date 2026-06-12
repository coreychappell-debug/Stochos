import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isPrivileged(user) {
  const role = user?.role?.name || "";
  return role === "admin" || role === "analyst" || user?.division === "FINANCE" || user?.division === "EXECUTIVE";
}

// GET /api/budget-proposals/versions — List all versions of a proposal
export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const proposalId = searchParams.get("proposalId");

  if (!proposalId) {
    return NextResponse.json({ error: "Missing proposalId parameter" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const proposal = await prisma.budgetProposal.findUnique({
    where: { id: proposalId }
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Gating: only division lead or finance/exec can view
  const privileged = isPrivileged(user);
  const isLead = user.division === proposal.division && !user.bureau;
  const isChief = user.division === proposal.division && user.bureau === proposal.bureau && user.subunit === proposal.subunit;

  if (!privileged && !isLead && !isChief) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const versions = await prisma.budgetProposalVersion.findMany({
      where: { proposalId },
      include: {
        createdBy: {
          select: { name: true, email: true }
        }
      },
      orderBy: { versionNumber: "desc" }
    });

    return NextResponse.json(versions);
  } catch (err) {
    console.error("Failed to fetch proposal versions:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/budget-proposals/versions — Restore a specific version
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { proposalId, versionNumber } = body;

  if (!proposalId || versionNumber === undefined) {
    return NextResponse.json({ error: "Missing proposalId or versionNumber" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const proposal = await prisma.budgetProposal.findUnique({
    where: { id: proposalId }
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  // Gating: only division lead or finance/exec can edit
  const privileged = isPrivileged(user);
  const isLead = user.division === proposal.division && !user.bureau;
  const isChief = user.division === proposal.division && user.bureau === proposal.bureau && user.subunit === proposal.subunit;

  if (!privileged && !isLead && !isChief) {
    return NextResponse.json({ error: "Forbidden: Cannot edit this proposal" }, { status: 403 });
  }

  if ((proposal.status === "submitted" || proposal.status === "approved") && !privileged) {
    return NextResponse.json({ error: "Forbidden: Proposal is locked and cannot be edited" }, { status: 403 });
  }

  try {
    const version = await prisma.budgetProposalVersion.findUnique({
      where: {
        proposalId_versionNumber: {
          proposalId,
          versionNumber: parseInt(versionNumber, 10)
        }
      }
    });

    if (!version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // 1. Create a backup snapshot of the CURRENT proposalData before overwrite so they can undo the restore!
    const currentVersionCount = await prisma.budgetProposalVersion.count({
      where: { proposalId }
    });
    const newBackupVersionNumber = currentVersionCount + 1;
    await prisma.budgetProposalVersion.create({
      data: {
        proposalId,
        versionNumber: newBackupVersionNumber,
        proposalData: proposal.proposalData,
        notes: `Backup snapshot prior to restoring version v${versionNumber}.`,
        createdById: user.id
      }
    });

    // 2. Overwrite the proposalData with the chosen version
    const updated = await prisma.budgetProposal.update({
      where: { id: proposalId },
      data: {
        proposalData: version.proposalData,
        notes: `Restored version v${versionNumber} on ${new Date().toLocaleDateString()}.`
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to restore proposal version:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
