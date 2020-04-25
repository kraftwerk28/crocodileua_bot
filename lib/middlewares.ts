import { Mw } from './bot';
import { endGame, checkWord, noop, GameState } from './utils';

export const checkChatType: Mw = (ctx, next = noop) => {
  const { chat } = ctx;
  if (!chat) return next();
  if (['group', 'supergroup'].includes(chat.type)) return next();
  return ctx.reply(ctx.t('no_pm', [ctx.me!]), {
    disable_web_page_preview: true,
  });
};

export const onText: Mw = async function (ctx, next = noop) {
  const { from, chat, message, db } = ctx;
  if (!(chat && from && message)) return next();
  const game = ctx.games.get(chat.id);
  if (!game) return next();

  if (
    [GameState.PENDING, GameState.TIMED_OUT].includes(game.gameState) &&
    checkWord(message.text!, game.word)
  ) {
    if (from.id === game.leader.id) {
      // ctx.replyTo(t('unfair_player'));
      // Not honest game flow
    } else {
      await addUser(ctx);
      await db.query('SELECT * FROM increase_user_wins($1, $2)', [
        chat.id,
        from.id,
      ]);
      endGame(ctx, from);
    }
  }
  return next();
};

export const addUser: Mw = async function (ctx, next = noop) {
  const { from, chat } = ctx;
  if (!(from && chat)) return next();
  await ctx.db.query('SELECT * FROM add_chat_member($1, $2, $3, $4, $5)', [
    chat.id,
    from.id,
    from.username,
    from.first_name,
    from.last_name,
  ]);
  return next();
};
