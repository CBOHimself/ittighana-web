// mongoose is CommonJS: use the default export for runtime values in ESM builds.
import mongoose, { type Model } from 'mongoose';

const { model, models, Schema } = mongoose;
type Schema<T = any> = mongoose.Schema<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
import { baseSchema, blocksDef, mediaRefSchema, publishStatusDef, seoSchema } from './helpers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getModel<S extends Schema<any>>(name: string, schema: S, collection: string) {
  return (models[name] as Model<S extends Schema<infer T> ? T : never>) ?? model(name, schema, collection);
}

/* ─── Pages ─────────────────────────────────────────────────────────────── */
/** Path + layout fields shared by everything rendered at a public URL. */
const routedDef = {
  path: { type: String, default: null },
  layout: { type: [Schema.Types.Mixed], default: [] },
  wpId: { type: Number, index: true },
};
const pathIndex = [{ path: 1 }, { unique: true, partialFilterExpression: { path: { $type: 'string' } } }] as const;

const pageSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  ...routedDef,
  pageTemplate: { type: String, default: 'default' },
  html: String,
  cover: mediaRefSchema,
  template: { type: String, default: 'default' },
  blocks: blocksDef,
  seo: { type: seoSchema, default: {} },
  status: publishStatusDef,
});
pageSchema.index(...pathIndex);
export const Page = getModel('Page', pageSchema, 'pages');

/* ─── Courses ───────────────────────────────────────────────────────────── */
const courseCategorySchema = baseSchema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  order: { type: Number, default: 0 },
  image: mediaRefSchema,
});
export const CourseCategory = getModel('CourseCategory', courseCategorySchema, 'course_categories');

const courseSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  ...routedDef,
  categoryId: { type: Schema.Types.ObjectId, ref: 'CourseCategory', index: true },
  template: { type: String, default: null, index: true },
  fields: { type: Schema.Types.Mixed, default: {} },
  summary: String,
  duration: String,
  mode: { type: String, enum: ['in-person', 'online', 'hybrid'] },
  fees: { amount: Number, currency: { type: String, default: 'GHS' }, note: String },
  intakes: [{ _id: false, label: String, startDate: Date }],
  cover: mediaRefSchema,
  gallery: { type: [mediaRefSchema], default: [] },
  blocks: blocksDef,
  formId: { type: Schema.Types.ObjectId, ref: 'Form' },
  order: { type: Number, default: 0 },
  publishedAt: Date,
  status: publishStatusDef,
  seo: { type: seoSchema, default: {} },
});
courseSchema.index({ categoryId: 1, status: 1, order: 1 });
courseSchema.index({ title: 'text', summary: 'text' });
courseSchema.index(...pathIndex);
export const Course = getModel('Course', courseSchema, 'courses');

/* ─── Careers ───────────────────────────────────────────────────────────── */
const careerSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  template: { type: String, default: null, index: true },
  fields: { type: Schema.Types.Mixed, default: {} },
  department: String,
  location: String,
  employmentType: String,
  summary: String,
  deadline: { type: Date, index: true },
  cover: mediaRefSchema,
  blocks: blocksDef,
  formId: { type: Schema.Types.ObjectId, ref: 'Form' },
  status: publishStatusDef,
  seo: { type: seoSchema, default: {} },
});
careerSchema.index({ title: 'text', summary: 'text' });
export const Career = getModel('Career', careerSchema, 'careers');

/* ─── Events ────────────────────────────────────────────────────────────── */
const eventSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  summary: String,
  template: { type: String, default: null, index: true },
  fields: { type: Schema.Types.Mixed, default: {} },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  allDay: { type: Boolean, default: false },
  location: String,
  onlineUrl: String,
  category: String,
  color: String,
  cover: mediaRefSchema,
  gallery: { type: [mediaRefSchema], default: [] },
  blocks: blocksDef,
  registrationFormId: { type: Schema.Types.ObjectId, ref: 'Form' },
  rrule: String,
  status: publishStatusDef,
  seo: { type: seoSchema, default: {} },
});
eventSchema.index({ start: 1, end: 1, status: 1 });
export const Event = getModel('Event', eventSchema, 'events');

/* ─── News (blog posts) ─────────────────────────────────────────────────── */
const newsSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  ...routedDef,
  excerpt: String,
  template: { type: String, default: null, index: true },
  fields: { type: Schema.Types.Mixed, default: {} },
  categories: { type: [String], default: [], index: true },
  cover: mediaRefSchema,
  html: String,
  publishedAt: { type: Date, index: true },
  status: publishStatusDef,
  seo: { type: seoSchema, default: {} },
});
newsSchema.index({ status: 1, publishedAt: -1 });
newsSchema.index(...pathIndex);
export const News = getModel('News', newsSchema, 'news');

/* ─── Templates (header, footer, single layouts, popups, sections) ─────── */
const templateSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  kind: { type: String, required: true, index: true },
  conditions: { type: [String], default: [], index: true },
  layout: { type: [Schema.Types.Mixed], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  wpId: { type: Number, index: true },
  // Content templates (courses, news, events, student articles, careers)
  contentType: { type: String, default: null, index: true },
  fields: { type: [Schema.Types.Mixed], default: [] },
  isDefault: { type: Boolean, default: false },
  description: String,
  preview: mediaRefSchema,
});
// At most one default template per content type
templateSchema.index({ contentType: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });
export const Template = getModel('Template', templateSchema, 'templates');

