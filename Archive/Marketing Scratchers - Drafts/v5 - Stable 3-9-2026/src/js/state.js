import { parseCSV } from './utils.js';
import { FEATURES_CSV_DATA } from './constants.js';

let state = {};
export let initialState = {
    fiscalYear: new Date().getFullYear() + 1,
    totalSalesTarget: 5_000_000_000,
    retailerCommissionPercent: 5.0,
    administrativeExpensePercent: 0.0,
    sellThroughPercent: 98.0,
    activeScenarioId: 's1',
    scenarios: [
        {
            id: 's1',
            name: 'Base Plan',
            denominations: [
                { price: 1, mixPercent: 10, isActive: true, isCollapsed: false }, { price: 2, mixPercent: 15, isActive: true, isCollapsed: false },
                { price: 3, mixPercent: 10, isActive: true, isCollapsed: false }, { price: 5, mixPercent: 25, isActive: true, isCollapsed: false },
                { price: 10, mixPercent: 20, isActive: true, isCollapsed: false }, { price: 20, mixPercent: 15, isActive: true, isCollapsed: false },
                { price: 25, mixPercent: 0, isActive: true, isCollapsed: false }, { price: 30, mixPercent: 5, isActive: true, isCollapsed: false },
                { price: 50, mixPercent: 0, isActive: false, isCollapsed: false }
            ],
            games: [
                { id: 'g1', gameNumber: '1234', denominationPrice: 5, name: 'Lucky 7s #123', vendorId: 'sg', units: 12000000, payoutPercent: 68.5, featureIds: [], poNumber: '', poDate: '', receiptDate: '', deliveryStatus: 'Planned' },
                { id: 'g2', gameNumber: '5678', denominationPrice: 10, name: 'Ultimate Cash #234', vendorId: 'pb', units: 18000000, payoutPercent: 71.0, featureIds: ["Holographic Foil"], poNumber: '', poDate: '', receiptDate: '', deliveryStatus: 'Planned' }
            ]
        }
    ],
    vendorPricing: {
        sg: { costModel: 'percentOfSales', baseCosts: { 1: 1.5, 2: 1.5, 3: 1.5, 5: 1.5, 10: 1.5, 20: 1.5, 25: 1.5, 30: 1.5, 50: 1.5 }, features: {} },
        pb: { costModel: 'perThousand', baseCosts: { 1: 21.8, 2: 21.8, 3: 21.8, 5: 21.8, 10: 21.8, 20: 21.8, 25: 21.8, 30: 21.8, 50: 21.8 }, features: {} },
        bs: { costModel: 'perThousand', baseCosts: { 1: 23.1, 2: 23.1, 3: 23.1, 5: 23.1, 10: 23.1, 20: 23.1, 25: 23.1, 30: 23.1, 50: 23.1 }, features: {} }
    },
    featureMasterList: [],
    auditLog: [],
    ui: { activeVendorTab: 'sg', editingFeaturesForGameId: null, vendorFilter: 'all', leftCollapsed: false, rightCollapsed: false, bottomCollapsed: false }
};

let history = [];
let historyIndex = -1;
let db;
const DB_NAME = 'PlanDB';
const STORE_NAME = 'PlanStore';

let onRender = () => { };

export function initializeState(renderCallback) {
    onRender = renderCallback;
}

export function getActiveScenario() {
    return state.scenarios.find(s => s.id === state.activeScenarioId) || state.scenarios[0];
}

export function getState() { return state; }

export function setState(newState) {
    state = migrateStateToScenarios(newState);
    onRender();
}

// Ensure old saves without scenarios are wrapped into one
export function migrateStateToScenarios(savedState) {
    if (!savedState) return savedState;
    if (savedState.scenarios && savedState.activeScenarioId) return savedState; // Already migrated

    console.log('[state] Migrating old flat state to Scenario structure...');
    const migrated = { ...savedState };
    if (!migrated.ui) migrated.ui = {};
    if (typeof migrated.ui.leftCollapsed === 'undefined') migrated.ui.leftCollapsed = false;
    if (typeof migrated.ui.rightCollapsed === 'undefined') migrated.ui.rightCollapsed = false;
    if (typeof migrated.ui.bottomCollapsed === 'undefined') migrated.ui.bottomCollapsed = false;

    migrated.activeScenarioId = 's1';
    migrated.scenarios = [{
        id: 's1',
        name: 'Base Plan',
        games: migrated.games || [],
        denominations: migrated.denominations || []
    }];
    delete migrated.games;
    delete migrated.denominations;

    // Migrate vendor base costs
    if (migrated.vendorPricing) {
        for (const vId in migrated.vendorPricing) {
            const vendor = migrated.vendorPricing[vId];
            if (vendor.baseCostValue !== undefined) {
                const val = vendor.baseCostValue;
                vendor.baseCosts = { 1: val, 2: val, 3: val, 5: val, 10: val, 20: val, 25: val, 30: val, 50: val };
                delete vendor.baseCostValue;
            }
        }
    }

    return migrated;
}

export function commit(mutationFn, auditMsg) {
    const prevStateForHistory = JSON.parse(JSON.stringify(state));
    mutationFn(state);

    history = history.slice(0, historyIndex + 1);
    history.push(prevStateForHistory);
    historyIndex++;

    if (auditMsg) logAudit(auditMsg);

    onRender();
    debouncedAutosave();
}

export function logAudit(msg) {
    const ts = new Date().toLocaleTimeString('en-US');
    state.auditLog.unshift({ timestamp: ts, message: msg });
    if (state.auditLog.length > 50) state.auditLog.pop();
}

// --- HISTORY ---
export function canUndo() { return historyIndex > 0; }
export function canRedo() { return historyIndex < history.length - 1; }

export function undo() {
    if (canUndo()) {
        historyIndex--;
        setState(JSON.parse(JSON.stringify(history[historyIndex])));
        saveStateToDB();
        logAudit('Action: Undo.');
    }
}

export function redo() {
    if (canRedo()) {
        historyIndex++;
        setState(JSON.parse(JSON.stringify(history[historyIndex])));
        saveStateToDB();
        logAudit('Action: Redo.');
    }
}

export function recordHistory(isInitial = false) {
    if (isInitial) {
        history = [JSON.parse(JSON.stringify(state))];
        historyIndex = 0;
    }
}

// --- DB & AUTOSAVE ---
export async function openDBSafe() {
    return new Promise((resolve) => {
        if (!('indexedDB' in window)) return resolve();
        const req = indexedDB.open(DB_NAME, 1);
        req.onerror = () => resolve();
        req.onsuccess = (e) => { db = e.target.result; resolve(); };
        req.onupgradeneeded = (e) => e.target.result.createObjectStore(STORE_NAME);
    });
}

export function saveStateToDB() {
    if (!db) return;
    const shallow = JSON.parse(JSON.stringify(state));
    shallow.auditLog = [];
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(shallow, 'autosavedPlan');
}

let autosaveTimeout;
const debouncedAutosave = () => {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(saveStateToDB, 1200);
};

export function restoreFromAutosaveSafe() {
    return new Promise((resolve) => {
        if (!db) return resolve(false);
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('autosavedPlan');
        req.onsuccess = (e) => {
            const saved = e.target.result;
            resolve(saved || false);
        };
        req.onerror = () => resolve(false);
    });
}
