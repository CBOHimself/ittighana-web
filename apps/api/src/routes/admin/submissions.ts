import { Form, FormSubmission, Media } from '@itti/db';
import { paginationQuery, submissionStatus, type FormField } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { audit } from '../../lib/audit';
import { assertId, notFound } from '../../lib/http';
import { escapeRegex, paginate } from '../../lib/paginate';
import { requirePermission } from '../../middleware/rbac';
import { storage } from '../../services';
import type { AppEnv } from '../../types';

const csvCell = (v: unknown) => {
  const s = Array.isArray(v) ? v.join('; ') : v instanceof Date ? v.toISOString() : String(v ?? '');
  // Prevent CSV formula injection in Excel
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export const submissionAdminRoutes = new Hono<AppEnv>()
  .get(
    '/',
    requirePermission('submissions:read'),
    zValidator('query', paginationQuery.extend({ formId: z.string().optional(), status: z.string().optional() })),
    async (c) => {
      const { formId, status, ...q } = c.req.valid('query');
      const filter: Record<string, unknown> = { deletedAt: null };
      if (formId) filter.formId = assertId(formId);
      if (status) filter.status = status;
      if (q.q) {
        const rx = { $regex: escapeRegex(q.q), $options: 'i' };
        filter.$or = [{ 'applicant.name': rx }, { 'applicant.email': rx }, { 'applicant.phone': rx }];
      }
      return c.json(await paginate(FormSubmission, filter, q, { createdAt: -1 }, '-data'));
    },
  )
  .get('/:id', requirePermission('submissions:read'), async (c) => {
    const s = await FormSubmission.findOne({ _id: assertId(c.req.param('id')), deletedAt: null }).populate('formId', 'name slug fields').lean();
    if (!s) throw notFound('Submission');
    return c.json(s);
  })
  .patch(
    '/:id',
    requirePermission('submissions:manage'),
    zValidator('json', z.object({ status: submissionStatus.optional(), note: z.string().min(1).max(2000).optional() })),
    async (c) => {
      const id = assertId(c.req.param('id'));
      const { status, note } = c.req.valid('json');
      const user = c.get('user');
      const update: Record<string, unknown> = {};
      if (status) update.$set = { status };
      if (note) update.$push = { notes: { by: user?.email ?? user?.id, text: note, at: new Date() } };
      const s = await FormSubmission.findOneAndUpdate({ _id: id, deletedAt: null }, update, { new: true }).lean();
      if (!s) throw notFound('Submission');
      await audit(c, 'update', 'submission', id, { status, note: Boolean(note) });
      return c.json(s);
    },
  )
  /** Stream a private applicant document (never publicly reachable). */
  .get('/:id/files/:mediaId', requirePermission('submissions:read'), async (c) => {
    const id = assertId(c.req.param('id'));
    const mediaId = c.req.param('mediaId');
    const s = await FormSubmission.findOne({ _id: id, 'files.mediaId': mediaId, deletedAt: null }, 'files').lean();
    if (!s) throw notFound('File');
    const m = await Media.findById(assertId(mediaId)).lean();
    if (!m || m.visibility !== 'private') throw notFound('File');
    await audit(c, 'download', 'submission-file', id, { mediaId });
    c.header('Content-Type', m.mime ?? 'application/octet-stream');
    c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(m.originalName ?? 'file')}"`);
    c.header('Cache-Control', 'private, no-store');
    const file = await storage.read(m.path, 'private');
    return stream(c, async (s) => {
      for await (const chunk of file) await s.write(chunk as Uint8Array);
    });
  })
  /** CSV export of every submission for a form. */
  .get('/export/:formId', requirePermission('submissions:read'), async (c) => {
    const formId = assertId(c.req.param('formId'));
    const form = await Form.findById(formId).lean();
    if (!form) throw notFound('Form');
    const fields = (form.fields as FormField[]).filter((f) => !['heading', 'paragraph', 'file'].includes(f.type));
    const subs = await FormSubmission.find({ formId, deletedAt: null }).sort({ createdAt: -1 }).lean();
    const header = ['Submitted', 'Status', 'Context', ...fields.map((f) => f.label), 'Files'];
    const rows = subs.map((s) => [
      s.createdAt,
      s.status,
      s.context?.title ?? '',
      ...fields.map((f) => (s.data as Record<string, unknown>)?.[f.name]),
      ((s.files ?? []) as Array<{ originalName?: string }>).map((f) => f.originalName).join('; '),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    await audit(c, 'export', 'form', formId);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="${form.slug}-applicants.csv"`);
    return c.body('\uFEFF' + csv);
  });
