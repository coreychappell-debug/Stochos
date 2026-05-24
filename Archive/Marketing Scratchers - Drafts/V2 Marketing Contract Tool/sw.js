body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: #f4f7f9;
    color: #333;
    margin: 0;
}

#app-container {
    display: grid;
    grid-template-areas:
        "header header"
        "left-panel main-content"
        "footer footer";
    grid-template-columns: 320px 1fr;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    overflow: hidden;
}

header { 
    grid-area: header; 
    background: #fff; 
    padding: 10px 20px; 
    border-bottom: 1px solid #ddd; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    gap: 1rem;
}
.header-title { font-size: 1.2em; font-weight: bold; }
.header-controls { display: flex; align-items: center; gap: 0.75rem; }
.header-controls button { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; background: #f8f9fa; cursor: pointer; }
.header-controls button:hover { background: #e9ecef; }
.control-group input { border: 1px solid #ccc; padding: 7px; border-radius: 4px; }

#left-panel { grid-area: left-panel; padding: 20px; border-right: 1px solid #ddd; background: #fff; overflow-y: auto; }
#main-content { grid-area: main-content; padding: 20px; overflow-y: auto; }
#right-panel { grid-area: right-panel; padding: 20px; background: #f8f9fa; border-left: 1px solid #ddd; overflow-y: auto; }
footer { grid-area: footer; background: #333; color: #ccc; padding: 10px 20px; font-size: 0.8em; height: 120px; overflow-y: auto; }
footer p { margin: 4px 0; }

.footer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
#clear-log-btn {
    background: #555;
    color: #fff;
    border: 1px solid #777;
    border-radius: 4px;
    padding: 2px 8px;
    cursor: pointer;
    font-size: 0.9em;
}
#clear-log-btn:hover {
    background: #777;
}


.denom-item { display: grid; grid-template-columns: auto 80px 70px 20px 1fr; align-items: center; gap: 10px; margin-bottom: 15px; }
.denom-item label { font-weight: bold; }
.denom-item input[type="number"] { width: 100%; box-sizing: border-box; text-align: right; border: 1px solid #ccc; border-radius: 4px; padding: 5px; }
.denom-details { text-align: right; font-size: 0.9em; color: #555; }
.progress-bar { background-color: #e9ecef; border-radius: .25rem; height: 8px; margin-top: 4px; overflow: hidden; }
.progress-bar-inner { background-color: #0d6efd; height: 100%; border-radius: .25rem; transition: width 0.2s ease-in-out; }
#denom-total { margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; font-weight: bold; }
.total-error { color: #d9534f; }

.add-denom-form {
    margin-top: 20px;
    padding-top: 15px;
    border-top: 2px solid #0d6efd;
}
.add-denom-form h4 {
    margin-top: 0;
}
.add-denom-form div {
    display: flex;
    gap: 10px;
}
.add-denom-form input {
    flex-grow: 1;
}

.game-group { margin-bottom: 2rem; }
.game-group-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d6efd; padding-bottom: 0.5rem; margin-bottom: 1rem; cursor: pointer; }
.game-group-header .toggle-icon { margin-right: 8px; font-size: 0.8em; display: inline-block; }
.game-table { width: 100%; border-collapse: collapse; }
.game-table th, .game-table td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: middle; }
.game-table th { background-color: #f8f9fa; }
.game-table input, .game-table select { width: 98%; box-sizing: border-box; border: 1px solid #ccc; padding: 4px; border-radius: 4px; }
.edit-features-btn { font-size: 0.8em; padding: 2px 6px; }
.delete-game-btn { background-color: #fbeaeae8; color: #c52626; border: 1px solid #e1b1b1; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 1em; }
.delete-game-btn:hover { background-color: #c52626; color: white; }


.tab-container { display: flex; border-bottom: 1px solid #ccc; }
.tab-btn { padding: 10px 15px; cursor: pointer; border: 1px solid transparent; border-bottom: 0; background: #eee; }
.tab-btn.active { background: #fff; border-color: #ccc; border-bottom: 1px solid #fff; position: relative; top: 1px; }
.tab-content { display: none; padding-top: 1rem; }
.tab-content.active { display: block; }
.pricing-table { width: 100%; font-size: 0.9em; }
.cost-model-group { margin-bottom: 1rem; }
.cost-input-row { display: none; }
.cost-input-row.active { display: table-row; }

.modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 1000; }
.modal-content { background: white; padding: 2rem; border-radius: 8px; width: 400px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
#feature-checklist { max-height: 300px; overflow-y: auto; margin-bottom: 1rem; border: 1px solid #eee; padding: 1rem; }
.feature-checklist-item { display: block; margin-bottom: 0.5rem; }
.modal-actions { text-align: right; margin-top: 1rem; }

#feature-management-list { max-height: 250px; overflow-y: auto; margin-bottom: 1rem; border: 1px solid #eee; padding: 1rem; }
.feature-management-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; border-bottom: 1px solid #f0f0f0; }
.feature-management-item:last-child { border-bottom: none; }
.delete-feature-btn { background-color: #d9534f; color: white; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; }
.add-feature-form { display: flex; gap: 10px; margin-top: 1rem; }


.dropdown { position: relative; display: inline-block; }
.dropdown-content { display: none; position: absolute; background-color: #f9f9f9; min-width: 160px; box-shadow: 0px 8px 16px 0px rgba(0,0,0,0.2); z-index: 1; right: 0; }
.dropdown-content a { color: black; padding: 12px 16px; text-decoration: none; display: block; font-size: 0.9em; }
.dropdown-content a:hover { background-color: #f1f1f1; }
.dropdown:hover .dropdown-content { display: block; }

.budget-tally {
    padding: 10px;
    margin-bottom: 1rem;
    background-color: #e9ecef;
    border: 1px solid #dee2e6;
    border-radius: .25rem;
    font-weight: 500;
}
```

***
### ## `app.js` (Updated)
The script now includes logic to clear the audit trail automatically and manually.


```javascript
(function() {
    'use strict';

    // --- CONSTANTS & STATE MANAGEMENT ---
    const FEATURES_CSV_DATA = `"Generic Feature","SG Brand Name","PB Brand Name","BS Brand Name","SG (Y/N)","PB (Y/N)","BS (Y/N)"
"Holographic Foil","HoloFoil™","Scratch FX® Holographic","Holographic Substrate","Y","Y","Y"
"Sparkle/Glitter Coating","Glitter Ink","Sparkle®","Metallic Sparkle","Y","Y","N"
"Scented Ink","Scent™","Scratch & Sniff®","Aroma Ink","Y","Y","Y"
"Metallic Ink","Metallic Inks","Metallic Inks","Metallic FX","Y","Y","Y"
"Die-Cut Ticket","Custom Die-Cut","Die-Cut","Custom Shape","Y","Y","Y"
"Oversized Format","Jumbo Ticket","Big Ticket™","Oversized Format","Y","Y","Y"
"Extended Play (Crossword/Bingo)","Extended Play","Crossword/Bingo","Extended Play","Y","Y","Y"
"Licensed Property Usage","Licensed Brands","Licensed Portfolio","","Y","Y","N"
"Recycled Substrate","Eco-Stock","Recycled Content Paper","","Y","Y","N"
"Secure Barcoding","Secure Code™","SecureValidate™","Secure Barcode","Y","Y","Y"`;

    const CONTRACT_UNIT_PLANS = {
        1: [12000000, 18000000, 24000000],
        2: [12000000, 18000000, 24000000],
        3: [12000000, 18000000, 24000000],
        5: [12000000, 18000000, 24000000],
        10: [12000000, 18000000],
        20: [12000000],
        30: [12000000],
        default: [10000000]
    };

    let state = {
        fiscalYear: new Date().getFullYear() + 1,
        totalSalesTarget: 5000000000,
        denominations: [
            { price: 1, mixPercent: 10, isActive: true, isCollapsed: false },
            { price: 2, mixPercent: 15, isActive: true, isCollapsed: false },
            { price: 3, mixPercent: 10, isActive: true, isCollapsed: false },
            { price: 5, mixPercent: 25, isActive: true, isCollapsed: false },
            { price: 10, mixPercent: 20, isActive: true, isCollapsed: false },
            { price: 20, mixPercent: 15, isActive: true, isCollapsed: false },
            { price: 25, mixPercent: 0, isActive: true, isCollapsed: false },
            { price: 30, mixPercent: 5, isActive: true, isCollapsed: false },
            { price: 50, mixPercent: 0, isActive: false, isCollapsed: false },
        ],
        games: [
            { id: 'g1', gameNumber: '1234', denominationPrice: 5, name: 'Lucky 7s #123', vendorId: 'sg', units: 12000000, payoutPercent: 68.5, featureIds: [] },
            { id: 'g2', gameNumber: '5678', denominationPrice: 10, name: 'Ultimate Cash #234', vendorId: 'pb', units: 18000000, payoutPercent: 71.0, featureIds: ["Holographic Foil"] }
        ],
        vendorPricing: {
            sg: { costModel: 'percentOfSales', baseCostValue: 1.5, features: {} },
            pb: { costModel: 'perThousand', baseCostValue: 21.80, features: {} },
            bs: { costModel: 'perThousand', baseCostValue: 23.10, features: {} }
        },
        featureMasterList: [],
        auditLog: [],
        ui: {
            activeVendorTab: 'sg',
            editingFeaturesForGameId: null
        }
    };

    let history = [];
    let historyIndex = -1;
    let db;
    const DB_NAME = 'PlanDB';
    const STORE_NAME = 'PlanStore';

    async function init() {
        console.log("Application Initialized.");
        await openDB();
        await restoreFromAutosave();
        setupEventListeners();
        initializeVendorPricing();
        loadFeatures();
        recordHistory();
        render();
    }

    function setupEventListeners() {
        document.getElementById('undo-btn').addEventListener('click', undo);
        document.getElementById('redo-btn').addEventListener('click', redo);
        document.getElementById('fiscal-year').addEventListener('input', handleFiscalYearChange);
        document.getElementById('total-sales-target').addEventListener('input', handleTargetChange);
        document.getElementById('load-plan-btn').addEventListener('click', () => document.getElementById('load-plan-input').click());
        document.getElementById('load-plan-input').addEventListener('change', loadPlan);
        document.getElementById('save-plan-btn').addEventListener('click', savePlan);
        document.getElementById('left-panel').addEventListener('input', handleDenominationChange);
        document.getElementById('left-panel').addEventListener('click', handleLeftPanelClicks);
        document.getElementById('center-panel').addEventListener('click', handleCenterPanelEvents);
        document.getElementById('center-panel').addEventListener('input', handleCenterPanelEvents);
        document.getElementById('right-panel').addEventListener('click', handleRightPanelEvents);
        document.getElementById('right-panel').addEventListener('input', handleRightPanelEvents);
        document.getElementById('feature-modal').addEventListener('click', handleModalEvents);
        document.getElementById('feature-management-modal').addEventListener('click', handleFeatureManagementModalEvents);
        document.getElementById('footer').addEventListener('click', handleFooterEvents);
        document.getElementById('export-summary-csv').addEventListener('click', (event) => { event.preventDefault(); exportReport('summary', 'csv'); });
        document.getElementById('export-summary-xlsx').addEventListener('click', (event) => { event.preventDefault(); exportReport('summary', 'xlsx'); });
        document.getElementById('export-detail-csv').addEventListener('click', (event) => { event.preventDefault(); exportReport('detail', 'csv'); });
        document.getElementById('export-detail-xlsx').addEventListener('click', (event) => { event.preventDefault(); exportReport('detail', 'xlsx'); });
    }

    function render() {
        console.log("Rendering UI...");
        document.getElementById('fiscal-year').value = state.fiscalYear;
        document.getElementById('total-sales-target').value = state.totalSalesTarget.toLocaleString('en-US');
        renderDenominations();
        renderCenterPanel();
        renderRightPanel();
        renderAuditTrail();
        updateUndoRedoButtons();
    }

    function renderDenominations() {
        const container = document.getElementById('left-panel');
        container.innerHTML = '<h3>Denominations</h3>';
        let totalMixPercent = 0;
        state.denominations.forEach(denom => {
            if (denom.isActive) totalMixPercent += denom.mixPercent;
            const revenue = state.totalSalesTarget * (denom.mixPercent / 100);
            const item = document.createElement('div');
            item.className = 'denom-item';
            item.innerHTML = `
                <input type="checkbox" id="denom-active-${denom.price}" ${denom.isActive ? 'checked' : ''}>
                <label for="denom-active-${denom.price}">$${denom.price}</label>
                <input type="number" id="denom-mix-${denom.price}" value="${denom.mixPercent}" min="0" max="100" step="0.1">
                <span>%</span>
                <div class="denom-details">
                    <span>${formatCurrency(revenue)}</span>
                    <div class="progress-bar"><div class="progress-bar-inner" style="width: ${denom.mixPercent}%;"></div></div>
                </div>`;
            container.appendChild(item);
        });
        const totalDiv = document.createElement('div');
        totalDiv.id = 'denom-total';
        totalDiv.innerHTML = `Total Mix: ${totalMixPercent.toFixed(1)}%`;
        if (totalMixPercent.toFixed(1) != 100.0) {
            totalDiv.classList.add('total-error');
            totalDiv.innerHTML += ` (Should be 100%)`;
        }
        container.appendChild(totalDiv);
        const addForm = document.createElement('div');
        addForm.className = 'add-denom-form';
        addForm.innerHTML = `
            <h4>Add New Price Point</h4>
            <div><input type="number" id="new-denom-price" placeholder="e.g., 4"><button id="add-denom-btn">Add</button></div>`;
        container.appendChild(addForm);
    }

    function renderCenterPanel() {
        const container = document.getElementById('center-panel');
        
        let totalPlannedContractCost = 0;
        state.games.forEach(game => {
            totalPlannedContractCost += calculateGameMetrics(game).contractCost;
        });
        const budgetPercent = state.totalSalesTarget > 0 ? (totalPlannedContractCost / state.totalSalesTarget * 100).toFixed(2) : 0;
        const budgetTallyHtml = `
            <div class="budget-tally">
                <strong>Total Planned Contract Costs:</strong> ${formatCurrency(totalPlannedContractCost)} of ${formatCurrency(state.totalSalesTarget)} (${budgetPercent}%)
            </div>`;

        container.innerHTML = `<h2>FY${state.fiscalYear} Plan</h2>${budgetTallyHtml}`;

        state.denominations.filter(d => d.isActive).forEach(denom => {
            const group = document.createElement('div');
            group.className = 'game-group';
            const gamesInGroup = state.games.filter(g => g.denominationPrice === denom.price);
            
            gamesInGroup.sort((a, b) => a.name.localeCompare(b.name));

            const tableBody = gamesInGroup.map(game => {
                const metrics = calculateGameMetrics(game);
                const unitOptions = CONTRACT_UNIT_PLANS[game.denominationPrice] || CONTRACT_UNIT_PLANS.default;
                const unitsDropdownHtml = unitOptions.map(size => `<option value="${size}" ${game.units === size ? 'selected' : ''}>${size.toLocaleString('en-US')}</option>`).join('');
                
                const costModel = state.vendorPricing[game.vendorId]?.costModel || 'percentOfSales';
                const modelDisplay = costModel === 'percentOfSales' ? '% of Sales' : 'Per Thousand';

                return `
                    <tr data-row-id="${game.id}">
                        <td><input type="text" value="${game.gameNumber || ''}" data-game-id="${game.id}" data-prop="gameNumber" maxlength="4" size="4"></td>
                        <td><input type="text" value="${game.name}" data-game-id="${game.id}" data-prop="name"></td>
                        <td><select data-game-id="${game.id}" data-prop="vendorId"><option value="sg" ${game.vendorId === 'sg' ? 'selected' : ''}>Scientific Games</option><option value="pb" ${game.vendorId === 'pb' ? 'selected' : ''}>Pollard Banknote</option><option value="bs" ${game.vendorId === 'bs' ? 'selected' : ''}>Brightstar</option></select></td>
                        <td>${modelDisplay}</td>
                        <td><select data-game-id="${game.id}" data-prop="units">${unitsDropdownHtml}</select></td>
                        <td><input type="number" value="${game.payoutPercent}" step="0.1" data-game-id="${game.id}" data-prop="payoutPercent"></td>
                        <td>${(game.featureIds && game.featureIds.length) ? game.featureIds.join(', ') : 'None'} <button class="edit-features-btn" data-game-id="${game.id}">Edit</button></td>
                        <td>${formatCurrency(metrics.contractCost)}</td>
                        <td>${formatCurrency(metrics.prizeExpense)}</td>
                        <td>${formatCurrency(metrics.cogs)}</td>
                        <td style="color: ${metrics.grossMargin < 0 ? '#d9534f' : 'green'};">${formatCurrency(metrics.grossMargin)}</td>
                        <td><button class="delete-game-btn" data-game-id="${game.id}">🗑️</button></td>
                    </tr>`;
            }).join('');
            
            const toggleIcon = denom.isCollapsed ? '►' : '▼';
            const tableDisplay = denom.isCollapsed ? 'style="display: none;"' : '';

            group.innerHTML = `
                <div class="game-group-header" data-price="${denom.price}"><span class="toggle-icon">${toggleIcon}</span><h3>$${denom.price} Games</h3><button class="add-game-btn" data-price="${denom.price}">+ Add Game</button></div>
                <table class="game-table" ${tableDisplay}><thead><tr><th>Game #</th><th>Game Name</th><th>Vendor</th><th>Cost Model</th><th>Units</th><th>Payout %</th><th>Features</th><th>Contract Cost</th><th>Prize Expense</th><th>Total COGS</th><th>Gross Margin</th><th>Actions</th></tr></thead><tbody>${tableBody}</tbody></table>`;
            container.appendChild(group);
        });
    }

    function renderRightPanel() {
        const container = document.getElementById('right-panel');
        const vendors = [{ id: 'sg', name: 'Scientific Games' }, { id: 'pb', name: 'Pollard Banknote' }, { id: 'bs', name: 'Brightstar' }];
        
        const headerHtml = `<div class="game-group-header"><h3>Vendor Pricing</h3><button id="manage-features-btn">Manage Features</button></div>`;
        
        let tabHtml = '<div class="tab-container">';
        vendors.forEach(v => { tabHtml += `<button class="tab-btn ${state.ui.activeVendorTab === v.id ? 'active' : ''}" data-vendor-id="${v.id}">${v.name}</button>`; });
        tabHtml += '</div>';
        
        let contentHtml = '';
        vendors.forEach(v => {
            const vendorData = state.vendorPricing[v.id] || {};
            const costModel = vendorData.costModel || 'percentOfSales';
            const baseCostValue = vendorData.baseCostValue || 0;

            const featureTableRows = state.featureMasterList.map(feature => {
                const featureName = feature['Generic Feature'];
                const savedPrice = vendorData.features?.[featureName] || '';
                return `<tr><td>${featureName}</td><td><input type="number" value="${savedPrice}" placeholder="0.00" step="0.01" data-feature-name="${featureName}"></td></tr>`;
            }).join('');

            contentHtml += `<div class="tab-content ${state.ui.activeVendorTab === v.id ? 'active' : ''}" id="tab-${v.id}">
                <h4>Pricing for ${v.name}</h4>
                <div class="cost-model-group">
                    <strong>Cost Model:</strong>
                    <label><input type="radio" name="costModel-${v.id}" value="percentOfSales" ${costModel === 'percentOfSales' ? 'checked' : ''}> % of Sales</label>
                    <label><input type="radio" name="costModel-${v.id}" value="perThousand" ${costModel === 'perThousand' ? 'checked' : ''}> Per Thousand</label>
                </div>
                <table class="pricing-table">
                    <thead><tr><th>Item</th><th>Cost</th></tr></thead>
                    <tbody>
                        <tr class="cost-input-row ${costModel === 'percentOfSales' ? 'active' : ''}">
                            <td>Base Cost (% of Sales)</td>
                            <td><input type="number" value="${baseCostValue}" step="0.01" data-feature-name="baseCostValue"></td>
                        </tr>
                        <tr class="cost-input-row ${costModel === 'perThousand' ? 'active' : ''}">
                            <td>Base Cost (per Thousand)</td>
                            <td><input type="number" value="${baseCostValue}" step="0.01" data-feature-name="baseCostValue"></td>
                        </tr>
                        ${featureTableRows}
                    </tbody>
                </table></div>`;
        });
        container.innerHTML = headerHtml + tabHtml + contentHtml;
    }

    function renderAuditTrail() {
        const container = document.getElementById('footer');
        container.innerHTML = `
            <div class="footer-header">
                <h4>Audit Trail</h4>
                <button id="clear-log-btn">Clear Log</button>
            </div>`;
        state.auditLog.slice(0, 5).forEach(log => {
            const entry = document.createElement('p');
            entry.textContent = `[${log.timestamp}] ${log.message}`;
            container.appendChild(entry);
        });
    }

    function renderFeatureManagementModal() {
        const listContainer = document.getElementById('feature-management-list');
        listContainer.innerHTML = '';
        state.featureMasterList.forEach(feature => {
            const item = document.createElement('div');
            item.className = 'feature-management-item';
            item.innerHTML = `<span>${feature['Generic Feature']}</span><button class="delete-feature-btn" data-feature-name="${feature['Generic Feature']}">Delete</button>`;
            listContainer.appendChild(item);
        });
    }

    function handleFiscalYearChange(event) {
        const oldValue = state.fiscalYear;
        const newYear = parseInt(event.target.value, 10);
        if (newYear && String(newYear).length === 4) {
            state.fiscalYear = newYear;
            logAudit(`Fiscal Year changed from ${oldValue} to ${state.fiscalYear}.`);
            render();
            debouncedAutosave();
        }
    }

    function handleTargetChange(event) {
        const oldValue = state.totalSalesTarget;
        state.totalSalesTarget = parseFloat(event.target.value.replace(/,/g, '')) || 0;
        logAudit(`Total Sales Target changed from ${formatCurrency(oldValue)} to ${formatCurrency(state.totalSalesTarget)}.`);
        render();
        debouncedAutosave();
    }

    function handleDenominationChange(event) {
        const parts = event.target.id.split('-');
        if (parts.length < 3) return;
        const type = parts[1];
        const price = parseInt(parts[2], 10);
        const denomination = state.denominations.find(d => d.price === price);
        if (!denomination) return;
        const oldValue = denomination[type === 'mix' ? 'mixPercent' : 'isActive'];
        if (type === 'mix') denomination.mixPercent = parseFloat(event.target.value) || 0;
        else if (type === 'active') denomination.isActive = event.target.checked;
        const newValue = denomination[type === 'mix' ? 'mixPercent' : 'isActive'];
        logAudit(`$${price} tier ${type === 'mix' ? 'mix %' : 'status'} changed from ${oldValue} to ${newValue}.`);
        render();
        debouncedAutosave();
    }
    
    function handleLeftPanelClicks(event) {
        if (event.target.id === 'add-denom-btn') {
            const input = document.getElementById('new-denom-price');
            const newPrice = parseFloat(input.value);
            addDenomination(newPrice);
            input.value = '';
        }
    }

    function handleCenterPanelEvents(event) {
        if (event.type === 'click' && event.target.matches('.add-game-btn')) {
            addGame(parseInt(event.target.dataset.price, 10));
            return;
        }
        if (event.type === 'click' && event.target.matches('.delete-game-btn')) {
            const gameId = event.target.dataset.gameId;
            const game = state.games.find(g => g.id === gameId);
            if (game && confirm(`Are you sure you want to delete the game "${game.name}"?`)) {
                deleteGame(gameId);
            }
            return;
        }
        if (event.type === 'click' && event.target.matches('.edit-features-btn')) {
            openFeatureModal(event.target.dataset.gameId);
            return;
        }

        const header = event.target.closest('.game-group-header');
        if (event.type === 'click' && header) {
            const price = parseInt(header.dataset.price, 10);
            const denomination = state.denominations.find(d => d.price === price);
            if (denomination) {
                denomination.isCollapsed = !denomination.isCollapsed;
                render();
            }
            return;
        }
        
        if (event.type === 'input') {
            const { gameId, prop } = event.target.dataset;
            if (gameId && prop) updateGame(gameId, prop, event.target.value);
        }
    }

    function handleRightPanelEvents(event) {
        const vendorId = state.ui.activeVendorTab;
        const vendorData = state.vendorPricing[vendorId];

        if (event.target.id === 'manage-features-btn') {
            openFeatureManagementModal();
        } else if (event.type === 'click' && event.target.matches('.tab-btn')) {
            state.ui.activeVendorTab = event.target.dataset.vendorId;
            renderRightPanel();
        } else if (event.type === 'input') {
            if (event.target.name === `costModel-${vendorId}`) {
                vendorData.costModel = event.target.value;
                logAudit(`Updated ${vendorId} cost model to ${vendorData.costModel}.`);
                render(); 
            } else {
                const { featureName } = event.target.dataset;
                const cost = parseFloat(event.target.value) || 0;
                if (featureName) {
                    if (featureName === 'baseCostValue') vendorData.baseCostValue = cost;
                    else vendorData.features[featureName] = cost;
                    logAudit(`Updated ${vendorId} price for '${featureName}' to ${cost}.`);
                    renderCenterPanel();
                }
            }
            debouncedAutosave();
        }
    }

    function handleModalEvents(event) {
        if (event.target.id === 'modal-save-btn') saveFeaturesFromModal();
        else if (event.target.id === 'modal-cancel-btn' || !event.target.closest('.modal-content')) closeFeatureModal();
    }

    function handleFeatureManagementModalEvents(event) {
        if (event.target.id === 'modal-done-btn' || !event.target.closest('.modal-content')) {
            closeFeatureManagementModal();
        }
        // Add/Delete logic will go here
    }
    
    function handleFooterEvents(event) {
        if (event.target.id === 'clear-log-btn') {
            clearAuditTrail();
        }
    }

    function addDenomination(price) {
        if (!price || price <= 0) return alert("Please enter a valid, positive price.");
        if (state.denominations.some(d => d.price === price)) return alert(`Price point $${price} already exists.`);
        const newDenom = { price: price, mixPercent: 0, isActive: true, isCollapsed: false };
        state.denominations.push(newDenom);
        state.denominations.sort((a, b) => a.price - b.price);
        logAudit(`Added new price point: $${price}.`);
        render();
        debouncedAutosave();
    }

    function addGame(denominationPrice) {
        const hasDefaultGame = state.games.some(g => g.denominationPrice === denominationPrice && g.name === 'New Game');
        if (hasDefaultGame) {
            alert('Please rename the existing "New Game" in this section before adding another.');
            return;
        }
        const defaultUnits = (CONTRACT_UNIT_PLANS[denominationPrice] || CONTRACT_UNIT_PLANS.default)[0];
        const newGame = { id: `g${Date.now()}`, gameNumber: '', denominationPrice, name: 'New Game', vendorId: 'sg', units: defaultUnits, payoutPercent: 68.0, featureIds: [] };
        state.games.push(newGame);
        logAudit(`Added game '${newGame.name}' to $${denominationPrice} tier.`);
        render();
        debouncedAutosave();
    }
    
    function deleteGame(gameId) {
        const gameIndex = state.games.findIndex(g => g.id === gameId);
        if (gameIndex > -1) {
            const gameName = state.games[gameIndex].name;
            state.games.splice(gameIndex, 1);
            logAudit(`Deleted game '${gameName}'.`);
            render();
            debouncedAutosave();
        }
    }

    function updateGame(gameId, property, value) {
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        const oldValue = game[property];
        let parsedValue = (property === 'units' || property === 'payoutPercent') ? (parseFloat(value) || 0) : value;
        game[property] = parsedValue;
        logAudit(`Updated game '${game.name}' ${property} from '${oldValue}' to '${game[property]}'.`);
        const propertiesThatAffectCalcs = ['units', 'payoutPercent', 'vendorId'];
        if (propertiesThatAffectCalcs.includes(property)) {
            renderCenterPanel();
        }
        debouncedAutosave();
    }

    function updateCalculatedCells(gameId) {
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        const row = document.querySelector(`tr[data-row-id="${gameId}"]`);
        if (!row) return;
        const metrics = calculateGameMetrics(game);
        
        const contractCostCell = row.cells[7];
        const prizeExpenseCell = row.cells[8];
        const cogsCell = row.cells[9];
        const marginCell = row.cells[10];

        if(contractCostCell) contractCostCell.textContent = formatCurrency(metrics.contractCost);
        if(prizeExpenseCell) prizeExpenseCell.textContent = formatCurrency(metrics.prizeExpense);
        if(cogsCell) cogsCell.textContent = formatCurrency(metrics.cogs);
        if(marginCell) {
            marginCell.textContent = formatCurrency(metrics.grossMargin);
            marginCell.style.color = metrics.grossMargin < 0 ? '#d9534f' : 'green';
        }
    }

    function logAudit(message) {
        const timestamp = new Date().toLocaleTimeString('en-US');
        state.auditLog.unshift({ timestamp, message });
        if (state.auditLog.length > 50) state.auditLog.pop();
    }

    function clearAuditTrail() {
        state.auditLog = [];
        logAudit("Audit trail cleared.");
        renderAuditTrail();
        debouncedAutosave();
    }

    function calculateGameMetrics(game) {
        const denomination = state.denominations.find(d => d.price === game.denominationPrice);
        if (!denomination) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };
        const revenue = game.units * denomination.price;
        const vendorCostData = state.vendorPricing[game.vendorId];
        if (!vendorCostData) return { revenue: 0, contractCost: 0, prizeExpense: 0, cogs: 0, grossMargin: 0 };
        
        let manufacturingCost = 0;
        if (vendorCostData.costModel === 'perThousand') {
            manufacturingCost = (game.units / 1000) * (vendorCostData.baseCostValue || 0);
        } else {
            manufacturingCost = revenue * ((vendorCostData.baseCostValue || 0) / 100);
        }

        let totalFeatureCost = 0;
        if (game.featureIds && vendorCostData.features) {
            game.featureIds.forEach(featureName => {
                totalFeatureCost += (game.units / 1000) * (vendorCostData.features[featureName] || 0);
            });
        }
        
        const contractCost = manufacturingCost + totalFeatureCost;
        const prizeExpense = revenue * (game.payoutPercent / 100);
        const cogs = contractCost + prizeExpense;
        const grossMargin = revenue - cogs;
        
        return { revenue, contractCost, prizeExpense, cogs, grossMargin };
    }

    function openFeatureModal(gameId) {
        state.ui.editingFeaturesForGameId = gameId;
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        document.getElementById('modal-game-name').textContent = game.name;
        document.getElementById('feature-checklist').innerHTML = state.featureMasterList.map(feature => {
            const featureName = feature['Generic Feature'];
            const isChecked = game.featureIds?.includes(featureName);
            return `<label class="feature-checklist-item"><input type="checkbox" name="${featureName}" ${isChecked ? 'checked' : ''}> ${featureName}</label>`;
        }).join('');
        document.getElementById('feature-modal').style.display = 'flex';
    }

    function closeFeatureModal() {
        state.ui.editingFeaturesForGameId = null;
        document.getElementById('feature-modal').style.display = 'none';
    }

    function saveFeaturesFromModal() {
        const gameId = state.ui.editingFeaturesForGameId;
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        const selectedFeatures = [];
        document.querySelectorAll('#feature-checklist input:checked').forEach(input => selectedFeatures.push(input.name));
        game.featureIds = selectedFeatures;
        logAudit(`Updated features for game '${game.name}'.`);
        closeFeatureModal();
        render();
        debouncedAutosave();
    }

    function openFeatureManagementModal() {
        renderFeatureManagementModal();
        document.getElementById('feature-management-modal').style.display = 'flex';
    }

    function closeFeatureManagementModal() {
        document.getElementById('feature-management-modal').style.display = 'none';
    }

    let autosaveTimeout;
    const debouncedAutosave = () => {
        clearTimeout(autosaveTimeout);
        autosaveTimeout = setTimeout(() => { saveStateToDB(); recordHistory(); }, 1500);
    };

    function recordHistory() {
        history = history.slice(0, historyIndex + 1);
        history.push(JSON.parse(JSON.stringify(state)));
        historyIndex++;
        updateUndoRedoButtons();
    }

    function updateUndoRedoButtons() {
        document.getElementById('undo-btn').disabled = historyIndex <= 0;
        document.getElementById('redo-btn').disabled = historyIndex >= history.length - 1;
    }

    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            state = JSON.parse(JSON.stringify(history[historyIndex]));
            render();
            saveStateToDB();
            logAudit("Action: Undo.");
        }
    }

    function redo() {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            state = JSON.parse(JSON.stringify(history[historyIndex]));
            render();
            saveStateToDB();
            logAudit("Action: Redo.");
        }
    }

    function loadFeatures() {
        try {
            state.featureMasterList = parseCSV(FEATURES_CSV_DATA);
            console.log("✅ Vendor features loaded successfully from internal data.");
        } catch (error) {
            console.error("❌ Failed to parse internal feature data:", error);
        }
    }

    function parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines.shift().split(',').map(h => h.trim().replace(/"/g, ''));
        return lines.map(line => {
            const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
                return obj;
            }, {});
        });
    }

    function savePlan() {
        try {
            const jsonString = JSON.stringify(state, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `FY${state.fiscalYear}_Plan.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            logAudit("Plan saved to file.");
        } catch (error) {
            console.error("❌ Failed to save plan:", error);
        }
    }

    function loadPlan(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const loadedState = JSON.parse(e.target.result);
                if (!loadedState.hasOwnProperty('fiscalYear')) throw new Error("Invalid plan file format.");
                state = loadedState;
                state.auditLog = []; // Clear log on load
                logAudit("Plan loaded from file.");
                history = [];
                historyIndex = -1;
                recordHistory();
                render();
            } catch (error) {
                alert("Error: Could not load the selected file.");
            }
        };
        reader.readAsText(file);
        event.target.value = null;
    }

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onerror = () => reject("Error opening DB");
            request.onsuccess = (event) => { db = event.target.result; resolve(); };
            request.onupgradeneeded = (event) => event.target.result.createObjectStore(STORE_NAME);
        });
    }

    function saveStateToDB() {
        if (!db) return;
        db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(state, 'autosavedPlan');
    }

    function restoreFromAutosave() {
        return new Promise(resolve => {
            if (!db) return resolve();
            const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('autosavedPlan');
            request.onsuccess = (event) => {
                const savedState = event.target.result;
                if (savedState && confirm("An autosaved plan was found. Would you like to restore it?")) {
                    state = savedState;
                    state.auditLog = []; // Clear log on restore
                    logAudit("Plan restored from autosave.");
                }
                resolve();
            };
            request.onerror = () => resolve();
        });
    }
    
    function initializeVendorPricing() {
        ['sg', 'pb', 'bs'].forEach(vendorId => {
            if (!state.vendorPricing[vendorId]) state.vendorPricing[vendorId] = {};
            if (!state.vendorPricing[vendorId].features) state.vendorPricing[vendorId].features = {};
            if (!state.vendorPricing[vendorId].costModel) state.vendorPricing[vendorId].costModel = 'percentOfSales'; // Default
        });
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }
    
    function exportReport(type, format) {
        let data;
        let filename = `FY${state.fiscalYear}_`;
        if (type === 'summary') {
            data = generateExecutiveSummaryData();
            filename += 'Executive_Summary';
        } else {
            data = generateDetailedCostData();
            filename += 'Detailed_Build';
        }

        if (data.length === 0) return alert("No data to export.");

        if (format === 'csv') {
            exportToCSV(data, filename + '.csv');
        } else if (format === 'xlsx') {
            exportToXLSX(data, filename + '.xlsx');
        }
    }

    function generateExecutiveSummaryData() {
        return state.denominations.filter(d => d.isActive).map(denom => {
            const gamesInDenom = state.games.filter(g => g.denominationPrice === denom.price);
            let totalRevenue = 0;
            let totalContractCost = 0;
            let totalPrizeExpense = 0;
            gamesInDenom.forEach(game => {
                const metrics = calculateGameMetrics(game);
                totalRevenue += metrics.revenue;
                totalContractCost += metrics.contractCost;
                totalPrizeExpense += metrics.prizeExpense;
            });
            return {
                'Price Point': `$${denom.price}`,
                'Sales Mix %': denom.mixPercent,
                'Total Revenue': totalRevenue,
                'Total Contract Cost': totalContractCost,
                'Total Prize Expense': totalPrizeExpense,
                'Total COGS': totalContractCost + totalPrizeExpense,
                'Gross Margin': totalRevenue - (totalContractCost + totalPrizeExpense)
            };
        });
    }

    function generateDetailedCostData() {
        return state.games.map(game => {
            const metrics = calculateGameMetrics(game);
            return {
                'Game #': game.gameNumber,
                'Game Name': game.name,
                'Price Point': `$${game.denominationPrice}`,
                'Vendor': game.vendorId.toUpperCase(),
                'Units': game.units,
                'Payout %': game.payoutPercent,
                'Features': game.featureIds?.join(', ') || 'None',
                'Calculated Revenue': metrics.revenue,
                'Contract Cost': metrics.contractCost,
                'Prize Expense': metrics.prizeExpense,
                'Total COGS': metrics.cogs,
                'Gross Margin': metrics.grossMargin
            };
        });
    }

    function exportToCSV(data, filename) {
        const header = Object.keys(data[0]).join(',');
        const rows = data.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
        const csvContent = [header, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function exportToXLSX(data, filename) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan');
        XLSX.writeFile(workbook, filename);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
