/**
 * Database migrations.
 *
 *   pnpm db:migrate                 # apply pending migrations
 *   pnpm db:migrate -- --status     # list applied / pending
 *   pnpm db:migrate -- --dry-run    # show what would happen
 *   pnpm db:migrate -- --only 20261116-04-content-templates --force   # re-run one
 *   pnpm db:migrate -- --content ../../content/itti
 */
import path from 'node:path';
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../connection';
import { migrate, migrationStatus } from '../migrations';

const { values: a } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    status: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    only: { type: 'string' },
    force: { type: 'boolean', default: false },
    content: { type: 'string', default: '../../content/itti' },
  },
});

await connectDb();
try {
  if (a.status) {
    console.table((await migrationStatus()).map((m) => ({ migration: m.id, applied: m.appliedAt ? m.appliedAt.toISOString() : 'pending', description: m.description })));
  } else {
    const ran = await migrate({ contentDir: path.resolve(a.content!), dryRun: a['dry-run'], only: a.only, force: a.force });
    console.log(ran.length ? `\n✓ ${ran.length} migration(s) ${a['dry-run'] ? 'checked' : 'applied'}` : '\n✓ Database is up to date');
  }
} finally {
  await disconnectDb();
}
