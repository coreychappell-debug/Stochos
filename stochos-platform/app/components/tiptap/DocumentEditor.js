'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontFamily } from '@tiptap/extension-font-family';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { MetricNode } from './MetricNode';
import { ChartNode } from './ChartNode';
import { PageBreakNode } from './PageBreakNode';
import { useState, useEffect } from 'react';

const getBorderCssValue = (type) => {
  if (!type || type === 'none') return 'none';
  if (type === 'solid' || type === 'solid-thin') return '1px solid #1e293b';
  if (type === 'solid-medium') return '2px solid #1e293b';
  if (type === 'solid-thick') return '3px solid #1e293b';
  if (type === 'dashed') return '1px dashed #475569';
  if (type === 'double') return '3px double #1e293b';
  return type;
};

// Extend TableCell and TableHeader to support custom borders, background colors, and padding attributes
const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
      },
      borderTop: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-top') || null,
      },
      borderBottom: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-bottom') || null,
      },
      borderLeft: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-left') || null,
      },
      borderRight: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-right') || null,
      },
      padding: {
        default: null,
        parseHTML: element => element.getAttribute('data-padding') || null,
      },
      verticalAlign: {
        default: null,
        parseHTML: element => element.style.verticalAlign || element.getAttribute('data-vertical-align') || null,
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const styles = [];
    const attrs = { ...HTMLAttributes };

    if (node.attrs.backgroundColor) {
      styles.push(`background-color: ${node.attrs.backgroundColor}`);
      attrs['data-background-color'] = node.attrs.backgroundColor;
    }
    if (node.attrs.borderTop) {
      styles.push(`border-top: ${getBorderCssValue(node.attrs.borderTop)}`);
      attrs['data-border-top'] = node.attrs.borderTop;
    }
    if (node.attrs.borderBottom) {
      styles.push(`border-bottom: ${getBorderCssValue(node.attrs.borderBottom)}`);
      attrs['data-border-bottom'] = node.attrs.borderBottom;
    }
    if (node.attrs.borderLeft) {
      styles.push(`border-left: ${getBorderCssValue(node.attrs.borderLeft)}`);
      attrs['data-border-left'] = node.attrs.borderLeft;
    }
    if (node.attrs.borderRight) {
      styles.push(`border-right: ${getBorderCssValue(node.attrs.borderRight)}`);
      attrs['data-border-right'] = node.attrs.borderRight;
    }
    if (node.attrs.padding) {
      const padVal = node.attrs.padding === 'compact' ? '4px 8px' : 
                     node.attrs.padding === 'spacious' ? '12px 16px' : '8px 12px';
      styles.push(`padding: ${padVal}`);
      attrs['data-padding'] = node.attrs.padding;
    }
    if (node.attrs.verticalAlign) {
      styles.push(`vertical-align: ${node.attrs.verticalAlign}`);
      attrs['data-vertical-align'] = node.attrs.verticalAlign;
    }

    if (styles.length > 0) {
      const existingStyle = HTMLAttributes.style || '';
      attrs.style = [existingStyle, styles.join('; ')].filter(Boolean).join('; ');
    }

    return ['td', attrs, 0];
  }
});

const CustomTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || element.getAttribute('data-background-color') || null,
      },
      borderTop: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-top') || null,
      },
      borderBottom: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-bottom') || null,
      },
      borderLeft: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-left') || null,
      },
      borderRight: {
        default: null,
        parseHTML: element => element.getAttribute('data-border-right') || null,
      },
      padding: {
        default: null,
        parseHTML: element => element.getAttribute('data-padding') || null,
      },
      verticalAlign: {
        default: null,
        parseHTML: element => element.style.verticalAlign || element.getAttribute('data-vertical-align') || null,
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const styles = [];
    const attrs = { ...HTMLAttributes };

    if (node.attrs.backgroundColor) {
      styles.push(`background-color: ${node.attrs.backgroundColor}`);
      attrs['data-background-color'] = node.attrs.backgroundColor;
    }
    if (node.attrs.borderTop) {
      styles.push(`border-top: ${getBorderCssValue(node.attrs.borderTop)}`);
      attrs['data-border-top'] = node.attrs.borderTop;
    }
    if (node.attrs.borderBottom) {
      styles.push(`border-bottom: ${getBorderCssValue(node.attrs.borderBottom)}`);
      attrs['data-border-bottom'] = node.attrs.borderBottom;
    }
    if (node.attrs.borderLeft) {
      styles.push(`border-left: ${getBorderCssValue(node.attrs.borderLeft)}`);
      attrs['data-border-left'] = node.attrs.borderLeft;
    }
    if (node.attrs.borderRight) {
      styles.push(`border-right: ${getBorderCssValue(node.attrs.borderRight)}`);
      attrs['data-border-right'] = node.attrs.borderRight;
    }
    if (node.attrs.padding) {
      const padVal = node.attrs.padding === 'compact' ? '4px 8px' : 
                     node.attrs.padding === 'spacious' ? '12px 16px' : '8px 12px';
      styles.push(`padding: ${padVal}`);
      attrs['data-padding'] = node.attrs.padding;
    }
    if (node.attrs.verticalAlign) {
      styles.push(`vertical-align: ${node.attrs.verticalAlign}`);
      attrs['data-vertical-align'] = node.attrs.verticalAlign;
    }

    if (styles.length > 0) {
      const existingStyle = HTMLAttributes.style || '';
      attrs.style = [existingStyle, styles.join('; ')].filter(Boolean).join('; ');
    }

    return ['th', attrs, 0];
  }
});

