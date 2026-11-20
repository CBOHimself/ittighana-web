/** Run on the server after each deploy: node --env-file=.env dist/sync-indexes.js */
import { allModels, connectDb, disconnectDb } from '@itti/db';

await connectDb();
for (const [name, m] of Object.entries(allModels)) {
  const dropped = await m.syncIndexes();
  console.log(`✓ ${name}${dropped.length ? ` (dropped ${dropped.join(', ')})` : ''}`);
}
await disconnectDb();
