import { Media } from '@itti/db';
import { makeKey, MAX_UPLOAD_MB, processImage, PUBLIC_ALLOWED, trustedMime } from '@itti/media';
import { mediaUpdateInput, paginationQuery } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { assertId, badRequest, notFound } from '../../lib/http';
import { escapeRegex, paginate } from '../../lib/paginate';
import { requirePermission } from '../../middleware/rbac';
import { storage } from '../../services';
import type { AppEnv } from '../../types';

/** Media library: uploads land in the cPanel media folder (public). */
export const mediaRoutes = new Hono<AppEnv>()
  .get(
    '/',
    requirePermission('content:read'),
    zValidator('query', paginationQuery.extend({ folder: z.string().optional(), type: z.enum(['image', 'document', 'video']).optional() })),
    async (c) => {
      const { folder, type, ...q } = c.req.valid('query');
      const filter: Record<string, unknown> = { deletedAt: null, visibility: 'public' };
      if (folder !== undefined) filter.folder = folder;
      if (type === 'image') filter.mime = /^image\//;
      if (type === 'video') filter.mime = /^video\//;
      if (type === 'document') filter.mime = 'application/pdf';
      if (q.q) {
        const rx = { $regex: escapeRegex(q.q), $options: 'i' };
        filter.$or = [{ originalName: rx }, { alt: rx }];
      }
      return c.json(await paginate(Media, filter, q, { createdAt: -1 }));
    },
  )
  .get('/folders', requirePermission('content:read'), async (c) => {
    return c.json(await Media.distinct('folder', { deletedAt: null, visibility: 'public' }));
  })
  .post('/', requirePermission('media:write'), async (c) => {
    const body = await c.req.parseBody({ all: true });
    const folder = typeof body.folder === 'string' ? body.folder.slice(0, 120) : '';
    const files = ([] as unknown[]).concat(body.file ?? []).filter((f): f is File => f instanceof File);
    if (!files.length) throw badRequest('No file uploaded');

    const created = [];
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer());
      const mime = trustedMime(file.type, buf, PUBLIC_ALLOWED);
      if (!mime) throw badRequest(`${file.name}: file type not allowed`);
      const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('video/') ? 'video' : 'document';
      if (buf.length > MAX_UPLOAD_MB[kind] * 1024 * 1024) {
        throw badRequest(`${file.name}: larger than ${MAX_UPLOAD_MB[kind]}MB`);
      }
      const createdBy = c.get('user')?.id;

      if (kind === 'image') {
        const img = await processImage(buf);
        const key = makeKey(file.name, img.original.ext);
        const stored = await storage.put(key, img.original.buffer, 'public');
        const variants: Record<string, { url: string; width: number; height: number }> = {};
        for (const [name, v] of Object.entries(img.variants)) {
          const s = await storage.put(key.replace(/\.(\w+)$/, `-${name}.webp`), v.buffer, 'public');
          variants[name] = { url: s.url!, width: v.width, height: v.height };
        }
        created.push(
          await Media.create({
            path: key,
            url: stored.url,
            originalName: file.name,
            mime: img.original.mime,
            size: stored.size,
            width: img.original.width,
            height: img.original.height,
            variants,
            folder,
            createdBy,
          }),
        );
      } else {
        const key = makeKey(file.name);
        const stored = await storage.put(key, buf, 'public');
        created.push(
          await Media.create({ path: key, url: stored.url, originalName: file.name, mime, size: stored.size, folder, createdBy }),
        );
      }
    }
    await audit(c, 'upload', 'media', undefined, { count: created.length });
    return c.json(created.map((m) => m.toJSON()), 201);
  })
  .patch('/:id', requirePermission('media:write'), zValidator('json', mediaUpdateInput), async (c) => {
    const m = await Media.findOneAndUpdate(
      { _id: assertId(c.req.param('id')), deletedAt: null },
      c.req.valid('json'),
      { new: true },
    ).lean();
    if (!m) throw notFound('Media');
    return c.json(m);
  })
  .delete('/:id', requirePermission('media:write'), async (c) => {
    const id = assertId(c.req.param('id'));
    // Soft delete only: the file stays on disk so existing pages don't break.
    const m = await Media.findOneAndUpdate({ _id: id, deletedAt: null }, { deletedAt: new Date() }).lean();
    if (!m) throw notFound('Media');
    await audit(c, 'delete', 'media', id);
    return c.json({ ok: true });
  });
