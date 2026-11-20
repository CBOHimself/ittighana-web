import { can, paginationQuery, type ContentType, type Permission } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';
import type { Model } from 'mongoose';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { assertId, conflict, notFound } from '../../lib/http';
import { escapeRegex, paginate } from '../../lib/paginate';
import { revalidate } from '../../lib/revalidate';
import { sanitizeBlocks } from '../../lib/sanitize';
import { checkTemplatedRecord } from '../../lib/templates';
import { requirePermission } from '../../middleware/rbac';
import type { AppEnv } from '../../types';

type CrudOptions = {
  /** Entity name used for audit + revalidation tags, e.g. "course". */
  entity: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: z.ZodType<any>;
  /** Schema for PATCH. Defaults to input.partial() for plain object schemas. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patchInput?: z.ZodType<any>;
  /** Field matched by the ?q= search. */
  searchField?: string;
  defaultSort?: Record<string, 1 | -1>;
  read?: Permission;
  write?: Permission;
  publish?: Permission;
  /** Fields included in list responses (omit heavy ones like blocks). */
  listProjection?: string;
  /** Extra revalidation tags to bust on any change (e.g. a listing page). */
  extraTags?: string[];
  /** Content type whose template + fields are validated on save and publish. */
  templated?: ContentType;
  /** Last chance to adjust data before it's written (create: before is undefined). */
  beforeSave?: (data: Record<string, unknown>, before?: Record<string, unknown>) => Promise<Record<string, unknown>> | Record<string, unknown>;
};

const listQuery = paginationQuery.extend({
  status: z.string().optional(),
  sort: z.string().optional(),
  /** Templates: only those for one content type (e.g. ?contentType=course). */
  contentType: z.string().optional(),
  /** Templated content: only records using one template. */
  template: z.string().optional(),
});

/**
 * Generic, permission-checked CRUD for admin content.
 * GET / · GET /:id · POST / · PATCH /:id · DELETE /:id · POST /:id/publish · POST /:id/unpublish
 */
