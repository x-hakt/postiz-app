'use client';

// x-hakt (PLN-25): the long-form ("rich") editor used by WordPress channels. The stock editor
// only knows paragraphs, h1-h3, bold, underline, bullet lists and links, which is fine for social
// posts and useless for articles. Rich mode adds italic, numbered lists, h4, inline code, code
// blocks, quotes, rules, line breaks, images, YouTube embeds, tables, and an HTML block that keeps
// figures with inline SVG diagrams (or any other embed) verbatim and renders them live. Social
// channels never load any of this.

import { FC, useCallback } from 'react';
import { Node } from '@tiptap/react';
import Italic from '@tiptap/extension-italic';
import Code from '@tiptap/extension-code';
import CodeBlock from '@tiptap/extension-code-block';
import Blockquote from '@tiptap/extension-blockquote';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import HardBreak from '@tiptap/extension-hard-break';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
import { OrderedList } from '@tiptap/extension-list';
import { sanitizeRichContent } from '@gitroom/helpers/utils/sanitize.post.content';

/** Raw HTML kept as-is (sanitised): figures with SVG diagrams, and embeds other than YouTube. */
export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return { html: { default: '' } };
  },
  parseHTML() {
    const outer = (el: HTMLElement | string) => ({ html: typeof el === 'string' ? el : el.outerHTML });
    return [
      { tag: 'div[data-html-block]', priority: 70, getAttrs: (el) => ({ html: (el as HTMLElement).innerHTML }) },
      { tag: 'figure', priority: 60, getAttrs: (el) => outer(el as HTMLElement) },
      { tag: 'svg', priority: 60, getAttrs: (el) => outer(el as unknown as HTMLElement) },
    ];
  },
  renderHTML({ node }) {
    const div = document.createElement('div');
    div.setAttribute('data-html-block', '');
    div.innerHTML = sanitizeRichContent(node.attrs.html);
    return div;
  },
});

export const richExtensions = () => [
  Italic,
  Code,
  CodeBlock,
  Blockquote,
  HorizontalRule,
  HardBreak,
  OrderedList,
  Image.configure({ inline: false, allowBase64: false }),
  Youtube.configure({ nocookie: true, controls: true, width: 640, height: 360 }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  HtmlBlock,
];

const Btn: FC<{ tip: string; onClick: () => void; children: React.ReactNode }> = ({ tip, onClick, children }) => (
  <div
    data-tooltip-id="tooltip"
    data-tooltip-content={tip}
    onClick={onClick}
    className="select-none cursor-pointer rounded-[6px] min-w-[30px] h-[30px] px-[6px] bg-newColColor flex justify-center items-center text-[12px] font-[600]"
  >
    {children}
  </div>
);

/** Extra toolbar buttons for rich mode. Prompts keep it simple and dependency-free. */
export const RichToolbar: FC<{ editor: any }> = ({ editor }) => {
  const run = useCallback((fn: (chain: any) => any) => () => editor && fn(editor.chain().focus()).run(), [editor]);
  const ask = (label: string, initial = '') => (typeof window === 'undefined' ? null : window.prompt(label, initial));
  if (!editor) return null;
  return (
    <>
      <Btn tip="Italic" onClick={run((c) => c.toggleItalic())}><i>I</i></Btn>
      <Btn tip="Numbered list" onClick={run((c) => c.toggleOrderedList())}>1.</Btn>
      <Btn tip="Heading 4" onClick={run((c) => c.toggleHeading({ level: 4 }))}>H4</Btn>
      <Btn tip="Quote" onClick={run((c) => c.toggleBlockquote())}>&ldquo;</Btn>
      <Btn tip="Inline code" onClick={run((c) => c.toggleCode())}>{'<>'}</Btn>
      <Btn tip="Code block" onClick={run((c) => c.toggleCodeBlock())}>{'{ }'}</Btn>
      <Btn tip="Divider" onClick={run((c) => c.setHorizontalRule())}>&mdash;</Btn>
      <Btn
        tip="Image (URL)"
        onClick={() => {
          const src = ask('Image URL (upload it in Insert Media first, then copy its link)');
          if (!src) return;
          const alt = ask('Alt text (what the image shows)') ?? '';
          editor.chain().focus().setImage({ src, alt }).run();
        }}
      >
        IMG
      </Btn>
      <Btn
        tip="YouTube video"
        onClick={() => {
          const src = ask('YouTube link');
          if (src) editor.chain().focus().setYoutubeVideo({ src }).run();
        }}
      >
        YT
      </Btn>
      <Btn tip="Table (3x3)" onClick={run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }))}>TBL</Btn>
      <Btn
        tip="HTML block (diagram, SVG figure, embed). Select one first to edit it"
        onClick={() => {
          const selected = editor.state.selection?.node;
          const current = selected?.type?.name === 'htmlBlock' ? selected.attrs.html : '';
          const html = ask('HTML (e.g. a <figure> with an inline <svg> diagram)', current);
          if (html === null) return;
          if (current) {
            editor.chain().focus().updateAttributes('htmlBlock', { html }).run();
          } else {
            editor.chain().focus().insertContent({ type: 'htmlBlock', attrs: { html } }).run();
          }
        }}
      >
        HTML
      </Btn>
    </>
  );
};
