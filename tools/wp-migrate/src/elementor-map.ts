import type { Block, MediaRef } from '@itti/schemas';
import { randomUUID } from 'node:crypto';

/** Minimal Elementor data model (from the `_elementor_data` post meta JSON). */
export type ElNode = {
  id: string;
  elType: 'section' | 'column' | 'container' | 'widget';
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElNode[];
};

export type MapContext = {
  rewriteUrl: (url: string) => string;
  unmapped: Map<string, number>;
};

const id = () => randomUUID().slice(0, 8);
const s = (v: unknown) => (typeof v === 'string' ? v : '');

function img(v: unknown, ctx: MapContext): MediaRef | undefined {
  const o = v as { url?: string; alt?: string } | undefined;
  if (!o?.url) return undefined;
  return { url: ctx.rewriteUrl(o.url), alt: o.alt ?? '' };
}

function link(v: unknown) {
  const o = v as { url?: string } | undefined;
  return o?.url ?? '#';
}

/**
 * Map one Elementor widget to zero or more blocks.
 * Add cases here as the inventory reveals widget types used on ittighana.com.
 */
function mapWidget(w: ElNode, ctx: MapContext): Block[] {
  const st = w.settings ?? {};
  switch (w.widgetType) {
    case 'heading': {
      const tag = s(st.header_size) || 'h2';
      return [{ id: id(), type: 'richText', html: `<${tag}>${s(st.title)}</${tag}>` }];
    }
    case 'text-editor':
      return [{ id: id(), type: 'richText', html: ctx.rewriteUrl(s(st.editor)) }];
    case 'image': {
      const m = img(st.image, ctx);
      return m ? [{ id: id(), type: 'image', image: m, caption: s(st.caption) || undefined, href: (st.link as { url?: string })?.url }] : [];
    }
    case 'image-gallery':
    case 'gallery': {
      const list = (st.gallery ?? st.wp_gallery ?? []) as Array<{ url: string; alt?: string }>;
      return [{ id: id(), type: 'imageGallery', images: list.map((m) => ({ url: ctx.rewriteUrl(m.url), alt: m.alt ?? '' })), columns: Number(st.gallery_columns ?? 3) || 3, lightbox: true }];
    }
    case 'button':
      return [{ id: id(), type: 'cta', heading: '', button: { label: s(st.text) || 'Learn more', href: link(st.link) }, variant: 'primary' }];
    case 'video':
      return [{ id: id(), type: 'video', url: s(st.youtube_url) || s(st.vimeo_url) || s((st.hosted_url as { url?: string })?.url) }];
    case 'accordion':
    case 'toggle': {
      const tabs = (st.tabs ?? []) as Array<{ tab_title: string; tab_content: string }>;
      return [{ id: id(), type: 'faq', items: tabs.map((t) => ({ question: t.tab_title, answer: t.tab_content })) }];
    }
    case 'counter':
      return [{ id: id(), type: 'stats', items: [{ value: `${s(st.prefix)}${String(st.ending_number ?? '')}${s(st.suffix)}`, label: s(st.title) }] }];
    case 'testimonial':
      return [{ id: id(), type: 'testimonial', items: [{ quote: s(st.testimonial_content), name: s(st.testimonial_name), role: s(st.testimonial_job) || undefined, photo: img(st.testimonial_image, ctx) }] }];
    case 'icon-box':
    case 'image-box':
      return [{ id: id(), type: 'featureGrid', items: [{ title: s(st.title_text), text: s(st.description_text), image: img(st.image, ctx), href: (st.link as { url?: string })?.url }], columns: 1 }];
    case 'call-to-action':
      return [{ id: id(), type: 'cta', heading: s(st.title), text: s(st.description), button: { label: s(st.button) || 'Learn more', href: link(st.link) }, variant: 'primary' }];
    case 'spacer':
    case 'divider':
      return [{ id: id(), type: 'spacer', size: 'md' }];
    case 'html':
    case 'shortcode':
      return [{ id: id(), type: 'richText', html: s(st.html) || s(st.shortcode) }];
    default:
      ctx.unmapped.set(w.widgetType ?? 'unknown', (ctx.unmapped.get(w.widgetType ?? 'unknown') ?? 0) + 1);
      return [];
  }
}

/**
 * Walk the Elementor tree. Top-level sections with a background image and a
 * heading become a Hero block; everything else is flattened in order, then
 * adjacent single-item stats/featureGrid blocks are merged (Elementor puts
 * each counter / icon box in its own column).
 */
export function elementorToBlocks(tree: ElNode[], ctx: MapContext): Block[] {
  const out: Block[] = [];

  const walk = (n: ElNode, depth: number) => {
    if (n.elType === 'widget') {
      out.push(...mapWidget(n, ctx));
      return;
    }
    const bg = img((n.settings ?? {}).background_image, ctx);
    if (depth === 0 && bg) {
      const widgets = flatten(n).filter((w) => w.elType === 'widget');
      const heading = widgets.find((w) => w.widgetType === 'heading');
      if (heading) {
        const text = widgets.find((w) => w.widgetType === 'text-editor');
        const buttons = widgets.filter((w) => w.widgetType === 'button');
        out.push({
          id: id(),
          type: 'hero',
          heading: stripTags(s(heading.settings?.title)),
          subheading: text ? stripTags(s(text.settings?.editor)) : undefined,
          image: bg,
          primaryCta: buttons[0] ? { label: s(buttons[0].settings?.text), href: link(buttons[0].settings?.link) } : undefined,
          secondaryCta: buttons[1] ? { label: s(buttons[1].settings?.text), href: link(buttons[1].settings?.link) } : undefined,
          align: 'left',
          overlay: true,
        });
        for (const w of widgets) if (w !== heading && w !== text && !buttons.includes(w)) out.push(...mapWidget(w, ctx));
        return;
      }
    }
    for (const c of n.elements ?? []) walk(c, depth + 1);
  };
  for (const n of tree) walk(n, 0);
  return mergeAdjacent(out);
}

function flatten(n: ElNode): ElNode[] {
  return [n, ...(n.elements ?? []).flatMap(flatten)];
}

const stripTags = (h: string) => h.replace(/<[^>]+>/g, '').trim();

function mergeAdjacent(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    const prev = out[out.length - 1];
    if (prev?.type === 'stats' && b.type === 'stats') prev.items.push(...b.items);
    else if (prev?.type === 'featureGrid' && b.type === 'featureGrid') {
      prev.items.push(...b.items);
      prev.columns = Math.min(prev.items.length, 4);
    } else if (prev?.type === 'richText' && b.type === 'richText') prev.html += `\n${b.html}`;
    else out.push(b);
  }
  return out;
}
