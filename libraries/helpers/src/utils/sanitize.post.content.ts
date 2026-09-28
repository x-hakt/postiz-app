import DOMPurify from 'isomorphic-dompurify';

// x-hakt (PLN-25): post bodies are stored as sanitised HTML. The list used to be only what the
// social editors produce (p, strong, u, a, ul, li, h1-h3), which silently dropped everything a
// long-form (WordPress) article needs at save time. It now keeps rich article markup too:
// headings, lists, emphasis, code, quotes, rules, images, tables, figures with inline SVG
// diagrams, and YouTube embeds. Social providers are unaffected: each one still converts the
// stored HTML to its own format with stripHtmlValidation() when it publishes.

const RICH_TAGS = [
  'p', 'br', 'hr', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup', 'small',
  'a', 'code', 'pre', 'kbd', 'blockquote',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'img', 'figure', 'figcaption', 'picture', 'source',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'iframe',
];

const RICH_ATTR = [
  'href', 'target', 'rel', 'class', 'id', 'title', 'lang',
  'data-mention-id', 'data-mention-label',
  'data-html-block', 'data-youtube-video',
  'src', 'srcset', 'sizes', 'alt', 'width', 'height', 'loading',
  'colspan', 'rowspan', 'scope', 'start', 'reversed', 'type',
  'allow', 'allowfullscreen', 'frameborder',
];

// Only YouTube may be embedded; any other iframe is dropped with its contents.
export const isAllowedEmbed = (src: string | null | undefined) =>
  /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i.test(String(src ?? ''));

let hooked = false;
const hookOnce = () => {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName === 'iframe' && !isAllowedEmbed((node as Element).getAttribute?.('src'))) {
      node.parentNode?.removeChild(node);
    }
  });
};

/** Sanitised rich HTML: article markup, inline SVG, YouTube embeds; nothing active. */
export const sanitizeRichContent = (value: unknown): string => {
  if (typeof value !== 'string' || !value) {
    return '';
  }
  hookOnce();
  return DOMPurify.sanitize(value, {
    // html + svg profiles (svg keeps diagrams: shapes, text, gradients, markers)
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_TAGS: RICH_TAGS,
    ADD_ATTR: RICH_ATTR,
    FORBID_TAGS: ['script', 'style', 'form', 'input', 'button', 'textarea', 'select', 'option', 'object', 'embed', 'link', 'meta', 'base', 'foreignObject'],
    // DOMPurify checks every attribute it doesn't know to be URI-safe against this pattern, so
    // it must let plain values through (x="30", viewBox, points, font-size) while refusing any
    // scheme except http(s)/mailto/tel. A pattern that only allowed "https:" etc. at the start
    // stripped every SVG coordinate (PLN-23).
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
};

export const sanitizePostContent = (value: unknown): string => sanitizeRichContent(value);
