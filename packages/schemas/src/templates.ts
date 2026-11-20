import { z } from 'zod';
import type { LayoutNode } from './layout';

/**
 * Content templates
 * ─────────────────
 * Repeating content (courses, news, events, student articles, careers) is stored as
 * data: a few core properties (title, slug, cover, dates…) plus `fields`, and a
 * `template` that decides how the record looks on the website.
 *
 * A template is a layout (the same component tree the pages use) with dynamic values
 * that read the record (`{ $dyn: 'field', field: 'course_overview' }`). Each template
 * declares the fields it shows, so the admin can build the right form and the API can
 * check the data before it is published. Field keys are shared across every template of
 * a content type (see FIELD_CATALOG), so switching template never loses data.
 */

export const CONTENT_TYPES = ['course', 'news', 'event', 'article', 'career'] as const;
export const contentType = z.enum(CONTENT_TYPES);
export type ContentType = z.infer<typeof contentType>;

export const CONTENT_TYPE_LABELS: Record<ContentType, { singular: string; plural: string; urlPrefix: string }> = {
  course: { singular: 'Course', plural: 'Courses', urlPrefix: '/itti-course/' },
  news: { singular: 'News post', plural: 'News', urlPrefix: '/' },
  event: { singular: 'Event', plural: 'Events', urlPrefix: '/events/' },
  article: { singular: 'Student article', plural: 'Student articles', urlPrefix: '/student-article/' },
  career: { singular: 'Career opening', plural: 'Careers', urlPrefix: '/careers/' },
};

export const FIELD_TYPES = ['text', 'textarea', 'richtext', 'image', 'gallery', 'file', 'link', 'date', 'datetime', 'number', 'list'] as const;
export const templateFieldType = z.enum(FIELD_TYPES);
export type TemplateFieldType = z.infer<typeof templateFieldType>;

export const templateField = z.object({
  /** Stable key stored in record.fields (snake_case, shared across templates). */
  key: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Use lowercase letters, numbers and underscores'),
  label: z.string().min(1),
  type: templateFieldType,
  /** Must be filled in before the record can be published. */
  required: z.boolean().default(false),
  help: z.string().optional(),
  /** Form section in the admin (e.g. "Overview", "Details"). */
  group: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});
export type TemplateField = z.infer<typeof templateField>;

const f = (key: string, label: string, type: TemplateFieldType, extra: Partial<TemplateField> = {}): TemplateField => ({
  key,
  label,
  type,
  required: false,
  ...extra,
});

/**
 * Canonical fields per content type. Template field lists are built from these, so the
 * same key always means the same thing (e.g. course_overview is always rich text).
 * The course keys match the original WordPress (ACF) field names, so imported data fits.
 */
export const FIELD_CATALOG: Record<ContentType, TemplateField[]> = {
  course: [
    f('custom_subheading', 'Subheading', 'text', { group: 'Overview', maxLength: 160 }),
    f('course_overview', 'Overview', 'richtext', { group: 'Overview', required: true }),
    f('learning_outcomes', 'Learning objectives', 'richtext', { group: 'Overview', required: true }),
    f('course_content', 'Course content', 'richtext', { group: 'Curriculum' }),
    f('training_methodology', 'Training methodology / delivery', 'richtext', { group: 'Curriculum' }),
    f('course_material', 'Course material', 'richtext', { group: 'Curriculum' }),
    f('who_needs_this_course', 'Who should take this course', 'richtext', { group: 'Audience' }),
    f('course_benefits', 'Benefits', 'richtext', { group: 'Audience' }),
    f('certification', 'Certification', 'textarea', { group: 'Certification', required: true }),
    f('exam_window', 'Exam window', 'textarea', { group: 'Certification' }),
    f('featured_image_1', 'Image 1', 'image', { group: 'Images' }),
    f('featured_image_2', 'Image 2', 'image', { group: 'Images' }),
    f('featured_image_3', 'Image 3', 'image', { group: 'Images' }),
  ],
  news: [
    f('subtitle', 'Subtitle', 'text', { group: 'Story', maxLength: 200 }),
    f('body', 'Story', 'richtext', { group: 'Story', required: true, help: 'The article text.' }),
    f('gallery', 'Photos', 'gallery', { group: 'Media' }),
    f('source_link', 'Source / further reading', 'link', { group: 'Media' }),
  ],
  event: [
    f('event_name', 'Event name (display)', 'text', { group: 'Event', help: 'Leave empty to use the title.' }),
    f('event_date', 'Date (display text)', 'text', { group: 'Event', help: 'e.g. "Saturday 6 December 2025". The start/end dates drive the calendar.' }),
    f('event_time', 'Time', 'text', { group: 'Event', help: 'e.g. "9:00am – 1:00pm"' }),
    f('event_location', 'Location', 'text', { group: 'Event', required: true }),
    f('event_description', 'Description', 'richtext', { group: 'Event', required: true }),
    f('registration_link', 'Registration link', 'link', { group: 'Event' }),
    f('gallery', 'Photos', 'gallery', { group: 'Media' }),
  ],
  article: [
    f('article_title', 'Article title (display)', 'text', { group: 'Article', help: 'Leave empty to use the title.' }),
    f('author', 'Student name', 'text', { group: 'Article', required: true }),
    f('programme', 'Programme / class', 'text', { group: 'Article' }),
    f('introduction', 'Introduction', 'richtext', { group: 'Article', required: true }),
    f('body', 'Article', 'richtext', { group: 'Article' }),
    f('article_image', 'Article image', 'image', { group: 'Media' }),
    f('article_pdf', 'Full article (PDF)', 'file', { group: 'Media' }),
  ],
  career: [
    f('role_summary', 'Role summary', 'textarea', { group: 'Role', required: true, maxLength: 400 }),
    f('responsibilities', 'Responsibilities', 'richtext', { group: 'Role', required: true }),
    f('requirements', 'Requirements', 'richtext', { group: 'Role', required: true }),
    f('benefits', 'What we offer', 'richtext', { group: 'Role' }),
    f('how_to_apply', 'How to apply', 'richtext', { group: 'Applying' }),
    f('apply_link', 'Apply link', 'link', { group: 'Applying', help: 'Leave empty to use the application form.' }),
  ],
};

