import { type Kysely, sql } from 'kysely';

import { type DB } from '../lib/db/db.generated.js';
import { DbGameState } from '../lib/db/store.js';

export async function up(db: Kysely<DB>) {
  await db.schema
    .createTable('game')
    .addColumn('id', 'bigserial', (cb) => cb.primaryKey())
    .addColumn('created_at', 'timestamp', (cb) =>
      cb.notNull().defaultTo(sql`now()`),
    )
    .addColumn('chat_id', 'bigint', (cb) => cb.notNull())
    .addColumn('thread_id', 'bigint')
    .addColumn('game_message_id', 'bigint', (cb) => cb.notNull())
    .addColumn('game_end_message_id', 'bigint')
    .addColumn('win_at', 'timestamp')
    .addColumn('host_user_id', 'bigint', (cb) => cb.notNull())
    .addColumn('winner_user_id', 'bigint')
    .addColumn('word', 'text', (cb) => cb.notNull())
    .addColumn('state', 'integer', (cb) =>
      cb.notNull().defaultTo(DbGameState.Pending),
    )
    .execute();

  await db.schema
    .createTable('chat')
    .addColumn('id', 'bigint', (cb) => cb.primaryKey())
    .addColumn('title', 'text')
    .addColumn('username', 'text')
    .addColumn('word_dict', 'text', (cb) => cb.notNull().defaultTo('legacy'))
    .addColumn('game_duration_seconds', 'integer', (cb) =>
      cb.notNull().defaultTo(5 * 60),
    )
    .addColumn('win_hold_duration_seconds', 'integer', (cb) =>
      cb.notNull().defaultTo(5),
    )
    .execute();

  await db.schema
    .createTable('user')
    .addColumn('id', 'bigint', (cb) => cb.primaryKey())
    .addColumn('username', 'varchar(32)')
    .addColumn('first_name', 'text', (cb) => cb.notNull())
    .addColumn('last_name', 'text')
    .execute();

  await db.schema
    .createTable('chat_member')
    .addColumn('chat_id', 'bigint', (cb) => cb.notNull())
    .addColumn('user_id', 'bigint', (cb) => cb.notNull())
    .addColumn('legacy_win_count', 'integer', (cb) => cb.notNull().defaultTo(0))
    .addColumn('legacy_host_count', 'integer', (cb) =>
      cb.notNull().defaultTo(0),
    )
    .addPrimaryKeyConstraint('chat_member_pk', ['chat_id', 'user_id'])
    .execute();

  await sql`
    insert into "user" (id, username, first_name, last_name)
    (select user_id, username, first_name, last_name from "users")
  `.execute(db);

  await sql`
    insert into "chat_member" (chat_id, user_id, legacy_win_count, legacy_host_count)
    (select chat_id, user_id, wins, leadings from "chat_members")
  `.execute(db);
}

export async function down(db: Kysely<DB>) {
  await db.schema.dropTable('game').execute();
  await db.schema.dropTable('chat_member').execute();
  await db.schema.dropTable('chat').execute();
  await db.schema.dropTable('user').execute();
}
