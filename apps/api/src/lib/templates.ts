import { Template } from '@itti/db';
import { validateTemplateFields, type ContentType, type TemplateField } from '@itti/schemas';
import { HTTPException } from 'hono/http-exception';

type TemplateDoc = { slug: string; title: string; contentType: ContentType | null; fields: TemplateField[]; isDefault?: boolean; status?: string };

/** The template a record uses: its own (if set) or the content type's default. */
export async function templateFor(type: ContentType, slug?: string | null): Promise<TemplateDoc | null> {
  if (slug) {
    const t = await Template.findOne({ slug, contentType: type, deletedAt: null }).select('-layout').lean<TemplateDoc>();
    if (!t) throw invalid({ template: `There is no ${type} template called “${slug}”` });
    return t;
  }
  return Template.findOne({ contentType: type, isDefault: true, deletedAt: null }).select('-layout').lean<TemplateDoc>();
}

function invalid(fields: Record<string, string>) {
  const res = new Response(JSON.stringify({ error: 'Please fix the highlighted fields', fields }), {
    status: 422,
    headers: { 'content-type': 'application/json' },
  });
  return new HTTPException(422, { res });
}

/**
 * Checks a record's template and fields.
 * - On save: the template must exist for this content type; field values must have the right shape.
 * - On publish (or saving with status "published"): required template fields must be filled in.
 */
export async function checkTemplatedRecord(type: ContentType, record: { template?: string | null; fields?: Record<string, unknown>; status?: string }, opts: { publish?: boolean } = {}) {
  const template = await templateFor(type, record.template);
  if (!template) return; // no templates registered yet: nothing to check against
  const publish = opts.publish || record.status === 'published';
  const { ok, errors } = validateTemplateFields(template.fields ?? [], record.fields, { publish });
  if (!ok) throw invalid(Object.fromEntries(Object.entries(errors).map(([k, v]) => [`fields.${k}`, v])));
}
