import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { allowedOrigins, isProd } from './env';
import { guardedSignIn } from './lib/login-guard';
import { sessionMiddleware } from './middleware/session';
import { adminRoutes } from './routes/admin';
import { calendarRoutes } from './routes/public/calendar';
import { contentRoutes } from './routes/public/content';
import { siteRoutes } from './routes/public/site';
import { submissionRoutes } from './routes/public/submissions';
import { auth } from './services';
import type { AppEnv } from './types';

const app = new Hono<AppEnv>();

app.use('*', logger());
app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
app.use(
  '/v1/*',
  cors({
    origin: allowedOrigins,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600,
  }),
);

app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));

// Better Auth handles everything under /v1/auth/*. Email sign-in goes through the
// lockout guard first. Public sign-up is disabled in the auth config as well.
app.post('/v1/auth/sign-in/email', (c) => guardedSignIn(c.req.raw, (r) => auth().handler(r)));
app.on(['GET', 'POST'], '/v1/auth/*', (c) => {
  if (c.req.path.endsWith('/sign-up/email') || c.req.path.includes('/magic-link')) return c.json({ error: 'Not found' }, 404);
  return auth().handler(c.req.raw);
});

app.use('/v1/*', sessionMiddleware);

const routes = app
  .basePath('/v1')
  .route('/', contentRoutes)
  .route('/', siteRoutes)
  .route('/', calendarRoutes)
  .route('/', submissionRoutes)
  .route('/admin', adminRoutes);

app.notFound((c) => c.json({ error: 'Not found' }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
  if (err.name === 'ValidationError' || err.name === 'CastError') return c.json({ error: err.message }, 422);
  console.error(err);
  return c.json({ error: isProd ? 'Something went wrong' : err.message }, 500);
});

export default app;

/** Typed route tree for the Hono RPC client (@itti/api-client). */
export type AppType = typeof routes;
