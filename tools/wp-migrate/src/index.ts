/**
 * WordPress/Elementor → MongoDB importer. See README.md.
 *   --inventory  list content + Elementor widget usage, no writes
 *   --dry-run    map everything and write the report, no DB writes
 */
import { connectDb, CourseCategory, Course, disconnectDb, Media, Page } from '@itti/db';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { elementorToBlocks, type ElNode, type MapContext } from './elementor-map';

const { values: args } = parseArgs({ options: { inventory: { type: 'boolean' }, 'dry-run': { type: 'boolean' } } });

const WP_DB_URL = process.env.WP_DB_URL ?? 'mysql://root:root@127.0.0.1:3307/wp';
const P = process.env.WP_TABLE_PREFIX ?? 'wp_';
const WP_SITE_URL = (process.env.WP_SITE_URL ?? 'https://www.ittighana.com').replace(/\/$/, '');
const MEDIA_URL = (process.env.MEDIA_PUBLIC_URL ?? 'https://media.ittighana.com').replace(/\/$/, '');

/** Adjust after running --inventory: how course pages are identified on the current site. */
const COURSE_MATCH = {
  postTypes: ['course', 'courses', 'lp_course'],
  parentPageSlug: 'courses', // pages that are children of /courses
};

type PostRow = RowDataPacket & {
  ID: number;
  post_title: string;
  post_name: string;
  post_type: string;
  post_status: string;
  post_parent: number;
  post_content: string;
  post_excerpt: string;
  guid: string;
  post_mime_type: string;
  menu_order: number;
};

const rewriteUrl = (html: string) =>
  html
    .replaceAll(`${WP_SITE_URL}/wp-content/uploads/`, `${MEDIA_URL}/wp-content/uploads/`)
    .replaceAll(WP_SITE_URL.replace('https://www.', 'https://') + '/wp-content/uploads/', `${MEDIA_URL}/wp-content/uploads/`)
    .replaceAll(WP_SITE_URL.replace('https://', 'http://') + '/wp-content/uploads/', `${MEDIA_URL}/wp-content/uploads/`);

const db = await mysql.createConnection(WP_DB_URL);
const [posts] = await db.query<PostRow[]>(
  `SELECT ID, post_title, post_name, post_type, post_status, post_parent, post_content, post_excerpt, guid, post_mime_type, menu_order
   FROM ${P}posts WHERE post_status IN ('publish','private','inherit') AND post_type NOT IN ('revision','nav_menu_item','customize_changeset','oembed_cache')`,
);
const [metaRows] = await db.query<(RowDataPacket & { post_id: number; meta_key: string; meta_value: string })[]>(
  `SELECT post_id, meta_key, meta_value FROM ${P}postmeta
   WHERE meta_key IN ('_elementor_data','_wp_attached_file','_wp_attachment_image_alt','_yoast_wpseo_title','_yoast_wpseo_metadesc','rank_math_title','rank_math_description','_thumbnail_id')`,
);
const meta = new Map<number, Record<string, string>>();
for (const m of metaRows) meta.set(m.post_id, { ...(meta.get(m.post_id) ?? {}), [m.meta_key]: m.meta_value });

const byId = new Map(posts.map((p) => [p.ID, p]));
const ctx: MapContext = { rewriteUrl, unmapped: new Map() };
const report: Record<string, unknown> = { pages: [], courses: [], media: 0, skipped: [] };

function parseElementor(id: number): ElNode[] | null {
  const raw = meta.get(id)?._elementor_data;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ElNode[];
  } catch {
    return null;
  }
}

function blocksFor(p: PostRow) {
  const tree = parseElementor(p.ID);
  if (tree) return elementorToBlocks(tree, ctx);
  return p.post_content ? [{ id: `wp${p.ID}`, type: 'richText' as const, html: rewriteUrl(p.post_content) }] : [];
}

function seoFor(id: number) {
  const m = meta.get(id) ?? {};
  return { title: m._yoast_wpseo_title || m.rank_math_title || undefined, description: m._yoast_wpseo_metadesc || m.rank_math_description || undefined };
}

function coverFor(id: number) {
  const thumb = Number(meta.get(id)?._thumbnail_id);
  const file = thumb ? meta.get(thumb)?._wp_attached_file : undefined;
  return file ? { url: `${MEDIA_URL}/wp-content/uploads/${file}`, alt: meta.get(thumb)?._wp_attachment_image_alt ?? '' } : undefined;
}

