import { byId, formatCurrency, vendorLabel } from './utils.js';
import { getState, commit, canUndo, canRedo } from './state.js';
import { calculateGameMetrics } from './calculations.js';
import { CONTRACT_UNIT_PRESETS, STANDARD_DENOMINATIONS } from './constants.js';

export function render() {
    const state = getState();
    byId('fiscal-year').value = state.fiscalYear;
    byId('total-sales-target').value = state.totalSalesTarget.toLocaleString('en-US');
    byId('retailer-comm').value = state.retailerCommissionPercent;
    byId('admin-expense').value = state.administrativeExpensePercent;
    byId('sell-through').value = state.sellThroughPercent;
    byId('vendor-filter').value = state.ui.vendorFilter;

    renderScenarioBar();
    renderDenominations();
    renderCenterPanel();
    renderRightPanel();
    renderAuditTrail();
    updateUndoRedoButtons();
    applyLayout();
}

function applyLayout() {
    const state = getState();
    const main = byId('main-content');
    if (main) {
        const leftW = state.ui.leftCollapsed ? '48px' : '280px';
        const rightW = state.ui.rightCollapsed ? '48px' : '320px';
        main.style.gridTemplateColumns = `${leftW} 1fr ${rightW}`;
    }
}

function updateUndoRedoButtons() {
    byId('undo-btn').disabled = !canUndo();
    byId('redo-btn').disabled = !canRedo();
}

export function renderScenarioBar() {
    const state = getState();
    const container = byId('scenario-bar');
    if (!container) return;

    let html = '';
    state.scenarios.forEach(sc => {
        const isActive = sc.id === state.activeScenarioId ? 'active' : '';
        html += `<div class="scenario-tab ${isActive}" data-scenario-id="${sc.id}">${sc.name}</div>`;
    });

    html += `
        <div class="scenario-actions">
            <button id="add-scenario-btn" title="Create new scenario">New</button>
            <button id="duplicate-scenario-btn" title="Duplicate current scenario">Duplicate</button>
            <button id="delete-scenario-btn" style="background-color: var(--danger-color);" ${state.scenarios.length === 1 ? 'disabled title="Cannot delete last scenario"' : 'title="Delete scenario"'}>Delete</button>
        </div>
    `;

    container.innerHTML = html;
}

export function renderDenominations() {
    const state = getState();
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return;

    const container = byId('left-panel');

    if (state.ui.leftCollapsed) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; height: 100%; cursor: pointer; padding-top: 8px;" data-action="toggle-left" title="Expand Denominations">
                <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; color: var(--text-light);">▶</button>
                <div style="writing-mode: vertical-rl; transform: rotate(180deg); margin-top: 1rem; font-weight: 600; color: var(--text-dark);">Denominations</div>
            </div>
        `;
        return;
    }

    container.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 8px; margin-bottom: 8px;">
        <h3 style="border: none; margin: 0; padding: 0;">Denominations</h3>
        <button data-action="toggle-left" title="Fold Denominations" style="padding: 2px 6px; font-size: 0.8rem;">◀</button>
    </div>`;

    let totalMixPercent = scenario.denominations.reduce((sum, d) => sum + (d.isActive ? d.mixPercent : 0), 0);

    scenario.denominations.forEach(denom => {
        const gamesInDenom = scenario.games.filter(g => g.denominationPrice === denom.price);
        const actualSalesInDenom = gamesInDenom.reduce((sum, g) => sum + calculateGameMetrics(g, state).revenue, 0);
        const actualSalesPercent = state.totalSalesTarget > 0 ? (actualSalesInDenom / state.totalSalesTarget) * 100 : 0;
        const progressPercent = denom.mixPercent > 0 ? Math.min(100, (actualSalesPercent / denom.mixPercent) * 100) : 0;

        const el = document.createElement('div');
        el.className = 'denom-item';
        el.dataset.price = denom.price;
        el.innerHTML = `
        < input type = "checkbox" id = "denom-active-${denom.price}" data - prop="isActive" ${denom.isActive ? 'checked' : ''}>
            <label for="denom-active-${denom.price}">$${denom.price}</label>
            <input type="number" value="${denom.mixPercent}" min="0" max="100" step="0.1" data-prop="mixPercent">
            <span>%</span>
            <div class="denom-details">
                <div style="display: flex; justify-content: space-between; font-size: 0.8em; color: var(--text-dark);">
                    <span>Actual: ${actualSalesPercent.toFixed(1)}%</span>
                    <span>Target: ${denom.mixPercent}%</span>
                </div>
                <div style="background: var(--bg-input); border-radius: 99px; height: 8px; margin-top: 2px;">
                     <div style="height: 100%; background: var(--accent-color); border-radius: 99px; width:${progressPercent}%"></div>
                </div>
            </div>`;
        container.appendChild(el);
    });

    const totalDiv = document.createElement('div');
    totalDiv.id = 'denom-total';
    totalDiv.textContent = `Total Mix: ${totalMixPercent.toFixed(1)}%`;
    if (totalMixPercent.toFixed(1) != 100.0) {
        totalDiv.classList.add('total-error');
        totalDiv.textContent += ' (Should be 100%)';
    }
    container.appendChild(totalDiv);

    const addForm = document.createElement('div');
    addForm.className = 'add-denom-form';
    addForm.style.marginTop = '1rem';
    addForm.innerHTML = `
        <h4>Add New Price Point</h4>
        <div style="display: flex; gap: 8px;"><input type="number" id="new-denom-price" placeholder="e.g., 4"><button id="add-denom-btn">Add</button></div>`;
    container.appendChild(addForm);
}

