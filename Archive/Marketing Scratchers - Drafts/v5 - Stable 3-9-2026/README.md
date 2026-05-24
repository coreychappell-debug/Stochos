# Fiscal Year Marketing Contract Manager - Instruction Manual

Welcome to the Marketing Contract Manager (Fiscal Year Planner)! This tool is an interactive, browser-based Progressive Web Application (PWA) designed to help you project and manage your marketing scratcher game runs, features, and pricing across multiple hardware vendors.

## 🚀 Getting Started

This application is completely "Local-First". You do not need an internet connection or a database to run it. 

1. **Open the Tool:** Simply double-click on `MarketingContract-5.html`. It will open and run directly in any modern web browser (Edge, Chrome, Safari).
2. **Offline Capable:** Because it relies entirely on your browser, all mathematical calculations and logic happen securely on your own machine.
3. **Autosave Engine:** The tool continuously auto-saves your progress in the background to your browser's local storage. If you accidentally close your window, your plan will be right where you left it.

## 💾 Saving & Loading Your Work

While the tool auto-saves for your convenience, if you want to create different versions, share with colleagues, or keep an official record:

*   **Save Plan:** Click the `Save Plan` button in the top menu. This will generate a `.json` file containing your entire setup, including all games, scenarios, and vendor pricing.
*   **Load Plan:** Click `Load Plan` to securely import a `.json` file that you previously saved or that a colleague sent to you.
*   **Export:** Click the `Export` dropdown to generate an Executive Summary or Detailed Build in either `.csv` or `.xlsx` format for sharing with stakeholders or performing out-of-system data analysis.

---

## 🎛️ Master Settings (Top Bar)

The controls at the very top of your screen define the global variables that dictate the financial projections for your entire fiscal year.

*   **Fiscal Year:** The target year you are planning for.
*   **Total Sales Target:** The total dollar amount in sales you expect all the games in your plan to generate combined over the year.
*   **Retailer Comm %:** The percentage of revenue paid out to retailers as commission. This effectively increases your Cost of Goods Sold (COGS).
*   **Admin Expense %:** The percentage of revenue reserved for general administrative overhead costs. This increases your COGS and lowers your overall Gross Margin.
*   **Sell-through %:** The projected lifetime sales percentage of your printed tickets (e.g., if you print 1,000,000 tickets but expect 2% to go unsold and be destroyed, you would set this to 98%).
    *   *Note:* Sell-through % reduces your expected Revenue, Prize Expense, and Retailer Commission. However, it does **not** reduce your Printing/Manufacturing costs if the vendor is paid on a "Per Thousand" basis, as you still must pay to print the unsold tickets!

## 📊 Scenarios and Workspaces

The tool supports multiple concurrent working environments called "Scenarios" using the tabbed bar slightly below the main header.
*   Click **New** to start a blank slate workspace.
*   Click **Duplicate** to make a direct copy of your current active scenario—perfect for A/B testing different game mixes or feature variants without destroying your original work.

---

## 🏗️ Building Your Plan (The 3 Panels)

### 1. Left Panel: Denominations & Game Mix
This panel defines the structural target of your portfolio.

1.  Enable or disable denominations (e.g., $1, $5, $10, etc.) using the checkboxes.
2.  Assign a **Target Mix %** to each denomination. This represents how much of your `Total Sales Target` you expect that price point to comprise. 
3.  The tool calculates an "Actual" percentage underneath the Target percentage. As you add games to the center panel, the progress bar will fill up. Your goal is to keep your "Total Mix" at exactly 100%.
4.  You can easily fold this panel away using the ◀ button to reclaim screen space.

### 2. Center Panel: The Game Roster
This is the heart of the application where you build out your actual game lineup. Games are automatically grouped under their respective price points based on the active Denominations.

*   **Adding Games:** Click `+ Add Game` in the header of any active denomination. 
*   **Defining Units:** Choose a standard preset for print quantities or select "Custom..." to type an exact amount.
*   **Assigning a Vendor:** Choose a printing vendor from the dropdown. *Critically, the assigned vendor determines the cost basis formula used to calculate the game's Contract Cost (see Vendor Pricing).*
*   **Adding Features:** Click the `Edit` button in the Features column to bring up the checklist menu. Adding special features like Holographic Foil automatically increases the printing cost of the game based on the assigned vendor's pricing model.
*   **Financial Metrics:** The tool automatically calculates the Contract Cost, Prize Expense, Total COGS, and Gross Margin in real-time as you tweak units, payouts, and features.

### 3. Right Panel: Vendor Pricing
This pane dictates the specific financial rules governing your relationships with your printing partners.

*   Click a Vendor tab (e.g., Scientific Games, Pollard Banknote) to set their specific financial model.
*   **Cost Model:** Determines *how* the vendor charges you for the base print job.
    *   *% of Sales:* The vendor takes a cut of the generated revenue (post sell-through reduction).
    *   *Per Thousand:* The vendor charges a flat rate for every 1,000 tickets *printed*, regardless of sell-through.
*   **Base Cost:** Input the base printing rate here.
*   **Feature Costs:** Assign the specific upcharge costs for special enhancements (Scented Ink, Sparkle Coating, etc.) for that specific vendor. If a game uses a feature, this cost is factored into the final contract cost.

## 📝 Audit Trail (Bottom Panel)
The console log at the bottom tracks all major changes made to your data model (e.g., changing global metrics, updating a specific game's payout structure). If you make a mistake, you can comfortably rely on the History controls (Undo / Redo buttons) in the top-left to revert your modifications.
