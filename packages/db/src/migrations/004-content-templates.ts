import { FIELD_CATALOG, buildTemplateFields, type LayoutNode } from '@itti/schemas';
import { buildContentTemplate, CONTENT_TEMPLATE_SPECS, WORDPRESS_CONTENT_TEMPLATES } from '../content-templates';
import { Template } from '../models';
import type { Migration } from './types';

/**
 * Content templates: the WordPress course and news layouts become selectable templates,
 * and new templates are added for events, student articles, careers and a news variant.
 * Each gets its field list (used by the admin form and API validation) and one default per type.
 */
export const m004: Migration = {
  id: '20261116-04-content-templates',
  description: 'Register course/news/event/student-article/career templates with their fields',
  async up({ log, dryRun }) {
    for (const wp of WORDPRESS_CONTENT_TEMPLATES) {
      const t = await Template.findOne({ slug: { $regex: `^${wp.slugPrefix}(-\\d+)?$` }, deletedAt: null });
      if (!t) { log(`missing WordPress template ${wp.slugPrefix} (import content first)`); continue; }
      const catalogKeys = new Set(FIELD_CATALOG[wp.contentType].map((f) => f.key));
      // Only catalog fields: leftovers in old layouts (e.g. a course field in the news template) are ignored.
      const fields = buildTemplateFields(wp.contentType, t.layout as LayoutNode[], wp.extraFields).filter((f) => catalogKeys.has(f.key));
      log(`${t.slug} → ${wp.contentType} template (${fields.length} fields)${wp.isDefault ? ', default' : ''}`);
      if (dryRun) continue;
      if (wp.isDefault) await Template.updateMany({ contentType: wp.contentType, isDefault: true, _id: { $ne: t._id } }, { isDefault: false });
      Object.assign(t, { contentType: wp.contentType, fields, isDefault: wp.isDefault ?? false, description: wp.description, ...(wp.title ? { title: wp.title } : {}) });
      await t.save();
    }

    const base = await Template.findOne({ slug: { $regex: '^itti-course-template-2(-\\d+)?$' } }).lean();
    if (!base) return log('skipped generated templates: course template 2 not found');
    for (const spec of CONTENT_TEMPLATE_SPECS) {
      const doc = buildContentTemplate(base.layout as LayoutNode[], spec);
      log(`${spec.slug} → ${spec.contentType} template (${doc.fields.length} fields)${spec.isDefault ? ', default' : ''}`);
      if (dryRun) continue;
      if (spec.isDefault) await Template.updateMany({ contentType: spec.contentType, isDefault: true, slug: { $ne: spec.slug } }, { isDefault: false });
      // Don't overwrite a template an admin has since edited.
      await Template.updateOne({ slug: spec.slug }, { $setOnInsert: { ...doc, deletedAt: null } }, { upsert: true });
    }
  },
};
