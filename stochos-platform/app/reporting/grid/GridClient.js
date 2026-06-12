'use client';

import { useState, useEffect } from 'react';
import FormatPanel from './FormatPanel';
import { useRouter } from 'next/navigation';
import { Settings } from 'lucide-react';
import HelpTrigger from '../../components/HelpTrigger';

export default function GridClient() {
  const router = useRouter();
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedColumn, setSelectedColumn] = useState(null);

  // Store formats for columns
  const [columnFormats, setColumnFormats] = useState({
    'col_actuals_2024': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' },
    'col_compare': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' },
    'col_variance': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' }
  });

  // Store formats for specific cells (Local overrides)
  const [cellFormats, setCellFormats] = useState({});
  const [editFormat, setEditFormat] = useState(null);

  // Custom spreadsheet formatting states
  const [selectedBorderStyle, setSelectedBorderStyle] = useState('solid');
  const [formulaValue, setFormulaValue] = useState('');

  // Sync formula bar on cell selection
  useEffect(() => {
    if (selectedCell) {
      setFormulaValue(selectedCell.value.toString());
    } else {
      setFormulaValue('');
    }
  }, [selectedCell]);

  const handleFormulaChange = (e) => {
    setFormulaValue(e.target.value);
  };

  const handleFormulaSubmit = (e) => {
    if (e) e.preventDefault();
    if (!selectedCell) return;

    const numVal = parseFloat(formulaValue);
    if (isNaN(numVal)) return;

    // Map cell ID to actual key if applicable
    const cellIdMap = {
      'C1': '4-1000',
      'C2': '5-2000',
      'C3': '5-2100'
    };
    const key = cellIdMap[selectedCell.id];
    if (key) {
      setActuals(prev => ({ ...prev, [key]: numVal }));
      // Also update selectedCell value so the formula bar and cell stay in sync
      setSelectedCell(prev => ({ ...prev, value: numVal }));
    }
  };

  // Dynamic values
  const [actuals, setActuals] = useState({
    '4-1000': 850000000,
    '5-2000': -520000000,
    '5-2100': -48000000
  });

  // Packages & Scenarios states
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [comparisonMode, setComparisonMode] = useState('prior_year'); // 'prior_year' or 'budget'

  const [loading, setLoading] = useState(true);
  const [isNewScenarioModalOpen, setIsNewScenarioModalOpen] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('Stretch Target Scenario');
  const [deriveFromCurrent, setDeriveFromCurrent] = useState(true);

  // Load grid actuals + packages on mount
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true);
        // Load Grid Formatting & Actuals
        const gridRes = await fetch('/api/reporting/grid');
        if (gridRes.ok) {
          const gridData = await gridRes.json();
          if (gridData.success) {
            if (gridData.actuals) setActuals(gridData.actuals);
            if (gridData.cellFormats) setCellFormats(gridData.cellFormats);
            if (gridData.columnFormats) setColumnFormats(gridData.columnFormats);
          }
        }

        // Load Packages
        const pkgsRes = await fetch('/api/reporting/packages');
        if (pkgsRes.ok) {
          const pkgsData = await pkgsRes.json();
          if (pkgsData.success && pkgsData.packages.length > 0) {
            setPackages(pkgsData.packages);
            setSelectedPackageId(pkgsData.packages[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load initial grid data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, []);

  // Fetch scenarios whenever selected package changes
  useEffect(() => {
    if (!selectedPackageId) return;

    async function loadScenarios() {
      try {
        const res = await fetch(`/api/reporting/budget/scenarios?packageId=${selectedPackageId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setScenarios(data.scenarios);
            const adopted = data.scenarios.find(s => s.isAdopted);
            if (adopted) {
              setSelectedScenarioId(adopted.id);
            } else if (data.scenarios.length > 0) {
              setSelectedScenarioId(data.scenarios[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch scenarios:', err);
      }
    }

    loadScenarios();
  }, [selectedPackageId]);

  // Actual values
  const sales2024 = actuals['4-1000'] || 0;
  const prizes2024 = actuals['5-2000'] || 0;
  const commissions2024 = actuals['5-2100'] || 0;
  const margin2024 = sales2024 + prizes2024 + commissions2024;

  // Comparison Values (Static 2023 vs Dynamic Budget Scenario)
  let salesCompare = 820500000;
  let prizesCompare = -490200000;
  let commissionsCompare = -45000000;

  if (comparisonMode === 'budget' && selectedScenarioId) {
    const activeScenario = scenarios.find(s => s.id === selectedScenarioId);
    if (activeScenario && activeScenario.data) {
      salesCompare = parseFloat(activeScenario.data['4-1000'] || 0);
      prizesCompare = parseFloat(activeScenario.data['5-2000'] || 0);
      commissionsCompare = parseFloat(activeScenario.data['5-2100'] || 0);
    }
  }

  const marginCompare = salesCompare + prizesCompare + commissionsCompare;

  // Variances
  const salesVar = sales2024 - salesCompare;
  const prizesVar = prizes2024 - prizesCompare;
  const commissionsVar = commissions2024 - commissionsCompare;
  const marginVar = margin2024 - marginCompare;

  const handleCellClick = (cellId, columnId, value, rowClass) => {
    setSelectedCell({ id: cellId, columnId, value, rowClass });
    setSelectedColumn(null);
    const format = cellFormats[cellId] || columnFormats[columnId] || {};
    setEditFormat(format);
  };

  const handleColumnClick = (columnId) => {
    setSelectedColumn(columnId);
    setSelectedCell(null);
    const format = columnFormats[columnId] || {};
    setEditFormat(format);
  };

  const handleSaveFormat = async () => {
    if (!editFormat) return;

    const type = selectedCell ? 'cell' : 'column';
    const id = selectedCell ? selectedCell.id : selectedColumn;

    if (selectedCell) {
      setCellFormats(prev => ({ ...prev, [id]: editFormat }));
      setSelectedCell(null);
    } else if (selectedColumn) {
      setColumnFormats(prev => ({ ...prev, [id]: editFormat }));
      setSelectedColumn(null);
    }

    try {
      await fetch('/api/reporting/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, format: editFormat })
      });
    } catch (err) {
      console.error('Error saving format override:', err);
    }
  };

  const updateActiveFormat = async (patch) => {
    const id = selectedCell ? selectedCell.id : selectedColumn;
    if (!id) return;
    const type = selectedCell ? 'cell' : 'column';

    const currentFormat = cellFormats[id] || columnFormats[id] || {
      scale: 'millions',
      currency_symbol: '$',
      decimal_places: 1,
      negative_style: 'parentheses',
      zero_display: 'dash'
    };

    const updated = { ...currentFormat, ...patch };

    // Update state locally first
    setEditFormat(updated);
    if (selectedCell) {
      setCellFormats(prev => ({ ...prev, [id]: updated }));
    } else {
      setColumnFormats(prev => ({ ...prev, [id]: updated }));
    }

    // Call API in the background
    try {
      await fetch('/api/reporting/grid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, format: updated })
      });
    } catch (err) {
      console.error('Error auto-saving format:', err);
    }
  };

  const toggleBold = () => {
    const current = editFormat?.fontWeight === 'bold' ? 'normal' : 'bold';
    updateActiveFormat({ fontWeight: current });
  };

  const toggleItalic = () => {
    const current = editFormat?.fontStyle === 'italic' ? 'normal' : 'italic';
    updateActiveFormat({ fontStyle: current });
  };

  const setTextAlign = (align) => {
    updateActiveFormat({ textAlign: align });
  };

  const setVerticalAlign = (align) => {
    updateActiveFormat({ verticalAlign: align });
  };

  const applyBorder = (side) => {
    const patch = {};
    const borderVal = selectedBorderStyle === 'none' ? null : selectedBorderStyle;
    if (side === 'all') {
      patch.borderTop = borderVal;
      patch.borderBottom = borderVal;
      patch.borderLeft = borderVal;
      patch.borderRight = borderVal;
    } else if (side === 'clear') {
      patch.borderTop = null;
      patch.borderBottom = null;
      patch.borderLeft = null;
      patch.borderRight = null;
    } else if (side === 'doubleBottom') {
      patch.borderBottom = 'double';
    } else {
      patch[side] = borderVal;
    }
    updateActiveFormat(patch);
  };

  const setBackgroundColor = (color) => {
    updateActiveFormat({ backgroundColor: color });
  };

  const setTextColor = (color) => {
    updateActiveFormat({ color: color });
  };

  const adjustDecimals = (delta) => {
    const current = editFormat?.decimal_places !== undefined ? editFormat.decimal_places : 1;
    const next = Math.max(0, Math.min(6, current + delta));
    updateActiveFormat({ decimal_places: next });
  };

  const toggleCurrency = () => {
    const current = editFormat?.currency_symbol ? null : '$';
    updateActiveFormat({ currency_symbol: current });
  };

  const togglePercent = () => {
    const current = !editFormat?.is_percent;
    updateActiveFormat({ is_percent: current });
  };

  const handleCreateScenario = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/reporting/budget/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newScenarioName,
          packageId: selectedPackageId,
          derivedFromScenarioId: deriveFromCurrent ? selectedScenarioId : null,
          data: deriveFromCurrent ? {} : {
            '4-1000': 900000000.00, // custom baseline target
            '5-2000': -540000000.00,
            '5-2100': -45000000.00
          }
        })
      });

      const data = await res.json();
      if (data.success) {
        setScenarios([...scenarios, data.scenario]);
        setSelectedScenarioId(data.scenario.id);
        setIsNewScenarioModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to create scenario:', err);
    }
  };

  const handleAdoptScenario = async () => {
    if (!selectedScenarioId) return;
    try {
      const res = await fetch(`/api/reporting/budget/scenarios/${selectedScenarioId}/adopt`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setScenarios(scenarios.map(s => {
          if (s.id === selectedScenarioId) {
            return { ...s, isAdopted: true, status: 'adopted' };
          }
          return { ...s, isAdopted: false, status: 'active' };
        }));
        alert('Scenario marked as adopted successfully.');
      }
    } catch (err) {
      console.error('Failed to adopt scenario:', err);
    }
  };

  const getGridBorderCssValue = (type) => {
    if (!type || type === 'none') return 'none';
    if (type === 'solid' || type === 'solid-thin') return '1px solid #cbd5e1';
    if (type === 'solid-medium') return '2px solid #64748b';
    if (type === 'solid-thick') return '3px solid #1e293b';
    if (type === 'dashed') return '1px dashed #94a3b8';
    if (type === 'double') return '3px double #1e293b';
    return type;
  };

  const getCellStyle = (cellId, columnId, baseStyle = {}) => {
    const cellFormat = cellFormats[cellId] || {};
    const colFormat = columnFormats[columnId] || {};
    
    // Merge cell overrides on top of column defaults
    const format = { ...colFormat, ...cellFormat };
    const isSelected = selectedCell?.id === cellId;

    const style = {
      padding: '12px',
      cursor: 'pointer',
      fontFamily: '"Inter", sans-serif',
      transition: 'all 0.1s ease',
      borderRight: '1px solid #cbd5e1',
      borderBottom: '1px solid #cbd5e1',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      verticalAlign: 'middle',
      ...baseStyle,
    };

    // Horizontal & Vertical Alignments
    if (format.textAlign) style.textAlign = format.textAlign;
    if (format.verticalAlign) style.verticalAlign = format.verticalAlign;

    // Font styles
    if (format.fontWeight) style.fontWeight = format.fontWeight;
    if (format.fontStyle) style.fontStyle = format.fontStyle;
    if (format.color) style.color = format.color;

    // Background Color
    if (format.backgroundColor) style.backgroundColor = format.backgroundColor;

    // Borders
    if (format.borderTop) style.borderTop = getGridBorderCssValue(format.borderTop);
    if (format.borderBottom) style.borderBottom = getGridBorderCssValue(format.borderBottom);
    if (format.borderLeft) style.borderLeft = getGridBorderCssValue(format.borderLeft);
    if (format.borderRight) style.borderRight = getGridBorderCssValue(format.borderRight);

    // Apply visual indicator for selected cell using outline
    if (isSelected) {
      style.outline = '2px solid #107c41';
      style.outlineOffset = '-2px';
      // Light overlay background if selected
      style.backgroundColor = style.backgroundColor ? `${style.backgroundColor}ee` : 'rgba(16, 124, 65, 0.08)';
      style.zIndex = 10;
      style.position = 'relative';
    }

    return style;
  };

  const renderCell = (val, cellId, columnId, rowClass) => {
    const cellFormat = cellFormats[cellId] || {};
    const colFormat = columnFormats[columnId] || {};
    const format = { ...colFormat, ...cellFormat };

    let num = val;
    if (format.scale === 'thousands') num = num / 1000;
    if (format.scale === 'millions') num = num / 1000000;
    if (format.scale === 'billions') num = num / 1000000000;

    let str = Math.abs(num).toFixed(format.decimal_places !== undefined ? format.decimal_places : 1);
    if (format.thousands_separator !== false) {
      str = parseFloat(str).toLocaleString('en-US', { 
        minimumFractionDigits: format.decimal_places !== undefined ? format.decimal_places : 1, 
        maximumFractionDigits: format.decimal_places !== undefined ? format.decimal_places : 1 
      });
    }

    if (val === 0) {
      if (format.zero_display === 'dash') return '—';
      if (format.zero_display === 'blank') return '';
    }

    let isNegative = val < 0;
    if (format.sign_flip) isNegative = !isNegative;

    if (isNegative) {
      if (format.negative_style === 'parentheses' || format.negative_style === 'parentheses_red') str = `(${str})`;
      if (format.negative_style === 'minus' || format.negative_style === 'minus_red') str = `-${str}`;
    }

    if (format.is_percent) str = `${str}%`;

    const showCurrency = rowClass === 'first_in_group' || rowClass === 'subtotal' || rowClass === 'grand_total';

    return (
      <div style={{ color: isNegative && format.negative_style?.includes('red') ? '#dc2626' : 'inherit', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          {showCurrency && format.currency_symbol && <span style={{ color: '#8899aa', marginRight: '4px' }}>{format.currency_symbol}</span>}
          <span style={{ marginLeft: 'auto' }}>{str}</span>
        </div>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#f1f3f4', color: '#1e293b', fontFamily: '"Inter", sans-serif' }}>
      
      {/* LEFT: Grid Workspace */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Dashboard Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>Governed Analytical Grid</h1>
            <p style={{ color: '#475569', fontSize: '13px', margin: '4px 0 0 0' }}>Multi-Scenario spreadsheet analysis & variance audits</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            
            {/* Packages Selector */}
            <select 
              value={selectedPackageId}
              onChange={e => setSelectedPackageId(e.target.value)}
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none' }}
            >
              <option value="">Select Package</option>
              {packages.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <HelpTrigger topicId="reporting_grid" />
            <button onClick={() => router.push('/reporting')} style={{ padding: '8px 16px', background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              Back to Dashboard
            </button>
          </div>
        </div>

        {/* SPREADSHEET TOOLBAR */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderRadius: '8px 8px 0 0', 
          padding: '8px 12px', 
          display: 'flex', 
          gap: '8px', 
          alignItems: 'center', 
          flexWrap: 'wrap',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}>
          {/* Font Weight and Italic Toggles */}
          <button 
            type="button"
            onClick={toggleBold}
            disabled={!selectedCell && !selectedColumn}
            style={{ 
              background: editFormat?.fontWeight === 'bold' ? '#eaf5ea' : 'transparent', 
              color: editFormat?.fontWeight === 'bold' ? '#107c41' : '#475569', 
              border: 'none', 
              padding: '6px 10px', 
              borderRadius: '4px', 
              fontWeight: 'bold', 
              cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
              opacity: (selectedCell || selectedColumn) ? 1 : 0.5,
              fontSize: '13px'
            }}
            title="Bold"
          >
            B
          </button>
          <button 
            type="button"
            onClick={toggleItalic}
            disabled={!selectedCell && !selectedColumn}
            style={{ 
              background: editFormat?.fontStyle === 'italic' ? '#eaf5ea' : 'transparent', 
              color: editFormat?.fontStyle === 'italic' ? '#107c41' : '#475569', 
              border: 'none', 
              padding: '6px 10px', 
              borderRadius: '4px', 
              fontStyle: 'italic', 
              cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
              opacity: (selectedCell || selectedColumn) ? 1 : 0.5,
              fontSize: '13px'
            }}
            title="Italic"
          >
            I
          </button>

          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }}></div>

          {/* Alignment Tools */}
          <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '4px' }}>
            <button 
              type="button"
              onClick={() => setTextAlign('left')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.textAlign === 'left' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.textAlign === 'left' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Left"
            >
              Left
            </button>
            <button 
              type="button"
              onClick={() => setTextAlign('center')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.textAlign === 'center' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.textAlign === 'center' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Center"
            >
              Center
            </button>
            <button 
              type="button"
              onClick={() => setTextAlign('right')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.textAlign === 'right' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.textAlign === 'right' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Right"
            >
              Right
            </button>
          </div>

          <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', padding: '2px', borderRadius: '4px' }}>
            <button 
              type="button"
              onClick={() => setVerticalAlign('top')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.verticalAlign === 'top' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.verticalAlign === 'top' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Top"
            >
              Top
            </button>
            <button 
              type="button"
              onClick={() => setVerticalAlign('middle')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.verticalAlign === 'middle' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.verticalAlign === 'middle' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Middle"
            >
              Middle
            </button>
            <button 
              type="button"
              onClick={() => setVerticalAlign('bottom')}
              disabled={!selectedCell && !selectedColumn}
              style={{ 
                background: editFormat?.verticalAlign === 'bottom' ? '#eaf5ea' : 'transparent', 
                color: editFormat?.verticalAlign === 'bottom' ? '#107c41' : '#475569', 
                border: 'none', 
                padding: '4px 8px', 
                borderRadius: '3px', 
                cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', 
                fontSize: '11px',
                fontWeight: 'bold'
              }}
              title="Align Bottom"
            >
              Bottom
            </button>
          </div>

          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }}></div>

          {/* Background and Text Colors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Fill Color">
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Fill:</span>
            <input 
              type="color"
              disabled={!selectedCell && !selectedColumn}
              value={editFormat?.backgroundColor || '#ffffff'}
              onChange={(e) => setBackgroundColor(e.target.value)}
              style={{ width: '22px', height: '22px', border: 'none', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', padding: 0, background: 'transparent' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Text Color">
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>Text:</span>
            <input 
              type="color"
              disabled={!selectedCell && !selectedColumn}
              value={editFormat?.color || '#1e293b'}
              onChange={(e) => setTextColor(e.target.value)}
              style={{ width: '22px', height: '22px', border: 'none', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', padding: 0, background: 'transparent' }}
            />
          </div>

          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }}></div>

          {/* Borders */}
          <select 
            disabled={!selectedCell && !selectedColumn}
            value={selectedBorderStyle}
            onChange={(e) => setSelectedBorderStyle(e.target.value)}
            style={{ 
              background: '#ffffff', 
              color: '#1e293b', 
              border: '1px solid #cbd5e1', 
              borderRadius: '4px', 
              padding: '4px 6px', 
              fontSize: '12px', 
              outline: 'none', 
              cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed'
            }}
            title="Border Line Style"
          >
            <option value="none">No Border (Clear)</option>
            <option value="solid">Thin Line</option>
            <option value="solid-medium">Medium Line</option>
            <option value="solid-thick">Thick Line</option>
            <option value="dashed">Dashed Line</option>
            <option value="double">Double Line</option>
          </select>

          <div style={{ display: 'flex', background: '#f1f5f9', padding: '2px', borderRadius: '4px', gap: '2px' }}>
            <button type="button" onClick={() => applyBorder('borderTop')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#1e293b', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Top Border">Top</button>
            <button type="button" onClick={() => applyBorder('borderBottom')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#1e293b', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Bottom Border">Bottom</button>
            <button type="button" onClick={() => applyBorder('doubleBottom')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#107c41', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Double Bottom Border (Total Line)">Double B.</button>
            <button type="button" onClick={() => applyBorder('borderLeft')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#1e293b', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Left Border">Left</button>
            <button type="button" onClick={() => applyBorder('borderRight')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#1e293b', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Right Border">Right</button>
            <button type="button" onClick={() => applyBorder('all')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#107c41', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="All Borders">All</button>
            <button type="button" onClick={() => applyBorder('clear')} disabled={!selectedCell && !selectedColumn} style={{ background: 'transparent', border: 'none', padding: '4px 6px', fontSize: '11px', color: '#dc2626', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold' }} title="Clear Borders">Clear</button>
          </div>

          <div style={{ width: '1px', height: '20px', background: '#cbd5e1', margin: '0 4px' }}></div>

          {/* Quick Format Shortcuts */}
          <button 
            type="button" 
            onClick={toggleCurrency} 
            disabled={!selectedCell && !selectedColumn} 
            style={{ background: editFormat?.currency_symbol ? '#eaf5ea' : 'transparent', border: 'none', color: '#107c41', padding: '6px 10px', borderRadius: '4px', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '13px' }}
            title="Toggle Currency ($)"
          >
            $
          </button>
          <button 
            type="button" 
            onClick={togglePercent} 
            disabled={!selectedCell && !selectedColumn} 
            style={{ background: editFormat?.is_percent ? '#eaf5ea' : 'transparent', border: 'none', color: '#107c41', padding: '6px 10px', borderRadius: '4px', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '13px' }}
            title="Toggle Percentage (%)"
          >
            %
          </button>
          <button 
            type="button" 
            onClick={() => adjustDecimals(1)} 
            disabled={!selectedCell && !selectedColumn} 
            style={{ background: 'transparent', border: 'none', color: '#475569', padding: '6px 8px', borderRadius: '4px', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontSize: '12px' }}
            title="Increase Decimals"
          >
            .00→
          </button>
          <button 
            type="button" 
            onClick={() => adjustDecimals(-1)} 
            disabled={!selectedCell && !selectedColumn} 
            style={{ background: 'transparent', border: 'none', color: '#475569', padding: '6px 8px', borderRadius: '4px', cursor: (selectedCell || selectedColumn) ? 'pointer' : 'not-allowed', fontSize: '12px' }}
            title="Decrease Decimals"
          >
            ←.0
          </button>
        </div>

        {/* FORMULA BAR */}
        <div style={{ 
          background: '#ffffff', 
          border: '1px solid #cbd5e1', 
          borderTop: 'none', 
          borderRadius: '0 0 8px 8px', 
          padding: '6px 16px', 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '20px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', minWidth: '40px', select: 'none' }}>
            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginRight: '4px' }}>{selectedCell ? selectedCell.id : ''}</span>
            <span style={{ fontStyle: 'italic', fontWeight: 'bold', color: '#107c41', fontSize: '15px', cursor: 'default' }}>fx</span>
          </div>
          <div style={{ width: '1px', height: '16px', background: '#cbd5e1', margin: '0 12px' }}></div>
          <form onSubmit={handleFormulaSubmit} style={{ flex: 1, display: 'flex' }}>
            <input 
              type="text"
              value={formulaValue}
              onChange={handleFormulaChange}
              onBlur={() => handleFormulaSubmit()}
              disabled={!selectedCell}
              placeholder={selectedCell ? "Enter value or formula..." : "Select a cell to enter value..."}
              style={{ 
                flex: 1, 
                border: 'none', 
                outline: 'none', 
                background: 'transparent', 
                color: '#1e293b', 
                fontSize: '13px', 
                fontFamily: 'monospace'
              }}
            />
          </form>
        </div>

        {/* Governance Comparison Panel */}
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comparison:</span>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
              <input type="radio" name="comparison" value="prior_year" checked={comparisonMode === 'prior_year'} onChange={() => setComparisonMode('prior_year')} />
              Prior Year (Static 2023)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '14px', color: '#1e293b', fontWeight: '500' }}>
              <input type="radio" name="comparison" value="budget" checked={comparisonMode === 'budget'} onChange={() => setComparisonMode('budget')} />
              Budget Scenario
            </label>

            {comparisonMode === 'budget' && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
                <select
                  value={selectedScenarioId}
                  onChange={e => setSelectedScenarioId(e.target.value)}
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#1e293b', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', outline: 'none' }}
                >
                  {scenarios.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.isAdopted ? '(Adopted)' : ''}</option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={() => setIsNewScenarioModalOpen(true)}
                  style={{ background: 'rgba(26, 115, 232, 0.08)', border: '1px solid #1a73e8', color: '#1a73e8', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                >
                  + New Scenario
                </button>
                {selectedScenarioId && !scenarios.find(s => s.id === selectedScenarioId)?.isAdopted && (
                  <button 
                    type="button"
                    onClick={handleAdoptScenario}
                    style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#10b981', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    Adopt Scenario
                  </button>
                )}
              </div>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            {comparisonMode === 'budget' && scenarios.find(s => s.id === selectedScenarioId)?.derivedFromScenarioId && (
              <span>Scenario Lineage: Derived from Parent Scenario</span>
            )}
          </div>
        </div>

        {/* Spreadsheet Table */}
        <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                <th style={{ padding: '12px', textAlign: 'left', color: '#475569', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', borderRight: '1px solid #cbd5e1', width: '40%' }}>Account Category</th>
                <th 
                  onClick={() => handleColumnClick('col_actuals_2024')}
                  style={{ padding: '12px', textAlign: 'right', color: selectedColumn === 'col_actuals_2024' ? '#107c41' : '#475569', cursor: 'pointer', borderBottom: selectedColumn === 'col_actuals_2024' ? '2px solid #107c41' : 'none', borderRight: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                    2024 Actuals <Settings size={13} style={{ color: '#64748b' }} />
                  </span>
                </th>
                <th 
                  onClick={() => handleColumnClick('col_compare')}
                  style={{ padding: '12px', textAlign: 'right', color: selectedColumn === 'col_compare' ? '#107c41' : '#475569', cursor: 'pointer', borderBottom: selectedColumn === 'col_compare' ? '2px solid #107c41' : 'none', borderRight: '1px solid #cbd5e1', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                    {comparisonMode === 'prior_year' ? '2023 Actuals' : 'Target Budget'} <Settings size={13} style={{ color: '#64748b' }} />
                  </span>
                </th>
                <th 
                  onClick={() => handleColumnClick('col_variance')}
                  style={{ padding: '12px', textAlign: 'right', color: selectedColumn === 'col_variance' ? '#107c41' : '#475569', cursor: 'pointer', borderBottom: selectedColumn === 'col_variance' ? '2px solid #107c41' : 'none', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', width: '100%' }}>
                    Variance <Settings size={13} style={{ color: '#64748b' }} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              
              {/* Row: Gross Ticket Sales */}
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', fontWeight: '600', color: '#0f172a', borderRight: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>Gross Ticket Sales</td>
                <td 
                  onClick={() => handleCellClick('C1', 'col_actuals_2024', sales2024, 'first_in_group')}
                  style={getCellStyle('C1', 'col_actuals_2024')}
                >
                  {renderCell(sales2024, 'C1', 'col_actuals_2024', 'first_in_group')}
                </td>
                <td 
                  onClick={() => handleCellClick('C1_COMP', 'col_compare', salesCompare, 'first_in_group')}
                  style={getCellStyle('C1_COMP', 'col_compare')}
                >
                  {renderCell(salesCompare, 'C1_COMP', 'col_compare', 'first_in_group')}
                </td>
                <td 
                  onClick={() => handleCellClick('C1_VAR', 'col_variance', salesVar, 'first_in_group')}
                  style={getCellStyle('C1_VAR', 'col_variance')}
                >
                  {renderCell(salesVar, 'C1_VAR', 'col_variance', 'first_in_group')}
                </td>
              </tr>

              {/* Row: Prize Expense */}
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', paddingLeft: '24px', color: '#1e293b', borderRight: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>Prize Expense</td>
                <td 
                  onClick={() => handleCellClick('C2', 'col_actuals_2024', prizes2024, 'data')}
                  style={getCellStyle('C2', 'col_actuals_2024')}
                >
                  {renderCell(prizes2024, 'C2', 'col_actuals_2024', 'data')}
                </td>
                <td 
                  onClick={() => handleCellClick('C2_COMP', 'col_compare', prizesCompare, 'data')}
                  style={getCellStyle('C2_COMP', 'col_compare')}
                >
                  {renderCell(prizesCompare, 'C2_COMP', 'col_compare', 'data')}
                </td>
                <td 
                  onClick={() => handleCellClick('C2_VAR', 'col_variance', prizesVar, 'data')}
                  style={getCellStyle('C2_VAR', 'col_variance')}
                >
                  {renderCell(prizesVar, 'C2_VAR', 'col_variance', 'data')}
                </td>
              </tr>

              {/* Row: Retailer Commissions */}
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', paddingLeft: '24px', color: '#1e293b', borderRight: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}>Retailer Commissions</td>
                <td 
                  onClick={() => handleCellClick('C3', 'col_actuals_2024', commissions2024, 'data')}
                  style={getCellStyle('C3', 'col_actuals_2024')}
                >
                  {renderCell(commissions2024, 'C3', 'col_actuals_2024', 'data')}
                </td>
                <td 
                  onClick={() => handleCellClick('C3_COMP', 'col_compare', commissionsCompare, 'data')}
                  style={getCellStyle('C3_COMP', 'col_compare')}
                >
                  {renderCell(commissionsCompare, 'C3_COMP', 'col_compare', 'data')}
                </td>
                <td 
                  onClick={() => handleCellClick('C3_VAR', 'col_variance', commissionsVar, 'data')}
                  style={getCellStyle('C3_VAR', 'col_variance')}
                >
                  {renderCell(commissionsVar, 'C3_VAR', 'col_variance', 'data')}
                </td>
              </tr>

              {/* Row: Subtotal */}
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }}>Gross Margin</td>
                <td 
                  onClick={() => handleCellClick('C4', 'col_actuals_2024', margin2024, 'subtotal')}
                  style={getCellStyle('C4', 'col_actuals_2024', { fontWeight: 'bold', borderTop: '1px solid #cbd5e1' })}
                >
                  {renderCell(margin2024, 'C4', 'col_actuals_2024', 'subtotal')}
                </td>
                <td 
                  onClick={() => handleCellClick('C4_COMP', 'col_compare', marginCompare, 'subtotal')}
                  style={getCellStyle('C4_COMP', 'col_compare', { fontWeight: 'bold', borderTop: '1px solid #cbd5e1' })}
                >
                  {renderCell(marginCompare, 'C4_COMP', 'col_compare', 'subtotal')}
                </td>
                <td 
                  onClick={() => handleCellClick('C4_VAR', 'col_variance', marginVar, 'subtotal')}
                  style={getCellStyle('C4_VAR', 'col_variance', { fontWeight: 'bold', borderTop: '1px solid #cbd5e1' })}
                >
                  {renderCell(marginVar, 'C4_VAR', 'col_variance', 'subtotal')}
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        {!selectedCell && !selectedColumn && (
          <div style={{ marginTop: '40px', textAlign: 'center', color: '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loading ? 'Loading financial models...' : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                Select a cell to style formats, or click column settings (<Settings size={13} style={{ display: 'inline-block' }} />) to apply layout changes universally.
              </span>
            )}
          </div>
        )}
      </div>

      {/* RIGHT: Format Panel */}
      {(selectedCell || selectedColumn) && (
        <FormatPanel 
          cell={selectedCell || { value: 123456789 }} 
          format={editFormat} 
          onChange={(newFormat) => setEditFormat({...editFormat, ...newFormat})}
          onClose={() => { setSelectedCell(null); setSelectedColumn(null); }}
          onSave={handleSaveFormat}
          isColumnMode={!!selectedColumn}
        />
      )}

      {/* NEW SCENARIO MODAL */}
      {isNewScenarioModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '24px', width: '400px', display: 'flex', flexDirection: 'column', gap: '16px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>Create Budget Scenario</h2>
            <form onSubmit={handleCreateScenario} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>Scenario Name</label>
                <input 
                  type="text" 
                  value={newScenarioName} 
                  onChange={e => setNewScenarioName(e.target.value)} 
                  required
                  style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', color: '#0f172a', fontSize: '13px', outline: 'none' }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#475569', fontWeight: '500' }}>
                <input 
                  type="checkbox" 
                  checked={deriveFromCurrent} 
                  onChange={e => setDeriveFromCurrent(e.target.checked)} 
                />
                Derive baseline data from current scenario
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsNewScenarioModalOpen(false)} style={{ background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                <button type="submit" style={{ background: '#107c41', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
