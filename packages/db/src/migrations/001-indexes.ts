import { allModels } from '../models';
import type { Migration } from './types';

/** Create every collection's indexes (autoIndex is off in production). Re-run by `db:indexes` on deploys too. */
export const m001: Migration = {
  id: '20261116-01-indexes',
  description: 'Create collections and indexes for all content, forms, media, users and audit log',
  async up({ db, log, dryRun }) {
    for (const [name, model] of Object.entries(allModels)) {
      if (dryRun) { log(`would sync indexes: ${name}`); continue; }
      await model.createCollection().catch(() => undefined);
      await model.syncIndexes();
      log(`indexes: ${name}`);
    }
    if (!dryRun) {
      // Sign-in lockout counters expire a day after the first failure (apps/api login-guard).
      await db.collection('login_attempts').createIndex({ firstFailureAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });
      await db.collection('audit_log').createIndex({ entity: 1, createdAt: -1 });
    }
  },
};