export function crudRoutes(o: CrudOptions) {
  const read = o.read ?? 'content:read';
  const write = o.write ?? 'content:write';
  const publish = o.publish ?? 'content:publish';
  // 'content' busts every rendered page (layouts embed lists/templates from many entities).
  const tags = (slug?: string) => ['content', o.entity, ...(slug ? [`${o.entity}:${slug}`] : []), ...(o.extraTags ?? [])];

  const prepare = (data: Record<string, unknown>) => {
    if ('blocks' in data) data.blocks = sanitizeBlocks(data.blocks);
    return data;
  };

  // Partial schema for PATCH. Object schemas with refinements can't be made partial,
  // so those resources pass an explicit patchInput.
  const patchSchema = o.patchInput ?? (o.input instanceof z.ZodObject ? o.input.partial() : o.input);

  return new Hono<AppEnv>()
    .get('/', requirePermission(read), zValidator('query', listQuery), async (c) => {
      const { status, sort, contentType, template, ...q } = c.req.valid('query');
      const filter: Record<string, unknown> = { deletedAt: null };
      if (status) filter.status = status;
      if (contentType) filter.contentType = contentType;
      if (template) filter.template = template;
      if (q.q && o.searchField) filter[o.searchField] = { $regex: escapeRegex(q.q), $options: 'i' };
      const sortSpec = sort
        ? { [sort.replace(/^-/, '')]: (sort.startsWith('-') ? -1 : 1) as 1 | -1 }
        : (o.defaultSort ?? { updatedAt: -1 });
      return c.json(await paginate(o.model, filter, q, sortSpec, o.listProjection));
    })

    .get('/:id', requirePermission(read), async (c) => {
      const doc = await o.model.findOne({ _id: assertId(c.req.param('id')), deletedAt: null }).lean();
      if (!doc) throw notFound(o.entity);
      return c.json(doc);
    })

    .post('/', requirePermission(write), zValidator('json', o.input), async (c) => {
      const data = prepare({ ...(c.req.valid('json') as Record<string, unknown>) });
      const user = c.get('user');
      if (data.status === 'published' && !(await canPublish(c, publish))) data.status = 'review';
      if (o.templated) await checkTemplatedRecord(o.templated, data as never);
      if (o.beforeSave) Object.assign(data, await o.beforeSave(data));
      try {
        const doc = await o.model.create({ ...data, createdBy: user?.id, updatedBy: user?.id });
        await audit(c, 'create', o.entity, String(doc._id));
        if (doc.status === 'published' || !('status' in doc)) await revalidate(tags(doc.slug));
        return c.json(doc.toJSON(), 201);
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw conflict('That slug is already in use');
        throw err;
      }
    })

    .patch('/:id', requirePermission(write), zValidator('json', patchSchema), async (c) => {
      const id = assertId(c.req.param('id'));
      const data = prepare({ ...(c.req.valid('json') as Record<string, unknown>) });
      if (data.status === 'published' && !(await canPublish(c, publish))) delete data.status;
      const before = await o.model.findOne({ _id: id, deletedAt: null }).lean<Record<string, unknown>>();
      if (!before) throw notFound(o.entity);
      if (o.templated && ('template' in data || 'fields' in data || data.status === 'published')) {
        // Field values merge into what's stored, so a template switch or a partial save never drops data.
        if ('fields' in data) data.fields = { ...((before.fields as object) ?? {}), ...((data.fields as object) ?? {}) };
        await checkTemplatedRecord(o.templated, {
          template: ('template' in data ? data.template : before.template) as string | null | undefined,
          fields: (data.fields ?? before.fields) as Record<string, unknown>,
          status: (data.status ?? before.status) as string,
        });
      }
      if (o.beforeSave) Object.assign(data, await o.beforeSave(data, before));
      try {
        const doc = await o.model
          .findByIdAndUpdate(id, { ...data, updatedBy: c.get('user')?.id }, { new: true, runValidators: true })
          .lean<Record<string, unknown>>();
        await audit(c, 'update', o.entity, id, { fields: Object.keys(data) });
        await revalidate([...tags(before.slug as string | undefined), ...tags(doc?.slug as string | undefined)]);
        return c.json(doc);
      } catch (err) {
        if ((err as { code?: number }).code === 11000) throw conflict('That slug is already in use');
        throw err;
      }
    })

    .post('/:id/publish', requirePermission(publish), async (c) => {
      const id = assertId(c.req.param('id'));
      if (o.templated) {
        const current = await o.model.findOne({ _id: id, deletedAt: null }).lean<Record<string, unknown>>();
        if (!current) throw notFound(o.entity);
        await checkTemplatedRecord(o.templated, current as never, { publish: true });
      }
      const doc = await o.model
        .findOneAndUpdate({ _id: id, deletedAt: null }, { status: 'published', updatedBy: c.get('user')?.id }, { new: true })
        .lean<Record<string, unknown>>();
      if (!doc) throw notFound(o.entity);
      await audit(c, 'publish', o.entity, id);
      await revalidate(tags(doc.slug as string | undefined));
      return c.json(doc);
    })

    .post('/:id/unpublish', requirePermission(publish), async (c) => {
      const id = assertId(c.req.param('id'));
      const doc = await o.model
        .findOneAndUpdate({ _id: id, deletedAt: null }, { status: 'draft', updatedBy: c.get('user')?.id }, { new: true })
        .lean<Record<string, unknown>>();
      if (!doc) throw notFound(o.entity);
      await audit(c, 'unpublish', o.entity, id);
      await revalidate(tags(doc.slug as string | undefined));
      return c.json(doc);
    })

    .delete('/:id', requirePermission(write), async (c) => {
      const id = assertId(c.req.param('id'));
      const doc = await o.model
        .findOneAndUpdate(
          { _id: id, deletedAt: null },
          // free the slug so it can be reused
          [{ $set: { deletedAt: new Date(), path: null, slug: { $concat: [{ $ifNull: ['$slug', ''] }, '--deleted-', { $toString: '$_id' }] } } }],
          { new: false, updatePipeline: true },
        )
        .lean<Record<string, unknown>>();
      if (!doc) throw notFound(o.entity);
      await audit(c, 'delete', o.entity, id);
      await revalidate(tags(doc.slug as string | undefined));
      return c.json({ ok: true });
    });
}

async function canPublish(c: Context<AppEnv>, permission: Permission) {
  return can(c.get('user')?.role, permission);
}
