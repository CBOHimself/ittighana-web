import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Article, Course, Form, Media, News, Page, SiteSettings, Template } from './models';

/**
 * Load structured site content (tools/wp-migrate → content/<site>/) into MongoDB.
 * Upserts by slug (or path for media), so it is safe to re-run. Without `replace`,
 * fields an admin may have edited are only set when the record is first created.
 */
export async function importContent(dir: string, opts: { replace?: boolean } = {}) {
  const DIR = path.resolve(dir);
  if (!existsSync(DIR)) throw new Error(`Content folder not found: ${DIR}`);
  const readAll = (sub: string): Record<string, unknown>[] => {
    const d = path.join(DIR, sub);
    return existsSync(d) ? readdirSync(d).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(path.join(d, f), 'utf8'))) : [];
  };
  const read = (file: string) => JSON.parse(readFileSync(path.join(DIR, file), 'utf8'));
  const stats: Record<string, number> = {};

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function upsert(model: any, name: string, docs: Record<string, unknown>[], key = 'slug', keep: string[] = []) {
    for (const doc of docs) {
      const { [key]: id, ...rest } = doc;
      const set: Record<string, unknown> = { ...rest };
      const setOnInsert: Record<string, unknown> = {};
      if (!opts.replace) for (const k of keep) if (k in set) { setOnInsert[k] = set[k]; delete set[k]; }
      await model.updateOne({ [key]: id }, { $set: { ...set, deletedAt: null }, $setOnInsert: { [key]: id, ...setOnInsert } }, { upsert: true });
    }
    stats[name] = docs.length;
  }

  // Older exports used `layoutTemplate` for the course template.
  const courses = readAll('courses').map(({ layoutTemplate, ...c }) => ({ ...c, template: c.template ?? layoutTemplate ?? null }));

  await upsert(Template, 'templates', readAll('templates'), 'slug', ['layout', 'fields', 'isDefault', 'contentType', 'description']);
  await upsert(Page, 'pages', readAll('pages'), 'slug', ['layout', 'seo', 'status']);
  await upsert(Course, 'courses', courses, 'slug', ['layout', 'fields', 'seo', 'status', 'template']);
  await upsert(Article, 'articles', readAll('articles'), 'slug', ['layout', 'fields', 'status', 'template']);
  await upsert(News, 'news', readAll('news'), 'slug', ['layout', 'html', 'fields', 'status', 'template']);
  await upsert(Form, 'forms', readAll('forms'), 'slug', ['fields', 'settings', 'status']);

  const media = existsSync(path.join(DIR, 'media.json')) ? (read('media.json') as { path: string }[]) : [];
  await upsert(
    Media,
    'media',
    media.map((m) => ({ ...m, visibility: 'public', source: 'wordpress', folder: 'wordpress', originalName: path.basename(m.path) })),
    'path',
  );

  // Site settings: merge design/theme data into the existing settings document.
  const site = read('site.json');
  const current = ((await SiteSettings.findOne({ key: 'site' }).lean())?.value ?? {}) as Record<string, unknown>;
  await SiteSettings.updateOne(
    { key: 'site' },
    { $set: { value: { ...current, siteName: site.name, description: site.description, logo: site.logo, favicon: site.favicon, tokens: site.tokens, menus: site.menus, theme: site.theme } } },
    { upsert: true },
  );
  stats.site = 1;
  return stats;
}
