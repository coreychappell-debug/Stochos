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
            { id: 'g1', denominationPrice: 5, name: 'Lucky 7s #123', vendorId: 'sg', units: 12000000, payoutPercent: 68.5, featureIds: [] },
            { id: 'g2', denominationPrice: 10, name: 'Ultimate Cash #234', vendorId: 'pb', units: 18000000, payoutPercent: 71.0, featureIds: ["Holographic Foil"] }
        ],
        vendorPricing: {
            sg: { baseCostPerThousand: 22.50, features: {} },
            pb: { baseCostPerThousand: 21.80, features: {} },
            bs: { baseCostPerThousand: 23.10, features: {} }
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
        document.getElementById('export-summary-csv').addEventListener('click', () => exportReport('summary', 'csv'));
        document.getElementById('export-summary-xlsx').addEventListener('click', () => exportReport('summary', 'xlsx'));
        document.getElementById('export-detail-csv').addEventListener('click', () => exportReport('detail', 'csv'));
        document.getElementById('export-detail-xlsx').addEventListener('click', () => exportReport('detail', 'xlsx'));
    }

    function render() {
        console.log("Rendering UI...");
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
        container.innerHTML = '<h2>Fiscal Year Plan</h2>';
        state.denominations.filter(d => d.isActive).forEach(denom => {
            const group = document.createElement('div');
            group.className = 'game-group';
            const gamesInGroup = state.games.filter(g => g.denominationPrice === denom.price);
            
            // 1. Persistent Sorting of games
            gamesInGroup.sort((a, b) => a.name.localeCompare(b.name));

            const tableBody = gamesInGroup.map(game => {
                const metrics = calculateGameMetrics(game);
                const unitOptions = CONTRACT_UNIT_PLANS[game.denominationPrice] || CONTRACT_UNIT_PLANS.default;
                const unitsDropdownHtml = unitOptions.map(size => `<option value="${size}" ${game.units === size ? 'selected' : ''}>${size.toLocaleString('en-US')}</option>`).join('');
                return `
                    <tr data-row-id="${game.id}">
                        <td><input type="text" value="${game.name}" data-game-id="${game.id}" data-prop="name"></td>
                        <td><select data-game-id="${game.id}" data-prop="vendorId"><option value="sg" ${game.vendorId === 'sg' ? 'selected' : ''}>Scientific Games</option><option value="pb" ${game.vendorId === 'pb' ? 'selected' : ''}>Pollard Banknote</option><option value="bs" ${game.vendorId === 'bs' ? 'selected' : ''}>Brightstar</option></select></td>
                        <td><select data-game-id="${game.id}" data-prop="units">${unitsDropdownHtml}</select></td>
                        <td><input type="number" value="${game.payoutPercent}" step="0.1" data-game-id="${game.id}" data-prop="payoutPercent"></td>
                        <td>${(game.featureIds && game.featureIds.length) ? game.featureIds.join(', ') : 'None'} <button class="edit-features-btn" data-game-id="${game.id}">Edit</button></td>
                        <td>${formatCurrency(metrics.cogs)}</td>
                        <td style="color: ${metrics.grossMargin < 0 ? '#d9534f' : 'green'};">${formatCurrency(metrics.grossMargin)}</td>
                    </tr>`;
            }).join('');
            
            // 3. Collapse/Expand UI
            const toggleIcon = denom.isCollapsed ? '►' : '▼';
            const tableDisplay = denom.isCollapsed ? 'style="display: none;"' : '';

            group.innerHTML = `
                <div class="game-group-header" data-price="${denom.price}"><span class="toggle-icon">${toggleIcon}</span><h3>$${denom.price} Games</h3><button class="add-game-btn" data-price="${denom.price}">+ Add Game</button></div>
                <table class="game-table" ${tableDisplay}><thead><tr><th>Game Name</th><th>Vendor</th><th>Units</th><th>Payout %</th><th>Features</th><th>COGS</th><th>Gross Margin</th></tr></thead><tbody>${tableBody}</tbody></table>`;
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
            const baseCost = state.vendorPricing[v.id]?.baseCostPerThousand || '';
            const featureTableRows = state.featureMasterList.map(feature => {
                const featureName = feature['Generic Feature'];
                const savedPrice = state.vendorPricing[v.id]?.features?.[featureName] || '';
                return `<tr><td>${featureName}</td><td><input type="number" value="${savedPrice}" placeholder="0.00" data-feature-name="${featureName}"></td></tr>`;
            }).join('');
            contentHtml += `<div class="tab-content ${state.ui.activeVendorTab === v.id ? 'active' : ''}" id="tab-${v.id}"><h4>Pricing for ${v.name}</h4><table class="pricing-table"><thead><tr><th>Item</th><th>Cost (per thousand)</th></tr></thead><tbody><tr><td>Base Print Cost</td><td><input type="number" value="${baseCost}" data-feature-name="baseCostPerThousand"></td></tr>${featureTableRows}</tbody></table></div>`;
        });
        container.innerHTML = headerHtml + tabHtml + contentHtml;
    }

    function renderAuditTrail() {
        const container = document.getElementById('footer');
        container.innerHTML = '<h4>Audit Trail</h4>';
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
        // 3. Collapse/Expand Logic
        const header = event.target.closest('.game-group-header');
        if (event.type === 'click' && header) {
            const price = parseInt(header.dataset.price, 10);
            const denomination = state.denominations.find(d => d.price === price);
            if (denomination) {
                denomination.isCollapsed = !denomination.isCollapsed;
                render(); // Re-render to show collapsed/expanded state
                return; // Stop further event processing
            }
        }

        if (event.type === 'click' && event.target.matches('.add-game-btn')) {
            addGame(parseInt(event.target.dataset.price, 10));
        } else if (event.type === 'click' && event.target.matches('.edit-features-btn')) {
            openFeatureModal(event.target.dataset.gameId);
        } else if (event.type === 'input') {
            const { gameId, prop } = event.target.dataset;
            if (gameId && prop) updateGame(gameId, prop, event.target.value);
        }
    }

    function handleRightPanelEvents(event) {
        if (event.target.id === 'manage-features-btn') {
            openFeatureManagementModal();
        } else if (event.type === 'click' && event.target.matches('.tab-btn')) {
            state.ui.activeVendorTab = event.target.dataset.vendorId;
            renderRightPanel();
        } else if (event.type === 'input') {
            const { featureName } = event.target.dataset;
            const vendorId = state.ui.activeVendorTab;
            const cost = parseFloat(event.target.value) || 0;
            if (featureName && vendorId) {
                if (featureName === 'baseCostPerThousand') state.vendorPricing[vendorId].baseCostPerThousand = cost;
                else state.vendorPricing[vendorId].features[featureName] = cost;
                logAudit(`Updated ${vendorId} price for '${featureName}' to ${cost}.`);
                render();
                debouncedAutosave();
            }
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
        // 2. Validation on Add Game
        const hasDefaultGame = state.games.some(g => g.denominationPrice === denominationPrice && g.name === 'New Game');
        if (hasDefaultGame) {
            alert('Please rename the existing "New Game" in this section before adding another.');
            return;
        }

        const defaultUnits = (CONTRACT_UNIT_PLANS[denominationPrice] || CONTRACT_UNIT_PLANS.default)[0];
        const newGame = { id: `g${Date.now()}`, denominationPrice, name: 'New Game', vendorId: 'sg', units: defaultUnits, payoutPercent: 68.0, featureIds: [] };
        state.games.push(newGame);
        logAudit(`Added game '${newGame.name}' to $${denominationPrice} tier.`);
        render();
        debouncedAutosave();
    }

    function updateGame(gameId, property, value) {
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        const oldValue = game[property];
        let parsedValue = (property === 'units' || property === 'payoutPercent') ? (parseFloat(value) || 0) : value;
        game[property] = parsedValue;
        logAudit(`Updated game '${game.name}' ${property} from '${oldValue}' to '${game[property]}'.`);
        const propertiesThatAffectCalcs = ['units', 'payoutPercent', 'vendorId'];
        if (propertiesThatAffectCalcs.includes(property)) updateCalculatedCells(gameId);
        debouncedAutosave();
    }

    function updateCalculatedCells(gameId) {
        const game = state.games.find(g => g.id === gameId);
        if (!game) return;
        const row = document.querySelector(`tr[data-row-id="${gameId}"]`);
        if (!row) return;
        const metrics = calculateGameMetrics(game);
        const cogsCell = row.cells[5];
        const marginCell = row.cells[6];
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

    function calculateGameMetrics(game) {
        const denomination = state.denominations.find(d => d.price === game.denominationPrice);
        if (!denomination) return { revenue: 0, cogs: 0, grossMargin: 0 };
        const revenue = game.units * denomination.price;
        const vendorCostData = state.vendorPricing[game.vendorId];
        if (!vendorCostData) return { revenue, cogs: 0, grossMargin: 0 };
        const manufacturingCost = (game.units / 1000) * (vendorCostData.baseCostPerThousand || 0);
        let totalFeatureCost = 0;
        if (game.featureIds && vendorCostData.features) {
            game.featureIds.forEach(featureName => {
                totalFeatureCost += (game.units / 1000) * (vendorCostData.features[featureName] || 0);
            });
        }
        const payoutCost = revenue * (game.payoutPercent / 100);
        const cogs = manufacturingCost + totalFeatureCost + payoutCost;
        const grossMargin = revenue - cogs;
        return { revenue, cogs, grossMargin };
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
        });
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }

    document.addEventListener('DOMContentLoaded', init);
})();