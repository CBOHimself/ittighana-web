import { existsSync } from 'node:fs';
import { importContent } from '../import-content';
import type { Migration } from './types';

/** Load the converted WordPress site (pages, courses, news, student articles, templates, forms, media). */
export const m003: Migration = {
  id: '20261116-03-import-wordpress',
  description: 'Import the converted WordPress content from content/itti (safe to re-run with db:seed-content)',
  async up({ contentDir, log, dryRun }) {
    if (!existsSync(contentDir)) return log(`skipped: ${contentDir} not found`);
    if (dryRun) return log(`would import ${contentDir}`);
    const stats = await importContent(contentDir);
    log(`imported ${Object.entries(stats).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  },
};
