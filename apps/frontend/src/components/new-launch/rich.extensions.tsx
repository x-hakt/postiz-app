'use client';

// x-hakt (PLN-25): the long-form ("rich") editor used by WordPress channels. The stock editor
// only knows paragraphs, h1-h3, bold, underline, bullet lists and links, which is fine for social
// posts and useless for articles. Rich mode adds italic, numbered lists, h4, inline code, code
// blocks, quotes, rules, line breaks, images, YouTube embeds, tables, and an HTML block that keeps
// figures with inline SVG diagrams (or any other embed) verbatim and renders them live. Social
// channels never load any of this.

import { FC, useCallback, useRef } from 'react';
import { Node, Mark } from '@tiptap/react';
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

// x-hakt (2026-10-06): image captions and the credits small print, editable as text in rich mode.
// The operator couldn't caption an image or change an article's photo credits: an image <figure>
// and the credits block (<div data-html-block><p><small>...</small></p></div>) both parsed as an
// HtmlBlock, editable only through a prompt holding the raw markup. Now an image figure is the
// picture with an ordinary editable caption under it, and the credits line is ordinary text. Both
// save back to exactly the markup the sites already render. Figures holding anything else (SVG
// diagrams, embeds) and any other HTML block stay HtmlBlocks.

/** The small-print style the planner's articles use for photo credits and notices. */
export const SMALL_PRINT_STYLE = 'font-size:0.75rem;line-height:1.5;opacity:0.75';

/** A <figure> that is one image plus, at most, a caption. */
export const isImageFigure = (figure: Element) => {
  const kids = Array.from(figure.children);
  return kids.filter((k) => k.tagName === 'IMG').length === 1 && kids.every((k) => k.tagName === 'IMG' || k.tagName === 'FIGCAPTION');
};

/** <figure><img src alt><figcaption>editable caption</figcaption></figure> */
export const ImageFigure = Node.create({
  name: 'imageFigure',
  group: 'block',
  content: 'inline*',
  draggable: true,
  isolating: true,
  defining: true,
  addAttributes() {
    return { src: { default: '' }, alt: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'figure',
        priority: 65, // ahead of HtmlBlock's figure rule (60)
        getAttrs: (el) => {
          const figure = el as HTMLElement;
          if (!isImageFigure(figure)) return false;
          const img = figure.querySelector('img') as HTMLImageElement;
          return { src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' };
        },
        contentElement: (dom: HTMLElement) => dom.querySelector('figcaption') || dom.ownerDocument.createElement('figcaption'),
      },
      {
        // An image figure the planner wrapped in an HTML block: unwrap it so it can be captioned too.
        tag: 'div[data-html-block]',
        priority: 76, // ahead of SmallPrint (75) and HtmlBlock (70)
        getAttrs: (el) => {
          const div = el as HTMLElement;
          const only = div.children.length === 1 && div.children[0].tagName === 'FIGURE' ? div.children[0] : null;
          if (!only || !isImageFigure(only) || div.textContent?.trim() !== only.textContent?.trim()) return false;
          const img = only.querySelector('img') as HTMLImageElement;
          return { src: img.getAttribute('src') || '', alt: img.getAttribute('alt') || '' };
        },
        contentElement: (dom: HTMLElement) => dom.querySelector('figcaption') || dom.ownerDocument.createElement('figcaption'),
      },
    ];
  },
  renderHTML({ node }) {
    return ['figure', ['img', { src: node.attrs.src, alt: node.attrs.alt }], ['figcaption', 0]];
  },
});

/** <div data-html-block><p><small style>editable text</small></p></div>: photo credits, notices. */
export const SmallPrint = Node.create({
  name: 'smallPrint',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return { style: { default: SMALL_PRINT_STYLE } };
  },
  parseHTML() {
    return [
      {
        tag: 'div[data-html-block]',
        priority: 75, // ahead of HtmlBlock's (70); anything that isn't one <p><small> falls through to it
        getAttrs: (el) => {
          const div = el as HTMLElement;
          const p = div.children.length === 1 ? div.children[0] : null;
          if (!p || p.tagName !== 'P' || p.children.length !== 1 || p.childNodes.length !== 1) return false;
          const small = p.children[0];
          if (small.tagName !== 'SMALL') return false;
          return { style: small.getAttribute('style') || SMALL_PRINT_STYLE };
        },
        contentElement: (dom: HTMLElement) => dom.querySelector('small') as HTMLElement,
      },
    ];
  },
  renderHTML({ node }) {
    return ['div', { 'data-html-block': '' }, ['p', ['small', { style: node.attrs.style }, 0]]];
  },
});

/** A glossary hover (x-hakt <Term>): <span data-term="ssh" [data-term-def="..."]>SSH</span>.
 *  Kept as a mark so editing the draft in Postiz never drops it. */
