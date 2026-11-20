/**
 * WordPress (WXR export) + Elementor → structured site content.
 *
 *   pnpm --filter @itti/wp-migrate wxr -- \
 *     --input input/export.xml --uploads <backup>/wp-content/uploads --out ../../content/itti
 *
 * Writes one folder per section (site, templates, pages, courses, articles,
 * news, forms, media) that `pnpm seed:content` loads into MongoDB.
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { LayoutNode } from '@itti/schemas';
import { convertTree, type ConvertCtx } from './convert';
import { json, parseWxr, php, type WxrItem } from './parse';
import { buildForms, buildMenus, buildTokens } from './site';

const { values: a } = parseArgs({
  options: {
    input: { type: 'string', default: 'input/export.xml' },
    uploads: { type: 'string' },
    out: { type: 'string', default: '../../content/itti' },
    site: { type: 'string' },
    /** JSON of ACF values pulled from the database dump (see extract-acf.py); WXR exports omit them. */
    acf: { type: 'string' },
  },
});

const xml = await readFile(a.input!, 'utf8');
const wxr = parseWxr(xml);

/* ACF: values from the DB dump (by post id) and field defaults from acf-field posts. */
type AcfDump = Record<string, Record<string, { slug: string; fields: Record<string, string> }>>;
const acfDump: AcfDump = a.acf && existsSync(a.acf) ? JSON.parse(await readFile(a.acf, 'utf8')) : {};
const acfValues = (type: string, id: number): Record<string, string> => acfDump[type]?.[String(id)]?.fields ?? {};
// Field group id → post types its location rules target.
const groupTypes = new Map<number, string[]>();
for (const g of wxr.items.filter((i) => i.type === 'acf-field-group')) {
  const conf = php(g.content) as { location?: Record<string, Record<string, { param?: string; operator?: string; value?: string }>> } | undefined;
  const types = Object.values(conf?.location ?? {})
    .flatMap((ors) => Object.values(ors))
    .filter((r) => r.param === 'post_type' && r.operator === '==' && r.value)
    .map((r) => r.value!);
  groupTypes.set(g.id, types);
}
const acfDefaultsByType = new Map<string, Map<string, string>>();
for (const it of wxr.items.filter((i) => i.type === 'acf-field')) {
  const conf = php(it.content) as Record<string, unknown> | undefined;
  const dv = conf?.default_value;
  if (!it.excerpt || typeof dv !== 'string' || !dv) continue;
  for (const t of groupTypes.get(it.parent) ?? []) {
    if (!acfDefaultsByType.has(t)) acfDefaultsByType.set(t, new Map());
    acfDefaultsByType.get(t)!.set(it.excerpt, dv);
  }
}
const acfDefaults = (type: string) => acfDefaultsByType.get(type) ?? new Map<string, string>();
const SITE = (a.site ?? wxr.site.link).replace(/\/$/, '');
const SITE_HOST = SITE.replace(/^https?:\/\/(www\.)?/, '').replace(/\./g, '\\.');
const SITE_RE = new RegExp(`^https?://(www\\.)?${SITE_HOST}`);
const OUT = path.resolve(a.out!);

/* ─── Media: what's available locally? ─────────────────────────────────── */
const available = new Set<string>();
if (a.uploads && existsSync(a.uploads)) {
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else available.add('/wp-content/uploads/' + path.relative(a.uploads!, p).split(path.sep).join('/'));
    }
  };
  walk(a.uploads);
}
const toPath = (url: string) => url.replace(SITE_RE, '').replace(/^https?:\/\/[^/]+/, '').split('?')[0]!;
const stripSize = (p: string) => p.replace(/-\d+x\d+(\.\w+)$/, '$1').replace(/-scaled(\.\w+)$/, '$1');
const missing = new Set<string>();
function resolveMedia(url: string): string | null {
  const p = toPath(url);
  if (available.has(p)) return p;
  const orig = stripSize(p);
  if (available.has(orig)) return orig;
  missing.add(orig);
  return null;
}
const label = (p: string) => path.basename(stripSize(p)).replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').slice(0, 40);

