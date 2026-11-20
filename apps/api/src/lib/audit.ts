import { AuditLog } from '@itti/db';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { clientIp } from './http';

export async function audit(
  c: Context<AppEnv>,
  action: string,
  entity: string,
  entityId?: string,
  diff?: unknown,
) {
  const user = c.get('user');
  try {
    await AuditLog.create({
      userId: user?.id,
      userEmail: user?.email,
      action,
      entity,
      entityId,
      diff,
      ip: clientIp(c.req.raw.headers),
    });
  } catch (err) {
    console.warn('[audit] failed', err);
  }
}
