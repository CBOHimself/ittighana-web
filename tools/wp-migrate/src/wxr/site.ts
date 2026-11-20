/** Kit (global design settings), menus and forms. */
import type { DesignTokens, FormField, NavItem } from '@itti/schemas';
import { dim } from './styles';
import type { WxrItem } from './parse';

export function buildTokens(kit: Record<string, any>, usedFonts: Set<string>): DesignTokens {
  const colors: DesignTokens['colors'] = {};
  for (const c of [...(kit.system_colors ?? []), ...(kit.custom_colors ?? [])]) colors[c._id] = { title: String(c.title).trim(), value: c.color };
  const typography: DesignTokens['typography'] = {};
  const fonts = new Set<string>(usedFonts);
  for (const t of [...(kit.system_typography ?? []), ...(kit.custom_typography ?? [])]) {
    const p = (k: string) => t[`typography_${k}`];
    const preset = { title: String(t.title).trim(), base: {} as Record<string, string>, tablet: {} as Record<string, string>, mobile: {} as Record<string, string> };
    if (p('font_family')) {
      preset.base['font-family'] = `"${p('font_family')}", sans-serif`;
      fonts.add(p('font_family'));
    }
    for (const [k, css] of [['font_weight', 'font-weight'], ['text_transform', 'text-transform'], ['font_style', 'font-style'], ['text_decoration', 'text-decoration']] as const)
      if (p(k)) preset.base[css] = String(p(k));
    for (const [bp, suf] of [['base', ''], ['tablet', '_tablet'], ['mobile', '_mobile']] as const) {
      for (const [k, css] of [['font_size', 'font-size'], ['line_height', 'line-height'], ['letter_spacing', 'letter-spacing'], ['word_spacing', 'word-spacing']] as const) {
        const v = dim(p(k + suf));
        if (v) preset[bp][css] = v;
      }
    }
    typography[t._id] = preset;
  }
  const g = kit.__globals__ ?? {};
  const gc = (k: string) => (typeof g[k] === 'string' && g[k] ? `var(--e-global-color-${g[k].split('=')[1]})` : kit[k] || undefined);
  if (kit.body_typography_font_family) fonts.add(kit.body_typography_font_family);
  if (kit.h1_typography_font_family) fonts.add(kit.h1_typography_font_family);
  return {
    colors,
    typography,
    containerWidth: Number(kit.container_width?.size ?? 1140),
    breakpoints: { tablet: Number(kit.viewport_lg ?? 1025) - 1, mobile: Number(kit.viewport_md ?? 768) - 1 },
    bodyBackground: gc('body_background_color'),
    bodyColor: gc('body_color'),
    bodyFont: kit.body_typography_font_family,
    headingFont: kit.h1_typography_font_family,
    paragraphSpacing: kit.paragraph_spacing && kit.paragraph_spacing.size !== '' && kit.paragraph_spacing.size !== undefined ? `${kit.paragraph_spacing.size}${kit.paragraph_spacing.unit ?? 'px'}` : undefined,
    fonts: [...fonts].filter((f) => !/^(sans-serif|serif|inherit|var\()/i.test(f)).sort(),
  };
}

export function buildMenus(items: WxrItem[], paths: Map<number, string>, link: (u: string) => string) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const menuItems = items.filter((i) => i.type === 'nav_menu_item' && i.status === 'publish');
  const menus: Record<string, { name: string; items: NavItem[] }> = {};
  const nodes = new Map<number, NavItem & { _parent: number; _order: number; _menu: string }>();
  for (const it of menuItems) {
    const cat = it.categories.find((c) => c.domain === 'nav_menu');
    if (!cat) continue;
    menus[cat.slug] ??= { name: cat.name, items: [] };
    const m = it.meta;
    const objId = Number(m._menu_item_object_id);
    const target = byId.get(objId);
    let href = '#';
    if (m._menu_item_type === 'custom') href = link(m._menu_item_url || '#');
    else if (m._menu_item_type === 'post_type') href = paths.get(objId) ?? '#';
    else if (m._menu_item_type === 'taxonomy') href = `/category/${objId}`;
    nodes.set(it.id, {
      label: it.title || target?.title || href,
      href,
      children: [],
      _parent: Number(m._menu_item_menu_item_parent || 0),
      _order: it.order,
      _menu: cat.slug,
    });
  }
  const sorted = [...nodes.entries()].sort((a, b) => a[1]._order - b[1]._order);
  for (const [, n] of sorted) {
    const parent = n._parent ? nodes.get(n._parent) : undefined;
    (parent ? parent.children! : menus[n._menu]!.items).push(n);
  }
  const clean = (list: NavItem[]): NavItem[] =>
    list.map((n) => {
      const { label, href, children } = n;
      return children?.length ? { label, href, children: clean(children) } : { label, href };
    });
  for (const m of Object.values(menus)) m.items = clean(m.items);
  return menus;
}

const FIELD_TYPE: Record<string, FormField['type']> = {
  text: 'text', email: 'email', textarea: 'textarea', tel: 'phone', number: 'number', date: 'date', time: 'text',
  select: 'select', radio: 'radio', checkbox: 'checkboxGroup', acceptance: 'checkbox', upload: 'file', url: 'text',
  html: 'paragraph', step: 'heading', hidden: 'text',
};

export function buildForms(list: Array<{ slug: string; name: string; settings: Record<string, any>; source: string }>) {
  return list.map(({ slug, name, settings: s, source }) => {
    const fields: FormField[] = (s.form_fields ?? []).map((f: any, i: number) => {
      const type = FIELD_TYPE[f.field_type ?? 'text'] ?? 'text';
      const key = String(f.custom_id || `field_${i}`).replace(/[^a-zA-Z0-9_]/g, '_');
      const field: FormField = {
        id: f._id || key,
        name: /^[a-zA-Z]/.test(key) ? key : `f_${key}`,
        type,
        label: f.field_label || f.placeholder || (type === 'checkbox' ? f.acceptance_text : '') || key,
        placeholder: f.placeholder || undefined,
        required: f.required === 'true' || f.required === true,
        width: Number(f.width ?? 100) <= 50 ? 'half' : 'full',
      };
      if (['select', 'radio', 'checkboxGroup'].includes(type) && f.field_options)
        field.options = String(f.field_options).split('\n').filter(Boolean).map((o) => {
          const [label, value] = o.split('|');
          return { label: label!.trim(), value: (value ?? label!).trim() };
        });
      if (type === 'paragraph') field.label = String(f.field_html ?? '').replace(/<[^>]+>/g, '');
      if (type === 'file') field.validation = { maxSizeMb: Number(f.file_sizes || 10) };
      return field;
    });
    return {
      slug,
      name,
      source,
      kind: /appl|enrol/i.test(name + source) ? 'enrolment' : 'general',
      fields,
      settings: {
        notifyEmails: String(s.email_to ?? '').split(',').map((x: string) => x.trim()).filter((x: string) => /@/.test(x)),
        confirmationMessage: s.success_message || 'Thank you. We have received your submission.',
        sendConfirmationEmail: true,
        submitLabel: s.button_text || 'Submit',
      },
      status: 'published',
    };
  });
}
