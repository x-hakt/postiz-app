// x-hakt (PLN-43): calendar status colours and site colours.
import {
  calendarStatus,
  isHiddenByDefault,
  siteColor,
  siteKey,
} from '@gitroom/helpers/utils/x-hakt.calendar.status';

const post = (state: string, ...tags: string[]) => ({
  state,
  tags: tags.map((name) => ({ tag: { name } })),
});

describe('x-hakt calendar status', () => {
  it('colours by state first', () => {
    expect(calendarStatus(post('QUEUE'))).toBe('scheduled');
    expect(calendarStatus(post('PUBLISHED'))).toBe('posted');
    expect(calendarStatus(post('ERROR'))).toBe('attention');
    expect(calendarStatus(post('ERROR', 'Done'))).toBe('attention');
    expect(calendarStatus(post('QUEUE', 'Write', 'Ready'))).toBe('scheduled');
  });

  it('untagged drafts and Ready cards need attention', () => {
    expect(calendarStatus(post('DRAFT'))).toBe('attention');
    expect(calendarStatus(post('DRAFT', 'Write', 'Ready'))).toBe('attention');
    expect(calendarStatus(post('DRAFT', 'Someone else'))).toBe('attention');
  });

  it('cards still in the pipeline are Topic', () => {
    expect(calendarStatus(post('DRAFT', 'Topic'))).toBe('topic');
    expect(calendarStatus(post('DRAFT', 'Topic', 'Write'))).toBe('topic');
    expect(calendarStatus(post('DRAFT', 'write'))).toBe('topic');
    expect(calendarStatus(post('DRAFT', 'Write', 'Ready', 'Revise'))).toBe('topic');
  });

  it('Done and Skip drafts are hidden', () => {
    expect(calendarStatus(post('DRAFT', 'Write', 'Ready', 'Done'))).toBe('done');
    expect(calendarStatus(post('DRAFT', 'Topic', 'Skip'))).toBe('done');
    expect(isHiddenByDefault(post('DRAFT', 'Done'))).toBe(true);
    expect(isHiddenByDefault(post('DRAFT', 'Ready'))).toBe(false);
  });

  it('gives each site a stable colour', () => {
    expect(siteKey('cgburchell.com')).toBe('cgburchell');
    expect(siteKey('x-hakt')).toBe('xhakt');
    expect(siteColor('Playtopia')).toBe(siteColor('playtopia'));
    expect(siteColor('x-hakt')).not.toBe(siteColor('Playtopia'));
    expect(siteColor('Some New Site')).toMatch(/^#[0-9a-f]{6}$/);
  });
});
