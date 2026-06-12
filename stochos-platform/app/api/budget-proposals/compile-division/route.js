import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export const dynamic = "force-dynamic";

function isPrivileged(user) {
  const role = user?.role?.name || "";
  return role === "admin" || role === "analyst" || user?.division === "FINANCE" || user?.division === "EXECUTIVE";
}

// POST /api/budget-proposals/compile-division — Compile approved bureau proposals into division-level draft
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { division, fiscalYear } = body;

  if (!division || !fiscalYear) {
    return NextResponse.json({ error: "Missing division or fiscalYear" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let jurisdictionId = user.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  const isFinExec = isPrivileged(user);
  const isDivLead = user.division === division && (!user.bureau || user.bureau === "");

  if (!isFinExec && !isDivLead) {
    return NextResponse.json({ error: "Forbidden: Only the Division Lead or Finance can compile this budget" }, { status: 403 });
  }

  // Acquire lock
  const lockKey = `compile-division-${jurisdictionId}-${division}-${fiscalYear}`;
  const lockResult = await acquireLock(
    lockKey,
    user.id,
    user.name,
    `Consolidate Division ${division} FY${fiscalYear}`,
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  // Fire-and-forget background execution
  Promise.resolve().then(async () => {
    try {
      // Fetch all approved bureau-level proposals for this division and fiscal year
      const approvedBureaus = await prisma.budgetProposal.findMany({
        where: {
          jurisdictionId,
          fiscalYear,
          division,
          status: "approved",
          NOT: {
            bureau: "",
            subunit: ""
          }
        }
      });

      if (approvedBureaus.length === 0) {
        console.warn("[compile-division] No approved bureau proposals found to compile.");
        return;
      }

      // Aggregate all line items
      let compiledLines = [];
      for (const bureauProp of approvedBureaus) {
        const bureauName = bureauProp.bureau;
        const subunitName = bureauProp.subunit;
        const prefix = `[${bureauName}${subunitName ? ` - ${subunitName}` : ""}]`;

        const lines = Array.isArray(bureauProp.proposalData) ? bureauProp.proposalData : [];
        for (const line of lines) {
          compiledLines.push({
            category: line.category || "General",
            desc: `${prefix} ${line.desc || ""}`,
            amount: parseFloat(line.amount || 0),
            contractId: line.contractId || ""
          });
        }
      }

      // Find existing proposal to backup
      const existingProposal = await prisma.budgetProposal.findFirst({
        where: {
          jurisdictionId,
          division,
          bureau: "",
          subunit: "",
          fiscalYear
        }
      });

      if (existingProposal && Array.isArray(existingProposal.proposalData) && existingProposal.proposalData.length > 0) {
        const versionCount = await prisma.budgetProposalVersion.count({
          where: { proposalId: existingProposal.id }
        });
        const versionNumber = versionCount + 1;
        await prisma.budgetProposalVersion.create({
          data: {
            proposalId: existingProposal.id,
            versionNumber,
            proposalData: existingProposal.proposalData,
            notes: existingProposal.notes || `Backup snapshot prior to compilation on ${new Date().toLocaleDateString()}.`,
            createdById: user.id
          }
        });
      }

      // Upsert the consolidated division proposal (bureau: "", subunit: "")
      await prisma.budgetProposal.upsert({
        where: {
          jurisdictionId_division_bureau_subunit_fiscalYear: {
            jurisdictionId,
            division,
            bureau: "",
            subunit: "",
            fiscalYear
          }
        },
        create: {
          jurisdictionId,
          division,
          bureau: "",
          subunit: "",
          fiscalYear,
          status: "draft",
          proposalData: compiledLines,
          submittedById: user.id,
          notes: `Compiled automatically from ${approvedBureaus.length} approved bureau proposals.`
        },
        update: {
          proposalData: compiledLines,
          status: "draft", // Reset to draft so division lead can edit/submit
          notes: `Re-compiled automatically from ${approvedBureaus.length} approved bureau proposals.`
        }
      });
    } catch (err) {
      console.error("Failed to compile division budget in background:", err);
    } finally {
      await releaseLock(lockKey);
    }
  });

  return NextResponse.json({
    success: true,
    message: "Division proposal compile job successfully dispatched in the background."
  }, { status: 202 });
}

