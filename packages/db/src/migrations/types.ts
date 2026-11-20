import type { mongoose } from '../connection';

type Db = NonNullable<typeof mongoose.connection.db>;

export type MigrationContext = {
  db: Db;
  /** Folder with the exported site content (content/itti). */
  contentDir: string;
  log: (message: string) => void;
  dryRun: boolean;
};

export type Migration = {
  /** Sortable, never changes once released: "YYYYMMDD-NN-name". */
  id: string;
  description: string;
  up: (ctx: MigrationContext) => Promise<void>;
};
