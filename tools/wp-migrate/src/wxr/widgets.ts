/**
 * Per-widget mapping: which Elementor settings are content (→ props) and how
 * style settings become CSS rules on the widget's inner parts.
 *
 * Inner-part class names here must match the components in
 * packages/blocks/src/layout/widgets.
 */
import { background, border, box, color, dim, radius, responsive, Rules, shadow, textShadow, typography, type Settings } from './styles';

type Ctx = { mediaUrl: (u: string) => string };
type StyleFn = (r: Rules, s: Settings, ctx: Ctx) => void;
const id = (u: string) => u;

const align = (r: Rules, s: Settings, key = 'align', sel = '') =>
  responsive(s, key, (v, bp) => r.set(sel, bp, 'text-align', v));
const JUSTIFY: Record<string, string> = { left: 'flex-start', start: 'flex-start', center: 'center', right: 'flex-end', end: 'flex-end', justify: 'space-between', stretch: 'stretch' };
const flexAlign = (r: Rules, s: Settings, key: string, sel: string) =>
  responsive(s, key, (v, bp) => r.set(sel, bp, 'justify-content', JUSTIFY[v as string] ?? v));
const sz = (r: Rules, s: Settings, key: string, sel: string, prop: string) => responsive(s, key, (v, bp) => r.set(sel, bp, prop, dim(v)));
const bx = (r: Rules, s: Settings, key: string, sel: string, prop: string) => responsive(s, key, (v, bp) => r.set(sel, bp, prop, box(v)));
const col = (r: Rules, s: Settings, key: string, sel: string, prop = 'color') => r.set(sel, 'base', prop, color(s, key));

