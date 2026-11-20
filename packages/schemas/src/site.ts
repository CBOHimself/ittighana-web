import { z } from 'zod';
import { designTokens } from './layout';

export const contactMessageInput = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  subject: z.string().max(200).optional(),
  message: z.string().min(5).max(5000),
  /** Honeypot: must stay empty. */
  website: z.string().max(0).optional(),
  turnstileToken: z.string().optional(),
});
export type ContactMessageInput = z.infer<typeof contactMessageInput>;

export const navItem: z.ZodType<NavItem> = z.lazy(() =>
  z.object({ label: z.string(), href: z.string(), children: z.array(navItem).optional() }),
);
export type NavItem = { label: string; href: string; children?: NavItem[] };

export const siteSettingsInput = z.object({
  siteName: z.string().default('ITTI Ghana'),
  tagline: z.string().optional(),
  description: z.string().optional(),
  logo: z.object({ url: z.string(), alt: z.string().default('') }).optional(),
  favicon: z.string().optional(),
  /** Global colours, fonts, container width and breakpoints. */
  tokens: designTokens.optional(),
  /** Navigation menus by slug (header-menu, footer-menu-1, …). */
  menus: z.record(z.string(), z.object({ name: z.string(), items: z.array(navItem) })).default({}),
  /** Which templates render the header, footer, single posts, 404, floating chat and popups. */
  theme: z
    .object({
      header: z.string().optional(),
      footer: z.string().optional(),
      singlePost: z.string().optional(),
      archive: z.string().optional(),
      notFound: z.string().optional(),
      floating: z.string().optional(),
      popups: z.array(z.object({ id: z.number(), slug: z.string() })).default([]),
      defaultCourseTemplate: z.string().optional(),
    })
    .default({ popups: [] }),
  whatsapp: z
    .object({
      enabled: z.boolean().default(true),
      number: z.string().default(''), // international format, digits only e.g. 233201234567
      message: z.string().default('Hello ITTI, I would like to make an enquiry.'),
    })
    .default({ enabled: true, number: '', message: 'Hello ITTI, I would like to make an enquiry.' }),
  contact: z
    .object({
      email: z.string().email().optional(),
      phones: z.array(z.string()).default([]),
      address: z.string().optional(),
      mapEmbedUrl: z.string().url().optional(),
      notifyEmails: z.array(z.string().email()).default([]),
    })
    .default({ phones: [], notifyEmails: [] }),
  socials: z
    .object({
      facebook: z.string().url().optional(),
      instagram: z.string().url().optional(),
      linkedin: z.string().url().optional(),
      x: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
    })
    .default({}),
  nav: z.object({ header: z.array(navItem).default([]), footer: z.array(navItem).default([]) }).default({ header: [], footer: [] }),
  /** HostHaus "Built by" mark; super-admin only. */
  watermark: z
    .object({ enabled: z.boolean().default(true), label: z.string().default('Built by HostHaus'), url: z.string().url().default('https://hosthaus.com') })
    .default({ enabled: true, label: 'Built by HostHaus', url: 'https://hosthaus.com' }),
});
export type SiteSettingsInput = z.infer<typeof siteSettingsInput>;

export const redirectInput = z.object({
  from: z.string().startsWith('/'),
  to: z.string().min(1),
  code: z.union([z.literal(301), z.literal(302)]).default(301),
});
export type RedirectInput = z.infer<typeof redirectInput>;

export const mediaUpdateInput = z.object({
  alt: z.string().max(250).optional(),
  folder: z.string().max(120).optional(),
  title: z.string().max(200).optional(),
});
