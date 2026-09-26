// x-hakt patches (bosun-x PLN-20): Instagram post / reel / story as separate choices with
// share_to_feed, Meta's AI self-disclosure label, and Facebook Page Reels. Meta is never
// called: `fetch` is replaced and every request it would make is checked.
import { InstagramProvider } from './instagram.provider';
import { FacebookProvider } from './facebook.provider';

const json = (value: any) => ({ json: async () => value, text: async () => JSON.stringify(value), ok: true, status: 200 });

function stubFetch(provider: any, respond: (url: string, init: any) => any) {
  const calls: { url: string; init: any }[] = [];
  provider.fetch = jest.fn(async (url: string, init: any = {}) => {
    calls.push({ url, init });
    return json(respond(url, init));
  });
  return calls;
}

const post = (settings: any, media: string[], message = 'Caption here') => ({
  id: 'p1',
  message,
  settings,
  media: media.map((path) => ({ path, type: path.endsWith('.mp4') ? 'video' : 'image' })),
});

const integration: any = { internalId: 'page-1', profile: 'playtopia' };

describe('Instagram (x-hakt patches)', () => {
  it('a Reel is created as REELS with share_to_feed and the AI label', async () => {
    const ig: any = new InstagramProvider();
    const calls = stubFetch(ig, () => ({ id: 'container-1' }));
    const [res] = await ig.postPending('ig-1', 'token', [post({ post_type: 'reel', share_to_feed: false, is_ai_generated: true }, ['https://x/a.mp4'])], integration);
    const create = calls.find((c) => c.url.includes('/ig-1/media?'))!.url;
    expect(create).toContain('media_type=REELS');
    expect(create).toContain('share_to_feed=false');
    expect(create).toContain('is_ai_generated=true');
    expect(res.pendingData.isAiGenerated).toBe(true);
  });

  it('a Reel shares to the feed by default; a plain Post has no share_to_feed or AI label unless asked', async () => {
    const ig: any = new InstagramProvider();
    const calls = stubFetch(ig, () => ({ id: 'c' }));
    await ig.postPending('ig-1', 'token', [post({ post_type: 'reel' }, ['https://x/a.mp4'])], integration);
    expect(calls[0].url).toContain('share_to_feed=true');
    const plain = stubFetch(ig, () => ({ id: 'c' }));
    await ig.postPending('ig-1', 'token', [post({ post_type: 'post' }, ['https://x/a.jpg'])], integration);
    expect(plain[0].url).not.toContain('share_to_feed');
    expect(plain[0].url).not.toContain('is_ai_generated');
  });

  it('a carousel carries the AI label on the parent, not on its items', async () => {
    const ig: any = new InstagramProvider();
    const calls = stubFetch(ig, () => ({ id: 'item' }));
    const [res] = await ig.postPending('ig-1', 'token', [post({ post_type: 'post', is_ai_generated: 'true' }, ['https://x/1.jpg', 'https://x/2.jpg'])], integration);
    expect(calls.every((c) => !c.url.includes('is_ai_generated'))).toBe(true);
    expect(res.pendingData.postType).toBe('carousel');
    expect(res.pendingData.isAiGenerated).toBe(true);
  });

  it('each Story gets the AI label', async () => {
    const ig: any = new InstagramProvider();
    const calls = stubFetch(ig, () => ({ id: 's' }));
    await ig.postPending('ig-1', 'token', [post({ post_type: 'story', is_ai_generated: true }, ['https://x/1.jpg', 'https://x/2.mp4'])], integration);
    const creates = calls.filter((c) => c.url.includes('/ig-1/media?'));
    expect(creates).toHaveLength(2);
    expect(creates.every((c) => c.url.includes('media_type=STORIES') && c.url.includes('is_ai_generated=true'))).toBe(true);
  });

  it('a Reel must be exactly one video', async () => {
    const ig: any = new InstagramProvider();
    expect(await ig.checkValidity([[{ path: 'a.jpg' }]], { post_type: 'reel' })).toBe('A Reel must be a video');
    expect(await ig.checkValidity([[{ path: 'a.mp4' }, { path: 'b.mp4' }]], { post_type: 'reel' })).toBe('A Reel is exactly one video');
    expect(await ig.checkValidity([[{ path: 'a.mp4' }]], { post_type: 'reel' })).toBe(true);
  });
});

describe('Facebook Page Reels (x-hakt patch)', () => {
  it('uploads through video_reels, then publishes once with the caption after the arm/confirm handshake', async () => {
    const fb: any = new FacebookProvider();
    const calls = stubFetch(fb, (url) =>
      url.includes('upload_phase=start') ? { video_id: 'v1', upload_url: 'https://rupload.facebook.com/video-upload/v1' }
      : url.includes('upload_phase=finish') ? { success: true, post_id: 'page-1_99' }
      : { success: true });
    const [res] = await fb.postPending('page-1', 'tok', [post({ post_type: 'reel' }, ['https://x/r.mp4'], 'Game night reel')], integration);
    expect(calls[0].url).toContain('/page-1/video_reels?upload_phase=start');
    expect(calls[1].url).toBe('https://rupload.facebook.com/video-upload/v1');
    expect(calls[1].init.headers.file_url).toBe('https://x/r.mp4');
    expect(res.pendingData).toMatchObject({ postType: 'reel', items: [{ kind: 'video', mediaId: 'v1' }], message: 'Game night reel' });

    // arm, then (after checkPostStatus confirms) publish
    const armed = await fb.finalizePost('tok', res.pendingData, integration);
    expect(armed.status).toBe('pending');
    expect(calls.some((c) => c.url.includes('upload_phase=finish'))).toBe(false);
    const done = await fb.finalizePost('tok', { ...armed.pendingData, confirmed: true }, integration);
    const finish = calls.find((c) => c.url.includes('upload_phase=finish'))!.url;
    expect(finish).toContain('/page-1/video_reels?upload_phase=finish&video_id=v1&video_state=PUBLISHED');
    expect(finish).toContain('description=Game%20night%20reel');
    expect(done).toMatchObject({ status: 'completed', postId: 'page-1_99', releaseURL: 'https://www.facebook.com/reel/v1' });
  });

  it('a Page Reel must be exactly one video', async () => {
    const fb: any = new FacebookProvider();
    expect(await fb.checkValidity([[{ path: 'a.jpg' }]], { post_type: 'reel' })).toBe('A Reel must be a video');
    expect(await fb.checkValidity([[]], { post_type: 'reel' })).toBe('A Reel is exactly one video');
    expect(await fb.checkValidity([[{ path: 'a.mp4' }]], { post_type: 'reel' })).toBe(true);
  });
});
