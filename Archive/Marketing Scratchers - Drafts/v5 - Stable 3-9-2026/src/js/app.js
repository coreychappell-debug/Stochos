import { byId, formatCurrency, vendorLabel, parseCSV } from './utils.js';
import {
    getState, setState, commit, initialState,
    openDBSafe, restoreFromAutosaveSafe, recordHistory,
    undo, redo, saveStateToDB, logAudit
} from './state.js';
import {
    render, refreshGameRow, renderDenominations,
    renderCenterPanel, renderRightPanel, renderAuditTrail
} from './ui-render.js';
import { CONTRACT_UNIT_PRESETS, FEATURES_CSV_DATA } from './constants.js';

// --- INIT ---
document.addEventListener('DOMContentLoaded', boot);

async function boot() {
    try {
        await openDBSafe();
        const restored = await restoreFromAutosaveSafe();

        // Connect state to render
        import('./state.js').then(m => m.initializeState(render));

        if (restored) {
            // Restore from DB but allow user to confirm (as in original code)
            showConfirm('An autosaved plan was found. Restore it?', () => {
                setState(restored);
                logAudit('Plan restored from autosave.');
                recordHistory(true);
                render();
            }, () => {
                setState(JSON.parse(JSON.stringify(initialState)));
                loadInitialData();
            });
        } else {
            setState(JSON.parse(JSON.stringify(initialState)));
            loadInitialData();
        }
    } catch (e) {
        console.warn('[init] Non-fatal init error:', e);
        setState(JSON.parse(JSON.stringify(initialState)));
        loadInitialData();
    }
}

function loadInitialData() {
    setupEventListeners();
    initializeVendorPricing();
    loadFeatures();
    recordHistory(true);
    render();
}

function loadFeatures() {
    getState().featureMasterList = parseCSV(FEATURES_CSV_DATA);
}

function initializeVendorPricing() {
    const state = getState();
    ['sg', 'pb', 'bs'].forEach(v => {
        state.vendorPricing[v] ||= {};
        state.vendorPricing[v].features ||= {};
        state.vendorPricing[v].costModel ||= 'percentOfSales';
    });
}

// --- EVENTS ---
function setupEventListeners() {
    byId('undo-btn').addEventListener('click', undo);
    byId('redo-btn').addEventListener('click', redo);
    byId('fiscal-year').addEventListener('change', handleGlobalChange);
    byId('total-sales-target').addEventListener('change', handleGlobalChange);
    byId('retailer-comm').addEventListener('change', handleGlobalChange);
    byId('admin-expense').addEventListener('change', handleGlobalChange);
    byId('sell-through').addEventListener('change', handleGlobalChange);
    byId('vendor-filter').addEventListener('change', handleGlobalChange);

    byId('load-plan-btn').addEventListener('click', () => byId('load-plan-input').click());
    byId('load-plan-input').addEventListener('change', loadPlan);
    byId('save-plan-btn').addEventListener('click', savePlan);

    byId('left-panel').addEventListener('change', handleLeftPanelChange);
    byId('left-panel').addEventListener('click', handleLeftPanelClick);

    byId('center-panel').addEventListener('focus', handleCenterPanelFocus, true);
    byId('center-panel').addEventListener('input', handleCenterPanelInput);
    byId('center-panel').addEventListener('change', handleCenterPanelChange);
    byId('center-panel').addEventListener('click', handleCenterPanelClick);

    byId('right-panel').addEventListener('click', handleRightPanelClick);
    byId('right-panel').addEventListener('change', handleRightPanelChange);

    byId('feature-modal').addEventListener('click', handleModalEvents);
    byId('feature-management-modal').addEventListener('click', handleFeatureManagementModalEvents);
    byId('confirm-modal').addEventListener('click', (e) => {
        if (!e.target.closest('.modal-content') || e.target.id === 'confirm-cancel-btn') {
            closeConfirm();
        }
    });

    byId('footer').addEventListener('click', handleFooterEvents);

    // Scenario actions
    const scenarioBar = byId('scenario-bar');
    if (scenarioBar) {
        scenarioBar.addEventListener('click', handleScenarioClick);
    }

    // Exports
    byId('export-summary-csv').addEventListener('click', e => { e.preventDefault(); exportReport('summary', 'csv'); });
    byId('export-summary-xlsx').addEventListener('click', e => { e.preventDefault(); exportReport('summary', 'xlsx'); });
    byId('export-detail-csv').addEventListener('click', e => { e.preventDefault(); exportReport('detail', 'csv'); });
    byId('export-detail-xlsx').addEventListener('click', e => { e.preventDefault(); exportReport('detail', 'xlsx'); });
}

