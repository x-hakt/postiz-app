// x-hakt (PLN-25): long-form WordPress content survives saving and publishing, sanitised; the
// social providers keep their old behaviour; the site preview asks the site. No network.
import { sanitizeRichContent, sanitizePostContent, isAllowedEmbed } from '@gitroom/helpers/utils/sanitize.post.content';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { WordpressProvider } from './wordpress.provider';

const ARTICLE =
  '<h2>Why</h2><p>Text with <em>emphasis</em>, <code>/wp-json/wp/v2/&lt;type&gt;</code> and a <a href="https://x-hakt.com">link</a>.</p>' +
  '<ol><li>one</li><li>two</li></ol><blockquote><p>quoted</p></blockquote><pre><code>echo "{x}"</code></pre><hr>' +
  '<p><img src="https://x-hakt.com/media/a.png" alt="A diagram"></p>' +
  '<figure><svg viewBox="0 0 10 10" role="img" aria-label="box"><rect width="10" height="10" fill="#26cb96"></rect><text x="1" y="5">hi</text></svg><figcaption>Caption</figcaption></figure>' +
  '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>' +
  '<div data-youtube-video=""><iframe src="https://www.youtube-nocookie.com/embed/abc123" allowfullscreen="true"></iframe></div>';

describe('rich content (x-hakt PLN-25)', () => {
  it('keeps article markup, inline SVG figures, images, tables and YouTube', () => {
    const out = sanitizeRichContent(ARTICLE);
    for (const piece of ['<h2>Why</h2>', '<em>emphasis</em>', '<code>/wp-json/wp/v2/&lt;type&gt;</code>', '<ol>', '<blockquote>', '<pre><code>', '<hr>', 'alt="A diagram"', '<svg', '<rect', '<figcaption>Caption</figcaption>', '<table>', 'youtube-nocookie.com/embed/abc123']) {
      expect(out).toContain(piece);
    }
  });

  it('keeps every SVG attribute a diagram needs, not just the tags', () => {
    const figure =
      '<figure><svg viewBox="0 0 380 170" role="img" aria-label="chart"><g font-family="\'IBM Plex Mono\', monospace" font-size="7" fill="#87898d"><text x="30" y="24" text-anchor="end">100%</text></g>' +
      '<polyline points="40,81 60,81" fill="none" stroke="#26cb96" stroke-width="1.8"></polyline><rect x="10" y="20" width="84" height="40" rx="6" stroke-opacity="0.55"></rect>' +
      '<line x1="36" y1="50" x2="370" y2="50" stroke-dasharray="4 3"></line><path d="M94 40 H 116"></path></svg></figure>';
    const out = sanitizePostContent(figure);
    for (const attr of ['viewBox="0 0 380 170"', 'x="30"', 'y="24"', 'text-anchor="end"', 'font-size="7"', 'points="40,81 60,81"', 'stroke-width="1.8"', 'rx="6"', 'stroke-opacity="0.55"', 'x1="36"', 'stroke-dasharray="4 3"', 'd="M94 40 H 116"', 'aria-label="chart"']) {
      expect(out).toContain(attr);
    }
  });

  it('still refuses script URLs in links', () => {
    const out = sanitizePostContent('<a href="javascript:alert(1)">x</a><a href="vbscript:msgbox(1)">v</a><a href="https://ok.example/">ok</a><a href="tel:+61400000000">call</a>');
    expect(out).not.toContain('javascript:');
    expect(out).not.toContain('vbscript:');
    expect(out).toContain('href="https://ok.example/"');
    expect(out).toContain('href="tel:+61400000000"');
  });

  it('keeps glossary hover spans (data-term / data-term-def)', () => {
    const out = sanitizeRichContent('<p>Over <span data-term="ssh">SSH</span> and a <span data-term="lifeboat-drill" data-term-def="Restoring a backup to prove it opens.">drill</span>.</p>');
    expect(out).toContain('<span data-term="ssh">SSH</span>');
    expect(out).toContain('data-term-def="Restoring a backup to prove it opens."');
  });

  it('strips anything active, and embeds that are not YouTube', () => {
    const out = sanitizeRichContent(
      '<p onclick="x()">a</p><script>alert(1)</script><img src="x" onerror="y()"><a href="javascript:alert(1)">b</a>' +
      '<iframe src="https://evil.example/embed"></iframe><svg><script>alert(2)</script><foreignObject><p>x</p></foreignObject></svg><style>body{}</style>'
    );
    expect(out).not.toMatch(/onclick|onerror|<script|javascript:|evil\.example|foreignObject|<style/i);
    expect(isAllowedEmbed('https://www.youtube.com/embed/x')).toBe(true);
    expect(isAllowedEmbed('https://youtube.com.evil.example/embed/x')).toBe(false);
  });

  it('storing a post no longer drops long-form markup', () => {
    expect(sanitizePostContent('<p>a <code>b</code></p><ol><li>c</li></ol>')).toBe('<p>a <code>b</code></p><ol><li>c</li></ol>');
  });

  it("publishing in rich mode keeps the article whole and doesn't turn &lt;text&gt; into tags", () => {
    const out = stripHtmlValidation('rich', ARTICLE);
    expect(out).toContain('<code>/wp-json/wp/v2/&lt;type&gt;</code>');
    expect(out).not.toContain('<type>');
    expect(out).toContain('<svg');
    expect(out).toContain('<pre><code>');
  });

  it('the other html providers (x, telegram) behave exactly as before', () => {
    const out = stripHtmlValidation('html', '<p>a <em>b</em> <code>c</code></p><ol><li>d</li></ol>');
    // upstream behaviour, unchanged: ol/em/code dropped, li kept
    expect(out).toBe('<p>a b c</p><li>d</li>');
  });

  it('WordPress uses rich mode; sitePreview posts to the site and passes back html or an https url', async () => {
    const wp: any = new WordpressProvider();
    expect(wp.editor).toBe('rich');
    const token = Buffer.from(JSON.stringify({ domain: 'https://site.example/', username: 'planner', password: 'pw' })).toString('base64');
    const calls: any[] = [];
    const realFetch = global.fetch;
    const reply = (status: number, body: any) => ({ status, ok: status < 400, json: async () => body });
    try {
      (global as any).fetch = jest.fn(async (url: string, init: any) => { calls.push({ url, init }); return reply(200, { html: '<html>page</html>' }); });
      const r = await wp.sitePreview(token, { title: 'T', content: '<p>x</p>', type: 'notes' });
      expect(r).toEqual({ available: true, html: '<html>page</html>', url: undefined });
      expect(calls[0].url).toBe('https://site.example/wp-json/wp/v2/preview');
      expect(calls[0].init.method).toBe('POST');
      expect(calls[0].init.headers.Authorization).toBe('Basic ' + Buffer.from('planner:pw').toString('base64'));
      expect(JSON.parse(calls[0].init.body)).toMatchObject({ title: 'T', content: '<p>x</p>', type: 'notes' });

      (global as any).fetch = jest.fn(async () => reply(200, { url: 'https://site.example/preview/tok' }));
      expect(await wp.sitePreview(token, {})).toEqual({ available: true, html: undefined, url: 'https://site.example/preview/tok' });
      (global as any).fetch = jest.fn(async () => reply(200, { url: 'javascript:alert(1)' }));
      expect((await wp.sitePreview(token, {})).url).toBeUndefined();
      (global as any).fetch = jest.fn(async () => reply(404, {}));
      expect(await wp.sitePreview(token, {})).toEqual({ available: false });
    } finally {
      (global as any).fetch = realFetch;
    }
  });

  it("sends a review's star rating to the site as meta.rating, in previews and when publishing", async () => {
    const wp: any = new WordpressProvider();
    const token = Buffer.from(JSON.stringify({ domain: 'https://site.example', username: 'planner', password: 'pw' })).toString('base64');
    const realFetch = global.fetch;
    const bodies: any[] = [];
    try {
      (global as any).fetch = jest.fn(async (_url: string, init: any) => {
        bodies.push(JSON.parse(init.body));
        return { status: 200, ok: true, json: async () => ({ id: 7, link: 'https://site.example/news/x', html: '<html></html>' }) };
      });
      await wp.sitePreview(token, { title: 'T', content: '<p>x</p>', type: 'review', rating: '3.5' });
      await wp.sitePreview(token, { title: 'T', content: '<p>x</p>', type: 'article' });
      wp.fetch = (global as any).fetch;
      await wp.post('id', token, [{ id: 'p', message: '<p>body</p>', settings: { title: 'Golden Axe', type: 'review', rating: '3.5' } }], {});
      await wp.post('id', token, [{ id: 'p', message: '<p>body</p>', settings: { title: 'News item', type: 'article' } }], {});
      expect(bodies[0].meta).toEqual({ rating: 3.5 });
      expect(bodies[1].meta).toBeUndefined();
      expect(bodies[2].meta).toEqual({ rating: 3.5 });
      expect(bodies[3].meta).toBeUndefined();
    } finally {
      (global as any).fetch = realFetch;
    }
  });

  it('copies article images onto the site and points the article at the copies', async () => {
    const wp: any = new WordpressProvider();
    const realFetch = global.fetch;
    const realFrontend = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://planner.example';
    const uploads: any[] = [];
    try {
      (global as any).fetch = jest.fn(async (url: string, init: any) => {
        if (url === 'https://site.example/wp-json/wp/v2/media') {
          uploads.push(init);
          return { ok: true, status: 201, json: async () => ({ source_url: `https://api.site.example/uploads/copy-${uploads.length}.webp` }) };
        }
        if (url.includes('broken')) return { ok: false, status: 404, headers: new Map([['content-type', 'text/html']]) };
        return { ok: true, status: 200, headers: new Map([['content-type', 'image/png']]), arrayBuffer: async () => new ArrayBuffer(4) };
      });
      const html =
        '<p>a</p><img src="https://planner.example/uploads/2026/10/01/pasted.png" alt="">' +
        '<img src="https://other.example/pic.png?w=1&amp;h=2" alt="b">' +
        '<img src="https://api.site.example/uploads/already.webp" alt="c">' +
        '<img src="https://site.example/own.png" alt="d">' +
        '<img src="https://other.example/broken.png" alt="e">' +
        '<img src="https://planner.example/uploads/2026/10/01/pasted.png" alt="again">';
      const out = await wp.imagesToSite(html, 'https://site.example', 'auth');
      expect(uploads).toHaveLength(2);
      expect(uploads[0].headers.Authorization).toBe('Basic auth');
      expect(uploads[0].headers['Content-Type']).toBe('image/png');
      expect(out.match(/copy-1\.webp/g)).toHaveLength(2);
      expect(out).toContain('src="https://api.site.example/uploads/copy-2.webp" alt="b"');
      expect(out).toContain('src="https://api.site.example/uploads/already.webp"');
      expect(out).toContain('src="https://site.example/own.png"');
      expect(out).toContain('src="https://other.example/broken.png"');
      expect(out).not.toContain('planner.example');
    } finally {
      (global as any).fetch = realFetch;
      process.env.FRONTEND_URL = realFrontend;
    }
  });
});

// The LinkedIn providers import a Prisma type; the class is all this needs.
jest.mock('@prisma/client', () => ({}));

describe('LinkedIn personal profile (x-hakt PLN-24)', () => {
  it('asks only for what the self-serve LinkedIn products grant; company pages keep theirs', async () => {
    const { LinkedinProvider } = await import('./linkedin.provider');
    const { LinkedinPageProvider } = await import('./linkedin.page.provider');
    expect(new LinkedinProvider().scopes).toEqual(['openid', 'profile', 'w_member_social']);
    expect(new LinkedinPageProvider().scopes).toEqual(expect.arrayContaining(['rw_organization_admin', 'w_organization_social']));
  });
});