export const GlossaryTerm = Mark.create({
  name: 'glossaryTerm',
  inclusive: false,
  addAttributes() {
    return {
      term: { default: '', parseHTML: (el) => el.getAttribute('data-term') || '', renderHTML: (a) => ({ 'data-term': a.term }) },
      def: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-term-def') || '',
        renderHTML: (a) => (a.def ? { 'data-term-def': a.def } : {}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-term]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', { ...HTMLAttributes, style: 'text-decoration: underline dotted; text-underline-offset: 3px', title: HTMLAttributes['data-term-def'] || `glossary: ${HTMLAttributes['data-term']}` }, 0];
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
  ImageFigure,
  SmallPrint,
  GlossaryTerm,
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

/** An image figure node with its caption as text. */
export const figure = (src: string, alt: string, caption = '') => ({
  type: 'imageFigure',
  attrs: { src, alt },
  content: caption.trim() ? [{ type: 'text', text: caption.trim() }] : [],
});

/** Extra toolbar buttons for rich mode. Prompts keep it simple and dependency-free. */
export const RichToolbar: FC<{ editor: any; onPickImages?: (files: File[]) => boolean }> = ({
  editor,
  onPickImages,
}) => {
  const run = useCallback((fn: (chain: any) => any) => () => editor && fn(editor.chain().focus()).run(), [editor]);
  const picker = useRef<HTMLInputElement>(null);
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
      {onPickImages && (
        <>
          <Btn tip="Upload an image into the article (or paste / drop one)" onClick={() => picker.current?.click()}>
            + IMG
          </Btn>
          <input
            ref={picker}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              onPickImages(Array.from(event.target.files || []));
              event.target.value = '';
            }}
          />
        </>
      )}
      <Btn
        tip="Image (URL)"
        onClick={() => {
          const src = ask('Image URL (upload it in Insert Media first, then copy its link)');
          if (!src) return;
          const alt = ask('Alt text (what the image shows)') ?? '';
          const caption = ask('Caption (who, where, when; leave empty for none)') ?? '';
          editor.chain().focus().insertContent(figure(src, alt, caption)).run();
        }}
      >
        IMG
      </Btn>
      <Btn
        tip="Caption: click an image first. A captioned image's caption is typed straight under it"
        onClick={() => {
          const sel = editor.state.selection;
          const node = sel?.node;
          if (node?.type?.name === 'image') {
            const caption = ask('Caption (who, where, when)') ?? '';
            editor.chain().focus().insertContentAt({ from: sel.from, to: sel.to }, figure(node.attrs.src, node.attrs.alt || '', caption)).run();
          } else if (editor.isActive('imageFigure')) {
            const current = (node?.type?.name === 'imageFigure' ? node : sel.$from.parent)?.textContent ?? '';
            const caption = ask('Caption (who, where, when). Empty removes it', current);
            if (caption === null) return;
            const pos = node?.type?.name === 'imageFigure' ? sel.from : sel.$from.before();
            const fig = editor.state.doc.nodeAt(pos);
            if (fig) editor.chain().focus().insertContentAt({ from: pos, to: pos + fig.nodeSize }, figure(fig.attrs.src, fig.attrs.alt, caption)).run();
          } else if (typeof window !== 'undefined') {
            window.alert('Click an image first, then CAP.');
          }
        }}
      >
        CAP
      </Btn>
      <Btn
        tip="Alt text: click an image first (what the image shows, for screen readers)"
        onClick={() => {
          const sel = editor.state.selection;
          const type = sel?.node?.type?.name === 'image' ? 'image' : editor.isActive('imageFigure') ? 'imageFigure' : '';
          if (!type) {
            if (typeof window !== 'undefined') window.alert('Click an image first, then ALT.');
            return;
          }
          const alt = ask('Alt text (what the image shows)', editor.getAttributes(type)?.alt || '');
          if (alt !== null) editor.chain().focus().updateAttributes(type, { alt }).run();
        }}
      >
        ALT
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
      <Btn
        tip="Glossary hover: select a word first (x-hakt: a key from its glossary, or a new key plus a definition)"
        onClick={() => {
          const current = editor.getAttributes('glossaryTerm');
          const term = ask('Glossary key (e.g. ssh, pg-dump). Empty removes it', current?.term || '');
          if (term === null) return;
          if (!term.trim()) { editor.chain().focus().unsetMark('glossaryTerm').run(); return; }
          const def = ask('Definition (only needed for a word the site glossary does not have yet)', current?.def || '') ?? '';
          editor.chain().focus().setMark('glossaryTerm', { term: term.trim().toLowerCase(), def: def.trim() }).run();
        }}
      >
        TERM
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