const mockRegistry = [
  { id: 'm1', name: 'Gross Sales YTD', value: '$850.0M' },
  { id: 'm2', name: 'Prize Expense YTD', value: '$520.0M' },
  { id: 'm3', name: 'Net Transfer', value: '$330.0M' },
  { id: 'm4', name: 'Scratcher Sales', value: '$410.5M' }
];

export default function DocumentEditor({ initialContent, onChange }) {
  const [showMetricModal, setShowMetricModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [editingChart, setEditingChart] = useState(null); // { attrs, onSave }
  const [showPreview, setShowPreview] = useState(false);
  const [chartConfig, setChartConfig] = useState({
    title: 'Q1 Performance',
    type: 'bar',
    metricKey: 'Gross Sales YTD',
    color: '#00b4d8'
  });

  const [registry, setRegistry] = useState(mockRegistry);

  // New table builder and cell styling states
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [hoveredRows, setHoveredRows] = useState(0);
  const [hoveredCols, setHoveredCols] = useState(0);
  const [selectedBorderStyle, setSelectedBorderStyle] = useState('solid');
  const [activeCellAttrs, setActiveCellAttrs] = useState({});

  const applyCellAttribute = (name, value) => {
    const { state } = editor;
    const { selection } = state;
    const isCellSelection = selection.constructor.name === 'CellSelection' || 
                            selection.class?.name === 'CellSelection' || 
                            ('cellRange' in selection) || 
                            ('eachCell' in selection);
    
    if (isCellSelection) {
      editor.chain().focus().setCellAttribute(name, value).run();
      return;
    }
    
    const { $from } = selection;
    let cellPos = null;
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth);
      if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
        cellPos = $from.before(depth);
        break;
      }
    }
    
    if (cellPos !== null) {
      const cellNode = state.doc.nodeAt(cellPos);
      if (cellNode) {
        const attrs = { ...cellNode.attrs, [name]: value };
        editor.view.dispatch(state.tr.setNodeMarkup(cellPos, null, attrs));
        editor.view.focus();
      }
    }
  };

  const applyBorder = (side) => {
    if (side === 'all') {
      applyCellAttribute('borderTop', selectedBorderStyle);
      applyCellAttribute('borderBottom', selectedBorderStyle);
      applyCellAttribute('borderLeft', selectedBorderStyle);
      applyCellAttribute('borderRight', selectedBorderStyle);
    } else if (side === 'clear') {
      applyCellAttribute('borderTop', null);
      applyCellAttribute('borderBottom', null);
      applyCellAttribute('borderLeft', null);
      applyCellAttribute('borderRight', null);
    } else {
      applyCellAttribute(side, selectedBorderStyle);
    }
  };

  useEffect(() => {
    async function loadRegistry() {
      try {
        const metricsRes = await fetch('/api/reporting/metrics');
        const gridRes = await fetch('/api/reporting/grid');
        if (metricsRes.ok && gridRes.ok) {
          const metricsData = await metricsRes.json();
          const gridData = await gridRes.json();
          if (metricsData.success && gridData.success) {
            const actuals = gridData.actuals || {};
            const mapped = metricsData.metrics.map(m => {
              let rawVal = 0;
              if (m.glAccount && actuals[m.glAccount] !== undefined) {
                rawVal = actuals[m.glAccount];
              }
              let formattedVal = rawVal.toLocaleString();
              if (Math.abs(rawVal) >= 1000000) {
                formattedVal = `$${(rawVal / 1000000).toFixed(1)}M`;
              } else if (rawVal !== 0) {
                formattedVal = `$${rawVal.toLocaleString()}`;
              }
              return { id: m.id, name: m.name, value: formattedVal };
            });
            if (mapped.length > 0) {
              setRegistry(mapped);
              setChartConfig(prev => ({ ...prev, metricKey: mapped[0].name }));
            }
          }
        }
      } catch (err) {
        console.error('Failed to load metrics dynamically inside editor:', err);
      }
    }
    loadRegistry();
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      FontFamily,
      Underline,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      MetricNode,
      ChartNode,
      PageBreakNode,
      Table.configure({ resizable: true }),
      TableRow,
      CustomTableHeader,
      CustomTableCell,
      Placeholder.configure({
        placeholder: 'Write your narrative here. Type / to insert a metric...',
      }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px]',
      },
    },
    onSelectionUpdate: ({ editor }) => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      let found = null;
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          found = node.attrs;
          break;
        }
      }
      setActiveCellAttrs(found || {});
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        onChange(editor.getHTML());
      }
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;
      let found = null;
      for (let depth = $from.depth; depth > 0; depth--) {
        const node = $from.node(depth);
        if (node.type.name === 'tableCell' || node.type.name === 'tableHeader') {
          found = node.attrs;
          break;
        }
      }
      setActiveCellAttrs(found || {});
    }
  });

  // Handle double-click edit chart event
  useEffect(() => {
    const handleEditChart = (e) => {
      const { attrs, onSave } = e.detail;
      setEditingChart({ attrs, onSave });
      setChartConfig(attrs);
      setShowChartModal(true);
    };

    window.addEventListener('stochos-edit-chart', handleEditChart);
    return () => {
      window.removeEventListener('stochos-edit-chart', handleEditChart);
    };
  }, []);

  // Sync content if it changes externally (e.g., loading a template)
  useEffect(() => {
    if (editor && initialContent !== undefined) {
      if (editor.getHTML() !== initialContent) {
        setTimeout(() => {
          editor.commands.setContent(initialContent);
        }, 0);
      }
    }
  }, [initialContent, editor]);

  if (!editor) return null;

  const insertMetric = (metric) => {
    editor.chain().focus().insertContent({
      type: 'metric',
      attrs: {
        metricId: metric.id,
        label: metric.name,
        value: metric.value
      }
    }).run();
    setShowMetricModal(false);
  };


  return (
    <div style={{ background: '#f8f9fa', border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      
      {/* TOOLBAR */}
      <div style={{ padding: '8px 12px', background: '#ffffff', borderBottom: '1px solid #cbd5e1', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
        
        {/* Undo / Redo */}
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }} 
          disabled={!editor.can().undo()}
          style={{ background: 'transparent', color: '#475569', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: editor.can().undo() ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: editor.can().undo() ? 1 : 0.4 }}
          title="Undo (Ctrl+Z)"
        >
          ↩
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }} 
          disabled={!editor.can().redo()}
          style={{ background: 'transparent', color: '#475569', border: 'none', padding: '6px 10px', borderRadius: '4px', cursor: editor.can().redo() ? 'pointer' : 'not-allowed', fontSize: '13px', opacity: editor.can().redo() ? 1 : 0.4 }}
          title="Redo (Ctrl+Y)"
        >
          ↪
        </button>

        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>

        {/* Font Family */}
        <select
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
        >
          <option value="Inter, sans-serif">Inter (Default)</option>
          <option value="Arial, sans-serif">Arial</option>
          <option value="'Times New Roman', serif">Times New Roman</option>
          <option value="'Courier New', monospace">Courier New</option>
          <option value="Georgia, serif">Georgia</option>
          <option value="Verdana, sans-serif">Verdana</option>
        </select>

        {/* Headings */}
        <select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'p') editor.chain().focus().setParagraph().run();
            else if (val === 'h1') editor.chain().focus().toggleHeading({ level: 1 }).run();
            else if (val === 'h2') editor.chain().focus().toggleHeading({ level: 2 }).run();
            else if (val === 'h3') editor.chain().focus().toggleHeading({ level: 3 }).run();
          }}
          style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', outline: 'none', cursor: 'pointer', fontSize: '13px' }}
        >
          <option value="p">Normal Text</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>

        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>

        {/* Basic Text Formatting */}
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} 
          style={{ background: editor.isActive('bold') ? '#e0f2fe' : 'transparent', color: editor.isActive('bold') ? '#0284c7' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          title="Bold"
        >
          B
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} 
          style={{ background: editor.isActive('italic') ? '#e0f2fe' : 'transparent', color: editor.isActive('italic') ? '#0284c7' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontStyle: 'italic', fontSize: '13px' }}
          title="Italic"
        >
          I
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }} 
          style={{ background: editor.isActive('underline') ? '#e0f2fe' : 'transparent', color: editor.isActive('underline') ? '#0284c7' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', textDecoration: 'underline', fontSize: '13px' }}
          title="Underline"
        >
          U
        </button>

        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>

        {/* Text Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Text Color">
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>A:</span>
          <input
            type="color"
            onInput={event => editor.chain().focus().setColor(event.target.value).run()}
            value={editor.getAttributes('textStyle').color || '#000000'}
            style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent', padding: 0 }}
          />
        </div>

        {/* Highlight Color */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="Highlight Color">
          <span style={{ fontSize: '12px', color: '#475569', fontWeight: 'bold' }}>H:</span>
          <input
            type="color"
            onInput={event => editor.chain().focus().setHighlight({ color: event.target.value }).run()}
            value={editor.getAttributes('highlight').color || '#ffff00'}
            style={{ width: '24px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent', padding: 0 }}
          />
          {editor.isActive('highlight') && (
            <button 
              onClick={(e) => { e.preventDefault(); editor.chain().focus().unsetHighlight().run(); }} 
              style={{ background: 'transparent', color: '#ef476f', border: 'none', padding: '0 4px', cursor: 'pointer', fontSize: '11px' }}
              title="Clear Highlight"
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>

        {/* Alignment */}
        <div style={{ display: 'flex', gap: '2px', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px', borderRadius: '4px' }}>
          <button 
            onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('left').run(); }} 
            style={{ background: editor.isActive({ textAlign: 'left' }) ? '#e0f2fe' : 'transparent', color: editor.isActive({ textAlign: 'left' }) ? '#0284c7' : '#475569', border: 'none', padding: '6px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
            title="Align Left"
          >
            Left
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('center').run(); }} 
            style={{ background: editor.isActive({ textAlign: 'center' }) ? '#e0f2fe' : 'transparent', color: editor.isActive({ textAlign: 'center' }) ? '#0284c7' : '#475569', border: 'none', padding: '6px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
            title="Align Center"
          >
            Center
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('right').run(); }} 
            style={{ background: editor.isActive({ textAlign: 'right' }) ? '#e0f2fe' : 'transparent', color: editor.isActive({ textAlign: 'right' }) ? '#0284c7' : '#475569', border: 'none', padding: '6px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
            title="Align Right"
          >
            Right
          </button>
          <button 
            onClick={(e) => { e.preventDefault(); editor.chain().focus().setTextAlign('justify').run(); }} 
            style={{ background: editor.isActive({ textAlign: 'justify' }) ? '#e0f2fe' : 'transparent', color: editor.isActive({ textAlign: 'justify' }) ? '#0284c7' : '#475569', border: 'none', padding: '6px 10px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px' }}
            title="Justify"
          >
            Justify
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>

        {/* Lists */}
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} 
          style={{ background: editor.isActive('bulletList') ? '#e0f2fe' : 'transparent', color: editor.isActive('bulletList') ? '#0284c7' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          title="Bullet List"
        >
          • List
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} 
          style={{ background: editor.isActive('orderedList') ? '#e0f2fe' : 'transparent', color: editor.isActive('orderedList') ? '#0284c7' : '#475569', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}
          title="Numbered List"
        >
          1. List
        </button>

        {/* Table Controls */}
        <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }}></div>
        
        {/* Dynamic 10x10 Hover Grid Size Table Builder */}
        <div style={{ position: 'relative' }}>
          <button 
            type="button"
            onClick={() => setShowTableSelector(!showTableSelector)}
            style={{ background: showTableSelector ? '#e0f2fe' : '#ffffff', color: '#0284c7', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            title="Insert Table Grid Builder"
          >
            <span>▦</span> Insert Table
          </button>
          
          {showTableSelector && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: '6px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              width: '180px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f172a', textAlign: 'center' }}>
                {hoveredRows > 0 && hoveredCols > 0 ? `${hoveredCols} x ${hoveredRows} Table` : 'Select grid size'}
              </div>
              
              <div 
                style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 14px)', gap: '2px', justifyContent: 'center' }}
                onMouseLeave={() => { setHoveredRows(0); setHoveredCols(0); }}
              >
                {Array.from({ length: 10 }).map((_, rIdx) => {
                  const row = rIdx + 1;
                  return Array.from({ length: 10 }).map((_, cIdx) => {
                    const col = cIdx + 1;
                    const isHighlighted = row <= hoveredRows && col <= hoveredCols;
                    return (
                      <div
                        key={`${row}-${col}`}
                        onMouseEnter={() => { setHoveredRows(row); setHoveredCols(col); }}
                        onClick={() => {
                          editor.chain().focus().insertTable({ rows: row, cols: col, withHeaderRow: true }).run();
                          setShowTableSelector(false);
                          setHoveredRows(0);
                          setHoveredCols(0);
                        }}
                        style={{
                          width: '14px',
                          height: '14px',
                          border: '1px solid #cbd5e1',
                          background: isHighlighted ? '#bae6fd' : '#ffffff',
                          borderColor: isHighlighted ? '#0284c7' : '#cbd5e1',
                          cursor: 'pointer',
                          borderRadius: '2px',
                          transition: 'background 0.05s, border-color 0.05s'
                        }}
                      />
                    );
                  });
                })}
              </div>
            </div>
          )}
        </div>

        {editor.isActive('table') && (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Add Column">Col +</button>
              <button onClick={() => editor.chain().focus().deleteColumn().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Delete Column">Col -</button>
              <button onClick={() => editor.chain().focus().addRowAfter().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Add Row">Row +</button>
              <button onClick={() => editor.chain().focus().deleteRow().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Delete Row">Row -</button>
              <button onClick={() => editor.chain().focus().mergeCells().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Merge Cells">Merge</button>
              <button onClick={() => editor.chain().focus().splitCell().run()} style={{ background: 'transparent', color: '#475569', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Split Cells">Split</button>
              <button onClick={() => editor.chain().focus().deleteTable().run()} style={{ background: 'transparent', color: '#ef476f', border: 'none', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }} title="Delete Table">Delete</button>
            </div>

            {/* Custom Cell Styling Overrides */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} title="Cell Background">
              <span style={{ fontSize: '11px', color: '#475569' }}>Bg:</span>
              <input
                type="color"
                onInput={event => applyCellAttribute('backgroundColor', event.target.value)}
                style={{ width: '20px', height: '20px', border: 'none', borderRadius: '2px', cursor: 'pointer', background: 'transparent', padding: 0 }}
              />
            </div>

            <select
              value={activeCellAttrs.padding || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                applyCellAttribute('padding', val);
                setActiveCellAttrs(prev => ({ ...prev, padding: val }));
              }}
              style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              title="Cell Padding"
            >
              <option value="">Padding...</option>
              <option value="compact">Compact</option>
              <option value="normal">Normal</option>
              <option value="spacious">Spacious</option>
            </select>

            <select
              value={activeCellAttrs.verticalAlign || ''}
              onChange={(e) => {
                const val = e.target.value || null;
                applyCellAttribute('verticalAlign', val);
                setActiveCellAttrs(prev => ({ ...prev, verticalAlign: val }));
              }}
              style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              title="Vertical Alignment"
            >
              <option value="">V-Align...</option>
              <option value="top">Top</option>
              <option value="middle">Middle</option>
              <option value="bottom">Bottom</option>
            </select>

            {/* Advanced Financial Border Formatting Toggles */}
            <select
              value={selectedBorderStyle}
              onChange={(e) => setSelectedBorderStyle(e.target.value)}
              style={{ background: '#ffffff', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 6px', fontSize: '12px', outline: 'none', cursor: 'pointer' }}
              title="Select Border Line Style"
            >
              <option value="none">No Border (Clear)</option>
              <option value="solid">Thin Solid Line</option>
              <option value="solid-medium">Medium Solid Line</option>
              <option value="solid-thick">Thick Solid Line</option>
              <option value="dashed">Dashed Line</option>
              <option value="double">Double Line (Total)</option>
            </select>

            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '4px', border: '1px solid #cbd5e1', overflow: 'hidden' }}>
              <button type="button" onClick={() => applyBorder('borderTop')} style={{ background: 'transparent', color: '#1e293b', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Apply Top Border">Top</button>
              <button type="button" onClick={() => applyBorder('borderBottom')} style={{ background: 'transparent', color: '#1e293b', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Apply Bottom Border">Bottom</button>
              <button type="button" onClick={() => applyBorder('borderLeft')} style={{ background: 'transparent', color: '#1e293b', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Apply Left Border">Left</button>
              <button type="button" onClick={() => applyBorder('borderRight')} style={{ background: 'transparent', color: '#1e293b', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Apply Right Border">Right</button>
              <button type="button" onClick={() => applyBorder('all')} style={{ background: 'transparent', color: '#0284c7', border: 'none', borderRight: '1px solid #cbd5e1', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Apply All Borders">All</button>
              <button type="button" onClick={() => applyBorder('clear')} style={{ background: 'transparent', color: '#ef476f', border: 'none', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }} title="Clear Borders">Clear</button>
            </div>
          </div>
        )}

        <div style={{ flex: 1 }}></div>

        <button 
          onClick={() => editor.chain().focus().insertPageBreak().run()} 
          style={{ background: '#ffffff', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
        >
          <span>✂️</span> Page Break
        </button>

        <button 
          onClick={() => setShowChartModal(true)} 
          style={{ background: '#ffffff', color: '#0284c7', border: '1px solid #93c5fd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500' }}
        >
          <span>📈</span> Insert Chart
        </button>

        <button 
          onClick={() => setShowMetricModal(true)} 
          style={{ background: '#ffffff', color: '#0284c7', border: '1px solid #93c5fd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500' }}
        >
          <span>➕</span> Insert Metric Pill
        </button>
      </div>

      {/* EDITOR / PREVIEW CONTENT */}
      {showPreview ? (
        <div className="preview-area" style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Render the current HTML output as a static preview */}
          <div className="document-page" dangerouslySetInnerHTML={{ __html: editor.getHTML() }} />
        </div>
      ) : (
        <div className="document-workspace" style={{ flex: 1, cursor: 'text' }} onClick={() => editor.commands.focus()}>
          <div className="document-page">
            <EditorContent editor={editor} />
          </div>
        </div>
      )}

      {/* METRIC MODAL */}
      {showMetricModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '500px', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: 'bold' }}>Insert Metric Link</h3>
              <button onClick={() => setShowMetricModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '16px' }}>
              <input type="text" placeholder="Search metric registry..." style={{ width: '100%', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', marginBottom: '16px', outline: 'none' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {registry.map(m => (
                  <div 
                    key={m.id} 
                    onClick={() => insertMetric(m)}
                    style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    <span style={{ color: '#0284c7', fontWeight: '500' }}>{m.name}</span>
                    <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHART MODAL */}
      {showChartModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#ffffff', width: '500px', borderRadius: '8px', border: '1px solid #cbd5e1', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: '#0f172a', fontSize: '16px', fontWeight: 'bold' }}>{editingChart ? 'Edit Embedded Chart' : 'Chart Builder'}</h3>
              <button onClick={() => { setShowChartModal(false); setEditingChart(null); }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>Chart Title</label>
                <input 
                  type="text" 
                  value={chartConfig.title}
                  onChange={(e) => setChartConfig({...chartConfig, title: e.target.value})}
                  style={{ width: '100%', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', outline: 'none' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#475569', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>Chart Type</label>
                  <select 
                    value={chartConfig.type}
                    onChange={(e) => setChartConfig({...chartConfig, type: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="line">Line Chart</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: '#475569', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>Brand Color</label>
                  <select 
                    value={chartConfig.color}
                    onChange={(e) => setChartConfig({...chartConfig, color: e.target.value})}
                    style={{ width: '100%', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    <option value="#00b4d8">Stochos Blue</option>
                    <option value="#06d6a0">Mint Green</option>
                    <option value="#ffd166">Alert Gold</option>
                    <option value="#ef476f">Danger Red</option>
                    <option value="#7b68ee">Royal Purple</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', color: '#475569', fontSize: '12px', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>Primary Metric</label>
                <select 
                  value={chartConfig.metricKey}
                  onChange={(e) => setChartConfig({...chartConfig, metricKey: e.target.value})}
                  style={{ width: '100%', padding: '8px 12px', background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '6px', cursor: 'pointer' }}
                >
                  {registry.map(m => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button 
                  onClick={() => {
                    if (editingChart) {
                      editingChart.onSave(chartConfig);
                      setEditingChart(null);
                    } else {
                      editor.chain().focus().insertContent({ type: 'chart', attrs: chartConfig }).run();
                    }
                    setShowChartModal(false);
                  }}
                  style={{ width: '100%', padding: '12px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px -1px rgba(2, 132, 199, 0.2)' }}
                >
                  {editingChart ? 'Update Chart Attributes' : 'Insert Dynamic Chart'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
