import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get user details
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check division access (only IT or admin/privileged users can trigger this)
  const isItOrAdmin = user.division === "IT" || user.division === "EXECUTIVE" || user.division === "FINANCE" || user.role?.name === "admin";
  if (!isItOrAdmin) {
    return NextResponse.json({ error: "Forbidden: Only IT or Executive Administrators can sync IT assets." }, { status: 403 });
  }

  let jurisdictionId = user.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  try {
    const { searchParams } = new URL(request.url);
    const fy = parseInt(searchParams.get("fiscalYear") || "2027", 10);

    // 1. Query active computer and mobile assets for the jurisdiction
    const activeAssets = await prisma.asset.findMany({
      where: {
        jurisdictionId,
        status: { not: "retired" },
        category: { in: ["computer", "mobile"] }
      }
    });

    const currentDate = new Date();

    // 2. Filter assets that are past their useful life (EOL)
    const expiredAssets = activeAssets.filter(a => {
      const start = a.purchaseDate ? new Date(a.purchaseDate) : new Date(a.createdAt);
      const usefulMonths = a.usefulLifeMonths || 36;
      const end = new Date(start);
      end.setMonth(end.getMonth() + usefulMonths);
      return end <= currentDate;
    });

    // 3. Aggregate replacement counts and costs by category
    const categories = {
      computer: { count: 0, cost: 0, desc: "computers (laptops/desktops)" },
      mobile: { count: 0, cost: 0, desc: "mobile devices (cell phones)" }
    };

    for (const a of expiredAssets) {
      if (categories[a.category]) {
        categories[a.category].count++;
        categories[a.category].cost += a.value ? parseFloat(a.value) : 0;
      }
    }

    // 4. Create the new budget proposal ledger lines
    const importLines = [];
    if (categories.computer.count > 0) {
      importLines.push({
        category: "Equipment & Capital Outlay",
        desc: `IT Asset Cycle Replacement: ${categories.computer.count} EOL ${categories.computer.desc}`,
        amount: categories.computer.cost,
        contractId: "" // Not tied to specific contract initially
      });
    }
    if (categories.mobile.count > 0) {
      importLines.push({
        category: "Equipment & Capital Outlay",
        desc: `IT Asset Cycle Replacement: ${categories.mobile.count} EOL ${categories.mobile.desc}`,
        amount: categories.mobile.cost,
        contractId: ""
      });
    }

    const bureau = user.bureau || "";
    const subunit = user.subunit || "";

    // 5. Look up existing IT budget proposal
    const existing = await prisma.budgetProposal.findFirst({
      where: { jurisdictionId, division: "IT", bureau, subunit, fiscalYear: fy }
    });

    if (existing && (existing.status === "submitted" || existing.status === "approved")) {
      return NextResponse.json({ error: "Forbidden: Budget proposal for IT is locked (submitted or approved) and cannot be updated." }, { status: 403 });
    }

    let newProposalData = [];
    if (existing && Array.isArray(existing.proposalData)) {
      // Remove any previously auto-injected IT Asset replacement lines to prevent duplicates
      const filteredExisting = existing.proposalData.filter(item => 
        !item.desc.startsWith("IT Asset Cycle Replacement:")
      );
      newProposalData = [...importLines, ...filteredExisting];
    } else {
      newProposalData = importLines;
    }

    // 6. Upsert the budget proposal
    const proposal = await prisma.budgetProposal.upsert({
      where: {
        jurisdictionId_division_bureau_subunit_fiscalYear: {
          jurisdictionId,
          division: "IT",
          bureau,
          subunit,
          fiscalYear: fy
        }
      },
      create: {
        jurisdictionId,
        division: "IT",
        bureau,
        subunit,
        fiscalYear: fy,
        status: "draft",
        proposalData: newProposalData,
        submittedById: user.id,
        notes: `Imported EOL lifecycle hardware replacement needs dynamically from IT Assets module.`
      },
      update: {
        proposalData: newProposalData,
        notes: existing?.notes || `Imported EOL lifecycle hardware replacement needs dynamically from IT Assets module.`
      }
    });

    return NextResponse.json({
      success: true,
      injectedCount: importLines.length,
      computersReplaced: categories.computer.count,
      computersCost: categories.computer.cost,
      mobilesReplaced: categories.mobile.count,
      mobilesCost: categories.mobile.cost,
      proposal
    });

  } catch (err) {
    console.error("Failed to sync EOL assets to IT budget:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
