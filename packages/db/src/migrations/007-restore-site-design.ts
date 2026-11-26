import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SiteSettings } from '../models';
import type { Migration } from './types';

/**
 * Put the site's design data back into the settings document: logo, favicon, design
 * tokens (colours, fonts), menus and the header/footer theme templates.
 * Saving the portal's Settings page used to replace the whole document with only the
 * form's fields, which removed these and left the site unstyled. Form fields are kept.
 */
export const m007: Migration = {
  id: '20261126-07-restore-site-design',
  description: 'Restore logo, design tokens, menus and theme templates in site settings',
  async up({ contentDir, log, dryRun }) {
    const file = path.join(contentDir, 'site.json');
    if (!existsSync(file)) return log(`skipped: ${file} not found`);
    const site = JSON.parse(readFileSync(file, 'utf8'));
    const current = ((await SiteSettings.findOne({ key: 'site' }).lean())?.value ?? {}) as Record<string, unknown>;
    const missing = ['logo', 'favicon', 'tokens', 'menus', 'theme'].filter((k) => current[k] == null);
    log(`missing before: ${missing.join(', ') || 'none'}`);
    if (dryRun) return;
    await SiteSettings.updateOne(
      { key: 'site' },
      {
        $set: {
          value: {
            ...current,
            description: current.description ?? site.description,
            logo: site.logo,
            favicon: site.favicon,
            tokens: site.tokens,
            menus: site.menus,
            theme: site.theme,
          },
        },
      },
      { upsert: true },
    );
  },
};
