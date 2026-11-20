/**
 * Writes the content templates into an exported content folder (no database needed),
 * so the local preview server (tools/content-server) shows the same templates the
 * database gets from migration 004.
 *
 *   pnpm --filter @itti/db run export-templates -- --dir ../../content/itti
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildTemplateFields, FIELD_CATALOG, type LayoutNode } from '@itti/schemas';
import { buildContentTemplate, CONTENT_TEMPLATE_SPECS, WORDPRESS_CONTENT_TEMPLATES } from '../content-templates';

const { values: a } = parseArgs({ options: { dir: { type: 'string', default: '../../content/itti' } } });
const dir = path.join(path.resolve(a.dir!), 'templates');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const load = (f: string) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
const save = (f: string, d: unknown) => writeFileSync(path.join(dir, f), JSON.stringify(d, null, 2) + '\n');

let base: LayoutNode[] | undefined;
for (const wp of WORDPRESS_CONTENT_TEMPLATES) {
  const file = files.find((f) => new RegExp(`^${wp.slugPrefix}(-\\d+)?\\.json$`).test(f));
  if (!file) { console.warn(`missing ${wp.slugPrefix}`); continue; }
  const t = load(file);
  const keys = new Set(FIELD_CATALOG[wp.contentType].map((f) => f.key));
  Object.assign(t, {
    contentType: wp.contentType,
    fields: buildTemplateFields(wp.contentType, t.layout, wp.extraFields).filter((f) => keys.has(f.key)),
    isDefault: wp.isDefault ?? false,
    description: wp.description,
    ...(wp.title ? { title: wp.title } : {}),
  });
  save(file, t);
  if (wp.slugPrefix === 'itti-course-template-2') base = t.layout;
  console.log(`✓ ${file}`);
}
if (!base) throw new Error('Course template 2 not found');
for (const spec of CONTENT_TEMPLATE_SPECS) {
  save(`${spec.slug}.json`, buildContentTemplate(base, spec));
  console.log(`✓ ${spec.slug}.json`);
}
