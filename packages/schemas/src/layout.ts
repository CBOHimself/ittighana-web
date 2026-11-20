import { z } from 'zod';
import { contentType, templateField } from './templates';

/**
 * Layout tree: the data model every page, template and course layout is stored in.
 * It mirrors the structure the site was designed with in Elementor (containers
 * holding widgets), so pages render 1:1 and the admin can edit each node.
 *
 *   container → children: LayoutNode[]
 *   widget    → type = widget name ("heading", "button", "nested-tabs", …)
 */
export const breakpoint = z.enum(['base', 'tablet', 'mobile']);
export type Breakpoint = z.infer<typeof breakpoint>;

/** One CSS rule scoped to the node: `.n-<id><sel> { …css }` at a breakpoint. */
export const styleRule = z.object({
  sel: z.string().default(''),
  bp: breakpoint.default('base'),
  css: z.record(z.string(), z.string()),
});
export type StyleRule = z.infer<typeof styleRule>;

/**
 * Dynamic value placeholder, resolved at render time from the record being shown
 * (e.g. a course's ACF field, the post title, the featured image).
 */
export const dynamicValue = z.object({
  $dyn: z.enum(['field', 'title', 'excerpt', 'featured-image', 'date', 'author', 'url', 'popup', 'archive-title', 'now']),
  field: z.string().optional(),
  fallback: z.unknown().optional(),
  /** Text wrapped around a resolved text value (Elementor before/after). */
  before: z.string().optional(),
  after: z.string().optional(),
  /** Date format for date/now: a PHP-style format string (e.g. "Y"), or omitted for the site default. */
  format: z.string().optional(),
});
export type DynamicValue = z.infer<typeof dynamicValue>;

export type LayoutNode = {
  id: string;
  /** "container" or a widget type */
  type: string;
  /** Content settings for the widget (text, links, images, items…). */
  props?: Record<string, unknown>;
  styles?: StyleRule[];
  /** Extra class names (entrance animations, custom classes). */
  className?: string;
  /** Hidden at these breakpoints. */
  hide?: Array<'desktop' | 'tablet' | 'mobile'>;
  /** Raw CSS from the designer (selector already scoped). */
  customCss?: string;
  /** Render only when the record has a non-empty value for this field (template sections that some records leave blank). */
  showIf?: string;
  children?: LayoutNode[];
};

export const layoutNode: z.ZodType<LayoutNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()).optional(),
    styles: z.array(styleRule).optional(),
    className: z.string().optional(),
    hide: z.array(z.enum(['desktop', 'tablet', 'mobile'])).optional(),
    customCss: z.string().optional(),
    showIf: z.string().optional(),
    children: z.array(layoutNode).optional(),
  }),
);
export const layout = z.array(layoutNode).default([]);

/** Global design tokens (from the Elementor kit). */
export const typographyPreset = z.object({
  title: z.string(),
  base: z.record(z.string(), z.string()).default({}),
  tablet: z.record(z.string(), z.string()).default({}),
  mobile: z.record(z.string(), z.string()).default({}),
});
export type TypographyPreset = z.infer<typeof typographyPreset>;

export const designTokens = z.object({
  colors: z.record(z.string(), z.object({ title: z.string(), value: z.string() })).default({}),
  typography: z.record(z.string(), typographyPreset).default({}),
  containerWidth: z.number().default(1140),
  breakpoints: z.object({ tablet: z.number(), mobile: z.number() }).default({ tablet: 1024, mobile: 767 }),
  bodyBackground: z.string().optional(),
  bodyColor: z.string().optional(),
  bodyFont: z.string().optional(),
  headingFont: z.string().optional(),
  /** Space after paragraphs (Elementor kit "paragraph spacing"); CSS length. */
  paragraphSpacing: z.string().optional(),
  fonts: z.array(z.string()).default([]),
});
export type DesignTokens = z.infer<typeof designTokens>;

export const templateKind = z.enum([
  'header',
  'footer',
  'single',
  'single-post',
  'single-page',
  'archive',
  'popup',
  'section',
  'loop-item',
  'floating-buttons',
  'page',
  'not-found',
]);
export type TemplateKind = z.infer<typeof templateKind>;

export const templateInput = z.object({
  title: z.string(),
  slug: z.string(),
  kind: templateKind,
  /** Where it applies: "general", "singular/post", "course:<slug>", … */
  conditions: z.array(z.string()).default([]),
  layout,
  status: z.enum(['draft', 'published']).default('published'),
  wpId: z.number().optional(),
  /** Content templates: which content type can use this template (null = site template). */
  contentType: contentType.nullable().default(null),
  /** Content templates: the fields the layout shows (drives the admin form and validation). */
  fields: z.array(templateField).default([]),
  /** The template used when a record doesn't pick one. One per content type. */
  isDefault: z.boolean().default(false),
  /** Shown in the admin template picker. */
  description: z.string().max(300).optional(),
  preview: z.object({ url: z.string(), alt: z.string().optional() }).optional(),
});
export type TemplateInput = z.infer<typeof templateInput>;
