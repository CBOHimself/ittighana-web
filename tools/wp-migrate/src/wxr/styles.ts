/**
 * Elementor settings → scoped CSS rules.
 *
 * Elementor stores design as flat settings ("padding", "title_color",
 * "typography_font_size_tablet", "__globals__"…). This turns them into
 * StyleRule[] for our renderer, preserving responsive overrides and global
 * colour/typography references (as CSS variables).
 */
import type { StyleRule } from '@itti/schemas';

export type Settings = Record<string, any>;
type BP = 'base' | 'tablet' | 'mobile';
const BPS: Array<[BP, string]> = [
  ['base', ''],
  ['tablet', '_tablet'],
  ['mobile', '_mobile'],
];

export class Rules {
  private map = new Map<string, Record<string, string>>();
  set(sel: string, bp: BP, prop: string, value: string | undefined | null) {
    if (value === undefined || value === null || value === '') return;
    const k = `${bp}|${sel}`;
    const css = this.map.get(k) ?? {};
    css[prop] = value;
    this.map.set(k, css);
  }
  merge(other: Rules) {
    for (const r of other.list()) for (const [p, v] of Object.entries(r.css)) this.set(r.sel, r.bp, p, v);
  }
  list(): StyleRule[] {
    return [...this.map.entries()].map(([k, css]) => {
      const [bp, ...rest] = k.split('|');
      return { bp: bp as BP, sel: rest.join('|'), css };
    });
  }
}

const num = (v: unknown) => v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v));

/** {unit,size} → "12px" */
export function dim(v: any): string | undefined {
  if (!v || typeof v !== 'object') return undefined;
  if (v.unit === 'custom') return v.size ? String(v.size) : undefined;
  if (!num(v.size)) return undefined;
  return `${v.size}${v.unit ?? 'px'}`;
}

/** {unit,top,right,bottom,left} → "1px 2px 3px 4px" */
export function box(v: any): string | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const sides = ['top', 'right', 'bottom', 'left'].map((s) => v[s]);
  if (sides.every((x) => x === '' || x === undefined || x === null)) return undefined;
  const u = v.unit ?? 'px';
  return sides.map((x) => (num(x) ? `${x}${u}` : '0')).join(' ');
}

/** Resolve a colour setting, honouring __globals__. */
export function color(s: Settings, key: string): string | undefined {
  const g = s.__globals__?.[key];
  if (typeof g === 'string' && g.startsWith('globals/colors?id=')) return `var(--e-global-color-${g.split('=')[1]})`;
  const v = s[key];
  return typeof v === 'string' && v ? v : undefined;
}

/** Typography group ("typography", "title_typography", …) → rules on `sel`. */
export function typography(r: Rules, s: Settings, prefix: string, sel: string) {
  const g = s.__globals__?.[`${prefix}_typography`];
  if (typeof g === 'string' && g.startsWith('globals/typography?id=')) {
    const id = g.split('=')[1];
    for (const p of ['font-family', 'font-size', 'font-weight', 'text-transform', 'font-style', 'text-decoration', 'line-height', 'letter-spacing', 'word-spacing'])
      r.set(sel, 'base', p, `var(--e-global-typography-${id}-${p})`);
    return;
  }
  if (s[`${prefix}_typography`] !== 'custom') return;
  for (const [bp, suf] of BPS) {
    if (bp === 'base') {
      const fam = s[`${prefix}_font_family`];
      if (fam) r.set(sel, bp, 'font-family', `"${fam}", sans-serif`);
      r.set(sel, bp, 'font-weight', s[`${prefix}_font_weight${suf}`]);
      r.set(sel, bp, 'text-transform', s[`${prefix}_text_transform${suf}`]);
      r.set(sel, bp, 'font-style', s[`${prefix}_font_style${suf}`]);
      r.set(sel, bp, 'text-decoration', s[`${prefix}_text_decoration${suf}`]);
    }
    r.set(sel, bp, 'font-size', dim(s[`${prefix}_font_size${suf}`]));
    r.set(sel, bp, 'line-height', dim(s[`${prefix}_line_height${suf}`]));
    r.set(sel, bp, 'letter-spacing', dim(s[`${prefix}_letter_spacing${suf}`]));
    r.set(sel, bp, 'word-spacing', dim(s[`${prefix}_word_spacing${suf}`]));
  }
}

/** Apply fn for the desktop, tablet and mobile variants of a setting. */
export function responsive(s: Settings, key: string, fn: (v: any, bp: BP) => void) {
  for (const [bp, suf] of BPS) {
    const v = s[key + suf];
    if (v !== undefined && v !== '' && v !== null) fn(v, bp);
  }
}

