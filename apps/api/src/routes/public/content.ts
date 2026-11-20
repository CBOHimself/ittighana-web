import {
  Article,
  Career,
  Course,
  CourseCategory,
  Event,
  Form,
  GalleryAlbum,
  Page,
  Redirect,
  SiteSettings,
  Space,
  SpaceBooking,
} from '@itti/db';
import { paginationQuery } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { notFound } from '../../lib/http';
import { paginate } from '../../lib/paginate';
import type { AppEnv } from '../../types';

const live = { status: 'published', deletedAt: null } as const;
const listQuery = paginationQuery.extend({ category: z.string().optional() });

/** Public, read-only content API consumed by the Next.js site. */
export const contentRoutes = new Hono<AppEnv>()
  .get('/settings', async (c) => {
    const doc = await SiteSettings.findOne({ key: 'site' }).lean();
    return c.json(doc?.value ?? {});
  })

  .get('/redirects', async (c) => {
    const items = await Redirect.find({ deletedAt: null }, 'from to code').lean();
    return c.json(items);
  })

  .get('/pages/:slug', async (c) => {
    const page = await Page.findOne({ slug: c.req.param('slug'), ...live }).lean();
    if (!page) throw notFound('Page');
    return c.json(page);
  })

  /* Courses ------------------------------------------------------------ */
  .get('/course-categories', async (c) => {
    const categories = await CourseCategory.find({ deletedAt: null }).sort({ order: 1, name: 1 }).lean();
    const courses = await Course.find(live, 'title slug summary cover categoryId duration mode order')
      .sort({ order: 1, title: 1 })
      .lean();
    return c.json(
      categories.map((cat) => ({
        ...cat,
        courses: courses.filter((co) => String(co.categoryId) === String(cat._id)),
      })),
    );
  })
  .get('/courses', zValidator('query', listQuery), async (c) => {
    const { category, ...q } = c.req.valid('query');
    const filter: Record<string, unknown> = { ...live };
    if (category) {
      const cat = await CourseCategory.findOne({ slug: category, deletedAt: null }).lean();
      if (!cat) throw notFound('Category');
      filter.categoryId = cat._id;
    }
    if (q.q) filter.$text = { $search: q.q };
    return c.json(await paginate(Course, filter, q, { order: 1, title: 1 }, '-blocks'));
  })
  .get('/courses/:slug', async (c) => {
    const course = await Course.findOne({ slug: c.req.param('slug'), ...live })
      .populate('categoryId', 'name slug')
      .populate('formId', 'slug name status')
      .lean();
    if (!course) throw notFound('Course');
    return c.json(course);
  })

  /* Careers ------------------------------------------------------------ */
  .get('/careers', zValidator('query', paginationQuery), async (c) => {
    const q = c.req.valid('query');
    const filter = { ...live, $or: [{ deadline: null }, { deadline: { $gte: new Date() } }] };
    return c.json(await paginate(Career, filter, q, { createdAt: -1 }, '-blocks'));
  })
  .get('/careers/:slug', async (c) => {
    const career = await Career.findOne({ slug: c.req.param('slug'), ...live })
      .populate('formId', 'slug name status')
      .lean();
    if (!career) throw notFound('Career');
    return c.json(career);
  })

  /* Events ------------------------------------------------------------- */
  .get(
    '/events',
    zValidator('query', z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })),
    async (c) => {
      const { from, to } = c.req.valid('query');
      const filter: Record<string, unknown> = { ...live };
      if (from) filter.end = { $gte: from };
      if (to) filter.start = { $lte: to };
      const events = await Event.find(filter, '-blocks -gallery').sort({ start: 1 }).limit(500).lean();
      return c.json(events);
    },
  )
  .get('/events/:slug', async (c) => {
    const event = await Event.findOne({ slug: c.req.param('slug'), ...live })
      .populate('registrationFormId', 'slug name status')
      .lean();
    if (!event) throw notFound('Event');
    return c.json(event);
  })

  /* Campus ------------------------------------------------------------- */
  .get('/gallery', async (c) => {
    const albums = await GalleryAlbum.find(live).sort({ order: 1, takenAt: -1 }).lean();
    return c.json(albums.map(({ items, ...a }) => ({ ...a, count: items.length, preview: items.slice(0, 4) })));
  })
  .get('/gallery/:slug', async (c) => {
    const album = await GalleryAlbum.findOne({ slug: c.req.param('slug'), ...live }).lean();
    if (!album) throw notFound('Album');
    return c.json(album);
  })
  .get('/articles', zValidator('query', paginationQuery), async (c) => {
    const q = c.req.valid('query');
    const filter: Record<string, unknown> = { ...live };
    if (q.q) filter.$text = { $search: q.q };
    return c.json(await paginate(Article, filter, q, { publishedAt: -1 }, '-blocks'));
  })
  .get('/articles/:slug', async (c) => {
    const article = await Article.findOne({ slug: c.req.param('slug'), ...live }).lean();
    if (!article) throw notFound('Article');
    return c.json(article);
  })
  .get('/spaces', async (c) => {
    return c.json(await Space.find(live, '-blocks').sort({ name: 1 }).lean());
  })
  .get('/spaces/:slug', async (c) => {
    const space = await Space.findOne({ slug: c.req.param('slug'), ...live }).lean();
    if (!space) throw notFound('Space');
    return c.json(space);
  })
  .get(
    '/spaces/:slug/availability',
    zValidator('query', z.object({ from: z.coerce.date(), to: z.coerce.date() })),
    async (c) => {
      const { from, to } = c.req.valid('query');
      const space = await Space.findOne({ slug: c.req.param('slug'), ...live }, 'availability minBookingMinutes').lean();
      if (!space) throw notFound('Space');
      const busy = await SpaceBooking.find(
        { spaceId: space._id, status: { $in: ['approved', 'pending'] }, start: { $lt: to }, end: { $gt: from }, deletedAt: null },
        'start end status',
      ).lean();
      return c.json({ hours: space.availability, minBookingMinutes: space.minBookingMinutes, busy });
    },
  )

  /* Forms -------------------------------------------------------------- */
  .get('/forms', async (c) => {
    const forms = await Form.find({ status: 'published', kind: 'enrolment', deletedAt: null }, 'name slug description kind').sort({ name: 1 }).lean();
    return c.json(forms);
  })
  .get('/forms/:slug', async (c) => {
    const form = await Form.findOne({ slug: c.req.param('slug'), status: 'published', deletedAt: null }).lean();
    if (!form) throw notFound('Form');
    const s = (form.settings ?? {}) as { opensAt?: string; closesAt?: string; notifyEmails?: string[] };
    const now = Date.now();
    const open = (!s.opensAt || new Date(s.opensAt).getTime() <= now) && (!s.closesAt || new Date(s.closesAt).getTime() >= now);
    const { notifyEmails: _hidden, ...publicSettings } = s;
    return c.json({ ...form, settings: publicSettings, open });
  });
