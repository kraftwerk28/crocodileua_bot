import fsp from 'node:fs/promises';
import type { MatchedMiddleware } from 'telegraf/typings/composer';
import type { Context, Mw } from './context';
import { GameState, createGame } from './game';

export const onStart: Mw = async (ctx) => {
  const { from, games, chat } = ctx;
  if (!(from && chat)) return;
  const game = games.retrieveByContext(ctx);
  if (game && [GameState.PENDING, GameState.WINNING].includes(game?.gameState))
    return;
  return createGame(ctx);
};

export const rating: Mw = async function (ctx) {
  return ctx.replyTo(await ctx.getRating(ctx.chat), { parse_mode: 'HTML' });
};

export const globalRating: Mw = async function (ctx) {
  return ctx.replyTo(await ctx.getRating(), { parse_mode: 'HTML' });
};

export const toggleAlias: MatchedMiddleware<Context, 'text'>[0] =
  async function (ctx) {
    const { message, from, match } = ctx;
    if (!(message && from && match && message.reply_to_message?.from)) return;
    if (from.id !== ctx.CREATOR_ID) return;

    const { from: aliasee } = message.reply_to_message;
    let newAlias: string | undefined = match[1]?.trim();

    if (!newAlias) {
      await ctx.db.query(`DELETE FROM aliases WHERE user_id = $1`, [
        aliasee.id,
      ]);
    } else {
      await ctx.db.query(`SELECT add_alias($1, $2)`, [aliasee.id, newAlias]);
    }
  };

export const listAlias: Mw = async function (ctx) {
  const result = await ctx.db.query('SELECT * FROM aliases');
  const { message, from } = ctx;
  if (!message || from?.id !== ctx.CREATOR_ID) return;
  if (!result.rowCount) {
    await ctx.reply('No aliases so far...', {
      reply_to_message_id: message.message_id,
      message_thread_id: message?.message_thread_id,
    });
    return;
  }
  const text = result.rows
    .map((row, idx) => `${idx + 1}) ${row.user_id}: ${row.alias}`)
    .join('\n');
  ctx.reply(text, {
    reply_to_message_id: message.message_id,
    message_thread_id: message.message_thread_id,
  });
};

export const changelog: Mw = async function (ctx) {
  const changelog = await fsp.readFile('CHANGELOG.md', 'utf-8');
  return ctx.reply(changelog, {
    parse_mode: 'HTML',
    reply_to_message_id: ctx.message?.message_id,
  });
};
