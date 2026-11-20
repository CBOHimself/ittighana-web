import { mongoose, Space, SpaceBooking } from '@itti/db';
import { templates } from '@itti/email';
import { paginationQuery } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { assertId, conflict, notFound } from '../../lib/http';
import { paginate } from '../../lib/paginate';
import { requirePermission } from '../../middleware/rbac';
import { mailer } from '../../services';
import type { AppEnv } from '../../types';

const fmt = (d: Date) => d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Accra' });

export const bookingRoutes = new Hono<AppEnv>()
  .use(requirePermission('bookings:manage'))
  .get(
    '/',
    zValidator('query', paginationQuery.extend({ status: z.string().optional(), spaceId: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() })),
    async (c) => {
      const { status, spaceId, from, to, ...q } = c.req.valid('query');
      const filter: Record<string, unknown> = { deletedAt: null };
      if (status) filter.status = status;
      if (spaceId) filter.spaceId = assertId(spaceId);
      if (from) filter.end = { $gte: from };
      if (to) filter.start = { $lte: to };
      return c.json(await paginate(SpaceBooking, filter, q, { start: 1 }));
    },
  )
  .get('/:id', async (c) => {
    const b = await SpaceBooking.findOne({ _id: assertId(c.req.param('id')), deletedAt: null }).populate('spaceId', 'name slug').lean();
    if (!b) throw notFound('Booking');
    return c.json(b);
  })
  /** Approve / decline / cancel. Approval re-checks overlaps inside a transaction. */
  .post(
    '/:id/decision',
    zValidator('json', z.object({ status: z.enum(['approved', 'declined', 'cancelled']), note: z.string().max(1000).optional() })),
    async (c) => {
      const id = assertId(c.req.param('id'));
      const { status, note } = c.req.valid('json');
      const user = c.get('user');

      const session = await mongoose.startSession();
      try {
        const booking = await session.withTransaction(async () => {
          const b = await SpaceBooking.findOne({ _id: id, deletedAt: null }).session(session);
          if (!b) throw notFound('Booking');
          if (status === 'approved') {
            const clash = await SpaceBooking.exists({
              _id: { $ne: b._id },
              spaceId: b.spaceId,
              status: 'approved',
              deletedAt: null,
              start: { $lt: b.end },
              end: { $gt: b.start },
            }).session(session);
            if (clash) throw conflict('Another approved booking overlaps this time');
          }
          b.set({ status, adminNote: note, decidedBy: user?.id, decidedAt: new Date() });
          await b.save({ session });
          return b;
        });

        const space = await Space.findById(booking.spaceId, 'name').lean();
        await mailer.send({
          to: booking.email,
          ...templates.bookingStatus(booking.name, space?.name ?? 'the space', `${fmt(booking.start)} – ${fmt(booking.end)}`, status, note),
        });
        await audit(c, `booking:${status}`, 'booking', id);
        return c.json(booking.toJSON());
      } finally {
        await session.endSession();
      }
    },
  );
