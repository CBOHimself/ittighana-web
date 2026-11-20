import { ROLES } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { env } from '../../env';
import { audit } from '../../lib/audit';
import { forbidden } from '../../lib/http';
import { requirePermission } from '../../middleware/rbac';
import { auth } from '../../services';
import type { AppEnv } from '../../types';

/**
 * User management (invite only). Wraps Better Auth's admin plugin so the
 * role rules (e.g. only super admins can create super admins) live in one place.
 */
export const userRoutes = new Hono<AppEnv>()
  .use(requirePermission('users:manage'))
  .get('/', async (c) => {
    const res = await auth().api.listUsers({
      headers: c.req.raw.headers,
      query: { limit: 200, sortBy: 'createdAt', sortDirection: 'desc' },
    });
    return c.json(res);
  })
  .post(
    '/invite',
    zValidator('json', z.object({ email: z.string().email(), name: z.string().min(2), role: z.enum(ROLES) })),
    async (c) => {
      const { email, name, role } = c.req.valid('json');
      if (role === 'super_admin' && c.get('user')?.role !== 'super_admin') {
        throw forbidden('Only a super admin can invite super admins');
      }
      const created = await auth().api.createUser({
        headers: c.req.raw.headers,
        // Throwaway password: the user sets their own through the reset link.
        body: { email, name, role: role as 'admin', password: randomBytes(24).toString('base64url') },
      });
      await auth().api.requestPasswordReset({
        body: { email, redirectTo: `${env.ADMIN_PUBLIC_URL}/reset-password` },
      });
      await audit(c, 'invite', 'user', created.user.id, { email, role });
      return c.json(created.user, 201);
    },
  )
  .post('/:id/role', zValidator('json', z.object({ role: z.enum(ROLES) })), async (c) => {
    const { role } = c.req.valid('json');
    if (role === 'super_admin' && c.get('user')?.role !== 'super_admin') throw forbidden();
    const res = await auth().api.setRole({
      headers: c.req.raw.headers,
      body: { userId: c.req.param('id'), role: role as 'admin' },
    });
    await audit(c, 'set-role', 'user', c.req.param('id'), { role });
    return c.json(res);
  })
  .post('/:id/ban', async (c) => {
    const res = await auth().api.banUser({ headers: c.req.raw.headers, body: { userId: c.req.param('id') } });
    await audit(c, 'ban', 'user', c.req.param('id'));
    return c.json(res);
  })
  .post('/:id/unban', async (c) => {
    const res = await auth().api.unbanUser({ headers: c.req.raw.headers, body: { userId: c.req.param('id') } });
    await audit(c, 'unban', 'user', c.req.param('id'));
    return c.json(res);
  });
