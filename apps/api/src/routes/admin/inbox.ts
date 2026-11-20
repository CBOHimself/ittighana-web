import { ContactMessage } from '@itti/db';
import { paginationQuery } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { assertId, notFound } from '../../lib/http';
import { escapeRegex, paginate } from '../../lib/paginate';
import { requirePermission } from '../../middleware/rbac';
import type { AppEnv } from '../../types';

export const inboxRoutes = new Hono<AppEnv>()
  .use(requirePermission('inbox:read'))
  .get('/', zValidator('query', paginationQuery.extend({ unread: z.stringbool().optional() })), async (c) => {
    const { unread, ...q } = c.req.valid('query');
    const filter: Record<string, unknown> = { deletedAt: null };
    if (unread) filter.read = false;
    if (q.q) {
      const rx = { $regex: escapeRegex(q.q), $options: 'i' };
      filter.$or = [{ name: rx }, { email: rx }, { subject: rx }];
    }
    return c.json(await paginate(ContactMessage, filter, q));
  })
  .get('/:id', async (c) => {
    const m = await ContactMessage.findOneAndUpdate(
      { _id: assertId(c.req.param('id')), deletedAt: null },
      { read: true },
      { new: true },
    ).lean();
    if (!m) throw notFound('Message');
    return c.json(m);
  })
  .patch(
    '/:id',
    zValidator('json', z.object({ read: z.boolean().optional(), replied: z.boolean().optional() })),
    async (c) => {
      const m = await ContactMessage.findOneAndUpdate(
        { _id: assertId(c.req.param('id')), deletedAt: null },
        c.req.valid('json'),
        { new: true },
      ).lean();
      if (!m) throw notFound('Message');
      return c.json(m);
    },
  );
