(function () {
  'use strict';

  // --- CONSTANTS & STATE ---
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

  // Quick presets; users can type ANY units in the number box.
  const CONTRACT_UNIT_PRESETS = {
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
    totalSalesTarget: 5_000_000_000,
    denominations: [
      { price: 1, mixPercent: 10, isActive: true,  isCollapsed: false },
      { price: 2, mixPercent: 15, isActive: true,  isCollapsed: false },
      { price: 3, mixPercent: 10, isActive: true,  isCollapsed: false },
      { price: 5, mixPercent: 25, isActive: true,  isCollapsed: false },
      { price:10, mixPercent: 20, isActive: true,  isCollapsed: false },
      { price:20, mixPercent: 15, isActive: true,  isCollapsed: false },
      { price:25, mixPercent:  0, isActive: true,  isCollapsed: false },
      { price:30, mixPercent:  5, isActive: true,  isCollapsed: false },
      { price:50, mixPercent:  0, isActive: false, isCollapsed: false }
    ],
    games: [
      { id:'g1', gameNumber:'1234', denominationPrice:5,  name:'Lucky 7s #123',      vendorId:'sg', units:12000000, payoutPercent:68.5, featureIds:[], poNumber:'', poDate:'', receiptDate:'', deliveryStatus:'Planned' },
      { id:'g2', gameNumber:'5678', denominationPrice:10, name:'Ultimate Cash #234', vendorId:'pb', units:18000000, payoutPercent:71.0, featureIds:["Holographic Foil"], poNumber:'', poDate:'', receiptDate:'', deliveryStatus:'Planned' }
    ],
    vendorPricing: {
      sg: { costModel:'percentOfSales', baseCostValue:1.5,  features:{} },
      pb: { costModel:'perThousand',    baseCostValue:21.8, features:{} },
      bs: { costModel:'perThousand',    baseCostValue:23.1, features:{} }
    },
    featureMasterList: [],
    auditLog: [],
    ui: { activeVendorTab:'sg', editingFeaturesForGameId:null, vendorFilter:'all' }
  };

  let history = [];
  let historyIndex = -1;
  let db;
  const DB_NAME = 'PlanDB';
  const STORE_NAME = 'PlanStore';

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', init);
  async function init() {
    await openDB();
    await restoreFromAutosave();
    setupEventListeners();
    initializeVendorPricing();
    loadFeatures();
    recordHistory();
    render();
  }

  // --- EVENTS ---
  function setupEventListeners() {
    byId('undo-btn').addEventListener('click', undo);
    byId('redo-btn').addEventListener('click', redo);
    byId('fiscal-year').addEventListener('input', handleFiscalYearChange);
    byId('total-sales-target').addEventListener('input', handleTargetChange);
    byId('load-plan-btn').addEventListener('click', () => byId('load-plan-input').click());
    byId('load-plan-input').addEventListener('change', loadPlan);
    byId('save-plan-btn').addEventListener('click', savePlan);

    const vf = byId('vendor-filter');
    if (vf) vf.addEventListener('change', (e) => {
      state.ui.vendorFilter = e.target.value || 'all';
      logAudit(`Vendor view changed to '${state.ui.vendorFilter}'.`);
      render();
      debouncedAutosave();
    });

    byId('left-panel').addEventListener('input', handleDenominationChange);
    byId('left-panel').addEventListener('click', handleLeftPanelClicks);

    byId('center-panel').addEventListener('click', handleCenterPanelEvents);
    byId('center-panel').addEventListener('input', handleCenterPanelEvents);
    // capture blur so inputs trigger commit logic
    byId('center-panel').addEventListener('blur', handleCenterPanelEvents, true);

    byId('right-panel').addEventListener('click', handleRightPanelEvents);
    byId('right-panel').addEventListener('input', handleRightPanelEvents);
    byId('right-panel').addEventListener('change', handleRightPanelEvents);

    byId('feature-modal').addEventListener('click', handleModalEvents);
    byId('feature-management-modal').addEventListener('click', handleFeatureManagementModalEvents);

    byId('footer').addEventListener('click', handleFooterEvents);

    // Exports
    byId('export-summary-csv').addEventListener('click', e => { e.preventDefault(); exportReport('summary','csv'); });
    byId('export-summary-xlsx').addEventListener('click', e => { e.preventDefault(); exportReport('summary','xlsx'); });
    byId('export-detail-csv').addEventListener('click', e => { e.preventDefault(); exportReport('detail','csv'); });
    byId('export-detail-xlsx').addEventListener('click', e => { e.preventDefault(); exportReport('detail','xlsx'); });
  }

  // --- RENDER ---
  function render() {
    byId('fiscal-year').value = state.fiscalYear;
    byId('total-sales-target').value = state.totalSalesTarget.toLocaleString('en-US');
    if (byId('vendor-filter')) byId('vendor-filter').value = state.ui.vendorFilter;
    renderDenominations();
    renderCenterPanel();
    renderRightPanel();
    renderAuditTrail();
    updateUndoRedoButtons();
  }

  function renderDenominations() {
    const container = byId('left-panel');
    container.innerHTML = '<h3>Denominations</h3>';

    let totalMixPercent = 0;
    state.denominations.forEach(denom => {
      if (denom.isActive) totalMixPercent += denom.mixPercent;
      const revenue = state.totalSalesTarget * (denom.mixPercent / 100);
      const el = document.createElement('div');
      el.className = 'denom-item';
      el.innerHTML = `
        <input type="checkbox" id="denom-active-${denom.price}" ${denom.isActive?'checked':''}>
        <label for="denom-active-${denom.price}">$${denom.price}</label>
        <input type="number" id="denom-mix-${denom.price}" value="${denom.mixPercent}" min="0" max="100" step="0.1">
        <span>%</span>
        <div class="denom-details">
          <span>${formatCurrency(revenue)}</span>
          <div class="progress-bar"><div class="progress-bar-inner" style="width:${denom.mixPercent}%"></div></div>
        </div>`;
      container.appendChild(el);
    });

    const totalDiv = document.createElement('div');
    totalDiv.id = 'denom-total';
    totalDiv.innerHTML = `Total Mix: ${totalMixPercent.toFixed(1)}%`;
    if (totalMixPercent.toFixed(1) != 100.0) {
      totalDiv.classList.add('total-error');
      totalDiv.innerHTML += ' (Should be 100%)';
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
    const container = byId('center-panel');

    // Filter games by vendor view
    const vendorView = state.ui.vendorFilter;
    const gamesForView = vendorView === 'all'
      ? state.games
      : state.games.filter(g => g.vendorId === vendorView);

    // Totals based on filtered games
    let totalPlannedContractCost = 0;
    gamesForView.forEach(g => totalPlannedContractCost += calculateGameMetrics(g).contractCost);
    const budgetPercent = state.totalSalesTarget ? (totalPlannedContractCost / state.totalSalesTarget * 100).toFixed(2) : 0;

    container.innerHTML = `
      <h2>FY${state.fiscalYear} Plan</h2>
      <div class="budget-tally"><strong>Total Planned Contract Costs (${vendorView === 'all' ? 'All Vendors' : vendorLabel(vendorView)}):</strong> ${formatCurrency(totalPlannedContractCost)} of ${formatCurrency(state.totalSalesTarget)} (${budgetPercent}%)</div>
    `;

    state.denominations
      .filter(d => d.isActive)
      .forEach(denom => {
        const group = document.createElement('div');
        group.className = 'game-group';

        const gamesInGroup = gamesForView
          .filter(g => g.denominationPrice === denom.price)
          .sort((a,b) => a.name.localeCompare(b.name));

        const bodyRows = gamesInGroup.map(game => {
          const metrics = calculateGameMetrics(game);
          const presets = CONTRACT_UNIT_PRESETS[game.denominationPrice] || CONTRACT_UNIT_PRESETS.default;
          const presetOptions = presets.map(n => `<option value="${n}">${n.toLocaleString('en-US')}</option>`).join('');
          const model = state.vendorPricing[game.vendorId]?.costModel || 'percentOfSales';
          const modelLabel = model === 'percentOfSales' ? '% of Sales' : 'Per Thousand';

          return `
            <tr data-row-id="${game.id}">
              <td><input type="text" value="${game.gameNumber||''}" data-game-id="${game.id}" data-prop="gameNumber" maxlength="4" size="4"></td>
              <td><input type="text" value="${game.name}" data-game-id="${game.id}" data-prop="name"></td>
              <td>
                <select data-game-id="${game.id}" data-prop="vendorId">
                  <option value="sg" ${game.vendorId==='sg'?'selected':''}>Scientific Games</option>
                  <option value="pb" ${game.vendorId==='pb'?'selected':''}>Pollard Banknote</option>
                  <option value="bs" ${game.vendorId==='bs'?'selected':''}>Brightstar</option>
                </select>
              </td>
              <td>${modelLabel}</td>
              <td>
                <div class="units-cell">
                  <select class="units-preset" data-game-id="${game.id}" data-action="unitsPreset">
                    <option value="">Presets…</option>
                    ${presetOptions}
                    <option value="custom">Custom…</option>
                  </select>
                  <input type="number" class="units-input" value="${game.units}" step="1000" min="0" data-game-id="${game.id}" data-prop="units">
                </div>
              </td>
              <td><input type="number" value="${game.payoutPercent}" step="0.1" data-game-id="${game.id}" data-prop="payoutPercent"></td>
              <td>${(game.featureIds&&game.featureIds.length)?game.featureIds.join(', '):'None'} <button class="edit-features-btn" data-game-id="${game.id}">Edit</button></td>
              <td>${formatCurrency(metrics.contractCost)}</td>
              <td>${formatCurrency(metrics.prizeExpense)}</td>
              <td>${formatCurrency(metrics.cogs)}</td>
              <td style="color:${metrics.grossMargin<0?'#d9534f':'green'}">${formatCurrency(metrics.grossMargin)}</td>
              <td><input type="text" class="table-po" value="${game.poNumber||''}" placeholder="PO #" data-game-id="${game.id}" data-prop="poNumber"></td>
              <td><input type="date" class="table-date" value="${game.poDate||''}" data-game-id="${game.id}" data-prop="poDate"></td>
              <td><input type="date" class="table-date" value="${game.receiptDate||''}" data-game-id="${game.id}" data-prop="receiptDate"></td>
              <td>
                <select class="status-select" data-game-id="${game.id}" data-prop="deliveryStatus">
                  ${['Planned','Ordered','Delivered','Cancelled'].map(s=>`<option value="${s}" ${game.deliveryStatus===s?'selected':''}>${s}</option>`).join('')}
                </select>
              </td>
              <td><button class="delete-game-btn" data-game-id="${game.id}">🗑️</button></td>
            </tr>`;
        }).join('');

        const toggleIcon = denom.isCollapsed ? '►' : '▼';
        const tableDisplay = denom.isCollapsed ? 'style="display:none;"' : '';

        group.innerHTML = `
          <div class="game-group-header" data-price="${denom.price}">
            <span class="toggle-icon">${toggleIcon}</span>
            <h3>$${denom.price} Games</h3>
            <button class="add-game-btn" data-price="${denom.price}">+ Add Game</button>
          </div>
          <table class="game-table" ${tableDisplay}>
            <thead>
              <tr>
                <th>Game #</th><th>Game Name</th><th>Vendor</th><th>Cost Model</th>
                <th>Units</th><th>Payout %</th><th>Features</th>
                <th>Contract Cost</th><th>Prize Expense</th><th>Total COGS</th><th>Gross Margin</th>
                <th>PO #</th><th>PO Date</th><th>Receipt Date</th><th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>`;
        container.appendChild(group);
      });
  }

  function renderRightPanel() {
    const container = byId('right-panel');
    const vendors = [
      { id:'sg', name:'Scientific Games' },
      { id:'pb', name:'Pollard Banknote' },
      { id:'bs', name:'Brightstar' }
    ];

    const header = `<div class="game-group-header"><h3>Vendor Pricing</h3><button id="manage-features-btn">Manage Features</button></div>`;

    let tabs = '<div class="tab-container">';
    vendors.forEach(v => tabs += `<button class="tab-btn ${state.ui.activeVendorTab===v.id?'active':''}" data-vendor-id="${v.id}">${v.name}</button>`);
    tabs += '</div>';

    let content = '';
    vendors.forEach(v => {
      const vd = state.vendorPricing[v.id] || {};
      const costModel = vd.costModel || 'percentOfSales';
      const base = vd.baseCostValue ?? 0;

      const featureRows = state.featureMasterList.map(f => {
        const name = f['Generic Feature'];
        const saved = vd.features?.[name] ?? '';
        return `<tr><td>${name}</td><td><input type="number" value="${saved}" placeholder="0.00" step="0.01" data-feature-name="${name}"></td></tr>`;
      }).join('');

      content += `
        <div class="tab-content ${state.ui.activeVendorTab===v.id?'active':''}" id="tab-${v.id}">
          <h4>Pricing for ${v.name}</h4>
          <div class="cost-model-group">
            <strong>Cost Model:</strong>
            <label><input type="radio" name="costModel-${v.id}" value="percentOfSales" ${costModel==='percentOfSales'?'checked':''}> % of Sales</label>
            <label><input type="radio" name="costModel-${v.id}" value="perThousand" ${costModel==='perThousand'?'checked':''}> Per Thousand</label>
          </div>
          <table class="pricing-table">
            <thead><tr><th>Item</th><th>Cost</th></tr></thead>
            <tbody>
              <tr class="cost-input-row ${costModel==='percentOfSales'?'active':''}">
                <td>Base Cost (% of Sales)</td>
                <td><input type="number" value="${base}" step="0.01" data-feature-name="baseCostValue"></td>
              </tr>
              <tr class="cost-input-row ${costModel==='perThousand'?'active':''}">
                <td>Base Cost (per Thousand)</td>
                <td><input type="number" value="${base}" step="0.01" data-feature-name="baseCostValue"></td>
              </tr>
              ${featureRows}
            </tbody>
          </table>
        </div>`;
    });

    container.innerHTML = header + tabs + content;
  }

  function renderAuditTrail() {
    const container = byId('footer');
    container.innerHTML = `
      <div class="footer-header">
        <h4>Audit Trail</h4>
        <button id="clear-log-btn">Clear Log</button>
      </div>`;
    state.auditLog.slice(0,5).forEach(log => {
      const p = document.createElement('p');
      p.textContent = `[${log.timestamp}] ${log.message}`;
      container.appendChild(p);
    });
  }

  // --- tiny row-level refresher ---
  function refreshRowNumbers(gameId) {
    const game = state.games.find(g => g.id === gameId);
    if (!game) return;
    const row = document.querySelector(`tr[data-row-id="${gameId}"]`);
    if (!row) return;
    const m = calculateGameMetrics(game);
    // cells: Contract Cost, Prize Expense, COGS, Gross Margin = columns 8..11 (0-indexed)
    const cells = row.querySelectorAll('td');
    cells[7].textContent  = formatCurrency(m.contractCost);
    cells[8].textContent  = formatCurrency(m.prizeExpense);
    cells[9].textContent  = formatCurrency(m.cogs);
    cells[10].textContent = formatCurrency(m.grossMargin);
    cells[10].style.color = m.grossMargin < 0 ? '#d9534f' : 'green';
  }

  // --- debounced, focus-safe full recalc ---
  let recalcTimer = null;
  function scheduleCenterRecalc() {
    clearTimeout(recalcTimer);
    recalcTimer = setTimeout(() => {
      const active = document.activeElement;
      const id   = active?.dataset?.gameId;
      const prop = active?.dataset?.prop;
      const caretStart = active?.selectionStart;
      const caretEnd   = active?.selectionEnd;

      renderCenterPanel();

      if (id && prop) {
        const el = document.querySelector(`[data-game-id="${id}"][data-prop="${prop}"]`);
        if (el) {
          el.focus();
          try { if (caretStart != null && caretEnd != null) el.setSelectionRange(caretStart, caretEnd); } catch {}
        }
      }
    }, 250);
  }

  // --- HANDLERS ---
  function handleFiscalYearChange(e) {
    const old = state.fiscalYear;
    const newYear = parseInt(e.target.value, 10);
    if (newYear && String(newYear).length === 4) {
      state.fiscalYear = newYear;
      logAudit(`Fiscal Year changed from ${old} to ${state.fiscalYear}.`);
      render(); debouncedAutosave();
    }
  }

  function handleTargetChange(e) {
    const old = state.totalSalesTarget;
    state.totalSalesTarget = parseFloat(e.target.value.replace(/,/g,'')) || 0;
    logAudit(`Total Sales Target changed from ${formatCurrency(old)} to ${formatCurrency(state.totalSalesTarget)}.`);
    render(); debouncedAutosave();
  }

  function handleDenominationChange(e) {
    const parts = e.target.id.split('-');
    if (parts.length < 3) return;
    const type = parts[1];
    const price = parseInt(parts[2],10);
    const denom = state.denominations.find(d => d.price === price);
    if (!denom) return;
    const oldVal = denom[type==='mix'?'mixPercent':'isActive'];

    if (type === 'mix') denom.mixPercent = parseFloat(e.target.value) || 0;
    else if (type === 'active') denom.isActive = e.target.checked;

    const newVal = denom[type==='mix'?'mixPercent':'isActive'];
    logAudit(`$${price} tier ${type==='mix'?'mix %':'status'} changed from ${oldVal} to ${newVal}.`);
    render(); debouncedAutosave();
  }

  function handleLeftPanelClicks(e) {
    if (e.target.id === 'add-denom-btn') {
      const input = byId('new-denom-price');
      addDenomination(parseFloat(input.value));
      input.value = '';
    }
  }

  function handleCenterPanelEvents(e) {
    if (e.type==='click' && e.target.matches('.add-game-btn')) {
      addGame(parseInt(e.target.dataset.price,10)); return;
    }
    if (e.type==='click' && e.target.matches('.delete-game-btn')) {
      const id = e.target.dataset.gameId;
      const game = state.games.find(g => g.id === id);
      if (game && confirm(`Delete "${game.name}"?`)) deleteGame(id);
      return;
    }
    if (e.type==='click' && e.target.matches('.edit-features-btn')) {
      openFeatureModal(e.target.dataset.gameId); return;
    }
    const header = e.target.closest('.game-group-header');
    if (e.type==='click' && header) {
      const price = parseInt(header.dataset.price,10);
      const denom = state.denominations.find(d => d.price===price);
      if (denom) { denom.isCollapsed = !denom.isCollapsed; render(); }
      return;
    }

    // Units preset dropdown support
    if (e.type==='input' || e.type==='change') {
      if (e.target.dataset && e.target.dataset.action === 'unitsPreset') {
        const { value } = e.target;
        const gameId = e.target.dataset.gameId;
        if (!gameId) return;
        if (value && value !== 'custom') {
          updateGame(gameId, 'units', parseFloat(value)||0, { render: true });
        } else if (value === 'custom') {
          const input = e.target.closest('.units-cell').querySelector('.units-input');
          if (input) input.focus();
        }
        return;
      }
    }

    // Live typing: fast path (no full table rebuild)
    if (e.type==='input') {
      const { gameId, prop } = e.target.dataset || {};
      if (gameId && prop) {
        updateGame(gameId, prop, e.target.value, { render: false });
        if (prop === 'units' || prop === 'payoutPercent') {
          refreshRowNumbers(gameId);
          scheduleCenterRecalc();
        }
      }
      return;
    }

    // Commit on change/blur: single authoritative rebuild (debounced)
    if (e.type === 'change' || e.type === 'blur') {
      const { gameId, prop } = e.target.dataset || {};
      if (gameId && prop) {
        updateGame(gameId, prop, e.target.value, { render: false });
        if (prop === 'vendorId') {
          renderCenterPanel();
        } else {
          scheduleCenterRecalc();
        }
      }
      return;
    }
  }

  function handleRightPanelEvents(e) {
    const vendorId = state.ui.activeVendorTab;
    const vendorData = state.vendorPricing[vendorId];

    if (e.target.id === 'manage-features-btn') {
      openFeatureManagementModal();
    } else if (e.type==='click' && e.target.matches('.tab-btn')) {
      state.ui.activeVendorTab = e.target.dataset.vendorId;
      renderRightPanel();
    } else if (e.type==='input' || e.type==='change') {
      if (e.target.name === `costModel-${vendorId}`) {
        vendorData.costModel = e.target.value;
        logAudit(`Updated ${vendorId} cost model to ${vendorData.costModel}.`);
        renderRightPanel();
        scheduleCenterRecalc();
      } else {
        const { featureName } = e.target.dataset || {};
        const cost = parseFloat(e.target.value) || 0;
        if (featureName) {
          if (featureName === 'baseCostValue') vendorData.baseCostValue = cost;
          else vendorData.features[featureName] = cost;
          logAudit(`Updated ${vendorId} price for '${featureName}' to ${cost}.`);
          scheduleCenterRecalc();
        }
      }
      debouncedAutosave();
    }
  }

  function handleModalEvents(e) {
    if (e.target.id === 'modal-save-btn') saveFeaturesFromModal();
    else if (e.target.id === 'modal-cancel-btn' || !e.target.closest('.modal-content')) closeFeatureModal();
  }

  function handleFeatureManagementModalEvents(e) {
    if (e.target.id === 'modal-done-btn' || !e.target.closest('.modal-content')) {
      closeFeatureManagementModal();
    }
  }

  function handleFooterEvents(e) {
    if (e.target.id === 'clear-log-btn') clearAuditTrail();
  }

  // --- MUTATIONS ---
  function addDenomination(price) {
    if (!price || price <= 0) return alert('Please enter a valid price.');
    if (state.denominations.some(d => d.price === price)) return alert(`$${price} already exists.`);
    state.denominations.push({ price, mixPercent:0, isActive:true, isCollapsed:false });
    state.denominations.sort((a,b)=>a.price-b.price);
    logAudit(`Added price point $${price}.`);
    render(); debouncedAutosave();
  }

  function addGame(denominationPrice) {
    const existsDefault = state.games.some(g => g.denominationPrice===denominationPrice && g.name==='New Game');
    if (existsDefault) return alert('Please rename the existing "New Game" first.');
    const defaultUnits = (CONTRACT_UNIT_PRESETS[denominationPrice] || CONTRACT_UNIT_PRESETS.default)[0];
    const newGame = {
      id:`g${Date.now()}`,
      gameNumber:'',
      denominationPrice,
      name:'New Game',
      vendorId:'sg',
      units:defaultUnits,
      payoutPercent:68.0,
      featureIds:[],
      poNumber:'', poDate:'', receiptDate:'', deliveryStatus:'Planned'
    };
    state.games.push(newGame);
    logAudit(`Added game '${newGame.name}' to $${denominationPrice}.`);
    render(); debouncedAutosave();
  }

  function deleteGame(gameId) {
    const idx = state.games.findIndex(g => g.id === gameId);
    if (idx > -1) {
      const name = state.games[idx].name;
      state.games.splice(idx,1);
      logAudit(`Deleted game '${name}'.`);
      render(); debouncedAutosave();
    }
  }

  function updateGame(gameId, prop, value, opts = { render: true }) {
    const game = state.games.find(g => g.id === gameId);
    if (!game) return;
    const old = game[prop];
    const parsed = (prop === 'units' || prop === 'payoutPercent') ? (parseFloat(value) || 0) : value;
    game[prop] = parsed;
    logAudit(`Updated '${game.name}' ${prop} from '${old}' to '${game[prop]}'.`);

    if (opts.render && (prop === 'vendorId' || prop === 'units' || prop === 'payoutPercent')) {
      renderCenterPanel();
    }
    debouncedAutosave();
  }

  function clearAuditTrail() {
    state.auditLog = [];
    logAudit('Audit trail cleared.');
    renderAuditTrail();
    debouncedAutosave();
  }

  // --- CALCS ---
  function calculateGameMetrics(game) {
    const denom = state.denominations.find(d => d.price === game.denominationPrice);
    if (!denom) return { revenue:0, contractCost:0, prizeExpense:0, cogs:0, grossMargin:0 };
    const revenue = game.units * denom.price;
    const vendor = state.vendorPricing[game.vendorId];
    if (!vendor) return { revenue:0, contractCost:0, prizeExpense:0, cogs:0, grossMargin:0 };

    let manufacturing = 0;
    if (vendor.costModel === 'perThousand') manufacturing = (game.units / 1000) * (vendor.baseCostValue || 0);
    else manufacturing = revenue * ((vendor.baseCostValue || 0) / 100);

    let featureCost = 0;
    if (game.featureIds && vendor.features) {
      game.featureIds.forEach(name => {
        featureCost += (game.units / 1000) * (vendor.features[name] || 0);
      });
    }

    const contractCost = manufacturing + featureCost;
    const prizeExpense = revenue * (game.payoutPercent / 100);
    const cogs = contractCost + prizeExpense;
    const grossMargin = revenue - cogs;

    return { revenue, contractCost, prizeExpense, cogs, grossMargin };
  }

  // --- FEATURES MODALS ---
  function openFeatureModal(gameId) {
    state.ui.editingFeaturesForGameId = gameId;
    const game = state.games.find(g => g.id === gameId);
    if (!game) return;
    byId('modal-game-name').textContent = game.name;
    byId('feature-checklist').innerHTML = state.featureMasterList.map(f => {
      const name = f['Generic Feature'];
      const checked = game.featureIds?.includes(name) ? 'checked' : '';
      return `<label class="feature-checklist-item"><input type="checkbox" name="${name}" ${checked}> ${name}</label>`;
    }).join('');
    byId('feature-modal').style.display = 'flex';
  }
  function closeFeatureModal(){ state.ui.editingFeaturesForGameId = null; byId('feature-modal').style.display = 'none'; }
  function saveFeaturesFromModal() {
    const id = state.ui.editingFeaturesForGameId;
    const game = state.games.find(g => g.id === id);
    if (!game) return;
    const selected = [];
    document.querySelectorAll('#feature-checklist input:checked').forEach(i => selected.push(i.name));
    game.featureIds = selected;
    logAudit(`Updated features for '${game.name}'.`);
    closeFeatureModal(); render(); debouncedAutosave();
  }

  function openFeatureManagementModal(){ renderFeatureManagementModal(); byId('feature-management-modal').style.display = 'flex'; }
  function closeFeatureManagementModal(){ byId('feature-management-modal').style.display = 'none'; }
  function renderFeatureManagementModal() {
    const list = byId('feature-management-list');
    list.innerHTML = '';
    state.featureMasterList.forEach(f => {
      const name = f['Generic Feature'];
      const row = document.createElement('div');
      row.className = 'feature-management-item';
      row.innerHTML = `<span>${name}</span><button class="delete-feature-btn" data-feature-name="${name}">Delete</button>`;
      list.appendChild(row);
    });
  }

  // --- AUTOSAVE / HISTORY ---
  let autosaveTimeout;
  const debouncedAutosave = () => {
    clearTimeout(autosaveTimeout);
    autosaveTimeout = setTimeout(() => { saveStateToDB(); recordHistory(); }, 1200);
  };

  function recordHistory() {
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.parse(JSON.stringify(state)));
    historyIndex++;
    updateUndoRedoButtons();
  }
  function updateUndoRedoButtons() {
    byId('undo-btn').disabled = historyIndex <= 0;
    byId('redo-btn').disabled = historyIndex >= history.length - 1;
  }
  function undo(){ if (historyIndex>0){ historyIndex--; state = JSON.parse(JSON.stringify(history[historyIndex])); render(); saveStateToDB(); logAudit('Action: Undo.'); } }
  function redo(){ if (historyIndex<history.length-1){ historyIndex++; state = JSON.parse(JSON.stringify(history[historyIndex])); render(); saveStateToDB(); logAudit('Action: Redo.'); } }

  // --- FEATURES CSV ---
  function loadFeatures() {
    try {
      state.featureMasterList = parseCSV(FEATURES_CSV_DATA);
      console.log('Features loaded.');
    } catch (e) { console.error('Failed to load features:', e); }
  }
  function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines.shift().split(',').map(h => h.trim().replace(/"/g,''));
    return lines.map(line => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return headers.reduce((o,h,i) => { o[h] = values[i] ? values[i].trim().replace(/"/g,'') : ''; return o; }, {});
    });
  }

  // --- SAVE / LOAD ---
  function savePlan() {
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `FY${state.fiscalYear}_Plan.json`; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    logAudit('Plan saved to file.');
  }

  function loadPlan(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const loaded = JSON.parse(evt.target.result);
        if (!loaded.hasOwnProperty('fiscalYear')) throw new Error('Invalid plan file.');
        state = loaded; state.auditLog = [];
        // Ensure new UI fields exist if loading an older save
        state.ui ||= {}; state.ui.vendorFilter ||= 'all'; state.ui.activeVendorTab ||= 'sg';
        state.games.forEach(g => {
          g.poNumber ||= ''; g.poDate ||= ''; g.receiptDate ||= ''; g.deliveryStatus ||= 'Planned';
        });
        logAudit('Plan loaded from file.');
        history = []; historyIndex = -1; recordHistory(); render();
      } catch { alert('Error: Could not load the selected file.'); }
    };
    reader.readAsText(file); e.target.value = null;
  }

  // --- DB ---
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onerror = () => reject('Error opening DB');
      req.onsuccess = e => { db = e.target.result; resolve(); };
      req.onupgradeneeded = e => e.target.result.createObjectStore(STORE_NAME);
    });
  }
  function saveStateToDB() {
    if (!db) return;
    const shallow = JSON.parse(JSON.stringify(state));
    shallow.auditLog = []; // keep DB light
    db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(shallow, 'autosavedPlan');
  }
  function restoreFromAutosave() {
    return new Promise(res => {
      if (!db) return res();
      const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get('autosavedPlan');
      req.onsuccess = e => {
        const saved = e.target.result;
        if (saved && confirm('An autosaved plan was found. Restore it?')) {
          state = saved; state.auditLog = [];
          state.ui ||= {}; state.ui.vendorFilter ||= 'all'; state.ui.activeVendorTab ||= 'sg';
          state.games.forEach(g => {
            g.poNumber ||= ''; g.poDate ||= ''; g.receiptDate ||= ''; g.deliveryStatus ||= 'Planned';
          });
          logAudit('Plan restored from autosave.');
        }
        res();
      };
      req.onerror = () => res();
    });
  }

  // --- EXPORTS ---
  function exportReport(kind, format) {
    if (kind === 'summary') {
      const rows = [['Denomination','$ Mix %','Revenue Target','Games','Contract Cost','Prize Expense','Total COGS','Gross Margin']];
      state.denominations.filter(d=>d.isActive).forEach(d=>{
        const games = state.games.filter(g=>g.denominationPrice===d.price);
        const revenueTarget = state.totalSalesTarget * (d.mixPercent/100);
        let contract=0, prize=0, cogs=0, margin=0;
        games.forEach(g=>{
          const m = calculateGameMetrics(g);
          contract += m.contractCost; prize += m.prizeExpense; cogs += m.cogs; margin += m.grossMargin;
        });
        rows.push([`$${d.price}`, d.mixPercent, revenueTarget, games.length, contract, prize, cogs, margin]);
      });
      return downloadRows(rows, `FY${state.fiscalYear}_Executive_Summary`, format);
    }
    // detail
    const rows = [['Game #','Game Name','$','Vendor','Units','Payout %','Features','Cost Model','Base Cost','Feature Cost (per k)','Contract Cost','Prize Expense','COGS','Gross Margin','PO #','PO Date','Receipt Date','Status']];
    state.games.forEach(g=>{
      const m = calculateGameMetrics(g);
      const v = state.vendorPricing[g.vendorId]||{};
      const model = v.costModel||'percentOfSales';
      const features = (g.featureIds||[]).join('; ');
      rows.push([
        g.gameNumber||'', g.name, g.denominationPrice, (g.vendorId||'').toUpperCase(),
        g.units, g.payoutPercent, features, model, v.baseCostValue||0, '',
        m.contractCost, m.prizeExpense, m.cogs, m.grossMargin,
        g.poNumber||'', g.poDate||'', g.receiptDate||'', g.deliveryStatus||''
      ]);
    });
    downloadRows(rows, `FY${state.fiscalYear}_Detailed_Build`, format);
  }

  function downloadRows(rows, baseName, format) {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `${baseName}.xlsx`);
    } else {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${baseName}.csv`; a.click();
      URL.revokeObjectURL(url);
    }
  }

  // --- helpers ---
  function byId(id){ return document.getElementById(id); }
  function logAudit(msg){ const ts = new Date().toLocaleTimeString('en-US'); state.auditLog.unshift({timestamp:ts, message:msg}); if (state.auditLog.length>50) state.auditLog.pop(); }
  function initializeVendorPricing(){ ['sg','pb','bs'].forEach(v => { state.vendorPricing[v] ||= { }; state.vendorPricing[v].features ||= { }; state.vendorPricing[v].costModel ||= 'percentOfSales'; }); }
  function formatCurrency(v){ return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:0,maximumFractionDigits:0}).format(v); }
  function vendorLabel(id){ return id==='sg'?'Scientific Games':id==='pb'?'Pollard Banknote':id==='bs'?'Brightstar':id; }

})();