/* ─── Campus ────────────────────────────────────────────────────────────── */
const galleryAlbumSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  cover: mediaRefSchema,
  items: { type: [mediaRefSchema], default: [] },
  takenAt: Date,
  order: { type: Number, default: 0 },
  status: publishStatusDef,
});
export const GalleryAlbum = getModel('GalleryAlbum', galleryAlbumSchema, 'gallery_albums');

const articleSchema = baseSchema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  ...routedDef,
  template: { type: String, default: null, index: true },
  fields: { type: Schema.Types.Mixed, default: {} },
  html: String,
  excerpt: String,
  author: { name: String, programme: String, photo: mediaRefSchema },
  cover: mediaRefSchema,
  blocks: blocksDef,
  tags: { type: [String], default: [], index: true },
  publishedAt: Date,
  status: publishStatusDef,
  seo: { type: seoSchema, default: {} },
});
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ title: 'text', excerpt: 'text' });
articleSchema.index(...pathIndex);
export const Article = getModel('Article', articleSchema, 'articles');

const spaceSchema = baseSchema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  summary: String,
  capacity: { type: Number, required: true },
  amenities: { type: [String], default: [] },
  photos: { type: [mediaRefSchema], default: [] },
  rules: String,
  availability: [{ _id: false, day: Number, open: String, close: String }],
  minBookingMinutes: { type: Number, default: 60 },
  requiresApproval: { type: Boolean, default: true },
  blocks: blocksDef,
  status: publishStatusDef,
});
export const Space = getModel('Space', spaceSchema, 'spaces');

const spaceBookingSchema = baseSchema({
  spaceId: { type: Schema.Types.ObjectId, ref: 'Space', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  organisation: String,
  purpose: String,
  attendees: Number,
  start: { type: Date, required: true },
  end: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'declined', 'cancelled'],
    default: 'pending',
    index: true,
  },
  adminNote: String,
  decidedBy: String,
  decidedAt: Date,
});
spaceBookingSchema.index({ spaceId: 1, status: 1, start: 1, end: 1 });
export const SpaceBooking = getModel('SpaceBooking', spaceBookingSchema, 'space_bookings');

/* ─── Forms & submissions ───────────────────────────────────────────────── */
const formSchema = baseSchema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  description: String,
  kind: { type: String, default: 'enrolment' },
  fields: { type: [Schema.Types.Mixed], default: [] },
  settings: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft', index: true },
});
export const Form = getModel('Form', formSchema, 'forms');

const storedFileSchema = new Schema(
  { field: String, mediaId: String, originalName: String, mime: String, size: Number },
  { _id: false },
);
const formSubmissionSchema = baseSchema({
  formId: { type: Schema.Types.ObjectId, ref: 'Form', required: true },
  /** Where the applicant came from (course/career/event). */
  context: { kind: String, refId: Schema.Types.ObjectId, title: String },
  data: { type: Schema.Types.Mixed, default: {} },
  files: { type: [storedFileSchema], default: [] },
  applicant: { name: String, email: { type: String, index: true }, phone: String },
  status: { type: String, default: 'new' },
  notes: [{ _id: false, by: String, text: String, at: { type: Date, default: Date.now } }],
  ip: String,
  userAgent: String,
});
formSubmissionSchema.index({ formId: 1, status: 1, createdAt: -1 });
export const FormSubmission = getModel('FormSubmission', formSubmissionSchema, 'form_submissions');

/* ─── Contact inbox ─────────────────────────────────────────────────────── */
const contactMessageSchema = baseSchema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  subject: String,
  message: { type: String, required: true },
  read: { type: Boolean, default: false, index: true },
  replied: { type: Boolean, default: false },
  ip: String,
});
export const ContactMessage = getModel('ContactMessage', contactMessageSchema, 'contact_messages');

/* ─── Media library ─────────────────────────────────────────────────────── */
const mediaSchema = baseSchema({
  /** Path relative to the visibility root, e.g. uploads/2026/11/photo.webp */
  path: { type: String, required: true, unique: true },
  url: String,
  visibility: { type: String, enum: ['public', 'private'], default: 'public', index: true },
  originalName: String,
  title: String,
  mime: String,
  size: Number,
  width: Number,
  height: Number,
  alt: { type: String, default: '' },
  folder: { type: String, default: '', index: true },
  variants: { type: Schema.Types.Mixed, default: {} },
  source: { type: String, enum: ['upload', 'wordpress'], default: 'upload' },
  wpId: { type: Number, index: true },
  /** false while the file is still missing on the media server (placeholder shown). */
  available: { type: Boolean, default: true },
});
export const Media = getModel('Media', mediaSchema, 'media');

/* ─── Settings, redirects, audit ────────────────────────────────────────── */
const siteSettingsSchema = baseSchema({
  key: { type: String, default: 'site', unique: true },
  value: { type: Schema.Types.Mixed, default: {} },
});
export const SiteSettings = getModel('SiteSettings', siteSettingsSchema, 'site_settings');

const redirectSchema = baseSchema({
  from: { type: String, required: true, unique: true },
  to: { type: String, required: true },
  code: { type: Number, default: 301 },
  hits: { type: Number, default: 0 },
});
export const Redirect = getModel('Redirect', redirectSchema, 'redirects');

const auditLogSchema = new Schema(
  {
    userId: String,
    userEmail: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: String,
    diff: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });
export const AuditLog = getModel('AuditLog', auditLogSchema, 'audit_log');

export const allModels = {
  Page,
  CourseCategory,
  Course,
  Career,
  Event,
  GalleryAlbum,
  Article,
  News,
  Template,
  Space,
  SpaceBooking,
  Form,
  FormSubmission,
  ContactMessage,
  Media,
  SiteSettings,
  Redirect,
  AuditLog,
};