export function renderCenterPanel() {
    const state = getState();
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return;

    const container = byId('center-panel');
    const vendorView = state.ui.vendorFilter;
    const gamesForView = vendorView === 'all' ? scenario.games : scenario.games.filter(g => g.vendorId === vendorView);

    let totalPlannedSales = gamesForView.reduce((sum, g) => sum + calculateGameMetrics(g, state).revenue, 0);

    // Add Non-Scratcher costs to the total contract budget expectations
    let gameContractCost = gamesForView.reduce((sum, g) => sum + calculateGameMetrics(g, state).contractCost, 0);
    let nonScratcherCost = (scenario.nonScratcherItems || []).reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
    let totalPlannedContractCost = gameContractCost + nonScratcherCost;

    const salesGoalPercent = state.totalSalesTarget ? (totalPlannedSales / state.totalSalesTarget * 100).toFixed(2) : 0;

    container.innerHTML = `
        <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">FY${state.fiscalYear} Plan</h2>
        <div style="padding: 0.75rem; margin-bottom: 1rem; text-align: center; background-color: #111827; border-radius: 0.5rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <div><strong>Total Planned Sales (${vendorView === 'all' ? 'All Vendors' : vendorLabel(vendorView)}):</strong> ${formatCurrency(totalPlannedSales)} of ${formatCurrency(state.totalSalesTarget)} (${salesGoalPercent}%)</div>
            <div style="font-size: 0.9em; color: var(--text-dark);"><strong>Expected Contract Cost:</strong> ${formatCurrency(totalPlannedContractCost)}</div>
        </div>
    `;

    scenario.denominations.filter(d => d.isActive).forEach(denom => {
        const group = document.createElement('div');
        group.className = 'game-group';
        group.dataset.price = denom.price;

        const gamesInGroup = gamesForView.filter(g => g.denominationPrice === denom.price).sort((a, b) => a.name.localeCompare(b.name));

        const toggleIcon = denom.isCollapsed ? '►' : '▼';
        const tableDisplay = denom.isCollapsed ? 'display:none;' : '';

        group.innerHTML = `
            <div class="game-group-header" data-action="toggle-collapse">
                <span class="toggle-icon">${toggleIcon}</span>
                <h3>$${denom.price} Games</h3>
                <button style="margin-left: auto;" data-action="add-game">+ Add Game</button>
            </div>
            <div style="${tableDisplay}">
            <table class="game-table">
                <thead>
                    <tr>
                        <th>Game #</th><th>Game Name</th><th>Vendor</th><th>Cost Model</th>
                        <th>Units</th><th>Payout %</th><th>Features</th>
                        <th>Contract Cost</th><th>Prize Expense</th><th>Total COGS</th><th>Gross Margin</th>
                        <th>PO #</th><th>PO Date</th><th>Receipt Date</th><th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${gamesInGroup.map(game => renderGameRow(game, state)).join('')}
                </tbody>
            </table>
            </div>`;
        container.appendChild(group);
    });

    // --- NON-SCRATCHER ITEMS SECTION ---
    if (scenario.nonScratcherItems) {
        const nsGroup = document.createElement('div');
        nsGroup.className = 'game-group';
        nsGroup.style.marginTop = '2rem';
        nsGroup.dataset.isNonScratcher = "true";

        const isNsCollapsed = state.ui.nonScratcherCollapsed || false;
        const toggleNsIcon = isNsCollapsed ? '►' : '▼';
        const tableNsDisplay = isNsCollapsed ? 'display:none;' : '';

        nsGroup.innerHTML = `
            <div class="game-group-header" data-action="toggle-ns-collapse" style="background-color: #2D3748; border-color: #4A5568;">
                <span class="toggle-icon">${toggleNsIcon}</span>
                <h3>Non-Scratcher / Marketing Items</h3>
                <button style="margin-left: auto; background-color: var(--accent-light); color: #fff;" data-action="add-ns-item">+ Add Item</button>
            </div>
            <div style="${tableNsDisplay}">
            <table class="game-table" style="background-color: #1A202C;">
                <thead>
                    <tr>
                        <th style="width: 25%">Item Name</th>
                        <th style="width: 20%">Vendor</th>
                        <th style="width: 20%">Associated Holiday / Campaign</th>
                        <th style="width: 15%">Total Cost</th>
                        <th>PO #</th><th>PO Date</th><th>Receipt Date</th><th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${(scenario.nonScratcherItems.length === 0)
                ? `<tr><td colspan="9" style="text-align:center; padding: 1rem; color: #718096;">No non-scratcher items planned for this scenario.</td></tr>`
                : scenario.nonScratcherItems.map(item => renderNonScratcherRow(item, state)).join('')}
                </tbody>
            </table>
            </div>`;
        container.appendChild(nsGroup);
    }
}