/* ─── Inventory ─────────────────────────────────────────────────────────── */
if (args.inventory) {
  const types = new Map<string, number>();
  const widgets = new Map<string, number>();
  const walk = (n: ElNode) => {
    if (n.widgetType) widgets.set(n.widgetType, (widgets.get(n.widgetType) ?? 0) + 1);
    n.elements?.forEach(walk);
  };
  for (const p of posts) {
    types.set(p.post_type, (types.get(p.post_type) ?? 0) + 1);
    parseElementor(p.ID)?.forEach(walk);
  }
  console.log('\nPost types:'); console.table(Object.fromEntries(types));
  console.log('\nElementor widgets in use:'); console.table(Object.fromEntries([...widgets].sort((a, b) => b[1] - a[1])));
  console.log('\nPages:');
  console.table(posts.filter((p) => p.post_type === 'page').map((p) => ({ id: p.ID, slug: p.post_name, title: p.post_title, parent: byId.get(p.post_parent)?.post_name ?? '', elementor: Boolean(meta.get(p.ID)?._elementor_data) })));
  await db.end();
  process.exit(0);
}

/* ─── Import ────────────────────────────────────────────────────────────── */
const dry = Boolean(args['dry-run']);
if (!dry) await connectDb();

// Media catalogue (files stay in place on cPanel)
for (const a of posts.filter((p) => p.post_type === 'attachment')) {
  const file = meta.get(a.ID)?._wp_attached_file;
  if (!file) continue;
  (report.media as number)++;
  if (dry) continue;
  await Media.updateOne(
    { path: `wp-content/uploads/${file}` },
    { $setOnInsert: { path: `wp-content/uploads/${file}`, url: `${MEDIA_URL}/wp-content/uploads/${file}`, originalName: path.basename(file), mime: a.post_mime_type, alt: meta.get(a.ID)?._wp_attachment_image_alt ?? '', title: a.post_title, folder: 'wordpress', source: 'wordpress' } },
    { upsert: true },
  );
}

// Pages and courses
const coursesParent = posts.find((p) => p.post_type === 'page' && p.post_name === COURSE_MATCH.parentPageSlug);
let defaultCategoryId: unknown;
for (const p of posts.filter((x) => x.post_status === 'publish' && (x.post_type === 'page' || COURSE_MATCH.postTypes.includes(x.post_type)))) {
  const isCourse = COURSE_MATCH.postTypes.includes(p.post_type) || (coursesParent && p.post_parent === coursesParent.ID);
  const blocks = blocksFor(p);

  if (isCourse) {
    (report.courses as unknown[]).push({ slug: p.post_name, blocks: blocks.length });
    if (dry) continue;
    if (!defaultCategoryId) {
      const cat = await CourseCategory.findOneAndUpdate({ slug: 'courses' }, { $setOnInsert: { name: 'Courses', slug: 'courses', order: 0 } }, { upsert: true, new: true });
      defaultCategoryId = cat._id;
    }
    await Course.updateOne(
      { slug: p.post_name },
      { $set: { title: p.post_title, blocks, seo: seoFor(p.ID), cover: coverFor(p.ID), summary: p.post_excerpt || undefined, order: p.menu_order }, $setOnInsert: { slug: p.post_name, categoryId: defaultCategoryId, template: 'classic', status: 'published' } },
      { upsert: true },
    );
  } else {
    const isHome = p.post_name === 'home' || p.post_name === 'homepage';
    const slug = isHome ? 'home' : p.post_name;
    (report.pages as unknown[]).push({ slug, blocks: blocks.length });
    if (dry) continue;
    await Page.updateOne(
      { slug },
      { $set: { title: p.post_title, blocks, seo: seoFor(p.ID) }, $setOnInsert: { slug, template: ['home', 'about'].includes(slug) ? slug : 'default', status: 'published' } },
      { upsert: true },
    );
  }
}

report.unmappedWidgets = Object.fromEntries(ctx.unmapped);
const outDir = path.join(import.meta.dirname, '..', 'output');
await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${dry ? '[dry run] ' : ''}Pages: ${(report.pages as unknown[]).length} · Courses: ${(report.courses as unknown[]).length} · Media: ${report.media}`);
console.log('Unmapped widgets:', report.unmappedWidgets);
console.log(`Report → ${path.join(outDir, 'report.json')}`);

await db.end();
if (!dry) await disconnectDb();
