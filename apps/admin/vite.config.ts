import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

/**
 * The admin portal lives at /staff on the main site (ittighana.com/staff).
 * - Production: built into the web app's public/staff folder; Next serves it and
 *   falls back to /staff/index.html for client-side routes (apps/web/next.config.ts).
 * - Development: run on :5176; the web app proxies localhost:3000/staff to it when
 *   ADMIN_DEV_URL is set, or open http://localhost:5176/staff/ directly.
 */
const port = Number(process.env.VITE_DEV_PORT || 5176);

export default defineConfig({
  base: '/staff/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  build: {
    outDir: path.resolve(import.meta.dirname, '../web/public/staff'),
    emptyOutDir: true,
    sourcemap: false,
  },
  server: { port, strictPort: true, hmr: { clientPort: port } },
});
