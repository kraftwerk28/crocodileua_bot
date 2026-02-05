import { Migrator, FileMigrationProvider, Kysely } from 'kysely';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createKyselyInstance } from './instance.js';
import { type DB } from './db.generated.js';

function createMigrator(db?: Kysely<DB>) {
  db ??= createKyselyInstance();
  const migrationFolder = path.resolve('dist/migrations');
  const provider = new FileMigrationProvider({ path, fs, migrationFolder });
  return new Migrator({ db, provider });
}

export async function migrateToLatest(db?: Kysely<DB>) {
  const migrator = createMigrator();
  const { error, results } = await migrator.migrateToLatest();
  // const { error, results } = await migrator.migrateDown();
  if (error) throw error;
  return results!;
}
