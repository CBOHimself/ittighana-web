import { nativeDb } from '../connection';
import { m001 } from './001-indexes';
import { m002 } from './002-site-settings';
import { m003 } from './003-import-wordpress';
import { m004 } from './004-content-templates';
import { m005 } from './005-template-refs';
import { m006 } from './006-wordpress-2024-cleanup';
import type { Migration, MigrationContext } from './types';

export type { Migration, MigrationContext } from './types';

/**
 * Versioned migrations, applied in order and recorded in the `migrations` collection.
 * Add new ones at the end with a new id; never edit or reorder released migrations.
 */
export const MIGRATIONS: Migration[] = [m001, m002, m003, m004, m005, m006];

type Applied = { _id: string; description: string; appliedAt: Date; durationMs: number };

export async function migrationStatus() {
  const applied = await nativeDb().collection<Applied>('migrations').find().toArray();
  return MIGRATIONS.map((m) => ({ id: m.id, description: m.description, appliedAt: applied.find((a) => a._id === m.id)?.appliedAt ?? null }));
}

/** Apply pending migrations (or one named migration again with `only` + `force`). */
export async function migrate(opts: { contentDir: string; dryRun?: boolean; only?: string; force?: boolean; log?: (m: string) => void }) {
  const log = opts.log ?? console.log;
  const db = nativeDb();
  const col = db.collection<Applied>('migrations');
  const done = new Set((await col.find().project({ _id: 1 }).toArray()).map((d) => d._id));
  const ran: string[] = [];
  for (const m of MIGRATIONS) {
    if (opts.only && m.id !== opts.only) continue;
    if (done.has(m.id) && !opts.force) continue;
    log(`\n▶ ${m.id}: ${m.description}${opts.dryRun ? ' (dry run)' : ''}`);
    const started = Date.now();
    const ctx: MigrationContext = { db, contentDir: opts.contentDir, dryRun: Boolean(opts.dryRun), log: (s) => log(`  · ${s}`) };
    await m.up(ctx);
    if (!opts.dryRun) {
      await col.updateOne({ _id: m.id }, { $set: { description: m.description, appliedAt: new Date(), durationMs: Date.now() - started } }, { upsert: true });
    }
    ran.push(m.id);
  }
  return ran;
}
