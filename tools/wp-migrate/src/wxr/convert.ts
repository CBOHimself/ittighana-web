/**
 * Elementor element tree → LayoutNode tree.
 */
import type { LayoutNode } from '@itti/schemas';
import { common, container, Rules, type Settings } from './styles';
import { contentProps, STYLE } from './widgets';

export type ConvertCtx = {
  /** Map an absolute/relative media URL to a usable value (path or placeholder token). */
  media: (url: string) => string;
  /** Same, for use inside CSS/HTML (placeholder becomes an inline SVG data URI). */
  mediaInline: (url: string) => string;
  /** Rewrite site links to relative paths. */
  link: (url: string) => string;
  /** WordPress post id → public path. */
  paths: Map<number, string>;
  /** Collected while converting. */
  fonts: Set<string>;
  forms: Map<string, { slug: string; name: string; settings: Settings; source: string }>;
  unknownWidgets: Map<string, number>;
  source: string;
};

const KNOWN = new Set([
  'heading', 'text-editor', 'button', 'icon', 'image', 'icon-list', 'nested-tabs', 'nested-accordion', 'toggle', 'accordion',
  'posts', 'call-to-action', 'icon-box', 'image-box', 'form', 'spacer', 'divider', 'image-carousel', 'gallery', 'counter',
  'blockquote', 'testimonial-carousel', 'countdown', 'html', 'google_maps', 'social-icons', 'share-buttons', 'post-info',
  'theme-post-title', 'theme-post-featured-image', 'theme-post-content', 'theme-archive-title', 'post-navigation',
  'author-box', 'nav-menu', 'contact-buttons', 'template', 'tpg-grid-layout', 'loop-grid', 'zigzag', 'shortcode',
]);

/* ─── Dynamic tags ([elementor-tag … name="acf-text" settings="…"]) ─────── */
function parseTag(tag: string): { name: string; settings: Record<string, any> } | null {
  const name = tag.match(/name="([^"]+)"/)?.[1];
  if (!name) return null;
  const raw = tag.match(/settings="([^"]*)"/)?.[1] ?? '';
  let settings: Record<string, any> = {};
  try {
    settings = raw ? JSON.parse(decodeURIComponent(raw)) : {};
  } catch {
    /* ignore */
  }
  return { name, settings };
}

function dynamicValue(tag: string, ctx: ConvertCtx): unknown {
  const t = parseTag(tag);
  if (!t) return undefined;
  const fieldName = () => String(t.settings.key ?? '').split(':').pop();
  const wrap = (v: Record<string, unknown>) => {
    const { before, after, fallback } = t.settings;
    if (typeof before === 'string' && before) v.before = before;
    if (typeof after === 'string' && after) v.after = after;
    if (v.fallback === undefined && fallback && (typeof fallback === 'string' || typeof fallback === 'object')) v.fallback = fallback;
    return v;
  };
  const dateFmt = () => {
    const { date_format, custom_format } = t.settings;
    if (date_format === 'custom' && custom_format) return String(custom_format);
    return date_format && date_format !== 'default' ? String(date_format) : undefined;
  };
  const v = dynamicBase(t, fieldName, ctx);
  if (v && typeof v === 'object' && '$dyn' in (v as object)) {
    const o = wrap(v as Record<string, unknown>);
    const f = dateFmt();
    if (f && (o.$dyn === 'now' || o.$dyn === 'date')) o.format = f;
    if (o.fallback === '' || (o.fallback && typeof o.fallback === 'object' && !(o.fallback as { url?: string }).url)) delete o.fallback;
    else if (o.fallback && typeof o.fallback === 'object') {
      const f = o.fallback as { url: string; id?: unknown; alt?: string };
      o.fallback = { url: ctx.media(f.url), alt: f.alt ?? '' };
    }
    return o;
  }
  return v;
}

function dynamicBase(t: { name: string; settings: Record<string, any> }, fieldName: () => string | undefined, ctx: ConvertCtx): unknown {
  switch (t.name) {
    case 'acf-text':
    case 'acf-url':
    case 'acf-image':
      return { $dyn: 'field', field: fieldName(), fallback: t.settings.fallback };
    case 'post-title':
      return { $dyn: 'title' };
    case 'post-excerpt':
      return { $dyn: 'excerpt' };
    case 'post-featured-image':
      return { $dyn: 'featured-image' };
    case 'post-date':
      return { $dyn: 'date' };
    case 'author-name':
      return { $dyn: 'author' };
    case 'archive-title':
      return { $dyn: 'archive-title' };
    case 'current-date-time':
      return { $dyn: 'now' };
    case 'site-url':
      return '/';
    case 'internal-url':
      return ctx.paths.get(Number(t.settings.post_id)) ?? '/';
    case 'popup':
      return `#popup-${t.settings.popup}`;
    default:
      return undefined;
  }
}

const LINK_KEYS = /(^link$)|(_link$)|(^url$)|(button_link)|(^link_to_url)/;

function applyDynamic(props: Record<string, unknown>, dyn: Record<string, string> | undefined, ctx: ConvertCtx) {
  if (!dyn || Array.isArray(dyn)) return;
  for (const [key, tag] of Object.entries(dyn)) {
    if (typeof tag !== 'string') continue;
    const v = dynamicValue(tag, ctx);
    if (v === undefined) continue;
    props[key] = LINK_KEYS.test(key) ? { ...(typeof props[key] === 'object' ? (props[key] as object) : {}), url: v } : v;
  }
}

