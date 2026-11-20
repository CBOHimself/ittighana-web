import type { DesignTokens, LayoutNode } from '@itti/schemas';

type BPs = { tablet: number; mobile: number };
const DEFAULT_BPS: BPs = { tablet: 1024, mobile: 767 };

const decl = (css: Record<string, string>) =>
  Object.entries(css)
    .map(([p, v]) => `${p}:${v}`)
    .join(';');

/**
 * Build the scoped CSS for a layout tree: one rule set per node, desktop-first
 * with tablet/mobile overrides (same breakpoints as the original Elementor kit).
 */
export function layoutCss(nodes: LayoutNode[] | undefined, bps: BPs = DEFAULT_BPS): string {
  const base: string[] = [];
  const tablet: string[] = [];
  const mobile: string[] = [];
  const extra: string[] = [];
  const walk = (n: LayoutNode) => {
    for (const r of n.styles ?? []) {
      const sel = r.sel
        .split(',')
        .map((s) => `.n-${n.id}${s.trim() ? (s.startsWith(':') || s.startsWith('::') || s.startsWith('[') ? s.trim() : ' ' + s.trim()) : ''}`)
        .join(',');
      const rule = `${sel}{${decl(r.css)}}`;
      (r.bp === 'tablet' ? tablet : r.bp === 'mobile' ? mobile : base).push(rule);
    }
    if (n.customCss) extra.push(n.customCss);
    n.children?.forEach(walk);
  };
  nodes?.forEach(walk);
  return [
    base.join(''),
    tablet.length ? `@media(max-width:${bps.tablet}px){${tablet.join('')}}` : '',
    mobile.length ? `@media(max-width:${bps.mobile}px){${mobile.join('')}}` : '',
    extra.join('\n'),
  ].join('\n');
}

/** Global design tokens → CSS variables (same names Elementor uses, so styles map 1:1). */
export function tokensCss(t: DesignTokens): string {
  const root: string[] = [];
  const tab: string[] = [];
  const mob: string[] = [];
  for (const [id, c] of Object.entries(t.colors)) root.push(`--e-global-color-${id}:${c.value}`);
  for (const [id, p] of Object.entries(t.typography)) {
    for (const [prop, v] of Object.entries(p.base)) root.push(`--e-global-typography-${id}-${prop}:${v}`);
    for (const [prop, v] of Object.entries(p.tablet)) tab.push(`--e-global-typography-${id}-${prop}:${v}`);
    for (const [prop, v] of Object.entries(p.mobile)) mob.push(`--e-global-typography-${id}-${prop}:${v}`);
  }
  root.push(`--container-max-width:${t.containerWidth}px`);
  if (t.paragraphSpacing) root.push(`--paragraph-spacing:${t.paragraphSpacing}`);
  const body = [
    t.bodyBackground ? `background-color:${t.bodyBackground}` : '',
    t.bodyColor ? `color:${t.bodyColor}` : '',
    t.bodyFont ? `font-family:"${t.bodyFont}",sans-serif` : '',
  ]
    .filter(Boolean)
    .join(';');
  return [
    `:root{${root.join(';')}}`,
    tab.length ? `@media(max-width:${t.breakpoints.tablet}px){:root{${tab.join(';')}}}` : '',
    mob.length ? `@media(max-width:${t.breakpoints.mobile}px){:root{${mob.join(';')}}}` : '',
    body ? `body{${body}}` : '',
    t.headingFont ? `h1{font-family:"${t.headingFont}",sans-serif}` : '',
    `@media(min-width:${t.breakpoints.tablet + 1}px){.hide-desktop{display:none!important}}`,
    `@media(min-width:${t.breakpoints.mobile + 1}px) and (max-width:${t.breakpoints.tablet}px){.hide-tablet{display:none!important}}`,
    `@media(max-width:${t.breakpoints.mobile}px){.hide-mobile{display:none!important}}`,
  ].join('\n');
}

/** Google Fonts stylesheet URL for the fonts the site uses. */
export function googleFontsHref(fonts: string[]) {
  if (!fonts.length) return undefined;
  const fam = fonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400`).join('&');
  return `https://fonts.googleapis.com/css2?${fam}&display=swap`;
}
