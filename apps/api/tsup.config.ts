import { defineConfig } from 'tsup';

/**
 * Bundle the API and the internal @itti/* packages into dist/. External deps
 * (mongoose, sharp, better-auth, ...) are installed in production node_modules
 * by `pnpm deploy` in CI.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'create-admin': 'src/scripts/create-admin.ts',
    'sync-indexes': 'src/scripts/sync-indexes.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  noExternal: [/^@itti\//],
});
