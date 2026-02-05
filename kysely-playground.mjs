import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: 'postgres://kraftwerk28:271828@localhost/northwind',
});
const dialect = new PostgresDialect({ pool });
const kysely = new Kysely({ dialect });

const q = kysely.insertInto('transaction').values((eb) => ({
  id: '12345',
  balance: eb.fn.coalesce(
    eb
      .selectFrom('transaction as t2')
      .select('balance')
      .where('t2.id', '=', eb.ref('transaction.id'))
      .orderBy('transaction.created_at', 'desc')
      .limit(1),
    eb.val(0),
  ),
}));

// const q = kysely
//   .selectFrom('customers')
//   .select('customer_id')
//   .select((eb) =>
//     eb.fn
//       .coalesce(
//         eb
//           .selectFrom('orders')
//           .select('ship_via')
//           .where('orders.customer_id', '=', eb.ref('customers.customer_id'))
//           .limit(1),
//         eb.val(2),
//       )
//       .as('foo'),
//   )
//   .limit(10);

console.log(q.compile().sql);
try {
  console.dir(await q.execute(), { depth: undefined });
} catch (err) {
  console.error(err.message);
}
await kysely.destroy();
