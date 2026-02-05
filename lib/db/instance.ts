import { Kysely, PostgresDialect, SqliteDialect } from 'kysely';
import pg from 'pg';
import Sqlite from 'better-sqlite3';

import { type DB } from './db.generated.js';

export function createKyselyInstance() {
  // const pool = new pg.Pool({
  //   connectionString: process.env.DATABASE_URL,
  //   max: 1,
  // });
  // const dialect = new PostgresDialect({ pool });

  const database = new Sqlite('db.sqlite3');
  const dialect = new SqliteDialect({ database });

  return new Kysely<DB>({ dialect });
}
