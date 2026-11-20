import { z } from 'zod';
import { blocks } from './blocks';
import { mediaRef, objectId, publishStatus, seo, slug } from './common';
import { layout } from './layout';

/** Fields shared by everything imported from / rendered like the original site. */
const routed = {
  /** Public URL path, e.g. "/about" or "/itti-course/customer-care". */
  path: z.string().startsWith('/').nullable().optional(),
  /** Layout tree (containers + widgets) rendered by @itti/blocks/layout. */
  layout,
  /** Original WordPress post id (for re-imports). */
  wpId: z.number().int().optional(),
};

/* ─── Pages (Home, About and other singletons) ──────────────────────────── */
export const pageTemplate = z.enum(['default', 'home', 'about', 'landing']);
export const pageInput = z.object({
  title: z.string().min(1),
  slug,
  ...routed,
  /** canvas = no header/footer, full-width = header/footer without page title */
  pageTemplate: z.enum(['default', 'canvas', 'full-width']).default('default'),
  html: z.string().optional(),
  /** Featured image (used by "post featured image" widgets on the page). */
  cover: mediaRef.optional(),
  template: pageTemplate.default('default'),
  blocks,
  seo,
  status: publishStatus.default('draft'),
});
export type PageInput = z.infer<typeof pageInput>;

/* ─── Courses ───────────────────────────────────────────────────────────── */
export const courseCategoryInput = z.object({
  name: z.string().min(1),
  slug,
  description: z.string().optional(),
  order: z.number().int().default(0),
  image: mediaRef.optional(),
});
export type CourseCategoryInput = z.infer<typeof courseCategoryInput>;

/**
 * Content template (slug of a Template with the matching contentType). Empty = the
 * content type's default template. See templates.ts.
 */
export const templateRef = z.string().max(120).nullable().optional();
/** Values for the template's fields (keys from FIELD_CATALOG). Checked by the API. */
const templateFields = z.record(z.string(), z.unknown()).default({});
export const courseInput = z.object({
  title: z.string().min(1),
  slug,
  ...routed,
  categoryId: objectId.optional(),
  /** Template that renders this course (Course template 1/2/3…). */
  template: templateRef,
  /** Course detail fields (overview, learning outcomes, certification, exam window, images…). */
  fields: templateFields,
  summary: z.string().max(400).optional(),
  duration: z.string().optional(),
  mode: z.enum(['in-person', 'online', 'hybrid']).optional(),
  fees: z
    .object({ amount: z.number().nonnegative(), currency: z.string().default('GHS'), note: z.string().optional() })
    .optional(),
  intakes: z.array(z.object({ label: z.string(), startDate: z.coerce.date().optional() })).default([]),
  cover: mediaRef.optional(),
  gallery: z.array(mediaRef).default([]),
  blocks,
  formId: objectId.optional(),
  publishedAt: z.coerce.date().optional(),
  order: z.number().int().default(0),
  status: publishStatus.default('draft'),
  seo,
});
export type CourseInput = z.infer<typeof courseInput>;

/* ─── Careers ───────────────────────────────────────────────────────────── */
export const careerInput = z.object({
  title: z.string().min(1),
  slug,
  template: templateRef,
  fields: templateFields,
  department: z.string().optional(),
  location: z.string().default('Accra, Ghana'),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'internship', 'volunteer']).default('full-time'),
  summary: z.string().max(400).optional(),
  deadline: z.coerce.date().optional(),
  cover: mediaRef.optional(),
  blocks,
  formId: objectId.optional(),
  status: publishStatus.default('draft'),
  seo,
});
export type CareerInput = z.infer<typeof careerInput>;

