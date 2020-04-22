import { Mw } from './bot';
import { endGame, checkWord, noop } from './utils';

export const checkChatType: Mw = (ctx, next) => {
  const { chat } = ctx;
  if (!chat) return next!();
  if (['group', 'supergroup'].includes(chat.type)) return next!();
  return ctx.reply(ctx.t('no_pm'));
};

export const onText: Mw = async function (ctx, next = noop) {
  const { from, chat, t, message } = ctx;
  if (!(chat && from && message)) return next();
  const game = ctx.games.get(chat.id);
  if (!game) return next();

  if (checkWord(message.text!, game.word)) {
    if (from.id === game.leader.id) {
      // ctx.replyTo(t('unfair_player'));
      // Not honest game flow
    } else {
      endGame(ctx, from);
    }
  }
};
