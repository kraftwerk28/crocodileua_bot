import { Mw, Context } from './context';
import { checkWord, noop } from './utils';
import { Middleware, Markup } from 'telegraf';
import { GameState, endGame } from './game';

export const checkChatType: Middleware<Context> = (ctx, next = noop) => {
  const { chat } = ctx;
  if (!chat) return next();
  switch (chat.type) {
    case 'group':
    case 'supergroup':
      return next();
    case 'private':
      return ctx.reply(ctx.t('no_pm', [ctx.me!]), {
        disable_web_page_preview: true,
        ...Markup.inlineKeyboard([
          Markup.button.url(
            ctx.t('no_pm_button'),
            `https://t.me/${ctx.me}?startgroup=frompm`,
          ),
        ]),
      });
    default:
      break;
  }
};

export const onText: Mw = async function (ctx, next = noop) {
  const { from, chat, message, db } = ctx;
  if (!(chat && from && message)) return next();
  if (!('text' in message)) return next();
  const game = ctx.games.retrieveByContext(ctx);
  if (!game) return next();

  if (
    [GameState.PENDING, GameState.TIMED_OUT].includes(game.gameState) &&
    checkWord(message.text!, game.word)
  ) {
    if (from.id === game.leader.id) {
      // ctx.replyTo(t('unfair_player'));
      // Not honest game flow
    } else {
      await addUser(ctx, noop);
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