function renderNonScratcherRow(item, state) {
    return `
        <tr data-ns-item-id="${item.id}" style="background-color: rgba(255, 255, 255, 0.02);">
            <td><input type="text" value="${item.name || ''}" data-ns-prop="name" placeholder="E.g., Pack Inserts"></td>
            <td>
                <select data-ns-prop="vendorId">
                    <option value="">None / Internal</option>
                    ${state.vendors.map(v => `<option value="${v.id}" ${item.vendorId === v.id ? 'selected' : ''}>${v.name}</option>`).join('')}
                </select>
            </td>
            <td><input type="text" value="${item.associatedHoliday || ''}" data-ns-prop="associatedHoliday" placeholder="E.g., Winter 2027"></td>
            <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="color: var(--text-dark);">$</span>
                    <input type="text" class="ns-cost-input" value="${(item.cost || 0).toLocaleString('en-US')}" inputmode="numeric" data-ns-prop="cost" style="width: 100px;">
                </div>
            </td>
            <td><input type="text" value="${item.poNumber || ''}" placeholder="PO #" data-ns-prop="poNumber" size="10"></td>
            <td>
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="date" value="${item.poDate || ''}" data-ns-prop="poDate">
                    <button title="Pick date" data-action="open-date">📅</button>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="date" value="${item.receiptDate || ''}" data-ns-prop="receiptDate">
                    <button title="Pick date" data-action="open-date">📅</button>
                </div>
            </td>
            <td>
                <select data-ns-prop="status">
                    ${['Planned', 'Ordered', 'Delivered', 'Cancelled'].map(s => `<option value="${s}" ${item.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td><button data-action="delete-ns-item">🗑️</button></td>
        </tr>`;
}

function renderGameRow(game, state) {
    const metrics = calculateGameMetrics(game, state);
    const presets = CONTRACT_UNIT_PRESETS[game.denominationPrice] || CONTRACT_UNIT_PRESETS.default;
    const presetOptions = presets.map(n => `<option value="${n}">${n.toLocaleString('en-US')}</option>`).join('');
    const model = state.vendorPricing[game.vendorId]?.costModel || 'percentOfSales';
    const modelLabel = model === 'percentOfSales' ? '% of Sales' : 'Per Thousand';

    return `
        <tr data-game-id="${game.id}">
            <td><input type="text" value="${game.gameNumber || ''}" data-prop="gameNumber" maxlength="4" size="4"></td>
            <td><input type="text" value="${game.name}" data-prop="name"></td>
            <td>
                <select data-prop="vendorId">
                    <option value="sg" ${game.vendorId === 'sg' ? 'selected' : ''}>Scientific Games</option>
                    <option value="pb" ${game.vendorId === 'pb' ? 'selected' : ''}>Pollard Banknote</option>
                    <option value="bs" ${game.vendorId === 'bs' ? 'selected' : ''}>Brightstar</option>
                </select>
            </td>
            <td>${modelLabel}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <select class="units-preset">
                        <option value="">Presets…</option>
                        ${presetOptions}
                        <option value="custom">Custom…</option>
                    </select>
                    <input type="text" class="units-input" value="${game.units.toLocaleString('en-US')}" inputmode="numeric" data-prop="units">
                </div>
            </td>
            <td><input type="number" value="${game.payoutPercent}" step="0.1" data-prop="payoutPercent"></td>
            <td>${(game.featureIds && game.featureIds.length) ? game.featureIds.join(', ') : 'None'} <button style="font-size: 0.75rem;" data-action="edit-features">Edit</button></td>
            <td data-metric="contractCost">${formatCurrency(metrics.contractCost)}</td>
            <td data-metric="prizeExpense">${formatCurrency(metrics.prizeExpense)}</td>
            <td data-metric="cogs">${formatCurrency(metrics.cogs)}</td>
            <td data-metric="grossMargin" style="color:${metrics.grossMargin < 0 ? 'var(--danger-color)' : '#22c55e'}">${formatCurrency(metrics.grossMargin)}</td>
            <td><input type="text" value="${game.poNumber || ''}" placeholder="PO #" data-prop="poNumber"></td>
            <td>
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="date" value="${game.poDate || ''}" data-prop="poDate">
                    <button title="Pick date" data-action="open-date">📅</button>
                </div>
            </td>
            <td>
                <div style="display:flex;align-items:center;gap:4px;">
                    <input type="date" value="${game.receiptDate || ''}" data-prop="receiptDate">
                    <button title="Pick date" data-action="open-date">📅</button>
                </div>
            </td>
            <td>
                <select data-prop="deliveryStatus">
                    ${['Planned', 'Ordered', 'Delivered', 'Cancelled'].map(s => `<option value="${s}" ${game.deliveryStatus === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </td>
            <td><button data-action="delete-game">🗑️</button></td>
        </tr>`;
}

export function renderRightPanel() {
    const state = getState();
    const container = byId('right-panel');

    if (state.ui.rightCollapsed) {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; height: 100%; cursor: pointer; padding-top: 8px;" data-action="toggle-right" title="Expand Vendor Pricing">
                <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 4px; color: var(--text-light);">◀</button>
                <div style="writing-mode: vertical-rl; margin-top: 1rem; font-weight: 600; color: var(--text-dark);">Vendor Pricing</div>
            </div>
        `;
        return;
    }

    const vendors = [{ id: 'sg', name: 'Scientific Games' }, { id: 'pb', name: 'Pollard Banknote' }, { id: 'bs', name: 'Brightstar' }];
    const header = `<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <h3 style="border: none; margin: 0; padding: 0;">Vendor Pricing</h3>
        <div style="display: flex; gap: 8px; align-items: center;">
            <button id="manage-features-btn" style="padding: 4px 8px; font-size: 0.8rem;">Features</button>
            <button data-action="toggle-right" title="Fold Vendor Pricing" style="padding: 2px 6px; font-size: 0.8rem;">▶</button>
        </div>
    </div>`;
    const tabs = `<div style="display: flex; border-bottom: 1px solid var(--border-color);">${vendors.map(v => `<button class="tab-btn" style="padding: 0.5rem 1rem; margin-bottom: -1px; border: 2px solid transparent; ${state.ui.activeVendorTab === v.id ? 'border-bottom-color: var(--accent-color); color: var(--accent-color);' : ''}" data-vendor-id="${v.id}">${v.name}</button>`).join('')}</div>`;

    let content = vendors.map(v => {
        const vd = state.vendorPricing[v.id] || {};
        const costModel = vd.costModel || 'percentOfSales';

        const baseCostRows = STANDARD_DENOMINATIONS.map(price => {
            const val = vd.baseCosts?.[price] ?? 0;
            return `<tr><td style="padding: 0.25rem 0;">$${price} Base Cost</td><td><input type="number" value="${val}" step="0.01" class="base-cost-input" data-denom-price="${price}"></td></tr>`;
        }).join('');

        const featureRows = state.featureMasterList.map(f => {
            const name = f['Generic Feature'];
            const saved = vd.features?.[name] ?? '';
            return `<tr><td style="padding: 0.25rem 0;">${name}</td><td><input type="number" value="${saved}" placeholder="0.00" step="0.01" data-feature-name="${name}"></td></tr>`;
        }).join('');

        return `
            <div class="tab-content" style="margin-top: 1rem; ${state.ui.activeVendorTab === v.id ? 'display:block;' : ''}" id="tab-${v.id}">
                <h4>Pricing for ${v.name}</h4>
                <div style="margin: 0.5rem 0;">
                    <strong>Cost Model:</strong>
                    <label style="margin-left: 1rem;"><input type="radio" name="costModel-${v.id}" value="percentOfSales" ${costModel === 'percentOfSales' ? 'checked' : ''}> % of Sales</label>
                    <label style="margin-left: 0.5rem;"><input type="radio" name="costModel-${v.id}" value="perThousand" ${costModel === 'perThousand' ? 'checked' : ''}> Per Thousand</label>
                </div>
                <table style="width: 100%; font-size: 0.875rem;">
                    <thead><tr><th style="text-align: left;">Item</th><th style="text-align: left;">Cost</th></tr></thead>
                    <tbody>
                        <tr><td colspan="2" style="font-weight: 600; padding-top: 0.5rem; background: var(--bg-light); border-bottom: 1px solid var(--border-color);">Base Costs</td></tr>
                        ${baseCostRows}
                        <tr><td colspan="2" style="font-weight: 600; padding-top: 0.5rem; background: var(--bg-light); border-bottom: 1px solid var(--border-color);">Feature Costs (Per Thousand)</td></tr>
                        ${featureRows}
                    </tbody>
                </table>
            </div>`;
    }).join('');
    container.innerHTML = header + tabs + content;
}

export function renderAuditTrail() {
    const state = getState();
    const container = byId('footer');

    if (state.ui.bottomCollapsed) {
        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" data-action="toggle-bottom" title="Expand Audit Trail">
                <h4 style="margin: 0; color: var(--text-dark);">Audit Trail</h4>
                <button style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0; color: var(--text-light);">▲</button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
            <h4 style="margin: 0;">Audit Trail</h4>
            <div style="display: flex; gap: 8px; align-items: center;">
                <button id="clear-log-btn" style="padding: 4px 8px; font-size: 0.75rem;">Clear Log</button>
                <button data-action="toggle-bottom" title="Fold Audit Trail" style="padding: 2px 6px; font-size: 0.8rem;">▼</button>
            </div>
        </div>
        <div id="log-entries" style="font-size: 0.75rem; color: #9ca3af; space-y: 0.25rem;">
        ${state.auditLog.slice(0, 5).map(log => `<p>[${log.timestamp}] ${log.message}</p>`).join('')}
        </div>
    `;
}

export function refreshGameRow(gameId) {
    const state = getState();
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return;

    const game = scenario.games.find(g => g.id === gameId);
    if (!game) return;
    const row = document.querySelector(`tr[data-game-id="${gameId}"]`);
    if (!row) return;

    const metrics = calculateGameMetrics(game, state);
    row.querySelector('[data-metric="contractCost"]').textContent = formatCurrency(metrics.contractCost);
    row.querySelector('[data-metric="prizeExpense"]').textContent = formatCurrency(metrics.prizeExpense);
    row.querySelector('[data-metric="cogs"]').textContent = formatCurrency(metrics.cogs);
    const grossMarginCell = row.querySelector('[data-metric="grossMargin"]');
    grossMarginCell.textContent = formatCurrency(metrics.grossMargin);
    grossMarginCell.style.color = metrics.grossMargin < 0 ? 'var(--danger-color)' : '#22c55e';
}
