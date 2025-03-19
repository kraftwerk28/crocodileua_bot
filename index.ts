import { sql } from 'kysely';
import { main } from './lib/bot.js';
import { logger } from './lib/log.js';
import { createKyselyInstance } from './lib/db/instance.js';
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('12');

try {
  const kysely = createKyselyInstance();

  await kysely.schema.dropTable('user').ifExists().execute();

  logger.info(
    await kysely.schema
      .createTable('user')
      .ifNotExists()
      .addColumn('id', 'varchar(32)', (cb) => cb.notNull().primaryKey())
      .addColumn('login', 'text', (cb) => cb.notNull())
      .addColumn('name', 'text', (cb) => cb)
      .addColumn('date_of_birth', 'timestamp', (cb) =>
        cb.check(sql`date_of_birth > 2000`),
      )
      .addColumn('status', 'text', (cb) =>
        cb
          .notNull()
          .check(sql`status in ('new', 'approved', 'not-approved', 'blocked')`),
      )
      .addColumn('comment', 'text', (cb) => cb)
      .execute(),
  );

  logger.info(
    await kysely
      .insertInto('user')
      .values({
        id: nanoid(),
        login: 'kraftwerk28',
        status: 'new',
      })
      .returningAll()
      .execute(),
  );

  // await main();
} catch (err) {
  logger.error(err);
}