// --- HANDLERS ---
function handleScenarioClick(e) {
    const target = e.target;

    // Switch Tabs
    const tab = target.closest('.scenario-tab');
    if (tab && !tab.classList.contains('active')) {
        const id = tab.dataset.scenarioId;
        commit(s => { s.activeScenarioId = id; }, `Switched to scenario ${id}`);
        return;
    }

    // Actions
    if (target.id === 'add-scenario-btn') {
        commit(s => {
            const newId = `s${Date.now()}`;
            s.scenarios.push({
                id: newId,
                name: `Scenario ${s.scenarios.length + 1}`,
                games: [],
                denominations: JSON.parse(JSON.stringify(s.scenarios[0]?.denominations || []))
            });
            s.activeScenarioId = newId;
        }, 'Created new scenario');
    } else if (target.id === 'duplicate-scenario-btn') {
        commit(s => {
            const current = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (!current) return;
            const newId = `s${Date.now()}`;
            const duplicate = JSON.parse(JSON.stringify(current));
            duplicate.id = newId;
            duplicate.name = `${current.name} (Copy)`;
            // Provide fresh IDs to games so they don't visually overlap when deleting
            duplicate.games.forEach(g => g.id = `g${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
            s.scenarios.push(duplicate);
            s.activeScenarioId = newId;
        }, 'Duplicated scenario');
    } else if (target.id === 'delete-scenario-btn') {
        const state = getState();
        if (state.scenarios.length <= 1) return;
        const current = state.scenarios.find(sc => sc.id === state.activeScenarioId);

        showConfirm(`Are you sure you want to delete scenario "${current?.name}"?`, () => {
            commit(s => {
                const idx = s.scenarios.findIndex(sc => sc.id === s.activeScenarioId);
                if (idx > -1) {
                    s.scenarios.splice(idx, 1);
                    s.activeScenarioId = s.scenarios[0].id;
                }
            }, 'Deleted scenario');
        });
    }
}

function handleGlobalChange(e) {
    const { id, value } = e.target;
    let msg = '';
    const mutation = s => {
        if (id === 'fiscal-year') {
            const newYear = parseInt(value, 10);
            if (newYear && String(newYear).length === 4) {
                s.fiscalYear = newYear;
                msg = `Fiscal Year changed to ${newYear}.`;
            }
        } else if (id === 'total-sales-target') {
            const newTarget = parseFloat(value.replace(/,/g, '')) || 0;
            s.totalSalesTarget = newTarget;
            msg = `Total Sales Target changed to ${formatCurrency(newTarget)}.`;
        } else if (id === 'retailer-comm') {
            const newVal = parseFloat(value) || 0;
            s.retailerCommissionPercent = newVal;
            msg = `Retailer Commission changed to ${newVal}%.`;
        } else if (id === 'admin-expense') {
            const newVal = parseFloat(value) || 0;
            s.administrativeExpensePercent = newVal;
            msg = `Administrative Expense changed to ${newVal}%.`;
        } else if (id === 'sell-through') {
            const newVal = parseFloat(value) || 0;
            s.sellThroughPercent = newVal;
            msg = `Sell-through Rate changed to ${newVal}%.`;
        } else if (id === 'vendor-filter') {
            s.ui.vendorFilter = value;
            msg = `Vendor view changed to '${value}'.`;
        }
    };
    commit(mutation, msg);
}

function handleLeftPanelChange(e) {
    const denomDiv = e.target.closest('.denom-item');
    if (!denomDiv) return;
    const price = parseInt(denomDiv.dataset.price, 10);
    const prop = e.target.dataset.prop;
    const value = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value) || 0;

    commit(s => {
        const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
        if (!scenario) return;
        const denom = scenario.denominations.find(d => d.price === price);
        if (denom && prop) denom[prop] = value;
    }, `Updated $${price} denomination.`);
}

function handleLeftPanelClick(e) {
    const target = e.target;
    if (target.closest('[data-action="toggle-left"]')) {
        commit(s => { s.ui.leftCollapsed = !s.ui.leftCollapsed; }, `Toggled Denominations panel ${getState().ui.leftCollapsed ? 'open' : 'closed'}.`);
        return;
    }

    if (e.target.id === 'add-denom-btn') {
        const input = byId('new-denom-price');
        const price = parseFloat(input.value);
        if (!price || price <= 0) return showError("Please enter a valid price.");

        const currentScenario = getState().scenarios.find(sc => sc.id === getState().activeScenarioId);
        if (!currentScenario) return;

        if (currentScenario.denominations.some(d => d.price === price)) return showError(`$${price} already exists.`);

        commit(s => {
            const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (!scenario) return;
            scenario.denominations.push({ price, mixPercent: 0, isActive: true, isCollapsed: false });
            scenario.denominations.sort((a, b) => a.price - b.price);
        }, `Added price point $${price}.`);
        input.value = '';
    }
}

function handleCenterPanelFocus(e) {
    const target = e.target;
    if (target.dataset.prop === 'units') {
        target.value = target.value.replace(/,/g, '');
    }
}

function handleCenterPanelInput(e) {
    const row = e.target.closest('tr[data-game-id]');
    if (!row) return;
    const gameId = row.dataset.gameId;
    const prop = e.target.dataset.prop;
    if (!gameId || !prop) return;

    const currentScenario = getState().scenarios.find(sc => sc.id === getState().activeScenarioId);
    if (!currentScenario) return;

    const game = currentScenario.games.find(g => g.id === gameId);
    if (!game) return;

    let value;
    if (prop === 'units') {
        value = parseFloat(e.target.value.replace(/,/g, '')) || 0;
    } else {
        value = e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value;
    }

    game[prop] = value;

    if (['units', 'payoutPercent', 'vendorId'].includes(prop)) {
        refreshGameRow(gameId);
    }
}

function handleNonScratcherInput(e) {
    const row = e.target.closest('tr[data-ns-item-id]');
    if (!row) return;
    const itemId = row.dataset.nsItemId;
    const prop = e.target.dataset.nsProp;
    if (!itemId || !prop) return;

    const currentScenario = getState().scenarios.find(sc => sc.id === getState().activeScenarioId);
    if (!currentScenario) return;

    const item = currentScenario.nonScratcherItems.find(i => i.id === itemId);
    if (!item) return;

    let value;
    if (prop === 'cost') {
        value = parseFloat(e.target.value.replace(/,/g, '')) || 0;
    } else {
        value = e.target.value;
    }

    item[prop] = value;

    // Refresh totals when cost changes
    if (prop === 'cost') {
        const centerPanel = byId('center-panel');
        if (centerPanel) {
            // A full re-render is safest to ensure top totals match, but we debounce it
            commit(s => { }, 'Updated Non-Scratcher item cost.');
        }
    }
}

function handleCenterPanelChange(e) {
    const row = e.target.closest('tr[data-game-id]');
    if (!row) return;
    const gameId = row.dataset.gameId;

    if (e.target.classList.contains('units-preset')) {
        const val = e.target.value;
        if (val && val !== 'custom') {
            const units = parseFloat(val) || 0;
            const unitsInput = row.querySelector('input[data-prop="units"]');
            if (unitsInput) unitsInput.value = units.toLocaleString('en-US');
            commit(s => {
                const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
                if (scenario) {
                    const g = scenario.games.find(x => x.id === gameId);
                    if (g) g.units = units;
                }
            }, `Set units preset to ${Number(val).toLocaleString('en-US')}.`);
        }
        return;
    }

    const prop = e.target.dataset.prop;
    if (!gameId || !prop) return;

    let value;
    if (prop === 'units') {
        value = parseFloat(e.target.value.replace(/,/g, '')) || 0;
        e.target.value = value.toLocaleString('en-US');
    } else {
        value = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    }

    commit(s => {
        const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
        if (!scenario) return;
        const game = scenario.games.find(g => g.id === gameId);
        if (game) game[prop] = value;
    }, `Updated game ${gameId} property ${prop}.`);
}

function handleNonScratcherChange(e) {
    const row = e.target.closest('tr[data-ns-item-id]');
    if (!row) return;
    const itemId = row.dataset.nsItemId;
    const prop = e.target.dataset.nsProp;
    if (!itemId || !prop) return;

    let value = e.target.value;
    if (prop === 'cost') {
        value = parseFloat(e.target.value.replace(/,/g, '')) || 0;
        e.target.value = value.toLocaleString('en-US');
    }

    commit(s => {
        const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
        if (!scenario) return;
        const item = scenario.nonScratcherItems.find(i => i.id === itemId);
        if (item) item[prop] = value;
    }, `Updated Non-Scratcher item ${itemId} property ${prop}.`);
}

function handleCenterPanelClick(e) {
    const target = e.target;
    const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const gameId = target.closest('tr[data-game-id]')?.dataset.gameId;
    const nsItemId = target.closest('tr[data-ns-item-id]')?.dataset.nsItemId;
    const price = parseInt(target.closest('.game-group')?.dataset.price, 10);
    const isNsGroup = target.closest('.game-group')?.dataset.isNonScratcher === "true";

    if (action === 'add-game') {
        const currentVendor = getState().ui.vendorFilter;
        commit(s => {
            const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (!scenario) return;
            const defaultVendor = (currentVendor && currentVendor !== 'all') ? currentVendor : 'sg';
            const defaultUnits = (CONTRACT_UNIT_PRESETS[price] || CONTRACT_UNIT_PRESETS.default)[0];
            scenario.games.push({
                id: `g${Date.now()}`, gameNumber: '', denominationPrice: price, name: 'New Game',
                vendorId: defaultVendor,
                units: defaultUnits, payoutPercent: 68.0, featureIds: [],
                poNumber: '', poDate: '', receiptDate: '', deliveryStatus: 'Planned'
            });
            const denom = scenario.denominations.find(d => d.price === price);
            if (denom) denom.isCollapsed = false;
        }, `Added new game to $${price}.`);
    } else if (action === 'delete-game' && gameId) {
        const currentScenario = getState().scenarios.find(sc => sc.id === getState().activeScenarioId);
        if (!currentScenario) return;
        const game = currentScenario.games.find(g => g.id === gameId);
        if (game) {
            showConfirm(`Delete "${game.name}"?`, () => {
                commit(s => {
                    const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
                    if (!scenario) return;
                    const idx = scenario.games.findIndex(g => g.id === gameId);
                    if (idx > -1) scenario.games.splice(idx, 1);
                }, `Deleted game '${game.name}'.`);
            });
        }
    } else if (action === 'edit-features' && gameId) {
        openFeatureModal(gameId);
    } else if (action === 'toggle-collapse') {
        commit(s => {
            const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (!scenario) return;
            const denom = scenario.denominations.find(d => d.price === price);
            if (denom) denom.isCollapsed = !denom.isCollapsed;
        }, `Toggled $${price} group.`);
    } else if (action === 'toggle-ns-collapse') {
        commit(s => {
            s.ui.nonScratcherCollapsed = !s.ui.nonScratcherCollapsed;
        }, `Toggled Non-Scratcher group.`);
    } else if (action === 'add-ns-item') {
        commit(s => {
            const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (!scenario) return;

            scenario.nonScratcherItems.push({
                id: `ns${Date.now()}`,
                name: 'New Item',
                vendorId: '',
                associatedHoliday: '',
                cost: 0,
                poNumber: '',
                poDate: '',
                receiptDate: '',
                status: 'Planned'
            });
        }, `Added new marketing/non-scratcher item.`);
    } else if (action === 'delete-ns-item' && nsItemId) {
        const currentScenario = getState().scenarios.find(sc => sc.id === getState().activeScenarioId);
        if (!currentScenario) return;

        const item = currentScenario.nonScratcherItems.find(i => i.id === nsItemId);
        if (item) {
            showConfirm(`Delete "${item.name}"?`, () => {
                commit(s => {
                    const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
                    if (!scenario) return;
                    const idx = scenario.nonScratcherItems.findIndex(i => i.id === nsItemId);
                    if (idx > -1) scenario.nonScratcherItems.splice(idx, 1);
                }, `Deleted Non-Scratcher item '${item.name}'.`);
            });
        }
    } else if (action === 'open-date') {
        const input = target.previousElementSibling;
        if (input && typeof input.showPicker === 'function') input.showPicker();
        else if (input) input.focus();
    }
}

function handleRightPanelClick(e) {
    const target = e.target.closest('[data-vendor-id], #manage-features-btn, [data-action="toggle-right"]');
    if (!target) return;

    if (target.dataset.action === 'toggle-right') {
        commit(s => { s.ui.rightCollapsed = !s.ui.rightCollapsed; }, `Toggled Vendor Pricing panel ${getState().ui.rightCollapsed ? 'open' : 'closed'}.`);
        return;
    }

    if (target.id === 'manage-features-btn') {
        openFeatureManagementModal();
    } else if (target.dataset.vendorId) {
        const vendorId = target.dataset.vendorId;
        if (vendorId !== getState().ui.activeVendorTab) {
            commit(s => {
                s.ui.activeVendorTab = vendorId;
            }, `Switched to ${vendorLabel(vendorId)} pricing view.`);
        }
    }
}

function handleRightPanelChange(e) {
    const vendorId = getState().ui.activeVendorTab;
    const vendorData = getState().vendorPricing[vendorId];
    if (!vendorData) return;

    if (e.target.name === `costModel-${vendorId}`) {
        const newModel = e.target.value;
        commit(s => {
            s.vendorPricing[vendorId].costModel = newModel;
        }, `Updated ${vendorId} cost model to ${newModel}.`);
    } else if (e.target.classList.contains('base-cost-input')) {
        const price = e.target.dataset.denomPrice;
        const cost = parseFloat(e.target.value) || 0;
        commit(s => {
            s.vendorPricing[vendorId].baseCosts[price] = cost;
        }, `Updated ${vendorId} base cost for $${price} game to ${cost}.`);
    } else {
        const { featureName } = e.target.dataset || {};
        const cost = parseFloat(e.target.value) || 0;
        if (featureName) {
            commit(s => {
                s.vendorPricing[vendorId].features[featureName] = cost;
            }, `Updated ${vendorId} price for '${featureName}' to ${cost}.`);
        }
    }
}

// --- MODALS ---
let confirmCallback = null;
let cancelCallback = null;
function showConfirm(message, onConfirm, onCancel) {
    byId('confirm-message').textContent = message;
    byId('confirm-modal').style.display = 'flex';
    confirmCallback = onConfirm;
    cancelCallback = onCancel;
}
function closeConfirm() {
    byId('confirm-modal').style.display = 'none';
    if (cancelCallback) cancelCallback();
    confirmCallback = null;
    cancelCallback = null;
}
byId('confirm-ok-btn').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
    cancelCallback = null;
    byId('confirm-modal').style.display = 'none';
});

function showError(message) {
    alert(message);
}

function openFeatureModal(gameId) {
    const state = getState();
    const scenario = state.scenarios.find(s => s.id === state.activeScenarioId);
    if (!scenario) return;
    state.ui.editingFeaturesForGameId = gameId;
    const game = scenario.games.find(g => g.id === gameId);
    if (!game) return;
    byId('modal-game-name').textContent = game.name;
    byId('feature-checklist').innerHTML = state.featureMasterList.map(f => {
        const name = f['Generic Feature'];
        const checked = game.featureIds?.includes(name) ? 'checked' : '';
        return `<label><input type="checkbox" name="${name}" ${checked}> ${name}</label>`;
    }).join('');
    byId('feature-modal').style.display = 'flex';
}

function openFeatureManagementModal() {
    const state = getState();
    const list = byId('feature-management-list');
    const renderList = () => {
        list.innerHTML = state.featureMasterList.map(f => {
            const name = f['Generic Feature'];
            return `<div data-name="${name}" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color);padding:6px 0;">
                <span>${name}</span>
                <button data-action="delete-feature" data-name="${name}" style="background:var(--danger-color);">Delete</button>
            </div>`;
        }).join('');
    };
    renderList();
    byId('feature-management-modal').style.display = 'flex';
}

function handleModalEvents(e) {
    if (e.target.id === 'modal-cancel-btn' || !e.target.closest('.modal-content')) {
        byId('feature-modal').style.display = 'none';
        getState().ui.editingFeaturesForGameId = null;
        return;
    }
    if (e.target.id === 'modal-save-btn') {
        const gameId = getState().ui.editingFeaturesForGameId;
        const checks = Array.from(byId('feature-checklist').querySelectorAll('input[type="checkbox"]'));
        const selected = checks.filter(c => c.checked).map(c => c.name);
        commit(s => {
            const scenario = s.scenarios.find(sc => sc.id === s.activeScenarioId);
            if (scenario) {
                const g = scenario.games.find(x => x.id === gameId);
                if (g) g.featureIds = selected;
            }
        }, 'Updated game features.');
        byId('feature-modal').style.display = 'none';
        getState().ui.editingFeaturesForGameId = null;
    }
}

function handleFeatureManagementModalEvents(e) {
    if (e.target.id === 'modal-done-btn' || !e.target.closest('.modal-content')) {
        byId('feature-management-modal').style.display = 'none';
        return;
    }
    if (e.target.id === 'add-feature-btn') {
        const input = byId('new-feature-name');
        const name = (input.value || '').trim();
        if (!name) return showError('Enter a feature name.');
        if (getState().featureMasterList.some(f => f['Generic Feature'] === name)) return showError('Feature already exists.');
        commit(s => { s.featureMasterList.push({ 'Generic Feature': name }); }, `Added feature '${name}'.`);
        input.value = '';
        openFeatureManagementModal();
    }
    if (e.target.dataset.action === 'delete-feature') {
        const name = e.target.dataset.name;
        showConfirm(`Delete feature '${name}' from master list? This will remove it from all games and vendor pricing.`, () => {
            commit(s => {
                s.featureMasterList = s.featureMasterList.filter(f => f['Generic Feature'] !== name);
                s.scenarios.forEach(sc => {
                    sc.games.forEach(g => g.featureIds = (g.featureIds || []).filter(x => x !== name));
                });
                Object.values(s.vendorPricing).forEach(v => { if (v.features) delete v.features[name]; });
            }, `Deleted feature '${name}'.`);
            openFeatureManagementModal();
        });
    }
}

function handleFooterEvents(e) {
    const target = e.target.closest('#clear-log-btn, [data-action="toggle-bottom"]');
    if (!target) return;

    if (target.dataset.action === 'toggle-bottom') {
        commit(s => { s.ui.bottomCollapsed = !s.ui.bottomCollapsed; }, `Toggled Audit Trail panel ${getState().ui.bottomCollapsed ? 'open' : 'closed'}.`);
        return;
    }

    if (target.id === 'clear-log-btn') {
        commit(s => s.auditLog = [], 'Audit log cleared.');
    }
}

// --- EXPORTS & LOAD/SAVE ---
function savePlan() {
    const json = JSON.stringify(getState(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `FY${getState().fiscalYear}_Plan.json`; a.click();
    URL.revokeObjectURL(url);
}

function loadPlan(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const loaded = JSON.parse(evt.target.result);
            if (!loaded.hasOwnProperty('fiscalYear')) throw new Error('Invalid plan file.');
            setState(loaded);
            logAudit('Plan loaded from file.');
            recordHistory(true);
            render();
        } catch { showError('Error: Could not load the selected file.'); }
    };
    reader.readAsText(file);
}

function exportReport(kind, format) {
    if (!window.XLSX) {
        return showError('Export library not loaded. Please check your connection and try again.');
    }
    const state = getState();
    const { calculateGameMetrics } = import('./calculations.js'); // Dynamic import for report

    // Note: In a real app we'd move export logic to its own module too.
    // For now, I'll keep it here or in utils.
    const scenario = state.scenarios.find(sc => sc.id === state.activeScenarioId);
    if (!scenario) return;

    if (kind === 'summary') {
        // ... summary export logic ...
    }
}
