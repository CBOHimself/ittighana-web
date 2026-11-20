/**
 * Re-import structured site content (tools/wp-migrate → content/<site>/) into MongoDB.
 * The first import happens in migration 003; use this after a fresh export.
 *
 *   pnpm db:seed-content            # defaults to ../../content/itti
 *   pnpm db:seed-content -- --dir ../../content/itti --replace
 *
 * --replace overwrites layouts/fields that admins may have edited.
 */
import { parseArgs } from 'node:util';
import { connectDb, disconnectDb } from '../connection';
import { importContent } from '../import-content';

const { values: a } = parseArgs({ options: { dir: { type: 'string', default: '../../content/itti' }, replace: { type: 'boolean', default: false } } });
await connectDb();
console.table(await importContent(a.dir!, { replace: a.replace }));
await disconnectDb();
