import type { DesignTokens, LayoutNode, NavItem } from '@itti/schemas';

/** The record a layout is showing (page, course, news post…), used by dynamic fields. */
export type RecordContext = {
  kind: 'page' | 'course' | 'news' | 'article' | 'event' | 'career' | 'template';
  title?: string;
  slug?: string;
  path?: string | null;
  excerpt?: string;
  cover?: { url: string; alt?: string };
  publishedAt?: string;
  author?: string;
  fields?: Record<string, unknown>;
  html?: string;
  layout?: LayoutNode[];
};

/** A listed item (posts widget, loop grid…). */
export type ListItem = RecordContext & { _id?: string };

export type RenderContext = {
  /** Base URL that /wp-content/uploads/... paths are served from ('' = same origin). */
  mediaBase: string;
  apiUrl: string;
  siteUrl: string;
  /** Current path (for active menu items). */
  path: string;
  record?: RecordContext;
  menus: Record<string, { name: string; items: NavItem[] }>;
  tokens?: DesignTokens;
  /** Pre-fetched data per node id (posts widgets, loop grids, embedded templates). */
  data: Record<string, unknown>;
  /** Layouts for embedded templates, by WordPress id or slug. */
  templates: Record<string, LayoutNode[]>;
  /**
   * Images bundled with the site (e.g. the logos) used when a media file is missing or
   * fails to load. `match` is compared with the media file name (case- and punctuation-insensitive).
   */
  imageFallbacks?: ImageFallback[];
};

export type ImageFallback = { match: string; src: string };
