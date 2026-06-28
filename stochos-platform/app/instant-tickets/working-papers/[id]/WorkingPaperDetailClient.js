"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Plus, Trash2, CheckCircle2, AlertTriangle, FileText, LayoutGrid, Check, Info } from "lucide-react";
import DocumentEditor from "@/app/components/tiptap/DocumentEditor";

// Predefined NYSGC Game templates based on price categories
const NY_GAME_TEMPLATES = {
  1: [
    { prizeValue: 1, description: "1 x $1 (Single)", winnerCount: 1000000 },
    { prizeValue: 2, description: "1 x $2 (Single)", winnerCount: 400000 },
    { prizeValue: 2, description: "2 x $1 (Double)", winnerCount: 200000 },
    { prizeValue: 5, description: "1 x $5 (Single)", winnerCount: 120000 },
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 40000 },
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 8000 },
    { prizeValue: 50, description: "10 x $5 (Win All)", winnerCount: 1500 },
    { prizeValue: 100, description: "1 x $100 (Single)", winnerCount: 400 },
    { prizeValue: 5000, description: "Top Prize", winnerCount: 8 }
  ],
  2: [
    { prizeValue: 2, description: "1 x $2 (Single)", winnerCount: 800000 },
    { prizeValue: 4, description: "1 x $4 (Single)", winnerCount: 300000 },
    { prizeValue: 4, description: "2 x $2 (Double)", winnerCount: 200000 },
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 100000 },
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 40000 },
    { prizeValue: 50, description: "5X Multiplier w/ $10", winnerCount: 5000 },
    { prizeValue: 100, description: "10 x $10 (Win All)", winnerCount: 1200 },
    { prizeValue: 500, description: "1 x $500 (Single)", winnerCount: 150 },
    { prizeValue: 20000, description: "Top Prize", winnerCount: 4 }
  ],
  5: [
    { prizeValue: 5, description: "1 x $5 (Single)", winnerCount: 600000 },
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 300000 },
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 80000 },
    { prizeValue: 20, description: "2X Multiplier w/ $10", winnerCount: 40000 },
    { prizeValue: 50, description: "10 x $5 (Win All)", winnerCount: 20000 },
    { prizeValue: 100, description: "5X Multiplier w/ $20", winnerCount: 8000 },
    { prizeValue: 500, description: "1 x $500 (Single)", winnerCount: 400 },
    { prizeValue: 1000, description: "10 x $100 (Win All)", winnerCount: 80 },
    { prizeValue: 50000, description: "1 x $50,000", winnerCount: 6 },
    { prizeValue: 500000, description: "Top Prize", winnerCount: 2 }
  ],
  10: [
    { prizeValue: 10, description: "1 x $10 (Single)", winnerCount: 500000 },
    { prizeValue: 20, description: "1 x $20 (Single)", winnerCount: 250000 },
    { prizeValue: 30, description: "3 x $10 (Triple)", winnerCount: 100000 },
    { prizeValue: 50, description: "10 x $5 (Win All)", winnerCount: 70000 },
    { prizeValue: 100, description: "5X Multiplier w/ $20", winnerCount: 20000 },
    { prizeValue: 100, description: "10X Multiplier w/ $10", winnerCount: 10000 },
    { prizeValue: 200, description: "20 x $10 (Win All)", winnerCount: 4000 },
    { prizeValue: 500, description: "1 x $500 (Single)", winnerCount: 1200 },
    { prizeValue: 1000, description: "10 x $100", winnerCount: 250 },
    { prizeValue: 10000, description: "10 x $1,000", winnerCount: 15 },
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
    { prizeValue: 10000, description: "1 x $10,000 (Single)", winnerCount: 40 },
    { prizeValue: 5000000, description: "Top Prize", winnerCount: 2 }
  ],
  30: [
    { prizeValue: 30, description: "1 x $30 (Single)", winnerCount: 300000 },
    { prizeValue: 50, description: "1 x $50 (Single)", winnerCount: 120000 },
    { prizeValue: 100, description: "1 x $100 (Single)", winnerCount: 70000 },
    { prizeValue: 200, description: "10 x $20 (Win All)", winnerCount: 35000 },
    { prizeValue: 500, description: "5X Multiplier w/ $100", winnerCount: 8000 },
    { prizeValue: 1000, description: "10X Multiplier w/ $100", winnerCount: 1800 },
    { prizeValue: 5000, description: "1 x $5,000 (Single)", winnerCount: 80 },
    { prizeValue: 10000, description: "10 x $1,000 (Win All)", winnerCount: 20 },
    { prizeValue: 2000000, description: "Top Prize", winnerCount: 2 }
  ],
  50: [
    { prizeValue: 50, description: "1 x $50 (Single)", winnerCount: 300000 },
    { prizeValue: 100, description: "1 x $100 (Single)", winnerCount: 150000 },
    { prizeValue: 200, description: "1 x $200 (Single)", winnerCount: 60000 },
    { prizeValue: 500, description: "10X Multiplier w/ $50", winnerCount: 15000 },
    { prizeValue: 1000, description: "20X Multiplier w/ $50", winnerCount: 3000 },
    { prizeValue: 5000, description: "1 x $5,000 (Single)", winnerCount: 180 },
    { prizeValue: 10000, description: "1 x $10,000 (Single)", winnerCount: 45 },
    { prizeValue: 10000000, description: "Top Prize", winnerCount: 1 }
  ]
};

