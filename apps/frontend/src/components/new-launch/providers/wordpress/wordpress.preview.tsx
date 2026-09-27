'use client';

// x-hakt (PLN-25): WordPress channels preview the post the way the SITE will render it: the
// site's own layout, fonts, spacing, images, diagrams and embeds. The provider's sitePreview
// asks the site's /wp-json/wp/v2/preview (via the backend and the channel's credentials) and
// gets back either a whole page (html) or a short-lived preview url. A site without that route
// falls back to a plain rendering of the post. The title is shown on top, because on WordPress
// channels it lives in the settings panel and is otherwise invisible while proofing.

import { FC, useEffect, useRef, useState } from 'react';
import { useIntegration } from '@gitroom/frontend/components/launches/helpers/use.integration';
import { useCustomProviderFunction } from '@gitroom/frontend/components/launches/helpers/use.custom.provider.function';
import { useSettings } from '@gitroom/frontend/components/launches/helpers/use.values';
import { sanitizeRichContent } from '@gitroom/helpers/utils/sanitize.post.content';

type Result = { available?: boolean; html?: string; url?: string; error?: string };

export const WordpressPreview: FC<{ maximumCharacters?: number }> = () => {
  const { value } = useIntegration();
  const customFunc = useCustomProviderFunction();
  const form = useSettings();
  const title: string = form?.watch?.('title') || '';
  const type: string = form?.watch?.('type') || '';
  const categories: number[] = form?.watch?.('categories') || [];
  const tags: number[] = form?.watch?.('tags') || [];
  const content = (value || []).map((p) => p.content).join('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r: Result = await customFunc.get('sitePreview', { title, content, type, categories, tags });
        if (mine === seq.current) setResult(r || { available: false });
      } catch {
        if (mine === seq.current) setResult({ available: true, error: 'Preview failed.' });
      } finally {
        if (mine === seq.current) setLoading(false);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [title, content, type, JSON.stringify(categories), JSON.stringify(tags)]);

  return (
    <div className="flex flex-col gap-[8px] w-full">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="text-[18px] font-[700] leading-tight">{title || <span className="opacity-60">No title yet (set it in Settings)</span>}</div>
        <div className="text-[12px] opacity-60 whitespace-nowrap">
          {loading ? 'Rendering…' : result?.html || result?.url ? 'Site preview' : ''}
          {result?.url && (
            <a className="ms-[8px] underline" href={result.url} target="_blank" rel="noreferrer">
              open
            </a>
          )}
        </div>
      </div>
      {result?.error && <div className="text-[13px] text-red-400">{result.error}</div>}
      {result?.html || result?.url ? (
        <iframe
          title="Site preview"
          className="w-full rounded-[8px] bg-white"
          style={{ height: '75vh', border: '1px solid rgba(127,127,127,.3)' }}
          // inline html: no scripts, no Postiz origin. A site url: the site's own scripts run,
          // isolated on the site's own origin (needed for JavaScript-rendered pages).
          sandbox={result.html ? 'allow-popups' : 'allow-scripts allow-same-origin allow-popups'}
          {...(result.html ? { srcDoc: result.html } : { src: result.url })}
        />
      ) : (
        !loading && (
          <div
            className="prose max-w-none text-[15px] leading-[1.6] [&_img]:max-w-full [&_svg]:max-w-full [&_pre]:overflow-auto"
            dangerouslySetInnerHTML={{ __html: sanitizeRichContent(content) }}
          />
        )
      )}
    </div>
  );
};
