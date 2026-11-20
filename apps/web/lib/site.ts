import type { LayoutNode } from '@itti/schemas';
import { cache } from 'react';
import { api, apiOrNull } from './api';
import type { SiteSettings } from './types';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.ittighana.com').replace(/\/$/, '');
/** Where /wp-content/uploads/... files are served from ('' = same origin, via the rewrite in next.config). */
export const MEDIA_BASE = (process.env.NEXT_PUBLIC_MEDIA_URL ?? '').replace(/\/$/, '');

const FALLBACK: SiteSettings = {
  siteName: 'International Travel and Tourism Institute',
  whatsapp: { enabled: false, number: '', message: '' },
  contact: { phones: [], notifyEmails: [] },
  socials: {},
  nav: { header: [], footer: [] },
  menus: {},
  theme: { popups: [] },
  watermark: { enabled: true, label: 'Built by HostHaus', url: 'https://hosthaus.com' },
};

/** Site settings: design tokens, menus, theme templates (cached per request). */
export const getSettings = cache(
  (): Promise<SiteSettings> => api<SiteSettings>('/settings', { tags: ['settings', 'content'] }).then((s) => ({ ...FALLBACK, ...s })).catch(() => FALLBACK),
);

export type TemplateDoc = { slug: string; kind: string; title: string; wpId?: number; layout: LayoutNode[] };

export const getTemplate = cache((slug?: string) =>
  slug ? apiOrNull<TemplateDoc>(`/templates/${slug}`, { tags: ['content', 'template'] }).catch(() => null) : Promise.resolve(null),
);
export const getTemplateByWpId = cache((id: string | number) =>
  apiOrNull<TemplateDoc>(`/templates/wp/${id}`, { tags: ['content', 'template'] }).catch(() => null),
);