/* Original image sizes (so placeholders keep the real aspect ratio and hold the layout). */
const sizeByPath = new Map<string, [number, number]>();
for (const att of wxr.items.filter((i) => i.type === 'attachment')) {
  const meta = php<Record<string, any>>(att.meta._wp_attachment_metadata) ?? {};
  if (meta.width && meta.height) sizeByPath.set(stripSize(toPath(att.attachmentUrl ?? '')), [Number(meta.width), Number(meta.height)]);
}
function sizeOf(url: string): [number, number] | undefined {
  const p = toPath(url);
  const m = p.match(/-(\d+)x(\d+)\.\w+$/);
  if (m) return [Number(m[1]), Number(m[2])];
  return sizeByPath.get(stripSize(p));
}
/** `placeholder:<label>[|<w>x<h>]` — rendered as an inline SVG of that size by the blocks package. */
const placeholderToken = (url: string) => {
  const sz = sizeOf(url);
  return `placeholder:${label(toPath(url))}${sz ? `|${sz[0]}x${sz[1]}` : ''}`;
};
const placeholderSvg = (text: string, size: [number, number] = [1200, 800]) => {
  const [w, h] = size;
  const t = text.replace(/[<&>"]/g, '');
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#e6e6e6"/><rect x="${w * 0.03}" y="${h * 0.04}" width="${w * 0.94}" height="${h * 0.92}" fill="none" stroke="#cbc8cc" stroke-width="4" stroke-dasharray="16 12"/><text x="${w / 2}" y="${h / 2 - 5}" font-family="Arial" font-size="${Math.max(14, Math.round(Math.min(w, h) / 20))}" fill="#002147" text-anchor="middle">ITTI</text><text x="${w / 2}" y="${h / 2 + Math.max(14, Math.round(Math.min(w, h) / 20))}" font-family="Arial" font-size="${Math.max(10, Math.round(Math.min(w, h) / 34))}" fill="#3277ae" text-anchor="middle">${t}</text></svg>`,
  )}`;
};

/* ─── Paths for every published item ───────────────────────────────────── */
const byId = new Map<number, WxrItem>(wxr.items.map((i) => [i.id, i]));
const paths = new Map<number, string>();
for (const it of wxr.items) {
  if (it.status !== 'publish' || !it.link || it.link.includes('?')) continue;
  let p = toPath(it.link).replace(/\/$/, '') || '/';
  if (it.type === 'page' && (it.slug === 'home' || it.slug === 'homepage')) p = '/';
  paths.set(it.id, p);
}

const ctx: ConvertCtx = {
  media: (url) => resolveMedia(url) ?? placeholderToken(url),
  mediaInline: (url) => resolveMedia(url) ?? placeholderSvg(label(toPath(url)), sizeOf(url)),
  link: (url) => {
    if (!SITE_RE.test(url) || /wp-content\/uploads/.test(url)) return url;
    return toPath(url).replace(/\/$/, '') || '/';
  },
  paths,
  fonts: new Set(),
  forms: new Map(),
  unknownWidgets: new Map(),
  source: '',
};

const layoutOf = (it: WxrItem): LayoutNode[] => {
  const data = json<any[]>(it.meta._elementor_data);
  ctx.source = it.slug || String(it.id);
  return data ? convertTree(data, ctx) : [];
};
const mediaRef = (attachmentId: unknown) => {
  const att = byId.get(Number(attachmentId));
  if (!att?.attachmentUrl) return undefined;
  return { id: att.id, url: ctx.media(att.attachmentUrl), alt: att.meta._wp_attachment_image_alt ?? '' };
};
const html = (s: string) => s.replace(/(https?:)?\/\/[^"'\s)]*?\/wp-content\/uploads\/[^"'\s)]+/g, (m) => ctx.mediaInline(m)).replace(new RegExp(SITE_RE.source + '(/[^"\\s]*)', 'g'), '$2');
const seo = (it: WxrItem) => ({
  title: it.meta._yoast_wpseo_title || undefined,
  description: it.meta._yoast_wpseo_metadesc || undefined,
});
const pageTemplate = (it: WxrItem) =>
  ({ elementor_canvas: 'canvas', elementor_header_footer: 'full-width' } as Record<string, string>)[it.meta._wp_page_template ?? ''] ?? 'default';

async function out(rel: string, data: unknown) {
  const file = path.join(OUT, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

await rm(OUT, { recursive: true, force: true });
const of = (type: string) => wxr.items.filter((i) => i.type === type);
const counts: Record<string, number> = {};
const isoDate = (d: string) => {
  const t = new Date(d.replace(' ', 'T') + 'Z');
  return d && !d.startsWith('0000') && !Number.isNaN(t.getTime()) ? t.toISOString() : undefined;
};

/* ─── Templates (theme builder, popups, sections) ──────────────────────── */
const KIND: Record<string, string> = {
  header: 'header', footer: 'footer', single: 'single', 'single-post': 'single-post', 'single-page': 'single-page',
  archive: 'archive', popup: 'popup', container: 'section', 'e-flexbox': 'section', section: 'section',
  'loop-item': 'loop-item', 'floating-buttons': 'floating-buttons', page: 'page',
};
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const courseSlugById = new Map(of('itti-course').map((c) => [c.id, c.slug]));
const termSlugById = new Map(wxr.terms.map((t) => [t.id, t.slug]));
function conditions(it: WxrItem): string[] {
  const raw = php<Record<string, string> | string[]>(it.meta._elementor_conditions);
  const list = raw ? Object.values(raw) : [];
  return [...new Set(list.map((c) => {
    const p = String(c).replace(/^include\//, '');
    if (p === 'general') return 'general';
    if (p === 'singular/not_found404') return '404';
    const course = p.match(/^singular\/itti-course\/(\d+)$/);
    if (course) return `course:${courseSlugById.get(Number(course[1])) ?? course[1]}`;
    const cat = p.match(/^singular\/in_category\/(\d+)$/);
    if (cat) return `post-category:${termSlugById.get(Number(cat[1])) ?? cat[1]}`;
    if (p === 'singular/post') return 'post';
    return p;
  }))];
}

const templates = [];
for (const it of of('elementor_library')) {
  const type = it.meta._elementor_template_type;
  if (!type || type === 'kit') continue;
  const kind = it.id === 3784 || conditions(it).includes('404') ? 'not-found' : KIND[type] ?? 'section';
  const t = {
    wpId: it.id,
    title: it.title,
    slug: `${slugify(it.title) || kind}-${it.id}`,
    kind,
    conditions: it.status === 'publish' ? conditions(it) : [],
    status: it.status === 'publish' ? 'published' : 'draft',
    layout: layoutOf(it),
  };
  templates.push(t);
  await out(`templates/${t.slug}.json`, t);
}
counts.templates = templates.length;

// Course → template (from theme builder conditions)
const courseTemplate = new Map<string, string>();
for (const t of templates) for (const c of t.conditions) if (c.startsWith('course:')) courseTemplate.set(c.slice(7), t.slug);

/* ─── Pages ────────────────────────────────────────────────────────────── */
for (const it of of('page')) {
  const page = {
    wpId: it.id,
    title: it.title || `Untitled ${it.id}`,
    slug: it.slug || `draft-${it.id}`,
    path: paths.get(it.id) ?? null,
    template: it.slug === 'home' ? 'home' : 'default',
    pageTemplate: pageTemplate(it),
    status: it.status === 'publish' ? 'published' : 'draft',
    seo: seo(it),
    layout: layoutOf(it),
    html: json(it.meta._elementor_data) ? undefined : html(it.content) || undefined,
    cover: mediaRef(it.meta._thumbnail_id),
  };
  await out(`pages/${page.slug}.json`, page);
  counts.pages = (counts.pages ?? 0) + 1;
}

/* ─── Courses (ACF custom post type "itti-course") ─────────────────────── */
const IMAGE_FIELDS = /image/;
for (const it of of('itti-course')) {
  const fields: Record<string, unknown> = {};
  const values = { ...acfValues('itti-course', it.id), ...it.meta };
  for (const [k, dv] of acfDefaults('itti-course')) if (!values[k]) values[k] = dv;
  for (const [k, v] of Object.entries(values)) {
    if (k.startsWith('_') || k === 'tpg-post-view-count' || k === 'mandatory_courses') continue;
    fields[k] = IMAGE_FIELDS.test(k) && /^\d+$/.test(v) ? mediaRef(v) : html(v);
  }
  const course = {
    wpId: it.id,
    title: it.title,
    slug: it.slug,
    path: paths.get(it.id) ?? null,
    status: it.status === 'publish' ? 'published' : 'draft',
    template: courseTemplate.get(it.slug) ?? null,
    publishedAt: isoDate(it.date),
    summary: it.excerpt || undefined,
    cover: mediaRef(it.meta._thumbnail_id) ?? (fields.featured_image_1 as object | undefined),
    fields,
    seo: seo(it),
    layout: layoutOf(it),
  };
  await out(`courses/${course.slug}.json`, course);
  counts.courses = (counts.courses ?? 0) + 1;
}

/* ─── Student articles (ACF CPT) ───────────────────────────────────────── */
for (const it of of('student-article')) {
  const m: Record<string, string> = { ...acfValues('student-article', it.id), ...it.meta };
  const article = {
    wpId: it.id,
    title: it.title,
    slug: it.slug,
    path: paths.get(it.id) ?? null,
    status: it.status === 'publish' ? 'published' : 'draft',
    author: { name: m.author || 'ITTI Student' },
    excerpt: m.introduction ? html(m.introduction).replace(/<[^>]+>/g, '').slice(0, 400) : undefined,
    fields: {
      author: m.author,
      article_title: m.article_title,
      introduction: m.introduction ? html(m.introduction) : undefined,
      article_pdf: /^\d+$/.test(m.article_pdf ?? '') ? mediaRef(m.article_pdf) : m.article_pdf,
      article_image: /^\d+$/.test(m.article_image ?? '') ? mediaRef(m.article_image) : undefined,
    },
    cover: mediaRef(m._thumbnail_id) ?? (/^\d+$/.test(m.article_image ?? '') ? mediaRef(m.article_image) : undefined),
    publishedAt: isoDate(it.date),
    html: html(it.content) || undefined,
    layout: layoutOf(it),
  };
  await out(`articles/${article.slug}.json`, article);
  counts.articles = (counts.articles ?? 0) + 1;
}

/* ─── News (blog posts) ────────────────────────────────────────────────── */
for (const it of of('post')) {
  const news = {
    wpId: it.id,
    title: it.title,
    slug: it.slug || `draft-${it.id}`,
    path: paths.get(it.id) ?? null,
    status: it.status === 'publish' ? 'published' : 'draft',
    excerpt: it.excerpt || html(it.content).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) || undefined,
    categories: it.categories.filter((c) => c.domain === 'category').map((c) => c.slug),
    cover: mediaRef(it.meta._thumbnail_id),
    publishedAt: isoDate(it.date),
    seo: seo(it),
    html: html(it.content) || undefined,
    layout: layoutOf(it),
  };
  await out(`news/${news.slug}.json`, news);
  counts.news = (counts.news ?? 0) + 1;
}

/* ─── Media library ────────────────────────────────────────────────────── */
const media = of('attachment').map((att) => {
  const meta = php<Record<string, any>>(att.meta._wp_attachment_metadata) ?? {};
  const p = toPath(att.attachmentUrl ?? '');
  return {
    wpId: att.id,
    path: p.replace(/^\//, ''),
    url: p,
    available: Boolean(resolveMedia(att.attachmentUrl ?? '')),
    title: att.title,
    alt: att.meta._wp_attachment_image_alt ?? '',
    width: meta.width ? Number(meta.width) : undefined,
    height: meta.height ? Number(meta.height) : undefined,
    mime: /\.pdf$/i.test(p) ? 'application/pdf' : /\.(png)$/i.test(p) ? 'image/png' : /\.webp$/i.test(p) ? 'image/webp' : /\.svg$/i.test(p) ? 'image/svg+xml' : /\.(jpe?g)$/i.test(p) ? 'image/jpeg' : 'application/octet-stream',
  };
});
await out('media.json', media);
counts.media = media.length;
counts.mediaAvailable = media.filter((m) => m.available).length;

/* ─── Site: design tokens, menus, logo, forms ──────────────────────────── */
const kits = wxr.items.filter((i) => i.type === 'elementor_library' && i.meta._elementor_template_type === 'kit');
const kit = kits.map((k) => php<Record<string, any>>(k.meta._elementor_page_settings)).find((s) => s?.system_colors) ?? {};
const tokens = buildTokens(kit, ctx.fonts);
const menus = buildMenus(wxr.items, paths, ctx.link);
const forms = buildForms([...ctx.forms.values()]);
for (const f of forms) await out(`forms/${f.slug}.json`, f);
counts.forms = forms.length;

const floating = templates.find((t) => t.kind === 'floating-buttons' && t.status === 'published');
await out('site.json', {
  name: kit.site_name || wxr.site.title,
  description: kit.site_description || wxr.site.description,
  url: SITE,
  logo: kit.site_logo?.url ? { url: ctx.media(kit.site_logo.url), alt: kit.site_name ?? '' } : undefined,
  favicon: kit.site_favicon?.url ? ctx.media(kit.site_favicon.url) : undefined,
  tokens,
  menus,
  theme: {
    header: templates.find((t) => t.kind === 'header' && t.status === 'published' && t.conditions.includes('general'))?.slug,
    footer: templates.find((t) => t.kind === 'footer' && t.status === 'published' && t.conditions.includes('general'))?.slug,
    singlePost: [...templates].reverse().find((t) => t.kind === 'single-post' && t.conditions.includes('post'))?.slug ??
      [...templates].reverse().find((t) => t.kind === 'single' && t.conditions.includes('post'))?.slug,
    archive: templates.find((t) => t.kind === 'archive' && t.status === 'published')?.slug,
    notFound: templates.find((t) => t.kind === 'not-found')?.slug,
    floating: floating?.slug,
    popups: templates.filter((t) => t.kind === 'popup' && t.status === 'published').map((t) => ({ id: t.wpId, slug: t.slug })),
    defaultCourseTemplate: templates.find((t) => /course template 2/i.test(t.title))?.slug,
  },
});

await out('manifest.json', {
  source: SITE,
  generatedAt: new Date().toISOString(),
  counts,
  unknownWidgets: Object.fromEntries(ctx.unknownWidgets),
  missingMedia: [...missing].sort(),
});
console.log('✓ Content written to', OUT);
console.table(counts);
if (ctx.unknownWidgets.size) console.log('Unknown widgets:', Object.fromEntries(ctx.unknownWidgets));
console.log(`Media: ${counts.mediaAvailable}/${counts.media} available locally, ${missing.size} referenced files use placeholders`);
