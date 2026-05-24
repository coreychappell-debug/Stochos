# Fiscal Year Marketing Contract Manager - Instruction Manual

Welcome to the Marketing Contract Manager (Fiscal Year Planner)! This tool is an interactive, browser-based Progressive Web Application (PWA) designed to help you project and manage your marketing scratcher game runs, features, and pricing across multiple hardware vendors.

## 🚀 Getting Started

This application is completely "Local-First". You do not need an internet connection or a database to run it. 

1. **Open the Tool:** Simply double-click on `MarketingContract-5.html`. It will open and run directly in any modern web browser.
2. **Offline Capable:** Because it relies entirely on your browser, all mathematical calculations and logic happen securely on your own machine.
3. **Autosave Engine:** The tool continuously auto-saves your progress in the background to your browser's local storage. A "Saved ✓" indicator will briefly flash when data is written.

## 💾 Saving, Loading & Exporting

*   **Save Plan:** Generates a complete `.json` workbook containing all scenarios, games, marketing items, and custom vendor prices. You will be prompted with a native Windows "Save As" dialog to pick where to store it.
*   **Load Plan:** Imports a `.json` plan file. It validates the file and automatically upgrades older plans to ensure backwards compatibility.
*   **Export Reports:**
    *   **Executive Summary:** A high-level view showing total projected revenue and costs by price point.
    *   **Detailed Build:** A comprehensive game-by-game breakdown of margins, units, payouts, and features.
    *   **Procurement / PO Report:** A simplified export for the purchasing team, stripping out financial margins and focusing purely on Units, vendor assignment, PO numbers, and receiving dates.
    *   **Vendor Pricing Matrix:** Exports your exact current vendor base costs and feature rates for auditing and contract sharing.

---

## 🎛️ Master Settings (Top Bar)

The global variables defining the financial projections for your entire fiscal year:
*   **Fiscal Year / Target Sales:** The high-level goals.
*   **Ret Comp & Admin Expense %:** Applied globally, reducing Gross Margin.
*   **Sell-through %:** Reduces expected Revenue, Prize Expense, and Retailer Commission (does *not* reduce per-thousand printing costs).

## 📊 Scenarios and Workspaces

The tool supports multiple concurrent working environments.
*   **New:** Starts a completely blank slate workspace alongside your existing tabs.
*   **Duplicate:** Makes a direct copy of your active scenario for safe A/B testing or what-if projections.
*   **Clear:** Wipes all games and items from the *current* scenario without affecting others.
*   **Delete:** Removes the scenario entirely.

---

## 🏗️ Building Your Plan

### 1. Left Panel: Denominations & Game Mix
Defines your portfolio structure. Set **Target Mix %** for each price point. As you add games, the "Actual" percentage updates. Your goal is a Total Mix of 100%.
*You can click the ◀ button to temporarily hide this panel.*

### 2. Center Panel: The Roster & Non-Scratchers
This is the heart of the application. Games are grouped by denomination.
*   **Adding Games:** Click `+ Add Game` in any denomination section. 
*   **Data Entry:** Use your `Tab` or `Enter` keys to rapidly move between fields.
*   **Features:** Click `Edit` to select special upcharge features (e.g., Holographic Foil). 
*   **Non-Scratcher / Marketing Items:** At the bottom, a dedicated grid tracks internal or external promotional costs (like inserts or digital campaigns) that drain from your total budget but don't generate direct revenue.

### 3. Right Panel: Granular Vendor Pricing
This pane dictates the specific financial rules governing your printing partners.
*   **Cost Model:** Determines if the vendor charges by `% of Sales` or `Per Thousand`.
*   **Base Costs:** You can enter *different base costs for every denomination* (e.g., $1 games cost $17.50/M; $20 games cost $35.00/M). 
*   **Feature Costs:** Assign specific upcharge costs for special enhancements. If a feature is unchecked, it is disabled for that vendor and cannot be added to their games.
*You can click the ▶ button to temporarily hide this panel.*

## 📝 Audit Trail (Bottom Panel)
The console log at the bottom tracks major changes. If you make a mistake, rely on the History controls (Undo / Redo buttons). It can also be collapsed using the ▼ button to focus solely on data entry.

## 🖨️ Printing
Want a physical copy? Just press `Ctrl+P`. The application automatically restyles itself using `@media print`, stripping away the dark interface and side panels to generate a clean, readable document of your games.
