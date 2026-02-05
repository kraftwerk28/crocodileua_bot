import { type Kysely, sql } from 'kysely';
import { type DB } from '../lib/db/db.generated.js';

export async function up(db: Kysely<DB>) {
  await db.schema
    .createTable('user')
    .addColumn('id', 'text', (cb) => cb.notNull().primaryKey())
    .addColumn('login', 'text', (cb) => cb.notNull())
    .addColumn('name', 'text', (cb) => cb)
    .addColumn('date_of_birth', 'timestamp', (cb) => cb)
    .addColumn('status', 'text', (cb) => cb.notNull()) // new, approved, not_approved, blocked
    .addColumn('comment', 'text', (cb) => cb)
    // .addColumn('password_hash', 'text', (cb) => cb.notNull()) // move to one-to-one table
    .execute();

  db.schema.createTable('password');

  db.schema
    .createTable('transaction')
    .addColumn('id', 'text', (cb) => cb.primaryKey()) // default from sqlite? or use nanoid
    .addColumn('created_at', 'timestamp', (cb) =>
      cb.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
    )
    .addColumn('action', 'text', (cb) => cb.notNull()) // bet, win, deposit, bonus, withdraw, correction
    .addColumn('diff', 'bigint', (cb) => cb.notNull())
    .addColumn('old_balance', 'bigint', (cb) => cb.notNull())
    .addColumn('new_balance', 'bigint', (cb) => cb.notNull())
    .addColumn('user', 'text', (cb) => cb.notNull().references('user.id'))
    .addColumn('issuer', 'text', (cb) => cb.notNull().references('user.id'))

    .addColumn('provider_id', 'text', (cb) => cb)
    .addColumn('game_id', 'text', (cb) => cb)
    .addColumn('session_id', 'text', (cb) => cb)
    .addColumn('action_id', 'text', (cb) => cb)

    .addColumn('comment', 'text')
    .execute();

  // BIGQUERY
  db.schema.createTable('transaction'); // copy transactions here from D1
  db.schema.createTable('user_action'); // user actions
}

export async function down(db: Kysely<DB>) {}
