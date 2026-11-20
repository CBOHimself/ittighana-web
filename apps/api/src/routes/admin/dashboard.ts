import { AuditLog, ContactMessage, Event, FormSubmission, SpaceBooking } from '@itti/db';
import { can } from '@itti/schemas';
import { Hono } from 'hono';
import type { AppEnv } from '../../types';

export const dashboardRoutes = new Hono<AppEnv>().get('/', async (c) => {
  const role = c.get('user')?.role;
  const now = new Date();
  const [newApplicants, unreadMessages, pendingBookings, upcomingEvents, recentActivity] = await Promise.all([
    can(role, 'submissions:read') ? FormSubmission.countDocuments({ status: 'new', deletedAt: null }) : null,
    can(role, 'inbox:read') ? ContactMessage.countDocuments({ read: false, deletedAt: null }) : null,
    can(role, 'bookings:manage')
      ? SpaceBooking.countDocuments({ status: 'pending', deletedAt: null, start: { $gte: now } })
      : null,
    Event.find({ deletedAt: null, start: { $gte: now } }, 'title slug start status').sort({ start: 1 }).limit(5).lean(),
    can(role, 'audit:read') ? AuditLog.find({}).sort({ createdAt: -1 }).limit(10).lean() : [],
  ]);
  return c.json({ newApplicants, unreadMessages, pendingBookings, upcomingEvents, recentActivity });
});
