import { Template } from '@itti/db';
import {
  buildTemplateFields,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  FIELD_CATALOG,
  templateInput,
  type ContentType,
  type LayoutNode,
  type TemplateField,
} from '@itti/schemas';
import { Hono } from 'hono';
import { audit } from '../../lib/audit';
import { assertId, badRequest, notFound } from '../../lib/http';
import { revalidate } from '../../lib/revalidate';
import { requirePermission } from '../../middleware/rbac';
import type { AppEnv } from '../../types';
import { crudRoutes } from './crud';

/**
 * Field list for a content template: keeps the admin's edits (labels, required, help)
 * for keys that are still in the layout, and adds catalog definitions for new keys.
 */
function mergeFields(type: ContentType, layout: LayoutNode[], current: TemplateField[] = []): TemplateField[] {
  const derived = buildTemplateFields(type, layout, current.map((f) => f.key));
  return derived.map((d) => ({ ...d, ...(current.find((c) => c.key === d.key) ?? {}) }));
}

const crud = crudRoutes({
  entity: 'template',
  model: Template,
  input: templateInput,
  searchField: 'title',
  listProjection: '-layout',
  extraTags: ['template'],
  read: 'content:read',
  write: 'settings:manage',
  publish: 'settings:manage',
  beforeSave: async (data, before) => {
    const type = (data.contentType ?? before?.contentType) as ContentType | null | undefined;
    if (!type) return data;
    const layout = (data.layout ?? before?.layout ?? []) as LayoutNode[];
    if ('layout' in data || 'contentType' in data || !before) {
      data.fields = mergeFields(type, layout, (data.fields ?? before?.fields ?? []) as TemplateField[]);
    }
    // One default per content type: setting a new one clears the old.
    if (data.isDefault === true) await Template.updateMany({ contentType: type, isDefault: true, slug: { $ne: data.slug ?? before?.slug } }, { isDefault: false });
    return data;
  },
});

export const templateRoutes = new Hono<AppEnv>()
  /** Content types, their URL prefix, canonical fields and available templates (for the admin picker). */
  .get('/content-types', requirePermission('content:read'), async (c) => {
    const templates = await Template.find({ contentType: { $in: CONTENT_TYPES }, deletedAt: null, status: 'published' })
      .select('title slug contentType description preview isDefault fields')
      .sort({ isDefault: -1, title: 1 })
      .lean();
    return c.json(
      CONTENT_TYPES.map((type) => ({
        type,
        ...CONTENT_TYPE_LABELS[type],
        fields: FIELD_CATALOG[type],
        templates: templates.filter((t) => t.contentType === type),
      })),
    );
  })

  /** Re-read the layout and rebuild the template's field list (keeps edited labels/required flags). */
  .post('/:id/sync-fields', requirePermission('settings:manage'), async (c) => {
    const id = assertId(c.req.param('id'));
    const t = await Template.findOne({ _id: id, deletedAt: null });
    if (!t) throw notFound('Template');
    if (!t.contentType) throw badRequest('Only content templates have fields');
    t.fields = mergeFields(t.contentType as ContentType, t.layout as LayoutNode[], t.fields as TemplateField[]);
    await t.save();
    await audit(c, 'sync-fields', 'template', id);
    return c.json(t.toJSON());
  })

  /** Make this the template used when a record doesn't choose one. */
  .post('/:id/make-default', requirePermission('settings:manage'), async (c) => {
    const id = assertId(c.req.param('id'));
    const t = await Template.findOne({ _id: id, deletedAt: null });
    if (!t) throw notFound('Template');
    if (!t.contentType) throw badRequest('Only content templates can be a default');
    await Template.updateMany({ contentType: t.contentType, isDefault: true }, { isDefault: false });
    t.isDefault = true;
    await t.save();
    await audit(c, 'make-default', 'template', id);
    await revalidate(['content', 'template', t.contentType]);
    return c.json(t.toJSON());
  })

  .route('/', crud);