/** Background group (classic/gradient) on `sel`. prefix: "background" | "_background" | "background_overlay" | "background_hover" */
export function background(r: Rules, s: Settings, prefix: string, sel: string, mediaUrl: (u: string) => string) {
  const kind = s[`${prefix}_background`];
  if (kind === 'classic') {
    r.set(sel, 'base', 'background-color', color(s, `${prefix}_color`));
    for (const [bp, suf] of BPS) {
      const img = s[`${prefix}_image${suf}`];
      if (img?.url) r.set(sel, bp, 'background-image', `url("${mediaUrl(img.url)}")`);
      const pos = s[`${prefix}_position${suf}`];
      if (pos && pos !== 'initial') r.set(sel, bp, 'background-position', pos);
      const size = s[`${prefix}_size${suf}`];
      if (size && size !== 'initial') r.set(sel, bp, 'background-size', size);
      const rep = s[`${prefix}_repeat${suf}`];
      if (rep) r.set(sel, bp, 'background-repeat', rep);
      const att = s[`${prefix}_attachment${suf}`];
      if (att) r.set(sel, bp, 'background-attachment', att);
    }
  } else if (kind === 'gradient') {
    const a = color(s, `${prefix}_color`) ?? 'transparent';
    const b = color(s, `${prefix}_color_b`) ?? '#f2295b';
    const sa = dim(s[`${prefix}_color_stop`]) ?? '0%';
    const sb = dim(s[`${prefix}_color_b_stop`]) ?? '100%';
    const type = s[`${prefix}_gradient_type`] ?? 'linear';
    const g =
      type === 'radial'
        ? `radial-gradient(at ${s[`${prefix}_gradient_position`] ?? 'center center'}, ${a} ${sa}, ${b} ${sb})`
        : `linear-gradient(${dim(s[`${prefix}_gradient_angle`]) ?? '180deg'}, ${a} ${sa}, ${b} ${sb})`;
    r.set(sel, 'base', 'background-color', 'transparent');
    r.set(sel, 'base', 'background-image', g);
  }
}

export function border(r: Rules, s: Settings, prefix: string, sel: string) {
  const type = s[`${prefix}_border`];
  if (type && type !== 'none') {
    r.set(sel, 'base', 'border-style', type);
    responsive(s, `${prefix}_width`, (v, bp) => r.set(sel, bp, 'border-width', box(v)));
    r.set(sel, 'base', 'border-color', color(s, `${prefix}_color`));
  } else if (type === 'none') r.set(sel, 'base', 'border-style', 'none');
}

export function radius(r: Rules, s: Settings, key: string, sel: string) {
  responsive(s, key, (v, bp) => r.set(sel, bp, 'border-radius', box(v)));
}

export function shadow(r: Rules, s: Settings, prefix: string, sel: string) {
  if (s[`${prefix}_box_shadow_type`] !== 'yes') return;
  const v = s[`${prefix}_box_shadow`] ?? {};
  r.set(sel, 'base', 'box-shadow', `${v.position === 'inset' ? 'inset ' : ''}${v.horizontal ?? 0}px ${v.vertical ?? 0}px ${v.blur ?? 10}px ${v.spread ?? 0}px ${v.color ?? 'rgba(0,0,0,0.5)'}`);
}

export function textShadow(r: Rules, s: Settings, prefix: string, sel: string) {
  if (s[`${prefix}_text_shadow_type`] !== 'yes') return;
  const v = s[`${prefix}_text_shadow`] ?? {};
  r.set(sel, 'base', 'text-shadow', `${v.horizontal ?? 0}px ${v.vertical ?? 0}px ${v.blur ?? 10}px ${v.color ?? 'rgba(0,0,0,0.3)'}`);
}

const FLEX_SIZE: Record<string, string> = { grow: '1 0 0', shrink: '0 1 auto', none: '0 0 auto' };