/* ─── Events ────────────────────────────────────────────────────────────── */
/** Event fields without cross-field checks (used for partial PATCH updates). */
export const eventFields = z.object({
    title: z.string().min(1),
    slug,
    summary: z.string().max(400).optional(),
    template: templateRef,
    fields: templateFields,
    start: z.coerce.date(),
    end: z.coerce.date(),
    allDay: z.boolean().default(false),
    location: z.string().optional(),
    onlineUrl: z.string().url().optional(),
    category: z.string().optional(),
    color: z.string().optional(),
    cover: mediaRef.optional(),
    gallery: z.array(mediaRef).default([]),
    blocks,
    registrationFormId: objectId.optional(),
    /** RFC 5545 RRULE, e.g. FREQ=WEEKLY;COUNT=6 */
    rrule: z.string().optional(),
    status: publishStatus.default('draft'),
    seo,
});
export const eventInput = eventFields.refine((e) => e.end >= e.start, {
  message: 'End must be after start',
  path: ['end'],
});
export type EventInput = z.infer<typeof eventInput>;

/* ─── Campus: Gallery ───────────────────────────────────────────────────── */
export const galleryAlbumInput = z.object({
  title: z.string().min(1),
  slug,
  description: z.string().optional(),
  cover: mediaRef.optional(),
  items: z.array(mediaRef.extend({ caption: z.string().optional() })).default([]),
  takenAt: z.coerce.date().optional(),
  order: z.number().int().default(0),
  status: publishStatus.default('draft'),
});
export type GalleryAlbumInput = z.infer<typeof galleryAlbumInput>;

/* ─── Campus: Student Articles ──────────────────────────────────────────── */
export const articleInput = z.object({
  title: z.string().min(1),
  slug,
  ...routed,
  template: templateRef,
  /** Article fields (article_title, author, introduction, article_pdf, article_image…). */
  fields: templateFields,
  html: z.string().optional(),
  excerpt: z.string().max(400).optional(),
  /** Legacy author block; new articles use fields.author / fields.programme. */
  author: z.object({ name: z.string(), programme: z.string().optional(), photo: mediaRef.optional() }).optional(),
  cover: mediaRef.optional(),
  blocks,
  tags: z.array(z.string()).default([]),
  publishedAt: z.coerce.date().optional(),
  status: publishStatus.default('draft'),
  seo,
});
export type ArticleInput = z.infer<typeof articleInput>;

/* ─── Campus: Spaces ────────────────────────────────────────────────────── */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
export const weeklyAvailability = z
  .array(
    z.object({
      /** 0 = Sunday … 6 = Saturday */
      day: z.number().int().min(0).max(6),
      open: hhmm,
      close: hhmm,
    }),
  )
  .default([]);

export const spaceInput = z.object({
  name: z.string().min(1),
  slug,
  summary: z.string().max(400).optional(),
  capacity: z.number().int().positive(),
  amenities: z.array(z.string()).default([]),
  photos: z.array(mediaRef).default([]),
  rules: z.string().optional(),
  availability: weeklyAvailability,
  minBookingMinutes: z.number().int().positive().default(60),
  requiresApproval: z.boolean().default(true),
  blocks,
  status: publishStatus.default('draft'),
});
export type SpaceInput = z.infer<typeof spaceInput>;

export const bookingStatus = z.enum(['pending', 'approved', 'declined', 'cancelled']);
export const bookingRequest = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string().min(7),
    organisation: z.string().optional(),
    purpose: z.string().min(3).max(1000),
    attendees: z.number().int().positive(),
    start: z.coerce.date(),
    end: z.coerce.date(),
    turnstileToken: z.string().optional(),
  })
  .refine((b) => b.end > b.start, { message: 'End must be after start', path: ['end'] });
export type BookingRequest = z.infer<typeof bookingRequest>;

/* ─── News (blog posts) ─────────────────────────────────────────────────── */
export const newsInput = z.object({
  title: z.string().min(1),
  slug,
  ...routed,
  excerpt: z.string().max(600).optional(),
  template: templateRef,
  fields: templateFields,
  categories: z.array(z.string()).default([]),
  cover: mediaRef.optional(),
  html: z.string().optional(),
  publishedAt: z.coerce.date().optional(),
  status: publishStatus.default('draft'),
  seo,
});
export type NewsInput = z.infer<typeof newsInput>;
