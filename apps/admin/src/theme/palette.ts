import { definePalette } from '@vantara-ui/ui';

/**
 * ITTI palette for vantara-ui's ThemeScope (palette roles → --vt-* variables).
 * Brand: navy #002147, blue #3277AE, light greys #E6E6E6 / #F5F5F5.
 * House rule: no grey text on light backgrounds, so the "muted" text roles are navy tones.
 * Keep in sync with the static defaults in styles/vantara-theme.css.
 */
export const ittiPalette = definePalette({
  name: 'itti',
  label: 'ITTI',
  base: 'default',
  light: {
    canvas: '#f5f5f5',
    surface: '#ffffff',
    surfaceMuted: '#f5f5f5',
    surfaceRaised: '#ffffff',
    line: '#e6e6e6',
    lineStrong: '#cbc8cc',
    fg: '#0b1526',
    fgMuted: '#13233d',
    fgSubtle: '#1b2f4f',
    fgInverse: '#ffffff',
    action: '#002147',
    actionHover: '#001b3b',
    onAction: '#ffffff',
    actionSecondary: '#ffffff',
    actionSecondaryHover: '#f5f5f5',
    onActionSecondary: '#002147',
    actionSecondaryLine: '#cbc8cc',
    accent: '#3277ae',
    accentSurface: '#eef4fa',
    onAccentSurface: '#002147',
    nav: '#002147',
    navLine: '#1a3a63',
    onNav: '#ffffff',
    onNavMuted: '#dde9f4',
    navActive: '#3277ae',
    onNavActive: '#ffffff',
    focus: '#3277ae',
  },
});
