import { connectDb, disconnectDb } from '../connection';
import { allModels } from '../models';

/** Run on every deploy (autoIndex is off in production). */
await connectDb();
for (const [name, m] of Object.entries(allModels)) {
  const dropped = await m.syncIndexes();
  console.log(`✓ ${name}${dropped.length ? ` (dropped: ${dropped.join(', ')})` : ''}`);
}
await disconnectDb();
