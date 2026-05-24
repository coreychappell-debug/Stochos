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
                { id: 'g1', gameNumber: '1234', denominationPrice: 5, ticketSize: '6x4', name: 'Lucky 7s #123', vendorId: 'sg', units: 12000000, payoutPercent: 68.5, featureIds: [], poNumber: '', poDate: '', receiptDate: '', deliveryStatus: 'Planned' },
                { id: 'g2', gameNumber: '5678', denominationPrice: 10, ticketSize: '8x4', name: 'Ultimate Cash #234', vendorId: 'pb', units: 18000000, payoutPercent: 71.0, featureIds: ["Holographic Foil"], poNumber: '', poDate: '', receiptDate: '', deliveryStatus: 'Planned' }
            ]
        }
    ],
    vendorPricing: {
        sg: { costModel: 'percentOfSales', baseCosts: { '2.4x4': [{ quantity: 1000000000, cost: 1.5 }], '4x4': [{ quantity: 1000000000, cost: 1.5 }], '6x4': [{ quantity: 1000000000, cost: 1.5 }], '8x4': [{ quantity: 1000000000, cost: 1.5 }], '12x8': [{ quantity: 1000000000, cost: 1.5 }], '12x12': [{ quantity: 1000000000, cost: 1.5 }] }, features: {} },
        pb: { costModel: 'perThousand', baseCosts: { '2.4x4': [{ quantity: 1000000000, cost: 21.8 }], '4x4': [{ quantity: 1000000000, cost: 21.8 }], '6x4': [{ quantity: 1000000000, cost: 21.8 }], '8x4': [{ quantity: 1000000000, cost: 21.8 }], '12x8': [{ quantity: 1000000000, cost: 21.8 }], '12x12': [{ quantity: 1000000000, cost: 21.8 }] }, features: {} },
        bs: { costModel: 'perThousand', baseCosts: { '2.4x4': [{ quantity: 1000000000, cost: 23.1 }], '4x4': [{ quantity: 1000000000, cost: 23.1 }], '6x4': [{ quantity: 1000000000, cost: 23.1 }], '8x4': [{ quantity: 1000000000, cost: 23.1 }], '12x8': [{ quantity: 1000000000, cost: 23.1 }], '12x12': [{ quantity: 1000000000, cost: 23.1 }] }, features: {} }
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

// Ensure old saves without scenarios are wrapped into one, and upgrade ticket size schema
export function migrateStateToScenarios(savedState) {
    if (!savedState) return savedState;
    let migrated = { ...savedState };

    if (!migrated.scenarios || !migrated.activeScenarioId) {
        console.log('[state] Migrating old flat state to Scenario structure...');
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
    }

    // Migrate vendor base costs to tiered structure keyed by Ticket Size
    if (migrated.vendorPricing) {
        for (const vId in migrated.vendorPricing) {
            const vendor = migrated.vendorPricing[vId];

            // If they still have a global float baseCostValue
            if (vendor.baseCostValue !== undefined) {
                const val = vendor.baseCostValue;
                vendor.baseCosts = {
                    '2.4x4': [{ quantity: 1000000000, cost: val }],
                    '4x4': [{ quantity: 1000000000, cost: val }],
                    '6x4': [{ quantity: 1000000000, cost: val }],
                    '8x4': [{ quantity: 1000000000, cost: val }],
                    '12x8': [{ quantity: 1000000000, cost: val }],
                    '12x12': [{ quantity: 1000000000, cost: val }]
                };
                delete vendor.baseCostValue;
            } else if (vendor.baseCosts && !Array.isArray(vendor.baseCosts['4x4'])) {
                // It means they have the object with { 1: 21.8, 2: 21.8 ... } mapping denom -> float
                // Or maybe just an old float object mapping ticketSize -> float
                // Let's force it to the new array structure using the default mapping
                // First grab the default mapping logic without importing directly, just redefine it locally for safe migration
                const mapDenomToSize = { 1: '2.4x4', 2: '4x4', 3: '4x4', 5: '6x4', 10: '8x4', 20: '8x4', 25: '8x4', 30: '8x4', 50: '12x8' };
                let newBaseCosts = {};
                for (const oldKey in vendor.baseCosts) {
                    const mappedSize = mapDenomToSize[oldKey] || '4x4';
                    const oldVal = vendor.baseCosts[oldKey];
                    // If oldVal is a float, wrap it in a tier array
                    if (typeof oldVal === 'number') {
                        if (!newBaseCosts[mappedSize]) newBaseCosts[mappedSize] = [];
                        newBaseCosts[mappedSize].push({ quantity: 1000000000, cost: oldVal });
                    } else if (Array.isArray(oldVal)) {
                        // It's already an array, so it might be a valid ticket Size old thing already? Unlikely, but pass through
                        newBaseCosts[oldKey] = oldVal;
                    }
                }

                // Fill any missing sizes
                ['2.4x4', '4x4', '6x4', '8x4', '12x8', '12x12'].forEach(size => {
                    if (!newBaseCosts[size]) newBaseCosts[size] = [{ quantity: 1000000000, cost: 0 }];
                });
                vendor.baseCosts = newBaseCosts;
            }
        }
    }

    // Ensure all games have a ticketSize
    migrated.scenarios.forEach(sc => {
        sc.games.forEach(g => {
            if (!g.ticketSize) {
                const mapDenomToSize = { 1: '2.4x4', 2: '4x4', 3: '4x4', 5: '6x4', 10: '8x4', 20: '8x4', 25: '8x4', 30: '8x4', 50: '12x8' };
                g.ticketSize = mapDenomToSize[g.denominationPrice] || '4x4';
            }
        });
    });

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
