import {
  AuthTokenDetails,
  PostDetails,
  PostResponse,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SocialAbstract } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import dayjs from 'dayjs';
import { Integration } from '@prisma/client';
import { makeSecureId } from '@gitroom/nestjs-libraries/services/make.secure.id';
import { WordpressDto } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/wordpress.dto';
import slugify from 'slugify';
// import FormData from 'form-data';
import { Tool } from '@gitroom/nestjs-libraries/integrations/tool.decorator';
import { getSsrfSafeDispatcher } from '@gitroom/nestjs-libraries/dtos/webhooks/ssrf.safe.dispatcher';
import { string } from 'yup';

export class WordpressProvider
  extends SocialAbstract
  implements SocialProvider
{
  identifier = 'wordpress';
  name = 'WordPress';
  isBetweenSteps = false;
  // x-hakt (PLN-25): long-form, kept as sanitised HTML (images, code, tables, SVG figures, YouTube)
  editor = 'rich' as const;
  scopes = [] as string[];
  override maxConcurrentJob = 5; // WordPress self-hosted typically has generous limits
  dto = WordpressDto;
  maxLength() {
    return 100000;
  }

  async generateAuthUrl() {
    const state = makeSecureId(6);
    return {
      url: state,
      codeVerifier: makeSecureId(10),
      state,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthTokenDetails> {
    return {
      refreshToken: '',
      expiresIn: 0,
      accessToken: '',
      id: '',
      name: '',
      picture: '',
      username: '',
    };
  }
  override handleErrors(
    body: string
  ):
    | { type: 'refresh-token' | 'bad-body' | 'retry'; value: string }
    | undefined {
    if (body.indexOf('rest_cannot_create') > -1) {
      return {
        type: 'bad-body',
        value: 'The connect user has insufficient permissions to create posts',
      };
    }
    return undefined;
  }

  async customFields() {
    return [
      {
        key: 'domain',
        label: 'Domain URL',
        validation: `/^https?:\\/\\/(?:www\\.)?[\\w\\-]+(\\.[\\w\\-]+)+([\\/?#][^\\s]*)?$/`,
        type: 'text' as const,
      },
      {
        key: 'username',
        label: 'Username',
        validation: `/.+/`,
        type: 'text' as const,
      },
      {
        key: 'password',
        label: 'Password',
        validation: `/.+/`,
        type: 'password' as const,
        hint: 'Application password, create in User->Profile',
      },
    ];
  }

  async authenticate(params: {
    code: string;
    codeVerifier: string;
    refresh?: string;
  }) {
    const body = JSON.parse(Buffer.from(params.code, 'base64').toString()) as {
      domain: string;
      username: string;
      password: string;
    };

    // Normalize the domain - users often paste it with surrounding whitespace
    // or a trailing slash, which would otherwise build `https://site.com//wp-json/...`.
    const domain = body.domain.trim().replace(/\/+$/, '');

    const auth = Buffer.from(`${body.username}:${body.password}`).toString(
      'base64'
    );

    // Direct fetch (not `this.fetch`) so we can branch on the HTTP status and
    // return a specific message instead of throwing a generic error.
    let response: Response;
    try {
      response = await fetch(`${domain}/wp-json/wp/v2/users/me`, {
        headers: {
          Authorization: `Basic ${auth}`,
        },
        // @ts-ignore - undici-only option; blocks SSRF to internal IPs
        dispatcher: getSsrfSafeDispatcher(),
      });
    } catch (err) {
      // DNS failure, connection refused, TLS error, site unreachable, etc.
      console.log(err);
      return 'Could not reach your WordPress site. Check the Domain URL and that the site is publicly accessible.';
    }

    // A security plugin (e.g. Wordfence), a WAF, or the server config commonly
    // strips the Authorization header or locks down the REST API. We don't try
    // to work around that - surface a distinct, actionable message instead.
    if (!response.ok) {
      // Log what WordPress actually returned (REST errors carry a `code` and
      // `message`) so failures can be diagnosed without guessing.
      const errorBody = await response.text().catch(() => '');
      let wpCode = '';
      let wpMessage = '';
      try {
        const parsed = JSON.parse(errorBody);
        wpCode = parsed?.code || '';
        wpMessage = parsed?.message || '';
      } catch (err) {
        // Non-JSON error body (e.g. an HTML page from a security plugin).
      }
      console.log(
        `WordPress auth failed for ${domain} (HTTP ${response.status})`,
        JSON.stringify({
          code: wpCode,
          message: wpMessage,
          ...(wpCode ? {} : { body: errorBody.slice(0, 500) }),
        })
      );

      if (response.status === 401 || response.status === 403) {
        return 'WordPress rejected the login. A security plugin or server setting may be blocking the REST API or stripping the Authorization header, or the username / Application Password is incorrect.';
      }

      return `WordPress returned an unexpected error (HTTP ${response.status}). Make sure the REST API is enabled and Application Passwords are available.`;
    }

    // Even on a 200, a security plugin / maintenance page can return HTML
    // instead of JSON, which would otherwise throw on `.json()`.
    let data: any;
    try {
      data = await response.json();
    } catch (err) {
      console.log(err);
      return 'WordPress did not return a valid response. The REST API may be disabled or blocked by a security plugin.';
    }

    const { id, name, avatar_urls, code } = data || {};

    if (code) {
      return 'Invalid credentials';
    }

    const biggestImage = Object.entries(avatar_urls || {}).reduce(
      (all, current) => {
        if (all > Number(current[0])) {
          return all;
        }
        return Number(current[0]);
      },
      0
    );

    return {
      refreshToken: '',
      expiresIn: dayjs().add(100, 'years').unix() - dayjs().unix(),
      accessToken: params.code,
      id: body.domain + '_' + id,
      name,
      picture: avatar_urls?.[String(biggestImage)] || '',
      username: body.username,
    };
  }

  // Custom provider functions below are invoked from the backend HTTP endpoint
  // (`/integrations/function`) - which is NOT a Temporal activity - so they must
  // use a plain `fetch` (with the SSRF guard) rather than `this.fetch`, which
  // calls `Context.current()` and throws outside an activity. This mirrors how
  // `authenticate` issues its request.
  private async wpGet(token: string, path: string) {
    const body = JSON.parse(Buffer.from(token, 'base64').toString()) as {
      domain: string;
      username: string;
      password: string;
    };

    const auth = Buffer.from(`${body.username}:${body.password}`).toString(
      'base64'
    );

    const response = await fetch(`${body.domain}${path}`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
      // @ts-ignore - undici-only option; blocks SSRF to internal IPs
      dispatcher: getSsrfSafeDispatcher(),
    });

    return response.json();
  }

  @Tool({
    description: 'Get list of post types',
    dataSchema: [],
  })
  async postTypes(token: string) {
    const postTypes = await this.wpGet(token, '/wp-json/wp/v2/types');

    return Object.entries<any>(postTypes).reduce((all, [key, value]) => {
      if (
        key.indexOf('wp_') > -1 ||
        key.indexOf('nav_') > -1 ||
        key === 'attachment'
      ) {
        return all;
      }

      all.push({
        id: value.rest_base,
        name: value.name,
      });

      return all;
    }, []);
  }

  @Tool({
    description: 'Get list of categories',
    dataSchema: [],
  })
  async categoriesList(token: string) {
    const categories = await this.wpGet(
      token,
      '/wp-json/wp/v2/categories?per_page=100'
    );

    return (Array.isArray(categories) ? categories : []).map(
      (category: any) => ({
        id: category.id,
        name: category.name,
      })
    );
  }

  @Tool({
    description: 'Get list of tags',
    dataSchema: [],
  })
  async tagsList(token: string) {
    const tags = await this.wpGet(token, '/wp-json/wp/v2/tags?per_page=100');

    return (Array.isArray(tags) ? tags : []).map((tag: any) => ({
      id: tag.id,
      name: tag.name,
    }));
  }

  // x-hakt (PLN-25): ask the site to render a draft exactly as it will publish it, for the
  // editor's Site preview. The site answers POST /wp-json/wp/v2/preview with { html } (a whole
  // page); plain WordPress has no such route, so a 404 just means "no site preview here".
  // Called through /integrations/function, not a Temporal activity, so plain fetch + SSRF guard.
  async sitePreview(
    token: string,
    data: { title?: string; content?: string; type?: string; categories?: number[]; tags?: number[] }
  ) {
    const body = JSON.parse(Buffer.from(token, 'base64').toString()) as {
      domain: string;
      username: string;
      password: string;
    };
    const domain = body.domain.trim().replace(/\/+$/, '');
    const auth = Buffer.from(`${body.username}:${body.password}`).toString('base64');
    try {
      const response = await fetch(`${domain}/wp-json/wp/v2/preview`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: data?.title || '',
          content: data?.content || '',
          type: data?.type || '',
          categories: data?.categories || [],
          tags: data?.tags || [],
        }),
        // @ts-ignore - undici-only option; blocks SSRF to internal IPs
        dispatcher: getSsrfSafeDispatcher(),
      });
      if (response.status === 404) {
        return { available: false };
      }
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { available: true, error: json?.message || `Preview failed (HTTP ${response.status})` };
      }
      // Either a whole page (html) or a short-lived preview url on the site itself (for sites
      // whose pages are rendered by JavaScript).
      const url = typeof json?.url === 'string' && /^https:\/\//.test(json.url) ? json.url : undefined;
      return { available: true, html: url ? undefined : String(json?.html || ''), url };
    } catch (err) {
      return { available: true, error: 'Could not reach the site for a preview.' };
    }
  }

  // x-hakt: images in a rich article (pasted or uploaded in the editor, so they live in Postiz's
  // media library, or pasted from another website) are copied onto the site through its media
  // endpoint, as the featured image is, and the article points at the site's copy: nothing is
  // hotlinked. Images already on the site (same domain or a subdomain of it) are left alone. An
  // image that can't be copied keeps its original address rather than failing the post.
  private async imagesToSite(content: string, domain: string, auth: string) {
    const siteHost = new URL(domain).hostname.replace(/^www\./, '');
    const own = `${process.env.FRONTEND_URL}/uploads/`;
    const sources = [
      ...new Set(
        [...content.matchAll(/<img\b[^>]*?\bsrc="(https:\/\/[^"]+)"/gi)].map((m) => m[1])
      ),
    ].filter((src) => {
      const host = new URL(src.replace(/&amp;/g, '&')).hostname;
      return host !== siteHost && !host.endsWith(`.${siteHost}`);
    });
    let out = content;
    for (const src of sources.slice(0, 30)) {
      try {
        const url = src.replace(/&amp;/g, '&');
        // undici-only option; blocks SSRF to internal IPs for images from other websites
        const options: any = url.startsWith(own) ? {} : { dispatcher: getSsrfSafeDispatcher() };
        const image = await fetch(url, options);
        const type = (image.headers.get('content-type') || '').split(';')[0];
        if (!image.ok || !type.startsWith('image/')) {
          throw new Error(`HTTP ${image.status} ${type}`);
        }
        const media = await (
          await fetch(`${domain}/wp-json/wp/v2/media`, {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Disposition': `attachment; filename="${(url.split('/').pop() || 'image').split('?')[0].replace(/[^\w.-]+/g, '-')}"`,
              'Content-Type': type,
            },
            body: Buffer.from(await image.arrayBuffer()),
          })
        ).json();
        if (typeof media?.source_url === 'string') {
          out = out.split(`src="${src}"`).join(`src="${media.source_url}"`);
        }
      } catch (err) {
        console.log('WordPress: kept an article image at its original address', src, String(err));
      }
    }
    return out;
  }

  async post(
    id: string,
    accessToken: string,
    postDetails: PostDetails<WordpressDto>[],
    integration: Integration
  ): Promise<PostResponse[]> {
    const body = JSON.parse(Buffer.from(accessToken, 'base64').toString()) as {
      domain: string;
      username: string;
      password: string;
    };

    const auth = Buffer.from(`${body.username}:${body.password}`).toString(
      'base64'
    );

    let mediaId = '';
    if (postDetails?.[0]?.settings?.main_image?.path) {
      console.log(
        'Uploading image to WordPress',
        postDetails[0].settings.main_image.path
      );

      const blob = await this.fetch(
        postDetails[0].settings.main_image.path
      ).then((r) => r.blob());

      const mediaResponse = await (
        await this.fetch(`${body.domain}/wp-json/wp/v2/media`, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Disposition': `attachment; filename="${postDetails[0].settings.main_image.path
              .split('/')
              .pop()}"`,
            'Content-Type': blob.type,
          },
          body: blob,
        })
      ).json();

      mediaId = mediaResponse.id;
    }

    const content = await this.imagesToSite(
      postDetails?.[0]?.message || '',
      body.domain,
      auth
    );

    const categories = (postDetails?.[0]?.settings?.categories || [])
      .map((category) => Number(category))
      .filter((category) => !isNaN(category));
    const tags = (postDetails?.[0]?.settings?.tags || [])
      .map((tag) => Number(tag))
      .filter((tag) => !isNaN(tag));

    const submit = await (
      await this.fetch(
        `${body.domain}/wp-json/wp/v2/${postDetails?.[0]?.settings?.type}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify({
            title: postDetails?.[0]?.settings?.title,
            content,
            slug: slugify(postDetails?.[0]?.settings?.title, {
              lower: true,
              strict: true,
              trim: true,
            }),
            status: postDetails?.[0]?.settings?.status || 'publish',
            ...(categories.length ? { categories } : {}),
            ...(tags.length ? { tags } : {}),
            ...(mediaId ? { featured_media: mediaId } : {}),
          }),
        }
      )
    ).json();

    return [
      {
        id: postDetails?.[0].id,
        status: 'completed',
        postId: String(submit.id),
        releaseURL: submit.link,
      },
    ];
  }
}
