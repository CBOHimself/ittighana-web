import type { FormInput, LayoutNode, MediaRef, SiteSettingsInput, WithMeta } from '@itti/schemas';

export type SiteSettings = SiteSettingsInput;

/** A record as returned by /v1/resolve (dates are ISO strings). */
export type RoutedRecord = {
  _id: string;
  title: string;
  slug: string;
  path: string | null;
  layout: LayoutNode[];
  html?: string;
  excerpt?: string;
  summary?: string;
  cover?: MediaRef;
  fields?: Record<string, unknown>;
  author?: { name: string };
  publishedAt?: string;
  categories?: string[];
  pageTemplate?: 'default' | 'canvas' | 'full-width';
  seo?: { title?: string; description?: string; ogImage?: string };
};

export type Resolved =
  | { kind: 'page'; record: RoutedRecord }
  /** Templated content: rendered through its chosen (or the default) content template. */
  | { kind: 'course' | 'news' | 'article' | 'event' | 'career'; record: RoutedRecord; template: { slug: string; layout: LayoutNode[] } | null }
  | { kind: 'redirect'; to: string; code: 301 | 302 };

export type PublicForm = WithMeta<FormInput> & { open: boolean };
