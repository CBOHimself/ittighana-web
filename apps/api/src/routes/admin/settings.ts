import { Redirect, SiteSettings } from '@itti/db';
import { can, redirectInput, siteSettingsInput } from '@itti/schemas';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { audit } from '../../lib/audit';
import { assertId, forbidden, notFound } from '../../lib/http';
import { revalidate } from '../../lib/revalidate';
import { requirePermission } from '../../middleware/rbac';
import type { AppEnv } from '../../types';

export const settingsRoutes = new Hono<AppEnv>()
  .get('/', requirePermission('content:read'), async (c) => {
    const doc = await SiteSettings.findOne({ key: 'site' }).lean();
    return c.json(siteSettingsInput.parse(doc?.value ?? {}));
  })
  .put('/', requirePermission('settings:manage'), zValidator('json', siteSettingsInput), async (c) => {
    const next = c.req.valid('json');
    // The stored document also holds design data the form doesn't edit (tokens, menus, theme
    // templates, logo); keep it and only replace the fields the form sends.
    const stored = ((await SiteSettings.findOne({ key: 'site' }).lean())?.value ?? {}) as Record<string, unknown>;
    const current = siteSettingsInput.parse(stored);
    // The HostHaus watermark can only be changed by a super admin.
    if (
      JSON.stringify(next.watermark) !== JSON.stringify(current.watermark) &&
      !can(c.get('user')?.role, 'watermark:manage')
    ) {
      throw forbidden('Only a super admin can change the HostHaus watermark');
    }
    await SiteSettings.updateOne({ key: 'site' }, { value: { ...stored, ...next }, updatedBy: c.get('user')?.id }, { upsert: true });
    await audit(c, 'update', 'settings', 'site');
    await revalidate(['settings', 'content']);
    return c.json(next);
  })

  /* Redirects ---------------------------------------------------------- */
  .get('/redirects', requirePermission('settings:manage'), async (c) => {
    return c.json(await Redirect.find({ deletedAt: null }).sort({ from: 1 }).lean());
  })
  .post('/redirects', requirePermission('settings:manage'), zValidator('json', redirectInput), async (c) => {
    const input = c.req.valid('json');
    const r = await Redirect.findOneAndUpdate({ from: input.from }, { ...input, deletedAt: null }, { upsert: true, new: true });
    await revalidate(['redirects']);
    return c.json(r, 201);
  })
  .delete('/redirects/:id', requirePermission('settings:manage'), async (c) => {
    const r = await Redirect.findByIdAndUpdate(assertId(c.req.param('id')), { deletedAt: new Date() });
    if (!r) throw notFound('Redirect');
    await revalidate(['redirects']);
    return c.json({ ok: true });
  });
