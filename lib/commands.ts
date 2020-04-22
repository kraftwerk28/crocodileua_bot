import { Mw } from './bot';
import { createGame } from './utils';

export const onStart: Mw = async (ctx) => {
  const { from, games, chat } = ctx;
  if (!(from && chat)) return;
  const game = games.get(chat.id);
  if (game?.gameEndMessageID) {
    return;
  }
  return createGame(ctx, from);
};
