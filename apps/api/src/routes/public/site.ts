import { Article, Career, Course, Event, News, Page, Redirect, SiteSettings, Template } from '@itti/db';
import type { ContentType } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { notFound } from '../../lib/http';
import type { AppEnv } from '../../types';

const live = { status: 'published', deletedAt: null } as const;
const normalize = (p: string) => {
  let out = decodeURIComponent(p.split('?')[0] ?? '/').replace(/\/+$/, '');
  if (!out.startsWith('/')) out = '/' + out;
  return out || '/';
};

async function theme() {
  const s = await SiteSettings.findOne({ key: 'site' }, 'value.theme').lean();
  return ((s?.value as { theme?: Record<string, string> } | undefined)?.theme ?? {}) as Record<string, string | undefined>;
}
const TEMPLATE_FIELDS = 'slug kind title layout wpId contentType';
const templateBySlug = (slug?: string | null) =>
  slug ? Template.findOne({ slug, status: 'published', deletedAt: null }, TEMPLATE_FIELDS).lean() : null;

/**
 * Template for a content record: the one it picked (if it belongs to this content
 * type), else the type's default content template, else a legacy theme template.
 */
async function contentTemplate(type: ContentType, picked?: string | null, legacy?: string | null) {
  const own = picked
    ? await Template.findOne({ slug: picked, contentType: type, status: 'published', deletedAt: null }, TEMPLATE_FIELDS).lean()
    : null;
  return (
    own ??
    (await Template.findOne({ contentType: type, isDefault: true, status: 'published', deletedAt: null }, TEMPLATE_FIELDS).lean()) ??
    (await templateBySlug(legacy))
  );
}

/** Content types that live under a fixed URL prefix and are found by slug. */
const PREFIXED = [
  { prefix: '/events/', type: 'event' as const, model: Event },
  { prefix: '/careers/', type: 'career' as const, model: Career },
];

/**
 * Public routing + rendering data for the website:
 *   /resolve?path=/about   → which record lives at a URL (+ the template that renders it)
 *   /templates/...         → header, footer, popups, loop items, embedded sections
 *   /list/:type            → items for posts / loop-grid widgets
 */
export const siteRoutes = new Hono<AppEnv>()
  .get('/resolve', zValidator('query', z.object({ path: z.string().default('/') })), async (c) => {
    const path = normalize(c.req.valid('query').path);
    const page = await Page.findOne({ path, ...live }).lean();
    if (page) return c.json({ kind: 'page', record: page });

    const t = await theme();
    const course = await Course.findOne({ path, ...live }).lean();
    if (course) return c.json({ kind: 'course', record: course, template: await contentTemplate('course', course.template, t.defaultCourseTemplate) });

    const news = await News.findOne({ path, ...live }).lean();
    if (news) return c.json({ kind: 'news', record: news, template: await contentTemplate('news', news.template, t.singlePost) });

    const article = await Article.findOne({ path, ...live }).lean();
    if (article) return c.json({ kind: 'article', record: article, template: await contentTemplate('article', article.template) });

    for (const { prefix, type, model } of PREFIXED) {
      if (!path.startsWith(prefix)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const record = await (model as any).findOne({ slug: path.slice(prefix.length), ...live }).lean();
      if (record) return c.json({ kind: type, record: { ...record, path }, template: await contentTemplate(type, record.template) });
    }

    const redirect = await Redirect.findOne({ from: path, deletedAt: null }).lean();
    if (redirect) {
      await Redirect.updateOne({ _id: redirect._id }, { $inc: { hits: 1 } });
      return c.json({ kind: 'redirect', to: redirect.to, code: redirect.code });
    }
    throw notFound('Page');
  })

  .get('/templates/wp/:id', async (c) => {
    const t = await Template.findOne({ wpId: Number(c.req.param('id')), deletedAt: null }, 'slug kind title layout wpId').lean();
    if (!t) throw notFound('Template');
    return c.json(t);
  })
  .get('/templates/:slug', async (c) => {
    const t = await templateBySlug(c.req.param('slug'));
    if (!t) throw notFound('Template');
    return c.json(t);
  })

  .get(
    '/list/:type',
    zValidator(
      'query',
      z.object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
        category: z.string().optional(),
        exclude: z.string().optional(),
        sort: z.enum(['date', 'title', 'order']).default('date'),
      }),
    ),
    async (c) => {
      const { limit, category, exclude, sort } = c.req.valid('query');
      const type = c.req.param('type');
      const filter: Record<string, unknown> = { ...live, path: { $type: 'string' } };
      if (category) filter.categories = { $in: category.split(',') };
      if (exclude) filter.path = { $type: 'string', $nin: exclude.split(',') };
      const order: Record<string, 1 | -1> = sort === 'title' ? { title: 1 } : sort === 'order' ? { order: 1, title: 1 } : { publishedAt: -1, createdAt: -1 };
      const fields = 'title slug path excerpt summary cover publishedAt author fields categories updatedAt template start end location department deadline';
      const model = type === 'page' ? Page : type === 'news' || type === 'post' ? News : type === 'article' || type === 'student-article' ? Article : type === 'course' || type === 'itti-course' ? Course : type === 'event' ? Event : type === 'career' ? Career : null;
      if (!model) throw notFound('List type');
      // Events and careers have no stored path: they live at /events/<slug> and /careers/<slug>.
      const prefixed = PREFIXED.find((p) => p.model === model);
      if (prefixed) delete filter.path;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items = await (model as any).find(filter, fields).sort(prefixed && type === 'event' && sort === 'date' ? { start: 1 } : order).limit(limit).lean();
      return c.json(prefixed ? items.map((i: { slug: string }) => ({ ...i, path: `${prefixed.prefix}${i.slug}` })) : items);
    },
  );
