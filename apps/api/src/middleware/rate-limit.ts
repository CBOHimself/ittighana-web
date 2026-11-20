import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { clientIp } from '../lib/http';

/**
 * Simple in-memory fixed-window limiter. Fine for a single Passenger process;
 * move to a MongoDB TTL collection if the API runs multiple instances.
 */
export function rateLimit({ windowMs, max, key }: { windowMs: number; max: number; key: string }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return createMiddleware(async (c, next) => {
    const now = Date.now();
    const id = `${key}:${clientIp(c.req.raw.headers)}`;
    const entry = hits.get(id);
    if (!entry || entry.reset < now) {
      hits.set(id, { count: 1, reset: now + windowMs });
    } else if (++entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      throw new HTTPException(429, { message: 'Too many requests. Please try again shortly.' });
    }
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
    await next();
  });
}
