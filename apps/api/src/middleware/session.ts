import { createMiddleware } from 'hono/factory';
import { auth } from '../services';
import type { AppEnv, SessionUser } from '../types';

/** Resolve the Better Auth session (if any) for every request. */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const session = await auth().api.getSession({ headers: c.req.raw.headers });
  c.set('user', (session?.user as SessionUser | undefined) ?? null);
  c.set('sessionId', session?.session.id ?? null);
  await next();
});
