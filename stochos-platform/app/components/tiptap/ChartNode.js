import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// In a real app, this data would be fetched dynamically from the Metric Registry based on the metricId.
const generateMockData = (metricKey) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return months.map(m => ({
    name: m,
    [metricKey]: Math.floor(Math.random() * 500) + 200,
    Budget: 400
  }));
};

const ChartComponent = (props) => {
  const { title, type, metricKey, color } = props.node.attrs;
  const data = generateMockData(metricKey || 'Value');

  const handleDoubleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const event = new CustomEvent('stochos-edit-chart', {
      detail: {
        attrs: props.node.attrs,
        onSave: (newAttrs) => {
          props.updateAttributes(newAttrs);
        }
      }
    });
    window.dispatchEvent(event);
  };

  return (
    <NodeViewWrapper 
      onDoubleClick={handleDoubleClick}
      style={{ display: 'block', margin: '20px 0', border: `1px solid ${color || '#00b4d8'}40`, borderRadius: '8px', padding: '16px', background: 'rgba(0,0,0,0.2)', cursor: 'pointer' }} 
      contentEditable={false}
    >
      <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: color || '#00b4d8', fontSize: '16px' }}>{title}</h3>
        <span style={{ fontSize: '12px', color: '#8899aa', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '12px' }}>Live Data Link</span>
      </div>
      <div style={{ width: '100%', height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'line' ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#8899aa" />
              <YAxis stroke="#8899aa" />
              <Tooltip contentStyle={{ backgroundColor: '#1b2838', borderColor: '#2d3a4a', color: '#fff' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Line type="monotone" dataKey={metricKey || 'Value'} stroke={color || "#00b4d8"} strokeWidth={3} />
              <Line type="monotone" dataKey="Budget" stroke="#8899aa" strokeDasharray="5 5" />
            </LineChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="#8899aa" />
              <YAxis stroke="#8899aa" />
              <Tooltip contentStyle={{ backgroundColor: '#1b2838', borderColor: '#2d3a4a', color: '#fff' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey={metricKey || 'Value'} fill={color || "#00b4d8"} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Budget" fill="#334155" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </NodeViewWrapper>
  );
};

export const ChartNode = Node.create({
  name: 'chart',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      title: { default: 'Dynamic Chart' },
      type: { default: 'bar' },
      metricKey: { default: 'Gross Sales' },
      color: { default: '#00b4d8' }
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-type="chart"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div', 
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'chart',
        style: 'border: 1px solid #ccc; padding: 40px; text-align: center; background: #f4f6f8; border-radius: 8px; margin: 20px 0; color: #334155; font-family: sans-serif;'
      }),
      `[Dynamic ${HTMLAttributes.type} Chart: ${HTMLAttributes.title}] - Renders in PDF Generator`
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartComponent);
  },
});