// Autocomplete play style ways to win options
const PLAY_STYLE_HELPERS = [
  { category: "Key Number Match", items: ["1 x $X (Single)", "2 x $X", "5 x $X", "10 x $X", "20 x $X", "Win All (All Prizes)"] },
  { category: "Multipliers", items: ["2X Multiplier w/ $X", "5X Multiplier w/ $X", "10X Multiplier w/ $X", "20X Multiplier w/ $X", "50X Multiplier w/ $X", "100X Multiplier w/ $X", "200X Multiplier w/ $X"] },
  { category: "Symbol Auto-Wins", items: ["Auto-Win [Moneybag] w/ $X", "Auto-Win [Coin] w/ $X", "Auto-Win [Star] w/ $X", "Double Win [Double Symbol]"] },
  { category: "Grid/Extended Play", items: ["Bingo Line", "Bingo Four Corners", "Bingo Letter X", "3 Words (Crossword)", "4 Words (Crossword)", "5 Words (Crossword)", "6 Words (Crossword)", "7 Words (Crossword)"] },
  { category: "Add Up Games", items: ["Beat the Dealer Score", "Add Up to 21", "Sum of Cards"] }
];

export default function WorkingPaperDetailClient({ workingPaper, plannedGames = [] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("builder"); // "builder" or "contract"

  // Working Paper State
  const [name, setName] = useState(workingPaper.name);
  const [gameNumber, setGameNumber] = useState(workingPaper.gameNumber);
  const [denomination, setDenomination] = useState(workingPaper.denomination);
  const [printRun, setPrintRun] = useState(Number(workingPaper.printRun));
  const [status, setStatus] = useState(workingPaper.status);
  const [coSignedDate, setCoSignedDate] = useState(workingPaper.coSignedDate ? workingPaper.coSignedDate.substring(0, 10) : "");
  const [documentContent, setDocumentContent] = useState(workingPaper.documentContent || "");
  const [syncToGame, setSyncToGame] = useState(true);
  const [gameId, setGameId] = useState(workingPaper.gameId || "");

  const selectedGame = plannedGames.find(g => g.id === gameId);
  const initialManualPayout = workingPaper.game 
    ? parseFloat(workingPaper.game.payoutPercent)
    : (Number(workingPaper.printRun) && workingPaper.denomination && parseFloat(workingPaper.plannedPrizeExpense) > 0
      ? (parseFloat(workingPaper.plannedPrizeExpense) / (Number(workingPaper.printRun) * workingPaper.denomination)) * 100
      : 65.0);
  const [manualPlannedPayout, setManualPlannedPayout] = useState(initialManualPayout);

  // Prize Tiers state
  const [prizeTiers, setPrizeTiers] = useState(
    workingPaper.prizeTiers.map(t => ({
      id: t.id,
      prizeValue: parseFloat(t.prizeValue),
      description: t.description || "",
      winnerCount: Number(t.winnerCount)
    }))
  );

  // Active Dropdown Helper state
  const [activeHelperRow, setActiveHelperRow] = useState(null);

  // Save handling
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // 'success', 'error'

  // Live Calculations
  const grossSales = printRun * denomination;
  
  const totalPayout = prizeTiers.reduce((sum, t) => sum + (t.prizeValue * t.winnerCount), 0);
  const totalWinners = prizeTiers.reduce((sum, t) => sum + BigInt(t.winnerCount), BigInt(0));

  const actualPayoutPercent = grossSales > 0 ? (totalPayout / grossSales) * 100 : 0;
  const overallOdds = totalWinners > BigInt(0) ? Number(printRun) / Number(totalWinners) : 0;

  // Retail Cashability Rate
  const retailCashablePayout = prizeTiers
    .filter(t => t.prizeValue < 600)
    .reduce((sum, t) => sum + (t.prizeValue * t.winnerCount), 0);
  
  const retailCashabilityRate = totalPayout > 0 ? (retailCashablePayout / totalPayout) * 100 : 0;

  // Planned Payout Difference (derived from selected game or manual input)
  const plannedPayout = selectedGame ? parseFloat(selectedGame.payoutPercent) : manualPlannedPayout;
  const targetPrizeFund = grossSales * (plannedPayout / 100);
  const variance = totalPayout - targetPrizeFund;

  const handleAddRow = () => {
    setPrizeTiers([
      ...prizeTiers,
      {
        id: `temp-${Date.now()}-${Math.random()}`,
        prizeValue: 0,
        description: "1 x $0",
        winnerCount: 0
      }
    ]);
  };

  const handleRemoveRow = (index) => {
    const updated = [...prizeTiers];
    updated.splice(index, 1);
    setPrizeTiers(updated);
  };

  const handleRowChange = (index, field, value) => {
    const updated = [...prizeTiers];
    if (field === "prizeValue") {
      updated[index].prizeValue = parseFloat(value) || 0;
    } else if (field === "winnerCount") {
      updated[index].winnerCount = parseInt(value, 10) || 0;
    } else {
      updated[index][field] = value;
    }
    setPrizeTiers(updated);
  };

  const loadTemplate = () => {
    const template = NY_GAME_TEMPLATES[denomination];
    if (!template) {
      alert(`No template predefined for denomination $${denomination}.`);
      return;
    }

    if (confirm(`This will overwrite your current prize tiers with the standard NYSGC $${denomination} game template. Continue?`)) {
      // Calculate realistic counts based on target print run scale relative to template's baseline
      const baselineRuns = { 1: 10000000, 2: 8000000, 5: 6000000, 10: 5000000, 20: 4000000, 30: 3000000, 50: 3000000 };
      const baseline = baselineRuns[denomination] || 5000000;
      const scale = printRun / baseline;

      const loadedTiers = template.map((t, idx) => ({
        id: `template-${idx}-${Date.now()}`,
        prizeValue: t.prizeValue,
        description: t.description,
        winnerCount: Math.max(1, Math.round(t.winnerCount * scale))
      }));
      setPrizeTiers(loadedTiers);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    const payload = {
      name,
      gameNumber,
      denomination,
      printRun,
      status,
      coSignedDate: coSignedDate || null,
      documentContent,
      syncToGame,
      gameId: gameId || null,
      prizeTiers: prizeTiers.map(t => ({
        prizeValue: t.prizeValue,
        description: t.description,
        winnerCount: t.winnerCount
      }))
    };

    try {
      const res = await fetch(`/api/instant-tickets/working-papers/${workingPaper.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Failed to save changes");
      
      setSaveStatus("success");
      router.refresh();
    } catch (err) {
      console.error(err);
      setSaveStatus("error");
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  function fmt$(val) {
    if (val === undefined || val === null) return "—";
    const num = parseFloat(val);
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(2) + "M";
    return "$" + num.toLocaleString("en-US");
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toLocaleString("en-US");
  }

  return (
    <div>
      {/* Top action bar */}
      <div className="page-header flex justify-between items-center" style={{ marginBottom: "16px" }}>
        <div className="flex gap-3 items-center">
          <Link href="/instant-tickets/working-papers" className="btn btn-secondary flex items-center justify-center" style={{ width: "36px", height: "36px", padding: 0, borderRadius: "50%" }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex gap-2 items-center">
              <h2 style={{ margin: 0 }}>Game #{gameNumber} — {name}</h2>
              <span className={`badge ${
                status === "executed" ? "badge-active" : 
                status === "pending_approval" ? "badge-submitted" : "badge-draft"
              }`}>
                {status === "executed" ? "Executed" : status === "pending_approval" ? "Pending Approval" : "Draft"}
              </span>
            </div>
            <p className="text-sm muted" style={{ margin: 0 }}>
              {selectedGame ? (
                <>Linked to Planned Scenario: <strong>{selectedGame.scenario.plan.name} ({selectedGame.scenario.name})</strong></>
              ) : (
                <>Standalone Scratch Game Specification</>
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          {saveStatus === "success" && (
            <span className="text-sm flex gap-1 items-center" style={{ color: "var(--success)", fontWeight: 500 }}>
              <CheckCircle2 size={16} /> Changes saved successfully!
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-sm flex gap-1 items-center" style={{ color: "var(--danger)", fontWeight: 500 }}>
              <AlertTriangle size={16} /> Error saving changes.
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn btn-primary flex gap-1 items-center"
          >
            <Save size={16} /> {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Inline Metadata Form Card */}
      <div className="card" style={{ marginBottom: "16px", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px" }}>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Game Title</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Game Number</label>
            <input
              type="text"
              value={gameNumber}
              onChange={e => setGameNumber(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Price (Denomination)</label>
            <select
              value={denomination}
              onChange={e => setDenomination(parseInt(e.target.value, 10))}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)", cursor: "pointer" }}
            >
              {[1, 2, 3, 5, 10, 20, 25, 30, 50].map(v => (
                <option key={v} value={v}>${v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Print Run (Tickets)</label>
            <input
              type="number"
              value={printRun}
              onChange={e => setPrintRun(parseInt(e.target.value, 10) || 0)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            />
          </div>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Associated Game Plan</label>
            <select
              value={gameId}
              onChange={e => {
                const newGameId = e.target.value;
                setGameId(newGameId);
                const gameObj = plannedGames.find(g => g.id === newGameId);
                if (gameObj) {
                  setName(gameObj.name);
                  setGameNumber(gameObj.gameNumber);
                  setDenomination(gameObj.denomination);
                  setPrintRun(Number(gameObj.units));
                  setManualPlannedPayout(parseFloat(gameObj.payoutPercent));
                }
              }}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)", cursor: "pointer" }}
            >
              <option value="">None (Standalone)</option>
              {plannedGames.map(g => (
                <option key={g.id} value={g.id}>
                  [{g.scenario.plan.name} - {g.scenario.name}] Game #{g.gameNumber} - {g.name}
                </option>
              ))}
            </select>
          </div>
          {!gameId && (
            <div>
              <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Planned Payout %</label>
              <input
                type="number"
                step="0.01"
                value={manualPlannedPayout}
                onChange={e => setManualPlannedPayout(parseFloat(e.target.value) || 0)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
              />
            </div>
          )}
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)", cursor: "pointer" }}
            >
              <option value="draft">Draft</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="executed">Executed (Approved)</option>
            </select>
          </div>
          <div>
            <label className="text-xs muted" style={{ fontWeight: 600, display: "block", marginBottom: "4px" }}>Co-Signed Date</label>
            <input
              type="date"
              value={coSignedDate}
              onChange={e => setCoSignedDate(e.target.value)}
              style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            />
          </div>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex gap-2" style={{ marginBottom: "16px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
        <button
          onClick={() => setActiveTab("builder")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold cursor-pointer`}
          style={{
            border: "none",
            background: "none",
            borderBottom: activeTab === "builder" ? "2.5px solid var(--primary)" : "none",
            color: activeTab === "builder" ? "var(--primary)" : "var(--text-secondary)",
            transition: "all 0.15s ease"
          }}
        >
          <LayoutGrid size={16} /> Prize Structure Builder
        </button>
        <button
          onClick={() => setActiveTab("contract")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold cursor-pointer`}
          style={{
            border: "none",
            background: "none",
            borderBottom: activeTab === "contract" ? "2.5px solid var(--primary)" : "none",
            color: activeTab === "contract" ? "var(--primary)" : "var(--text-secondary)",
            transition: "all 0.15s ease"
          }}
        >
          <FileText size={16} /> Contract Language Editor
        </button>
      </div>

      {/* BUILDER TAB CONTENT */}
      {activeTab === "builder" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Balancer Board KPIs */}
          <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Actual Payout Rate</div>
              <div className="flex justify-between items-end">
                <span className="kpi-value">{actualPayoutPercent.toFixed(2)}%</span>
                <span className="text-xs muted" style={{ marginBottom: "6px" }}>Planned: {plannedPayout.toFixed(2)}%</span>
              </div>
              
              {workingPaper.game && (
                <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ display: "flex", gap: "6px", alignItems: "center", cursor: "pointer", fontSize: "11px", color: "var(--text-secondary)" }}>
                    <input
                      type="checkbox"
                      checked={syncToGame}
                      onChange={e => setSyncToGame(e.target.checked)}
                    />
                    <span>Override Plan Payout %</span>
                  </label>
                  {Math.abs(actualPayoutPercent - plannedPayout) < 0.05 ? (
                    <span className="flex gap-1 items-center text-xs" style={{ color: "var(--success)", fontWeight: 600 }}>
                      <Check size={12} /> Balanced
                    </span>
                  ) : (
                    <span className="flex gap-1 items-center text-xs" style={{ color: "var(--gold)", fontWeight: 600 }}>
                      ⚠️ Out of Balance
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Calculated Prize Fund</div>
              <div className="kpi-value">{fmt$(totalPayout)}</div>
              <div className="text-xs muted" style={{ marginTop: "4px" }}>
                Variance: <span style={{ color: variance >= 0 ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                  {variance >= 0 ? "+" : ""}{fmt$(variance)}
                </span>
              </div>
            </div>

            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Overall Winning Odds</div>
              <div className="kpi-value">{overallOdds > 0 ? `1 in ${overallOdds.toFixed(2)}` : "—"}</div>
              <div className="text-xs muted" style={{ marginTop: "4px" }}>
                Total Winners: {fmtUnits(totalWinners)}
              </div>
            </div>

            <div className="kpi-card" style={{ borderColor: retailCashabilityRate < 75 ? "var(--danger)" : "var(--border)" }}>
              <div className="kpi-label" style={{ color: retailCashabilityRate < 75 ? "var(--danger)" : "var(--text-secondary)" }}>
                Retail Cashability Rate
              </div>
              <div className="kpi-value" style={{ color: retailCashabilityRate < 75 ? "var(--danger)" : "var(--text)" }}>
                {retailCashabilityRate.toFixed(1)}%
              </div>
              <div className="text-xs muted" style={{ marginTop: "4px" }}>
                {retailCashabilityRate < 75 ? (
                  <span style={{ color: "var(--danger)", fontWeight: 500 }}>⚠️ Below 75% Target! Player reinvestment may drop.</span>
                ) : (
                  <span>Healthy. Payouts under $600: {fmt$(retailCashablePayout)}</span>
                )}
              </div>
            </div>
          </div>

          {/* Builder Table Card */}
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <div>
                <h3>Prize Structure Specifications</h3>
                <p className="text-xs muted" style={{ margin: 0 }}>Design individual prize tiers, win combinations, and winner allocations.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={loadTemplate}
                  className="btn btn-secondary flex items-center gap-1 text-xs"
                >
                  Load NYSGC Template
                </button>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="btn btn-primary flex items-center gap-1 text-xs"
                >
                  <Plus size={14} /> Add Row
                </button>
              </div>
            </div>

            <div className="card-body" style={{ overflowX: "visible" }}>
              <table className="data-table" style={{ overflow: "visible" }}>
                <thead>
                  <tr>
                    <th style={{ width: "160px" }}>Prize Value ($)</th>
                    <th>Winning Combination (Description)</th>
                    <th style={{ width: "160px" }}>Winner Count</th>
                    <th style={{ width: "160px" }}>Total Payout</th>
                    <th style={{ width: "130px" }}>Tier Odds</th>
                    <th style={{ width: "60px" }}></th>
                  </tr>
                </thead>
                <tbody style={{ overflow: "visible" }}>
                  {prizeTiers.map((tier, idx) => {
                    const rowPayout = tier.prizeValue * tier.winnerCount;
                    const rowOdds = tier.winnerCount > 0 ? printRun / tier.winnerCount : 0;
                    const requiresW2G = tier.prizeValue >= 600;

                    return (
                      <tr key={tier.id} style={{ overflow: "visible" }}>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>$</span>
                              <input
                                type="number"
                                className="form-control text-right"
                                value={tier.prizeValue || ""}
                                onChange={e => handleRowChange(idx, "prizeValue", e.target.value)}
                                style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                              />
                            </div>
                            {requiresW2G && (
                              <span className="text-2xs" style={{ color: "var(--danger)", fontWeight: 500, display: "flex", gap: "2px", alignItems: "center" }}>
                                ⚠️ Claim-Only (W-2G)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ position: "relative", overflow: "visible" }}>
                          <input
                            type="text"
                            placeholder="e.g. 10X Multiplier w/ $10"
                            className="form-control"
                            value={tier.description}
                            onChange={e => handleRowChange(idx, "description", e.target.value)}
                            onFocus={() => setActiveHelperRow(idx)}
                            onBlur={() => setTimeout(() => setActiveHelperRow(null), 250)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                          />

                          {/* Ways to win Helper Autocomplete Dropdown */}
                          {activeHelperRow === idx && (
                            <div style={{
                              position: "absolute",
                              left: "10px",
                              right: "10px",
                              backgroundColor: "var(--surface-1)",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                              zIndex: 100,
                              maxHeight: "200px",
                              overflowY: "auto",
                              padding: "8px",
                              ...(idx >= prizeTiers.length - 2 && prizeTiers.length > 2
                                ? { bottom: "100%", marginBottom: "4px" }
                                : { top: "100%", marginTop: "4px" })
                            }}>
                              <div className="text-2xs uppercase muted font-semibold" style={{ padding: "4px 8px", borderBottom: "1px solid var(--border)", marginBottom: "4px" }}>
                                Play Style Ways to Win Picker
                              </div>
                              {PLAY_STYLE_HELPERS.map(g => (
                                <div key={g.category} style={{ marginBottom: "8px" }}>
                                  <div className="text-xs font-semibold" style={{ padding: "2px 8px", color: "var(--primary)" }}>{g.category}</div>
                                  {g.items.map(item => {
                                    // Replace placeholder $X with tier's prize value
                                    const displayText = item.replace("$X", `$${tier.prizeValue}`);
                                    return (
                                      <div
                                        key={item}
                                        onClick={() => handleRowChange(idx, "description", displayText)}
                                        style={{
                                          padding: "4px 12px", fontSize: "12px", cursor: "pointer",
                                          borderRadius: "4px", transition: "background 0.1s"
                                        }}
                                        className="dropdown-item-hover"
                                      >
                                        {displayText}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            value={tier.winnerCount || ""}
                            onChange={e => handleRowChange(idx, "winnerCount", e.target.value)}
                            style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                          />
                        </td>
                        <td className="text-right" style={{ fontWeight: 500 }}>
                          {fmt$(rowPayout)}
                        </td>
                        <td>
                          {rowOdds > 0 ? `1 in ${rowOdds.toLocaleString("en-US", { maximumFractionDigits: 1 })}` : "—"}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="btn btn-danger"
                            style={{ padding: "4px 8px" }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTRACT LANGUAGE EDITOR TAB CONTENT */}
      {activeTab === "contract" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div className="card" style={{ padding: "16px" }}>
            <div className="flex gap-2 items-center" style={{ marginBottom: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "8px" }}>
              <Info size={16} style={{ color: "var(--primary)" }} />
              <span className="text-sm muted">
                Review and update the co-signed legal text, validation rules, claim policies, and play instructions. This text exports directly inside official Commission binders.
              </span>
            </div>
            
            <div style={{ minHeight: "450px", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
              <DocumentEditor
                initialContent={documentContent}
                onChange={(html) => setDocumentContent(html)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
