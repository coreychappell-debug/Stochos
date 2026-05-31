import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';

const MetricComponent = (props) => {
  return (
    <NodeViewWrapper as="span" style={{ display: 'inline-block' }}>
      <span 
        contentEditable={false} 
        title={`Metric: ${props.node.attrs.label}`}
        style={{
          color: 'inherit',
          fontFamily: 'inherit',
          fontWeight: 'inherit',
          fontStyle: 'inherit',
          borderBottom: '2px dotted rgba(0, 180, 216, 0.6)',
          padding: '0 2px',
          cursor: 'pointer',
          margin: '0 2px',
          userSelect: 'none'
        }}
      >
        {props.node.attrs.value}
      </span>
    </NodeViewWrapper>
  );
};

export const MetricNode = Node.create({
  name: 'metric',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  marks: '_', // Allow this node to receive marks like bold, italic, color, etc.

  addAttributes() {
    return {
      metricId: { default: null },
      label: { default: 'Metric' },
      value: { default: '0.00' }
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-type="metric"]' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span', 
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'metric',
        title: `Metric: ${HTMLAttributes.label}`,
        style: 'color: inherit; font-family: inherit; font-weight: inherit; font-style: inherit; margin: 0 2px; border-bottom: 2px dotted rgba(0, 180, 216, 0.4);'
      }),
      HTMLAttributes.value
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MetricComponent);
  },
});