/** Settings shared by every element: spacing, sizing, position, background, border. */
export function common(r: Rules, s: Settings, isWidget: boolean, mediaUrl: (u: string) => string) {
  const p = isWidget ? '_' : '';
  responsive(s, `${p}margin`, (v, bp) => r.set('', bp, 'margin', box(v)));
  responsive(s, `${p}padding`, (v, bp) => r.set('', bp, isWidget ? 'padding' : '--padding', box(v)));
  responsive(s, '_z_index', (v, bp) => r.set('', bp, 'z-index', String(v)));
  responsive(s, 'z_index', (v, bp) => r.set('', bp, 'z-index', String(v)));

  if (isWidget) {
    responsive(s, '_element_width', (v, bp) => {
      if (v === 'auto') r.set('', bp, 'width', 'auto');
      if (v === 'inherit') r.set('', bp, 'width', '100%');
    });
    // Custom width only applies where the (cascaded) width mode is "initial" (Custom).
    const modeAt = { base: s._element_width, tablet: s._element_width_tablet ?? s._element_width, mobile: s._element_width_mobile ?? s._element_width_tablet ?? s._element_width } as Record<string, unknown>;
    responsive(s, '_element_custom_width', (v, bp) => {
      if (modeAt[bp] !== 'initial') return;
      r.set('', bp, 'width', dim(v));
      r.set('', bp, 'max-width', '100%');
    });
    for (const bp of ['tablet', 'mobile'] as const) {
      if (modeAt[bp] === 'initial' && modeAt.base !== 'initial' && s[bp === 'tablet' ? '_element_custom_width_tablet' : '_element_custom_width_mobile'] === undefined && s._element_custom_width) {
        r.set('', bp, 'width', dim(s._element_custom_width));
        r.set('', bp, 'max-width', '100%');
      }
    }
    background(r, s, '_background', '', mediaUrl);
    border(r, s, '_border', '');
    radius(r, s, '_border_radius', '');
    shadow(r, s, '_box_shadow', '');
  }
  responsive(s, '_flex_size', (v, bp) => FLEX_SIZE[v] && r.set('', bp, 'flex', FLEX_SIZE[v]));
  if (s._flex_size === 'custom') {
    r.set('', 'base', 'flex-grow', s._flex_grow);
    r.set('', 'base', 'flex-shrink', s._flex_shrink);
  }
  responsive(s, '_flex_align_self', (v, bp) => r.set('', bp, 'align-self', v));
  responsive(s, '_flex_order', (v, bp) => r.set('', bp, 'order', v === 'start' ? '-99999' : v === 'end' ? '99999' : String(s._flex_order_custom ?? 0)));

  const pos = s._position ?? s.position;
  if (pos === 'absolute' || pos === 'fixed') {
    r.set('', 'base', 'position', pos);
    const h = s._offset_orientation_h === 'end' ? 'right' : 'left';
    const v = s._offset_orientation_v === 'end' ? 'bottom' : 'top';
    responsive(s, h === 'left' ? '_offset_x' : '_offset_x_end', (x, bp) => r.set('', bp, h, dim(x)));
    responsive(s, v === 'top' ? '_offset_y' : '_offset_y_end', (y, bp) => r.set('', bp, v, dim(y)));
  } else {
    // Relative offsets (motion "offset" without absolute positioning) are ignored like Elementor does.
  }
  if (s.overflow === 'hidden') r.set('', 'base', 'overflow', 'hidden');
}

/** Container (flexbox) settings → CSS variables consumed by the base container CSS. */
export function container(r: Rules, s: Settings, mediaUrl: (u: string) => string) {
  common(r, s, false, mediaUrl);
  responsive(s, 'flex_direction', (v, bp) => r.set('', bp, '--flex-direction', v));
  responsive(s, 'flex_wrap', (v, bp) => r.set('', bp, '--flex-wrap', v));
  responsive(s, 'flex_justify_content', (v, bp) => r.set('', bp, '--justify-content', v));
  responsive(s, 'flex_align_items', (v, bp) => r.set('', bp, '--align-items', v));
  responsive(s, 'flex_align_content', (v, bp) => r.set('', bp, '--align-content', v));
  responsive(s, 'flex_gap', (v, bp) => {
    const u = v.unit ?? 'px';
    if (num(v.row)) r.set('', bp, '--row-gap', `${v.row}${u}`);
    if (num(v.column)) r.set('', bp, '--column-gap', `${v.column}${u}`);
    if (!num(v.row) && num(v.size)) r.set('', bp, '--gap', `${v.size}${u}`);
  });
  responsive(s, 'width', (v, bp) => r.set('', bp, '--width', dim(v)));
  responsive(s, 'boxed_width', (v, bp) => r.set('', bp, '--content-width', dim(v)));
  responsive(s, 'min_height', (v, bp) => r.set('', bp, '--min-height', dim(v)));
  background(r, s, 'background', '', mediaUrl);
  background(r, s, 'background_hover', ':hover', mediaUrl);
  if (s.background_overlay_background) {
    background(r, s, 'background_overlay', '::before', mediaUrl);
    r.set('::before', 'base', 'opacity', s.background_overlay_opacity?.size !== undefined ? String(s.background_overlay_opacity.size) : '0.5');
  }
  border(r, s, 'border', '');
  border(r, s, 'border_hover', ':hover');
  radius(r, s, 'border_radius', '');
  radius(r, s, 'border_radius_hover', ':hover');
  shadow(r, s, 'box_shadow', '');
  shadow(r, s, 'box_shadow_hover', ':hover');
  if (s.border_hover_transition?.size !== undefined) r.set('', 'base', 'transition', `all ${s.border_hover_transition.size}s`);
}
