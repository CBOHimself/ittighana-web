import { googleFontsHref, Layout, layoutCss, type ListItem, type RecordContext, type RenderContext } from '@itti/blocks/layout';
import type { LayoutNode } from '@itti/schemas';
import { publicApiUrl, api } from './api';
import { IMAGE_FALLBACKS } from './brand';
import { getSettings, getTemplateByWpId, MEDIA_BASE, SITE_URL } from './site';
import type { RoutedRecord } from './types';

/** Build the render context shared by every layout region on a request. */
export async function makeContext(path: string, record?: RecordContext): Promise<RenderContext> {
  const s = await getSettings();
  return {
    mediaBase: MEDIA_BASE,
    apiUrl: publicApiUrl,
    siteUrl: SITE_URL,
    path,
    record,
    menus: s.menus ?? {},
    tokens: s.tokens,
    data: {},
    templates: {},
    imageFallbacks: IMAGE_FALLBACKS,
  };
}

export function toRecordContext(kind: RecordContext['kind'], r: RoutedRecord): RecordContext {
  return {
    kind,
    title: r.title,
    slug: r.slug,
    path: r.path,
    excerpt: r.excerpt ?? r.summary,
    cover: r.cover,
    // Events are dated by their start; everything else by its publish date.
    publishedAt: r.publishedAt ?? (r as { start?: string }).start,
    author: r.author?.name ?? (typeof r.fields?.author === 'string' ? (r.fields.author as string) : undefined),
    fields: r.fields,
    html: r.html,
    layout: r.layout,
  };
}

const LIST_TYPE = (t?: unknown) =>
  t === 'itti-course' ? 'course' : t === 'student-article' ? 'article' : t === 'event' || t === 'career' ? t : t === 'page' ? null : 'news';

const toItem = (r: RoutedRecord, kind: RecordContext['kind']): ListItem => ({ _id: r._id, ...toRecordContext(kind, r) });

/**
 * Walk a layout and fetch what its data-driven widgets need (posts lists,
 * loop grids, embedded templates, post navigation) into ctx.data / ctx.templates.
 */
export async function prepare(nodes: LayoutNode[] | undefined, ctx: RenderContext, depth = 0): Promise<void> {
  if (!nodes?.length || depth > 3) return;
  const jobs: Promise<unknown>[] = [];
  const loadTemplate = async (id: unknown) => {
    const key = String(id ?? '');
    if (!key || ctx.templates[key]) return;
    ctx.templates[key] = [];
    const t = await getTemplateByWpId(key);
    ctx.templates[key] = t?.layout ?? [];
    await prepare(ctx.templates[key], ctx, depth + 1);
  };
  const list = (type: string | null, query: Record<string, string | number | undefined>) =>
    type ? api<RoutedRecord[]>(`/list/${type}`, { tags: ['content'], query }).catch(() => []) : Promise.resolve([]);

  const walk = (n: LayoutNode) => {
    const p = (n.props ?? {}) as Record<string, any>;
    switch (n.type) {
      case 'posts': {
        const skin = p._skin || 'classic';
        const type = LIST_TYPE(p.posts_post_type ?? 'post');
        const limit = Number(p[`${skin}_posts_per_page`] ?? 6);
        const exclude = Array.isArray(p.posts_exclude) && p.posts_exclude.includes('current_post') ? ctx.record?.path ?? undefined : undefined;
        jobs.push(list(type, { limit, exclude: exclude ?? undefined }).then((items) => (ctx.data[n.id] = items.map((i) => toItem(i, type === 'course' ? 'course' : type === 'article' ? 'article' : 'news')))));
        break;
      }
      case 'tpg-grid-layout':
        jobs.push(list('news', { limit: Number(p.post_limit ?? 9) }).then((items) => (ctx.data[n.id] = items.map((i) => toItem(i, 'news')))));
        break;
      case 'loop-grid': {
        const type = LIST_TYPE(p.post_query_post_type ?? 'post');
        jobs.push(list(type, { limit: Number(p.posts_per_page ?? 9) }).then((items) => (ctx.data[n.id] = items.map((i) => toItem(i, type === 'article' ? 'article' : type === 'course' ? 'course' : 'news')))));
        jobs.push(loadTemplate(p.template_id));
        break;
      }
      case 'template':
        jobs.push(loadTemplate(p.template_id));
        break;
      case 'post-navigation':
        jobs.push(
          list('news', { limit: 100 }).then((items) => {
            const i = items.findIndex((x) => x.path === ctx.record?.path);
            ctx.data[n.id] = i < 0 ? {} : { prev: items[i + 1] && toItem(items[i + 1]!, 'news'), next: items[i - 1] && toItem(items[i - 1]!, 'news') };
          }),
        );
        break;
    }
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  if (ctx.record?.layout && depth === 0) ctx.record.layout.forEach(walk);
  await Promise.all(jobs);
}

/** A rendered layout region with its scoped CSS. */
export function Region({ nodes, ctx, as: Tag = 'div', className = '' }: { nodes: LayoutNode[] | undefined; ctx: RenderContext; as?: 'div' | 'header' | 'footer' | 'main'; className?: string }) {
  if (!nodes?.length) return null;
  const bps = ctx.tokens?.breakpoints;
  const css = [layoutCss(nodes, bps), ...Object.values(ctx.templates).map((t) => layoutCss(t, bps)), ctx.record?.layout ? layoutCss(ctx.record.layout, bps) : ''].join('\n');
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Tag className={`lay ${className}`}>
        <Layout nodes={nodes} ctx={ctx} />
      </Tag>
    </>
  );
}

export const fontsHref = (fonts: string[] | undefined) => googleFontsHref(fonts ?? []);
