import { type Mw, type Context } from './context.js';
import { checkWord, escapeHtml, noop } from './utils.js';
import { type Middleware, Markup } from 'telegraf';
import { DbGameState } from './db/store.js';
import { Action } from './actions.js';

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
  const { from, chat, message, t, telegram } = ctx;
  if (!(chat && from && message)) return next();
  if (!('text' in message)) return next();
  const game = await ctx.db.getGameByCtx(ctx);
  if (!game) return next();
  if (
    game.state === DbGameState.Pending &&
    checkWord(message.text!, game.word)
  ) {
    if (from.id === game.host_user_id) {
      // ctx.replyTo(t('unfair_player'));
      // Not honest game flow
    } else {
      const replyMarkup = Markup.inlineKeyboard([
        Markup.button.callback(t('request_play_btn'), Action.REQUEST_LEADING),
      ]);
      const endMessage = await telegram.sendMessage(
        game.chat_id,
        t('winner_msg', {
          word: escapeHtml(game.word),
          winner: await ctx.mention(from),
        }),
        {
          parse_mode: 'HTML',
          message_thread_id: game.thread_id,
          ...replyMarkup,
        },
      );
      await ctx.db.setGameWinner(game.id, from, endMessage);
    }
  }
  return next();
};

export const addUser: Mw = async function (ctx, next = noop) {
  const { from, chat } = ctx;
  if (!(from && chat)) return next();
  await Promise.all([ctx.db.saveUser(from), ctx.db.saveChatMember(chat, from)]);
  // await ctx.db.query('SELECT * FROM add_chat_member($1, $2, $3, $4, $5)', [
  //   chat.id,
  //   from.id,
  //   from.username,
  //   from.first_name,
  //   from.last_name,
  // ]);
  return next();
};