export const STYLE: Record<string, StyleFn> = {
  heading: (r, s) => {
    align(r, s);
    col(r, s, 'title_color', ' .w-title');
    typography(r, s, 'typography', ' .w-title');
    textShadow(r, s, 'text_shadow', ' .w-title');
  },
  'text-editor': (r, s) => {
    align(r, s);
    col(r, s, 'text_color', '');
    typography(r, s, 'typography', '');
    col(r, s, 'link_color', ' a');
    col(r, s, 'link_hover_color', ' a:hover');
    sz(r, s, 'paragraph_spacing', ' p', 'margin-bottom');
  },
  button: (r, s) => {
    responsive(s, 'align', (v, bp) => {
      if (v === 'justify') r.set(' .w-btn', bp, 'width', '100%');
      else r.set('', bp, 'text-align', v);
    });
    const b = ' .w-btn';
    r.set(b, 'base', 'background-color', color(s, 'background_color'));
    if (s.background_background === 'gradient') background(r, s, 'background', b, id);
    r.set(b, 'base', 'color', color(s, 'button_text_color'));
    r.set(b + ' svg', 'base', 'fill', color(s, 'button_text_color'));
    typography(r, s, 'typography', b);
    border(r, s, 'border', b);
    radius(r, s, 'border_radius', b);
    bx(r, s, 'text_padding', b, 'padding');
    shadow(r, s, 'button_box_shadow', b);
    textShadow(r, s, 'text_shadow', b);
    r.set(b + ':hover', 'base', 'background-color', color(s, 'button_background_hover_color'));
    r.set(b + ':hover', 'base', 'color', color(s, 'hover_color'));
    r.set(b + ':hover', 'base', 'border-color', color(s, 'button_hover_border_color'));
    sz(r, s, 'icon_indent', b, 'gap');
  },
  icon: (r, s) => {
    align(r, s);
    const i = ' .w-icon';
    r.set(i, 'base', 'color', color(s, 'primary_color'));
    r.set(i + ' svg', 'base', 'fill', color(s, 'primary_color'));
    r.set(i + ':hover', 'base', 'color', color(s, 'hover_primary_color'));
    sz(r, s, 'size', i, 'font-size');
    if (s.view === 'stacked') {
      r.set(i, 'base', 'background-color', color(s, 'primary_color') ?? '#69727d');
      r.set(i, 'base', 'color', color(s, 'secondary_color') ?? '#fff');
    }
    if (s.view === 'framed') {
      r.set(i, 'base', 'border', `${dim(s.border_width) ?? '3px'} solid ${color(s, 'primary_color') ?? '#69727d'}`);
      r.set(i, 'base', 'background-color', color(s, 'secondary_color'));
    }
    sz(r, s, 'icon_padding', i, 'padding');
    radius(r, s, 'border_radius', i);
    if (s.rotate?.size) r.set(i + ' > *', 'base', 'transform', `rotate(${s.rotate.size}${s.rotate.unit ?? 'deg'})`);
  },
  image: (r, s) => {
    align(r, s);
    sz(r, s, 'width', ' img', 'width');
    sz(r, s, 'space', ' img', 'max-width');
    sz(r, s, 'height', ' img', 'height');
    responsive(s, 'object-fit', (v, bp) => r.set(' img', bp, 'object-fit', v));
    responsive(s, 'object-position', (v, bp) => r.set(' img', bp, 'object-position', v));
    radius(r, s, 'image_border_radius', ' img');
    border(r, s, 'image_border', ' img');
    shadow(r, s, 'image_box_shadow', ' img');
    if (s.opacity?.size !== undefined) r.set(' img', 'base', 'opacity', String(s.opacity.size));
    col(r, s, 'caption_color', ' figcaption');
    typography(r, s, 'caption_typography', ' figcaption');
  },
  'icon-list': (r, s) => {
    sz(r, s, 'space_between', ' .w-il-item:not(:last-child)', 'padding-bottom');
    if (s.view === 'inline') {
      r.set(' .w-il', 'base', 'flex-direction', 'row');
      r.set(' .w-il', 'base', 'flex-wrap', 'wrap');
      sz(r, s, 'space_between', ' .w-il', 'column-gap');
    }
    flexAlign(r, s, 'icon_align', ' .w-il-item');
    col(r, s, 'icon_color', ' .w-il-icon');
    r.set(' .w-il-icon svg', 'base', 'fill', color(s, 'icon_color'));
    col(r, s, 'icon_color_hover', ' .w-il-item:hover .w-il-icon');
    sz(r, s, 'icon_size', ' .w-il-icon', 'font-size');
    sz(r, s, 'icon_size', ' .w-il-icon svg', 'width');
    col(r, s, 'text_color', ' .w-il-text');
    col(r, s, 'text_color_hover', ' .w-il-item:hover .w-il-text');
    sz(r, s, 'text_indent', ' .w-il-text', 'padding-inline-start');
    typography(r, s, 'icon_typography', ' .w-il-item');
    if (s.divider === 'yes') r.set(' .w-il-item:not(:last-child)', 'base', 'border-bottom', `${dim(s.divider_weight) ?? '1px'} ${s.divider_style ?? 'solid'} ${color(s, 'divider_color') ?? '#ddd'}`);
  },
  'nested-tabs': (r, s) => {
    const t = ' .w-tab';
    r.set(t, 'base', 'background-color', color(s, 'tabs_title_background_color_color'));
    r.set(t, 'base', 'color', color(s, 'title_text_color'));
    typography(r, s, 'title_typography', t);
    border(r, s, 'tabs_title_border', t);
    radius(r, s, 'tabs_title_border_radius', t);
    bx(r, s, 'tabs_title_padding', t, 'padding');
    r.set(t + ':hover', 'base', 'background-color', color(s, 'tabs_title_background_color_hover_color'));
    r.set(t + ':hover', 'base', 'color', color(s, 'title_text_color_hover'));
    border(r, s, 'tabs_title_border_hover', t + ':hover');
    const a = ' .w-tab[aria-selected="true"]';
    r.set(a, 'base', 'background-color', color(s, 'tabs_title_background_color_active_color'));
    r.set(a, 'base', 'color', color(s, 'title_text_color_active'));
    border(r, s, 'tabs_title_border_active', a);
    sz(r, s, 'tabs_title_space_between', ' .w-tabs-heading', 'gap');
    sz(r, s, 'tabs_title_spacing', ' .w-tabs-heading', 'margin-bottom');
    responsive(s, 'tabs_justify_horizontal', (v, bp) => r.set(' .w-tabs-heading', bp, 'justify-content', JUSTIFY[v as string] ?? v));
    responsive(s, 'title_alignment', (v, bp) => r.set(t, bp, 'text-align', v));
    background(r, s, 'box_background_color', ' .w-tab-panel', id);
    border(r, s, 'box_border', ' .w-tab-panel');
    bx(r, s, 'box_padding', ' .w-tab-panel', 'padding');
  },
  'nested-accordion': (r, s) => {
    const t = ' .w-acc-title';
    r.set(t, 'base', 'background-color', color(s, 'accordion_background_normal_color'));
    r.set(t, 'base', 'color', color(s, 'normal_title_color'));
    typography(r, s, 'title_typography', t);
    border(r, s, 'accordion_border_normal', t);
    bx(r, s, 'accordion_padding', t, 'padding');
    sz(r, s, 'accordion_item_title_space_between', ' .w-acc', 'gap');
    r.set(' .w-acc-item[open] .w-acc-title', 'base', 'background-color', color(s, 'accordion_background_active_color'));
    r.set(' .w-acc-item[open] .w-acc-title', 'base', 'color', color(s, 'active_title_color'));
  },
  toggle: (r, s) => {
    col(r, s, 'title_color', ' .w-acc-title');
    r.set(' .w-acc-title', 'base', 'background-color', color(s, 'title_background'));
    typography(r, s, 'title_typography', ' .w-acc-title');
    col(r, s, 'content_color', ' .w-acc-body');
    typography(r, s, 'content_typography', ' .w-acc-body');
  },
  'call-to-action': (r, s) => {
    sz(r, s, 'min-height', ' .w-cta', 'min-height');
    bx(r, s, 'padding', ' .w-cta-content', 'padding');
    responsive(s, 'alignment', (v, bp) => r.set(' .w-cta-content', bp, 'text-align', v));
    responsive(s, 'vertical_position', (v, bp) => r.set(' .w-cta-content', bp, 'justify-content', { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[v as string] ?? v));
    col(r, s, 'title_color', ' .w-cta-title');
    typography(r, s, 'title_typography', ' .w-cta-title');
    sz(r, s, 'title_spacing', ' .w-cta-title', 'margin-bottom');
    col(r, s, 'description_color', ' .w-cta-desc');
    typography(r, s, 'description_typography', ' .w-cta-desc');
    sz(r, s, 'description_spacing', ' .w-cta-desc', 'margin-bottom');
    col(r, s, 'button_text_color', ' .w-btn');
    r.set(' .w-btn', 'base', 'background-color', color(s, 'button_background_color'));
    r.set(' .w-btn', 'base', 'border-color', color(s, 'button_border_color'));
    typography(r, s, 'button_typography', ' .w-btn');
    r.set(' .w-cta-overlay', 'base', 'background-color', color(s, 'background_color'));
    sz(r, s, 'image_min_height', ' .w-cta-image', 'min-height');
  },
  'icon-box': (r, s) => {
    align(r, s, 'text_align');
    col(r, s, 'primary_color', ' .w-ib-icon');
    r.set(' .w-ib-icon svg', 'base', 'fill', color(s, 'primary_color'));
    sz(r, s, 'icon_size', ' .w-ib-icon', 'font-size');
    sz(r, s, 'icon_space', ' .w-ib-icon', 'margin-bottom');
    col(r, s, 'title_color', ' .w-ib-title');
    typography(r, s, 'title_typography', ' .w-ib-title');
    sz(r, s, 'title_bottom_space', ' .w-ib-title', 'margin-bottom');
    col(r, s, 'description_color', ' .w-ib-desc');
    typography(r, s, 'description_typography', ' .w-ib-desc');
  },
  'image-box': (r, s) => {
    align(r, s, 'text_align');
    sz(r, s, 'image_size', ' .w-ib-img img', 'width');
    sz(r, s, 'image_space', ' .w-ib-img', 'margin-bottom');
    col(r, s, 'title_color', ' .w-ib-title');
    typography(r, s, 'title_typography', ' .w-ib-title');
    col(r, s, 'description_color', ' .w-ib-desc');
    typography(r, s, 'description_typography', ' .w-ib-desc');
  },
  counter: (r, s) => {
    col(r, s, 'number_color', ' .w-counter-number');
    typography(r, s, 'typography_number', ' .w-counter-number');
    col(r, s, 'title_color', ' .w-counter-title');
    typography(r, s, 'typography_title', ' .w-counter-title');
  },
  spacer: (r, s) => sz(r, s, 'space', ' .w-spacer', 'height'),
  divider: (r, s) => {
    r.set(' .w-divider', 'base', 'border-top', `${dim(s.weight) ?? '1px'} ${s.style ?? 'solid'} ${color(s, 'color') ?? '#ddd'}`);
    sz(r, s, 'width', ' .w-divider', 'width');
    sz(r, s, 'gap', '', 'padding-block');
    responsive(s, 'align', (v, bp) => r.set(' .w-divider', bp, 'margin-inline', v === 'center' ? 'auto' : v === 'right' ? 'auto 0' : '0 auto'));
  },
  blockquote: (r, s) => {
    col(r, s, 'content_text_color', ' .w-bq-content');
    typography(r, s, 'content_typography', ' .w-bq-content');
    col(r, s, 'author_text_color', ' .w-bq-author');
    typography(r, s, 'author_typography', ' .w-bq-author');
    r.set(' .w-bq', 'base', 'border-color', color(s, 'border_color'));
  },
  'testimonial-carousel': (r, s) => {
    r.set(' .w-tc-slide', 'base', 'background-color', color(s, 'slide_background_color'));
    bx(r, s, 'slide_padding', ' .w-tc-slide', 'padding');
    col(r, s, 'content_color', ' .w-tc-content');
    typography(r, s, 'content_typography', ' .w-tc-content');
    col(r, s, 'name_color', ' .w-tc-name');
    typography(r, s, 'name_typography', ' .w-tc-name');
    col(r, s, 'title_color', ' .w-tc-title');
    typography(r, s, 'title_typography', ' .w-tc-title');
  },
  'image-carousel': (r, s) => {
    sz(r, s, 'image_spacing_custom', ' .w-carousel-track', 'gap');
    radius(r, s, 'image_border_radius', ' img');
  },
  gallery: (r, s) => {
    sz(r, s, 'image_spacing_custom', ' .w-gallery', 'gap');
    radius(r, s, 'image_border_radius', ' img');
  },
  form: (r, s) => {
    sz(r, s, 'column_gap', ' .w-form', 'column-gap');
    sz(r, s, 'row_gap', ' .w-form', 'row-gap');
    col(r, s, 'label_color', ' .w-form-label');
    typography(r, s, 'label_typography', ' .w-form-label');
    const f = ' .w-form-field';
    col(r, s, 'field_text_color', f);
    typography(r, s, 'field_typography', f);
    r.set(f, 'base', 'background-color', color(s, 'field_background_color'));
    r.set(f, 'base', 'border-color', color(s, 'field_border_color'));
    bx(r, s, 'field_border_width', f, 'border-width');
    bx(r, s, 'field_border_radius', f, 'border-radius');
    const b = ' .w-form-submit';
    r.set(b, 'base', 'background-color', color(s, 'button_background_color'));
    col(r, s, 'button_text_color', b);
    typography(r, s, 'button_typography', b);
    bx(r, s, 'button_border_radius', b, 'border-radius');
    bx(r, s, 'button_text_padding', b, 'padding');
    r.set(b + ':hover', 'base', 'background-color', color(s, 'button_background_hover_color'));
    col(r, s, 'button_hover_color', b + ':hover');
    col(r, s, 'success_message_color', ' .w-form-success');
    col(r, s, 'error_message_color', ' .w-form-error');
    typography(r, s, 'message_typography', ' .w-form-message');
  },
  'nav-menu': (r, s) => {
    const a = ' .w-nav-link';
    col(r, s, 'color_menu_item', a);
    typography(r, s, 'menu_typography', a);
    sz(r, s, 'padding_horizontal_menu_item', a, 'padding-inline');
    sz(r, s, 'padding_vertical_menu_item', a, 'padding-block');
    sz(r, s, 'menu_space_between', ' .w-nav-list', 'gap');
    col(r, s, 'color_menu_item_hover', a + ':hover');
    const bg = s.pointer === 'background';
    r.set(a + ':hover', 'base', 'background-color', bg ? color(s, 'pointer_color_menu_item_hover') : undefined);
    r.set(a + '[aria-current="page"]', 'base', 'background-color', bg ? color(s, 'pointer_color_menu_item_active') : undefined);
    col(r, s, 'color_menu_item_active', a + '[aria-current="page"]');
    if (bg) {
      r.set(a + ':hover', 'base', 'color', color(s, 'color_menu_item_hover') ?? '#fff');
      r.set(a + '[aria-current="page"]', 'base', 'color', color(s, 'color_menu_item_active') ?? '#fff');
    }
    if (s.pointer === 'underline') r.set(a + '[aria-current="page"]', 'base', 'box-shadow', `inset 0 -${dim(s.pointer_width) ?? '3px'} 0 ${color(s, 'pointer_color_menu_item_active') ?? 'currentColor'}`);
    col(r, s, 'color_dropdown_item', ' .w-nav-dropdown a');
    r.set(' .w-nav-dropdown', 'base', 'background-color', color(s, 'background_color_dropdown_item'));
    col(r, s, 'color_dropdown_item_hover', ' .w-nav-dropdown a:hover');
    r.set(' .w-nav-dropdown a:hover', 'base', 'background-color', color(s, 'background_color_dropdown_item_hover'));
    typography(r, s, 'dropdown_typography', ' .w-nav-dropdown a');
    col(r, s, 'toggle_color', ' .w-nav-toggle');
    r.set(' .w-nav-toggle', 'base', 'background-color', color(s, 'toggle_background_color'));
  },
  posts: (r, s) => {
    const skin = s._skin || 'classic';
    sz(r, s, `${skin}_column_gap`, ' .w-posts', 'column-gap');
    sz(r, s, `${skin}_row_gap`, ' .w-posts', 'row-gap');
    col(r, s, `${skin}_title_color`, ' .w-post-title');
    typography(r, s, `${skin}_title_typography`, ' .w-post-title');
    col(r, s, `${skin}_meta_color`, ' .w-post-meta');
    typography(r, s, `${skin}_meta_typography`, ' .w-post-meta');
    col(r, s, `${skin}_excerpt_color`, ' .w-post-excerpt');
    typography(r, s, `${skin}_excerpt_typography`, ' .w-post-excerpt');
    col(r, s, `${skin}_read_more_color`, ' .w-post-more');
    typography(r, s, `${skin}_read_more_typography`, ' .w-post-more');
    bx(r, s, `${skin}_content_padding`, ' .w-post-content', 'padding');
    r.set(' .w-post', 'base', 'background-color', color(s, `${skin}_card_bg_color`));
    responsive(s, `${skin}_alignment`, (v, bp) => r.set(' .w-post-content', bp, 'text-align', v));
    responsive(s, `${skin}_image_width`, (v, bp) => r.set(' .w-post-thumb', bp, 'width', dim(v)));
  },
  'social-icons': (r, s) => {
    sz(r, s, 'icon_size', ' .w-social a', 'font-size');
    sz(r, s, 'icon_spacing', ' .w-social', 'gap');
    sz(r, s, 'icon_padding', ' .w-social a', 'padding');
    if (s.icon_color === 'custom') {
      r.set(' .w-social a', 'base', 'background-color', color(s, 'icon_primary_color'));
      r.set(' .w-social a', 'base', 'color', color(s, 'icon_secondary_color'));
    }
    radius(r, s, 'border_radius', ' .w-social a');
    responsive(s, 'align', (v, bp) => r.set(' .w-social', bp, 'justify-content', JUSTIFY[v as string] ?? v));
  },
  'theme-post-content': (r, s) => {
    align(r, s);
    col(r, s, 'text_color', '');
    typography(r, s, 'typography', '');
  },
  'post-info': (r, s) => {
    col(r, s, 'text_color', ' .w-pi-text');
    typography(r, s, 'icon_typography', ' .w-pi-text');
    col(r, s, 'icon_color', ' .w-pi-icon');
    sz(r, s, 'space_between', ' .w-pi', 'gap');
  },
  countdown: (r, s) => {
    r.set(' .w-cd-item', 'base', 'background-color', color(s, 'box_background_color'));
    col(r, s, 'digits_color', ' .w-cd-digits');
    typography(r, s, 'digits_typography', ' .w-cd-digits');
    col(r, s, 'label_color', ' .w-cd-label');
    typography(r, s, 'label_typography', ' .w-cd-label');
  },
  zigzag: (r, s) => {
    col(r, s, 'style_title_color', ' .w-zz-title');
    typography(r, s, 'style_title_typography', ' .w-zz-title');
    col(r, s, 'style_description_color', ' .w-zz-desc');
    typography(r, s, 'style_description_typography', ' .w-zz-desc');
  },
};
STYLE['theme-post-title'] = STYLE.heading!;
STYLE['theme-archive-title'] = STYLE.heading!;
STYLE['theme-post-featured-image'] = STYLE.image!;
STYLE.accordion = STYLE.toggle!;

/** Settings that are purely visual; everything else on a widget is content (props). */
const STYLE_KEY =
  /(^_)|(_color(_|$))|(typography)|(^align)|(_align)|(padding)|(margin)|(border)|(radius)|(shadow)|(^height)|(_width(_|$))|(_height(_|$))|(space)|(spacing)|(_gap)|(^gap)|(opacity)|(hover_animation)|(motion_fx)|(sticky)|(^animation)|(object-)|(css_filters)|(^z_index)|(^hide_)|(^ai$)|(_offset)|(custom_css)|(_indent)|(_transition)|(^rotate)|(^weight$)|(_background(_|$))|(^background_)|(^icon_size)|(^size_)|(min-height)/;
const KEEP = new Set(['header_size', 'image_size', 'thumbnail_size', 'view', 'shape', 'title_tag', 'image_position', 'position', 'icon_align', 'size', 'layout', '_skin', 'columns', 'slides_to_show', 'gallery_columns', 'title_position', 'tabs_direction', 'pointer', 'dropdown', 'full_width', 'toggle', 'button_width', 'image_stretch', 'bg_image', 'show_labels', 'icon_color']);
const KEEP_ARRAYS = new Set(['form_fields', 'tabs', 'items', 'icon_list', 'carousel', 'gallery', 'slides', 'social_icon_list', 'share_buttons', 'image_zigzag_items']);

export function contentProps(s: Settings): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === '__dynamic__' || k === '__globals__') continue;
    if (STYLE_KEY.test(k) && !KEEP.has(k) && !KEEP_ARRAYS.has(k)) continue;
    if (v === null) continue;
    // keep '' for switchers ('' = turned off), drop other empty strings
    if (v === '' && !/(show_|_thumbnail$|^show)/.test(k)) continue;
    // An empty meta list means "show no meta" (not "use the defaults"), so keep it.
    if (Array.isArray(v) && v.length === 0 && !KEEP_ARRAYS.has(k) && !/_meta_data$/.test(k)) continue;
    out[k] = v;
  }
  return out;
}
