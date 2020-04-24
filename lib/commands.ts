import { Mw } from './bot';
import { createGame, ratingMention, numNoun, GameState } from './utils';

export const onStart: Mw = async (ctx) => {
  const { from, games, chat } = ctx;
  if (!(from && chat)) return;
  const game = games.get(chat.id);
  if (game && [GameState.PENDING, GameState.WINNING].includes(game?.gameState))
    return;
  return createGame(ctx, from);
};

export const rating: Mw = async (ctx) => {
  const { chat, t } = ctx;
  if (!chat) return;
  const data = await ctx.db.query('SELECT * FROM get_chat_rating($1)', [
    chat?.id,
  ]);
  if (!data.rows.length) return ctx.replyTo(t('no_players_yet'));

  const ratingText = data.rows
    .map((r, i) =>
      t(i < 3 ? 'user_rating_bold' : 'user_rating', [
        (i + 1).toString(),
        ratingMention(r.first_name, r.last_name),
        r.wins,
        numNoun(r.wins),
      ])
    )
    .join('\n');

  const text = t('chat_rating_header') + '\n\n' + ratingText;

  return ctx.replyTo(text, { parse_mode: 'HTML' });
};

export const globalRating: Mw = async (ctx) => {
  const { t } = ctx;
  const data = await ctx.db.query('SELECT * FROM get_global_rating()');
  if (!data.rows.length) return ctx.replyTo(t('no_players_yet'));

  const ratingText = data.rows
    .map((r, i) =>
      t(i < 3 ? 'user_rating_bold' : 'user_rating', [
        (i + 1).toString(),
        ratingMention(r.first_name, r.last_name),
        r.wins,
        numNoun(r.wins),
      ])
    )
    .join('\n');

  const text = t('global_rating_header') + '\n\n' + ratingText;

  return ctx.replyTo(text, { parse_mode: 'HTML' });
};