/** Field keys a layout reads through `{ $dyn: 'field' }` values (in render order, de-duplicated). */
export function fieldsInLayout(nodes: LayoutNode[] | undefined): string[] {
  const keys: string[] = [];
  const visit = (v: unknown) => {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    if (o.$dyn === 'field' && typeof o.field === 'string' && !keys.includes(o.field)) keys.push(o.field);
    Object.values(o).forEach(visit);
  };
  visit(nodes ?? []);
  return keys;
}

/**
 * The field list for a template: every catalog field the layout shows, in catalog order,
 * plus any other keys it reads (as plain text) so nothing is silently dropped.
 */
export function buildTemplateFields(type: ContentType, layout: LayoutNode[] | undefined, extraKeys: string[] = []): TemplateField[] {
  const used = new Set([...fieldsInLayout(layout), ...extraKeys]);
  const catalog = FIELD_CATALOG[type];
  const known = catalog.filter((d) => used.has(d.key));
  const unknown = [...used]
    .filter((k) => !catalog.some((d) => d.key === k) && /^[a-z][a-z0-9_]*$/.test(k))
    .map((k) => f(k, k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), 'text', { group: 'Other' }));
  return [...known, ...unknown];
}

/* ─── Validation ─────────────────────────────────────────────────────────── */

const mediaValue = z.object({ url: z.string().min(1), alt: z.string().optional() }).passthrough();
const linkValue = z.union([z.string().url(), z.string().startsWith('/'), z.object({ url: z.string().min(1), label: z.string().optional() })]);

const VALUE_SCHEMAS: Record<TemplateFieldType, z.ZodType> = {
  text: z.string(),
  textarea: z.string(),
  richtext: z.string(),
  image: z.union([mediaValue, z.string().min(1)]),
  gallery: z.array(z.union([mediaValue, z.string().min(1)])),
  file: z.union([mediaValue, z.string().min(1)]),
  link: linkValue,
  date: z.coerce.date(),
  datetime: z.coerce.date(),
  number: z.coerce.number(),
  list: z.array(z.string()),
};

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.replace(/<[^>]*>/g, '').trim() === '') || (Array.isArray(v) && v.length === 0);

export type FieldErrors = Record<string, string>;

/**
 * Checks record.fields against a template's field list.
 * - Always: values must have the right shape for their field type and length limits.
 * - When publishing: required fields must be filled in.
 * Keys the template doesn't define are kept (another template may use them).
 */
export function validateTemplateFields(defs: TemplateField[], values: Record<string, unknown> | undefined, opts: { publish?: boolean } = {}) {
  const errors: FieldErrors = {};
  const data = { ...(values ?? {}) };
  for (const def of defs) {
    const v = data[def.key];
    if (isEmpty(v)) {
      if (opts.publish && def.required) errors[def.key] = `${def.label} is required before publishing`;
      continue;
    }
    const parsed = VALUE_SCHEMAS[def.type].safeParse(v);
    if (!parsed.success) {
      errors[def.key] = `${def.label}: expected ${def.type}`;
      continue;
    }
    if (def.maxLength && typeof v === 'string' && v.length > def.maxLength) {
      errors[def.key] = `${def.label} must be ${def.maxLength} characters or fewer`;
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, data };
}
