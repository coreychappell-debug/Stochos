import { Node, mergeAttributes } from '@tiptap/core';

export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,

  parseHTML() {
    return [{ tag: 'hr.page-break' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { class: 'page-break', 'data-type': 'page-break' })];
  },

  addCommands() {
    return {
      insertPageBreak: () => ({ commands }) => {
        return commands.insertContent({ type: 'pageBreak' });
      },
    };
  },
});
