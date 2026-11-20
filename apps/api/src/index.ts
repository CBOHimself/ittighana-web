import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { connectDb } from '@itti/db';
import app from './app';
import { env, isProd } from './env';
import { ensureLoginGuardIndexes } from './lib/login-guard';

await connectDb(env.MONGODB_URI);
await ensureLoginGuardIndexes().catch((err) => console.warn('[login-guard] index', err));

// Locally, serve uploaded media from disk. On cPanel, media.ittighana.com serves it directly.
if (!isProd) {
  app.use(
    '/media/*',
    serveStatic({ root: env.MEDIA_PUBLIC_DIR, rewriteRequestPath: (p) => p.replace(/^\/media/, '') }),
  );
}

// Passenger (cPanel) manages the port itself, so any value works there.
const port = env.PORT ?? env.API_PORT;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ITTI API listening on http://localhost:${info.port}`);
});
