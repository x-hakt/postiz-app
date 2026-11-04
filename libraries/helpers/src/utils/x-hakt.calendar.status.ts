// x-hakt (PLN-43): calendar cards are coloured by what they need from the operator, not by
// their first tag. Four colours: Topic (a planner card still in the pipeline), Scheduled,
// Posted, and Attention (everything else that is still a draft, plus failed posts). Cards
// tagged Done or Skip are spent and hidden unless "Show done" is on. Each site also gets
// its own colour for the card's edge, so channels with the same avatar are easy to tell apart.

export type CalendarStatus = 'topic' | 'attention' | 'scheduled' | 'posted' | 'done';

type StatusPost = {
  state?: string | null;
  tags?: { tag?: { name?: string | null } | null }[] | null;
};

const tagNames = (post: StatusPost) =>
  (post.tags || []).map((t) => String(t?.tag?.name || '').trim().toLowerCase());

export function calendarStatus(post: StatusPost): CalendarStatus {
  const state = String(post.state || '').toUpperCase();
  if (state === 'ERROR') return 'attention';
  if (state === 'PUBLISHED') return 'posted';
  if (state === 'QUEUE') return 'scheduled';
  const tags = tagNames(post);
  if (tags.includes('done') || tags.includes('skip')) return 'done';
  // The planner's card precedence: Revise beats Ready (the agent is reworking it).
  if (tags.includes('revise')) return 'topic';
  if (tags.includes('ready')) return 'attention';
  if (tags.includes('topic') || tags.includes('write')) return 'topic';
  return 'attention';
}

export const isHiddenByDefault = (post: StatusPost) => calendarStatus(post) === 'done';

export const CALENDAR_STATUS_STYLE: Record<
  CalendarStatus,
  { label: string; color: string }
> = {
  topic: { label: 'Topic', color: '#2563eb' },
  scheduled: { label: 'Scheduled', color: '#0d9488' },
  posted: { label: 'Posted', color: '#6b7280' },
  attention: { label: 'Attention', color: '#dc2626' },
  done: { label: 'Done', color: '#9ca3af' },
};

// Kept clear of the status colours (blue, teal, grey, red).
const SITE_COLORS: Record<string, string> = {
  playtopia: '#f59e0b',
  xhakt: '#8b5cf6',
  cgburchell: '#84cc16',
  chrisburchell: '#ec4899',
};
const SPARE_COLORS = ['#f97316', '#d946ef', '#eab308', '#a3e635', '#fb7185', '#c084fc'];

export const siteKey = (name?: string | null) =>
  String(name || '')
    .toLowerCase()
    .replace(/\.(com|com\.au|net|org)$/, '')
    .replace(/[^a-z0-9]/g, '');

export function siteColor(name?: string | null): string {
  const key = siteKey(name);
  if (SITE_COLORS[key]) return SITE_COLORS[key];
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_COLORS[h % SPARE_COLORS.length];
}
