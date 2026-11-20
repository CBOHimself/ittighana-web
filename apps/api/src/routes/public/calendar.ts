import { Event } from '@itti/db';
import { Hono } from 'hono';
import { env } from '../../env';
import { notFound } from '../../lib/http';
import { toIcs } from '../../lib/ics';

/** ITTI calendar feed (subscribe in Google/Outlook/Apple) + per-event .ics downloads. */
export const calendarRoutes = new Hono()
  .get('/calendar.ics', async (c) => {
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90);
    const events = await Event.find({ status: 'published', deletedAt: null, end: { $gte: since } }).lean();
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=900');
    return c.body(toIcs(events, env.WEB_PUBLIC_URL));
  })
  .get('/events/:slug/ics', async (c) => {
    const event = await Event.findOne({ slug: c.req.param('slug'), status: 'published', deletedAt: null }).lean();
    if (!event) throw notFound('Event');
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${event.slug}.ics"`);
    return c.body(toIcs([event], env.WEB_PUBLIC_URL));
  });