/* ─── URL rewriting in content ─────────────────────────────────────────── */
function rewrite(value: unknown, ctx: ConvertCtx, key = ''): unknown {
  if (typeof value === 'string') {
    if (/wp-content\/uploads\//.test(value)) {
      if (/<[a-z]/i.test(value)) {
        return value.replace(/(https?:)?\/\/[^"'\s)]*?\/wp-content\/uploads\/[^"'\s)]+/g, (m) => ctx.mediaInline(m));
      }
      if (/^(https?:)?\/\/|^\/wp-content/.test(value)) return ctx.media(value);
    }
    return ctx.link(value);
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, ctx, key));
  if (value && typeof value === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' && typeof v === 'number') o[k] = v;
      else o[k] = rewrite(v, ctx, k);
    }
    // Repeater items: carry their own __dynamic__
    if ('__dynamic__' in o) {
      applyDynamic(o, (value as Settings).__dynamic__, ctx);
      delete o.__dynamic__;
    }
    return o;
  }
  return value;
}

function collectFonts(s: Settings, ctx: ConvertCtx) {
  for (const [k, v] of Object.entries(s)) if (k.endsWith('_font_family') && typeof v === 'string' && v) ctx.fonts.add(v);
}

const ANIM = (s: Settings) => {
  const a = s.animation || s._animation;
  return a && a !== 'none' ? `anim anim-${a}` : undefined;
};

/**
 * Widgets from plugins that are no longer active on the original site: WordPress keeps their
 * data but renders nothing. They are converted (so the admin can turn them back on) but hidden.
 */
const UNRENDERED_WIDGETS = new Set(['zigzag']);

function hideOf(s: Settings) {
  const h: Array<'desktop' | 'tablet' | 'mobile'> = [];
  if (s.hide_desktop) h.push('desktop');
  if (s.hide_tablet) h.push('tablet');
  if (s.hide_mobile) h.push('mobile');
  return h.length ? h : undefined;
}

function slugify(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'form';
}

export function convertTree(els: any[], ctx: ConvertCtx): LayoutNode[] {
  return (els ?? []).map((e) => convertEl(e, 0, ctx)).filter((n): n is LayoutNode => Boolean(n));
}

function convertEl(el: any, depth: number, ctx: ConvertCtx): LayoutNode | null {
  const s: Settings = el.settings && !Array.isArray(el.settings) ? el.settings : {};
  collectFonts(s, ctx);
  const isContainer = el.elType === 'container' || el.elType === 'e-flexbox' || el.elType === 'section' || el.elType === 'column';
  const rules = new Rules();
  const node: LayoutNode = { id: String(el.id), type: isContainer ? 'container' : String(el.widgetType ?? el.elType) };

  if (isContainer) {
    container(rules, s, ctx.mediaInline);
    const boxed = s.content_width ? s.content_width === 'boxed' : depth === 0;
    const props: Record<string, unknown> = { boxed };
    if (s.html_tag) props.tag = s.html_tag;
    if (s.link?.url) props.link = rewrite(s.link, ctx);
    if (s.background_overlay_background) props.overlay = true;
    if (s.background_video_link) props.backgroundVideo = s.background_video_link;
    if (el.elType === 'e-flexbox') props.atomic = true;
    applyDynamic(props, s.__dynamic__, ctx);
    node.props = props;
    node.children = (el.elements ?? []).map((c: any) => convertEl(c, depth + 1, ctx)).filter(Boolean) as LayoutNode[];
  } else {
    const w = node.type;
    if (!KNOWN.has(w)) ctx.unknownWidgets.set(w, (ctx.unknownWidgets.get(w) ?? 0) + 1);
    common(rules, s, true, ctx.mediaInline);
    STYLE[w]?.(rules, s, { mediaUrl: ctx.mediaInline });
    const props = rewrite(contentProps(s), ctx) as Record<string, unknown>;
    applyDynamic(props, s.__dynamic__, ctx);

    // Elementor Pro forms → our form engine (one form per widget)
    if (w === 'form') {
      const name = String(s.form_name || 'Form');
      let slug = slugify(`${name}-${ctx.source}`);
      if (ctx.forms.has(slug) && ctx.forms.get(slug)!.source !== ctx.source) slug += `-${el.id}`;
      ctx.forms.set(slug, { slug, name, settings: s, source: ctx.source });
      props.formSlug = slug;
    }
    // Nested widgets (tabs/accordion) keep their child containers
    if (el.elements?.length) node.children = el.elements.map((c: any) => convertEl(c, depth + 1, ctx)).filter(Boolean) as LayoutNode[];
    node.props = props;
  }

  const styles = rules.list();
  if (styles.length) node.styles = styles;
  const cls = [ANIM(s), typeof s._css_classes === 'string' ? s._css_classes : undefined, typeof s.css_classes === 'string' ? s.css_classes : undefined]
    .filter(Boolean)
    .join(' ');
  if (cls) node.className = cls;
  const hide = UNRENDERED_WIDGETS.has(node.type) ? (['desktop', 'tablet', 'mobile'] as const).slice() : hideOf(s);
  if (hide) node.hide = hide;
  if (typeof s.custom_css === 'string' && s.custom_css.trim()) node.customCss = s.custom_css.replace(/selector/g, `.n-${el.id}`);
  return node;
}
