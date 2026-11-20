import { can, type Permission } from '@itti/schemas';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { env } from '../env';
import type { AppEnv } from '../types';

/** Require a signed-in staff user whose role is allowed into the portal. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw new HTTPException(401, { message: 'Sign in required' });
  if (!env.PORTAL_ROLES.includes(user.role ?? '') || (user as { banned?: boolean }).banned) {
    throw new HTTPException(403, { message: 'This account does not have access to the staff portal' });
  }
  await next();
});

/** Require a signed-in user holding every listed permission. */
export const requirePermission = (...permissions: Permission[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    if (!user) throw new HTTPException(401, { message: 'Sign in required' });
    if (!permissions.every((p) => can(user.role, p))) {
      throw new HTTPException(403, { message: 'You do not have permission to do this' });
    }
    await next();
  });
