'use client';

export default function FormatPanel({ cell, format, onChange, onClose, onSave, isColumnMode }) {
  
  // Format live preview logic
  const renderPreview = (val, mockRowClass) => {
    let num = val;
    if (format.scale === 'thousands') num = num / 1000;
    if (format.scale === 'millions') num = num / 1000000;
    if (format.scale === 'billions') num = num / 1000000000;

    let str = Math.abs(num).toFixed(format.decimal_places);
    if (format.thousands_separator) {
      str = parseFloat(str).toLocaleString('en-US', { minimumFractionDigits: format.decimal_places, maximumFractionDigits: format.decimal_places });
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

    const showCurrency = mockRowClass === 'first_in_group' || mockRowClass === 'subtotal' || mockRowClass === 'grand_total';
    const isTotal = mockRowClass === 'grand_total';

    return (
      <div style={{ 
        display: 'flex', justifyContent: 'space-between', padding: '8px 0', 
        borderBottom: isTotal ? '3px double #1e293b' : 'none',
        color: isNegative && format.negative_style?.includes('red') ? '#dc2626' : '#1e293b'
      }}>
        <span style={{ color: '#64748b', visibility: showCurrency && format.currency_symbol ? 'visible' : 'hidden' }}>{format.currency_symbol}</span>
        <span>{str}</span>
      </div>
    );
  };

  return (
    <div style={{ width: '400px', background: '#ffffff', borderLeft: '1px solid #cbd5e1', display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '"Inter", sans-serif' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '18px', margin: 0, color: '#0f172a', fontWeight: 'bold' }}>{isColumnMode ? 'Column Format' : 'Cell Override'}</h2>
          <span style={{ fontSize: '12px', color: isColumnMode ? '#475569' : '#107c41', fontWeight: '600' }}>{isColumnMode ? 'Universal Default' : 'Local Edit'}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px' }}>✕</button>
      </div>

      <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Section 1: Scale */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Display Scale</label>
          <select 
            value={format.scale} onChange={(e) => onChange({ scale: e.target.value })}
            style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', outline: 'none' }}
          >
            <option value="units">Units</option>
            <option value="thousands">Thousands (K)</option>
            <option value="millions">Millions (M)</option>
            <option value="billions">Billions (B)</option>
          </select>
        </div>

        {/* Section 2: Currency */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Symbol</label>
            <input 
              type="text" value={format.currency_symbol || ''} onChange={(e) => onChange({ currency_symbol: e.target.value })}
              style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Visibility Rule</label>
            <div style={{ fontSize: '12px', color: '#0e6c38', padding: '8px', background: '#eaf5ea', borderRadius: '4px', border: '1px dashed #107c41' }}>
              Governed by Positional Rule
            </div>
          </div>
        </div>

        {/* Section 3: Decimals */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Decimal Places</label>
          <input 
            type="number" min="0" max="6" value={format.decimal_places} onChange={(e) => onChange({ decimal_places: parseInt(e.target.value) })}
            style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', outline: 'none' }}
          />
        </div>

        {/* Section 4: Negatives */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Negative Numbers</label>
          <select 
            value={format.negative_style} onChange={(e) => onChange({ negative_style: e.target.value })}
            style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', outline: 'none' }}
          >
            <option value="parentheses">(1,234)</option>
            <option value="minus">-1,234</option>
            <option value="parentheses_red">(1,234) Red</option>
            <option value="minus_red">-1,234 Red</option>
          </select>
        </div>

        {/* Section 5: Zeros */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Zero Display</label>
          <select 
            value={format.zero_display} onChange={(e) => onChange({ zero_display: e.target.value })}
            style={{ width: '100%', padding: '8px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '4px', outline: 'none' }}
          >
            <option value="dash">— (Dash)</option>
            <option value="zero">0</option>
            <option value="blank">Blank</option>
          </select>
        </div>

        {/* Section 6: Font & Text Style */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Font & Style</label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button 
              type="button"
              onClick={() => onChange({ fontWeight: format.fontWeight === 'bold' ? 'normal' : 'bold' })}
              style={{ flex: 1, padding: '8px', background: format.fontWeight === 'bold' ? '#eaf5ea' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: format.fontWeight === 'bold' ? '#107c41' : '#475569', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Bold
            </button>
            <button 
              type="button"
              onClick={() => onChange({ fontStyle: format.fontStyle === 'italic' ? 'normal' : 'italic' })}
              style={{ flex: 1, padding: '8px', background: format.fontStyle === 'italic' ? '#eaf5ea' : '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', color: format.fontStyle === 'italic' ? '#107c41' : '#475569', fontStyle: 'italic', cursor: 'pointer' }}
            >
              Italic
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Fill Color</label>
              <input 
                type="color" 
                value={format.backgroundColor || '#ffffff'} 
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: '2px', background: '#ffffff' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>Text Color</label>
              <input 
                type="color" 
                value={format.color || '#1e293b'} 
                onChange={(e) => onChange({ color: e.target.value })}
                style={{ width: '100%', height: '32px', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer', padding: '2px', background: '#ffffff' }}
              />
            </div>
          </div>
        </div>

        {/* Section 7: Cell Alignment */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Cell Alignment</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Horizontal:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['left', 'center', 'right'].map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onChange({ textAlign: align })}
                    style={{ flex: 1, padding: '6px', fontSize: '12px', textTransform: 'capitalize', background: format.textAlign === align ? '#eaf5ea' : '#f8fafc', border: '1px solid #cbd5e1', color: format.textAlign === align ? '#107c41' : '#475569', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Vertical:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {['top', 'middle', 'bottom'].map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => onChange({ verticalAlign: align })}
                    style={{ flex: 1, padding: '6px', fontSize: '12px', textTransform: 'capitalize', background: format.verticalAlign === align ? '#eaf5ea' : '#f8fafc', border: '1px solid #cbd5e1', color: format.verticalAlign === align ? '#107c41' : '#475569', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    {align}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 8: Cell Borders */}
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>Cell Borders</label>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
            <button type="button" onClick={() => onChange({ borderTop: 'solid' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}>Top</button>
            <button type="button" onClick={() => onChange({ borderBottom: 'solid' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}>Bottom</button>
            <button type="button" onClick={() => onChange({ borderBottom: 'double' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#eaf5ea', border: '1px solid #cbd5e1', color: '#107c41', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Double B.</button>
            <button type="button" onClick={() => onChange({ borderLeft: 'solid' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}>Left</button>
            <button type="button" onClick={() => onChange({ borderRight: 'solid' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}>Right</button>
            <button type="button" onClick={() => onChange({ borderTop: 'solid', borderBottom: 'solid', borderLeft: 'solid', borderRight: 'solid' })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 30%', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '4px', cursor: 'pointer' }}>All</button>
            <button type="button" onClick={() => onChange({ borderTop: null, borderBottom: null, borderLeft: null, borderRight: null })} style={{ padding: '6px', fontSize: '11px', flex: '1 1 100%', background: '#f8fafc', border: '1px dashed #ef476f', color: '#ef476f', borderRadius: '4px', cursor: 'pointer', marginTop: '4px' }}>Clear Borders</button>
          </div>
        </div>

      </div>

      {/* Live Preview Footer */}
      <div style={{ padding: '20px', background: '#f8fafc', borderTop: '1px solid #cbd5e1' }}>
        <h3 style={{ fontSize: '12px', color: '#475569', textTransform: 'uppercase', margin: '0 0 12px 0', fontWeight: 'bold', letterSpacing: '0.5px' }}>Live Preview</h3>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '16px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '16px', marginBottom: '20px', color: '#0f172a' }}>
          {renderPreview(cell.value, 'first_in_group')}
          {renderPreview(-Math.abs(cell.value), 'data')}
          {renderPreview(0, 'data')}
          {renderPreview(cell.value * 2, 'grand_total')}
        </div>
        
        <button 
          onClick={onSave}
          style={{ 
            width: '100%', 
            padding: '12px', 
            background: '#107c41', 
            color: '#ffffff', 
            fontWeight: 'bold', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer', 
            fontSize: '14px',
            boxShadow: '0 2px 4px rgba(16, 124, 65, 0.2)',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#0e6c38'}
          onMouseOut={(e) => e.currentTarget.style.background = '#107c41'}
        >
          Save Configuration
        </button>
      </div>

    </div>
  );
}
